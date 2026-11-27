# README 截图来源

2026-11-25，使用 Windows 上的 Playwright / Microsoft Edge 从 `http://127.0.0.1:8088` 实拍 **Heluo Editorial 3.0**。这是本地工作区重建的 Docker 展厅，不是线上 PocketBay、设计稿或实体手机照片。

| 采集基线 | 实测值 |
| --- | --- |
| 前端镜像 | `deploy-frontend:latest` · `bd3734075057` |
| 后端镜像 | `deploy-backend:latest` · `3445c47dbd0d` |
| 页面入口脚本 | `index-C6fZmYPP.js` |
| 服务与数据库 | 首页 HTTP 200；health / ready 均为 UP；MySQL 8.4 原数据卷，Flyway V31 |
| 浏览器视口 | 普通页面 1440 × 900；后台及 3D 展柜 1680 × 1050；设备像素比 1 |

前台以访客身份打开，不提交预约、订单或支付。预约截图在可用日期上点击后采集；后台通过本地管理员登录，只拍内容、商品与 3D 展项。3D 实体图在 WebGL 就绪后拍摄，点云图通过展柜切换按钮进入并等待点云就绪。采集会话启用减少动态效果，滚动加载图片、等待解码，再回到顶部拍首屏或整页。不修改页面文案或合成界面。

## 文件与校验

本页收录 32 张实拍：下表为基础图库 26 张，另有[点云与洛笙亮点 6 张](#点云与洛笙亮点)。文件名中的 `preview` 表示固定视口首屏。SHA-256 用于核对本批文件，以后重拍的渲染帧可能不同。

| 图片 | 页面 | 主题 / 语言 | 实测尺寸 | SHA-256 |
| --- | --- | --- | --- | --- |
| [admin-content-dark-zh.png](admin-content-dark-zh.png) | `/admin` | 深 / zh-CN | 1680 × 1140 | `ad4cd542b1fd2dfb959dbe0320b42022901d1528e47d237a885fc31f754d68c5` |
| [admin-content-light-zh.png](admin-content-light-zh.png) | `/admin` | 浅 / zh-CN | 1680 × 1140 | `19974eb211c0f8800ad274f53b2d9c27aeb682ec065e7861afe00732ada85275` |
| [admin-exhibits-dark-zh.png](admin-exhibits-dark-zh.png) | `/admin/operations` | 深 / zh-CN | 1680 × 1534 | `9446c9e2b12c3b237a0df949d88c6f6d1f66dbd96d3209bad34e734ada9a6c4f` |
| [admin-products-dark-zh.png](admin-products-dark-zh.png) | `/admin/operations` | 深 / zh-CN | 1680 × 1534 | `44a9002b192f5ce5bd442d11458d47ed5e3bd089cfe85bcd1c33a93891660ad2` |
| [artifact-detail-light-en.png](artifact-detail-light-en.png) | `/artifacts/heluo-bronze-ding` | 浅 / en-US | 1440 × 2338 | `346edf87534403089e9185445fd86c6403c42a4950942d4d7e70f1719ea00bdb` |
| [artifact-detail-light-preview.png](artifact-detail-light-preview.png) | `/artifacts/heluo-bronze-ding` | 浅 / en-US | 1440 × 900 | `7782a57ae10515bb734dc400d6aa28d1c92cc183b3fde5384544804c9c72c537` |
| [booking-dark-en.png](booking-dark-en.png) | `/appointment` | 深 / en-US | 1440 × 2517 | `86dd31e804c6c0e6f25cc138cd35b871b1370f7b286ba4ecaa84b55a629becb3` |
| [booking-light-en.png](booking-light-en.png) | `/appointment` | 浅 / en-US | 1440 × 2517 | `5027b8e9e02ff92a995553e65bd1c1a108b7586313e7f1c89b82e826a650884f` |
| [booking-light-preview.png](booking-light-preview.png) | `/appointment` | 浅 / en-US | 1440 × 900 | `c68e0c5aa9822adac705003f114e7ebeb74661522a2e38bd3693e2247596193b` |
| [digital-exhibit-dark-en.png](digital-exhibit-dark-en.png) | `/exhibits/heluo-bronze-ding-3d` | 深 / en-US | 1680 × 1050 | `8472f8fa5075527dc669e814d39735c3fde718cfd900bbe96c5067b991c1db11` |
| [digital-exhibit-light-en.png](digital-exhibit-light-en.png) | `/exhibits/heluo-bronze-ding-3d` | 浅 / en-US | 1680 × 1050 | `7cd0bb5a821a3285d9c16838956982b39fb4678a1a64b8a56a2f1301f5cb001c` |
| [digital-exhibit-pointcloud.png](digital-exhibit-pointcloud.png) | `/exhibits/heluo-bronze-ding-3d` | 深 / en-US | 1680 × 1050 | `777db55974168397ea5457c5dafba00802f1a03caf4816009a35c164c462d6be` |
| [explore-dark-en.png](explore-dark-en.png) | `/explore` | 深 / en-US | 1440 × 3541 | `eff7088719df88e76d727e658bc64eecac4da939d368d80a18942f1fd2854c9d` |
| [explore-light-en.png](explore-light-en.png) | `/explore` | 浅 / en-US | 1440 × 3541 | `176f3830ebc5a0e66f70bda3ef27db07ca1e77838bbbac94b6c95c00f2f0d331` |
| [explore-light-preview.png](explore-light-preview.png) | `/explore` | 浅 / en-US | 1440 × 900 | `2073a89d2cc6c8c0c8b3f21b121e04cfd0d7bd292846dce15dd57a629823bbf9` |
| [gallery-dark-en.png](gallery-dark-en.png) | `/exhibits` | 深 / en-US | 1440 × 900 | `34096ad19c0d12b240c1ece518dbf11ebaf360bf3a05c78af993aee2d0dfc1ab` |
| [gallery-light-en.png](gallery-light-en.png) | `/exhibits` | 浅 / en-US | 1440 × 900 | `51f679f3cc4ace09a0de05dff04804fec612ba492801756c76b42f9038d5e193` |
| [gallery-light-preview.png](gallery-light-preview.png) | `/exhibits` | 浅 / en-US | 1440 × 900 | `56e425bc1f1ffdf94a1830582ee9102e945baf09c5f44046f2d7c3b46189c5be` |
| [hero-light-preview.png](hero-light-preview.png) | `/` | 浅 / en-US | 1440 × 900 | `d2cc4b525db9e24a0dd88ef32c09c267e4dc8c30ccf83a1d507556f42cac5a66` |
| [home-dark-en.png](home-dark-en.png) | `/` | 深 / en-US | 1440 × 900 | `7611b8f8fa37e50c75da8d72e9c4bd3300b5a120fbc56478fc84f315a97b94e5` |
| [home-dark-zh.png](home-dark-zh.png) | `/` | 深 / zh-CN | 1440 × 900 | `8e531bc70c8c1706be235c244d63cc5a2dfbfa98c11c246498702235663f0fa8` |
| [home-light-en.png](home-light-en.png) | `/` | 浅 / en-US | 1440 × 900 | `d2cc4b525db9e24a0dd88ef32c09c267e4dc8c30ccf83a1d507556f42cac5a66` |
| [home-light-zh.png](home-light-zh.png) | `/` | 浅 / zh-CN | 1440 × 900 | `21ee144d618ce52d7e4373fd61e644f5ffb4c487c982c3eccffb9e8525e34936` |
| [mobile-exhibits-dark-zh.png](mobile-exhibits-dark-zh.png) | `/exhibits` | 深 / zh-CN (2x 装裱) | 536 × 1071 | `e51cda79f8ebefeabc23e372cb75d00968ee3b1613e70127d69d24f402a10e7b` |
| [mobile-explore-light-zh.png](mobile-explore-light-zh.png) | `/explore` | 浅 / zh-CN (2x 装裱) | 536 × 1071 | `d78905fd0be0e6a283ab70dc85a124c6c13fdaead992338f7a68198403afb5c3` |
| [mobile-home-dark-zh.png](mobile-home-dark-zh.png) | `/` | 深 / zh-CN (2x 装裱) | 536 × 1071 | `51fd38697632ceef7c05feeed06cd15f7dd01f73a3a9387e9352c61c313f402c` |
| [mobile-home-light-zh.png](mobile-home-light-zh.png) | `/` | 浅 / zh-CN (2x 装裱) | 536 × 1071 | `a6f649c62a1f273798a2a638dec7b8b3fe1e73d49d204251393530b0f8872df2` |
| [shop-dark-en.png](shop-dark-en.png) | `/shop` | 深 / en-US | 1440 × 1530 | `07949b452021931dea9e46de04c50af15b187ff126817e24bc05d84ae8593447` |
| [shop-light-en.png](shop-light-en.png) | `/shop` | 浅 / en-US | 1440 × 1530 | `fc36061dfb461122a47af85ae1c165616943c650b5ba40e75fa7c294a8366a37` |
| [shop-light-preview.png](shop-light-preview.png) | `/shop` | 浅 / en-US | 1440 × 900 | `00dd55c4a1fb66a000b4a90ad9f30312dc7a90ddab9610b1e31a03486fd5797e` |

## 点云与洛笙亮点

以下均为中文深色、1680 × 1050 的 Edge 浏览器截图，路径为 `/exhibits/heluo-bronze-ding-3d`。三步图在原 8088 Docker 展厅切换点云、开始并暂停微导览后逐步前进拍摄。带洛笙的三张来自 14173 的本地 Vite 生产预览（`/assets/index--ND1OdHf.js`），代理至 18180 的同版 Docker 后端，使用独立 H2 临时库和项目签核证据；模型关闭，未连接线上站点或模型服务。

| 图 | 实际界面状态 | SHA-256 |
| --- | --- | --- |
| [ding-tour-with-luosheng.png](ding-tour-with-luosheng.png) | 01 / 03 · 馆藏资料直出 | `495c0fa9ac4e94c5df60215b58e10bf39eaf68a04745e690a797e423e89071b2` |
| [luosheng-ding-answer.png](luosheng-ding-answer.png) | 馆藏资料直出 | `49e04ab4ee7815aface74e4836c040db898ace361e2ad05c197014f4008e1463` |
| [luosheng-ding-sources.png](luosheng-ding-sources.png) | LS-DING-EARS · v3 | `fb7fc0d516811b61285d5df5976130c6cb804f62ca3f553eacf0173037b5ed47` |
| [pointcloud-tour-ear.png](pointcloud-tour-ear.png) | 立耳对称轮廓 | `f475f28f7b3f14c82e32d2d2b69782dda9f4f917dd624bc3b9c34147fe2b4f89` |
| [pointcloud-tour-feet.png](pointcloud-tour-feet.png) | 三足承重柱体 | `b5cba129fb4caa3cceab912807c7cabc1f3bc7fd55e313df4aa2d3c56d679fb9` |
| [pointcloud-tour-motif.png](pointcloud-tour-motif.png) | 器腹兽面纹带 | `02f0900844a86d313253eb42ef94a7e91872a2ecd2b952b91c0186c6d8277484` |

## 动态交互演示（GIF）

2026-11-27，基于本地 `frontend/dist` 在 `vite preview`（`127.0.0.1:4179` / `127.0.0.1:4180`，仅路由拦截模拟公开展项及签核 JSON，非公网线上环境）下使用 Microsoft Edge（`1280 × 720`、`zh-CN`、`reducedMotion: no-preference`）通过 Chromium CDP `Page.startScreencast` 捕获并以 10 fps 等距重采样 + `ffmpeg` 2-pass 调色板转码生成以下 3 段交互 GIF：

| 文件 | 路由与演示内容 | 尺寸与体积 | SHA-256 |
| --- | --- | --- | --- |
| [gif-01-theme-switch-dotfield.gif](gif-01-theme-switch-dotfield.gif) | `/` · 浅色宣白 ↔ 深色冷夜玄青切换与首屏浑仪磁阵光标联动（52 帧 / 5.14 s） | `900 × 506` · `2,228,476 B` | `b8ca796ec5e683326ff56d97779aab2ac9f6fe67c0ecea3264be48bc21fc51cf` |
| [gif-02-3d-solid-to-pointcloud.gif](gif-02-3d-solid-to-pointcloud.gif) | `/exhibits/heluo-bronze-ding-3d` · 河洛青铜鼎 3D 实体 PBR 与鎏金粉绿锈点云切换（81 帧 / 8.05 s） | `800 × 450` · `3,239,929 B` | `871f71fca21c340217ad57b62e0b707d9ecc8fed8d30e666457ab9e70602d8fc` |
| [gif-03-pointcloud-tour-luosheng.gif](gif-03-pointcloud-tour-luosheng.gif) | `/exhibits/heluo-bronze-ding-3d` · 点云三步微导览（01→02→03）与洛笙同屏提问、展开 `LS-DING-EARS · v3` 证据卡并点击「俯视双耳」联动切镜（注入 `museum-guide-enabled` 元标签与签核档案响应，88 帧 / 8.78 s） | `680 × 383` · `4,009,006 B` | `bda5cdc797ff05404a644facba581676c67d52dbc110637a847bf4f05b342450` |

亮点采集脚本：`node frontend/scripts/capture-readme-highlights.mjs tour` 只依赖 8088；参数 `guide` 使用上述隔离实例。后者需以 `VITE_GUIDE_ENABLED=true` 构建前端，后端启用演示数据和向导、设置签核卡路径并令 `MUSEUM_GUIDE_MODEL_ENABLED=false`。图片及原始记录先生成在被忽略的 `artifacts/readme-highlights/`。

## 再次采集

先按[仓库 README](../../README.md#本地启动)启动 8088 的 MySQL 多容器方案，安装 Microsoft Edge 和前端开发依赖。在仓库根目录执行：

```powershell
node frontend/scripts/capture-readme-docker.mjs
```

脚本只连接本地固定入口；后台凭据取自 Git 忽略的 `deploy/.env`，不输出令牌。每张 PNG 与尺寸、入口脚本、散列记录先写入被忽略的 `artifacts/readme-docker/`。核对完整性及画面后再替换展示文件并更新上表。旧版 `digital-exhibit.png` 和 `gallery-score-r3.png` 是历史素材，不属于本轮图库，仓库首页不引用。
