# 河洛数字博物馆 · 专业后台管理系统 2.0 三阶段升级计划

> 日期：2026-11-28
> 关联需求：`F-04`、`F-07`、`F-11`、`F-13`、`N-01`、`N-03`、`N-06`

## 1. 目标与三阶段统筹蓝图

将现有“两入口堆叠 9 个 Tab”的后台工作台重构为信息架构清晰、决策效率高、具备策展级数据可视化能力的专业博物馆后台管理系统（Archivist Neutral 工作台风格，双主题 OKLCH 令牌）。

### 整体三阶段规划
- **阶段 1（本次实施）：导航壳层重构 + 网站人流统计采集 + 多维看板与核心图表 + 独立专页拆分**
  - 重构 `AdminShell` 为 5 大业务域分组、12 个独立路由（支持桌面折叠、移动端侧滑抽屉、待办角标）。
  - 新增 Flyway `V32` 网站访问每日统计表与轻量级公开上报接口（`POST /api/v1/analytics/page-view`），前台路由切换异步延迟埋点（零首屏同步包体增量）。
  - 扩展 `AdminDashboardController`：新增多维时间序列聚合接口（支持 `7 / 30 / 90` 天、真实统计 vs `is_demo` 演示样本严格隔离、90 天演示访问种子注入与清除）。
  - 方案 A 自研零重型依赖策展级响应式 SVG 图表组件库（KPI 迷你曲线卡、PV/UV 双折线面积图、预约客流与入馆核销组合图、未来 14 天预约承载力图、热门馆藏排行条形图、文创营收趋势与订单状态环形图）。
  - 落地 `/admin` 馆务总览看板、`/admin/categories` 展陈分类专页、`/admin/guide` 洛笙 AI 治理专页，并适配原有内容/运营页面支持独立路由 `lockedTab` 满宽展示。
- **阶段 2（待阶段 1 验收后推进）：参观预约体系升级**
  - 排班与时段日历视图（月历总览 + 当日 4 场时段卡片、单场容量与状态编辑、批量排班 / 一键临时闭馆）。
  - 预约现场快速核销栏（扫码/输入 10 位核验码一键核销）、后端全库关键词检索与「今日入馆名单」CSV 导出。
- **阶段 3（待阶段 2 验收后推进）：策展、商城与审计治理收口**
  - 3D 展项编辑抽屉、文创商品双语与灵感文物关联编辑、行内快捷补货。
  - 商城订单详情抽屉（商品明细与流转时间轴）、后台全模块服务端检索（订单/商品/日志）、表格化视图统一升级与 `Ctrl+K` 快捷指令栏。

## 2. 阶段 1 影响范围与数据模型

### 后端新增与修改
- `backend/src/main/resources/db/migration/V32__create_site_analytics_tables.sql`：新建 `site_page_daily_stats`（按日/路由类型/slug/is_demo 唯一汇总 PV/UV）与 `site_visitor_daily_uniques`（按日/作用域/SHA-256 匿名访客摘要去重，不落库明文 IP）。
- `backend/src/main/java/com/heluo/museum/analytics/SiteAnalyticsService.java` & `SiteAnalyticsController.java`：公开埋点限流采集与 90 天演示种子生成/清除。
- `backend/src/main/java/com/heluo/museum/admin/AdminDashboardController.java`：保留原有 `/summary` 契约，新增 `/analytics`、`/demo-analytics/seed`、`/demo-analytics`。
- `backend/src/main/java/com/heluo/museum/config/BootstrapDataInitializer.java`、`SecurityConfiguration.java`、`PocketBaySpaController.java`、`application.yml`、`docker-compose.yml`。

### 前端新增与修改
- 埋点与数据：`frontend/src/lib/visitTracker.ts`、`frontend/src/lib/adminDemoAnalytics.ts`、`frontend/src/composables/useAdminNavCounts.ts`、`frontend/src/App.vue`。
- 壳层与路由：`frontend/src/components/AdminShell.vue`、`frontend/src/router/index.ts`。
- 图表组件库：`frontend/src/components/admin/charts/{chartGeometry.ts,KpiSparklineCard.vue,AreaTrendChart.vue,AppointmentFlowChart.vue,CapacityHorizonChart.vue,DonutStatusChart.vue,RankedBarChart.vue}`。
- 视图与样式：`AdminDashboardView.vue`、`AdminCategoriesView.vue`、`AdminGuideView.vue`、`AdminContentView.vue`、`AdminOperationsView.vue`、`frontend/src/styles/07-admin.css`。

## 3. 验收标准与风险控制

- **权限边界**：`/api/v1/admin/**` 全部接口严格要求 `ADMIN` 角色；公开埋点接口仅接收白名单路由类型与清洗后 slug，按客户端 IP 滑动窗口限流。
- **双库兼容**：SQL 严禁使用 MySQL 专属 upsert 语法，全部时间分桶基于 `Asia/Shanghai` `Clock` 在 Java 侧完成，确保 H2 `MODE=MySQL` 与 MySQL 8.4 行为一致。
- **数据诚信**：`is_demo=1` 样本与真实业务数据隔离；看板默认仅在数据库尚无真实访问数据时才激活「演示预览」，并明确提示与提供一键切换「真实统计」。
- **预算与样式红线**：首屏 JS/CSS 通过 `bundle-budget.mjs` 门禁，`07-admin.css` 严禁出现 `!important`，全部测试与构建通过。

## 4. 阶段 1 验证结果（2026-11-28）

- **后端全量测试**：`cd backend && mvn test` **111 / 111** 全部通过（含新增 `SiteAnalyticsAndDashboardTests` 与 `PocketBayGuideMetaInjectionTests` 12 条新后台 SPA 子路径验证；当前本轮纯前端样式与图表组件精修未改动后端代码）。
- **前端全量校验与构建预算**：`vue-tsc -b` 0 错、`vitest run` **84 文件 / 457 用例**全通过（含新增 `chartGeometry.spec.ts`、`AdminDashboardView.spec.ts`、`AdminCategoriesAndGuide.spec.ts`）、`test:e2e:types` 0 错、`vite build` + 双门禁全绿（首屏 JS gzip `76,863 / 81,638 B`、CSS `15,348 / 80,000 B`、`woff2 = 0`、`AdminDashboardView` 异步 chunk `42.41 kB` / `14.07 kB` gzip、R4 AAC 音乐门禁 `5,001,307 / 6,000,000 B`）。
- **Apple Design 去 AI 味精修与实机视觉验收（隔离 H2 18089 + Vite 14173，真实 Chromium + 内置浏览器）**：
  - 完成克制瓷釉钛蓝 × 冷铂银灰 × 宋瓷青玉 × 香槟鎏金 OKLCH 色板、系统无衬线光学排版（移除英文大写 `kicker` 与等宽数字堆砌）、1:1 触控滑扫实时读数、液态磨砂浮层、`10px` 圆头细环与 `14px` 胶囊容量柱，并补齐 `prefers-reduced-motion` / `prefers-reduced-transparency` 支持（`07-admin.css` 零 `#hex`、零 `!important`）；
  - 前台访问 `/` 与 `/explore` 后切换「真实统计」核验实时 `realPV: 2` 入库且与 `is_demo=1` 样本完全隔离；
  - 桌面 `1440×900`（浅色/深色主题、液态磨砂悬浮 Tooltip、14 天承载力点击跳 `/admin/slots?date=...`、`/admin/categories`、`/admin/guide`、`/admin/artifacts`）及移动端 `390×844` 全部 `overflow: false`，`consoleErrors: []`、`pageErrors: []`，并已在内置浏览器保持实时预览。
- **尚未验证项**：阶段 2（排班月历/批量开关/CSV 导出）与阶段 3（3D/商品编辑扩展/订单明细抽屉/服务端全模块筛选）待阶段 1 用户检视确认后立项推进；MySQL 8.4 环境下 V32 迁移与聚合查询待部署阶段复验。

## 5. 阶段 2 实施与验证结果（2026-11-28）：参观与预约体系专业升级

### 影响范围与实现摘要
- **后端扩展**：[AdminAppointmentController.java](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/backend/src/main/java/com/heluo/museum/appointment/AdminAppointmentController.java)
  - 时段管理：增强 `GET /appointment-slots`（日期区间/状态过滤、`size <= 200`）；新增 `GET /appointment-slots/calendar?month=YYYY-MM` 自然月度汇总；加固 `PATCH /appointment-slots/{id}`（防时间段重复及已有预约防直接取消）；新增 `POST /appointment-slots/batch-generate`（90 天窗口批量按标准 4 场排班，支持自动跳过周一与幂等去重）与 `POST /appointment-slots/batch-status`（批量开闭馆与安全调容保护）。
  - 预约核销与导出：增强 `GET /appointments` 支持全库 `keyword`（`escape '\\'` 转义）/ `visitDate` / `dateFrom` / `dateTo` / `status` 组合筛选；新增 `GET /appointments/lookup?code=...` 与 `POST /appointments/check-in-by-code`（支持 10 位 HMAC 核验码与 `AP` 编号）；新增 `GET /appointments/export` 导出含 UTF-8 BOM 与公式注入防护的 RFC 4180 CSV 名单并写审计日志。
- **前端专页与路由**：[adminCsvExport.ts](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/lib/adminCsvExport.ts)、[router/index.ts](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/router/index.ts)、[AdminSlotsView.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/views/AdminSlotsView.vue)、[AdminAppointmentsView.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/views/AdminAppointmentsView.vue)、[07-admin.css](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/styles/07-admin.css)（第 12 节，`hasImportant=False`、`hasHex=False`）。完整保留 `/admin/operations` 原 `slots`/`appointments` Tab 契约。

### 实测验证结果
- **后端全量测试**：`cd backend && mvn test` **114 / 114** 通过（含新增 [AdminAppointmentPhase2Tests.java](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/backend/src/test/java/com/heluo/museum/appointment/AdminAppointmentPhase2Tests.java) 3 组权限、月历/批量排班/调容冲突、快核与防注入 BOM CSV 导出集成用例）。
- **前端全量校验与预算**：`vue-tsc -b` 0 错、`vitest run` **85 文件 / 459 用例**全部通过（含新增 [AdminSlotsAndAppointments.spec.ts](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/views/AdminSlotsAndAppointments.spec.ts)）、`test:e2e:types` 0 错、`vite build` + 双门禁全绿（首屏 JS gzip `76,937 / 81,638 B`、CSS `15,348 / 80,000 B`、`woff2 = 0`、`AdminSlotsView` 异步 chunk `7.99 kB` gzip、`AdminAppointmentsView` 异步 chunk `5.67 kB` gzip）。
- **实机视觉与交互验收**：重启本地预览后端 `18089` + Vite `14173`，Playwright 实测 `/admin/slots` 与 `/admin/appointments` 的 `1440×900` 双主题、批量排班抽屉、样票查询预览、CSV BOM 导出（`status: 200`, `bomOk: true`）及 `390×844` 移动端全部 `overflow: false`、`consoleErrors: []`、`pageErrors: []`，并由内置浏览器实机登录巡检停留在 `/admin/slots` 供预览。
- **尚未验证项**：阶段 3（3D 展项深度编辑、商品编辑增强与订单明细抽屉/服务端全模块检索）待阶段 2 确认后推进；MySQL 8.4 正式环境的并发锁与导出性能待部署阶段复验。

## 6. 阶段 3 实施与验证结果（2026-11-28）：策展、商城与审计治理收口

### 影响范围与实现摘要
- **后端全模块筛选与订单详情/导出扩展**：
  - [AdminExhibitController.java](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/backend/src/main/java/com/heluo/museum/content/AdminExhibitController.java)：扩展 `GET /admin/exhibits` 支持 `status` 与关联 `artifacts` 跨表 `keyword` 安全检索。
  - [AdminStoreController.java](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/backend/src/main/java/com/heluo/museum/store/AdminStoreController.java)：扩展 `GET /admin/products` 支持 `keyword` 与 `lowStock`；扩展 `GET /admin/orders` 支持 `keyword`、`dateFrom`、`dateTo`（`Asia/Shanghai`）；新增 `GET /admin/orders/{id}` 返回 `paymentNo`、各节点流转时间与商品明细；新增 `GET /admin/orders/export` 导出 UTF-8 BOM + 防公式注入 CSV 并写审计日志。
  - [AdminOperationLogController.java](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/backend/src/main/java/com/heluo/museum/admin/AdminOperationLogController.java) & [AdminUserController.java](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/backend/src/main/java/com/heluo/museum/auth/AdminUserController.java)：补充 `action`/`keyword`/`dateFrom`/`dateTo` 日志检索与 `status`/多字段用户检索。
- **前端全局快捷指令与 5 大独立专页**：
  - [AdminCommandPalette.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/AdminCommandPalette.vue) & [AdminShell.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/AdminShell.vue)：支持 `Ctrl+K` / `Cmd+K` 与侧栏按钮唤醒，实时模糊匹配全 12 个后台路由、待办角标与快捷主题切换。
  - [router/index.ts](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/router/index.ts) 按需懒加载接入 [AdminExhibitsView.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/views/AdminExhibitsView.vue)、[AdminProductsView.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/views/AdminProductsView.vue)（低库存 Tab + 行内快捷补货 `+10/+20` + 双语与文物溯源编辑抽屉）、[AdminOrdersView.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/views/AdminOrdersView.vue)（订单详情流转时间轴抽屉 + 履约完成 + CSV 导出）、[AdminLogsView.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/views/AdminLogsView.vue) 与 [AdminUsersView.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/views/AdminUsersView.vue)，保留 `/admin/operations` 原契约；同步升级 [adminCsvExport.ts](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/lib/adminCsvExport.ts) 透传 `arrayBuffer()` 字节流保留 UTF-8 BOM，及 [07-admin.css](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/styles/07-admin.css) 第 13 节 OKLCH 样式与响应式降级。

### 实测验证结果
- **后端全量测试**：`cd backend && mvn.cmd test` **116 / 116** 通过（含新增 [AdminPhase3Tests.java](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/backend/src/test/java/com/heluo/museum/admin/AdminPhase3Tests.java)）。
- **前端全量校验与预算**：`vue-tsc -b` 0 错、`vitest run` **86 文件 / 464 用例**通过（含新增 [AdminPhase3Views.spec.ts](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/views/AdminPhase3Views.spec.ts)）、`test:e2e:types` 0 错、`vite build` + 双门禁全绿（首屏 JS gzip `77,146 / 81,638 B`、CSS `15,348 / 80,000 B`、`woff2 = 0`、R4 `5,001,307 / 6,000,000 B`）；`07-admin.css` `hasImportant=False`、`hasHex=False`。
- **实机视觉与交互验收**：隔离预览后端 `18089` + Vite `14173` 下 Playwright 实测建单支付后核查订单抽屉 `hasPaymentNo: true`、CSV 下载校验 `hasUtf8Bom: true`、`Ctrl+K` 指令栏、快捷补货 `+10`、日志与用户过滤及 `1440×900` 双主题/`390×844` 移动端共 9 帧截图全部 `overflow: false`、`consoleErrors: []`、`pageErrors: []`。
- **尚未验证项**：MySQL 8.4 正式环境多条件检索与订单 CSV 大数据量导出性能待部署阶段复验。

## 7. 看板图表「方向 B · 河洛策展图录风」差异化重构（2026-11-28）

- **几何与纯函数扩展**：[chartGeometry.ts](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/admin/charts/chartGeometry.ts) 新增 `buildRosePetalPath`（极坐标花瓣闭合路径）与 `buildMovingAverage`（滑动均线），并在 [chartGeometry.spec.ts](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/admin/charts/chartGeometry.spec.ts) 补齐覆盖。
- **7 组图表差异化与玄墨暗房锚点**：
  - [KpiSparklineCard.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/admin/charts/KpiSparklineCard.vue)：拆分 4 种微图（平滑趋势曲线 + 半圆游标核销仪表弧 + 10 柱胶囊微列 + 21 点阵势能矩阵）及顶部 2px 矿彩饰条。
  - [AreaTrendChart.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/admin/charts/AreaTrendChart.vue)：融入极淡 18×18 微点阵底纹与 X 轴基线游标刻针。
  - [AppointmentFlowChart.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/admin/charts/AppointmentFlowChart.vue)：重构为渐变预约底柱 + 哑铃核销落差棒 + 每日核销率平滑曲线复合仪（支持三图层切换）。
  - [CapacityHorizonChart.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/admin/charts/CapacityHorizonChart.vue)：重构为真实周一至周日对齐的 2×7 河洛热力日历矩阵（周一斜纹闭馆 + 四阶负载矿彩热力瓷块 + 微型满载进度槽）。
  - [SlotRadialCompassChart.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/admin/charts/SlotRadialCompassChart.vue)：新增全页唯一「玄墨暗房」重点卡片——昼时极坐标花瓣罗盘（3 层虚线轨道 + 36 道刻度针 + 4 色矿彩花瓣与右侧时刻清单双向联动，独立暗房 OKLCH 变量）。
  - [SalesTrendChart.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/admin/charts/SalesTrendChart.vue) & [OrderRatioBar.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/admin/charts/OrderRatioBar.vue)：鎏金竖向渐变柱 + 3 日均线 + 峰值胶囊，搭配紧凑分段订单比例条及 2×2 状态格。
  - [RankedBarChart.vue](file:///c:/Users/Jie/Documents/%E5%8D%9A%E7%89%A9%E9%A6%86/frontend/src/components/admin/charts/RankedBarChart.vue)：接入馆藏/3D 展项缩略图（带 `@error` 文字篆章降级）、金银铜前三序牌及双层 PV/UV 嵌套进度条。
- **验证结果**：`vue-tsc -b` 0 错、`vitest run` **86/86（465/465）**、`test:e2e:types` 0 错、`vite build` + 双门禁全绿（首屏 JS gzip `77,116 / 81,638 B`、CSS `15,348 / 80,000 B`、`woff2 = 0`、`AdminDashboardView` 异步 chunk `21.84 kB` gzip）；`07-admin.css` 与 `components/admin/charts/*.vue` 零 `!important`、零 `#hex`；Playwright `1440×900` 浅/深双主题与 `390×844` 移动端共 6 帧截图及缩略图全部 `complete: true, naturalWidth > 0, overflow: false, consoleErrors: []`。
