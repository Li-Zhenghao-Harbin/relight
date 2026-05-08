import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';

document.querySelector('#app').innerHTML = `
  <div class="layout">
    <aside class="panel">
      <h1>2D -> 3D 贴图转换器</h1>
      <p class="desc">
        上传一张基础图（或 Albedo）即可开始；上传 Normal/Depth 后可以得到更真实的鼻梁侧向阴影。
      </p>

      <section class="group">
        <h2>贴图输入</h2>
        <label>基础图 / Albedo <input id="baseMap" type="file" accept="image/*" /></label>
        <label>Normal <input id="normalMap" type="file" accept="image/*" /></label>
        <label>Roughness <input id="roughnessMap" type="file" accept="image/*" /></label>
        <label>F0 <input id="f0Map" type="file" accept="image/*" /></label>
        <label>Alpha <input id="alphaMap" type="file" accept="image/*" /></label>
        <label>Depth <input id="depthMap" type="file" accept="image/*" /></label>
      </section>

      <section class="group">
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

      <section class="group actions">
        <button id="applyBtn">应用贴图并预览</button>
        <button id="exportBtn">导出 GLB</button>
      </section>

      <p id="status" class="status">等待上传贴图...</p>
    </aside>

    <main class="viewer-wrap">
      <div id="viewer"></div>
    </main>
  </div>
`;

const state = {
  textures: {},
  objectUrls: [],
  mesh: null,
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
viewer.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.minDistance = 0.6;
controls.maxDistance = 8;

scene.add(new THREE.AmbientLight(0xffffff, 0.26));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
keyLight.position.set(1.5, 1.2, 1.8);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0xaaccff, 0.9);
rimLight.position.set(-1.2, 0.4, 1.2);
scene.add(rimLight);

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle('error', isError);
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
  }
}

function cleanupTextures() {
  Object.values(state.textures).forEach(disposeTexture);
  state.textures = {};
  state.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  state.objectUrls = [];
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

async function applyMaps() {
  setStatus('正在加载贴图...');

  try {
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
    scene.add(state.mesh);

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

  setStatus('正在导出 GLB...');

  const exportScene = new THREE.Scene();
  exportScene.add(state.mesh.clone());

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
      link.download = `face-relight-${ts}.glb`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('导出成功：已下载 GLB，可直接用 GLTFLoader 导入 three.js。');
    },
    (error) => {
      setStatus(`导出失败：${error?.message || '未知错误'}`, true);
    },
    { binary: true, trs: false, onlyVisible: true, maxTextureSize: 4096 }
  );
}

document.getElementById('applyBtn').addEventListener('click', applyMaps);
document.getElementById('exportBtn').addEventListener('click', exportGlb);

bindNumberDisplay('segments', 'segmentsValue');
bindNumberDisplay('displacementScale', 'displacementScaleValue', (v) => v.toFixed(3));
bindNumberDisplay('displacementBias', 'displacementBiasValue', (v) => v.toFixed(3));
bindNumberDisplay('normalScale', 'normalScaleValue', (v) => v.toFixed(2));
bindNumberDisplay('roughnessValue', 'roughnessValueText', (v) => v.toFixed(2));
bindNumberDisplay('metalnessValue', 'metalnessValueText', (v) => v.toFixed(2));

window.addEventListener('resize', updateRendererSize);
updateRendererSize();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
});
