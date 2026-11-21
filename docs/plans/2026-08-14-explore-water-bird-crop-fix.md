# Explore 首件水鸟媒体裁切修复

## 目标

修复 `/explore` 首件“水鸟青铜雕塑”媒体图在桌面卡片中上沿裁切过紧、悬停缩放进一步遮挡头部的问题，让器物头部和背景上沿稳定留在卡片媒体舞台内。

## 关联需求

- `F-01/F-03`：公开馆藏卡片与详情入口的首图应清晰可辨。
- `N-03/N-06`：桌面与移动端不出现关键媒体裁切异常，且保留可回归的布局契约。

## 影响范围

- `frontend/src/assets/explore-reference.css`：仅调整 Explore 首件媒体的裁切位置、缩放和卡片裁切边界。
- `frontend/src/views/ExploreReferenceLayout.spec.ts`：增加首件媒体不裁切上沿的 CSS 契约。
- 不改变 API、路由、搜索、分类、分页、鉴权或订单/预约状态机。

## 实施与验收标准

1. 首件媒体使用更靠上的安全焦点位置，保留水鸟头部、鸟喙和上方背景。
2. 首件悬停不再通过额外缩放把头部推过媒体舞台上沿。
3. 卡片显式裁切媒体溢出，文字信息栏继续保持在卡片内部。
4. 专项测试、类型检查、生产构建和 `git diff --check` 通过。

## 验证结果

- Explore 专项测试：`pnpm vitest run src/views/ExploreReferenceLayout.spec.ts`，1 个文件 / 4 项通过。
- 前端全量测试：33 个文件 / 154 项通过；`pnpm typecheck` 通过；`pnpm build` 通过。
- `git diff --check` 通过；构建仍有既有 Rollup `@vueuse/core` PURE 注释和 chunk size warning，不影响本次修复。
- 未重复执行正式 Docker/浏览器截图；本次仅修改首件 Explore CSS 和契约测试，实体手机、触控笔及系统级强制颜色继续待补验。
