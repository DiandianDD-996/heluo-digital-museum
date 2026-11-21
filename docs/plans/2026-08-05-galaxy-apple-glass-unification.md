# Galaxy × Apple Glass 组件统一实施计划

## 目标

在不改变路由、接口、身份权限、预约/订单状态机、Three.js 所有权或页面信息架构的前提下，将现有“河洛纸墨”视觉系统的按钮、交互卡片、输入面板和分段选择统一为克制的 Apple 毛玻璃体验；Galaxy 仅作为 CSS 交互细节原型来源。

## 关联需求

- `F-01`、`F-02`、`F-03`：公开浏览、搜索与详情操作保持可用。
- `F-04`、`F-07`、`F-11`、`F-13`：后台操作、表单和状态按钮保持权限与语义。
- `F-05`：3D 工具、实体/点云切换、导览 Dock 不改变 Three.js 生命周期和手势。
- `F-06`、`F-08`、`F-09`、`F-10`：预约、认证、购物袋、模拟支付不改变校验与幂等边界。
- `N-03`、`N-06`：320–1672px 响应式、可访问性、类型检查、测试和生产构建。

## 参考与选型

- Galaxy 快照：`uiverse-io/galaxy@adbd2adde0a299a3956ea288fb444ec01891ca41`，MIT。
- 按钮：`Buttons/BurgiSimon_wonderful-seahorse-35.html` 的内高光、底部填充与按压深度。
- 信息卡：`Cards/joe-watson-sbf_honest-bullfrog-6.html` 与 `Cards/SteveBloX_dangerous-warthog-85.html` 的材质层级。
- 复选框：`Checkboxes/talhaabu1_odd-cobra-97.html` 的描边勾选；当前业务页面没有原生复选框，作为共享组件预置，不新增必填业务条件。
- 分段选择：`Toggle-switches/cbolson_slippery-treefrog-30.html` 的滑动选中板。

所有颜色、圆角、间距和辅助功能降级仍以 `design.md` 与 `main.css` 命名令牌为准；不复制 Galaxy 中的颜色、无限动画、3D 翻转或弹性曲线。

## 影响范围

- 共享：`FluidButton.vue`、`AdminActionButton.vue`、`AdminTabs.vue`，新增无业务副作用的 `GlassCheckbox.vue`。
- 全局样式：`frontend/src/assets/main.css` 只追加组件契约和既有选择器的统一规则。
- 页面标注：公开内容卡、预约信息卡、商城商品卡、3D 分段切换和后台操作控件增加语义化 `data-galaxy-*` 标记；不改 API 调用、表单字段、状态或路由。
- 测试：为共享组件和关键标记新增/扩展单元测试。

## 实施步骤

1. 将 `FluidButton` 收口为 44px 最小触控高度、1px 材质边、可访问 loading/success/error 状态和 1px 按压反馈；保留现有 `motion-v`。
2. 建立 `GlassCheckbox`：原生输入仍可聚焦，SVG 勾选描边动画在减少动态时静态完成，组件不绑定任何业务字段。
3. 将后台操作按钮和 tabs 改为同一材质、状态、焦点和键盘交互合同。
4. 给已有公开卡片、预约卡、商城卡和 3D 切换器标注统一契约；用 CSS 将卡片高光、图片信息条和滑动分段选择映射到现有令牌。
5. 针对 `prefers-reduced-motion`、`prefers-reduced-transparency`、`prefers-contrast` 保持可读、可操作的实色降级。
6. 运行 typecheck、Vitest、生产构建、页面映射/性能门禁；可用时启动本地服务做桌面与手机浏览器截图和横向溢出检查。
7. 更新 `PROJECT_STATUS.md` 与需求追踪表，仅记录验证通过的事实。

## 验收标准

- 同类主/次/危险按钮、后台操作、分段选择和图片信息卡视觉状态一致；交互目标不低于 44px（紧凑表格内操作保留现有 38px 桌面密度，并在手机升至 42px）。
- `hover`、`focus-visible`、`active`、`disabled`、`loading`、`success/error` 可区分；按压最大 1px / `scale(.98)`，无弹跳。
- 减少动态、减少透明度、高对比度下仍有可见边界、对比与状态。
- 预约、购物车、模拟支付、3D 实体/点云、后台 CRUD 行为不变。
- 现有前端类型检查、测试、生产构建，以及页面/指针性能门禁通过；截图回归无横向溢出、无新增控制台错误。

## 风险与回滚

- `main.css` 已有其他未提交的指针与动效工作。本任务只追加命名规则和紧邻目标组件的选择器，不覆盖或回退既有改动。
- 玻璃滤镜可能增加低端设备合成成本，因此不扩大玻璃覆盖面积，复用现有 reduced-transparency 与 motion-tier 降级。
- 若视觉回归破坏 3D Dock、预约表单或后台紧凑密度，删除本任务追加的 `data-galaxy-*` 样式块即可回退，不涉及数据或业务逻辑。

## 验证结果

待实施后填写。
