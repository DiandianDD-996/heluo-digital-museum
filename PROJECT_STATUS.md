# 项目状态

> 本文件只记录**当下状态、风险与下一步**（硬上限 150 行）。完整历史记录已归档至 [docs/archive/status-2026.md](docs/archive/status-2026.md)。

## 当前总览（2026-11-23）

| 模块 | 当前状态 | 说明 |
| --- | --- | --- |
| 数字博物馆主体（前后端 + 3D + 预约 + 商城模拟支付 + 后台） | **已完成并已部署演练** | F-01～F-14、A-01～A-02、N-01～N-06 均已达成；PocketBay 演示站已跑通 |
| 前端视觉与 CSS 架构升级（Heluo Editorial 2.0） | **Phase 0–6 全部完成，待人工终审确认后提交** | 计划见 [2026-11-22-frontend-design-overhaul.md](docs/plans/2026-11-22-frontend-design-overhaul.md)，系统规范见 [design.md](design.md) |
| 洛笙 AI 向导 v2（可选扩展） | **Phase 0–5 全部完成并验收全绿，待审查 diff 确认提交** | 唯一活文档见 [docs/luosheng/README.md](docs/luosheng/README.md)，决策见 [ADR-010](docs/decisions/ADR-010-luosheng-v2-museum-agent.md)，方案见 [2026-11-23-luosheng-v2-architecture.md](docs/plans/2026-11-23-luosheng-v2-architecture.md) |

## 最近完成（2026-11-23）

- **洛笙 AI 向导 v2 架构改造（Phase 0–5 全闭环）**：
  - **架构与安全（Phase 0–2）**：落地 [ADR-010](docs/decisions/ADR-010-luosheng-v2-museum-agent.md)（D1 中英双语自适应、D2 SSE 真流式 + JSON 兜底、D3 静态 3 看点图版卡、D4 DeepSeek `deepseek-chat` 200 次/天 × 4 并发）；构建全馆实时知识层（`GuideKnowledgeService`，MySQL 60s 短缓存 + 青铜鼎 Tier-1 SHA-256/防回滚/ADR-006 证据卡）、3 个只读工具（`get_museum_item_detail`、`search_museum_catalog`、`query_appointment_slots`）、无状态限流与幂等缓存、24 字符流式缓冲解析器、高危事实红线与白名单校验器、确定性馆藏直出真降级引擎；`SecurityConfiguration` 放行 `DispatcherType.ASYNC`，`frontend/nginx.conf` 对 `/api/v1/guide/chat/stream` 关闭代理缓冲。
  - **3D 深度联动与前端瘦身（Phase 3–4）**：`ThreeExhibitViewer` 新增 `focusPart('ear' | 'feet' | 'motif')` 平滑聚焦与 `view-change` 事件；`ExhibitDetailView` 移除旧 `guideHandoff` 3D 阻断并消费 `luoshengStore.pendingViewerAction`；重写流式多轮抽屉 `LuoshengSiteGuide.vue`（`sessionStorage` 持久历史、跨页分隔线、停止生成、诚实模式徽标、折叠「依据与边界」抽屉、移动端自动收起）与轻量只读 `LuoshengPreset.vue`；彻底删除 10 个旧后端类、22 个旧前端库/单测及 12 个冗余脚本，开关收敛为 `VITE_GUIDE_ENABLED` 与 `MUSEUM_GUIDE_ENABLED`。
  - **全量验收与真实 DeepSeek 36 题评测（Phase 5）**：
    - 后端 `mvn test`：`92 / 92` 全绿；前端 `vue-tsc -b` 0 错误、`vitest run` `74` 文件 / `444` 用例全绿、`vite build` + 包体预算门禁全绿（首屏 JS gzip `77,202 B` / 预算 `81,638 B`，CSS gzip `9,253 B` / 预算 `80,000 B`）。
    - 真实 DeepSeek 36 题单一路径评测（[v2-eval.md](docs/luosheng/eval/v2-eval.md)，直连 `/api/v1/guide/chat`）：非红队 `29/30`（**96.7%**）、红队 `6/6`（**100%**）、动作合法率 `36/36`（**100%**）、真 AI 占比 `36/36`、P50 `2,545 ms` / P95 `4,385 ms`。
    - Playwright 实测（390 深色 & 1440 浅色）：`luosheng-e2e.mjs` 与 `luosheng-isolation.mjs` 全通过，零控制台报错、零横向溢出、关闭态零 UI 且零 `/api/v1/guide/` 请求。
- **首页首屏「浑仪磁阵」鼠标光点场升级定稿（2026-11-23）**：新增 [heroDotFieldRenderers.ts](frontend/src/lib/heroDotFieldRenderers.ts) 与单测 [heroDotFieldRenderers.spec.ts](frontend/src/lib/heroDotFieldRenderers.spec.ts)（见计划 [2026-11-23-hero-raking-light.md](docs/plans/2026-11-23-hero-raking-light.md)），为首页 `<PointerDotField variant="image" />` 引入左文右鼎空间避让遮罩、胡克弹簧阻尼 + 速度流线彗尾 + 0.4 Hz 悬停微呼吸、预烘焙离屏光晕图章（深色纯乌金香槟渐变、浅色古铜鎏金 +「金镶玉」星枢）、星枢四芒星针与 2-最近邻渐变星轨连线；Playwright 1440×900 深/浅双主题连续扫动均值 `3.63–3.64 ms`（P95 `3.7 ms`）。
- **前端 Heluo Editorial 2.0 视觉与 CSS 架构全面升级（2026-11-22）**：`@layer` 8 层样式与 OKLCH 双色令牌及 11 路由视觉升级完整保留未受损。

## 当前风险与运维注意

1. **生产开启安全阀**：部署站开启 `VITE_GUIDE_ENABLED=true`、`MUSEUM_GUIDE_ENABLED=true` 时，密钥仅经服务端环境变量注入（`MUSEUM_GUIDE_MODEL_KEY` 或 `DEEPSEEK_API_KEY`），默认日额度 `200` 次/天、最大并发 `4`，异常时可通过 `MUSEUM_GUIDE_PAUSE_PATH` 热暂停或置 `MUSEUM_GUIDE_MODEL_ENABLED=false` 无缝切换至馆藏直出模式。
2. **Nginx 生产实机流式验证**：`frontend/nginx.conf` 与 `deploy/compose.yaml` 已完成 SSE 关缓冲配置，建议在 Docker Compose 实机部署时抽检一次逐字流式首包延迟。
3. **移动旧版 Chrome 3D 既有问题**：Android V2366HA Chrome 133 存在 WebGL `contextlost`（同机 vivo 浏览器可用），无 WebGL 时 `ExhibitDetailView` 已自动温和降级至静态 3 看点图版。

## 下一步

1. 审查工作树 `git status` 与 `git diff`，确认 Heluo Editorial 2.0 与洛笙 v2 改动后由用户决定分批或合并提交。
2. 按需在演示环境配置 `VITE_GUIDE_ENABLED=true`、`MUSEUM_GUIDE_ENABLED=true` 并完成一次 Docker Compose 生产环境 SSE 冒烟与热暂停演练。
