# 洛笙 v1 真人试用与真机走查记录（Phase 5，待你填写）

> 按 [ADR-009](../../decisions/ADR-009-luosheng-v1-convergence.md) 规则，本文件必须由项目作者本人实测填写，代理不得代填。

## 1. 5 人真人试用（目标：≥4/5 人完成任务 ①）

每位测试者约 10 分钟，在青铜鼎页面完成 4 个任务：
- **① 北极星任务**：2 分钟内用自己的话说出 1 个原本没注意的构造细节
- **② 大白话追问**：用日常口语追问一次（如“两条腿？”“把手能提吗？”）
- **③ 缺证边界**：问“它是哪里出土的？”并确认未编造洛阳出土
- **④ 控制权**：输入或点击“我先自己逛”收起面板

| # | 测试者（匿名代号） | ① 新细节（2 分钟内） | ② 大白话追问 | ③ 缺证边界 | ④ 我先自己逛 | 原话反馈 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | P1 | ☐ 通过 / ☐ 未通过 | ☐ | ☐ | ☐ | |
| 2 | P2 | ☐ 通过 / ☐ 未通过 | ☐ | ☐ | ☐ | |
| 3 | P3 | ☐ 通过 / ☐ 未通过 | ☐ | ☐ | ☐ | |
| 4 | P4 | ☐ 通过 / ☐ 未通过 | ☐ | ☐ | ☐ | |
| 5 | P5 | ☐ 通过 / ☐ 未通过 | ☐ | ☐ | ☐ | |

## 2. 手机真机走查（1 次）

- 设备型号 / 系统 / 浏览器：
- 软键盘弹出时输入框与发送按钮是否可见：☐ 通过 / ☐ 问题：
- 5 轮对话流滚动与折叠出处是否顺畅：☐ 通过 / ☐ 问题：
- 收起与“我先自己逛”是否正常：☐ 通过 / ☐ 问题：

## 3. 演示站开启与安全阀演练（1 次）

部署环境变量（仅服务端注入密钥）：
```bash
# 前端构建
VITE_GUIDE_ENABLED=true

# 后端运行
MUSEUM_GUIDE_ENABLED=true
MUSEUM_GUIDE_MODEL_ENABLED=true
MUSEUM_GUIDE_PACK_PATH=/app/content/luosheng/ding.zh-CN.json
MUSEUM_GUIDE_MINIMUM_VERSION_PATH=/app/content/luosheng/minimum-release-version.txt
MUSEUM_GUIDE_APPROVED_DIGEST_PATH=/app/content/luosheng/ding.zh-CN.sha256
MUSEUM_GUIDE_MODEL_ENDPOINT=https://api.deepseek.com/chat/completions
MUSEUM_GUIDE_MODEL_NAME=deepseek-chat
MUSEUM_GUIDE_MODEL_KEY=<你的 DeepSeek Key>
MUSEUM_GUIDE_DAILY_TURN_LIMIT=200
MUSEUM_GUIDE_MAX_CONCURRENT_GENERATIONS=4
MUSEUM_GUIDE_PAUSE_PATH=/tmp/luosheng.pause
```

- 暂停文件（`touch /tmp/luosheng.pause`）演练结果：☐ 通过
- 关闭开关（`MUSEUM_GUIDE_ENABLED=false`）演练结果：☐ 通过
