# Android 候选版本真机复验

## 目标与范围
关联 F-01/F-02/F-05/F-06、N-03/N-06。通过用户已开启 USB 调试的实体 Android Chrome 检查当前本地候选版本，补充页面布局与 3D 真实运行证据。只采集诊断、更新验收工具和文档；不修改 Three.js 生命周期、业务状态机，不提交或部署。

## 环境与方法
- V2366HA，Chrome 133.0.6943.121；ADB 已授权，4189 反向端口映射与 CDP 19222 可用。
- 访问本地生产预览 `http://127.0.0.1:4189`，使用实际手机视口，不使用桌面移动模拟或覆盖 viewport。
- 基础检查：首页、馆藏、预约、商城、真实展项入口；滚动底部后核对末尾操作区域。
- 3D 必须达到 `data-viewer-state=ready` 且控件可操作；`data-render-state=running` 只说明渲染循环开始，不能当作加载成功。

## 影响文件
- `frontend/scripts/android-candidate-check.mjs`：基础页面采集。
- `frontend/scripts/android-three-diagnose.mjs`：独立真机 3D 诊断；记录最终状态、资源请求、页面错误、WebGL 丢失事件和显式释放调用。诊断插桩仅存在于测试页面，重新加载后消失。
- 项目状态与需求追踪表。

## 实测结果
- 基础截图/JSON：`artifacts/real-device/candidate-1789214883339/`。五个页面未发现横向溢出或已完成加载的坏图；3D 此轮基础截图仅为海报状态。
- 最终滚动复验：首页入口 bottom≈597.9，导航 top=630；馆藏末尾控件 bottom≈613.9、导航 top=630；预约末尾按钮 bottom≈134.3、导航 top=634；商城入口 bottom≈620.4、导航 top=630。以上只能证明这台设备该状态下末尾入口可达，不能证明所有安全区/输入法/语言主题组合通过。
- 3D 首次进入失败，点击“重试加载”仍失败，最终 `viewer-state=error`、页面 visible；控制台报告 `CONTEXT_LOST_WEBGL`。证据 `artifacts/real-device/3d-retry.json`、`3d-retry.png`。
- 重新加载后的独立诊断：`artifacts/real-device/three-diagnosis-1789215291153/result.json`、`terminal.png`。约 1078ms 收到 contextlost；未记录应用主动 loseContext 调用，未记录 requestfailed。模型资源请求耗时约 13ms（缓存响应），不能据此认定模型完成解码或上传 GPU。
- 单独创建 WebGL2 上下文成功，返回 Qualcomm / Adreno 750、MAX_TEXTURE_SIZE=4096。不能将失败解释为手机完全不支持 WebGL，也不能仅凭现有证据断定 GPU 驱动缺陷。
- Chrome 同时提示不支持 KHR_parallel_shader_compile；这是兼容性线索，尚未证明是根因。

## 风险、未验证项与下一步
F-05 真机门禁未通过，旋转/缩放/点云操作没有成功验收。后续隔离已执行，结果见下表；尚无经过完整页面验证的最小修复。进一步处理需要针对浏览器/贴图上传兼容性另列修复范围，避免无新假设重复相同诊断；不得通过移除控件禁用状态或只检查 running 掩盖失败。

全站 V3.0/V3.1 逐条规格与证据对照见 `2026-09-12-v31-evidence-matrix.md`，尚未闭环。axe 112 个状态的 0 violations 不等于全部无障碍通过；原120条incomplete中的8条ARIA规则已定向复核，另36个短文本节点对比度通过（不能直接从规则数量相减）。控件边界原6项review中搜索焦点2项已修正，剩余4项淡默认边框按规格保留并记录判断边界。

## 后续隔离诊断（未修改产品3D代码）
新增 `frontend/scripts/android-three-isolation.mjs`，通过临时拦截本地诊断HTML，使用当前构建的Three.js与真实GLB逐项排除；每组重新加载页面，结束返回展项海报。测试记录 `contextlost` 事件，不因上下文随后恢复而将 `isContextLost=false` 误报为成功。

| 隔离条件 | 实际结果与证据目录（均在artifacts/real-device下） |
|---|---|
| 基础立方体、PBR、环境光 | 均可渲染；three-isolation-1789215516846 |
| 鼎几何体+无贴图材质、原材质移除贴图 | 可渲染；1789215570695、1789215611101对应目录 |
| 原贴图、取消mipmap、取消sRGB、原尺寸canvas复制 | 均出现contextlost；1789215637578、1789215670292 |
| 贴图缩至256/512；保留1024 | 256/512可渲染，1024仍中断；1789215704640。只作定位，不作为降质交付 |
| 普通生成512/1024/2048贴图 | 均可渲染；1789215735514，不能认定手机只支持512 |
| 原始1024贴图放到立方体 | 仍中断；1789215865824（此前1789215799014与1789215818544未正确选到贴图，不作该结论证据） |
| CPU像素读取上传实验 | getImageData报Out of memory；1789215896122。系统MemAvailable约5.2GiB，不足以将此错误直接归因为系统内存耗尽 |
| HTMLImageElement代替ImageBitmap，无环境光 | 可渲染；1789215949928 |
| HTMLImageElement+环境光、实际完整页面 | 仍中断；1789216005767、three-diagnosis-1789215977925。不能把改变图片解码入口视为已验证修复 |

定位边界：故障与该设备/Chrome的真实贴图上传和完整场景组合相关；简单几何体、环境光单独运行正常。尚未证明唯一底层根因，未擅自修改生命周期、降低正式贴图或声称3D已恢复。源文件对照旧4209快照确认ThreeExhibitViewer等3D运行源码未变；这也符合9月11日已有同设备中断记录，不能归因于本次两处视觉修正。

本轮新增诊断脚本在真机实际执行并产出结果；未修改产品代码，无需据此重复跑前端全量单元测试。未提交、推送或部署。

## USB恢复与格式隔离续验

用户后续明确要求不更新Chrome、寻找其他办法，更新浏览器不再作为唯一下一步。已检查手机存在vivo浏览器（包com.vivo.browser，版本记录含30.2.25.1/27.2.10.4），但尚未完成该浏览器3D对照。通过ADB打开该浏览器的工具操作被自动审批拒绝，仅返回blocked by policy；不绕过，需用户手动打开同一本地候选URL。

新增无损原始像素上传隔离：prepare-png-model-trial.mjs保存桌面解码RGBA；android-three-isolation.mjs model-raw-env使用真实几何、环境光及1024尺寸DataTexture，按GLTF texture association保持材质贴图映射。报告artifacts/real-device/three-isolation-1789222721964/results.json仍记录contextlost；即使最终lost=false也不能当成功，calls=0。实验只修改诊断脚本和忽略的产物，不采用为产品修复，不降低正式画质。该证据排除“换成原始RGBA上传就足以修好”的假设，不能证明所有32位Chrome都失败或手机硬件不支持。

ADB再次识别10AE641DSN000HE/V2366HA为device，已恢复4189 reverse及19222 CDP。软键盘专项独占手机交互，其他诊断待其交还后运行。

新假设：现有三张1024 WebP贴图的浏览器解码/上传路径存在兼容问题。prepare-png-model-trial.mjs生成仅用于临时请求替换的GLB，保留原几何、材质、贴图尺寸，去除EXT_texture_webp并引用PNG。桌面解码后RGBA逐字节一致，三张PNG大小1387425/903462/1464801字节，结果保存在artifacts/real-device/png-model-trial/conversion.json。原正式模型未改；PNG显著增大体积，不预先采用为交付。android-three-diagnose.mjs --png-trial只在诊断标签页拦截模型请求，用完整页面ready/交互结果判断；格式对照尚待真机执行。

格式对照结果：three-diagnosis-1789221895340/result.json记录PNG替换完整页面仍error，约3407ms contextlost，无应用主动loseContext记录。PNG+HTMLImage组合随后发生Target crashed，命令退出1；该次未产出终态JSON，不能当作普通error或通过。诊断脚本后续已补异常落盘，但没有为补报告重跑同一崩溃。

系统证据：artifacts/real-device/browser-crash/summary.json。Chrome版本133.0.6943.121，包primaryCpuAbi=armeabi-v7a、secondaryCpuAbi=arm64-v8a；实际崩溃渲染进程ABI=arm。20:29历史记录明确SkBitmap.cpp tryAllocPixels对1024×1024图像分配失败；22:03软键盘切换和22:06组合实验均SIGTRAP，当前记录无同一Abort message，不混为已证明同因。设备仅报告arm64-v8a，GPU进程虚拟地址空间很大不能推断渲染进程也是64位。下一有效对照应使用官方更新版Chrome/稳定浏览器环境；不能据这些记录证明唯一根因、擅自替换正式资源或把失败移出验收。
