# 鼠标浅色对比与鎏金点细节精修

## 目标

以用户确认的浅色、深色首页效果图和新增鼠标细节参考图为视觉基准，在不改变点阵数量、间距、页面布局、业务逻辑和输入降级规则的前提下，精修三项细节：浅色背景上的鼠标识别度、单圈光标材质、深色主题中少量鎏金节点的热芯与柔光层次。

## 关联需求

- F-01 / F-02 / F-03 / F-05 / F-06 / F-09：公开前台首页、馆藏、展厅、预约和商城交互体验。
- N-03 / N-04 / N-06：响应式、性能降级、无障碍和可维护性。

## 视觉基准

- `artifacts/pointer-polish/home-light-reference.png`
- `artifacts/pointer-polish/home-dark-reference.png`
- `artifacts/pointer-polish/pointer-detail-reference-image2.png`
- `artifacts/pointer-polish/home-light-implemented.png`
- `artifacts/pointer-polish/home-dark-implemented.png`
- `artifacts/pointer-polish/dark-gold-field-detail.png`

细节约束：

1. 光标保持 `7px` 即时核心与 `46px` 单圈阻尼光晕；不增加第二圈、雷达、准星或 Canvas 中心环。
2. 浅色纸面仅在光标附近使用羽化的低强度青玉灰对比场，不能形成可见灰盘或全局遮罩。
3. 点阵数量、规则间距和青玉主结构不变；金色节点仍然稀疏。
4. 深色主题只有鼠标附近少量金点进入高亮态，使用月白热芯、鎏金主体和短距离琥珀柔光；普通金点保持小而克制。
5. 路线项和卡片继续使用现有 `data-pointer-surface` 局部反馈，不扩大到相邻卡片。

## 影响范围

- `frontend/src/components/PointerDotField.vue`：按主题与表面变体绘制青玉/鎏金材质层次和少量高亮金点。
- `frontend/src/assets/pointer-motion.css`：精修单圈光晕、浅色局部对比场和深浅主题令牌。
- `frontend/src/assets/pointerMotionVisual.spec.ts`、`frontend/src/components/PointerDotField.spec.ts`：锁定单圈、浅色对比场、金点数量不增加和降级边界。
- `PROJECT_STATUS.md`、`docs/01-requirements-traceability.md`：记录实现与验证结果。

不修改点阵生成算法、共享 RAF、鼠标坐标热路径、页面结构、API、路由、鉴权、Three.js、表单或移动端交互。

## 实施步骤

1. 固化三张视觉参考图并审查现有光标/点阵实现。
2. 为纸面场增加仅在点阵激活时显示的局部羽化对比层；图片/深色场不使用该压暗层。
3. 将单圈材质拆为同一边缘上的月白、香槟金和青玉层次，保持一个几何圆环。
4. Canvas 金点使用基础主体、活跃主体和只属于少量高活跃节点的热芯；不改变点的数量和位置。
5. 补充专项测试，运行前端全量测试、类型检查、生产构建、指针体积、性能和页面映射门禁。
6. 复核实际首页深浅主题、控制台、横向溢出与降级模式；记录未执行的实体设备验证。

## 验收标准

- 浅色首页的鼠标核心和单圈在白墙、玻璃、山景上均清楚，但无可见灰色圆盘。
- 深色首页金点分布不变，仅焦点附近约 `3–5` 个节点呈现更亮的金属热芯与短柔光。
- 光标始终是单圈；快速移动仅保留既有受控拉伸，停止后恢复圆形。
- 青玉点负责规则结构，鎏金点负责局部视觉焦点；不出现满屏星空或霓虹。
- 粗指针、减少动态、高对比度、强制颜色和减少透明度降级不回归。
- 所有相关工程门禁通过，未验证项如实记录。

## 风险

- Canvas `shadowBlur` 过大会导致深色主题泛黄并增加绘制成本，因此只对高活跃金点使用短柔光。
- 浅色局部对比层过强会形成灰盘，因此最大强度限制在低透明度并使用大范围羽化。
- 当前工作树存在大量既有未提交修改，本次只在上述文件内做增量编辑，不还原或覆盖无关改动。

## 验证结果

- 专项回归：`PointerCursor`、`PointerDotField`、点阵算法、视觉契约与页面映射共 `25` 项通过。
- 前端全量：Vitest `25` 个文件 / `94` 项通过；`vue-tsc --noEmit` 通过；Vite 生产构建通过。
- 交互体积：JS `17,991 B / 6,636 B gzip`，低于 `18,000 B / 7,000 B gzip` 预算；CSS `7,233 B / 1,833 B gzip`；无布局属性 transition。
- 生产性能：Docker 正式地址 `http://localhost:8088` 的 `perf:pointer` 全部门禁通过；普通路由 1x CPU 指针派发平均 `0.091ms`、RAF 回调平均 `0.172ms`，4x CPU 能降为 static。
- 页面门禁：首页、馆藏、展厅、商城共 `32` 组固定视口通过，无横向溢出、无控件裁切、每个批准主视觉仅一个非阻塞点阵。
- 部署：前端已使用 `--no-cache` 重建并替换，镜像 `sha256:6573eb6af35e0fe186777745202db75c2181ab59bc450a0c16df0edcc01adf5a`，首页 HTTP `200`。
- 生产浏览器：`1672×941` 浅色/深色首页均确认 `theme` 正确、点阵为 `active`、光标 intent 正确、横向溢出为 `0`，控制台无 error/warning；视觉截图已写入上述实施证据路径。
- 未验证：实体手机、触控笔与系统级强制颜色未因本次桌面视觉增量重复人工复验；自动降级门禁已通过。
