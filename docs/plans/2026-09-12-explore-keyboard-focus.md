# Explore 搜索键盘焦点补齐

## 目标与关联需求
F-02、N-03、N-06；对应 V3.1 A Focus / C2 Search / E Explore。保留用户选择的一体化搜索尺寸、字体、浅色绿/深色古铜配色与轻边界，仅补齐可辨认的键盘焦点。

## 任务卡
| 项目 | 规格 |
|---|---|
| 页面与当前实现 | `/explore`；`MuseumSearchField.vue` 的 input 原生 outline 被 `explore-gallery.css` 设为 none；外层 focus-within 使用1px半透明边线和3px低透明度光晕 |
| 可复现问题 | 当前构建 `010de749…` 浅色390/1440焦点边界采样最低约2.29:1，截图确认没有2px实线焦点环 |
| 证据 | `artifacts/premium-visual-2026-09-12/control-boundaries/summary.json` 与浅色 focus PNG |
| 保留内容 | 默认/hover边框、鼠标交互、字体、420×46px尺寸、按钮位置、双主题及全部搜索行为 |
| 目标与具体修改 | 外层仅在包含 `input:focus-visible` 时增加2px实线outline、2px offset，复用 `--gallery-tab-focus`；强制颜色模式使用系统 Highlight |
| 影响文件 | `frontend/src/assets/explore-gallery.css`；调用方只有 Explore 的 `.gallery-search` |
| 禁止修改 | 组件API、事件、路由、搜索数据与状态；不为消除报告review而加深所有默认边框 |
| 验收方法 | 键盘Tab焦点、双主题390/1440计算样式与像素复核；类型检查、Explore相关测试、生产构建；已有搜索交互专项 |
| 完成条件 | input获得键盘焦点时2px实线/2px分离，文字与控件不位移；鼠标/默认保留，Enter与清除行为通过 |

## 风险与设计复核
历史全局 `!important` 可能覆盖焦点；在既有局部规则后声明明确作用域，浏览器验收最终值。使用 frontend-design 的遵循已有视觉方向和克制原则，不更换布局或品牌色。默认边框低于3:1的采样不是本规格强制加深依据，仍单独审查其识别作用。

## 验证结果
`artifacts/premium-visual-2026-09-12/focus-after/summary.json`：a7f7eb18构建，390/1440双主题共8个default/focus样本；4个focus样本均为2px outline、2px offset，浅色最低5.94:1、深色11.86:1。4个default淡边界仍保留review，不因焦点修复宣称全部边界达标。

`artifacts/explore-keyboard-focus-20260912/summary.json`：passed=true，320/390/768/1024/1366/1440双主题双语24组搜索检查通过；属于实际搜索专项，不是全站所有控件键盘流程。构建与报告对应关系见V3.1证据索引，后续首页文字色及商城局部避让不作为本专项重跑。无提交、推送或部署。
