# 移动端预约页美学重构与视觉梳理实施计划（2026-11-27）

## 1. 目标
针对移动端（`<= 760px`）预约参观页（`/appointment`）当前存在的「3 列大灰块过长」「头部行政字段堆积」「BottomSheet 抽屉图标失控放大（~150px）」「底部动作按钮与副券冗余」「右下角洛笙悬浮钮遮挡」等问题，重塑为轻量、克制、富有东方博物馆票券质感与清晰节奏的移动端预约体验；保持桌面端（`> 760px`）布局、全部业务逻辑、无障碍与既有测试契约 100% 不变。

## 2. 关联需求 ID
- `F-06`（参观预约查询与创建核心流程）
- `N-03`（移动端适配、触控热区、无障碍与视觉规范）
- `N-06`（前后端契约与构建/门禁合规）

## 3. 影响范围
- [AppointmentView.vue](../../frontend/src/views/AppointmentView.vue)：
  - `setupEntrance()` 移动端跳过隐藏动效，避免滚动过快留白；
  - `.appointment-mobile-action` 升级为吸底实时票根摘要栏 + 「填写预约信息」主按钮；
  - 补充 `:global(.appointment-bottom-sheet ...)` 图标尺寸限定（`16px` / `22px`）修正 Teleport 抽屉内巨型 SVG；
  - 重构 `@media (max-width: 760px)` 样式：单行页头、隐去冗余进度条与 365 天长串日期区间、无边框月历导航、真 7 列极简日历、2×2 展签时段网格、紧凑底部副券卡，并将极窄降级收紧至 `@media (max-width: 359px)`（4 列日历 / 单列时段以保障 `320px` 视口触控 >= 44px）。
- [LuoshengSiteGuide.vue](../../frontend/src/components/LuoshengSiteGuide.vue)：
  - 在 `/appointment` 路由下为 `.luosheng-root` 增加 `is-appointment-stage`，移动端适当抬高底距以避让吸底实时票根动作条。
- 文档同步：[PROJECT_STATUS.md](../../PROJECT_STATUS.md)。

## 4. 实施步骤
1. 阅读 Impeccable `craft-floor.md` 规范并落盘本计划文档；
2. 调整 `AppointmentView.vue` 移动端逻辑、模板、全局抽屉样式及 `@media (max-width: 760px)` / `(max-width: 359px)` 响应式样式；
3. 调整 `LuoshengSiteGuide.vue` 预约页移动端悬浮球避让高度；
4. 运行前端 `typecheck`、`vitest run`、`test:e2e:types`、`vite build`（含双预算门禁）、`impeccable detect --json --changed` 与多视口实机截图验收（`390×844` 浅/深/EN/抽屉、`320×900` DOM 指标、`1440×900` 桌面防回退）；
5. 生成视觉对比产物并更新 `PROJECT_STATUS.md` 与本文档验证结果。

## 5. 验收标准
- 前端 `vue-tsc -b`、Vitest 全部用例、`tsc -p e2e/tsconfig.json`、`vite build` 及资源预算门禁全部通过；
- `impeccable detect --json --changed` 返回 `[]`（0 违规）；
- `390×844` 真机视口下显示真 7 列日历 + 2×2 时段格 + 吸底实时票根栏，`BottomSheet` 抽屉内日历图标为 `16×16px`，洛笙 `笙` 钮不遮挡按钮与关键数据；
- `320×900` 视口满足 `overflow: false, small: [], clipped: []`；
- `1440×900` 桌面端布局零回退。

## 6. 风险
- `320px` 窄屏（含 Windows 滚动条实际内容宽度约 `305px`）下 7 列日历单格宽会低于 `44px`，因此通过 `@media (max-width: 359px)` 保留 4 列网格确保 `>= 44px` 触控热区，而 `360px–760px` 主流手机全面呈现真 7 列月历。
- `MobileAppointmentShopPolish.spec.ts` 通过正则从最后一个 `@media (max-width: 760px)` 截取校验 `.appointment-dates` 7 列定义，需将 760px 规则合并为单块且把 `@media (max-width: 359px)` 置于其后。

## 7. 验证结果
- **前端类型与单元测试**：`vue-tsc -b` 0 错误；`npx vitest run --maxWorkers=2` **81 个文件、449 条用例全部通过**；`tsc -p e2e/tsconfig.json` 0 错误。
- **生产构建与门禁**：`npm run build` 通过（首屏 JS gzip `76,232 B / 81,638 B`、CSS gzip `15,347 B / 80,000 B`、`woff2Files: 0`、R4 配乐 `5,001,307 B / 6,000,000 B`）。
- **设计规范检测**：`impeccable detect --json --changed` 返回 `[]`（0 违规）。
- **多视口 DOM 与视觉验收**（本地 `vite preview` + Chrome）：
  - `390×844` 浅色初始态 / 已选态 / 英文已选态 / 深色已选态：全部 `overflow: false, small: [], clipped: []`，整页高度由线上 `3,598px` 降至 `2,519px`（含底部全局深色页脚）；
  - `BottomSheet` 抽屉内 `.appointment-sheet-date svg` 实测渲染 `16×16px`；
  - `320×900` 极窄视口与 `1440×900` 桌面端防回退检查：全部 `overflow: false, small: [], clipped: []`。
