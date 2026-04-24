import { build, context } from 'esbuild';
import { resolve, dirname } from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';

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
