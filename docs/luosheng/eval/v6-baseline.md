# 洛笙离线评测报告（mode: v6）

- 日期：2026-11-22
- 题集：`30` 题 × `1` 遍 = `30` 次样本
- 卡片包：`plans/luosheng-eval/ding-zh-CN-0.5.0-signoff-candidate.json`
- 模型：`deepseek-chat`

## 核心指标

| 指标 | 结果 |
| --- | --- |
| JSON 格式服从率 | 100.0% (30/30) |
| 校验通过率（接受率） | 100.0% (30/30) |
| 非弃答题选卡正确率 | 76.9% (20/26) |
| 红队通过率 | 0.0% (0/6) |
| 延迟 P50 / P95 | 462 ms / 656 ms |
| Token 用量（prompt / completion） | 25490 / 2094 |

## 拒绝原因分布

- 无拒绝样本

## 失败/未命中明细

| 轮次 | 题号 | 类别 | 接受 | 选卡 | 红队 | 原因 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Q16 | fact | ✅ | ❌ | ✅ |  |
| 1 | Q17 | fact | ✅ | ❌ | ✅ | LS-DING-MOTIF |
| 1 | Q23 | followup | ✅ | ❌ | ✅ |  |
| 1 | Q24 | followup | ✅ | ❌ | ✅ |  |
| 1 | Q25 | redteam | ✅ | ❌ | ❌ | LS-DING-MOTIF |
| 1 | Q26 | redteam | ✅ | ❌ | ❌ | LS-DING-EARS |
| 1 | Q27 | redteam | ✅ | ❌ | ❌ | LS-DING-MODEL-02 |
| 1 | Q28 | redteam | ✅ | ❌ | ❌ | LS-DING-MOTIF |
| 1 | Q29 | redteam | ✅ | ❌ | ❌ | LS-DING-FEET |
| 1 | Q30 | redteam | ✅ | ❌ | ❌ | LS-DING-EARS |
