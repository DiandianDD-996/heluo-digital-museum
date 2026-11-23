<div align="center">

<sub>HELUO DIGITAL MUSEUM · 河洛数字博物馆</sub>

# 河洛数字博物馆

**把一件器物的纹理、尺度与故事，变成可以被重新发现的数字展览。**

<p>
  <a href="https://heluo.pocketbay.app/"><strong>线上展厅</strong></a>
  &nbsp;·&nbsp;
  <a href="#核心体验">核心体验</a>
  &nbsp;·&nbsp;
  <a href="#展馆声景-r4">展馆声景</a>
  &nbsp;·&nbsp;
  <a href="#页面掠影">页面掠影</a>
  &nbsp;·&nbsp;
  <a href="#本地启动">本地启动</a>
</p>

<p>
  <img src="https://img.shields.io/badge/Live-heluo.pocketbay.app-b88a44?style=flat-square" alt="线上地址" />
  <img src="https://img.shields.io/badge/Frontend-Vue%203%20%2B%20TypeScript-42b883?style=flat-square" alt="前端技术" />
  <img src="https://img.shields.io/badge/Backend-Spring%20Boot%203.5%20%2B%20Java%2017-6db33f?style=flat-square" alt="后端技术" />
  <img src="https://img.shields.io/badge/3D%20%26%20Audio-Three.js%20%2B%20R4%20AAC-1c1b19?style=flat-square" alt="3D 与声景" />
  <img src="https://img.shields.io/badge/Bilingual-中文%20%2B%20English-7d6b52?style=flat-square" alt="双语支持" />
</p>

</div>

---

**河洛数字博物馆**是一座面向当代文化探索者的双语（`zh-CN` / `en-US`）数字博物馆系统。它从「浏览器物」出发，把馆藏检索、策展式长文阅读、可交互 3D 青铜展厅、R4 展馆声景、AI 策展向导「洛笙」，以及线下预约、文创商城（模拟支付）与后台运营工作台串联成一条完整体验路径。

> [!NOTE]
> 独立部署的[线上演示站](https://heluo.pocketbay.app/)不一定与仓库最新提交同步；体验最新 **Heluo Editorial 2.0** 视觉系统、**R4 四乐章声景**与**洛笙 AI 向导 v2**，建议按[本地启动](#本地启动)章节运行。

<div align="center">
  <a href="docs/showcase/home-light-en.png">
    <img src="docs/showcase/hero-light-preview.png" alt="河洛数字博物馆英文浅色首页：缃色暖黄古宣展厅、青铜鼎展廊与十二律吕声景控件" width="100%" />
  </a>
  <br />
  <sub>河洛数字博物馆 · 浅色「缃色暖黄古宣」展厅首屏（点击查看完整长图）</sub>
</div>

---

## 核心体验

<table>
  <tr>
    <td width="50%" valign="top">
      <h3>Heluo Editorial 2.0 视觉系统</h3>
      <p>以当代亚洲博物馆画册与静谧展厅为蓝本，建立 8 层 <code>@layer</code> CSS 架构与 OKLCH 双色令牌：</p>
      <ul>
        <li><strong>双主题质感</strong>：浅色「缃色暖黄古宣 · 鎏金松烟」与深色「曜石暗房 · 丝绸钛金」。</li>
        <li><strong>浑仪磁阵光点场</strong>：首屏 <code>PointerDotField</code> 结合空间避让遮罩、弹簧阻尼彗尾与星轨连线。</li>
        <li><strong>零外部字体下载</strong>：依托系统衬线与等宽数字排印，全站可见字号 <code>&gt;= 12px</code>，触控热区 <code>&gt;= 44px</code>。</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>可交互 3D 数字展厅</h3>
      <p>基于 <strong>Three.js</strong> 打造《河洛青铜鼎 · 3D 数字重制展项》（编号 <code>01</code>）：</p>
      <ul>
        <li><strong>多维观察</strong>：支持自由旋转缩放、点云模式切换与耳 / 足 / 纹饰局部平滑聚焦（<code>focusPart</code>）。</li>
        <li><strong>声画联动</strong>：进入暗房展柜或切换点云模式时，触发低频滤波与轻量立体声微音效。</li>
        <li><strong>温和降级</strong>：在 WebGL 不可用或受限移动端环境自动切换至静态「三看点」图版，不阻断核心阅读。</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <h3>洛笙 · AI 策展向导 v2（可选扩展）</h3>
      <p>全馆实时知识 Grounded 的双语策展讲解员与 3D 展柜交互副驾（详见 <a href="docs/luosheng/README.md">洛笙 v2 文档</a>）：</p>
      <ul>
        <li><strong>可控可追溯</strong>：支持中英自适应、SSE 真流式多轮对话与 3 个只读馆藏检索工具，每条回答附「依据与边界」抽屉。</li>
        <li><strong>证据防线</strong>：青铜鼎 Tier-1 签名证据卡（v6 双语 9 卡）启用 SHA-256 校验、防回滚与 ADR-006 冲突拦截。</li>
        <li><strong>诚实降级</strong>：默认通过开关关闭；无模型或触发运维暂停时自动切换为确定性「馆藏资料直出」。</li>
      </ul>
    </td>
    <td width="50%" valign="top">
      <h3>双语策展与运营闭环</h3>
      <p>从前台文化发现到后台内容治理，覆盖数字博物馆第一版完整业务链路：</p>
      <ul>
        <li><strong>双语发现</strong>：藏品、文化专题（含《参观与数字导览须知》）与文创商品统一接入中英搜索链路。</li>
        <li><strong>到访与文创</strong>：未来 14 天预约时段查询与预约管理、个人中心「文创账簿」、购物袋与模拟结算。</li>
        <li><strong>后台工作台</strong>：内容、3D 展项、商品、预约时段与订单、用户、基础统计与操作日志统一管理。</li>
      </ul>
    </td>
  </tr>
</table>

---

## 展馆声景 R4

走进展厅、俯身读一段展签、绕着青铜器近观，是三种不同的观看节奏。项目为不同空间编排了 **R4 四乐章原创声景**，并配套**「十二律吕 · 青铜游标刻度」（`AcousticRuler`）**磨砂玻璃操控台与古琴丝弦包络动效（停帧零 `rAF` 消耗）。

首次进入默认静音；开启声音后可独立控制配乐或交互音效，跨页沿用同一曲目时连续播放，换曲时等功率交叉淡化。

| 序号 | 曲目 | 对应场景 | 时长 | 试听（AAC 96 kbps） |
| :---: | --- | --- | :---: | --- |
| `01` | **入馆 · 河洛晨光** | 首页与馆藏漫游 | `1:38` | [home-r4.m4a](https://raw.githubusercontent.com/DiandianDD-996/heluo-digital-museum/main/frontend/public/media/audio/music-r4/home-r4.m4a) |
| `02` | **水岸 · 静读** | 水鸟铜器展签与专题长文 | `1:43` | [reading-r4.m4a](https://raw.githubusercontent.com/DiandianDD-996/heluo-digital-museum/main/frontend/public/media/audio/music-r4/reading-r4.m4a) |
| `03` | **观器 · 温金** | 青铜鼎 3D 近观 | `1:48` | [bronze-r4.m4a](https://raw.githubusercontent.com/DiandianDD-996/heluo-digital-museum/main/frontend/public/media/audio/music-r4/bronze-r4.m4a) |
| `04` | **温润 · 玉石** | 河图玉璧、彩陶与纹石展品 | `1:39` | [jade-r4.m4a](https://raw.githubusercontent.com/DiandianDD-996/heluo-digital-museum/main/frontend/public/media/audio/music-r4/jade-r4.m4a) |

> 诚实声明：R4 曲目基于 **VSCO 2 CE** 与 **VCSL**（全部 `CC0 1.0 Universal`）声学采样进行当代编排，不宣称古代礼乐复原。详细采样来源、SHA-256 与许可全文见 [R4 声源与署名说明](frontend/public/media/audio/music-r4/CREDITS.md)。

---

## 页面掠影

以下页面截图于 `2026-11-24` 采集自本地最新 `Heluo Editorial 2.0` Docker Compose 构建（`1440px` / `1680px` 桌面视口，采集说明见 [截图来源说明](docs/showcase/SOURCES.md)）。点击任意图片可查看原尺寸。

### 同一座展馆，两种光线

<table>
  <tr>
    <td width="50%" align="center"><strong>首页 · 中文浅色</strong></td>
    <td width="50%" align="center"><strong>首页 · 中文深色</strong></td>
  </tr>
  <tr>
    <td width="50%"><a href="docs/showcase/home-light-zh.png"><img src="docs/showcase/home-light-zh.png" alt="中文浅色首页完整页面：明亮展馆、器物介绍与主题入口" /></a></td>
    <td width="50%"><a href="docs/showcase/home-dark-zh.png"><img src="docs/showcase/home-dark-zh.png" alt="中文深色首页完整页面：深色展馆、器物介绍与主题入口" /></a></td>
  </tr>
</table>

### 全链路文化体验（浅色主视觉 · 2×2 矩阵）

从馆藏检索、数字展厅入口，到未来 14 天线下预约与文创商城，所有页面均采用 `16:10` 对齐预览（点击任意图片可查看完整长图）。

<table>
  <tr>
    <td width="50%" align="center"><strong>Explore · 探索馆藏与双语检索</strong></td>
    <td width="50%" align="center"><strong>3D Gallery · 数字展厅入口</strong></td>
  </tr>
  <tr>
    <td><a href="docs/showcase/explore-light-en.png"><img src="docs/showcase/explore-light-preview.png" alt="英文浅色 Explore 页面预览：馆藏检索与双栏画册" /></a></td>
    <td><a href="docs/showcase/gallery-light-preview.png"><img src="docs/showcase/gallery-light-preview.png" alt="英文浅色 3D 数字展厅入口" /></a></td>
  </tr>
  <tr>
    <td width="50%" align="center"><strong>Visit Booking · 未来 14 天线上预约</strong></td>
    <td width="50%" align="center"><strong>Museum Store · 河洛文创商城（模拟结算）</strong></td>
  </tr>
  <tr>
    <td><a href="docs/showcase/booking-light-en.png"><img src="docs/showcase/booking-light-preview.png" alt="英文浅色线上预约参观页面：14 天时段与电子入馆凭证" /></a></td>
    <td><a href="docs/showcase/shop-light-en.png"><img src="docs/showcase/shop-light-preview.png" alt="英文浅色文创商城页面预览：商品展示与购物袋" /></a></td>
  </tr>
</table>

### 亮点特写 · 3D 展厅多模态观察与器物档案

支持 **实体 PBR 渲染** 与 **鎏金粒子点云重构** 一键切换（同步触发暗房低频声景滤波与底部「十二律吕」游标刻度），并与器物档案详情页无缝联动。

<table>
  <tr>
    <td width="50%" align="center"><strong>3D 实体渲染（浅色展柜）</strong></td>
    <td width="50%" align="center"><strong>3D 鎏金点云重构（暗房声景联动）</strong></td>
  </tr>
  <tr>
    <td><a href="docs/showcase/digital-exhibit-light-en.png"><img src="docs/showcase/digital-exhibit-light-en.png" alt="英文浅色 3D 展厅：已加载实体模型与控制面板" /></a></td>
    <td><a href="docs/showcase/digital-exhibit-pointcloud.png"><img src="docs/showcase/digital-exhibit-pointcloud.png" alt="3D 青铜鼎展厅点云模式：鎏金粒子点阵与底部十二律吕声景控制栏" /></a></td>
  </tr>
  <tr>
    <td width="50%" align="center"><strong>器物档案与策展详情（点击看长卷）</strong></td>
    <td width="50%" align="center"><strong>3D 实体渲染（深色暗房展柜）</strong></td>
  </tr>
  <tr>
    <td><a href="docs/showcase/artifact-detail-light-en.png"><img src="docs/showcase/artifact-detail-light-preview.png" alt="英文浅色器物档案详情页：馆藏元数据与 3D 直达入口" /></a></td>
    <td><a href="docs/showcase/digital-exhibit-dark-en.png"><img src="docs/showcase/digital-exhibit-dark-en.png" alt="英文深色 3D 展厅：已加载实体模型与控制面板" /></a></td>
  </tr>
</table>

<details>
<summary>展开查看：后台管理工作台与深色预约/展厅截图</summary>

<br />

<table>
  <tr>
    <td width="50%" align="center"><strong>数字展厅入口（英文深色）</strong></td>
    <td width="50%" align="center"><strong>预约参观（英文深色）</strong></td>
  </tr>
  <tr>
    <td><a href="docs/showcase/gallery-dark-en.png"><img src="docs/showcase/gallery-dark-en.png" alt="英文深色数字展厅入口" /></a></td>
    <td><a href="docs/showcase/booking-dark-en.png"><img src="docs/showcase/booking-dark-en.png" alt="英文深色预约参观完整页面" /></a></td>
  </tr>
  <tr>
    <td width="50%" align="center"><strong>后台内容管理（中文深色）</strong></td>
    <td width="50%" align="center"><strong>后台内容管理（中文浅色）</strong></td>
  </tr>
  <tr>
    <td><a href="docs/showcase/admin-content-dark-zh.png"><img src="docs/showcase/admin-content-dark-zh.png" alt="深色内容管理完整工作台" /></a></td>
    <td><a href="docs/showcase/admin-content-light-zh.png"><img src="docs/showcase/admin-content-light-zh.png" alt="浅色内容管理完整工作台" /></a></td>
  </tr>
  <tr>
    <td width="50%" align="center"><strong>商品运营（中文深色）</strong></td>
    <td width="50%" align="center"><strong>3D 展项管理（中文深色）</strong></td>
  </tr>
  <tr>
    <td><a href="docs/showcase/admin-products-dark-zh.png"><img src="docs/showcase/admin-products-dark-zh.png" alt="深色商品管理工作台" /></a></td>
    <td><a href="docs/showcase/admin-exhibits-dark-zh.png"><img src="docs/showcase/admin-exhibits-dark-zh.png" alt="深色 3D 展项管理工作台" /></a></td>
  </tr>
</table>

</details>

---

## 技术栈与架构边界

| 维度 | 选型与实现 |
| --- | --- |
| **前端** | Vue 3 (`3.5`) + TypeScript + Vite (`7`) + Pinia + Vue Router + Three.js (`0.185`) + GSAP + Element Plus（后台按需） |
| **后端** | Java 17 + Spring Boot `3.5.0`（Web / Security / Validation / Data JPA）+ Flyway + MySQL 8 |
| **工程质量** | Vitest 单元测试、Playwright 端到端与视觉巡检、首屏 JS/CSS 包体与音频资源预算门禁 |
| **部署** | Docker Compose（`deploy/compose.yaml`）+ Nginx（已为 `/api/v1/guide/chat/stream` 关闭 SSE 代理缓冲） |
| **项目边界** | 课程与工程演示项目；商城仅支持**模拟支付**；管理员不可公开注册；邮件在本地通过 Mailpit 调试 |

> 部分 3D 模型与展馆声学采样基于 Cleveland Museum of Art、VSCO 2 CE 与 VCSL 的 `CC0` 开放资源，具体来源与授权以资产台账及展项说明为准。

---

## 本地启动

### 方式一：Docker Compose（推荐）

前提：已安装并启动 Docker Desktop。

```bash
git clone https://github.com/DiandianDD-996/heluo-digital-museum.git
cd heluo-digital-museum
cp deploy/.env.example deploy/.env
docker compose --env-file deploy/.env -f deploy/compose.yaml up --build -d
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
```

<details>
<summary>Windows PowerShell 命令</summary>

```powershell
git clone https://github.com/DiandianDD-996/heluo-digital-museum.git
Set-Location heluo-digital-museum
Copy-Item "deploy\.env.example" "deploy\.env"
docker compose --env-file deploy\.env -f deploy\compose.yaml up --build -d
docker compose --env-file deploy\.env -f deploy\compose.yaml ps
```

</details>

服务启动后访问：

- **前台展厅**：<http://localhost:8088>
- **健康检查**：<http://localhost:8088/api/v1/health>

管理员初始账号由本机 `deploy/.env` 中的 `MUSEUM_BOOTSTRAP_ADMIN_*` 变量决定（`deploy/.env` 已被 Git 忽略，切勿提交）。如需开启洛笙 AI 向导，可在构建/运行环境中设置 `VITE_GUIDE_ENABLED=true` 与 `MUSEUM_GUIDE_ENABLED=true` 并注入模型密钥。

停止服务：

```bash
docker compose --env-file deploy/.env -f deploy/compose.yaml down
```

### 方式二：本地开发与校验

```bash
# 前端：类型检查、单元测试与生产构建（含包体与音频预算门禁）
cd frontend
pnpm install
pnpm typecheck
pnpm test
pnpm build

# 后端：Maven 测试套件
cd ../backend
mvn test
```

---

## 项目文档

- [项目当前状态与下一步](PROJECT_STATUS.md)
- [设计系统规范（Heluo Editorial 2.0）](design.md)
- [洛笙 AI 向导 v2（唯一事实入口）](docs/luosheng/README.md)
- [需求追踪表](docs/01-requirements-traceability.md)
- [数据模型与权限边界](docs/04-data-and-permissions.md)
- [API 接口契约](docs/05-api-design.md)
- [测试与验收计划](docs/06-test-plan.md)
- [展馆声景 R4 来源与许可](frontend/public/media/audio/music-r4/CREDITS.md)
