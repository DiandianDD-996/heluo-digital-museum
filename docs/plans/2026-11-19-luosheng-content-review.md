# 洛笙青铜鼎三处看点审稿单

当前数字展项的鼎耳、三足、纹样和出处四卡已通过初审。正式候选签核与普通话试读稿审签仍待办理。

逐条定位、核对图版和记录签核请用[证据卡包 0.3.0 草稿](2026-11-19-luosheng-evidence-cards.md)，本页保留可连读的讲解稿。

本轮已更换下表原有的三张旧视角图：洛笙展签分别使用 `frontend/src/assets/luosheng-ding-{top,side,back}.webp`。通过 `frontend/scripts/render-luosheng-plates.mjs` 从项目 [V18 v5.5 数字模型](../../backend/src/main/resources/db/migration/V18__correct_heluo_bronze_ding_to_v5_5_centerline.sql) 重拍，输出三张 480 × 480 透明 WebP，共 59,924 字节。正侧视保留两足的遮挡效果，背视能辨三足，俯视可辨两耳。相关事实及上线许可仍待签核；展厅封面与轮播图未替换。

| 看点 | 观察稿与校验方法 | 降级资料与状态 |
| --- | --- | --- |
| 鼎耳 | “先看鼎口两边：左边一只，右边一只。这对立起来的结构叫鼎耳。”从俯视图左右边缘定位。 | 开发预览使用新图 `luosheng-ding-top.webp`；上线许可待签核。 |
| 三足 | “从侧面只数到了两只？对照背视图：中间一足，两边各一足。”不把固定视图里的遮挡描述为损坏。 | 开发预览使用等比例的 `luosheng-ding-side.webp` 和 `luosheng-ding-back.webp`；上线许可待签核。 |
| 器身纹样 | “从口沿往下，找到鼎身中段凸起的线条，沿着较宽的一条看它在哪里转弯。”不推断具体寓意。 | 开发预览 `frontend/src/assets/luosheng-ding-relief.webp` 从项目 v5.5 GLB 的正面机位重拍，1100 × 620、66,704 字节；中轴两侧上部可辨宽线内转。第 09 版旧图仍留在原型，不再作为展签证据。新图亦非原器摄影，发布许可待签核。 |

- 模型依据：项目 [V15 模型迁移](../../backend/src/main/resources/db/migration/V15__upgrade_heluo_bronze_ding_to_v5_4.sql)记录为基于 Cleveland Museum of Art [1962.281](https://www.clevelandart.org/art/1962.281) 参考模型进行项目重制；图片是数字模型视图。不要把外部馆方记录当作当前数字展项自有藏品的凭据。
- 首批标注题：“哪里是鼎耳？”可答，依据俯视图；“这件在洛阳出土吗？”现有资料不足，不作断言；“为什么看起来像把手？”可描述形状，不能仅凭形状断言本件用途；“只看到两条腿，是不是少了一条？”先核视角，不能据此判断残损；“纹样象征什么？”缺证据，不猜测。
- 发布前由内容负责人逐条签核事实与授权，由 3D 负责人确认当前版本角度，再请首次参观者实际找一次。未签核保持开发预览。

## 图版审阅对照

2026-11-20，用户确认本轮审阅材料全部通过，对应下列四张 `0.3.0-draft` 证据卡。

| 卡号 | 初审结果 |
| --- | --- |
| LS-DING-EARS | 通过 |
| LS-DING-FEET | 通过 |
| LS-DING-MOTIF | 通过 |
| LS-DING-SOURCE | 通过 |

以下四图是开发版实际使用的数字模型渲染件。评审请按卡号记录「通过初审／需修订」和理由，并以[机器可读正文](luosheng-eval/ding-zh-CN-0.3.0-draft.json)为准。当前审阅稿 `0.3.0-draft` 的 SHA-256 为 `85b865db77d6d52b1ae9348ff88de77c0a31703d98f0fa462d5f69d102878e51`，仅用于复现审阅对象，不可填作发布候选签核指纹。

### LS-DING-EARS · 俯视找双耳

![俯视图：口沿左右各有一只鼎耳](../../frontend/src/assets/luosheng-ding-top.webp)

核对：「鼎耳」这个称呼与左右定位是否清楚？文字是否只说明像把手，未断定原器的搬运方式？3D 负责人另检查就绪后手动选择俯视的可见性。

### LS-DING-FEET · 侧视与背视对照

| 侧视：两足清晰可见 | 背视：可辨三足 |
| --- | --- |
| ![数字模型侧视图](../../frontend/src/assets/luosheng-ding-side.webp) | ![数字模型背视图](../../frontend/src/assets/luosheng-ding-back.webp) |

核对：两图能否支持遮挡解释，背视中间与两侧是否各能指认一足？不要由图上的遮挡推断原器缺损。3D 负责人另检查实际背视预设。

### LS-DING-MOTIF · 器腹局部找转折

![数字模型局部：器腹凸起宽线的转折](../../frontend/src/assets/luosheng-ding-relief.webp)

核对：按讲解从口沿往下，能否找到较宽的凸线及内转位置？这张图是否清楚标明是数字模型局部，不代表原器颜色，也不支持寓意判断？

### LS-DING-SOURCE · 参考原物与数字展项

以[参考馆藏 1962.281](https://www.clevelandart.org/art/1962.281)及[模型来源和许可记录](../../assets/models/bronze-ding/source/third-party/cleveland-1962.281/SOURCE.md)核对：项目是否准确说明数字重制参考来源，没有把上面四图称为原器照片？出土地是「现有资料不足」，不是「不在洛阳出土」。核对上游许可之后，仍须单独确认项目图版的使用范围与署名。

本轮初审无修改意见，已保存[送签内容快照](luosheng-eval/ding-zh-CN-0.3.0-review-candidate.json)并生成[送签文件](luosheng-eval/ding-zh-CN-0.3.0-release-candidate.json)。送签文件指纹和正式签核栏见[证据卡登记表](2026-11-19-luosheng-evidence-cards.md#图版快照与签核)。

## 普通话试读稿（待馆方签核）

三段独立试读。游客主动点「朗读」才播放对应段，不连播下一段；初次邀请保留文字，不配开场音。语气亲切、清晰，有一点笑意即可。下表引号内是需要试读和复核的完整正文；方位以图版为准，不假定游客正在看的 3D 镜头。

| 片段 | 试读正文 | 审核对照 |
| --- | --- | --- |
| `ear` 鼎耳 | “我们先找一对小耳朵。看俯视图，鼎口两边各有一处立起来的结构，这就是展签上说的鼎耳。它挺像把手，不过光看模样，还不能确定原器是怎么搬的。” | [鼎耳卡](2026-11-19-luosheng-evidence-cards.md#ls-ding-ears鼎耳数字模型视觉观察)／[俯视图](../../frontend/src/assets/luosheng-ding-top.webp)。只说像把手，不断定用途。 |
| `feet` 三足 | “侧视图里只数到两只？先别忙着给鼎补一只脚。再对照背视图：中间一只，两边各一只。两张图看起来不同，可以用角度造成的遮挡来解释。” | [三足卡](2026-11-19-luosheng-evidence-cards.md#ls-ding-feet三足数字模型视觉观察)／[侧视图](../../frontend/src/assets/luosheng-ding-side.webp)与[背视图](../../frontend/src/assets/luosheng-ding-back.webp)。不推断原器缺损，也不声称镜头已切换。 |
| `motif` 纹样 | “看局部图，顺着口沿往下，找一条凸起来的宽线。沿着它走一小段，看看它在哪儿往里拐。转弯的位置能在模型图上找出来；至于纹样代表什么，单靠这张图还不能确定。” | [纹样卡](2026-11-19-luosheng-evidence-cards.md#ls-ding-motif鼎腹纹样数字模型视觉观察)／[器腹局部图](../../frontend/src/assets/luosheng-ding-relief.webp)。只讲可见轮廓，不猜寓意。 |

**录音与字幕交接：** 内容负责人先审正文，3D 负责人核对固定图版和观察位置；试读时在每句后自然停顿，以实际录音测量时长。字幕以获批录音的实际用词为准，按句核对，不能把试读文本当作已同步字幕。录制前确认配音授权范围、署名、期限及撤回联系人；原始授权凭据由负责人保管。播放验收按 [E07](2026-11-19-luosheng-acceptance.md) 检查主动播放、系统静音、暂停、停止、换展和读屏共存。当前仅有文本，无录音、字幕时间轴或授权记录。
