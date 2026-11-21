/**
 * 移动首屏构建预算门禁。
 *
 * 两个指标都量"首屏"，这是 2026-09-26 修正的核心：
 *
 *   - 初始 JS  = `dist/index.html` 直接引用的入口 chunk + 它的
 *                `modulepreload` 静态依赖。这一条过去是量 `dist/assets`
 *                下**所有** JS 的 gzip 总和。
 *   - 初始 CSS = `dist/index.html` 引用的样式表 gzip 总和（原本就是首屏口径）。
 *
 * 为什么必须改：本项目的 13 个视图全部走动态 `import()`，Three.js 的
 * 734 KB 也只在打开 3D 展项时才拉。旧口径把"站点总量"当成"首屏成本"，
 * 两者已相差约 6.7 倍——门禁在为懒加载资源判死刑，而它对首屏退化毫无
 * 分辨力：首屏涨 10 KB 与懒加载块涨 10 KB 在旧口径里权重相同。
 *
 * 全量总量并没有被丢掉，而是降级为**仅告警**（见 `totals`），这样懒加载
 * 代码的膨胀仍然可见，只是不再拦构建。
 *
 * 度量口径必须与 Vite 的 gzip 级别一致，所以这里用 `node:zlib` 的
 * `gzipSync` 默认级别，不要改成 level 9——那会让数字凭空偏小约 0.8%，
 * 门禁看起来更宽松，实际没有变。
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

const MAX_INITIAL_CSS_GZIP_BYTES = 80_000

function findFiles(directory, extension) {
  return readdirSync(directory).flatMap((name) => {
    const path = resolve(directory, name)
    return statSync(path).isDirectory() ? findFiles(path, extension) : path.endsWith(extension) ? [path] : []
  })
}

/** Normalizes an `index.html` reference to a dist-relative POSIX path, so a
 *  leading slash, a relative prefix, or a cache-busting query all resolve to
 *  the same file. */
function normalizeReference(reference) {
  return reference.replace(/^\//, '').split('?')[0].split('#')[0]
}

/** Deduplicated, in document order, so a chunk referenced twice is charged
 *  once. */
function unique(values) {
  return values.filter((value, index) => values.indexOf(value) === index)
}

/**
 * Every value of `attribute` across `<tagName ...>` tags, in document order.
 *
 * Read by name rather than by position: HTML attribute order carries no
 * meaning, so a single regex like `<link[^>]*rel="modulepreload"[^>]*href=`
 * would stop seeing preloads the day Vite emitted them the other way round —
 * and it would fail by under-reporting, which is the direction a size gate
 * must never fail in.
 */
function attributeValues(html, tagName, attribute) {
  const tagPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'g')
  const valuePattern = new RegExp(`\\b${attribute}="([^"]+)"`)
  return [...html.matchAll(tagPattern)]
    .map((tag) => valuePattern.exec(tag[0])?.[1])
    .filter((value) => typeof value === 'string')
}

/**
 * Every JS file the first paint must download: the module entry points
 * `index.html` declares, plus anything Vite asked the browser to
 * `modulepreload` before the app runs.
 */
export function initialJsFiles(indexHtml) {
  const entries = attributeValues(indexHtml, 'script', 'src')
    .filter((src) => src.split('?')[0].endsWith('.js'))
    .map(normalizeReference)
  // Vite only emits modulepreload for chunks that are statically imported by
  // the entry. They are on the critical path even though the app has not run.
  const preloaded = attributeValues(indexHtml, 'link', 'href')
    .filter((href) => href.split('?')[0].endsWith('.js'))
    .map(normalizeReference)
  return unique([...entries, ...preloaded])
}

/** Every stylesheet the first paint must download. */
export function initialCssFiles(indexHtml) {
  return unique(
    attributeValues(indexHtml, 'link', 'href')
      .filter((href) => href.split('?')[0].endsWith('.css'))
      .map(normalizeReference),
  )
}

/**
 * Measures a built `dist` directory.
 *
 * Throws on a reference with no file behind it rather than silently skipping
 * it: a missing chunk would otherwise read as a smaller bundle, which is the
 * one failure mode a size gate must never have.
 */
export function collectBudgetSummary(distDir) {
  const indexPath = resolve(distDir, 'index.html')
  if (!existsSync(indexPath)) throw new Error('未找到 dist/index.html，请先运行 Vite build。')

  const indexHtml = readFileSync(indexPath, 'utf8')
  const gzipBytesOf = (relativePath) => {
    const file = resolve(distDir, relativePath)
    if (!existsSync(file)) throw new Error(`首页引用的资源不存在：${relativePath}`)
    return gzipSync(readFileSync(file)).byteLength
  }

  const jsFiles = initialJsFiles(indexHtml)
  const cssFiles = initialCssFiles(indexHtml)
  const assetsDir = resolve(distDir, 'assets')
  const gzipTotal = (extension) => findFiles(assetsDir, extension)
    .reduce((total, path) => total + gzipSync(readFileSync(path)).byteLength, 0)

  return {
    jsFiles,
    cssFiles,
    initialJsGzipBytes: jsFiles.reduce((total, file) => total + gzipBytesOf(file), 0),
    initialCssGzipBytes: cssFiles.reduce((total, file) => total + gzipBytesOf(file), 0),
    initialCssBudgetBytes: MAX_INITIAL_CSS_GZIP_BYTES,
    woff2Files: findFiles(distDir, '.woff2').length,
    // Advisory only — see the header note.
    totals: {
      javascriptGzipBytes: gzipTotal('.js'),
      cssGzipBytes: gzipTotal('.css'),
    },
  }
}

/** Compares a measurement against the recorded baseline. Returns the reasons
 *  the build must fail; empty means it passed. Pure, so the spec can exercise
 *  the thresholds without a real build. */
export function budgetFailures(summary, budget) {
  const failures = []
  if (summary.initialJsGzipBytes > budget.initialJsGzipBytes * budget.maxGrowthRatio) {
    failures.push(
      `initialJsGzipBytes: ${summary.initialJsGzipBytes} B 超过基线 ${budget.initialJsGzipBytes} B + ${Math.round((budget.maxGrowthRatio - 1) * 100)}%。首屏 JS 退化需要解释并复核。`,
    )
  }
  if (summary.initialCssGzipBytes > MAX_INITIAL_CSS_GZIP_BYTES) {
    failures.push(`首页初始 CSS 为 ${summary.initialCssGzipBytes} B gzip，超过 ${MAX_INITIAL_CSS_GZIP_BYTES} B 门禁。`)
  }
  if (summary.initialCssGzipBytes > budget.initialCssGzipBytes * budget.maxGrowthRatio) {
    failures.push(
      `initialCssGzipBytes: ${summary.initialCssGzipBytes} B 超过基线 ${budget.initialCssGzipBytes} B + ${Math.round((budget.maxGrowthRatio - 1) * 100)}%。`,
    )
  }
  if (summary.woff2Files > 0) {
    failures.push(`构建产物包含 ${summary.woff2Files} 个 WOFF2，系统中文字体方案发生回归。`)
  }
  return failures
}

function main() {
  const distDir = resolve(process.cwd(), 'dist')
  const budget = JSON.parse(readFileSync(new URL('./resource-budget.json', import.meta.url), 'utf8'))
  const summary = collectBudgetSummary(distDir)

  console.log(`移动首屏构建预算：${JSON.stringify(summary)}`)

  const failures = budgetFailures(summary, budget)
  if (failures.length > 0) throw new Error(failures.join('\n'))

  const { javascriptGzipBytes, cssGzipBytes } = summary.totals
  console.log(
    `门禁通过。全量（仅告警）：JS ${javascriptGzipBytes} B，CSS ${cssGzipBytes} B。`
    + ` 首屏 JS ${summary.initialJsGzipBytes} B / 预算 ${Math.floor(budget.initialJsGzipBytes * budget.maxGrowthRatio)} B。`,
  )
}

// Guarded so importing this module (the spec does) cannot run the gate.
// Compares resolved URLs rather than string concatenation, which mangles
// Windows paths and `%`-escaped filenames.
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main()
