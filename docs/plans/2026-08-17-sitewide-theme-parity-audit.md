# 全站浅深主题一致性审计与修复

## 目标

检查正式 `8088` 上公开页面、内容详情、3D 展项、预约、商城、登录以及可访问的主题控件，在浅色/深色切换后保持画布、卡片、控件和文字层级一致；修复已确认的 3D 页浅色残留。

## 关联需求

- `F-01/F-02/F-03/F-05/F-06/F-08/F-09/F-11/F-12/F-13/F-14`
- `N-03/N-06`

## 实施范围

- `frontend/src/assets/theme-controls.css`
- `frontend/src/assets/route-exhibit-detail-legacy.css`
- `frontend/src/assets/darkThemeCohesion.spec.ts`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`

## 审计方法

1. 在正式 Docker 页面逐路由切换主题，检查根主题属性、横向溢出和可见大面积背景。
2. 对首页、Explore、文物/文章详情、展厅列表、3D 展项、预约、商城和登录采样计算样式。
3. 对有效动态详情使用当前 API 返回的真实 slug，不把错误页当作业务页面证据。
4. 对发现的主题专属残留补充 CSS 合同测试，并跑前端全量质量门禁。

## 验收标准

- 深色 3D 页面不出现浅色视角缩略图、浅色激活模式按钮或浅色根背景露底。
- 浅色主题的 3D 控件几何和交互状态保持不变。
- 公开路由在两种主题下无横向溢出；主题切换不改变核心页面结构、API、路由、鉴权或 Three.js 行为。
- 非本次发现的实体设备、系统强制颜色、真实慢网和后台真实 CRUD 不标记为已验收。

## 验证结果

- 已在正式 Docker `http://localhost:8088` 对公开路由、内容详情、展厅、3D 展项、预约、商城、登录和已登录管理端进行浅色/深色切换抽样；根节点、页面画布、主要卡片、表单、按钮和输入控件均跟随 `data-theme`。
- 发现并修复 3D 页深色主题的三处残留：视角缩略图浅色底、实体/点云激活态浅色底、`html` 根节点浅色背景；修复后 3D 页根/页面背景为深色令牌，模式按钮和视角按钮均为深色材质，横向溢出为 `0`。
- 管理端 `/admin` 与 `/admin/operations` 已实页复核：深色和浅色下侧栏、页头、运营统计/列表卡、创建用户表单、输入框、tabs、操作按钮均保持对应主题材质；未发现浅色主题中的深色卡片或深色主题中的浅色卡片残留。
- 专项 `darkThemeCohesion.spec.ts` + `themeFoundation.spec.ts`：`22/22` 通过。正式 Docker 前端镜像：`sha256:0569e3a691dab9c37882c8b88d8bf5467c60e66c2580d2694b47f2a873301996`；页面 HTTP `200`，`/api/v1/health` 返回 `data.status=UP`。
- 全量前端 Vitest：`45` 个文件 / `251` 项通过；`corepack pnpm typecheck`、`corepack pnpm build`、`corepack pnpm qa:pointer-pages` 和 `git diff --check` 通过。构建仅有既有 Rollup 注释及大 chunk 提示，无失败项。
- 仍未替实体手机、触控笔、Windows 强制颜色/高对比度、真实慢网和后台真实 CRUD 验收；本轮未执行 Git commit。
