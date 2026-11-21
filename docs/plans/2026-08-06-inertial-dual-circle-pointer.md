# 惯性双圆拖拽鼠标动效

## 目标

根据用户对 Chanly 参考站的明确反馈，将当前“发光点 + 固定细环”重做为惯性双圆交互：小圆即时跟随鼠标，大圆带阻尼延迟跟随，快速移动时产生受控拉拽伸缩；点阵退回为安静的科技背景，不与主交互焦点竞争。

## 关联需求

- F-01 / F-02 / F-03 / F-05 / F-09：公开前台品牌展示与鼠标交互。
- N-03 / N-06：输入能力、性能、媒体偏好与资源释放。

## 交互契约

1. 小核心为 `7px` 月白青玉光点，使用共享位置热通道即时更新。
2. 大圆为 `46px` 半透明青玉光晕，按帧率无关阻尼追随小核心；静止后追上并停止 RAF。
3. 快速移动时大圆沿运动方向轻微拉长，最大轴向比例受限；不使用弹簧回弹、夸张缩放或多重圆环。
4. 仅在四个既有点阵主视觉区域激活大圆，普通链接、表单、3D Canvas、键盘、pen/touch 和无障碍降级继续使用原有交互策略。
5. 点阵只保留局部圆形亮度/尺度波，移除 Canvas 自绘中心环，避免出现“双大圆”。

## 影响范围

- `frontend/src/components/PointerCursor.vue`
- `frontend/src/components/PointerDotField.vue`
- `frontend/src/assets/pointer-motion.css`
- 对应单元测试、项目状态与需求追踪。

不修改业务、路由、API、Three.js、后台和后端。

## 验收标准

- 实页可清晰观察到“小圆即时、大圆滞后追随”的拉拽关系。
- 快速移动时大圆仅有受控轴向拉伸，停止后自然归圆，且不再出现 Canvas 中心固定环。
- 单个共享 RAF、离开回收、低帧降级、减少动态/高对比度、pen/touch 和减少透明度策略不回归。
- 类型检查、测试、构建、性能、多尺寸、Docker 与浏览器实页验证通过。

## 风险

- 尾随阈值过低会造成静止后无意义续帧，过高会让拉拽感消失；需通过性能审计和实页目视共同校准。
- 半透明大圆在浅色回廊与深色图片上都必须可读，需使用月白高光与墨玉细边的双层对比。

## 验证结果

- `corepack pnpm test`：23 个测试文件、79 项通过；新增断言覆盖小点即时到位、大圆尚未到位/进入拉拽态，以及静止后回收共享 RAF。
- `corepack pnpm typecheck`、`corepack pnpm build`、`corepack pnpm perf:pointer-size` 通过；交互代码为 `16,308 B`（gzip `6,085 B`），无布局属性 transition。
- `HELUO_PERF_DURATION_MS=2000 corepack pnpm perf:pointer`：16 项性能、媒体偏好、后台暂停和输入设备门禁通过；`corepack pnpm qa:pointer-pages`：首页、馆藏、展厅、商城共 32 个尺寸组合通过，无横向溢出、裁切或点阵层拦截。
- Impeccable 检测目标组件/CSS 返回 `[]`；`git diff --check` 通过。
- 通过 `docker compose --env-file deploy/.env -f deploy/compose.yaml build --no-cache frontend` 重建并强制替换 `deploy-frontend-1`；实际运行镜像为 `sha256:a309c32206b715136814322c49630d80c805c7aa9502b8c5e799763bfad8e1eb`，首页 HTTP `200`，容器内 `/actuator/health` 返回 `UP`。
- 生产实页 `1440×900`：快速移动到 `(900,430)` 时小点已到该坐标，大圆仍在约 `(797,404)`，`data-pulling=true`、不透明度 `1`、无横向溢出；截图存于 `artifacts/page-mapping/home-inertial-dual-circle-drag-1440x900.png`，控制台错误为空。
- 首次 2 秒性能审计的后台暂停采样为 `4495ms`（距门禁 `4500ms` 少 `5ms`）而失败；重跑采样为 `5042.4ms`，16 项门禁均通过。该偶发计时抖动留作后续性能观察。
- 未重新执行后端 Maven 测试或实体鼠标/触控板/手机手感复测；本次未改后端与业务流程。
