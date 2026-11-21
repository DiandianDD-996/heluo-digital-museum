# 河洛数字博物馆全站细节优化实施计划

日期：2026-09-08。状态：本地实现与自动验收已完成，性能风险、真机与外部验收留项；用户未授权提交或线上发布。

## 目标与范围

保留河洛文化、青玉古铜、浅深主题与核心 3D 体验，提升全站视觉一致性、操作连续性、异常恢复和答辩可复现性。覆盖公开浏览、内容详情、账户、预约、商城、个人中心、内容与运营后台。

关联需求：F-01 至 F-14、N-01 至 N-06、A-01/A-02。既有完成状态代表历史验收，本次增量按下表单独记录，不把历史结果当作本轮通过。

## 当前基线与证据边界

- 起始 HEAD：`d222c2269da68bc18ca863aaaff71fbfd8cefab3`；当前已有大量 tracked/untracked 改动，实施基于整个工作树，禁止回退。
- 线上最后记录 release 639；只读检查实际显示 PocketBay 休眠页，尚未证明线上与当前工作树一致。
- 2026-09-05 记录的 264 个前端测试、28 个后端测试属于历史结果，需重新执行。
- 本轮开始时 Docker daemon 未运行；已有 4173/5173 服务不能当作博物馆服务使用。
- 当前源码问题：记录分页截断、URL 查询状态缺失、网络故障清会话、购物车响应竞态、后台筛选串扰、支付过期取消回滚、点云仅一次降级、异常清理不完整。

## 阶段与状态

| 阶段 | 工作 | 状态 | 验收 |
|---|---|---|---|
| 1 | 当前代码构建、版本指纹、页面和关键状态基线 | 本地基线已采集 | 112 状态截图，无页面溢出/pageerror；关键故障回归另附 |
| 2 | 请求/认证、购物车、支付事务、重置令牌、场馆时区、通知 | 本地通过 | 后端 42 项、MySQL 浏览器业务 6 项通过；真实 SMTP 不在范围内 |
| 3 | 令牌、共享控件、任务页和后台材质收敛 | 本地矩阵通过，人工留项 | 改后 112 状态和控件 50 状态通过；全站逐元素对比度、真机辅助设置待验 |
| 4 | 导航、搜索 URL/分页、详情、预约草稿、个人记录、后台草稿 | 本地流程通过 | 三角色闭环、完整分页与提交恢复通过；真机键盘/触控待验 |
| 5 | 内容图片响应式变体、点云分批采样、降级与资源清理 | 本地通过，性能风险留项 | 3D 4 组与 20 次进出通过；首次 render 约 450ms，真机长时间 FPS 待验 |
| 6 | MySQL/浏览器 CI、就绪探针、请求编号、演示材料 | 本地交付完成，CI 待验 | ready/缓存/404/版本证据、三分钟演示与 MySQL 备用环境完成；GitHub 首次 CI 和线上同版本未验 |

## 实施约定与影响范围

- 请求 API 向后兼容，默认超时 15 秒，可传 AbortSignal；401 合并处理，403 不登出，网络故障可重试，写操作不自动重放。
- 购物车变更顺序执行，结算等待全部变更；超时订单事务提交后返回 409；重置令牌原子消费；业务 Clock 使用 Asia/Shanghai。
- 邮件事务提交后异步发送并有限超时，记录失败；真实 SMTP 和持久化补发队列不在本轮。
- Explore 使用 `q/category/page`；查询变更复用组件且不抢焦点；现有 ContentPage 用于完整分页。
- 预约草稿只在当前标签页内存保存，重登后重验时段，成功提交后清理，不持久化联系人。
- 样式按令牌、共享组件、页面布局分工，先验证替代再清理覆盖；不全项目格式化，不引入大型运行时依赖。
- 图片由现有自创媒体生成 320/640/960px 变体，保留来源；3D 可取消分批采样、连续档位降级、及时幂等清理和失败回退。
- 新增 `GET /api/v1/ready`，保留原 health；请求 ID 在响应与日志一致。数据库演进如需修改只用 Flyway。
- 文件责任：后端工作者仅 backend；交易工作者仅 api/auth、预约/商城/个人记录；3D 工作者仅 Viewer/质量工具；主代理负责路由/公开与后台视图、样式、资源、验证脚本、CI 和文档。每个文件同一时间一个编辑者。

## 逐页交付

| 区域 | 交付 |
|---|---|
| 导航/首页 | 稳定品牌和工具入口、安全区、明确 404；品牌首屏可见，主题入口直达馆藏分类 |
| 馆藏/详情 | 查询 URL、总数与完整分页；标题/元信息/来源、长文目录、返回位置和失败恢复 |
| 展厅/3D | 完整主体、统一控制、忙碌反馈、逐档降级、可恢复异常 |
| 预约 | 登录续填、错误分层、时段冲突保留草稿、摘要清晰 |
| 商城/账户 | 购物车顺序更新、结算冻结、支付恢复；网络故障保持登录、记录分页 |
| 后台 | 每模块独立筛选/分页、过期响应隔离、草稿保护、具名危险操作确认 |

## 验收标准

- 工程：前端 typecheck/test/build、相关审计；后端测试；隔离 MySQL 与真实浏览器三角色流程；最终 git diff 检查。
- 流程：搜索/详情返回；登录-预约-后台处理-用户查询；加购-改量-结算-模拟支付-历史订单；内容草稿-发布-前台可见-撤回；越权失败。
- 边界：21 条预约/订单与 25 条搜索结果、响应逆序、断网/503/401/409、重复支付、响应丢失、超时库存恢复、令牌并发、上海午夜。
- 视觉：390/1440px 全页双主题中英文；320/768/1920px 关键区域；200% 放大、键盘、减少动态/透明度、强制颜色。触控区至少 44px，正文对比度 4.5:1，大字/边界 3:1。
- 性能：固定条件下 Fast 4G LCP <=2.5s、CLS <=0.1、交互目标 <=200ms；Slow 4G LCP <=4s。无 INP 样本必须记未测。已测资源预算不得无说明增长超过 5%。
- 3D：点云操作 100ms 内反馈、采样任务 <=50ms；20 次进出无资源持续增长。实体手机 10 分钟 >=30FPS 为真机目标，浏览器模拟不替代。

## 风险与回滚

多层全局 CSS 的加载顺序、异步请求竞态和第三方渲染资源是主要回归面。保留 baseline 构建与只包含本次差异的补丁证据；出现回归时定点修复，禁止重置工作区。隔离数据库与独立端口用于所有写流程。真机、线上写流程、真实网络及未达标指标如实留项；不得声称生产容量或可靠邮件投递。

## 验证结果

- 基线：`node scripts/quality-audit.mjs --baseline`，14 路由 × 2 视口 × 2 主题 × 2 语言，112 状态；页面横向溢出 0，pageerror 0。证据：`artifacts/sitewide-quality/baseline-visual-summary.json` 与 `baseline-screenshots/`。
- 后端最终：Maven 测试 9 类 / 42 项通过，JAR 打包与 Flyway 23 版迁移通过；报告位于 `backend/target/surefire-reports/`，基线与当前环境隔离。
- 前端最终：类型检查、57 文件 / 309 项单测、生产构建通过；JS gzip 约 509KB、CSS gzip 约 116KB、首屏 CSS gzip 约 47KB，均符合锁定预算，不超过 5% 增长限制。早期 289/292 的失败已修复，不作为最终结果。
- MySQL：8.0.41 隔离实例浏览器 6/6 通过，失败/跳过/不稳定均为 0，用时 13.527 秒。覆盖登录续填、管理员确认、用户查看、购物车竞态、支付响应丢失/幂等恢复、内容发布撤回、普通用户 403/他人记录 404、21/21/25 条边界和预约提交响应丢失恢复。报告：`artifacts/sitewide-quality/business-mysql-results.json`。
- 视觉：改后 `current-visual-summary.json` 共 112 状态，溢出/pageerror/坏图均为 0；`controls/summary.json` 共 50 状态，溢出/无名称按钮/小于 44px 控件均为 0。CSS zoom 2 不替代原生浏览器 200% 放大。
- 3D：4 组桌面/移动双主题真实渲染与像素变化通过；重试、WebGL context loss 恢复、点云取消、离屏暂停和 20 次 SPA 进出通过，上下文超限警告从 7 降至 0；采样阶段长任务为 0，首次点云下一绘制机会 2.6–4.4ms。首次实际 render 仍约 450ms，不能声称交互延迟全达标。详见 `docs/reviews/2026-09-08-three-quality-verification.md`。
- 生产配置入口：当前 dist 内嵌到独立 Spring Boot JAR，HTML 散列匹配，JS gzip/immutable、ready 200/UP/no-store、GLB Range 206 通过；未知公开地址 404 且提供 Vue shell。`production-environment.json` 含私有测试凭据，不共享；公开版本索引为 `version-evidence.json`。

### 性能复测（2026-09-08 13:07，上海时区）

Chrome 移动模拟 390×844、DPR 3、粗指针、CPU 4 倍降速，生产配置入口 4191，Fast/Slow 4G 分别测试冷暖缓存。Explore 移动山水图使用较小变体，商城粗指针按钮取消模糊后，12 项适用自动门禁全部通过。

| 路由 | Fast 冷/暖 LCP ms | Slow 冷/暖 LCP ms | 最大 CLS | 可见 blur |
|---|---:|---:|---:|---:|
| Explore | 1452 / 584 | 2716 / 904 | 0.0610 | 0 |
| 商城 | 2024 / 1160 | 3940 / 1428 | 0.0000 | 0 |

Explore Slow 冷 LCP 从先前 4276ms 降至 2716ms，冷传输从 525.2KiB 降至 424.2KiB；商城 Slow 冷仅比 4 秒目标少 60ms，需保留波动风险。最新定向结果归档于 `artifacts/sitewide-quality/performance-final-targeted.json` 和 `.md`。早前六路由报告 `artifacts/performance/mobile-summary.json` 保留原始失败，首页/预约/登录/Profile 的 Fast 冷 LCP 为 1504/1260/1520/1616ms；该文件中的 Explore/商城和旧门禁结论以定向复测为准。Profile 指标只覆盖脚本所记录的页面状态，不替代登录后全部历史记录的性能。

所有 INP 均无有效样本，明确记为未测；本机模拟网络和 GPU 不替代实体设备或线上性能。

复测须在 `frontend` 工作目录执行，避免脚本将报告写到仓库外：

```powershell
Set-Location 'C:/Users/Jie/Documents/博物馆/frontend'
$env:HELUO_PERF_DURATION_MS = '5000'
node scripts/performance-audit.mjs --mobile --base-url http://127.0.0.1:4191 --network all --routes /explore,/shop
```

### 分阶段文件与下一步

以下均为当前工作区文件；完整源文件散列位于 `artifacts/sitewide-quality/version-evidence.json`，不把 HEAD 与 dirty 工作区视为同一版本。

| 阶段 | 主要修改文件（绝对路径） | 下一步 |
|---|---|---|
| 1 | `C:/Users/Jie/Documents/博物馆/frontend/scripts/quality-audit.mjs`；`C:/Users/Jie/Documents/博物馆/frontend/scripts/quality-evidence.mjs` | 发布后另核对部署版本 |
| 2 | `C:/Users/Jie/Documents/博物馆/frontend/src/lib/api.ts`；`C:/Users/Jie/Documents/博物馆/frontend/src/stores/auth.ts`；`C:/Users/Jie/Documents/博物馆/backend/src/main/java/com/heluo/museum/store/OrderController.java` | 保持真实服务范围不变 |
| 3 | `C:/Users/Jie/Documents/博物馆/frontend/src/assets/theme-controls.css`；`C:/Users/Jie/Documents/博物馆/frontend/src/assets/task-pages.css`；`C:/Users/Jie/Documents/博物馆/frontend/src/assets/mobile-performance.css` | 真机与人工对比度验收 |
| 4 | `C:/Users/Jie/Documents/博物馆/frontend/src/views/ExploreView.vue`；`C:/Users/Jie/Documents/博物馆/frontend/src/views/AppointmentView.vue`；`C:/Users/Jie/Documents/博物馆/frontend/src/views/AdminContentView.vue`；`C:/Users/Jie/Documents/博物馆/frontend/src/views/AdminOperationsView.vue` | 真机键盘、触控、原生缩放 |
| 5 | `C:/Users/Jie/Documents/博物馆/frontend/src/components/ThreeExhibitViewer.vue`；`C:/Users/Jie/Documents/博物馆/frontend/src/lib/pointCloudGeometry.ts`；`C:/Users/Jie/Documents/博物馆/frontend/src/lib/responsiveMedia.ts` | 定位首次 render 阻塞；真机连续 10 分钟 |
| 6 | `C:/Users/Jie/Documents/博物馆/.github/workflows/ci.yml`；`C:/Users/Jie/Documents/博物馆/frontend/scripts/quality-mysql-environment.mjs`；`C:/Users/Jie/Documents/博物馆/frontend/scripts/quality-production-environment.mjs`；`C:/Users/Jie/Documents/博物馆/docs/reviews/2026-09-08-quality-demo-guide.md` | GitHub 首次 CI、线上同版本验收；提交/发布须另行授权 |

前后截图分别保留于 `C:/Users/Jie/Documents/博物馆/artifacts/sitewide-quality/baseline-screenshots/` 和 `C:/Users/Jie/Documents/博物馆/artifacts/sitewide-quality/current-screenshots/`。阶段 2/4 的流程证据使用业务报告，阶段 5 的失败前后和画布图位于 `three/`；不以静态截图证明事务或并发正确。

### 授权发布补记（2026-09-08 14:02）

用户在本地验收后明确授权覆盖 PocketBay `#329 / heluo`。deployment `5987` / release `4850` 已 `done/running` 并替换 `639`，阶段 1 的主要部署资源版本对应已补证，阶段 6 的发布入口已可用；Git 提交/推送未授权也未执行。

线上 HTTP 19/20 通过，七个主要路由 HTML、入口 JS/CSS 与当前 dist 一致；health/ready 200/UP、公开 API、匿名 401、GLB Range 206 通过。浏览器搜索返回 3 项且内层 URL 保留 q；预约日期/时段、商城及 3D 实体/主题/俯视可用。

平台 iframe 未同步外层地址，并将未知路由的 HTTP 404 转换为 200，虽然应用恢复页正确可见。本次浏览器实测约 1 FPS 导致 3D fallback、点云禁用，视口覆盖未生效；不得把这次发布写为线上点云、手机或性能验收通过。Docker Desktop 本机内部 socket 错误使本机干净镜像构建未执行，平台构建和运行门禁成功。详见 `C:/Users/Jie/Documents/博物馆/docs/plans/2026-09-08-pocketbay-quality-release.md`。
