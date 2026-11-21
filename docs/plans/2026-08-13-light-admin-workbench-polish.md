# 浅色后台工作台导航与控件视觉优化

- 日期：2026-08-13
- 目标：修复浅色模式下后台侧边导航文字与背景融为一体的问题，并统一卡片、表单和操作按钮的层级、状态与触控尺寸。
- 关联需求：F-06、F-08、N-03、N-06（后台管理可读性、主题一致性与无障碍交互）。

## 影响范围

- `frontend/src/components/AdminShell.vue`：根据当前主题为侧栏及导航项选择 `light/dark` glass 层，避免浅色主题继承暗色导航文字。
- `frontend/src/assets/task-pages.css`：新增仅作用于浅色后台的纸张、青玉、古铜金 token 组合；重做导航 default/hover/active/focus-visible、摘要卡、工具条、表单卡、记录卡和主/次/危险按钮。
- `frontend/src/assets/taskPagesTheme.spec.ts`：增加浅色后台视觉契约断言。

## 设计决策

- 侧栏使用极浅青灰纸张底（`#edf6f1`），正文使用深墨青（`#123f3b`），辅助文字使用中青灰（`#52756f`），保证导航标题与副标题在浅色背景上有稳定对比度。
- active 导航使用浅青玉面板与古铜金左侧标记；hover/focus-visible 使用白玉高光和可见 focus ring，不改变路由和权限行为。
- 卡片采用轻量纸张渐变、顶部高光与方向性阴影；按钮按 primary/secondary/danger 统一尺寸（至少 44px）、圆角、边框、按压/悬停/键盘焦点反馈。
- 深色主题通过动态 `data-glass="dark"` 保持现有视觉契约，未改变 API、路由、业务状态机或权限边界。

## 验收标准

1. 浅色 `/admin` 与 `/admin/operations` 中导航标题、副标题和图标清晰可读，当前项有青玉面板与古铜金左标记。
2. 摘要卡、工具条、表单卡、记录卡在浅色模式下层级明显，主/次/危险按钮外观统一，按钮触控高度不小于 44px。
3. hover、pressed、focus-visible 状态可见；`prefers-reduced-transparency`、`prefers-contrast`、`forced-colors` 降级规则继续有效。
4. `pnpm typecheck`、相关 Vitest、生产构建通过；浏览器桌面与移动视口无横向溢出。

## 风险与未验证项

- 浏览器截图参考由已登录的 Chrome ChatGPT Web 生成，仅作为设计方向，不作为线上资源。
- 实体手机、触控笔和系统级强制颜色仍需现场补验。
