# V3.1 A：语义 Token 最终映射与证据边界

## 目标与范围

关联全站视觉方案 V3.1 A1–A7、F-01/F-02/F-05/F-06/F-07 相关页面。此次仅核对源码、已有报告，并在4189做只读浏览器计算样式抽样；不更改产品、不重建、不操作手机、不部署。V3.1 第3节明确“不是要求所有行都必须修改”，A4亦要求证据成立；已有品牌、字体、语义接口和合格边框保留，不以统一为理由重做。

核对基线：`artifacts/holistic/heluo-release-candidate-1789095823227/source`。这是前一候选源码，不是最初项目。相对此基线 `tokens.css`、`glass.css`、`theme-controls.css` 等未变；Explore局部新Token属于此前已批准的分类/搜索任务，不是本次另建全站系统。最新对比度收口只调整局部值/引用，不修改全局Token值。

## 真实入口与覆盖顺序

`frontend/src/main.ts`显式顺序为：tokens → base → glass → main → interaction → pointer-motion → moonhall-light → tactile-ui → light-ui-material-depth → mobile-performance → theme-controls。

`tokens.css` 将 `--color-*` 映射到 `--theme-*`，再映射到 surface/control/primary/secondary/status/tactile 语义。CSS变量在使用处求值，不能因tokens入口早于main就认定别名失效。

浅色：`main.css`的基础color值继续被`moonhall-light.css`的`--moonhall-*`映射覆盖。深色：`tokens.css`引用`--dark-reference-*`；`main.css`后段深色修订（3084行附近）继续覆盖早期同名参考值。因此不能把tokens文件内fallback当作最终值。

共享控件：`theme-controls.css`提供字段边界、状态、focus规则；玻璃/tactile材质和`!important`可能竞争，必须检查命中的实际元素。`matchedBorders`历史报告只是匹配选择器清单，内含媒体条件分支，不等于每条当时均生效。

路由样式入口：

| 页面 | 真实额外入口 |
|---|---|
| Home | public-responsive-polish.css + HomeView scoped style |
| Explore | control-surface-polish.css、public-responsive-polish.css、explore-gallery.css |
| 预约 | task-pages.css、control-surface-polish.css、appointment-workbench.css |
| 登录/账户 | task-pages.css |
| 商城 | control-surface-polish.css、public-responsive-polish.css |
| 两类后台 | route-admin-legacy.css、task-pages.css、control-surface-polish.css、Element Plus select/option CSS |
| 3D详情 | route-exhibit-detail-legacy.css + 实际组件style |

这些是路由加载的全局CSS，不能只按main.ts导入顺序推导所有页面；最终还受作用域、选择器优先级、important、媒体条件和异步CSS加载影响。Explore使用`html #app #explore-gallery`局部覆盖历史材质，限制影响范围。

## Token变动与全部直接消费者

对比旧4209快照，以下23个局部Token新增于`frontend/src/assets/explore-gallery.css`，作用域为`.collection-page.collection-gallery`，浅色定义6–28行、深色定义151–173行。全src搜索确认其消费者均在同一文件；不存在其他路由直接引用。表中给出完整消费位置，值以该文件上述定义为准。

| Token（省略双横线） | 直接消费者/行 |
|---|---|
| gallery-tab-text | 分类默认文字176 |
| gallery-tab-hover-text、gallery-tab-hover | 分类hover182 |
| gallery-tab-active-text、gallery-tab-active | 分类active179 |
| gallery-tab-indicator | 分类短线178；深色discovery-border-focus161、focus162、action163、action-hover165、action-active166 |
| gallery-tab-focus | 搜索输入键盘轮廓94、搜索按钮轮廓145、分类键盘轮廓184 |
| discovery-title | 看板标题66 |
| discovery-text | 搜索输入107 |
| discovery-secondary | 看板说明67、浅色placeholder114 |
| discovery-muted | 通用placeholder113（浅色被114覆盖） |
| discovery-icon | leading95、clear116 |
| discovery-divider | 看板底线57 |
| discovery-surface、discovery-border | 搜索框默认82、80 |
| discovery-surface-hover、discovery-border-hover | 搜索框hover92 |
| discovery-border-focus、discovery-focus | 搜索框focus-within93 |
| discovery-action、discovery-action-text | 提交按钮133、134 |
| discovery-action-hover | 提交按钮hover143 |
| discovery-action-active | 提交按钮active144 |

旧4209这些名字无定义/引用；最近对比度专项开始前已经存在，不能把“基线不存在”和“最近才改动”混为一谈。最近具体前后为：

| 修改 | 前 → 后 | 作用域/保留 |
|---|---|---|
| discovery-secondary浅色值 | #697871 → #53645c | 原消费者说明；深色#aebdb4不变 |
| 搜索输入focus | 只有focus-within轻环、outline none → 新增2px gallery-tab-focus + 2px offset | 不改Token值；浅色#146b50，深色var(--theme-focus)；保留原halo/尺寸 |
| 浅色placeholder引用 | discovery-muted（#89958f）→ discovery-secondary（#53645c） | 深色仍discovery-muted #899990；仅新增浅色覆盖 |
| 首页深色说明引用 | 原正文色继承 → theme-text-strong | 全局theme-text-strong定义不变；仅新增HomeView.vue:173消费者 |

因全局`theme-text-strong`值未改，本次不存在它的全局引用迁移；原消费者不变，新增消费者已单列。导航/购物袋修正使用`env(safe-area-inset-bottom)`及媒体断点，不是新增品牌Token。默认淡边框保持，不能将对比度采样器的默认border提示直接判为必须加深。

## 当前七类页面 Light/Dark Computed 抽样

2026-09-12使用隔离Chrome/Playwright，1440×900、reduced-motion=reduce；每路由新page、主题上下文独立。后台仅通过隔离环境管理员登录读取，不写业务数据。开始/结束HTML SHA256均为`3495c669d2105dfd50f905d00f57f850beffea0a0b3cb89b138dba3bbf7d7fc8`。以下为本轮命令直接读取的Computed值，非手算Token推断。

七类元素均继承相同的最终语义：

| Token | Light | Dark |
|---|---|---|
| theme-surface-canvas | oklch(97% .003 165) | oklch(22% .009 165) |
| theme-text-strong | oklch(25.5% .042 165) | oklch(91% .024 84) |
| theme-focus | oklch(47% .11 169) | oklch(83% .105 78) |

| 路由/实际抽样选择器 | Light最终color / background | Dark最终color / background |
|---|---|---|
| / `.home-cover__intro` | oklch(.34 .031 164) / transparent | oklch(.91 .024 84) / transparent |
| /explore `.gallery-intro__description` | rgb(83,100,92) / transparent | rgb(174,189,180) / transparent |
| /appointment 首个input | oklch(.255 .042 165) / oklch(.99 .002 165) | oklch(.91 .024 84) / oklch(.29 .01 165 / .96) |
| /login 首个input | 同预约 | 同预约 |
| /shop 首个.fluid-button | oklch(.97 .009 90) / oklch(.42 .085 163) | oklch(.14 .016 170) / oklch(.76 .1 76) |
| /admin 首个.el-select__wrapper | oklch(.27 .025 165) / transparent | oklch(.91 .024 84) / oklch(.2 .01 78 / .88) |
| /exhibits/heluo-bronze-ding-3d h1 | oklch(.255 .042 165) / transparent | rgb(255,253,247) / transparent |

预约/登录/后台字段边框在Light为oklch(.55 .028 164)，Dark为oklch(.69 .024 160)，与theme-controls中的field-boundary对应。3D标题深色采用局部前景，并非theme-text-strong的相同最终色；局部视觉语义差异本身不构成缺陷。

首次脚本在桌面等待`.viewer-poster-start`可见超时，未输出完整结果；正式重跑改为真实可见h1，完成14组。故上表只证明3D入口页标题与继承变量，**不证明poster按钮、运行场景或工具栏通过**。透明背景也不能直接用于文字对比度计算，必须另查合成背景。

## 对应现有证据与未覆盖

报告均位于`artifacts/premium-visual-2026-09-12/`：

| 要求 | 实际证据 | 限定 |
|---|---|---|
| 七类双主题Computed | 上述14组当前候选现场读取 | 每类代表元素，非所有状态/全部调用者 |
| 首页背景文字 | home-contrast-final/summary-home.json，8组、说明最低5.85 | 9e997c候选；之后首页源码未变；不是整页结论 |
| 搜索focus | focus-after/summary.json，浅5.94/深11.86；artifacts/explore-keyboard-focus-20260912/summary.json 24组 | a7f7候选对应局部规则；随后placeholder变更单独验收 |
| placeholder | explore-placeholder/after/summary.json及对应专项计划 | 当前候选24状态；浅6.1565、深最低6.0312 |
| 预约/登录/商城/后台边界 | control-boundaries/summary.json及focus-after；select-short-text-followup/summary.json | default/focus抽样，不等于完整状态/全页；后台8组选择器与36短文本另证 |
| 全站背景 | background-contrast/summary.json 112首屏样本 | 010de749旧构建；部分低值已专项修正；不能用于全页/嵌套滚动全通过 |
| 3D | Android计划与当前入口h1抽样 | 真机contextlost未通过，不能由主题变量一致关闭 |
| 预算/字体 | 本轮实际运行node scripts/bundle-budget.mjs退出0 | 读取当前dist，不重建；initial CSS gzip 47594/80000，JS gzip509568、CSS gzip105257、WOFF2=0 |

A项“全局语义映射、直接引用、七类代表元素双主题Computed、当前产物预算/无新增WOFF2”已有明确记录。后续全页112状态/310视口/7493直接文字样本0低值已完成；展开菜单另有8组558样本证据，不再将无限滚动穷举列作门禁。原生200%键盘及forced-colors模拟新增定向证据见v31-evidence-matrix；尚存真机3D/软键盘、原生系统辅助验证和缩放截图采集限制。不得因本表完成便将整体V3.1或发布前置条件标为通过。

风险与下一步：任何后续共享Token数值修改都应重新列直接引用并重验上述七类；仅局部修改则检查受影响消费者和布局。最终发布必须关联届时实际构建，不能把本记录签名当作自动更新的永久凭证。
