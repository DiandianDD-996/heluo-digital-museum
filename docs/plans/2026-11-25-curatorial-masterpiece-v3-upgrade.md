# 河洛数字博物馆 · 前端审美跃迁与多模态策展体验 3.0 升级实施计划

> 日期：2026-11-25  
> 分支规划：先封存基线快照分支 `codex/backup-2026-11-24-baseline`，再于 `codex/feat-curatorial-masterpiece-v3` 实施  
> 关联需求 ID：`F-01`、`F-02`、`F-03`、`F-04`、`F-05`、`F-06`、`F-08`、`F-09`、`F-10`、`F-11`、`F-12`、`F-13`、`F-14`、`A-01`、`A-02`、`N-03`、`N-06`  
> 设计规范演进：升级并同步 [design.md](../../design.md)（`Heluo Editorial 3.0`：8 层 `@layer` + OKLCH 冷夜玄青/清透宣白/后台典藏白灰令牌，零外部 `.woff2`、可见字号 `>= 12px`、触控热区 `>= 44px`、首屏 JS gzip `< 81,638 B`）

---

## 1. 目标

在当前 84 分硬核工程与旗舰专件基础上，彻底攻克拉低整体审美的四大核心短板（**图像资产 AI 味与灰底黑框穿帮、深色黑棕发闷与大面积沉寂、后台泛黄拥挤、跨页流转与点云高光不足**），将全站体验推升至 **95+ 分国际数字博物馆画册级水准**：

1. **零风险可随时一键回退的基线保护（Phase 0）**：将当前工作树全部已验收但未提交的前后端状态完整固化至独立备份分支与离线补丁快照，确保任意时刻可 1 秒无损退回当前版本。
2. **全站色彩重调与克制动态环境光影（Phase 1）**：
   - 深色模式彻底去棕，重调为**「冷夜玄青 / 苍冥曜石黑」**（冷底衬托暖鎏金、青铜粉绿锈与朱砂红）；
   - 浅色模式微降浊黄，提纯为**「清透当代美术馆宣白」**；
   - 管理后台剥离古宣黄，建立独立**「Archivist Neutral 极净典藏白灰」**工作台令牌；
   - 全站底层引入极低 GPU 开销的**「洛水微澜漫反射流光 + 河洛几何浑天细环缓慢自转水印」**动态背景，消除大面积同色系沉寂感。
3. **去 AI 味高精视觉资产重制与馆藏无痕装裱（Phase 2）**：
   - 淘汰首页带假盆景树、套娃玻璃罩、地面涂抹伪影的走廊图，重制**高锐度极简光束石台与青铜重器摄影级双主题主视觉**；
   - 按**「Leica 90mm 微距商业实拍、冷调青石/原麻台面、零暖黄滤镜、真实瓷釉冷高光与丝绸经纬」**重绘 3 件文创主图及悬停材质微距副图；
   - 对 6 件馆藏主图执行**影棚灰底软剥离与暗房接触暗影无痕融合**，彻底消灭探索页与详情页“纯黑底框套灰色方块”的硬边割裂。
4. **吸收「Zyon学长聊ai」三条参考作品高光精髓（Phase 3）**：
   - 升级 `ThreeExhibitViewer` 点云着色器为**「青铜粉绿锈 × 22K 错金铭文」光谱 + GLSL 有机呼吸微扰动 + 鼎足下方同心「散落微尘光池（Ground Dust Light Pool）」**；
   - 在文物详情铭牌与 3D 展品档案抽屉新增**「器物矿物色谱圆点（Material Light Swatches）+ 工艺线索线框签（Craft Clues）」**；
   - 首页与展厅融入**「礼 · 玉 · 河 · 洛」章节式留白引言**，打通首页 Section 2「一鼎之间」3 看点**左侧器物微距推镜联动**及 `?focus=ear|motif|feet` 直达 3D 部位聚焦，并补齐 `EXHIBIT 01 ↔ EXHIBIT 02` 暗房内直通切柜。
5. **跨路由共享元素一镜到底 + 详情页黄铜放大镜与图录排印（Phase 4）**：
   - 激活 View Transitions API 动态共享元素 `active-artifact-plate` + 悬停 `120ms` 详情数据预取，实现「探索网格 → 详情 60% 展台 → 3D 海报帧」平滑飞行落位；
   - 为非 3D 器物详情页接入**黄铜游标 2.5× 局部微距放大镜与全屏暗房高清缩放**；
   - 升级 `68ch` 长文排印：首段宋刻沉降首字、文末「留给观众的问题」朱砂细栏批注笺（直连问洛笙）、正文关联器物悬停微缩铭牌预览。
6. **任务页仪式感拉齐与双语漏译 100% 清零（Phase 5）**：
   - 预约页右侧预览升级为**「待钤印宣纸活字副券母版」**（实时排字 + 提交瞬间朱砂篆印落下动画），14 天日历区分周一闭馆并增加余量细刻度；
   - 文创模拟支付完成生成**「河洛文创 · 模拟收藏出库笺」**，商品卡微露灵感文物纹样切片；
   - 个人中心嵌入**「我的观展手账画册摘要轨」**；`NotFoundView` 升级为**「编号未录 · 待考残简」**策展彩蛋页；
   - 清零 `en-US` 模式下详情页分类/尺寸/馆藏地与个人中心订单商品名残留中文，收敛双语单一事实源。
7. **管理后台 Linear 级清爽工作台重构（Phase 6）**：
   - 移除常驻占半屏的超长新建表单，主屏 100% 释放给高可读结构化列表与精炼 KPI 条；
   - 新建/编辑收进**右侧宽幅滑出式抽屉（Slide-over Drawer）**，内置**「前台 68ch 画册实时预览」**一键切换与列表**「EN 已译 / 缺译文」**完整度徽标，同步更新后台单测套件。

---

## 2. 影响范围

### 2.1 样式架构与设计规范（前端零新增散装全局 CSS 文件）
- `design.md`（同步更新 `Heluo Editorial 3.0` 色板令牌、后台中性色规范与动态背景降级契约）
- `frontend/src/styles/01-tokens.css`（冷夜玄青深色令牌、清透宣白浅色令牌、器物矿物色谱辅助令牌）
- `frontend/src/styles/03-surfaces.css`（展台接触暗影、无痕装裱表面与环境流光遮罩）
- `frontend/src/styles/04-components.css`（矿物色谱圆点、工艺线索签、朱砂批注笺、微缩预览卡样式）
- `frontend/src/styles/05-shell.css`（全局克制漫反射流光与几何浑天旋轨背景层）
- `frontend/src/styles/06-motion.css`（`active-artifact-plate` 共享元素过渡几何缓动、`prefers-reduced-motion` 兜底）
- `frontend/src/styles/07-admin.css`（`Archivist Neutral` 白灰/冷石板工作台令牌、满宽列表与右侧宽幅滑出抽屉样式）

### 2.2 前端视图、组件与核心库
- **全局壳与过渡预取**：`frontend/src/App.vue`、`frontend/src/components/AmbientGalleryBackdrop.vue`（按需异步挂载）、`frontend/src/lib/inkTransitions.ts`、`frontend/src/lib/prefetch.ts`、`frontend/src/router/index.ts`
- **双语与矿物色谱元数据**：`frontend/src/lib/contentLocale.ts`、`frontend/src/lib/curatorialSwatches.ts`、`frontend/src/lib/productPresentation.ts`
- **首页与探索馆藏**：`frontend/src/views/HomeView.vue`、`frontend/src/views/ExploreView.vue`、`frontend/src/components/PlainTextLinks.vue`
- **文物/专题详情与微距检视**：`frontend/src/views/ContentDetailView.vue`、`frontend/src/components/ArtifactLoupeStage.vue`（懒加载组件）
- **3D 展厅与点云着色器**：`frontend/src/components/ThreeExhibitViewer.vue`、`frontend/src/lib/pointCloudQuality.ts`、`frontend/src/views/ExhibitDetailView.vue`、`frontend/src/views/ExhibitsView.vue`
- **预约、文创、个人档案与 404**：`frontend/src/views/AppointmentView.vue`、`frontend/src/views/ShopView.vue`、`frontend/src/components/CartPanelContent.vue`、`frontend/src/views/ProfileView.vue`、`frontend/src/components/ProfileOrders.vue`、`frontend/src/views/NotFoundView.vue`
- **管理后台工作台**：`frontend/src/views/AdminContentView.vue`、`frontend/src/views/AdminOperationsView.vue`、`frontend/src/components/AdminShell.vue`

### 2.3 视觉媒体资产与离线处理脚本
- `frontend/public/media/editorial/`（新版首屏浅/深双主题极简光束石台主图及多档位 `.webp`、6 件暗房边缘无痕融合馆藏图；旧资产保留备份后缀不破坏历史引用）
- `frontend/public/media/shop/` 及 `frontend/public/media/responsive/`（新版 3 件买手店冷调微距实拍主图 + 悬停材质细节副图及 `320w/640w/960w` 响应式切片）
- `frontend/src/lib/responsiveMediaManifest.json`

### 2.4 单测与 E2E 回归用例
- `frontend/src/views/AdminQuality.spec.ts`（适配右侧滑出抽屉触发与实时预览断言）
- `frontend/src/assets/themeFoundation.spec.ts`、`darkThemeCohesion.spec.ts`（同步新 OKLCH 冷夜玄青与清透宣白令牌契约）
- 新增/扩展共享过渡、详情微距放大镜、双语零中文残留及点云光池单测与 `frontend/e2e/` 视觉巡检脚本
- **后端影响**：**零后端代码或数据库迁移改动**（保持后端 `106/106` 测试零风险稳定）。

---

## 3. 实施步骤

### Phase 0：零损一键回退基线封存（最高优先级前置动作）
1. 检查 `git status`，在用户授权执行本计划后，首先基于当前 `HEAD` + 全部工作树未提交变更切出并提交备份快照分支 `codex/backup-2026-11-24-baseline`，同时导出工作树快照清单至项目外 scratch 备份记录。
2. 从该快照点切出本次开发分支 `codex/feat-curatorial-masterpiece-v3`，验证一行命令 `git switch codex/backup-2026-11-24-baseline` 即可 100% 回到升级前状态。

### Phase 1：全站色彩令牌重调（`Heluo Editorial 3.0`）与克制动态背景
1. 重调 `01-tokens.css`：
   - **深色「冷夜玄青 · Cold Obsidian Gallery」**：`--surface-canvas: oklch(12.2% 0.006 238)`、`--surface-subtle: oklch(14.8% 0.007 238)`、`--surface-elevated: oklch(17.6% 0.008 238)`、`--surface-plinth: oklch(14.2% 0.007 238)`，搭配暖香槟钛金 `--accent-jade: oklch(82% 0.054 78)`、古铜 `--accent-bronze: oklch(74% 0.062 74)` 与青铜粉绿微光 `--accent-patina: oklch(68% 0.072 168)`；
   - **浅色「清透宣白 · Crisp Museum Paper」**：`--surface-canvas: oklch(97.4% 0.008 84)`、`--surface-subtle: oklch(95.4% 0.010 84)`、`--surface-elevated: oklch(99.5% 0.003 85)`，保留温润纸感同时彻底去除浑浊偏黄。
2. 在 `07-admin.css` 建立 `.admin-workspace` 独立 `Archivist Neutral` 令牌（浅色 `#F8F9FA / #FFFFFF / 1px 石墨细线`，深色冷石板灰阶），彻底剥离古宣黄。
3. 实现异步轻量化 `AmbientGalleryBackdrop.vue`（挂载于公开前台底层 `z-index: 0`）：结合极慢速柔和天光/洛水漫反射色晕漂移与 `0.5px` 河洛浑天仪几何细线缓慢旋轨水印（滚动轻微视差，`prefers-reduced-motion: reduce` 与后台路由完全静默）。
4. 同步更新 `design.md` 与主题契约单测。

### Phase 2：去 AI 味高清图像重制与馆藏“黑框套灰底”根治
1. **首页 Hero 双主题主视觉**：调用高精度图像生成工具产出浅色（极简天光石灰岩展台 + 侧逆光青铜重器局部留白，无假树无套娃玻璃框）与深色（冷夜曜石聚光束展台 + 青铜重器幽微金属肌理）超清母版，生成全套响应式 `.webp` 并更新 `HomeView.vue` 与清单。
2. **商城 3 件文创静物图 + 微距肌理副图**：按 Leica 90mm 冷调买手店静物摄影标准重制《河流纹茶杯套装》《河洛水系丝巾》《河图纹笔记本》主图与悬停微距细节图，生成 `320w/640w/960w` 切片，彻底消除暖黄塑料感。
3. **6 件馆藏器物图暗房无痕融合**：编写图像处理脚本对 `explore-bronze-ding-user-v2.webp`、`explore-water-bird-bronze-user-v2.webp` 等带影棚中灰底的馆藏图进行边缘平滑背景剥离与羽化合成，配合 `.gallery-object__media` / `.detail-media` 展台顶光与底部椭圆接触暗影，彻底消除矩形灰框硬边。

### Phase 3：融合 Zyon 三条视频高光亮点（点云光池 + 矿物色谱 + 章节推镜）
1. **升级 `ThreeExhibitViewer.vue` & `pointCloudQuality.ts`**：
   - 将点云调色板升级为高辨识度「青铜粉绿锈 `jade: [0.38, 0.72, 0.62]` × 错金铭文 `copper: [0.98, 0.83, 0.50]` × 银白高光核」，场景暗雾同步为冷曜石 `#0d1014`；
   - 在顶点着色器增加静置态低频有机呼吸微扰动（`uReducedMotion` 为 1 时归零）与螺旋聚拢入场弧线；
   - 重写 `makeDust()`：使用自定义圆形柔光片元着色器，除空间微浮尘外，在鼎足底座平面 `y = bounds.min.y` 构建同心渐变**「散落微尘光池（Ground Dust Light Pool）」**。
2. **新增「器物矿物色谱 & 工艺线索」铭牌组件**：在 `curatorialSwatches.ts` 定义 6 件馆藏与 2 件展项的真实矿物取色圆点（中英双语色名 + OKLCH 色值）与 3–4 枚传统工艺线索签，接入 `ContentDetailView.vue` 与 `ExhibitDetailView.vue` 档案抽屉。
3. **首页章节引言、3 看点微距联动与 3D 暗房直通**：
   - `HomeView.vue` 植入「礼 · 玉 · 河 · 洛」极简章节留白眉题与几何浑天细环水印；
   - `HomeView.vue` Section 2 点击 `双耳 / 器腹饕餮纹 / 三足支撑` 时，左侧青铜鼎展台同步平滑推镜聚焦对应部位并点亮局部聚光遮罩，「进入 3D 近观」附带 `?focus=ear|motif|feet`，`ExhibitDetailView.vue` 读取查询参数在模型就绪后自动平滑推镜聚焦；
   - `ExhibitDetailView.vue` 顶栏与档案抽屉补齐 `EXHIBIT 01 ↔ EXHIBIT 02` 暗房直通切柜链接。

### Phase 4：跨路由共享元素一镜到底 + 详情放大镜与图录排印
1. **Shared-Element View Transitions & Hover Prefetch**：
   - 新增 `prefetch.ts`（带内存 LRU 短缓存复用于 `apiGet`），在 `ExploreView` 卡片 `pointerenter` 120ms 后预热对应 `/artifacts/:slug` 或 `/articles/:slug` 数据；
   - 升级 `inkTransitions.ts` 与 `06-motion.css`：点击卡片或详情「进入 3D 展项」时精准标记单个激活器物容器 `view-transition-name: active-artifact-plate`，实现列表、详情展台与 3D 海报帧之间的无缝几何缩放飞行。
2. **详情页 `ArtifactLoupeStage.vue`**：在 `ContentDetailView.vue` 展台图支持桌面悬停 2.5× 黄铜游标光学微距镜与点击全屏暗房高清检视（键盘 `Esc` 关闭、焦点归还）。
3. **长文 `68ch` 画册排印升级**：在 `ContentDetailView.vue` 实现首段宋刻沉降首字、文末「留给观众的问题」朱砂细栏策展批注笺（含「带着这个问题问洛笙 →」快捷提问胶囊）及 `PlainTextLinks.vue` 器物悬停微缩铭牌预览。

### Phase 5：任务页仪式感拉齐与双语漏译清零
1. **预约页 `AppointmentView.vue`**：右侧常驻面板升级为「待钤印宣纸活字副券母版」，随选定日期/时段/人数实时排入活字，提交成功触发朱砂印章钤盖动效后再弹出完整高清藏书票；14 天日历明确标注「周一闭馆」并为开放日渲染底部余量细刻度条。
2. **商城 `ShopView.vue` & `CartPanelContent.vue`**：商品卡微露灵感源文物纹样角标并支持主图/微距肌理图悬停切换；模拟支付完成态渲染「河洛文创 · 模拟收藏出库笺」（含订单号、灵感馆藏溯源与朱砂章）。
3. **个人中心 `ProfileView.vue` & `NotFoundView.vue`**：个人档案页新增「我的观展手账画册摘要轨」（直连打开线装手账与导出长图）；404 页重构为「编号未录 · 待考残简」策展彩蛋页。
4. **双语 100% 清零**：升级 `contentLocale.ts` 统一覆盖分类英文名、尺寸/典藏地英文译文与订单商品英文名，修复 `ContentDetailView.vue` 与 `ProfileOrders.vue` 英文态中文残留，清理 `ExploreView` / `ShopView` 重复本地英文表。

### Phase 6：管理后台 Linear 级工作台重构
1. 重构 `AdminContentView.vue` 与 `AdminOperationsView.vue` 布局：
   - 主工作区 100% 满宽展示 KPI 概览条、过滤搜索栏与高清晰度结构化记录列表；每条内容记录展示 `EN 完整 / 缺译文` 微徽标；
   - 将新建与编辑表单收进右侧宽幅滑出式抽屉（`560px–680px` Slide-over Sheet），顶栏设 `+ 新建文物 / 新建文章 / 新建商品 / 新建展项` 醒目触发按钮；
   - 在 `AdminContentView.vue` 抽屉顶栏内置**「表单编辑 ↔ 前台 68ch 画册预览」**分段切换，管理员可实时核对分段小标题、规格铭牌与双语展示效果；
   - 完整保留 `useUnsavedChanges` 在抽屉关闭、切换 Tab 及路由离开时的「保存并继续 / 放弃修改 / 继续编辑」防丢稿保护，并同步更新 `AdminQuality.spec.ts`。

### Phase 7：全量测试门禁、Impeccable 机械检测与双主题实机视觉验收
1. 执行前端 `pnpm --dir frontend typecheck`、`vitest run`、`pnpm --dir frontend build`（核验 `bundle-budget` 与 `music-assets-budget` 双门禁全绿）。
2. 执行 `impeccable.cmd detect --json --changed` 机械设计检测，确保无新增违规色值、微缩字或反模式。
3. 启动前后端隔离环境，运行官方 Playwright E2E（`bilingual-search.e2e.ts` + `business.e2e.ts`），并在 `1440×900` 与 `390×844` 视口捕获浅色/深色/英文/后台全套实机截图逐项复核。
4. 更新 `PROJECT_STATUS.md` 与 `docs/01-requirements-traceability.md`，审查 `git diff` 后向用户汇报并等待确认。

---

## 4. 验收标准

1. **安全回退保障**：`codex/backup-2026-11-24-baseline` 分支完整保存升级前全部状态，一行命令可无损回退。
2. **性能与构建硬红线**：
   - `initialJsGzipBytes < 81,638 B`、`initialCssGzipBytes < 80,000 B`、`woff2Files === 0`；
   - 动态背景与 3D 点云光池在离开路由或开启 `prefers-reduced-motion: reduce` 时零泄露、零多余 `rAF`。
3. **视觉与交互质量**：
   - 深色模式呈现纯净冷夜玄青衬暖金质感，无泥棕发闷；后台呈现极净白灰 Linear 级清爽层级，无古宣黄底残留；
   - 首页大图与商城 3 件商品图细节锐利、无 AI 黄雾塑料感；探索页与详情页 6 件馆藏无“黑框套灰底”硬边；
   - 探索 → 详情 → 3D 具备平滑共享元素过渡；3D 点云呈现铜绿×错金光谱与鼎足落尘光池；英文模式核心页面零未翻译中文字段混排。
4. **自动化测试全绿**：`vue-tsc` 0 错、Vitest 全量单测全绿、Playwright 双套件全绿、零浏览器控制台报错、移动端 `375px/390px` 零横向溢出。

---

## 5. 风险与控制措施

| 风险点 | 影响 | 控制措施 |
| --- | --- | --- |
| 全局动态背景与新增交互推高首屏入口 JS 体积 | 可能逼近 `81,638 B` 门禁 | `AmbientGalleryBackdrop`、`ArtifactLoupeStage` 等均采用 `defineAsyncComponent` 懒加载或纯 CSS 合成动画，首屏关键路径 JS 增量控制在 `< 1.5 KB` gzip。 |
| 馆藏实拍图边缘抠图若过硬会产生锯齿白边 | 暗房展台上出现生硬描边 | 采用基于背景色差距离场的平滑 Alpha 软剥离（保留 `2–3px` 自然亚像素羽化过渡）并在浅/深双主题下分别实机截图放大核验。 |
| 后台改为滑出抽屉影响既有 `AdminQuality.spec.ts` 选择器 | 单测初期报错 | 抽屉保持原有表单语义类名与 `useUnsavedChanges` 生命周期钩子，同步升级单测中的抽屉打开前置步骤，绝不删减任何业务校验断言。 |
| View Transitions 在不支持浏览器或异步慢网下的表现 | 动画跳帧或闪烁 | 结合 `120ms` 悬停数据预取 + `180ms` 超时安全降级，不支持浏览器或 `prefers-reduced-motion` 自动无感回退原生跳转。 |

---

## 6. 验证结果（2026-11-25 已完成全链路核验 + 4 轮实机细节精修）

- [x] Phase 0 基线备份分支与可回退性核验：已于 `codex/backup-2026-11-24-baseline`（commit `59454643dedcabf69997c9ec222bcf55075343f4`）完整封存升级前 97 项改动，并在新分支 `codex/feat-curatorial-masterpiece-v3` 开展全部施工；后端与数据库源码 0 改动（`git status --short -- backend` 为空）。
- [x] `pnpm --dir frontend typecheck`：`vue-tsc -b` 0 错误；`pnpm --dir frontend test:e2e:types`：`tsc -p e2e/tsconfig.json` 0 错误。
- [x] `pnpm --dir frontend exec vitest run`：**80 个测试文件 / 447 个用例全部通过**（含新增 `curatorialPhase4.spec.ts`、扩展后的 `contentLocale.spec.ts`、`AdminQuality.spec.ts`、`ThreeExhibitViewer.spec.ts` 及全部主题/预算契约测试）。
- [x] `pnpm --dir frontend build`（含 `bundle-budget` & `music-assets-budget`）：
  - 首屏 JS gzip：**`73,017 B`** / 预算 `81,638 B`（结余 `8,621 B`）
  - 首屏 CSS gzip：**`14,393 B`** / 预算 `80,000 B`（结余 `65,607 B`）
  - `woff2Files`：**`0`**
  - 配乐 R4 门禁：4 首 AAC `.m4a`，`5,001,307 / 6,000,000 B`，散列与 CC0 清单一致
- [x] `impeccable detect --json --changed` 机械设计审计：返回 **`[]`（0 违规）**。
- [x] Playwright E2E（`bilingual-search.e2e.ts` & `business.e2e.ts`）与 `1440×900` / `390×844` / `375×812` 双主题 + 交互态 + 移动端实机截图 4 轮核验：
  - 官方 E2E 双套件（运行于含 V30 双展项与洛笙 AI 向导的完整隔离实例）：**18/18 全部通过（39.8s）**（`bilingual-search.e2e.ts` 11/11 + `business.e2e.ts` 7/7）
  - **Round 1–4 深度精修闭环**：除首轮 23 帧基线复检外，继续针对实机预览展开 4 轮（共 60+ 帧）全交互与极窄 `375×812` 审查并逐项根治：
    1. `/exhibits` 双展柜统一升级冷夜玄青暗房展台（含石板与青铜鼎柔光接触影）并补全英文副标题/溯源译文；
    2. `RakingLightViewer` 暗房冷调同步 + WebP 透明通道边缘遮罩修复（消除石板右上角边角伪影）+ 移动端 HUD 位置提升避让底坞；
    3. `ProductProvenanceDrawer` 补齐浅色模式 `provenance-frame--source` 暗房展柜类，`CuratorialBookmarkSheet` 冷却遮罩与书脊色温并升级导出主钮；
    4. `04-components.css` 将 `.mineral-swatch-row` 升级为单列左右对齐色谱账本（彻底消除 3D 暗房抽屉与文物详情 OKLCH 字符串截断），并根治 `.inline-status > i` 的 `background: currentColor` 导致暗色成功勾选圆点反黑的底层 CSS 缺陷；
    5. `ExhibitDetailView` 3D 抽屉中文本地化 `licenseLabel`、冷却所有残余暖棕 hue `74` 暗房底色、移动端隐藏顶栏切柜胶囊（保留于底部抽屉内）消除顶栏换行压盖声景邀请条；
    6. `LuoshengSiteGuide` 抽屉改实色防透底、缩短单行输入占位符、`<768px` 折叠为 48×48 圆形青铜篆印触发器并针对首页/3D/斜射光三类底栏精确避让（375px 零重叠）；
    7. `CartPanelContent` 支付成功态隐藏冗余空袋图标并防出库笺抬头孤字换行，`LoginView` 暗色模式建筑天空压暗无缝溶入玄青画布，`HomeView` 去除 Section 2 铭牌旧红边，`ContentDetailView` 专题头图右卡垂直居中并收紧英文首字沉降间距。
