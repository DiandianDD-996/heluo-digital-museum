# 浅色主题可读性微调计划

- 日期：2026-08-14
- 状态：已完成
- 关联需求：`F-05`、`N-03`、`N-06`

## 目标

在不调整展项布局、Three.js、导览状态机、路由或接口的前提下，提升浅色数字展厅导览轨道中未激活步骤的文字可读性。真实 `390×844` 页面复核显示，当前暖纸 Dock 上的六段步骤标签在首屏中视觉过淡；本轮将它们从纯辅助色提升到正文级墨绿，并保留当前步骤的青玉强调。

## 影响范围

- `frontend/src/assets/moonhall-light.css`：仅限浅色主题的展厅 Dock 导览文字令牌。
- `frontend/src/assets/MoonhallLightTheme.spec.ts`：增加防回归的样式契约。
- `PROJECT_STATUS.md`、`docs/01-requirements-traceability.md`：记录范围与验证结果。

## 步骤

1. 在既有 Moonlit Hall 浅色覆盖层中调整未激活导览标签颜色，不改变字号、轨道、按钮或状态选择器。
2. 扩展样式契约，保证浅色模式使用正文级令牌且深色主题不被该规则覆盖。
3. 运行专项测试、类型检查和生产构建；重建前端容器后以真实 `390×844` 与桌面页面复核。

## 验收标准

1. 浅色 `390×844` 与桌面数字展厅中，“器形概览”至“来源说明”可直接辨识，当前步骤仍有青玉强调。
2. 无横向溢出；实体/点云切换、导览步骤和视角按钮可用。
3. 深色主题未被浅色选择器覆盖；类型检查、相关 Vitest、生产构建和 Docker 页面回归通过。

## 风险

- 当前工作区含大量未提交的并行修改；仅编辑本计划列出的文件，不重置或格式化无关内容。
- 原有 `main.css` 使用高特异性展厅规则；继续采用后置的 `html:not([data-theme="dark"])` 范围，浏览器计算样式作为最终依据。

## 验证结果

- 专项：`pnpm vitest run src/assets/MoonhallLightTheme.spec.ts` 通过，`1` 个文件/`6` 项。
- 工程：`pnpm typecheck`、`pnpm build` 与 `git diff --check` 通过。
- Docker：使用 `docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --build frontend` 重建；`/` 与 `/exhibits/heluo-bronze-ding-3d` 返回 HTTP `200`。
- 实页：应用内浏览器以 `390×844` 强制视口复核，六段标签计算字号均为 `13.12px`；当前项为青玉、其余项为正文墨绿，页面宽度 `375px`、`scrollWidth=375px`。点云模式切换后按钮进入“返回实体模型”状态，Canvas 保持 `running`。
- 未补验：真实手机、触控笔和 Windows 系统级强制颜色。
