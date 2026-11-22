#!/usr/bin/env node
/**
 * Luosheng v1 consolidated E2E entrypoint (delegates to the core HTTP/preset check).
 * Usage: node frontend/scripts/luosheng-e2e.mjs
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const result = spawnSync(process.execPath, [join(dir, 'luosheng-preset-check.mjs'), ...process.argv.slice(2)], {
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
