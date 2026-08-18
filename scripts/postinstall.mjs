/**
 * Ensures Electron's binary is downloaded into THIS project's ./.cache/electron
 * rather than the machine-wide cache (%LOCALAPPDATA%\electron on Windows,
 * ~/Library/Caches/electron on macOS).
 *
 * Two problems this solves:
 *   1. electron/install.js only honours the lowercase `electron_config_cache`
 *      env var. Setting it in .npmrc no longer works — npm 11 rejects unknown
 *      config keys ("Unknown project config"), so it never reaches the script.
 *   2. npm sometimes skips electron's own postinstall entirely, leaving
 *      node_modules/electron with no dist/ and no path.txt. Running `npm run
 *      dev` then fails with a confusing "Electron failed to install" error.
 *
 * Our own postinstall runs after all dependencies are in place, so we can set
 * the env var and invoke electron's installer ourselves.
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const electronDir = resolve(root, 'node_modules', 'electron')

if (!existsSync(electronDir)) {
  // Production install (`npm ci --omit=dev`) — Electron isn't expected.
  process.exit(0)
}

if (existsSync(resolve(electronDir, 'path.txt'))) {
  process.exit(0)
}

console.log('[vidgif] Installing Electron into ./.cache/electron ...')

const result = spawnSync(process.execPath, [resolve(electronDir, 'install.js')], {
  cwd: electronDir,
  stdio: 'inherit',
  env: { ...process.env, electron_config_cache: resolve(root, '.cache', 'electron') }
})

if (result.status !== 0) {
  console.error('[vidgif] Electron install failed. Re-run `npm install`.')
  process.exit(result.status ?? 1)
}
