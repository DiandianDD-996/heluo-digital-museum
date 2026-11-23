# 河洛数字博物馆 · 前端视觉与架构全面升级方案（Heluo Editorial 2.0）

> **文档性质**：高水准专业前端设计评审报告 + 可直接用于 `/goal` 模式一竿子执行到底的完整落地实施蓝图  
> **评审基线**：2026-11-22 代码快照 + `docs/design/audit/` 实机渲染截图 + `frontend/scripts/bundle-budget.mjs` 性能门禁  
> **关联约束**：严格遵守 `AGENTS.md`（不破坏现有业务与 API、不引入大型依赖、不新增 WOFF2 字体文件、保持 `vue-tsc` / `vitest` / `vite build` / `bundle-budget` 全绿、所有权限与数据边界不变）

---

## 一、全方位锐评：当前前端离「高水准专业设计团队作品」有多远？

### 1.1 综合评分（满分 10 分）

| 评估维度 | 当前得分 | 专业团队标杆线 | 一句话诊断 |
| --- | :---: | :---: | --- |
| 业务功能完整性与容错 | **9.0** | 8.5 | 幂等提交、草稿恢复、3D 降级、AI 向导集成非常扎实 |
| 性能工程意识 | **8.0** | 8.5 | 首屏预算门禁、响应式 WebP、按需加载思路优秀 |
| **视觉系统统一性** | **4.5** | 9.0 | **最大短板**：四套审美语言同时存活，跨页割裂感极强 |
| **版式、留白与高级感** | **5.5** | 9.0 | 缺乏博物馆画册的呼吸感，多处沦为“粗框卡片装一切” |
| **交互细腻度与动效克制** | **5.5** | 8.5 | 自定义光标忽隐忽现、双动画库并存、3D 舞台浮层杂乱 |
| **CSS 与前端样式架构健康度** | **3.5** | 9.0 | **严重失控**：26 个 CSS、~19,600 行、1,002 个 `!important` |
| **综合设计水准** | **5.8** | **9.0** | **“工程很硬核，但视觉像五位风格迥异的设计师轮流打补丁的缝合体”** |

**核心结论**：目前的前端**尚未达到**高水准专业前端设计团队的作品标准。它的核心问题不是“缺功能”或“不够努力”，而是**在多轮局部视觉试验中只做加法不做减法**——新方案没能清理旧方案，导致审美方向互相抵消、样式权重恶性膨胀、界面显得厚重局促，失去了顶级文化机构应有的**静谧、克制、锋利与策展仪式感**。

---

### 1.2 六大系统性病灶（附代码与渲染实证）

#### 病灶 1：CSS 架构进入「特异性军备竞赛」（工程级灾难）

实测 `frontend/src/assets/*.css` 现状统计：

| 文件名 | 行数 | 源码体积 | `!important` 数量 | 现状诊断 |
| --- | ---: | ---: | ---: | --- |
| `main.css` | 3,922 | 234.0 KB | 64 | 混杂大量已废弃首页旧类（`.curation-home`、`.home-hero`、`.artifact-dial`）及硬编码色值 |
| `route-explore-legacy.css` | 3,399 | 126.5 KB | 108 | 历史探索页巨型遗留表 |
| `control-surface-polish.css` | 2,456 | 76.4 KB | 199 | 补丁之王，用 `html[data-theme] #app ... !important` 全局强压控件 |
| `route-exhibit-detail-legacy.css` | 1,959 | 88.8 KB | 74 | 3D 展项页历史样式 |
| `route-admin-legacy.css` | 1,516 | 82.6 KB | 139 | 后台历史样式，与 Element Plus 样式打架 |
| `task-pages.css` | 1,370 | 52.8 KB | 59 | 预约/登录/个人中心混写 |
| `explore-discovery-reference.css` | 802 | 28.5 KB | 81 | **0 引用死文件** |
| `explore-reference.css` | 780 | 36.2 KB | 0 | 仅被旧测试引用 |
| `explore-gallery.css` | 349 | 28.3 KB | 80 | 用 `html #app #explore-gallery` + 硬编码 23 个 hex/rgba 覆盖上层补丁 |
| `light-ui-material-depth.css` | 256 | 10.7 KB | 70 | 硬加厚重陶瓷边线与投影，覆盖 `tactile-ui.css` |
| 其余 16 个 CSS 文件 | ~2,790 | ~115 KB | 128 | 包含 `explore-page-optimization.css` 等 0 引用死文件 |
| **合计（26 个文件）** | **~19,600** | **~880 KB** | **1,002** | **11 个页面背负了 2 万行互相打架的 CSS** |

- **典型灾难案例**：仅一个 `MuseumSearchField` 搜索框，就在 `tactile-ui.css`、`light-ui-material-depth.css`、`control-surface-polish.css`、`explore-gallery.css` 四个文件里被连续覆写了 4 次，选择器一路叠到 `html[data-theme] #app #explore-gallery .gallery-search .museum-search-field__control { height: 46px !important; }`。
- **直接后果**：任何微调都会引发不可预知的级联回归，且首屏 CSS 体积被大量死代码和覆盖规则白白吞噬。

#### 病灶 2：四套视觉语言同屏打架，全站品牌感支离破碎

1. **策展极简风**（`HomeView.vue`）：大留白、无重边框、摄影主导；
2. **厚壳拟物风**（`tactile-ui.css` + `light-ui-material-depth.css`，源自 Uiverse 卡片/输入框片段）：粗暗绿色外框 + 双层内嵌古铜线 + 内凹灰底输入框 + 强投影，让卡片和输入框看起来像“套了厚塑料保护壳的旧式工业面板”；
3. **毛玻璃拟态风**（`glass.css` 的 `data-glass`）：被后续补丁在多个页面用 `backdrop-filter: none !important` 局部阉割，导致同站控件有的透、有的不透；
4. **硬编码冷翠商务风**（`explore-gallery.css` 直接违背 `design.md` 的令牌禁令硬编码 `#173c31`/`#0e6248`）+ 后台 `Element Plus` 默认组件观感。

#### 病灶 3：排版缺乏「博物馆画册」的呼吸感与精细度

- **系统字体未被精心雕琢**：受 WOFF2 零字库门禁约束使用系统字体本身很务实，但直接用 `STSong/SimSun` 400 字重作为大标题，在 Windows 高分屏上笔画瘦削、锯齿明显；缺少字号级差、字重补偿、行高节奏和中文标点/断行控制。
- **装饰性英文与微缩字泛滥**：`brand-copy small` 字号小至 `0.43rem`（约 6.9px，可读性为零）；全站随处可见风格各异的英文标签（`DIGITAL ARCHIVE 01 ONLINE GALLERY`、`YOUR SELECTION`、`VISITOR CART`、`VISIT TICKET`、`COLLECTION DESK`），视觉噪音远大于信息价值。

#### 病灶 4：逐页视觉与体验硬伤清单

| 页面 | 当前核心视觉与体验缺陷 |
| --- | --- |
| **全局壳层（Header / Footer / Mobile Tab）** | 1. 顶部导航缺少滚动后的轻盈收敛感；<br>2. **页脚极其寒酸**：只有干巴巴一行文字+一条横线，缺乏专业博物馆的开放时间、洛阳馆址、快速索引与策展声明；<br>3. 移动端底部 Tab Bar 在浅色模式下呈现发脏的灰暗半透明条，图标与文字对比度偏低。 |
| **首页（`HomeView.vue`）** | 1. 首屏左侧 `94% -> 60% -> 0` 纯色渐变遮罩像一层“白雾贴纸”硬盖在建筑廊道上；<br>2. “走近器物”和“河洛三脉”配图使用 `object-fit: contain` + 浅灰实底块，器物边缘与卡片背景生硬割裂，缺乏博物馆展台光影氛围；<br>3. 底部“预约参观”收尾区过于单薄，缺乏转化张力。 |
| **探索馆藏（`ExploreView.vue`）** | 1. 顶部检索区与分类栏层级单薄，缺少高定馆藏目录的仪式感；<br>2. 器物卡片的年代、材质、分类标签信息层级平庸；<br>3. 下方“主题导览”和“文化阅读”视觉节奏雷同，缺乏“图录区 vs 期刊阅读区”的版式区分。 |
| **文物/文章详情（`ContentDetailView.vue`）** | 1. 长文阅读排版偏平，缺少博物馆策展长文的“首字/导语突出、图注规范、宽幅引文、清晰分节”；<br>2. 器物基础档案（时代/材质/尺寸/馆藏地）展示不够像精致的“实体博物馆展签铭牌”。 |
| **数字展厅列表（`ExhibitsView.vue`）** | 1. 当前核心 3D 展项只有 1 件（青铜鼎），却套用了“巨大顶部 Banner + 列表网格”结构，导致页面重心偏空；<br>2. 介绍文案中直接写“使用项目组自主创作的河洛风格青铜鼎 GLB 模型”，工程味过重，破坏策展沉浸感（技术/版权来源应优雅收纳至展签注脚）。 |
| **3D 展项详情（`ExhibitDetailView.vue`）** | 1. **浮层过载**：左/右墙面装饰字 + 场景标牌 + 顶部返回 + 左侧工具条 + 右侧信息板 + 底部 6 步导览与视角 Dock + 洛笙 AI 浮标，最多 **7 个 UI 元素同时包围 3D 画布**；<br>2. 3D 舞台本身被边缘控件压缩，不够沉浸、不够“暗房聚光灯”。 |
| **河洛文创商城（`ShopView.vue`）** | **全站最急需重做**：<br>1. 全屏背景图上硬生生悬浮三张参差不齐的粗框白卡，遮挡背景茶具/丝巾主体，层次极其混乱；<br>2. 右侧购物袋在未登录/空态时是一块巨大的死白空框，视觉失衡；<br>3. 缺少高端文创买手店（MoMA / 故宫文创）的摄影陈列感与商品细节表达。 |
| **预约参观（`AppointmentView.vue`）** | 1. 左侧步骤条+14天日期+时段+表单纵向过长，信息密度平铺；<br>2. 右侧“本次参观”只是普通灰框列表，完全浪费了博物馆最迷人的**“实体/电子入馆票根（Museum Pass）”**视觉锚点；<br>3. 浅色模式下输入框厚重内凹边框显得陈旧。 |
| **登录与个人中心（`LoginView.vue` / `ProfileView.vue`）** | 1. 登录页左侧水彩建筑亮部直接压白字，对比度隐患明显；右侧深色/厚框卡片与水彩画风割裂；<br>2. 个人中心预约记录与订单记录缺乏卡片化状态视觉（如票根态、订单进度条）。 |
| **后台管理台（`AdminShell` / `Content` / `Operations`）** | 1. `route-admin-legacy.css` 与 `Element Plus` 原生样式风格分裂；<br>2. 顶部 KPI 概览、筛选工具栏、编辑区与列表区缺乏现代 SaaS/CMS（Linear 级）的干净栅格与清晰留白。 |
| **洛笙 AI 向导（`LuoshengSiteGuide.vue`）** | 面板样式独立于 `luosheng-palette.css`，与新主站视觉语言需统一对齐；在 3D 页与移动端需严防遮挡核心操作按钮。 |

#### 病灶 5：动效与指针交互的“过度设计”与“体验割裂”

- **自定义光标（`PointerCursor`）体验割裂**：30px 绿色大圆环仅在部分路由启用，进入商城/个人中心/登录/后台就突然变回系统鼠标，跨页割裂感极强；且大圆环悬浮在标题与输入框上方时严重干扰视线。
- **双动画库并存**：`ShopView.vue` 与 `ContentDetailView.vue` 同时混用 `gsap` 和 `motion-v`，导致动效曲线、入场延迟和包体积维护成本双重增加。

#### 病灶 6：深色模式缺少「暗房展厅打光」层次

- 深色模式目前更多是“把背景换成深炭灰+金线边框”，但图片容器与画布之间生硬拼接，缺少博物馆夜间展厅特有的**微弱顶光径向光晕（Gallery Spotlight）**与精致的暗面层次区分。

---

## 二、目标设计体系：Heluo Editorial 2.0（河洛新策展主义）

> **设计定位**：对标 **Rijksmuseum（荷兰国立博物馆）× The Met × MoMA Design Store × Linear** 的当代东方数字策展系统。  
> **视觉关键词**：**宣纸留白 · 青石细线 · 墨玉暗房 · 古铜点金 · 朱砂一印**。

### 2.1 不可动摇的 6 条美学铁律

1. **去厚壳，立细线**：彻底废除 2px+ 粗边框、双层内嵌假金属边和厚重阴影。卡片与面板以**极轻色阶差 + `1px` 低对比细线（Hairline）**界定层级，只在悬浮/浮层使用极柔和的弥散投影。
2. **摄影与器物是绝对主角**：页面不再用大面积花哨背景图与浮卡互抢焦点；器物摄影拥有专属的**展台比例（4:5 / 3:4 / 16:10）与柔光衬底**。
3. **单一权威令牌源（Single Source of Truth）**：所有颜色、字号、圆角、阴影、动效时长全部来自 `tokens.css`；全站禁止在组件或页面 CSS 中硬编码任何 `#hex` 或 `rgb()`。
4. **CSS Cascade Layers 零 `!important` 架构**：全局入口声明 `@layer reset, tokens, base, surface, components, views, overrides;`，通过清晰的层级自然覆盖，全站 `!important` 数量从 **1,002 压降至 < 10**（仅保留 `forced-colors` / `prefers-reduced-motion` 无障碍兜底）。
5. **系统字库精排（遵守 0 WOFF2 门禁）**：
   - **Display（策展衬线）**：`"Source Han Serif CN", "Noto Serif CJK SC", "Songti SC", "STSong", "FangSong", Georgia, serif`；配合精细字距（中文标题 `-0.015em` 到 `0.02em`，大标题 `font-weight: 600` 配合 `text-rendering: optimizeLegibility` 消除单薄感）。
   - **Body（现代无衬线）**：`"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, -apple-system, sans-serif`；正文统一 `15px–16px / 1.75–1.85` 行高。
   - **Mono / Data（编号、年代、票号、价格）**：`ui-monospace, "SFMono-Regular", Consolas, monospace` + `font-variant-numeric: tabular-nums`。
   - **最小字号底线**：全站任何可见文字不得小于 **`12px`（`0.75rem`）**，彻底消灭 `0.43rem` 微缩字。
6. **克制而一致的动效与光标**：
   - 默认回归**原生精准光标**（或在 3D/画廊大图悬停时提供极克制的上下文态提示），彻底移除全站遮挡视线的 30px 绿色大圆环光标；保留并弱化 `PointerDotField` 仅作为首页/展厅极低存在感（opacity ≤ 0.35）的呼吸微粒纹理。
   - 统一动效曲线 `--ease-curatorial: cubic-bezier(0.22, 1, 0.36, 1)`，标准交互 `180ms`，入场 `320ms`，严禁弹跳与重复入场闪烁。

### 2.2 全新双主题 OKLCH 语义色板

#### 浅色主题：「日间月白展厅 · Daylight Paper」
- `--surface-canvas`: `oklch(97.8% 0.004 95)`（温润微暖宣纸白，告别冷惨白与发灰青绿底）
- `--surface-subtle`: `oklch(94.8% 0.008 105)`（宣纸次级面/展台衬底）
- `--surface-elevated`: `oklch(99.5% 0.002 95)`（纯净展签白）
- `--ink-primary`: `oklch(20% 0.024 168)`（深墨青，对比度 > 13:1）
- `--ink-secondary`: `oklch(38% 0.020 168)`（正文墨色，对比度 > 7:1）
- `--ink-muted`: `oklch(52% 0.015 165)`（辅助说明，对比度 ≥ 4.6:1）
- `--border-hairline`: `oklch(25% 0.02 168 / 0.10)`（极细结构线）
- `--border-strong`: `oklch(25% 0.02 168 / 0.22)`（悬停/强调边线）
- `--accent-jade`: `oklch(38% 0.072 165)`（主操作深青玉）
- `--accent-jade-hover`: `oklch(31% 0.068 165)`
- `--accent-bronze`: `oklch(58% 0.085 72)`（年代、编号、细金线）
- `--accent-seal`: `oklch(53% 0.145 29)`（朱砂印章色，全屏严格 < 3%）

#### 深色主题：「夜间墨玉展厅 · Nocturne Gallery」
- `--surface-canvas`: `oklch(12.5% 0.008 165)`（深墨石，绝非死黑 `#000`）
- `--surface-subtle`: `oklch(16.5% 0.010 165)`（展柜次级面）
- `--surface-elevated`: `oklch(21% 0.012 165)`（浮起卡片/面板）
- `--surface-spotlight`: `radial-gradient(ellipse at 50% 0%, oklch(28% 0.025 75 / 0.28), transparent 72%)`（展厅顶光）
- `--ink-primary`: `oklch(93.5% 0.010 88)`（暖象牙白）
- `--ink-secondary`: `oklch(78% 0.012 155)`（柔玉灰正文）
- `--ink-muted`: `oklch(62% 0.014 155)`（次要注脚）
- `--border-hairline`: `oklch(88% 0.02 85 / 0.10)`
- `--border-strong`: `oklch(75% 0.065 75 / 0.36)`（古铜微光边线）
- `--accent-jade`: `oklch(71% 0.092 75)`（暗模式下主操作升华为温润古铜金，与暗墨底形成博物馆级奢华质感）
- `--accent-jade-hover`: `oklch(78% 0.095 75)`
- `--accent-jade-ink`: `oklch(14% 0.014 165)`（金底深墨字，对比度 > 8:1）

### 2.3 目标 CSS 文件架构（从 26 个收敛至 8 个核心基础层）

```text
frontend/src/styles/
├── 00-layers.css        # @layer reset, tokens, base, surface, components, views, overrides;
├── 01-tokens.css        # 唯一权威令牌（色彩/字阶/间距/圆角/投影/动效，浅+深+无障碍降级）
├── 02-reset-base.css    # 盒模型、排版基准、焦点环、滚动条、无障碍 sr-only/skip-link
├── 03-surfaces.css      # 统一材质系统：paper / plinth / glass(light|dark|compact) / spotlight
├── 04-components.css    # 共享基础控件：按钮、输入框、搜索框、分段选择、徽标、骨架、弹窗、BottomSheet
├── 05-shell.css         # 全局 Header（含滚动收缩）、结构化 Footer、移动端 Bottom Tab Bar
├── 06-motion.css        # 统一动效工具类、View Transitions、reduced-motion 兜底
└── 07-admin.css         # 后台四层工作台统一设计系统（含 Element Plus 主题变量深度对齐）
```

**页面专属样式**：全部采用各视图 `.vue` 文件内的 `<style scoped>` 或同目录极简模块 CSS，严禁跨页污染！

---

## 三、分阶段可落地执行计划（Phase 0 → Phase 6）

> **设计原则**：每个 Phase 均可独立编译、独立通过测试并可随时在浏览器目视验收。`/goal` 模式可按 Phase 0 → Phase 6 顺序连续推进，每完成一个 Phase 必须运行该阶段的验证门禁并通过后方可进入下一阶段。

---

### Phase 0：视觉基线留存与契约盘点（准备阶段）

**目标**：建立改造前后的客观对比基准，理清受 CSS 架构重构影响的旧测试文件，避免后续盲改。

**执行步骤**：
1. 核查现有前端基线：`npm run typecheck`、`npm run test`、`npm run build`（在 `frontend/` 下运行）。
2. 清点并分类 `frontend/src/assets/*.spec.ts` 中的样式契约测试（区分“功能/无障碍/响应式硬门禁”与“已过时的旧拟物边框/旧类名断言”），在 `docs/plans/2026-11-22-frontend-design-overhaul.md` 末尾记录迁移策略：
   - **保留并增强**：响应式无溢出、焦点可见性、深浅主题切换、reduced-motion、bundle 预算、无 WOFF2、业务交互测试。
   - **随架构演进同步更新**：断言旧拟物文件（`light-ui-material-depth.css` / `tactile-ui.css` / `control-surface-polish.css`）特定选择器或旧 CSS 变量名的 spec 文件，改为断言新 `styles/01-tokens.css` 与 `04-components.css` 的新设计系统契约。
3. 使用 Playwright 截取改造前基线图（桌面 `1440×900` 浅/深 + 移动 `390×844` 浅，覆盖 `/`、`/explore`、`/exhibits`、`/exhibits/heluo-bronze-ding-3d`、`/shop`、`/appointment`、`/login`），存档至 `docs/design/audit/2026-11-22-overhaul-before/`。

**验收标准**：
- 基线构建与全量单元测试通过；
- 改造前 7 个核心页面基线截图存档完毕。

---

### Phase 1：设计系统底层重构与全局壳层升级（地基工程）

**目标**：建立 `@layer` 分层样式系统、全新 OKLCH 令牌、精雕组件基元、升级全局导航/结构化博物馆页脚/移动端底栏，并移除干扰性的全局大圆环光标。

**涉及文件**：
- 新建：`frontend/src/styles/00-layers.css` ~ `06-motion.css`
- 修改：`frontend/src/main.ts`、`frontend/src/App.vue`
- 修改组件：`FluidButton.vue`、`MuseumSearchField.vue`、`StatusBadge.vue`、`InlineStatus.vue`、`LoadingSkeleton.vue`、`BottomSheet.vue`、`AudioControl.vue`、`EditorialCard.vue`
- 精简/退役：`PointerCursor.vue`（默认关闭全局 30px 圆环遮挡，改为按需极简态或从全局壳层卸载，保留导出兼容测试）

**核心落地规格**：
1. **全新全局导航（`App.vue` + `05-shell.css`）**：
   - 高度桌面 `72px`（滚动超过 `24px` 平滑收敛至 `60px`，呈现高级吸顶毛玻璃 + `1px` 底细线）；
   - 左侧品牌印章 + 中文馆名（`16px/600` 衬线）+ 英文副标（`12px` 大写宽字距，**消灭 `0.43rem` 微缩字**）；
   - 中间主导航：取消花哨背景块，采用**清晰当前态下划线细金线（`2px` `--accent-bronze`）** + 温润文字色变；
   - 右侧工具组（音频 / 深浅色 / 中英 / 账户）：统一为 `36px–40px` 高度（触控区 `44px`）的极简透明/轻边框图标胶囊，告别笨重方砖按钮。
2. **结构化博物馆级页脚（`App.vue` + `05-shell.css`）**：
   - 从单行文字升级为 **3 栏策展页脚**（最大宽度 `1240px`）：
     - 左栏：河洛品牌印章 + 一句话策展使命 + 洛阳市洛龙区概念馆址与开放时段（09:00–17:00，周一闭馆）；
     - 中栏：快速导览（探索馆藏 / 3D 数字展厅 / 预约参观 / 河洛文创 / 个人档案）；
     - 右栏：项目声明（概念数字策展与 CC0 公开模型致谢说明）+ 版权信息。
   - 移动端优雅折叠为竖排紧凑结构，并预留底部 Tab Bar 安全间距（`env(safe-area-inset-bottom)`）。
3. **移动端底部 Tab Bar（`05-shell.css`）**：
   - 浅色采用纯净通透月白玻璃（`oklch(99% 0.003 95 / 0.88)` + `blur(16px)` + 顶部 `1px` 细线），告别发灰发脏的半透明条；
   - 选中态用深青玉/古铜金图标 + 顶部微型金点指示器，触控热区 ≥ `48px`。
4. **基础控件去油腻改造（`04-components.css`）**：
   - `FluidButton`：主按钮（深青玉实底 / 深色态古铜金实底，圆角 `6px`，无伪元素高光条、无厚投影）、次按钮（透明底 `1px` 细线，hover 轻染底色）、幽灵按钮、危险按钮（朱砂色）。
   - `MuseumSearchField`：单一权威样式，高 `46px`，圆角 `8px`，纯净背景 + `1px` 细线，focus 时单一平滑外光环，彻底移除双层厚框与 `!important`。
   - 所有表单 `<input>` / `<textarea>` / `<select>`：统一纯净平面化 + 微弱底色区分 + 清晰 focus 态，告别内凹厚边框。

**验证门禁**：
- `npm run typecheck && npm run test && npm run build` 全绿；
- 浏览器检查桌面与移动端 Header、Footer、Tab Bar 在浅/深双色下无溢出、对比度达标。

---

### Phase 2：策展封面与阅读体验重构（首页 + 探索馆藏 + 文物/文章详情）

**目标**：让用户一进入网站就被“国家级数字博物馆画册”的气场震撼，从首页到详情页形成行云流水的策展叙事闭环。

**涉及文件**：
- `frontend/src/views/HomeView.vue`
- `frontend/src/views/ExploreView.vue`
- `frontend/src/views/ContentDetailView.vue`
- 清理：`explore-gallery.css`、`route-explore-legacy.css`、`explore-discovery-reference.css`、`explore-reference.css`、`explore-page-optimization.css`

**核心落地规格**：
1. **首页（`HomeView.vue`）—— 电影感策展封面 × 杂志叙事流**：
   - **首屏 Hero（Full-bleed Curatorial Cover）**：
     - 取消生硬的左半屏“纯白雾贴纸”，改用**双层自然光影遮罩**（仅在文字区背后做柔和径向/线性衰减，确保廊道与青铜鼎通透震撼）；
     - 标题升级为极具雕塑感的排版（桌面 `clamp(3.25rem, 5.2vw, 4.75rem)`，行高 `1.12`，配合顶部极细古铜眉标 + 编号 `NO.01 · LUOYANG`）；
     - 主次 CTA 清晰分级：主按钮「探索馆藏」+ 幽灵玻璃按钮「进入 3D 数字展厅」；
     - 底部悬浮一条精致的**策展信息带**（左侧馆址与今日开放状态，中间微型滚动提示线，右侧「预约参观」快捷入口）。
   - **第二屏：「一鼎之间 · 器物精读」**：
     - 采用 **5:7 非对称画册双栏**：左侧为带极浅暖纸/暗房聚光灯衬底的高清青铜鼎展台图（支持柔和边缘融合，告别生硬灰方块），右下角压印细线铭牌（器型 / 材质 / 概念策展注脚）；右侧为大标题 + 3 个可点击的观察切入点标签（双耳 / 器腹饕餮纹 / 三足支撑）+「阅读青铜鼎故事」与「进入 3D 近观」双入口。
   - **第三屏：「河洛三脉 · 主题画廊」**：
     - 桌面端采用 **1.35fr : 1fr : 1fr 黄金不等宽三栏**，每张卡片采用无粗边框的**纯摄影展台 + 底部精致编号（01/02/03）+ 衬线标题 + 悬停平滑缩放（`scale(1.03)`）与箭头微移**；
     - 移动端改为精致横排图录卡，图文比例协调。
   - **第四屏：「赴一场河洛之约 · 预约横幅」**：
     - 设计为一张全宽**横向策展邀请函/票根式容器**（带极淡河洛水波底纹 SVG + 开放时间概要 + 醒目「预约线下参观」主按钮），作为首页优雅的转化收尾。

2. **探索馆藏（`ExploreView.vue`）—— 高定数字馆藏目录**：
   - **策展检索头**：左侧大衬线标题「探索馆藏」+ 一句话导语，右侧精致 `420px` 搜索框 + 热门检索建议词快捷点击（如：青铜 / 玉璧 / 河图 / 彩陶），让空手进来的访客立刻知道能搜什么。
   - **极简分类导航栏**：取消厚边框分段盒，改为**底部细线 Tab 栏（Underline Tabs）**，当前激活项配 `2px` 古铜/青玉指示线 + 实时馆藏数量计数。
   - **馆藏器物展墙**：
     - 全部视图第 1 帧保留 **跨 2 列 Hero 精选展品卡**（左大图 16:10 + 右侧策展导读与年代/材质铭牌），其余展品采用 **3 列等比呼吸感网格（4:3 展台画幅）**；
     - 展品图片采用统一的展台光影背景 + `object-fit: cover` / 精准居中留白构图，底部信息区精简为“分类·年代”眉标 + 衬线标题 + 材质，干净利落。
   - **专题阅读区（期刊目录风）**：
     - 改为**高质感期刊列表**（左 16:10 封面图 + 中间分类/作者/衬线标题/2行摘要 + 右侧细线阅读箭头，卡片间仅用 `1px` 水平细线分隔），与上方器物图录形成鲜明的节奏对比。

3. **文物/文章详情（`ContentDetailView.vue`）—— 沉浸式策展长文阅读器**：
   - 顶部增加 `2px` 固定**古铜阅读进度细线**（随滚动平滑推进）；
   - 文物首屏采用**左右画册头图**：左 60% 展台高清器物图（含概念展品优雅角标），右 40% **博物馆实体铭牌风档案卡**（分类、时代意象、材质、尺寸、馆藏位置，`1px` 细线网格排列 + 直达 3D 展项按钮）；
   - 正文区锁定最佳阅读行宽 **`68ch`（约 680px）**，行高 `1.9`，小节标题配竖向古铜短线装饰，右侧/左侧悬浮极简章节目录（Sticky TOC）实时高亮当前章节；
   - 底部以双卡收束：「进入 3D 互动展项」+「预约线下参观」。

**验证门禁**：
- 首页、探索页（含搜索/筛选/分页/空态）、文物与文章详情页在桌面 `1440×900` 与移动 `390×844` 浅/深双主题下均无布局错位与溢出；
- `npm run typecheck && npm run test && npm run build` 全绿。

---

### Phase 3：沉浸式 3D 数字展厅重构（展厅列表 + 3D 暗房展柜）

**目标**：把 3D 青铜鼎打造成全站最令人“哇塞”的视觉名片，彻底清理杂乱浮层，营造殿堂级暗房展柜体验。

**涉及文件**：
- `frontend/src/views/ExhibitsView.vue`
- `frontend/src/views/ExhibitDetailView.vue`
- `frontend/src/components/ThreeExhibitViewer.vue`（仅限外层容器/加载态/海报态样式微调，**严禁破坏 WebGL 渲染与释放逻辑**）
- 清理：`route-exhibit-detail-legacy.css`

**核心落地规格**：
1. **数字展厅列表（`ExhibitsView.vue`）—— 大片级策展主舞台**：
   - 当展项数量为 1–2 件时，自动启用 **Feature Exhibition Showcase 布局**：不再把单件镇馆之宝塞进空荡列表，而是呈现一张**全宽电影画幅主展陈卡片**（左 58% 高清月光青铜鼎展台图 + 右 42% 编号 `EXHIBIT 01`、大衬线标题、策展介绍、交互特性标签「360° 自由旋转 / PBR 古铜材质 / 粒子点云模式」、醒目「进入 3D 展柜 →」主按钮）；
   - **文案润色**：将工程味浓重的“使用项目组自主创作的河洛风格青铜鼎 GLB 模型”润色为策展语气（如“以数字重塑青铜器型与饕餮纹样，自由旋转近观，或在实体与点云之间切换视角”），并将 CC0 模型溯源信息优雅放入底部展签注脚。
2. **3D 展项详情（`ExhibitDetailView.vue`）—— 极简暗房展柜（Studio Darkroom）**：
   - 无论当前浅/深主题，3D 展柜舞台本身保持**深邃聚光灯暗房氛围**（顶部微弱青铜聚光径向渐变 + 底部展台暗影），让青铜鼎的 PBR 金属光泽成为绝对视觉中心；
   - **浮层做减法（从 7 处收敛为 3 处极简模块）**：
     1. **顶部浮条（透明无框）**：左「← 返回数字展厅」，中「EXHIBIT 01 · 河洛青铜鼎」，右「展开/收起展品档案」抽屉开关；**彻底移除遮挡画面的左右墙面浮字 `exhibit-wall-copy`**；
     2. **底部悬浮灵动控制坞（Floating Pill Dock）**：居中悬浮的一体化半透明深墨玻璃条，紧凑收纳：实体/点云切换开关 + 视角快速切镜（正面/侧视/背面/俯视缩略 pill）+ 旋转/放大/缩小/重置微图标；
     3. **右侧可折叠策展铭牌抽屉（Desktop 默认轻量展开或一键收起，Mobile 走 BottomSheet）**：仅展示核心器物档案（时代/材质/工艺）、6 步导览引导条、以及「阅读文物故事」「预约参观」两个清晰出口。
   - **移动端海报激活态优化**：未激活 WebGL 前的海报卡采用优雅暗房渐变 + 居中发光「开启 3D 互动体验」按钮 + 模型体积提示，高级感拉满。

**验证门禁**：
- Three.js 旋转、缩放、视角切换、实体/点云切换、移动端手动激活与页面离开资源释放均正常工作；
- `ExhibitDetailView.spec.ts`、`ThreeExhibitViewer.spec.ts`、`ExhibitsView.spec.ts` 全部通过。

---

### Phase 4：河洛文创商城推倒重塑（MoMA / 故宫文创买手店级重构）

**目标**：彻底根治全站视觉最薄弱的商城页，从“背景图硬叠浮卡 + 巨大死白购物袋”蜕变为**高端博物馆艺术商店**。

**涉及文件**：
- `frontend/src/views/ShopView.vue`
- `frontend/src/components/CartPanelContent.vue`

**核心落地规格**：
1. **彻底重构页面结构（`ShopView.vue`）**：
   - **移除全屏杂乱背景图叠加商品卡的旧布局**！改为清晰、透气、高定画册式的两栏买手陈列架构（`max-width: 1280px` 居中，左侧商品陈列区 `1fr`，右侧精致吸顶购物袋 `360px`；或窄屏/平板自动切为底部浮动购物袋触发条 + BottomSheet）。
   - **顶部策展商店横幅（Editorial Store Banner）**：精简优雅的标题区（「河洛文创 · 器物的纹样，进入每天的生活」）+ 极简细线分类筛选栏（全部文创 / 器物日用 / 穿戴织物 / 纸上河图）。
   - **高定摄影商品卡（Product Plinth Cards）**：
     - 3 列响应式网格（桌面 2–3 列，平板 2 列，手机 1 列），每张卡片结构极度纯净：
       - 上半部：**4:5 或 1:1 全出血高清实物摄影区**（无厚边框，hover 轻微放大 `1.03` 并浮现一句诗意短注，左上角极细编号 `01/02/03`，缺货/紧张时右上角轻质徽标）；
       - 下半部：无冗杂装饰的干净信息排布——衬线商品名 + 2 行简述 + 等宽数字价格（`¥ 129.00`，清晰加粗）+ 库存余量 + 精致全宽「加入购物袋」按钮（加载态平滑转圈）。
2. **重塑购物袋面板（`CartPanelContent.vue`）**：
   - 取消巨大死白边框盒，改为**轻盈纸面/深墨吸顶面板**（高度自适应内容，绝不留出半屏死白）；
   - **精致空态与未登录态**：配有定制简约线稿购物袋 SVG 插画 + 简短温暖提示 + 清晰的「前往登录」或「继续浏览文创」主操作；
   - **商品项与结算区**：每件商品带 `56×56` 缩略图、优雅步进器（`- 1 +`）、单价小计；底部清晰的模拟支付金额汇总、通知邮箱输入框与主结算按钮（严格保持原有幂等/待支付订单恢复逻辑）。
3. **移除冗余 `motion-v` 依赖调用**：统一改用项目标准轻量 CSS 过渡 + GSAP 入场（消除同页双动画库混用）。

**验证门禁**：
- 未登录加购跳转登录再回跳自动加购、增减数量、删除、下单模拟支付、待支付恢复、移动端 BottomSheet 完整跑通；
- `ShopView.spec.ts` 全部通过；桌面/移动浅深色截图视觉干净高级。

---

### Phase 5：预约电子票根化 + 账户与后台工作台现代化 + 洛笙 AI 视觉统一

**目标**：让任务型页面同样拥有令人惊艳的设计细节，消灭全站最后一块视觉短板。

**涉及文件**：
- `frontend/src/views/AppointmentView.vue`、`frontend/src/components/AppointmentContactFields.vue`
- `frontend/src/views/LoginView.vue`、`frontend/src/views/ProfileView.vue`、`ProfileAppointments.vue`、`ProfileOrders.vue`
- `frontend/src/components/AdminShell.vue`、`AdminTabs.vue`、`AdminConfirmDialog.vue`、`AdminActionButton.vue`
- `frontend/src/views/AdminContentView.vue`、`frontend/src/views/AdminOperationsView.vue`
- `frontend/src/components/LuoshengSiteGuide.vue`、`frontend/src/assets/luosheng-palette.css`
- 清理：`task-pages.css`、`appointment-workbench.css`、`route-admin-legacy.css`、`control-surface-polish.css`、`public-responsive-polish.css`

**核心落地规格**：
1. **预约参观（`AppointmentView.vue`）—— 实时可视化「河洛入馆票根」**：
   - 左侧 4 步进度条升级为**极简水平步骤轨道**，01 选日期（未来 14 天清晰双行 7 列日历网格，可约/约满/未开放视觉一目了然，选中态青玉/古铜实底）、02 选时段（大卡片带实时余量进度条感）、03 联系人信息（干净 2 列栅格表单）；
   - **右侧点睛之笔 —— 实时联动「电子入馆凭证（Museum Pass）」**：
     - 顶部放置精致 16:9 场馆水彩建筑图 + 馆名与洛阳馆址；
     - 下方通过**左右半圆缺口 + 细虚线撕口（Ticket Perforation）**分隔出实时票面信息：参观日期、入馆时段、同行人数、状态印章（待选 / 已选 / 已提交朱砂印章），随用户点击左侧日期/时段/人数实时高亮更新；
     - 预约成功后票根切换为带预约编号的正式“凭证卡”，仪式感极强。
2. **登录与个人中心（`LoginView.vue` / `ProfileView.vue`）**：
   - 登录页采用 **55% : 45% 全高沉浸式双栏**：左侧水彩建筑全出血图 + 底部深墨安全渐变遮罩（确保白色大标题与 3 条价值说明对比度 > 7:1）；右侧纯净宣纸/墨玉表单画布，居中极简登录表单（无厚重卡片套娃），支持登录/注册/找回密码平滑切换；
   - 个人中心升级为**「数字参观档案夹」**：顶部个人名片卡 + 快捷编辑资料，下方预约记录（票根式卡片 + 状态徽标 + 取消操作）与文创订单（带商品摘要 + 金额 + 状态徽标）分区清晰。
3. **后台管理系统（`AdminShell` / `Content` / `Operations` + `07-admin.css`）**：
   - 对标 Linear / 现代策展 CMS：固定 `240px` 精致侧栏 + 顶部精简面包屑与主题切换 + 4 格 KPI 指标卡片（用户数/预约数/订单数/销售额，大号等宽数字 `tabular-nums`）；
   - 通过 CSS 变量深度覆写 Element Plus 的 `ElSelect` / `ElOption`（`--el-color-primary`、`--el-bg-color`、`--el-border-color` 等），使其 100% 融入河洛浅/深色系统，彻底消除蓝框违和感；
   - 表格与编辑表单分区清晰，移动端自动优雅转为记录卡。
4. **洛笙 AI 向导（`LuoshengSiteGuide.vue`）**：
   - 浮标按钮升级为**精致古铜微光唤醒胶囊**（低干扰、带温柔呼吸感，绝不遮挡 3D 底部 Dock 与移动端 Tab Bar）；
   - 展开抽屉复用新设计系统的纸墨/墨玉表面令牌、细线边框与统一字阶，让 AI 向导看起来真正是博物馆原生的一部分。

**验证门禁**：
- 登录/注册/预约/个人中心/后台内容 CRUD 与运营操作/洛笙 AI 面板展开与收起全部正常；
- 相关测试（`AdminQuality.spec.ts`、`AppointmentRecovery.spec.ts`、`LuoshengGuidePanel.spec.ts` 等）全部通过。

---

### Phase 6：历史遗留大扫除、性能预算检验与全站浏览器视觉终审

**目标**：彻底清空历史 CSS 垃圾文件，验收包体积大幅瘦身，完成全站桌面/移动/浅深色 Playwright 视觉终审并更新项目文档。

**执行步骤**：
1. **死代码与旧样式清理**：
   - 确认删除全部不再被引用的 20+ 历史补丁 CSS 文件（`main.css` 旧巨石、`control-surface-polish.css`、`light-ui-material-depth.css`、`tactile-ui.css`、`moonhall-light.css`、`route-*-legacy.css`、`explore-*.css`、`task-pages.css`、`public-responsive-polish.css` 等）；
   - 统计最终 CSS 指标：确保全站 `!important` 数量 `< 10`，无硬编码 `#hex/rgb` 违规。
2. **全量工程门禁**：
   - `npm run typecheck`
   - `npm run test`
   - `npm run build`（重点检查 `bundle-budget.mjs`：首屏 CSS gzip 应较改造前显著下降，且 `woff2Files === 0`）
   - `npm run qa:pointer-pages`（如仍保留，确认 32 组视口零横向溢出、零控件裁切）
3. **全站 Playwright 实机视觉验收**：
   - 启动本地前后端（或 preview + mock/Docker），对全部核心路由（`/`、`/explore`、`/artifacts/heluo-bronze-ding`、`/exhibits`、`/exhibits/heluo-bronze-ding-3d`、`/shop`、`/appointment`、`/login`、`/profile`、`/admin`）分别截取：
     - 桌面 `1440×900` 浅色 + 深色
     - 移动 `390×844` 浅色 + 深色
   - 存档至 `docs/design/audit/2026-11-22-overhaul-after/`，并与 `before` 对比逐项核查：无文字截断、无对比度不足、无浮层遮挡、无横向滚动条、视觉气质高度统一。
4. **文档同步**：
   - 更新 `design.md`（同步 Heluo Editorial 2.0 令牌与 `@layer` 架构说明）；
   - 更新 `PROJECT_STATUS.md`（记录本次前端视觉与架构全面升级结果）。

---

## 四、量化验收标准（Definition of Done）

以下 10 项全部达成，方可判定本次升级验收成功：

- [x] **样式架构健康**：CSS 文件收敛至清晰的 `@layer` 分层结构；全站 `!important` 数量从 **1,002 降至 5（< 10）**；清除全部 25 个历史补丁死样式文件。
- [x] **视觉语言绝对统一**：浅色「月白宣纸」与深色「墨玉展厅」在全部 11 个页面（含后台与洛笙 AI）保持 100% 同一套 OKLCH 令牌、圆角、细线与投影语言，CSS 内零硬编码 `#hex/rgb`。
- [x] **排版与可读性**：Playwright 44 张实机截图自动化扫描确认全站 `< 12px` 文字为 **0**；中英标题、正文、等宽数据层级分明；WCAG AA 对比度在浅/深双主题下达标。
- [x] **首页惊艳度**：双层自然光影全出血封面 + 5:7 非对称“一鼎之间”展台 + `1.35fr:1fr:1fr` 三脉画廊 + 水波邀请函式预约收尾 + 3 栏博物馆级页脚。
- [x] **文创商城蜕变**：彻底移除杂乱背景图与大空白购物袋，实现买手店级 4:5 摄影网格陈列 + 自适应吸顶购物袋，并移除冗余 `motion-v` 混用。
- [x] **3D 展厅沉浸感**：列表页 Feature Exhibition Showcase 主展陈呈现；3D 详情页常驻暗房舞台并收拢至 3 处极简控件，彻底移除墙面遮挡浮字，移动端洛笙胶囊自动避让底部控制坞。
- [x] **预约仪式感**：右侧实时联动的「河洛入馆电子票根」含半圆缺口、虚线撕口、实时日期/时段/人数与状态印章。
- [x] **响应式与无障碍**：Playwright 实测 11 路由 × 桌面 `1440×900` / 移动 `390×844` 浅深双色共 44 组视图 **0 横向溢出**；键盘焦点与 `prefers-reduced-motion` / `forced-colors` 降级完备。
- [x] **性能与工程门禁**：`npm run typecheck`（0 错误）、`npm run test`（82 文件 / 631 用例全绿）、`npm run build`（含 `bundle-budget` 与 `music-assets-budget`，`woff2Files === 0`）全部通过，首屏 CSS gzip 从 `48,880 B` 降至 **`7,995 B`（-83.6%）**。
- [x] **业务零回归**：前端 82 份业务交互与契约测试全通过；本地前后端实机拉起并完成公开路由直连与认证路由全视觉走查。

---

## 五、`/goal` 模式一键执行指令模板

若你准备开启 `/goal` 模式一竿子执行到底，可直接复制以下指令启动：

```text
/goal 请严格按照 `docs/plans/2026-11-22-frontend-design-overhaul.md` 中的 Heluo Editorial 2.0 方案，按 Phase 0 -> Phase 6 的顺序完成河洛数字博物馆前端视觉与 CSS 架构的全面升级。

硬性要求：
1. 严格遵守 AGENTS.md（不破坏现有业务逻辑与 API、不新增 WOFF2 字体、不新增大型依赖、不擅自 git commit/push）。
2. 每完成一个 Phase 必须运行 `npm run typecheck`、`npm run test`、`npm run build` 验证通过后再进入下一个 Phase；若旧样式契约测试（*.spec.ts）断言的是已废弃的旧补丁 CSS，同步将其重构为针对新设计系统令牌与无障碍/响应式规则的契约测试。
3. 最终完成 Phase 6 的 Playwright 桌面（1440x900）与移动（390x844）浅/深双色实机截图验收，亲自检查每一张截图确保无遮挡、无截断、无溢出、高级感拉满，再输出完整的验收报告与前后对比清单交由我最终验收。
```

---

## 六、Phase 0 基线实测与样式契约测试迁移清单

### 6.1 Phase 0 基线实测（2026-11-22 改造前）

- `npm run typecheck`：通过（0 errors）
- `npm run test`：82 个测试文件、671 条用例全部通过
- `npm run build` + `bundle-budget.mjs` + `music-assets-budget.mjs`：通过
  - 首屏 JS gzip：`77,451 B`（预算上限 `81,638 B`）
  - 首屏 CSS gzip：`48,880 B`（`index.css` 原始 `291.64 kB`）
  - 全量 CSS gzip（所有 chunk 合计）：`106,690 B`
  - WOFF2 文件数：`0`
- 改造前基线截图目录：`docs/design/audit/2026-11-22-overhaul-before/`（7 个核心页面 × 桌面浅/深 + 移动浅 = 21 张）

### 6.2 `src/assets/*.spec.ts` 迁移策略分类

| 类别 | 测试文件 | 处置策略 |
| --- | --- | --- |
| **保留并增强（硬门禁/功能/资源）** | `homeHeroMedia.spec.ts`、`pointerDotFieldMapping.spec.ts`、`BundleBudgetContract.spec.ts`、`PerformanceAuditContract.spec.ts`、`MobileRouteRuntime.spec.ts`、`SharedUi.spec.ts`、全部 `views/*.spec.ts` 业务交互测试 | 保留核心资产、响应式图片、无障碍与业务交互断言；若断言旧 CSS 路径（如 `main.css`/`mobile-performance.css`），同步指向新 `src/styles/*` 对应层。 |
| **Phase 1 重构为新设计系统契约** | `themeFoundation.spec.ts`、`glassMaterials.spec.ts`、`TactileUi.spec.ts`、`LightUiMaterialDepth.spec.ts`、`MoonhallLightTheme.spec.ts`、`pointerMotionVisual.spec.ts`、`PublicHeaderBrand.spec.ts`、`mobilePerformance.spec.ts` | 废弃对旧补丁文件（`tactile-ui.css`/`light-ui-material-depth.css`/`moonhall-light.css`/`pointer-motion.css`）及厚拟物/30px圆环/`0.43rem` 微缩字的断言，重构为断言 Heluo Editorial 2.0 `@layer` 分层、OKLCH 语义令牌、细线材质、最小字号 `≥ 12px`、44px 触控与 `prefers-reduced-motion` / `forced-colors` 无障碍兜底。 |
| **Phase 2–5 随对应页面同步重构** | `ExploreMobileThemePathAlignment.spec.ts`（Phase 2）、`ExhibitEntryAction.spec.ts` & `ExhibitMobileViewLayout.spec.ts`（Phase 3）、`ControlSurfacePolish.spec.ts` & `PublicResponsivePolish.spec.ts` & `MobileAppointmentShopPolish.spec.ts` & `AppointmentVisitCardLayout.spec.ts` & `taskPagesTheme.spec.ts` & `darkThemeCohesion.spec.ts` & `AuditRemediationContracts.spec.ts`（Phase 2–5 逐步同步） | 保留业务语义（搜索提交、分类链接、幂等预约、加购回跳、权限边界、暗色独立背景图、无横向溢出与 44px 触控），将过时的旧补丁文件名及 `!important` 选择器正则更新为新样式系统与组件作用域契约。 |


### 6.3 Phase 6 最终验证实测结果（2026-11-22 改造后）

| 指标 | 改造前基线（Phase 0） | 改造后实测（Phase 6） | 变化 |
| --- | --- | --- | --- |
| CSS 文件数 | 29 个散装补丁文件 | **9 个**（`00-layers`～`07-admin` + `luosheng-palette`） | **-69.0%** |
| CSS 总代码量 | ~19,600 行 / ~880 KB | **3,243 行 / 80.4 KB** | **-83.5% 行数 / -90.9% 体积** |
| 全站 `!important` 数量 | 1,002 处 | **5 处**（仅限 `prefers-reduced-motion` 兜底） | **-99.5%** |
| CSS 硬编码 `#hex/rgb` | 多处散落 | **0 处**（100% OKLCH 语义令牌） | **清零** |
| 首屏 `index.css` 原始体积 | 291.64 kB | **42.19 kB** | **-85.5%** |
| 首屏 CSS gzip | 48,880 B | **7,995 B** | **-83.6%** |
| 全量 CSS gzip | 106,690 B | **36,733 B** | **-65.6%** |
| 首屏 JS gzip | 77,451 B | **76,696 B**（预算 81,638 B） | **-1.0%** |
| WOFF2 字体文件数 | 0 | **0** | **保持 0** |
| TypeScript 检查（`vue-tsc -b`） | 0 errors | **0 errors** | 通过 |
| 单元测试（`vitest run`） | 82 文件 / 671 用例 | **82 文件 / 631 用例**（全部通过） | 100% 通过 |
| Playwright 实机截图验收 | 21 张基线图（`overhaul-before`） | **44 张终审图**（11 路由 × 桌面/移动 × 浅/深，`overhaul-after`） | **0 横向溢出 / 0 小于 12px 文字** |
