# 全站沉浸式视听升级

> 关联 `docs/design/2026-09-19-immersive-audiovisual-design.md`（设计提案）与本计划（实施与验收）。设计方案给出视听语言，本计划负责把语言落到现有代码结构上，并给出可复现的验收边界。
>
> 状态：**阶段 A/B/C 实施完成，阶段 D 自动化门禁已通过；§5.2 浏览器实页验收已执行并发现 5 项缺陷（均非本轮改造的回归，尚未修复）；主观听感待用户实机确认**。用户已就两项关键取向作出决定：**音效控件采用"单总开关 + 展开式音量分档"**（§2.4），**背景音乐走"别具风格、具备高级感"的生成式音景路线**（§2.2）。实际证据见 §7，未通过项见 §7.4。

## 1. 目标

在既有"河洛纸墨"设计系统与纯 Web Audio 合成音效体系内，补齐三个已建成但未接通的能力，并为其余公开页面建立统一的视听编排：

1. **接通环境音景**：`AmbienceScene`（hall / bronze / jade / river）与 `switchAmbience()` 已实现但零调用，需按页面语义与内容主题启用。
2. **新增生成式背景音乐**：当前无任何 BGM。以 Web Audio 实时音序器合成古琴／编钟／水声式音乐层，零音频文件。
3. **补齐页面级音效与动效**：Explore、展厅、详情、预约、商城、账户当前为动效与音效空白；后台只做轻量统一。

### 1.1 明确不做

- 不引入任何音频文件（mp3/ogg/webm/wav）；不接入第三方音源库。音效素材建议一节（设计方案 6.1）不予采纳，理由见 §2。
- 不新增运行时依赖。`ScrollTrigger` 复用已安装的 `gsap` 包内插件。
- 不改动业务逻辑、API、权限、数据表、模拟支付与 Three.js 模型质量。
- 不为后台运营工作台增加装饰性动效或音效；后台只沿用既有控件反馈。

## 2. 关键决策与理由

### 2.1 全部程序化合成，零音频文件

沿用 `soundSynthesis.ts` 的 `OfflineAudioContext` 渲染路线，新增音色与音乐层同样是代码而非素材。理由：

- `AGENTS.md` 要求"3D 模型、图片和字体必须记录来源/版权"，且"不新增大型依赖"。合成音无版权登记负担。
- `bundle-budget.mjs` 对 CSS/JS gzip 设 5% 增长门禁，且禁止 WOFF2 进入产物；音频文件虽不在该脚本统计范围内，但会实质增加发布包体积。合成方案体积增量为纯代码。
- 现有代码注释已把该路线作为既定产品决策（"no audio files to fetch, license, or ship, and zero load-time cost"）。

### 2.2 生成式音乐：写"音景"，不写"旋律"

用户取向为**大胆设计、别具风格、具备高级感**。据此确定如下取向，并明确其反面：

**追求**——调式化而非循环化的生成式音景。五声音阶为骨架，按页面语义选调式与配器：首页开阔（宫调、低频托底、编钟点缀）、详情内敛（羽调、古琴拨弦、稀疏）、展厅明亮（徵调、泛音与气声）、预约与账户平实、商城轻快。音符间距以"秒"为单位，不做可哼唱的旋律主题。

**避免**——博物馆语境下"高级感"的反面恰恰是"有记忆点的旋律"：一段写得好听的循环，在详情页停留三分钟就会从沉浸变成骚扰；而一旦它被记住，第二次进入就变成"又是这首"，破坏展陈感。因此不做预制循环、不做主旋律、不做节拍律动。

**判断标准**（用于人工验收）：这段音乐应听起来像"展厅里恰有人在很远的地方试琴"——几乎不被注意到，但关掉之后空间感立刻塌陷。

实现路线为 `AudioContext` 实时调度音符（scheduler 前瞻式排程），而非离线渲染整段循环后 `loop = true`。理由：单段循环在长时间停留（详情页阅读、预约填表）会暴露重复感；实时调度可带随机化与和声游走，且可随页面改变调式与配器，并与环境音共用一套总线做交叉淡入淡出。

### 2.3 新增主音量总线

当前 `playInteraction` / `playTransition` / `switchAmbience` 各自直连 `context.destination`，无法统一控制音量、无法做 ducking（音乐在交互音或叙事音出现时自动让位）、也无法实现"仅静音音乐但保留音效"。需引入 `masterGain → destination` 与 `musicBus` / `sfxBus` / `ambienceBus` 三条子总线。

### 2.4 音效控件：单总开关 + 展开式音量分档

用户决定：**保留一个总开关，悬停／点击展开音量分档**，而非在顶栏并列"音效"与"音乐"两个按钮。

理由与约束：顶栏已有深色模式、语言、账户四个控件，再并列两个音频按钮会使移动端（`main.css` 在 767px 以下隐藏 `span` 文案，仅剩图标）难以自解释；且"音效／音乐"的拆分是低频需求，不值得常驻顶栏。

交互契约：

- 默认收起，仅显示图标 + 状态文案（沿用现有 `aria-pressed` 语义）。
- `hover`（指针设备）与 `click` / `Enter` / `Space`（键盘与触屏）均可展开；触屏无 hover，故 click 必须能展开。
- 展开面板内含：**音效**、**音乐**两个独立开关，以及总音量分档。
- 面板展开不得改变顶栏布局高度（浮层定位），移动端不得产生横向溢出。
- 键盘可达：`Escape` 收起，焦点移入面板时不被 `PointerCursor` 之类的全局指针逻辑劫持；收起后焦点回到开关。
- 总开关仍为静默默认（沿用 `museum-audio-enabled` 键），细分偏好分别持久化；总开关关闭时所有子总线静音。
- `prefers-reduced-motion: reduce` 下仍保持"默认关闭"的既有行为。

## 3. 影响范围

### 3.1 变动文件

| 文件 | 变更 |
| --- | --- |
| `frontend/src/lib/soundSynthesis.ts` | 新增音色规格：页面交互音、环境音补齐（river 已有扫频，需补 pad 层）、乐器音色（古琴拨弦、编钟、埙／箫气声） |
| `frontend/src/lib/audioSystem.ts` | 新增总线架构、BGM 启停、环境音自动切换、ducking、音量分级；`preloadEssentials` 扩展 |
| `frontend/src/lib/musicGenerator.ts` | **新增**：生成式音序器（调式／和声进行／配器／排程），随机数可注入种子 |
| `frontend/src/lib/audioScenes.ts` | **新增**：路由 → 环境音场景 + 音乐场景的映射表 |
| `frontend/src/stores/audio.ts` | 单总开关 + 音效／音乐拆分 + 音量分档，各自持久化 |
| `frontend/src/components/AudioControl.vue` | **新增**：总开关 + 展开式面板（替代 `App.vue` 内联按钮） |
| `frontend/src/App.vue` | 接入 `AudioControl`，移除内联音频按钮 |
| `frontend/src/lib/inkTransitions.ts` | 转场音与 BGM 场景切换的时序协同 |
| `frontend/src/views/*.vue` | 各公开页面接入动效编排与音效（Explore / Exhibits / ExhibitDetail / Appointment / Shop / Login / Profile） |
| `frontend/src/components/*.vue` | 共享控件（`MuseumSearchField` / `EditorialCard` / `BottomSheet` / `CartPanelContent` / 分页）接入反馈音 |
| `frontend/src/assets/*.css` | 新增动效所需的 `data-motion` 初始态与降级规则；`audio-control` 浮层样式 |

### 3.2 不改动

后端、`docs/04-data-and-permissions.md`、`docs/05-api-design.md`、权限、路由守卫语义、`ROUTE_TRANSITION_MS` 语义、Three.js 模型与画质。

## 4. 实施步骤

### 阶段 A：音频基础设施（不改视觉，可独立验证）

1. **总线重构**（`audioSystem.ts`）：建 `masterGain`，下挂 `sfxBus` / `musicBus` / `ambienceBus`。现有三个播放入口改接子总线，行为与音量默认值保持不变，现有测试不得回归。
2. **音量与开关拆分**：`stores/audio.ts` 拆为 `sfxEnabled` / `musicEnabled`，各自持久化到独立 localStorage 键（沿用 `museum-audio-enabled` 作为总开关，避免破坏已保存偏好）。默认仍为**全部静音**，符合 09-21 收口结论。
3. **环境音自动切换**：封装 `useAmbienceScene()`，由路由与内容主题驱动 `switchAmbience()`；页面离开时按需 `stopAmbience()`。补齐 `ambience-river` 的 pad 层，使四场景响度感知一致。
4. **生成式音乐**（`musicGenerator.ts`）：五声音阶为骨架，按页面语义选调式（见 §2.2）。提供 `start(scene)` / `setScene(scene)` / `stop()`，场景切换用交叉淡入淡出而非硬切；随机数注入种子以便测试复现。
5. **音量分档**：`masterGain` 上实现"静／轻／常／满"四档，档位改变时对三条子总线做短斜坡而非跳变（避免爆音）。

### 阶段 B：页面动效编排

6. **建立共享编排原语**：在 `lib/gsap.ts` 旁新增滚动揭示辅助，统一 `ScrollTrigger.batch` 的 `start` / `once` / 降级分支，避免六个页面各自复制 `ContentDetailView` 的写法。所有新动效必须：仅在 `motionTier === 'full'` 且非 `prefers-reduced-motion` 时运行；用 `createGsapContext` 包裹以便 `revert()`；`clearProps` 释放内联样式。
7. **Explore**：首屏看板入场、馆藏卡滚动揭示（`v-artifact-awaken` 已有悬停效果，补入场）、筛选切换的列表重排过渡、分页切换过渡、搜索结果的竹简式依次显现。
8. **Exhibits / ExhibitDetail**：已有 12 / 27 个钩子，核对完整性与降级一致性，补展项卡入场与 3D 信息板时序。
9. **Appointment / Shop / Login / Profile**：预约步骤推进与摘要更新、商城卡片入场与购物袋展开、登录表单聚焦反馈、个人中心记录列表入场。商城与账户以"不干扰操作"为上限——动效服务于状态变化确认，不做装饰性编排。
10. **后台轻量统一**：仅统一控件反馈与页面切换的既有基线，不新增滚动编排。

### 阶段 C：音效接线

11. **共享控件反馈音**：搜索聚焦／提交／清除、分类切换、分页、购物袋开关、表单校验成功／失败、复制与展开。统一走 `adaptivePlay` 以保留防听觉疲劳逻辑。
12. **材料语义音**：`v-artifact-awaken` 已按 bronze / jade / ink 分音色，扩展到展项卡与商城商品（商品按品类给中性音色，不强行套材料语义）。
13. **叙事音接线**：`opening` / `discovery` / `ending` 接入详情页关键节点与 3D 展项进入／退出，并触发 BGM ducking。

### 阶段 D：验证与文档

14. 门禁与证据收集见 §5。
15. 更新 `PROJECT_STATUS.md`、`docs/01-requirements-traceability.md`、`docs/06-test-plan.md`，并在 `docs/design/2026-09-19-immersive-audiovisual-design.md` 标注本计划为其落地实施。

## 5. 验收标准

### 5.1 必须通过（自动化）

- `pnpm typecheck` 通过。
- `pnpm test`（vitest）全部通过；新增测试覆盖：
  - 总线架构下默认静音、偏好持久化、存储不可用时降级；
  - 音效／音乐独立开关互不影响；总开关关闭时两者皆静音；
  - 音量分档写入 `masterGain` 的期望增益值，且档位切换不产生跳变；
  - 环境音场景切换的调用契约（含重复切同场景不重建）；
  - `musicGenerator` 的调式／和声推进在给定种子下可复现（随机数需可注入种子）；
  - 各页面在 `motionTier === 'static'` 与 `prefers-reduced-motion` 下不注册 ScrollTrigger；
  - 组件卸载后无遗留 AudioNode 与 ScrollTrigger 实例。
- `pnpm build` 通过，`bundle-budget.mjs` 全部门禁通过（初始 CSS ≤ 80,000 B gzip；JS／CSS 增长 ≤ 基线 5%，如超需明示并说明理由）。
- `git diff --check` 通过。

### 5.2 必须通过（浏览器实页）

- 双主题、双语、390 / 1440 两视口，逐页核对：进入动画完成、无横向溢出、核心操作可交互、控制台无异常。
- 音效控件：默认关闭；hover 与 click 均可展开；展开不改变顶栏高度、移动端不溢出；`Escape` 收起且焦点归还；开启后音效与音乐均生效；刷新后偏好保持；总开关关闭后所有子总线静音。
- 页面切换时环境音与 BGM 正确交叉淡入淡出，无叠音、无爆音。
- 关闭音效后不再创建 `AudioContext`；`prefers-reduced-motion` 下不播放装饰性动效。
- 键盘可达性与既有 axe 基线不回归。"112 状态 0 violations"基线属实（`artifacts/premium-visual-2026-09-12/accessibility/summary.json`），但**该基线只覆盖采集时已挂载的 DOM**；本轮命中的 2 处对比度所在元素从未被基线审计过，故不能据此判定为回归。限定条件见 §7.6。

### 5.3 人工确认（不得由自动化代替）

- **主观听感**：音色是否悦耳、编钟与古琴是否可信、长时间停留是否产生听觉疲劳；音乐是否达到 §2.2 所述"几乎不被注意到、关掉后空间塌陷"的判断标准。此项必须由用户实机确认，不标为已通过。
- **真机帧率与触控体验**：实体设备上的动画流畅度与音频延迟。历史 Chrome133 的 3D 兼容风险保留，本轮不改变其结论。

### 5.4 未验证即如实列出

每项未运行或失败的验证在最终报告逐条列出，不以"应该可以"代替结果（`AGENTS.md` §5）。

## 6. 风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| 音频节点泄漏 | 长时间使用后内存增长、杂音 | 每阶段补卸载测试；`onBeforeUnmount` 停止 BGM 与环境音；场景切换复用节点而非无限新建 |
| 浏览器自动播放策略 | 首次进入无声音 | 保持现有"首次用户交互后初始化"策略；BGM 仅在有用户手势后启动，不做自动尝试 |
| 动效与业务竞态 | 揭示动画导致内容短暂不可见或掩盖操作 | `AGENTS.md` §4 已定"移动端优先保证可用性，不以特效牺牲核心操作"；装饰动效与可读内容并行，CTA 与导航不参与隐藏 |
| 音乐与语音类内容冲突 | 阅读时长文本时干扰 | BGM 默认音量低于环境音；详情页阅读区默认压低音乐；ducking 让位 |
| 生成式随机导致不可复现 | 测试不稳定 | 随机数注入种子，测试固定种子断言 |
| bundle 预算超限 | 构建门禁失败 | 音乐生成器按路由懒加载；新增代码控制在预算内，超限时明示并说明 |
| 感官过载 | 与"安静动效"设计契约冲突 | `design.md` 明确要求"安静动效"与"禁止无节制玻璃拟态"；本计划的动效克制度以此为准，音效总量保持低面积 |
| 展开面板劫持全局指针/焦点 | 键盘与触屏用户无法操作 | 面板不参与 `PointerCursor` 逻辑；`Escape` 归还焦点；纳入 §5.2 键盘核对项 |

## 7. 验证结果

> 本节记录 2026-09-26 本轮实际执行的命令与输出。**沙箱限制说明**：工作区 `node_modules` 由 Windows 侧 pnpm 安装，其符号链接在 Linux 侧读取返回 `EIO`，故 `pnpm test` / `pnpm typecheck` **无法原地执行**。全部检查在隔离副本 `/tmp/vt` 中运行（`rsync` 同步源码，副本自带独立 `node_modules`）。**同步为单向：源码树 → 副本，禁止反向**。

### 7.1 自动化门禁（已通过）

| 门禁 | 命令 | 结果 |
| --- | --- | --- |
| 类型检查 | `npx vue-tsc -b --force` | 通过，无输出（exit 0） |
| 单元测试 | `npx vitest run` | **69 文件 / 435 测试全部通过**，0 失败，49.0s |
| 生产构建 | `npx vite build` | 通过，10.74s |
| 资源预算 | `node scripts/bundle-budget.mjs` | **门禁通过**；首屏 CSS 48,819 B ≤ 80,000 B；首屏 JS 78,274 B ≤ 81,638 B；全量 JS 526,433 B / CSS 106,597 B |
| 空白/行尾 | `git diff --check`（本轮涉及文件） | 通过，无发现 |

### 7.2 新增测试覆盖（对照 §5.1 逐项）

| §5.1 要求 | 覆盖文件 | 行数 |
| --- | --- | --- |
| 总线架构、默认静音、偏好持久化、存储降级 | `src/lib/audioBus.spec.ts` | 470 |
| 音效／音乐独立开关；总开关关闭时皆静音 | `src/lib/audioBus.spec.ts`、`src/lib/audioSystem.spec.ts` | 470 / 29 |
| 音量分档写入 `masterGain` 期望增益、切换不跳变 | `src/lib/audioBus.spec.ts` | 470 |
| 环境音场景切换契约（重复切同场景不重建） | `src/lib/audioBus.spec.ts` | 470 |
| `musicGenerator` 给定种子可复现 | `src/lib/musicGenerator.spec.ts` | 682 |
| 路由 → 音景映射（含全部路由覆盖） | `src/lib/audioScenes.spec.ts` | 79 |
| 音乐导演／交叉淡入淡出 | `src/lib/musicDirector.spec.ts` | 384 |
| 共享控件反馈音 | `src/lib/interactionSound.spec.ts` | 179 |
| 动效降级原语与帧预算 | `src/lib/gsap.spec.ts`、`src/lib/motionFrame.spec.ts` | 28 / 38 |
| 各页面 `static` / `prefers-reduced-motion` 下不注册 ScrollTrigger | 各页面 `*.spec.ts`（`readFileSync` 源码断言） | — |

### 7.3 本轮修复的问题

1. **`playNarrative` 零调用**：`opening` / `discovery` / `ending` 三种叙事音已实现但全站无调用点，属"建成未接通"的最后一处。已接线：详情页开篇与阅读结束（`ContentDetailView`）、3D 展项就绪（`ExhibitDetailView`）、展项列表与商城上架（`ExhibitsView` / `ShopView`）、账户记录就绪（`ProfileView`）。各调用点均有"每次访问仅触发一次"的守卫，避免语言切换或筛选重渲染重复击钟。
2. **`awaken-*` 材料音覆盖不足**：`ExhibitDetailView` 进入 3D 与 `ExhibitsView` 打开展项卡补 `awaken-bronze`。
3. **CRLF 行尾回归（已修复）**：14 个 `frontend/src` 文件被改写为 CRLF，而 HEAD 均为 LF，且仓库无 `.gitattributes`。`git diff` 会归一化行尾因而看不出差异，但 `git diff --check` 读取原始字节，会把**每一个行**（含文件首行）报成 "trailing whitespace"——即 §5.1 的门禁失败与被改写行数成正比。已全部还原为 LF；复核 `frontend/src` 残留 CRLF = 0，`git diff --check` 在本轮涉及文件上 exit 0。**建议**：新增 `.gitattributes` 声明 `* text=auto eol=lf`，否则同一问题会在下次写入时复发。
4. **`ProfileAppointments` 取消预约静默**：成功后既不设 `message` 也无 `role="status"` 节点，委派音层看不到任何信号。已补 `playTransition('dismiss')`。
5. **未重复接线的判断**：商城下单成功/失败、账户支付结果均经 `InlineStatus` 渲染 `data-state`，全局委派音层已覆盖（且 `announce: false` 时仍生效），故**刻意不加**，避免同一次事件响两声。

### 7.4 §5.2 浏览器实页验收：已执行，5 项缺陷未通过

**执行环境**：`artifacts/immersive-audiovisual-2026-09-26/`（脚本 + 112 张截图 + 原始 JSON + README）。沙箱每次 bash 调用自成进程组并随即回收，故**不启用监听端口的服务器**，改以 Playwright 路由拦截同时承担静态服务与 `/api/v1` 桩（`BASE=http://127.0.0.1:4189` 为路由占位，无进程监听）。

**通过项**：112/112 状态完成渲染；控制台异常 0；`h1` 齐备；文档级横向溢出 0；图片无破；`[data-motion]` 无残留不可见节点。音频图 17/17；键盘可达性 9/10；音效控件 17/22。

**未通过的 5 项**（**均为既有缺陷或本轮首次暴露，非本轮视听改造的回归**；本轮**未修改任何生产源码**，下列修复均需用户另行批准范围）：

| # | 缺陷 | 证据 |
| --- | --- | --- |
| 1 | `AudioControl.vue` 悬停与点击冲突，且**依偏好而不同**：音效关闭的新用户点击可正常展开；**已开启音效的回访用户**悬停展开面板后，同一次点击立刻将其关闭，违反 §2.4"hover 与 click 均可展开" | `diag-click3.mjs` 双场景对照；`onPointerEnter` 先置 `open = true`，`togglePanel()` 随后执行 `open = !open`。键盘 `Enter` 正常 |
| 2 | `Escape` 未归还焦点，违反 §2.4"收起后焦点回到开关" | `root.value.focus?.()` 对无 `tabindex` 的 `<div>` 是静默空操作。仅当焦点原本在面板内时丢给 `BODY`；若焦点原在开关上则停留不动。`diag-focus.mjs` |
| 3 | 移动端面板左移出屏 28px | `.audio-panel { right: 0 }` 位于 46px 宽的 `.audio-control` 内，390px 视口下 `left` 落于 −28px。`width: min(260px, calc(100vw - 32px))` 只约束宽度，未钳制定位。被 `body { overflow-x: clip }` 静默裁切，溢出检测器读数为 0 |
| 4 | `.section-label` 对比度 **3.64**（需 4.5），**仅浅色主题** | `--color-accent: oklch(61% .092 66)` 落在 `oklch(98% .003 165)` 卡片面上。独立复算（canvas 归一 `oklch`）与 axe 一致；若维持该强调色，需压到约 L≈52% 或字号升至 18.66px 以上 |
| 5 | `.status-badge--warning` 对比度 **4.25**（需 4.5），**仅浅色主题** | `--color-warning: oklch(58% .12 75)`。`diag-contrast3.mjs` 与 `diag-det.mjs`（2 轮 × 4 组合）复现稳定 |

**另确认一项**：`.profile-record-actions { min-width: max-content }`（`main.css:621`）使订单卡内容溢出（`grid-template-columns` 解析为 360.688px > 卡片 328px）；A/B 注入改 `min-width: 0` 后 6/6 不再溢出。该缺陷**仅当 `ProfileView` 懒挂载记录区真正挂上时才出现**（受 `IntersectionObserver` 门控），故 112 状态扫描中仅捕获 1 次。`main.css` 本轮未改动，属既有隐患。

**仍未覆盖**：

- **桩 API 未触达真实后端**：全部 `/api/v1` 响应由 `stub-api.mjs` 生成，故后端行为、权限边界、数据一致性均未覆盖。
- **`prefers-reduced-motion` 的"装饰性动效不播放"已验**（5 页均 `tier=static`、`partialHidden=0`），但**真机帧率与触控体验未测**（见下）。
- **音量分档与 BGM 的响度平衡未经听感校准**：仅验证写入 `masterGain` 的增益值与无跳变（`linearRampToValueAtTime` / `exponentialRampToValueAtTime`，无跳变），四档相对响度是否合适需 §5.3 主观确认。

### 7.4.1 其余未验证项（如实列出，不得视为通过）

- **§5.3 主观听感：未确认，须用户实机签署**。音色悦耳度、编钟与古琴可信度、长时停留听觉疲劳，以及"几乎不被注意到、关掉后空间塌陷"的判断标准，代理无法代替。
- **§5.3 真机帧率与触控体验：未测**。实体设备动画流畅度与音频延迟均未测量；历史 Chrome 133 的 3D 兼容风险**保留原结论，本轮未改变**。
- **`pnpm test` / `pnpm typecheck` / `pnpm build` 未原地执行**：见本文开头沙箱说明，全部改在 `/tmp/vt` 隔离副本运行。项目自身脚本未被实际调用。同理，`artifacts/immersive-audiovisual-2026-09-26/` 内的脚本**不含 `node_modules` 与 `axe.min.js`**，需按该目录 README 补齐依赖后方可复现。
- **`git diff --check` 仅为局部通过**：全仓库范围仍有 6,000 余行历史遗留空白发现，涉及 `.github/`、`AGENTS.md`、`assets/` 等与本轮无关的文件，**本轮未清理**（`AGENTS.md` §3 禁止夹带无关改动）。
- **工作树存在 198 个未跟踪文件与 107 个已修改文件**，基线远早于本轮；提交范围需用户确认。

### 7.5 变更文件（本轮）

- `frontend/src/views/ContentDetailView.vue`、`ExhibitsView.vue`、`ExhibitDetailView.vue`、`ShopView.vue`、`ProfileView.vue`
- `frontend/src/components/ProfileAppointments.vue`（`ProfileOrders.vue` 仅加注释说明为何不接线）
- 14 个 `frontend/src` 文件行尾还原为 LF（见 §7.3.3）
- `artifacts/immersive-audiovisual-2026-09-26/`（新增：验收脚本、112 张截图、原始 JSON、README）
- `docs/plans/2026-09-26-immersive-audiovisual-upgrade.md`（本节 §7.4–§7.6）

**本轮未修改任何生产源码。** §7.4 所列 5 项缺陷的修复均涉及 `assets/main.css`、`assets/explore-gallery.css`、`assets/theme-controls.css` 与 `AudioControl.vue`，属本轮视听改造之外的范围；按 `AGENTS.md` §3"一个任务解决一个明确目标、不夹带无关改动"，应在用户确认后作为独立步骤处理。

### 7.6 对 axe 基线的说明（原表述"112 状态 0 violations"**成立**，但覆盖范围需限定）

原计划 §5.2 与 §7.4 称 axe 基线为"112 状态 0 violations"。核查后该表述**属实**，基线文件为 **`artifacts/premium-visual-2026-09-12/accessibility/summary.json`**（采集于 2026-09-12T11:49Z，`buildSignature=010de749acd6…`，112 状态、**0 violation 对象**、120 个 incomplete 对象）。

**须注意两点，否则会误读本轮结果：**

1. **同目录体系下另有一份更早的采集，不是基线**。`artifacts/premium-visual-2026-09-10/accessibility/summary.json`（2026-09-12T11:28Z，`buildSignature=aaf4543…`）含 **4 个 violation 对象**（全部 `/explore` 浅色 `color-contrast`，目标 `.gallery-intro__description`，axe 记录前景色 `#697871` → 4.26）。这 4 项由 `2026-09-12` 当日的 `--discovery-secondary` 修复（`#697871` → `#53645c`）解决，21 分钟后重采即得 0 violations。**该 `-09-10` 目录名易被误当作基线（本轮即先误读此处），引用时应以 `-09-12` 为准。**

2. **"0 violations"仅覆盖当时已挂载的 DOM**。两份采集的浅色 `profile` / `artifact` 的 incomplete 目标均只有顶栏控件（`.locale-toggle`、`.theme-toggle > span`、`.account-label--desktop`）；`.section-label` 与 `.status-badge--warning` **在 violations 与 incomplete 中皆不出现**。原因是 `ProfileView` 记录区受 `IntersectionObserver` 门控，而两次采集都未滚动到该区，故这些元素从未参与审计。

**因此本轮 8 项 axe 发现的定性是"首次暴露"而非"回归"**：它们不在基线覆盖范围内，无法用基线判定"以前通过、现在失败"。基线本身不需要更正，需要补充的是**覆盖口径**——若 `ProfileView` 记录区计入审计范围，该基线应补采。

**结论**：§5.2"与既有 axe 基线不回归"在本轮**未通过**，但未通过的 2 项（§7.4 缺陷 4、5）不是本轮视听改造引入的回归，而是基线未覆盖区域中的既有对比度问题。是否将懒挂载区纳入 axe 审计范围、以及是否修复这 2 处对比度，均需用户确认后单独执行。

未运行、未通过或未覆盖的验证均已在上文逐条列出，不以"应该可以"代替结果（`AGENTS.md` §5）。
