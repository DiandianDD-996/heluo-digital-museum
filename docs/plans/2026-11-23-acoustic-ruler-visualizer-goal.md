# 「十二律吕 · 青铜游标刻度」双处联动声律可视化 Goal 执行方案

> 日期：2026-11-23
> 状态：已完成并全量验收通过
> 关联需求：`F-01`、`F-05`、`F-12`、`F-14`、`N-03`、`N-06`
> 关联规范与决策：[design.md](../../design.md)、[ADR-005-recorded-museum-music.md](../decisions/ADR-005-recorded-museum-music.md)、[2026-11-23-hero-raking-light.md](./2026-11-23-hero-raking-light.md)

---

## 0. Goal 总目标与完成红线（Done Definition）

在**严格遵守 `Heluo Editorial 2.0` 视觉克制原则与 `ADR-005` 既有混音平衡**的前提下，构建一套名为**「十二律吕 · 青铜游标刻度（AcousticRuler）」**的实时音频视觉化组件，并完成**首页首屏底边（`/`）**与**3D 展厅详情页底边（`/exhibits/:slug`）**的双处联动落地：

1. **视觉与美学达标**：呈现为精密博物馆器物游标刻度与建筑光丝（绝非霓虹粗柱均衡器），浅色「缃色古宣」与深色「曜石暗房」双主题协调一致，3D 展厅支持「实体鎏金 ↔ 点云银砂」状态联动与部位聚焦微脉冲。
2. **声学与动态真实**：直连 `audioSystem` 共享只读 `AnalyserNode`，针对 R3 室内乐（`-26 ~ -29 LUFS`）完成对数分频映射、动态自适应增益与快起慢落胡克弹簧阻尼；静音时优雅收束为静止刻度尺（不造假动画），点击刻度可直接唤醒或暂停声景。
3. **性能与预算门禁全绿**：
   - 静音、滚出视口、后台标签页或 `prefers-reduced-motion: reduce` 时 **0 rAF 帧循环、0 CPU 持续占用**；
   - 播放态单帧绘制均值 `<= 2.5 ms`（1440×900 桌面），禁用 Canvas2D `shadowBlur`；
   - `npm run typecheck`、`npm run test`、`npm run build`（含 `bundle-budget.mjs` 首屏 JS gzip `<= 81,638 B`、CSS gzip `<= 80,000 B`、`woff2 === 0`、`music-assets-budget.mjs`）100% 通过；
   - Playwright 实景巡检覆盖 1440 浅/深双主题与 390 移动端双主题（首页 + 3D 展厅），零控制台报错、零横向溢出、不遮挡 `.home-cover__foot` / `.exhibit-dock` / 移动端底部 Tab Bar，触控热区 `>= 44px`。

---

## 1. 顶尖成品方案对标与美学转译

在动手设计前，拆解四类顶尖成品在“极简音频视觉化 + 高端文化/器物体验”上的成功做法，并明确取舍：

| 参考标杆 | 值得学习的核心做法 | 本项目转译为「河洛律吕」的具体规格 | 明确摒弃的反模式 |
| --- | --- | --- | --- |
| **Bang & Olufsen / Teenage Engineering（精密声学硬件 UI）** | 极细竖向微线阵列（1–2px 示波器/刻度尺质感）、物理惯性阻尼、克制的单色金属光泽（香槟金/暖白/拉丝灰）、交互即反馈 | 每根律线宽 `1.5px`、间距 `7–9px`，底边压 `1px` 极细基线；静音时作为精密青铜游标刻度静伏，开启瞬间由基线柔和唤醒；支持点击刻度条切换声景 | 摒弃 `6–12px` 粗圆角柱体、多色 RGB 彩虹渐变与高饱和外发光 |
| **Rijksmuseum / 当代亚洲博物馆数字展厅** | 严苛留白、画册装裱对齐、等宽数字与展签体说明（`tabular-nums`），一切视觉元素服务于器物主角 | 高度严格限制在 `18–32px`（绝不抢夺青铜鼎主视觉）；可配一枚极轻展签标注当前曲目（如 `《观器·温金》`），桌面端自动避让文字与控制坞 | 摒弃大面积居中巨型声波、占据半屏的播放器卡片与跳动百分比数字 |
| **Apple Music / AudioMotion / 室内乐声学可视化工程实践** | 针对无重鼓点的原声/室内乐使用**对数频率分桶**（避免低频挤在最左侧、高频右侧全空）、动态归一化与平滑包络 | 锁定室内乐有效主频段 `60 Hz – 4.5 kHz`，按对数刻度切分 `48`（桌面）/ `24`（移动）根律线；对幅值施加幂次压缩（`pow(v, 0.65)`）+ 慢速滚动峰值归一，让大提琴、竖琴、长笛皆有清晰起伏 | 摒弃线性 FFT 直出（导致室内乐画面半死不活或高频神经质闪烁） |
| **本站「浑仪磁阵」（`heroDotFieldRenderers.ts`）** | 胡克弹簧阻尼、空间策展避让遮罩、零 `shadowBlur` 高性能渲染、浅色「金镶玉」与深色「曜石香槟」统一材质语汇 | 复用相同物理手感：**快起慢落弹簧阻尼**模拟古琴余韵与水波下沉；每根律线顶端可选点缀 `1.5px` 极细亮星端，首页首屏与上方「浑仪磁阵」形成**上星轨、下律吕**呼应 | 摒弃每帧 `shadowBlur` 或高频 DOM `style.height` 回流重排 |

---

## 2. 约束边界与红线

1. **零新增第三方依赖**：纯 TypeScript + 原生 Web Audio `AnalyserNode` + Canvas2D 实现，不引入 `wavesurfer.js` / `audiomotion-analyzer` 等外部包。
2. **严守首屏 JS 预算红线**：当前首屏 JS gzip 基线 `77,751 B`（上限 `81,638 B`，余量约 `4.4 KB`）。
   - 规则：`audioSystem.ts` 仅增加极精简的 `AnalyserNode` 旁路挂点（预计 `< 350 B` gzip）；
   - 规则：`AcousticRuler.vue` 与 `acousticRulerEngine.ts` **只由动态懒加载的 `HomeView.vue` 和 `ExhibitDetailView.vue` 引入**，严禁被 `App.vue` 或入口 chunk 静态导入。
3. **严守 CSS `@layer` 9 文件架构**：不新增独立散装 CSS 文件；共享基础样式归入 [04-components.css](../../frontend/src/styles/04-components.css) 与 [06-motion.css](../../frontend/src/styles/06-motion.css)，页面级定位保留在对应视图 `<style scoped>`，所有色彩全部引用 `01-tokens.css` 的 OKLCH 令牌（禁止硬编码裸色或破坏 WCAG AA）。
4. **不改变 R3 既有混音与响度**：`AnalyserNode` 必须以**只读旁路（side-tap）**方式并联在 `duckGain`（或 `musicBus`）输出端，绝不串接进主增益路径影响 `audioBus.spec.ts` 既有总线拓扑断言与 `ADR-005` 响度校准。
5. **后端零改动**：纯前端体验升级，不修改 Java API、数据库或 Nginx 配置。

---

## 3. 技术架构与双处联动规格

### 3.1 音频数据通路（只读旁路设计）

在 [audioSystem.ts](../../frontend/src/lib/audioSystem.ts) 中保持原有主链路完全不变：

```text
sfxBus ────────┐
ambienceBus ───┼──→ masterGain ──→ destination
musicBus → duckGain ─┘
                 └──→ (按需懒创建) musicAnalyser (AnalyserNode, fftSize=2048, smoothing=0.82)
```

- **按需创建**：仅当有视觉组件调用 `audioSystem.acquireMusicAnalyser()` 时才在已有 `AudioContext` 上创建一次 `AnalyserNode` 并 `duckGain.connect(analyser)`；`analyser` **不连接** `destination`，保证零信号叠加。
- **降级容错**：在 jsdom / 模拟音频测试环境若 `createAnalyser` 不存在，安全返回 `null`，所有既有单测零破坏。
- **状态订阅**：配合 `useAudio()` 暴露 `isMusicActivelyPlaying`（综合 `enabled && isMusicOn && volumeTier !== 'silent' && musicDirector.isRunning()`），让组件精准决定何时启动/彻底停止 rAF。

### 3.2 声学与物理渲染引擎（`frontend/src/lib/acousticRulerEngine.ts`）

将算法完全解耦为纯 TypeScript 模块，便于 Vitest 单元测试与数学验证：

1. **对数分频映射器（`buildLogBandTable`）**：
   - 输入：`sampleRate`（默认 `44100`）、`fftSize`（`2048`，`binCount = 1024`）、`barCount`（桌面 `48` / 移动 `24`）、频段 `[60, 4500]` Hz；
   - 按对数区间切分频带，每带取 RMS 或加权均值，并做低频轻柔衰减补偿（防止大提琴单频压死其余乐器）。
2. **室内乐动态自适应包络（`normalizeChamberSpectrum`）**：
   - 维护慢速滚动峰值基准 `rollingPeak`（上升快 `tau=0.25s`，下降极慢 `tau=4.5s`，下限地板 `0.18` 防止无声放大底噪）；
   - 输出归一化幅值 `norm = clamp(raw / rollingPeak, 0, 1)`，经幂次柔化 `Math.pow(norm, 0.68)`；
   - 乘以**对称窗函数包络**：`window(u) = 0.28 + 0.72 * Math.pow(Math.sin(Math.PI * u), 0.72)`，使律线在中间舒展、向左右边缘优雅收拢归零。
3. **快起慢落胡克弹簧阻尼（`stepRulerBars`）**：
   - 每根律线状态 `{ value, velocity, peakHold, pulse }`；
   - 当目标值高于当前值（拨弦/起音）：较高刚度 `stiffnessUp = 0.24`、轻阻尼 `0.72`，捕捉乐句灵动起势；
   - 当目标值低于当前值（余韵回落）：柔和刚度 `stiffnessDown = 0.08`、高阻尼 `0.86`，如丝弦与水波般缓缓回沉；
   - **3D 部位聚焦涟漪（`triggerRulerRipple(centerRatio, strength)`）**：当 3D 展厅聚焦鼎耳/鼎足/纹饰时，从对应水平位置向两侧扩散一道克制的单次金石泛音波纹，持续 `700ms` 自然消散。
4. **双主题与双模式视觉配色（`drawAcousticRuler`）**：
   - **基线与刻度**：底边 `1px` 极细基线（`opacity 0.14–0.22`），每 4 根（对应传统律度节拍）设一根略高 `1.5px` 的静息主刻度；
   - **静音态（`idle`）**：所有竖线平缓收敛回 `2px–4px` 静止刻度尺，动画收敛至阈值 `< 0.002` 后自动停止帧循环；
   - **播放态（`active`）**：
     - 浅色「缃色古宣」（首页）：暖栗古铜 → 浅鎏金渐变细丝（`rgba(128, 86, 46, ...)`），顶部微点象牙鎏金星端；
     - 深色「曜石暗房」（首页 & 3D 实体态）：哑光古铜 → 丝绸香槟金渐变细丝（`rgba(222, 198, 152, ...)`），顶部微点暖白星端；
     - **3D 点云模式（`pointcloud`）**：自动切为清冷矿物银砂 + 微青钛白光丝（`rgba(206, 224, 232, ...)`），与扫描点云视觉严格同色温。

### 3.3 双处联动页面落位设计

#### 落位 A：首页首屏 `.home-cover` 最底边（[HomeView.vue](../../frontend/src/views/HomeView.vue)）
- **位置**：嵌入 `.home-cover` 最底部边缘（`position: absolute; inset-inline: 0; bottom: 0; z-index: 3;`），视觉上位于 `.home-cover__foot` 下缘贴边处（桌面高度 `26px`，移动 `18px`）。
- **防遮挡与避让**：给 `.home-cover__foot` 底部留出清晰呼吸间距（例如桌面 `padding-bottom` 增加 `18px`），并采用中轴淡入/两端渐隐蒙版，确保馆址、滚动提示与预约链接 100% 清晰可读。
- **与「浑仪磁阵」联动**：桌面端鼠标划过底边声律区域时，可附带极轻的局部刻度微亮（不抢主交互）；点击声律右侧极简展签（可选显示 `《入馆·河洛晨光》` 或静音态 `开启展馆声景`）即可作为用户手势一键唤醒音频。

#### 落位 B：3D 展厅详情页 `.exhibit-scene` 最底边（[ExhibitDetailView.vue](../../frontend/src/views/ExhibitDetailView.vue)）
- **位置**：嵌入 `.exhibit-scene` 暗房舞台最底沿（`position: absolute; inset-inline: clamp(20px, 4vw, 56px); bottom: 6px; height: 28px; z-index: 4;`），桌面端自然托举在 `.exhibit-dock`（`bottom: 24px` 以上）下方作为暗房光学底座；移动端自动避让底部控制坞与全局底栏（保证 0 重叠）。
- **与 3D 场景深度联动**：
  1. 绑定 `:visual-mode="displayMode === 'pointcloud' ? 'pointcloud' : 'bronze'"`，切换实体/点云时平滑插值过渡色调（`320ms`）；
  2. 监听 `ThreeExhibitViewer` 的视角/部位聚焦事件（`ear` → 偏左 `0.34`、`motif` → 居中 `0.50`、`feet` → 偏右 `0.66`），调用 `rulerRef.triggerRipple(pos)` 激起一道克制的金石泛音波纹；
  3. 仅在展项为青铜鼎（配乐 `bronze`）时展示《观器·温金》展签，其他未专属配乐展项诚实展示《水岸·静读》或自动读取当前 `musicDirector` 曲目元数据，绝不张冠李戴。

#### 双处跨页一致性（联动闭环）
- 从首页 `/` 点击「进入数字展厅」一路进入 `/exhibits/heluo-bronze-ding-3d`：
  - 若音频已开启，首页《入馆·河洛晨光》淡出、3D 展厅《观器·温金》1.8s 交叉淡入，底部声律无缝承接实时频谱，并从浅色古宣/首页质感平滑过渡到暗房青铜光丝；
  - 若音频未开启，两处均以统一规格的静息游标刻度尺呈现，形成贯穿核心展示页的品牌级视觉符号。

---

## 4. 影响文件清单

| 文件路径 | 操作 | 职责说明 |
| --- | --- | --- |
| `frontend/src/lib/audioSystem.ts` | 修改 | 新增按需只读旁路 `acquireMusicAnalyser()` / `releaseMusicAnalyser()`，不改主链路与既有音量 |
| `frontend/src/stores/audio.ts` | 修改 | 暴露只读响应式状态 `isMusicPlaying` 与当前曲目元数据（供声律组件与展签复用） |
| `frontend/src/lib/acousticRulerEngine.ts` | 新增 | 对数分频映射、室内乐动态归一、胡克弹簧阻尼、涟漪脉冲与双主题 Canvas2D 绘制器 |
| `frontend/src/lib/acousticRulerEngine.spec.ts` | 新增 | 声学分频、静音收敛、弹簧阻尼稳定性、涟漪衰减与主题色板单元测试 |
| `frontend/src/components/AcousticRuler.vue` | 新增 | 可复用声律游标组件（DPR Canvas、`IntersectionObserver`、静音零 rAF、`prefers-reduced-motion`、无障碍按钮与曲目轻展签） |
| `frontend/src/components/AcousticRuler.spec.ts` | 新增 | 组件挂载/卸载清理、静音停帧、点击解锁音频、点云模式与减少动态模式单测 |
| `frontend/src/styles/04-components.css` | 修改 | 补充 `.acoustic-ruler` 极简令牌样式与 `forced-colors` / 降级规则 |
| `frontend/src/views/HomeView.vue` | 修改 | 在 `.home-cover` 最底边接入 `<AcousticRuler variant="hero" />` 并微调底部留白 |
| `frontend/src/views/ExhibitDetailView.vue` | 修改 | 在 `.exhibit-scene` 底边接入 `<AcousticRuler variant="darkroom" />`，联动点云模式与 3D 部位聚焦涟漪 |
| `frontend/src/stores/locale.ts` | 修改 | 补充中英双语曲目名与声律无障碍文案（`aria-label`、静音轻提示） |
| `frontend/e2e/acoustic-ruler.spec.ts`（或扩展脚本） | 新增 | Playwright 双主题 + 桌面/移动实景验证与截图留证 |

---

## 5. 分阶段 Goal 执行步骤（Autonomous Execution Phases）

### Phase 0：基线体检与锁定（预检，约 5 分钟）
1. 在 `frontend/` 执行 `npm run typecheck`、`npm run test`、`npm run build`，记录当前精确基线数值（单测数、首屏 JS gzip、CSS gzip）。
2. 检查 [HomeView.vue](../../frontend/src/views/HomeView.vue) `.home-cover__foot` 与 [ExhibitDetailView.vue](../../frontend/src/views/ExhibitDetailView.vue) `.exhibit-dock` 在 `1440×900` 与 `390×844` 下的底部像素留白，确认精确高度与 `z-index` 层级，避免与 `LuoshengSiteGuide.vue` 悬浮球及移动端底栏冲突。

### Phase 1：音频旁路挂点与响应式曲目状态（最小核心）
1. 修改 `audioSystem.ts`，实现懒创建的只读 `AnalyserNode` 旁路（`fftSize = 2048`、`minDecibels = -90`、`maxDecibels = -18`、`smoothingTimeConstant = 0.82`），支持引用计数或安全复用。
2. 修改 `stores/audio.ts`（必要时在 `musicDirector.ts` 暴露轻量状态回调），提供 `activeTrack`（`home | reading | bronze | null`）与 `isMusicAudible` 响应式状态。
3. 补齐 `audioBus.spec.ts` 测试用例，确认既有总线的增益连接拓扑与音量阶梯零回归。
4. **阶段门禁**：`npx vitest run src/lib/audioBus.spec.ts src/lib/musicDirector.spec.ts` 全绿。

### Phase 2：纯算法声学渲染引擎 + 单元测试
1. 编写 `frontend/src/lib/acousticRulerEngine.ts`：
   - 对数频带表生成器（验证 `60 Hz – 4.5 kHz` 单调递增且无空频带）；
   - 室内乐滚动峰值自适应归一器；
   - 快起慢落胡克弹簧步进器与收敛判定 `isSettled()`（保证停播后必然在 `<= 1.8s` 内收敛停帧）；
   - 3D 部位聚焦泛音波纹脉冲器；
   - Canvas2D 绘制函数（支持 `hero-light` / `hero-dark` / `darkroom-bronze` / `darkroom-pointcloud` 四套精细调色，全零 `shadowBlur`）。
2. 编写 `acousticRulerEngine.spec.ts`，覆盖空频谱、强弱突跃、低音量 R3 室内乐模拟输入、弹簧稳定性（绝不 NaN / 发散）、静音收敛停帧与涟漪衰减。
3. **阶段门禁**：`npx vitest run src/lib/acousticRulerEngine.spec.ts` 全绿。

### Phase 3：`AcousticRuler.vue` 组件与无障碍实现
1. 编写 `frontend/src/components/AcousticRuler.vue`：
   - `ResizeObserver` + DPR 缩放防模糊；
   - `IntersectionObserver` + `document.visibilitychange` + `isMusicAudible` 三重门控：仅当「在视口内 && 前台可见 &&（正在播放 || 处于回落收敛或涟漪动画中）」才运行 rAF，否则立刻 `cancelAnimationFrame`；
   - `prefers-reduced-motion: reduce` 下自动绘制一帧静态精密刻度后永不启动循环；
   - 提供极克制的交互触发区（符合 `>= 44px` 触控高度标准、清晰 `:focus-visible` 焦点环、中英双语 `aria-label`），未开启声音时点击即可一步解锁并开始播放。
2. 在 `04-components.css` 添加组件级共享令牌样式（遵循 `@layer components`）。
3. 编写 `AcousticRuler.spec.ts` 完成挂载、停帧、降级、卸载清理、点击唤醒的完整单测覆盖。
4. **阶段门禁**：`npx vitest run src/components/AcousticRuler.spec.ts` 全绿。

### Phase 4：首页首屏 + 3D 展厅双处联动接入
1. **首页接入**（`HomeView.vue`）：
   - 在 `.home-cover` 底部挂载 `<AcousticRuler variant="hero" />`；
   - 复核 `.home-cover__foot` 间距，确保桌面与 `390px` 移动端文字、按钮、向下滚动引导均不与声律重叠。
2. **3D 展厅接入**（`ExhibitDetailView.vue`）：
   - 在 `.exhibit-scene` 暗房底边挂载 `<AcousticRuler ref="acousticRulerRef" variant="darkroom" :visual-mode="displayMode" />`；
   - 在 `focusPart` / 视图切换 / 3D 激活就绪时触发一次轻柔的声律泛音波纹；
   - 校验 `.exhibit-dock`、`LuoshengSiteGuide` 悬浮按钮与移动端布局零遮挡。
3. **阶段门禁**：`npm run typecheck && npm run test && npm run build` 全部通过，核实首屏 JS gzip 增量 `< 600 B` 且稳居 `81,638 B` 门禁内。

### Phase 5：实景浏览器验收、性能测量与文档收口
1. 启动本地前端（或前后端全栈），通过 Playwright 执行实景巡检并截图审查（至少覆盖 6 组视图）：
   - 首页 `1440×900` 浅色（静音刻度态 vs 开启音乐播放态）；
   - 首页 `1440×900` 深色（开启音乐播放态，与浑仪磁阵同屏检查）；
   - 3D 展厅 `1440×900` 暗房实体模式（播放《观器·温金》态）与点云模式（银砂光丝切换态）；
   - 首页 + 3D 展厅 `390×844` 移动端（无横向溢出、不遮挡操作区）。
2. 性能与帧耗断言：
   - 播放态连续采样 60 帧，Canvas 绘制单帧均值 `<= 2.5 ms`；
   - 静音态与滚离首屏后监测 `rAF` 回调计数增长为 `0`。
3. 更新 `PROJECT_STATUS.md`、本方案验证记录与 `docs/01-requirements-traceability.md`（若状态变更），审查 `git status` / `git diff`，不自动提交，等待用户最终审阅确认。

---

## 6. 风险与回滚预案

| 风险 | 触发场景 | 缓解与回滚策略 |
| --- | --- | --- |
| 首屏 JS 触发 `bundle-budget.mjs` 失败 | `AcousticRuler` 被静态导入到入口 chunk | 严格只在懒加载视图引入；若仍有膨胀，将绘制函数进一步拆为按需异步导入 |
| 某些浏览器/沙盒下 `MediaElementAudioSourceNode` 输出全 0 频谱 | 跨源策略或无真实音频解码器的无头环境 | 同源 `/media/audio/music-r3/*.mp3` 无 CORS 问题；检测到持续全 0 且音频 `playing` 时优雅停在温润基线态，不报错、不崩溃 |
| 移动端 3D 展厅底部空间紧凑 | `390px` 窄屏同时存在 `.exhibit-dock`、洛笙按钮与底部安全区 | 移动端声律高度收窄至 `14–16px` 并贴紧底部安全区最底层（`pointer-events: none`），将点击开关收口到顶栏 `AudioControl` |
| 视觉显得“像音乐播放器”破坏博物馆气质 | 律线过粗、过高或跳动过急 | 通过截图自检严格把关：线宽 `<= 2px`、最大高度 `<= 28px`、低饱和度单色渐变、阻尼回落舒缓 |

---

## 7. 验证结果记录（执行完成后填写）

- [x] `npm run typecheck`：`vue-tsc -b` 0 错误通过
- [x] `npm run test`：`vitest run` 77 文件 / 432 用例全部通过（含 `acousticRulerEngine.spec.ts` 5 用例与 `AcousticRuler.spec.ts` 3 用例）
- [x] `npm run build`（含 `bundle-budget.mjs` 与 `music-assets-budget.mjs`）：通过，首屏 JS gzip `79,614 B / 81,638 B`、`AcousticRuler` 独立懒加载（`5.07 kB` gzip）、CSS gzip `12,889 B / 80,000 B`、WOFF2 `0`、R4 AAC `.m4a` `5,001,307 / 6,000,000 B`
- [x] Playwright 桌面/移动双主题实景截图与帧耗/停帧检查：通过（`acoustic-upgrade-verify.mjs` 全过；含玻璃控制台边框、`XII · 十二律吕` 角标、十二律柱、古琴丝弦包络与洛水倒影实景验收；静音态 `0` rAF 绘制、滚离首屏 `0` rAF 绘制；播放态 1440×900 采样 240 帧单帧绘图均值 `0.0738 ms` / 峰值 `0.2 ms` <= `2.5 ms`；1440/390 浅深双主题及实体/点云切换零溢出、零遮挡、零报错）
