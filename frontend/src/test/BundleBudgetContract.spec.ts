/// <reference types="node" />

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
// @ts-expect-error -- plain .mjs script with no type declarations, shared with the build.
import { budgetFailures, collectBudgetSummary, initialCssFiles, initialJsFiles } from '../../scripts/bundle-budget.mjs'

/**
 * The gate's job is to notice regressions in the *first-paint* cost. It used
 * to measure every JS file in `dist/assets`, which is not that: every view in
 * this app is a dynamic `import()`, so the old number was roughly 6.7x the
 * real first-paint cost and could not tell a heavier landing page from a
 * heavier lazily-loaded chunk.
 *
 * These tests pin the corrected metric rather than the numbers, so a future
 * edit that quietly widens the measurement back out fails here.
 */

/** A throwaway dist tree. Real files on disk, because the measurement's whole
 *  point is what `gzipSync` makes of actual bytes. */
const roots: string[] = []
function makeDist(files: Record<string, string>): string {
  const root = mkdtempSync(resolve(tmpdir(), 'bundle-budget-'))
  roots.push(root)
  for (const [name, contents] of Object.entries(files)) {
    const path = resolve(root, name)
    mkdirSync(resolve(path, '..'), { recursive: true })
    writeFileSync(path, contents)
  }
  return root
}

afterAll(() => { for (const root of roots) rmSync(root, { recursive: true, force: true }) })

/**
 * `kb * 512` base-36 tokens joined by spaces. Roughly `kb` KiB of *raw* text,
 * which gzips to about 0.58x that — so `filler(20)` is on the order of 42 KiB
 * of gzip, not 20. Assertions below are written against ratios rather than
 * guessed absolute byte figures for exactly that reason.
 *
 * Deliberately not a repeated line: gzip collapses `const x = 1;` repeated
 * forever to almost nothing, so a repetition-based filler cannot represent a
 * large bundle and makes size assertions meaningless. Real minified code is
 * high-entropy, and this stands in for it.
 */
function filler(kb: number): string {
  const chunks: string[] = []
  let seed = 0x2545f491
  for (let i = 0; i < kb * 512; i += 1) {
    // A small LCG in base 36 — dense, no long repeated runs.
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    chunks.push(seed.toString(36))
  }
  return chunks.join(' ')
}

const INDEX = (entry: string, preloads: string[] = [], styles: string[] = []) => `<!doctype html>
<html><head>
<script type="module" crossorigin src="/${entry}"></script>
${preloads.map((p) => `<link rel="modulepreload" crossorigin href="/${p}">`).join('\n')}
${styles.map((s) => `<link rel="stylesheet" crossorigin href="/${s}">`).join('\n')}
</head><body><div id="app"></div></body></html>`

describe('first-paint bundle budget', () => {
  it('charges the entry chunk and its modulepreload deps, not every chunk', () => {
    const dist = makeDist({
      'index.html': INDEX('assets/index-AAA.js', ['assets/vendor-BBB.js'], ['assets/index-CCC.css']),
      'assets/index-AAA.js': filler(20),
      'assets/vendor-BBB.js': filler(10),
      // Lazily imported: on disk, but not on the first paint.
      'assets/ExploreView-DDD.js': filler(400),
      'assets/three.module-EEE.js': filler(600),
      'assets/index-CCC.css': filler(5),
    })

    const summary = collectBudgetSummary(dist)

    // Both first-paint chunks are listed; the 1 MB of lazy chunks is not.
    expect(summary.jsFiles).toEqual(['assets/index-AAA.js', 'assets/vendor-BBB.js'])
    expect(summary.totals.javascriptGzipBytes).toBeGreaterThan(summary.initialJsGzipBytes * 5)
  })

  it('excludes a lazy chunk even when it is the largest file in the build', () => {
    // The regression this guards: measuring all of `dist/assets` made the
    // figure track the biggest lazy chunk instead of the landing page.
    const small = makeDist({
      'index.html': INDEX('assets/index-AAA.js'),
      'assets/index-AAA.js': filler(10),
    })
    const withLazyGiant = makeDist({
      'index.html': INDEX('assets/index-AAA.js'),
      'assets/index-AAA.js': filler(10),
      'assets/three.module-EEE.js': filler(800),
    })

    expect(collectBudgetSummary(withLazyGiant).initialJsGzipBytes)
      .toBe(collectBudgetSummary(small).initialJsGzipBytes)
    expect(collectBudgetSummary(withLazyGiant).totals.javascriptGzipBytes)
      .toBeGreaterThan(collectBudgetSummary(small).totals.javascriptGzipBytes * 10)
  })

  it('reads modulepreload regardless of attribute order', () => {
    const html = `<link crossorigin href="/assets/a.js" rel="modulepreload"><link rel="modulepreload" href="/assets/b.js">`
    expect(initialJsFiles(html)).toEqual(['assets/a.js', 'assets/b.js'])
  })

  it('normalizes leading slashes, queries and duplicate references', () => {
    // Vite emits root-relative paths and can append a cache-busting query;
    // charging the same chunk twice would inflate the figure.
    const html = `<script type="module" src="/assets/index-a.js"></script>
<script type="module" src="assets/index-a.js?v=2"></script>`
    expect(initialJsFiles(html)).toEqual(['assets/index-a.js'])
  })

  it('ignores an inline style block that merely mentions a .css file', () => {
    // The init script in index.html is inline; only real href references count.
    const html = `<style>/* index-CRLIerse.css */</style><link rel="stylesheet" href="/assets/real.css">`
    expect(initialCssFiles(html)).toEqual(['assets/real.css'])
  })

  it('throws on a referenced chunk that is missing', () => {
    // The one failure mode a size gate must never have: a broken reference
    // reading as a smaller bundle.
    const dist = makeDist({ 'index.html': INDEX('assets/index-GONE.js') })
    expect(() => collectBudgetSummary(dist)).toThrow(/资源不存在/)
  })

  it('throws when there is no build to measure', () => {
    const root = mkdtempSync(resolve(tmpdir(), 'bundle-budget-empty-'))
    roots.push(root)
    expect(() => collectBudgetSummary(root)).toThrow(/dist\/index\.html/)
  })

  const budget = { maxGrowthRatio: 1.05, initialJsGzipBytes: 77_751, initialCssGzipBytes: 48_819 }
  const passing = {
    initialJsGzipBytes: 77_751,
    initialCssGzipBytes: 48_819,
    woff2Files: 0,
  }

  it('passes at the baseline and within the 5% allowance', () => {
    expect(budgetFailures(passing, budget)).toEqual([])
    expect(budgetFailures({ ...passing, initialJsGzipBytes: 81_638 }, budget)).toEqual([])
  })

  it('fails just past the allowance, and says which metric', () => {
    const failures = budgetFailures({ ...passing, initialJsGzipBytes: 81_640 }, budget)
    expect(failures).toHaveLength(1)
    expect(failures[0]).toMatch(/initialJsGzipBytes/)
  })

  it('fails on first-paint CSS past its own hard limit', () => {
    // 80,000 B is an absolute ceiling, independent of the 5% growth ratio.
    const failures = budgetFailures({ ...passing, initialCssGzipBytes: 80_001 }, budget)
    expect(failures.join('\n')).toMatch(/80,000|80000/)
  })

  it('fails when a WOFF2 slips back into the build', () => {
    // The system-font approach is deliberate: shipping a CJK webfont would
    // cost megabytes.
    const failures = budgetFailures({ ...passing, woff2Files: 1 }, budget)
    expect(failures.join('\n')).toMatch(/WOFF2/)
  })

  it('does not fail on the advisory full-site totals', () => {
    // The whole point of the revision: lazy chunks may grow without blocking
    // a build, but the figure is still printed for review.
    const dist = makeDist({
      'index.html': INDEX('assets/index-AAA.js'),
      'assets/index-AAA.js': 'const x = 1;\n',
      'assets/three.module-EEE.js': filler(500),
    })
    const summary = collectBudgetSummary(dist)
    expect(budgetFailures(summary, budget)).toEqual([])
    expect(summary.totals.javascriptGzipBytes).toBeGreaterThan(100_000)
  })
})
