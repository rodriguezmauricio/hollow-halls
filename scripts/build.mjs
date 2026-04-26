import { build, context } from 'esbuild';
import { resolve, dirname, join } from 'node:path';
import { copyFile, mkdir, readdir } from 'node:fs/promises';

const watch = process.argv.includes('--watch');
const production = process.env.NODE_ENV === 'production';

const shared = {
  bundle: true,
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
  target: 'es2022',
  tsconfig: resolve('tsconfig.json'),
};

const extensionBuild = {
  ...shared,
  entryPoints: ['src/extension.ts'],
  outfile: 'out/extension.js',
  platform: 'node',
  format: 'cjs',
  // Runtime deps stay external — vsce bundles node_modules into the .vsix,
  // so we `require()` them at runtime instead of ballooning our JS bundle.
  // Keeps us well under the 500 KB extension budget from CLAUDE.md.
  external: ['vscode', '@anthropic-ai/sdk', 'ollama'],
};

const webviewBuild = {
  ...shared,
  entryPoints: ['webview/main.ts'],
  outfile: 'out/webview.js',
  platform: 'browser',
  format: 'iife',
};

// Assets the webview serves directly: CSS + bundled fonts.
// Paths here are source → destination (relative to out/).
const assets = [
  { src: 'webview/theme/hollow.css',                                           dst: 'out/webview.css' },
  { src: 'node_modules/@fontsource/cinzel/files/cinzel-latin-400-normal.woff2', dst: 'out/fonts/cinzel-400.woff2' },
  { src: 'node_modules/@fontsource/cinzel/files/cinzel-latin-600-normal.woff2', dst: 'out/fonts/cinzel-600.woff2' },
  { src: 'node_modules/@fontsource/cinzel/files/cinzel-latin-700-normal.woff2', dst: 'out/fonts/cinzel-700.woff2' },
  { src: 'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-300-normal.woff2',  dst: 'out/fonts/plex-300.woff2' },
  { src: 'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2',  dst: 'out/fonts/plex-400.woff2' },
  { src: 'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2',  dst: 'out/fonts/plex-500.woff2' },
  { src: 'node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-italic.woff2',  dst: 'out/fonts/plex-400-italic.woff2' },
];

async function copyAssets() {
  await Promise.all(
    assets.map(async ({ src, dst }) => {
      await mkdir(dirname(dst), { recursive: true });
      await copyFile(src, dst);
    }),
  );
  await copySkills();
}

/**
 * Copies each agent's bundled skill from
 *   assets/skills/<id>/...files
 * to
 *   out/skills/<id>/.claude/skills/<id>/...files
 *
 * The outer `out/skills/<id>` is the directory the extension passes to
 * `claude --add-dir`, and the inner `.claude/skills/<id>/` is where Claude
 * Code auto-discovers the skill. This scoping means one agent's call only
 * sees its own skill, never its neighbors'.
 */
async function copySkills() {
  let entries;
  try {
    entries = await readdir('assets/skills', { withFileTypes: true });
  } catch {
    return; // no skills authored yet — not an error
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillId = entry.name;
    const srcDir = join('assets/skills', skillId);
    const dstDir = join('out/skills', skillId, '.claude', 'skills', skillId);
    await copyTree(srcDir, dstDir);
  }
}

async function copyTree(srcDir, dstDir) {
  await mkdir(dstDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const s = join(srcDir, entry.name);
    const d = join(dstDir, entry.name);
    if (entry.isDirectory()) {
      await copyTree(s, d);
    } else if (entry.isFile()) {
      await copyFile(s, d);
    }
  }
}

async function run() {
  await copyAssets();
  if (watch) {
    const [ext, web] = await Promise.all([
      context(extensionBuild),
      context(webviewBuild),
    ]);
    await Promise.all([ext.watch(), web.watch()]);
    console.log('[hollow-halls] watching…');
  } else {
    await Promise.all([build(extensionBuild), build(webviewBuild)]);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
