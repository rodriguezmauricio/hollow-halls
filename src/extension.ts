import * as vscode from 'vscode';
import { AgentManager } from '@/core/AgentManager';
import { providerForAgent } from '@/core/ProviderFactory';
import { loadSettings, openSettingsInEditor } from '@/core/Settings';
import { CostTracker, costForStream, formatCost } from '@/core/CostTracker';
import { designRoom } from '@/rooms/design';
import { uiuxRoom } from '@/rooms/uiux';
import { codeRoom } from '@/rooms/code';
import { frontRoom } from '@/rooms/front';
import { marketRoom } from '@/rooms/market';
import { secRoom } from '@/rooms/sec';
import type { Room } from '@/rooms/types';
import type { ExtensionMsg, RoomPublicInfo, WebviewMsg } from '@/messaging/protocol';

let panel: vscode.WebviewPanel | undefined;
let statusBar: vscode.StatusBarItem | undefined;
const costTracker = new CostTracker();

const ROOMS: readonly Room[] = [
  designRoom,
  uiuxRoom,
  codeRoom,
  frontRoom,
  marketRoom,
  secRoom,
];
const ROOM_BY_ID: Record<string, Room> = Object.fromEntries(ROOMS.map((r) => [r.id, r]));

export function activate(context: vscode.ExtensionContext): void {
  statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  statusBar.text = 'Hollow Halls · $0.00';
  statusBar.tooltip = 'Session spend across all Hollow Halls meetings';
  statusBar.command = 'hollowHalls.open';
  statusBar.show();
  costTracker.onChange((total) => {
    if (statusBar) statusBar.text = `Hollow Halls · ${formatCost(total)}`;
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
    wireMessages(panel, context);

    panel.onDidDispose(() => {
      panel = undefined;
    });
  });

  const editSettingsCmd = vscode.commands.registerCommand(
    'hollowHalls.editSettings',
    () => openSettingsInEditor(),
  );

  context.subscriptions.push(openCmd, editSettingsCmd);
}

export function deactivate(): void {
  panel?.dispose();
  panel = undefined;
  statusBar?.dispose();
  statusBar = undefined;
}

function wireMessages(p: vscode.WebviewPanel, context: vscode.ExtensionContext): void {
  p.webview.onDidReceiveMessage(async (raw: WebviewMsg) => {
    try {
      switch (raw.type) {
        case 'ready':
          send(p, {
            type: 'init',
            rooms: ROOMS.map(toPublic),
          });
          return;

        case 'open_room': {
          const room = ROOM_BY_ID[raw.roomId];
          if (!room) return;
          send(p, { type: 'room_opened', room: toPublic(room) });
          return;
        }

        case 'close_room':
          return;

        case 'send_prompt':
          await handleSendPrompt(p, context, raw);
          return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send(p, { type: 'error', message });
    }
  });
}

async function handleSendPrompt(
  p: vscode.WebviewPanel,
  context: vscode.ExtensionContext,
  msg: Extract<WebviewMsg, { type: 'send_prompt' }>,
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

  // Echo the user's prompt into the webview transcript first so the full
  // conversation is visible in the room view.
  send(p, { type: 'user_prompt', roomId, text: msg.prompt });
  send(p, { type: 'room_activity', roomId, busy: true });

  try {
    // Sequential (round-robin) so the transcript reads cleanly.
    for (const agent of agents) {
      let provider;
      try {
        provider = await providerForAgent(context, agent, settings);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        send(p, { type: 'error', message });
        return;
      }

      const manager = new AgentManager(provider);
      const providerId = provider.id;
      await manager.run(
        { room, agent, userPrompt: msg.prompt, meetingId },
        {
          onThinking: () =>
            send(p, { type: 'agent_thinking', roomId, meetingId, agentId: agent.id }),
          onChunk: (chunk) =>
            send(p, { type: 'agent_text_chunk', roomId, meetingId, agentId: agent.id, chunk }),
          onComplete: (result) => {
            const streamCost = costForStream({
              provider: providerId,
              model: result.model,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              providerReportedCostUSD: result.providerReportedCostUSD,
            });
            costTracker.record({
              roomId,
              agentId: agent.id,
              provider: providerId,
              model: result.model,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              costUSD: streamCost,
            });
            send(p, {
              type: 'cost_update',
              roomId,
              agentId: agent.id,
              provider: providerId,
              model: result.model,
              inputTokens: result.inputTokens,
              outputTokens: result.outputTokens,
              sessionTotalUSD: costTracker.sessionTotal,
              thisStreamUSD: streamCost,
            });
            send(p, { type: 'agent_message_complete', roomId, meetingId, agentId: agent.id });
          },
          onError: (err) =>
            send(p, { type: 'error', message: `${agent.name}: ${err.message}` }),
        },
      );
    }
  } finally {
    send(p, { type: 'room_activity', roomId, busy: false });
  }
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
