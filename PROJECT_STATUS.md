# 项目状态

> 本文件只记录**当下状态、风险与下一步**（硬上限 150 行）。完整历史记录已归档至 [docs/archive/status-2026.md](docs/archive/status-2026.md)。

## 当前总览（2026-11-22）

| 模块 | 当前状态 | 说明 |
| --- | --- | --- |
| 数字博物馆主体（前后端 + 3D + 预约 + 商城模拟支付 + 后台） | **已完成并已部署演练** | F-01～F-14、A-01～A-02、N-01～N-06 均已达成；PocketBay 演示站已跑通 |
| 洛笙 AI 向导（可选扩展 v1） | **Phase 0（M0）已完成，生产默认关闭** | 已采纳 [ADR-009](docs/decisions/ADR-009-luosheng-v1-convergence.md)，唯一活文档见 [docs/luosheng/README.md](docs/luosheng/README.md) |

## 最近完成（2026-11-22）

- **洛笙 Phase 0（M0 止血收尾）完成**：
  - 未提交改动已拆分为干净提交；`frontend/src/oracleJdk-27/` 已移出仓库至 `C:\Tools\oracleJdk-27`。
  - 15 份历史洛笙计划与运行日志已归档至 `docs/archive/luosheng/`；`PROJECT_STATUS.md` 与 `docs/01-requirements-traceability.md` 均已瘦身至 ≤150 行。
  - 用户已拍板：`museum.guide.daily-turn-limit=200`（DeepSeek），并纳入并发线程池（默认 4）+ `temperature=0`、青铜鼎页大白话直通后端、5 轮轻量对话流三项修补。

## 当前风险与已知待办

1. **真实模型表现未测**：`luosheng-structured-v6` 尚未在真实 DeepSeek 上跑过系统基线（Phase 1 优先解决）。
2. **线上并发与体验阻塞**：当前代码仍为 `maxConcurrentGenerations=1`、无 `temperature=0`、卡片为法务免责腔、前端单轮覆盖框（分别在 Phase 1/2/3/4 解决）。
3. **测试引用遗留**：`docs/plans/luosheng-eval/` 下 0.5.0 候选快照目前被既有后端/离线测试引用，保留至 Phase 2 切换至 `content/luosheng/ding.zh-CN.json` 后一并清理。
4. **移动旧版 Chrome 3D 既有问题**：Android V2366HA Chrome 133 存在 WebGL `contextlost`（同机 vivo 浏览器实测可用），暂不阻塞洛笙 v1。

## 下一步（严格按序）

1. **Phase 1（M1，1 天）**：修复 `GuideChatCompletionModel` 参数（`temperature=0` + 超时对齐），建立 30 题评测集与离线脚本，用真实 DeepSeek 跑通 30×3 基线并按分叉规则决策。
2. **Phase 2（M2，1.5 天）**：8 张青铜鼎卡片按 Schema v3（`spoken`/`boundary`/`systemConstraints`）口语化改写，单人审签打 tag，清理旧 0.5.0 快照。
3. **Phase 3（M3，2 天）**：升级生成 v7（接话 + 选卡）、补并发池与青铜鼎页大白话通道。
4. **Phase 4（M4，1.5 天）**：删除 `LuoshengPreview.vue`、开关 7 合 3、`LuoshengSiteGuide` 补 5 轮对话流、浏览器脚本 11 合 2。
5. **Phase 5（M5，1.5 天）**：5 人真人试用 + 真机走查 + 演示站公开开启。
