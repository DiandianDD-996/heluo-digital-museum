# 移动端固定导航安全区修复

## 目标
为 Explore、预约、商城等移动页面的固定底部导航补齐系统安全区偏移，避免导航压住页面末尾内容。

## 关联问题
UI-003：390×844 中途滚动截图显示 fixed `.mobile-tab-bar` 与内容重叠，但该截图不足以证明末尾内容无法滚动到可操作区域。安全区偏移属于兼容性补齐；不能声称原截图已经证明底部阻断。证据目录：`C:/Users/Jie/AppData/Local/Temp/heluo-ui003-final-1789196799530/`。9月12日 Android 真机最终滚动验证末尾入口可达，详见 `2026-09-12-android-candidate-verification.md`。

## 实施范围
- `frontend/src/assets/main.css`
- 在 0–760px 与 761–900px 的 `.mobile-tab-bar` 规则中使用 `bottom: calc(.75rem + env(safe-area-inset-bottom))`。

## 禁止修改
不修改路由、API、业务状态机、页面内容、导航结构或桌面布局。

## 验收
- `pnpm run typecheck`
- `darkThemeCohesion.spec.ts`：记录既有首页背景断言失败，不归因于本修复。
- 重新执行移动端截图并确认固定导航与末尾内容存在安全间距。

## 状态
代码修复已完成。追加真实 Playwright 复验：首页深色中英文在动画完成与 reduced-motion 下两行标题均完整包含；展厅列表真实入口为 `/exhibits/heluo-bronze-ding-3d`。未提交、未推送、未部署。
