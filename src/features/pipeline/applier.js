import * as THREE from 'three';
import { getAspectSize, loadTextureFromInput } from './common.js';

export function createMapsApplier({ state, scene, setStatus, applyModelShadowFlags, cleanupBeforeApply }) {
  return async function applyMaps() {
    setStatus('正在加载贴图...');
    try {
      cleanupBeforeApply();

      const [baseTex, normalTex, roughnessTex, f0Tex, alphaTex, depthTex] = await Promise.all([
        loadTextureFromInput(state, 'baseMap'),
        loadTextureFromInput(state, 'normalMap'),
        loadTextureFromInput(state, 'roughnessMap'),
        loadTextureFromInput(state, 'f0Map'),
        loadTextureFromInput(state, 'alphaMap'),
        loadTextureFromInput(state, 'depthMap')
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
  };
}
