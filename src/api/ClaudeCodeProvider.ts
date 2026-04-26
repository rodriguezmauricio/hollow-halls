import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  ProviderUnavailableError,
  type LlmProvider,
  type StreamArgs,
  type StreamResult,
  type ToolUseEvent,
} from './provider';

/**
 * Shells out to the `claude` CLI in headless mode. Inherits the user's keychain
 * OAuth — so a Max subscriber gets Sonnet-quality inference without an API key.
 *
 * Contract (see https://code.claude.com/docs/en/headless):
 *   claude -p
 *     --system-prompt-file <tmpfile>
 *     --model <sonnet|haiku|...>
 *     --max-turns 1              # one model turn, no tool/agent loop
 *     --output-format stream-json
 *     --verbose
 *     --include-partial-messages
 *   (user prompt piped on stdin)
 *
 * No `--bare`: bare mode skips OAuth keychain reads, which defeats the purpose.
 */

export interface ClaudeCodeProviderOptions {
  readonly model: string;
  readonly binaryPath?: string; // override for tests / non-PATH installs
}

export class ClaudeCodeProvider implements LlmProvider {
  readonly id = 'claude-code' as const;

  constructor(private readonly opts: ClaudeCodeProviderOptions) {}

  async stream(args: StreamArgs): Promise<StreamResult> {
    const systemFile = await writeTempFile(args.system);
    let child: ChildProcess | undefined;
    let full = '';
    let inputTokens = 0;
    let outputTokens = 0;
    let resolvedModel = this.opts.model;
    let reportedCost: number | undefined;
    let authFailed = false;
    let stderr = '';

    try {
      const binary = this.opts.binaryPath ?? defaultBinary();
      const maxTurns = Math.max(1, args.maxTurns ?? 1);
      const cliArgs = [
        '-p',
        '--system-prompt-file', systemFile,
        '--model', this.opts.model,
        '--max-turns', String(maxTurns),
        '--output-format', 'stream-json',
        '--verbose',
        '--include-partial-messages',
      ];
      if (args.permissionMode) {
        cliArgs.push('--permission-mode', args.permissionMode);
      }
      if (args.skillsDir) {
        // `.claude/skills/` within the added dir is auto-loaded by Claude Code,
        // scoping the agent to exactly the skill we ship for them.
        cliArgs.push('--add-dir', args.skillsDir);
      }

      child = spawn(binary, cliArgs, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
        // shell:true on Windows is required because `claude` is a .cmd shim
        // post-CVE-2024-27980. All our args are safe (flags + absolute path +
        // short model id), and the user prompt goes through stdin, so no shell
        // interpolation of untrusted text happens.
      });

      child.stdin!.end(args.userPrompt);

      child.stderr!.setEncoding('utf8');
      child.stderr!.on('data', (chunk: string) => {
        stderr += chunk;
      });

      const onAbort = () => child?.kill();
      args.signal?.addEventListener('abort', onAbort);

      try {
        await parseStream(child.stdout!, {
          onTextDelta: (delta) => {
            full += delta;
            args.onTextChunk(delta);
          },
          onResult: (r) => {
            inputTokens = r.inputTokens;
            outputTokens = r.outputTokens;
            if (r.model) resolvedModel = r.model;
            if (typeof r.costUSD === 'number') reportedCost = r.costUSD;
          },
          onAuthFailed: () => {
            authFailed = true;
          },
          onToolUse: args.onToolUse,
        });

        const exitCode = await waitForExit(child);
        args.signal?.removeEventListener('abort', onAbort);

        if (authFailed) {
          throw new ProviderUnavailableError(
            'claude-code',
            "Claude Code is installed but not authenticated. Run 'claude auth login' in a terminal, then retry.",
          );
        }
        if (exitCode !== 0 && !args.signal?.aborted) {
          throw new ProviderUnavailableError(
            'claude-code',
            `Claude Code exited with code ${exitCode}.${stderr ? `\n${stderr.trim()}` : ''}`,
          );
        }
      } finally {
        args.signal?.removeEventListener('abort', onAbort);
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
        throw new ProviderUnavailableError(
          'claude-code',
          "Claude Code CLI not found on PATH. Install from https://docs.claude.com/en/docs/claude-code, run 'claude auth login', then retry.",
        );
      }
      throw err;
    } finally {
      await rm(systemFile, { force: true }).catch(() => {});
    }

    return {
      fullText: full,
      inputTokens,
      outputTokens,
      model: resolvedModel,
      providerReportedCostUSD: reportedCost,
    };
  }
}

function defaultBinary(): string {
  // On Windows, npm installs `claude.cmd` on PATH. Node's spawn with shell:true
  // handles the .cmd extension; we don't need to specify it.
  return 'claude';
}

async function writeTempFile(content: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'hollow-halls-'));
  const path = join(dir, 'system.txt');
  await writeFile(path, content, 'utf8');
  return path;
}

interface StreamCallbacks {
  onTextDelta: (chunk: string) => void;
  onResult: (r: { inputTokens: number; outputTokens: number; model?: string; costUSD?: number }) => void;
  onAuthFailed: () => void;
  onToolUse?: (event: ToolUseEvent) => void;
}

async function parseStream(stdout: NodeJS.ReadableStream, cb: StreamCallbacks): Promise<void> {
  stdout.setEncoding('utf8');
  let buffer = '';
  for await (const chunk of stdout as AsyncIterable<string>) {
    buffer += chunk;
    let newline: number;
    while ((newline = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;
      handleLine(line, cb);
    }
  }
  const tail = buffer.trim();
  if (tail) handleLine(tail, cb);
}

function handleLine(line: string, cb: StreamCallbacks): void {
  let msg: any;
  try {
    msg = JSON.parse(line);
  } catch {
    // The CLI occasionally emits non-JSON status lines; skip them silently.
    return;
  }

  if (msg?.type === 'stream_event') {
    const ev = msg.event;
    if (ev?.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
      const text = ev.delta.text;
      if (typeof text === 'string' && text.length > 0) cb.onTextDelta(text);
      return;
    }
    // Tool-use start: the model is calling a tool. Fires once when the model
    // commits to a tool name; its input payload may follow in subsequent
    // input_json_delta events but we only surface the initial name + id here.
    if (ev?.type === 'content_block_start' && ev.content_block?.type === 'tool_use') {
      cb.onToolUse?.({
        phase: 'start',
        toolName: String(ev.content_block.name ?? 'tool'),
        toolUseId: typeof ev.content_block.id === 'string' ? ev.content_block.id : undefined,
        input: ev.content_block.input,
      });
    }
    return;
  }

  // A `user` message with content_block.type === 'tool_result' carries the
  // tool's output back to the model — we surface it as our 'result' phase so
  // the transcript can render a paired line.
  if (msg?.type === 'user' && Array.isArray(msg.message?.content)) {
    for (const block of msg.message.content) {
      if (block?.type === 'tool_result') {
        const output = extractToolResultText(block.content);
        cb.onToolUse?.({
          phase: 'result',
          toolName: 'tool',
          toolUseId: typeof block.tool_use_id === 'string' ? block.tool_use_id : undefined,
          output,
          isError: block.is_error === true,
        });
      }
    }
    return;
  }

  if (msg?.type === 'result') {
    const usage = msg.usage ?? {};
    cb.onResult({
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      model: msg.model,
      costUSD: typeof msg.total_cost_usd === 'number' ? msg.total_cost_usd : undefined,
    });
    return;
  }

  if (msg?.type === 'system' && msg?.subtype === 'api_retry' && msg?.error === 'authentication_failed') {
    cb.onAuthFailed();
  }
}

function extractToolResultText(content: unknown): string | undefined {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const b of content) {
      if (b && typeof b === 'object' && (b as { type?: unknown }).type === 'text') {
        const text = (b as { text?: unknown }).text;
        if (typeof text === 'string') parts.push(text);
      }
    }
    if (parts.length > 0) return parts.join('\n');
  }
  return undefined;
}

function waitForExit(child: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve(child.exitCode);
    child.once('exit', (code) => resolve(code ?? 0));
  });
}
