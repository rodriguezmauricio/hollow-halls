import * as vscode from 'vscode';

const SECRET_KEY = 'hollowHalls.anthropicApiKey';

export async function getApiKey(
  context: vscode.ExtensionContext,
): Promise<string | undefined> {
  const existing = await context.secrets.get(SECRET_KEY);
  if (existing) return existing;

  const entered = await vscode.window.showInputBox({
    title: 'Hollow Halls — Anthropic API Key',
    prompt: 'Paste your Anthropic API key. Stored securely in VS Code SecretStorage.',
    password: true,
    ignoreFocusOut: true,
    placeHolder: 'sk-ant-…',
    validateInput: (v) => (v.trim().startsWith('sk-ant-') ? null : 'Expected a key starting with sk-ant-'),
  });

  if (!entered) return undefined;
  await context.secrets.store(SECRET_KEY, entered.trim());
  return entered.trim();
}

export async function clearApiKey(context: vscode.ExtensionContext): Promise<void> {
  await context.secrets.delete(SECRET_KEY);
}
