# 全站视觉增量发布收口

## 目标与授权
按用户已明确授权，将当前已验视觉增量覆盖更新 PocketBay #329 / heluo。关联 F-01/F-02/F-05/F-06/F-07、N-03/N-06。不提交或推送 Git，不迁移本地数据库，不改既有根 Dockerfile、持久卷及已批准配置方案。

## 发布门禁裁定
- V3.1 O2 要求重点任务 200%；400% 属于复杂内容/合规专项。本轮已有原生200%及真实Tab证据，截图合成限制保留，不额外扩展为全站400%穷举。
- O3 修改焦点/自定义控件应检查 Forced Colors：当前 Chromium 强制颜色4组检查和截图通过。原生Windows系统对比主题未验，不能把模拟写成系统验收。
- V3.0 规定区分既有失败、新失败和已解决问题；不将既有失败改写为通过。本轮Chrome133的3D失败在此前线上版本已存在，3D运行代码和模型未修改。用户要求不更新浏览器，vivo已实测完整模型、旋转、放大、点云及返回实体，另有浅色刷新后显式启动证据。此路径支持真机代表验收，不代表Chrome133已修复。
- 核心验证：构建/类型/预算、329单测、14业务E2E，按证据矩阵限定构建关联；最后一次改动仅强制颜色CSS分支，有定向4组补验。没有新增未关闭的本轮产品失败。
- 全站像素/所有设备不作为新增无限门禁。保留读屏、原生系统对比主题、400%专项、深色登录真机与安全密码截图限制、长期GPU性能及线上业务写入未验。

## 实施与影响范围
1. 核对线上heluo现有版本和授权配置路径，不展示凭证。
2. 将根项目所需前后端源码、公共资源、构建配置及已批准pocketbay.properties打包到独立证据目录；排除依赖、产物、数据库、测试报告、密钥及未批准配置；逐项验证ZIP哈希。
3. 上传一次，等待平台完成候选健康检查并切换；不自动回滚，不创建第二项目。
4. 核对活动release、health/ready和线上真实iframe双主题双视口页面及资源，确认候选资产与本地一致。
5. 更新状态、需求追踪和结果记录，审查diff。

## 风险与验收
平台休眠不等于应用崩溃；必要时使用公开唤醒入口。Chrome133故障明确保留，不能宣称所有浏览器通过。发布后必须返回真实健康响应与运行版本证据，上传成功不等于完成。

## 验证结果
- 发布包415文件、22,367,229字节；SHA256 `711c796a9146c33047016a9d82127ee250c6900911cf7de7bb703b6e7ab80d50`；禁止条目0，解压逐项哈希一致。与release6143相比10文件不同，全部为前端页面/样式/测试；后端、模型及已批准配置未变。
- 平台免配对接口按手册提交name=heluo却返回heluo-7nbn（deployment7752），未实现覆盖。已如实告知用户；该意外副本未执行删除，不以之作为#329发布成功。上传凭证中的projectId=329为客户端意图，返回slug才是实际目标，不能混淆。
- 随后使用已批准且状态验证绑定heluo的原会话上传同一包，返回deployment7753、slug=heluo。该候选release6442在data_sync阶段因平台database_proxy_unavailable失败，active_release_id仍6143、active_release_unchanged=true。响应虽然含running/done，但deployment=failed，因此不是部署成功。
- 平台repair_hint明确为外部服务故障可重试，safe_to_retry=true；原会话同包重试一次，deployment7755。累计三次上传（含一次目标不符）；不再自动追加上传，不改源码/配置、不自动回滚。

## 最终发布结果
- 2026-09-12 23:02 CST复核：#329/heluo，deployment7755，release6443；活动6143→6443；project/deployment均running、next_action=done、error_category=null。
- 公开入口 `https://heluo.pocketbay.app`，实际应用iframe `https://heluo--e.pocketbay.app`；公开唤醒后health与ready均HTTP200、data.status=UP。
- `artifacts/pocketbay-visual-final-online-1789225301883/summary.json`：passed=true，16状态（首页/馆藏/预约/商城×390/1440×浅深主题，中文）通过真实可见导航进入；搜索提交及清除通过，横向溢出0、页面异常0。
- 50项HTTP校验：HTML、health、ready及47个JS/CSS资源。47资源字节哈希全部与本地候选一致。平台HTML额外插入一个确切的pb-embed-hide-chrome样式；只剔除此已逐字核实片段后，HTML哈希等于ffc173ee候选，不宣称原始HTML逐字相同。
- 初次线上脚本HTML严格比较因平台注入样式失败；后续4条Failed to fetch已由独立探针定位为测试拦截 `https://pocketbay.com/api/analytics/collect` 导致，堆栈来自pb-insights.js。仅放行该平台正常浏览统计请求，保持博物馆业务POST拦截及全部pageerror断言，再跑16状态错误0。保留失败报告，不以删除断言获得通过。
- 已检查线上首页浅色桌面、馆藏深色手机/浅色桌面截图；平台外层托管条和反馈浮层属于托管外壳，非项目新增控件。线上业务写入、手机线上3D、全浏览器/系统辅助功能专项未补跑；本地vivo证据不冒充线上实机。
- 当前工作树完整保留，无Git提交/推送/删除/回滚。意外副本heluo-7nbn仍保留，需用户确认后才可删除；不将其视为交付站点。

## 交付文件
本轮新增 `frontend/scripts/verify-visual-final-online.mjs`，更新本计划、V3.1证据索引、PROJECT_STATUS及需求追踪。打包/上传工具和原始证据位于忽略目录artifacts/pocketbay-deploy-current，不包含在发布包内。
