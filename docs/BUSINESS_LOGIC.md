# 业务逻辑说明

本文档描述当前项目的核心业务逻辑与分层结构，便于后续新增模式和功能。

## 1. 业务目标

项目提供两种工作模式：

- 生成 / 导出模式：上传贴图，预览受光效果，导出 GLB（平面或立体烘焙）
- 导入 / 打光模式：导入已有 GLB/GLTF，在页面中实时调节光源和阴影

核心体验是“同一套预览场景 + 模式化操作面板”。

## 2. 分层设计

### 2.1 入口装配层

- 文件：`src/main.js`
- 职责：
  - 注入页面结构
  - 创建状态、UI 控制器、场景控制器、业务管线
  - 初始化事件绑定和默认值
  - 启动渲染循环

### 2.2 应用层（App）

- 文件：`src/app/layout.js`
  - 负责页面模板（模式菜单、左右面板、中间预览）
  - 使用 `data-mode-only="build|import"` 声明模式可见性

- 文件：`src/app/modeConfig.js`
  - 维护模式单一配置源（`DEFAULT_MODE`、模式 key、Tab 文案、左侧标题、按钮 id）
  - 新增模式时优先改这里，减少多处硬编码

- 文件：`src/app/bindings.js`
  - 统一绑定按钮、滑杆、选择框等 UI 事件
  - 把“事件绑定细节”从 `main.js` 中抽离，降低入口复杂度

### 2.3 核心层（Core）

- 文件：`src/core/state.js`
  - 管理应用状态（当前模式、mesh、贴图对象 URL、尺寸信息）

- 文件：`src/core/ui.js`
  - 提供 UI 基础能力：
    - `setStatus()`：统一状态提示和错误提示
    - `setUiMode()`：切换模式并更新左侧标题/Tab 状态
    - `bindNumberDisplay()`：绑定滑杆数值显示

- 文件：`src/core/scene.js`
  - three.js 场景基础设施：
    - Scene / Camera / Renderer / OrbitControls 初始化
    - 主光源与补光初始化
    - 自适应尺寸、相机聚焦、渲染帧驱动

### 2.4 功能层（Features）

- 文件：`src/features/modelPipeline.js`
  - 作为功能编排层，负责资源生命周期与公共阴影控制
  - 下游能力由子模块实现：
    - `src/features/pipeline/applier.js`：`applyMaps()`
    - `src/features/pipeline/exporter.js`：`exportGlb()`
    - `src/features/pipeline/importer.js`：`importModelForLighting()`
    - `src/features/pipeline/common.js`：贴图读取/深度采样等共享工具
  - 管理资源生命周期：
    - 释放纹理、释放 mesh、释放导入模型材质与几何
  - 管理统一阴影更新：
    - `updateShadowSettings()` 同步渲染器、光源和模型阴影标记

## 3. 模式逻辑

模式由 `uiMode` 驱动，取值：

- `build`
- `import`

模式切换时：

1. 更新 `.app-shell[data-mode]` 属性
2. 控制 `mode-tab` 激活状态
3. 更新左侧标题文案：
   - `build` -> 生成与导出
   - `import` -> 导入与打光
4. 通过 CSS 规则控制 `data-mode-only` 的显示与隐藏

## 4. 导出逻辑

导出类型：

- `flat`：导出当前平面网格与材质位移语义
- `baked`：先做 Camera Space Reconstruction（Depth -> Point Cloud），再做 Grid Triangulation（Point Cloud -> Mesh），生成真实立体几何

`baked` 主流程：

1. 读取 displacement 贴图像素
2. 执行 mesh refinement（Hole filling / Bilateral / Edge-aware）
3. 基于 refined depth 恢复 camera space 点云
4. 按规则网格将点云三角化为 `BufferGeometry`
5. 生成 UV、重算法线，并复用预览材质贴图
6. 清理位移贴图参数，避免下游重复解释
7. 通过 `GLTFExporter` 导出二进制 GLB

兼容回退路径：

- 若点云三角化前置数据不可用，则回退到“按 UV 采样 refined depth 写入顶点 Z”的传统烘焙流程。
- `Triangulation 点数上限` 参数用于控制点云采样密度（影响导出网格精度与性能）。
- UI 会在参数区实时展示预计网格复杂度（网格尺寸、顶点数、三角形数）。
- UI 提供 refinement 参数：启用开关、Hole Filling 迭代、Bilateral 空间半径与深度阈值、Edge-aware 强度。

## 5. 阴影与打光逻辑

右侧面板参数通过 `updateShadowSettings()` 统一生效：

- 阴影总开关
- 主光源强度
- shadow map 尺寸
- bias 与 normalBias
- 模型 cast/receive shadow 标记

Shading Normal 规则：

- 运行时打光不再把 mesh normal 作为最终 shading normal。
- 若材质存在 normal map，则使用 AI normal map 采样结果作为最终 shading normal（shader override）。
- 该策略同时作用于“生成预览材质”和“导入模型材质”。

## 6. 后续扩展建议

未来新增模式时，建议遵循以下规则：

1. 在 `layout.js` 新增 `data-mode-only="<new-mode>"` 的区块
2. 在 `modeConfig.js` 注册新模式（tab 文案、panel 标题、默认值策略）
3. 在 `features/` 下新增对应业务模块（避免塞回 `main.js`）
4. 在 `bindings.js` 按模块补充事件绑定
5. `main.js` 仅做“组装与启动”，不承载业务细节
