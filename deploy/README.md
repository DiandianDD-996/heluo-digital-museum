# 本地容器运行

## 洛笙 AI 向导

模型预览由 Maven 测试入口提供，仅监听本机回环地址。启动与联调说明见[洛笙青铜鼎实时问答预览](../docs/plans/2026-11-20-luosheng-model-preview.md)。

默认前后端关闭。Compose 会把仓库内 `content/luosheng` 以只读方式挂到 `/run/luosheng`，并以签核摘要和最低版本文件校验中英证据卡。若要在本地开放确定性馆藏回答，在忽略文件 `deploy/.env` 设置 `VITE_GUIDE_ENABLED=true`、`MUSEUM_GUIDE_ENABLED=true`、`MUSEUM_GUIDE_MODEL_ENABLED=false`，然后重建前端并启动服务。此模式不请求外部模型、不需要模型 API 密钥。

```powershell
docker compose --env-file deploy/.env -f deploy/compose.yaml build frontend
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d backend frontend
Invoke-RestMethod http://localhost:8088/api/v1/ready
```

接入模型须另行获批模型供应方，随后在受保护的运行环境中设置模型开关、端点和密钥，不要提交密钥。候选覆盖文件 `compose.luosheng-candidate.yaml` 只读挂载独立签核发布目录；通用部署变量见[洛笙说明](../docs/luosheng/README.md)。

## 单容器 H2 演示方案

仓库根目录的 `docker-compose.yml` 提供 Spring Boot/H2 演示容器，项目名 `heluo-museum`，服务 `museum`，镜像 `heluo-museum:local`。若同时运行下文的 MySQL 方案，需为两个入口分配不同的宿主机端口。

从仓库根目录重建、启动：

```powershell
docker compose -p heluo-museum -f docker-compose.yml build museum
docker compose -p heluo-museum -f docker-compose.yml up -d --no-build
```

保留 `heluo-museum_museum-local-data` 数据卷及本机忽略的 `pocketbay.properties`；不要使用 `down -v`。根 Dockerfile 的前端步骤只执行 Vite 构建，发布前仍需在 `frontend/` 单独运行 `corepack pnpm build`（含类型与资源预算）和单测。启动后检查 `/api/v1/health`、`/api/v1/ready` 的 `data.status=UP` 并实际浏览页面。此次整理细节见 [视听收口计划](../docs/plans/2026-09-21-audiovisual-stabilization.md)。

### R3 配乐资源与验收（2026-09-27）

当前采用的三首配乐位于 `frontend/public/media/audio/music-r3/`，构建后由既有公开 `/media/**` 路径提供，不新增鉴权例外。`corepack pnpm build` 额外执行配乐资源门禁：核对三首压缩音频与已验证清单的SHA256、大小、循环参数及合计6MB上限。无损试听母带仍在本机忽略的 `artifacts/`，不会进入容器构建上下文。

部署后，在仓库根目录执行 `node scripts/music-audition/check-production.mjs`，核对8088的健康检查、五条页面、JS/CSS与本地构建一致，以及三首MP3的匿名GET/HEAD/Range、MIME、大小与散列。在 `frontend/` 执行 `$env:MUSIC_R3_BASE_URL='http://localhost:8088'; node scripts/music-r3-browser-check.mjs`，复验真实页面导航与原生播放。脚本只读取业务API，不创建预约、订单或其他数据；结果保存在忽略的 `artifacts/music-r3-integration-2026-09-27/`。

音乐默认静音，经用户手势启用后按需加载；同曲跨页保持进度，跨曲短交接，后台和未知路由安静。隐藏页面暂停，回到前台后等下一次手势恢复。音频请求失败时保持安静，不启动旧随机配乐。完整结果与主观听感/真机边界见 [R3接入计划](../docs/plans/2026-09-27-music-r3-integration.md)。

## MySQL 多容器方案

1. 从本目录复制环境变量：`Copy-Item .env.example .env`。
2. 在 `deploy/.env` 中替换两个本地密码，不要提交该文件。
3. 在仓库根目录运行：`docker compose --env-file deploy/.env -f deploy/compose.yaml up --build`。
4. 浏览器访问 `http://localhost:8088`；存活检查为 `http://localhost:8088/api/v1/health`，数据库就绪检查为 `http://localhost:8088/api/v1/ready`。分别确认 HTTP 200 与 `data.status=UP`。
5. Compose 默认不启动 Mailpit，也不配置 SMTP。仅本机调试时，在 `deploy/.env` 设置 `MUSEUM_SMTP_HOST=mailpit`、`MUSEUM_SMTP_PORT=1025`，并运行 `docker compose --env-file deploy/.env -f deploy/compose.yaml --profile dev-mail up -d --build`。测试收件箱仅绑定 `127.0.0.1:8025`。已有旧部署要主动停止旧 Mailpit 容器；调整 profile 不会自动停止已经运行的旧实例。

部署到已获批准的 SMTP 服务时，在本地忽略的 `deploy/.env` 中设置 `MUSEUM_SMTP_HOST`、端口、认证和 TLS 变量，并将 `MUSEUM_PUBLIC_BASE_URL` 设为公开前台地址。非开发配置在非回环站点上禁止 Mailpit 或 SMTP 1025。SMTP 密码不得提交到仓库。重置密码请求按来源 IP 和目标用户名节流，超限仍返回统一受理响应。

后端不采用容器自动转发头重写。Compose 默认仅信任本机回环和 Nginx 固定地址 `172.30.88.10/32`；如网段冲突，同时更改 `MUSEUM_NETWORK_SUBNET` 与 `MUSEUM_NGINX_IP`。有额外上游反代时，在 `MUSEUM_TRUSTED_PROXY_CIDRS` 仅列出实际代理的出站地址，代理必须净化或追加其真实对端地址。PocketBay 直连不应信任客户提交的转发头；只配置真实前置代理。

`compose.yaml` 使用 MySQL 8.4、Spring Boot API 和 Nginx 承载的 Vue 单页应用，数据库结构由版本化 Flyway 迁移维护。

如果用 `MUSEUM_WEB_PORT=127.0.0.1:8088` 限制宿主机监听，另显式设置 `MUSEUM_PUBLIC_BASE_URL=http://127.0.0.1:8088`，不要将端口映射表达式用作公开 origin。现有实例升级前注意旧 Mailpit 是否仍暴露公网端口；仅在确认容器归属并获准变更后停止旧实例。

## 全站质量隔离环境

在 `backend/` 执行 `mvn -B package`，在 `frontend/` 执行 `corepack pnpm build` 和 `node scripts/quality-environment.mjs`。脚本使用 4189/18081 端口、独立 H2 数据目录与运行时随机管理员，启动完成会验证真实 API 返回。

这是同版本本地演示备用入口，不替代 MySQL 验收。临时凭据与日志位于已忽略的 `artifacts/sitewide-quality/current-environment.json` 和相邻日志；不得提交或共享。停止使用 `node scripts/quality-environment.mjs --stop`。原始数据目录保留，不会覆盖现有 Compose 数据。

Windows 原生 MySQL 8 隔离验收使用 `node scripts/quality-mysql-environment.mjs`，入口 `http://127.0.0.1:4192`，数据库 13306；从 PATH 定位 MySQL，独立目录和凭据，不修改已存在的 MySQL80 服务。当前构建真实压缩/缓存验收使用 `node scripts/quality-production-environment.mjs`，入口 `http://127.0.0.1:4191`，把 dist 放入 JAR 副本并使用独立 H2。两个脚本都支持 `--stop` 且保留数据。临时环境文件只用于本机，不纳入提交。

详细命令、三分钟演示和证据边界见 `docs/reviews/2026-09-08-quality-demo-guide.md`。MySQL 入口验证数据库和业务，生产配置入口用于 gzip、缓存、Range 与前端性能，不将 Vite preview 的无压缩下载指标当作部署指标。

前端 `.env.example` 中 `MUSEUM_DEV_API_URL` 可选择本地 API；它仅用于 Vite 开发/preview 代理，不会把测试服务地址写进生产 bundle。真实 SMTP、真实支付与线上发布不属于本轮质量优化。

## 数据备份与恢复演练

备份文件只写入被 Git 忽略的 `deploy/backups/`：

```powershell
.\deploy\scripts\backup-mysql.ps1
```

恢复演练默认导入隔离库 `museum_recovery_test`，不会覆盖当前演示库：

```powershell
.\deploy\scripts\restore-mysql.ps1 -BackupFile .\deploy\backups\museum-<timestamp>.sql
```

只有明确要覆盖 `museum` 时才传入 `-TargetDatabase museum -Confirm`；恢复后仍需让 Flyway/应用健康检查通过。
# 公开站点索引（2026-09-10）

`GET/HEAD /robots.txt` 与 `/sitemap.xml` 由后端实时生成；Compose 的 Nginx 精确转发这两个地址，PocketBay 直接由 Spring Boot 响应。设置已有 `MUSEUM_PUBLIC_BASE_URL` 为正式 HTTP(S) origin（不能包含路径、查询或凭据），与邮件链接共享同一公开地址。默认值只用于本地环境，正式发布前必须核对。

站点地图包含公开文物、文章、展项和五个公开入口；草稿、软删除、禁用分类及关联文物未发布的展项按对应公开 API 规则过滤。响应不缓存，撤回内容下次请求即消失。`frontend/public` 中旧静态索引不是生产服务来源；直接 Vite preview 不代表生产索引验收。

`/artifacts/{slug}`、`/articles/{slug}`、`/exhibits/{slug}` 的 HTML 由后端注入标题、描述及 Open Graph 元数据。不可见条目返回 HTTP 404，公开详情也不缓存，撤回后无需等待 CDN 缓存过期（外层代理应遵守 `Cache-Control: no-store`）。PocketBay 使用包内 `static/index.html`；Compose 固定 `MUSEUM_SPA_INDEX_URL=http://frontend/index.html`，读取 Nginx 正在提供的同一版模板。该地址是可信部署配置，不应来自请求头，也不应设为外部用户可控地址。

验收两种部署时均检查匿名 GET/HEAD、XML 解析、绝对 URL、撤回后的过滤和管理接口仍受保护。PocketBay/Cloudflare 可能替换 robots 内容，须在最终公开域名复验；平台返回 204 空响应不等于应用健康。

## 洛笙全站导览

候选只使用 `VITE_GUIDE_ENABLED=true`（构建时）和 `MUSEUM_GUIDE_ENABLED=true`（服务运行时）。模型密钥仅在后端运行时注入，不能写入前端产物、镜像或报表。默认关闭时需用关闭态参数构建，不复用开启态镜像。

获准在 Compose 开启候选后，显式加上 `-f deploy/compose.luosheng-candidate.yaml`。先用 `config --quiet` 验证插值，再核对证据卡、最低版本与签核指纹；配置校验本身不核验这些文件。运行时暂停可在只读挂载的宿主机目录创建 `pause` 标记，移除后恢复为管理员设置的模式。

管理员可在 `/api/v1/admin/guide/overview` 查看关闭态、模型额度、并发与拦截计数；`POST /api/v1/admin/guide/cache/invalidate` 清空目录缓存，`POST /api/v1/admin/guide/runtime-mode` 可切换 `NORMAL`、`DETERMINISTIC`、`PAUSED`。文件暂停优先；应用重启会重置运行模式、应用计数与缓存，供应商实际用量以其账单为准。详细接口、评测和限制见[洛笙 v2.2 说明](../docs/luosheng/README.md#5-v22-后端加固与运行时治理2026-11-24)。

### PocketBay 单镜像启用洛笙

这不是 Compose 的配置方式。根目录 Dockerfile 把证据包复制到 `/app/content/luosheng`。用该镜像启用确定性导览且不调用外部模型时，应在**已授权**的运行环境设置以下非秘密配置：

```dotenv
MUSEUM_GUIDE_ENABLED=true
MUSEUM_GUIDE_MODEL_ENABLED=false
MUSEUM_GUIDE_PACK_PATH=/app/content/luosheng/ding.zh-CN.json
MUSEUM_GUIDE_MINIMUM_VERSION_PATH=/app/content/luosheng/minimum-release-version.txt
MUSEUM_GUIDE_APPROVED_DIGEST_PATH=/app/content/luosheng/ding.zh-CN.sha256
```

根 Dockerfile 默认前端构建参数为 `VITE_GUIDE_ENABLED=false`。此时 `pocketbay` profile 可通过服务端 HTML meta 启用浏览器入口；开启入口不会自动加载签核证据。实际验证应同时检查首页和器物详情的按钮，以及匿名 `GET /api/v1/guide/exhibits/heluo-bronze-ding-3d?locale=zh-CN` 和 `locale=en-US` 均返回 `data.available=true` 与预期卡数。未获准启用时保持运行开关关闭，并使用默认构建。默认构建与 `VITE_GUIDE_ENABLED=true` 构建有不同静态指纹，不混用验收结论；远端构建参数、配置注入和正式入口另需验证。见[移动审查方案 §8.42](../docs/plans/2026-11-25-production-mobile-audit-and-remediation.md#842-发布准备缺省构建参数与洛笙运行时开关)。
