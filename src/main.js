import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

document.querySelector('#app').innerHTML = `
  <div class="app-shell">
    <nav class="mode-nav">
      <button id="modeBuildBtn" class="mode-tab is-active" type="button">生成 / 导出</button>
      <button id="modeImportBtn" class="mode-tab" type="button">导入 / 打光</button>
    </nav>

    <div class="top-layout">
      <aside class="panel panel-left">
      <h1 id="panelLeftTitle">生成与导出</h1>

      <section class="group" data-mode-only="build">
        <h2>贴图输入</h2>
        <label>基础图 / Albedo <input id="baseMap" type="file" accept="image/*" /></label>
        <label>Normal <input id="normalMap" type="file" accept="image/*" /></label>
        <label>Roughness <input id="roughnessMap" type="file" accept="image/*" /></label>
        <label>F0 <input id="f0Map" type="file" accept="image/*" /></label>
        <label>Alpha <input id="alphaMap" type="file" accept="image/*" /></label>
        <label>Depth <input id="depthMap" type="file" accept="image/*" /></label>
      </section>

      <section class="group" data-mode-only="build">
        <h2>材质和几何参数</h2>
        <label>细分段数
          <input id="segments" type="range" min="32" max="512" step="32" value="256" />
          <span id="segmentsValue">256</span>
        </label>
        <label>位移强度
          <input id="displacementScale" type="range" min="0" max="0.12" step="0.001" value="0.03" />
          <span id="displacementScaleValue">0.03</span>
        </label>
        <label>位移偏移
          <input id="displacementBias" type="range" min="-0.08" max="0.08" step="0.001" value="-0.015" />
          <span id="displacementBiasValue">-0.015</span>
        </label>
        <label>法线强度
          <input id="normalScale" type="range" min="0" max="3" step="0.01" value="1" />
          <span id="normalScaleValue">1.00</span>
        </label>
        <label>默认粗糙度
          <input id="roughnessValue" type="range" min="0" max="1" step="0.01" value="0.65" />
          <span id="roughnessValueText">0.65</span>
        </label>
        <label>默认金属度
          <input id="metalnessValue" type="range" min="0" max="1" step="0.01" value="0.03" />
          <span id="metalnessValueText">0.03</span>
        </label>
      </section>

      <section class="group" data-mode-only="build">
        <h2>GLB 导出模式</h2>
        <label>导出类型
          <select id="exportMode">
            <option value="baked">立体 GLB（Depth 烘焙为真实几何）</option>
            <option value="flat">平面 GLB（保留材质位移贴图）</option>
          </select>
        </label>
      </section>

      <section class="group" data-mode-only="build">
        <button id="applyBtn">应用贴图并预览</button>
      </section>

      <section class="group" data-mode-only="build">
        <h2>导出</h2>
        <button id="exportBtn">导出 GLB</button>
      </section>

      <section class="group" data-mode-only="import">
        <h2>导入模式说明</h2>
        <p class="desc">当前模式用于加载已有 GLB/GLTF，并在右侧参数中实时调光和阴影。</p>
      </section>

      <section class="group" data-mode-only="import">
        <h2>导入模型到打光场景</h2>
        <label>GLB / GLTF
          <input id="importModel" type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" />
        </label>
        <button id="importBtn">导入模型并打光</button>
      </section>

      <p id="status" class="status status-panel">等待上传贴图...</p>
    </aside>

      <main class="viewer-wrap">
        <div id="viewer"></div>
      </main>

      <aside class="panel panel-right">
        <section class="group">
          <h2>主光源位置（XYZ）</h2>
          <label>Light X
            <input id="lightX" type="range" min="-5" max="5" step="0.01" value="1.5" />
            <span id="lightXValue">1.50</span>
          </label>
          <label>Light Y
            <input id="lightY" type="range" min="-5" max="5" step="0.01" value="1.2" />
            <span id="lightYValue">1.20</span>
          </label>
          <label>Light Z
            <input id="lightZ" type="range" min="-5" max="5" step="0.01" value="1.8" />
            <span id="lightZValue">1.80</span>
          </label>
          <label>光源强度
            <input id="lightIntensity" type="range" min="0" max="4" step="0.01" value="2.1" />
            <span id="lightIntensityValue">2.10</span>
          </label>
        </section>

        <section class="group">
          <h2>阴影参数</h2>
          <label>启用阴影
            <input id="enableShadows" type="checkbox" checked />
          </label>
          <label>模型 Cast Shadow
            <input id="modelCastShadow" type="checkbox" checked />
          </label>
          <label>模型 Receive Shadow
            <input id="modelReceiveShadow" type="checkbox" checked />
          </label>
          <label>Shadow Map
            <select id="shadowMapSize">
              <option value="1024">1024</option>
              <option value="2048" selected>2048</option>
              <option value="4096">4096</option>
            </select>
          </label>
          <label>Shadow Bias
            <input id="shadowBias" type="range" min="-0.005" max="0.005" step="0.0001" value="-0.0001" />
            <span id="shadowBiasValue">-0.0001</span>
          </label>
          <label>Shadow Normal Bias
            <input id="shadowNormalBias" type="range" min="0" max="0.15" step="0.001" value="0.02" />
            <span id="shadowNormalBiasValue">0.020</span>
          </label>
        </section>
      </aside>
    </div>
  </div>
`;

const state = {
  uiMode: 'build',
  textures: {},
  objectUrls: [],
  mesh: null,
  importedRoot: null,
  material: null,
  geometry: null,
  dimensions: { width: 1, height: 1 }
};

const viewer = document.getElementById('viewer');
const statusEl = document.getElementById('status');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x11161f);

const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 100);
camera.position.set(0, 0, 2.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.6;
controls.maxDistance = 8;

scene.add(new THREE.AmbientLight(0xffffff, 0.26));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
keyLight.position.set(1.5, 1.2, 1.8);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 0.1;
keyLight.shadow.camera.far = 20;
keyLight.shadow.camera.left = -2.5;
keyLight.shadow.camera.right = 2.5;
keyLight.shadow.camera.top = 2.5;
keyLight.shadow.camera.bottom = -2.5;
keyLight.shadow.bias = -0.0001;
keyLight.shadow.normalBias = 0.02;
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xaaccff, 0.9);
rimLight.position.set(-1.2, 0.4, 1.2);
scene.add(rimLight);

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
}

function setUiMode(mode) {
  if (mode !== 'build' && mode !== 'import') return;
  state.uiMode = mode;

  const appShell = document.querySelector('.app-shell');
  appShell?.setAttribute('data-mode', mode);

  document.getElementById('modeBuildBtn')?.classList.toggle('is-active', mode === 'build');
  document.getElementById('modeImportBtn')?.classList.toggle('is-active', mode === 'import');

  const titleEl = document.getElementById('panelLeftTitle');
  if (titleEl) {
    titleEl.textContent = mode === 'build' ? '生成与导出' : '导入与打光';
  }
}

function updateRendererSize() {
  const width = viewer.clientWidth;
  const height = viewer.clientHeight;
  camera.aspect = width / Math.max(height, 1);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function disposeTexture(texture) {
  if (texture) {
    texture.dispose();
  }
}

function disposeCurrentMesh() {
  if (state.mesh) {
    scene.remove(state.mesh);
    state.mesh.geometry.dispose();
    state.mesh.material.dispose();
    state.mesh = null;
  }
}

function disposeMaterial(material) {
  if (!material) return;
  Object.values(material).forEach((value) => {
    if (value && value.isTexture) {
      value.dispose();
    }
  });
  material.dispose();
}

function disposeImportedRoot() {
  if (!state.importedRoot) return;
  scene.remove(state.importedRoot);
  state.importedRoot.traverse((node) => {
    if (!node.isMesh) return;
    node.geometry?.dispose();
    if (Array.isArray(node.material)) {
      node.material.forEach(disposeMaterial);
    } else {
      disposeMaterial(node.material);
    }
  });
  state.importedRoot = null;
}

function cleanupTextures() {
  Object.values(state.textures).forEach(disposeTexture);
  state.textures = {};
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.objectUrls = [];
}

function forEachSceneMesh(callback) {
  if (state.mesh) {
    callback(state.mesh);
  }
  if (state.importedRoot) {
    state.importedRoot.traverse((node) => {
      if (node.isMesh) callback(node);
    });
  }
}

function applyModelShadowFlags() {
  const cast = document.getElementById('modelCastShadow').checked;
  const receive = document.getElementById('modelReceiveShadow').checked;
  forEachSceneMesh((mesh) => {
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
  });
}

function updateShadowSettings() {
  const enabled = document.getElementById('enableShadows').checked;
  const mapSize = Number(document.getElementById('shadowMapSize').value);
  const bias = Number(document.getElementById('shadowBias').value);
  const normalBias = Number(document.getElementById('shadowNormalBias').value);
  const intensity = Number(document.getElementById('lightIntensity').value);

  renderer.shadowMap.enabled = enabled;
  keyLight.castShadow = enabled;
  keyLight.intensity = intensity;
  keyLight.shadow.bias = bias;
  keyLight.shadow.normalBias = normalBias;

  if (keyLight.shadow.mapSize.x !== mapSize || keyLight.shadow.mapSize.y !== mapSize) {
    keyLight.shadow.mapSize.set(mapSize, mapSize);
    if (keyLight.shadow.map) {
      keyLight.shadow.map.dispose();
      keyLight.shadow.map = null;
    }
  }

  applyModelShadowFlags();
}

async function loadTextureFromInput(inputId) {
  const input = document.getElementById(inputId);
  if (!input.files || input.files.length === 0) {
    return null;
  }

  const file = input.files[0];
  const objectUrl = URL.createObjectURL(file);
  state.objectUrls.push(objectUrl);

  const texture = await new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(objectUrl, resolve, undefined, reject);
  });

  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

function bindNumberDisplay(inputId, textId, formatter) {
  const input = document.getElementById(inputId);
  const text = document.getElementById(textId);
  const update = () => {
    text.textContent = formatter ? formatter(Number(input.value)) : input.value;
  };
  input.addEventListener('input', update);
  update();
}

function getAspectSize(width, height) {
  if (width <= 0 || height <= 0) {
    return { w: 1, h: 1 };
  }
  if (width >= height) {
    return { w: 1, h: height / width };
  }
  return { w: width / height, h: 1 };
}

function getTextureImageData(texture) {
  const image = texture?.image;
  if (!image) return null;

  const width = image.width || image.videoWidth || 0;
  const height = image.height || image.videoHeight || 0;
  if (!width || !height) return null;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(image, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);
  return { data: imageData.data, width, height };
}

function sampleDepthFromImageData(imageData, u, v) {
  if (!imageData) return 0;

  const uu = THREE.MathUtils.clamp(u, 0, 1);
  const vv = THREE.MathUtils.clamp(v, 0, 1);
  const x = Math.min(imageData.width - 1, Math.max(0, Math.round(uu * (imageData.width - 1))));
  const y = Math.min(
    imageData.height - 1,
    Math.max(0, Math.round((1 - vv) * (imageData.height - 1)))
  );
  const idx = (y * imageData.width + x) * 4;
  return imageData.data[idx] / 255;
}

function buildExportMesh(exportMode = 'baked') {
  if (!state.mesh) return null;

  const exportedMesh = state.mesh.clone();
  exportedMesh.geometry = state.mesh.geometry.clone();
  exportedMesh.material = state.mesh.material.clone();
  exportedMesh.castShadow = document.getElementById('modelCastShadow').checked;
  exportedMesh.receiveShadow = document.getElementById('modelReceiveShadow').checked;

  if (exportMode !== 'baked') {
    return exportedMesh;
  }

  const depthTex = exportedMesh.material.displacementMap;
  if (!depthTex) {
    return exportedMesh;
  }

  const uvAttr = exportedMesh.geometry.getAttribute('uv');
  const positionAttr = exportedMesh.geometry.getAttribute('position');
  if (!uvAttr || !positionAttr) {
    return exportedMesh;
  }

  const depthData = getTextureImageData(depthTex);
  if (!depthData) {
    return exportedMesh;
  }

  const displacementScale = exportedMesh.material.displacementScale || 0;
  const displacementBias = exportedMesh.material.displacementBias || 0;

  for (let i = 0; i < positionAttr.count; i += 1) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    const depth = sampleDepthFromImageData(depthData, u, v);
    const displacedZ = depth * displacementScale + displacementBias;
    positionAttr.setZ(i, displacedZ);
  }

  positionAttr.needsUpdate = true;
  exportedMesh.geometry.computeVertexNormals();

  // 真实几何已烘焙到顶点，导出时移除位移贴图，避免下游重复解释。
  exportedMesh.material.displacementMap = null;
  exportedMesh.material.displacementScale = 0;
  exportedMesh.material.displacementBias = 0;

  return exportedMesh;
}

function fitCameraToObject(object) {
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;

  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxSize = Math.max(size.x, size.y, size.z, 0.001);
  const halfFov = THREE.MathUtils.degToRad(camera.fov * 0.5);
  const distance = (maxSize / Math.tan(halfFov)) * 0.75;

  controls.target.copy(center);
  camera.position.set(center.x, center.y, center.z + distance);
  camera.near = Math.max(distance / 100, 0.01);
  camera.far = Math.max(distance * 100, 100);
  camera.updateProjectionMatrix();
  controls.update();
}

async function importModelForLighting() {
  const input = document.getElementById('importModel');
  if (!input.files || input.files.length === 0) {
    setStatus('请先选择一个 GLB/GLTF 文件。', true);
    return;
  }

  const file = input.files[0];
  const fileName = file.name.toLowerCase();
  setStatus(`正在导入模型：${file.name}`);

  try {
    disposeCurrentMesh();
    cleanupTextures();
    disposeImportedRoot();

    if (!fileName.endsWith('.glb') && !fileName.endsWith('.gltf')) {
      setStatus('仅支持导入 .glb 或 .gltf 文件。', true);
      return;
    }

    if (fileName.endsWith('.glb')) {
      const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
      const glbMagic = String.fromCharCode(header[0], header[1], header[2], header[3]);
      if (glbMagic !== 'glTF') {
        setStatus('模型导入失败：该文件不是有效的 GLB（二进制头不匹配）。', true);
        return;
      }
    }

    const loader = new GLTFLoader();
    let gltf;
    if (fileName.endsWith('.glb')) {
      const arrayBuffer = await file.arrayBuffer();
      try {
        gltf = await new Promise((resolve, reject) => {
          loader.parse(arrayBuffer, '', resolve, reject);
        });
      } catch (parseError) {
        // 少数浏览器/文件会在 parse 路径失败，回退到 objectURL 再试一次。
        const objectUrl = URL.createObjectURL(file);
        gltf = await new Promise((resolve, reject) => {
          loader.load(
            objectUrl,
            (result) => {
              URL.revokeObjectURL(objectUrl);
              resolve(result);
            },
            undefined,
            (error) => {
              URL.revokeObjectURL(objectUrl);
              reject(parseError || error);
            }
          );
        });
      }
    } else {
      const objectUrl = URL.createObjectURL(file);
      gltf = await new Promise((resolve, reject) => {
        loader.load(
          objectUrl,
          (result) => {
            URL.revokeObjectURL(objectUrl);
            resolve(result);
          },
          undefined,
          (error) => {
            URL.revokeObjectURL(objectUrl);
            reject(error);
          }
        );
      });
    }

    const root = gltf.scene || gltf.scenes?.[0];
    if (!root) {
      setStatus('导入失败：文件中没有可用场景。', true);
      return;
    }

    root.traverse((node) => {
      if (node.isMesh) {
        node.frustumCulled = false;
      }
    });

    state.importedRoot = root;
    scene.add(root);
    applyModelShadowFlags();
    fitCameraToObject(root);

    setStatus('导入成功：可在右侧调节 Light X/Y/Z 与阴影参数。');
  } catch (error) {
    const message = `${error?.message || '未知错误'}`;
    if (message.includes('Invalid typed array length')) {
      setStatus('模型导入失败：文件可能已损坏，或该 GLTF 依赖外部 .bin/.贴图但未一起提供。建议优先使用内嵌资源的 .glb。', true);
      return;
    }
    if (message.includes('could not be read') || message.includes('permission')) {
      setStatus('模型导入失败：浏览器无法读取该文件。请将文件复制到本地普通目录（如桌面）后重试，或重新导出一个新的 .glb。', true);
      return;
    }
    setStatus(`模型导入失败：${message}`, true);
  }
}

async function applyMaps() {
  setStatus('正在加载贴图...');

  try {
    disposeImportedRoot();
    cleanupTextures();
    disposeCurrentMesh();

    const [baseTex, normalTex, roughnessTex, f0Tex, alphaTex, depthTex] =
      await Promise.all([
        loadTextureFromInput('baseMap'),
        loadTextureFromInput('normalMap'),
        loadTextureFromInput('roughnessMap'),
        loadTextureFromInput('f0Map'),
        loadTextureFromInput('alphaMap'),
        loadTextureFromInput('depthMap')
      ]);

    if (!baseTex) {
      setStatus('请至少上传一张基础图 / Albedo。', true);
      return;
    }

    baseTex.colorSpace = THREE.SRGBColorSpace;
    if (normalTex) normalTex.colorSpace = THREE.NoColorSpace;
    if (roughnessTex) roughnessTex.colorSpace = THREE.NoColorSpace;
    if (f0Tex) f0Tex.colorSpace = THREE.NoColorSpace;
    if (alphaTex) alphaTex.colorSpace = THREE.NoColorSpace;
    if (depthTex) depthTex.colorSpace = THREE.NoColorSpace;

    const segments = Number(document.getElementById('segments').value);
    const displacementScale = Number(document.getElementById('displacementScale').value);
    const displacementBias = Number(document.getElementById('displacementBias').value);
    const normalScaleValue = Number(document.getElementById('normalScale').value);
    const roughnessValue = Number(document.getElementById('roughnessValue').value);
    const metalnessValue = Number(document.getElementById('metalnessValue').value);

    state.dimensions.width = baseTex.image?.width || 1;
    state.dimensions.height = baseTex.image?.height || 1;
    const aspect = getAspectSize(state.dimensions.width, state.dimensions.height);

    state.geometry = new THREE.PlaneGeometry(aspect.w, aspect.h, segments, segments);
    state.material = new THREE.MeshStandardMaterial({
      map: baseTex,
      normalMap: normalTex || null,
      roughnessMap: roughnessTex || null,
      metalnessMap: f0Tex || null,
      alphaMap: alphaTex || null,
      displacementMap: depthTex || null,
      displacementScale: depthTex ? displacementScale : 0,
      displacementBias: depthTex ? displacementBias : 0,
      normalScale: new THREE.Vector2(normalScaleValue, normalScaleValue),
      roughness: roughnessValue,
      metalness: metalnessValue,
      side: THREE.DoubleSide,
      transparent: Boolean(alphaTex),
      alphaTest: alphaTex ? 0.08 : 0
    });

    state.mesh = new THREE.Mesh(state.geometry, state.material);
    state.material.shadowSide = THREE.FrontSide;
    scene.add(state.mesh);
    applyModelShadowFlags();

    setStatus(
      `已完成预览：${state.dimensions.width}x${state.dimensions.height}。` +
      (depthTex ? ' Depth 位移已启用。' : ' 未提供 Depth，当前是平面受光。')
    );
  } catch (error) {
    setStatus(`贴图加载失败：${error.message || '未知错误'}`, true);
  }
}

function exportGlb() {
  if (!state.mesh) {
    setStatus('请先应用贴图后再导出。', true);
    return;
  }

  const exportMode = document.getElementById('exportMode').value;
  const isBaked = exportMode === 'baked';
  setStatus(isBaked ? '正在导出立体 GLB（Depth 烘焙为真实网格）...' : '正在导出平面 GLB...');

  const exportScene = new THREE.Scene();
  const meshToExport = buildExportMesh(exportMode);
  if (!meshToExport) {
    setStatus('导出失败：当前没有可导出的网格。', true);
    return;
  }
  exportScene.add(meshToExport);

  const exporter = new GLTFExporter();
  exporter.parse(
    exportScene,
    (result) => {
      if (!(result instanceof ArrayBuffer)) {
        setStatus('导出失败：结果不是二进制 GLB。', true);
        return;
      }

      const blob = new Blob([result], { type: 'model/gltf-binary' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      link.href = url;
      link.download = `face-relight-${isBaked ? 'baked' : 'flat'}-${ts}.glb`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus(
        isBaked
          ? '导出成功：已下载立体 GLB（Depth 已烘焙为顶点几何）。'
          : '导出成功：已下载平面 GLB（保留材质位移贴图语义）。'
      );
    },
    (error) => {
      setStatus(`导出失败：${error?.message || '未知错误'}`, true);
    },
    { binary: true, trs: false, onlyVisible: true, maxTextureSize: 4096 }
  );
}

document.getElementById('applyBtn').addEventListener('click', applyMaps);
document.getElementById('exportBtn').addEventListener('click', exportGlb);
document.getElementById('importBtn').addEventListener('click', importModelForLighting);
document.getElementById('modeBuildBtn').addEventListener('click', () => setUiMode('build'));
document.getElementById('modeImportBtn').addEventListener('click', () => setUiMode('import'));

bindNumberDisplay('segments', 'segmentsValue');
bindNumberDisplay('displacementScale', 'displacementScaleValue', (v) => v.toFixed(3));
bindNumberDisplay('displacementBias', 'displacementBiasValue', (v) => v.toFixed(3));
bindNumberDisplay('normalScale', 'normalScaleValue', (v) => v.toFixed(2));
bindNumberDisplay('roughnessValue', 'roughnessValueText', (v) => v.toFixed(2));
bindNumberDisplay('metalnessValue', 'metalnessValueText', (v) => v.toFixed(2));
bindNumberDisplay('lightX', 'lightXValue', (v) => v.toFixed(2));
bindNumberDisplay('lightY', 'lightYValue', (v) => v.toFixed(2));
bindNumberDisplay('lightZ', 'lightZValue', (v) => v.toFixed(2));
bindNumberDisplay('lightIntensity', 'lightIntensityValue', (v) => v.toFixed(2));
bindNumberDisplay('shadowBias', 'shadowBiasValue', (v) => v.toFixed(4));
bindNumberDisplay('shadowNormalBias', 'shadowNormalBiasValue', (v) => v.toFixed(3));

function updateMainLightPosition() {
  keyLight.position.set(
    Number(document.getElementById('lightX').value),
    Number(document.getElementById('lightY').value),
    Number(document.getElementById('lightZ').value)
  );
}

document.getElementById('lightX').addEventListener('input', updateMainLightPosition);
document.getElementById('lightY').addEventListener('input', updateMainLightPosition);
document.getElementById('lightZ').addEventListener('input', updateMainLightPosition);
document.getElementById('lightIntensity').addEventListener('input', updateShadowSettings);
document.getElementById('enableShadows').addEventListener('change', updateShadowSettings);
document.getElementById('modelCastShadow').addEventListener('change', updateShadowSettings);
document.getElementById('modelReceiveShadow').addEventListener('change', updateShadowSettings);
document.getElementById('shadowMapSize').addEventListener('change', updateShadowSettings);
document.getElementById('shadowBias').addEventListener('input', updateShadowSettings);
document.getElementById('shadowNormalBias').addEventListener('input', updateShadowSettings);
updateMainLightPosition();
updateShadowSettings();
setUiMode('build');

window.addEventListener('resize', updateRendererSize);
updateRendererSize();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
