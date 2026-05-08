# 2D 人脸贴图做“可打光伪3D”环境搭建（three.js）

本文档用于快速搭建一个可运行的 three.js 项目，让一张 2D 人脸图结合
`Albedo / Normal / Roughness / F0 / Alpha / Depth` 实现更真实的受光，
重点是鼻梁等凸起区域产生合理的侧向阴影。

---

## 1. 目标和结论

- 你手头这组贴图可以做出**非常接近 3D 的受光效果**，并可直接用于 three.js。
- 但它本质是“**2.5D / 伪3D**”：如果没有真实网格（mesh），侧面轮廓和大角度旋转仍不如真 3D。
- 对“鼻梁打光后侧面出现阴影”这个目标，`Normal + Depth(+少量位移)` 已经足够显著提升真实感。

---

## 2. 环境要求

- Node.js: `>= 20 LTS`
- npm: `>= 10`
- 操作系统: Windows / macOS / Linux 均可
- 浏览器: Chrome / Edge 最新版（支持 WebGL2）

可选（后续导出标准 3D 资产时）：
- Blender（用于把 depth 生成网格并导出 `glb/gltf`）

---

## 3. 项目初始化（推荐 Vite）

在项目根目录执行：

```bash
npm create vite@latest . -- --template vanilla
npm install
npm install three lil-gui
npm install -D vite
```

> 如果当前目录已有项目结构，只需要安装依赖：
>
> ```bash
> npm install three lil-gui
> ```

---

## 4. 资源目录约定

建议结构：

```text
pcov3d/
  public/
    textures/
      face_albedo.png
      face_normal.png
      face_roughness.png
      face_f0.png
      face_alpha.png
      face_depth.png
```

贴图约定（很关键）：

- `Albedo`：sRGB 色彩空间
- `Normal`：线性空间（不要 sRGB）
- `Roughness`：线性空间，白=更粗糙，黑=更光滑
- `F0`：线性空间，建议作为金属度/反射率辅助输入
- `Alpha`：线性空间，用于透明裁切
- `Depth`：线性空间，白高黑低（或反之，后续可在代码里翻转）

---

## 5. 启动开发环境

```bash
npm run dev
```

打开终端输出的本地地址（通常是 `http://localhost:5173`）。

---

## 6. 在 three.js 中实现“可打光伪3D”的最小方案

### 方案 A（优先推荐，快且稳定）

`PlaneGeometry + MeshStandardMaterial + NormalMap + DisplacementMap(Depth)`

为什么有效：
- `NormalMap` 决定局部法线方向 -> 直接影响鼻梁两侧明暗过渡
- `DisplacementMap(Depth)` 让面片产生真实高低 -> 侧光时阴影更自然
- `Roughness/F0` 控制高光宽度和强度 -> 皮肤质感更可信

关键参数建议：
- `PlaneGeometry` 分段数：`256 x 256` 起步（位移需要足够细分）
- `displacementScale`：`0.01 ~ 0.06` 之间调试
- `normalScale`：先从 `(1.0, 1.0)` 开始
- 光源：至少加一个方向光 + 一个弱环境光

> 注意：`MeshStandardMaterial` 原生不直接接收 F0 贴图。  
> 你可以先把 F0 信息映射到 `metalnessMap` 或在 `onBeforeCompile` 里自定义 BRDF 计算。

---

## 7. three.js 最小代码骨架（接线关系）

在 `main.js` 里核心接线如下（示意）：

```js
const material = new THREE.MeshStandardMaterial({
  map: albedoTex,
  normalMap: normalTex,
  roughnessMap: roughnessTex,
  metalnessMap: f0Tex, // 近似用法，精确 F0 需自定义 shader
  alphaMap: alphaTex,
  transparent: true,
  displacementMap: depthTex,
  displacementScale: 0.03,
  displacementBias: -0.015
});
```

纹理色彩空间（必须正确）：

```js
albedoTex.colorSpace = THREE.SRGBColorSpace;
normalTex.colorSpace = THREE.NoColorSpace;
roughnessTex.colorSpace = THREE.NoColorSpace;
f0Tex.colorSpace = THREE.NoColorSpace;
alphaTex.colorSpace = THREE.NoColorSpace;
depthTex.colorSpace = THREE.NoColorSpace;
```

---

## 8. “能否合成 3D 格式图片”说明

可以分两种理解：

1) **用于实时渲染（推荐）**  
- 不一定要先生成 `.glb`，直接在 three.js 中使用“平面 + 多贴图”即可得到可打光效果。

2) **导出标准 3D 资产（.glb/.gltf/.obj）**  
- 可把 `Depth` 转成高度场网格（例如 Blender 位移），再绑定贴图后导出 `glb`，three.js 可直接 `GLTFLoader` 导入。
- 这种方式在多角度观察时比单纯平面更像真实 3D。

---

## 9. 常见问题（影响鼻梁阴影）

- 几何分段太低：位移后仍然“平”，阴影不明显。
- 法线方向错（OpenGL/DirectX 法线约定不一致）：会出现“鼻梁反着亮”。
- Depth 白黑反了：凸起变凹陷，阴影逻辑全错。
- 光太平（只有环境光）：看不到结构起伏。
- 相机正对且光线同轴：侧向阴影天然不明显。

---

## 10. 下一步建议

- 先用方案 A 跑通（1~2 小时内可看到明显效果）。
- 如果你需要大角度转头仍然可信，再做方案 B：`Depth -> 网格 -> glb`。
- 后续可加 `SSAO/Contact Shadow` 进一步增强鼻翼、鼻梁根部阴影。

---

## 11. 一键回顾命令

```bash
npm create vite@latest . -- --template vanilla
npm install
npm install three lil-gui
npm run dev
```

