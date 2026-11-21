# PocketBay 当前工作树覆盖部署计划

## 1. 目标

将当前本地工作树覆盖发布到 PocketBay 现有项目 `#329 / heluo`，替换活动 release `498`，不创建新项目、不从 Git HEAD 或远端仓库重建。

本次继续使用根级多阶段 `Dockerfile`，由单个 Spring Boot 容器同时提供 Vue SPA、API 与 3D 静态资源。PocketBay 演示数据库继续使用 `/data` 中的 H2 文件，不迁移本机 MySQL。

## 2. 关联需求

- 功能保持：`F-01` 至 `F-14`。
- 非功能要求：`N-01`、`N-02`、`N-03`、`N-05`、`N-06`。

## 3. 影响范围

- 部署输入：当前工作树中的根级 `Dockerfile`、`docker-entrypoint.sh`、前后端源码、锁文件、迁移和生产媒体。
- 运行配置：仅携带经 PocketBay 配对页批准的 `pocketbay.properties`，作为运行时敏感配置；不在文档、日志或对话中输出内容。
- 平台目标：只选择已有项目 `#329 / heluo`，保留平台 `/data` 持久卷并创建候选版本。
- 项目记录：发布完成后更新本计划、`PROJECT_STATUS.md` 与 `docs/01-requirements-traceability.md`。

## 4. 打包边界

部署包以项目根为根目录，包含 Docker 构建所需的 `Dockerfile`、`docker-entrypoint.sh`、`frontend/` 和 `backend/`。

必须排除：

- `.git`、`.github`、IDE 配置；
- `node_modules`、`dist`、`target`、覆盖率、测试报告和缓存；
- `deploy/`、`.env*`、日志、数据库文件、dump、备份；
- `assets/`、`docs/` 等不参与运行镜像构建的设计与过程资料；
- 除配对页明确批准路径外的任何本地配置或密钥。

## 5. 实施步骤

1. 核对 PocketBay 最新部署协议和现有项目/版本信息。
2. 记录敏感配置的路径、大小与 SHA-256，不读取或输出文件内容。
3. 按白名单生成当前工作树部署包并检查禁用项、必需文件和压缩包哈希。
4. 从压缩包解压到临时目录，使用传统 Docker builder 完成干净构建。
5. 创建 `dockerfile` 配对会话，在配对页选择已有项目 `#329 / heluo` 并批准配置迁移。
6. 上传候选版本并轮询；仅在 `next_action=done` 且 `project_status=running` 时认定发布成功。
7. 验证线上 SPA 路由、health、公开 API、移动 GLB Range、缓存策略和管理员身份/后台统计/注销。
8. 使用 `390x844` 深色移动视口验证点云模式、主题切换、横向溢出与控制台错误。
9. 更新项目状态、需求追踪和本计划验证记录。

## 6. 验收标准

- PocketBay 返回新 deployment/release，状态为 `done/running`，项目 slug 为 `heluo`。
- `/`、`/appointment`、`/exhibits/heluo-bronze-ding-3d`、`/login` 返回 HTTP 200。
- `/api/v1/health` 返回 `data.status=UP`；公开内容、商品和预约时段数据可读取。
- 移动 GLB Range 请求返回 HTTP 206；HTML、哈希静态资源和私有 API 缓存策略保持正确。
- 管理员登录、`ADMIN` 身份、后台统计和注销成功，敏感值不进入日志或文档。
- `390x844` 深色点云可启用并即时切换主题，无横向溢出和应用级 console error。
- 旧活动版本只在候选健康检查通过后被替换；候选失败时不触发回滚或破坏线上数据。

## 7. 风险

- PocketBay 为公开内测演示环境，休眠唤醒、跨境链路和长期 SLA 不由应用完全控制。
- `/data` 数据按平台候选版本规则形成单向快照；本任务不主动执行版本回滚或数据恢复。
- H2 仅用于单实例演示，正式生产继续使用 MySQL 8.4。
- 当前工作树包含大量未提交改动；打包必须基于当前目录并严格遵守白名单，不执行清理、重置、提交或推送。
- 真实 SMTP、实体 iOS/Android、中低端 GPU、三运营商和系统强制颜色不属于本次发布门禁，需在最终报告中保留为未验证项。

## 8. 验证结果

- `pocketbay.properties` 仅记录路径、大小和 SHA-256，内容未输出；配对页批准该唯一运行时配置，无缺失配置路径。
- 当前工作树白名单包包含 `307` 个条目、大小 `17,475,099 B`，SHA-256 为 `d49bf5d4eb724fd205617eb8b23f9e2c6aafd7a97ea11fcfbe2b094363c6e950`；禁用项和缺失必需文件均为 `0`。`23` 个 `.sql` 全部位于 Flyway 版本化迁移目录，作为应用启动必需源码保留，不是数据库 dump。
- 从压缩包解出的全新上下文使用 `DOCKER_BUILDKIT=0 docker build` 成功，镜像 ID 为 `79b1c05e1236`；构建仅保留既有 Rollup 注释位置和 Three.js 大 chunk 提示。
- 第一个配对会话错误选择 `heluo-xl41`，未上传任何部署包；过期后以项目显示名重建会话，最终授权结果明确返回 `project_slug=heluo` 和批准配置路径。
- deployment `1012` / release `530` 返回 `next_action=done`、`project_status=running`，成为项目 `#329 / heluo` 的活动版本并替换 release `498`；未触发版本回滚或数据恢复。
- 新 release 切换后被平台立即置为休眠，普通 HTTP 请求返回 `204`；通过 PocketBay 官方“唤醒并继续”入口恢复后，`/`、`/appointment`、`/exhibits/heluo-bronze-ding-3d`、`/login` 均为 HTTP `200` 和 Vue 挂载页面，health 为 `UP`。
- 公开数据验收：分类 `3`、文物 `5`、文章 `3`、3D 展项 `1`、商品 `3`、预约时段 `15`。HTML 为 `no-cache, must-revalidate`，入口哈希脚本为 `public, max-age=31536000, immutable`，未登录 `/api/v1/auth/me` 为 `401 + no-store`。
- 移动 GLB Range 返回 `206 bytes 0-1023/837720`；管理员登录、`ADMIN` 身份、后台 summary 和注销均为 HTTP `200`，私有响应保持 `no-store`。
- 线上 `390x844` 深色点云 Canvas 为 `375x640`，鼎身、双耳、三足和展台可辨；点云开启状态下切换浅色再切回深色均保持 `aria-pressed=true`，页面无横向溢出，控制台 `warning/error` 为 `0`。
- 未执行 Git commit/push/reset；真实 SMTP、实体 iOS/Android、中低端 GPU、三运营商、系统强制颜色、长期休眠唤醒和后台真实 CRUD 仍待验收。
