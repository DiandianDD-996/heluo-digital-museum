# 文章 SPA 首次进入空白修复计划

## 目标

修复从“探索馆藏”通过站内路由进入文章详情时正文保持隐藏、必须刷新页面才能显示的问题，并保证三篇专题、桌面和手机路径一致可用。

## 关联需求

- `F-01`：游客可浏览已发布文章。
- `F-03`：游客可直接查看文章详情正文。
- `N-03`：桌面和移动端核心流程可用。
- `N-06`：路由和动效失败时提供稳定降级。

## 根因

探索页文章卡位于长页面下方，点击时浏览器处于较大的滚动位置。页面使用 220ms 同步进退场，但路由在退场完成前恢复滚动；内容详情又提前通过 `gsap.set` 隐藏正文。ScrollTrigger 按旧页面坐标初始化后未命中，正文持续处于 `opacity: 0 / visibility: hidden`，刷新后重新计算才恢复。

## 实施

1. 路由滚动等待页面退场完成后应用，并保留历史后退的 `savedPosition`。
2. 将内容详情滚动动画改为渐进增强：正文、事实、关联内容和 CTA 默认可见，仅在触发器实际进入时执行 `fromTo`。
3. 增加路由延迟/历史位置单测和正文禁止预隐藏的契约测试。
4. 执行类型检查、前端测试、生产构建、Docker 重建。
5. 在桌面和手机尺寸下，从探索页分别点击三篇专题，验证无需刷新即可显示。

## 验收标准

- 从探索页首次点击任一专题，详情从页面顶部打开，正文无需刷新即可出现。
- 动效未触发或初始化失败时，正文仍保持可见。
- 浏览器后退仍恢复探索页原滚动位置。
- 三篇文章无横向溢出或控制台错误。

## 验证结果

- `frontend/src/router/index.ts` 将新路由滚动恢复延后 `240ms`，覆盖 `220ms` 页面退场；浏览器后退继续使用 `savedPosition`。
- `frontend/src/views/ContentDetailView.vue` 已删除正文、事实、关联内容和 CTA 的预隐藏 `gsap.set`，改为内容默认可见、进入视口时才执行 `fromTo`，动效失效不再造成正文永久空白。
- `corepack pnpm exec vitest run src/assets/glassMaterials.spec.ts src/router/index.spec.ts src/views/ContentDetailView.spec.ts`：3 个文件、12 项通过；全量 `corepack pnpm test`：23 个文件、81 项通过；`corepack pnpm typecheck`、`corepack pnpm build` 和 `git diff --check` 通过。
- Docker 前端使用 `--no-cache` 重建并强制替换运行容器；运行镜像为 `sha256:f8de744ed9c3094a13459f2bec142e81350029c51d35c231fed784f2aebfd4a9`，首页 HTTP `200`，容器内 API health 为 `UP`。
- 生产实页从 `/explore` 逐一点击 `why-negative-space-matters`、`river-as-timeline`、`how-to-read-bronze`：桌面与 `390x844` 均在无需刷新时显示最终标题和正文，进入详情 `scrollY=0`、无横向溢出；手机端分别检测到 14、14、13 个可见正文段落。浏览器后退恢复探索页约 `scrollY=908` 的原卡片位置，控制台无警告或错误。
