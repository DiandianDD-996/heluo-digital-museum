# 前端视觉方案完成度核对

依据：2026-09-10-premium-frontend-visual-plan.md 第6–8节；2026-09-11现场核对。此表是当前判断入口，历史流水记录保留在premium-visual-acceptance.md。整体尚未完成，不把用户暂缓的真机项目算作失败或通过。

## 版本与证据边界

当前候选为4209，HTML SHA256 `2ca809f10772587e7b051efc80062c4d100bdd1eb65b317a06a64c86dbcfff08`。实际读取候选1789095823227的runtime-summary、static-equivalence和increment-summary：health/ready均true；静态等价报告complete=true、sourceDrift为空；相对4207仅AdminOperationsView.vue运行源码变化，另含相应测试。旧模块报告只按源码不变关联，不写成4209重跑。

## 分批交付

| 原要求 | 已有交付 | 判断与剩余 |
|---|---|---|
| A 基线、首页/探索八状态、控件板、视觉评审 | before/after-visual-summary及截图；4209图集含首页/探索八状态；controls状态板 | 图集已交付。原基线时间为09-10 16:01Z，初轮after为16:27Z，均4189；它们不是最终4209对比。尚不能证明最终版与改前数据完全相同；用户视觉认可未取得 |
| B 首页与共享材质 | 首页对齐16组、公共/账户/浮层计算样式及截图，来源见验收记录 | 已实现并有分项证据；不等同全部控件全状态证明 |
| C 浏览、详情与3D | 导航/搜索/详情、故事来源→3D→返回及故障恢复报告 | 关键路径已有证据；真实设备长运行暂缓 |
| D 预约、商城、账户、后台 | 隔离业务报告；cart/booking/auth/admin反馈；4209下拉专项 | 已测流程有证据；需保留所有状态覆盖范围，未穷尽全部后台反馈 |
| E 检查、文档与交付 | 构建/单测/预算记录、12图、验收记录、状态、需求追踪表 | 原生缩放、人工辅助功能及视觉认可仍缺；发布独立，不作为自动获授权事项 |

## 第8节验收逐项判断

| 验收维度 | 支持证据 | 未证明范围 |
|---|---|---|
| 主次 | 首页/探索/预约12图，人工代表图审查；首页三图与标题对齐已修复 | 用户能否快速理解下一步及最终审美认可需评审 |
| 内容质感 | 来源链接与鼎详情关联、素材审查表、完整器形代表图 | 真实运营场馆定位仍需事实确认，不能据概念素材作参观承诺 |
| 一致性 | 双主题共享材质、全站112状态历史截图、4209增量 | 未测展开态和全部嵌套滚动区不从默认截图推导 |
| 响应式 | 320/390/768/1440/1920相关布局证据；4209三页12图无溢出 | 真机安全区/软键盘/字体缩放按用户要求延期 |
| 可访问性 | axe112状态零violations、文字背景及边界专项、键盘/44px目标；4209菜单采样558矩形零低值 | axe incomplete不等于通过；原生200%缩放未执行，读屏/系统级强制颜色未验；全部滚动遮挡未穷尽 |
| 完整状态 | 见下方真实控件状态覆盖表；四类明确缺口已在4209定向补验 | 代表业务组件的适用状态已有证据，不延伸为每个按钮、所有内容组合、全像素或全部滚动位置通过 |
| 性能 | 冷缓存核心页每页3次实验室报告、预算记录；无新增生产依赖/素材 | 不代表公网、真实INP或低端手机；后续源码变更仍需按影响复验 |
| 业务保持 | 隔离业务、内容路径、权限及4209关联文物真实草稿报告；恢复后14项浏览器业务通过 | 恢复报告1789097179493已读取：passed=true、同4209静态签名、14项零失败/跳过，stopped=true；仅隔离MySQL恢复库，不代表生产/H2/跨版本恢复 |

命令合同：typecheck、test、build以及pointer-pages、pointer-size、Lighthouse已有分批记录；package.json确认命令存在。当前未改产品源码，不为更新数字重复执行，不能把历史执行写作本次执行。

## 当前可执行下一步与环境前置

1. 状态覆盖映射与四类缺口补验已完成，见下表；不继续重复默认截图或无限增加无业务意义的状态组合。
2. 原生缩放需要可用浏览器控制或人工操作。当前cua入口实际报 `unsupported Codex auth method: apikey`，不使用CSS zoom或设备缩放冒充浏览器原生200%。
3. 用户可通过4209图集确认视觉方向；最终改前/改后严格同数据对照尚未证明，不以历史图片拼接代替。
4. 真机维持延期；线上版本/平台能力与生产发布由总方案独立处理。未提交、推送、部署或删除数据。

本次仅生成完成度核对文档，并同步状态/需求追踪；没有产品修改，没有新增测试执行成绩。

## 真实控件状态覆盖表（后续补验）

表中“覆盖”指脚本明确触发并断言的代表业务组件状态，不是全站所有实例穷举。导航链接、标题、静态器物图不要求人为增加成功/提交/禁用状态；详情没有列表空态，错误页承担资源不可用反馈；表单的空输入属于原生必填校验，不是数据列表空态。

| 真实控件/区域 | 适用状态与已有断言 | 脚本与实际报告 |
|---|---|---|
| 搜索与清空 | 加载锁定输入/清空、错误、重试成功、无结果、清空恢复 | premium-journey-audit.mjs；journeys/summary.json |
| 登录/找回邮件 | 密码显隐、提交禁用、错误恢复、找回成功及切换清除反馈 | premium-auth-states.mjs；auth-states/summary.json，8组passed |
| 注册/确认重置 | 提交禁用、失败保留密码、重试成功回登录 | **本次补验**premium-state-gaps.mjs；state-gaps-4209/summary.json，8组passed |
| 个人资料保存 | default/hover/focus/pressed、loading/disabled、error保留、retry/success和公告 | holistic-control-state-audit.mjs；holistic/controls-1789067173815/summary.json，8组passed |
| 个人订单列表/分页 | 加载、错误、刷新、空态、记录、首页/尾页禁用、Enter/Space分页 | 同上；其他个人记录不宣称独立重跑 |
| 预约日历/联系人/提交 | 日历loading/error/retry/empty；日期时段选中；电话无效无写入；pending锁定、不确定结果保留、同键重试成功、防重复 | premium-booking-feedback.mjs与premium-selection-states.mjs；booking-feedback、selection-states的summary.json均8组complete |
| 购物袋/数量/模拟支付 | loading与empty分离、读取失败重试、数量锁定及失败保留、支付锁定及同键重试、成功清恢复、抽屉焦点返回 | premium-cart-feedback.mjs；cart-feedback/summary.json，8组complete |
| 展厅列表 | loading/error/retry/empty/reload恢复真实列表 | **本次补验**state-gaps-4209/summary.json，8组passed |
| 内容详情 | loading/error/retry恢复真实详情 | **本次补验**同上；不为单资源详情制造列表空态 |
| 3D舞台 | 启动/就绪、实体/点云、模型失败重试、上下文恢复、离开释放 | three-quality-audit与资源恢复报告，详见主验收记录；真机长运行延期 |
| 后台代表列表/编辑 | 内容及运营默认列表loading/error/retry/empty/live；编辑pending inert/error保留/retry success | premium-admin-feedback.mjs；admin-feedback/summary.json，4组complete（中文双宽双主题） |
| 后台确认/未保存 | 取消、等待焦点约束、错误保留草稿、继续编辑/丢弃；危险/次按钮hover/focus/pressed | admin-feedback与controls-1789067173815；不是每项业务的破坏性操作重放 |
| 分类/日期/后台标签/选择器 | 选中非颜色标记、键盘、焦点、触控尺寸、禁用适用项；关联文物空值拦截/错误保留/重试成功 | selection-states与4209 select-verification-20260911最终报告 |

除标注holistic或select-verification的条目，报告目录均相对 `artifacts/premium-visual-2026-09-10/`。本次实际读取脚本的断言及报告的checks，不把单测或截图文件存在自动视为流程通过；complete型报告结合脚本抛错行为和既有执行记录判断。旧版本范围继续遵守上方源码等价边界。

补验脚本只访问冻结4209，首尾核对HTML签名，所有API写请求默认拦截；注册/重置专用路由模拟503和成功响应，未发送真实注册/邮件/密码请求。读取展厅及详情时模拟加载/失败/空列表后恢复真实GET。实际退出0，8组×4类流程通过，共104张视口截图、pageErrors与unexpectedWrites均为空；减少动态开启，不代表完整动效或原生缩放。脚本通过执行解析，未改应用源码/依赖/数据库。
