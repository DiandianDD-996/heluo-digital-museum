# 2026-11-24 后端安全与平台升级

目标：按 Gate 0 → 1 → 2 收紧公网安全、验证洛笙双路径并扩展后端数据契约；不改前端源码或既有字段类型。

| 门禁 | 需求 | 影响与验收 |
| --- | --- | --- |
| Gate 0 | F-08、N-01/N-02/N-05、LS-07/08 | Compose 默认无 Mailpit；可信代理统一解析；重置密码节流；洛笙隔离缓存和冲突检查；镜像默认关闭洛笙。 |
| Gate 1 | LS-01～06 | 导航编码、双语证据和引用白名单；JSON/SSE 同规则，违规句不得先发后撤；评测覆盖中间事件。 |
| Gate 2 | F-01～09、F-11～13、N-05 | V28 与后台写入契约、检索、运行时治理、核销与公开详情 SEO；MySQL 8 / H2 双验证。 |

范围：后端、部署文件、Nginx、洛笙评测脚本及授权文档。保留 PocketBay 健康检查和入口有效适配。

风险：反代信任必须匹配实际拓扑；进程内限额不跨副本；前端旧搜索顺序与响应字段须兼容；生产密钥、MySQL 或 Docker 不可用时须明确标注真实验证缺口。

实施顺序：先修 Compose 与代理/限频/幂等边界并跑安全专项，再统一洛笙回答契约与流式检查并跑双路径评测，最后追加迁移、运营能力与 SEO；发布前用独立项目重建两种镜像和回归核心业务。

## 完成与接口交接

- Gate 0：开关默认关闭；Mailpit 仅 `dev-mail` 回环；重置密码按可信 IP 和账号统一节流；洛笙 `requestId` 隔离 JSON/SSE 且拒绝异参重放。
- Gate 1：动作分类归一；双语签核卡；当前页/已读资料才能引用；正文裸链与内部标识清洗，违规句在发出前拦截并中止模型流。双路径题集包含 SSE 中间事件断言。
- Gate 2：V28 补齐分类、藏品、专题、3D 和商品的双语/溯源字段；`type=all` 保持原范围，`type=museum` 才聚合四类。管理员接口增量包括仪表盘、`/api/v1/admin/guide/**` 与 `POST /api/v1/admin/appointments/{id}/check-in`。核销提交 `verificationCode`，只允许预约时段内的 `CONFIRMED` 记录，完成后持久化核销时间并审计，旧 `/complete` 不变。两种部署的动态详情 SEO 遵循发布权限。
- 持久决策与运行限制见 [ADR-012](../decisions/ADR-012-backend-trust-runtime-and-detail-visibility.md)。

## 验证结果（2026-11-24）

| 检查 | 结果 |
| --- | --- |
| `mvn -f backend/pom.xml test` / H2 MySQL 模式 | `106/106`，无失败、错误或跳过；覆盖代理、重置、重放隔离、英语签核卡、句级 SSE、模式切换、核销审计、统计及发布态 SEO。 |
| 独立 MySQL 8.4 | `BilingualMigrationTests,BilingualSearchTests,DingAssociationMigrationTests` `23/23`；迁移至 V29，验证历史数据与新种子、分页、排序、可见性。 |
| 前端 | `pnpm --dir frontend typecheck`、`test --maxWorkers=2`（77 文件/`433/433`）、`build`（含预算检查）通过。默认 worker 首轮启动超时，限制并发后全量通过。 |
| Compose 配置与启动 | 默认、`dev-mail`、洛笙候选 `config --quiet` 通过；隔离 MySQL/Nginx Compose `data.status=UP`，默认无 Mailpit；显式配置 `dev-mail` 后只监听 `127.0.0.1` 且 HTTP 200。Windows BuildKit 的中文目录问题使用 Docker 经典构建器绕过，未更改项目构建上下文。 |
| 两种镜像的公开页面 | MySQL Compose 与 PocketBay/H2 均验证文物/专题/展项 GET/HEAD、五项 OG、配置 origin、实际 JS/CSS 与同版 `index.html` 一致、未知内容 404、洛笙默认关闭。草稿与 HTML 转义另有集成覆盖。 |
| 管理端与浏览器 | MySQL Compose 验证普通用户不能访问洛笙后台、管理员可读关闭态和切模式；核销一次成功、重复 409、当日计数加一。原浏览器 E2E `5/7`（预约确认、支付、后台发布撤回、权限、分页）；两条恢复流程因旧标签和旧购物袋数量 DOM 选择器失败，用临时适配副本保持业务断言复验 `2/2`，未改前端。 |
| 真实模型 | [同一最终 PocketBay 镜像评测](../luosheng/eval/v2.2-eval.md)：JSON `36/36`、SSE `36/36`、红队 `12/12`、动作 `72/72`、真模型 `71/72`（1 次馆藏降级），P50 `3484 ms`、P95 `5473 ms`。较早空库运行不计入成绩。 |

尚未验证：正式公网拓扑、真实 SMTP、外层代理下 SSE 首包和热暂停、生产数据迁移与真机。先前部署的 `deploy-mailpit-1` 仍在 `0.0.0.0:8025`；新配置不会自动停掉旧容器，须获准后处理。所有隔离检查未改动原有部署数据。原业务 E2E 的两个过时选择器待前端线同步；本轮不提交、不推送。
