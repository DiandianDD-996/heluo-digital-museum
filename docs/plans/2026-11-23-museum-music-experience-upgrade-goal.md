# 河洛数字博物馆音乐系统与声景体验全栈升级 Goal 执行方案

> 日期：2026-11-23
> 状态：Track 1 + Track 2 已完成并验收；Track 3 待后续独立执行
> 关联需求：`F-01`、`F-02`、`F-03`、`F-05`、`F-12`、`F-14`、`N-03`、`N-06`、`LS-05`
> 关联规范与决策：[ADR-005-recorded-museum-music.md](../decisions/ADR-005-recorded-museum-music.md)、[ADR-010-luosheng-v2-museum-agent.md](../decisions/ADR-010-luosheng-v2-museum-agent.md)、[design.md](../../design.md)、[CREDITS.md](../../frontend/public/media/audio/music-r3/CREDITS.md)

---

## 0. Goal 总目标与三轨推进策略

本方案将音乐体验升级整合为 **3 条递进轨道（Tracks）**，每条轨道都具备独立可验证的完成态（Done Definition），可按优先级逐轨交付，也可由 `/goal` 顺序推进：

| 轨道 | 主题 | 是否改动音频素材 / ADR | 执行模式 | 预计价值 |
| --- | --- | --- | --- | --- |
| **Track 1（Phase 1–2）** | **立竿见影体验包 + 工程健壮性加固**（曲目展签与选曲、洛笙专注避让、等功率交叉淡化、iOS 中断自愈、后台暂停状态同步、Media Session、任务页降扰、清理退役代码） | **零素材改动**（完全遵循现有 ADR-005） | **全自动闭环执行** | 立刻提升可见度、顺滑度、跨端稳定度与代码洁净度 |
| **Track 2（Phase 3）** | **3D 声画通感包**（暗房首访声景轻邀请、实体/点云声场滤镜、3D 部位聚焦声像微定位、浅/深双主题听觉温度微调） | **零素材改动**（纯 Web Audio 实时声学处理） | **全自动闭环执行** | 让 3D 展厅与双主题产生博物馆装置级声画共鸣 |
| **Track 3（Phase 4–5）** | **音乐内容升级包（R4）**（CC0 东方金石玉声点缀、AAC/Opus 格式扩容评估、第 4 首玉器/彩陶专属乐章《温润·玉石》） | **涉及新编曲、新素材与 ADR 演进** | **两段式执行（含强制人类主观试听门禁）** | 打造独一无二的“河洛”地域听觉标识 |

> **关键治理红线**：Track 1 与 Track 2 不改变 R3 既有母带、文件散列与 `6,000,000 B` 资源门禁；Track 3 在生成 R4 离线试听与校验后**必须暂停并交由用户通过 `127.0.0.1:4197/?revision=r4` 实听确认**，未经用户主观认可，严禁替换生产 `/media/audio/` 资源或覆盖 `ADR-005`。

---

## 1. Track 1：立竿见影体验包 + 工程健壮性加固（Phase 1–2）

### Phase 1：底层播放引擎、跨端稳定性与代码卫生

#### 目标
补齐现有 Web Audio 引擎在交叉淡化质感、iOS 兼容性、切页状态一致性、系统媒体浮窗及任务页干扰控制上的最后几块短板，并清理已退役的随机音乐生成器死代码。

#### 详细任务
1. **等功率交叉淡化（Equal-Power Crossfade）** — [musicPlayback.ts](../../frontend/src/lib/musicPlayback.ts)
   - 将 `ramp()` 的线性淡入淡出升级为基于 `setValueCurveAtTime` 的等功率曲线（淡出用 $\cos(\frac{\pi}{2}t)$、淡入用 $\sin(\frac{\pi}{2}t)$，支持环境无 `setValueCurveAtTime` 时平滑回退到 `linearRampToValueAtTime`）；
   - 消除跨路由换曲中点处的 `-3 dB` 响度凹陷，同时保持 `CROSSFADE_SECONDS = 1.8` 与 `FADE_IN_SECONDS = 1.4` 节奏稳定。
2. **iOS Safari 中断恢复与音频上下文自愈** — [audioSystem.ts](../../frontend/src/lib/audioSystem.ts)
   - `ensureContext()` 在检测 `context.state === 'suspended'` 的同时兼容 Safari 特有的 `'interrupted'` 状态；
   - 监听 `context.addEventListener('statechange', ...)`，在锁屏/来电恢复后若用户仍保持开启偏好，自动安全重建或触发重arm。
3. **后台暂停状态显式同步** — [musicDirector.ts](../../frontend/src/lib/musicDirector.ts)、[stores/audio.ts](../../frontend/src/stores/audio.ts)、[AudioControl.vue](../../frontend/src/components/AudioControl.vue)
   - 在 `musicDirector` 中暴露轻量状态订阅接口 `subscribe(listener)`，广播 `{ activeTrack, isPausedByVisibility, isPlaying, manualTrack }`；
   - 切回标签页且处于等待手势恢复状态时，`useAudio()` 准确呈现 `isPaused` 状态，避免顶栏图标显示“正在播放”而实际无声的认知错位；同时支持在非严格拦截环境下尝试柔和恢复，被浏览器拒绝时优雅落回待手势状态。
4. **接入浏览器 Media Session API** — 新增 `frontend/src/lib/mediaSession.ts`
   - 当背景音乐真正进入播放态时，写入 `navigator.mediaSession.metadata`：
     - 标题：中英双语当前乐章名（《入馆·河洛晨光》/《水岸·静读》/《观器·温金》）；
     - 艺术家 / 专辑：`河洛数字博物馆 · 展馆原声 R3`；
     - 封面图：按曲目分别绑定对应高清展品图（首页青铜鼎、水鸟铜器、暗房青铜鼎）。
   - 绑定 `play` / `pause` / `stop` action handler，支持手机锁屏、系统媒体浮窗与蓝牙耳机线控操作；在不支持该 API 的环境中无害降级。
5. **区分“策展沉浸页”与“表单任务页”的存在感** — [audioScenes.ts](../../frontend/src/lib/audioScenes.ts)
   - 将 `login`、`reset-password` 由 `account (reading 0.64)` 收敛为 `quiet`，减少输入账号密码时的打扰；
   - 将 `appointment` 音量从 `0.72` 微调至 `0.48`（保留轻微陪伴感但不干扰填表核对手机号/邮箱），同步更新 `audioScenes.spec.ts`。
6. **清理已退役的随机生成器死代码**
   - 核实 `frontend/src/lib/musicGenerator.ts`（32.7 KB）、`musicGenerator.spec.ts`、`warmSoundscape.spec.ts` 在生产代码中确为零引用后安全移除（或按团队习惯归档），减少 60+ KB 维护噪音；同步检查 `audioSystem.ts` 中闲置 `ambience` 路径，若无计划复用则标注清晰边界并确保现有测试全绿。

#### Phase 1 验收标准
- `musicPlayback.spec.ts` 新增等功率曲线采样断言与回退断言；
- `audioBus.spec.ts` / `musicDirector.spec.ts` 覆盖 `interrupted` 状态恢复、后台暂停状态广播与 Media Session 同步；
- `npm run typecheck && npm run test && npm run build` 全绿，首屏 JS gzip 不得突破 `81,638 B`。

---

### Phase 2：策展级曲目展签、手动选曲与洛笙 AI 专注避让

#### 目标
让访客真正“看得见、选得了、读得懂”三首原创乐章，并打通背景音乐与 **洛笙 AI 向导 v2** 之间的声学礼让。

#### 详细任务
1. **曲目元数据单一事实源** — 新增 `frontend/src/lib/musicCatalog.ts`（按需或极轻量定义）
   - 维护三首 R3 乐章的中英双语标题、副题/适配场景、配器构成说明（诚实标注“现代室内乐采样编排 · VSCO 2 CE CC0 1.0”）、时长与对应封面路径。
2. **升级 [AudioControl.vue](../../frontend/src/components/AudioControl.vue) 面板（保持极简克制）**
   - 顶栏仍保持**唯一图标入口**（绝不破坏导航栏留白）；
   - 展开面板内新增三项克制增强：
     1. **当前曲目展签**：`正在聆听 ·《观器·温金》`（若后台暂停则显示 `已暂停 · 点击继续`）；
     2. **展厅自动 / 手动选曲**：在“随展厅自动切换”外，提供 3 枚极简文字胶囊一键点播《入馆·河洛晨光》《水岸·静读》《观器·温金》（手动选曲锁定后不随路由强制打断，点回“自动”即恢复跨路由映射）；
     3. **可折叠「声音手记」(`<details>`)**：简明展示 CC0 1.0 音源署名（Sam Gossner / Simon Dalzell / Elan Hickler）与诚实声明，不额外增加路由或弹窗负担。
   - 样式全部走 [04-components.css](../../frontend/src/styles/04-components.css) 语义令牌，确保 `>= 12px` 字号红线、WCAG AA 对比度与 `>= 44px` 触控热区，完整支持中英双语（[stores/locale.ts](../../frontend/src/stores/locale.ts)）。
3. **洛笙 AI 向导 v2 专注避让（Smart Ducking）** — [audioSystem.ts](../../frontend/src/lib/audioSystem.ts)、[LuoshengSiteGuide.vue](../../frontend/src/components/LuoshengSiteGuide.vue)
   - 在 `audioSystem.ts` 新增持续态避让 API：`setFocusDuck(sourceId: string, active: boolean, depth?: number)`（支持多来源引用计数，避免与 `playNarrative` 的 900ms 瞬态 duck 互相踩踏！采用 `min(narrativeDuck, focusDuck)` 或独立叠加增益）；
   - 在 `LuoshengSiteGuide.vue` 中监听 `store.open` 与 `streaming`：
     - 抽屉展开阅读/输入时：`depth = 0.72`（柔和压低约 `-2.8 dB`，attack `0.35s`）；
     - 正在流式输出回答时：`depth = 0.62`（略微再沉静一点，约 `-4 dB`）；
     - 抽屉收起或组件卸载时：`setFocusDuck('luosheng', false)`，以 `1.6s` 缓缓回升至原音量。
   - 严守 `ADR-010` 隔离红线：当 `VITE_GUIDE_ENABLED=false` 时，洛笙组件不渲染，音频系统不受任何影响。

#### Phase 2 验收标准
- `AudioControl.spec.ts` 覆盖曲目展签显示、手动切曲与切回自动模式、声音手记折叠展开、键盘 `Escape` 焦点回收；
- 新增洛笙避让单测，验证“展开压低 → 流式更深 → 收起回升 → 卸载不残留卡死压低”；
- Playwright 在 1440 / 390 双主题实测 `AudioControl` 面板不溢出视口、`luosheng-isolation.mjs` 仍 100% 通过。

---

## 2. Track 2：3D 声画通感包（Phase 3）

### 目标
不增加任何新音频文件，仅通过 Web Audio 实时滤波、空间声像（Pan）与轻量 UI 提示，把 3D 暗房展厅和浅/深双主题升级为“声、光、器一体”的沉浸空间。

### 详细任务
1. **3D 暗房首访“声景轻邀请”** — [ExhibitDetailView.vue](../../frontend/src/views/ExhibitDetailView.vue)
   - 触发条件：`!audio.enabled` && `localStorage` 未记录已忽略 (`museum-audio-darkroom-invite-dismissed`) && 当前展项进入 3D 暗房；
   - 呈现形态：在暗房顶部或底坞上方克制浮现一枚可关闭的细长展签胶囊（中：`开启暗房声景 ·《观器·温金》` / 英：`Enable darkroom soundscape · Warm Bronze`），支持一键「开启」与 `×` 忽略；
   - 交互闭环：点「开启」即刻作为合法用户手势调用 `audio.enable()` 并自动淡出消失；点 `×` 永久静默；绝不遮挡 3D 模型、`.exhibit-dock` 或移动端控制按钮。
2. **零开销声学色调滤镜链路（实体 ↔ 点云 & 昼 ↔ 夜双主题）** — [audioSystem.ts](../../frontend/src/lib/audioSystem.ts)、[App.vue](../../frontend/src/App.vue)、[ExhibitDetailView.vue](../../frontend/src/views/ExhibitDetailView.vue)
   - 在 `musicBus → toneFilter (BiquadFilterNode) → duckGain` 之间插入单级轻量声学滤镜（默认 `allpass` 或 `gain = 0 dB`，完全零染音）：
     - **昼/夜双主题微调**：浅色「缃色古宣」为 `0 dB` 全通透明；深色「曜石暗房」应用极轻柔的 `highshelf`（`frequency = 7500 Hz`, `gain = -1.2 dB`, `0.8s` 平滑过渡），营造更温润的夜间厅堂感；
     - **3D 点云模式联动**：在 `ExhibitDetailView` 切换到点云模式（`displayMode === 'pointcloud'`）时，平滑启用轻微的高通/空气感微调（例如 `highpass` 切点柔和抬至 `140 Hz` 或 `lowshelf 220 Hz -3.5 dB`，`0.6s` 过渡），让声音随点云视图同步“轻盈、透明化”；切回实体模型或离开 3D 展厅页时立刻 `0.6s` 还原全频。
   - **安全红线**：`onBeforeUnmount` 必须重置 3D 滤镜状态，严禁离开 3D 页面后残留点云滤波。
3. **3D 部位聚焦的立体声像微锚点** — [ThreeExhibitViewer.vue](../../frontend/src/components/ThreeExhibitViewer.vue)、[ExhibitDetailView.vue](../../frontend/src/views/ExhibitDetailView.vue)
   - 当用户通过按钮或洛笙 `focusPart('ear' | 'feet' | 'motif')` 聚焦青铜鼎局部时，按器物物理特征触发极轻的差异化金石声效（仅在 `isSfxOn` 且用户已开声时生效）：
     - `ear`（双立耳）：偏清亮高泛音（`awaken-bronze`, `rate: 1.14`, `volume: 0.16`, `pan: -0.22`）；
     - `motif`（兽面纹）：中频饱满主体（`awaken-bronze`, `rate: 1.0`, `volume: 0.18`, `pan: 0`）；
     - `feet`（三柱足）：低沉浑厚根基（`awaken-bronze`, `rate: 0.84`, `volume: 0.18`, `pan: 0.22`）。
   - 与防疲劳节流兼容（连续快速点选不叠音、不刺耳）。

### Phase 3 验收标准
- 单测验证：滤镜模式切换、离开 3D 页自动复位、`focusPart` 声像与音高参数传递、暗房轻邀请的开启与永久关闭持久化；
- `audioBus.spec.ts` 确认总线拓扑与增益电平无意外偏移；
- Playwright 实景检查 3D 展厅（实体/点云切换、浅/深主题、1440/390 布局）零遮挡、零控制台错误。

---

## 3. Track 3：音乐内容升级包 R4（Phase 4–5，含人工试听门禁）

> ⚠️ **严格边界声明**：本轨道产出新编曲与新音频资源。依据 `AGENTS.md` 与 `ADR-005` 纪律，**技术指标（响度/峰值/无削波）不能代替人类主观耐听度判断**。执行到 Phase 4 末尾必须停下，等待用户在本地试听台实际听音并明确确认后，方可进入 Phase 5 生产接入。

### Phase 4：东方金石玉声 CC0 音源审计、格式评估与 R4 离线试听制作

#### 目标
保留 R1/R2/R3 全部原始母带与脚本不动，搭建独立可复现的 **R4 创作与试听管线**，解决两个核心体验升级：
1. **注入河洛文化辨识度**：在现有室内乐框架上融入克制的 CC0 东方金石玉声点缀；
2. **拓展第 4 首乐章《温润·玉石》**：专门服务于玉璧、玉猪龙、彩陶与河图石相关展品页面。

#### 详细任务
1. **东方点缀音源搜集与法务/声学入库审计**
   - 仅采用明确 **CC0 1.0 / Public Domain**（或项目方自录并声明许可）的真实器乐单音采样（例如公开可验证的 CC0 玉磬/钵磬、古琴泛音/散音、弱吹箫/竹笛气声、编钟弱击）；
   - 严守 [scripts/music-audition/README.md](../../scripts/music-audition/README.md) 溯源规范：逐文件记录固定源 URL/提交哈希、SHA-256、实测 MIDI 原音高、许可全文，绝不凭文件名猜八度、绝不混入 CC-BY-NC 或来源不明商业采样；
   - 保持诚实文案原则：明确表述为“现代室内乐与东方金石采样的当代编排”，不宣称古代礼乐复原。
2. **R4 编曲与离线渲染** — 新增 `scripts/music-audition/compose-r4.py`（扩展 `render.py --revision r4`、`check-r4.py`）
   - 保留 `r1` / `r2` / `r3` 现有全部谱稿与 WAV 散列完全不变；
   - **三首既有乐章的 R4 精修**（克制点睛，每 12–16 秒最多 1–2 处东方音色呼吸点，绝不堆砌喧宾夺主）：
     - 《入馆·河洛晨光 R4》：在段落开合处融入极轻玉磬泛音与弱吹竹韵引子；
     - 《水岸·静读 R4》：在长句换气间隙缀入古琴稀疏泛音，强化水岸留白感；
     - 《观器·温金 R4》：在青铜主旋律回归前以极柔和的低音编钟余韵承接，建立庄重而不压迫的礼器厚重感。
   - **新增第 4 首专属乐章《温润·玉石（jade-r4）》**（时长 `95–115s`，完整引子/A/B/A'/尾奏结构，目标场景响度约 `-27.5 LUFS`）：
     - 配器方向：近场竖琴 + 稀疏高音钢琴泛音 + 极轻中提琴长音 + 玉磬清音点缀，清透、温润、高呼吸感，适配玉璧/玉猪龙/河图石/彩陶等器物详情页。
3. **网页音频编码与 6 MB 预算扩容实验** — 新增 `scripts/music-audition/export-web-r4.py`
   - 实测对比两种分发编码方案（4 首合计总时长约 ~440 秒）：
     - **方案 A（首选推荐：AAC `.m4a` 96 kbps, 44.1 kHz stereo）**：Chrome / Edge / Firefox / Safari / iOS / Android **100% 全平台原生支持**，4 首总大小约 `5.1–5.3 MB`（稳居既有 `6,000,000 B` 门禁内，单套文件无需双格式兜底！），实测编码延迟与无缝循环接缝；
     - **方案 B（备选：Opus `.webm` 80 kbps 主轨 + MP3 96 kbps 降级）**：样本级原生无缝循环最强，但需维护双格式资产或重新评估预算口径。
   - 生成完整的 `quality-check-r4.json` 报告（BS.1770 响度、4× 过采样真峰值 `< -3 dBTP`、0 削波、400ms 首尾边界电平连续性、所有源文件与产物 SHA-256）。
4. **启动本地试听台与自动化检查（🛑 强制人工确认暂停点）**
   - 更新 `listening.html` 支持 R1/R2/R3/R4 四版对比与第 4 首《温润·玉石》试听；
   - 运行 `python -B -X utf8 scripts/music-audition/preview-server.py` 与 `node scripts/music-audition/check-preview.mjs --r4`；
   - **🛑 暂停并汇报用户**：交付 `http://127.0.0.1:4197/?revision=r4` 试听地址、技术核验报告与四版差异摘要，**等待用户亲自佩戴耳机试听并明确批复“采纳 R4”后，才允许执行 Phase 5**。

---

### Phase 5：R4 生产接入、门禁升级与 ADR 归档（仅在用户认可试听后执行）

1. **生产资源部署**：在 `frontend/public/media/audio/music-r4/`（或按 ADR 决定替换）放入经校验的 4 首网页音频、`manifest.json`、`CREDITS.md` 及全部 CC0 许可全文。
2. **门禁与路由映射更新**：
   - 更新 [music-assets-budget.mjs](../../frontend/scripts/music-assets-budget.mjs) 校验 4 首乐章散列、无缝循环参数、全部许可文件及 `<= 6,000,000 B` 体积红线；
   - 更新 [audioScenes.ts](../../frontend/src/lib/audioScenes.ts) 与 `musicCatalog.ts`，为玉器/彩陶/河图石相关展品 slug 映射 `jade` 乐章（仅映射实际试听确认的展品，严禁盲目猜测）；
   - 扩展 `AudioControl.vue` 频道列表至 4 首，并同步 `mediaSession.ts` 与中英双语文案。
3. **架构决策文档（ADR）更新**：
   - 新增 `docs/decisions/ADR-011-music-r4-eastern-accents-and-aac-delivery.md`（或修订 `ADR-005`），记录东方金石采样许可边界、编码格式选型与 4 乐章映射规则。
4. **全量闭环验收**：
   - 前端：`npm run typecheck`、`npm run test`、`npm run build`（含 `bundle-budget.mjs` 与 `music-assets-budget.mjs`）；
   - 浏览器端复跑 `frontend/scripts/music-r3-browser-check.mjs`（升级为 R4 检查脚本）：覆盖默认静音、4 曲切换、同曲续播、原生无缝循环、等功率淡化、失败降级与 Media Session；
   - 更新 `PROJECT_STATUS.md` 与 `docs/01-requirements-traceability.md`，展示 `git diff` 并等待用户确认后提交。

---

## 4. 全方案影响文件总览

| 轨道 | 核心修改/新增文件 |
| --- | --- |
| **Track 1** | `frontend/src/lib/musicPlayback.ts`、`audioSystem.ts`、`musicDirector.ts`、`audioScenes.ts`、`mediaSession.ts`（新）、`musicCatalog.ts`（新）、`frontend/src/stores/audio.ts`、`locale.ts`、`frontend/src/components/AudioControl.vue`、`LuoshengSiteGuide.vue`、`frontend/src/styles/04-components.css`、清理 `musicGenerator.ts` 及相关测试 |
| **Track 2** | `frontend/src/lib/audioSystem.ts`、`frontend/src/App.vue`、`frontend/src/views/ExhibitDetailView.vue`、`frontend/src/components/ThreeExhibitViewer.vue`、对应单测与 Playwright 脚本 |
| **Track 3** | `scripts/music-audition/compose-r4.py`（新）、`export-web-r4.py`（新）、`check-r4.py`（新）、`render.py`、`listening.html`；确认后接入 `frontend/public/media/audio/music-r4/*`、`frontend/scripts/music-assets-budget.mjs`、`docs/decisions/ADR-011-*.md` |

---

## 5. 跨轨道关键风险与防线

1. **首屏 JS 预算风险（最高优先级红线）**：
   - 入口 chunk 当前余量仅约 `4.4 KB` gzip。Track 1/2 中 `AudioControl.vue` 和 `audioSystem.ts` 都在入口链路，新增代码（曲目元数据、Media Session、focus duck、toneFilter、等功率曲线）总增量必须严控在 **`<= 2.2 KB` gzip** 内；声音手记长文案或扩展交互应保持精简，必要时将非首屏工具模块按需懒加载。
2. **多个 Ducking 来源互相覆盖**：
   - `playNarrative()`（900ms 定时器）与 `LuoshengSiteGuide`（持续打开态）若直接写同一个 `duckGain` 节点会产生竞态（例如点一次提示音 900ms 后把洛笙的避让提前弹回 `1.0`）。
   - **解法**：在 `audioSystem.ts` 内维护 `narrativeDuckFactor` 与 `focusDuckSources: Map<string, number>`，统一由 `recomputeDuckGain()` 计算目标值 `Math.min(narrativeDuckFactor, ...focusDuckSources.values())` 并平滑 ramp。
3. **Safari / WebKit `AudioContext` 与 `BiquadFilterNode` 兼容性**：
   - 切勿在每次切换主题或点云模式时反复 `disconnect/connect` 节点（容易爆音）；始终保持单个 `toneFilter` 常驻串联，仅通过 `setTargetAtTime` / `linearRampToValueAtTime` 平滑调整参数。
4. **R4 音源版权与试听主观偏差**：
   - Track 3 绝不“自说自话”上线新音乐；任何外部采样必须有可复现的固定哈希与 CC0/PD 许可，且必须经用户本人实听拍板后才能进入生产目录。

---

## 6. 推荐的 `/goal` 启动策略

为了兼顾交付节奏与可控性，推荐分两次或三次独立 `/goal` 会话执行：

1. **第一轮 `/goal`（纯前端声画体验大跃升，无需等待人工试听）**：
   - 串联执行 **「Track 1 + Track 2 + 声律可视化方案（`2026-11-23-acoustic-ruler-visualizer-goal.md`）」**；
   - 一次交付完成后，前端音乐感知、3D 声画联动、洛笙礼让、首页与暗房十二律吕刻度全部上线并全绿验收。
2. **第二轮 `/goal`（R4 音乐内容创作与试听打样）**：
   - 执行 **Track 3 的 Phase 4**，在本地试听台交付 R4 东方点缀版与第 4 首《温润·玉石》供你亲自试听打分；
   - 认可后再执行 **Phase 5** 完成生产接入与 ADR 归档。

---

## 7. 验证结果记录（执行完成后填写）

- [x] Track 1（Phase 1–2）单测 + 类型检查 + 预算门禁 + Playwright：已通过（`vue-tsc -b` 0 错误、`vitest run` 77 文件 / 432 用例全绿；`vite build` 首屏 JS gzip `79,614 / 81,638 B`、CSS gzip `12,889 / 80,000 B`、WOFF2 `0`、`music-assets-budget.mjs` `5,001,307 / 6,000,000 B`；Playwright `acoustic-upgrade-verify.mjs` 与 `luosheng-isolation.mjs` 390 深 / 1440 浅全绿，零报错；注：旧版 `music-r3-browser-check.mjs` 因仓库已切换至 R4 `.m4a` 资源路径故跳过）
- [x] Track 2（Phase 3）3D 声画通感单测 + 暗房实景验收：已通过（`ExhibitDetailView.spec.ts` 覆盖点云低频声场滤镜切换与卸载复位、`part-focus` 立体声像微音效及暗房声景轻邀请持久化；Playwright 1440/390 双主题实景验收零遮挡、零溢出）
- [x] Track 3（Phase 4）R4 离线质量核验 + 本地试听台用户主观确认：已通过（31 个 CC0 1.0 VCSL 样本审计、8 份 R4 WAV 渲染与 `check-r4.py`/`check-r3.py` 全绿、AAC `.m4a` 96 kbps 4 首合计 `5,001,307 B <= 6,000,000 B`、Playwright `check-preview.mjs --r4` `43/43` 通过；用户已在 `http://127.0.0.1:4197/?revision=r4` 试听确认“采纳 R4 / 进入 Phase 5”）
- [x] Track 3（Phase 5）生产资源门禁 + ADR 归档 + 全量回归：已通过（部署 `/media/audio/music-r4/` 4 首 AAC `.m4a` + 双 CC0 许可；新增 [ADR-011](../decisions/ADR-011-music-r4-eastern-accents-and-aac-delivery.md)；`vue-tsc -b` 0 错、`vitest run` `77` 文件 / `432/432` 全绿、`vite build` + `bundle-budget` 首屏 JS `79,572 B / 81,638 B` + `music-assets-budget` `5,001,307 / 6,000,000 B` 全绿；Playwright `music-r4-browser-check.mjs` `21/21` 项通过且 `0` 报错）
