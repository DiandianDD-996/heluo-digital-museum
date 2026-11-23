# 首页首屏「浑仪磁阵」鼠标光点场定稿（2026-11-23）

- **日期**：2026-11-23
- **目标**：在保留首页 `<PointerDotField variant="image" />` 与 `PointerCursor` 架构的基础上，将首屏背景光点交互升级并定稿为「浑仪磁阵」（胡克弹性阻尼点阵 + 左文右鼎空间避让遮罩 + 预烘焙离屏光晕图章 + 星枢四芒星针与同心星环 + 2-最近邻渐变星轨连线 + 点击弹性冲击波），同步收净临时方案切换条与未选中分支代码。
- **关联需求**：F-01（首页策展入口）、N-01（首屏性能预算与响应式可用性）

## 影响范围

- 新增首屏专属光点场物理与渲染模块：`frontend/src/lib/heroDotFieldRenderers.ts`
  - **空间策展遮罩（`computeSpatialWeight`）**：在左侧主标题/正文阅读区与中央青铜方鼎本体处做平滑椭圆退晕，静止态不遮挡文字与主展品。
  - **物理与呼吸**：胡克定律弹簧阻尼回位、随鼠标速度方向拉伸的椭圆流线尾迹、悬停 0.4 Hz 微幅谐波呼吸、点击弹性冲击波；离场收敛后完全停止 `requestAnimationFrame`。
  - **双主题高定矿物配色（零黑底暗圈、零 `shadowBlur`）**：
    - 深色模式（乌金香槟 · 曜石星晖）：彻底去除冷绿点，统一为暗金琥珀 → 丝绸香槟金 → 象牙珍珠白高光核三阶同色系渐变。
    - 浅色模式（宣纸鎏金 · 金镶玉枢）：普通点为温润古铜鎏金 + 珍珠反光芯，1/11 星枢主点采用「金镶玉」（深墨玉芯 `oklch(35% 0.068 166)` + 香槟金外圈）。
  - **器物几何细节**：高能星枢节点浮现同心细环与微旋十字四芒星针；星轨采用 2-最近邻三段线性渐变丝线。
- 新增单元测试：`frontend/src/lib/heroDotFieldRenderers.spec.ts`
- 更新组件与样式：
  - `frontend/src/components/PointerDotField.vue`：`variant="image"` 自动走 `heroDotFieldRenderers.ts`，其余 `paper / heading` 页面行为 100% 不变。
  - `frontend/src/views/HomeView.vue`：保持 `<PointerDotField variant="image" />`，移除临时对比切换条，底部渐隐遮罩调优至 `76%`。
  - `frontend/src/App.vue`：从 `lightSwitcherRoutes` 移除 `'home'`，避免在首页展示不再生效的旧四套光效浮窗。
  - `frontend/src/styles/06-motion.css`：浅色模式下激活点阵时的 `PointerCursor` 外环与中心点同步对齐为古铜香槟金细环 + 深墨玉金边芯（「金镶玉」）。

## 验证结果

- `npx vue-tsc -b`：0 错误。
- `npx vitest run`：**75 文件 / 448 用例全绿**（含新增 `heroDotFieldRenderers.spec.ts` 3 例）。
- `npm run build` + 首屏预算门禁：通过；首屏 JS gzip `77,569 B / 81,638 B`；首屏 CSS gzip `10,281 B / 80,000 B`。
- Playwright（Edge 1440×900，深/浅双主题）：连续扫动帧耗时均值 `3.63–3.64 ms`（P95 `3.7 ms`），零控制台错误与页面异常。
