# 河洛展馆配乐 R3：来源与制作说明

《入馆·河洛晨光》《水岸·静读》《观器·温金》为河洛数字博物馆项目制作的原创采样编排。网页文件采用已确认的 R3 场景音量版本，只为循环播放调整首尾衔接。

## 乐器录音来源

- 音源库：VS Chamber Orchestra: Community Edition（VSCO 2 CE）。
- 官方仓库：https://github.com/sgossner/VSCO-2-CE
- 样本固定提交：`440300901dfe9275fd84e0b7763af1f8443ae62e`。
- 录音署名：Sam Gossner / Versilian Studios；Simon Dalzell / Ivy Audio。
- 切样署名：Elan Hickler / Soundemote。
- 原音高核对：官方 SFZ 分支固定提交 `6dd651d55dde97fd4028699be9d4481f26917891`。
- 原始录音许可：CC0 1.0 Universal，全文见同目录 [LICENSE-CC0-1.0.txt](./LICENSE-CC0-1.0.txt)。
- 固定版本官方许可：https://github.com/sgossner/VSCO-2-CE/blob/440300901dfe9275fd84e0b7763af1f8443ae62e/LICENSE

CC0 许可在这里指上述源乐器录音。项目保留来源署名，使用样本制作新编排，没有转售原始样本，也不宣称源库作者为本项目背书。

竖琴、钢琴、长笛、大提琴和中提琴来自这套录音；少量弱拨弦由本地合成器生成。竖琴不是古琴，长笛不是箫。作品是现代室内乐方向的采样编排，不是真人合奏实录，也不宣称复原历史礼乐。

## 网页版本

三首文件为 44.1 kHz、双声道、128 kbit/s MP3。首页、阅读、近观的已认可相对音量保留。每首尾部与开头重叠 1.8 秒，折叠到网页文件前缀；首次播放的这段前缀也包含上一轮尾音，正文保持原有编排。

来源样本的固定 URL、SHA-256、MIDI 原音高、源母带散列、网页文件散列、循环参数和编码测量结果见同目录 [manifest.json](./manifest.json)。
