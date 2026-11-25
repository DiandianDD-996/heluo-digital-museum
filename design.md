# Design — 河洛数字博物馆（Heluo Editorial 3.0）

> 全站锁定设计系统。新增或修改任何页面前必须先读取本文件；必须扩展本系统的 `@layer` 与 OKLCH 语义令牌，禁止在页面中临时发明孤立色板、硬编码 `#hex/rgb` 或新增散装补丁 CSS。

## Genre & Aesthetic Direction

- **美学定位**：`Heluo Editorial 3.0` —— 当代国际数字博物馆画册与静谧数字展厅的融合。浅色主题为**「清透当代美术馆宣白 · Crisp Museum Paper」**，深色主题为**「冷夜玄青 / 苍冥曜石黑 · Cold Obsidian Gallery」**，管理后台采用独立**「极净典藏白灰 · Archivist Neutral」**工作台令牌。
- **核心原则**：克制、精准、呼吸感、以器物为主角。以冷暗建筑空间衬托暖香槟鎏金、青铜粉绿锈与朱砂红；通过 1px 细线边框、清晰表面明度阶梯、非对称画册构图与微克制动效营造高级质感，严禁厚拟物投影、双层塑料边框、浑浊暖棕泥感或高饱和渐变装饰。

## CSS Architecture (`@layer`)

全局样式严格收敛于 `frontend/src/styles/` 的 8 层有序文件 + `frontend/src/assets/luosheng-palette.css`（总计 9 个 CSS 文件）：

```css
@layer reset, tokens, base, surface, components, views, overrides;
```

1. `00-layers.css`：声明全局层叠顺序。
2. `01-tokens.css`：浅/深双主题 OKLCH 语义色板、矿物色谱与展台接触暗影辅助令牌、字阶、间距、圆角、投影与动效曲线（含向后兼容别名）。
3. `02-reset-base.css`：盒模型、`overflow-x: clip`、中英衬线/无衬线/等宽数字排印基线、统一表单平面化与高对比键盘焦点环。
4. `03-surfaces.css`：纸面（`.surface-paper`）、展台（`.surface-plinth`）、暗房展窗（`.surface-vitrine`）、三档玻璃材质（`data-glass="light|dark|compact"`）以及 `prefers-reduced-transparency` / `prefers-contrast: more` / `forced-colors` / 弱端设备降级。
5. `04-components.css`：共享组件基元（`FluidButton`、`MuseumSearchField`、`StatusBadge`、`InlineStatus`、`LoadingSkeleton`、`BottomSheet`、`EditorialCard`、`AudioControl`、`.state-panel`、矿物色谱圆点、工艺线索签、朱砂批注笺与微缩铭牌预览卡）。
6. `05-shell.css`：吸顶收缩导航栏（`72px -> 60px`）、全局克制漫反射流光与 0.5px 几何浑天细环背景层（`AmbientGalleryBackdrop`）、3 栏冷夜玄青博物馆页脚与移动端底部 Tab Bar（触控热区 ≥ `48px`）。
7. `06-motion.css`：策展缓动曲线、跨路由共享元素 `active-artifact-plate` View Transitions、`artifact-awaken`、`PointerDotField` 克制呈现及 `prefers-reduced-motion: reduce` 兜底（全站仅此一处使用 5 条 `!important`）。
8. `07-admin.css`：后台按需加载 `Archivist Neutral` 极净典藏白灰/冷石板工作台样式（`240px` 固定侧栏、4 格 `tabular-nums` KPI、满宽高可读结构化列表、右侧宽幅滑出式编辑/实时预览抽屉及 Element Plus `ElSelect`/`ElOption` 令牌融合）。

## Theme — OKLCH 语义三色板

### 浅色前台「清透当代美术馆宣白 · Crisp Museum Paper」
- `--surface-canvas`: `oklch(97.4% 0.008 84)`（清透温润美术馆宣白基底，剔除浑浊发黄与噪点）
- `--surface-subtle`: `oklch(95.4% 0.010 84)`（浅灰宣纸次级面）
- `--surface-elevated`: `oklch(99.5% 0.003 85)`（纯净白宣展签与控件面）
- `--surface-plinth`: `oklch(94.6% 0.010 84)` / `--surface-vitrine`: `oklch(14.0% 0.006 238)`（冷夜曜石暗房器物展柜）
- `--ink-primary`: `oklch(18.5% 0.008 238)`（玄青墨色正文主字） / `--ink-secondary`: `oklch(34.5% 0.009 236)` / `--ink-muted`: `oklch(47.5% 0.010 234)`
- `--accent-jade`: `oklch(23.5% 0.014 238)`（深玄墨主操作色，配 `--accent-jade-ink: oklch(98.8% 0.004 86)`）
- `--accent-bronze`: `oklch(46.5% 0.072 68)`（古铜细线与索引色，WCAG AA `>= 5.2:1`）
- `--accent-patina`: `oklch(44% 0.064 168)`（青铜粉绿锈辅助点缀色）
- `--accent-seal`: `oklch(47.5% 0.142 26)`（金石朱砂印章红）

### 深色前台「冷夜玄青 / 苍冥曜石黑 · Cold Obsidian Gallery」
- `--surface-canvas`: `oklch(12.2% 0.006 238)`（深邃冷夜玄青基底，彻底去棕去泥感）
- `--surface-subtle`: `oklch(14.8% 0.007 238)` / `--surface-elevated`: `oklch(17.6% 0.008 238)` / `--surface-plinth`: `oklch(14.2% 0.007 238)` / `--surface-darkroom`: `oklch(10.8% 0.006 238)`
- `--ink-primary`: `oklch(95.0% 0.004 86)`（丝绸象牙白） / `--ink-secondary`: `oklch(79.5% 0.006 228)` / `--ink-muted`: `oklch(64.0% 0.007 230)`
- `--accent-jade`: `oklch(82% 0.054 78)`（暖香槟钛金主操作，配 `--accent-jade-ink: oklch(13% 0.007 238)`）
- `--accent-bronze`: `oklch(74% 0.062 74)`（哑光鎏金古铜细线）
- `--accent-patina`: `oklch(68% 0.072 168)`（青铜粉绿锈幽光，与 3D 点云光谱呼应）
- `--accent-seal`: `oklch(65% 0.136 27)`（朱砂红）
- 3D 场景雾色同步冷曜石 `#0d1014`（浅色 `#f4f3ef`），点云采用青铜粉绿锈 × 22K 错金铭文 × 银白高光核与鼎足散落微尘光池。

### 管理后台「极净典藏白灰 · Archivist Neutral」（`.admin-workspace` 独立作用域）
- **浅色后台**：画布 `oklch(98.1% 0.002 248)`（等效 `#F8F9FA`）、纯白面板 `oklch(100% 0 0)`（`#FFFFFF`）、次级面 `oklch(95.8% 0.003 248)`、1px 冷石墨细线、墨黑主操作 `oklch(20.5% 0.008 250)`，完全剥离古宣黄与环境装饰底纹。
- **深色后台**：冷石板灰阶 `oklch(14.2% 0.008 252)` / `oklch(17.2% 0.009 252)` / `oklch(20.2% 0.010 252)` + 纯净雪白主操作。

## Ambient Dynamic Backdrop & Degradation

- 公开前台底层（`z-index: 0`，排除后台与 3D 暗房详情页）异步挂载 `AmbientGalleryBackdrop.vue`：极慢速洛水天光/香槟漫反射双色晕漂移（纯 CSS `transform` 合成）+ `0.5px` 河洛几何浑天细环缓慢自转水印（随滚动轻度微视差）。
- 当开启 `prefers-reduced-motion: reduce`、`prefers-contrast: more`、`forced-colors: active` 或 `data-performance-tier="constrained"` 时，环境背景自动静默隐藏且零 `rAF` / 零滚动监听开销。

## Typography & Accessibility

- **零外部字体下载**：全站保持 `woff2Files === 0`，依托系统高质感衬线/无衬线字栈（`--font-display` / `--font-body` / `--font-mono`）。
- **最小字号硬红线**：全站可见文字一律 `>= 12px`（`--text-xs: 0.75rem`，并在 reset 层统一 `small { font-size: var(--text-xs); }`）。
- **长文阅读行宽**：详情正文锁定 `--reading-max: 68ch`，行高 `1.9`，含首段宋刻沉降首字、顶部 `2px` 古铜阅读进度线、Sticky 目录、正文关联器物悬停微缩铭牌预览与文末朱砂细栏策展批注笺。
- **数字排版**：日期、价格、馆藏编号、KPI 指标统一 `.font-mono` / `font-variant-numeric: tabular-nums`。
- **触控与焦点**：全部交互控件最小热区 `44px × 44px`（移动端底栏 `>= 48px`）；`:focus-visible` 使用 `2px` 清晰外环。

## Macrostructure Across Routes

- **首页（`/`）**：极简光束石台与青铜重器高清双主题封面 + 几何浑天细环与浑仪磁阵 → 「礼 · 玉 · 河 · 洛」章节留白眉题 → 5:7 非对称“一鼎之间”器物精读（3 看点左侧微距推镜联动 + `?focus=ear|motif|feet` 直达 3D）→ `1.35fr : 1fr : 1fr` 三脉画廊 → 河洛水波纹预约邀请函 → 3 栏冷夜玄青页脚。
- **探索馆藏（`/explore`）**：策展检索头 + 四类范围切换 → 底部细线分类栏 → 暗房无痕融合器物墙（悬停 120ms 预取 + `active-artifact-plate` 一镜到底共享元素过渡）→ 主题导览 → 期刊风延伸阅读列表。
- **文物/文章详情（`/artifacts/:slug`、`/articles/:slug`）**：60/40 展台（支持桌面 2.5× 黄铜游标微距镜与点击全屏暗房高清检视）+ 实体铭牌（含矿物色谱圆点与传统工艺线索签）→ `68ch` 图录长文 + 文末朱砂策展批注笺（一键问洛笙）。
- **3D 展厅（`/exhibits`、`/exhibits/:slug`）**：Feature Exhibition Showcase + 暗房内 `EXHIBIT 01 ↔ EXHIBIT 02` 一键切柜；青铜鼎点云采用粉绿锈×错金光谱与鼎足散落微尘光池。
- **河洛文创（`/shop`）**：买手店两栏架构（冷调商业微距实拍主图 + 悬停材质肌理副图 + 灵感文物切片溯源抽屉 + 模拟支付「模拟收藏出库笺」）。
- **预约、个人档案与 404（`/appointment`、`/profile`、`/*`）**：14 天余量刻度日历（区分周一闭馆）+ 待钤印宣纸活字副券实时排字与朱砂落印 → 藏书票弹窗；个人中心嵌入观展手账画册摘要轨；404 页为「编号未录 · 待考残简」策展彩蛋页。
- **管理后台（`/admin`、`/admin/operations`）**：Archivist Neutral 极净白灰工作台 + 满宽列表（含 `EN 已译 / 缺译文` 徽标）+ 右侧宽幅滑出式表单/前台 68ch 实时预览抽屉。

## Motion & Fallback

- 保留全局精密指针光标（`PointerCursor`）与桌面点阵波纹（`PointerDotField`）联动，输入框、3D 画布自动还原原生指针，触屏、高对比与减少动态模式自动关闭。
- 页面切换与共享元素过渡克制在 `220–360ms`，遵循 `prefers-reduced-motion: reduce` 立即收敛；3D 场景离开页面时释放全部 WebGL 资源。
