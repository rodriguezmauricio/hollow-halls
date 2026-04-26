import * as vscode from 'vscode';
import { AgentManager } from '@/core/AgentManager';
import { runChain } from '@/core/RoomChain';
import { CommonRoom, type Attending } from '@/core/CommonRoom';
import { resolveAgentCall, providerForModerator } from '@/core/ProviderFactory';
import { loadSettings, openSettingsInEditor } from '@/core/Settings';
import { CostTracker, costForStream, formatCost } from '@/core/CostTracker';
import { SkillsManager } from '@/core/SkillsManager';
import { savePlan } from '@/core/Persistence';
import { consult as oracleConsult } from '@/core/Oracle';
import { designRoom } from '@/rooms/design';
import { uiuxRoom } from '@/rooms/uiux';
import { codeRoom } from '@/rooms/code';
import { frontRoom } from '@/rooms/front';
import { marketRoom } from '@/rooms/market';
import { secRoom } from '@/rooms/sec';
import type { AgentDef, Room } from '@/rooms/types';
import type { PermissionMode, ToolUseEvent } from '@/api/provider';
import type {
  AttendingAgent,
  ExtensionMsg,
  RoomPublicInfo,
  WebviewMsg,
} from '@/messaging/protocol';

let panel: vscode.WebviewPanel | undefined;
let statusBar: vscode.StatusBarItem | undefined;
const costTracker = new CostTracker();

/** Per-meeting abort controllers so the webview can cancel a convening in flight. */
const meetingAborts = new Map<string, AbortController>();
/** Per-room abort controllers so the webview can stop an individual agent stream. */
const roomAborts = new Map<string, AbortController>();

/** First open workspace folder, or undefined when running on a virtual /
 *  empty workspace. Threaded into every Claude Code subprocess so file-
 *  reading tools resolve against the user's project, not VS Code's
 *  install dir. */
function workspaceCwd(): string | undefined {
  return vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

const ROOMS: readonly Room[] = [
  designRoom,
  uiuxRoom,
  codeRoom,
  frontRoom,
  marketRoom,
  secRoom,
];
const ROOM_BY_ID: Record<string, Room> = Object.fromEntries(ROOMS.map((r) => [r.id, r]));
const ALL_AGENTS: Record<string, { room: Room; agent: AgentDef }> = {};
for (const r of ROOMS) {
  for (const a of r.agents) ALL_AGENTS[a.id] = { room: r, agent: a };
}

export function activate(context: vscode.ExtensionContext): void {
  const skills = new SkillsManager(context);

  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = 'Hollow Halls · $0.00';
  statusBar.tooltip = 'Session spend across all Hollow Halls meetings';
  statusBar.command = 'hollowHalls.open';
  statusBar.show();

  // One-time soft warning at $0.50/session — tool use can burn Max's
  // rate budget fast, and the user should notice before runaway spend.
  let warned = false;
  costTracker.onChange((total) => {
    if (statusBar) statusBar.text = `Hollow Halls · ${formatCost(total)}`;
    if (!warned && total >= 0.5) {
      warned = true;
      vscode.window.showWarningMessage(
        `Hollow Halls session cost crossed ${formatCost(total)}. Switch agents to plan-only mode or cap --max-turns in settings if you want to slow spend.`,
        'Edit Settings',
      ).then((choice) => {
        if (choice === 'Edit Settings') openSettingsInEditor();
      });
    }
  });
  context.subscriptions.push(statusBar);

  const openCmd = vscode.commands.registerCommand('hollowHalls.open', () => {
    if (panel) {
      panel.reveal(vscode.ViewColumn.Active);
      return;
    }

    panel = vscode.window.createWebviewPanel(
      'hollowHalls',
      'The Hollow Halls',
      vscode.ViewColumn.Active,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'out'),
          vscode.Uri.joinPath(context.extensionUri, 'assets'),
        ],
      },
    );

    panel.webview.html = renderHtml(panel.webview, context.extensionUri);
    wireMessages(panel, context, skills);

    panel.onDidDispose(() => {
      for (const ctrl of meetingAborts.values()) ctrl.abort();
      meetingAborts.clear();
      for (const ctrl of roomAborts.values()) ctrl.abort();
      roomAborts.clear();
      panel = undefined;
    });
  });

  const editSettingsCmd = vscode.commands.registerCommand(
    'hollowHalls.editSettings',
    () => openSettingsInEditor(),
  );

  const editAgentSkillCmd = vscode.commands.registerCommand(
    'hollowHalls.editAgentSkill',
    async () => {
      const picks = Object.values(ALL_AGENTS).map(({ room, agent }) => ({
        label: agent.name,
        description: `${agent.tag} · ${room.name.toLowerCase()}`,
        agentId: agent.id,
      }));
      const picked = await vscode.window.showQuickPick(picks, {
        placeHolder: 'Which agent\'s SKILL.md do you want to edit?',
      });
      if (!picked) return;
      const { agent } = ALL_AGENTS[picked.agentId]!;
      const file = await skills.bundledSkillFile(agent);
      if (!file) {
        vscode.window.showErrorMessage(
          `No bundled SKILL.md found for ${agent.name}. Run \`npm run build\` to compile assets, or point this agent at a user-authored skill via .hollow/settings.json.`,
        );
        return;
      }
      const doc = await vscode.workspace.openTextDocument(file);
      await vscode.window.showTextDocument(doc);
    },
  );

  const createSkillCmd = vscode.commands.registerCommand(
    'hollowHalls.createSkill',
    async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Name for the new skill (lowercase, hyphen-separated)',
        placeHolder: 'brutalist-type',
        validateInput: (v) => (v.trim() ? undefined : 'Give it a name'),
      });
      if (!name) return;
      const uri = await skills.createUserSkillScaffold(name);
      if (!uri) {
        vscode.window.showWarningMessage('Open a workspace folder first — skills are workspace-scoped.');
        return;
      }
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc);
    },
  );

  context.subscriptions.push(openCmd, editSettingsCmd, editAgentSkillCmd, createSkillCmd);
}

export function deactivate(): void {
  panel?.dispose();
  panel = undefined;
  statusBar?.dispose();
  statusBar = undefined;
}

function wireMessages(
  p: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  skills: SkillsManager,
): void {
  p.webview.onDidReceiveMessage(async (raw: WebviewMsg) => {
    try {
      switch (raw.type) {
        case 'ready': {
          const initSettings = await loadSettings();
          const initProvider = initSettings.defaultProvider;
          const initModel = initSettings.providers[initProvider].defaultModel;
          send(p, {
            type: 'init',
            rooms: ROOMS.map(toPublic),
            provider: initProvider,
            model: initModel,
          });
          return;
        }

        case 'open_room': {
          const room = ROOM_BY_ID[raw.roomId];
          if (!room) return;
          const savedStateJson = context.workspaceState.get<string>(`hollowRoom:${raw.roomId}`);
          send(p, { type: 'room_opened', room: toPublic(room), savedStateJson });
          return;
        }

        case 'close_room':
          return;

        case 'save_room_state':
          // Best-effort — never block on this.
          void context.workspaceState.update(`hollowRoom:${raw.roomId}`, raw.stateJson);
          return;

        case 'send_prompt':
          await handleSendPrompt(p, context, skills, raw);
          return;

        case 'build_last_turn':
          // Re-run the exact prompt for a single agent in acceptEdits mode so
          // it can now execute (edits, bash, etc.). disableChain so BUILD
          // targets only this agent — no [NEXT:] handoffs.
          await handleSendPrompt(
            p,
            context,
            skills,
            {
              type: 'send_prompt',
              roomId: raw.roomId,
              agentIds: [raw.agentId],
              prompt: raw.prompt,
              permissionMode: 'acceptEdits',
            },
            { disableChain: true },
          );
          return;

        case 'open_great_hall':
          send(p, {
            type: 'great_hall_opened',
            roster: ROOMS.map((r) => ({
              roomId: r.id,
              roomName: r.name,
              accentColor: r.accentColor,
              agents: r.agents.map((a) => ({
                id: a.id,
                name: a.name,
                tag: a.tag,
                visual: a.visual,
              })),
            })),
          });
          return;

        case 'close_great_hall':
          return;

        case 'convene':
          await handleConvene(p, context, skills, raw);
          return;

        case 'cancel_meeting': {
          const ctrl = meetingAborts.get(raw.meetingId);
          if (ctrl) ctrl.abort();
          return;
        }

        case 'cancel_room_stream': {
          const ctrl = roomAborts.get(raw.roomId);
          if (ctrl) ctrl.abort();
          roomAborts.delete(raw.roomId);
          // Eagerly clear the busy state. On Windows the Claude CLI subprocess
          // can take a couple of seconds to fully die under shell:true (cmd.exe
          // shim holds stdout open), so the chain's finally block won't fire
          // immediately. Signal "done" to the UI now; any late chunks will
          // still render into the current turn but the prompt bar is unblocked.
          send(p, { type: 'room_activity', roomId: raw.roomId, busy: false });
          return;
        }

        case 'oracle_consult':
          await handleOracleConsult(p, context, raw.prompt);
          return;

        case 'open_file': {
          const uri = vscode.Uri.file(raw.path);
          vscode.commands.executeCommand('vscode.open', uri);
          return;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send(p, { type: 'error', message });
    }
  });
}

interface SendPromptOpts {
  /** Internal flag set by `build_last_turn` so BUILD never accidentally
   *  triggers a [NEXT:] chain — it should target one agent only. */
  readonly disableChain?: boolean;
}

async function handleSendPrompt(
  p: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  skills: SkillsManager,
  msg: Extract<WebviewMsg, { type: 'send_prompt' }>,
  opts: SendPromptOpts = {},
): Promise<void> {
  const room = ROOM_BY_ID[msg.roomId];
  if (!room) {
    send(p, { type: 'error', message: `Unknown room: ${msg.roomId}` });
    return;
  }

  const agents = room.agents.filter((a) => msg.agentIds.includes(a.id));
  if (agents.length === 0) {
    send(p, { type: 'error', message: 'No agents selected.' });
    return;
  }

  const settings = await loadSettings();
  const meetingId = `m_${Date.now().toString(36)}`;
  const roomId = room.id;

  const roomCtrl = new AbortController();
  roomAborts.set(roomId, roomCtrl);

  send(p, { type: 'user_prompt', roomId, text: msg.prompt });
  send(p, { type: 'room_activity', roomId, busy: true });

  try {
    // Single-agent + chain-allowed → run as a [NEXT:]/[DONE] chain so the
    // agent can hand off to a room-mate. Multi-agent (or BUILD) → keep the
    // legacy fan-out so each picked agent answers independently.
    const useChain = !opts.disableChain && agents.length === 1;

    if (useChain) {
      await runChainForRoom({
        p,
        context,
        skills,
        settings,
        room,
        firstAgent: agents[0]!,
        meetingId,
        msg,
        signal: roomCtrl.signal,
      });
    } else {
      for (const agent of agents) {
        if (roomCtrl.signal.aborted) break;
        await runFanoutForAgent({
          p,
          context,
          skills,
          settings,
          room,
          agent,
          meetingId,
          msg,
          signal: roomCtrl.signal,
        });
      }
    }
  } finally {
    roomAborts.delete(roomId);
    send(p, { type: 'room_activity', roomId, busy: false });
  }
}

interface SingleRunCtx {
  readonly p: vscode.WebviewPanel;
  readonly context: vscode.ExtensionContext;
  readonly skills: SkillsManager;
  readonly settings: Awaited<ReturnType<typeof loadSettings>>;
  readonly room: Room;
  readonly meetingId: string;
  readonly msg: Extract<WebviewMsg, { type: 'send_prompt' }>;
  readonly signal: AbortSignal;
}

/** Legacy fan-out path: one shot per picked agent, no inter-agent handoff. */
async function runFanoutForAgent(
  ctx: SingleRunCtx & { agent: AgentDef },
): Promise<void> {
  const { p, context, skills, settings, room, agent, meetingId, msg, signal } = ctx;
  const roomId = room.id;

  let call;
  try {
    call = await resolveAgentCall(context, agent, roomId, settings, skills);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send(p, { type: 'error', message });
    return;
  }

  const effectiveMode: PermissionMode = msg.permissionMode ?? call.permissionMode ?? 'default';
  const manager = new AgentManager(call.provider);
  const providerId = call.provider.id;
  let streamed = '';

  await manager.run(
    {
      room,
      agent,
      userPrompt: msg.prompt,
      meetingId,
      permissionMode: effectiveMode,
      skillsDir: call.skillsDir,
      maxTurns: call.maxTurns,
      maxTokens: call.maxTokens,
      thinking: msg.thinking,
      cwd: workspaceCwd(),
      signal,
    },
    {
      onThinking: () =>
        send(p, { type: 'agent_thinking', roomId, meetingId, agentId: agent.id }),
      onChunk: (chunk) => {
        streamed += chunk;
        send(p, { type: 'agent_text_chunk', roomId, meetingId, agentId: agent.id, chunk });
      },
      onToolUse: (event) => forwardToolUse(p, roomId, meetingId, agent.id, event),
      onComplete: (result) => {
        recordAndAnnounceCost({
          p, roomId, agentId: agent.id, providerId, result,
        });
        send(p, { type: 'agent_message_complete', roomId, meetingId, agentId: agent.id });
        if (effectiveMode === 'plan' && streamed.trim().length > 0) {
          savePlan({ roomId, agentId: agent.id, agentName: agent.name, body: streamed })
            .then((path) => {
              if (path) send(p, { type: 'plan_saved', roomId, agentId: agent.id, path });
            })
            .catch((err) => {
              console.error('[hollow halls] failed to save plan:', err);
            });
        }
      },
      onError: (err) =>
        send(p, { type: 'error', message: `${agent.name}: ${err.message}` }),
    },
  );
}

/** [NEXT:]/[DONE] chain path: agent A may hand off to a room-mate B, etc. */
async function runChainForRoom(
  ctx: SingleRunCtx & { firstAgent: AgentDef },
): Promise<void> {
  const { p, context, skills, settings, room, firstAgent, meetingId, msg, signal } = ctx;
  const roomId = room.id;
  const agentById: Record<string, AgentDef> = {};
  for (const a of room.agents) agentById[a.id] = a;
  const effectiveMode: PermissionMode = msg.permissionMode ?? 'default';

  await runChain(
    {
      room,
      firstAgent,
      userPrompt: msg.prompt,
      meetingId,
      permissionMode: msg.permissionMode,
      thinking: msg.thinking,
      cwd: workspaceCwd(),
      signal,
      resolveCall: (a) => resolveAgentCall(context, a, roomId, settings, skills),
    },
    {
      onAgentThinking: (agentId) =>
        send(p, { type: 'agent_thinking', roomId, meetingId, agentId }),
      onAgentChunk: (agentId, chunk) =>
        send(p, { type: 'agent_text_chunk', roomId, meetingId, agentId, chunk }),
      onAgentToolUse: (agentId, event) =>
        forwardToolUse(p, roomId, meetingId, agentId, event),
      onAgentComplete: (agentId, cleanText, result, providerId) => {
        recordAndAnnounceCost({ p, roomId, agentId, providerId, result });
        send(p, { type: 'agent_message_complete', roomId, meetingId, agentId });
        if (effectiveMode === 'plan' && cleanText.trim().length > 0) {
          const a = agentById[agentId];
          if (a) {
            savePlan({ roomId, agentId, agentName: a.name, body: cleanText })
              .then((path) => {
                if (path) send(p, { type: 'plan_saved', roomId, agentId, path });
              })
              .catch((err) => {
                console.error('[hollow halls] failed to save plan:', err);
              });
          }
        }
      },
      onAgentError: (agentId, err) => {
        const a = agentById[agentId];
        const name = a ? a.name : agentId;
        send(p, { type: 'error', message: `${name}: ${err.message}` });
      },
      onHandoff: (fromAgentId, toAgentId) =>
        send(p, { type: 'chain_handoff', roomId, meetingId, fromAgentId, toAgentId }),
      onChainError: (kind, message) =>
        send(p, { type: 'chain_error', roomId, meetingId, kind, message }),
    },
  );
}

function recordAndAnnounceCost(args: {
  readonly p: vscode.WebviewPanel;
  readonly roomId: string;
  readonly agentId: string;
  readonly providerId: 'anthropic' | 'ollama' | 'claude-code';
  readonly result: import('@/api/provider').StreamResult;
}): void {
  const { p, roomId, agentId, providerId, result } = args;
  const streamCost = costForStream({
    provider: providerId,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    providerReportedCostUSD: result.providerReportedCostUSD,
  });
  costTracker.record({
    roomId,
    agentId,
    provider: providerId,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUSD: streamCost,
  });
  send(p, {
    type: 'cost_update',
    roomId,
    agentId,
    provider: providerId,
    model: result.model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    sessionTotalUSD: costTracker.sessionTotal,
    thisStreamUSD: streamCost,
  });
}

async function handleConvene(
  p: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  skills: SkillsManager,
  msg: Extract<WebviewMsg, { type: 'convene' }>,
): Promise<void> {
  const attending: Attending[] = [];
  const attendingPublic: AttendingAgent[] = [];
  for (const pick of msg.picks) {
    const room = ROOM_BY_ID[pick.roomId];
    const agent = room?.agents.find((a) => a.id === pick.agentId);
    if (!room || !agent) continue;
    attending.push({ room, agent });
    attendingPublic.push({
      roomId: room.id,
      roomName: room.name,
      accentColor: room.accentColor,
      agent: { id: agent.id, name: agent.name, tag: agent.tag, visual: agent.visual },
    });
  }

  if (attending.length === 0) {
    send(p, { type: 'error', message: 'Pick at least one agent to convene.' });
    return;
  }

  const settings = await loadSettings();
  const meetingId = `m_${Date.now().toString(36)}`;
  const controller = new AbortController();
  meetingAborts.set(meetingId, controller);

  send(p, { type: 'meeting_started', meetingId, attending: attendingPublic, task: msg.task });
  send(p, { type: 'room_activity', roomId: 'common', busy: true });

  const common = new CommonRoom(context, settings, skills);
  try {
    await common.convene(
      { meetingId, task: msg.task, attending, permissionMode: msg.permissionMode, thinking: msg.thinking, cwd: workspaceCwd() },
      {
        onModeratorPick: (agentId, rationale) =>
          send(p, { type: 'moderator_pick', meetingId, agentId, rationale }),
        onAgentThinking: (agentId) =>
          send(p, { type: 'agent_thinking', roomId: 'common', meetingId, agentId }),
        onAgentChunk: (agentId, chunk) =>
          send(p, { type: 'agent_text_chunk', roomId: 'common', meetingId, agentId, chunk }),
        onAgentToolUse: (agentId, event) =>
          forwardToolUse(p, 'common', meetingId, agentId, event),
        onAgentComplete: (agentId, result, costUSD) => {
          const found = attending.find((a) => a.agent.id === agentId);
          const providerId = providerIdForAgent(found?.agent.id, settings);
          costTracker.record({
            roomId: 'common',
            agentId,
            provider: providerId,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            costUSD,
          });
          send(p, {
            type: 'cost_update',
            roomId: 'common',
            agentId,
            provider: providerId,
            model: result.model,
            inputTokens: result.inputTokens,
            outputTokens: result.outputTokens,
            sessionTotalUSD: costTracker.sessionTotal,
            thisStreamUSD: costUSD,
          });
          send(p, { type: 'agent_message_complete', roomId: 'common', meetingId, agentId });
        },
        onAgentAborted: (agentId) =>
          send(p, { type: 'agent_message_complete', roomId: 'common', meetingId, agentId }),
        onMeetingEnded: ({ reason, turns, costUSD, transcriptPath }) => {
          send(p, { type: 'meeting_ended', meetingId, reason, turns, costUSD, transcriptPath });
          send(p, { type: 'room_activity', roomId: 'common', busy: false });
        },
        onError: (err) => send(p, { type: 'error', message: err.message }),
      },
      controller.signal,
    );
  } finally {
    meetingAborts.delete(meetingId);
  }
}

async function handleOracleConsult(
  p: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  prompt: string,
): Promise<void> {
  const settings = await loadSettings();
  send(p, { type: 'oracle_thinking' });
  try {
    const provider = await providerForModerator(context, settings);
    const decision = await oracleConsult(prompt, ROOMS, provider);
    send(p, { type: 'oracle_response', decision });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send(p, { type: 'error', message: `Oracle: ${message}` });
  }
}

function forwardToolUse(
  p: vscode.WebviewPanel,
  roomId: string,
  meetingId: string,
  agentId: string,
  event: ToolUseEvent,
): void {
  const summary = formatToolSummary(event);
  send(p, {
    type: 'agent_tool_use',
    roomId,
    meetingId,
    agentId,
    phase: event.phase,
    toolName: event.toolName,
    summary,
    isError: event.isError,
    toolUseId: event.toolUseId,
  });
}

function formatToolSummary(event: ToolUseEvent): string {
  if (event.phase === 'start') {
    const input = summarizeInput(event.input);
    return input ? `${event.toolName}(${input})` : `${event.toolName}`;
  }
  const out = (event.output ?? '').trim();
  if (!out) return event.isError ? 'error (no output)' : '✓';
  const oneLine = out.replace(/\s+/g, ' ');
  return oneLine.length > 120 ? oneLine.slice(0, 117) + '…' : oneLine;
}

function summarizeInput(input: unknown): string {
  if (input == null) return '';
  if (typeof input === 'string') return input.length > 80 ? input.slice(0, 77) + '…' : input;
  if (typeof input !== 'object') return String(input);
  const obj = input as Record<string, unknown>;
  // Common-case shortcuts.
  for (const key of ['file_path', 'path', 'command', 'pattern', 'query', 'url']) {
    if (typeof obj[key] === 'string') {
      const v = obj[key] as string;
      return v.length > 80 ? v.slice(0, 77) + '…' : v;
    }
  }
  try {
    const json = JSON.stringify(obj);
    return json.length > 80 ? json.slice(0, 77) + '…' : json;
  } catch {
    return '';
  }
}

function providerIdForAgent(
  agentId: string | undefined,
  settings: Awaited<ReturnType<typeof loadSettings>>,
): 'anthropic' | 'ollama' | 'claude-code' {
  if (agentId && settings.agentOverrides[agentId]?.provider) {
    return settings.agentOverrides[agentId]!.provider!;
  }
  return settings.defaultProvider;
}

function send(p: vscode.WebviewPanel, msg: ExtensionMsg): void {
  p.webview.postMessage(msg);
}

function toPublic(room: Room): RoomPublicInfo {
  return {
    id: room.id,
    name: room.name,
    subtitle: room.subtitle,
    description: room.description,
    accentColor: room.accentColor,
    agents: room.agents.map((a) => ({
      id: a.id,
      name: a.name,
      tag: a.tag,
      visual: a.visual,
    })),
  };
}

function renderHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'out', 'webview.js'),
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'out', 'webview.css'),
  );
  const nonce = makeNonce();
  const csp = [
    `default-src 'none'`,
    `img-src ${webview.cspSource} data:`,
    `style-src ${webview.cspSource}`,
    `font-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>The Hollow Halls</title>
    <link rel="stylesheet" href="${styleUri}" />
  </head>
  <body>
    <div id="root"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function makeNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
