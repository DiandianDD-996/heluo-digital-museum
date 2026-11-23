-- Add bilingual fields for 3D exhibits and museum shop products.
ALTER TABLE exhibits_3d ADD COLUMN title_en VARCHAR(300) NULL;
ALTER TABLE exhibits_3d ADD COLUMN summary_en VARCHAR(1000) NULL;
ALTER TABLE products ADD COLUMN name_en VARCHAR(200) NULL;
ALTER TABLE products ADD COLUMN summary_en VARCHAR(500) NULL;

-- 1. Align Bronze Ding 3D exhibit title, display number (01), and English metadata without overwriting custom editor edits.
UPDATE exhibits_3d
SET title = '河洛青铜鼎 · 3D 数字重制展项'
WHERE slug = 'heluo-bronze-ding-3d'
  AND OCTET_LENGTH(title) = 37 AND OCTET_LENGTH(REPLACE(title, '河洛青铜鼎 · 互动概念展项', '')) = 0;

UPDATE exhibits_3d
SET display_no = '01'
WHERE slug = 'heluo-bronze-ding-3d'
  AND (display_no IS NULL OR TRIM(display_no) = '' OR display_no = '06');

UPDATE exhibits_3d
SET title_en = CASE WHEN title_en IS NULL OR TRIM(title_en) = '' THEN 'Heluo Bronze Ding · 3D Digital Reconstruction' ELSE title_en END,
    summary_en = CASE WHEN summary_en IS NULL OR TRIM(summary_en) = '' THEN 'Interactive 3D digital reconstruction modeled from Cleveland Museum of Art 1962.281 (CC0), supporting free rotation, zoom, viewpoint focus, and solid/point-cloud inspection.' ELSE summary_en END
WHERE slug = 'heluo-bronze-ding-3d';

UPDATE exhibits_3d
SET summary = '基于 Cleveland Museum of Art 1962.281 CC0 鼎模型，保留原始器型与纹样并重制古青铜 PBR 材质的 3D 数字展项，支持自由旋转、缩放与实体/点云切换。'
WHERE slug = 'heluo-bronze-ding-3d'
  AND OCTET_LENGTH(summary) = 175 AND OCTET_LENGTH(REPLACE(summary, '基于 Cleveland Museum of Art 1962.281 CC0 鼎模型，保留原始器型与纹样并重制真实古青铜 PBR 材质的数字展项，支持旋转、缩放和近观纹样。', '')) = 0;

UPDATE exhibits_3d
SET description = '本展项以 Cleveland Museum of Art 1962.281 Tripod (Ding) 的 CC0 模型为基础网格，保留原始器型与纹样，由项目完成法线、AO、粗糙度、金属度和局部氧化铜绿重制，并在深色博物馆顶光展厅中呈现。该版本为项目数字重制，不是馆方扫描数据或官方复原。拖动模型可自由旋转视角，滚轮或双指可缩放，亦可切换实体/点云模式对比外轮廓；若设备不支持 WebGL，仍可查看高清静态 3 看点图版与文字说明。'
WHERE slug = 'heluo-bronze-ding-3d'
  AND OCTET_LENGTH(description) = 424 AND OCTET_LENGTH(REPLACE(description, '本展项以 Cleveland Museum of Art 1962.281 Tripod (Ding) 的 CC0 模型为基础网格，保留原始器型与纹样，由项目完成法线、AO、粗糙度、金属度和局部氧化铜绿重制，并使用深色博物馆顶光展厅呈现。该版本不是馆方扫描数据或官方复原。请拖动模型旋转视角，使用滚轮或双指缩放；若设备不支持 WebGL，仍可查看封面图和文字说明。', '')) = 0;

-- 2. Backfill structured dimensions & collection_location on Heluo Bronze Ding artifact.
UPDATE artifacts
SET dimensions = CASE WHEN dimensions IS NULL OR TRIM(dimensions) = '' THEN '参考实物整体约 24.5 × 20 厘米（克利夫兰艺术博物馆 1962.281 公开记录）' ELSE dimensions END,
    collection_location = CASE WHEN collection_location IS NULL OR TRIM(collection_location) = '' THEN '河洛数字博物馆 · 深墨青铜厅' ELSE collection_location END
WHERE slug = 'heluo-bronze-ding';

-- 3. Refine concept artifacts editorial copy (only when still using default seed structure, never clobbering custom edits).
UPDATE artifacts
SET content = '观察入口｜先看姿态与张力

这是一件由项目组自主创作的概念展品，并非真实馆藏复原。画面中有三处值得先看的视觉锚点：一是笔直向上又微向前探的细长鸟颈，将视线从纤细双足一路引向昂起的鸟喙；二是紧贴躯干收拢的双翼弧线，让整件青铜雕塑在静止中保持重心沉稳；三是肩腹交界处随曲面流动的连续河流旋纹，让厚重金属显出羽翼般的轻盈。

器形与材料｜把生命感交给青铜

青铜常给人冷硬、沉重的印象，水鸟却属于水岸、迁徙与季节变化。设计刻意把两种相反气质放在同一轮廓里：坚固金属承载柔软羽势，稳定足部托起欲行、欲飞的动态张力。器表旋纹是项目组提炼的水波与羽毛意象，不冒充特定历史纹样。

文化语境与延伸阅读｜从自然意象回到河洛水系

中国早期器物中常见鸟、兽与复合动物形象，它们既关联古人对水域与季节的观察，也体现工匠组织器表秩序的方法。看完这件水鸟雕塑后，可以对照浏览《彩陶水纹罐》与专题《把河流看成一条时间线》，看看水岸意象如何跨越不同材料反复出现。

留给观众的问题

如果把昂首改为低头、把收拢的双翼改为展开，这件作品的情绪会发生什么变化？选一处姿态或纹线，写下属于你的水岸联想。'
WHERE slug = 'water-bird-bronze'
  AND OCTET_LENGTH(content) = 1803 AND OCTET_LENGTH(REPLACE(content, '观察入口｜先看姿态

这是一件由项目组自主创作的概念展品，并非真实馆藏复原。水鸟昂首而立，细长颈部把视线从足部引向头部，收拢的双翼则让身体保持稳定。观看它时，可以先不判断它属于哪个年代，只留意一条曲线怎样让金属显得轻盈，又怎样在静止中保留欲行、欲飞的张力。

器形与材料｜把生命感交给青铜

青铜通常给人厚重、坚固的印象，水鸟却代表水岸、迁徙与季节变化。创作把两种相反感受放在一起：坚硬材料承载柔软羽翼，稳定足部托起向前伸展的长颈。表面的河流旋纹不是对古代纹样的复制，而是用连续线条提示羽毛、水波与时间流动。

文化语境｜古人如何观看自然

中国早期器物中常见鸟、兽及复合动物形象。它们可能关联环境观察、身份表达、礼仪想象，也可能只是工匠组织器表秩序的方法。面对概念作品，我们不替历史给出唯一答案，而借水鸟提出一个问题：当自然形象进入器物，人们保存的是动物的外形，还是与水域、季节和生活经验有关的记忆？

当代阅读｜从标本式观看走向关系式观看

今天的观众可以把这件作品看作人与环境关系的缩影。鸟需要湿地，聚落依赖水系，材料又来自采集、冶炼和协作。器物因此不只是一个孤立造型，也连接生态、技术与共同体。数字放大让我们看清纹线，同时也提醒我们把目光重新放回真实河流与生命环境。

留给观众的问题

如果把昂首改为低头、把双翼改为展开，这件作品的情绪会发生什么变化？请从姿态、材料和纹样中选一个细节，为它写下一句属于你的水岸故事。', '')) = 0;

UPDATE artifacts
SET content = '观察入口｜从轮廓读懂上张下稳

这是一件以河洛纹样为灵感的原创概念器物，不对应任何真实馆藏。面对画面，可以先锁定三处具象结构：一是向前伸展的宽流与向后收尖的尾翼，构成左右呼应的横向张力；二是深腹向下微微收束，再由三根细长外撇的足稳稳撑起，形成轻巧而不失庄重的重心；三是腹部中段环绕器身的几何河流纹带，在上下素面留白之间拉出清晰节奏。

功能想象｜使用动作塑造形态

爵类器形常让人联想到温酒、斟酌与宴饮礼仪。这里不替概念作品套用单一历史定论，而是顺着结构体会动作与形态的关系：外撇三足负责稳定，长流暗示倾倒方向，收束器腹回应盛放与聚温。把这些动作连起来，静止的器物便有了可想象的使用路径。

馆内对照｜与河洛青铜鼎一起看

想进一步理解“无原型概念展品”与“有原型数字重制”的区别，可以把这件青铜爵与镇馆 3D 展项《河洛青铜鼎（数字重制）》并置比较，再延伸阅读专题《第一次看青铜器，可以从哪三个问题开始？》。

留给观众的问题

如果把前伸的流部缩短、把外撇的足部收直，它给人的仪式感与实用感会发生怎样的变化？'
WHERE slug = 'heluo-bronze-jue'
  AND OCTET_LENGTH(content) = 1689 AND OCTET_LENGTH(REPLACE(content, '观察入口｜器形先于年代

这是一件河洛纹样主题的原创概念器物，不对应真实馆藏。先沿轮廓观看：收束的腹部、向外展开的口沿和支撑身体的足部，共同形成上张、下稳的节奏。器形并非随意装饰，它决定手如何接近、液体如何盛放，也决定器物在空间中显得庄重还是轻巧。

功能想象｜使用动作塑造形态

爵类器物常让人联想到饮用、温酒与礼仪场景，但概念创作不把某一历史用途直接套在作品上。我们更关心动作与形态的关系：足部提供稳定，流部暗示倾倒，器身容量回应盛放。把这些动作连起来，静止的器物便出现了一条可能的使用路径。

纹样阅读｜秩序不是填满表面

器表采用项目组重新组织的河流曲线与几何单元。重复让视线建立节拍，对称提供稳定，局部留白则使纹样不至于失去层次。它借鉴青铜装饰的组织方式，却不冒充具体历史纹样。判断一组纹样是否有效，可以看它是否顺应器形转折，而不是只看细节是否繁复。

礼与共同体｜器物为何超越工具

当器物进入宴饮、祭告或重要相聚，它会参与人与人的关系。材料的稀缺、制作的协作和使用场合，共同赋予它超出日常工具的意义。礼并不只是遥远制度，也是一套让行动有次序、让共同体确认彼此位置的方式。

留给观众的问题

请分别从器形、纹样和使用场景提出一个问题。与其先背术语，不如先说明你看见了什么、它可能怎样被使用，以及为什么人们愿意把如此多的劳动投入一件器物。', '')) = 0;

UPDATE artifacts
SET content = '观察入口｜圆廓、中孔与玉质光影

这是一件由项目组自主创作的玉璧概念展品，并非考古出土实物。观看时可先聚焦三处具体视觉细节：一是外圆边缘圆润收敛的厚度过渡，在斜射光下呈现柔和的半哑光漫反射；二是居中留出的圆形穿孔，让视线先沿外缘环绕，再穿过中央空处；三是璧面若隐若现的同心环线与微弱色泽层次，没有繁复雕饰，全靠比例与光影建立克制的秩序。

材料与象征｜温润来自时间，留白构成内容

玉石的光泽不像镜面那样夺目，需要微调视角才能看见细微明暗游走。圆形玉器在传统文化中常与完整、循环、礼仪和沟通天地相联系，不同时代含义各异。保留极简的圆与孔，正是让“实”与“空”彼此定义，体会象征如何从形状与材料中自然生长。

馆内对照｜继续阅读留白与秩序

这件作品的视觉语法与专题《为什么“留白”让一件展品更容易被看见？》直接呼应，也可以与《河洛图纹石板》对照，观察不同材料如何表达空间秩序。

留给观众的问题

如果中央穿孔更小、外缘更厚，作品还会保持现在的轻盈与平衡吗？试着用“完整”“边界”“穿越”中的一个词概括你的观看感受。'
WHERE slug = 'river-map-jade-bi'
  AND OCTET_LENGTH(content) = 1590 AND OCTET_LENGTH(REPLACE(content, '观察入口｜圆与孔之间

这是一件由项目组自主创作的玉璧概念展品。它最重要的不是复杂纹样，而是圆形外缘与中央孔洞建立的关系。外圆把视线聚拢，中孔又让视线穿过器物；实体与空处相互定义，使一块材料获得克制而持续的张力。

材料经验｜温润来自时间

玉石的光泽不会像镜面那样立即夺目，它需要移动视角才能看见细微变化。切割、钻孔、研磨与抛光都意味着漫长劳动。材料价值因此不仅来自稀少，也来自人对时间和手艺的投入。数字图像可以放大纹理，却无法完全替代光线在真实表面缓慢移动的经验。

象征结构｜完整、沟通与秩序

圆形玉器在传统文化中常被联系到完整、循环、身份与礼仪。不同年代和语境中的含义并不相同，不能用一句固定答案概括。概念作品保留圆与孔的基本结构，是为了让观众理解：象征往往不是附加说明，而是从形状、材料、使用方式和共同认知中逐渐形成。

留白的价值｜空处也是内容

中孔不是缺失，页面留白也不是空洞。它们都为观看提供停顿，让边缘、厚度与光影更容易被发现。当信息不断涌来时，玉璧提醒我们放慢速度：一次只观察一个转折、一束反光或一道细纹。

留给观众的问题

如果中央孔更小、外缘更厚，作品还会保持现在的轻盈和平衡吗？试着用“完整”“边界”“穿越”三个词中的一个，解释你如何理解这件概念玉器。', '')) = 0;

UPDATE artifacts
SET content = '观察入口｜器腹弧度与波纹节拍

这是一件项目组自主创作的彩陶概念展品。画面中最易辨认的三处细节分别是：饱满外鼓的宽腹与向上收束的短颈，兼顾盛水容量与双手捧握的尺度；深色绘纹与温润红褐陶胎形成的明暗反差；以及绕腹展开的多道连续水波纹，顺着器身最宽处形成环绕流动的视觉节拍。

工艺与生活｜泥土、河流与使用痕迹

从选土、塑形到烧成，陶器始终紧贴日常：宽腹盛放谷物与清水，平底便于在地面稳放，水纹则把河边聚落关于饮水、耕作与迁徙的记忆画进日用器皿。真实陶器常带有磨损、烟炱与修补痕迹，数字展览呈现的是洁净概念形态，但器物真正的温度恰恰留在反复使用之中。

馆内对照｜顺着河流继续看

可以结合《河洛图纹石板》与专题《把河流看成一条时间线》一起阅读，看“水流”如何从生活容器上的波纹，演变为抽象的方位与秩序符号。

留给观众的问题

如果要为河边聚落设计一只日常盛水罐，你会优先考虑容量、搬运、防洒还是纹样？你的选择会如何改变它的轮廓？'
WHERE slug = 'painted-pottery-water-jar'
  AND OCTET_LENGTH(content) = 1596 AND OCTET_LENGTH(REPLACE(content, '观察入口｜从一只容器开始

这是一件项目组自主创作的彩陶概念展品。宽腹提供容量，收口便于保存与搬运，底部让器物能够稳定放置。它首先是一只与盛放有关的容器，随后才成为纹样与故事的载体。理解陶器，可以从身体尺度和日常动作开始，而不是只从年代标签开始。

制作过程｜泥土如何获得形状

从选土、淘洗、揉泥、成形到干燥和烧制，每一步都会留下痕迹。器壁厚薄关系到受热与强度，口沿和腹部转折反映手的控制，烧成气氛则影响颜色。即使是概念作品，也通过这些工艺逻辑保持可信：好看的轮廓必须能够被材料支持。

水纹与聚落｜装饰连接生活环境

器身水纹来自河流意象。水不仅是图案，也与饮用、种植、交通和聚落选择有关。重复波线把流动的河变成可环绕观看的节奏，使一个日常容器成为环境记忆的载体。它提示我们，所谓文明并非抽象名词，而是许多稳定生活方式逐渐累积的结果。

修补与珍惜｜使用痕迹也是历史

真实陶器常有磨损、烟炱、裂纹和修补。它们并不降低观看价值，反而说明器物曾经被需要。数字展览容易呈现完整、洁净的形象，因此更需要提醒观众：器物的意义也存在于反复使用、损坏和被珍惜的过程里。

留给观众的问题

如果要为河边聚落设计一只容器，你会优先考虑容量、搬运、密封还是纹样？选择一个需求，并说明它将怎样改变器形。', '')) = 0;

UPDATE artifacts
SET content = '观察入口｜线条、对称与水流秩序

这是一件河洛图纹主题的原创概念石板，并非考古出土文物。欣赏上面的刻画线条时，可以先抓住三个具体视觉锚点：一是纵横交汇的主干线条与圆点节点，像河流支流与渡口一样牵引视线前行；二是局部重复、对称排布的几何单元与周边大片留白，在粗砺石面上建立起清晰的秩序感；三是深浅不一的刻痕边缘，保留了坚硬石材上落刀稳重、不可轻易修改的质感。

图纹与解读边界｜像河流、像地图，却保留开放性

曲折线条、交汇节点与对称结构，很容易让人联想到水流、方位、星点或关系图。作为概念作品，它主动区分“视觉上像什么”与“考古证据说明什么”：抽象图纹是一种整理空间与关系的思考入口，而不是某处遗址的确证文献。

馆内对照｜与彩陶和河流专题互看

建议对照《彩陶水纹罐》中的流动波纹，再读专题《把河流看成一条时间线》，体会从具象水流到抽象秩序符号的过渡。

留给观众的问题

请把这块石板分别当作“水流图”“方位图”或“关系图”来读：找出两个支持你读法的线条细节，再找出一个可能反驳它的细节。'
WHERE slug = 'river-map-pattern-stone'
  AND OCTET_LENGTH(content) = 1698 AND OCTET_LENGTH(REPLACE(content, '观察入口｜先追踪一条线

这是一件河洛图纹主题的原创概念石板，并非考古文物。观看时可以从任意一条线出发，追踪它如何转折、交汇和停止。线条的方向会引导视线移动，节点让视线停顿，留白则把不同区域分开。抽象图形因此能够像路线一样被阅读。

石与刻痕｜不可轻易撤回的书写

石材坚硬、沉重，刻下一道线需要明确动作。与纸上书写相比，刻痕更慢，也更难修改。材料特性让图形带有决定性：深浅形成层次，边缘保留工具方向，表面磨损又记录时间。数字放大可以帮助辨认刻痕，但不能把推测变成确定事实。

图与地图｜相似不等于证明

河流、道路、星点和方位都可能被人联想到这组图纹，但视觉相似不能直接证明历史含义。策展说明应区分“看起来像什么”与“有证据说明什么”。概念作品主动保留开放性，让观众练习提出解释，同时说明解释需要材料、语境和比较对象支持。

秩序想象｜人在复杂世界中寻找结构

人们不断用图形整理空间、时间与关系。从结绳、刻画到地图和数据图表，抽象符号帮助我们把难以把握的世界转化为可讨论的结构。河洛图纹在此成为一种当代阅读入口：我们如何从流动中发现节点，又如何避免把自己的期待误认为唯一答案。

留给观众的问题

请为石板选择一种阅读方式：河流图、方位图或关系图。指出支持这种解释的两个视觉细节，再指出一个可能反驳它的细节。好的观看不仅寻找答案，也保留修正答案的空间。', '')) = 0;

-- 4. Upgrade museum shop product descriptions & backfill English product fields.
UPDATE products
SET description = '设计灵感源自馆内概念展品《河洛图纹石板》与《彩陶水纹罐》，封面将交汇水线与留白秩序转译为克制的压纹构图，适合日常随笔、观展笔记与灵感记录。本品为项目原创概念文创，纸张克重与装帧细节未作真实量产标注，当前仅用于模拟商城演示。'
WHERE slug = 'river-map-notebook'
  AND OCTET_LENGTH(description) = 78 AND OCTET_LENGTH(REPLACE(description, '原创河洛风格文创概念商品，仅用于第一版模拟商城演示。', '')) = 0;

UPDATE products
SET description = '设计取意于专题《把河流看成一条时间线》与河洛水系意象，以深墨绿、暖金与流动波线织就舒展的视觉节奏，兼顾日常配饰与礼赠场景。本品为项目原创概念文创，商品资料未标注真丝等具体织物成分，材质与尺寸以概念展示为准，当前仅用于模拟商城演示。'
WHERE slug = 'heluo-silk-scarf'
  AND OCTET_LENGTH(description) = 78 AND OCTET_LENGTH(REPLACE(description, '原创河洛风格文创概念商品，仅用于第一版模拟商城演示。', '')) = 0;

UPDATE products
SET description = '设计呼应概念展品《彩陶水纹罐》与《河图玉璧》的器形留白，将环绕水波纹收束于温润杯腹，把河洛水岸的流动感带入日常饮茶片刻。本品为项目原创概念文创，釉色与容量参数未作真实量产标注，当前仅用于模拟商城演示。'
WHERE slug = 'river-line-teacup-set'
  AND OCTET_LENGTH(description) = 78 AND OCTET_LENGTH(REPLACE(description, '原创河洛风格文创概念商品，仅用于第一版模拟商城演示。', '')) = 0;

UPDATE products
SET name_en = CASE WHEN name_en IS NULL OR TRIM(name_en) = '' THEN 'River-Map Pattern Notebook' ELSE name_en END,
    summary_en = CASE WHEN summary_en IS NULL OR TRIM(summary_en) = '' THEN 'Bring Heluo geometric river motifs into daily notes and sketches.' ELSE summary_en END
WHERE slug = 'river-map-notebook';

UPDATE products
SET name_en = CASE WHEN name_en IS NULL OR TRIM(name_en) = '' THEN 'Heluo River-Lines Scarf' ELSE name_en END,
    summary_en = CASE WHEN summary_en IS NULL OR TRIM(summary_en) = '' THEN 'An original concept scarf inspired by flowing river contours and deep ink-green tones.' ELSE summary_en END
WHERE slug = 'heluo-silk-scarf';

UPDATE products
SET name_en = CASE WHEN name_en IS NULL OR TRIM(name_en) = '' THEN 'River-Wave Teacup Set' ELSE name_en END,
    summary_en = CASE WHEN summary_en IS NULL OR TRIM(summary_en) = '' THEN 'Keep a quiet rhythm of flowing water in everyday tea rituals.' ELSE summary_en END
WHERE slug = 'river-line-teacup-set';

-- 5. Seed visitor & digital guide article if RIVER category and user exist and article does not yet exist.
INSERT INTO articles (
    category_id, title, slug, cover_image_url, cover_asset_ref,
    summary, content, author_display, status, published_at,
    created_by, updated_by, title_en, summary_en
)
SELECT
    c.id,
    '参观与数字导览须知：规划你的河洛博物馆之旅',
    'visit-and-digital-guide',
    '/media/exhibits/painted-pottery-jar-cover.webp',
    'IMG-EXHIBIT-POTTERY-JAR',
    '一文了解未来 14 天公开预约窗口、单笔 1–30 人规则、3D 展厅操作与推荐游览动线。',
    '预约与入馆规则｜开放窗口与人数说明

河洛数字博物馆的公开入馆预约窗口为“今天起未来 14 天”，系统仅展示状态为开放且仍有余量的时段；若某天未显示可约场次，通常说明当天暂未放出名额、尚未排期或已约满。单笔公开预约支持 1 至 30 人，超过 30 人的团体需分笔预约或联系馆方另行安排。提交预约后，可在个人中心随时查看核销状态或按需取消。

展品身份说明｜数字重制与原创概念

本馆公开藏品明确分为两类：一类是以公开馆藏为原型的数字重制展项（如参考克利夫兰艺术博物馆 1962.281 CC0 模型制作的 3D 展项），所有年代与尺寸均严格标注来源与空白边界；另一类是项目组围绕河洛水系与礼器意象自主创作的原创概念展品，用于建立观察方法与文化联想，不冒充真实出土文物。

线上 3D 展厅操作与降级体验｜随时无障碍观展

进入 3D 展厅后，可通过鼠标拖动或单指滑动自由旋转模型，滚轮或双指缩放细节，也可以一键切换正、侧、背、俯视角以及实体/点云观察模式。若移动端或旧版浏览器暂不支持 WebGL，页面会自动平滑降级至高清静态 3 看点对照图版，核心讲解与细节观察不受影响。

推荐游览动线｜10 分钟速览与深度慢读

如果你是第一次到访，推荐按“3D 展厅近观轮廓 → 探索馆藏对照 5 件原创概念器物 → 阅读文化专题建立观察方法 → 逛河洛文创与预约线下时段”的顺序体验；全程可随时唤起向导洛笙查余量、做跨展品对比或直达 3D 局部视角。

留给观众的问题

今天你更想先花 10 分钟快速体验 3D 交互展柜，还是沿着水系与器形慢读一整条策展动线？',
    '河洛数字博物馆',
    'PUBLISHED',
    current_timestamp(3),
    u.uid,
    u.uid,
    'Visitor & Digital Guide: Planning Your Heluo Museum Journey',
    'Plan your visit with our 14-day booking window, 1–30 visitor rules, 3D hall controls, and recommended routes.'
FROM categories c
JOIN (SELECT MIN(id) AS uid FROM users) u ON u.uid IS NOT NULL
WHERE c.code = 'RIVER'
  AND NOT EXISTS (SELECT 1 FROM articles WHERE slug = 'visit-and-digital-guide');
