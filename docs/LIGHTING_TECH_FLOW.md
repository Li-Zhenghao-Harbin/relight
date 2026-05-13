# 2D 人脸打光技术实现流程

本文档聚焦项目的核心目标：  
**把一张 2D 人脸图片转成可被 three.js 多方向光源打光的资产，并在光源移动时产生合理阴影。**

---

## 1. 问题定义与技术路线

### 1.1 核心问题

单纯的 2D 图片（只有颜色）在 three.js 中被光照时，没有真实几何起伏，阴影变化非常有限，无法体现鼻梁/眼窝等结构。

### 1.2 解决路线

项目采用“两种资产路径”来适配不同平台能力：

1. `flat`（平面语义）
   - 保留位移贴图语义，模型几何仍是平面
   - 适合依赖材质位移解释的渲染链路

2. `baked`（立体几何）
   - 先做 Camera Space Reconstruction（Depth -> Point Cloud）
   - 再做 Grid Triangulation（Point Cloud -> Mesh）
   - 最终导出真实起伏网格
   - 适合大多数平台直接导入后打光，阴影结果更稳定

---

## 2. 运行时总体流程

### 步骤 A：初始化应用（入口装配）

由 `src/main.js` 完成：

1. 注入页面结构：`createAppLayout()`
2. 初始化状态：`createAppState()`
3. 初始化 three 场景：`createSceneController()`
4. 初始化 UI 控制器：`createUiController()`
5. 初始化业务管线：`createModelPipeline()`
6. 绑定所有交互事件：`initializeBindings()`
7. 设置默认模式、默认光照参数并启动渲染循环

### 步骤 B：进入模式执行业务

- `build` 模式：上传贴图 -> 预览 -> 导出 GLB
- `import` 模式：导入 GLB/GLTF -> 调整光照与阴影

模式由 `state.uiMode` 驱动，UI 显示由 `data-mode-only` 控制。

---

## 3. 生成/导出模式（build）技术流程

### 3.1 贴图加载与材质构建

主流程在：`src/features/pipeline/applier.js`

1. 读取输入贴图（albedo / normal / roughness / f0 / alpha / depth）
2. 设置颜色空间（albedo 为 sRGB，其余为线性）
3. 按图片宽高比创建平面几何
4. 构建 `MeshStandardMaterial`，挂接各类贴图
5. 预览网格加入场景，并应用阴影标记

### 3.2 Camera Space Reconstruction（导出前预处理）

主流程在：`src/features/pipeline/exporter.js`

在 `baked` 导出前，先对 depth 执行 mesh refinement，再恢复到 camera space 点云：

1. 读取 depth 贴图像素（`getTextureImageData`）
2. 执行 Depth Refinement（可关闭）：
   - Hole filling：对低深度孔洞区域做邻域填补
   - Bilateral depth smooth：在保持局部深度边界的前提下降噪
   - Edge-aware filtering：按梯度抑制跨边界过度平滑
3. 基于相机 FOV 与图像尺寸构建简化内参：
   - `fx = fy = (H/2) / tan(FOV/2)`
   - `cx = (W - 1) / 2`, `cy = (H - 1) / 2`
4. 把 depth 映射为相机深度 `z`
5. 用针孔模型恢复 3D 点：
   - `x_cam = (u - cx) * z / fx`
   - `y_cam = -(v - cy) * z / fy`
   - `z_cam = -z`
6. 得到 point cloud（`Float32Array`），并保存到运行时状态中供后续步骤使用

当前代码包含自适应采样步长（`stride`），用于控制点云规模并保持导出速度。  
并且可以通过 UI 参数 `Triangulation 点数上限`（`#triangulationMaxPoints`）调节重建密度与导出性能平衡。
页面会实时显示“预计网格”信息（采样网格尺寸 / 顶点数 / 三角形数），便于导出前预估复杂度。
Depth refinement 参数也在 UI 中可调：`depthRefineEnabled`、`depthHoleFillIters`、`depthBilateralSpatial`、`depthBilateralRange`、`depthEdgeAwareStrength`。

### 3.3 Grid Triangulation（点云转网格）

在完成 Camera Space Reconstruction 后，`baked` 导出流程会基于规则采样网格做三角化：

1. 以 `sampledWidth x sampledHeight` 的点云布局构建顶点数组
2. 为每个顶点生成 UV（`u = x / (W-1)`, `v = 1 - y / (H-1)`）
3. 按网格单元拆分为两片三角形：
   - `(i0, i2, i1)`
   - `(i1, i2, i3)`
4. 计算法线并生成 `BufferGeometry`
5. 克隆预览材质并清理位移参数（`displacementMap/Scale/Bias`），避免导出后重复位移

该步骤输出的是可直接导出的真实 mesh，而不是仅用于统计的点云。

### 3.4 导出 GLB

主流程在：`src/features/pipeline/exporter.js`

在完成 Camera Space Reconstruction 之后，进入导出流程并读取 `exportMode`：

- `flat`：直接导出当前网格与材质
- `baked`：执行 Camera Space Reconstruction + Grid Triangulation 并导出真实 mesh

### 3.5 depth 烘焙为真实几何（兼容路径）

当前实现优先使用 “Point Cloud -> Grid Triangulation” 生成导出网格。  
若三角化前置数据不可用，则回退到传统顶点位移烘焙：

1. 克隆预览网格
2. 从 displacement 贴图读取像素数据
3. 对每个顶点按 UV 采样 depth
4. 计算 `Z = depth * displacementScale + displacementBias`
5. 写回顶点坐标，重算法线
6. 移除位移贴图参数，避免下游重复解释
7. 通过 `GLTFExporter` 导出二进制 GLB

这个步骤是“阴影能否正确随光位变化”的关键。

---

## 4. 导入/打光模式（import）技术流程

主流程在：`src/features/pipeline/importer.js`

1. 校验文件类型（`.glb/.gltf`）
2. 若是 `.glb`，先做文件头校验（`glTF` magic）
3. 优先 `arrayBuffer + loader.parse`，失败回退 `objectURL + loader.load`
4. 导入场景根节点并加入当前 three 场景
5. 应用 cast/receive shadow 标记
6. 自动相机聚焦，进入可交互打光状态

---

## 5. 多方向打光与阴影计算链路

### 5.1 光照基础设施

在 `src/core/scene.js` 中初始化：

- `DirectionalLight`（主光）
- `AmbientLight`（环境补光）
- `renderer.shadowMap.enabled = true`

### 5.2 阴影参数统一更新

在 `src/features/modelPipeline.js` 的 `updateShadowSettings()` 中统一处理：

- 阴影开关
- 光源强度
- shadow map 分辨率
- `bias` / `normalBias`
- mesh 的 `castShadow` / `receiveShadow`

这样可确保“UI 参数变更 -> 渲染器/光源/模型状态”同步更新，避免阴影表现不一致。

### 5.3 Shading Normal 替换（AI Normal 优先）

在预览材质和导入材质中，片元着色阶段会执行 normal override：

- 不使用 mesh normal 作为最终 shading normal
- 直接以 AI normal map 采样结果作为 `normal`（转换到 view space）
- 该逻辑在 `src/features/pipeline/common.js` 的 `forceNormalMapAsShadingNormal()` 中统一实现

这样可以让光照结果主要由 AI normal map 驱动，减少几何法线对人脸细节光影的干扰。

### 5.4 步骤级输出（新增）

页面左侧新增“步骤输出”区域（`#stepLog`），每个技术步骤都会即时写入：

- `xxx已完成`
- `xxx失败：<原因>`

相关实现：

- `src/core/ui.js`
  - `reportStep(stepName, success, detail)`
  - `clearStepLog()`
- `src/features/pipeline/exporter.js`
  - 在导出流程中依次输出：
    - 导出流程初始化
    - 导出模式识别
    - Depth refinement
    - Camera space reconstruction
    - 导出网格构建
    - GLB 二进制生成
    - 文件下载

---

## 6. 为什么 GLB 是必要中间产物

本项目构建 GLB 的目的不是“仅为文件格式转换”，而是为了把 2D 贴图信息组织成可被 3D 引擎稳定消费的资产：

- 统一材质与纹理绑定关系
- 在需要时把 depth 固化成真实几何
- 让外部平台在移动光源时得到更接近真实人脸结构的阴影变化

简而言之：  
**GLB 是把 2D 信息转化为“可打光三维语义”的载体。**

---

## 7. 代码模块与职责对照

- `src/main.js`：应用装配与启动
- `src/app/layout.js`：页面结构
- `src/app/modeConfig.js`：模式定义（单一配置源）
- `src/app/bindings.js`：交互绑定
- `src/core/state.js`：运行时状态
- `src/core/ui.js`：模式切换与状态提示
- `src/core/scene.js`：three 场景与渲染基础设施
- `src/features/modelPipeline.js`：业务编排 + 阴影统一控制
- `src/features/pipeline/applier.js`：贴图应用
- `src/features/pipeline/exporter.js`：导出与 depth 烘焙
- `src/features/pipeline/importer.js`：导入与容错
- `src/features/pipeline/common.js`：共享工具函数

---

## 8. 结果判定标准（是否达成目标）

满足以下条件可认为技术目标达成：

1. 仅上传 albedo 时，打光变化有限（符合预期）
2. 上传 depth + 导出 `baked` GLB 后，鼻梁/眼窝阴影随光位变化明显增强
3. 在导入模式中移动光源 XYZ，阴影连续变化且无严重伪影
4. 调整 bias/normalBias 后可控制阴影条纹与悬浮问题
