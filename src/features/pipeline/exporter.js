import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { getTextureImageData, sampleDepthFromImageData } from './common.js';

function buildExportMesh(state, exportMode) {
  if (!state.mesh) return null;
  const exportedMesh = state.mesh.clone();
  exportedMesh.geometry = state.mesh.geometry.clone();
  exportedMesh.material = state.mesh.material.clone();
  exportedMesh.castShadow = document.getElementById('modelCastShadow').checked;
  exportedMesh.receiveShadow = document.getElementById('modelReceiveShadow').checked;

  if (exportMode !== 'baked') return exportedMesh;

  const depthTex = exportedMesh.material.displacementMap;
  if (!depthTex) return exportedMesh;

  const uvAttr = exportedMesh.geometry.getAttribute('uv');
  const positionAttr = exportedMesh.geometry.getAttribute('position');
  if (!uvAttr || !positionAttr) return exportedMesh;

  const depthData = getTextureImageData(depthTex);
  if (!depthData) return exportedMesh;

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
  exportedMesh.material.displacementMap = null;
  exportedMesh.material.displacementScale = 0;
  exportedMesh.material.displacementBias = 0;

  return exportedMesh;
}

export function createModelExporter({ state, setStatus }) {
  return function exportGlb() {
    if (!state.mesh) {
      setStatus('请先应用贴图后再导出。', true);
      return;
    }

    const exportMode = document.getElementById('exportMode').value;
    const isBaked = exportMode === 'baked';
    setStatus(isBaked ? '正在导出立体 GLB（Depth 烘焙为真实网格）...' : '正在导出平面 GLB...');

    const exportScene = new THREE.Scene();
    const meshToExport = buildExportMesh(state, exportMode);
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
  };
}
