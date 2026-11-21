# V3.0 / V3.1 当前实施与证据索引

## 判断边界
目标仍是按审计事实增量实施全站视觉方案，不能用几个通过测试替代完整规格。本文对应Downloads中的V3.0与V3.1、Task0附件、当前源码和真实报告；不是另起一套视觉方向。

旧4209验收快照：`artifacts/holistic/heluo-release-candidate-1789095823227/source`。运行源码对照脚本 `frontend/scripts/audit-source-lineage.mjs`，结果在 `artifacts/premium-visual-2026-09-12/source-lineage/summary.json`。83个运行src文件中77个文本内容相同（忽略CRLF），6个差异文件为HomeView、ExploreView、explore-gallery.css、interaction.css、main.css、responsiveMediaManifest.json。main.css含两处底部导航安全区及根滚动容器scroll-padding避让，interaction.css增加761–900px购物袋入口避让。此对照不等于旧浏览器测试重跑，也不证明后端/数据/public资源相同。

旧默认状态报告不能冒充当前构建；未变组件的事件/状态实现可按源码沿用历史证明，受首页素材、Explore或底栏改动影响的布局必须补验。旧状态证据详细范围见 `2026-09-11-premium-completion-audit.md` 的真实控件状态覆盖表。

## A–P逐项状态
| V3.1项 | 当前实现/证据 | 状态与剩余 |
|---|---|---|
| A 语义Token | tokens/glass/theme-controls等源码与旧快照相同；本次Explore次文沿用局部语义，搜索焦点复用gallery-tab-focus，首页深色说明复用theme-text-strong；底栏使用env安全区 | `2026-09-12-token-final-map.md`已记录入口/层叠、23个局部Token直接消费者及七类页面双主题14组当前Computed；预算通过，无新增全站体系，不据此替代对比度/3D运行验收 |
| B 公共壳层 | 共享壳层源码未变；main含安全区偏移与根滚动避让；真机四页末尾入口可达；商城断点避让12组通过 | 后续原生200%16组真实Tab已关闭公众端原底栏中心遮挡，后台命中已解释；仍保留原生缩放截图限制，不宣称所有控件所有状态穷举 |
| C1 FluidButton | 源码未变，历史controls/booking/cart/admin报告已有适用状态与尺寸/事件断言；最新业务E2E14项通过 | 沿用未变状态实现证据，不宣称所有调用方状态穷举 |
| C2 搜索/输入/复选 | 搜索布局本轮更新；搜索24组真实交互通过；旧selection-states覆盖选择/禁用及键盘 | 焦点已修正；随后placeholder浅色由3.0469提升至6.1565，深色保持且最低6.0312，24状态通过，边框/尺寸/按钮/焦点值前后一致；默认淡边框按规格保留 |
| D 首页 | 用户背景/CTA更新已有专项；动画与reduced-motion标题完整；home-contrast-final的390/1440双主题双语8组通过，说明最低5.85:1 | 不改冻结背景、构图与CTA。仅对应首屏文字区域，不扩大为整页或所有背景裁切通过 |
| E Explore | 24组双语双主题320/390/768/1024/1366/1440布局、搜索、Enter、清空和返回检查通过；焦点2px/2px通过 | responsive-focus-followup确认390px英文第4分类经Tab后横向滚动136px，焦点及命中通过；此专项其他商城失败由后续cart-nav-after单独闭环 |
| F 文物/专题/展厅 | 相应页面源码未变；旧state-gaps-4209真实加载/错误/空态恢复证据存在 | 媒体manifest变化需按资源影响复核；不能只从默认h1截图推导长文和来源布局全部通过 |
| G 预约 | 源码未变；旧booking-feedback、selection-states有失败保留/重试/禁用证据；最新E2E含预约通过 | 真机双主题4联系字段及确认按钮真实键盘开关可达，见android-keyboard计划；不扩展为所有手机状态 |
| H 商城 | Vue源码未变；旧cart-feedback覆盖抽屉、失败、支付不确定性、焦点返回；最新E2E模拟支付/幂等通过；interaction.css本轮补761–900px避让 | cart-nav-after双主题6宽度12组通过；10组浮动入口开关通过，981px两组无入口、使用桌面面板，开关N/A；不延伸为全部购物状态复跑 |
| I 身份/账户 | Login/Profile源码未变；旧state-gaps-4209明确触发注册/重置表单；最新E2E覆盖登录续填 | 当前axe的reset默认页可能同登录，不能作为重置表单证据；沿用有明确触发的历史状态报告 |
| J 内容后台 | 源码未变；旧admin-feedback和最新CRUD E2E；当前8组select展开ID/listbox/option及键盘通过 | aria-controls的8条incomplete已定向解释；不宣称后台新增英文能力 |
| K 运营后台 | 源码未变；旧反馈/列表状态及当前36个短文本对比度通过，最低4.532:1 | 36是节点数量，不能从120规则数量中直接相减 |
| L 3D | 3D运行源码与旧快照相同；Chrome133真机contextlost重复复现；vivo浏览器另有实体/旋转/放大/点云/返回实体真实触控截图通过；浅色刷新→海报→显式启动→实体显示也通过 | vivo无CDP内部状态或无缓存冷启动全矩阵；Chrome133既有失败保留。用户不更新浏览器，替代路径已实测，不将Chrome失败改写为已修复。详见vivo-three-verification与Android计划 |
| M 完整状态 | 历史代表组件状态表按源码等价关联；当前搜索反馈/业务测试补充 | 只覆盖真实适用状态，不能声称每个控件全部状态；不为不存在的功能制造indeterminate等状态 |
| N 响应式 | 搜索24组、真机基础检查；responsive-focus-followup共58组记录；商城760/761/900/901/980/981双主题12组修后无相交/无溢出，首尾指纹一致 | 58组原报告包含修前商城覆盖，不应整批写通过；12组定向报告关闭该覆盖问题。未触及页面不由商城结果推断 |
| O 无障碍 | 原axe112状态0 violations；8条ARIA与36短文本定向通过；全页112状态/310视口/7493直接文字样本0低值；下拉8组558样本最低7.442；原生200%16组真实Tab修后公众端原底栏遮挡关闭；forced-colors模拟4组焦点与分类系统色通过 | 原axe120条incomplete不可按节点数量相减。上述为明确代表范围，不要求所有像素/嵌套位置穷举；后台4条中心命中已解释，原生缩放截图仍有合成限制。Chromium模拟不等于原生Windows对比主题；预约双主题真实软键盘与vivo代表3D通过，登录密码安全截图限制、深色登录未验保留。O2的400%为复杂内容/合规专项，不作本轮全站强制新增门禁 |
| P 性能 | 本轮生产构建、类型与资源预算通过；不新增依赖/3D模型/图片资源 | 旧性能报告只按未变实现关联，不冒称公网或低端设备性能通过 |

## 当前构建与报告关联
- `ffc173ee3b849fd4909e9ec4b616d9ab0b723942e4723c59c5ab638c27ae143a`：最新候选追加强制颜色选中分类文字修复；构建含类型/预算、4组浏览器焦点/分类检查通过，见forced-category-label计划。普通主题及3D代码未改。
- `f28dbe00ea177ffa804a440825314f9354b05b022948abef917310b487d7a8f7`：追加main.css根滚动容器底栏避让。构建/类型/预算及329单测通过；正式16组Tab公众端原中心遮挡消失，后台4条命中已定向解释，原生缩放截图限制保留，见native-zoom-focus-clearance计划。
- `fullpage-contrast/summary-extended.json`：3495c669同构建112状态、310文档滚动视口、7493直接文字样本，低值0。含首次超时及同构建续跑，不覆盖嵌套容器/所有交互/非文本图形，详见fullpage-contrast-review计划。
- `3495c669d2105dfd50f905d00f57f850beffea0a0b3cb89b138dba3bbf7d7fc8`：最新候选，仅比fdf9b305增加浅色搜索占位文字局部颜色；placeholder 24状态、Explore14单测及类型/构建预算通过。此前其他门禁没有在此构建全部重跑，按未变源码限定关联。
- `010de749…`：原axe、后台选择器/短文本、全站112首屏背景采样；后者complete=true，仅首页1440深色中文说明一项低值。不是全页对比度结论。
- `a7f7eb18…`：搜索焦点2px/2px与24组搜索通过；首页首轮修正未命中，4.09仍存在，不能用作首页完成证据。
- `9e997c110b58d402a58e784dba180b14ae23219c1c6e5bcee8c5ebd1789dea12`：纠正首页scoped选择器后的候选；home-contrast-final共8组完成，说明最低5.85:1；responsive-focus-followup在此版发现商城覆盖，不作为最终全通过。
- `fdf9b3051afdc348f9aea850645ed729f934eac4a1a23983fa7a317bd56f536a`：补interaction.css购物袋避让后的当前报告构建；cart-nav-after12组及native-zoom16组首尾均为此指纹。后者不证明完整键盘流程。
- `select-short-text-followup/summary.json`：16组、8组选择器与36短文本，业务写入0。旧构建之后仅增加搜索焦点和首页局部文字色，后台组件/规则未变。

## 本轮实际产品改动集
`main.css` 两处安全区与根滚动避让；`explore-gallery.css` 浅色说明/占位文字对比度、键盘焦点与强制颜色分类标签；`HomeView.vue` 深色说明文字色；`interaction.css` 761–900px购物袋入口避让；`darkThemeCohesion.spec.ts`旧首页资源断言同步。其他既有dirty改动归用户/原任务，不以工作树总数推导本轮范围。

具体当前→目标参数、影响范围、禁止项、验收见 `2026-09-12-mobile-fixed-nav-safe-area.md`、`2026-09-12-explore-keyboard-focus.md`、`2026-09-12-home-intro-contrast.md`。本索引不代替未运行验证；发布范围与既有失败裁定见 `2026-09-12-pocketbay-visual-final-release.md`，未将全设备/合规认证标记完成。
