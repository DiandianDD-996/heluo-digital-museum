# 洛笙 AI 向导「更自由、更大胆、更智能」迭代计划（v2.1）

> 日期：2026-11-24  
> 关联模块：洛笙 AI 向导（[docs/luosheng/README.md](../luosheng/README.md)、[ADR-010](../decisions/ADR-010-luosheng-v2-museum-agent.md)）

## 1. 现状诊断：为什么当前向导显得过于谨慎？

1. **语气防御过重、缺乏策展感染力**：`GuidePromptBuilder` 中大量前置禁令使模型在普通问答中也习惯性先输出免责声明（“不能确认也不能排除”“不在现有档案中”），读起来像法务核对员而非博物馆资深讲解员。
2. **历史与文化通识被过度压抑**：模型不敢结合商周青铜礼制、块范法铸造常识、玉璧礼仪脉络、黄河流域聚落文化等公开通识做纵深延展，导致回答局限于 90 字目录摘要复述。
3. **模型参数与记忆偏保守**：`temperature=0.35` 偏干涩、`max_tokens=900` 易限制深度对比与路线规划、`MAX_TOOL_ROUNDS=2` 限制多步联合检索、`history` 仅保留 400 字符导致多轮追问丢失上下文。
4. **工具能力存在盲区**：`get_museum_item_detail` 不支持 `product`；`query_appointment_slots` 查询指定日期无余量时不会自动顺延推荐近期可约时段。
5. **前端交互与排版偏平面**：聊天气泡仅渲染纯 `<p>`（不支持加粗与列表结构）；3D 展柜缺少“一键三步导览”联动；跨页切换时仅插入静态分割线，缺乏主动引导。

## 2. 迭代目标与改动范围

在**坚守 100% 事实诚实（不编造出土记录/王世/估价、不把原创概念展品说成真实出土文物、不代客下单/预约）**的前提下，从 5 个维度全面升级：

1. **解放策展人格与文化通识（`GuidePromptBuilder.java`、`GuideLlmClient.java`、`GuideProperties.java`）**：
   - 明确区分「馆藏特定档案事实（严格忠于记录）」与「历史/工艺/美学通识（大胆、生动、有见地地展开）」；
   - 禁止在未问及边界时主动堆砌免责声明，将档案边界自然收进折叠 `boundaryNote`；
   - 提升默认 `temperature` 至 `0.65`、`max_tokens` 至 `1600`、`MAX_TOOL_ROUNDS` 至 `4`、历史记忆上限至 `14` 轮 / `1200` 字符。
2. **增强只读工具智能度（`GuideToolExecutor.java`）**：
   - `get_museum_item_detail` 新增支持 `product`，可深度讲解文创设计与库存；
   - `query_appointment_slots` 默认窗口扩至 7 天，且当指定日期无余量时自动附带 `nextAvailableSlots`（最多 3 个最近可约时段），一轮给出替代方案；
   - 目录索引补充 `period`、`material`、`dimensions` 及更完整摘要，并补充 `/explore`、`/exhibits` 页面上下文。
3. **升级交互动作与 3D 三步导览（`GuideModels.java`、`GuideResponseValidator.java`、`LuoshengSiteGuide.vue`、`luoshengStore.ts`）**：
   - 新增 `viewer_tour` 动作（点击后在 3D 展柜按 `ear → motif → feet` 平滑巡礼，可随时切换/打断，控制权仍归游客）；
   - `navigate` 支持 `category`（探索页分类筛选）与 `people`（预约页人数预填，同步更新 `AppointmentView.vue`）。
4. **富文本结构化排版与主动语境引导（`LuoshengSiteGuide.vue`、`guidePresets.ts`）**：
   - 零 `v-html` 纯 Vue 模板安全解析 `**加粗**` 与有序/无序列表；
   - 升级各路由开场破冰问题，兼顾深度、想象力与实用性；
   - 跨页分割线新增可点击「问问当前展品」快捷胶囊。
5. **文档与验证闭环**：
   - 补充后端与前端单测覆盖新工具、新动作、`viewer_tour` 与富文本解析；
   - 运行后端 `mvn test`、前端 `vue-tsc -b`、`vitest run`、`vite build` + 包体预算门禁。

## 3. 风险与回滚

- **红线回归风险**：提高 `temperature` 与鼓励通识延展后，需确保 `GuideResponseValidator` 的 5 条核心红线拦截保持完好，且 Prompt 仍明确区分特定档案与通识背景。
- **包体预算**：前端新增排版解析与 `viewer_tour` 需控制在轻量化实现，确保构建后仍通过 `bundle-budget` 检查。
