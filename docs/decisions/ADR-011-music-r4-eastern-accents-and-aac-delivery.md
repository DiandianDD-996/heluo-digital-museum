# ADR-011：展馆配乐 R4 东方音色点缀、第四乐章与 AAC-LC 单格式交付

- 日期：2026-11-23
- 状态：已接受（用户经 `http://127.0.0.1:4197/?revision=r4` 主观试听后正式批复采纳 R4）
- 关联决策：[ADR-005-recorded-museum-music.md](./ADR-005-recorded-museum-music.md)、[ADR-010-luosheng-v2-museum-agent.md](./ADR-010-luosheng-v2-museum-agent.md)

## 背景

在 [ADR-005](./ADR-005-recorded-museum-music.md) 确立的三首 R3 室内乐（128 kbps MP3）基础上，项目组希望进一步解决两个体验短板：
1. 现有配乐偏欧洲室内乐基底，缺少克制可辨识的东方金石玉声与丝弦呼吸点；
2. 玉璧、彩陶与河图石等温润材质展品仍共用《水岸·静读》，缺少专属听觉区分度，且 MP3 128 kbps 难以在 `6,000,000 B` 静态资源总预算内容纳第 4 首乐章。

## 决策

1. **新增 CC0 1.0 东方点缀音源（VCSL 独立审计入库）**：
   - 在完全保留 R1–R3 `VSCO 2 CE` 样本及散列的前提下，新增审计来自 `sgossner/VCSL`（固定提交 `c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e`，SFZ 映射 `dfcf4a4918771eee884b96ad4493de82ef84daf6`，**CC0 1.0 Universal**）的 31 个 WAV 采样：`Hand Chimes`（`jade_chime`）、`Dan Tranh/Normal mf`（`dan_tranh`）、`Vibraphone/Soft Mallets`（`bronze_bell`）、`Gong 1/gong_p.wav`（`bronze_gong`）与 `Baroque Tenor Recorder`（`wooden_wind`）。
   - 所有样本均经 262,144 点 FFT 实测基频并校准 `tuneCents`，并在 `CREDITS.md`、`manifest.json` 与前台 `AudioControl` 折叠「声音手记」中履行诚实声明：**不宣称古代礼乐复原或古琴/编钟/箫真人实录**。
2. **四乐章构成与显式内容映射**：
   - 保留《入馆·河洛晨光》（`home`，`98.2s`，sceneGain `0.80`）、《水岸·静读》（`reading`，`103.0s`，sceneGain `0.58`）、《观器·温金》（`bronze`，`107.6s`，sceneGain `0.72`）的 R4 克制点缀精修版；
   - 新增第 4 首《温润·玉石》（`jade`，`99.1s`，sceneGain `0.67`，目标场景响度 `-27.479 LUFS`）；
   - `frontend/src/lib/audioScenes.ts` 仅对实际试听确认的展品显式映射：`artifact-detail:river-map-jade-bi`、`artifact-detail:painted-pottery-water-jar`、`artifact-detail:river-map-pattern-stone` → `jade`，`artifact-detail:water-bird-bronze` → `story`，`exhibit-detail:heluo-bronze-ding-3d` → `exhibit`；未单独试听的新内容继续回落 `story`。
3. **网页交付格式切换为 AAC-LC `.m4a`（96 kbps, 44.1 kHz stereo）**：
   - 经 `scripts/music-audition/export-web-r4.py` 实测对比：方案 A（AAC `.m4a` 96 kbps 单格式）4 首合计 **`5,001,307 B`**（`< 6,000,000 B` 门禁），全平台浏览器原生支持；方案 B（Opus `.webm` 80 kbps + MP3 96 kbps 降级）双格式合计 `9,800,874 B` 超出预算。因此正式采用 **AAC `.m4a` 96 kbps** 部署于 `/media/audio/music-r4/`，保留 `1.8s` 尾首互补余弦折叠无缝循环与原有 Web Audio `musicBus` 等功率淡化总线。

## 取舍与边界

- 延续 ADR-005“首次访问默认静音、仅在用户合法手势后加载与播放、无后台自动播放、不引入后端音频接口或新增前端依赖”的边界。
- 经用户确认后已移除旧版 `frontend/public/media/audio/music-r3/` 生产静态文件（离线试听母带与脚本仍完整保留于 `artifacts/music-audition-2026-09-27/` 与 `scripts/music-audition/`）；`frontend/scripts/music-assets-budget.mjs` 已切换至校验 `dist/media/audio/music-r4/` 的 4 首 AAC 文件、散列、零削波、峰值余量、无缝接缝与双 CC0 许可文件。
