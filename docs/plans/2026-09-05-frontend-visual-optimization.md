# 河洛数字博物馆前端视觉优化方案

## 目标

在保留现有「器物—纹样—故事」品牌叙事的前提下，降低装饰性玻璃效果，提升首页首屏速度、馆藏探索效率、数字展厅互动理解度和预约转化率。

## 三个可选视觉方向

1. **展卷叙事（推荐）**：纸面、青玉、古铜、纵向展签；适合全站主方向。
2. **月厅静谧**：深墨舞台、月白文字、青铜高光；适合数字展厅与夜间模式。
3. **策展档案**：高对比白纸、黑墨、红印章；适合馆藏检索、文章与后台内容管理。

对应可交互 HTML 初稿：

- `docs/design-prototypes/01-river-scroll.html`
- `docs/design-prototypes/02-moon-hall.html`
- `docs/design-prototypes/03-curatorial-archive.html`

## 锐评结论

- 当前视觉辨识度高，但首屏存在等待空白，影响可信度。
- 首页氛围强，核心动作（探索、展厅、预约）不够明确。
- 玻璃、噪点、边框、阴影叠加后，操作层级不够硬。
- 展厅的 3D 价值没有在第一屏被充分表达。
- 预约页业务完整，但还不像高可信票务流程。
- 移动端固定导航完整，但预约没有被突出，反馈浮层干扰品牌。

## 推荐色彩体系

```css
--paper-0: #f4f1e8;
--paper-1: #ebe7dc;
--paper-2: #ddd8ca;
--ink-strong: #173b35;
--ink-body: #40534c;
--ink-muted: #78837a;
--jade: #176653;
--jade-deep: #0f493d;
--bronze: #a87842;
--bronze-soft: #d4b486;
--line: rgba(35, 62, 53, .16);
```

使用规则：L0–L3 四级表面；表单、日期、按钮使用实色；透明效果只保留在背景或导航层；深色只用于文字、3D 舞台和少量叙事锚点。

## 页面改造

### 首页

- 首屏先显示标题与 CTA，再加载背景与动效。
- 固定展示「探索馆藏 / 进入数字展厅 / 预约参观」三个入口。
- 增加开放信息、参观时长、线上展览说明等信任信息。

### 馆藏探索

- 搜索器提前到首屏上半区。
- 筛选项显示数量、清除筛选和空结果状态。
- 卡片统一展示图像、类别、名称、材质/时期、3D 可用性。

### 数字展厅

- 桌面端 55% 3D 舞台 + 45% 展签信息。
- 明确「旋转、缩放、切换视角、重置、全屏」。
- 增加加载、失败、低画质和版权来源状态。

### 预约

- 使用突出当前步骤的 Stepper。
- 日期卡片显示可预约时段和余量。
- 移动端固定「上一步 / 下一步」操作栏。
- 完成后输出可保存的预约票据和日历入口。

## 实施顺序

1. 修复首屏空白等待感、图片降级和 3D 加载状态。
2. 重做首页 CTA、预约 Stepper、移动端固定操作栏。
3. 统一 `tokens.css`、`glass.css`、`task-pages.css` 的 L0–L3 表面合同。
4. 优化馆藏搜索、空状态、筛选反馈和展厅操作说明。
5. 最后再精修纹理、动效、字体比例和青铜色使用比例。

## 验收门槛

- 文字首屏 < 300ms；可点击 < 1.5s；LCP < 2.5s。
- 用户 3 秒内找到「探索馆藏」，5 秒内找到「预约参观」。
- 3D 加载失败时仍可阅读展项说明。
- 键盘、焦点、禁用、错误、成功状态完整；移动端 CTA 不被底部导航遮挡。

## 影响文件建议

- `frontend/src/views/HomeView.vue`
- `frontend/src/views/ExploreView.vue`
- `frontend/src/views/ExhibitsView.vue`
- `frontend/src/views/AppointmentView.vue`
- `frontend/src/assets/tokens.css`
- `frontend/src/assets/glass.css`
- `frontend/src/assets/task-pages.css`
- `frontend/src/assets/mobile-performance.css`


## 重做记录（2026-09-05）

三版原型已重做为真实资产驱动版本，不再使用 CSS 几何图形伪造展品：

- 方向一使用 `museum-corridor-hero-hd-v2.webp`，验证首页建筑叙事。
- 方向二使用 `exhibit-ding-moonlight.webp`，验证深色数字展厅舞台。
- 方向三使用青铜爵、玉璧和彩陶真实封面，验证馆藏检索密度。

已通过本地 HTTP 页面验证：三版均可打开，图片正常加载，并覆盖桌面端与移动端断点。
