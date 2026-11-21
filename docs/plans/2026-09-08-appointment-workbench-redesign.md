# 预约页面精致化重构

## 目标与关联需求

重构 `/appointment` 的信息层级、日期选择与预约摘要，使首屏可直接开始预约，并保持全站前端设计风格统一。关联 `F-06`（预约）、`F-12`（中英文）、`F-14`（主题）、`N-03/N-06`（体验与兼容性）。

## 设计依据

- 沿用 `design.md` 的河洛纸墨体系、现有主题令牌、宋体展示标题、无衬线操作文字、Element Plus 图标和 `FluidButton` / `BottomSheet`。
- 2026-09-08 实际查看大英博物馆官方参观页 https://www.britishmuseum.org/visit 与其预约日历 https://ticketing.britishmuseum.org/events?k=general%20admission 。借鉴日期可用性直接可见、参观信息与预约操作分工明确的结构；不复制其品牌、素材和运营规则。
- 访客通常在浏览馆藏后用电脑或手机安排参观，页面应安静、可信、直接可操作。浅深两种主题共享布局。
- 用紧凑标题、14 天日期网格、时段选择、单层联系人字段和场馆图文侧栏组织页面。取消横向溢出日期条及多层金色票券装饰。
- 配色全部从现有 `--theme-*` 和 `--color-bronze` 派生：月白画布、青玉次级表面、墨绿标题、低面积古铜流程点缀；深色继承现有暖墨与古铜。展示字体只用于页面标题，控件使用全站正文与等宽数字。对比度复核后古铜小字混入主文字色，以维持 4.5:1 以上对比度。
- 版式比较：大图封面会延后预约操作；全页表单缺少场馆识别。选用无外框的主任务列与场馆信息侧栏，场馆图片为该页面的辨识元素。

## 影响范围与风险

- `frontend/src/views/AppointmentView.vue`：页面结构、日历可用性、状态反馈。
- `frontend/src/components/AppointmentContactFields.vue`：复用桌面和移动联系人字段。
- `frontend/src/assets/appointment-workbench.css`：预约页和预约抽屉的专属样式。
- 预约相关测试与本文、`PROJECT_STATUS.md`、需求追踪表。
- API、鉴权、14 天窗口、1-30 人边界、预约幂等与草稿恢复保持现有契约。重点回归账号切换、登录返回、响应丢失及日期无名额。
- 旧页面存在大量高优先级 CSS；新结构使用独立命名，计算样式和真实截图作为最终依据。保留用户已有未提交改动。
- 场馆图片复用项目已有概念图与响应式资源，来源见 `frontend/public/media/editorial/README.md`。不新增依赖、外部服务或资源下载。

## 实施步骤

1. 完成当前代码、主题、测试、官方参考和运行环境检查。
2. 重做任务布局、可用日期状态、场馆信息与简洁摘要。
3. 复用联系人字段，保留移动抽屉与既有提交逻辑。
4. 执行类型检查、相关与全量单元测试、生产构建及预约浏览器流程。
5. 复核桌面/手机、中英文、浅深主题、键盘焦点、减少动态效果以及无溢出，和馆藏/商城对照。
6. 更新验证结果、状态和需求追踪，检查 diff，不提交或发布。

## 验收标准

- 桌面及 320/390/760px 手机和平板宽度的日期、文本、按钮完整可见，无横向溢出或内容遮挡。
- 日期始终呈现 14 天；无时段和约满日期有区别，均不可选择；跨月日期可识别。
- 日期、时段、人数、表单、提交与成功状态在浅深主题和中英文下可用；所有操作目标至少 44px。
- 浏览器走通登录续填、预约提交、个人中心状态及不确定响应重试；生产构建通过。
- 场馆图加载正常，全站导航、主题、字体和按钮保持一致。

## 验证结果

- `corepack pnpm typecheck`：通过。
- `corepack pnpm test`：58 文件 / 316 项通过；新增约满与未开放日期区分、自动选中可用时段、人数余量和跨月日期行为验证，更新旧票券布局断言。
- `corepack pnpm build`：通过；初始 CSS gzip 为 47,224 B（80,000 B 预算），JS/CSS 总资源增长预算通过。保留现有 VueUse 注释和 Three.js 大分块提示，不新增依赖。
- 浏览器测试使用 `HELUO_QUALITY_ENV_FILE=../artifacts/sitewide-quality/appointment-environment.json`，执行 `corepack pnpm exec playwright test e2e/appointment-presentation.e2e.ts e2e/business.e2e.ts --grep 'booking text|appointment layout|预约登录|预约落库|mobile contact'`：5/5 通过。
- 24 组画面：320/390/540/760/900/1440px，各覆盖中英文与浅深主题；日期完整、被检文字无裁切、被检控件 >=44px、无页面横向溢出/pageerror，场馆图真实加载。截图：`artifacts/sitewide-quality/appointment-redesign/`。
- 双主题正文、古铜小字、流程编号、摘要标签、隐私说明与输入占位符共 6 类文字，对比度 >=4.5:1。此结果不代表全站无障碍认证。
- 手机：关闭抽屉焦点返回、重新打开保留信息、登录返回保留姓名/手机/邮箱/2 人、真实提交、个人记录显示同一预约编号与人数。电脑：登录续填、创建预约、管理员确认、个人中心状态一致；响应丢失后重试仅恢复原预约，数据库记录为 1 条。
- Computer Use 实页复核了浅深主题、手机英文、馆藏/商城到预约的导航与字体一致性；旧 `4192` 入口是固定旧构建快照，未覆盖。新预览为 `http://127.0.0.1:5190/appointment`，页面 HTTP 200、health `data.status=UP`。
- 首次后台预览子进程提前结束导致连接失败，改用持续运行的预览会话后恢复；旧结构断言、移动抽屉焦点与古铜对比度失败均已修复并重跑通过。手机快照等待抽屉完成展开后采集。
- `git diff --check`：任务文件通过；保留仓库现有 CRLF 提示与其他任务改动。

## 修改文件（绝对路径）

- `C:/Users/Jie/Documents/博物馆/frontend/src/views/AppointmentView.vue`
- `C:/Users/Jie/Documents/博物馆/frontend/src/components/AppointmentContactFields.vue`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/appointment-workbench.css`
- `C:/Users/Jie/Documents/博物馆/frontend/src/views/AppointmentRecovery.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/views/AppointmentMobilePerformance.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/views/RemediationViews.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/test/MobileRouteRuntime.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/ControlSurfacePolish.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/src/assets/glassMaterials.spec.ts`
- `C:/Users/Jie/Documents/博物馆/frontend/e2e/appointment-presentation.e2e.ts`
- `C:/Users/Jie/Documents/博物馆/docs/plans/2026-09-08-appointment-workbench-redesign.md`
- `C:/Users/Jie/Documents/博物馆/PROJECT_STATUS.md`
- `C:/Users/Jie/Documents/博物馆/docs/01-requirements-traceability.md`

## 未验证项与下一步

- 本次未发布 PocketBay，未执行 Git commit/push。预览使用现有隔离 MySQL 服务；没有修改生产数据。
- 实体 iOS/Android、原生输入法、系统屏幕阅读器/强制颜色、真实 SMTP 邮件未验收。后端代码未修改，本轮未重跑 Maven、Docker 镜像及预约以外全站业务 E2E。
- 下一步为用户检查预览效果，再按发布流程部署该增量。当前工作树还包含其他任务的未提交修改，发布时需重新确定完整源码快照。
