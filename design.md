# Design — 河洛数字博物馆（Heluo Editorial 2.0）

> 全站锁定设计系统。新增或修改任何页面前必须先读取本文件；必须扩展本系统的 `@layer` 与 OKLCH 语义令牌，禁止在页面中临时发明孤立色板、硬编码 `#hex/rgb` 或新增散装补丁 CSS。

## Genre & Aesthetic Direction

- **美学定位**：`Heluo Editorial 2.0` —— 当代亚洲顶尖博物馆画册与静谧数字展厅的融合。浅色主题为**「月白宣纸 · Daylight Paper」**，深色主题为**「墨玉展厅 · Nocturne Gallery」**。
- **核心原则**：克制、精准、呼吸感、以器物为主角。通过 1px 细线边框、清晰表面明度阶梯、非对称画册构图与微克制动效营造高级质感，严禁厚拟物投影、双层塑料边框或高饱和渐变装饰。

## CSS Architecture (`@layer`)

全局样式严格收敛于 `frontend/src/styles/` 的 8 层有序文件 + `frontend/src/assets/luosheng-palette.css`（总计 9 个 CSS 文件）：

```css
@layer reset, tokens, base, surface, components, views, overrides;
```

1. `00-layers.css`：声明全局层叠顺序。
2. `01-tokens.css`：浅/深双主题 OKLCH 语义色板、字阶、间距、圆角、投影与动效曲线（含向后兼容别名）。
3. `02-reset-base.css`：盒模型、`overflow-x: clip`、中英衬线/无衬线/等宽数字排印基线、统一表单平面化与高对比键盘焦点环。
4. `03-surfaces.css`：纸面（`.surface-paper`）、展台（`.surface-plinth`）、三档玻璃材质（`data-glass="light|dark|compact"`）以及 `prefers-reduced-transparency` / `prefers-contrast: more` / `forced-colors` / 弱端设备降级。
5. `04-components.css`：共享组件基元（`FluidButton`、`MuseumSearchField`、`StatusBadge`、`InlineStatus`、`LoadingSkeleton`、`BottomSheet`、`EditorialCard`、`AudioControl`、`.state-panel`）。
6. `05-shell.css`：吸顶收缩导航栏（`72px -> 60px`）、3 栏结构化博物馆页脚与移动端底部 Tab Bar（触控热区 ≥ `48px`）。
7. `06-motion.css`：策展缓动曲线、View Transitions、`artifact-awaken`、`PointerDotField` 克制呈现及 `prefers-reduced-motion: reduce` 兜底（全站仅此一处使用 5 条 `!important`）。
8. `07-admin.css`：后台按需加载工作台样式（`240px` 固定侧栏、4 格 `tabular-nums` KPI、结构化内容卡及 Element Plus `ElSelect`/`ElOption` 令牌融合）。

## Theme — OKLCH 语义双色板

### 浅色「缃色暖黄古宣 · 鎏金松烟 · Daylight Parchment」
- `--surface-canvas`: `oklch(95.4% 0.024 86)`（全站统一温润缃色暖黄古宣基底）
- `--surface-subtle`: `oklch(93.4% 0.028 84)`（暖栗宣纸次级底）
- `--surface-elevated`: `oklch(97.2% 0.018 87)`（温润象牙暖黄展签与控件面）
- `--surface-plinth`: `oklch(91.8% 0.030 83)`（器物展台暖砂宣底）
- **极简宋韵留白暗纹与随鼠柔光显影（85%–90% 大留白，严格位于内容底层 `z-index: 0`）**：
  - `--pattern-yunlei` / `--pattern-yunlei-lit`（`64px × 64px` 无缝平铺）：**极简宋韵斜格 · 微距柿蒂星点**（静置仅微露 `0.65px` 细丝，鼠标划过时由底层柔光 `.app-ambient-veil` 以日光象牙金光晕点亮深古铜赤金线条与中心四芒星）；
  - `--pattern-brocade` / `--pattern-brocade-lit`（`48px × 48px` 无缝平铺）：**极简宋锦方胜暗纹**（八角细框 + 中心方胜微点，随卡片鼠标柔光浮现）；
  - `--pattern-plinth-lattice` / `--pattern-plinth-lattice-lit`（`36px × 36px` 无缝平铺）：**极简展柜微距十字星点**（铺陈于深色器物舞台）。
- `--ink-primary`: `oklch(19.5% 0.014 68)`（暖胡桃松烟浓墨）
- `--ink-secondary`: `oklch(34.5% 0.018 68)` / `--ink-muted`: `oklch(46.5% 0.022 68)`
- `--accent-jade`: `oklch(24% 0.024 64)`（漆黑乌金主操作色，悬停泛暖栗古铜 `oklch(32% 0.042 64)`，配 `--accent-jade-ink: oklch(97.6% 0.016 86)`）
- `--accent-bronze`: `oklch(44% 0.078 66)`（高对比深栗古铜眉标与激活细线，WCAG AA `>= 5.8:1`）
- `--accent-seal`: `oklch(47% 0.142 26)`（经典博物馆朱砂印章红，与暖黄古宣形成典雅金石对比）

### 深色「曜石暗房 · 丝绸钛金 · Obsidian Silk」
- `--surface-canvas`: `oklch(13.2% 0.005 74)`（全站统一纯净微暖曜石炭黑基底，绝非纯黑或脏绿）
- `--surface-subtle`: `oklch(15.4% 0.006 74)` / `--surface-elevated`: `oklch(17.6% 0.006 74)` / `--surface-plinth`: `oklch(14.8% 0.006 74)`
- **馆藏级无缝错金暗纹**：与浅色同构的 `--pattern-yunlei`（`64px × 64px` 乌金错金云雷柿蒂回纹，`stroke-opacity: 0.068`）、`--pattern-brocade`（`48px × 48px` 暗锦八达晕菱格纹，`stroke-opacity: 0.076`）与 `--pattern-plinth-lattice`（`36px × 36px` 展台暗金细格纹，`stroke-opacity: 0.095`），在保持 `--surface-canvas` 统一底色的前提下赋予大面积区域错金漆器与宋锦装裱质感。
- `--ink-primary`: `oklch(95.2% 0.006 82)`（温润丝绸象牙白） / `--ink-secondary`: `oklch(80% 0.007 78)`
- `--accent-jade`: `oklch(81% 0.048 78)`（丝绸浅香槟钛金主操作，配 `--accent-jade-ink: oklch(14% 0.006 74)`）
- `--accent-bronze`: `oklch(72% 0.054 72)`（哑光暖古铜眉标与细线，与主操作色形成清晰明度与色度层级分离）
- 玻璃材质附加顶部微光高光 `--glass-highlight` 与 `saturate(135%)`；鼠标光点场在浅/深双主题下统一为「暖玉珍珠白 × 丝绸浅香槟金 × 矿物银砂」纯光学加色高光点，零深绿或暗褐斑点。

## Typography & Accessibility

- **零外部字体下载**：全站保持 `woff2Files === 0`，依托系统高质感衬线/无衬线字栈（`--font-display` / `--font-body` / `--font-mono`）。
- **最小字号硬红线**：全站可见文字一律 `>= 12px`（`--text-xs: 0.75rem`，并在 reset 层统一 `small { font-size: var(--text-xs); }`），彻底消除历史微缩字。
- **长文阅读行宽**：详情正文锁定 `--reading-max: 68ch`，行高 `1.9`，配顶部 `2px` 古铜阅读进度线与 Sticky 目录。
- **数字排版**：日期、价格、馆藏编号、KPI 指标统一 `.font-mono` / `font-variant-numeric: tabular-nums`。
- **触控与焦点**：全部交互控件最小热区 `44px × 44px`（移动端底栏 `>= 48px`）；`:focus-visible` 使用 `2px` 清晰外环。

## Macrostructure Across Routes

- **首页（`/`）**：双层自然光影全出血封面 → 5:7 非对称“一鼎之间”器物精读（含 3 观察切入点）→ `1.35fr : 1fr : 1fr` 三脉画廊 → 河洛水波纹预约邀请函 → 3 栏博物馆页脚。
- **探索馆藏（`/explore`）**：策展检索头 + 热门检索词 → 底部细线分类栏 → 跨 2 列主卡 + 3 列呼吸感器物墙 → 主题导览 → 期刊风延伸阅读列表。
- **文物/文章详情（`/artifacts/:slug`、`/articles/:slug`）**：60/40 展台与实体铭牌头图 → `68ch` 长文 + Sticky TOC → 关联 3D 展项与预约双收束卡。
- **3D 展厅（`/exhibits`、`/exhibits/:slug`）**：1–2 件展项自动采用大片级 Feature Exhibition Showcase；3D 详情采用常驻深邃暗房（Studio Darkroom），浮层收敛为无框顶条 + 底部灵动悬浮坞 + 可折叠铭牌抽屉，彻底移除墙面遮挡浮字。
- **河洛文创（`/shop`）**：1280px 买手店两栏架构（4:5 高清摄影卡 + 360px 自适应吸顶购物袋，移除杂乱底图与 `motion-v`）。
- **预约与个人中心（`/appointment`、`/login`、`/profile`）**：水平 4 步轨道 + 14 天双行日历 + 右侧实时联动电子入馆票根（半圆缺口与虚线撕口）；登录页 55:45 全高双栏；个人中心采用“数字参观档案夹”与票根/账簿卡片。
- **管理后台（`/admin`、`/admin/operations`）**：`240px` 固定侧栏 + 4 格 KPI 条 + 两行结构化内容记录卡 + Element Plus 令牌融合。
- **洛笙 AI 向导（`LuoshengSiteGuide.vue` / `LuoshengPreset.vue`）**：100% 绑定 Heluo Editorial 2.0 语义令牌；在 3D 暗房页自动切换暗房玻璃材质并于移动端避让底部控制坞。

## Motion & Fallback

- 保留全局精密指针光标（`PointerCursor`，4px 中心点 + 30px 古铜高光磁吸细环）与桌面点阵波纹（`PointerDotField`）联动，输入框、3D 画布自动还原原生指针，触屏、高对比与减少动态模式自动关闭。
- 页面切换与入场动效克制在 `220–360ms`，遵循 `prefers-reduced-motion: reduce` 立即收敛；3D 场景离开页面时释放全部 WebGL 资源。
