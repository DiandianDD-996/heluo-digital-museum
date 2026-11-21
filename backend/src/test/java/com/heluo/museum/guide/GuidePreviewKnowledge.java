package com.heluo.museum.guide;

import com.heluo.museum.guide.GuideEvidenceReader.Evidence;
import com.heluo.museum.guide.GuideEvidenceVisibility.Card;
import com.heluo.museum.guide.GuideEvidenceVisibility.Status;
import java.net.URI;
import java.time.Instant;
import java.util.List;

final class GuidePreviewKnowledge {
    private static final URI CLEVELAND = URI.create("https://www.clevelandart.org/art/1962.281");

    static List<Evidence> cards(String exhibit, String artifact, String locale, Instant availableAt) {
        return List.of(
                entry(exhibit, artifact, locale, availableAt, "EAR", null,
                        "数字模型口沿两侧各有一只向上立起的鼎耳。用俯视图沿口沿比对位置。数字模型不能证明参考原物的搬运方式。",
                        "鼎耳", "耳朵", "口沿两侧", "提手", "把手"),
                entry(exhibit, artifact, locale, availableAt, "FEET", null,
                        "数字模型底部有三只鼎足。侧面视角有一足可能被器身挡住。对照背视图可分辨中间与两侧三足。遮挡不能证明原物残损。",
                        "三足", "鼎足", "几条腿", "几只脚", "为什么只看到两只"),
                entry(exhibit, artifact, locale, availableAt, "MOTIF", null,
                        "数字模型器腹中段可见凸起的宽线和转折。图版由数字模型渲染，不能仅凭图版为纹样定名或判断寓意。",
                        "纹样", "线条", "纹路", "器身花纹"),
                entry(exhibit, artifact, locale, availableAt, "SOURCE", CLEVELAND,
                        "河洛青铜鼎展项展示的是数字模型，可观察口沿两侧的鼎耳、器底的三足和器腹纹样。项目参考克利夫兰艺术博物馆馆藏 Tripod (Ding)，编号 1962.281。图版由数字模型渲染，馆藏公开记录未填出土地。",
                        "1962.281", "参考馆藏", "参考藏品", "克利夫兰", "收藏在哪", "介绍一下这件鼎",
                        "介绍这件鼎", "介绍一下青铜鼎", "介绍一下河洛青铜鼎", "这是什么展品", "这是什么鼎"),
                entry(exhibit, artifact, locale, availableAt, "PERIOD", CLEVELAND,
                        "克利夫兰艺术博物馆将参考藏品 1962.281 编为中国商代安阳时期，约公元前 1250–1046 年。该文化分期不能证明出土地。",
                        "商代", "哪个朝代", "什么年代", "什么时候做", "断代", "多少年历史", "年代"),
                entry(exhibit, artifact, locale, availableAt, "MEASURE", CLEVELAND,
                        "克利夫兰艺术博物馆登记参考藏品 1962.281 的材质为青铜，整体尺寸 24.5 × 20 厘米。馆藏条目在这一字段未分别标注高或宽。",
                        "尺寸", "多大", "多高", "多宽", "材质", "什么做的"),
                entry(exhibit, artifact, locale, availableAt, "INTERPRETATION", CLEVELAND,
                        "克利夫兰艺术博物馆在参考藏品 1962.281 的说明中，以商代礼器的动物图像为背景，讨论兽面（taotie）与古代礼仪艺术中的超自然观念。这是馆方解读，不能用它确认项目数字模型上某一条线的身份或寓意。",
                        "饕餮", "兽面", "馆方怎么解读", "馆方如何解读"));
    }

    private static Evidence entry(String exhibit, String artifact, String locale, Instant availableAt,
            String id, URI source, String text, String... aliases) {
        return new Evidence(new Card(id, 1, exhibit, artifact, locale, Status.PUBLISHED, availableAt, null),
                text, List.of(aliases), source);
    }
}
