# 线上移动端严格审查与优化修复方案

> 审查日期：2026-11-25（Asia/Shanghai）；用户入口：https://heluo.pocketbay.app/
>
> 状态：**应用内候选通过本地回归；公网 P0、PocketBay 宿主、正式入口性能和真机验收未关闭**。第 1～7 节保留修复前的审查基线，第 8 节记录候选版本和复验结果，最新同镜像证据见 §8.40。生产配置、业务数据及发布未写入。
>
> 关联需求：F-01/F-02/F-03/F-05/F-06/F-08/F-09/F-12/F-14、N-03/N-05/N-06、LS-05～LS-06。

## 1. 结论与发布判断

当前站点的基本移动布局和品牌系统已经成立，但还不能按“线上移动端全部验收通过”交付。确认了 **9 组问题：P0 × 1、P1 × 4、P2 × 4、P3 × 0**。优先恢复预约可用性，再解决输入区遮挡、平台浮层与冷启动位移，随后收口 3D 短屏布局和全站触控标准。

本报告的“通过”仅针对实际执行的公开、未登录流程。没有测试账号，不把预约提交、登录成功、支付、个人中心或管理后台写成已验收；没有实体手机，不把 Chromium 仿真写成 iPhone / Android 真机测试。

### 实现一致性判断

**未通过完整线上一致性验收。** 保留 Heluo Editorial 3.0 的器物主视觉、双主题令牌和底部导航，不建议推倒重做。问题主要集中于嵌入宿主与应用之间、异步首屏布局、短高度下的弹层，以及零散控件绕过共享尺寸标准。

本地 `impeccable detect --json frontend/src/styles frontend/src/views frontend/src/components` 输出 `[]`，但运行态仍有遮挡、文字裁切、焦点逸出。这证明静态检测只能作为一层门禁。文档声称的“365 天可约”与线上空时段、文档的“44px 控件”与实测 26–40px 控件也不一致。

### 审查健康评分

这是人工审查分，不是 Lighthouse 分，也不是 WCAG 合规认证。

| 维度 | 得分 | 依据 |
| --- | --- | --- |
| 可访问性 | 2/4 | 基础页面自动扫描良好，但平台关闭按钮不满足 24px/间距要求，暗房弹窗焦点未约束 |
| 性能 | 1/4 | 两次公开入口实验室测试 CLS 均约 0.875，TBT 约 525–785ms |
| 双主题 | 3/4 | 检查的明暗主题页面可读且一致；未做完整像素对比度、强制颜色与真机验证 |
| 响应式与触控 | 2/4 | 主页面无整体横向滚动，但短视口、3D、英文和触控尺寸仍有缺口 |
| 实现与验收一致性 | 2/4 | 设计体系明确；线上预约数据、历史验收结论与实测存在差异 |
| **合计** | **10/20** | **基本可用，仍需实质修复** |

## 2. 测试方法与证据边界

### 2.1 实际测试矩阵

浏览器：Playwright 驱动的 Chromium **153.0.8010.12**，`isMobile=true`、`hasTouch=true`，从用户提供的外层入口进入真实跨域 iframe。默认保留动画、平台横条、反馈浮层和站点底部栏，不通过隐藏浮层制造通过结果。

| 外层视口（CSS px） | 主题/语言 | 基础页面 |
| --- | --- | --- |
| 320×568 | 浅色中文、浅色英文 | 每组 6 页 |
| 375×667 | 浅色中文 | 6 页 |
| 390×844 | 浅色中文、深色中文、深色英文 | 每组 6 页 |
| 430×932 | 深色中文 | 6 页 |
| 768×1024 | 浅色中文 | 6 页 |
| 844×390 | 浅色中文横屏 | 6 页 |

合计 **9 组 × 6 页 = 54 个基础页面状态**，覆盖 `/`、`/explore`、`/exhibits`、`/appointment`、`/shop`、`/login`。每个状态保存整屏截图、布局、控件尺寸、表单字号、图片与导航信息。由于 PocketBay 横条占用 39px，390×844 时应用实际可用视口是 **390×805**，320×568 时是 **320×529**。

进一步执行：搜索结果进入文物详情、高清弹窗倍率切换/关闭、洛笙展开/输入/短视口、青铜鼎与图纹石板运行时激活、3D 合成触控横滑、小屏/横屏切换及滚动、购物袋开关、商品溯源、未登录加购跳转、英文章节、外层刷新、公开时段接口与健康接口。

390px 中文浅/深各 6 页进行了 axe 自动检查，共 **12 个基础页面状态，所选 WCAG A/AA 标签规则的 violations 为 0**。该检查在应用 iframe 内执行，不能代替外层页面、交互展开态、键盘或读屏验收。

### 2.2 性能测试

使用已有 Lighthouse **13.4.1**；移动配置 412×823、DPR 1.75、模拟 4× CPU 降速、约 1.6Mbps 网络。以下是实验室诊断值，不是实际用户 Core Web Vitals，也没有测得真实 INP。

| 用户入口测试 | 性能分 | LCP | CLS | TBT | Speed Index |
| --- | ---: | ---: | ---: | ---: | ---: |
| 第一次 | 49/100 | 2.98s | 0.875 | 524.5ms | 7.82s |
| 第二次 | 44/100 | 2.92s | 0.875 | 784.5ms | 7.77s |

其他浏览器审查存在并行活动，CPU/TBT 和综合分仅用于诊断，不用来承诺真机速度。两次共同的强信号是 **CLS 0.875**，明显高于 0.1 的目标。Lighthouse 将主要位移归因到应用的 `footer.site-footer`；不能把全部问题归咎于平台。

另一次直接测试 `heluo--e.pocketbay.app` 被重定向回公开外层地址。该次包含重定向成本，**不作为内层独立性能分**，也不与前两次直接比较。

### 2.3 本轮未覆盖

- iOS Safari / Android Chrome 实体手机、微信内置浏览器、刘海安全区、真实软键盘、双指缩放、GPU 发热与持续帧率；本机未安装 Playwright WebKit / Firefox。
- 登录成功、注册/重置邮件、预约创建/取消/核销、购物车写入/下单/模拟支付、个人中心与后台登录后功能；没有测试账号且未写生产业务数据。
- 洛笙实际模型回复、SSE、限额：仅展开与输入，未发送对话；不能据此评价答案或首字延迟。
- 屏幕阅读器、系统字体放大、200% 文字重排、强制颜色、完整键盘矩阵和完整对比度认证。
- 生产数据库、部署变量、运行镜像提交号与日历种子执行状态；没有把本地代码直接当成已部署事实。

## 3. 问题清单与逐项修复契约

### M01 · P0 · 线上预约没有可选时段

**证据**：`GET /api/v1/appointment-slots` 多次返回 HTTP 200、`data: []`；显式请求 `dateFrom=2026-12-01&dateTo=2026-12-07` 仍为空。健康接口 HTTP 200、`data.status=UP`。当月与下月非周一日期均“未开放”，无法选择日期/时段进入后续流程。

**影响**：预约主任务阻断。这不是移动专属缺陷，但直接影响移动用户的核心路径。页面一边显示“未来一年（365 天）”，空态又说“未来两周暂未开放”，进一步混淆预期。

**定位与原因边界**：本地候选位置为 `backend/src/main/java/com/heluo/museum/appointment/AppointmentSlotController.java:28`、`backend/src/main/java/com/heluo/museum/config/BootstrapDataInitializer.java:25`、同文件 `:189`，以及 `frontend/src/views/AppointmentView.vue:440`、`:843`。本地 365 天补齐逻辑只在条件启用的启动初始化器中执行；这只是排查线索。未确认线上是否为旧镜像、未启用初始化、时区/过滤条件问题或运营关闭。

**修复步骤**：

1. 先只读核对线上镜像版本、服务端业务日期/时区、时段表日期分布、OPEN 状态与余量，复核查询过滤；不得因为“空”就盲目开启开发种子或重跑全部初始化。
2. 若缺少时段，使用明确的管理功能或专用、幂等的补齐任务，只补缺失日期/时段；保留已预约人数、人工关闭、调整容量与审计信息。若需结构改动必须走版本化迁移。
3. 年窗口持续维护不能依赖重启服务；在确认运营规则后设计滚动补齐或管理员批量开放，涉及长期架构选择时补 ADR。
4. 区分“正在加载 / 暂未开放 / 查询失败 / 本日已满”，空态提供重试和最近可约日期，不通过前端伪造余量。统一 365 天口径和文章里的旧 14 天说明。

**验收**：公开未来日期存在真实可预约记录；周一保持关闭；跨月选择后可进入表单。用隔离测试账户完成一次预约及个人记录查询，验证重复提交与容量边界；生产业务写入另需明确授权。没有完成这个闭环，不关闭 F-06 的线上阻断状态。

### M02 · P1 · 洛笙短视口中推荐问题覆盖输入区

**复现**：打开洛笙，将外层视口收窄至 390×460（应用 390×421），模拟较短可视高度，不宣称这等价于 iOS 真实键盘。

**证据**：抽屉高度约 345px；推荐问题容器 y=334.7～482.7，而输入框 y=361.8～405.8。输入框中心 `elementFromPoint` 命中 `.luosheng-starters`，不是 textarea。截图可见推荐问题叠在输入区上。

**影响**：在可视高度不足时输入目标被挡住，用户可能误点推荐问题；这是应用自身布局问题，平台反馈浮层会进一步加重。

**候选根因**：`frontend/src/components/LuoshengSiteGuide.vue:1241` 的日志区有 `min-height:220px`，移动抽屉限制 `max-height:82dvh`，与头部、上下文、快捷问题和输入区的总高度争抢空间。

**修复设计**：抽屉使用明确的纵向轨道：头部、上下文、`minmax(0,1fr)` 消息区、输入区；消息区 `min-height:0; overflow-y:auto`，输入区不压缩。短高度时将推荐问题折叠为一个入口；键盘打开后优先保住消息最后一段与输入框。统一模态层与背景滚动管理；对真实 Safari 的 `visualViewport` 行为先验证，只有 CSS 无法满足时再加入节流监听。

**验收**：390×460、375×500、320×568 下，输入框/发送/关闭按钮中心和四角命中自身或其子节点；推荐区不与输入区相交。真机软键盘弹出/收起、多行输入、旋转与安全区均可用。

### M03 · P1 · PocketBay 浮层遮挡应用内容，关闭热区过小

**证据**：外层 39px 顶部横条、底部品牌标识、右侧“立即反馈”及自动提示在多页持续出现，进入高清弹窗后仍在最上方；小屏 3D 控制区与反馈浮层发生视觉覆盖。Lighthouse 的 `target-size` 指出 `#pb-host-chip-close` 为 **18×18px** 且与邻近按钮间距不足，属于外层页面的问题。

**影响**：遮挡内容、增加误触、破坏暗房沉浸，也减少可用高度。这部分不能靠提高 iframe 内的 `z-index` 解决。

**修复设计**：优先核对平台已有的发布/品牌/反馈开关与支持的嵌入模式，在允许的配置范围内收敛为不自动展开的反馈入口；需保留时将关闭热区做到 44px，并与站内任务浮层互斥。若平台没有这些能力，单独评估支持的正式访问入口或自定义域名方案。任何付费、域名或部署变化另行确认，不把换托管作为本次默认实施动作。

**验收**：从用户实际公开地址进入，在表单、3D、购物袋和高清弹窗内测点击命中与遮挡；截图包含平台壳层。若无法控制平台浮层，应明确列为已知限制，不用测试时隐藏节点来“通过”。

### M04 · P1 · 冷启动发生明显布局位移

**证据**：两次公开入口 Lighthouse CLS 均为 **0.874848**，主要移位节点为 `footer.site-footer`，并非只有平台横条。第一屏加载时页面结构稳定性不达标。

**候选位置**：`frontend/src/App.vue:292` 的异步路由与 Suspense fallback；`frontend/src/styles/05-shell.css:192` 的主内容布局；`frontend/src/styles/04-components.css:419` 的通用小型 skeleton。当前检查没有完整解析每帧 trace，因此“异步主内容缺少等高占位”是优先验证的假设，不是已证明的唯一原因。

**修复步骤**：先结合 trace/filmstrip 与 LayoutShift attribution 确认空主区、骨架、首屏 Hero、页脚的高度变化；给首屏路由提供匹配真实结构的占位与必要最小块高度，确保图片有稳定纵横比。稳定首屏后再按主线程时间线收敛装饰动画/非必要预热，不以删除品牌视觉或全站禁用动效代替优化。平台壳层的首次高度分配也要一起复测。

**验收**：同入口、同配置、空缓存至少 3 次独立运行；目标 CLS 每次 ≤0.1，LCP 中位数 ≤2.5s，TBT 中位数 ≤200ms，综合分只作辅助。稳定保留首屏空间，加载前后不会把用户正在阅读或点击的位置挪走。真机另外记录首次可操作时间，不能以实验室 TBT 代替 INP。

### M05 · P1 · 3D 短屏/横屏没有围绕有效高度布局

**证据**：320×568 外层下，应用高度 529px，工具按钮 y=451～487；中心命中 `.mobile-tab-bar`。滚动约 194px 后可命中工具按钮，**并非永远不可操作**。844×390 横屏下，应用只有 351px 高，顶部的“空间标尺 / 3 步微导览 / 展品档案”挤成竖排，展品和工具区不能在初始一屏形成有效操作空间。

**候选位置**：`frontend/src/views/ExhibitDetailView.vue:2050` 附近的场景最小高度、760px 宽度断点与短高度规则，`frontend/src/styles/05-shell.css:755` 附近的底部导航避让，以及场景内 `.exhibit-dock`。

**修复设计**：用真实可用高度分配“场景 + 一级工具”，同时考虑宿主横条、站点头部、底栏和安全区。为 `max-height`、横屏及粗指针组合单独设计紧凑模式；不要在宽 844px 时直接套桌面完整工具栏。短屏仅保留返回、信息、重置和主要模式；其余视角/标尺/微导览放入可展开工具面板。选择紧凑模式时仍能直接看到展品主体与工具，不要求用户先猜测需要滚动。

**验收**：320×568、375×667、844×390 初始视口中，展品可辨识，主要操作不被导航/平台层挡住；工具扩展可关闭且不困住页面滚动。合成触控只用于回归，再用真机分别验证旋转、双指缩放、页面纵向滚动、手势取消和 WebGL 丢失恢复。

### M06 · P2 · 多处控件小于项目 44px 触控标准

**已测尺寸**：声景入口高 38px；首页局部推镜高 36px；搜索输入/提交高 38px、热门词高 36px；登录模式切换高 40px、显示密码 40×40px；洛笙关闭 36×36px、快捷意图高 32px；3D 旋转/缩放/重置 36×36px；页脚手账约 60×26.3px；购物袋拖拽手柄高 28px。

**重要区分**：小于 44px 违反本项目标准，但不自动等于 WCAG 2.2 AA 失败；AA 的 24px/间距例外需单独判断。平台的 18px 关闭按钮例外不足，已在 M03 单列。禁用日期、隐藏按钮不应与正常可操作按钮混算。

**候选文件**：`frontend/src/styles/04-components.css`、`frontend/src/styles/05-shell.css`、`frontend/src/views/HomeView.vue`、`frontend/src/views/LoginView.vue`、`frontend/src/views/ExhibitDetailView.vue`、`frontend/src/components/LuoshengSiteGuide.vue`、`frontend/src/components/BottomSheet.vue`。

**修复设计**：在现有层叠系统中集中约束触屏操作最小 44×44px，主要任务操作 48px；扩大实际交互盒而非只放大图标或做会与邻居重叠的透明伪元素。小号视觉按钮可以保持字级，但外部可点击盒要达标。320px 日历的七列布局也小于 44px 宽，若坚持项目标准，极窄屏采用日期列表/带明确翻页入口的周条，不强行塞七个 44px 单元造成新的溢出。

**验收**：启用状态、可见、实际可交互元素按 CSS px 检查目标尺寸与间距，验证图标按钮可读名称和聚焦态；桌面精细布局不被触屏规则整体放大。

### M07 · P2 · 英文品牌与导航重叠，首页章节标签被裁切

**证据**：320px 英文页品牌文字范围 x=50～195.1，主题按钮范围 x=164～208，真实发生交叠。390px 英文首页 `CHAPTER I · BRONZE CLOSE-UP` 从 x=398.3 开始，整段在屏外；第二章节标签延伸到 x≈507。此时 `scrollWidth` 仍等于视口宽度，说明单纯“没有横向滚动”会漏检裁切。

**候选根因**：`frontend/src/styles/05-shell.css` 的小屏头部空间分配；`frontend/src/views/HomeView.vue:604` 的 flex 章节行，两个文本都 `white-space:nowrap`；`frontend/src/styles/02-reset-base.css:10` 的全局横向 clip 掩盖越界。章节属于辅助装饰文字，不能夸大为主要内容丢失，但观感与英文完整性需要修复。

**修复设计**：英文窄屏品牌使用明确短名或有完整可访问名称的截断方案，头部控制不互相盖住；章节在窄屏转为两行/上下排布，缩减英文 letter-spacing，让文字可换行。不删除全站 clip 来强行放出横向滚动，不进一步缩小字体来塞内容。

**验收**：320/375/390px 英文浅深主题，品牌与操作区无矩形交叠，章节实际文本边界完整落入容器；额外运行字体放大压力测试。中文章节原有层级不退化。

### M08 · P2 · iframe 路由没有同步到外层地址，刷新丢失当前位置

**复现与证据**：从公开首页点击底部“馆藏”，内层已到 `/explore`，外层地址仍为 `/`；刷新外层后内层回到首页。商城加购跳到内层 `/login?returnTo=...` 时，外层仍为 `/shop`。直接访问外层深路径可进入相应页面，但不能据此证明站内跳转后的刷新/分享有效。

**影响**：刷新、复制地址与分享无法准确表达当前馆藏/搜索页面；登录/预约上下文需要额外验证。自动化 back 测试超时，不据此断言浏览器“返回”完全失效。

**修复设计**：先核对平台支持的路径/History 同步机制。有宿主合作能力时使用明确消息协议同步 pathname/query/hash、push/replace 与 popstate，严格校验 origin/source/允许路径，避免双向循环。跨域 iframe 不能直接操作父页 History。若平台不支持，采用平台支持的正式入口方案；仅在应用里调 `router.push` 不足以解决外层地址问题。

**验收**：通过站内导航进入搜索、文物详情、预约及登录 returnTo 后，刷新保持正确页面；复制地址在新窗口可恢复目标；前进/后退各执行两次，无循环、无多余历史记录；查询参数必须保真，敏感输入不进入 URL。

### M09 · P2 · 高清暗房弹窗没有完整的焦点封闭

**证据**：打开高清暗房，聚焦“关闭高清检视”，按 Tab 后焦点离开 `[role=dialog]`，`document.activeElement` 变成 BODY。本地 `frontend/src/components/ArtifactLoupeStage.vue:136` 只提供开关时 focus 与 Escape，未见 Tab 循环及背景 inert 处理。

**影响**：外接键盘、切换控制等辅助操作可能进入弹窗后方；`aria-modal=true` 本身不会实现焦点管理。本轮没有进行读屏器验证，不把这一条包装成完整读屏合规结论。

**修复设计**：复用可靠的模态焦点管理逻辑，打开时聚焦明确目标，Tab/Shift+Tab 在可交互项间循环，背景不可交互，关闭恢复触发器；统筹背景滚动锁与多个弹窗的引用计数，避免关闭一个弹窗误解锁另一个。保留 Escape 关闭与现有缩放/拖动。

**验收**：连续 Tab/Shift+Tab 各两轮不逸出，Escape 关闭并回到原触发器；触屏关闭、浏览器返回策略与背景滚动分别验证。参照 WAI-ARIA Modal Dialog 模式，不靠仅添加 ARIA 属性验收。

## 4. 风险与体验优化候选（不计入 9 组确认缺陷）

1. **iOS 输入自动放大风险**：搜索、登录、月份选择、聊天输入的计算字号为 14px。建议触屏表单至少 16px，并在 Safari 真机验证聚焦缩放、键盘遮挡及还原；当前只确认字号，没有确认本次真实 iOS 自动缩放。不要使用 `user-scalable=no` 或禁止缩放来掩盖问题。
2. **任务页首屏效率**：390px 登录用户名框约在应用 y=679，提交按钮更低；小屏先看到大幅场馆图而非表单。建议登录/预约任务页缩短首屏装饰，控制装饰区占比；以输入与任务完成耗时验收，不能仅以“首屏放下所有内容”作为统一标准。
3. **手势证据有限**：青铜鼎运行时 ready 后执行合成触控横滑，结束后仍 ready；这不证明所有旋转/双指语义正确或移动 GPU 性能达标。图纹石板在模拟环境激活成功，真实触摸光源控制仍需真机。
4. **版本漂移**：本地已有并继续出现与本任务无关的未提交源码/图片变更。修复前先固定测试对应发布版本与资产清单，重新确认问题是否仍可复现；本报告的本地文件只作为定位候选，不代表线上源码身份已经核实。

## 5. 可执行实施计划

| 问题 | 审查类别 | 建议使用的修复工作流 |
| --- | --- | --- |
| M01 | 业务可用性 / 实现一致性 | 先诊断生产数据与版本；`$impeccable clarify` 统一空态口径 |
| M02、M05 | 响应式 / 交互可达性 | `$impeccable adapt`，针对短高度与横屏 |
| M03 | 宿主集成 / 可访问性 | 核对平台能力；可控部分使用 `$impeccable harden` |
| M04 | 性能 / 布局稳定性 | `$impeccable optimize`，以 trace 和重复测量验收 |
| M06、M07 | 触控 / 国际化布局 | `$impeccable adapt`、`$impeccable typeset` |
| M08、M09 | 导航 / 焦点可访问性 | `$impeccable harden`，补行为回归 |

可按阶段逐项或整批执行；全部修复后重新 `$impeccable audit`，最终 `$impeccable polish`。这些是后续实施入口，不代表本轮已经执行修复。

### 阶段 A：恢复核心任务与输入可用性

顺序：M01 → M02 → M03。先完成只读运行版本/数据诊断；处理日历与空态，再修聊天高度模型；同步评估平台配置能力。用户未批准实施前不改生产预约数据或发布配置。

产出：预约根因记录与定点修复、短视口聊天回归、平台边界确认。退出条件是未来时段可查、隔离环境预约闭环通过、短视口输入区无遮挡；若平台不可控，明确保留限制，不能签署“全站无遮挡”。

### 阶段 B：稳定首屏与 3D 移动布局

顺序：M04 → M05。先用位移 trace 定位首屏，再处理高度/导航/工具栏的空间分配；严格保持 GLB、鉴权、API 和 3D 生命周期清理逻辑，不夹带视觉重做。

产出：冷启动录屏/trace、至少三次性能结果、竖屏与横屏场景截图、真实手势清单。退出条件为 CLS 达标、主要 3D 操作初始可达、真机核心手势通过。

### 阶段 C：统一交互与导航细节

顺序：M06 + M07 → M08 → M09。共享尺寸规则优先，再做英文布局；外层路由同步必须先确认平台能力；最后统一弹窗焦点、滚动锁及返回行为。同步处理确认后的 iOS 输入字号。

产出：触控尺寸自动门禁、英文文本边界/重叠门禁、刷新/分享/返回 E2E、弹窗键盘回归。不可用“所有元素都设 44px”或“全局 overflow:hidden”替代逐类设计。

### 阶段 D：真实使用路径回归与交付

- 最小前端检查：`corepack pnpm typecheck`、`corepack pnpm test`、`corepack pnpm build`；后端变化才运行相应后端测试与权限/数据不变性检查。
- 行为断言优先：输入框命中、面板互斥、日期可选/余量、外层刷新路径、焦点返回、底栏遮挡；截图仅辅助。
- 用实际公开入口重跑基础矩阵和交互展开态；修复后再执行 `$impeccable audit`，最后 `$impeccable polish`。
- 至少一台 iOS Safari 和一台 Android Chrome，补微信内置浏览器、竖横屏、键盘、后台返回、弱网、无 WebGL；没有设备则保留未验证状态。
- 更新本计划结果、需求追踪和状态；涉及宿主入口/路由协议/时段调度的长期决策再写 ADR；审查 Git diff 后等待用户确认提交。

工作量只给粗估：应用内 UI 与验证约 **4–7 个工程人日**，日历真实根因、宿主能力/发布协调和真机问题可能增加时间。不要把此范围当作已承诺的排期。

## 6. 修复后统一验收表

| 场景 | 必须满足 |
| --- | --- |
| 冷启动 | 无页脚/首屏大跳动；至少三次 CLS ≤0.1，记录加载条件与版本 |
| 中文/英文导航 | 320～430px 无文字与按钮交叠；所有页面能从真实入口进入 |
| 搜索 | 中文/英文关键词、无结果、清除、结果详情、返回保留合理状态 |
| 表单与键盘 | 真实软键盘显示时字段、错误、提交可达；输入不被推荐问题覆盖 |
| 预约 | 未来可约时段、周一关闭、跨月、余量不足、重复提交、成功记录均验证 |
| 购物袋 | 开关/拖动/关闭/重开正常；登录续接商品意图；隔离账户测试加减/下单/模拟支付 |
| 3D | 320×568 与844×390初始主要控件可达；旋转/缩放/滚动/取消手势与降级有效 |
| 弹窗 | 背景不可误操作；焦点循环；关闭回焦；平台浮层不能遮盖主要操作 |
| 浏览器导航 | 站内进入后刷新、复制分享、前进/后退保持正确 path/query/hash |
| 可访问性 | 热区达项目标准；Axe 无新增严重问题；人工焦点、读屏、200%字级与对比度补验 |

## 7. 已执行结果、排除项与证据索引

### 7.1 本次通过/已确认可用的部分

- 54 个基础状态均完成抓取，未发现文档整体横向滚动，未捕获页面 JS 异常；最终矩阵没有内层业务请求失败。
- 390px 双主题基础页面的 12 次 axe 所选规则扫描 violations=0；不包含模态态与平台层的合规承诺。
- 搜索“青铜”得到 4 条馆藏/专题结果并进入青铜鼎详情；高清检视可打开、切倍率、关闭。
- 青铜鼎与图纹石板从 poster 到 ready；短屏可以通过滚动到达被初始底栏遮挡的工具。
- 购物袋开关及商品溯源可用；未登录加购进入登录页并带有 `returnTo`、`intent=add-to-cart`、`productId`，没有实际加入生产购物车。
- 明暗主题已有一致的色板与内容层次；主要导航多数保持合适尺寸，不需要全站重新设计。

### 7.2 不计为产品缺陷的探测噪声

- 首页 SVG 装饰环和放大图像超出自己的布局边界，但被各自容器裁切；不计为主内容溢出。英文实际文本越界单列 M07。
- 初始自动点击部分内容链接受 smooth scroll 与 sticky header 干扰，改用底部导航或定位后真实触点完成路径；超时本身不作为“按钮坏了”的证据。
- 第一次商城探测未等关闭动画完全移除；后续显式关闭并等待 detached 后流程通过。第一次登录 URL 通配符不匹配带斜杠的 returnTo，改用 pathname 判断后通过，未误记为加购失败。
- 首次 Lighthouse 生成报告后出现临时 profile 清理 EPERM；报告保留，后续改用任务目录下独立 profile 完成重测。内层独立性能测试发生平台重定向，其分数剔除。
- 浏览器 back 自动等待超时未认定为返回失效；已确认的事实仅是外层 URL 不同步与刷新回首页。

### 7.3 证据文件

证据目录：`C:\Users\Jie\Documents\博物馆\artifacts\mobile-audit-2026-11-25`。该目录被 Git 忽略，仅作本地审查附件，不自动提交。

| 证据 | 用途 |
| --- | --- |
| [scan.json](../../artifacts/mobile-audit-2026-11-25/scan.json) 与 `scan.cjs` | 54 状态、DOM 尺寸、图片/控件、12 次 axe 结果、错误与请求记录 |
| [contact-1.jpg](../../artifacts/mobile-audit-2026-11-25/contact-1.jpg)、[contact-2.jpg](../../artifacts/mobile-audit-2026-11-25/contact-2.jpg)、[contact-3.jpg](../../artifacts/mobile-audit-2026-11-25/contact-3.jpg) | 54 张整屏截图的总览，原尺寸截图同目录 |
| [journeys.json](../../artifacts/mobile-audit-2026-11-25/journeys.json) 与 `journeys.cjs` | 详情、弹窗、洛笙、3D/图纹石板、小屏、英文等状态 |
| [followup.json](../../artifacts/mobile-audit-2026-11-25/followup.json)、[followup-shop.json](../../artifacts/mobile-audit-2026-11-25/followup-shop.json)、[header.json](../../artifacts/mobile-audit-2026-11-25/header.json) | API 空数据、中心点击命中、滚动可恢复、刷新、商城与英文头部的定点复核 |
| [lighthouse-outer.html](../../artifacts/mobile-audit-2026-11-25/lighthouse-outer.html)、[lighthouse-outer-r2.html](../../artifacts/mobile-audit-2026-11-25/lighthouse-outer-r2.html) | 两次公开入口性能及外层触控检测，JSON 原始报告同目录 |
| [followup-empty-calendar.png](../../artifacts/mobile-audit-2026-11-25/followup-empty-calendar.png) | M01 日历空时段 |
| [followup-guide-short.png](../../artifacts/mobile-audit-2026-11-25/followup-guide-short.png) | M02 短视口输入覆盖 |
| [journey-three-320.png](../../artifacts/mobile-audit-2026-11-25/journey-three-320.png)、[journey-three-landscape.png](../../artifacts/mobile-audit-2026-11-25/journey-three-landscape.png) | M03/M05 平台覆盖与 3D 有效空间 |
| [journey-english-folio.png](../../artifacts/mobile-audit-2026-11-25/journey-english-folio.png)、[followup-english-header.png](../../artifacts/mobile-audit-2026-11-25/followup-english-header.png) | M07 章节裁切与头部交叠 |

## 8. 实施与复验（2026-11-25）

本轮在原工作树上定点修改，保留已有未提交改动。浏览器涉及写入的流程使用隔离的 PocketBay profile + H2 测试库，不使用线上用户或管理员；本地构建显式启用洛笙，只测试输入控件，不向模型发送对话。

| 问题 | 本轮实施及证据 | 仍需验收 |
| --- | --- | --- |
| M01 · P0 | 空态、请求失败可重试；最近可约日期来自接口并支持跨月跳转。公开接口只返回未过时、有余量的开放时段，因此“无可约时段”不宣称运营未开放或各场已满。默认文章和 V31 统一 365 天文案；V31 仅精确更新已知旧文案，不增删时段、不改运营记录。启用初始化器的隔离 H2 实查 1,248 个未来可约记录（2026-11-26～2027-11-24、周一 0 条）；预约续填、提交、管理员确认、个人记录、丢失响应后的幂等恢复通过。 | 公网外层首页、ready 和带日期的时段查询返回 HTTP 204 空响应，并报告 `x-pocketbay-app-status: sleeping`，与修复前收到的 200 空数组不是同一种响应。仍无法确认当前上线版本、业务日期或真实时段分布，P0 不关闭。未新增自动补种任务。 |
| M02 | 日志可收缩、独立滚动；短屏灵感抽屉可折叠，输入/发送区独立。390×421、375×461、320×529 应用视口中，输入和发送 48px、关闭 44px 的中心和四角可命中。 | 真机软键盘、多行与旋转，实际模型回复和 SSE。 |
| M03 / M08 | 未改宿主。历史证据中的浮层和地址栏由 PocketBay 外层拥有。Vite 和本地 Spring 打包入口的实际站内导航、刷新、分享、两次返回及两次前进通过（含分类 hash、中文查询和嵌套 returnTo），见 §8.18。 | 核对 PocketBay 的反馈浮层及历史/深链接能力，公网同入口验证；直连路由通过不代表外层已同步。 |
| M04 | 给首页异步路由预留首屏空间，窄屏按主题提前请求真实主视觉。拦截 HomeView 脚本时，封面已开始请求、页脚不进入首屏。触屏空闲不预热其他页面，不启动桌面光标。最新候选三次冷启动 LCP 中位 2.490s、TBT 中位 58ms、CLS 均 0，通过应用内实验室门槛，见 §8.20。 | 带 PocketBay 外层的正式入口三次独立测量；真机首次可操作时间。本地 LCP 离门槛约 10ms，不能替代正式入口。 |
| M05 | 矮屏和粗指针横屏分配首要工具与扩展工具；激活前不显示无效工具栏，横屏洛笙让开展品资料。320×529、375×628、844×351 下，Chromium 触点检查激活/资料/重置/模式/视角，标尺和微导览入口可点，扩展工具能退出。无 WebGL 时可看封面、重试和打开资料；运行中断时青铜鼎可重新加载，图纹石板保留图板与资料并在上下文恢复后重绘，见 §8.7。 | 真机旋转/双指/纵向滚动、手势取消、真实设备图形中断及宿主遮挡。 |
| M06 / M07 | 扩大声景、推镜、手账、搜索、登录、聊天、购物袋及可点日期，主要输入/提交用 48px。窄屏短品牌保留完整无障碍名称；320 / 375 / 390 的英文明暗主题下，品牌与工具栏不相交、章节文字不裁切。 | 抽查不代表全站所有控件均达标；真实系统字号、浏览器缩放和读屏未验。 |
| M09 | 原生模态 `dialog` 禁止背景聚焦，打开默认聚焦关闭、Tab/Shift+Tab 循环、Escape 和点按关闭回焦。应用内 Chromium 实走两次返回/前进，无暗房历史项；滚轮和模拟触摸不能带动背景，关闭后保留位置并恢复滚动，见 §8.16。 | 公网外层浮层与 Back 行为、真机触屏及读屏。 |

### 8.1 发布前的外部依赖

只读复查：外层 `heluo.pocketbay.app` 对 `/`、`/api/v1/ready`、`/api/v1/appointment-slots?dateFrom=2026-12-01&dateTo=2026-12-31` 均返回 `204`、`0 B`、`CF-Cache-Status: DYNAMIC`，带 `x-pocketbay-app-status: sleeping`。内层 `heluo--e.pocketbay.app` 的同三条请求也返回 `204`、`0 B`、`DYNAMIC`，未见该状态头。该响应头只证明外层在这些请求中报告休眠，不证明休眠原因、源站健康状况或数据库为空。

1. 提供 PocketBay `#329 / heluo` 的授权只读诊断入口，或提供不含密钥的运行状态与日志摘要、当前镜像版本、业务时区和时段聚合。先核对实际数据库类型，分别用 [H2](../testing/appointment-availability-diagnostics-h2.sql) 或 [MySQL](../testing/appointment-availability-diagnostics.sql) 查询统计未来 7/30/365 天，按 §8.28 判读；不导出用户明细，不盲目开启开发初始化器。
2. 如确需补时段，先确定范围、运营规则与授权；只补缺口，保留人工关闭、容量与已有预约。反馈浮层或深链接如需改平台配置，单独审查并确认发布权限。
3. 候选上线后，从公开外层入口回归预约、导航、短屏表单、3D 和冷启动；补 iOS Safari、Android Chrome、微信、真实键盘/手势和读屏。不以 Chromium 模拟尺寸或本地 H2 结果替代。

### 8.2 候选改动入口

- 预约：[AppointmentView.vue](../../frontend/src/views/AppointmentView.vue)、[参观指南种子](../../backend/src/main/resources/content/seed-editorial-copy.json)、[V31 精确文案迁移](../../backend/src/main/resources/db/migration/V31__align_visit_guide_booking_window.sql)、[迁移保留馆员编辑回归](../../backend/src/test/java/com/heluo/museum/config/VisitGuideBookingWindowMigrationTests.java)。隔离 H2 的文章 API 验证旧 14 天说明替换为 365 天。迁移只替换匹配的旧句，保留馆员追加段落及改过的摘要。
- 首屏、触控与双语：[index.html](../../frontend/index.html)、[App.vue](../../frontend/src/App.vue)、[routePrefetch.ts](../../frontend/src/lib/routePrefetch.ts)、[04-components.css](../../frontend/src/styles/04-components.css)、[05-shell.css](../../frontend/src/styles/05-shell.css)、[HomeView.vue](../../frontend/src/views/HomeView.vue)、[ExploreView.vue](../../frontend/src/views/ExploreView.vue)、[LoginView.vue](../../frontend/src/views/LoginView.vue)。
- 交互布局与暗房：[LuoshengSiteGuide.vue](../../frontend/src/components/LuoshengSiteGuide.vue)、[ExhibitDetailView.vue](../../frontend/src/views/ExhibitDetailView.vue)、[ThreeExhibitViewer.vue](../../frontend/src/components/ThreeExhibitViewer.vue)、[RakingLightViewer.vue](../../frontend/src/components/RakingLightViewer.vue)、[ArtifactLoupeStage.vue](../../frontend/src/components/ArtifactLoupeStage.vue)。
- 回归：[移动端 E2E](../../frontend/e2e/mobile-remediation.e2e.ts)、[暗房单测](../../frontend/src/lib/curatorialPhase4.spec.ts)。工作树中其它未提交变更不作为本次变更认领。

### 8.3 验证记录

- 后端 `mvn package`：109/109 通过，产物打包成功；独立 MySQL 8.4 的三套迁移专项合计 **18/18**（双语 2、青铜鼎关联 14、参观指南 2）。初版 V31 实测会把馆员只改了大小写的英文摘要识别成旧种子；改为精确字面匹配后，回归验证保留馆员编辑和完整预约/时段记录。Flyway 仍提示 MySQL 8.4 超出当前版本正式验证范围。测试使用独立容器和新 schema，无生产数据，容器已停止。
- 前端默认关闭洛笙的单测：81 个文件、450/450 通过。把构建用 `VITE_GUIDE_ENABLED=true` 带入整套单测时，3 个页面测试文件的旧夹具未注入洛笙所依赖的 Pinia/组件，430/450 通过；启用态使用下面的实际应用 E2E 验收，不宣称可选开关开启时的单测矩阵已通过。
- 前端启用洛笙的候选生产构建、应用类型检查及 `test:e2e:types` 通过。首屏 gzip JS 75,719 / 81,638 B、CSS 15,124 / 80,000 B，配乐资源 5,001,307 / 6,000,000 B；保留 Vite 已有 Three.js 大 chunk 告警。
- 候选前端 + 隔离 H2 + Chromium：**28/28**（移动定点 10、业务 7、双语 11）。覆盖真实表单、权限与 CRUD，预约空态/错误故障注入无生产写入。无 WebGL 用例覆盖 [320px 深色降级截图](../../artifacts/mobile-audit-2026-11-25/candidate-3d-no-webgl-320.png)、[844×351 英文横屏降级截图](../../artifacts/mobile-audit-2026-11-25/candidate-3d-no-webgl-844.png) 所示的封面、可达重试和资料面板；两张截图也检查了封面边界和重试文字配色。E2E 使用先前启动的 H2 实例，最终 V31 的数据库回归独立运行。
- Impeccable changed detector `[]`，并实际检查窄屏渲染。Chromium 在双主题 6 页及展开的暗房和洛笙共 14 个状态执行选定 WCAG A/AA 标签的 axe 扫描，0 violations；[axe 结果](../../artifacts/mobile-audit-2026-11-25/candidate-axe.json)、[短屏洛笙](../../artifacts/mobile-audit-2026-11-25/candidate-guide-dark-short.png)、[320px 3D](../../artifacts/mobile-audit-2026-11-25/candidate-3d-ready-320.png)、[横屏扩展工具](../../artifacts/mobile-audit-2026-11-25/candidate-3d-tools-844.png)。不据此声明完整 WCAG 合规。

### 8.4 本地冷启动结果

目标是启用洛笙的首页性能候选构建（资产入口 `index-DMZD7Cse.js`），不经过 PocketBay 外层；这一批运行在 3D 降级补丁之前。Lighthouse 13.4.1，每次独立 Chrome profile，移动 412×823、模拟 4× CPU 降速 + 约 1.6Mbps 网络。

| 独立运行 | CLS（每次 ≤0.1） | LCP（中位数 ≤2.5s） | TBT（中位数 ≤200ms） |
| --- | ---: | ---: | ---: |
| [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-delivery-1.json) | 0 | 3.46s | 289.4ms |
| [2](../../artifacts/mobile-audit-2026-11-25/lh-retest-delivery-2.json) | 0 | 3.33s | 197.5ms |
| [3](../../artifacts/mobile-audit-2026-11-25/lh-retest-delivery-3.json) | 0 | 3.06s | 96.5ms |
| 本地判定 | **通过** | **未达标** | **中位数达标** |

三次 trace 均无布局位移事件。第 2 次结果中，主视觉请求于导航开始后约 14ms 发起，Lighthouse 记录的资源加载延迟约 8ms，但元素可绘制延迟仍约 1.22s；优先继续排查实际渲染/主线程开销，而非再预载更多资源。公网、INP 与真机速度均未验证，本地实验室和历史公网入口的绝对值不直接做前后对比。

### 8.5 首屏关键路径复测

M04 / N-03：封面首轮资源已提前发现，首页块及其阻塞样式仍在入口脚本运行后才发现。现仅移动直达首页时，并行下载 `HomeView` 的构建产物和必要样式；粗指针首页不再下载指针画布，受限设备不挂载本来就被 CSS 隐藏的环境背景。受限设备的首次首页把声景和洛笙安排在正文的首轮渲染之后；正文/主链接不等待它们。没有改变首屏文案、路由和桌面主视觉。资源文件名由 Vite 在构建时生成，不把哈希写死。

| 同一隔离入口的三次冷启动 | LCP 中位数（≤2.5s） | TBT 中位数（≤200ms） | CLS（每次 ≤0.1） |
| --- | ---: | ---: | ---: |
| 本轮基线 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-critical-path-baseline-1.json) · [2](../../artifacts/mobile-audit-2026-11-25/lh-retest-critical-path-baseline-2.json) · [3](../../artifacts/mobile-audit-2026-11-25/lh-retest-critical-path-baseline-3.json) | 3.37s | 276.1ms | 0 / 0 / 0 |
| 并行加载 + 跳过触屏画布 | 3.00s | 120ms | 0 / 0 / 0 |
| 加上声景/洛笙的非阻塞加载 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-critical-path-defer-1.json) · [2](../../artifacts/mobile-audit-2026-11-25/lh-retest-critical-path-defer-2.json) · [3](../../artifacts/mobile-audit-2026-11-25/lh-retest-critical-path-defer-3.json) | **2.91s，未达标** | **171ms，通过** | **0 / 0 / 0，通过** |

最终候选的 LCP 改善约 0.46s，三次均以真实首页封面为 LCP 节点，没有布局位移事件。浏览器端到端 **29/29**（移动 11、业务 7、双语 11）；新增断言验证 `/login` 不请求首页资产，移动首页封面、首页 JS 和 CSS 各请求一次且不加载粗指针不可用的画布。生产构建、应用与 E2E 类型检查、两项构建预算通过：共享入口 gzip JS 75,819 / 81,638 B、CSS 15,124 / 80,000 B；移动首页专用预载产物单独列为首页路由成本，不能从共享入口门禁反推整页传输量。[390px 浅色](../../artifacts/mobile-audit-2026-11-25/critical-path-home-mobile-light.png)、[320px 深色](../../artifacts/mobile-audit-2026-11-25/critical-path-home-mobile-dark.png)、[1440px 桌面](../../artifacts/mobile-audit-2026-11-25/critical-path-home-desktop.png) 实际渲染均无横向溢出；仍需正式入口、真机与 INP 验证。

本轮文件：[Vite 构建钩子](../../frontend/vite.config.ts)、[首页加载入口](../../frontend/index.html)、[应用壳](../../frontend/src/App.vue)、[首页](../../frontend/src/views/HomeView.vue)、[移动回归](../../frontend/e2e/mobile-remediation.e2e.ts)、[指针绘制位置](../../frontend/src/assets/pointerDotFieldMapping.spec.ts) 与 [动效约束](../../frontend/src/assets/pointerMotionVisual.spec.ts)。下一步优先分离封面和正文后的具体主线程任务，继续用相同范围比较，不用公网旧报告和本地报告直接算提升。

默认关闭洛笙的 Vitest 完整复跑通过（450 项）；调整的两条源码约束仍检查首页只声明一个画布，并要求触摸设备不挂载。Impeccable changed detector `[]`，Git diff 空白检查通过。

### 8.6 首屏渲染 trace 与反证

[基线原始 trace](../../artifacts/mobile-audit-2026-11-25/lh-retest-paint-baseline-1-trace.json) 中，封面资源在导航后约 33ms 下载完成，约 213ms 进入一帧的绘制记录，约 660ms 报告文字候选，约 1,053ms 报告封面为最终 LCP 候选。期间观察到渲染主线程的布局和声景块相关长任务，以及 GPU 合成线程多段约 120～190ms 的任务。这里是本地实际 trace 时间，不等同于移动节流模拟值；任务相关性本身不证明因果。

- 将受限设备的首页磨砂合成改为实色并暂停仪轨动画，三次模拟 LCP 中位 2.95s，无可重复改善，未保留视觉改动。
- 将封面从 `decoding="async"` 改为浏览器默认策略，三次模拟 LCP 中位 2.93s，仍无改善，未保留改动。
- 保留的改动：窄屏首页声景控制器在进入可用视区后才下载和初始化画布，顶部音频按钮始终可达。底部控制器保留绝对定位尺寸，空区域不拦截点击；桌面和不支持可见性观察的浏览器仍正常加载。新增 [Chromium 用例](../../frontend/e2e/mobile-remediation.e2e.ts) 验证未滚动时不请求画布，滚动后触控满足尺寸及命中检查。

| 最终独立冷启动 | LCP | TBT | CLS |
| --- | ---: | ---: | ---: |
| [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-paint-visible-ruler-final-1.json) | 2.78s | 80.5ms | 0 |
| [2](../../artifacts/mobile-audit-2026-11-25/lh-retest-paint-visible-ruler-final-2.json) | 2.75s | 62.5ms | 0 |
| [3](../../artifacts/mobile-audit-2026-11-25/lh-retest-paint-visible-ruler-final-3.json) | 2.77s | 65ms | 0 |
| 判定 | **中位 2.77s，未达 2.50s** | **中位 65ms，通过** | **每次为 0，通过** |

同一 Lighthouse 配置，三次仍以真实封面作为 LCP 节点，未请求 `AcousticRuler` 代码，无布局位移事件。相比 §8.5 上一候选，LCP 中位改善约 0.14s，TBT 少约 106ms；实际 trace 的 GPU 合成仍有波动，不能把剩余差距归因于某个单独 CSS 属性。

最终版本 `index-DuG7ttUS.js`：前端单测 450/450，应用及 E2E 类型、生产构建和预算门禁通过；共享入口 JS / CSS gzip 75,826 / 15,124 B。隔离 Chromium 所选用例 30 项均有通过证据：首轮 29 项通过，双语真实 API 分页因 Windows worker 进程异常退出未产生断言结果，单独复跑通过。Impeccable changed detector 为 `[]`。实看 [390px 浅色首页](../../artifacts/mobile-audit-2026-11-25/visible-ruler-mobile-light.png)、[320px 深色滚动后](../../artifacts/mobile-audit-2026-11-25/visible-ruler-mobile-dark-scrolled.png) 和 [1440px 桌面](../../artifacts/mobile-audit-2026-11-25/visible-ruler-desktop.png)，未见横向溢出。正式入口、真机及公网 INP 未验。

### 8.7 M05：运行中 WebGL 丢失与恢复

补查青铜鼎与图纹石板已经处于可交互状态时的真实浏览器上下文丢失。验收：青铜鼎展示封面及说明并可重试至新画布；图纹石板可在上下文不可用时继续看静态图板和打开资料，恢复后重新绘制斜射光。以 Chromium 的 `WEBGL_lose_context` 触发原生事件；不将故障注入视作手机 GPU 复现。影响范围仅两个展项的故障回归及确需修复的渲染生命周期，不改展品、接口或模型。

- 青铜鼎现有恢复路径通过：320×529 中文竖屏及 844×351 英文横屏均可在图形中断时查看封面和展品资料，点击重试后创建可用画布。
- 图纹石板先复现运行中断时画布空白。修复后，中断时取消绘制、丢弃失效资源并阻止过时的纹理回调写入，显示图板及中英文提示；恢复后重建资源，测试确认新程序已在有效的 WebGL 上下文运行。
- 用截图及文字区域点击命中确认：短横屏提示在舞台上沿，窄竖屏提示避开光学控制台和底部工具栏。320px 粗指针屏给洛笙保留独立位置，光向、放大镜和洛笙入口分别验证 44px 触控尺寸及无遮挡；英文光向读数可换行，不伸入放大镜按钮。桌面样式未改。
- [320px 中文中断](../../artifacts/mobile-audit-2026-11-25/stone-graphics-interrupted-zh-CN-320.png)、[320px 英文恢复](../../artifacts/mobile-audit-2026-11-25/stone-graphics-restored-en-US-320.png)、[844×351 英文中断](../../artifacts/mobile-audit-2026-11-25/stone-graphics-interrupted-en-US-844.png)、[844×351 英文恢复](../../artifacts/mobile-audit-2026-11-25/stone-graphics-restored-en-US-844.png) 均为实际渲染截图。候选 `index-Cq13LvhZ.js` 的生产构建、应用及 E2E 类型检查、构建预算和隔离 Chromium **35/35**（移动 17、业务 7、双语 11）通过；默认前端单测 **450/450**。沿用既有 Three.js 大 chunk 告警，没有改动模型文件。

### 8.8 发布门禁复查

最终候选 `index-Cq13LvhZ.js` 使用 §8.4 同一配置，三次独立冷启动 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-m05-bilingual-final-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-m05-bilingual-final-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-m05-bilingual-final-3.json) 的 LCP 分别为 **2.77s / 2.77s / 2.79s**（中位 2.77s，未达 2.50s）；TBT **71.5 / 73.5 / 85ms**（中位 73.5ms，达标）；CLS **0 / 0 / 0**（达标）。仅为本地候选结果，M04 不关闭。

未写入生产。公网 `/api/v1/ready` 复查仍为 `204 / 0 B`，外层报告 `sleeping`，缓存标记 `DYNAMIC`，未能据此确认源站健康或时段数据。Android 调试桥未发现已连接设备。不将浏览器尺寸模拟当作真机触摸、软键盘或读屏验收。

### 8.9 M04：离屏布局隔离实验

目标及范围：N-03 / M04。只对窄屏首页首屏之后的远端馆藏和参观区试验浏览器的离屏布局、样式和绘制跳过，不推迟首屏、紧随封面的精读或导航，不卸载内容、表单或链接。风险是离屏块估算尺寸影响滚动位置；若不能稳定改善 LCP，或影响实际阅读、跳转和滚动，则不保留。

本实验 LCP **2.72 / 2.75 / 2.74s**，中位约 2.74s；CLS 均为 0，TBT 中位 64ms。比 §8.8 中位仅少 33ms，仍不达标，已撤回样式，不引入离屏估算高度。

### 8.10 M04：移除挂载后的同步布局

目标及范围：N-03 / M04。离屏实验的 [原始 trace](../../artifacts/mobile-audit-2026-11-25/lh-retest-offscreen-containment-2-trace.json) 中，导航约 69ms 时，应用挂载回调读取 `window.scrollY`，强制计算页面样式与布局约 36.7ms；约在导航后 132ms，浏览器还要布局真实首页。改为在应用壳 DOM 尚未插入前读取初值，并沿用被动 scroll 监听；无样式、路由、图片和服务端改动。风险：顶部栏状态必须随实际滚动位置恢复。真实移动 Chromium 已验证进入馆藏回到页顶、返回首页保留滚动位置并收缩、回到页顶后展开。

候选 `index-BzGHrZkW.js` 的三次 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-header-preread-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-header-preread-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-header-preread-3.json) 同配置独立运行：LCP **2.72 / 2.71 / 2.72s**，TBT **52.5 / 41.5 / 53ms**，CLS **0 / 0 / 0**。检查三次原始 trace 中最终 LCP 前归因到 JS 调用栈的布局，未再观察到原挂载回调造成的额外同步布局。保留改动；LCP 中位 **2.72s** 比 §8.8 约快 51ms，仍高于 2.50s。真实正式入口仍需独立复测；公网 ready 在本轮仍为 `204 / 0 B`、`sleeping`。

生产构建、应用及 E2E 类型、构建预算、默认前端单测 **450/450**、隔离 Chromium E2E **36/36**、Impeccable changed detector 和 Git diff 空白检查均通过。另检查了 [390px 首页](../../artifacts/mobile-audit-2026-11-25/header-preread-screens/390x844.png) 与 [1440px 桌面](../../artifacts/mobile-audit-2026-11-25/header-preread-screens/1440x900.png) 的实际渲染。后端未改、未重跑后端单测及迁移门禁。

### 8.11 M06：补齐文创溯源与预约助手触点

目标及范围：N-03 / M06。隔离候选的触屏复扫复现了两处仍为 **36px 高**的独立操作：「问洛笙查可约时段」和商品图上的纹样溯源标签。只在粗指针设备将两者的实际边框盒扩大至至少 **44×44 CSS px**，复用共享尺寸令牌；不修改预约、向导、溯源的业务逻辑，不放大桌面细指针控件（1440px 实测仍均为 36px）。风险是近邻、商品图或吸顶栏遮挡，因此检查控件中心和四角内缩点，实际从热区边缘点按。

- [移动回归](../../frontend/e2e/mobile-remediation.e2e.ts) 在 320×529 中文竖屏、844×351 英文横屏验证：点按纹样标签打开抽屉且能关闭；点按预约助手打开洛笙并填入对应语言的问题，不发送。查看了 [窄屏商品标签](../../artifacts/mobile-audit-2026-11-25/touch-shop-320.png) 和 [横屏预约助手](../../artifacts/mobile-audit-2026-11-25/touch-appointment-844.png) 的实际渲染。
- 320×529 中文浅色、390×805 英文深色、844×351 英文浅色共 [39 个页面或展开状态](../../artifacts/mobile-audit-2026-11-25/touch-retest.json) 复扫，抽样范围内没有剩余的 44px 不足或居中滚动后的中心命中失败。扫描排除禁用、隐藏、仅在聚焦时出现的跳转入口、段落内联链接和展开弹层的背景，预约等待真实可选日期；不将此结果扩展至未抽样状态或 WCAG 2.2 AA 认证。
- 候选 `index-CDd7D50e.js`：生产构建、应用与 E2E 类型、首屏与配乐预算、默认前端单测 **450/450**、隔离 Chromium E2E **38/38**、Impeccable changed detector 均通过。三次同配置冷启动 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-m06-touch-final-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-m06-touch-final-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-m06-touch-final-3.json)：CLS 均为 0、TBT 中位 47ms、LCP 中位 **2.74s**，仍未达 2.50s，不能关闭 M04。
- 修改文件：[预约页](../../frontend/src/views/AppointmentView.vue)、[商城页](../../frontend/src/views/ShopView.vue)、[移动回归](../../frontend/e2e/mobile-remediation.e2e.ts)。无后端改动、未重跑后端及迁移门禁；本轮公网就绪仍报告 `204 / sleeping`，没有部署。真机触控、系统级字体缩放/读屏及外层平台验收未做。

### 8.12 M07：英文 200% 字号压力基线

目标及范围：N-03 / M07。用触屏 Chromium 保持同一 CSS 视口，将英文首页根字号从 **16px 提到 32px**，每次等待 computed size 变更后检查真实文本范围。普通字号下，320、375、390、844px 的品牌、导航控件和章节在此检查中均未越界。模拟放大后，320px 短品牌可用宽度约 6px、文字需要约 63px；375/390px 的短品牌与部分底栏标签也会截短或侵入相邻空间；844px 的两处章节标签越出章节行。此为 rem 布局压力复现，不等同于系统文字设置、浏览器页面缩放或读屏结果。

下一步需让品牌与操作区在实际空间不足时仍有可辨识名称、底栏标签有独立可读空间、章节随内容换行；同时验证常规字号的顶部栏、底部安全区和浮动按钮避让不退化。本轮仅取基线，未修改字体放大布局，也不据此关闭 M07。

### 8.13 M07：英文放大后的重排与跨引擎复验

目标及范围：N-03 / M07。只调整公共壳与首页文案的布局，不改路由、展品内容、字号令牌或操作。顶部小屏间距不随字号加倍；以品牌容器的可用空间选择长名/短名。底栏仅在容器容不下常规英文标签时使用短标签（Art / 3D / Visit），五个链接始终可用，可访问名称保留完整含义并包含可见词。首页封面编号与章节按词换行；极短横屏沿用原本用于窄屏的取舍，隐藏非交互的坐标与展品副标。风险：普通字号布局、滚动条占宽、触控和底栏与洛笙的避让。

- Chromium 和 Windows Playwright WebKit 均在根字号 16/32px 检查 320、375、390、430、844px 等 6 个视口各两档，未见所测品牌、底栏与章节文字越界；两个引擎在 320px 放大态均实点进入馆藏与预约。WebKit 首次在可见滚动条下发现品牌仍出现省略号，补余量后 320px 品牌文字宽与可用宽同为 65px。见 [320px WebKit](../../artifacts/mobile-audit-2026-11-25/webkit-200pct-home-en-320.png)、[844px Chromium](../../artifacts/mobile-audit-2026-11-25/chromium-200pct-home-en-844.png)。
- [移动回归](../../frontend/e2e/mobile-remediation.e2e.ts:140) 覆盖五种宽度和双主题：实测文本范围、各底栏链接/语言切换的 44px 热区与命中、320px 洛笙触点和真实路由点击。隔离 Chromium 移动、双语和业务场景 **39/39** 通过。生产构建、应用及 E2E 类型、首屏与配乐预算、Impeccable changed detector、Git diff 检查通过。
- 候选 `index-VGG93Lsy.js` 三次独立本地冷启动 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-m07-font-scale-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-m07-font-scale-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-m07-font-scale-3.json)：CLS 0/0/0、TBT 中位 42ms、LCP 中位 **2.73s**；与上一候选同一量级，M04 的 2.50s 门槛仍未通过。公网就绪仍为 204 / sleeping，未部署或写入生产。
- 修改文件：[公共壳模板](../../frontend/src/App.vue)、[公共壳样式](../../frontend/src/styles/05-shell.css)、[首页](../../frontend/src/views/HomeView.vue)、[移动回归](../../frontend/e2e/mobile-remediation.e2e.ts)。此检查是浏览器内根字号压力与合成点按；未验证手机系统级字体设置、iOS Safari 真机、系统放大、读屏及正式入口。

### 8.14 M04：合并移动首页首次布局实验

目标及范围：N-03 / M04。§8.13 的三份原始 trace 显示，封面传输完成后仍先布局公共壳，再布局完整首页；慢点不在封面传输。本次只调整窄屏、受限设备直接进入首页时的首次挂载顺序，等待已预载的首页路由，设短超时和失败回退以保留公共壳。其他路由和桌面的挂载策略不动，不使用替代封面。验证三次相同 Lighthouse 冷启动及首屏内容、导航、主题、慢请求回退；若无稳定改善则撤回实验。

- 候选 `index-WnzEiV01.js` 确实将 LCP 前两次主要文档布局并为一次，但三次同配置冷启动 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-mount-ready-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-mount-ready-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-mount-ready-3.json) 的 LCP 分别为 **2.735 / 2.731 / 2.729s**，中位 **2.731s**（原候选 2.729s）；TBT 中位从 **42ms** 增至 **70.5ms**，CLS 均为 0。实验未保留；不继续为撤回的路径扩展测试。
- 恢复 `index-VGG93Lsy.js`，对同一隔离服务另做 [浏览器实际限速诊断](../../artifacts/mobile-audit-2026-11-25/cdp-throttle-m07.json)：Chromium、412×823、DPR 1.75、禁用缓存，CDP 下行约 1.6Mbps、延迟参数 150ms、CPU 4× 降速。3 次冷启动由浏览器 PerformanceObserver 测得真实封面 LCP **1.936 / 1.884 / 1.904s**，未记录非输入引起的布局位移；封面响应约 0.81s 传完，共享入口 JS 约 1.05s 传完。两者都早于约 1.90s 的最终呈现，不能把剩余时间全归因于网络、Vue 或 GPU 中的某一项。这组是对 **本地 Chromium 的实际限速**，不是 Lighthouse Lantern 同配置模拟、实体手机或正式入口结果，不用于替代 M04 门禁。
- 恢复版的生产构建、应用类型、首屏与配乐预算通过；移动首页 6 条相关回归通过：慢路由预载和页脚位置、冷启动后底栏到商城、馆藏返回恢复滚动、资源不重复且不影响深链接、双主题英文放大、声景画布可见才加载。没有保留生产代码改动，本轮未重跑全量前后端门禁，未写入生产。下一步按共享入口脚本下载至封面呈现之间的真实依赖和任务分段，优先隔离非首屏模块；另需 PocketBay 只读信息与实体手机验收。

### 8.15 M04：首页移除非必要共享图标与入场纹样依赖

目标 N-03 / M04。基于与候选散列一致的 [Rollup 模块清单](../../artifacts/mobile-audit-2026-11-25/mobile-bundle-breakdown-m07.json)，HomeView 的三个图标引入了 20,698 B（构建后、HTTP 压缩前）的共享图标包，浏览器限速诊断实际传输约 5.8 KB；触屏首页也承担从不运行的完整动效纹样代码。只替换首页的装饰 SVG、把完整动效用纹样和 GSAP 一起按需加载，不更改公共入口、正文和按钮语义。验证资源瀑布、独立冷启动、双主题实景和桌面完整入场；风险是外观细节、桌面动效首次播放与首屏稳定性退化。

- 保留候选 `index-CVdHh779.js`。移动首页入口与首页必需 JS/CSS 的实际传输（同配置第 2 次 Lighthouse）由 **111,969 B 降至 105,469 B**，少一个共享图标包请求；其他路由仍可正常使用原图标库。移动首页不请求装饰纹样；桌面完整动效场景验证纹样下载、绘制后移除、同一会话返回不重复播放。资源下载失败时不运行入场，保留原有可见封面和操作。
- 同配置三次独立冷启动 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-home-local-icons-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-home-local-icons-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-home-local-icons-3.json)：LCP **2.656 / 2.619 / 2.654s**，中位 **2.654s**（较 §8.13 少约 75ms，仍未达 2.50s）；TBT **61.5 / 36 / 53ms**，中位 **53ms**，达标；CLS **0 / 0 / 0**，达标。未替换首屏图，三次的 LCP 节点仍为真实封面。
- 隔离 Chromium **40/40**，含移动、真实业务与双语；默认单测 **450/450**；应用及 E2E 类型、生产构建、首屏与配乐预算通过。Impeccable changed detector `[]`；实看 [390px 浅色](../../artifacts/mobile-audit-2026-11-25/home-local-icons-polish/390x844.png)、[390px 深色](../../artifacts/mobile-audit-2026-11-25/home-local-icons-polish/dark-mobile-390.png) 和 [1440px 桌面](../../artifacts/mobile-audit-2026-11-25/home-local-icons-polish/1440x900.png)，深色移动由首页链接实点进入预约。文件：[首页](../../frontend/src/views/HomeView.vue)、[首页图标](../../frontend/src/components/HomeActionIcon.vue)、[首次访问资源约束](../../frontend/src/test/MobileRouteRuntime.spec.ts)、[移动及桌面动效回归](../../frontend/e2e/mobile-remediation.e2e.ts)。本轮不改或重测后端及迁移。公开 ready 只读复查仍为 204 / sleeping，未部署；正式入口和真机无新增验收证据。

### 8.16 M09：暗房浏览器历史与背景滚动复验

目标 N-03 / M09。只验证并固定应用内行为，不改变路由或增设弹窗历史项。沿 320×529 视口「首页 → 馆藏 → 青铜鼎详情 → 高清暗房」点按进入；浏览器 Back 两次，依次到馆藏、首页；Forward 两次，依次到馆藏、详情。首次返回时卸载暗房、解除滚动锁，馆藏主区域获得焦点；前进回详情时暗房保持关闭，主区域获得焦点。开暗房前后历史长度不变。

- 在 390×844 等顶部栏完成收缩后记录非零滚动位置。用 Chromium 滚轮和 CDP 触摸滑动（从支持默认触摸滚动的暗房标题区开始），分别确认暗房开启时背景位置不变；Escape 关闭后原触发器重新聚焦、位置不变，再用滑动和滚轮确认页面可滚动。另一个独立场景验证 Tab/Shift+Tab、不可聚焦的背景、Escape 和点按关闭。CDP 滑动后立即混用 Playwright 点按的探查没有稳定关闭，未将组合场景标为通过；真机需复核滑动后立即点按关闭。
- [移动 E2E](../../frontend/e2e/mobile-remediation.e2e.ts) 三组暗房场景各重复三次 **9/9**；原候选 `index-CVdHh779.js` 的移动、业务及双语 Chromium 回归 **42/42**，E2E 类型检查和 `git diff --check` 通过。只加测试和记录，未改应用代码；未重跑应用构建、单测、性能或后端门禁。
- 公开 ready HEAD 仍为 **204 / sleeping / DYNAMIC**，未写入生产；ADB 未检测到连接设备。应用内历史不等同于 PocketBay 的外层浏览器历史。正式入口、真机手势与读屏仍待验证。

### 8.17 M04：触屏首页不启动桌面光标

目标 N-03 / M04。§8.15 的原始请求显示，窄屏粗指针仍下载 `PointerCursor`、指针共享状态和灯光预设；该设备上光标没有可用的悬停行为。仅调整[公共壳](../../frontend/src/App.vue)的按需装载：粗指针直接采用原有静态动效档，浏览器能力变化为精细指针且支持悬停时再启动桌面光标。封面、主题样式、文案、路由与展品组件不改。风险是外接鼠标的能力变化、全局动效档和桌面光标回归。

- 候选 `index-D6QjFWA_.js`：六次冷启动均以真实封面为 LCP 节点，不再请求 `PointerCursor`、`usePointerMotion`、`lightPreset`。按第 2 次网络清单比较，新增入口条件使必需 JS/CSS 增 75 B，移除 4,957 B 光标相关网络传输，合计少 **4,882 B**。同一隔离入口、同一 Lighthouse 13.4.1 移动配置，每次独立 Chrome profile。原始 trace 中应用启动后的 GPU 任务较多；删掉这组并发工作后，不能把全部时间差单独归因于传输字节。
- 第一组 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-coarse-static-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-coarse-static-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-coarse-static-3.json)：LCP **2.490 / 2.491 / 2.483s**，中位 **2.490s**（§8.15 为 2.654s）；TBT 中位 **40.5ms**。回归结束后独立复测 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-coarse-static-confirm-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-coarse-static-confirm-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-coarse-static-confirm-3.json)：LCP **2.483 / 2.487 / 2.485s**，中位 **2.485s**；TBT 中位 **45ms**。两组每次 CLS 均 **0**，无位移事件。本地门槛通过，LCP 余量仅约 10–15ms。
- [移动 E2E](../../frontend/e2e/mobile-remediation.e2e.ts) 验证粗指针不请求光标，Chromium CDP 改变指针能力后无需刷新可加载并显示桌面光标，切回粗指针恢复静态。隔离移动、真实业务与双语 **43/43**，默认 Vitest **450/450**，应用及 E2E 类型、生产构建、首屏及配乐预算、`git diff --check` 通过；Impeccable changed detector `[]`。实看 [390px 浅色](../../artifacts/mobile-audit-2026-11-25/coarse-static-polish/390x844.png)、[390px 深色触屏](../../artifacts/mobile-audit-2026-11-25/coarse-static-polish/dark-mobile-390.png) 和 [1440px 桌面](../../artifacts/mobile-audit-2026-11-25/coarse-static-polish/1440x900.png)，深色首页实点进入预约。浏览器能力模拟不等同于实体设备接入鼠标。
- 无后端或迁移变更，未重跑相关门禁，未部署。公网 ready 只读复查 **204 / sleeping / DYNAMIC**；生产版本、预约余量、外层路由与遮挡、正式入口性能、实体手机、软键盘及读屏尚无新增验收证据。

### 8.18 M08：应用内刷新、分享与历史往返

目标 N-03 / M08。仅添加[移动浏览器回归](../../frontend/e2e/mobile-remediation.e2e.ts:69)，不改路由、登录或平台集成。320×529 触屏 Chromium 实点底栏、馆藏专题、搜索结果与商城加购，进入分类、青铜搜索、青铜鼎详情、预约和带 `returnTo` 的登录。每个目标都在原窗口刷新，并将从实际导航捕获的地址放入新的独立浏览器上下文，确认 HTTP 200、页面内容和完整 URL 一致。覆盖分类的 `category` 与 `#collection-title`、中文 `q`、加购意图与内外层一致的 `productId`；输入假用户名和密码但不提交，地址保持不变。

- 浏览器从登录连续返回至商城、预约，再前进至商城、登录；每次实点跳转只增加一条历史，刷新及往返不增添记录，不产生循环。
- 同一候选 `index-D6QjFWA_.js` 在隔离 Vite/H2（4189）及 Spring Boot `pocketbay` profile 内嵌前端/H2（4191）各独立重复 **3/3**。打包入口另确认本地 readiness UP、HTML 与构建一致、gzip 与静态资源缓存、GLB Range 206、未知路由 404（Vue 外壳）。隔离 Vite 入口的移动、真实业务及双语 [Chromium 回归](../../artifacts/sitewide-quality/business-results.json) **44/44**，E2E 类型及 Git 空白检查通过。
- 本轮不重建前端、不重跑单测、后端单测、迁移或性能门禁；未部署或写入生产。Spring profile 的本地打包检验不含 PocketBay 外层。生产宿主的深链接、返回、遮挡与真机仍待验，M08 不关闭。

### 8.19 阶段 D：文创溯源抽屉键盘复验

目标 N-03 / F-09。对候选 index-D6QjFWA_.js 的 40 个基础及展开状态扫描 WCAG 2.2 AA 及之前的 A/AA 规则，英文双主题商城溯源正文两次命中严重级 scrollable-region-focusable。正文滚动区依赖异步资料加载后才出现的外链；接口失败时无可聚焦内容。新增浏览器回归在旧候选确认：键盘打开后，关闭按钮未获得焦点。

仅修复商城溯源抽屉和回归：使用已有暗房的原生模态方式，正文自身加入带可访问名称的焦点位置；打开、正反 Tab、正文滚动、Escape、回焦和触控关闭分别验证。保留资料接口及回退、手账、加购和跳转。关注原生 top layer 对退出淡化、背景滚动、横屏与商城导航的影响。

- 候选 index--ND1OdHf.js：原生模态阻止背景取焦，关闭按钮初始聚焦，正文可独立聚焦并按 End 滚动，正反 Tab 各八次留在抽屉内，Escape 回到发起按钮；320px 和 844px 合成触屏的纹样入口与关闭动作通过。隔离 Chromium 的移动、真实业务及双语回归 **45/45**，应用和 E2E 类型、生产构建、双资源预算及 Impeccable changed detector 通过。
- 用 axe 4.13.0 检查中文/英文×浅/深主题，涵盖基础页面以及短屏洛笙、购物袋、溯源（资料成功与失败）、高清暗房，共 [44 个状态](../../artifacts/mobile-audit-2026-11-25/release-accessibility-index--ND1OdHf.json)，所测 WCAG A/AA 规则 **0 violations**。实看[英文深色溯源](../../artifacts/mobile-audit-2026-11-25/index--ND1OdHf-provenance-dark-en-US.png)。图片和半透明层对比度、关闭时延迟挂载的音频面板 ARIA 引用仍有 axe 自动检查无法判断的条目，不作为 WCAG 合规证明。
- Chromium 和 Windows WebKit 各在 320×529、390×421、844×351 读取搜索、用户名、密码、预约月份、洛笙输入的计算字号，共 **30/30 为 16px**，viewport 未禁用用户缩放。此为样式门槛，不是 Safari 真机的聚焦缩放或系统键盘结果。ADB 本轮未发现连接设备。未改后端、迁移、宿主或生产数据，也未重跑后端及迁移专项。
- 默认前端 Vitest 与浏览器检查并行时 **448/450**，两个 `ThreeExhibitViewer.spec.ts` 时序用例失败（取消待构建点云后重试、加载帧不参与质量选择）；独立执行 `pnpm test --maxWorkers=1` 后 **81/81 文件、450/450 用例通过**。未为通过复测更改 3D 实现、断言或超时；不把独立通过解释为并行不稳定性已修复。审查本次溯源修改差异，受追踪文件 `git diff --check` 无错误。
- 在单测结束后，同一候选独立运行三次 Lighthouse 13.4.1 移动冷启动：[第 1 次](../../artifacts/mobile-audit-2026-11-25/lh-retest-release-provenance-1.json)、[第 2 次](../../artifacts/mobile-audit-2026-11-25/lh-retest-release-provenance-2.json)、[第 3 次](../../artifacts/mobile-audit-2026-11-25/lh-retest-release-provenance-3.json)。LCP **2.594 / 2.467 / 2.453s**（中位 **2.467s**），TBT **247 / 92 / 131.5ms**（中位 **131.5ms**），CLS 三次均 **0**，无位移事件。三次网络清单均确认最新 JS 和一次高优先级首页封面请求，无桌面光标相关请求；真实封面为 LCP 节点。第 1 次 LCP 和 TBT 超过目标数值，按约定的中位数判据，本地门槛通过；正式入口尚未测得。
- 正式外层入口的首页、`/api/v1/ready` 和带日期的公开预约查询复查均返回 **204 / 0 B / sleeping / DYNAMIC**。未确认源站运行版本及预约余量，不关闭 M01；宿主浮层与外层历史（M03/M08）、正式入口性能、实体 iOS/Android/微信、真实键盘和手势、读屏及未决对比度仍待验。下一步是 §8.1 的授权只读核对，未发布、提交或推送。

### 8.20 阶段 D：图片对比度与声景展开语义

目标 N-03。对 §8.19 的 axe 不确定项进行定点复验：用实际建筑照片和浏览器合成后的文字位置采样，对照普通文字 4.5:1、大字 3:1；对声景分别核对关闭、键盘打开、Escape 关闭的引用关系与焦点。只修复可复现问题，限制影响在登录图像文案和声景触发按钮，保留照片、表单流程、声景设置行为及懒挂载。主要风险是过度压暗建筑主体、移动裁切变化及披露行为被误当成菜单；在中英双主题竖屏、横屏和桌面复验。

- **P1 · 登录照片上的文字对比度（WCAG 1.4.3）**：旧候选在四种宽高采样中，小标题有多处不足 4.5:1；320px 英文浅色最差约 **1.07:1**，大标题约 **1.92:1**（门槛 3:1）。[登录样式](../../frontend/src/views/LoginView.vue:475) 把局部渐暗层固定在文案下方，不用固定图片坐标，不改变表单尺寸、图片或文案。实际查看修复前后 [320px 浅色](../../artifacts/mobile-audit-2026-11-25/index-DrY4tgTD.js-light-login-320x529.png)、[844px 深色 WebKit](../../artifacts/mobile-audit-2026-11-25/index-DrY4tgTD.js-webkit-dark-login-844x351.png) 与桌面。
- 最新候选 `index-DrY4tgTD.js`，Chromium 320×529、390×805、844×351、1440×900 及 Windows WebKit 320×529、844×351，各跑中英、浅深。登录小标题/大标题在采样中的最小值分别为 **6.96:1 / 10.76:1**；含其他页面的代表性文字共 **96 个可见样本**均过对应阈值，20 个移动上隐藏的桌面列表文字未计入。复验按字形位置采已合成的背景像素，用原始前景色计算对比度，不把抗锯齿边缘当作前景；是抽样而非全站 WCAG 签核。[主报告含其他页面抽样和声景](../../artifacts/mobile-audit-2026-11-25/release-manual-a11y-index-DrY4tgTD.json)、[320px Chromium](../../artifacts/mobile-audit-2026-11-25/release-manual-a11y-index-DrY4tgTD-login-320x529.json)、[320px WebKit](../../artifacts/mobile-audit-2026-11-25/release-manual-a11y-index-DrY4tgTD-webkit-login-320x529.json)。
- **P2 · 声景披露的 ARIA 引用**：旧构建的新 E2E 因关闭时仍引用未挂载的 ID 而失败，展开内容实际是设置分组，不是菜单。[声景按钮](../../frontend/src/components/AudioControl.vue:169) 保留 `aria-expanded`，只在展开时提供 `aria-controls`，移除菜单声明。四种语言/主题的键盘打开、首控件聚焦、Escape 回焦及展开状态 axe 均通过；[单测](../../frontend/src/components/AudioControl.spec.ts:84) **11/11**，新增[移动 E2E](../../frontend/e2e/mobile-remediation.e2e.ts:385) 在新构建通过。隔离 Chromium 移动、业务、双语合计 **46/46**；[整批 axe](../../artifacts/mobile-audit-2026-11-25/release-accessibility-index-DrY4tgTD.json) 44 个状态无 violations，`aria-valid-attr-value` 不再出现为不确定项，未抽样的复杂背景对比度仍需人工核查；双引擎 30 个输入字号样本仍通过 16px 门槛。
- 全量 Vitest 首轮 **449/450**，登录主题契约拒绝渐变遮罩中的十六进制写法。改用现有的不透明 `--ink-on-dark` 字色变量作为遮罩 alpha 的实色端，保留透明度和颜色合成，未放宽测试。最终构建与首次修复的 320×529 浅色渲染截图 SHA-256 一致。独立重跑 **81/81 文件、450/450 用例**通过。
- 应用与 E2E 类型、启用洛笙的生产构建、首屏与配乐预算、Impeccable changed detector、受追踪文件空白检查通过。最终构建本地 Lighthouse 13.4.1 三次冷启动 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-release-login-audio-tokens-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-release-login-audio-tokens-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-release-login-audio-tokens-3.json) 的 LCP **2.476 / 2.507 / 2.490s**，TBT **109 / 58 / 54ms**，CLS **0 / 0 / 0**。三次均以封面为 LCP，封面高优先级、只请求一次；未请求登录路由资源或桌面光标，无位移事件。按中位数通过本地门槛，LCP 余量约 10ms，有一次超过 2.50s。
- 正式首页、就绪接口和带日期的时段查询仍为 `204 / 0 B / sleeping / DYNAMIC`。ADB 未发现设备。未改后端、迁移或平台配置，未重跑后端专项，未发布。M01、M03、M08、正式入口性能与真机（含微信、读屏、软键盘、真实手势）均未关闭；诊断仍需要 §8.1 的授权只读证据。

### 8.21 公开入口冷启动及外层路由诊断

2026-11-26 延续执行，仅使用公开访客入口，不登录、不提交业务表单、不发送反馈、不调用平台唤醒或管理接口。初始 HTTP HEAD 只读复查 `/`、`/api/v1/ready` 及 2026-11-26 至 2026-12-03 的预约时段查询均为 `204 / 0 B / sleeping / DYNAMIC`；这些响应不能说明源站健康、版本或数据。Android Debug Bridge 当前也未列出连接设备。

随后在隔离访客浏览器中直接打开正式公网首页，页面显示 PocketBay 外层 shell 与“正在唤醒应用”；约数秒后自动进入内嵌首页，未点击“唤醒并继续”控件。真实 DOM 显示 `pb-host-frame` iframe 承载应用，宿主地址仍为 `https://heluo.pocketbay.app/`，内层首页是 `https://heluo--e.pocketbay.app/`。这证明本次访客浏览器有一条无需交互的短时进入路径，**不**证明其他访客可用、冷启动 SLA、应用/部署版本与公开 HTTP 204 的根因，也未取得 PocketBay 的运行日志或时段聚合。

尝试通过该真实页面的业务分类链接实点检验外层 URL 同步，但当前浏览器交互通道未能将页面 hit-test 稳定定位到 iframe 链接（AX/DOM 可读、点击返回 target no longer available）；没有使用脚本伪造点击或绕开宿主。故不能据此记录 M08 的公网同步通过或失败。用户手势、软键盘、微信、读屏、性能、M03 浮层关闭热区与 M01 公网数据仍未验收。未修改生产源码、生产数据、平台配置或发布状态；§8.1 的授权只读状态/日志及汇总证据仍是 M01 根因诊断入口。

### 8.22 手势取消后的合成触控恢复专项

既有源码已为图纹石板舞台和罗盘监听 `pointercancel`，但此前移动端回归没有直接证明取消后不会残留拖动态。本地 H2 隔离入口新增独立浏览器专项 [touch-cancel-recovery.e2e.ts](../../frontend/e2e/touch-cancel-recovery.e2e.ts)：在运行中的图纹石板罗盘合成 touch pointerdown/move/cancel，确认取消后迟到的 move 不改变方位读数，再开始下一次手势确认读数恢复更新。新用例 **1/1 通过**，E2E TypeScript 检查通过；不修改应用行为或现有回归文件。此为 DOM/浏览器合成事件证据，不替代真机操作系统手势取消、纵向滚动争用或设备触摸验收。未重跑完整 46 项 E2E、全量单测、后端/迁移、axe 或性能门禁；生产与宿主缺口保持未关闭。

### 8.23 公网就绪与预约可用性复核

2026-11-26 再次走公开访客入口，外层启动后无需手动唤醒即挂载首页。随后匿名 `GET /` 返回 **200**，`GET /api/v1/ready` 返回 **200 / data.status=UP**；这与 §8.21 早些时候的 `204 / sleeping` 是不同观测。预约查询的 HEAD 返回 401；接口契约为 GET，按 GET 判定访客可用性。

`GET /api/v1/appointment-slots` 指定 2026-11-26 至 2026-12-02、2026-12-25、2027-11-25（三个含首尾的 7/30/365 日窗口），均返回 **200 / data: []**。M01 因此在应用就绪时仍可复现，不是单凭休眠响应推断。公开接口只展示尚未开始且开放、有余量的时段，不能区分数据库缺行、关闭、满额或时间过滤；仍按 §8.1 核实 #329 活动版本、业务时区、初始化开关和按状态/余量汇总，不盲目补种。

应用内首页可读，但当前浏览器通道对 iframe 的点击与键盘激活均报目标不可用，未获得 M08 新结论。未访问后台、提交表单、执行显式唤醒、写生产数据或发布；ADB 未列出设备。M03/M08、正式性能、真机与读屏仍待验。本轮仅新增公开只读诊断证据，未改代码或重跑本地构建及回归。

### 8.24 M08：在正式入口复现外层地址与刷新丢失

2026-11-26 改用桌面 Chrome 扩展的临时标签，仅操作公开页面。等 PocketBay 启动画面退出后，用真实点击进入馆藏、首页青铜分类、馆藏专题锚点、热门词「青铜」与预约。五次可确认导航中，外层始终为 `https://heluo.pocketbay.app/`；`pb-host-frame` 内层分别为 `/explore`、`/explore?category=BRONZE`、`/explore?category=BRONZE#collection-title`、`/explore?q=%E9%9D%92%E9%93%9C`、`/appointment`。首个馆藏导航后实际刷新外层，内层回到首页；因此复制当时的外层地址也不能表达馆藏目标。本次确认 M08 **仍存在**，不是此前内置浏览器点击通道失效造成的假象。

真实 iframe 首页入口脚本是 `index-DVvv2KEz.js`；本地候选构建的入口是 `index-DrY4tgTD.js`。两者指纹不同，不能把本次公网结果算作本地候选的发布验收，也不能用本地路由回归替代宿主证据。器物详情点击后的导航未等到稳定读数；前进/后退往返超时，不据此判定浏览器历史失效。尚未完成新窗口分享、登录 `returnTo`、M03 浮层、正式性能与真机复验。未登录、提交业务表单、修改平台设置或发布。下一步需核实 PocketBay 是否有受支持的外层路由同步能力；没有宿主接收协议前不在应用侧引入猜测的消息桥。

### 8.25 M03：正式入口反馈热区与高清暗房命中

2026-11-26 用桌面 Chrome 窄视口走正式入口。以浏览器实际报告的 **390×844 CSS px** 为准；加载 3D 和暗房时，iframe 内 `documentElement.clientWidth` 约为 377px。初始显示折叠条，本轮没有复现自动展开。实点「展开反馈」后，立即反馈按钮 **60×25px**，收起按钮 **18×18px**，两者中心均命中自身或子元素；收起后，展开条只有 **12×40px**。在折叠容器 **60×40px** 的横向六个采样点中，靠左五个命中宿主容器，最右一个命中展开条；可见细条以外的容器也会拦截落点，不是扩大的按钮热区。两种状态均不满足项目 44px 目标。

从首页实点进入青铜鼎互动 3D 和器物详情，并打开高清暗房。反馈按钮中心 `(360.5, 662.4)` 在 3D 外层命中反馈，iframe 同一坐标命中 `SECTION`，不据此判定某个 3D 控件无法点按。在高清暗房，外层同一坐标命中宿主反馈按钮，内层则命中暗房图片，确认反馈覆盖了暗房内容。实点收起及关闭暗房成功，恢复视口；未打开反馈表单、提交反馈、改宿主设置或隐藏节点。

M03 仍未关闭。需核对 PocketBay 是否提供调整热区、取消自动提示或避让应用浮层的受支持设置；若不提供，记录宿主限制并由用户决定是否评估替代正式入口。表单、购物袋、真机和截图证据尚未补齐，本轮无应用改动，未重跑本地门禁。

### 8.26 M04：当前线上版本三次独立冷缓存基线

2026-11-26 00:31–00:32（Asia/Shanghai），只从正式地址 `https://heluo.pocketbay.app/` 导航。Lighthouse 13.4.1、Headless Chrome 157、每次全新 profile、三次串行；与 §2 公网基线采用同一移动模拟（412×823、DPR 1.75、150ms RTT、约 1.6 Mbps、4× CPU 模拟）。不控制服务端休眠或 CDN 状态，因此是浏览器冷缓存，不是三次独立服务器唤醒。三次外层与 iframe 首页文档均 `200`，均下载线上 `index-DVvv2KEz.js` 和真实首页封面，无显式唤醒或生产写入。

| 报告 | 外层 LCP（模拟） | TBT（模拟） | CLS | 内层封面候选（原始 trace） |
| --- | ---: | ---: | ---: | ---: |
| [第 1 次](../../artifacts/mobile-audit-2026-11-25/production-retest-1795624299920/run-1.json) | 1.503s | 152.5ms | 0.874848 | 7.012s |
| [第 2 次](../../artifacts/mobile-audit-2026-11-25/production-retest-1795624299920/run-2.json) | 2.738s | 118ms | 0.874848 | 7.756s |
| [第 3 次](../../artifacts/mobile-audit-2026-11-25/production-retest-1795624299920/run-3.json) | 2.941s | 146.5ms | 0.874848 | 7.284s |

**M04 公网未通过**：CLS 三次超过 0.1，主位移均归因 `footer.site-footer`，发生在应用 iframe 内；外层也有小位移，但不是这次大幅跳动的来源。外层 LCP 中位 2.738s 超过 2.5s，TBT 中位 146.5ms 在 200ms 以内。三次外层 LCP 节点均为启动壳的 `img.pb-word`；原始 trace 另在 iframe 记录到 `img.corridor-home__hero-media` 大图候选，上表最后一列是该候选相对外层导航的原始时间，不是 Lighthouse 模拟值或用户首次可操作时长。不能将其与本地候选的封面 LCP 直接作数值前后对比。[网络与 trace 摘要](../../artifacts/mobile-audit-2026-11-25/production-retest-1795624299920/summary.json)。

本轮未改应用、配置或生产数据，未部署、未重跑本地门禁。`index-DrY4tgTD.js` 上线后仍需从同一正式入口重复三次，对照构建、外层节点和 iframe 封面，复核位移来源；真机首次可操作时间与 INP 另测。

### 8.27 M08：器物详情分享与浏览器历史往返

2026-11-26 在 Chrome 桌面访客路径测试已发布的 `index-DVvv2KEz.js`。从首页点击「阅读青铜鼎故事」，等详情标题出现后读取地址：内层为 `/artifacts/heluo-bronze-ding`，外层仍为 `https://heluo.pocketbay.app/`。用实际读取的外层地址在同一浏览器的新标签打开，加载完成后内层为 `/`，原标签仍停在详情。确认实际分享外层地址不能还原器物位置；新标签不是新的浏览器 profile。

原标签实点主导航「河洛文创」，从游客购物袋的「前往登录」进入，确认内层为 `/login?returnTo=/shop` 且登录表单出现，外层仍为 `/`。浏览器**返回一次**恢复内层 `/shop`，**前进一步**恢复完整 `/login?returnTo=/shop`，外层始终为 `/`。这条会话内历史往返可用，不能将外层地址与分享错误泛化成浏览器历史完全失效。没有输入凭据、登录、加购、下单、调用管理接口或改配置。

M08 不关闭：宿主 URL 仍不表达内层路径或参数。未做实际登录后回跳、带具体商品的 `returnTo`、跨浏览器历史或实体手机验收；宿主支持机制仍未知。未改代码、未发布、未重跑本地门禁。

### 8.28 M01：可在授权环境运行的只读诊断

交付 [MySQL 8 聚合查询](../testing/appointment-availability-diagnostics.sql)。授权运维人员在活动应用实际使用的博物馆 schema，用已有 `SELECT` 权限执行；只需回传三个聚合行、同期的应用版本及业务时间、`MUSEUM_BOOTSTRAP_ENABLED` 的布尔状态，以及去敏后的启动/数据库错误摘要。查询不访问 `appointments` 或用户表，不输出时段 ID 或任何联系人信息；不要分享账号、连接串、环境变量清单或完整日志。本地代码明确使用 `Asia/Shanghai`；SQL 从数据库 UTC 时钟换算 UTC+8，不能替代活动应用时钟。若活动应用使用其他数据存储，请提供同口径聚合，不对非 MySQL 环境硬跑脚本。

- `total_slots=0`：只说明该窗口没有时段，不说明历史表为空；先核对活动 schema、版本和时钟。若证明确实缺未来库存，再确认运营排班和只补缺口的授权。
- `total_slots>0`、`public_slots=0`：用关闭、取消、已开始、未开始但满额的互斥分类确认原因。今天恰好到开始时间归入已开始。保留馆员关闭、取消和已有预约，不自动覆盖。
- `public_slots>0` 且同时间、同范围的公开 GET 仍为空：先核对 SQL 与访问的活动实例是否同库、时钟是否一致、上游是否休眠或用了不同的筛选版本；不要先写入时段。

隔离 MySQL **8.4.11** 使用 V1/V3 表定义与只授予 `appointment_slots` SELECT 的夹具账号验证。原 SQL 对空表返回三个零值行；固定业务时刻与合成数据验证窗口首尾、已开始（含恰好开始）、关闭、取消、满额、剩余人数。7/30/365 天分别 7/9/11 个时段，其中公开可约 **2/4/6**、余量 **12/29/36**，与直接复现公开接口筛选的对照查询一致。隔离容器已停止。未连接生产、未改代码/迁移配置或启用初始化器，未重跑业务回归；M01 需实际聚合返回后才能定因。

### 8.29 M08：完整外层深链接可直达，站内跳转仍不更新

2026-11-26 Chrome 公开访客复验，线上入口 `index-DVvv2KEz.js`：

- 直接打开正式外层 `/explore?category=BRONZE#collection-title`，内层保留完整路径、查询和锚点，青铜礼器筛选激活，显示 3 条器物。实刷外层后，内外地址与分类不变；等页面就绪，内层滚动约 100px，锚点位于视口上沿下约 58px（刚刷新时滚动尚未恢复）。
- 以馆藏中可见的青铜鼎详情链接构造同域正式外层路径 `/artifacts/heluo-bronze-ding`，直达和刷新均进入对应器物详情。随后实点主导航「预约参观」，内层变为 `/appointment`，外层停留在旧的器物路径；实际刷新回到青铜鼎详情，而非总是回首页。

结论：已知完整正式地址可以直接分享与刷新，宿主能将外层路径、查询和锚点传给内层；**从应用内跳转后，外层可能还是上一个页面的有效地址**，M08 不关闭。这是传递方向的区分，不证明存在受支持的内层到外层同步协议。未修改平台、应用代码或发布状态，未登录、提交数据或重跑本地门禁；其他参数组合、登录实际回跳及真机仍待验。

### 8.30 M01：默认 PocketBay H2 诊断路径

当前 [`pocketbay` profile](../../backend/src/main/resources/application-pocketbay.yml) 默认 H2 文件库，项目历史部署也使用 `/data/museum.mv.db`；这不是当前活动实例未覆盖数据源的证明。请运维先在 #329 核对驱动类型和活动版本，不发送 JDBC 地址或凭据。若为 MySQL，沿用 §8.28；若为 H2，使用[同口径 H2 聚合 SQL](../testing/appointment-availability-diagnostics-h2.sql)。SQL 针对同一时刻显式输出 UTC 和 `Asia/Shanghai`，不依赖 JDBC 会话或 JVM 默认时区。

嵌入式 H2 不应由第二个 JVM 打开正在运行的应用数据库。只有平台已授权并支持的一致性快照才可用于此核对；在受控环境用匹配活动实例的 H2 版本对快照只读打开（JDBC **设置** `IFEXISTS=TRUE;ACCESS_MODE_DATA=r`），不要直连在线文件、禁锁、热复制数据文件、开启 H2 控制台或把快照发到聊天。记录快照时间与聚合执行时间；若跨日或其间时段有变化，不能把该汇总直接与实时 GET 逐项对照。没有支持的快照或权限时，由平台运维执行等价的只读汇总。

用候选 JAR 同版 H2 **2.3.232**、独立文件库、实际 V1/V3 表和 `SELECT` 权限验证。把会话设为 UTC−05:00，仍输出准确的 UTC／上海时间及窗口日期。空表 3 个零值行，合成数据的可约数 **2/4/6**、余量 **12/29/36** 与 MySQL 同夹具一致；快照只读模式拒绝写操作。未访问任何生产文件或执行生产查询，未改运行时或重跑业务回归；M01 仍需活动数据结果。

### 8.31 根目录 Dockerfile 候选镜像验收

2026-11-26 使用根目录生产 `Dockerfile`（构建时 `VITE_GUIDE_ENABLED=true`）生成本地镜像 `heluo-mobile-audit-release:20261126`，镜像 ID `sha256:b0ec01d2a7bd45874573c2ba3d39f8fcf82e3609948b82963ed53c9960ba8c48`。实际 HTTP 返回的 `index-DrY4tgTD.js` 与 §8.20 本地候选文件同 SHA-256：`4260ec13a0389285adfe89729c26c3a522c277df12b34cefe0f75ef9c65ca259`。

实际镜像入口以 `127.0.0.1:4194` 运行，使用新建 tmpfs H2、临时测试账号，仅对该夹具启用初始化。洛笙开启，外部模型和 SMTP 关闭。HTTP 验证：ready `UP`、洛笙启用 meta、公开返回 **1,252** 个可约夹具时段、带哈希的 JS 使用 gzip 与 immutable 缓存、GLB 的 32 字节范围请求返回 `206`、站内深链接 `200`、未知 SPA 路径 `404`。测试容器已停止并确认退出。

| 验证 | 结果 |
| --- | --- |
| [移动修复、触控取消及业务流程](../../artifacts/sitewide-quality/business-pocketbay-results.json) | **36/36**，含隔离预约和商城模拟支付流程 |
| [双语、权限与统计、订单并发、预约交互](../../artifacts/mobile-audit-2026-11-25/docker-4194-complementary-results.json) | 首轮 **15/18**；前三类均通过，预约交互三项因旧的 14 天断言和「参与人数」定位失败 |
| [预约交互专项复验](../../artifacts/mobile-audit-2026-11-25/docker-4194-appointment-retest.json) | **3/3**；断言改为逐日校验当前上海月份，定位使用「同行人数」，保留双主题对比度、24 组多端布局、移动表单回焦及登录后提交检查；E2E 类型检查通过 |

合计 **54 个不同用例均有通过记录**，不是一次 54/54 全绿；只更新预约 E2E 断言，未改运行时代码。未使用生产凭据、数据或服务，未部署。夹具可约不能替代 M01 活动实例聚合；本次没有验证 PocketBay 反馈浮层、外层路由同步、同一公网入口的候选性能或实体设备，M01、M03、M04、M08 均不关闭。

### 8.32 M01：移动预约余量竞争与改选

在 §8.31 同一镜像的新建隔离 H2 中，通过管理 API 创建下月两个各有 2 个名额的时段。第一位访客在 390×844 视口选时段、打开表单并填写同行人数及手机号；第二位访客先提交并占满原时段。公开 API 不再返回该时段、仍返回替代时段。第一位访客从原表单提交得到 **HTTP 409**，显示名额提示，保留手机号和同行人数，个人记录仍为 0；关闭抽屉、重新选择同日另一个时段后可保留输入并成功提交。个人记录只有新时段对应的 1 条记录，公开查询也不再展示已用尽的替代时段。

[同次隔离回归](../../artifacts/mobile-audit-2026-11-25/docker-4194-appointment-capacity.json) **3/3**（登录续填和管理员确认、余量抢完后的改约、响应丢失后的幂等恢复）；E2E TypeScript 和目标差异检查通过。只新增测试，测试容器已停止，未改运行时、生产数据或发布。此结果验证方案 §6 的「余量不足」真实 API 路径，不解释公网何以没有可约时段。

同轮只读核对 [PocketBay 公开部署协议 v2.2](https://pocketbay.com/deploy)（HTTP 200）。该文档说明部署、配对和诊断流程，没有给出反馈浮层配置或应用到外层的路由同步接口；这只表示公开协议未说明，不能断言平台不支持。未访问控制台或使用设备凭据。ADB 设备列表为空，真机门禁保持未验。

### 8.33 M03：正式入口购物袋与登录表单命中

无头 Chrome 等待 iframe 超时，普通公开 HTTP 同期返回 204 / sleeping。桌面 Chrome 访客测试标签打开同一入口后，从「正在唤醒应用」自动进入馆内，无显式唤醒。实测外层 **390×844 CSS px**，线上 iframe 入口仍是 `index-DVvv2KEz.js`；这是窄视口桌面输入，不是实体设备或触控合成。

| 公开访客路径 | 结果 |
| --- | --- |
| 首页 → 底栏文创 → 打开购物袋 | 袋子稳定展开后，关闭按钮与「前往登录」各为 44px 高。每个控件各取九点；反馈展开、折叠态均为 18/18 落到应用 iframe。展开态实点关闭并重开，折叠态实点「前往登录」进入 `/login?returnTo=/shop`。仅覆盖空袋访客状态，不代表有商品或结算态。 |
| 登录初始位置及键盘进入提交按钮 | 用户名中心实点可获得焦点；Tab 可从显示密码到登录按钮并滚动使其可见。初始位置提交按钮部分低于视口，未把视口外采样点记为宿主拦截。 |
| 登录页向下滚动约 67px | 用户名框与宿主透明容器产生约 **9.5×16.7px** 的重叠。外层坐标 **(335.3, 643.3)** 在反馈展开和折叠时都命中 `div#pb-host-widget`，内层同点命中用户名输入框。折叠态实点该右缘不聚焦，实点输入框中心可聚焦。反馈条视觉上位于右侧，实际抢占范围更宽。 |

**M03 仍未关闭**：此次确认宿主不仅覆盖暗房内容，也会拦住表单输入框的部分点击，但不等于整个表单或访客空袋被阻断。请平台核实能否让反馈容器仅在可见控件处接收指针、提供符合要求的热区，或在应用浮层打开时避让。未访问登录态购物袋、结算或预约表单，未输入凭据、提交任何表单、发反馈或改宿主设置；已恢复测试视口并关闭临时标签。无应用改动、未发布、未重跑本地门禁；真实软键盘、手势及真机仍待验。

### 8.34 M02：合成中文输入法按键与多行草稿

需求 N-03 / M02。补测多行输入和横竖屏时，§8.31 旧候选复现：`isComposing=true` 时 Enter 不发送，但 Escape 会从抽屉局部监听直接关闭，绕过已有的全局组合态保护。修复范围限洛笙组件的 Escape 处理，复用已有全局守卫，保留普通 Escape、关闭按钮和回焦；不改 API、模型、外部服务、视口策略或样式。验收包括组合态不发送不关闭、Shift+Enter 留换行、横竖屏切换保留草稿与命中热区、普通 Escape 回焦。真实系统键盘仍需实体设备。

- [旧 Docker 候选反证](../../artifacts/mobile-audit-2026-11-25/guide-ime-before.json)：新用例因组合态 Escape 关闭抽屉失败。
- [新版生产构建预览复验](../../artifacts/mobile-audit-2026-11-25/guide-ime-after.json)：`index-C55jEvYj.js`，Chromium 短屏及组合态两项 **2/2**。组合态 Enter/Escape 保持输入焦点和两行草稿，不产生聊天请求；390×421 → 844×351 → 390×421 → 390×805 切换后可命中输入/发送/关闭按钮的中心与四角，普通 Escape 关闭并回焦。
- 默认前端单测 **450/450**、应用和 E2E 类型、生产构建、移动首屏 JS/CSS 与音频预算通过；Impeccable 目标文件未检出规则问题。预览与旧候选隔离容器已停止。仅合成 `isComposing` 事件和改变布局视口，不代表真实系统输入法、软键盘、刘海安全区或 Safari。此处是预览结果；新指纹的 Docker 验收与冷启动见 §8.35，§8.31 的证据仍对应旧指纹。

### 8.35 同一 Docker 候选的全量回归与冷启动

2026-11-26，使用根目录生产 `Dockerfile`、`VITE_GUIDE_ENABLED=true` 重新构建包含 §8.34 修复的镜像 `heluo-mobile-audit-release:20261126-ime`，镜像 ID 为 `sha256:eea16ff3f488c263160cb73d9ee5773592fac7c49f00af8a9cbb2fdd66113a2b`。回环入口 `127.0.0.1:4196` 使用全新 tmpfs H2 和临时夹具账户；外部模型及 SMTP 关闭。实际 HTTP 入口 `index-C55jEvYj.js` 与本地构建文件 SHA-256 一致：`b739ed2e0aa3cd721c34f931f2ee32f56309372d5e0c5fb86a2bfde039e71129`。

- HTTP 检查通过：ready 为 `UP`、洛笙启用 meta 存在、未来 7/30/365 天匿名查询分别返回 **24/104/1,252** 个可约夹具时段；入口 JS 有 gzip 和 immutable 缓存、移动 GLB 的 32 字节范围请求为 `206`、青铜鼎详情直达为 `200`、未知路由为 `404`。
- [Chromium 浏览器/API 全量回归](../../artifacts/mobile-audit-2026-11-25/docker-4196-full-results.json)同一次执行 **56/56**，无跳过、失败或重试。覆盖预约余量竞争和改选、幂等恢复、商城模拟支付、后台维护与权限、双语、3D/触控取消，以及洛笙短屏和合成输入法组合键。
- E2E 结束后，同一容器依次用三个全新 Chrome profile 运行 Lighthouse 13.4.1（移动 412×823、DPR 1.75、模拟限速）。三份报告均请求新入口，测得的 LCP 节点为馆首页封面 `img.corridor-home__hero-media`。

| 冷启动报告 | LCP | TBT | CLS |
| --- | ---: | ---: | ---: |
| [第 1 次](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4196-ime-1.json) | 2.463s | 33.5ms | 0 |
| [第 2 次](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4196-ime-2.json) | 2.537s | 39ms | 0 |
| [第 3 次](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4196-ime-3.json) | 2.469s | 37ms | 0 |
| 中位数 | **2.469s** | **37ms** | **0** |

应用内实验室门槛通过（LCP 中位 ≤2.50s、TBT 中位 ≤200ms、每次 CLS ≤0.1）；单次 LCP 仍超过 2.50s，中位数余量约 31ms，不作稳定余量或公网性能承诺。隔离容器已停止并确认退出；该轮未改运行时代码，未重跑单测、迁移或 Windows WebKit。未发布、未写生产数据或配置；不关闭公网预约 M01、宿主浮层 M03、正式入口性能 M04、外层路由 M08，实体手机、真实键盘和读屏仍未验。下一步先由 PocketBay #329 授权运维按 §8.30 返回去敏聚合并确认宿主支持范围，再安排受授权的发布与同入口复验。

### 8.36 移动购物袋：登录续加与触屏拖动

对应 F-09 / N-03，以及 §6「购物袋」和「浏览器导航」。现有回归分别覆盖访客跳转登录及已登录后的商城业务；补验从首页底栏出发、选择具体商品、实际登录并恢复购物意图，确认只加一次、URL 清理后刷新不重放。使用同一隔离镜像、临时访客和临时商品；用 Chromium 触屏输入拖动购物袋把手，验证展开、滑动关闭及重开时保留商品和数量。范围限 E2E 与记录；不替代实体手势、PocketBay 宿主遮挡或公网交易验证。

- [专项](../../artifacts/mobile-audit-2026-11-25/docker-4196-mobile-bag-first.json) **1/1**；[同镜像业务套件](../../artifacts/mobile-audit-2026-11-25/docker-4196-business-mobile-bag.json) **9/9**，无跳过或重试，E2E 类型检查通过。[回归用例](../../frontend/e2e/business.e2e.ts:304)使用 390×844 Chromium 移动触屏上下文与真实隔离 API。
- 从首页底栏进入文创，点临时商品触发登录，`returnTo` 包含正确商品 ID；登录前购物袋为空、无加购请求。实际登录回到 `/shop` 后查询购物袋，只有同一商品的 1 件，浏览器只发送一次加入请求。由浏览器触屏输入上拖把手切到展开态、下拖关闭；重开仍显示 1 件，按钮关闭后刷新依然为 1 件，未重放加购。
- 使用 §8.35 的同镜像和重新启动的 tmpfs H2，隔离容器已停止。此轮只新增测试、未改运行时代码，未重跑全站 E2E、性能或单测；未发布、未访问生产登录态或写入生产数据，不关闭宿主遮挡、外层地址或真机门禁。

### 8.37 M09：共享底部抽屉的背景焦点与滚动

目标 N-03 / M09。高清暗房已使用原生模态；补测文创购物袋、预约信息和展品信息使用的共享抽屉。先确认打开时背景能否获取焦点；如能，定点修复共享组件，保留双向 Tab、按键/触摸关闭、回焦、拖动、现有版式与路由。验证同一访客购物袋的背景聚焦尝试、前后 Tab、Escape 回焦与滚动恢复，并回归预约、展品和触屏拖动。风险为多弹层关闭顺序、WebKit、入退场和安全区；不扩大到 PocketBay 宿主或重写业务流程。

- [旧镜像反证](../../artifacts/mobile-audit-2026-11-25/sheet-native-before.json)：购物袋虽有 `aria-modal` 并拦截 Tab 边界，背景触发器仍可通过 `focus()` 获得焦点。改用[原生模态抽屉](../../frontend/src/components/BottomSheet.vue)，由浏览器隔离背景，焦点默认落在关闭按钮；按 Escape、点击遮罩、拖动关闭沿用原入口。退场完成后释放模态，页面滚动锁取决于抽屉是否打开，不再逐实例覆盖 body 内联样式；路由卸载显式关闭。
- 首个原生版本 [Chromium 专项 6/6](../../artifacts/mobile-audit-2026-11-25/sheet-native-focused.json)，但 Windows WebKit 的普通 Tab 跳过「前往登录」链接。最终版给抽屉内可见、可用控件明确双向 Tab 顺序。构建预览在 Chromium 390×844 中文浅色、844×390 英文深色和 Windows WebKit 390×844 中文浅色均验证了原生模态、焦点顺序、Escape 回焦与路由返回解锁。其中两组 Chromium 的抽屉外框与修复前相同，关闭键均为 44×44px 且中心可命中；见[竖屏](../../artifacts/mobile-audit-2026-11-25/sheet-after-chromium-zh-CN-light-390x844.png)与[横屏](../../artifacts/mobile-audit-2026-11-25/sheet-after-chromium-en-US-dark-844x390.png)。
- 最终源码前端单测 **449/449**（原先两条模拟抽屉单测合并为一条原生模态生命周期测试，实际焦点循环与回焦下沉到浏览器 E2E），应用与 E2E 类型、生产构建、首屏 JS/CSS 和配乐预算通过。Impeccable 目标检测未检出规则问题。
- 根目录 Dockerfile 最终候选 `heluo-mobile-audit-release:20261126-sheetfinal`（`sha256:9e457db74ed7113e6c7567b41b679fa1963aeea81f8f609433a124d2c0cb459c`）使用回环 `4198` 和新 tmpfs H2。ready `UP`、洛笙 meta 存在，HTTP 入口 `index-BRuZ4Z6y.js` 与本地构建 SHA-256 相同：`17eb627437c1a256b94f3723a1b5acb801ae134e1b111ee1725049a6cdee02a2`。同镜像[浏览器/API 全量](../../artifacts/mobile-audit-2026-11-25/docker-4198-full-results.json) **58/58**，无失败、跳过或重试；三组 Chromium/WebKit 视觉与交互样本在最终容器上再次通过，包括点遮罩关闭与路由返回解锁。
- 最终镜像三次新浏览器 profile 冷启动 [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4198-sheet-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4198-sheet-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4198-sheet-3.json) 均确认新入口和真正的馆首页封面 LCP：**2.490 / 2.479 / 2.489s**（中位 **2.489s**）、TBT **62 / 51 / 49.5ms**（中位 **51ms**）、CLS **0 / 0 / 0**。应用内可复测门槛通过，LCP 中位余量约 11ms，不作公网性能承诺。
- 本轮没有变化的后端代码、迁移与接口未另重测；专用预览和隔离容器均已停止。未提交、推送、发布、访问生产凭据或写入生产。公网 M01/M03/M04/M08、实体 Safari/Android/微信、真实键盘与读屏仍待验；Windows WebKit 只作为引擎补验。

### 8.38 M01：公网休眠响应不能替代就绪态诊断

2026-11-26 01:44（Asia/Shanghai）从正式入口发送匿名 GET：就绪、参观指南及含起止日期的 7/30/365 天时段查询均返回 HTTP **204**。随后复查首页和就绪接口，均为 **204 / 0 B**，响应头明确标为 `x-pocketbay-app-status: sleeping`、`cf-cache-status: DYNAMIC`。未收到应用 JSON；不能据此读取当前指南文案、判断活动版本或把没有响应体当成零库存。本次不覆盖 §8.23 已观察到的 **ready 200/UP、三个时段窗口均 200 且为空** 的就绪态证据。

下一步仍是由 PocketBay #329 授权运维按 §8.28/§8.30 回传去敏活动版本、数据库驱动、业务时钟、预约初始化开关及三行时段汇总；不要发送凭据，不对活动 H2 文件另开 JVM。仅做公开只读请求和文档同步，未显式唤醒、登录、调整宿主、发布、写生产数据或重跑候选测试；M01/M03/M04/M08 和真机门禁均未关闭。

### 8.39 阶段 D：最终原生抽屉的展开态无障碍检查

目标 N-03 / M09。在 §8.37 同一镜像的回环 H2 夹具上，覆盖实际展开的购物袋、预约表单和展项信息，而非仅扫描无弹层页面。检查中英、双主题的 axe A/AA 结果，及 Chromium 强制颜色模拟下关闭控件、键盘焦点和 Escape 回焦。验证不发送预约、不启动 3D 或模型服务；记录自动检查无法判断的项目。风险主要是浏览器模拟不能替代 Windows 系统高对比度、真机或读屏；仅在确认实际的应用问题时才改运行时代码。

- 2026-11-26，原 `20261126-sheetfinal` 镜像使用回环 4199、新 tmpfs H2；ready 为 UP，HTTP 入口和入口 SHA-256 均匹配 §8.37。触屏 Chromium 153 在 390×805、中文/英文×浅/深四组中，经页面控件实际打开访客购物袋、预约表单、3D 展项信息。[axe 4.13.0 结果](../../artifacts/mobile-audit-2026-11-25/sheet-expanded-accessibility-index-BRuZ4Z6y.json)：所选 WCAG 2.2 及以前的 A/AA 规则 **12 个展开状态、0 violations**。每个抽屉可读到对话框名称，背景焦点尝试无效，正反向 Tab 保持在弹层内，Escape 返回原触发器。
- 中文浅/深购物袋各有一个 `color-contrast` 人工待判断项，axe 无法解析文字叠层背景。[用浏览器合成像素复核](../../artifacts/mobile-audit-2026-11-25/release-manual-a11y-index-BRuZ4Z6y-bag-390x805.json)同一段访客说明的中英双主题四组，最小对比度为浅色 **6.57:1**、深色 **5.64:1**，均达到 **4.5:1**。只对该文字样本结论负责。
- 中文三抽屉分别以 Chromium 浅/深强制颜色模拟检查，共 **6 个状态**。关闭按钮均为 **44×44px**、中心可命中、键盘聚焦有 **2px 实线轮廓**，图标使用该模式的黑/白前景，Tab、Shift+Tab、Escape 与回焦均通过。此为浏览器模拟，未操作真实系统高对比度、实体手机、微信、软键盘或读屏。
- 未改应用代码、未提交预约、未重跑应用全套及性能，未访问生产或发布。隔离容器已停止并确认退出。公网 M01/M03/M04/M08 保持开放。

### 8.40 阶段 D：预约成功后电子票根的焦点交接

目标 F-06 / N-03，验证完整移动路径中从填写信息抽屉自动切换到电子票根弹窗。先在 §8.37 同一隔离镜像实走注册、登录和预约，复现是否缺失初始焦点、背景隔离、双向 Tab 或关闭回焦；只在确认后定点修复票根语义与交接，保留盖章、票面、背景点击关闭、个人记录链接和预约 API / 幂等逻辑。不触及生产。风险是同时过渡的两种弹窗、预约成功后提交触发器不再可用、手机短屏滚动和 WebKit 默认键盘行为；验收包含自动打开、Escape、重开、遮罩关闭和查看真实预约记录。

- 复现确认：旧实现的自定义 `div[role=dialog]` 没有自动聚焦关闭按钮。已将票根改为原生 `dialog.showModal()`，增加关闭按钮初始焦点、明确 Tab/Shift+Tab 循环、Escape/遮罩关闭、回焦和滚动锁；预约接口、幂等键、票面和盖章流程不变。
- 2026-11-26 在隔离 H2 夹具实走注册→选日期/时段→填写→登录→提交预约。Chromium 和 Windows WebKit 均验证实际 POST、自动弹出票根、关闭按钮初始聚焦、背景禁止聚焦、双向 Tab 各两轮不逸出、Escape 关闭并回焦解锁、键盘重开后点遮罩关闭仍回焦，以及从票根进入个人中心查看该预约记录。Chromium 采用减少动画；WebKit 采用正常动画。截图：[Chromium](../../artifacts/sitewide-quality/appointment-redesign/mobile-issued-pass-dialog-chromium.png)、[WebKit](../../artifacts/sitewide-quality/appointment-redesign/mobile-issued-pass-dialog-webkit.png)。
- 最终开启洛笙的镜像 `heluo-mobile-audit-release:20261126-passfocus`，ID `sha256:2742c268bc73bdfe0aba54086e70dde7ee8630251ec94d53707ff08381af6716`；回环 4202、新 tmpfs H2、临时账户、外部模型和 SMTP 关闭。ready 为 UP、洛笙 meta 存在，实际入口 `index-RfRkSJAB.js` 的 SHA-256 `fed8018ac7fd6def85907d65b28a243a947d7f2c829af2642fa7838314f50a2b` 与本地构建一致。该镜像的[Chromium/API 全量](../../artifacts/mobile-audit-2026-11-25/docker-4202-passfocus-results.json) **58/58**，[Windows WebKit 票根专项](../../artifacts/mobile-audit-2026-11-25/pass-webkit-results.json) **1/1**。前端单测 **449/449**、应用/E2E 类型、生产构建、首屏及配乐预算、Impeccable 定点检测（`[]`）通过。
- 在该镜像上顺序运行三次独立 profile 冷启动（[1](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4202-passfocus-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4202-passfocus-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4202-passfocus-3.json)），均确认最终入口和首页封面 LCP；LCP **2.486 / 2.471 / 2.472s**（中位 **2.472s**）、TBT **69 / 35.5 / 40.5ms**（中位 **40.5ms**）、CLS **0 / 0 / 0**，通过本地实验室门槛。
- 隔离容器 4199/4201/4202 已停止并确认退出；未发布、未访问生产或修改业务数据，也未重跑后端单测/迁移专项。公网 M01/M03/M04/M08、真机、微信、读屏及系统键盘仍待验；Windows WebKit 不等于 iOS Safari。

### 8.41 发布准备：可校验的本地源码包

目标 N-03 / N-06。PocketBay 历史流程接收源码包，故在 §8.40 已验镜像之外准备明确的本地交付输入。只纳入根 Dockerfile、入口脚本、运行源码、公开静态资源及签核证据包；排除本地配置、密钥、数据库、日志与夹具，不上传、不配对。逐条比对压缩包散列并从解包上下文重建；如实际静态资源或后端类/资源与 §8.40 镜像不相同，不将其视为对应同一验收版本。上线仍需独立授权，生产预约根因与宿主门禁不随打包关闭。

- 2026-11-26，[本地源码 ZIP](../../artifacts/mobile-audit-2026-11-25/pocketbay-passfocus-source/source.zip) 共 **446 个文件 / 28,513,288 B**，SHA-256 为 `4011fc46db1819023f86aae8552e1017ccafd9305ac36f95e155ebab006bc4bb`。逐项核对 ZIP 和解包目录与[清单](../../artifacts/mobile-audit-2026-11-25/pocketbay-passfocus-source/source-manifest.json)相符。只交接该 ZIP 与必要的非敏感校验值，勿打包或共享整个 `artifacts` 目录。
- 从解包目录运行 `docker build --build-arg VITE_GUIDE_ENABLED=true -t heluo-mobile-audit-release:20261126-passfocus-package .` 成功；前端生产构建及 Maven 打包实际执行，依赖层可使用本地 Docker 缓存。新镜像 ID `sha256:24f6766c9e6c98fb2c583d3b40aaf9465f27c371cca60c2202af03168622cd6f`，不是同一镜像摘要。[JAR 逐条内容校验](../../artifacts/mobile-audit-2026-11-25/pocketbay-passfocus-source/jar-comparison.json)：两侧 **698/698** 个非目录条目同 SHA-256，无新增、缺失或内容变化；其中含 **199** 个应用 `.class`、**284** 个静态资源、**31** 个迁移、**77** 个依赖 JAR。整个 JAR 文件的 SHA-256 不同，不声称归档或镜像字节级复现。镜像运行配置一致，独立于 JAR 的入口脚本和洛笙签核内容合计 **7** 个文件散列一致。
- 使用新镜像的 `127.0.0.1:4203`、全新 tmpfs H2、临时账户，关闭外部模型与 SMTP。[真实 HTTP 验收](../../artifacts/mobile-audit-2026-11-25/pocketbay-passfocus-source/rebuilt-http-smoke.json)：ready `200/UP`、首页 `200`、洛笙启用 meta、实际 `index-RfRkSJAB.js` 的 SHA-256 与 §8.40 一致；公开预约 7/30/365 天均 `200`，分别 **24 / 104 / 1252** 条余量为正的隔离时段。[Chromium 专项](../../artifacts/mobile-audit-2026-11-25/pocketbay-passfocus-source/rebuilt-browser-results.json) **2/2**：移动预约抽屉填表、登录后提交、电子票根回焦与个人记录；洛笙短屏可打开、输入和关闭且不发送消息。专用容器已停止。
- 此轮未改应用源码、未重跑 58 项全量、Windows WebKit、性能、前后端单测或迁移专项；§8.40 仍是这些验收的证据来源。没有上传、配对、发布、访问生产或修改生产数据/配置。PocketBay 的远端构建是否能采用同一构建参数、运行时洛笙开关及产物是否匹配，须在授权发布时单独核对；不把隔离 H2 初始化结果视作生产 M01 根因或恢复。下一步仍是 #329 授权运维按 §8.30 提供去敏运行状态和时段聚合，并确认 M03/M08 的宿主能力；发布获准后才复测正式入口 M04 和真机。

### 8.42 发布准备：缺省构建参数与洛笙运行时开关

目标 N-03 / N-06。仍使用 §8.41 同一解包源码，按 Dockerfile 默认 `VITE_GUIDE_ENABLED=false` 重建，不更改源码包。使用同一镜像的独立 H2 夹具比较洛笙关闭、仅开启、开启且配置签核证据路径三种状态；验证就绪、脚本指纹、HTML meta、快捷入口、短屏输入及中英文证据接口。不开启外部模型、SMTP 或生产访问权限。

- 2026-11-26，本地重建镜像 `heluo-mobile-audit-release:20261126-passfocus-default`，ID `sha256:f0e486e6fd0981d2facb33bfbe6bef4121b170bad70fd51cc21e64c35490172f`。回环 4204／4205／4206 分别使用新 tmpfs H2。三个夹具 ready 均 `200/UP`，首页、`/explore` 和 `/artifacts/heluo-bronze-ding` 直接 GET 均为 200；浏览器读取相同的实际入口 `index-C4l_snwb.js`，SHA-256 `c553aa06aac7bb2ddb173b82cce450a5acecbbb2ec61adf5fe216b52f6638aab`。它与 §8.40/§8.41 显式开启构建参数的入口**不同**。
- [三配置浏览器与 API 对照](../../artifacts/mobile-audit-2026-11-25/pocketbay-passfocus-source/runtime-guide-matrix.json)：关闭时三条路由没有启用 meta 或洛笙按钮，签核卡接口中英文均 404；仅开启时三条路由均显示入口，详情可打开输入，但卡接口 `200 / available:false`，中英文各 **0** 张；运行时开启且配置[容器内三条证据路径](../../deploy/README.md#pocketbay-单镜像启用洛笙)后，中英文各 **9** 张，两个 API 响应均为 `200 / available:true`。不能用 ready 或按钮可见替代证据包验收。[配置完整时的移动专项](../../artifacts/mobile-audit-2026-11-25/pocketbay-passfocus-source/default-guide-input-results.json) **2/2**：短屏输入及中文组合键、多行草稿、横竖重排、关闭回焦通过，未发送真实对话。
- PocketBay [公开部署协议](https://pocketbay.com/deploy)可读取，未找到自定义 Docker build args 的说明，不代表平台不支持。若授权运维确认不能传构建参数，可考虑上述运行时路径；默认镜像独立门禁见 §8.43，不复用 §8.40 的证据。若能传参数，优先核对已验候选的入口指纹，再额外核对签核卡路径。未改应用代码或源码 ZIP，专用容器均已停止。未测试真实模型、远端构建、真机或同一正式入口性能，未进行生产写入、登录或部署。
- 同轮正式入口仅作匿名 GET：首页、ready、7/30/365 天时段均为 **204 / sleeping / DYNAMIC**，没有应用数据。该结果不改变 §8.23 的就绪态空列表证据；仍需 #329 授权运维提供 §8.30 的去敏汇总。没有显式发送唤醒请求。

### 8.43 发布准备：默认构建产物的独立回归门禁

目标 N-03 / N-06。按 §8.42 同一默认构建镜像、完整签核卡路径、回环 tmpfs H2 复启；先核对真实 ready、入口和签核卡，再重复主候选的 Chromium/API 全量、Windows WebKit 票根专项及三个串行冷启动，避免让一条尚未确定能否使用的发布路径继承不同脚本的验收结论。冷启动要求三次均加载实际首页封面和对应脚本；LCP 中位 ≤2.50s、TBT 中位 ≤200ms、每次 CLS ≤0.1。若任一门禁未过，保留实测证据，不能把默认构建列为已验可发。此次不改业务代码、不检查远端构建设置、不访问生产应用实例。

- 2026-11-26 复启 §8.42 同一镜像 `sha256:f0e486e6fd0981d2facb33bfbe6bef4121b170bad70fd51cc21e64c35490172f`，回环 4206、新 tmpfs H2、模型和 SMTP 关闭。实际 HTTP ready `200/UP`、首页入口 `index-C4l_snwb.js`、洛笙启用 meta 与英文签核卡 **9** 张通过复核。启用洛笙必测的同镜像 [Chromium/API](../../artifacts/mobile-audit-2026-11-25/pocketbay-passfocus-source/default-full-browser-results.json) **58/58**，[Windows WebKit 票根](../../artifacts/mobile-audit-2026-11-25/pocketbay-passfocus-source/default-pass-webkit-results.json) **1/1**，无失败、跳过或重试。覆盖隔离账户的真实预约、后台、订单及模拟支付；WebKit 专项不能代替实体 iOS Safari。
- 同一镜像在浏览器回归结束后用 Lighthouse 13.4.1 依次运行三个独立冷缓存 profile [1](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4206-passfocus-default-1.json)、[2](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4206-passfocus-default-2.json)、[3](../../artifacts/mobile-audit-2026-11-25/lh-retest-docker4206-passfocus-default-3.json)；每次验证正确入口与首页封面 LCP。LCP **2.472 / 2.471 / 2.472s**（中位 **2.472s**），TBT **34.5 / 35 / 43.5ms**（中位 **35ms**），CLS 均 **0**，本地门禁通过。这个结果不包含 PocketBay 外层、休眠恢复或真实用户网络时延。
- 正式发布时按构建能力选证据：显式 `VITE_GUIDE_ENABLED=true` 对照 §8.40 的 `index-RfRkSJAB.js`；使用默认参数并由服务端开启时对照 §8.42/§8.43 的 `index-C4l_snwb.js`，同时核对三条运行时证据路径和中英文卡。无对应指纹时不可签核为上述候选。容器已停止，没有新改动或上传源码 ZIP，未重跑前后端单测、实际生产性能、远端构建、真机、微信或读屏，未提交、发布或写入生产。下一步继续等 #329 去敏预约聚合及宿主能力确认，授权发布后复验 M01/M03/M04/M08。

### 8.44 后台页拉起后的公网预约复核

2026-11-26，在用户要求继续执行方案后，通过公开正式入口打开 `/admin/operations`。PocketBay 自动进入唤醒流程并挂载应用；未点击平台显式唤醒按钮、未改配置。应用将未认证请求重定向到 `/login?returnTo=/admin/operations`，需要管理员手工登录，本轮未输入或接触凭据。

只读 GET 显示外层 `heluo.pocketbay.app` 与应用内层 `heluo--e.pocketbay.app` 的 `/api/v1/ready` 均为 **200 / UP**；两入口对 2026-11-26 至 2026-12-02 的 `/api/v1/appointment-slots` 均为 **200 / data: []**。这确认应用从休眠恢复后公开预约仍无可用时段，但不能判断实际 H2 是缺行、关闭、满额或被时钟过滤；未创建测试时段、未执行生产写入。PocketBay「数据库」控制台此前确认是独立 PostgreSQL 16.14 且无用户表，不能用于诊断应用绑定的 `/data/museum.mv.db`。

**下一步**：管理员在博物馆后台手工登录后，检查近期时段列表并确认测试日期无重复；再按 §8.30 使用受支持的 H2 只读入口统计，或在明确授权下由管理员在界面创建单个公开测试时段。创建属生产写入，提交前必须再次确认具体日期、时间与容量。M01 继续保持未验收。
### 8.45 后台排班到公开日历专项

关联 F-06 / M01。在独立本机 H2 上通过后台表单创建一个开放时段，核对响应、公开余量及独立游客浏览器的选中状态。测试后关闭夹具。影响范围为业务浏览器回归与验收记录，生产排班仍由管理员核实。

本机既有 JAR 与前端 dist 的 ready 返回 UP。管理员通过表单开放容量为 3 的时段后，匿名接口返回相同 ID 和 3 个余位，390×844 游客窗口可选中该时段。最终版本在同库连续执行 2/2 通过，收尾将测试时段关闭。线上后台需管理员登录后核实。
