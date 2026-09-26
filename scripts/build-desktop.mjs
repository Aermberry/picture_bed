/**
 * Build Windows NSIS installer via electron-builder API.
 * Avoids the CLI re-spawn path (process.execPath is the host app under MiMo's bundled node).
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'electron-builder';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const result = await build({
  projectDir: root,
  // Build only — Release asset upload is done by `gh release upload` in CI,
  // not by electron-builder (avoids GH_TOKEN publish path on tag builds).
  publish: 'never',
  win: ['nsis'],
  x64: true,
  config: {
    appId: 'com.aermberry.picbed',
    productName: 'picbed',
    copyright: 'Copyright © Aermberry',
    // npm package has no "main"; desktop entry is injected only into the packaged app
    extraMetadata: {
      main: 'desktop/main.mjs',
    },
    directories: {
      output: path.join(root, 'release'),
      buildResources: path.join(root, 'desktop'),
    },
    files: [
      'dist/**/*',
      'desktop/**/*',
      'package.json',
      '!**/*.map',
      '!**/node_modules/**/{test,tests,__tests__,docs,doc}/**',
    ],
    asar: true,
    win: {
      target: [{ target: 'nsis', arch: ['x64'] }],
      artifactName: 'picbed-setup-${version}.${ext}',
    },
    nsis: {
      oneClick: true,
      perMachine: false,
      allowToChangeInstallationDirectory: false,
      createDesktopShortcut: true,
      createStartMenuShortcut: true,
      shortcutName: 'picbed',
    },
  },
});

console.log('built artifacts:');
for (const file of result) {
  console.log(' -', file);
}
