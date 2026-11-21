# 河洛场景配乐试听制作

这是一套独立的离线编曲与试听工具，不接入前端产品，不修改 Docker。

原稿三份事件谱在 `score.json`，创作意图见 `SCORE.md`；根据用户“连续性不足，尤其青铜鼎”的反馈，修订谱在 `score-r2.json`，改动见 `REVISION-R2.md`。由实际乐器录音与少量明确标注的合成拨弦混合渲染；竖琴不是古琴，长笛不是箫。试听文件是采样编排小样，尚待用户听感反馈。

用户对 r2 评价“还不错”，并授权自由发展新作。第三轮由 `compose-r3.py` 中明确写下的主题、和声与声部展开生成 `score-r3.json`，编曲说明见 `SCORE-R3.md`。三个更长的乐章各有引入、发展和回归；仍是可复现的原创采样编排，不是即兴随机音序、真人合奏录音或历史礼乐复原。

## 运行

在仓库根目录使用已安装 NumPy / SciPy 的 Python：

```powershell
python scripts/music-audition/render.py
```

连续性第二版使用下面的命令。它读取 `score-r2.json`，输出 `*-r2.wav` 与 `render-report-r2.json`，保留原稿 WAV 和报告：

```powershell
python -X utf8 scripts/music-audition/render.py --revision r2
```

第三版先生成谱稿，再渲染。保留原来的十二份音频及报告，新增六份 `*-r3.wav` 和 `render-report-r3.json`：

```powershell
python -B -X utf8 scripts/music-audition/compose-r3.py
python -B -X utf8 scripts/music-audition/render.py --revision r3
python -B -X utf8 scripts/music-audition/check-r3.py
```

本次核实的运行环境为系统 Python 3.13，NumPy 2.4.6，SciPy 1.17.1。没有向前端或系统安装新依赖。渲染器读取 `artifacts/music-audition-2026-09-27/source-samples/manifest.json`，校验所用源文件 SHA256，按核实的 MIDI 原音高进行带限移调，最大允许移调五个半音。

只有标注 `connected` 的弦乐使用 RMS 包络定位有效主体入口，加 120ms 平滑起音与 320ms 释放，避免慢起势采样在短乐句结束后才发出主体。剩余音源长度按移调与裁切后的实际长度核验。这个处理是采样衔接，不是真实跨音连弓录音。

r3 为持续乐器加入逐音编写的三点动态曲线，通过平滑曲线经过起始、约 48% 时值与结束的三个增益，释放期保留末值；不额外生成周期性颤音。可按乐句设置起音与释放，但实际录音必须覆盖完整时值和释放。r3 混音把旋律、回应、和声、低音以不同轻重送入同一室内声场，仅为和声做 330Hz 宽缓 −1.2dB 让位；r1/r2 默认音频路径不变。r2 铜器谱已与旧渲染器进行浮点混音比较，逐样本完全一致。

## 试听页面

渲染完成后会用 `listening.html` 生成输出目录中的 `index.html`。页面提供三个场景、建议页面音量/等响度比较、乐句跳转和 WAV 下载，只有一个播放器，初次加载与切换场景都不自动播放。r2 页面默认选中青铜鼎，读取保留的原报告来提供 R1/R2 比较，版本切换保留位置及播放状态。

r3 页面同时提供三个版本，时长按各曲实际文件显示。默认选中青铜鼎新作，可使用 `?revision=r3` 直达。不同版本的段落组织和时长不同，同一秒数不代表同一乐句；若切回短版本时原进度超出结尾，会回到开头并提示。建议完整听一次，再比较版本。

在仓库根目录启动仅供本机访问的试听服务：

```powershell
python -B -X utf8 scripts/music-audition/preview-server.py
```

打开 `http://127.0.0.1:4197/?revision=r3`。本地服务支持音频字节范围请求，保证浏览器准确跳转到指定秒数；原先直接使用 `python -m http.server` 的服务缺少 Range 支持，在实测中出现元数据已加载但 seekable 仍为零、乐句跳转回到开头。服务仅绑定本机，不用于生产部署。仅调整预览模板时可执行 `python -X utf8 scripts/music-audition/render.py --revision r3 --preview-only`，无需重新渲染音频。

服务运行时，`node scripts/music-audition/check-preview.mjs --r2` 使用前端已有 Playwright 执行两版十二文件解码、HTTP/下载、播放状态、快速版本切换与响应式检查，生成 `preview-check-r2.json` 与 1440px / 390px 截图。省略 `--r2` 可检查 r1 页面。它不启动网站或调用业务接口，也不代表实际设备的听感验收。可用 `MUSIC_PREVIEW_URL` 指定另一个试听地址。

第三版用 `node scripts/music-audition/check-preview.mjs --r3` 检查三版十八文件、可变时长、长曲切回短曲、暂停/播放/快速切换及桌面和窄屏页面，生成独立的 `preview-check-r3.json` 与截图。`check-r3.py` 重新读取新 WAV，核对响度、峰值、削波、首尾、时长、源文件/谱稿/渲染器散列，确认旧版本完整保留，并记录分段能量供定位；这些数值不为审美打分。

验证记录更正：R2 旧脚本只断言跳转后开始播放，未断言到达指定秒数；因此当时“乐句跳转通过”的表述不足。R3 补上准确位置和 Range 响应断言，并修复本地预览服务后重新验收。旧版音频内容与散列不受该问题影响。

`python -B -X utf8 scripts/music-audition/compare-continuity.py` 校验两版音频散列、原稿未改和等响度条件，测量声部交接处的 400ms 响度变化，生成 `continuity-comparison-r2.json`。报告把低电平窗口作为定位依据，不把它称为真正静音或音乐优劣评分。首轮渲染器、谱稿、模板、报告快照保存在输出目录的 `r1-source/`。

## 音源来源

- 音源：VS Chamber Orchestra: Community Edition，CC0 1.0。
- 官方仓库：https://github.com/sgossner/VSCO-2-CE
- 采样固定提交：`440300901dfe9275fd84e0b7763af1f8443ae62e`。
- 官方 SFZ 音高映射固定提交：`6dd651d55dde97fd4028699be9d4481f26917891`。
- 录音署名：Sam Gossner / Versilian Studios，Simon Dalzell / Ivy Audio；切样：Elan Hickler / Soundemote。
- 每个样本的 URL、原音高、格式与散列，以及许可全文和获取记录，保存在上述 `source-samples` 目录。

请按该 manifest 恢复缺失的源文件，不凭文件名推测八度。不同乐器的命名习惯不同。本地样本位于已忽略的 artifacts 目录，并不随这些文本文件自动提交；移交时需要一并保留来源清单与许可。

## 输出与校验

每首导出两份 44.1kHz、双声道、16-bit PCM WAV：

- `*-audition-r1.wav`：等响度比较稿，目标约 -24 LUFS；若瞬态余量不足，三首一起降低目标。
- `*-scene-r1.wav`：建议页面音量版本，保留首页/阅读/近观的相对层级。

第二版用对应的 `*-r2.wav` 文件名，沿用相同目标响度和场景相对音量。

第三版使用 `*-r3.wav`，继续使用相同响度目标和场景相对音量。时长随新乐章变化。r2 源快照位于输出目录的 `r2-source/`，与 `r1-source/` 一起保留原谱、渲染器、试听模板和报告，供追溯。

`render-report.json` 记录响度、4 倍过采样峰值估计、边界幅度、频带能量、单声道相关性、源文件与输出散列，以及配器数量。使用 1kHz 校准信号与静音输入检查响度计算，再对输出文件回读测量。

这些指标只核实技术性质。不能据此宣称“悦耳”“高级”“不疲劳”或真机听感已经通过。每份有自然收束，是独立试听短曲；没有声称完成无缝循环、长时间阅读或产品切页验收。
