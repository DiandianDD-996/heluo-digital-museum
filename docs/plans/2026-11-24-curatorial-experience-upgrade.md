# 河洛数字博物馆 · 前端策展美学与多模态交互全面升级计划

> 日期：2026-11-24  
> 关联需求 ID：`F-01`、`F-02`、`F-03`、`F-05`、`F-06`、`F-07`、`F-09`、`F-12`、`F-13`、`F-14`、`A-02`、`N-03`、`N-06`、`LS-05`、`LS-06`  
> 设计规范遵循：[design.md](../../design.md)（Heluo Editorial 2.0，8 层 `@layer` + OKLCH 双色令牌，零新增散装全局 CSS、零外部 `.woff2`、可见字号 `>= 12px`、触控热区 `>= 44px`）

## 1. 目标

在后端 Gate 0–2（安全加固、洛笙 v2.2 契约修复、Flyway `V28` 双语与文创溯源、`V29` 预约核销、四类加权检索与后台可观测接口）已完成验收的基础上，落地全套策展级前端设计与交互升级：

1. **首屏 JS 包体预算瘦身清障**：消除根入口冗余静态依赖，将首屏 JS gzip 从紧贴红线的 `79.6 KB / 81.6 KB (97.5%)` 压降至安全水位，为新增交互留出充足空间。
2. **双语与文创溯源单一事实源（SSOT）打通 + 洛笙抽屉精修**：消费后端 `V28` 新增双语与分类/溯源字段，移除前端散落的按 slug 英文硬编码补丁表，探索页支持四类全馆检索（含 3D 展项与文创）；补齐洛笙抽屉跨页分割线「问问当前展品」破冰胶囊与无闪烁流式加粗渲染。
3. **青铜鼎 3D 展柜（`EXHIBIT 01`）空间叙事升级**：在 `ThreeExhibitViewer` 真实 CMA 1962.281 PBR 网格与点云之上，新增按需开启的三维鎏金微光空间锚点（双耳/器腹/三足，基于相机矩阵投影与法线遮挡自动淡退）、`245 × 200 mm` 三维比例尺参照框，以及手势拖拽 1:1 即刻接管、零抢夺的三步微导览字幕条。
4. **新增第 2 件数字展项 `EXHIBIT 02`《河洛图纹石板 · 斜射光刻痕检视》**：新增双兼容迁移 `V30__add_stone_raking_light_exhibit.sql`（同步 `BootstrapDataInitializer` 与洛笙目录），基于 WebGL GLSL 片元着色器与馆藏石板高清摄影纹理构建高精度法线/刻痕高度场，支持 360° 拖拽虚拟侧光灯方位与掠射仰角、2.4× 光学微距检视镜及 R4 声景联动。
5. **河洛文创「器物灵感溯源」抽屉、金石印章电子入馆票根与「观展手账」书签夹**：商城新增右侧/底部画册式溯源抽屉（呈现文创与灵感馆藏高清双联对照卡与完整策展长文案）；预约页与个人中心升级带朱砂印章、几何矢量核销矩阵码、`.ics` 日历导出与打印视图的电子入馆凭证（对接后端 `verificationCode`）；全站提供零登录本地持久化「观展手账」书签夹。
6. **后台可观测运营台升级与过时 E2E 选择器修复**：`AdminOperationsView` 接入 7 日预约满载率条形图、低库存预警、洛笙运行时治理卡片（今日额度、降级/红线统计、模式切换、缓存刷新）与预约时段内凭码核销交互；同步修复 `frontend/e2e/business.e2e.ts` 中两条旧 DOM 选择器。

## 2. 影响范围

- **数据库迁移与种子（仅限 `EXHIBIT 02` 注册）**：
  - `backend/src/main/resources/db/migration/V30__add_stone_raking_light_exhibit.sql`
  - `backend/src/main/java/com/heluo/museum/config/BootstrapDataInitializer.java`（幂等补齐第 2 件展项种子，兼容 H2/MySQL）
- **前端核心架构、组件与视图**：
  - 入口与包体：`frontend/src/App.vue`、`frontend/src/components/AudioControl.vue`、`frontend/src/lib/audioSystem.ts`
  - 状态与工具：`frontend/src/stores/curatorialBookmarks.ts`、`frontend/src/lib/content.ts`、`frontend/src/lib/contentLocale.ts`、`frontend/src/lib/museumPass.ts`
  - 洛笙向导：`frontend/src/components/LuoshengSiteGuide.vue`、`frontend/src/stores/luoshengStore.ts`
  - 3D 与斜射光展厅：`frontend/src/components/ThreeExhibitViewer.vue`、`frontend/src/components/RakingLightViewer.vue`、`frontend/src/views/ExhibitsView.vue`、`frontend/src/views/ExhibitDetailView.vue`
  - 探索、详情、商城、预约、个人中心与后台：`frontend/src/views/ExploreView.vue`、`frontend/src/views/ContentDetailView.vue`、`frontend/src/views/ShopView.vue`、`frontend/src/components/ProductProvenanceDrawer.vue`、`frontend/src/components/MuseumPassCard.vue`、`frontend/src/components/CuratorialBookmarkSheet.vue`、`frontend/src/views/AppointmentView.vue`、`frontend/src/views/ProfileView.vue`、`frontend/src/views/AdminOperationsView.vue`
  - 样式令牌层：`frontend/src/styles/04-components.css`、`frontend/src/styles/05-shell.css`、`frontend/src/styles/07-admin.css`
  - 测试与 E2E：`frontend/src/**/*.spec.ts`、`frontend/e2e/business.e2e.ts`

## 3. 实施步骤

1. **Step 1**：首屏 JS 依赖拆分与预算减重，验证 `vite build` + `bundle-budget` 显著下降。
2. **Step 2**：打通 `V28` 双语/溯源/四类检索 DTO，移除前端英文硬编码字典；升级 `LuoshengSiteGuide.vue` 跨页胶囊与无闪烁流式解析。
3. **Step 3**：升级 `ThreeExhibitViewer.vue` 与 `ExhibitDetailView.vue`，实现三维微光锚点、`245 × 200 mm` 尺度框及手势即打断微导览。
4. **Step 4**：落地 `V30` 迁移与 WebGL `RakingLightViewer.vue`（《河洛图纹石板 · 斜射光刻痕检视》`EXHIBIT 02`），打通暗房检视与无 WebGL 温和降级。
5. **Step 5**：实现商城 `ProductProvenanceDrawer.vue`、金石印章 `MuseumPassCard.vue`（含 `.ics` 导出与打印排版）及全站 `CuratorialBookmarkSheet.vue` 观展手账。
6. **Step 6**：升级 `AdminOperationsView.vue`（7 日满载率、低库存、洛笙治理、预约核销）并修复 `business.e2e.ts` 过时选择器。
7. **Step 7**：运行后端 `mvn test`、前端 `vue-tsc`、`vitest`、`vite build`（含双预算门禁）及本地浏览器浅/深双主题 + 桌面/移动视口实景巡检，更新 `PROJECT_STATUS.md` 与 `docs/01-requirements-traceability.md`。

## 4. 验收标准与风险控制

- **包体与性能**：`initialJsGzipBytes` 低于预算上限且较 `79,614 B` 显著下降；`woff2Files === 0`；WebGL 斜射光与 3D 展柜离开路由立即释放 GPU 纹理、缓冲与帧循环。
- **兼容性与测试**：`V30` 同时通过 H2 MySQL 模式与 MySQL 8 语法；现有与新增前后端单测全绿；无 WebGL 环境 `RakingLightViewer` 自动回退至高清石板对照图版。
- **视觉与无障碍**：全部色彩走 `01-tokens.css` OKLCH 语义变量，可见字号 `>= 12px`，交互热区 `>= 44px`，遵循 `prefers-reduced-motion: reduce`。

## 5. 验证结果

- **前端类型检查与生产构建门禁**：`pnpm --dir frontend typecheck` 0 错误；`pnpm --dir frontend build`（含 `bundle-budget.mjs` 与 `music-assets-budget.mjs`）全绿，首屏 `initialJsGzipBytes = 72,700 B / 81,638 B`（较改造前 `79,614 B` 净降 `-6,914 B` gzip），`initialCssGzipBytes = 13,056 B / 80,000 B`，`woff2Files = 0`，R4 配乐 `5,001,307 / 6,000,000 B` 通过。
- **前端全量单元测试**：`pnpm --dir frontend exec vitest run --maxWorkers=2` 共 **`79` 个测试文件 / `440/440` 用例全部通过**（含新增 `RakingLightViewer.spec.ts`、`MuseumPassAndProvenance.spec.ts` 及升级的 `ExhibitDetailView.spec.ts`、`LuoshengSiteGuide.spec.ts`、`AdminQuality.spec.ts`）。
- **后端全量测试（含 `V30` 迁移与双库语法校验）**：`mvn -f backend/pom.xml test` **`106/106` 用例全部通过**，Flyway 30 个版本迁移全部校验并执行通过。
- **浏览器全流程与双主题实机巡检**：在本地回环隔离环境启动 Spring Boot（`pocketbay` H2 MySQL 模式，`V1..V30`）与 Vite 前端，执行 Playwright 双主题视觉与交互巡检（`14/14` 项断言通过，覆盖 `1440×900` 与 `390×844` 浅/深双主题，零横向溢出、零控制台报错）并逐帧审查实机截图；同步执行官方 E2E 套件 `e2e/bilingual-search.e2e.ts`（`11/11`）与 `e2e/business.e2e.ts`（`7/7`，含修复选择器后的预约与支付断线恢复用例），合计 **`18/18` 全部通过**。
