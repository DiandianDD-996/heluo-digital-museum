# 洛笙青铜鼎证据卡包

卡包 `ding-zh-CN@0.3.0-draft`。以下各卡均适用藏品 `heluo-bronze-ding`、展项 `heluo-bronze-ding-3d`、语言 `zh-CN`。出处卡、纹样卡为 `2-draft`，鼎耳和三足卡仍为 `1-draft`。仅供阶段 A 审稿及阶段 B 开发预览复查，**不得进入生产检索、回放或公开发布**。署名和上游许可记录不替代本项目的派生素材放行。

馆方可对照以下图版和来源，逐条审核[机器可读审阅稿](luosheng-eval/ding-zh-CN-0.3.0-draft.json)中的正文、限制与检索别名。该文件的四张卡均为 `DRAFT`，没有发布时间；`releaseVersion: 1` 仅为读取器要求的格式值，不是发布登记。送审预检可将此文件路径作为末尾参数核对清单；它不应被配置到任何环境。正式签核应使用冻结后的发布候选字节，不能沿用审阅稿指纹。

## LS-DING-EARS：鼎耳（数字模型视觉观察）

- 可支持：俯视图可见鼎口两侧各有一处立起的结构。本展签拟称其为「鼎耳」。模型里的轮廓看起来像把手；仅凭形状不能确认参考原物的搬运方式。
- 证据定位：[俯视图](../../frontend/src/assets/luosheng-ding-top.webp)口沿左右两侧；[v5.5 资产记录](../../assets/models/bronze-ding/source/heluo-bronze-ding-v5.5-SOURCE.md)「处理范围」说明双耳未改。图版是数字渲染，无公开图版链接；公开参考见 LS-DING-SOURCE。
- 禁止推断：由形状断定用途、搬运方法或受力能力；在不知道游客正在看哪侧时替他判断左右。
- 对应展签 `ear`：找一找鼎耳／鼎耳就是把手吗？；验收 F01、F02、R01-A。显式选择俯视仅在 3D 就绪时可用。

## LS-DING-FEET：三足（数字模型视觉观察）

- 可支持：给定侧视图里两足清晰可见；给定背视图里中间和两侧各可辨一足。两张图的差异可由固定视角下的遮挡解释。
- 证据定位：[侧视图](../../frontend/src/assets/luosheng-ding-side.webp)下半部与[背视图](../../frontend/src/assets/luosheng-ding-back.webp)下半部对照；[v5.5 资产记录](../../assets/models/bronze-ding/source/heluo-bronze-ding-v5.5-SOURCE.md)「处理范围」说明三足未改。无公开图版链接；公开参考见 LS-DING-SOURCE。
- 禁止推断：从只看见两足推定原器缺损、补配或断裂；把图版的固定视角当成游客当前镜头。
- 对应展签 `feet`：数一数鼎足／只看见两足，是不是少了一足？；验收 F03、R01-B、R02、D01。模型未就绪时给两张图，不声称已换视角。

## LS-DING-MOTIF：鼎腹纹样（数字模型视觉观察）

- 可支持：数字裁切图的器腹可见凸出的宽线和内转轮廓。展签可建议从口沿往下找，并沿较宽的线观察转折。
- 证据定位：[展签局部图](../../frontend/src/assets/luosheng-ding-relief.webp)中轴两侧上部的宽线内转。使用[渲染脚本](../../frontend/scripts/render-luosheng-plates.mjs)的 `--relief` 模式，从 [v5.5 GLB](../../frontend/public/media/models/heluo-bronze-ding-v5.5.glb) 以正面预设方向 `[0, .5, 9.7]` 和裁切视场重拍。源 GLB SHA-256 为 `1d59ddd7b40a27737180869d25e5da51d3b530a32de91c251a29d064808b7299`。不是原物摄影，无公开图版链接。
- 禁止推断：象征对象或寓意、特定工艺、确切年代、真实颜色；把渲染光影认作原器磨损或氧化证据。
- 对应展签 `motif`：沿着鼎腹纹样看／这些纹样象征什么？；验收 F04、U02、D02。正面预设的实际可见性需 3D 负责人独立签核。

## LS-DING-SOURCE：出处边界（数字重制）

- 可支持：项目登记的数字重制参考是 Cleveland Museum of Art 的 `1962.281 Tripod (Ding)`；使用了项目派生的模型。洛笙图版展示数字模型，渲染画面不证明原器颜色。
- 证据定位：[v5.5 资产记录](../../assets/models/bronze-ding/source/heluo-bronze-ding-v5.5-SOURCE.md)「派生源」「网页导出」，[上游来源记录](../../assets/models/bronze-ding/source/third-party/cleveland-1962.281/SOURCE.md)「发布方」「许可」，[公开馆藏条目 1962.281](https://www.clevelandart.org/art/1962.281)。项目记录说明模型输入，不等同于外部馆藏史的独立考证。
- 禁止推断：在洛阳出土、原物归本数字博物馆所有、项目图版为原器照片、项目模型是原始扫描或参考馆的官方复原。器类通识和纹样寓意没有已审来源，不纳入本包。
- 对应展签「查看依据」及验收 F05、F06、U01、U03。游客问出土地或原物颜色时，先说明当前证据不足，再提供对应来源，不自动运镜。

### 出处卡核对记录（2026-11-19，非馆方签核）

| 核对对象 | 实际观察 | 适用范围 |
| --- | --- | --- |
| 克利夫兰艺术博物馆[公众条目](https://www.clevelandart.org/art/1962.281)及 [Open Access 条目 API](https://openaccess-api.clevelandart.org/api/artworks/138016) | 公众条目返回 HTTP 200；API 的 `accession_number` 为 `1962.281`、`title` 为 `Tripod (Ding)`、`find_spot` 为 `null`、`provenance` 为空数组 | 可以核对参考原物编号和名称；不能用空字段断言某地不是出土地，也不能把文化分期字段当作具体出土地。 |
| [Sketchfab 模型元数据](https://api.sketchfab.com/v3/models/af15e7980f9b4f718094fc2e16205d89) | `name` 为 `1962.281 Tripod (Ding)`，`user.username` 为 `clevelandart`，`license.slug` 为 `cc0` | CC0 的直接证据来自该模型记录，不借用馆藏 API 的分享许可来证明模型授权。 |
| 项目原始 GLB 与[入库记录](../../assets/models/bronze-ding/source/third-party/cleveland-1962.281/SOURCE.md) | 本地原始文件 12,911,616 B；SHA-256 为 `af0d55ea617c38a62595bb5dbe6c48c56fe76103037c1b5d2ffdfb37e674f8db`，与项目记录一致 | 验证本地文件与入库时记录的指纹一致；未重新下载上游模型，派生图版仍独立签核。 |

待签回答样例（U01）：“项目参考了克利夫兰艺术博物馆编号 1962.281 的藏品。该馆公开记录没有填写出土地，所以我不能确定它是否在洛阳出土。” 不把公开记录空白说成没有其他考古资料，也不从馆藏说明新增断代或纹样寓意。

## 图版快照与签核

2026-11-20，用户确认 `0.3.0-draft` 的鼎耳（`LS-DING-EARS`）、三足（`LS-DING-FEET`）、纹样（`LS-DING-MOTIF`）和出处（`LS-DING-SOURCE`）均通过初审。下表用于登记冻结候选的正式签核。

[送签内容快照](luosheng-eval/ding-zh-CN-0.3.0-review-candidate.json)保留初审通过的四张卡，卡包的 `releaseVersion` 为 `2`。四卡的运行状态均为 `DRAFT`，正式签核以补齐发布字段后重新计算的指纹为准。预检自动比对下表指纹。

四张均来自项目 v5.5 GLB 的 WebGL 渲染；纹样是单独的正面局部机位。列出展签文件的 SHA-256，换图后须递增相应卡片版本并重新核对定位。

| 文件 | SHA-256 |
| --- | --- |
| `ding-zh-CN-0.3.0-review-candidate.json` | `b598d6a1be09f8afa088fbb0150c945ad458e553773f1c8c523f59984f5232d8` |
| `luosheng-ding-top.webp` | `d822f3ccfa89eba78f03d7a569910bd7748de25f267966e653f213f2595a8fa3` |
| `luosheng-ding-side.webp` | `1694a05f9a3912219810793e3715da2c6ca4f68123544a5242bb3849a105d60b` |
| `luosheng-ding-back.webp` | `e47fca6f76a0eeb7a3c369ad0744041bd0c27a5fade324c7bf7240c3acfd39e2` |
| `luosheng-ding-relief.webp` | `ca1afb70ff3a5b30e5e49a75b46c5bbafe00bdddb1de29bce921d04d217aeffc` |

| 卡片 | 素材许可记录及待办 | 内容签核记录 | 3D 或发布签核记录 | 发布状态 |
| --- | --- | --- | --- | --- |
| LS-DING-EARS | 上游模型 CC0 有记录；派生俯视图待放行 | 待签／未签 | 俯视角和图版待签／未签 | 草稿 |
| LS-DING-FEET | 上游模型 CC0 有记录；两张派生图待放行 | 待签／未签 | 背视角和两图待签／未签 | 草稿 |
| LS-DING-MOTIF | 已定位本地 v5.5 模型、正面渲染方式与图版指纹；派生图使用许可待签 | 待签／未签 | 正视角及裁切图待签／未签 | 草稿 |
| LS-DING-SOURCE | 已核对上游模型 CC0 元数据与本地原始 GLB 指纹；署名与讲解表述待签 | 待签／未签 | 来源表述待签／未签 | 草稿 |

先冻结待审候选 JSON，再分别审核事实、角度及许可；任一项未核不进入公开问答。两列签核记录均填「审核人／YYYY-MM-DD／卡包版本／凭据编号／候选 JSON 的 SHA-256」。版本只填 `@` 后的部分；指纹按候选文件原始字节计算，使用小写十六进制。发布负责人须核对原始凭据所覆盖的卡片、正文和资产快照。凭据编号用于定位馆方审核档案，不记录联系方式等无关信息。卡片或素材更新时递增版本并重新签核，不沿用旧版记录。

从仓库根运行 `node docs/plans/luosheng-eval/prepare-evidence-candidate.mjs <候选UTC生效时间> <审签目录中的新文件路径>`。时间精确到秒，格式为 `YYYY-MM-DDTHH:mm:ssZ`。工具核对冻结快照与素材，生成带 `PUBLISHED` 和 `publishedAt` 字段的候选，打印供签核使用的 SHA-256。

[当前送签文件](luosheng-eval/ding-zh-CN-0.3.0-release-candidate.json)的候选生效字段为 `2026-11-20T04:45:05Z`，取生成时刻。SHA-256 为 `15a509ba0f56c7cd8abaaaedaa89fb53e85a4269ad11fb56555e9fe725ac71ef`。候选存放在审签目录，实际开放以正式签核和受控发布配置为准。

完成签核后，文件证据源使用发布配置提供的 SHA-256 文件。文件内容为签核记录中的 64 位小写十六进制指纹，可带一个换行。卡包内容变化时，文件证据源会在解析前拒绝读取，直到配置指向签核记录对应的卡包。

送审前从仓库根运行 `node docs/plans/luosheng-eval/check-evidence-review.mjs`；存在已发布登记时，须在命令末尾传入候选 JSON 路径。退出码 1 表示候选、资产或登记不一致或无效，2 表示快照匹配但仍待签或待发布，0 表示四卡的登记、候选中已发布卡片清单和文件指纹匹配。当前四张图版及 v5.5 源模型均匹配，四卡仍待签（退出码 2）。此工具不替代后端完整格式验证，不验证签名身份、凭据真伪、素材许可或事实正确性，也不生成可发布卡包。

## 一体化向导扩展候选 · 六卡送签

扩展卡包 `ding-zh-CN@0.4.0-draft`。保留四卡冻结内容，补入参考实物断代与尺寸；运行时发行号由 2 升至 3。以下是独立的六卡审核登记，旧四卡的签核不能转用。

| 文件 | SHA-256 |
| --- | --- |
| `ding-period-zh-CN-draft.json` | `ab55fb04c3933a19880d589b16a60016b85e7c1532ead6665e8726176b774023` |
| `ding-size-zh-CN-draft.json` | `3b73014e19acbf874b2a236b7c53e1c82cec6d24dee339f57487529f971d00a7` |

| 卡片 | 本版审查要点 | 内容签核记录 | 3D 或发布签核记录 | 发布状态 |
| --- | --- | --- | --- | --- |
| 扩展 · LS-DING-EARS | 鼎耳俯视图、定位与可证边界 | 待签 | 待签 | 草稿 |
| 扩展 · LS-DING-FEET | 侧视遮挡、背视对照、不是原器修复史 | 待签 | 待签 | 草稿 |
| 扩展 · LS-DING-MOTIF | 正视局部、观察不推断寓意 | 待签 | 待签 | 草稿 |
| 扩展 · LS-DING-SOURCE | 参考实物身份、出土地空白及原始来源 | 待签 | 待签 | 草稿 |
| 扩展 · LS-DING-PERIOD | 所引年代属于 1962.281 参考实物；不把安阳时期当出土地 | 待签 | 待签 | 草稿 |
| 扩展 · LS-DING-SIZE | 两个数值是参考实物整体尺寸；不推断比尺或局部尺寸 | 待签 | 待签 | 草稿 |

1. 从仓库根运行 `node docs/plans/luosheng-eval/check-evidence-review.mjs --extended`。退出 2 表示资料快照匹配、仍待签，不是合格或可上线。
2. 确定生效时间后运行 `node docs/plans/luosheng-eval/prepare-evidence-candidate.mjs --extended <候选UTC生效时间> <审签目录中新文件路径>`。它不会覆盖已有文件，不创建签核或运行配置。仅在受控审签目录保留候选，不部署。
3. 两类责任人核对同一候选字节及图版后，按上文格式登记六卡各自的凭据和同一 SHA-256；待获准后将扩展版本去掉 `-draft` 并按实际状态登记。传入候选路径复跑 `check-evidence-review.mjs --extended`。退出 0 仅证明登记、冻结内容和指纹匹配，发布人还须核验原始签核、实际部署使用的文件和模型配置。

#### 2026-11-21 自行审核（本地候选，不登记为馆方签核）

- 内容核对通过：馆方开放 API 的 1962.281 为 `Tripod (Ding)`，商代安阳时期约公元前 1250–1046 年，整体 24.5 × 20 厘米；`find_spot` 为空，不据此判断洛阳或其他出土地。断代和尺寸属于参考实物，不能移用到数字模型。上游 Sketchfab 元数据确认发布账号为 `clevelandart`、许可为 `cc0`；这不是对项目最终发布的批准。
- 图版核对通过：俯视图口沿左右可辨两耳；侧视可辨两足，背视左、中、右各一足；正面局部可见向内转折的凸线。四张图不提供原器修复史、原色或纹样寓意的依据。冻结内容和图版指纹预检无不匹配。
- 本地审核快照使用上海时间 2026-11-21 08:00 作为生成工具所需的候选字段，非上线时间；SHA-256 为 `4bf19536870ef10ecf6fd60455221bdeae0320e18b56db09e3cf63adf46ec0b9`，存于前端忽略缓存目录，不部署。未签登记对草稿预检返回 2；传入带 `PUBLISHED` 字段的审核快照时，正式预检正确拒绝（退出 1），防止将内部审核当作正式发布。
