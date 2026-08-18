/**
 * Build wrapper that keeps every downloaded artefact inside ./.cache.
 *
 * Both cache env vars must be ABSOLUTE paths — the downloaders resolve them
 * relative to their own working directory, so a relative value silently falls
 * back to the machine-wide cache (%LOCALAPPDATA%\electron on Windows,
 * ~/Library/Caches/electron on macOS). Computing them here also means the
 * scripts stay identical on both platforms.
 *
 * Usage: node scripts/build.mjs --win [--dir]
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const cacheRoot = resolve(root, '.cache')
const electronCache = resolve(cacheRoot, 'electron')
const builderCache = resolve(cacheRoot, 'electron-builder')

mkdirSync(electronCache, { recursive: true })
mkdirSync(builderCache, { recursive: true })

// electron-builder extracts CommonJS helper tools (icon-tool.js, winCodeSign)
// into its cache. Now that the cache lives inside this project, Node walks up
// and finds our root package.json with "type": "module" and parses those
// helpers as ESM — they fail with "require is not defined". Marking the cache
// subtree as CommonJS stops that lookup at the right place.
writeFileSync(resolve(cacheRoot, 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2))

const env = {
  ...process.env,
  ELECTRON_CACHE: electronCache,
  electron_config_cache: electronCache,
  ELECTRON_BUILDER_CACHE: builderCache
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32'
  })
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('npx', ['electron-vite', 'build'])

// electron-builder passes an explicit cacheRoot to @electron/get for the
// Electron zip, which overrides ELECTRON_CACHE — so it has to be set through
// electron-builder's own config instead of the environment.
run('npx', [
  'electron-builder',
  ...process.argv.slice(2),
  `-c.electronDownload.cache=${electronCache}`
])
