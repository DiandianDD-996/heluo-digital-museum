# PocketBay 单容器演示部署计划

## 1. 目标

将当前河洛数字博物馆以 PocketBay 支持的单个 HTTP 容器形式部署，保留 Vue 前台、Spring Boot API、登录、预约、商城、模拟支付、后台管理和 3D 资源。

本次部署是公开内测平台上的演示环境，不替代既定的中国大陆备案生产方案。

## 2. 关联需求

- 功能需求：`F-01` 至 `F-14`，部署后不得静默删除或降级既有业务功能。
- 非功能需求：`N-01`、`N-02`、`N-03`、`N-05`、`N-06`。

## 3. 部署边界与数据选择

- PocketBay 一次只运行一个 Web 容器，不启动 `deploy/compose.yaml` 中的 MySQL、Mailpit 或其他服务。
- 不上传本机 MySQL 数据、备份、`deploy/.env` 或任何未批准的密钥。
- PocketBay 演示环境使用 H2 文件数据库，写入平台持久卷 `/data`；现有 MySQL 驱动、迁移和 Compose 路径保持可用。
- 使用现有 Flyway 迁移建立空库，并由显式管理员初始化配置写入演示内容。
- 邮件必须使用外部 SMTP 才能真实投递；未配置时只验收不依赖邮件送达的流程。
- 动态实例休眠期间，订单超时扫描不会执行；恢复访问后调度任务继续运行。正式生产不得依赖该行为。

## 4. 影响范围

- 根级 PocketBay 多阶段 `Dockerfile` 和 `.dockerignore`。
- 后端增加 `pocketbay` profile，读取平台 `PORT` 和 `/data`。
- 后端增加 Vue History 路由的 SPA 回退控制器。
- H2 从测试依赖调整为 PocketBay profile 可用的运行时依赖。
- 本地生成且 Git 忽略的 `pocketbay.properties`，只在 PocketBay 配对页批准后加密上传。
- `PROJECT_STATUS.md` 与 `docs/01-requirements-traceability.md` 在真实部署验证后更新。

## 5. 实施步骤

1. 增加单容器构建：先构建 Vue，再把 `dist` 写入 Spring Boot 静态资源，最后生成 Java 17 运行镜像。
2. 增加 PocketBay profile：监听 `0.0.0.0:${PORT}`，数据库写入 `${POCKETBAY_DATA_DIR}/museum`。
3. 增加已知前端路由到 `/index.html` 的服务端回退，不覆盖 `/api`、`/actuator` 或静态文件。
4. 生成最小部署配置，只包含 JWT、管理员初始化和明确的演示环境开关。
5. 运行前端测试、类型检查、构建、后端测试、根级 Docker 构建和本地 HTTP/核心 API 检查。
6. 创建 PocketBay 配对会话，让用户确认演示数据库和敏感配置上传。
7. 打包最小构建上下文，上传并轮询至 `project_status=running`；失败时依据平台日志最多修复两次。
8. 验证线上首页、深层路由、健康接口和核心数据接口，再更新状态与追踪表。

## 6. 验收标准

- PocketBay 返回 `next_action=done` 且 `project_status=running`，并提供 HTTPS URL。
- `/`、`/explore`、`/exhibits/heluo-bronze-ding-3d` 和 `/login` 返回可用 SPA 页面。
- `/api/v1/health` 返回 `data.status=UP`。
- 公开内容、搜索、商品和预约时段接口返回初始化数据。
- H2 文件位于 `/data`，重新部署后由 PocketBay 持久卷保留。
- 不上传 `deploy/.env`、本机数据库、备份、设计源资产、Git 历史、依赖目录或构建缓存。

## 7. 风险

- PocketBay 是单节点公开内测平台，无固定 SLA，不能代表大陆三网稳定生产上线。
- H2 仅用于单实例演示；正式环境继续使用 MySQL 8.4。
- 平台休眠会延迟定时订单过期处理。
- 未配置真实 SMTP 时，密码找回与通知邮件不能完成真实投递验收。
- 当前工作区包含大量用户未提交改动；部署包会按白名单生成，不执行提交、重置或清理。

## 8. 验证结果

- `corepack pnpm typecheck`：通过。
- `corepack pnpm test`：通过，37 个测试文件、186 项测试全部成功。
- `corepack pnpm build`：通过；仅保留既有 Rollup 注释位置和大 chunk 警告。
- `mvn test`：通过，19 项测试全部成功；H2 MySQL 兼容模式下 22 个 Flyway 迁移全部执行成功。
- `docker build -t heluo-pocketbay:local .`：通过。
- 全新 `/data` 卷本地验收：`/`、`/explore`、`/exhibits/heluo-bronze-ding-3d`、`/login` 均返回 HTTP 200 和 Vue 挂载节点。
- `/api/v1/health` 返回 `UP`；初始化数据包含 5 件文物、3 篇文章、1 个 3D 展项、3 件商品和 3 个预约时段。
- 3D 模型 `/media/models/heluo-bronze-ding-v5.5.glb` 返回 HTTP 200，大小 5,213,372 字节。
- 管理员登录、`ADMIN` 角色、个人身份接口和后台统计接口均验证成功；容器重启后原登录会话仍有效。
- H2 文件已写入 `/data/museum.mv.db`，容器重启后仍存在并可读取。
- 首个 PocketBay 配对会话已授权项目 `app-2odx`，但三次上传均未达到成功门禁；该阶段没有将候选 URL 误报为成功。
- 第 1 次：`healthcheck_failed` / `health_check`，平台日志显示已有 `/data/museum.mv.db` 为 root-only，`museum` 用户收到 `AccessDeniedException`。
- 第 2 次：`deploy_failed` / `build`，平台传统 Docker builder 不支持 `COPY --chmod`；已改为普通 `COPY` + `RUN chmod 755`，并以 `DOCKER_BUILDKIT=0` 本地验证。
- 第 3 次：`healthcheck_failed` / `health_check`，平台将获批配置以 root-only 挂载到 `/app/pocketbay.properties`；入口降权后 Spring Boot 报 `FileNotFoundException (Permission denied)`。
- 最终修复：入口先复制只读配置到 `/tmp/pocketbay.properties` 并设置 `museum:museum`、`0600`，再修正 `/data` 属主并通过 `setpriv` 降权；传统 builder、root-only 配置/H2 文件、健康、页面、管理员登录和后台统计均通过。
- 用户明确要求重新部署后已创建新会话，复用已有项目 `app-2odx` 并重新批准 `pocketbay.properties`。白名单包共 309 个条目、15,486,376 字节，禁用项为 0；从压缩包解出的全新上下文执行 `DOCKER_BUILDKIT=0 docker build` 成功。
- 新会话第 1 次上传的部署 `918` / release `440` 返回 `next_action=done`、`project_status=running`、`framework=dockerfile`，正式 URL 为 `https://app-2odx.pocketbay.app`。
- 线上 `/`、`/explore`、`/exhibits/heluo-bronze-ding-3d`、`/login` 均返回 HTTP 200 和 Vue 挂载节点；`/api/v1/health` 为 `UP`。公开数据为 3 个分类、5 件文物、3 篇文章、1 个 3D 展项、3 件商品和 3 个预约时段。
- 3D 模型 Range GET 返回 HTTP 206，总大小与声明值均为 5,213,372 字节；管理员登录、`ADMIN` 角色、`/auth/me`、后台 summary 和注销通过。Chrome 首页与 3D 展项实页渲染、旋转响应通过，控制台 error 为 0。
- 未在本轮验证真实 SMTP、PocketBay 长期 SLA、大陆三网、平台版本数据回滚或实体设备；演示环境继续使用 `/data` H2，正式生产继续使用 MySQL 8.4。

## 9. 当前工作区覆盖更新（2026-08-16）

### 目标与范围

- 将当前本地工作区覆盖发布到 PocketBay 现有项目 `#329 / app-2odx`，替换当前运行版本，不创建新项目。
- 继续使用根级多阶段 `Dockerfile`，在单容器中构建 Vue 前端并由 Spring Boot 提供 SPA、API 与 3D 静态资源。
- 保留平台 `/data` 持久卷中的 H2 演示数据；不迁移本机 MySQL，不上传 `deploy/.env`、数据库备份、设计源文件、依赖目录或构建缓存。
- 仅在配对页重新批准后随包迁移 Git 忽略的 `pocketbay.properties`，不得输出其中的敏感值。

### 步骤与发布门

1. 运行前端全量测试、类型检查、生产构建与后端测试。
2. 检查白名单压缩包只包含 Dockerfile 构建所需文件和获批配置，并从压缩包解出的上下文完成 Docker 构建预检。
3. 创建 `dockerfile` 配对会话，由用户在配对页选择现有 `app-2odx` 并确认覆盖及配置迁移。
4. 上传候选版本并轮询；仅当 `next_action=done` 且 `project_status=running` 时视为发布成功。
5. 验证正式 URL、Vue 深层路由、health、公开数据、移动 GLB Range 请求与关键缓存头，再同步项目状态和需求追踪表。

### 风险与回退边界

- PocketBay 会先构建候选版本并通过健康检查，再切换网关；候选失败时不得把上传或构建开始误报为成功。
- `/data` 与托管版本数据按平台规则生成单向快照；本任务不主动触发版本回滚或数据恢复。
- 当前工作区包含大量未提交改动，部署包按明确白名单生成，不执行 Git 清理、重置、提交或推送。

### 验证结果

- 发布前门禁通过：前端 `44` 个测试文件 / `244` 项、类型检查、生产构建、后端 `28` 项测试、根级传统 Docker builder；工作树镜像为 `25fe639bb072`，首份白名单包解包上下文镜像为 `edd32bfcfa51`。
- 首次覆盖包为 `283` 个文件、`17,141,626 B`，禁用项和缺失项为 `0`；deployment `968` / release `489` 返回 `done/running` 并替换 release `484`。平台返回的旧默认地址 `app-2odx.pocketbay.app` 随后不可达，但项目实际自定义入口 `heluo.pocketbay.app` 为 HTTP `200`/health `UP`；未据此修改应用源码或重复上传。
- 用户随后反馈移动点云过浅，完成仅限移动/fallback 调色板的二次收口；新根镜像为 `7a01751c04da`，白名单包为 `283` 个文件、`17,141,679 B`，禁用项、缺失项为 `0`。
- 第二次配对接口返回现有项目 slug `heluo`，deployment `972` / release `493` 返回 `next_action=done`、`project_status=running`，成为最终活动版本；正式地址为 `https://heluo.pocketbay.app`。
- 最终线上 6 个 SPA 入口、health、HTML/哈希资源缓存和移动 GLB Range 通过；`412×915` 点云 Canvas 为 `ready/running`、模式切换成功、无横向溢出和控制台 warning/error。未执行 Git commit/push/reset，也未触发平台版本回滚。
- 用户随后反馈移动端“进入互动 3D”被信息入口遮挡；本地完成单一海报操作区和 ready 状态右上信息入口重排，白名单补丁包共 `283` 个文件、`17,443,449 B`，禁用项和缺失项为 `0`，传统 Docker builder 镜像 `578527c0b130` 通过。
- 补丁复用已授权且明确返回 `project_slug=heluo` 的项目会话上传，release `498` 返回 `next_action=done`、`project_status=running` 并替换 release `493`；两个误选到 `heluo-w0ue` 的配对会话均未上传包，也未删除该误建项目。
- 线上 `/`、3D 深层路由和 health 为 HTTP `200`，移动 GLB Range 为 `206 bytes 0-1023/837720`；`320×800`、`390×844`、`412×915` 的 ready 状态信息入口与返回按钮、Dock 重叠面积均为 `0`，无横向溢出，BottomSheet 的 `aria-expanded` 可从 `false` 切换为 `true`。
