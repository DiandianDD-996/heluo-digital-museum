#!/usr/bin/env node
/**
 * Luosheng v1 consolidated production isolation entrypoint (disabled state: zero UI, zero requests).
 * Usage: node frontend/scripts/luosheng-isolation.mjs
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const dir = dirname(fileURLToPath(import.meta.url))
const result = spawnSync(process.execPath, [join(dir, 'luosheng-production-check.mjs'), ...process.argv.slice(2)], {
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
