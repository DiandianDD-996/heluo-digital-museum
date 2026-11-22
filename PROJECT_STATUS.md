# 项目状态

> 本文件只记录**当下状态、风险与下一步**（硬上限 150 行）。完整历史记录已归档至 [docs/archive/status-2026.md](docs/archive/status-2026.md)。

## 当前总览（2026-11-22）

| 模块 | 当前状态 | 说明 |
| --- | --- | --- |
| 数字博物馆主体（前后端 + 3D + 预约 + 商城模拟支付 + 后台） | **已完成并已部署演练** | F-01～F-14、A-01～A-02、N-01～N-06 均已达成；PocketBay 演示站已跑通 |
| 洛笙 AI 向导（可选扩展 v1） | **Phase 0–4 工程全部落地，待 Phase 5 真人试用与上线开关** | 唯一活文档见 [docs/luosheng/README.md](docs/luosheng/README.md)，决策见 [ADR-009](docs/decisions/ADR-009-luosheng-v1-convergence.md) |

## 最近完成（2026-11-22）

- **Phase 0（止血收尾）**：工作树拆分为 3 个干净提交；`oracleJdk-27` 移至 `C:\Tools\oracleJdk-27`；15 份旧计划与历史状态/追踪表归档至 `docs/archive/`。
- **Phase 1（真实模型摸底 + 参数修复）**：`GuideChatCompletionModel` 补齐 `temperature=0` 与 7.5s 超时对齐；建立 30 题评测集与 `scripts/luosheng-eval.mjs`；实测 DeepSeek v6 基线（红队 0/6、选卡 76.9%，坐实检索与提示词短板）。
- **Phase 2（8 卡口语化 Schema v3）**：生成 `content/luosheng/ding.zh-CN.json`（`formatVersion: 2`，拆 `spoken`/`boundary`/`systemConstraints`）、SHA-256 指纹与 `v3-card-diff.md` 审定表；后端 `GuideEvidenceFileSource`/`GuideEvidenceReader`/`GuideExhibitController`/`GuideAnswerDelivery` 全面兼容 v1/v2 并默认交付口语句。
- **Phase 3（生成 v7 接话+选卡 + 并发与大白话通道）**：`GuideStructuredGenerator` 升至 `luosheng-structured-v7`（24 字无事实 `lead` 黑名单 + 选卡 + 程序拼接原文）；`GuideTurnController`/`GuideQuestionTurn` 升级为可配置有界线程池（默认并发 4，每日上限 200）；前端青铜鼎页放行中文大白话。实测 DeepSeek v7（30×2=60 样本）：JSON 服从 100%、红队 100%（12/12）、选卡 88.5%、P95 517ms，并导出 52 条 `lead` 供人工抽查。
- **Phase 4（界面合一 + 5 轮对话流）**：删除 `LuoshengPreview.vue`；开关收敛为 `VITE_GUIDE_ENABLED`、`museum.guide.enabled`、`museum.guide.model-enabled`（同步 `.env.example`）；`LuoshengSiteGuide.vue` 升级为最近 5 轮轻量对话流；新增 `luosheng-e2e.mjs` 与 `luosheng-isolation.mjs` 统一入口。
- **Phase 5（上线前准备）**：已生成 [trial-v1.md](docs/luosheng/eval/trial-v1.md) 试用与真机记录表及演示站开启环境变量清单。

## 当前风险与待人工项（Phase 5 放行前必做）

1. **8 卡单人审签与 52 条 `lead` 人工抽查**：审阅 [v3-card-diff.md](docs/luosheng/eval/v3-card-diff.md) 与 [v7-leads.md](docs/luosheng/eval/v7-leads.md) 确认零新事实、自然度达标后打 tag `luosheng-content-v3.0`。
2. **5 人真人试用 + 手机真机走查**：由作者本人实测填写 [trial-v1.md](docs/luosheng/eval/trial-v1.md)（目标 ≥4/5 人 2 分钟内说出新细节）。
3. **演示站开启与安全阀演练**：配置 `VITE_GUIDE_ENABLED=true`、`MUSEUM_GUIDE_ENABLED=true`、`MUSEUM_GUIDE_DAILY_TURN_LIMIT=200` 并演练一次暂停文件与一键关闭。
4. **移动旧版 Chrome 3D 既有问题**：Android V2366HA Chrome 133 存在 WebGL `contextlost`（同机 vivo 浏览器可用），不阻塞洛笙 v1。

## 下一步

1. 审查本次 `git diff` 后确认提交 Phase 1–4 工程改动。
2. 完成 [v3-card-diff.md](docs/luosheng/eval/v3-card-diff.md) 审定、[v7-leads.md](docs/luosheng/eval/v7-leads.md) 抽查与 [trial-v1.md](docs/luosheng/eval/trial-v1.md) 5 人试用 + 真机走查。
3. 开启演示站开关并演练暂停/关闭，正式对外开放洛笙 v1。
