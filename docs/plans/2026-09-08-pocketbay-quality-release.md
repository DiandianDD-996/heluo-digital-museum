# PocketBay 全站优化覆盖发布

## 目标与关联需求

将已通过本地验收的当前工作树覆盖发布到现有项目 `#329 / heluo`。关联 `F-01` 至 `F-14`、`N-01/N-02/N-03/N-05/N-06`；用户已明确授权替换运行版本，不包含 Git 提交或推送。

## 影响范围与步骤

1. 核对官方部署协议、项目身份和运行状态。2026-09-08 控制台显示项目休眠；历史 release 639 仅作历史记录。
2. 按白名单打包根级 Dockerfile、入口脚本、前后端源码和生产资源。排除依赖、构建输出、测试报告、本地数据库、备份及开发配置。
3. 仅迁移配对批准的 `pocketbay.properties`，不输出配置内容。继续使用现有 `/data` H2 演示库，不上传本地 MySQL 数据。
4. 在全新解包目录验证镜像构建，核对源码与本地验收版本的哈希对应。
5. 上传候选版本，等待平台健康检查通过并切换入口；记录 deployment、release 和实际状态。
6. 验证线上 health、ready、公开数据、主要路由、缓存、GLB Range 及浏览器页面。更新本计划、项目状态、需求追踪表并审查 diff。

## 验收标准

- 发布目标始终为 `#329 / heluo`，平台明确返回完成且 running。
- 线上 health/ready 为 200/UP，首页及馆藏、展厅、预约、商城和登录可用。
- 线上入口资源与当前构建对应，公开 API 可读取，移动 GLB Range 为 206。
- 保留线上持久数据；不主动回滚、删除、提交真实业务记录。

## 风险与验证结果

- 当前工作树含未提交修改；版本以文件哈希和上传包哈希标识。
- PocketBay 为 H2 单实例演示，休眠、网络和平台容量仍受平台影响；本地 MySQL 通过不等于线上完整业务闭环。
- 真实 SMTP、实体设备、线上写流程、GitHub CI 与 3D 首次 render 长任务仍单独留项。
- 2026-09-08 14:02（上海时区）最终复核：deployment `5987` / release `4850` 返回 `done/running`，活动版本已从 `639` 切换到 `4850`；仅上传一次，没有回滚。
- 配对确认 `heluo`，唯一批准配置为 `pocketbay.properties`。用户在配对页选择信任客户端后下发的凭证存于官方路径，并限制为当前 Windows 用户访问；配置和凭证未输出。
- 包包含 `375` 个条目、`19,697,785 B`，SHA-256 `edeba2f8c4113339b65ea4b32a08dd609e326777485c67b9acddd825e4f87e94`；禁用项为 0，解包逐文件校验通过。
- 验收记录中的 `381` 个源码文件均未漂移，源码指纹 `cd1758a3f321b5cf72c04c320df04507dfde7f18b392ee237048623419c0e36a`。线上七个主要路由的 HTML，以及入口 JS `index-C2wvSK_T.js`、CSS `index-BtPebWBr.css` 与当前本地 dist 字节哈希一致。
- Docker Desktop 启动因本机 `dockerInference` socket 无法访问而失败，本机全新上下文镜像构建未执行。平台 Dockerfile 构建、数据同步、容器启动和健康门禁成功；本次没有改动业务源码或 Docker 配置。
- 发布后平台立即休眠，最初命令行访问为 204；通过官方“唤醒并继续”入口恢复。其后 HTTP 验收 `19/20` 通过：七个主要路由 200、health/ready 200/UP、响应体和响应头请求编号一致、六类公开数据可读、未登录身份 401/no-store、入口 JS/CSS immutable 且哈希匹配、移动 GLB Range 206 且 1024 字节内容匹配。
- 公开数据：分类 3、文物 5、文章 3、展项 1、商品 3、预约时段 3。浏览器由首页导航进入馆藏、预约、商城和展厅；“青铜”搜索得到 3 项，2026-09-10 可选两个时段，商城图片和库存正常。
- HTTP 未通过项：未知路由在应用内正确显示 404 恢复页，但 PocketBay 外层返回 200。PocketBay 还使用 `heluo--e.pocketbay.app` iframe 承载应用，内层导航和查询参数未同步外层地址栏；应用内查询有效，但从外层直接复制当前地址不能证明上下文恢复。
- 3D 实体模型完整呈现，浅深主题和俯视控制可用，画布提交计数增长；本机线上浏览器的帧率窗口约 1 FPS，触发 `fallback`，点云入口禁用。记录到一项 WebGL 着色器精度警告，没有捕获 error；不把本轮标为点云或性能通过。
- 视口覆盖调用未改变浏览器实际宽度，应用实际视口为约 `1978×966`；截图只作为当前桌面证据。390px、1440px 的线上专项、实体设备、真实写流程、真实 SMTP、GitHub CI、3D 首帧与长期 FPS 仍待验收。
- 未执行 Git commit/push/reset，未创建线上预约或订单，未上传本地 MySQL 数据。

## 证据与下一步

证据均位于已忽略的 `C:/Users/Jie/Documents/博物馆/artifacts/sitewide-quality/`：

- `pocketbay-package-evidence.json`：包清单、逐文件散列、源版本对应关系。
- `pocketbay-release-evidence.json`：脱敏后的最终平台状态。
- `pocketbay-online-http.json`：20 项线上 HTTP 检查，保留 404 状态不匹配的失败。
- `pocketbay-browser-evidence.json`：浏览器控件、3D 渲染数据、警告及实际视口边界。
- `pocketbay-home-desktop.png`、`pocketbay-explore-search.png`、`pocketbay-appointment.png`、`pocketbay-shop.png`、`pocketbay-3d-solid.png`、`pocketbay-3d-dark-top.png`：发布后截图。

下一步：在实体手机前台运行和可控视口下复核点云，定位浏览器低帧率；评估 PocketBay iframe 的地址同步与 404 状态处理。平台问题未解决前，不把本地全站质量结论扩大为线上全部通过。
