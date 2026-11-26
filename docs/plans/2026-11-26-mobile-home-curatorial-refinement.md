# 移动端首页适配与无边框通透策展精修计划（2026-11-26）

## 目标

优化河洛数字博物馆首页（`HomeView.vue`）在移动端（`<= 760px`）的器物视觉比例与文字信息密度，兼顾高级审美留白与通透展厅现场感：

1. **无痕重制竖屏主视觉（`483×941`）**：从桌面高清原图（`home-hero-{light|dark}-v3.webp`）无痕重制 `home-hero-light-v3-portrait.webp` 与 `home-hero-dark-v3-portrait.webp`，裁去左侧竖向壁缝，缩小青铜鼎与石台占比，并无缝延展顶部顶光光束与底部石质地面，确保移动端保持完整、自然的建筑空间感。
2. **无边框全出血通透构图**：取消一切硬质画框/卡片外框，以极轻柔的顶部/底部渐隐氛围层过渡，将精简后的单行宋体主标题与轻量眉题置于上方顶光留白区，中段完整留给青铜鼎，底部柔和承接主次胶囊按钮与单行开放时间。
3. **跨屏幕与下屏降噪**：覆盖 `320×529`（单行按钮 + 矮屏约束）、`375×667`、`390×844`（明/暗双主题、中/英双语），并将 `AcousticRuler` 保持于首屏视口下方（`> 100svh`）；精简 Section 2–4 冗余文案，桌面端（`> 760px`）保持零改动。

## 关联需求 ID

- `N-03`：响应式与易用性（桌面/移动无关键溢出、44px 控件、无障碍）
- `N-06`：类型检查、自动化测试、构建预算与 `impeccable detect` 门禁

## 影响范围

- `frontend/public/media/editorial/home-hero-light-v3-portrait.webp`、`home-hero-dark-v3-portrait.webp`：保持 `483×941` lossy VP8 WebP 规格，缩小青铜鼎主体比例并消除壁缝与生硬截断。
- `frontend/src/views/HomeView.vue`：为 `<picture>` 增加 `class="home-cover__picture"`，重构 `@media (max-width: 760px)`、`@media (max-width: 760px) and (max-height: 620px)` 及深色模式移动端样式。
- `frontend/src/test/HomeView.spec.ts`：补充 `.home-cover__picture` 包裹 `.corridor-home__hero-media` 与 `<source>` 的契约断言。
- `PROJECT_STATUS.md`、`docs/01-requirements-traceability.md`：同步本轮移动端首页优化状态。

## 验收标准

- `390×844`（浅/深、中/英）、`375×667`、`320×529` 移动首屏无边框、无断层、无壁缝、无压字与底栏遮挡，青铜鼎比例适中且氛围高级。
- `1440×900` 桌面端首页（浅/深双主题）与基线完全一致。
- `vue-tsc -b`、Vitest、`test:e2e:types`、`npm run build`（双预算）及 `impeccable detect --json --changed` 全部通过（0 违规）。
- `mobile-remediation.e2e.ts` 首页与移动端壳层相关用例通过。

## 验证结果

- `npm run typecheck`（`vue-tsc -b`）：**0 错误**
- `npm run test`（Vitest）：**81 个测试文件 / 449 个用例全部通过**（含 `HomeView.spec.ts`、`PublicResponsivePolish.spec.ts` 与 `homeHeroMedia.spec.ts`）
- `npm run test:e2e:types`（`tsc -p e2e/tsconfig.json`）：**0 错误**
- `npm run build`（`vite build` + 预算门禁）：**通过**；首屏 JS gzip `76,060 B / 81,638 B`、首屏 CSS gzip `15,349 B / 80,000 B`、`woff2Files = 0`、R4 配乐资源 `5,001,307 B / 6,000,000 B`
- `impeccable detect --json --changed`：**`[]`（0 违规）**
- Playwright 首页与移动壳层 E2E（`e2e/mobile-remediation.e2e.ts` 9 项首页/英文窄屏/200% 字号/声景尺延后加载专项，运行于本地 `vite preview`）：**9 / 9 通过**
- 实机分辨率目检与内置浏览器演示：已在本地 `vite preview` Chromium 逐张核验 `390×844`（浅色/深色/英文）、`375×667`、`320×529`、`1440×900`（浅/深双主题），并在内置浏览器 `390×844` 实机演示浅/深双主题切换通过，获得用户确认满意。
- **未验证/待发布项**：`mobile-remediation.e2e.ts` 中依赖后端接口的预约/商城/3D 用例未针对纯静态 `vite preview` 重复执行；PocketBay 线上部署及真机复验将在发布完成后确认。
