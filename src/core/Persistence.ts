import * as vscode from 'vscode';

export interface TranscriptMessage {
  readonly agentId: string;
  readonly agentName: string;
  readonly roomId: string;
  readonly text: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly costUSD: number;
  readonly at: number;
}

export interface TranscriptFile {
  readonly id: string;
  readonly roomId: 'common';
  readonly startedAt: string;
  readonly endedAt: string;
  readonly task: string;
  readonly attending: readonly string[];
  readonly messages: readonly TranscriptMessage[];
  readonly costUSD: number;
  readonly endReason: 'done' | 'turn_limit' | 'cancelled' | 'error';
}

/**
 * Write a Great Hall meeting transcript to
 * `<workspace>/.hollow/transcripts/{iso}_great-hall_{shortId}.json`.
 *
 * Returns the absolute fsPath so the UI can surface it. Returns undefined
 * when no workspace is open (meetings still run; they just aren't saved).
 */
/**
 * Save a plan-mode reply to `<workspace>/.hollow/plans/{iso}_{roomId}_{agentId}.md`.
 * Returns the absolute fsPath, or undefined when no workspace folder is open.
 */
export async function savePlan(args: {
  roomId: string;
  agentId: string;
  agentName: string;
  body: string;
}): Promise<string | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;

  const dirUri = vscode.Uri.joinPath(folder.uri, '.hollow', 'plans');
  try {
    await vscode.workspace.fs.createDirectory(dirUri);
  } catch {
    // already exists — fine
  }

  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${iso}_${args.roomId}_${args.agentId}.md`;
  const fileUri = vscode.Uri.joinPath(dirUri, fileName);
  const header = `# Plan — ${args.agentName} (${args.roomId})\n\n`;
  const bytes = new TextEncoder().encode(header + args.body.trim() + '\n');
  await vscode.workspace.fs.writeFile(fileUri, bytes);
  return fileUri.fsPath;
}

export async function saveGreatHallTranscript(t: TranscriptFile): Promise<string | undefined> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;

  const dirUri = vscode.Uri.joinPath(folder.uri, '.hollow', 'transcripts');
  try {
    await vscode.workspace.fs.createDirectory(dirUri);
  } catch {
    // already exists — fine
  }

  const isoSafe = t.startedAt.replace(/[:.]/g, '-');
  const fileName = `${isoSafe}_great-hall_${t.id}.json`;
  const fileUri = vscode.Uri.joinPath(dirUri, fileName);
  const body = JSON.stringify(t, null, 2) + '\n';
  await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(body));
  return fileUri.fsPath;
}
