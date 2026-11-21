# 移动端英文账户入口完整显示

## 1. 目标

修复已登录用户在移动端切换英文后，公共 Header 的 `Account` 入口被视口右侧裁切的问题，覆盖 320–760px 的公开页和 3D 展项页。

关联需求：`F-05`、`F-08`、`F-12`、`F-14`、`N-03`、`N-06`。

## 2. 根因

移动端普通公开页仍显示账户文字，英文品牌、主题按钮、语言按钮与账户按钮的总宽度超过 393px 可用空间；品牌链接保持 `flex: 0 0 auto`，工具区无法获得稳定的三个触控槽，最终账户按钮向右溢出。

## 3. 影响范围

- `frontend/src/assets/main.css`
- `frontend/src/test/PublicHeaderBrand.spec.ts`
- `PROJECT_STATUS.md`
- `docs/01-requirements-traceability.md`

不修改登录状态、用户昵称、路由、API、鉴权、3D 场景或桌面 Header。

## 4. 实施方案

- 移动端公共 Header 的品牌区改为可收缩布局；印章固定，品牌文字允许省略。
- 主题、语言、账户三个工具槽统一为 `44×44px`。
- 账户入口使用已有 `User` 图标并隐藏移动文字；完整名称继续由现有 `aria-label` 提供。
- 极窄屏隐藏主题文字，语言按钮继续显示 `EN/中文`。

## 5. 验收标准

- 320、390、393、430px 的中英文、登录/未登录 Header 均无横向溢出或控件裁切。
- 账户入口完整可见，命中区不小于 `44×44px`，可访问名称保持正确。
- 桌面 Header 与 3D 内容不回归；专项测试、全量测试、类型检查、构建、页面映射和 `git diff --check` 通过。

## 6. 风险

- 320px 英文品牌可能使用省略号，这是为三个必要工具入口保留稳定触控空间的预期降级。
- 浏览器视口回归不替代原实体手机的浏览器工具栏、安全区和系统字体缩放验收。

## 7. 验证结果

- 专项 `PublicHeaderBrand.spec.ts` 与 `PublicResponsivePolish.spec.ts` 共 `14/14` 项通过；前端全量 Vitest `49` 个文件 / `264` 项、类型检查、生产构建及移动首屏构建预算通过。
- 本地真实页面在英文模式下覆盖 `/explore`、`/appointment`、`/shop`、`/exhibits/heluo-bronze-ding-3d` 及 320/390/393/430px 四档宽度：主题、语言、账户三个控件均为 `44×44px`，账户图标为 `18×18px`，账户文字隐藏，所有控件完整位于 Header 内，页面横向溢出为 `0`。
- 393px 的 3D 展项页 Header 可用宽度为 `378px`，工具区横坐标为 `225–365px`，账户按钮为 `321–365px`，完整落在 Header 内。
- 页面映射审计 `32/32` 通过；桌面 Header、登录状态、路由、API、鉴权和 3D 内容未修改。
- 当前工作树白名单包包含 `311` 个条目、`17,479,329 B`，SHA-256 为 `d0fb9d7521dd28a25919917a77707a0da082a1b29a666cb91516ba33b8f572e5`；禁用项和缺失必需文件均为 `0`，保留 `23` 个运行必需的 Flyway 迁移。从压缩包解出的全新目录通过传统 Docker 构建，镜像 ID 为 `40d98275d84d`。
- PocketBay 配对页明确选择现有项目 `#329 / heluo`，只批准 `pocketbay.properties`；deployment `1134` / release `639` 返回 `next_action=done`、`project_status=running`，并替换活动 release `634`。
- 正式英文页面 320/390/393/430px × `/explore`、`/appointment`、`/shop`、3D 展项共 `16/16` 组通过：三个 Header 控件均为 `44×44px`，账户图标为 `18×18px`，账户文字隐藏，控件完整位于 Header 内，页面横向溢出为 `0`。已登录 `jie` 状态在 390/393/430px 同样通过；393px 3D 页账户按钮横坐标为 `321–365px`。
- `/`、Explore、预约、商城、3D、登录与 health 均为 `200/UP`；HTML 为 `no-cache, must-revalidate`，哈希资源为 immutable，移动 GLB Range 为 `206 bytes 0-1023/837720`。
- 原实体手机浏览器工具栏、安全区、系统字体缩放与强制颜色仍待用户在刷新后复验；本轮未执行 Git commit、push、reset 或工作树清理。
