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

### 浅色「月白宣纸 · Daylight Paper」
- `--surface-canvas`: `oklch(97.8% 0.006 95)`（温润宣纸底）
- `--surface-subtle`: `oklch(95.2% 0.009 92)`（次级锦绫浅底）
- `--surface-elevated`: `oklch(99.5% 0.003 95)`（浮起纯净纸面）
- `--surface-plinth`: `oklch(93.8% 0.011 90)`（器物展台）
- `--ink-primary`: `oklch(20% 0.018 165)`（河洛松烟墨）
- `--ink-secondary`: `oklch(38% 0.014 165)` / `--ink-muted`: `oklch(52% 0.010 160)`
- `--accent-jade`: `oklch(34% 0.068 165)`（深青玉主操作）
- `--accent-bronze`: `oklch(52% 0.088 72)`（古铜眉标与激活细线）
- `--accent-seal`: `oklch(49% 0.145 27)`（朱砂印章，严格限高优先级警示与印戳）

### 深色「乌金石墨 · Obsidian Silk」
- `--surface-canvas`: `oklch(13.5% 0.004 82)`（纯净暖乌金炭黑，彻底去偏绿发闷，绝非纯黑）
- `--surface-subtle`: `oklch(17.5% 0.004 82)` / `--surface-elevated`: `oklch(21.5% 0.005 82)` / `--surface-plinth`: `oklch(16% 0.004 82)`
- `--ink-primary`: `oklch(96% 0.006 86)`（纯净暖象牙白） / `--ink-secondary`: `oklch(81% 0.006 84)`
- `--accent-jade`: `oklch(75% 0.088 76)`（高定香槟古铜金主操作，配 `--accent-jade-ink: oklch(14% 0.006 76)`）
- 玻璃材质附加顶部微光高光 `--glass-highlight` 与 `saturate(140%)`；3D 展厅在浅色模式呈现日间实景建筑展厅，在深色模式呈现乌金暖光景深展厅与「天青月白 × 香槟鎏金」星尘点云。

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
