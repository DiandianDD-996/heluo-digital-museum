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

## 2026-11-21 · INT-3 声音包与生成 v6

基线：`codex/feat-guide-baseline`，`e0b1177`，干净工作树；采用确认的前端 669 通过、后端 170 总计／5 跳过。声音源文件和提示词与该提交一致；UI 源包补登记原面板文案，不迁移原先硬编码的图版观察或馆藏编号。运行时 UI 两份副本及声音文件均通过 SHA-256。声音哈希为 `968ef513a924b7bbc1f73a025e76547d02a0d8f9cbc5eb227c2c73de6f8283c2`。

红测：资产／旧常量／提示词四项初始失败；Java 正例旧版落为 `GENERATION_UNAVAILABLE`，缺证仍吐旧文案。实现后，单独把运行声音包的「细节」改成「细点」实跑：`tests 1 / pass 0 / fail 1`，断言为 SHA-256 不一致；恢复字节后通过。中间 Maven 回归曾发现撤回后图版来源为空的越界访问、最小启动容器缺少新 Bean、启动失败断言未取根因；均修正并复跑。

交付：启动严格加载；事实句只照录证据原文；整段引文保留 v5 最小码点和完整句段校验。动作和过渡走严格角色白名单，坏草稿整体仍返回 `GENERATION_UNAVAILABLE`。已知缺证类型由 `insufficient.missing` 短语组成，不在公开 API 中增加分类字段；未知类别仍走通用缺证。UI 迁移含读屏标签、错误回退；建议问题继续取现有词表。测试采用本地模型替身，无外部模型调用。

实跑结果摘要（原始输出行）：

```text
pnpm --dir frontend typecheck
$ vue-tsc -b

pnpm --dir frontend test
 Test Files  82 passed (82)
      Tests  670 passed (670)

pnpm --dir frontend build
✓ built in 11.58s
门禁通过。全量（仅告警）：JS 530075 B，CSS 106690 B。 首屏 JS 77448 B / 预算 81638 B。
配乐资源门禁通过：3 首已认可R3，4933850 / 6000000 B；文件与音频验收清单一致。

cd backend && mvn -B test
offline-grounding version=luosheng-structured-v6 accepted=7 rejected=3 falsePositives=0 unsupported=3 total=10
[WARNING] Tests run: 175, Failures: 0, Errors: 0, Skipped: 5
[INFO] BUILD SUCCESS

node --test docs/plans/luosheng-eval/*.test.mjs
ℹ tests 67
ℹ pass 67
ℹ fail 0
ℹ skipped 0
```

固定语料的接受率 70%，较 v5 变化 0 个百分点；3 个无依据样本全部拒绝。默认生产构建通过，未在 JS 产物检出本次扫描的导览面板文案；保留依赖纯注释、动态/静态同引和大包预警。Maven 实际通过 170，另外 5 项浏览器／手动预览由开关跳过。不启用候选，因此未做 390px／1440px 启用态观感、主题溢出及真机/读屏；真实模型服从率、证据正式签核与发布状态未验证。未改依赖、模型/向导开关、公开接口字段或证据包，未提交／推送。

## 2026-11-21 · INT-4 内容冲刺（草稿）

目标不是把卡写满，而是把"能答什么、不能答什么、缺什么"写清。**全部为 DRAFT，未生成指纹，未标 PUBLISHED。**

产出：

| 文件 | 内容 |
| --- | --- |
| `ding-zh-CN-0.5.0-drafts.json` | 鼎新增 9 张草稿：模型许可、模型边界、机位、图版对比、参考记录、记录留空、屏幕尺寸、渲染光影、器内不可见 |
| `concept-exhibits-zh-CN-drafts.json` | 玉璧 6 张、水鸟 6 张草稿（**阻塞**，见下） |
| `ding-knowledge-map.md` | 鼎的事实分层、部位表、常见问题、缺口、覆盖度 |
| `concept-exhibits-knowledge-map.md` | 两件概念展品的知识地图与共同约束 |
| `content-queue.md` | 第一批 8 张送签顺序、送签前必核四项、缺口清单 |

三个判断写在文件里，避免后来者重复摸索：

1. **只有鼎有 3D 展项。** 玉璧只存在于测试夹具，水鸟没有展项。因此概念展品卡片即便写完也无法上线，不进入送签队列。
2. **水鸟需要新的看点词汇**（翼／喙／颈），超出当前 `ear/feet/motif` 枚举，属于 ADR-008 记录的边界，需前后端与文案同步改。
3. **概念展品的 `publicSource` 为空是正确的**，来源是馆方自有展签，不是缺资料。

缺来源的六项（铸造工艺、用途礼制、原器颜色、修复史、重量、铭文释文）没有写成卡，集中列入缺口清单；补齐前正确回答是"现有已审资料还不足以确认"，并说明缺的是哪一类。

验证：两份 JSON 解析通过，均为 9 + 12 张、状态全为 `DRAFT`；离线工具 67 项通过，未破坏既有校验；未改代码、未改已签核内容、未调用真实模型。

未验证：卡片正文未经馆方审阅，分期口径与尺寸解读需人工确认；概念展品未上线；真实模型对新增卡片的检索命中率未测。

## 2026-11-22 · INT-4 青铜鼎送审预检

- LS-04／LS-08：核对旧六卡资产与冻结快照，补齐九张新稿的证据定位、可支持项、禁止推断与复核事项。收窄渲染、器内和屏幕尺寸的表述；未改旧六卡正文、运行时证据或正式签核。
- [八张建议送签队列](content-queue.md)仍是四张原卡、分期和尺寸、`LS-DING-RECORD-02` 与 `LS-DING-MODEL-02`。优先回答哪里可查、三处部位误读、年代尺寸以及模型与出土地边界。名单未送出，双签 0；鼎草稿共 15/20，差 5 张；概念展品仍阻塞。正式高频问题覆盖没有真人数据，不沿用拟定问法的 8/10 估计。
- `node docs/plans/luosheng-eval/check-evidence-review.mjs --extended` → `卡包：0.4.0-draft；送审预检：待签或待发布`，退出码 2，无素材或快照指纹不匹配；只覆盖旧六卡，不覆盖新增九张。
- `node --test 'docs/plans/luosheng-eval/*.test.mjs'` → `tests 69 / pass 69 / fail 0 / skipped 0`，新增两项检查编辑字段、定位、卡号及规范化 claim 一致性，不替代运行时 schema 或馆方复查。未生成发布包与指纹。
- 复查 Cleveland Open Access API 138016：`1962.281 / Tripod (Ding)`，`find_spot: null`，`provenance: []`，尺寸字段写 `Overall: 24.5 x 20 cm (9 5/8 x 7 7/8 in.)`，没有为两个方向分别命名。本次未复查上游模型服务，仅使用既有来源核对记录；正文、图版许可、运行时兼容和剩余五张仍待核对。未改应用，不重跑前后端构建及全量测试；不启用向导，不调用真实模型。真人试用由人执行，代理未代替。

## 2026-11-22 · INT-4 青铜鼎草稿补齐

- LS-04／LS-08：核对馆藏 API 138016（`1962.281`、`technique: bronze` 与背景说明 `description`）、v5.5 资产处理范围、图版渲染脚本和图版组件。新增材质登记、数字局部调整、纹样裁切、可选观看路线四份拟审草稿，另存一份只供编辑参考的来源馆背景解读。
- 鼎合计 20 张编辑草稿（既有 6＋首批 9＋本批 5）。首批建议送签名单不变，理由见[队列](content-queue.md)；尚未送审，双签 0。背景卡不进入送签、词表、既有候选或运行时证答；不据此回答本件的工艺、礼制功能或纹样寓意。玉璧和水鸟尚无实际生产 3D 展项，未变更其草稿。
- `node --test 'docs/plans/luosheng-eval/*.test.mjs'` → `tests 70 / pass 70 / fail 0 / skipped 0`；含编辑包结构、claim 冲突与背景卡隔离检查。不证明新草稿通过运行时 schema／指纹或内容获批。
- `node docs/plans/luosheng-eval/check-evidence-review.mjs --extended` → `卡包：0.4.0-draft；送审预检：待签或待发布`，退出码 2。无现有指纹不匹配，只覆盖旧六卡。未改已冻结快照、不生成正式指纹。
- 本轮只改编辑材料、离线测试和记录，未重跑前后端全量或候选页面，也未启用向导、调用真实模型。真人试用由人执行，代理未代替。INT-6 仍等待双签、真人试用结果和干净工作树。

## 2026-11-22 · INT-5／INT-3 双视口与默认关闭复验

- F-06／LS-02／LS-06／LS-08：浏览器首轮红测显示默认预约页从意图模块间接打包完整导览词表，产物出现 `LS-DING-EARS`。把现有上海时区和公开日期窗口逻辑移到独立模块，预约页直接引用；向导继续复用同一逻辑，未更改预约的日期范围、路由或 API。保留原关闭产物扫描，不添加豁免。
- 候选旧测试另有修订号及提示词漂移、首页异步挂载竞态、故障用例的提问未进入取证等失败。对齐合成卡修订 1 与文案包，用已知取证问题验证确实仅发送一次，并等待入口或输入框挂载。故障用例覆盖服务端超时、繁忙、额度、生成不可用、暂停回复、网络失败及客户端无响应；无响应实际显示核对进度，结束后清除，旧引用不回填，仍可主动回原背视图。故障为浏览器受控替身，不等于生产暂停／撤回演练。
- Chrome 390px 深色／1440px 浅色验证：Enter／Space 均可提交具名澄清按钮并获相应合成答复；手输后输入框保持焦点；缺证使用出土地说明，答后两条词表建议和「更多／收起」可操作，窄屏换行且按钮不超出容器。候选也复验公开预约时段、跨页返回图版及焦点、迟到回复取消和显式结束参观。仅隔离 Spring/H2 与本机 Vite 构建，未调用真实模型（`realModelSamples: 0`）。
- 实跑：`pnpm --dir frontend typecheck` 退出 0；`pnpm --dir frontend test` → `Test Files 82 passed (82), Tests 670 passed (670)`；`pnpm --dir frontend build` → `✓ built in 15.92s`，首屏 JS 77486/81638 B，资源门禁通过；独立临时候选产物构建 `✓ built in 10.05s`。两次构建保留既有 Vite 警告。Node 离线 `tests 70 / pass 70 / fail 0 / skipped 0`。
- Chrome 定向 Maven `GuideExhibitIntegrationTests#visitorUsesCandidateFromHomeAndReturnsToApprovedPlate,GuideProductionBrowserTests` → `Tests run: 2, Failures: 0, Errors: 0, Skipped: 0`，`BUILD SUCCESS`。前者两视口各返回两次 H2 实际时段，后者通过产物扫描及关闭态公开导航。没有开启正式开关或部署。未在当前批次复跑交叉主题、200% 原生缩放、真机与系统读屏、真实模型、馆方双签或真人试用。
- 默认 `mvn -B test` → `Tests run: 175, Failures: 0, Errors: 0, Skipped: 5`、`BUILD SUCCESS`；其中两项在上述定向运行补验，其余三个可选浏览器／手动预览未跑。v6 固定语料仍为 `accepted=7 rejected=3 falsePositives=0 unsupported=3 total=10`。

## 2026-11-22 · INT-5 交叉主题与原生缩放复验

- 扩展矩阵先后发生 Node 子进程异常退出 `0xC0000409`（根因未确认）；独立 Chrome 缩放设置探针可设到 200%，不是产品页通过。用已安装 Node v24.22.3 定向复跑，真实产品页红测定位到短视口「更多」建议横向超出容器，`geometry.fits` 为 false，`Tests run: 1, Failures: 1`、`BUILD FAILURE`。
- 短视口建议仍换行，高度不足时只在建议区纵向滚动；保留无横滚断言，加验键盘可到达末项、继续到输入框，且发送按钮在可视区域。没有改变事实卡、路径、API 或正式开关。
- 以新构建的隔离候选（Vite `✓ built in 12.43s`）配 Spring/H2，Node v24.22.3 下 `mvn -B -Dtest=GuideExhibitIntegrationTests#visitorUsesCandidateFromHomeAndReturnsToApprovedPlate test`：`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。四组 390／1440px 深浅、原生 200% 深浅、合成 CSS 2× 回流均通过；原生实测 `innerWidth=720`、`devicePixelRatio=2`、`CSS zoom=1`。六组均为 `realModelSamples: 0`，不是正式模型延迟或质量指标。
- `pnpm --dir frontend typecheck` 退出 0；`pnpm --dir frontend test` → `Test Files 82 passed (82), Tests 670 passed (670)`；`pnpm --dir frontend build` → `✓ built in 11.54s`，默认首屏 JS 77453／81638 B，配乐资源门禁通过，仍有既有 Vite 警告。`node --test docs/plans/luosheng-eval/*.test.mjs` → `tests 70 / pass 70 / fail 0 / skipped 0`。
- 默认 `mvn -B test` → `Tests run: 175, Failures: 0, Errors: 0, Skipped: 5`、`BUILD SUCCESS`；v6 固定语料 `accepted=7 rejected=3 falsePositives=0 unsupported=3 total=10`。其中候选矩阵及 `GuideProductionBrowserTests`（默认关闭构建、公众导航无导览 UI 和请求）分别定向补跑，各 `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`；其余三个默认跳过项本轮未跑。
- 试用手册和结果空表已准备同一批次核对、分母记录、50 条实际回答独立抽查与真实问法单独同意；未采集或填入任何结果。真人试用由人执行，代理未代替。尚无馆方双签、真人试用、真机读屏或真实模型证据；正式向导不启用，INT-6 门禁不变。

## 2026-11-22 · INT-4 首批八稿人工交接

- LS-04／LS-08：只读预检按队列逐张输出八份待审原文、修订、来源定位及双签待办；复用旧六卡既有指纹检查，`RECORD-02` 和 `MODEL-02` 仍是未冻结编辑草稿。没有修改事实原文、既有指纹或运行时卡包。
- 新测试先因模块未实现失败，完成后定向 2/2；全量 `node --test docs/plans/luosheng-eval/*.test.mjs` → `tests 72 / pass 72 / fail 0 / skipped 0`。覆盖原文不变，拒绝重复卡、仅编辑卡及已登记图版漂移。
- `node docs/plans/luosheng-eval/ding-first-review.mjs` → `洛笙首批八张 · 待人工审阅（未送签、不可发布）`，八条卡标题，退出 2；旧六卡 `check-evidence-review.mjs --extended` → `0.4.0-draft；送审预检：待签或待发布`，退出 2，无文件指纹不匹配。
- 仅离线材料和测试，未重跑应用构建、前后端全量或浏览器；不签核、不送审、不生成正式候选、不启用向导、不调用真实模型。双签 0；真实高频覆盖、真人试用及 INT-6 仍未达门禁。

## 2026-11-22 · LS-08 本地暂停与撤回复验

- 新增 Spring／H2 集成回归：使用临时目录的真实暂停文件，不伪造 API 回复。在已回答过的会话及新会话中，暂停时都返回 `QUESTIONING_DISABLED`，不附正文、引用或图版动作；预设仍返回同一卡号、修订和正文，匿名公开时段仍返回隔离库种入的剩余人数。移除文件后，原会话主动重问恢复取证。合成证据全程不启动生成。
- 定向首跑 `Tests run: 5, Failures: 1, Errors: 0, Skipped: 0`，筛选式 JSONPath 断言与实测返回不符；检查响应已含正确卡号与修订后，改为对该固定夹具直接断言卡号、修订与原文，未改应用逻辑。
- 默认 `mvn -B test` → `Tests run: 176, Failures: 0, Errors: 0, Skipped: 5`、`BUILD SUCCESS`；包含新回归、既有阻塞替身草稿在暂停恢复后丢弃、交付前撤卡阻断及文件版撤回与回放防护。v6 固定语料 `accepted=7 rejected=3 falsePositives=0 unsupported=3 total=10`。
- 未重跑前端、五个默认跳过的可选浏览器／预览用例、生产停用或供应商取消与计费。未改正式配置、发布文件或签核状态；未调用真实模型。

## 2026-11-22 · INT-4 八卡冻结审阅候选

- 将已获用户确认的首批八稿冻结为 `ding-zh-CN@0.5.0-draft`（发行号 4）。原文、修订、别名与来源不变；移除编辑说明字段，仍全为 `DRAFT`、无生效时间。SHA-256 与审核回收要求见[冻结记录](content-queue.md#10-八卡冻结审阅候选)。该指纹仅标识审阅快照，不是批准或发布指纹。
- `node --test docs/plans/luosheng-eval/*.test.mjs`：73 通过，0 失败、0 跳过；校验快照原始字节及逐卡内容。`mvn -B test`：`Tests run: 177, Failures: 0, Errors: 0, Skipped: 5`、`BUILD SUCCESS`；实际读取器在临时测试目录下解析八卡，逐条确认不能检索或回放。未重跑前端或可选浏览器用例。
- 未签核发布候选、挂载卡包、启用向导、调用真实模型、提交或推送。试用及放行门禁不变。

## 2026-11-22 · INT-4 八卡签核候选出包验证

- `prepare-evidence-candidate.mjs --eight` 复核冻结八卡、现有素材指纹及送审原文，仅在明确给出生效时间时生成新文件，不覆盖现有文件。独立比对工具验证候选原始字节完全符合可复现输出，并打印候选指纹；不核验审核凭据或授予发布批准。
- 离线全量 `tests 74 / pass 74 / fail 0 / skipped 0`。以临时目录、2099 年夹具实跑出包和比对，两命令退出 0、SHA-256 一致，验证后删除临时夹具。未出实际签核包，不部署；前端、后端和浏览器本轮未重跑。

## 2026-11-22 · INT-4 仅供签核的八卡文件

- 以 `2099-01-01T00:00:00Z` 占位生成持久的本地核对文件，生成和逐字节比对各退出 0、输出相同 SHA-256；见[签核材料](content-queue.md#11-仅供签核的八卡文件不部署)。文件不挂载，不授予部署批准。
- Node 离线 `tests 75 / pass 75 / fail 0 / skipped 0`；`mvn -B test` 输出 `Tests run: 178, Failures: 0, Errors: 0, Skipped: 5`、`BUILD SUCCESS`。在隔离测试中，真实读取器解析八卡，占位时刻前均不可检索或回放；以固定测试时钟到达边界才可解析引用。未重跑前端构建和浏览器，未调用真实模型。
- 正式候选另定时间和文件指纹，仍待双签及真人试用；未开启向导、提交或推送。

## 2026-11-22 · 文案待审指纹

- 为 Phase C 馆方文案审阅准备五份源文件的 [SHA-256 清单](copy-review-candidate.sha256)，不改源文案、事实卡或运行逻辑。Git 固定源文件、原字节运行时 JSON 副本的 LF，避免不同系统检出时无意更改待审指纹。放行记录明确要求独立的馆方文案审阅凭据。
- 新校验先因清单缺失红测（5 过、1 失败）；加入清单后全量离线 `tests 76 / pass 76 / fail 0 / skipped 0`。现有运行时副本相同与 v6 提示词一致性校验仍通过。
- `pnpm --dir frontend typecheck` 退出 0；`pnpm --dir frontend test`：`Test Files 82 passed (82)`、`Tests 670 passed (670)`；`pnpm --dir frontend build`：`built in 24.95s`，首屏及配乐预算通过，仍有分块警告。 `mvn -B test`：`Tests run: 178, Failures: 0, Errors: 0, Skipped: 5`、`BUILD SUCCESS`。
- 本轮未重跑可选浏览器矩阵，仅复查已开放的回环候选讲解接口返回 HTTP 200。未完成真实高频覆盖、正式双签、馆方文案批准、真人试用及真实模型验收；工作树未清，INT-6 未开始，未公开开启向导。

## 2026-11-22 · 正式全站导览本机交互入口

- 新增显式 opt-in 的 [启动方式](../2026-11-19-luosheng-acceptance.md#本机体验正式全站导览)，复用 Spring/H2 的合成卡和公开时段夹具。Vite、Spring 都只监听回环地址；默认 15 分钟后退出。与旧开发预览不同，普通首页加载正式组件，问答请求不经过测试替身路由。
- 首跑子进程直写原生输出，Surefire 记录 `Corrupted channel`，URL 未正常打印；改为转发至 JVM 输出后，`LUOSHENG_LOCAL_DEMO_SECONDS=50` 定向测试打印可打开的 URL，`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`，`BUILD SUCCESS`。退出后确认当轮前端 5173、后端 58930 无监听。外部 upstream 和 901 秒参数分别被拒绝。
- Chromium 实页：首页 HTTP 200；点击带看后聚焦鼎耳图版；正式 `POST /api/v1/guide/turns` HTTP 200、引用 `LS-DING-PERIOD`；无出土地资料时显示缺证。离线全量 76 通过、0 失败、0 跳过；`git diff --check` 退出 0。
- 本轮未重跑前后端全量、生产构建、异尺寸矩阵或实际预约提交；未调用真实模型，不写生产数据或发布配置，未更改 INT-6 门禁。

## 2026-11-22 · 本机入口后的默认关闭复验

- LS-08／F-06：将八卡签核候选的命名加入关闭态静态产物探针；回归先沿首页、检索、展厅、返回藏品与预约页验证无洛笙 UI 或自动请求，再主动探测普通预设／回合接口均为 HTTP 404。仅操作回环 Spring/H2，不改功能逻辑或发布开关。
- `pnpm --dir frontend build`：`built in 16.66s`，首屏 JS 77453／81638 B 和配乐资源门禁通过，保留分块警告。`mvn -B test`：`Tests run: 179, Failures: 0, Errors: 0, Skipped: 6`、`BUILD SUCCESS`，v6 `accepted=7 rejected=3 falsePositives=0 unsupported=3 total=10`。
- 定向 `LUOSHENG_RUN_PRODUCTION_BROWSER=1` 下 `GuideProductionBrowserTests` 输出 `Production HTTP: preset and turn routes both returned 404`，并通过公开导航和产物扫描；`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。其余五个默认跳过项、前端独立单测、Node 离线全量、真机与真人试用本轮未重跑。未调用真实模型或部署。

## 2026-11-22 · 正式八卡双签登记预检

- LS-04／LS-08：新增 `--signoffs`，先严格核对候选字节，再要求内容和素材／发布登记各自绑定其 SHA-256 与全部八卡的确切修订；检查结论、编号、角色、日期、素材范围字段。不验签字真伪、不写批准指纹、拒绝 2099 占位候选。[填写说明](content-queue.md#12-正式候选的双签登记预检)
- 定向红测缺少导出，退出 1；补齐后定向 8 项全过，Node 离线全量 79 过／0 失败／0 跳过。对仓库内 2099 文件实跑普通模式退出 0、指纹保持不变；签核模式输出「2099 年占位候选只供对照，不可登记签核」，退出 1。仅用测试夹具验证正向组合，`git diff --check` 退出 0。
- 未收到正式候选或原始双签，未重跑应用套件、开启实例、调用真实模型或部署；真人试用尚未执行。

## 2026-11-22 · 建议问题源包一致性

- LS-02／LS-04：新增源包到前端词表的建议问题结构一致性校验（展品、分组、顺序、问句、种类、支撑卡号、编辑理由）。定向红测 6 过／1 失败，发现八条 `why` 说明被缩写；恢复与源包一致的内部编辑元数据，游客问句、证据卡、路由及源文案指纹不变。
- `node --test docs/plans/luosheng-eval/*.test.mjs`：80 通过／0 失败／0 跳过；`pnpm --dir frontend typecheck` 退出 0；`pnpm --dir frontend test`：82 文件、670 项全过；`pnpm --dir frontend build`：`built in 26.73s`，首屏和配乐预算通过，保留分块警告；`git diff --check` 退出 0。
- 本轮未重跑后端、浏览器与真机，未调用真实模型或上线。馆方文案批准、正式双签与真人试用依然没有登记。

## 2026-11-22 · 受控试用候选出包

- 按用户确认的日期生成八卡候选，北京时间 2026-11-22 00:00；生成和逐字节核对各退出 0，两次 SHA-256 相同，见[候选登记](content-queue.md#13-2026-11-22-受控试用候选待双签)。保留原文、卡号、修订和来源；不把候选时间当作已试用或已上线。
- 新增已登记候选指纹回归；Node 离线全量 81 通过／0 失败／0 跳过，`git diff --check` 退出 0。本轮未重跑应用套件与浏览器，不挂载、不生成批准指纹、不启用开关、不调用真实模型、不提交或推送。正式双签、馆方文案批准及真人试用仍未登记。

## 2026-11-22 · 八卡双签登记草稿

- 预填两类登记各自的候选指纹与八卡编号／修订；结论保留 `PENDING`，其余凭据字段留空。脚本独立比对两栏均匹配实际候选；双签预检对草稿按预期退出 1，未生成批准指纹。
- 离线全量 81 通过／0 失败／0 跳过，`git diff --check` 退出 0。仅整理登记材料和记录；未重跑应用套件或浏览器、未实际签核、试用或启用向导。

## 2026-11-22 · 用户审核确认与成品本机展示

- 将用户对该候选两类审核的「全部标记通过」登记在同一指纹下，仅限受控内部试用，不将对话视作独立馆方凭据。 `--signoffs` 退出 0，报告两栏指纹和八卡修订一致，不批准发布。离线 81 项通过／0 失败／0 跳过。
- 旧本机预览接口已返回 HTTP 500，改用仓库已有入口启动新的隔离演示。Chromium 1440px／390px 均通过首页、鼎耳图版、正式问答 HTTP 200、合成证据引用和缺证提示。只用 H2 和测试卡；预览启动用例定时运行，未宣称整套应用测试或正式试用完成。
- 未改应用源码、未重跑前后端全量或生产构建；未调用真实模型、挂载受控候选、公开上线、提交或推送。馆方文案、真实高频覆盖、独立真人与真机记录仍待实际验证。

## 2026-11-22 · 八卡受控候选后端核对

- LS-04／LS-08：按固定 SHA-256 在隔离测试中读取已登记的八卡候选，验证缺批准指纹时不可用、匹配时可取鼎耳和年代原文、问出土地仍明确缺证且保留来源。生成启动计数未增加。定向 Maven：`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`。
- 全量 Maven：`Tests run: 180, Failures: 0, Errors: 0, Skipped: 6`，`BUILD SUCCESS`；跳过为默认未开启的浏览器、手动预览及本机演示测试。Node 离线：81 通过、0 失败、0 跳过。前端类型检查退出 0；Vitest 82 文件／670 项通过；默认生产构建 `built in 16.36s`，首屏和配乐预算通过，有分块告警。
- 不变更候选、馆方批准状态、公开开关、部署或真实模型。定向测试不接入本机合成演示站，不计真人试用；未重跑浏览器和真机。

## 2026-11-22 · 浏览器门禁补跑

- 启用 `LUOSHENG_RUN_BROWSER`／`LUOSHENG_RUN_PRODUCTION_BROWSER`，只用回环 HTTP、H2 与替身卡。首轮 4 项：3 通过、1 失败、0 跳过。馆藏预设、首页候选主路径通过；默认产物未检出导览草稿或入口，首页、检索、展品与预约流程正常；预设和问答接口均为 404。
- 旧展签浏览器脚本仍匹配 v6 迁移前的字句，并用无法匹配跨行文本的正则检查两条原文。保留引用和动作断言，改为从策划声音源包取缺证与出处提示，对合成卡文本做精确匹配。两次红测后，`GuideHttpIntegrationTests#browserUsesRealTestServiceAndDropsLateResponses` 实跑 1 通过、0 失败、0 跳过；没有改应用、卡包或 v6 校验。
- 开启态 Vite 产物写入独立临时目录，构建 `built in 15.58s`。初次浏览器执行记录了四组深浅主题／宽度与双主题原生 200% 主路径，但 Node 子进程异常退出（`-1073740791`）；串行重跑同一退出码，两次均不算整项通过。
- 相同开启态产物改用 Codex 随附 Node v24.22.3，仍用本机 Chrome 与同一套断言：6 组（390／1440 × 双主题，及 200% 双主题）整项通过，覆盖迟到回复取消、明确退出重置、问答失败回原图版和重排；`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`，`BUILD SUCCESS`。原 PATH 上 Node v24.15.0 的异常未定位到具体根因。
- 未运行两项限时人工预览，未调用真实模型、登记真人或真机结果、挂载八卡候选、部署、提交或推送。

## 2026-11-22 · 八卡受控候选本机展示

- 新增仅在 `LUOSHENG_LOCAL_DEMO=1` 并显式设置 `LUOSHENG_LOCAL_DEMO_DATED=1` 时可走的八卡显示路径。双签登记预检退出 0，原始八卡 SHA-256 匹配；仅写测试临时目录。前后端绑定回环，演示最多运行 900 秒，不连接真实模型、生产数据库或部署实例。
- 首次浏览器冒烟在追问时失败：全局暂停同时拦下不生成的问答。去掉演示的暂停文件后，Chrome 1440px 浅色和 390px 深色均从首页进入鼎耳图版、核对卡包原文、请求年代和出土地；接口均 HTTP 200、`generated=false`，两条引用实际可见。未变更公开暂停语义、应用组件或八卡文件。
- 定向 Maven `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`，`BUILD SUCCESS`；Node 离线 81 通过、0 失败、0 跳过，脚本语法检查和 `git diff --check` 退出 0。演示已启动，定时退出尚未验；未重跑前后端全量、构建或真机。

## 2026-11-22 · 八卡展示自动验收与到期验证

- 通过 `LUOSHENG_LOCAL_DEMO_SMOKE=1` 启动实际八卡候选，复用正式界面与 API。输出 `Dated demo smoke passed: 1440px light`、`Dated demo smoke passed: 390px dark`；覆盖鼎耳图版解码和原文、年代逐字匹配、缺证提示和引用卡号／修订，两类追问均 `generated=false`。
- 另开普通演示限时 5 秒，期间首页 HTTP 200，Maven 正常退出后同一地址 `curl` 退出 7（已无法连接）。两次均 `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。脚本语法与 `git diff --check` 退出 0；未重跑全量、真机或真实模型，未部署或更改公开开关。

## 2026-11-22 · 当前工作树交付复核

- `codex/feat-guide-baseline` / `f33d311` + 未提交变更。前端：`pnpm --dir frontend typecheck` 退出 0；测试 `82 passed` 文件、`670 passed` 项；默认生产构建 `built in 10.87s`，首屏 JS `77453 / 81638 B`、配乐预算通过，保留分块及依赖注解告警。
- 后端 `mvn -B test`：`Tests run: 180, Failures: 0, Errors: 0, Skipped: 6`、`BUILD SUCCESS`。本次默认开关未运行浏览器及本机预览项；此前定向结果分列，不算本次全量内通过。Node 离线 `tests 81 / pass 81 / fail 0 / skipped 0`；`git diff --check` 退出 0。
- 核对总方案 §13 与放行记录：八卡用户确认、本机工程结果已登记；试用表为空、`adb devices` 无设备。正式受控实例和外部模型授权、馆方文案批准、真实高频覆盖、8 人与 50 条抽检及真机资料未见，继续默认关闭。未改事实、公开 API 或开关，未提交或推送。

## 2026-11-22 · 八卡实页截图留档

- 在同一八卡浏览器检查增加可选截图目录。初次截取导览区域时该语义容器无可截图边界而超时（1 失败），改为保留实际浏览器视口后，1440px 浅色与 390px 深色均通过；Maven `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`，`BUILD SUCCESS`。
- 实看鼎耳图版、桌面年代原文与 `LS-DING-PERIOD` 修订 1、窄屏缺证与 `LS-DING-SOURCE` 修订 2 的三张 PNG。保存在任务产物目录，不入仓库，不计真机、真人试用或发布验收。

## 2026-11-22 · 八卡固定问法覆盖复核

- `mvn -B '-Dtest=GuideExhibitIntegrationTests#datedTrialCandidateServesItsExactEvidenceWithoutGenerating' test`：`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`，`BUILD SUCCESS`。整体尺寸、图版出处、三足观察均逐字返回冻结卡片，并给出对应卡号；鼎耳高度只返回缺证且无引用。年代原文和出土地缺证继续通过，六次问答 `generated=false`，生成计数未增加。
- 仅扩展同一八卡的隔离集成测试及覆盖记录，未改应用、冻结内容或开关；不计真实高频覆盖率、真人/真机或公网验收。本轮未重跑全量。

## 2026-11-22 · 八卡试用动线自动复跑

- 同一八卡候选与隔离时段夹具：在实际页面走五分钟推荐、拒绝预约、纠正到三足、承接「另一只呢」、主动切图、查时段与返回三足图版；检查卡号／修订、正文原文、未自动切图、返回后标题回焦。未发起真实生成，未提交预约。
- 定向浏览器输出 `Dated demo smoke passed: 1440px light`、`Dated demo smoke passed: 390px dark`、`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。
- 完整命令复跑：`pnpm --dir frontend typecheck` 退出 0，`pnpm --dir frontend test` 为 `82 passed` 文件、`670 passed` 测试，`pnpm --dir frontend build` 为 `built in 12.19s`，首屏 JS `77453 B / 预算 81638 B`，配乐预算通过；依赖注解、重复导入与大分块仍有警告。`mvn -B test` 为 `Tests run: 180, Failures: 0, Errors: 0, Skipped: 6`、`BUILD SUCCESS`；浏览器定向与默认开关跳过分列。`node --test docs/plans/luosheng-eval/*.test.mjs` 为 `tests 81 / pass 81 / fail 0 / skipped 0`。
- 真人试用表仍空，馆方独立批准和正式受控实例无登记；保持默认关闭，不计真人、真机、真实高频覆盖或发布验收；没有部署、提交或推送。

## 2026-11-22 · 八卡预约交接边界核对

- 拒绝预约时等待本轮馆藏搜索，核对返回青铜鼎、前一轮推荐正文已替换、仍在首页且未访问预约 API。查询三人时段后核对上海时间的明日查询参数、页面选中日与可选时段；整条预约路径只发公开时段 GET，返回时仍是三足背视图并回焦。
- 同一八卡隔离实页输出 `Dated demo smoke passed: 1440px light`、`Dated demo smoke passed: 390px dark`、`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。仅补浏览器断言及记录，未重跑全量；未动应用、卡包、API 或发布开关。

## 2026-11-22 · 正式展签文案补迁

- 展签、图版及预约交接剩余标签移入 UI 文案包（包括 `alt` 和看点组可访问名称）。文字不变；图注继续直接使用卡片正文，八卡候选 SHA-256 不变。预约页只在开启导览时延迟加载文案。
- 源 UI 文案和前后端副本 SHA-256 均为 `88c4ff40d0e3f7533778ffb25ab977330bfb5436246f9ef151cc22706d722a40`。更新的是待审清单；原五文件中仅 UI 指纹刷新，不能视为馆方批准或改变八卡用户确认。
- 新增离线红测先失败（展签未取 UI 文案）；迁移后 `tests 82 / pass 82 / fail 0 / skipped 0`。前端首次类型检查报告 JSON 类型无 `default`；改用仅类型导入后，类型检查退出 0，`82 passed` 文件、`670 passed` 测试；生产 `built in 12.00s`、首屏 JS `77455 / 81638 B`、配乐预算通过，保留构建告警。Maven 全量 `Tests run: 180, Failures: 0, Errors: 0, Skipped: 6`、`BUILD SUCCESS`。
- 八卡隔离浏览器 `1440px light` 与 `390px dark` 均通过，实测看点组、鼎耳和三足图版替代文字、预约页只读交接与返回。定向 Maven `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。不计真机读屏、真人、真实模型或对外放行。
- 默认关闭的产物未检出新增导览文案标记；实页的馆藏及预约浏览正常，讲解预设与问答接口均为 404。定向 Maven `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`；`git diff --check` 通过。未部署、提交或推送。

## 2026-11-22 · 正式导览回复文案补迁

- 导览导航、馆藏检索命中解释、预约时段四种结果及输入提示迁入 `ui.zh-CN.json`，保持原字句。路由、日期过滤、人数限制、公开时段 API、当前名额和馆藏字段来源不变，UI 模板不会二次解释插入的关键词或替换符号。八卡原文与指纹均未改。
- 新增离线回归先失败（导航模块未引用 UI 文案），迁移后 `tests 83 / pass 83 / fail 0 / skipped 0`。源和前后端副本 SHA-256 为 `d3785bb272aeec71a20abfbde2422f0ba7bd3823717f11700a2b143d10c59666`，仅刷新待馆审清单。
- 完整工程回归：前端类型检查退出 0；`82 passed` 文件、`671 passed` 测试；`built in 10.74s`，首屏 JS `77455 / 81638 B` 及配乐预算通过，保留构建告警；后端 `Tests run: 180, Failures: 0, Errors: 0, Skipped: 6`、`BUILD SUCCESS`。八卡浏览器两组视口／主题通过，定向 Maven `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。
- 默认关闭产物未检出导览文案标记，实际浏览路径无导览请求且预设、回合 API 均为 404；定向 Maven `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。`git diff --check` 通过；未调用真实模型、未部署、未提交或推送，不提升正式放行状态。

## 2026-11-22 · 三足侧视追问顺序复验

- 此前演练顺序从鼎耳先纠正、再追问；本次对齐试用手册，从真实三足侧视先问「另一只在哪」，再说「我说的是脚」。两轮均返回冻结三足卡原文、卡号和修订，均不生成、不切图；主动点背视按钮后才切图，查公开时段返回仍保留背视。
- 两次定向失败如实保留：手动切换看点不应断言标题夺取焦点；修正为选中按钮 `aria-pressed=true` 后，窄屏展开面板挡住看点按钮。演练先用既有收起操作、再切看点。最终两组输出 `Dated demo smoke passed: 1440px light`、`Dated demo smoke passed: 390px dark`，Maven `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`，`BUILD SUCCESS`。
- 仅改验收脚本和文档；未重跑全量。试用结果表仍为空，`adb devices` 未列出设备；不计真人、真机或正式发布，不修改冻结候选及公开开关。

## 2026-11-22 · 三足和预约实页留档

- 同一八卡演练新增可选截图：窄屏三足回答和「看背视图」按钮、预约页只读时段及返回入口、返回后的已解码背视图。三张图已读回查看，存于任务产物目录，不入仓库。时段和空位均来自隔离预约夹具，不代表实际库存。
- 定向 Maven 输出 `Dated demo smoke passed: 1440px light`、`Dated demo smoke passed: 390px dark`、`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。仅改截图分支和文档，未重跑全量、不计真人或发布验收。

## 2026-11-22 · 八卡批准指纹失配与恢复

- 在八卡浏览器演练末尾只修改 Maven 注入的 JUnit 临时批准指纹；先校验原字节与冻结卡包相符，故意失配后刷新，讲解接口 HTTP 200、`available=false`、`entries=[]`，页面公开藏品标题仍显示且没有旧三足卡。恢复原字节后刷新，重新打开讲解可见原文。没有写正式批准、卡包或部署配置。
- 两档实页输出 `Dated demo smoke passed: 1440px light`、`Dated demo smoke passed: 390px dark`；Maven `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`；脚本语法与 `git diff --check` 通过。未重跑全量或验证不刷新的现有页面，不计正式撤回演练。

## 2026-11-22 · 指纹失配后未刷新页面的追问

- 在原来的批准失配与恢复演练中，先留在三足页追问「我说的是脚」，再刷新。两种视口均收到 HTTP 200、`INSUFFICIENT_EVIDENCE`、`generated=false`、`citations=[]`、`text=null`；界面用声音包界面文案显示资料不足，新答复无旧三足原文和背视图按钮。原有刷新与恢复检查继续通过，不断言已画出的静态图版实时消失。
- 首跑测试错误地把 `null` 当作界面文本断言，Maven 报 1 失败；改为分别断言接口和界面文案后：`Dated demo smoke passed: 1440px light`、`Dated demo smoke passed: 390px dark`，`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。仅改定向脚本与记录，未重跑全量、未改正式批准、未调用外部模型。

## 2026-11-22 · 当前工作树全量与浏览器补验

- `pnpm --dir frontend typecheck` 退出 0；`pnpm --dir frontend test` → `Test Files  82 passed (82)`、`Tests  671 passed (671)`；`pnpm --dir frontend build` → `built in 11.56s`，首屏 JS 77455／81638 B 与配乐门禁通过；保留依赖注释、动态／静态同引和大分块警告。
- `mvn -B test` → `Tests run: 180, Failures: 0, Errors: 0, Skipped: 6`、`BUILD SUCCESS`；v6 `accepted=7 rejected=3 falsePositives=0 unsupported=3 total=10`。`node --test docs/plans/luosheng-eval/*.test.mjs` → `tests 83`、`pass 83`、`fail 0`、`skipped 0`。八卡登记预检退出 0，SHA-256 仍为 `1f8d3c15ab6bc7d9b694eb212205778e2d27d82f8c7017333c8521342405d1cf`。
- 五个开关场景定向首跑：预制讲解、开启态首页往返、冻结八卡两视口以及关闭态生产构建浏览通过；HTTP 浏览器场景在桌面查点云按钮焦点时按钮已消失，页面显示点云不可切换、仍可读图版。合计 `Tests run: 5, Failures: 1, Errors: 0, Skipped: 0`、`BUILD FAILURE`。以已安装 Chrome 单独复跑同一 HTTP 场景（保留断言）→ `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。浏览器与运行负载同时变化，不能判定首跑降级根因已修复；手动预览未当作自动验收运行。
- 本机演示首页和讲解接口 HTTP 200；`adb devices` 无设备，试用表仍为空。只更新执行记录、状态与追踪，未改代码、冻结包、审批或发布配置；未调用真实模型、提交或推送。真实问题覆盖、馆方文案、同批正式实例、真人试用与独立回答抽查仍待实际证据。

## 2026-11-22 · 默认 Chromium 点云独立复跑

- HTTP 浏览器脚本在点云场景用 `MutationObserver` 仅记录画质、查看器、点云与渲染状态的变动（最多 30 条，含相对时间，仅失败时输出）。没有改动渲染、浏览器启动参数或原断言；桌面仍要通过键盘确认、从实体切换到点云及画面变化，窄屏仍要在 GLB 请求故意失败时保留图版说明。
- 默认 Chromium、`LUOSHENG_RUN_BROWSER=1` 下单独执行 `mvn -B '-Dtest=GuideHttpIntegrationTests#browserUsesRealTestServiceAndDropsLateResponses' test` → `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。上轮失败此次未重现；尚不能确认首跑出现的是性能降级或其他状态变化，不能将这次独立通过写成批量稳定性或真机通过。未改应用、批准和发布配置，未重跑全量。

## 2026-11-22 · 点云降级定位与八卡演示入口核对

- 默认 Chromium 合跑五项再次为 `Tests run: 5, Failures: 1, Errors: 0, Skipped: 0`、`BUILD FAILURE`。失败场景的记录显示桌面查看器先到 `ready`，画质在 11609ms `high → medium`、24486ms `medium → fallback`，点云状态始终 `idle`，按钮消失后焦点断言失败。确认本次是性能降级，未关闭降级或放宽点云断言；不能外推到真机。
- 日期版启动红测：只带 `LS-DING-EARS` 的回环假夹具被旧启动器错误打印成八卡入口，`pass 0 / fail 1`。启动器现先核对展项、语言、八卡数量和唯一性、每卡修订／原文／公开出处，才打印链接；错夹具回归和全部 Node 离线测试 `tests 84 / pass 84 / fail 0`。未改正式 API 或事实卡包。
- 加固后日期版定向 Maven 两档 `Dated demo smoke passed: 1440px light`、`Dated demo smoke passed: 390px dark`；`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`。没有重跑前后端全量，不计真人／真机或发布验收；未使用真实模型，不改变发布状态。

## 2026-11-22 · 点云独立浏览器进程对照

- 实验：在点云阶段前关闭前一 Chromium 并以相同参数重新启动，原断言、顺序和降级逻辑不变。原 PATH Node v24.15.0 的子进程在点云阶段前以 `-1073740791`（`0xC0000409`）退出；四项通过，合跑 `Tests run: 5, Failures: 1, Errors: 0, Skipped: 0`、`BUILD FAILURE`。
- 换用已安装 Node v24.22.3 再跑同一五项，仍是 `Tests run: 5, Failures: 1, Errors: 0, Skipped: 0`、`BUILD FAILURE`。三项展品浏览器场景（含冻结八卡两视口）和关闭态生产浏览通过；点云状态在 3954ms 达到 `ready`，10449ms `high → medium`，22910ms `medium → fallback`，一直未离开 `idle`，焦点检查找不到已撤下的按钮。独立 Chromium 无法消除复现，故撤回本轮进程拆分，保留原诊断日志和断言。未确定总负载或截图等待各自贡献，未改正式代码、审批或公开开关，未重跑全量。

## 2026-11-22 · 点云截图顺序与复验

- 同一 Chromium／Node 24.22.3 合跑带计时复现：焦点断言失败，`Tests run: 5, Failures: 1, Errors: 0, Skipped: 0`。首档画质下降发生在截图前约 426ms；实体截图耗时 9620ms，结束后 2959ms 切到 `fallback`，确认未完成。该记录不能证明截图导致性能下降，但说明截图占了确认前的一段时间。
- 将实体截图提前到查看器就绪后，随后滚到讲解区按既有机制离屏暂停，再提问并以键盘确认。保留构建点云、模式切换、回到画布恢复渲染和画面变化断言；保留窄屏 GLB 失败与图版回退断言。默认 Chromium／Node 24.22.3 同一五项合跑 `Tests run: 5, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`；八卡桌面浅色和窄屏深色通过，关闭态产物无向导 UI 或请求。
- 脚本语法与 `git diff --check` 通过；未重跑前后端全量，也未证明低性能设备在持续可见时一定不降级。未改应用代码、正式开关或审批记录，未调用真实模型。

## 2026-11-22 · 冻结八卡与开启态生产构建同跑

- 新增日期版自动冒烟的 `LUOSHENG_DATED_DEMO_DIST`。它只接受绝对输出目录和日期版 smoke，通过 Vite preview 仅在回环服务静态构建并代理到隔离 Spring/H2；实际首页正文与指定 `index.html` 一致才继续八卡校验。默认演示路径、公开 API 和部署配置未变。
- 开启态临时 Vite 构建 `✓ built in 11.64s`，首页 SHA-256 `717d40951a9e1f99deb65dfec50c6cfe11cbdf1b2cdb32cf7ebbe7020364be02`（仅首页，不代表整包或镜像）。Maven 输出 `Dated demo served the exact built index`、`Dated demo smoke passed: 1440px light`、`Dated demo smoke passed: 390px dark`，`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。覆盖三足追问、只读预约原看点返回、失配不再引用及恢复；未留运行入口。
- Node 离线 `tests 84 / pass 84 / fail 0 / skipped 0`，脚本语法和 `git diff --check` 通过。仍有 Vite 分块等构建警告。未重跑默认前后端全量、实际发布镜像或开启态预算，未做反向主题矩阵、真人／真机或真实模型验证；没有更改审批、事实包或正式放行状态。

## 2026-11-22 · 同一八卡产物四组主题及预算

- 沿用上一轮同一开启态产物（复核 `index.html` SHA-256 一致），加入 1440px 深色和 390px 浅色，并逐组断言页面真实主题。日期版 Maven：`Dated demo served the exact built index`、`Dated demo smoke passed: 1440px light / 390px dark / 1440px dark / 390px light`（四条独立输出）、`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。核看两张反向主题截图，原测试组截图名称不互相覆盖。
- 同一目录调用现有预算函数，输出 `initialJsGzipBytes=79073`、`initialCssGzipBytes=48880`、`woff2Files=0`、`failures=[]`，只核首屏预算。脚本语法与 `git diff --check` 通过；未重跑全量、配乐资源门禁或正式镜像，未执行真人、真机或真实模型。未变更公开开关、审批或事实包。

## 2026-11-22 · 同一八卡后端的仅前端回滚

- 日期版开启态四组结束后，同一 Spring/H2 后端不重启、不改批准，另以默认关闭产物跑首页、搜索、展项、返回藏品和公开预约。确认实际首页为关闭态静态文件，产物无测试文案／图版标记，页面没有导览 UI 或请求。独立直接 GET 仍返回八张卡，证明没有偷偷关闭后端；两者都关闭时照常断言讲解与问答 HTTP 404。
- Node v24.15.0 首跑在浏览器断言前以 `-1073740791`（`0xC0000409`）异常退出。Node v24.22.3 补跑开启与关闭场景：`Frontend-only rollback: all eight cards still available at the backend`、`Production HTTP: preset and turn routes both returned 404`、`Tests run: 2, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。离线 `84/84`、脚本语法与 `git diff --check` 通过。
- 只证明本机前端回退，不证明后端停用或生产切换；未重跑全量或真机，不改生产配置、事实包及审批，不调用真实模型。

## 2026-11-22 · 八卡打包版运行中暂停和恢复

- 同一冻结包及开启态构建，桌面浅色在正常引用后写入隔离测试暂停标记。下一轮实际 HTTP 200：`outcome=QUESTIONING_DISABLED generated=false citations=0`；无正文、无图版动作。实页「读当前讲解」仍显示三足原文，查询三人时段只发一条公开 GET；移除标记后再次追问恢复原文和引用。其余三组保留原场景。
- `Dated demo pause/resume passed: 1440px light; readable plate, GET-only slots, cited reply restored`；四组尺寸和主题全部通过。Maven 定向 `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。未重跑默认前后端全量，未测试真机、真人、真实模型或正式部署。
- 日期版的限时本机体验入口允许复用同一静态构建，仍要求绝对目录、回环连接及冻结八卡校验；回滚目录仍仅允许在冒烟模式使用。
- 交互入口实际启动：`Dated demo served the exact built index`，独立请求得到 `HTTP 200; available=True; cards=8`；仅回环限时开放。离线套件 `tests 84 / pass 84 / fail 0 / skipped 0`，两个脚本语法检查与 `git diff --check` 通过。

## 2026-11-22 · 八卡一键重建与本机体验

- 新增 PowerShell 入口：以当前代码构建独立临时产物，启动日期版隔离后端，复用首页和八卡核对。构建和运行分别设置进程环境，退出恢复，避免污染下次日常构建；不读取上次地址或复用旧包。
- Node 24.22.3 下运行 `./frontend/scripts/luosheng-local-demo.ps1 -Smoke`：`built in 11.52s`、`Dated demo served the exact built index`、四组布局和桌面暂停恢复均通过，`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。仍有依赖注释和 Vite 分块警告。不是正式实例或真实模型验收。
- 普通体验模式也实跑：独立产物 `built in 9.63s`，启动后实测 `HTTP 200; available=True; cards=8`。默认 `frontend/dist/index.html` 前后 SHA-256 一致；PowerShell 语法解析 0 错误，`git diff --check` 通过。未重跑默认前后端全量，限时实例在记录时仍运行。

## 2026-11-22 · 八卡打包版迟到回复隔离

- 首跑使用 Playwright 测试侧转发，后端因同源请求头未保留返回 HTTP 403，未到迟到断言，Maven 失败 1 项。改为 Chromium 正常发送请求，仅在浏览器侧延后把真实 JSON 交给应用；不修改应用、服务端校验或事实包。
- 桌面浅色实测接口正常返回三足原文、卡号和修订（HTTP 200，非生成）；页面进入核对状态，关闭问答、换鼎耳、重开后再释放旧响应。旧正文、依据和背视图动作均不显示；新年代问题仍正常回答并可查看引用。
- `Dated demo late reply passed: held cited feet response never replaced the ear context`；四组尺寸和主题冒烟通过，`Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。离线 `84/84`，脚本语法和差异检查通过。未重跑默认全量，也未验证真实模型上游取消／计费、真人、真机或正式实例。

## 2026-11-22 · 八卡打包版生成不可用与额度降级

- 首跑真实接口返回 `GENERATION_UNAVAILABLE`，随后长会话先触及 `SESSION_RATE_LIMITED`，Maven 失败 1 项。将生成故障移到新访次，未调整任一限制，保留独立后端的单次日额度。
- 桌面浅色两次先取到带引用的年代回答，再提交「这只鼎耳是用来做什么的？」。真实接口依次 HTTP 200、`GENERATION_UNAVAILABLE` 和 `GENERATION_LIMIT_REACHED`，均无正文、引用或图版动作，页面显示各自回退提示、不保留旧依据。主动返回继续读鼎耳原文，不重发问答、焦点回到图版标题。
- `Dated demo generation fallback passed: loopback failure and exhausted budget cleared citations; current plate remained readable`，四组浏览器通过，Maven `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`；离线 `84/84`、脚本语法与 `git diff --check` 通过。未重跑默认全量，不等于真实模型、供应商额度或正式实例验收。

## 2026-11-22 · 断网保留已打开的图版

- 红测：Chromium 离线，实际问答请求失败并清掉旧引用，但点击「读当前讲解」重新拉取失败，清空当前图版，标题无法获得焦点；Maven 失败 1 项。
- 修复仅区分展签请求的传输错误：面板原已打开、同页同看点同视角时保留读屏当前内容并回焦。显式不可用、失败的 HTTP 回复、跨页或尚未打开等情形不使用该回退。未增加存储、事实或 API 字段。
- 绿测：`Dated demo browser offline passed: request failed, open plate remained readable and reconnect restored cited replies`、`Dated demo open plate revocation passed: explicit unavailable preset cleared the old plate`。同一构建的四组浏览器通过，Maven 定向 `Tests run: 1, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。断网时无法接收撤回，不证明正式同批实例、真机或真实模型。
- 默认全量复验：前端类型检查退出 0，`Test Files 82 passed (82)`、`Tests 671 passed (671)`；默认构建 `built in 15.69s`，预算检查退出 0（保留 Vite 分块警告）。后端 `Tests run: 180, Failures: 0, Errors: 0, Skipped: 6`、`BUILD SUCCESS`，默认跳过可选场景；v6 固定语料 `accepted=7 rejected=3 falsePositives=0 unsupported=3 total=10`。离线 `84/84`，脚本语法与差异检查通过。

## 2026-11-22 · 断网修复后回滚复验

- 同一次 Maven 运行使用断网修复后的开启态与关闭态构建。首页 SHA-256 分别为 `8b880576caa3137f0dc3679227cba2c88cdd811914b139ac3f946f511f4dde99`、`df7df6f31945fc872d13f914c5850cbceba18df56a3499f82e65d98b0e8e9dcb`，仅指首页文件。冻结八卡 SHA-256 仍为 `1f8d3c15ab6bc7d9b694eb212205778e2d27d82f8c7017333c8521342405d1cf`。
- 四组开启态场景通过；同一后端仅换回关闭产物后，公开浏览与时段正常，无导览请求，`Frontend-only rollback: all eight cards still available at the backend`。独立全关闭实例：`Production HTTP: preset and turn routes both returned 404`。定向合跑 `Tests run: 2, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。
- 开启态首屏预算复测：JS gzip `79085` B、CSS gzip `48880` B、`woff2Files=0`、`failures=[]`。未测试正式部署切换、真实模型、真机和真人；未变更审批、应用行为或部署开关。

## 2026-11-22 · 八卡打包版客户端截止时间

- 前两次演练失败在 Playwright 重复关闭已处理路由；更换为浏览器 fetch 层模拟未响应后，第三次因进度及回复同时具有 status 角色而命中两个元素。最终按实际顺序验证进度出现、消失，再核对超时正文，不改应用。
- `Dated demo browser deadline passed: one stalled request, no old citations or retry, current plate readable`。四组浏览器通过，桌面浅色断言实际客户端取消信号、尝试一次、清除旧引用及读图版回焦。另合跑后端两个合成生成超时／并发测试；总计 `Tests run: 3, Failures: 0, Errors: 0, Skipped: 0`、`BUILD SUCCESS`。
- 离线 `84/84`、脚本语法与差异检查通过。未重跑默认全量，未验证正式实例、真机或真实模型。
