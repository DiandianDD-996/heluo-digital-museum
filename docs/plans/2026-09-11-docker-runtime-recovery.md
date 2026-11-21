# Docker Desktop 启动故障修复

日期：2026-09-11。目标：解决用户截图中的 Docker Desktop 意外退出，恢复后续隔离 Compose 验收环境。关联 N-04/N-05；不修改业务需求状态。

## 原因与处理

启动日志先报 `run/dockerInference` 无法移除，随后暴露 `docker-secrets-engine/engine.sock` 同类错误。两处都是本地 Unix socket 重解析点遗留文件。常规 `docker desktop stop --timeout 20` 未能停止已卡住的 Desktop，按可执行路径核对后结束 Docker Desktop/backend 进程，保留并重建这两处运行时目录。

分次处理会让另一处遗留 socket 阻断下一次启动，最终在所有 Docker 进程退出后同时重建两处，启动成功。此证据支持“遗留通信文件阻断启动”；没有确定这些文件最初为何遗留，不能认定磁盘损坏、升级缺陷或 WSL 损坏。

没有恢复出厂设置，没有移动 Docker 数据盘、镜像、卷或用户项目；没有修改注册表、驱动或 WSL 发行版。系统 AFUnix 驱动检查为 RUNNING。

## 保留的原始目录

- `C:/Users/Jie/AppData/Local/Docker/run-backup-20260911-003221`
- `C:/Users/Jie/AppData/Local/Docker/run-backup-20260911-003438`
- `C:/Users/Jie/AppData/Local/docker-secrets-engine-backup-20260911-003336`
- `C:/Users/Jie/AppData/Local/docker-secrets-engine-backup-20260911-003438`

新建空目录 `C:/Users/Jie/AppData/Local/Docker/run` 和 `C:/Users/Jie/AppData/Local/docker-secrets-engine`，由 Docker 重新生成通信端点。备份未删除；不应在 Docker 运行时把旧 socket 复制回去。

## 验收

2026-09-11 10:48再次复核：docker desktop status仍running、服务端29.6.1；新候选1789094445104完成真实Docker构建并独立4207运行，health/ready均UP、HTTP13及内容浏览通过。截图故障当前未复现，既有容器/卷保留；未执行Windows重启，因此不扩大为重启复发已解决。

- `docker desktop status`：running。
- `docker version` / `docker info`：服务端 29.6.1、Linux 引擎正常返回。
- 真实拉取并运行官方 `hello-world:latest`，禁用容器网络，输出 `Hello from Docker!`，退出码 0。
- 测试容器 `heluo-docker-recovery-20260911-0035` 与 hello-world 镜像保留，未清理用户记录。
- 既有 `qmyz-qmyz-1` 容器可见，并在 Docker 恢复后处于 Up；没有为测试重启或重建该容器。

后续复核：Docker Desktop 仍为 running，服务端 29.6.1 Linux 正常。两套隔离博物馆环境 4196/4197 首页均 HTTP 200，实际 `/api/v1/health` 与 `/api/v1/ready` 均 HTTP 200 且 `data.status=UP`；MySQL 和 Mailpit 容器为 healthy。完整 Compose 构建与业务回归的后续证据另见 `2026-09-11-local-release-readiness.md`。

复核时首次误用 `/api/health` 与 `/api/ready`，返回鉴权错误；该次 PowerShell 循环还复用了上一条响应，输出无效，不作为成功证据。核对控制器路由后，使用停止于错误的检查重新验证上述四个正确 API，全部通过。

未验证：Windows 重启后的复发情况。这次引擎修复不等同完整优化方案或生产部署完成。

项目代码未因该故障修改；同步记录文件：

- `C:/Users/Jie/Documents/博物馆/docs/plans/2026-09-11-docker-runtime-recovery.md`
- `C:/Users/Jie/Documents/博物馆/PROJECT_STATUS.md`
- `C:/Users/Jie/Documents/博物馆/docs/01-requirements-traceability.md`

下一步沿原优化方案继续隔离 Compose 验收，使用独立项目名与数据卷，避免影响已恢复的其他容器。未提交、推送或生产发布。
