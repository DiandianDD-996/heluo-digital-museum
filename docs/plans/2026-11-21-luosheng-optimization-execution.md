# 洛笙优化执行方案（可直接交给编码代理）

2026-11-21 · 状态：待执行 · 前置：ADR-006、ADR-007、`2026-11-21-luosheng-unified-visitor-guide-final.md`

> 本文件是自包含的执行契约。执行代理不需要本次对话的上下文。
> 计划中的代码事实以执行时的实际代码为准；如有出入，先记录差异，再按代码行事。

---

## 0. 启动指令（粘贴到编码代理的 goal）

```text
在 C:\Users\Jie\Documents\博物馆 中，按 docs/plans/2026-11-21-luosheng-optimization-execution.md 执行洛笙优化。

第一步：阅读 AGENTS.md、PROJECT_STATUS.md、本方案、ADR-006、ADR-007。
第二步：执行 WP0 前置检查。工作树不干净时立即停止并询问，不得开始改动。
第三步：按 WP1 → WP2 → WP3 → WP5 → WP4 → WP6 顺序逐包执行。
每个工作包：先写会失败的测试 → 最小实现 → 跑本包指定检查 → 在本文件 §9 记录结果 → 再进入下一包。

硬约束：
- 不启用向导，不调用真实模型，不新增依赖，不改公开 API，不改生产数据。
- 不执行 git commit / push / reset / 删除，除非用户逐次明确确认。
- 任一停止规则触发时立即停下，写清证据，不要自行扩大范围。
- 每个工作包结束后按 AGENTS.md §7 汇报：完成内容、修改文件绝对路径、验证结果、未验证项与风险。
```

如果只能跑一次 goal，只执行 **WP0 + WP1**。WP1 是决定后续是否值得继续平台化投资的关键实验；其余工作包可以在拿到 WP1 结论后再排。

---

## 1. 一句话目标

把洛笙从“单件展品的证据问答”升级为**可验证、可复用、可测量**的向导内核：用最少的代码换取最多的信息，不新增面向游客的功能。

判断成功的标准不是“测试更多了”，而是能回答三个问题：

1. 加第二件藏品，需要改代码吗？
2. 模型说的每一句，能不能被代码证明有依据？
3. 真实游客在哪里答不上来，能不能在不收集问题正文的前提下看见？

---

## 2. 诊断摘要（本方案为什么是这些工作）

| # | 问题 | 代码证据 | 本方案对应 |
| --- | --- | --- | --- |
| 1 | 单件定制：卡号、图版、事实来源硬编码在控制器 | `GuideTurnController` 构造函数、`PLATES`、`supportsTopic()` 均写死 `LS-DING-*` | WP1 |
| 2 | 意图解析分散：旧站点问答、发现、时段、返回、后端检索各有一套规则 | `luoshengSiteGuide.ts`、`luoshengDiscovery.ts`、`luoshengSlots.ts`、`luoshengPreview.ts`、`GuideFollowUpRetrieval.java` | WP2 |
| 3 | “证据约束”只校验引用集合，不校验正文是否被引用支持 | `GuideAnswerDelivery.deliver()` 只检查长度、引用子集、去重 | WP3 |
| 4 | 内容签核吞吐未量化，六张卡仍未签完 | `PROJECT_STATUS.md`、`docs/plans/luosheng-eval/` | WP4 |
| 5 | 真实模型样本 0、真人试用 0；匿名计数只有 6 类 | `GuideTurnController.JOURNEY_EVENTS` | WP5 |
| 6 | 旧路径未删、单语言写死、死代码留存 | `validate()` 写死 `zh-CN`；`answerSiteGuide` 仍被调用 | WP6 |

**不在本方案解决的事**：语音、跨设备续看、个性化路线、多展品对比（L4，继续延后）；3D 渲染；商城与预约业务流程。

---

## 3. 非目标与硬约束

- 不新增游客可见功能、入口或页面。
- 不新增第三方依赖；如确有必要，先写替代方案与体积/维护影响，等用户确认。
- 不接入真实支付、短信、第三方登录或未批准的云服务。
- 不修改 `deploy/` 下的生产配置；新增配置只进 `.env.example` 与候选说明。
- 不启用 `MUSEUM_GUIDE_*` 的任何开关；所有验证在默认关闭或测试夹具下完成。
- 不调用真实模型；生成相关测试只使用本机协议替身或固定桩。
- 不修改已签核内容卡的正文；WP1 只增加路由档案，不签新内容。
- 不改动公开 API 的既有字段；如必须新增字段，先说明兼容策略并等待确认。
- 不提交生成产物、测试报告、日志、本地数据库或上传内容。
- 不顺手格式化、不升级依赖、不重构无关模块。

---

## 4. WP0：前置检查与基线（0.5 天）

### 目标

在动任何代码之前，确认工作树状态、记录可复现基线，避免把既有未提交改动混进本次任务。

### 步骤

1. 记录：
   ```bash
   git rev-parse --short HEAD
   git status --porcelain
   git diff --stat
   ```
2. **门禁**：如果 `git status --porcelain` 有非本任务文件，停止，向用户报告并询问先提交、暂存还是另开工作树。不得在脏树上开始 WP1。
3. 阅读并按需记录：
   - `AGENTS.md` 第 3、4、5、6、7 节；
   - `PROJECT_STATUS.md` 最新 20 条；
   - `docs/01-requirements-traceability.md` 中与导览相关的需求 ID；
   - `docs/05-api-design.md` 的 `/api/v1/guide/*`；
   - `docs/06-test-plan.md` 的导览章节。
4. 运行基线并记录实际数字（不要照抄本文件里的数字）：
   ```bash
   pnpm --dir frontend typecheck
   pnpm --dir frontend test
   pnpm --dir frontend build
   cd backend && mvn -B test
   ```
   离线评测按仓库既有方式运行；若脚本自带用法说明，以说明为准：
   ```bash
   node --test docs/plans/luosheng-eval/*.test.mjs
   ```
5. 在 `docs/plans/luosheng-eval/optimization-run-log.md` 新建执行日志，写入：日期、HEAD、基线命令与结果、失败/跳过项、环境说明。

### 验收

- 执行日志存在且包含真实输出摘要。
- 工作树干净，或用户已明确同意当前处理方式。
- 基线中所有失败项被逐条记录，不用“应该可以”代替。

### 停止规则

- 工作树不干净且用户未答复 → 停止。
- 基线命令无法运行（缺 JDK、Node、pnpm、数据库）→ 记录环境差异，停止并询问是否允许用 CI 等价命令替代。

---

## 5. WP1：档案化配置 + 第二件藏品实验（2–3 天）

### 目标

回答唯一重要的问题：**洛笙的“可复用”是真的，还是这一件鼎的定制西装？**

做法：把控制器里所有 `LS-DING-*` 硬编码抽成一份可校验的展品档案（profile），然后用第二件结构不同的藏品（建议 `river-map-jade-bi`）在测试夹具中跑通同一套流程。

### 关联需求

执行时从 `docs/01-requirements-traceability.md` 查取导览相关 ID 并写入本节与追踪表。

### 影响范围

- `backend/src/main/java/com/heluo/museum/guide/GuideTurnController.java`
- `backend/src/main/java/com/heluo/museum/guide/GuideFollowUpRetrieval.java`
- 新增 `backend/src/main/java/com/heluo/museum/guide/GuideProfile.java`（或等价类）
- `backend/src/main/resources/application.yml`
- `deploy/.env.example`、`deploy/README.md`
- `backend/src/test/java/com/heluo/museum/guide/`（新增参数化测试与第二展品夹具）
- `backend/src/test/resources/`（第二展品证据包与档案）
- `docs/05-api-design.md`、`docs/decisions/`（若形成长期决定）

### 设计

1. 新增档案文件，运行时由 `museum.guide.profile-path` 指向；**档案只做路由，不承载面向游客的事实**，事实仍来自已签核证据卡。
2. 档案结构（示例，执行时可微调，但必须保持“数据驱动、失败关闭”）：
   ```json
   {
     "version": 1,
     "exhibits": [
       {
         "exhibitSlug": "heluo-bronze-ding-3d",
         "artifactSlug": "heluo-bronze-ding",
         "locale": "zh-CN",
         "plates": [
           { "stop": "ear", "cardId": "LS-DING-EARS", "revision": 1, "view": "top" },
           { "stop": "feet", "cardId": "LS-DING-FEET", "revision": 1, "view": "back" },
           { "stop": "motif", "cardId": "LS-DING-MOTIF", "revision": 2, "view": "relief" }
         ],
         "factSources": {
           "PERIOD": { "cardId": "LS-DING-PERIOD", "revision": 1 },
           "SIZE": { "cardId": "LS-DING-SIZE", "revision": 1 },
           "PROVENANCE": { "cardId": "LS-DING-SOURCE", "revision": 2 }
         },
         "topicCardIds": ["LS-DING-EARS", "LS-DING-FEET", "LS-DING-MOTIF"]
       }
     ]
   }
   ```
3. 启动时校验档案：字段完整、`stop` 在枚举内、同一展品/语言下无重复、卡号非空、修订号 ≥1。任何一项失败 → 启动失败并给出可读错误，不进入半可用状态。
4. 请求时按 `(exhibitSlug, locale)` 取档案；缺失 → 与现有“展项不可用”一致地失败关闭（404），不返回通用回答。
5. 删除控制器中的卡号常量、`PLATES` map、`supportsTopic` switch，以及 `GuideFollowUpRetrieval` 构造函数里的固定 `Reference`。删除后 `grep -R "LS-DING-" backend/src/main/java` 必须为 0。
6. 第二展品夹具：
   - 在测试资源中新增 `river-map-jade-bi` 的证据包（2–3 张合成卡，含 `claim`）与档案；
   - 在测试库中插入对应的 `PUBLISHED` 3D 展项行（仅测试迁移/初始化脚本，不新增生产迁移）；
   - 参数化集成测试对两件展品跑同一组场景：椭圆指代、明确纠正、问出处、图版确认、缺证弃答。
7. 配置与文档：`application.yml` 增加 `profile-path`；`.env.example` 同步；`deploy/README.md` 写明默认关闭、缺失档案即拒绝启动。

### 验收（逐条可执行）

- [ ] `grep -R "LS-DING-" backend/src/main/java` 返回空。
- [ ] 档案缺失、字段缺失、重复 `stop`、修订号非法，各有测试且表现为启动失败或 404，而非默认回答。
- [ ] 两件展品跑同一套参数化集成测试，全部通过。
- [ ] `cd backend && mvn -B test` 全绿；不得减少既有测试数量（若调整，说明原因）。
- [ ] 默认关闭配置下，前端构建与既有导览隔离测试不变。
- [ ] `.env.example`、`application.yml`、`deploy/README.md` 三处配置一致。
- [ ] 在 `docs/plans/luosheng-eval/optimization-run-log.md` 记录：为支持第二展品实际改了哪些文件、多少行、哪些是新数据、哪些是新逻辑。

### 停止规则（重要）

- 如果为了让第二件藏品跑通，需要改动公开 API、前端组件或超过 15 个文件 → 停止。这说明抽象没有成立，不要硬做。
- 如果第二件藏品无法在不新增内容签核流程的前提下验证 → 停止，改用“档案可加载 + 纯单元测试”作为最小证据，并在报告中明确降级。
- 结论只有两种，必须写清楚：
  - **可复用**：新增展品只需加数据与档案；
  - **单件定制**：新增展品必须加代码。若为后者，写 ADR-008，明确把后续投入转向内容与试用，不再做平台化叙事。

### 风险

- 档案与已签核证据包之间可能出现卡号/修订号漂移 → 运行时 `resolve()` 已校验修订号；补一条“档案引用不存在卡号时失败关闭”的测试。
- 新增必填配置会让现有候选启动失败 → 默认关闭路径不得要求该配置；只有 `turns-enabled=true` 时才强制。

---

## 6. WP2：单一意图契约（2–3 天）

### 目标

前端只保留一个意图解析入口，删除“同一句话被不同函数理解成不同意思”的结构性风险。

### 范围

只统一**前端面向游客的路由意图**（站点导航、发现搜索、时段查询、返回看点、取消）。后端的证据检索正则属于另一个域（取证），不在本包合并；但必须明确边界：只有被判定为“当前展品取证”的问题才允许发往 `/api/v1/guide/turns`。

### 影响范围

- `frontend/src/lib/luoshengSiteGuide.ts`
- `frontend/src/lib/luoshengDiscovery.ts`
- `frontend/src/lib/luoshengSlots.ts`
- `frontend/src/lib/luoshengPreview.ts`（仅返回看点判定部分）
- 新增 `frontend/src/lib/luoshengIntent.ts`
- 新增 `frontend/src/lib/luoshengIntent.spec.ts` 与语料夹具
- `frontend/src/components/LuoshengSiteGuide.vue`（只改调用点，不重写组件）
- `frontend/src/lib/luoshengTurns.spec.ts`（边界断言）

### 设计

1. 定义判别联合：
   ```ts
   type Intent =
     | { kind: 'cancel-slot' }
     | { kind: 'slot-query'; date: string; people: number }
     | { kind: 'slot-clarify'; people?: number }
     | { kind: 'resume-lookpoint'; stop: GuideStop }
     | { kind: 'site-page'; route: string }
     | { kind: 'site-navigation'; stops: SiteStop[] }
     | { kind: 'discovery-search'; keyword: string; exclusions: string[] }
     | { kind: 'discovery-clarify' }
     | { kind: 'object-evidence' }
     | { kind: 'unknown' }
   ```
2. 固定优先级，写进代码注释与测试名：
   1. 明确取消 → `cancel-slot`
   2. 日期/人数 → `slot-query` / `slot-clarify`
   3. 明确要求回到刚才的看点 → `resume-lookpoint`（只有游客主动要求时才返回）
   4. “这里/当前页/我在哪” → `site-page`
   5. 当前展品上的取证问题 → `object-evidence`
   6. 带排除项的找物 → `discovery-search`
   7. 站点导航 → `site-navigation`
   8. 其余 → `discovery-clarify` 或 `unknown`
3. `answerSiteGuide` 不再做模式匹配：把它的调用点改成只取页面说明（`explainSitePage`）或新意图结果。完成后 `grep -R "answerSiteGuide" frontend/src` 必须为 0。
4. 旧模块保留为薄适配器（`discoveryIntent`、`slotIntent`、`requestsSavedLookpoint` 内部转为调用 `parseIntent`），保证现有调用点不炸；等语料全绿后再删除适配器。
5. 金标语料至少 80 条，必须包含：
   - 方案 §1 的 8 条失败原话；
   - 否定 + 逗号混合：“不想预约，只想看青铜鼎”；
   - 无标点：“先看鼎再查明天”；
   - 全角/半角、空白、末尾语气词；
   - “另一只呢”“我说的是脚”“它以前断过吗”“明天还有名额吗”；
   - “回到刚才那只耳朵”“接着看玉器”（后者不得触发返回）；
   - 输入法选字过程中的中间态字符串（不得误提交）。
   每条包含 `question`、`context`（路由、是否在展品页、已选看点、待查时段手误）、`expected`。

### 验收

- [ ] `luoshengIntent.spec.ts` 语料 100% 通过。
- [ ] `grep -R "answerSiteGuide" frontend/src` 为 0。
- [ ] 只有 `object-evidence` 会产生 `/turns` 请求；新增一条测试，断言导航/时段/找物问题不触发问答请求。
- [ ] 现有前端测试除非因删除旧函数而调整，否则不得修改断言；调整需逐条说明。
- [ ] `pnpm --dir frontend typecheck && pnpm --dir frontend test && pnpm --dir frontend build` 全绿。
- [ ] 组件行数不得显著增加（以 `git diff --stat` 为准；目标 ±50 行内）。

### 停止规则

- 如果统一意图需要重写 `LuoshengSiteGuide.vue` 主体 → 停止，改为“新增入口 + 旧函数适配”，分两批做。
- 如果语料中超过 10% 的用例无法用确定性规则表达 → 记录下来，不要引入模型分类器；这一轮允许它们在 `unknown`，下一轮再评估。

### 风险

- 行为回归：现有 523 项测试覆盖了很多边界，语料要覆盖它们断言过的语义，而不是只覆盖新写的例子。
- 优先级冲突：“先看鼎再查明天”这类顺序请求如果无法一次表达，明确降级为“先执行第一步 + 提示可继续”，并在语料中锁定该行为。

---

## 7. WP3：句级引用校验（1–2 天）

### 目标

把“证据约束生成”从提示词承诺变成代码约束：模型输出的每一句，必须能对应当轮证据卡中的一段原文；否则整份草稿作废。

### 影响范围

- `backend/src/main/java/com/heluo/museum/guide/GuideStructuredGenerator.java`
- `backend/src/main/java/com/heluo/museum/guide/GuideAnswerDelivery.java`
- `backend/src/main/java/com/heluo/museum/guide/GuideQuestionTurn.java`（如需新失败类别）
- `backend/src/test/java/com/heluo/museum/guide/GuideStructuredGeneratorTests.java`
- 新增 `GuideGroundedDraftTests.java`（或等价）
- `docs/05-api-design.md`（仅内部实现说明；对外响应不变）

### 设计

1. 提示词版本升级为 `luosheng-structured-v5`，响应格式改为按句返回：
   ```json
   {
     "sentences": [
       { "text": "面向游客的一句话", "slot": 1, "quote": "证据卡中的原文片段" }
     ],
     "references": [1]
   }
   ```
   证据不足仍返回 `{"text": null, "references": []}`（保持现有弃答通道）。
2. 确定性校验（全部满足才接受）：
   - `sentences` 数量 1–6，总字数 ≤300 码点，单句 ≤120 码点；
   - `slot` 必须是当轮 evidence 的合法下标；
   - `quote` 经 NFKC 与空白归一后，必须是该 slot 卡原文的**连续子串**，长度 ≥6 码点；
   - `references` 去重后 ≤3，且都能对应到 slot；
   - 任何一句失败 → 整份草稿丢弃。
3. 丢弃后的对外行为保持不变：返回 `GENERATION_UNAVAILABLE`（前端已有降级路径），内部日志 `event=guide_generation_rejected`，并给指标计数。**不要**新增对外响应类别，避免前端改动。
4. 保留：严格 JSON（重复键、尾随内容拒绝）、16KB 载荷上限、8 秒超时、单并发、日额度。

### 验收

- [ ] 以下用例各有测试且行为正确：
  - 每句 quote 均为原文子串 → 接受；
  - 一句 quote 为改写 → 整份拒绝；
  - quote 来自另一张卡 → 拒绝；
  - 缺少 quote → 拒绝；
  - 三句中一句无依据 → 整份拒绝；
  - 弃答 JSON → 保持 `Draft("", [])`；
  - 重复键/尾随内容/超长 → 拒绝。
- [ ] 生成失败对外仍是 `GENERATION_UNAVAILABLE`，前端无改动。
- [ ] 用固定证据集跑离线评测，记录“接受率”；与 v4 的接受率对比并写入执行日志。
- [ ] `cd backend && mvn -B test` 全绿。

### 停止规则

- 如果固定证据集上的接受率低于 60%，停止，不要为了通过而放宽 quote 校验；先分析是提示词问题还是证据文本过长，再决定是否调整。
- 如果必须改前端才能展示拒绝状态 → 停止，保持对外类别不变，只在内部记录。

### 风险

- 生成可用性下降：这是有意的取舍。报告里必须同时给出“拒绝率”和“假阳性通过率（应为 0）”，不能只报一面。
- 证据卡文本里可能存在跨句引用 → quote 允许任意子串，不要求整句匹配，避免误杀。

---

## 8. WP4：内容吞吐与签核工作流（0.5–1 天）

### 目标

把“一张卡从起草到双签要多久”变成可测量、可复用的流程，而不是每次重新摸索。

### 范围

- `docs/plans/luosheng-eval/` 现有工具：`prepare-evidence-candidate.mjs`、`check-evidence-review.mjs`、`check-context-batch.mjs`、`context-check.mjs`
- 新增 `docs/plans/luosheng-eval/CONTENT-WORKFLOW.md`
- 新增 `docs/plans/luosheng-eval/card-review-checklist.md`
- 如需小工具，只允许薄封装，不重写现有校验逻辑

### 步骤

1. 阅读现有工具与 `docs/plans/2026-11-19-luosheng-evidence-cards.md`，画出当前实际流程（谁写、谁审、谁签、产物是什么）。
2. 用 WP1 的第二展品测试卡做一次**干跑**：从草稿到通过 `check-evidence-review`，记录每一步命令、耗时、卡点。
3. 写出 `CONTENT-WORKFLOW.md`：
   - 五步以内：起草 → 自检 → 指纹/候选 → 双签 → 发布；
   - 每步一条命令与预期输出；
   - 常见失败与修复；
   - 明确“哪些字段必须人工判断，哪些可自动校验”。
4. 写出 `card-review-checklist.md`：来源、版权、断代口径、数字精度、claim 键值、数字模型与原器的区分、禁止推断清单。
5. 给出单位成本基线：本次干跑的实际耗时；并定义下一次的目标（例如 ≤30 分钟/卡，达到后才有资格谈第二件正式藏品）。

### 验收

- [ ] 干跑全程只用文档里的命令，不依赖个人记忆。
- [ ] `CONTENT-WORKFLOW.md` 可被非工程人员按步骤执行。
- [ ] 现有离线工具测试全绿，未修改其断言。
- [ ] 不签核任何正式内容卡，不生成正式发布指纹。

### 停止规则

- 如果现有工具无法在不改变签核语义的前提下复用 → 停止，只写流程文档与卡点报告，不新写工具。

---

## 9. WP5：匿名信号与真人试用套件（1 天 + 人工执行）

### 目标

在不收集问题正文的前提下，拿到“哪类问题答不上来”的信号；并准备一套 8 人试用工具，让人工试用可以直接开始。

### 范围

- `backend/src/main/java/com/heluo/museum/guide/GuideTurnController.java`（事件枚举）
- `frontend/src/stores/luoshengVisit.ts`（事件上报）
- `frontend/src/lib/luoshengTurns.ts`（回复类别映射）
- 新增 `docs/plans/2026-11-21-luosheng-trial-kit.md`
- 新增 `docs/plans/luosheng-eval/trial-results-template.md`

### 设计

1. 扩展匿名事件类别（仍然只发枚举，不发正文、不发访次、不带 Cookie/来源页）：
   `turn-insufficient`、`turn-clarify`、`turn-disputed`、`generation-unavailable`、`generation-rejected`、`intent-unknown-navigation`、`intent-unknown-object`、`intent-unknown-slot`、`intent-unknown-discovery`。
2. 后端 `JOURNEY_EVENTS` 增加对应映射；未知类别仍返回 400。
3. 前端在收到回复类别时上报一次，失败静默；不得因上报失败影响回答展示。
4. 试用套件必须包含：
   - 8 名参与者、每人 10–15 分钟；
   - 5 个任务：五分钟看一件、不预约只看鼎、另一只呢、我说的是脚、去预约再回来；
   - 每项的成功标准与观察记录栏；
   - 同意说明（只记录任务完成情况与匿名类别，不录屏、不收集原话）；
   - 结果模板：每项完成率、澄清次数、动作到达率、返回成功率、主观困惑点。
5. 明确标注：**本工作包只准备工具，不执行试用**。试用结果由人工填写，执行代理不得声称已完成真人验证。

### 验收

- [ ] 新增事件在后端测试中可被接收，非法类别仍 400。
- [ ] 前端上报测试：成功、失败、默认关闭三种情况均不影响主流程。
- [ ] 抓包/测试断言请求体只含 `kind`，不含问题、访次、Cookie、来源页。
- [ ] 试用套件可被非工程人员独立执行。
- [ ] 执行日志明确写“真人试用未执行”。

### 停止规则

- 如果需要新增数据表或持久化访次才能统计 → 停止。本轮只允许进程内计数与匿名枚举。

---

## 10. WP6：清理、决策记录与收尾（0.5 天）

### 目标

删掉本轮已被替代的旧路径，把长期决定写进 ADR，更新状态与追踪表。

### 步骤

1. 删除：`answerSiteGuide`（若 WP2 已完成）、本轮确认无用的适配器、残留的 `LS-DING-*` 常量、未使用的 `import` 与注释掉的代码。
2. 单语言处理：不要假装支持多语言。显式定义 `SUPPORTED_LOCALES = Set.of("zh-CN")`，其他语言返回明确的“暂不支持”，并在文档写明这是 v1 决策。
3. 写 ADR-008（一份，三节）：档案化配置、单一意图契约、句级引用校验。每节写清背景、决定、替代方案、后果。如果 WP1 结论是“单件定制”，ADR 的结论必须如实写成“放弃平台化，转向内容与试用”。
4. 更新：
   - `PROJECT_STATUS.md`：本轮完成项、未验证项（真实模型 0、真人试用 0、正式签核待办）；
   - `docs/01-requirements-traceability.md`：只把真正达到验收标准的项标为完成；
   - `docs/05-api-design.md`：只写实际发生的接口/配置变化；
   - `docs/06-test-plan.md`：新增用例与命令；
   - `.env.example` 与 `deploy/README.md`：新增配置。
5. 最终自检：
   ```bash
   git diff --stat
   git status --short
   ```
   确认只包含本任务文件。

### 验收

- [ ] 上述五个文档已更新，且与代码一致。
- [ ] ADR-008 存在，结论与 WP1 实测一致。
- [ ] `git diff --stat` 中无构建产物、日志、数据库、`.env`、上传内容。
- [ ] 按 AGENTS.md §7 输出最终汇报。

---

## 11. 统一验证命令

在仓库根目录执行；若本机没有 pnpm，用等价 npm 命令并在日志中注明。

```bash
pnpm --dir frontend typecheck
pnpm --dir frontend test
pnpm --dir frontend build
cd backend && mvn -B test
```

离线评测（以脚本实际说明为准）：

```bash
node --test docs/plans/luosheng-eval/*.test.mjs
```

定向浏览器验证只在需要时运行，且必须使用现有测试夹具，不启用正式入口：

```bash
cd backend && mvn -B '-Dtest=GuideHttpIntegrationTests' test
```

不得在未确认的情况下运行真实模型、真实支付、真实短信或生产数据库。

---

## 12. 分支、提交与汇报

- 每个工作包一个分支：`codex/feat-guide-profile`、`codex/feat-guide-intent`、`codex/feat-guide-grounding`、`codex/chore-guide-cleanup`。
- 每个工作包结束先给用户看 `git diff` 摘要与验证结果；**未经用户明确确认，不 commit、不 push**。
- 提交信息使用 Conventional Commits，例如 `refactor(guide): load exhibit profiles from configuration`。
- 最终汇报必须包含：
  1. 完成内容；
  2. 修改文件（绝对路径）；
  3. 执行的验证及真实结果（含失败与跳过）；
  4. 未验证项、风险与下一步；
  5. WP1 的结论：可复用 / 单件定制，以及证据。

---

## 13. 停止规则汇总

| 触发条件 | 动作 |
| --- | --- |
| 工作树不干净且用户未答复 | 停止 |
| 基线命令无法运行 | 记录环境差异，停止并询问 |
| WP1 需要改公开 API、前端或超过 15 个文件 | 停止，判定抽象不成立 |
| WP1 第二展品无法在不新增签核流程下验证 | 降级为档案加载 + 单元测试，明确记录 |
| WP2 需要重写主组件 | 停止，改分批 |
| WP2 超过 10% 语料无法确定性表达 | 允许落入 `unknown`，记录，不引入模型分类器 |
| WP3 固定证据集接受率 <60% | 停止，不放宽校验 |
| WP4 需要重写签核工具 | 停止，只写流程与卡点 |
| WP5 需要持久化或新数据表 | 停止 |
| 同一测试连续两次修复仍失败 | 停止，附失败输出与已尝试方案 |
| 任何需要真实模型/真实数据/生产配置的动作 | 停止，等用户确认 |

---

## 14. 执行记录（由执行代理填写）

| 工作包 | 状态 | 分支/HEAD | 执行命令 | 结果 | 修改文件 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| WP0 | 未开始 | | | | | |
| WP1 | 未开始 | | | | | |
| WP2 | 未开始 | | | | | |
| WP3 | 未开始 | | | | | |
| WP5 | 未开始 | | | | | |
| WP4 | 未开始 | | | | | |
| WP6 | 未开始 | | | | | |

---

## 附录 A：金标语料种子（WP2 至少覆盖）

| 问题 | 预期意图 | 备注 |
| --- | --- | --- |
| 我只有五分钟，带我看一件 | discovery-search | 关键词青铜鼎，short=true |
| 不想预约，只想看青铜鼎 | discovery-search | 排除预约，不得返回预约入口 |
| 这里可以预约吗 | site-page 或 slot | 先页面指代，再回答预约入口 |
| 它是什么年代的 | object-evidence | 走取证，不得给四类入口 |
| 另一只在哪 | object-evidence 或 clarify | 有已确认看点才承接 |
| 明天还有名额吗 | slot-query | 日期=明天，人数缺省 |
| 在哪能看 3D | site-navigation | 数字展厅 |
| 怎么预约参观 | site-page | 预约说明，不查余量 |
| 我说的是脚 | object-evidence | 纠正为三足 |
| 它以前断过吗 | object-evidence 或 insufficient | 不得推断原器缺损 |
| 回到刚才那只耳朵 | resume-lookpoint | stop=ear |
| 接着看玉器 | discovery-search | 不得触发返回 |
| 先看鼎再查明天 | discovery-search + 待办时段 | 顺序请求降级为第一步 + 提示 |
| 我不想看鼎了 | discovery-clarify 或 navigation | 排除鼎，不重复推荐 |
| （全角空格/无标点变体） | 同义 | NFKC 后一致 |

## 附录 B：档案最小校验清单（WP1）

- [ ] `version` 存在且为 1；
- [ ] 每个 `exhibitSlug` 唯一（按 `locale`）；
- [ ] `plates[].stop` 在 `ear|feet|motif` 或新枚举内，且不重复；
- [ ] `plates[].cardId` 非空，`revision ≥ 1`；
- [ ] `factSources` 的键在 `PERIOD|SIZE|PROVENANCE` 内；
- [ ] `topicCardIds` 非空且无重复；
- [ ] 档案缺失或非法时，`turns-enabled=true` 启动失败；默认关闭不受影响。

## 附录 C：句级校验最小用例（WP3）

| 输入 | 期望 |
| --- | --- |
| 每句 quote 均为对应卡原文子串 | 接受，引用去重 |
| 一句 quote 为同义改写 | 整份拒绝 |
| quote 来自另一张卡 | 整份拒绝 |
| 缺 quote | 整份拒绝 |
| 三句中一句无依据 | 整份拒绝 |
| `{"text":null,"references":[]}` | 弃答，保持现状 |
| 重复键 / 尾随内容 / 超长 | 拒绝 |
| 单句 >120 码点或全文 >300 码点 | 拒绝 |
