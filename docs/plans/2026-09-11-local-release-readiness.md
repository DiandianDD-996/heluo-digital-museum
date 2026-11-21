# 全方位优化本地发布准备记录

2026-09-11 后台选择专项收尾：当前467文件候选1789095823227运行于4209。关联文物缺省0已修复，未选拦截/聚焦、失败保留草稿、成功重置通过8组；独立H2真实DRAFT创建与匿名404通过。327单测、类型检查、独立构建/预算及192静态等价通过。最终报告 `artifacts/holistic/select-verification-20260911/1789096523209/summary.json` complete=true、passed=true，8组24菜单、558文字矩形样本、最低7.442、零失败。旧低值来自截图与坐标失配，没有修改配色。只覆盖已测菜单状态，不替代固定头所有遮挡位置、系统菜单和读屏验收。真机按用户指示延期；场馆事实、平台线上与人工门禁仍保留，整体未标完成，未提交/上线。

## 2026-09-11 后台关联文物候选（当前版本）

当前候选 `heluo-release-candidate-1789095823227`，467文件、独立4209/H2；4207保持原样。相对4207仅AdminOperationsView.vue及其AdminQuality.spec.ts改变：初始关联文物用空值，缺少有效选择时阻止提交并聚焦，保存失败保留草稿。没有共享CSS、首页、预约、商城、3D查看器或后端变化；increment-summary.json已断言精确两文件差异。

- 源清单SHA256 `5de6abe695986e53ae79a74b94a16dcfede2856d65149fea41cd28d9794e66db`。
- Docker image inspect ID `sha256:4c29b9e998aa4904fa06fddfbbd2506cd28cc034dbd5a6540d9e40532a6a787d`；build config digest `61d7ee4b92914947de3f638e8cf00f6da7c1e1eec4d1d638c2ab6d8d58b7cc0e`。
- 实页HTML SHA256 `2ca809f10772587e7b051efc80062c4d100bdd1eb65b317a06a64c86dbcfff08`。
- 源包19,957,317字节、467条逐一核验，SHA256 `01adf55a772728658b00ce8a61e034fbea04eff358d9e6727c7cf830e2c0c3c9`。父目录含私有环境凭据，仍只把source.zip当作源包。

已通过：60文件327单测、类型检查、独立生产构建与Docker实际运行health/ready；192静态文件与select-fix-preview-20260911逐字节相同、源码无漂移；8组关联选择/失败重试/重置浏览器检查；真实创建草稿、刷新与匿名404。资源预算使用原脚本仅替换独立产物路径，CSS首包47,576 B、JS gzip509,614 B、CSS总gzip104,319 B，通过既有5%增长门禁。

证据位于当前候选目录的runtime-summary.json、static-equivalence.json、increment-summary.json、package-summary.json、exhibit-create-summary.json，以及select-verification-20260911/exhibit-1789095986652/summary.json。该真实创建只在新候选H2卷保留一条测试草稿，不做线上写入。未重新跑无变更模块的全量后端/全站业务/axe；此前报告以精确源码等价限定关联，不算新版本重跑。

下拉菜单文字采样经历位置错配，最终结果见select-state-verification专项；complete表示执行结束，须同时检查passed/failures，不能单凭complete宣称通过。用户已明确先跳过真机，记录延期未验收；场馆定位、平台能力与其余适用人工门禁仍需按事实处理。未Git提交或生产发布。

## 2026-09-11 10:48 首页对齐候选收尾（当前版本）

当前候选为 `heluo-release-candidate-1789094445104`，467文件、独立回环 `http://127.0.0.1:4207`、独立本地H2卷；旧4205保留。相对4205唯一运行源码变化为 `frontend/src/views/HomeView.vue` 的主题卡片CSS，其余变化为五个审计脚本，未删除输入文件。`increment-summary.json`记录完整比较及旧/新实页尺寸。

- 源清单SHA256：`898a23099eb6fefc57ad0ac9845159ddff7c3b6f6ff46b76f626f4365858c781`。
- Docker image inspect ID：`sha256:46691ad4cc54ad122900c8511fd71da6f07d9c8c52c1f6e8c7124d21d779b9b4`；build config digest为 `5000856ca33118061a41e4b1dd359069af33a069f2cb6d643724c21ad1a2adec`，区分两种标识。
- 实页HTML SHA256：`16519ec976f5b6a79d72b7f431f6b8e19d7546942262fc513ba1e09dce0edc64`。
- `source.zip`为19,956,793字节，467条逐一与清单相同，SHA256：`fb9be4d686036c4b0a4393cd693ab7067cfdb81081f34b0d2f715d7187124fc1`。仅此ZIP是源包，父目录含私有local-environment.json，不整体分享。

本轮通过：独立Vite构建及根Dockerfile构建、vue-tsc、首页2文件6单测、实际health/ready UP；HTTP13项；16组首页布局/分类导航；首页故事→鼎详情→3D→返回刷新及390px来源链接。192静态文件与 `artifacts/holistic/home-alignment-preview-20260911` 逐字节一致，构建后工作树源文件无漂移。人工查看新Docker1440浅色中文截图，图框和展签对齐、器形完整。

候选目录 `artifacts/holistic/heluo-release-candidate-1789094445104/` 下保存runtime-summary.json、static-equivalence.json、increment-summary.json、package-summary.json；专项报告为 `artifacts/holistic/home-alignment-1789094728423/summary.json`、`deployment-1789094727765/summary.json`、`content-browser-1789094727950/summary.json`。

验证边界：本次未重跑4205的14项完整业务、112状态axe、50响应式与商城/预约背景全量测试；它们只作为源码未变模块的历史证据，不能写成4207全量通过。首次首页单测路径误填views目录，未找到测试；核对实际test目录后6项通过。构建仍有既有VueUse注释和Three.js chunk大小警告，没有为CSS小修扩展依赖/打包重构。

截图Docker故障当前已恢复：Desktop running、Linux29.6.1，本轮实际构建及服务验证成功，无出厂重置或数据删除。仍未验证Windows重启复发。场馆性质、平台路由/索引/冷启动、原生后台隐藏、真实手机及剩余人工辅助功能验收保持未完成；无Git提交、推送或生产发布。

## 2026-09-11 10:35 候选全站增量验收

在实际4205候选1789093399666完成：axe 112状态0 violations、120规则级incomplete保留；响应式50状态无溢出/无名按钮/过小控件；受本轮修改影响的商城/预约16状态、32滚动视口、996文字矩形背景采样无低值。三份报告均为HTML指纹 `da67b7b40aa589bad9b91c5a2ebbe5953b9af7000ac05b38ffcd58d5a6c7241a`，分别位于候选目录的 `accessibility/summary.json`、`controls/summary.json`、`background-contrast/summary-extended-shop-appointment.json`。axe脚本额外核对首尾服务指纹。

本轮只改premium-accessibility-audit、quality-controls、premium-background-contrast三个审计脚本：增加独立报告目录、用实际服务HTML标识版本；背景脚本支持显式axe报告输入。语法检查通过。捕获清单逐文件复核只有这三个脚本变化，运行源码/部署配置无变化；候选源ZIP没有包含这些后补审计脚本改进，既有镜像和业务验收仍对应相同运行源码。首次背景命令读到了另一任务正在刷新中的历史路径报告，因不足112状态正确拒绝执行；改为本候选完整报告后通过。没有修改产品来绕过验证。

本次结果不代表全部字形、嵌套滚动区域、原生系统缩放或读屏通过；50状态的放大采用CSS zoom。真机adb与9222仍不可用。平台索引/分享/空闲恢复、场馆事实和完整人工门禁未完成；全目标继续保持未完成。源包、旧报告及容器保留，未提交、推送或生产发布。

## 2026-09-11 10:27 统一增量候选

本节取代下文02:51候选作为当前本地交付版本。前端任务已明确完成并释放编辑；购物袋/预约最终报告为8组各自通过，326单测、类型、构建与预算通过，详见视觉验收文档最终交接。

- 候选 `heluo-release-candidate-1789093399666`：466文件冻结，捕获前后稳定；构建后再次逐文件核对当前源码无漂移。包括危险按钮、购物袋读取/重试、手机继续挑选焦点恢复、BottomSheet与interaction样式。
- 源包 `artifacts/holistic/heluo-release-candidate-1789093399666/source.zip`，19,954,618字节；SHA256 `fbd087379a9532673e27738a2d1f0947f27ab458818346ae8231cac022769112`。466个ZIP条目内容散列逐一匹配清单，无额外条目。只分享source.zip，父目录含私有local-environment.json，不得整目录分享。
- 清单SHA256 `1faad7124291e21b3bf1fa8875a90dac2031e48136b6fb4dbde4df5d353dbb5d`。根Dockerfile实际构建退出0；镜像 `sha256:80f3ce4cd5e0f519f28ffa4f1a93f1aa46a8f922e0e551e853f1538774770778`。
- 新容器独立4205及新H2卷，health/ready均UP，旧服务未替换。HTML SHA256 `da67b7b40aa589bad9b91c5a2ebbe5953b9af7000ac05b38ffcd58d5a6c7241a`。
- `static-equivalence.json`：192静态文件与已验收dist逐一相同；动态robots/sitemap另验。由此可关联最终购物袋412文字/68截图、预约104文字/56截图的证据，不把更旧全站扫描当作本版全站通过。
- 同目录 `business-results.json`：14/14通过（含预约、支付响应丢失、权限、后台发布及竞争）；HTTP13项报告 `artifacts/holistic/deployment-1789093545120/summary.json`；内容与390px来源换行 `artifacts/holistic/content-browser-1789093546698/summary.json` 通过。runtime-summary.json保留运行身份。

尚未完成：新版本全站共用弹层影响的最终门禁、真机、平台路由/索引/冷启动、场馆定位。后端源码相对已验收Compose未变化，但不能将新H2业务回归等同新MySQL部署。生产未发布；本地候选准备不构成生产批准。

2026-09-11 增量更正：候选1789066042877为02:51已验收历史产物，不含之后的危险按钮CSS修复及活动前端任务购物袋变更。危险按钮独立预览定向验收通过，见control-state-completion；需统一刷新候选，不把本文历史“最新”表述当作当前源码等价证明。

日期：2026-09-11。关联 F-01/F-03/F-05/F-06/F-07/F-09/F-10/F-11，N-01 至 N-06。

## 当前判断

2026-09-11 02:51：已形成可检查的本地发布候选 `heluo-release-candidate-1789066042877`，包含最新后台弹窗修复。完整源包、镜像与真实业务路径已经验证；全方案仍未完成，也未获生产发布结论。以下“构建与证据”保留历史批次，不以旧描述覆盖本节最新结果。

- 源包：`artifacts/holistic/heluo-release-candidate-1789066042877/source.zip`，460 个文件、19,649,350 字节，SHA256 `5ba8d5abbc1c25aa08b83b52a2e50dd3783862ea32bcd2928f127765850f3acc`。ZIP 每个条目已与逐文件指纹核对，禁止路径 0；环境文件、备份、上传数据及构建产物不在包内。
- 清单：同目录 `fingerprints.json`，SHA256 `afcd4b400e50e61dad4012fc414e288c8cd4eefbf6835b4973b86a61d46fee58`。捕获前后文件集及散列一致，02:52 再查无源码漂移。对比上个 Compose 快照，运行代码仅 `AdminConfirmDialog.vue`、`route-admin-legacy.css` 两处变化，后端不变。
- 镜像：实际根 Dockerfile 构建成功，标签 `heluo-release-candidate-1789066042877:local`；本机镜像标识 `sha256:e4d3abf6a684373ba873e43244624e26035010a64339511793934f5e6b4d0da4`。独立回环端口 4202、新 H2 数据卷，不替换 4196/4197 或线上服务。
- 运行：health/ready 200/UP；14/14 浏览器业务、13 项 HTTP、首页故事→鼎详情→3D→返回/刷新及390px来源换行通过。证据：候选目录 `business-results.json`、`runtime-summary.json`；`artifacts/holistic/deployment-1789066276275/summary.json`、`content-browser-1789066276464/summary.json`。
- 版本对应：候选服务的192个静态文件（24,392,255字节）与当前验收 preview 的 dist 逐文件完全一致；动态 robots/sitemap 不参与静态比较，另由13项HTTP检查覆盖。报告 `static-equivalence.json`。HTML 指纹 `640e4fd299fb2e2560562b6f3aed479f36146924baf1b082356a2f3ae3422ee4` 与最新前端报告相同，且不是仅凭 HTML 推断全部资源一致。
- 最新前端报告：同指纹 axe 112状态0 violations、背景330视口/8,393文字样本、50响应式状态、88输入边界样本、后台4组24检查。此静态等价证据可关联候选镜像的前端版本；不扩大到全部控件状态、真机或线上版本。

只可把 `source.zip` 当作候选源包；父目录含私有本地环境元数据，禁止整目录分享。首次捕获误纳入已有 `deploy/backups` 文件，已标记旧候选1789066013762无效、保留本地且未压缩/上传；改用部署文件白名单后重新捕获并核验通过。首次业务命令因 PowerShell 逗号参数解析未启动测试，加引号重跑后14项全部通过，不把失败命令计为验收。

线上仍是旧版：公开唤醒后短期访问正常，iframe站内导航不更新外层地址、外层noindex/robots归平台、线上sitemap401；详见平台访问记录。真实运营场馆定位、平台支持机制与真机条件仍未确认。下一步完成剩余控件与真机门禁，根据平台能力处理路由/索引/冷启动，再进入独立授权的发布流程。

## 构建与证据

### 2026-09-11 02:32 同源根Dockerfile补验

根镜像 `heluo-pocketbay-quality-1789064953595:local` 使用上述新Compose的同一前后端冻结源码，镜像配置SHA256 `c4a84285a0ffcf8e2d0ce5d3a3ec07aecf6c151a9fdf4d5c8db858726295e986`。完整新建脚本退出0；HTTP13项、业务14/14、首页故事→来源→3D→返回及手机换行全部通过。重启5014ms恢复ready，4条已支付订单及原令牌保留。证据：`artifacts/holistic/deployment-1789065065267/summary.json`、`artifacts/sitewide-quality/business-pocketbay-results.json`、`artifacts/holistic/content-browser-1789065066764/summary.json`、`artifacts/holistic/pocketbay-restart-1789065104104/summary.json`。

当前工作树前端60文件/324单测通过。构建前散列核对发现相对Compose快照仅验收脚本premium-admin-feedback发生变化，业务源码包括AdminConfirmDialog焦点修复已在快照中；之后改动仍需再次核对。旧4197容器已停止，镜像/卷保留，旧元数据与报告分别备份为pocketbay-environment-before-final-20260911.json和business-pocketbay-results-before-final-20260911.json。不作为生产发布、平台冷启动或真机通过依据。

### 2026-09-11 02:27 更新快照

隔离Compose `heluo-quality-1789064712241` 已以452文件快照构建并启动，源码散列在其 `artifacts/sitewide-quality/heluo-quality-1789064712241-source/fingerprints.json`。新快照包括已接入的首页故事和来源链接。业务E2E14/14、HTTP13项、首页→鼎详情→3D→返回/刷新及390px来源链接检查均通过。报告分别为 `artifacts/sitewide-quality/business-docker-results.json`、`artifacts/holistic/deployment-1789064829953/summary.json`、`artifacts/holistic/content-browser-1789064831833/summary.json`。

旧Compose已停止但容器与卷保留，旧环境元数据及业务报告分别备份为 `docker-environment-before-final-20260911.json` 与 `business-docker-results-before-final-20260911.json`（元数据含凭据，不分享）。Compose脚本修改后的完整停止/新建分支均退出0。本快照之后前端仍在处理后台确认弹窗焦点，不能称全站最终版本；根Dockerfile4197仍为旧快照，不借用本次结果。没有生产发布。

| 环境 | 冻结源码/标识 | 已验证 |
|---|---|---|
| Compose Nginx/Spring Boot/MySQL | 项目 `heluo-quality-1789058403115`；`artifacts/sitewide-quality/heluo-quality-1789058403115-source/fingerprints.json` | HTTP 13、业务 12/12、内容关联、Mailpit 6 封、最高 10 VU 的 1,233 次公开请求 |
| 根 Dockerfile Spring Boot/H2 | 镜像 `heluo-pocketbay-quality-1789059247091:local`；镜像配置 SHA-256 `0ce22ef191d2a2ad958e871afa12a16703e26e0c65cbc7369b38f44dcac183c6`；`artifacts/sitewide-quality/heluo-pocketbay-quality-1789059247091-fingerprints.json` | HTTP 13、业务 12/12、内容关联、容器重启后 5 条已支付订单和令牌保留 |

详细报告路径见主方案的“Compose 统一验收”。前端模块来自同一冻结来源，根 Dockerfile、入口脚本及 dockerignore 单独记录散列。后续工作树变化不自动进入这些已验证镜像。最终发布前重新冻结、构建、运行受影响门禁并确认版本散列，不能只复用测试数量。

## 本轮业务与数据变化

- 后端公开索引使用配置化绝对基址，精确允许 GET/HEAD；撤回、删除及停用分类内容不公开。
- 新增独立鼎记录和来源故事；V24 只修复符合已知初始数据特征的鼎展项关联，保留爵与管理员自定义内容。14 项隔离 MySQL 迁移测试包含失败原子回滚。
- 库存竞争、重复支付、支付/取消/过期竞争增加证据，不改变既有模拟支付边界。
- 所有新增业务测试记录在独立数据库中；本轮没有生产数据迁移、提交、推送或部署。

## 恢复与风险

### 隔离 MySQL 逻辑恢复演练（2026-09-11）

新增 `frontend/scripts/holistic-restore-audit.mjs`：验证目标容器的 Compose 项目标签及固定测试库名，使用一致性逻辑备份恢复到新建、唯一命名的测试库，不覆盖源库。凭据只引用容器内环境变量，不进入宿主机命令参数。备份含测试账户哈希，仅保留忽略目录，不应分享或提交。

实际恢复 21 张表、24 条成功迁移；完整导出比较除 MySQL 自动补写的等价 `CHARACTER SET utf8mb4` 列声明外一致，INSERT 数据未作归一化。原始和规范化 SHA-256 均记录在 `artifacts/holistic/restore-1789062802107/summary.json`，退出 0。第一次逐字比较因上述声明差异失败，记录与新库 `museum_restore_1789062741963` 保留；成功复验新库 `museum_restore_1789062802107` 也保留，两者均在隔离 MySQL 中，未删除数据。

后续应用补验：`holistic-restored-app-audit.mjs` 使用同一后端镜像、关闭初始化管理员、延后过期扫描，连接恢复库并仅在回环4198启动。health/ready、既有管理员登录与ADMIN角色、52订单/50预约API总数与恢复库对账、公开鼎详情及3D关联均通过。报告 `artifacts/holistic/heluo-restored-app-1789063092209/summary.json`。只给隔离应用账户授予新恢复库权限；原业务库未修改。临时应用已停止、容器保留。首次检查误用单值role而非实际roles数组，修正断言后重跑退出0，失败报告也保留。

上述02时演练只证明恢复后读取。11时补验将当前Compose测试库恢复至museum_restore_1789097018018，21表24迁移和数据等价通过；4209同前端+Compose实际后端连接新库，14/14浏览器业务通过，订单26→52、预约25→50。报告`artifacts/holistic/restored-business-20260911/1789097179493/summary.json`；4210后端和4211预览已停止，库及容器保留。首次ESM配置失败、第二轮预览连接中断保留失败证据，第三轮通过不证明第二轮原因已解决。详见restored-business-verification。本地恢复后业务写入缺口已补齐；不证明生产备份、H2文件恢复、跨版本恢复或实际RTO/RPO。最终发布仍需真实生产前置资料与独立授权。

本地 Compose 停止使用 `quality-docker-environment.mjs --stop`，保留数据；4197 容器仅在核对名称后使用 `docker stop heluo-pocketbay-quality-1789059247091`。不要删除卷、镜像或用户原有容器。Docker Desktop 通信目录备份按专项修复记录保留，未经必要性判断不覆盖正在使用的运行时目录。

生产迁移前需要只读核对当前目标 slug、来源、公开状态和关联，取得数据库备份并实际验证可恢复性。V24 已执行后不得编辑历史迁移。业务回退应使用经过审核的补偿迁移恢复原关联，保留新增内容及后续用户编辑，不能重置整个数据库。本轮尚未为真实生产数据生成或执行补偿脚本，也没有做生产备份恢复演练。

根镜像启动脚本第一次在服务就绪后触发 Node/Windows 退出断言；容器与 HTTP 正常。已改为等待子进程关闭和自然结束，`--check` 退出 0；完整新建流程没有再次重建验证。该脚本只用于本地验收，不进入生产运行入口。

## 剩余门禁

1. 来源链接及首页故事已接入，最新后台修复已纳入候选镜像并通过业务回归；仍需完成其余控件状态与人工可访问性门禁，后续代码变化须重新核对候选指纹。
2. 确认项目是否真实对应运营场馆；据事实统一首页、预约、详情及通知中的参观承诺。
3. 平台侧只读核对版本、事件、启动/代理日志和 iframe 路由；公开唤醒解释了本次休眠链路，不能解释全部历史204。正式环境持续观察和空闲冷启动仍未完成。
4. 实体手机 10 分钟 3D、触屏/软键盘/安全区、系统强制颜色等人工验收。
5. 候选源包与本地恢复材料已准备；上述门禁满足后核对它们仍对应最终源码，再完成生产前置数据核验、备份和恢复安排，按既有协作规则处理生产发布与 Git 提交的独立授权。

## 验证记录

2026-09-11 当前Compose页面性能：四核心页各三次、12次全新Chrome/冷存储Lighthouse模拟网络采样完成，首页/馆藏/预约/商城LCP中位数分别606.8/678.5/687.6/781.6ms，CLS分别0.00486/0.00234/0.00573/0，全部满足2.5s/0.1目标。条件固定RTT40ms、9000Kbps、CPU4倍减速；本机模拟不代表公网或真实用户INP。报告 `artifacts/holistic/performance-compose-1789064712241/summary.json`，保留12个单次报告；首尾HTML SHA256均 `6b6e2d6bf3a887831058b6d73cb5910459f6799f4ff21dbb297b392179444c99`。脚本增加环境文件/输出目录参数与首尾指纹检查，退出0。后台弹窗后续样式未包含在本冻结镜像，最终变更影响仍须核对。

2026-09-11 3D逐循环资源补验：同一Compose快照运行 `three-quality-audit.mjs --recovery-only`，每次同展项就绪后读取renderer公开计数，20次均为11 geometries/7 textures；退出后渲染停止、Canvas和监听基线稳定，故障恢复检查错误0。报告 `artifacts/holistic/three-resource-compose-1789064712241/recovery-summary.json`。本次未重复四种显示状态；沿用同镜像上一轮该部分证据。此计数属于当前renderer，不能证明浏览器驱动层全局显存无泄漏；后台真实隐藏及真机长运行仍未验证。它补充下方历史“逐次未断言”记录。

2026-09-11 当前Compose 3D复验：`MUSEUM_QA_URL=http://127.0.0.1:4196`，新增可选 `HELUO_THREE_OUTPUT` 将报告隔离保存到 `artifacts/holistic/three-compose-1789064712241/summary.json`。4种视口/主题状态、模型失败重试、WebGL上下文恢复、点云采样取消重试、滚出视口暂停恢复、20次进出、加载期间退出均通过，错误0；退出后渲染提交停止、Canvas回到基线、监听计数稳定、无上下文数量警告。无头浏览器未真正触发后台隐藏，该项明确未测；移动模拟不代替真机。20次循环尚未逐次断言renderer几何/纹理资源数，不能以Canvas清空代替全部GPU资源释放证明。

2026-09-11 重建工具收尾：Compose 验收脚本与根镜像脚本一样等待 Docker 子进程 `close`，释放日志句柄并自然返回，避免强制退出时仍有活动句柄。增加 `--check`，仅校验固定回环地址和隔离项目名称后访问 health/ready；实际运行两项 UP、退出 0。此结果只证明当前既有环境及检查分支，修改后的完整新建/停止分支将在最终源码冻结后验证，不提前标记通过。

最新后端 11 类/66 项测试及 package 成功；两套 Docker E2E 各 12/12；Compose 压测 P95 6ms、最大 66.66ms、错误率 0%；PocketBay 本地重启到 ready 6,016ms。都属于本机实验室结果，不作为公网服务可用性承诺。
