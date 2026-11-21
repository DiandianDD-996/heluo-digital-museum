# PocketBay 移动端性能优化实施方案

> 状态：本地工程实施、Compose 与 PocketBay release `484` 自动化移动性能门禁已完成；真实设备、三运营商和分档闲置冷启动仍待验。
>
> 当前线上：`https://app-2odx.pocketbay.app`，PocketBay deployment `963` / release `484`；历史诊断基线为 release `440`。

## 1. 目标

在不删除业务功能、不改变权限和状态机、不降低桌面视觉质量的前提下，解决 PocketBay 演示环境在移动端的两类问题：

1. 首次打开、刷新和路由进入时等待时间过长；
2. 页面加载后滑动、毛玻璃合成和 3D 交互在中低端设备上响应较慢。

本方案的最终目标不是单独提高某个实验分数，而是建立可重复验证的移动端性能合同：

- 首页、探索、预约、登录和个人中心能够快速显示可操作界面；
- 重复访问能够复用浏览器缓存，不重复下载哈希静态资源；
- 3D 页面在移动端先提供可用封面和说明，由用户主动启动互动模型；
- 移动端 3D 首帧、实体旋转、点云切换和退出释放均有明确预算；
- PocketBay 冷启动、跨境网络和前端资源成本能够分别测量，避免误判。

## 2. 关联需求与硬边界

### 2.1 关联需求

- 功能需求：`F-01`、`F-03`、`F-05`、`F-06`、`F-08`、`F-09`、`F-12`、`F-14`。
- 非功能需求：`N-03`、`N-04`、`N-05`、`N-06`。
- `N-04` 现有的 10 并发、100 次公开读请求标准继续有效；本方案在其上补充移动前端资源、Web Vitals、缓存和 3D 首帧预算，不覆盖原有后端压测结论。

### 2.2 不允许改变

- 不删除公开浏览、搜索、预约、商城、模拟支付、登录、个人中心、后台管理或 3D 功能。
- 不改变预约、订单、支付、库存和内容发布状态机。
- 不把权限判断移到前端；受保护接口继续由后端校验身份和角色。
- 不对登录、个人资料、预约、订单、购物车或后台响应设置公共缓存。
- 不以降低可读性、隐藏错误状态或移除无障碍降级换取性能分数。
- 不上传本机 MySQL、备份、`.env`、设计源文件或未批准的密钥。
- 不先引入 Service Worker、PWA 离线缓存、第三方 RUM 服务或大型性能依赖。
- 不执行 Git 提交、推送、强制重置或清理用户现有改动。

### 2.3 环境边界

- PocketBay 继续使用单容器 Spring Boot + 内嵌 Vue 产物 + `/data` H2 演示库。
- 本地 MySQL/Docker Compose 路径必须继续可用。
- PocketBay 是演示环境，不替代中国大陆备案生产方案。
- 平台休眠、Cloudflare 路由和大陆运营商网络不由应用代码完全控制，必须独立报告。

## 3. 已验证的线上基线

本节数据来自 2026-08-16 对 release `440` 的 GET、响应头、本地产物和 `390x844` 浏览器视口检查。浏览器视口不等同于真实手机，未测量的项目明确标为待验。

| 指标 | 当前结果 | 结论 |
| --- | ---: | --- |
| 暖机首页/API TTFB | 约 `0.24-0.37s` | 当前暖机后端不是几秒级等待的主因 |
| 新连接首页/API TTFB | 约 `0.54-0.58s` | 包含 DNS、连接和 TLS 成本 |
| 静态资源缓存 | `no-cache, no-store` | 浏览器和 Cloudflare 无法复用哈希资源 |
| Cloudflare 状态 | 静态资源 `BYPASS` | 每次刷新回源下载 |
| 首页观察资源 | 23 字体、6 脚本、5 图片、1 CSS | 请求和字体分片过多 |
| 首页估算传输量 | 约 `2.57 MiB` | 对移动网络过重 |
| 首页字体传输 | 约 `1.50 MiB` | 首屏最大可优化项 |
| 首页图片传输 | 约 `0.84 MiB` | 三张卡片图片存在明显尺寸浪费 |
| 三张卡片图片 | `598,298 B` | 原图约 `960-1254px`，仅显示约 `92x108px` |
| 主 CSS | `853,776 B` 原始，约 `173 KB` gzip | 14 个本地 CSS 全局合并，移动端需解析全部路由样式 |
| 主 JS | 约 `98 KB` gzip | 当前不是最高优先级 |
| 3D 页估算传输量 | 约 `7.6 MiB` | 移动网络进入成本过高 |
| 3D 模型 | `5,213,372 B` | 仅包含 WebP 纹理扩展，无 Meshopt/Draco 网格压缩 |
| 3D 页字体 | 32 个分片，约 `1.96 MiB` | 3D 内容文字触发更多字体分片 |
| Three.js 脚本 | 约 `188 KB` gzip | 必须只在启动 3D 时加载 |
| 移动首屏可见 blur 层 | 7 个 | 常驻导航、路线板和底栏包含最高 `30px` blur |

### 3.1 已有优化，不重复作为第一优先级

- Vue 路由已经按页面动态导入。
- 移动点云预算已经是 `24,000` 点。
- 移动 WebGL DPR 上限已经是 `1.25`。
- 3D FPS 低于 `35` 时已有降级。
- 3D Canvas 离屏或页面隐藏时会暂停 RAF。
- 粗指针、无 hover 和多数高 DPR 手机会让自定义鼠标点阵进入静态档。

这些措施主要解决运行阶段负载，无法消除字体、图片、CSS、Three.js 和 GLB 的首次下载与初始化成本。

## 4. 性能预算

预算分为本地可控门禁和 PocketBay 线上观察值。只有本地门禁和线上复验都通过，才允许把移动优化标为完成。

### 4.1 首屏资源预算

| 指标 | 当前 | 第一阶段门禁 | 最终门禁 |
| --- | ---: | ---: | ---: |
| 首页冷访问传输量 | `2.57 MiB` | `<= 1.20 MiB` | `<= 1.00 MiB` |
| 首页正常重复访问传输量 | 接近冷访问 | `<= 200 KB` | `<= 150 KB` |
| 首页资源请求数 | 35 个可观察资源 | `<= 24` | `<= 20` |
| 首页字体请求 | 23 | `<= 8` | `<= 6` |
| 首页字体传输 | `1.50 MiB` | `<= 400 KB` | `<= 300 KB` |
| 首页 CSS | `173 KB` gzip | `<= 120 KB` | `<= 80 KB` |
| 首页脚本 | 约 `136 KB` gzip | 不增加 | `<= 180 KB` |
| 首页图片 | `0.84 MiB` | `<= 450 KB` | `<= 350 KB` |

### 4.2 用户体验预算

| 指标 | 本地 Docker Fast 4G + 4x CPU | PocketBay 暖机 Fast 4G | 说明 |
| --- | ---: | ---: | --- |
| TTFB | `<= 500ms` | `<= 800ms` | PocketBay 超限时单独标为平台/路由问题 |
| FCP | `<= 1.8s` | `<= 2.5s` | 首次可见内容 |
| LCP | `<= 2.5s` | `<= 3.5s` | 首页和主要任务页 |
| CLS | `<= 0.10` | `<= 0.10` | 字体交换、图片和骨架不得跳动 |
| INP | `<= 200ms` | `<= 250ms` | 需要真实设备补验 |
| 单个 Long Task | `< 200ms` | `< 200ms` | 重点检查 CSS、字体和 3D 初始化 |

Fast 4G 门禁固定为：下载 `4 Mbps`、上传 `1 Mbps`、RTT `150ms`、CPU 4x slowdown。另加 Slow 4G 观察档：下载 `1.6 Mbps`、RTT `300ms`，只报告结果，不作为首轮硬阻断。

### 4.3 3D 预算

| 指标 | 当前 | 最终门禁 |
| --- | ---: | ---: |
| 移动端进入页面、尚未启动 3D | 自动加载全部资源 | `<= 1.20 MiB` |
| 移动端启动后的总新增传输 | 约 `5.7 MiB` 以上 | `<= 3.00 MiB` |
| 移动 LOD GLB | 无独立版本，`5.21 MB` | `<= 1.50 MB` |
| 点击启动到完整首帧 | 未量化 | Fast 4G 下 `<= 4.0s` |
| 实体旋转帧率 | 未做真机本轮测量 | 中位数 `>= 45 FPS`，连续 5 秒不得低于 `30 FPS` |
| 退出资源释放 | 已有清理 | Canvas、RAF、几何、材质、纹理和监听器均释放，无 WebGL context lost |

## 5. 总体策略

采用“先传输、后解析、再渲染、最后平台”的顺序：

```text
建立可重复基线
-> 修复静态缓存
-> 精简字体和图片
-> 拆分路由 CSS
-> 移动端按需启动 3D
-> 压缩移动模型并降低 GPU 固定成本
-> 真机、慢网和 PocketBay 冷启动复验
```

不采用以下伪优化：

- 不先继续削减点云数量，因为首页、预约和账户页同样慢；
- 不用更长 loading 动画掩盖资源体积；
- 不把所有图片简单设为 `loading="lazy"`，当前近屏图片仍会被浏览器预取；
- 不给未版本化资源设置一年 immutable 缓存；
- 不把 Cloudflare `HIT` 当作唯一通过条件，浏览器磁盘缓存也必须独立验证；
- 不用平台保活请求替代冷启动测量，也不在未确认平台规则前实施保活。

## 6. 工作流 A：测量与防回归

### 6.1 扩展现有性能脚本

优先扩展 `frontend/scripts/performance-audit.mjs`，保持现有零依赖 CDP 路径，不先安装 Lighthouse：

- 支持 `--base-url`，分别测试本地 Docker 与 PocketBay；
- 支持 Fast 4G、Slow 4G 和 CPU 4x；
- 采集 Navigation Timing、Paint、LCP、CLS、Event Timing、Long Task；
- 汇总请求数、transferSize、字体/CSS/JS/图片/模型分组体积；
- 记录缓存来源、响应头、`cf-cache-status`、Range GET；
- 记录首页可见 blur 元素数量；
- 记录 3D 点击时间、Three.js 加载、GLB 下载、首帧和 FPS；
- 输出机器可读 JSON 和中文 Markdown 摘要。

### 6.2 固定基线路由

- `/`
- `/explore`
- `/appointment`
- `/login`
- `/profile`
- `/exhibits/heluo-bronze-ding-3d`

账户和后台只做授权后的 no-store 与交互检查，不把私人响应内容写入报告。

### 6.3 CI 门禁

- 每次前端构建记录首页 JS/CSS gzip 体积；
- 静态资源预算超出 5% 即失败；
- 普通路由加载 Three.js、GLTFLoader 或 GLB 即失败；
- 缓存策略测试必须断言私有 API 仍为 `no-store`；
- 性能报告属于本地构建产物，不提交浏览器缓存、trace 原始大文件或含身份数据的日志。

## 7. 工作流 B：缓存与传输层

### 7.1 目标缓存矩阵

| 路径 | 策略 | 说明 |
| --- | --- | --- |
| `/assets/<content-hash>.*` | `public, max-age=31536000, immutable` | Vite 文件名含内容哈希 |
| `/media/**` 中明确版本化文件 | `public, max-age=31536000, immutable` | 例如 `*-v5.5.glb`、`*-v2.webp` |
| 未版本化媒体 | `public, max-age=86400` + Last-Modified/ETag | 先短缓存，后续改名版本化 |
| `/`, `/index.html`, SPA 路由 | `no-cache, must-revalidate` | HTML 必须及时引用新哈希文件 |
| 公开内容 API | 首轮保持 `no-store` | 后续按数据新鲜度单独评估短缓存 |
| 登录、用户、预约、订单、购物车、后台 API | `private, no-store` | 不允许边缘或共享缓存 |

### 7.2 后端实现

- 新增 `StaticResourceCacheConfiguration`，使用 Spring MVC ResourceHandler 为真实存在的 `/assets/**` 和 `/media/**` 设置路径级 Cache-Control；避免给 404 响应错误地设置一年缓存。
- `SecurityConfiguration` 保留 API 的默认禁止缓存策略，并允许静态文件的 `HEAD` 请求，便于缓存和部署检查。
- SPA HTML 继续单独控制，不与静态资源共享 immutable 规则。
- `application-pocketbay.yml` 开启文本类型压缩作为源站兜底，只覆盖 HTML、CSS、JS、JSON、SVG；不重复压缩 WOFF2、WebP、GLB。
- 检查静态响应是否继续携带不必要的跨域 `Vary`，只有确认来源后才收窄，不能破坏开发代理或 API CORS。

### 7.3 验收

1. 第一次普通 GET：哈希资源为 `200`，带 public immutable。
2. 第二次正常页面访问：浏览器 resource timing 显示静态资源来自 memory/disk cache，传输量接近 0。
3. Cloudflare 若支持源站缓存，第二次可出现 `HIT`；若仍为 `BYPASS`，记录为 PocketBay 平台限制，但浏览器缓存门禁仍必须通过。
4. 发布新构建后，HTML 引用新哈希资源，不出现旧 HTML 指向已删除资源的 404。
5. 私有 API、登录响应和错误响应仍为 no-store。

## 8. 工作流 C：中文字体

### 8.1 当前问题

`main.ts` 同时全局引入 Noto Sans SC Variable 与 Noto Serif SC Variable。两个包各定义 101 个 Unicode range；浏览器按页面出现的汉字下载多个 WOFF2 分片。`font-display: swap` 只能避免长时间空白，不能减少 23-32 个实际请求和 1.5-1.96 MiB 传输。

### 8.2 推荐方案

1. 正文、表单、导航、数字和后台全部使用系统中文无衬线栈：
   `Microsoft YaHei`、`PingFang SC`、`Hiragino Sans GB`、Arial、sans-serif。
2. 移除 Noto Sans SC Web 字体运行时导入。
3. Noto Serif SC 只允许用于品牌名、首页 H1、主要页面 H1/H2；正文、卡片摘要、导航和按钮不得触发它。
4. 移动粗指针设备优先使用系统宋体/系统中文回退，避免为了装饰标题下载大量分片。
5. 如果品牌验收要求保留统一衬线字体，再为固定品牌和标题字符生成单个受控 WOFF2 子集；动态内容缺字必须自然回退系统字体。
6. 最多预加载一个真正首屏使用的标题子集，不预加载整套中文字体。

### 8.3 验收

- 首页实际字体请求 `<= 6`，传输 `<= 300 KB`；
- 3D 页面字体传输不超过 `400 KB`；
- 中文、英文、数字、标点和粗细字重无缺字、乱码或明显混排；
- 字体交换 CLS `<= 0.10`；
- Windows、Android、iOS 至少各检查一个系统字体回退结果。

## 9. 工作流 D：响应式图片

### 9.1 首页卡片

当前三张图片自然尺寸约 `960-1254px`，移动端仅显示约 `92x108px`。为每张图生成：

- `192w` 或等效 `1x` 缩略图；
- `384w` 或等效 `2x` 缩略图；
- 保留现有大图供详情或大尺寸舞台使用。

使用 `<picture>`、`srcset` 和准确 `sizes`，不要只依赖 `loading="lazy"`。

### 9.2 首页 Hero

- 新增约 `640w` 和 `1280w` 的移动版本；
- 移动媒体查询不得继续选择桌面高密度图；
- 优先把 CSS background 改为绝对定位 `<picture>`，保留全幅背景视觉，同时获得 `srcset`、`sizes`、`fetchpriority="high"` 和明确尺寸；
- 如果结构风险过高，先保留 CSS background，但用移动专用 `image-set()` 和 preload media 条件。

### 9.3 其他路由

- Explore、商城、文章和预约图片按实际渲染宽度生成候选；
- 不放大已有低分辨率资源；
- GLB、字体和图片继续记录来源、版本和体积；
- 新媒体使用版本化文件名，便于 immutable 缓存。

### 9.4 验收

- 首页图片传输 `<= 350 KB`；
- 不下载超过实际所需像素面积 4 倍的卡片图片；
- Hero 是 LCP 时必须成功解码，不出现空白或布局跳动；
- `390x844`、`412x915`、`768x1024`、`1440x900` 和 DPR 1/2/3 均选择合理候选。

## 10. 工作流 E：路由级 CSS

### 10.1 拆分原则

当前 `main.ts` 全局加载 14 个本地 CSS，`main.css` 又包含多个页面和历史覆盖。第一轮只做所有权拆分，不同时重做视觉或全项目格式化。

建议结构：

```text
assets/
  tokens.css
  base.css
  shell.css
  glass.css
  components/
  routes/
    home.css
    explore.css
    exhibits.css
    exhibit-detail.css
    appointment.css
    shop.css
    auth-profile.css
    admin.css
```

### 10.2 实施顺序

1. 从 `main.css` 提取 3D 与后台规则，因为体积大、路由边界清晰；
2. 提取 Explore、预约、商城和账户规则；
3. 将已有 `task-pages.css`、Explore 系列和控制面覆盖移动到对应路由入口；
4. 保留 tokens、基础排版、App shell、Header、移动底栏和共享控件为全局；
5. 每提取一个路由立即运行 CSS 合同测试和双主题截图，不同时更改选择器语义；
6. 路由样式通过动态 View 导入或 `<style src>` 进入 Vite CSS code splitting。

### 10.3 风险控制

- 不先引入 PurgeCSS，避免动态类、主题属性和 Element Plus 浮层被误删；
- 不一次性加入 CSS Layer 改变全部级联顺序；
- 现有后置材质覆盖必须逐条归属，禁止复制一份后留下旧规则；
- 每波结束检查 computed styles，不以构建成功代替实页验证。

### 10.4 验收

- 首页首次 CSS `<= 80 KB gzip`；
- 普通路由不下载 admin、3D 或 Explore 专用 CSS；
- 路由切换后样式在内容显示前到位，不出现明显 FOUC；
- 13 个正式路由双主题、中英文和移动/桌面无视觉回归。

## 11. 工作流 F：移动端按需启动 3D

### 11.1 页面状态机

移动端默认不挂载 `ThreeExhibitViewer`，使用现有封面和展项说明提供完整静态状态：

```text
poster
-> activating
-> loading-runtime
-> loading-model
-> compiling-first-frame
-> ready
-> error-with-retry
```

- `poster` 必须包含“进入互动 3D”主操作、模型体积提示和静态说明；
- 用户点击后才动态导入 Three.js、loader 和 viewer；
- 加载失败保留封面、文字和重试，不让整个页面不可用；
- 桌面宽屏可继续自动启动，Save-Data、2G/3G、粗指针或低内存设备必须手动启动；
- 路由离开时中止未完成下载可行部分，并继续释放迟到的 GLTF 回调资源。

### 11.2 点云延迟创建

当前实体首帧也会创建、采样并预热透明点云。调整为：

- 移动端实体模式加载完成后不调用 `createCloud`；
- 用户首次点击“点云模式”时才创建 24,000 点 BufferGeometry 和 shader；
- 点云按钮在初始化期间显示局部 loading，不阻塞实体旋转和页面其他操作；
- 桌面可在浏览器空闲时预热，但不得阻塞 LCP 或完整实体首帧；
- 初始化失败回退实体模式，并恢复按钮可重试状态。

### 11.3 移动模型字段

采用后端可选字段而不是前端硬编码文件名：

- `mobile_model_url`，可空；
- `mobile_model_size_bytes`，可空；
- API 返回 `mobileModelUrl`、`mobileModelSizeBytes`；
- 管理后台允许录入，但必须校验 URL 与大小成对出现；
- 前端移动策略优先选移动模型，字段为空时回退桌面模型。

这是向后兼容的接口扩展，需要版本化 Flyway 迁移、API 文档和后端测试。

## 12. 工作流 G：GLB 与 GPU 优化

### 12.1 移动 LOD

- 以 v5.5 桌面模型为视觉基线，单独生成 `heluo-bronze-ding-v5.5-mobile.glb`；
- 在 Blender 中降低不可见细节和三角面，保留器型、正面纹样、中轴修复和主要轮廓；
- 纹理优先降到 1024px，保留 Base Color、Normal、Metallic-Roughness 和 AO；
- 使用 glTF-Transform + Meshopt 做量化和网格压缩；Draco 仅在 Meshopt 无法达到预算时对比，不同时盲目叠加；
- 如使用 Meshopt，显式配置 `MeshoptDecoder`，记录解码器脚本成本；
- KTX2/Basis 作为第二轮 GPU 内存优化，必须经过移动浏览器纹理质量和兼容性验证后再启用。

### 12.2 移动渲染档

- `antialias: false`；
- 关闭实时 shadow map、castShadow 和 receiveShadow，使用现有 AO 保持体积感；
- DPR 首值保持 `1.0-1.25`，低帧率时可降到 1.0；
- 移动端不创建装饰 dust，或只在点云模式创建；
- 底座圆柱、圆环段数按移动档降低；
- 保留 PMREM 反射的视觉必要性，后续再评估预烘焙小型环境贴图；
- 当前 24,000 点不先继续降低，真机仍低于 30 FPS 时再增加 12,000 点中间档。

### 12.3 验收

- 移动 GLB `<= 1.50 MB`，重新导入 Blender 和 GLTFLoader 均成功；
- 封面、实体、五个预设视角、缩放、旋转和点云切换保留；
- 主要器型、正面纹样和材质层次在 `390x844` 下与桌面基线可辨识一致；
- Canvas 非空，首帧完整，不出现材质半透明或黑模；
- 控制台无 decoder、纹理、shader 或 WebGL context error。

## 13. 工作流 H：移动合成层和交互响应

### 13.1 毛玻璃

对 `(pointer: coarse)` 和移动性能档执行：

- Header、移动底栏、路线面板改为近实色表面；
- 常驻层 `backdrop-filter: none`，最多保留 1-2 个小面积临时 Sheet/弹层模糊；
- 用边框、内高光和静态阴影保留月白青玉层级，不把页面简单压暗；
- Bottom Sheet 打开时避免背景与 Sheet 双重大面积 blur；
- 继续保留 `prefers-reduced-transparency`、高对比度和强制颜色分支。

### 13.2 首屏外内容

- 对明确的首屏外长页面段落评估 `content-visibility: auto`；
- 必须配合稳定 `contain-intrinsic-size`，避免滚动条和布局跳动；
- 表单、导航、当前路由主内容和可聚焦元素不得因该优化失去可访问性。

### 13.3 交互

- 路由切换后 100ms 内显示稳定页面壳或局部加载状态；
- 按钮点击立即进入 loading/pressed 状态，网络请求不得造成“无响应”错觉；
- 预约、登录、支付、后台写操作继续防重复提交，不以性能优化移除幂等或禁用状态。

## 14. 工作流 I：PocketBay 与大陆网络

### 14.1 冷启动审计

固定记录三组数据：

1. 连续访问后的暖机 TTFB；
2. 闲置 15、30、60 分钟后的第一次请求；
3. 冷启动后第二次请求。

每组记录首页、health 和一个公开 API。只有第一次明显升高且第二次恢复，才归类为平台冷启动。

### 14.2 路由审计

- 当前响应经过 Cloudflare `NRT` 节点；这说明本次网络路径经过东京边缘，但不等同于固定源站位置。
- 完成前端 P0 后，再测试中国移动、联通、电信的 Wi-Fi/蜂窝网络。
- PocketBay 暖机 TTFB P95 持续高于 `800ms`，或冷启动持续高于 `2s`，应记录为平台限制。
- 演示环境可继续使用 PocketBay；面向大陆长期稳定生产时，按既定方案迁移到备案大陆实例和 HTTPS 入口。

### 14.3 公开 API 的可选短缓存

静态资源优化完成后再评估：

- 分类、已发布文物、文章和展项可使用 30-60 秒公共缓存，并允许短暂 stale-while-revalidate；
- 商品库存、预约余量、健康、登录和所有私有数据保持 no-store；
- 后台发布后若无法主动清缓存，则公开内容最大陈旧时间不得超过约定值；
- 该项收益低于字体、图片、CSS 和 3D，不进入第一轮。

## 15. 分阶段实施与验收

### 15.1 预期收益

| 优化项 | 对首次访问 | 对重复访问 | 对加载后响应 | 预期收益 |
| --- | --- | --- | --- | --- |
| 静态缓存 | 小 | 极高 | 间接 | 重复访问避免再次下载约 `2.4 MiB` 首页静态资源；3D 模型可直接复用 |
| 字体收敛 | 极高 | 高 | 中 | 首页预计减少约 `1.1-1.3 MiB` 和十余个请求，降低字体解析与交换成本 |
| 响应式图片 | 高 | 中 | 低 | 首页预计减少约 `0.4-0.55 MiB`，改善 Hero/卡片解码 |
| 路由 CSS | 中 | 中 | 高 | 首页预计减少 `50-100 KB gzip`，同时降低 CSS 解析和选择器匹配成本 |
| 移动 blur 收敛 | 无 | 无 | 高 | 降低滚动和固定层合成压力，重点改善中低端 GPU |
| 3D 点击启动 | 极高 | 高 | 中 | 未启动 3D 时避免下载约 `5.7 MiB` 的运行时与模型资源 |
| 移动 LOD + Meshopt | 极高 | 高 | 高 | 模型目标从 `5.21 MB` 降到 `1.50 MB`，并降低解析、上传和显存压力 |
| 延迟点云/关闭移动阴影 | 中 | 中 | 极高 | 避免实体首帧执行不必要的表面采样、Buffer 上传和 1024 阴影贴图 |

以上为基于当前资源体积的工程估算，不作为完成证据；最终以实施后的 CDP、HTTP 和真机数据为准。

### 15.2 工作量与依赖

| 阶段 | 预计工作量 | 关键依赖 | 是否需要重新部署 |
| --- | ---: | --- | --- |
| Phase 0 门禁 | `0.5-1` 人日 | 现有 CDP 审计脚本 | 否，先测本地和当前线上 |
| Phase 1 缓存与字体 | `1-2` 人日 | Spring MVC/Security、字体视觉确认 | 是 |
| Phase 2 图片与首屏 CSS | `1.5-3` 人日 | 图片导出、页面截图矩阵 | 是 |
| Phase 3 全路由 CSS/合成层 | `2-4` 人日 | Phase 2 级联边界稳定 | 是 |
| Phase 4 3D/移动 LOD | `3-6` 人日 | Blender、glTF-Transform、API/Flyway | 是 |
| Phase 5 线上真机收口 | `1-2` 人日 + 闲置观察 | PocketBay、真实设备和网络 | 是 |

总工作量约 `9-18` 人日。当前 CSS 历史覆盖较多、工作区存在大量未提交改动，因此不能把低估工期作为压缩验收的理由。Phase 1-2 完成后先做一次收益复盘；如果首页已经达到最终预算，Phase 3 仍以可维护性和移动合成压力为目标，不为追求更小数字进行无关重构。

### 15.3 决策门

1. **缓存门**：浏览器重复访问可复用静态资源，私有 API no-store，才进入图片/CSS 发布。
2. **首屏门**：首页 `<= 1.20 MiB`、字体 `<= 400 KB`，才进入全路由 CSS 拆分。
3. **3D 视觉门**：移动 LOD 的器型、正面纹样和材质通过用户目视确认，才接入 API 和正式路由。
4. **发布门**：工程、Docker、业务回归和线上预算全部通过，才替换 PocketBay release。
5. **生产门**：真实三网和闲置冷启动不达标时，明确保留 PocketBay 演示定位，不用前端分数掩盖平台限制。

### Phase 0：建立门禁

**范围**：扩展性能审计脚本，保存 release `440` 基线。

**验收**：能够一条命令输出 6 个路由的 TTFB、LCP、资源体积、缓存、Long Task 和 3D 首帧数据。

### Phase 1：缓存与字体

**范围**：Spring 静态缓存、HEAD、文本压缩兜底、移除 Noto Sans、限制 Noto Serif。

**验收**：静态资源可复用；首页字体 `<= 400 KB`；私有 API no-store；视觉无缺字。

**回滚**：缓存配置可独立回滚；字体保留原 import 的单独回滚提交，不与 CSS 拆分混在同一波。

### Phase 2：图片与首屏 CSS

**范围**：首页缩略图/Hero 响应式资源，提取 3D、后台和 Explore CSS。

**验收**：首页冷访问 `<= 1.20 MiB`、图片 `<= 450 KB`、CSS `<= 120 KB`，双主题/中英文/移动无回归。

### Phase 3：全路由 CSS 拆分与移动合成层

**范围**：完成任务、商城、账户和后台 CSS 所有权；粗指针关闭常驻 blur。

**验收**：首页 CSS `<= 80 KB`；移动首屏可见 blur 层 `<= 2`；全部路由页面映射、系统偏好和键盘门禁通过。

### Phase 4：3D 按需加载与移动 LOD

**范围**：poster 状态机、延迟点云、移动模型字段/迁移、Meshopt LOD、移动渲染档。

**验收**：3D 启动前 `<= 1.20 MiB`；移动 GLB `<= 1.50 MB`；点击到完整首帧 `<= 4s`；交互和释放通过。

### Phase 5：线上与真机收口

**范围**：PocketBay 重新部署、缓存复验、闲置冷启动、真实手机、三运营商观察。

**验收**：所有硬预算通过；平台限制单独记录；未通过项不得把追踪表标为完成。

## 16. 影响文件

| 模块 | 预计文件 |
| --- | --- |
| 缓存 | `backend/src/main/java/com/heluo/museum/config/StaticResourceCacheConfiguration.java`、`SecurityConfiguration.java`、`application-pocketbay.yml` |
| 缓存测试 | `backend/src/test/java/com/heluo/museum/config/StaticResourceCacheConfigurationTests.java`、测试静态 fixture |
| 字体与入口 | `frontend/src/main.ts`、`frontend/src/assets/main.css`、字体合同测试 |
| 图片 | `frontend/src/views/HomeView.vue`、首页 Hero CSS、`frontend/public/media/editorial/`、媒体 README |
| CSS 拆分 | `frontend/src/assets/main.css`、现有覆盖 CSS、`frontend/src/assets/routes/*.css`、对应 View |
| 3D 页面 | `frontend/src/views/ExhibitDetailView.vue`、`frontend/src/components/ThreeExhibitViewer.vue`、相关 spec |
| 3D API | `ExhibitController.java`、`AdminExhibitController.java`、Flyway V23、API 文档和初始化数据 |
| 3D 资产 | `assets/models/bronze-ding/`、`frontend/public/media/models/heluo-bronze-ding-v5.5-mobile.glb`、资产 README |
| 性能审计 | `frontend/scripts/performance-audit.mjs`、`frontend/package.json`、性能报告目录 |
| 项目文档 | 本计划、`PROJECT_STATUS.md`、需求追踪表、必要时部署/API/资产文档 |

## 17. 完整验证矩阵

### 17.1 工程检查

- `corepack pnpm typecheck`
- `corepack pnpm test`
- `corepack pnpm build`
- `corepack pnpm qa:pointer-pages`
- `corepack pnpm perf:pointer-size`
- `corepack pnpm perf:pointer`
- 新增移动加载性能脚本
- `mvn test`
- `git diff --check`

### 17.2 Docker 与 HTTP

- 根级 PocketBay Docker build；
- Compose 路径继续构建；
- 页面与 API health 实际 GET；
- 静态资源第一次/第二次 GET 响应头；
- GLB Range GET `206` 与 Content-Range；
- 新 release 发布后旧 HTML/新哈希一致性；
- 私有 API no-store 与无敏感缓存。

静态资源 HEAD 在实施前可能因当前 Security matcher 返回 401，因此基线与最终验收都保留真实 GET/Range，HEAD 作为新增能力单独测试。

### 17.3 浏览器矩阵

- `390x844`、`412x915`、`768x1024`、`1440x900`；
- 浅色/深色；
- 中文/英文；
- DPR 1/2/3；
- Fast 4G、Slow 4G、CPU 4x；
- Save-Data、coarse pointer、reduced-motion、reduced-transparency、高对比度、强制颜色；
- 首页、Explore、预约、登录、个人中心、商城、3D 和后台关键入口；
- 控制台 error、资源 404、字体缺字、FOUC、横向溢出和文字遮挡。

### 17.4 业务回归

- 游客浏览、搜索和进入详情；
- 普通用户登录、预约、购物车、下单、模拟支付和个人记录；
- 管理员内容、展项、预约、订单和统计；
- 3D 封面、启动、加载、错误重试、实体、点云、视角和退出；
- 不重复提交预约、订单或支付。

### 17.5 真实设备待验

- 至少一台 Android 真机和一台 iPhone；
- Android 高端机只能证明上限，仍需中低端设备或等效 CPU/GPU 降档观察；
- 中国移动、联通、电信至少各一条真实网络结果；
- 记录设备、系统、浏览器、网络、首次/二次访问、LCP/INP、3D 首帧和主观卡顿点。

## 18. 风险与回滚

| 风险 | 控制与回滚 |
| --- | --- |
| 未版本化媒体被长期缓存 | 只对哈希/版本文件 immutable；变更内容必须改文件名 |
| 字体品牌感下降 | 先系统正文、保留少量标题；按路由截图对照，可独立恢复标题字体 |
| CSS 拆分造成级联漂移 | 每次只提取一个所有权边界；检查 computed styles；不复制旧规则 |
| 图片缩略图模糊 | 使用 1x/2x 候选和真实渲染尺寸门禁，保留原图回退 |
| 3D 点击启动降低发现性 | 用明确封面 CTA、体积提示和加载进度；桌面仍可自动启动 |
| 移动 LOD 纹样损失 | 保留 v5.5 桌面模型，移动模型独立 URL，可按字段快速回退 |
| Meshopt 解码兼容问题 | 保留未压缩移动候选，对比 decoder 成本；加载失败回退封面/桌面模型 |
| 关闭阴影导致模型变平 | 依赖 AO/环境反射，真机视觉不过门禁时只恢复关键小阴影 |
| PocketBay 仍慢 | 将缓存、前端、冷启动和跨境路由证据分开；必要时迁移常驻大陆实例 |
| 性能优化破坏安全缓存 | 自动断言所有私有/写接口 no-store，不通过即阻断发布 |

每个 Phase 独立实施、验证和重新部署。不得把缓存、字体、CSS、3D 和数据库迁移压成一次不可定位的大改动。

## 19. 交付物

- 本实施方案；
- 更新后的移动性能审计脚本与 JSON/Markdown 基线；
- 缓存头与浏览器缓存验证记录；
- 字体、图片、CSS 和 3D 前后对比表；
- 移动 GLB、来源/处理参数、SHA-256 和 Blender/浏览器验证记录；
- PocketBay 新 release 的部署与冷启动报告；
- 真实设备和三运营商观察表；
- 更新后的 `PROJECT_STATUS.md` 与需求追踪记录。

## 20. 当前验证记录

- 已完成 release `440` 的线上只读基线诊断，以及本地缓存、字体、响应式图片、路由运行时、移动合成层和 3D 按需加载/移动 LOD 实施。
- 已通过本地 Compose 重新构建和实际 HTTP 页面验证；哈希资源与版本化媒体为 `public, max-age=31536000, immutable`，HTML 为 `no-cache, must-revalidate`，私有 API 保持 `no-store`，移动 GLB Range 请求返回 `206`。
- 2026-08-16 运行 `corepack pnpm perf:mobile -- --base-url http://localhost:8088 --network all`，完成 6 路由、Fast 4G/Slow 4G、冷/暖缓存共 24 次访问，`artifacts/performance/mobile-summary.json` 的全部自动门禁通过。
- Fast 4G 冷访问：首页 `277.3 KiB`、14 请求、LCP `1356ms`、Long Task 最大 `98ms`；Explore LCP `1660ms`、Long Task 最大 `101ms`；预约 LCP `1180ms`、Long Task最大 `129ms`；登录 LCP `1428ms`；个人中心 LCP `1756ms`。
- 移动 3D Fast 4G 冷访问：启动前 `360.0 KiB`，启动后新增 `1039.4 KiB`，GLB `818.4 KiB`，点击到完整首帧 `2946ms`；实体旋转、5 秒 FPS 采样和资源 Range 门禁通过。自动化 FPS 使用无头浏览器，不能替代真实 GPU 验收。
- 移动点云矩形块已定位为移动 GLB 的 normalized `Int16 POSITION` 在应用世界变换时溢出折返；点云几何现先解码为 `Float32` 再变换。专项测试和 `390x844` 正式页面复核均恢复鼎身、双耳与三足轮廓，无应用级 error；仍保留既有 Three.js `X4122` 浮点精度 warning。
- Slow 4G 已完成观察：Explore 冷访问 LCP `4380ms`、3D 点击到完整首帧 `6119ms`，不属于首轮硬阻断，但已作为后续网络优化与真机验收风险记录。
- 移动预约运行时合同测试 `13/13` 通过；最终前端 Vitest `43` 个文件 / `239` 项、类型检查、生产构建、`qa:pointer-pages` `32/32` 视口、`perf:pointer-size`（JS `17,983 B` / gzip `6,716 B`）和 `perf:pointer` `16/16` 通过；后端 `5` 个测试套件 / `28` 项通过，`git diff --check` 无 whitespace error。
- Compose 最新前端/后端镜像分别为 `sha256:0f2a0b2cabb4b5ac2df37d92c7cc1b9a8030a50c7652a4304007b85450719ac2`、`sha256:c43feb61f95ccf08379a1cc58641f2e260e8a01fd03a65afd12bfc8036ed015c`；正式页面为 `200`、health 为 `UP`，未登录 `/api/v1/auth/me` 已从 `500` 修为 `401 AUTH_REQUIRED` 并保持 `Cache-Control: no-store`。
- 2026-08-16 收口复跑时，未提供身份的首次移动审计按合同将 `/profile` 标记为 `not-measured-auth-required` 并失败；随后使用从本机忽略配置取得的临时登录身份运行同一套 6 路由 Fast/Slow 4G 冷暖共 `24` 次访问，`mobile-summary.json` 全部门禁再次通过，凭据与访问令牌均未写入仓库或报告。
- PocketBay 发布前传统 builder 预检通过：当前工作树与白名单压缩包解出的干净上下文都生成镜像 `sha256:ecbe437ee948`；全新 `/data` 卷的 4 个 SPA 入口、health、管理员身份和移动 GLB `206` Range 均通过。白名单包为 `359` 个条目、`17,026,118 B`，禁用项和缺失必需文件为 `0`。
- PocketBay 配对页已批准已有项目 `app-2odx` 与唯一敏感配置 `pocketbay.properties`；哈希匹配的白名单包上传后，deployment `963` / release `484` 返回 `next_action=done`、`project_status=running`。
- release `484` 线上页面、health、6 组公开数据、管理员登录/`ADMIN` 身份/后台统计/注销均通过；HTML 为 `must-revalidate, no-cache`，哈希资源和移动 GLB 为 `public, max-age=31536000, immutable`，私有 API 为 `no-store`。线上入口资源为 `index-BRxo3QJF.js` 与 `index-aU2XJXvY.css`，移动 GLB Range 为 `206 bytes 0-0/837720`。
- 2026-08-16 运行 `corepack pnpm perf:mobile -- --base-url https://app-2odx.pocketbay.app --network all`，使用临时线上登录身份完成 6 路由、Fast/Slow 4G、冷暖缓存共 24 次访问，31 项自动门禁全部通过。Fast 4G 首页冷访问 `274.4 KiB`、TTFB `269ms`、LCP `1688ms`；移动 3D 启动前 `355.6 KiB`、启动后新增 `1038.7 KiB`、GLB `819.1 KiB`、点击到完整首帧 `2977ms`。Slow 4G Explore 冷访问 LCP `4672ms`、3D 点击到完整首帧 `6087ms`，继续作为非阻断观察值。
- release `484` 的 `390x844` 线上实页已切换点云并目视确认鼎身、双耳和三足轮廓完整，`aria-pressed=true`、Canvas 非空、无横向溢出，控制台 warning/error 为空。该浏览器模拟与无头 FPS 仍不代替真实手机 GPU 验收。
- release `440` 的一次真实休眠唤醒记录：确认唤醒 POST 约 `24.8s` 返回 `303`，截至 `154.7s` 仍未恢复，约 `156s` 后首页与 health 才返回 `200/UP`。该样本显著超过计划的 `2s` 平台观察阈值，归类为 PocketBay 休眠恢复成本；样本的未知闲置时长使其不能替代 15/30/60 分钟三档复验。
- Android/iPhone 真机、中低端 CPU/GPU、真实 INP、中国移动/联通/电信、15/30/60 分钟闲置冷启动、系统强制颜色/高对比度、真实管理员 CRUD 与真实 SMTP 仍明确标为未验证；当前环境未检测到 `adb`，Android CDP `127.0.0.1:9222` 也不可用，不据此宣称 Phase 5 完成。
