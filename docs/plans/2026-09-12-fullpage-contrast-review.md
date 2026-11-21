# 全页直接文字对比度复核

关联V3.1 A/O、N-03/N-06。既有axe incomplete与首屏采样不足以代表全页，因此使用现有`frontend/scripts/premium-background-contrast.mjs --extended`对双语/双主题、390/1440宽度的112个默认路由状态滚动复核。

## 结果

`artifacts/premium-visual-2026-09-12/fullpage-contrast/summary-extended.json`：complete=true，首尾HTML指纹均为3495c669d2105dfd50f905d00f57f850beffea0a0b3cb89b138dba3bbf7d7fc8。共112路由状态、310滚动视口、7493个直接文字样本，低于对应4.5/3阈值的样本0。

覆盖文档滚动，步进700px/900px视口重叠；隐藏文字填充后按文字矩形每3px读取实际合成背景，以computed前景和祖先opacity计算对比。排除禁用控件、视口外/被遮挡文字。不是全像素或整站所有交互状态证明。

首次在桌面英文预约入口等待h1超时，进程退出1；报告保持complete=false。脚本新增同构建、相同路由/主题/语言/宽度/offset续跑，保留已完成样本，第二次退出0并核对末尾指纹。没有删除或用新构建替代失败记录。最终按112组去重核对覆盖数。

## 限定与后续

- reset路由默认呈现仍与登录相关；不代表重置表单状态已触发，状态证据沿用独立state-gaps报告。
- 不覆盖嵌套滚动容器、全部伪元素/图形、鼠标与键盘所有状态、真机显示或屏幕阅读器。
- 此后新增html scroll-padding仅影响焦点滚动目标，不更改文字/背景色；其行为需单独验收。
- 无产品颜色修改、无业务写入（仅隔离管理员登录）；未部署。
