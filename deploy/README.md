# 本地容器运行

## 洛笙预设讲解接口

模型预览由 Maven 测试入口提供，仅监听本机回环地址。启动与联调说明见[洛笙青铜鼎实时问答预览](../docs/plans/2026-11-20-luosheng-model-preview.md)。

接口默认关闭。独立 Spring 测试环境可通过 `MUSEUM_GUIDE_PRESET_ENABLED` 启用读取。启用时必须为 `MUSEUM_GUIDE_PACK_PATH`、`MUSEUM_GUIDE_MINIMUM_VERSION_PATH` 和 `MUSEUM_GUIDE_APPROVED_DIGEST_PATH` 提供进程可读的文件路径。最低版本文件填写正整数，指纹文件填写签核记录中的 SHA-256。发布时由受控环境挂载有效数据，当前 Compose 保持默认关闭。

## 当前本机演示入口（2026-09-21）

当前 `http://localhost:8088` 使用仓库根目录的 `docker-compose.yml`，项目名 `heluo-museum`，服务 `museum`，镜像 `heluo-museum:local`，容器 `heluo-museum-local`。这是打包前端的 Spring Boot/H2 演示容器，与下文 MySQL 多容器方案不同，不能同时占用 8088。

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
5. 本地 Compose 默认启动 Mailpit 测试收件箱：`http://localhost:8025`。密码找回、预约和模拟支付通知只投递到这里，不会发送真实邮件；重置令牌不会写入应用日志或 API 响应。

部署到已获批准的 SMTP 服务时，在本地忽略的 `deploy/.env` 中设置 `MUSEUM_SMTP_HOST`、端口、认证和 TLS 变量，并将 `MUSEUM_PUBLIC_BASE_URL` 设为公开前台地址。SMTP 密码不得提交到仓库。

`compose.yaml` 使用 MySQL 8.4、Spring Boot API 和 Nginx 承载的 Vue 单页应用，数据库结构由版本化 Flyway 迁移维护。

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

验收两种部署时均检查匿名 GET/HEAD、XML 解析、绝对 URL、撤回后的过滤和管理接口仍受保护。PocketBay/Cloudflare 可能替换 robots 内容，须在最终公开域名复验；平台返回 204 空响应不等于应用健康。

## 洛笙全站导览

正式候选的 Spring 进程同时设置 `MUSEUM_GUIDE_PRESET_ENABLED=true`，用于读取已审讲解。可将 `MUSEUM_GUIDE_PAUSE_PATH` 指向进程可读的运维标记路径。运营创建该标记文件即可暂停问答，游客仍可阅读通过当前签核的讲解和查询公开时段。移除标记文件后恢复问答。发布前从普通首页检查停止及恢复，并记录构建、卡包指纹和运行实例。

中文公众端导览默认关闭。经过发布确认后，可在运行 Vite 前端构建的环境中设置 `VITE_GUIDE_SITE_ENABLED=true`，重新构建并发布前端产物。容器启动后设置该变量无法修改已构建的产物。此开关仅控制基于本站资料的导览入口和路线，与青铜鼎本机模型测试入口独立。

统一向导的回环联调使用 `VITE_GUIDE_UNIFIED_PREVIEW=http` 或对应的受控 `model` 模式，且只在 Vite 开发构建生效。正式候选的 `VITE_GUIDE_TURNS_ENABLED=true` 与 `VITE_GUIDE_SITE_ENABLED=true` 需一起在构建时设置。候选 Spring 进程需显式提供 `MUSEUM_GUIDE_TURNS_ENABLED=true`、已签包及其最低版本与指纹的只读挂载、获准的 HTTPS 模型地址和名称、运行时密钥与大于零的每日调用上限。现行 Compose 保持关闭。应通过候选环境的服务配置注入这些值，凭据仅在服务端处理。单实例重启会重置调用计数，发布责任人需核对供应商侧预算。清除服务端开启值并重启可关闭问答，界面仍能使用站内导航和预约查询。

候选开启时，`museum.guide.journey` 在 Spring 实例内累计图版和预约返回的尝试数、到达数。面板澄清量为 `clarification.single + clarification.repeated`，连续澄清占比以其中的 `clarification.repeated` 为分子；这些是浏览器行为趋势，不是按人数计分。发布负责人在批准环境中使用内部指标采集汇总实例增量，并核对重启前后的计数。现有 Actuator 对外范围维持 `health` 和 `info`。浏览器可能丢失上报，现场通过率仍按联合试用表判定。

如批准的候选环境使用 Docker Compose，可显式追加 `-f deploy/compose.luosheng-candidate.yaml`。该叠加文件给前端构建传入两个公开开关，并只在后端运行时注入模型配置。`MUSEUM_GUIDE_RELEASE_DIR` 须为已存在的绝对目录，内含经过六卡预检的 `evidence.json`、`minimum-version.txt`、`approved-sha256.txt`；容器用户仅需读取权限。挂载为只读，不会在宿主机自动创建缺失目录。暂停时由运营在该目录创建 `pause` 标记，恢复时移除；不要用临时预览包充当签核包。模型密钥由受保护的服务运行环境注入，不写入镜像、代码或报表。

问答仍默认关闭，不读取展品路由档案。批准候选开启问答时，还须给后端注入 `MUSEUM_GUIDE_PROFILE_PATH`（`museum.guide.profile-path`），指向进程可读的 UTF-8 版本 1 JSON 文件。可参照仓库的 `docs/plans/luosheng-eval/ding-profile.example.json`（示例，不参与运行时，也不打入后端包）；档案只含公开标识、卡片修订映射和纠正词，不提供回答事实。Compose 候选应将档案随签核资料只读挂载，再通过候选环境的私有叠加配置注入容器内路径（如 `/run/luosheng/profile.json`）；仅设置宿主机环境变量不等于传入容器。文件缺失或非法则开启态拒绝启动；修改映射须重启，卡片仍在每轮按当前审批状态和修订重新核对。本轮不修改部署清单或开启候选。

从仓库根用 `docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.luosheng-candidate.yaml config --quiet` 检查候选配置。不要输出完整插值后的配置，因为可能包含密钥。此命令不启动容器，也不核验证据内容。获准启动后仍须按[放行记录](../docs/plans/2026-11-19-luosheng-acceptance.md#unified-release-record)复核实例与来源。只用 `deploy/compose.yaml` 发版时须从默认配置重新构建前端并重建后端，不能复用开启态前端镜像冒充关闭态。

复核关闭态部署时，在具有前端测试依赖与 Chrome 的机器上运行 `node frontend/scripts/luosheng-production-check.mjs`。将 `LUOSHENG_PRODUCTION_ORIGIN` 设为待验入口，将 `LUOSHENG_PRODUCTION_DIST` 设为同次部署中 Nginx 静态目录的本地副本。脚本比对实际提供的脚本和样式等文件，并检查首页、搜索、藏品、3D 海报及预约页。此检查需要至少一条可读取的公开时段，隔离环境可使用种子时段。

在本机隔离部署复核开启态时，从 `frontend` 运行 `node scripts/luosheng-preset-check.mjs`。设置 `LUOSHENG_CANDIDATE_ORIGIN` 为绑定在 `127.0.0.1` 的 Nginx 地址，`LUOSHENG_CHECK_PUBLIC_TURNS=true`，并用 `LUOSHENG_QA_USERNAME` / `LUOSHENG_QA_PASSWORD` 提供隔离库的临时普通游客账号。该脚本需要其约定的合成证据包，并会注入失败情形，不用于正式站点。用初始化数据生成后天的公开时段后，可设 `LUOSHENG_CHECK_SEEDED_SLOTS=1`，核对未拦截的同源响应、面板余量及返回原视角。设 `LUOSHENG_CHECK_SWAPPED_THEMES=1` 可覆盖手机和桌面各自的双主题。不要将合成卡、其指纹或本机模型占位配置部署到发布环境。

在已批准的候选环境，从内部服务日志按实例和时间窗统计 `guide_generation_started`，用 `guide_turn` 的结果和耗时区分已交付生成、澄清、无证据和退化。进程内 Timer / Counter 汇总在重启后会重置，现有 Actuator 暴露范围不变。发起计数表示已进入模型适配器，不是供应商收到的请求数，也不是收费凭据；费用须按同一时间窗用供应商用量和账单核对，浏览器端的可读耗时须另测。
