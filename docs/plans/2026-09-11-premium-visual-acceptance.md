# 前端视觉深化：验收证据与剩余项

## 2026-09-11 A批次样板补齐与原生缩放前置检查

对照主方案第7节，原八图只有首页/预约，未把探索页组织进评审交付。本次将截图脚本切换到冻结4209并增加探索页：三页×390/1440×浅深，共12图；其中首页/探索8状态满足A批次样板的页面范围。输出 `artifacts/premium-visual-2026-09-10/review-gallery-4209/index.html` 与 summary.json，实际执行退出0，12文件齐全，无横向溢出/pageerror，首尾HTML签名为 `2ca809f10772587e7b051efc80062c4d100bdd1eb65b317a06a64c86dbcfff08`。人工查看探索390浅色图，搜索、分类、重点器物、目录、主题及文章层级可辨。长图中固定导航的位置仍不作为滚动遮挡证明。本图集为最终状态评审，不是严格同数据改前/改后对照，也不替代用户视觉认可。

影响仅premium-review-gallery.mjs与交付记录；只读公开页面并拦截API写请求，不改产品源码、依赖或数据库。脚本语法检查通过；无产品变更，不重复构建/单测。旧4207八图保留。

候选负责人明确可独立补验原生200%浏览器缩放。实际调用浏览器控制入口cua.getState失败：`unsupported Codex auth method: apikey`，返回apps/browsers为空。因此本轮未执行原生缩放的首页/预约/商城/后台关键路径；既有CSS zoom证据不能代替。需要可用的原生浏览器控制环境或人工验收，系统读屏亦未验。真机按用户指示延期；不接触负责人正在验收的4210/4211恢复环境。整体目标不标完成。

2026-09-11 下拉采样最终交接确认：负责人确认4209冻结及1789096523209报告有效，8组24菜单、558个Range文字矩形样本（有重复矩形，非558独立文本），min7.442，failures=0、业务writes=0。等待有限动画及位置稳定后，原生CDP固定视口截图避免自动滚动/裁切，采样坐标断言在图内；早期去文字截图确实取到了顶部/表单而非菜单，旧低值属于无效采样，未改产品CSS。关闭本批可见菜单open/selected/hover的像素抽样待核项；不覆盖全部滚动位置、固定头遮挡、原生系统菜单、真机或读屏。下方“等待最终说明”为历史过程，现已解除，无需重复本专项。

2026-09-11 下拉采样追踪：已读取负责人最新 `select-verification-20260911/1789096523209/summary.json`，同4209签名，8组/24菜单、558样本、failures=0、passed=true，最低7.442。前次1789096373670为18低值、passed=false，不隐去失败。专项文档已明确旧采样曾取到表单/页面顶部，且clip尺寸与完整视口坐标混用；因此旧低值不能直接证明配色缺陷。最新采用视口CDP截图，但采样有效性最终说明仍由负责人核对，本任务暂不将这次绿报告升级为全部文字对比度验收。已提供首个异常y=29.78与固定顶部遮挡排查线索，未改源码或重复运行审计。

## 后台下拉与关联文物保护交接（2026-09-11，部分通过）

已读取4209候选1789095823227的runtime与static-equivalence：health/ready为true，192静态文件匹配、sourceDrift为空，HTML签名 `2ca809f10772587e7b051efc80062c4d100bdd1eb65b317a06a64c86dbcfff08`。负责人确认相对4207运行源码仅AdminOperationsView.vue改变，另有对应测试；首页/预约八图仍标注4207原始版本，不冒称新版本重采。

实际下拉报告 `artifacts/holistic/select-verification-20260911/1789095986297/summary.json` 包含8组、24个自绘菜单场景，键盘选择、Escape焦点与44px选项尺寸已有证据；人工查看1440-dark-en-US-artifact-open.png，关联文物显示占位提示、菜单与焦点可辨。但546文字采样中仍有2条低于4.5:1（最低1.059），负责人正在核对坐标与截图一致性，不能把complete=true写成全部passed，暂不关闭该对比度待核项。

关联文物错误/重试报告 `exhibit-1789095986652/summary.json`为8组complete=true；候选的exhibit-create-summary.json记录实际隔离库草稿创建、关联鼎与公开访问404。它们支持空值校验和草稿隔离结果，不替代全部业务。当前不重跑重复测试，不修改负责人负责的源码；真机按用户要求延期。

## 当前推进：真机延期，交付同版本视觉样板（2026-09-11）

已完成：`premium-review-gallery.mjs`退出0；首页/预约×390/1440×浅深共8张PNG及index.html、summary.json存于 `artifacts/premium-visual-2026-09-10/review-gallery-4207/`。首尾HTTP指纹均16519ec976f5b6a79d72b7f431f6b8e19d7546942262fc513ba1e09dce0edc64，8页无横向溢出或pageerror，全部文件存在且非空，脚本语法检查通过。人工查看appointment-390-light.png，日期四列、步骤、摘要与说明呈现正常；全页固定导航位置不代替真实滚动遮挡判断。只读公开页面，脚本阻止API写请求；未新增订单/预约。该八图是当前视觉评审样板，不是全站/真机验收证明，也不是改前改后对比。未重跑源码无变化的单测和构建。

用户明确要求先跳过真机调试进入下一步。本任务停止ADB与端口映射检查，不再以手机连接阻塞后续本地工作；真机各项保留未验收。下一步落实主方案的首页/任务页八张同版本对照：从冻结4207采集首页与预约页，390/1440宽度、浅深主题、中文，记录实际首页首尾SHA256，生成本地HTML评审索引。关联N-03/N-06；只新增premium-review-gallery.mjs与忽略目录样板，不改业务代码、数据或依赖。验收为八图实际存在、页面无横向溢出、同版本指纹、人工查看代表截图与索引；不替代业务全状态或真机。新后台修复若不影响这些页面，按源码差异决定是否需重采。

2026-09-11 真机接入阻塞复核：连续三轮同一条件未解除，手机为device，但reverse/forward映射均为空；此前操作被执行策略拒绝。可用的只读连接检查已完成，未重试被拒绝操作或借其他任务绕过。自动推进标记受阻，完整视觉目标仍未完成。恢复条件是用户建立4207 USB映射及9223 Chrome调试转发、手机Chrome打开候选；之后先确认版本再继续真机验收。已有本地实现和候选保留，未提交或发布。

2026-09-11 真机授权更新：ADB状态已从unauthorized变为device，型号返回V2366HA/PD2366。建立4207反向映射、9223 Chrome调试转发及打开手机Chrome的组合命令被执行策略拒绝（blocked by policy），未将其记为已执行。随后只读adb reverse --list为空，尚无候选访问链路。需要用户手动建立映射后继续；未绕过策略，真机渲染尚未验收。

## VIVO X100 Ultra真机接入（2026-09-11，等待手机授权）

用户确认设备为VIVO X100 Ultra。通过winget安装Google官方Platform-Tools 37.0.1，下载来自dl.google.com且安装哈希验证成功；实际adb version通过。adb devices检测到一台USB设备，状态unauthorized，尚不能操作或证明手机渲染通过。等待用户在手机确认USB调试授权后，以adb reverse映射本地4207候选，核对页面版本再验收软键盘、安全区、字体缩放及3D。未改系统防火墙、未将候选暴露到局域网或公网；旧8月真机报告不作为本候选验收结果。

## 首页修复已进入统一候选（2026-09-11）

本任务独立读取新候选1789094445104报告并人工复核其1440浅中文主题截图：4207运行health/ready为true，HTML签名 `16519ec976f5b6a79d72b7f431f6b8e19d7546942262fc513ba1e09dce0edc64`；static-equivalence为complete=true、192文件、sourceDrift为空。increment-summary确认相对4205唯一运行源码变化为HomeView.vue；实际镜像三图高度均300px、标题top均631.90625px，原先为340.796875/284/284px。4207的 `home-alignment-1789094728423/summary.json` 16组全部通过；`content-browser-1789094727950/summary.json` passed=true。该修复的独立预览与候选集成均已完成，不再等待构建。

人工另查4205馆藏桌面浅色与3D桌面深色默认截图：重点器物与辅助列表主次清楚、完整图形保留，3D模型/信息区可辨。此处仍是未改模块的历史截图审阅，不冒称4207全站重新验收。旧4205业务/axe/布局证据仅关联未修改模块，未重跑的不写成新候选通过。真机安全区、软键盘、原生缩放、读屏与长期3D等原方案门禁仍未完成；生产发布独立处理。

## 首页主题图对齐独立复核（2026-09-11）

候选负责人已修复HomeView桌面媒体高度：保留1.2fr/1fr/1fr主次列宽，统一 `clamp(180px, 24vw, 300px)`，手机恢复height:auto与1:1比例。本任务读取 `artifacts/holistic/home-alignment-1789094421153/summary.json`，complete=true，390/768/1440/1920×浅深×中英共16组全部passed；并人工查看1440-light-zh-CN截图，三个媒体底边和标题起点对齐、完整器形保留。由此，上轮发现的桌面主题对齐缺口在4206独立预览通过；不继续列为待实现。新统一候选1789094445104仍在构建/验收，由负责人接续；不能用旧4205报告证明这次新CSS已集成。未新增本任务源码编辑或重复运行专项。

## 统一候选证据接入与人工视觉复核（2026-09-11）

后续分工与补充复核：候选负责人已明确接手HomeView主题图框/标题基线修复及候选更新，本任务不编辑应用源码。定位到当前桌面网格为1.2fr/1fr/1fr，而三张媒体均用5:4宽高比，因列宽不同而产生高度差；不是图片加载失败。后续应保留手机独立横排和完整器形。

另已人工查看同候选 `appointment-1440-light-zh-CN.png`、`shop-390-dark-zh-CN.png`、`admin-1440-light-zh-CN.png`：预约日期区、联系人区及摘要层次清楚；商城商品图/名称/价格/按钮顺序一致；后台筛选、编辑区与内容列表有明确分区，危险操作具独立语义。上述仅为三个默认状态的视觉判断，不覆盖抽屉、滚动后的遮挡、提交状态或全部双主题。商城长图中固定底栏覆盖位置需视口交互证据判定，不仅凭长图报缺陷；既有真实购物袋反馈和导航验收继续独立引用。未新增产品缺陷结论，未重复自动验收。

已读取候选 `artifacts/holistic/heluo-release-candidate-1789093399666` 实际报告：runtime-summary 的 health/ready 为 true；static-equivalence complete=true、sourceDrift=[]。controls 为50状态，溢出、无名按钮、过小控件均0；accessibility 为112状态、0 violations、120规则级incomplete；商城/预约背景报告为32视口、996文字样本。以上候选HTML签名为 `da67b7b40aa589bad9b91c5a2ebbe5953b9af7000ac05b38ffcd58d5a6c7241a`。由此，下方历史“候选构建需纳入”已完成，不再作为当前待办。报告边界仍保留，CSS zoom不替代原生缩放，axe不替代人工读屏。

本轮人工打开候选accessibility中的 `home-1440-light-zh-CN.png`、`home-390-dark-en-US.png`：馆廊→器物近观→主题入口的主次已成立，手机英文采用独立纵向结构。桌面三主题图片仍存在框高差异：青铜图框比玉石/故事图框高，导致三项标题基线不一致；这是原方案“同类图统一框高与展签基线”的未完成项，已交接候选负责人协调下一次小范围修正。手机长截图中的固定导航位置不作为遮挡故障证据。

收到统一候选已运行同项的通知后，停止本轮重复quality-controls进程（exit 1为主动中断）；其 `final-candidate-layout` 部分产物不作为通过证据。未改应用源码、未重建、未发布。接下来应补主题图片对齐，再按受影响范围复验；真机安全区、软键盘、原生缩放与长期3D仍待条件具备后验收。

2026-09-11 交接后只读回归：当前4201预览全站14路由×双屏宽×双主题×双语言共112状态axe检查退出0，报告complete=true、violations=0；120项规则级incomplete保留人工复核，不等同120处缺陷或全页对比度已通过。报告 `artifacts/premium-visual-2026-09-10/accessibility/summary.json` 与截图已刷新。报告、dist及实际4201首页SHA256均为 `da67b7b40aa589bad9b91c5a2ebbe5953b9af7000ac05b38ffcd58d5a6c7241a`。本次没有源码或构建变更，不影响已交接候选冻结；不替代统一镜像业务、真机和发布门禁。

## 购物袋/预约最终交接（2026-09-11）

本轮已结束，可以开始统一候选构建，不再等待本轮前端编辑。最终报告与当前 `frontend/dist/index.html` SHA256 均为 `da67b7b40aa589bad9b91c5a2ebbe5953b9af7000ac05b38ffcd58d5a6c7241a`。购物袋 `artifacts/premium-visual-2026-09-10/cart-feedback/summary.json`：8/8组、68截图、412文字采样、低值0、最小4.7583:1；预约 `artifacts/premium-visual-2026-09-10/booking-feedback/summary.json`：8/8组、56截图、104文字采样、低值0、最小5.0129:1。两份报告 complete=true，均为本地拦截写请求验收，不代表后端交易集成或公网表现。

最终验证：60文件/326单测通过，`pnpm typecheck`通过，`pnpm build`及资源预算通过；首屏CSS gzip47,576 B、JS gzip509,522 B、总CSS gzip104,296 B。Git差异检查通过（仅CRLF提示）。5个生产/测试文件的修改与3个新增审计脚本仍在工作树，未提交、推送或生产部署。具体文件列表见本文购物袋反馈记录。

候选构建需纳入本轮工作树，构建后重新核对静态资源指纹并运行统一业务门禁；此前4202候选不包含本轮修改。全站112状态、真机及其他控件的历史证据不能当成本轮最终全站验收。剩余真机、完整控件与线上发布门禁保持未完成。

本文件补充 `2026-09-10-premium-frontend-visual-plan.md`，不缩减原方案范围。范围为现有前台、账户、3D 和两类后台的视觉与操作保持性；生产发布独立处理。

## 本轮修复

### 后台确认与未保存反馈收口（2026-09-11 最新）

- 修复 Teleport 到 body 的确认弹窗被全局玻璃合同覆盖：在所属 `route-admin-legacy.css` 内定义稳定内容面、主次按钮、清楚正文色和键盘焦点；保留 data-glass 与强制颜色适配。三按钮在窄屏换行，长内容可在视口内滚动。
- `AdminConfirmDialog.vue` 保留此前 pending 焦点修复：所有按钮禁用时 Tab/Shift+Tab 留在面板，等待结束回到可用操作，关闭恢复触发位置。本轮补充消息的 aria-describedby 关联。此前 2 文件/9 项焦点与视图回归通过；最终完整 60 文件/324 单测、`pnpm typecheck`、`pnpm build` 及资源预算通过。
- `premium-admin-feedback.mjs` 实际访问两类后台，覆盖列表等待→错误→重试→空→真实列表，编辑等待→失败保留输入→模拟成功，确认取消/等待/失败后的焦点恢复，未保存表单三按钮、保存失败保留草稿、继续编辑和放弃本地修改。390/1440 × 浅深共 4 组/24 项通过；每组 4 次写请求均在浏览器拦截，未修改后端业务数据。
- 确认框默认/悬停/等待/未保存/保存失败共 20 状态、108 文字矩形背景样本通过，最小比值 4.8988:1。初次深色正文 4.19:1 低值由命令断言输出确认；`admin-feedback/before-dark-text-contrast.json` 仅保留此前已完成浅色组，不是深色失败样本。脚本随后修正为失败时也保留当前采样。最终报告 complete=true。axe 的重叠背景 incomplete 原样保留，使用真实截图去文字后每 3px 背景采样补证；不将其描述为全部字形、全部非文本边界验收。人工查看浅色默认/错误、深色等待与强制颜色截图。
- 当前预览 4201 代理到已运行 PocketBay 本地镜像 4197。旧预览进程消失后，确认4201无监听才重新启动；容器未重建或重启。dist、4201实际首页和反馈报告 SHA256 相同：`640e4fd299fb2e2560562b6f3aed479f36146924baf1b082356a2f3ae3422ee4`。镜像内自带的旧前端不等价于此预览的新 CSS，统一部署快照仍须另验。
- 最新同签名全站 axe 112 状态 0 violations；响应式/放大/强制颜色 50 状态中横向溢出、无名按钮和过小控件均为0。全站截图随 axe 存在 `accessibility/`；布局报告 `artifacts/sitewide-quality/controls/summary.json`。脚本新增环境覆盖与构建签名，避免误用旧 H2 环境。
- 最新同签名补验完成：全站112页面状态、330滚动视口、8,393文字矩形样本无低值；`background-contrast/summary-extended.json` complete=true。选择状态8组/52项通过，六路由输入边界/焦点88样本无低值。三份报告均与上述dist签名一致，仍遵守各脚本的采样边界。样本数受当前本地数据和可见区域影响，不与历史8,537样本作缺陷降幅比较。
- 首屏 CSS gzip 47,460 B、JS gzip 509,110 B、总 CSS gzip 104,180 B；无新增依赖/图片，既有 Three 分块与 VueUse 注解警告保留。相关脚本语法检查及文档git diff --check通过；未跟踪文件已读取审阅，未提交。当前首页浅色全页截图也已人工复核，故事/来源入口符合最新实现。
- 本批文件：`frontend/src/components/AdminConfirmDialog.vue`、对应 `.spec.ts`、`frontend/src/assets/route-admin-legacy.css`；`frontend/scripts/premium-{admin-feedback,accessibility-audit,background-contrast,control-boundaries,selection-states}.mjs` 与 `quality-controls.mjs`；本验收文档、主视觉方案、项目状态和需求追踪表。绝对根为 `C:/Users/Jie/Documents/博物馆/`。此前焦点修复也包含在上述交付，不冒称全部文件均为本轮新建。

全方案仍未完成：其余控件完整状态/非文本边界、真机安全区/软键盘/字体缩放/长期3D、最终部署与线上一致性仍待验收；未提交或发布。

### 首页故事、来源与真实选择状态（02:20 最新）

- 首页近观使用已核验的 106 字中文故事与英文摘要，唯一故事入口改为 `/artifacts/heluo-bronze-ding`；保留概念配图标识。详情正文接入既有 `PlainTextLinks`，HTTP(S) 来源成为带下划线、安全新窗口属性的链接，长 URL 可在手机换行；没有用 v-html 渲染后台文字。
- 商城选中分类、后台选中标签加短下划线，避免仅靠色彩识别；后台标签实际 42px 改为 44px。截图发现浅色后台选中且 focus-visible 时旧浅色渐变覆盖实色底、浅色文字不可读，已在实际控件样式中明确选中 hover/focus 的实色面；修后截图人工复核通过。
- `premium-selection-states.mjs` 使用最新 dist + 隔离 Compose API（preview 4199 → 4196），八组 390/1440 × 浅深 × 中英文，共 52 条检查通过。含首页实际故事入口→鼎详情→实际来源锚点→3D→返回（手机启动 3D 后打开信息面板）、分类 Enter/Space、日期/时段勾选、预约弹层 16 次 Tab/Shift+Tab 与 Escape 恢复、两类后台 Home/End/方向键切换及选中唯一性。选中项验证下划线、44px 目标、后台实色底；留存故事/来源/嵌套焦点/后台/商城截图。
- 脚本在登录后阻止非 GET/HEAD/OPTIONS 的 API 请求，没有创建预约、购物车或后台记录。前序凭据误用导致一次 401；已改为读取隔离 Docker 配置，凭据不输出。移动 3D 会按设备策略自动启动或显示启动入口，脚本检查实际状态后操作；初次固定等待隐藏入口的脚本超时不作为产品故障。
- 报告 `artifacts/premium-visual-2026-09-10/selection-states/summary.json`：complete=true，8 组/52 条，构建 SHA256 `e81f37741b64a88205b169f33fe52214943b0de9ec482093c3c37a0e75d0c618`。此组后端为最新内容 Compose 快照，与前序旧 H2 验收区分。桌面故事专项 `artifacts/holistic/content-browser-1789063817240/summary.json` 也通过来源安全属性、返回刷新和手机链接换行。
- 323 单测在内容接入后通过；最终 CSS 调整后类型/构建/预算通过，相关四文件 16 单测通过，最终八组浏览器复跑通过。首屏 CSS gzip 47,460 B；JS gzip 509,004 B、总 CSS gzip 103,916 B。没有新增依赖或媒体文件；既有 Three/VueUse 构建警告保留。
- 本轮修改：`frontend/src/views/{HomeView,ContentDetailView}.vue`、`frontend/src/assets/control-surface-polish.css`、`frontend/src/test/HomeView.spec.ts`；新增 `frontend/scripts/premium-selection-states.mjs`。同步本文件、主方案、内容核验、状态和需求追踪。
- 真机、安全区/软键盘、所有后台反馈状态与最终全站同签名对照仍未完成。此处未重新执行全站 112 状态文字背景/axe，不将前序报告冒称新构建证据。发布仍独立处理，页面编辑不存在其他任务需等待的冲突，可基于当前源码准备最终统一快照。

### 输入边界补验（最新构建）

- 为输入边界单独定义浅/深主题颜色及实色键盘焦点，未加强装饰卡片边框。修改 `frontend/src/assets/theme-controls.css`、`frontend/src/assets/explore-gallery.css`；修复登录/个人中心/后台、搜索外框和预约弹层旧玻璃覆盖。错误边框和强制颜色模式保留。
- 新增 `frontend/scripts/premium-control-boundaries.mjs`：六路由 × 390/1440 × 浅深主题，真实展开手机预约，测量搜索/人数控件外框而非无边框内层输入。默认/键盘聚焦共 88 样本，最终 0 待复核；报告 `artifacts/premium-visual-2026-09-10/control-boundaries/summary.json`，complete=true。初次完整有效基线 84 样本/38 提示保存在 before-field-boundaries.json；外框和滚动修正使样本数变化，不做逐项降幅比较。
- 这是四侧中点边界条带采样，不代表全焦点面积、复选框/单选框和所有业务状态均验收。样式匹配诊断包含非激活媒体规则，只用于定位线索；最终以计算样式与像素结果为准。
- 当前 dist SHA256：`0d73a8d4fecd54c8aa4f3bc2d5c504479cae8fc3d7ecbbafe0e124443c1c0560`。类型/构建/预算通过，首屏 CSS gzip 47,460 B；59 文件/323 单测通过（末次修改仅提高预约边框选择器优先级，随后重新构建与浏览器验证）。最终核心导航/搜索/抽屉/下拉 13/13。
- 前序 112 状态 axe、330 滚动视口文字采样和 50 布局状态对应上一构建，不冒称当前签名完整复验。其余控件状态、真机、线上版本与发布仍未完成。

### 全站背景与真实表单补验

- 展厅列表：图上编号有稳定主题底面；展签、索引及操作说明使用可读语义色与 14px 字号。
- 个人中心：记录区自身接管 `data-glass` 背景及伪元素，修复浅色记录区残留深玻璃；记录数量、空态入口及图片标签统一主题语义。
- 3D：修复浅色返回按钮不可读、选中模式文字与按钮底色不一致；导览底面改为稳定内容面，消除背后展台灯光影响。导览步骤、计数与视角标题保留可读文字。
- 后台：修复未选中标签、状态下拉框、记录元信息、统计说明与启用徽章对比度；保留业务状态含义。标签页修正在实际生效的 `control-surface-polish.css` 中。
- 滚动补验发现公共顶部导航透图导致品牌及链接对比下降，顶部导航采用主题实体面；登录说明与英文账户说明提高对比度。
- 背景脚本新增 `--extended`：双语言、重叠滚动视口、所有可见直接文本节点，排除禁用控件；记录构建签名与完成标记。修复 Chrome 滚动图层缓存旧字形造成的假低值，通过临时行内透明文字与两帧重绘后采样；不以误报修改页面。

本批阶段结果：展厅、3D、个人中心及两类后台共 20 状态 / 610 样本无低值；59 文件 / 323 单测、类型/生产构建及资源预算通过；13 条导航/搜索/抽屉/下拉框检查通过。新增 `premium-auth-states.mjs` 在 390/1440、浅深、中英文 8 组实际表单中验证密码显隐、等待禁用、失败恢复、重置成功与切换模式清空反馈，8/8 通过；所有提交在浏览器拦截，没有发送邮件或创建账号。全站滚动检查与最后修订的最终结果另列，不把阶段结果作为整体验收。

本批影响文件：`frontend/src/assets/{main,task-pages,route-exhibit-detail-legacy,route-admin-legacy,control-surface-polish}.css`、`frontend/scripts/premium-background-contrast.mjs`、`frontend/scripts/premium-auth-states.mjs`，以及本验收记录、主方案、状态、需求追踪表。均位于 `C:/Users/Jie/Documents/博物馆/`，不包含其他任务的后端与部署改动。

最后构建复核：首屏 CSS gzip 47,246 B / 80,000 B；现有 Three 大分块与 VueUse 注解警告仍在，没有新增依赖。最新 axe 全部 112 状态为 0 violations，仍有图片/渐变背景不可自动判定及后台下拉框未挂载引用的 incomplete。`quality-controls.mjs` 最新 50 状态通过：320/768/1920px、CSS 200% 放大、强制颜色，溢出/无名称按钮/小于目标控件均为 0；这是桌面浏览器模拟。人工复看最新版个人中心浅色与 3D 深色截图，记录区与导览已使用统一主题表面。

最终文字背景复验：`premium-background-contrast.mjs --extended` 完成 14 路由 × 两宽度 × 两主题 × 两语言，共 112 页面状态、330 个重叠滚动视口、8,537 个直接文字矩形样本，低于目标 0。`summary-extended.json` 的 `complete=true`；`dist/index.html` SHA256 为 `8c9be8861d6eed57a4f0f9eed33ec42022caad38e7476f8a53e7ea93fca99d91`，与报告一致。前一版 42 项低值的完整报告保留为 `summary-extended-before-navigation.json`；这些包括重复滚动位置，不是 42 个独立缺陷。最终结果覆盖中文/英文首屏以下，不能覆盖嵌套滚动容器未展开内容、全部字形像素、禁用控件或非文本边界。额外留存个人中心与 3D 双主题/双宽度 8 张最终首屏截图供目视对照。

### 前序修复记录

- `BottomSheet.vue`：真实手机宽度浏览器复现首次打开后 Shift+Tab 跳到背景。现在面板自身/面板外焦点均纳入首尾循环；Escape 关闭后恢复触发按钮。
- `ExhibitDetailView.vue`：3D 操作按钮组增加具名 `group`，解决无语义 div 上的 aria-label；保留各按钮原有 Tab 顺序，没有引入需要额外方向键导航的 toolbar。
- 后台深色选中项小字使用可读文字色。此前详情、3D、账户、404 展签对比度、搜索加载中禁止清空的修复保留。
- 首屏背景像素采样发现手机底部导航在器物/商品图片上对比下降，改为稳定主题实体底色，并提高深色导航文字。首页次入口增加轻实体底面，底部预约入口采用可读文字色。
- 独立直接进入深色商城时，空购物车残留浅色面板；此前经过其他路由的截图会被延迟加载的 CSS 掩盖。现在空态样式由共享 interaction.css 自身持有，覆盖侧栏与 Teleport 抽屉；提高空态展签和说明字号，使用主题语义色。新增直接访问与探索后返回商城的样式一致性检查。

## 验证及证据边界

| 项目 | 方法与证据 | 结论边界 |
|---|---|---|
| 单测/构建 | `pnpm test` 59 文件 323 项通过；`pnpm build` 内含 vue-tsc 与资源预算，通过 | 本次增加抽屉首个反向 Tab 与焦点恢复回归；没有验收线上版本 |
| 真实浏览路径 | `premium-journey-audit.mjs`：首页主入口→搜索青铜→搜索结果详情→返回保留查询→清空→实际导航进入展厅→展项 | 桌面使用页面展厅链接，手机使用底部导航；没有用直达 URL 冒充导航 |
| 搜索完整反馈 | 双主题实页拦截一次搜索请求：等待→禁用输入/清空→503 错误→解除拦截并重试成功→无结果→清空 | 加载/错误由浏览器隔离模拟，不是线上故障或后端错误测试；恢复阶段使用真实本地 API |
| 购物车抽屉 | 手机双主题：打开初始焦点→Shift+Tab→连续 12 次 Tab→Escape→触发按钮恢复 | 检查实际组件，非克隆夹具；该场景为空购物车，非支付验收 |
| 后台下拉框 | 点击实际 ElSelect 包装器，验证展开状态、aria-controls 对应真实可见弹层，再 Escape 关闭 | 关闭时弹层未挂载造成的 axe incomplete 得到展开态证据；不代表全部后台表单均已人工审查 |
| 资源选择 | `premium-resource-audit.mjs`，首页/馆藏/展厅/商城 × 390/1440 × 浅深共 16 状态，坏图 0 | 保存 currentSrc、浏览器固有尺寸、呈现尺寸、object-fit/position 与加载优先级；DPR 1，不是全部高密屏验收 |
| 路由样式独立性 | 浅深两主题直接进入商城与先访问探索再进入商城，空购物车的计算背景、背景图、边框一致；合并上述脚本为 13/13 通过 | 专门防止延迟加载的跨路由 CSS 掩盖首次访问缺陷 |
| 首页/商城背景复核 | 最新构建 8 状态、138 个可见文字矩形样本，低于阈值 0；对固定导航遮住的矩形进行命中测试并排除 | 中文首屏有限采样，不是全站/全像素对比度证明；未采样内容仍待核对 |

上述脚本读取既有 `artifacts/sitewide-quality/current-environment.json`；凭据只存在忽略配置，不复制进报告。证据保存在忽略目录 `artifacts/premium-visual-2026-09-10/{journeys,resources,accessibility}`。当前前端 preview 为隔离本地环境，不能把其 9 月 8 日 H2 JAR 测试结果用于证明并行任务的最新后端版本。

## 素材审查表

| 用途 | 当前文件/尺寸 | 焦点与裁切 | 来源/内容边界 |
|---|---|---|---|
| 浅色馆廊封面 | `museum-corridor-hero-hd-v2.webp` 1586×992；2x 3172×1984 | 桌面 cover 居中；手机 portrait 512×998 / 1018×1984，center 48% | `assets/images/README.md` 与 editorial README 登记的概念环境图，不作为真实馆舍实拍 |
| 夜间馆廊封面 | `museum-corridor-dark-image2-hd-v2.webp` 1672×941；2x 3344×1882 | 桌面 cover 居中；手机 portrait 512×998 / 966×1882，center 48% | 已登记网页生成夜景，独立构图；不把日景简单压暗 |
| 器物近观 | `hero-bronze-ding-home-640w-v1.webp`；384/640w 响应式 | contain 居中，四周留白；非首屏 lazy | 复用已登记鼎意象；DOM 图注明确“数字策展配图”，不宣称与真实馆藏一一对应 |
| 首页三主题 | 鼎、玉璧、河图 192/384/640w 版本 | contain 居中；手机独立小图布局 | 来自登记原图的派生资源，无本轮新增生成素材 |
| 馆藏主图和列表 | `/media/responsive/explore-*-user-v2-{320,640}w.webp` | 重点器物和藏品列表 contain，完整器形；主题/文章缩略图 cover | 来源见 editorial README；主题缩略图是内容导航图，不把裁切图作为结构事实 |
| 展厅列表封面 | `exhibit-ding-moonlight.webp` | cover，焦点 50% 52% | 概念展厅入口图；3D 视图缩略图来源另见 exhibits README |
| 商城商品 | `river-line-teacup-set`、`heluo-silk-scarf`、`river-map-notebook` 的 640w 响应式资源 | cover 居中，统一商品舞台 | 沿用素材总账的自主创作第一版展示素材，不新增品牌或真实销售承诺 |

## 未完成项（不等价于通过）

1. axe 的 color-contrast incomplete 主要由伪元素、渐变、背景图片、元素重叠造成；另有符号/短文本和带图片节点无法自动判定。这些仍需背景采样或人工实页核对，不能由 0 violations 推导全页文字/边界达到阈值。
   `premium-background-contrast.mjs` 已补充中文首屏 56 状态、1,075 个直接文字矩形的背景采样；首次 131 项低于目标需复核，不能当作 131 个确定缺陷。抽样间距 3px，保留文字矩形边缘/被遮挡内容引入低值的可能，不覆盖全部字形像素、英文、首屏以下和非文本边界。原始结果在 `background-contrast/summary.json`，针对首页/商城的修复复核单独保存 `summary-home-shop.json`，未覆盖首轮证据。
2. 个人中心记录区与空态链接已消除旧玻璃覆盖，最新 axe 不再报告 link-in-text-block；ElSelect 的引用已取得展开态证据。最新扩展采样已补中文/英文首屏以下的可见直接文字，取代前述首轮有限范围作为最新证据；非文本边界、全部字形像素、嵌套滚动区域与未展开反馈仍未全面验证。
3. 按钮视觉夹具、实页搜索反馈、抽屉、下拉框及本批新增账户反馈仅覆盖已列出的状态；其余控件与全部后台反馈状态尚不能统称“完整状态已验收”。
4. 实体手机安全区、软键盘、系统字体放大和长期 3D 性能未验收。本轮 PATH 与常见 Android SDK/platform-tools 路径未发现 adb，不能把桌面仿真当作真机。
5. 线上版本、素材散列与生产可用性仍待独立核实。既有用户授权不包含本轮自行发布。

无提交、推送、生产数据修改或部署。所有未验项保持原方案门槛，下一轮优先补非文本边界、嵌套区域与剩余真实控件状态证据；真机和线上一致性仍独立待验。

本轮新增/修改文件：`frontend/src/components/BottomSheet.vue`、`frontend/src/views/{HomeView,ExhibitDetailView}.vue`、`frontend/src/assets/{main,interaction,public-responsive-polish,route-admin-legacy}.css`、`frontend/src/test/SharedUi.spec.ts`；新增 `frontend/scripts/premium-{journey-audit,resource-audit,background-contrast}.mjs`；同步本文件、主视觉方案、项目状态和需求追踪。上述路径均以 `C:/Users/Jie/Documents/博物馆/` 为根。保留已有 `panelClass` 等非本轮改动。
# 购物袋反馈补验计划（2026-09-11，进行中）

目标：补齐 F-06/F-07、N-03/N-06 购物袋加载、失败、重试与手机弹层反馈。当前4201构建实测：GET购物袋等待时，弹层错误显示“购物袋还是空的”；证据 `cart-feedback/before-loading-failure.json`。状态保持与辅助语义修复限定于 ShopView、CartPanelContent 和必要回归，不改变 API、订单或支付幂等流程。

实施：先独立表示读取状态并提供读取重试；再把手机弹层打开时的反馈播报归属移入弹层，防止重复播报；最后运行390/1440×浅深×中英文的拦截式真实浏览器流程，验证数量失败保留、支付重试复用同一键及单次建单。截图、对比度工具结果、相关单测及构建归档。所有浏览器业务写请求均拦截，登录只用于本地身份初始化。

风险：读取失败不得误报为空，已有待支付恢复不能被读取状态遮蔽；桌面与手机同时挂载时只保留一个反馈播报源。自动对比度 incomplete 单独保留，不将其计为已验证。
# 购物袋与预约反馈补验完成（2026-09-11）

完成 `premium-cart-feedback.mjs`、`premium-booking-feedback.mjs`：隔离本地身份、拦截所有业务写请求，覆盖 390/1440px、浅深主题、中英文共 8 组。购物袋验证读取中不误报为空、读取失败重试、数量等待/失败保留、支付失败恢复、同一支付幂等键、单次建单、成功清理恢复记录、手机弹层 Escape/返回商品焦点及强制颜色；预约验证日历等待/失败/空/重试、无效手机号不写请求、提交锁定、未确认结果保留表单与同一预约键和请求体、成功禁止重复提交。两脚本均 `complete=true`，购物袋与预约各 8/8 组；构建签名分别为当前 dist 的 `da67b7b40aa589bad9b91c5a2ebbe5953b9af7000ac05b38ffcd58d5a6c7241a`。文字像素补充采样已纳入结果；axe 在购物袋旧字号阶段曾发现 4.19:1 辅助文字，本轮已提高为主题文字和 14px，并由采样复核。

本轮修改：`frontend/src/components/CartPanelContent.vue`、`frontend/src/components/BottomSheet.vue`、`frontend/src/views/ShopView.vue`、`frontend/src/assets/interaction.css`、`frontend/src/test/SharedUi.spec.ts`，新增 `frontend/scripts/premium-feedback-contrast.mjs`、`premium-cart-feedback.mjs`、`premium-booking-feedback.mjs`。未改变 API、路由、权限、订单或预约状态机。
