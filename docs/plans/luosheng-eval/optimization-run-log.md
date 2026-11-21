# 洛笙靠谱地基执行日志

## 2026-11-21 · WP0 基线

`codex/feat-guide-baseline` / `38f574b`。`git rev-parse --short HEAD` → `38f574b`；`git status --porcelain`、`git diff --stat` 在执行前均无输出。已核对协作规则、项目状态、LS-01～LS-08、导览 API、测试计划、地基方案、总方案及 ADR-006/007。WP0 是现状基线，不修改业务代码；从 WP1 起记录实现前的红测及实现后的绿测。

| 命令 | 实测结果 |
| --- | --- |
| `pnpm --dir frontend typecheck` | 退出码 0。 |
| `pnpm --dir frontend test` | 78 文件、524 项通过，0 失败。 |
| `pnpm --dir frontend build` | 退出码 0；首屏 JS gzip 77,453 / 81,638 B，CSS 48,880 / 80,000 B；三首配乐合计 4,933,850 / 6,000,000 B。Three.js 分块超过 Vite 500 kB 提醒阈值，不影响预算门禁。 |
| `mvn -B test`（`backend`） | 158 项，153 通过、0 失败、0 错误、5 跳过。 |
| `node --test`（PowerShell 枚举 `docs/plans/luosheng-eval/*.test.mjs` 两个文件） | 62 通过，0 失败、0 跳过。 |

环境：Windows 11、JDK 17.0.13、Maven 3.9.15、Node 24.15.0、pnpm 11.21.0；Spring 测试用隔离 H2，导览集成仅使用现有测试夹具和失效回环地址。未设置导览开启环境变量。5 项后端跳过为 `LUOSHENG_RUN_BROWSER`（3）、`LUOSHENG_RUN_PRODUCTION_BROWSER`（1）、`LUOSHENG_MANUAL_PREVIEW`（1）未设置。未调用真实模型、未访问生产库、未变更正式验收状态。仓库现状基线为 524 项前端单测（方案中 523 为旧快照）。

## 2026-11-21 · WP1 档案化实验

**结论：可复用。** 同一 `/guide/turns` 路径、同一套参数化断言覆盖原鼎和河图玉璧测试展项。第二件只向同一测试运行时增加 10 行展项档案、4 行合成卡（2 张，含 `claim`）和 H2 初始化数据。无玉璧专用运行逻辑；实验使用既有 `motif` 看点标识，但配独立卡号、图版策略与纠正词。该结论限于后端取证内核和现有看点/语言契约，不承诺新页面、新图版枚举、前端展签或正式卡包零成本。

- 红测：`mvn -B '-Dtest=GuideExhibitIntegrationTests#sameReviewPathForTwoDifferentExhibits' test`，两例均期望未配置公共展项为 404，旧代码实际 200。
- 绿测：`mvn -B test` 164 项，159 通过、0 失败/错误、5 项按开关跳过，比基线多 6 项：4 种非法启动配置和 2 套共享问答路径。两件均覆盖指代与已审图版、明确纠正、问出处、卡缺失或修订漂移后弃答。测试中鼎耳修订从旧合成值 3 对齐冻结候选的 1；不改冻结卡。
- `rg -n 'LS-DING-' backend/src/main/java` 无匹配。默认 `pnpm --dir frontend build` 和资源预算通过，首屏数字与基线相同；关闭态 `GuideProductionBrowserTests` 1/1 通过（仅启用该检查的环境标志，向导保持关闭）。未运行开启候选浏览器、正式配置部署、真人试用或真实模型。

改动量（不含日志和状态登记）：通用路由 `GuideProfile.java` 新增 109 行；`GuideFollowUpRetrieval.java` +52/−40、`GuideRetrievalSession.java` +1/−1、`GuideTurnController.java` +20/−21；三份档案/卡数据共 35 行；`GuideExhibitIntegrationTests.java` +126（含 H2 初始化、参数化断言、启动校验）；`application.yml` +1、`.env.example` +1、`deploy/README.md` +2、API 文档 +1/−1。实验不依赖前端变更、生产迁移或新增签核步骤。候选开启时必须单独注入档案绝对路径；本轮未改 Compose 清单。

## 2026-11-21 · WP2 意图契约

- 红测：`pnpm --dir frontend test src/lib/luoshengIntent.spec.ts src/lib/luoshengTurns.spec.ts`。新契约缺失；组件收到导航、时段、找物及未知输入时，旧逻辑实际发出一次 `/api/v1/guide/turns`，预期零次。
- 实现：规则归并至 `luoshengIntent.ts`；发现、时段模块保留测试使用的薄投影；页面文案只消费结果。顺序请求先找物再显示待办时段；主动返回须匹配已保存看点。组件 +24/−24 行，原测试断言未改。
- 绿测：`pnpm --dir frontend typecheck`、`test`（79 文件、643 项）、`build` 和资源预算均通过。117 条金标全过；组件以同源 fetch 替身验证只有断代取证发送一次问答请求，IME 组合态不发送。 `rg -n answerSiteGuide frontend/src` 零匹配。
- 首屏 JS/CSS gzip 77,453/48,880 B，音乐 4,933,850 B，均在原预算内；既有 Vite 分块提醒不阻塞。规则不是开放域分类；语料之外可能需要澄清或返回未知。未做候选开启浏览器、真人试用或真实模型。

## 2026-11-21 · WP3 句级引用

- 红测：`mvn -B '-Dtest=GuideGroundedDraftTests' test`，旧协议不能接受两个 v5 合法样例，并接受 3 份带合法卡号的无依据草稿。v4 数字来自修改前实跑，不使用仿写的旧校验器。
- 绿测：`mvn -B test` 169 项，164 通过、无失败或错误，默认跳过 5 项浏览器或手动预览。单独运行默认关闭构建的 `GuideProductionBrowserTests` 1/1，通过后剩 4 项候选／手动浏览器未跑；离线 Node 工具 62/62。回环问答集成确认整稿拒绝仍返回 `GENERATION_UNAVAILABLE`、无正文、无引用、不成话题；显式弃答仍为缺证。原有撤回、超时、并发、限额、重播与交付复核测试通过。
- 比对时用 NFKC 和空白归一，保留展示标点。除了核对 quote 归属和连续性，正文还必须是包含 quote 的完整已审原文范围，以拒绝真引文加新事实或截掉句内否定；不进行开放域语义判断。正文语气、任意问题相关性和真实模型格式服从率均未验收。内部拒绝日志仅含固定事件名；匿名计数不改变 API。

固定离线对照：同三张合成证据卡、同十个案例（7 份有依据、3 份无依据），替身按实际提示词版本编码。接受/拒绝率分母为全部 10 份；假阳性通过率的分母为 3 份无依据草稿。

| 校验器 | 接受率 | 拒绝率 | 假阳性通过率 |
| --- | --- | --- | --- |
| v4 | 10/10（100%） | 0/10（0%） | 3/3（100%） |
| v5 | 7/10（70%） | 3/10（30%） | 0/3（0%） |

70% 高于本次 60% 停止线，7 份有依据样本全部通过。固定样本只衡量校验器，不推断候选实际生成接受率。仍需另行批准后才可验证签核资料、开启态部署、真实模型、真机及访客试用。本次没有执行地基 WP4–WP6 或总方案 Goal B/C。

### WP0–WP3 改动清单

- [PROJECT_STATUS.md](C:/Users/Jie/Documents/博物馆/PROJECT_STATUS.md)
- [backend/src/main/java/com/heluo/museum/guide/GuideFollowUpRetrieval.java](C:/Users/Jie/Documents/博物馆/backend/src/main/java/com/heluo/museum/guide/GuideFollowUpRetrieval.java)
- [backend/src/main/java/com/heluo/museum/guide/GuideRetrievalSession.java](C:/Users/Jie/Documents/博物馆/backend/src/main/java/com/heluo/museum/guide/GuideRetrievalSession.java)
- [backend/src/main/java/com/heluo/museum/guide/GuideStructuredGenerator.java](C:/Users/Jie/Documents/博物馆/backend/src/main/java/com/heluo/museum/guide/GuideStructuredGenerator.java)
- [backend/src/main/java/com/heluo/museum/guide/GuideTurnController.java](C:/Users/Jie/Documents/博物馆/backend/src/main/java/com/heluo/museum/guide/GuideTurnController.java)
- [backend/src/main/resources/application.yml](C:/Users/Jie/Documents/博物馆/backend/src/main/resources/application.yml)
- [backend/src/test/java/com/heluo/museum/guide/GuideExhibitIntegrationTests.java](C:/Users/Jie/Documents/博物馆/backend/src/test/java/com/heluo/museum/guide/GuideExhibitIntegrationTests.java)
- [backend/src/test/java/com/heluo/museum/guide/GuideHttpIntegrationTests.java](C:/Users/Jie/Documents/博物馆/backend/src/test/java/com/heluo/museum/guide/GuideHttpIntegrationTests.java)
- [backend/src/test/java/com/heluo/museum/guide/GuideStructuredGeneratorTests.java](C:/Users/Jie/Documents/博物馆/backend/src/test/java/com/heluo/museum/guide/GuideStructuredGeneratorTests.java)
- [deploy/.env.example](C:/Users/Jie/Documents/博物馆/deploy/.env.example)
- [deploy/README.md](C:/Users/Jie/Documents/博物馆/deploy/README.md)
- [docs/01-requirements-traceability.md](C:/Users/Jie/Documents/博物馆/docs/01-requirements-traceability.md)
- [docs/05-api-design.md](C:/Users/Jie/Documents/博物馆/docs/05-api-design.md)
- [docs/decisions/ADR-007-luosheng-visit-context.md](C:/Users/Jie/Documents/博物馆/docs/decisions/ADR-007-luosheng-visit-context.md)
- [docs/plans/2026-11-21-luosheng-smart-usable-master.md](C:/Users/Jie/Documents/博物馆/docs/plans/2026-11-21-luosheng-smart-usable-master.md)
- [frontend/src/components/LuoshengSiteGuide.vue](C:/Users/Jie/Documents/博物馆/frontend/src/components/LuoshengSiteGuide.vue)
- [frontend/src/lib/luoshengDiscovery.ts](C:/Users/Jie/Documents/博物馆/frontend/src/lib/luoshengDiscovery.ts)
- [frontend/src/lib/luoshengSiteGuide.ts](C:/Users/Jie/Documents/博物馆/frontend/src/lib/luoshengSiteGuide.ts)
- [frontend/src/lib/luoshengSlots.ts](C:/Users/Jie/Documents/博物馆/frontend/src/lib/luoshengSlots.ts)
- [frontend/src/lib/luoshengTurns.spec.ts](C:/Users/Jie/Documents/博物馆/frontend/src/lib/luoshengTurns.spec.ts)
- [backend/src/main/java/com/heluo/museum/guide/GuideProfile.java](C:/Users/Jie/Documents/博物馆/backend/src/main/java/com/heluo/museum/guide/GuideProfile.java)
- [backend/src/test/resources/guide/ding-profile.json](C:/Users/Jie/Documents/博物馆/backend/src/test/resources/guide/ding-profile.json)（原 `main/resources` 副本已移出打包资源）
- [backend/src/test/java/com/heluo/museum/guide/GuideGroundedDraftTests.java](C:/Users/Jie/Documents/博物馆/backend/src/test/java/com/heluo/museum/guide/GuideGroundedDraftTests.java)
- [backend/src/test/resources/guide/jade-evidence.json](C:/Users/Jie/Documents/博物馆/backend/src/test/resources/guide/jade-evidence.json)
- [backend/src/test/resources/guide/jade-profile.json](C:/Users/Jie/Documents/博物馆/backend/src/test/resources/guide/jade-profile.json)
- [docs/plans/luosheng-eval/optimization-run-log.md](C:/Users/Jie/Documents/博物馆/docs/plans/luosheng-eval/optimization-run-log.md)
- [frontend/src/lib/luoshengIntent.spec.ts](C:/Users/Jie/Documents/博物馆/frontend/src/lib/luoshengIntent.spec.ts)
- [frontend/src/lib/luoshengIntent.ts](C:/Users/Jie/Documents/博物馆/frontend/src/lib/luoshengIntent.ts)

## 2026-11-21 · 遗留清理（ADR-008 已记录项）

两项遗留在不改变对外行为的前提下收掉：

1. **删除 `view` 字段与 stop→view 常量。** `GuideProfile` 内的 `VIEWS` 映射已移除，`Plate` 不再携带从未被消费的 `view`。stop 改为数据驱动：只要求非空、去空白、同展品内唯一。控制器原有的 `knownStop` 校验一并删除，改由已有的“按展品查档案”判断（`profile.plate(lookpoint) == null` 返回非法参数）。
2. **档案移出打包资源。** `backend/src/main/resources/guide/ding-profile.json` 移至 `backend/src/test/resources/guide/ding-profile.json`，示例副本放 `docs/plans/luosheng-eval/ding-profile.example.json`。后端包不再包含可被误当成运行时来源的档案；运行时仍只读注入路径。

验证：`mvn -B test` 170 项，0 失败、5 项按开关跳过；新增 `blank-stop` 参数用例覆盖新校验分支，原 `duplicate-stop` 断言同步为新消息。前端无改动，未重跑前端套件。部署文档 `deploy/README.md` 的参照路径已改为示例文件。未改公开 API、未启用候选、未调用真实模型。

## 2026-11-21 · INT-1 语言资产数据化

把散落在代码里的语言知识搬进一份可审阅、可校验的词表；事实仍只在证据卡里。

新增 `frontend/src/assets/guide/lexicon.zh-CN.json`：看点标签、相对日期、人数词、站点关键词、检索词表与别名、建议问题、下一步看点。新增 `frontend/src/lib/luoshengLexicon.ts` 负责加载与校验：版本、重复 stop、空白或带首尾空格的标签、澄清选项与下一步指向不存在的看点、审阅说明指向不存在的标签，任一不合法即抛错。`luoshengIntent.ts` 改为消费词表，删除 `pointNames`、`relativeDays`、`digits`、`sitePatterns` 四组硬编码。

新增 `docs/plans/luosheng-eval/sync-lexicon.mjs`：对照词表与证据包，检查卡片存在、修订号一致、标签必须是卡片别名或有审阅说明；卡片中未进入词表的别名只提示。删掉 `LS-DING-EARS` 的 `鼎耳` 别名后，脚本报错并以退出码 1 结束；原始包退出码 0。

过程中修掉三处自身缺陷：`nextGlance` 与 `searchAliases` 曾被误按数值校验；证据检测正则曾把 `${labels.source}` 写进正则字面量导致模板不插值，已改为 `new RegExp` 构造；`--pack` 传绝对路径时 URL 拼接失败，已改用 `pathToFileURL`。

验证：`vue-tsc -b` 通过；`vitest run` 80 文件、657 项通过（新增 13 项词表用例）；117 条金标问法行为不变。词表校验 `--check` 退出码 0。未改后端、未启用候选、未调用真实模型。

边界：新增**别名**不需要改代码；新增**看点**仍受前端 `GuideStop` 与界面标签约束。

## 2026-11-21 · INT-5 交互易用性

四件事，全部来自已审词表或既有状态，不新增事实：

1. **建议问题。** 空态三条、回答后两条加「更多」；有已确认看点时先给该部位的问法，没有时先给整件展品的问法，不预设部位。没有档案的展品不给建议。
2. **澄清按钮化。** 回复被判定为 `CLARIFY` 且档案声明了看点时，直接给「鼎耳／三足／纹样」按钮，点击后按该部位提问，不再让游客自己组织句子。
3. **缺证说明。** 服务端对缺证总会返回一段兜底文案，前端原先无法区分。`askPublicGuide` 现在把 `INSUFFICIENT_EVIDENCE`／`DISPUTED_EVIDENCE` 标记为 `insufficient`，面板显示「这一点现有资料还不能确认」，而不是把兜底文案当成普通回答。
   **未做**：按事实类别（年代／尺寸／出土地／寓意）说明「缺的是什么」。这需要服务端在回复里携带缺证分类，属于对外契约变更，按硬约束留到 INT-3 一并说明后再做。
4. **诚实进度。** 只有等待真实超过 2 秒才显示「正在核对资料…」，完成即消失；不伪造阶段。

无障碍：回答区 `aria-live="polite" aria-atomic="true"`；澄清按钮为 `role="group"` 并带标签；建议问题分组带 `aria-label`；按钮沿用既有 44–48px 命中区。

过程中修掉两处自身缺陷：建议问题顺序在无看点时会把「鼎耳」这类部位问法排在前面，等于替游客预设了部位；`insufficient` 最初用「正文为空」判断，而服务端对缺证始终返回兜底文案，导致面板永不触发。

验证：`vue-tsc -b` 退出码 0；`vitest run` 82 文件、669 项通过（新增 7 项建议用例、5 项面板用例）；`npm run build` 与首屏、CSS、配乐预算均通过。未改后端、未启用候选、未调用真实模型。

未验证：390px／1440px 真机与浏览器实页观感，本轮只做了单元与组件级断言；真实问答链路仍为默认关闭。
