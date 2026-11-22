# 洛笙开源调研与升级

2026-11-20。关联 LS-02、LS-03、LS-04、LS-06、LS-08。范围为青铜鼎本机实时问答、现有全站导览的后续扩展，以及相应的验证。

| 项目 | 仓库许可 | 查阅结果与借鉴方式 |
| --- | --- | --- |
| [Tour Avatar](https://github.com/liwei0513/tour-avatar) | MIT | Android 导览的 `ChatViewModel` 分开处理游客消息、检索、模型输出和朗读。洛笙采用限量的当前看点问答回顾，保留现有网页和展品交互。 |
| [Ben Uri Agentic RAG Chatbot](https://github.com/luisrodriguesphd/agentic-rag-chatbot) | Apache-2.0 | 仓库把 Agent、资料索引、检索和评估分成独立管线。洛笙将模型身份与文物证据问答分开处理。 |
| [Local Museum Chatbot for Qwen](https://github.com/alexandercartledge/local-museum-chatbot-qwen) | MIT | README 说明按展室整理馆方文本，再用相关展室资料回答。对应洛笙现有展品、看点与证据卡边界。 |
| [Museum Guide App](https://github.com/extrawest/museum_guide_app) | Apache-2.0 | README 说明以两个流程拆开检索藏品与讲解。扩展馆藏时可借鉴，先确定藏品再调用讲解。 |
| [The Warhol Out Loud](https://github.com/CMP-Studio/TheWarholOutLoud) | MIT | 面向博物馆的无障碍音频导览，作为后续字幕、文字讲解和播放控制的参考。 |
| [ACMI Static Museum Audio Guide](https://github.com/ACMILabs/static-museum-audio-guide) | MIT | 轻量音频导览模板，作为后续路线和离线内容组织的参考。 |
| [RAGFlow](https://github.com/infiniflow/ragflow) 与 [Promptfoo](https://github.com/promptfoo/promptfoo) | Apache-2.0 / MIT | 前者参考带依据的检索，后者参考把固定问法、预期来源和缺证行为写成回归用例。 |
| [Museum-AI](https://github.com/Tswoen/Museum-AI) 与 [华东师大博物馆 AI 导览](https://github.com/Cral-39/ecnu-museum-ai-assistant) | GitHub 未标明 SPDX 许可证 | 用于观察中文知识管理与卡片导航，当前仅作产品参考。 |

搜索覆盖英文博物馆 LLM、博物馆 RAG、馆方音频导览和中文 AI 导览。许可证来自仓库元数据。实现沿用 Vue、Spring Boot 和现有证据链，以本项目代码实现借鉴机制。

## 本轮实现与验收

1. 模型身份问答从本机预览的服务端配置读取。问「你是什么模型」时回复配置中的模型名，保留待接续的展品看点和出处。
2. 当前看点可回顾最近的问答文字；换看点、关闭导览或离开页面时清空记录，历史里不重复挂载图版操作。
3. 提示词把展品答案限制在游客实际问到的部位，从最有用的观察建议说起；证据不足时明确事实边界。
4. 验收模型标识、本地身份与真实生成的分流、会话取消、历史窗口、换看点清理、双主题与缺证。

## 验证结果

- 前端 507 项测试通过，类型检查、生产构建、首屏与配乐资源预算通过。
- 后端定向检查 42 项通过，1 项按开关跳过。包含双主题本机替身验收。首次浏览器检查的输入框名称同时匹配了全站导览，改为精确匹配后复跑通过。
- DeepSeek Flash 实页验收通过。390px 深色与 1440px 浅色验证模型身份、问答回看、换看点清理、鼎耳与三足的图版引用、追问依据和缺证。四条实测生成答复约 1.9 至 2.9 秒，仅记录本次样本。
- 上线、跨展品会话、流式输出、语音对话与真机验收待后续阶段验证。

## 后续扩展

- 按展览、藏品、展品看点三个层级扩充带版本的馆方证据卡，保留出处和审签状态。
- 用固定测试集比较自由追问、来源追踪、简明讲解、导航和拒答，先用本地替身验证协议，再用同批问题复核真实模型。
- 语音、实时流式和跨页会话分别验收。流式优先考虑在证据复核完成后输出，语音需要字幕和手动播放控制。
