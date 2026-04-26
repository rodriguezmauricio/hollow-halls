import * as vscode from 'vscode';

// ===== Custom Room persistence =====

export interface CustomRoomJson {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly accentColor: string;
  readonly createdAt: string;
}

export async function loadCustomRooms(): Promise<CustomRoomJson[]> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return [];
  const dirUri = vscode.Uri.joinPath(folder.uri, '.hollow', 'rooms');
  let entries: [string, vscode.FileType][];
  try {
    entries = await vscode.workspace.fs.readDirectory(dirUri);
  } catch {
    return [];
  }
  const rooms: CustomRoomJson[] = [];
  for (const [name, type] of entries) {
    if (type !== vscode.FileType.File || !name.endsWith('.json')) continue;
    try {
      const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(dirUri, name));
      const raw = JSON.parse(new TextDecoder().decode(bytes)) as Partial<CustomRoomJson>;
      if (typeof raw.id === 'string' && typeof raw.name === 'string') {
        rooms.push({
          id: raw.id,
          name: raw.name,
          description: raw.description ?? '',
          accentColor: raw.accentColor ?? '#9de0f0',
          createdAt: raw.createdAt ?? new Date().toISOString(),
        });
      }
    } catch {
      // skip malformed files
    }
  }
  return rooms;
}

export async function saveCustomRoom(room: CustomRoomJson): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return;
  const dirUri = vscode.Uri.joinPath(folder.uri, '.hollow', 'rooms');
  try { await vscode.workspace.fs.createDirectory(dirUri); } catch { /* exists */ }
  const fileUri = vscode.Uri.joinPath(dirUri, `${room.id}.json`);
  await vscode.workspace.fs.writeFile(fileUri, new TextEncoder().encode(JSON.stringify(room, null, 2) + '\n'));
}

export async function deleteCustomRoom(id: string): Promise<void> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return;
  const fileUri = vscode.Uri.joinPath(folder.uri, '.hollow', 'rooms', `${id}.json`);
  try { await vscode.workspace.fs.delete(fileUri); } catch { /* already gone */ }
}

// ===== Transcript + plan persistence =====

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
