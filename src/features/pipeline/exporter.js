import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { getTextureImageData } from './common.js';

function getDepthRefineConfigFromUi() {
  const enabled = document.getElementById('depthRefineEnabled')?.checked ?? true;
  const holeFillIters = Math.max(0, Math.round(Number(document.getElementById('depthHoleFillIters')?.value) || 0));
  const bilateralSpatialRadius = Math.max(1, Math.round(Number(document.getElementById('depthBilateralSpatial')?.value) || 1));
  const bilateralRangeSigma = Math.max(0.001, Number(document.getElementById('depthBilateralRange')?.value) || 0.06);
  const edgeAwareStrength = THREE.MathUtils.clamp(
    Number(document.getElementById('depthEdgeAwareStrength')?.value) || 0,
    0,
    1
  );
  return {
    enabled,
    holeFillIters,
    bilateralSpatialRadius,
    bilateralRangeSigma,
    edgeAwareStrength
  };
}

function buildDepthMapFromImageData(depthData) {
  const { width, height, data } = depthData;
  const values = new Float32Array(width * height);
  for (let i = 0; i < values.length; i += 1) {
    values[i] = data[i * 4] / 255;
  }
  return { width, height, values };
}

function holeFillDepthMap(depthValues, width, height, iterations = 0, holeThreshold = 1 / 255) {
  if (iterations <= 0) return depthValues;
  let current = depthValues.slice();
  const next = new Float32Array(current.length);
  const offsets = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1]
  ];

  for (let iter = 0; iter < iterations; iter += 1) {
    next.set(current);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const idx = y * width + x;
        if (current[idx] > holeThreshold) continue;
        let sum = 0;
        let count = 0;
        for (const [dx, dy] of offsets) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          const v = current[ny * width + nx];
          if (v <= holeThreshold) continue;
          sum += v;
          count += 1;
        }
        if (count > 0) next[idx] = sum / count;
      }
    }
    current = next.slice();
  }

  return current;
}

function bilateralDepthSmooth(depthValues, width, height, radius = 2, rangeSigma = 0.06) {
  const result = new Float32Array(depthValues.length);
  const spatialSigma = Math.max(1, radius * 0.75);
  const spatialCoeff = -1 / (2 * spatialSigma * spatialSigma);
  const rangeCoeff = -1 / (2 * rangeSigma * rangeSigma);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const centerIdx = y * width + x;
      const centerDepth = depthValues[centerIdx];
      let weightSum = 0;
      let valueSum = 0;

      for (let ky = -radius; ky <= radius; ky += 1) {
        const ny = y + ky;
        if (ny < 0 || ny >= height) continue;
        for (let kx = -radius; kx <= radius; kx += 1) {
          const nx = x + kx;
          if (nx < 0 || nx >= width) continue;
          const sampleIdx = ny * width + nx;
          const sampleDepth = depthValues[sampleIdx];
          const spatialDist2 = kx * kx + ky * ky;
          const depthDelta = sampleDepth - centerDepth;
          const wSpatial = Math.exp(spatialDist2 * spatialCoeff);
          const wRange = Math.exp(depthDelta * depthDelta * rangeCoeff);
          const w = wSpatial * wRange;
          weightSum += w;
          valueSum += sampleDepth * w;
        }
      }

      result[centerIdx] = weightSum > 1e-6 ? valueSum / weightSum : centerDepth;
    }
  }

  return result;
}

function edgeAwareFilterDepth(depthValues, width, height, strength = 0.4) {
  if (strength <= 0) return depthValues;
  const smoothed = bilateralDepthSmooth(depthValues, width, height, 1, 0.12);
  const out = new Float32Array(depthValues.length);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = y * width + x;
      const center = depthValues[idx];
      const left = x > 0 ? depthValues[idx - 1] : center;
      const right = x < width - 1 ? depthValues[idx + 1] : center;
      const up = y > 0 ? depthValues[idx - width] : center;
      const down = y < height - 1 ? depthValues[idx + width] : center;
      const gradient = Math.max(Math.abs(left - right), Math.abs(up - down));
      const edgeFactor = THREE.MathUtils.clamp(gradient * 20, 0, 1);
      const t = strength * (1 - edgeFactor);
      out[idx] = center * (1 - t) + smoothed[idx] * t;
    }
  }

  return out;
}

function refineDepthMap(depthMap, config) {
  const { width, height } = depthMap;
  const original = depthMap.values;
  if (!config.enabled) {
    return { width, height, values: original.slice() };
  }

  const holesFilled = holeFillDepthMap(original, width, height, config.holeFillIters);
  const bilateral = bilateralDepthSmooth(
    holesFilled,
    width,
    height,
    config.bilateralSpatialRadius,
    config.bilateralRangeSigma
  );
  const edgeAware = edgeAwareFilterDepth(bilateral, width, height, config.edgeAwareStrength);

  return {
    width,
    height,
    values: edgeAware
  };
}

function reconstructPointCloudInCameraSpace({
  depthMap,
  displacementScale,
  displacementBias,
  fovDeg = 45,
  maxPoints = 250000
}) {
  const { width, height, values } = depthMap;
  const pixelCount = width * height;
  const stride = Math.max(1, Math.ceil(Math.sqrt(pixelCount / maxPoints)));
  const sampledWidth = Math.ceil(width / stride);
  const sampledHeight = Math.ceil(height / stride);
  const points = new Float32Array(sampledWidth * sampledHeight * 3);

  const fovRad = THREE.MathUtils.degToRad(fovDeg);
  const fy = (height * 0.5) / Math.tan(fovRad * 0.5);
  const fx = fy;
  const cx = (width - 1) * 0.5;
  const cy = (height - 1) * 0.5;

  let writeIndex = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const idx = y * width + x;
      const depth = values[idx];
      const zRaw = depth * displacementScale + displacementBias;
      const z = Math.abs(zRaw) < 1e-6 ? 1e-6 : zRaw;

      const xCam = ((x - cx) * z) / fx;
      const yCam = -((y - cy) * z) / fy;
      const zCam = -z;

      points[writeIndex] = xCam;
      points[writeIndex + 1] = yCam;
      points[writeIndex + 2] = zCam;
      writeIndex += 3;
    }
  }

  return {
    points: points.slice(0, writeIndex),
    stride,
    count: writeIndex / 3,
    sampledWidth,
    sampledHeight
  };
}

function sampleDepthFromMap(depthMap, u, v) {
  const { width, height, values } = depthMap;
  const x = Math.min(width - 1, Math.max(0, Math.round(u * (width - 1))));
  const y = Math.min(height - 1, Math.max(0, Math.round((1 - v) * (height - 1))));
  return values[y * width + x];
}

function getTriangulationMaxPointsFromUi(defaultValue = 250000) {
  const el = document.getElementById('triangulationMaxPoints');
  const parsed = Number(el?.value);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return Math.round(parsed);
}

function buildTriangulatedMeshFromPointCloud(state) {
  const cloud = state.reconstructedPointCloud;
  const meta = state.reconstructedPointCloudMeta;
  const baseMaterial = state.mesh?.material;
  if (!cloud || !meta || !baseMaterial) return null;

  const { sampledWidth, sampledHeight } = meta;
  if (!sampledWidth || !sampledHeight || sampledWidth < 2 || sampledHeight < 2) return null;

  const vertexCount = sampledWidth * sampledHeight;
  if (vertexCount * 3 > cloud.length) return null;

  const positions = new Float32Array(vertexCount * 3);
  positions.set(cloud.subarray(0, vertexCount * 3));

  const uvs = new Float32Array(vertexCount * 2);
  let uvWrite = 0;
  for (let y = 0; y < sampledHeight; y += 1) {
    const v = sampledHeight > 1 ? 1 - y / (sampledHeight - 1) : 0;
    for (let x = 0; x < sampledWidth; x += 1) {
      const u = sampledWidth > 1 ? x / (sampledWidth - 1) : 0;
      uvs[uvWrite] = u;
      uvs[uvWrite + 1] = v;
      uvWrite += 2;
    }
  }

  const quadCount = (sampledWidth - 1) * (sampledHeight - 1);
  const indexCount = quadCount * 6;
  const useUint32 = vertexCount > 65535;
  const indices = useUint32 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);
  let indexWrite = 0;

  for (let y = 0; y < sampledHeight - 1; y += 1) {
    for (let x = 0; x < sampledWidth - 1; x += 1) {
      const i0 = y * sampledWidth + x;
      const i1 = i0 + 1;
      const i2 = i0 + sampledWidth;
      const i3 = i2 + 1;

      indices[indexWrite] = i0;
      indices[indexWrite + 1] = i2;
      indices[indexWrite + 2] = i1;
      indices[indexWrite + 3] = i1;
      indices[indexWrite + 4] = i2;
      indices[indexWrite + 5] = i3;
      indexWrite += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = baseMaterial.clone();
  material.displacementMap = null;
  material.displacementScale = 0;
  material.displacementBias = 0;

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = document.getElementById('modelCastShadow').checked;
  mesh.receiveShadow = document.getElementById('modelReceiveShadow').checked;
  state.reconstructedMeshMeta = {
    vertexCount,
    triangleCount: indexCount / 3,
    sampledWidth,
    sampledHeight
  };
  return mesh;
}

function buildExportMesh(state, exportMode, refinedDepthMap = null) {
  if (!state.mesh) return null;
  state.reconstructedMeshMeta = null;
  if (exportMode === 'baked') {
    const triangulatedMesh = buildTriangulatedMeshFromPointCloud(state);
    if (triangulatedMesh) return triangulatedMesh;
  }

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

  let depthMap = refinedDepthMap;
  if (!depthMap) {
    const depthData = getTextureImageData(depthTex);
    if (!depthData) return exportedMesh;
    depthMap = buildDepthMapFromImageData(depthData);
  }
  if (!depthMap.width || !depthMap.height) return exportedMesh;

  const displacementScale = exportedMesh.material.displacementScale || 0;
  const displacementBias = exportedMesh.material.displacementBias || 0;

  for (let i = 0; i < positionAttr.count; i += 1) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    const depth = sampleDepthFromMap(depthMap, u, v);
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

export function createModelExporter({ state, setStatus, reportStep, clearStepLog, getCameraFov }) {
  return function exportGlb() {
    clearStepLog?.();
    reportStep?.('导出流程初始化', true);

    if (!state.mesh) {
      reportStep?.('网格检查', false, '请先应用贴图');
      setStatus('请先应用贴图后再导出。', true);
      return;
    }

    const exportMode = document.getElementById('exportMode').value;
    const isBaked = exportMode === 'baked';
    reportStep?.('导出模式识别', true, isBaked ? 'baked（立体）' : 'flat（平面）');
    setStatus(isBaked ? '正在导出立体 GLB（Depth 烘焙为真实网格）...' : '正在导出平面 GLB...');

    let refinedDepthMap = null;
    if (isBaked) {
      try {
        const depthTex = state.material?.displacementMap;
        if (!depthTex) {
          reportStep?.('Camera space reconstruction', false, '缺少 depth 贴图');
          setStatus('导出失败：立体导出需要 Depth 贴图。', true);
          return;
        }

        const depthData = getTextureImageData(depthTex);
        if (!depthData) {
          reportStep?.('Camera space reconstruction', false, '读取 depth 像素失败');
          setStatus('导出失败：无法读取 Depth 图像数据。', true);
          return;
        }

        const refineConfig = getDepthRefineConfigFromUi();
        const rawDepthMap = buildDepthMapFromImageData(depthData);
        refinedDepthMap = refineDepthMap(rawDepthMap, refineConfig);
        reportStep?.(
          'Depth refinement',
          true,
          refineConfig.enabled
            ? `hole=${refineConfig.holeFillIters}，bilateral=${refineConfig.bilateralSpatialRadius}/${refineConfig.bilateralRangeSigma.toFixed(2)}，edgeAware=${refineConfig.edgeAwareStrength.toFixed(2)}`
            : '已关闭'
        );

        const triangulationMaxPoints = getTriangulationMaxPointsFromUi();
        const result = reconstructPointCloudInCameraSpace({
          depthMap: refinedDepthMap,
          displacementScale: state.material?.displacementScale || 0,
          displacementBias: state.material?.displacementBias || 0,
          fovDeg: getCameraFov ? getCameraFov() : 45,
          maxPoints: triangulationMaxPoints
        });

        state.reconstructedPointCloud = result.points;
        state.reconstructedPointCloudMeta = {
          count: result.count,
          stride: result.stride,
          sampledWidth: result.sampledWidth,
          sampledHeight: result.sampledHeight,
          width: refinedDepthMap.width,
          height: refinedDepthMap.height
        };

        reportStep?.(
          'Camera space reconstruction',
          true,
          `点云点数=${result.count}，网格=${result.sampledWidth}x${result.sampledHeight}，采样步长=${result.stride}，点数上限=${triangulationMaxPoints}`
        );
      } catch (error) {
        reportStep?.('Camera space reconstruction', false, error?.message || '未知错误');
        setStatus(`导出失败：Camera space reconstruction 出错：${error?.message || '未知错误'}`, true);
        return;
      }
    }

    const exportScene = new THREE.Scene();
    const meshToExport = buildExportMesh(state, exportMode, refinedDepthMap);
    if (!meshToExport) {
      reportStep?.('导出网格构建', false);
      setStatus('导出失败：当前没有可导出的网格。', true);
      return;
    }
    if (isBaked && state.reconstructedMeshMeta) {
      const { sampledWidth, sampledHeight, vertexCount, triangleCount } = state.reconstructedMeshMeta;
      reportStep?.(
        '导出网格构建',
        true,
        `grid triangulation=${sampledWidth}x${sampledHeight}，顶点=${vertexCount}，三角形=${triangleCount}`
      );
    } else {
      reportStep?.('导出网格构建', true);
    }
    exportScene.add(meshToExport);

    const exporter = new GLTFExporter();
    exporter.parse(
      exportScene,
      (result) => {
        if (!(result instanceof ArrayBuffer)) {
          reportStep?.('GLB 二进制生成', false, '结果不是 ArrayBuffer');
          setStatus('导出失败：结果不是二进制 GLB。', true);
          return;
        }
        reportStep?.('GLB 二进制生成', true);

        const blob = new Blob([result], { type: 'model/gltf-binary' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        link.href = url;
        link.download = `face-relight-${isBaked ? 'baked' : 'flat'}-${ts}.glb`;
        link.click();
        URL.revokeObjectURL(url);
        reportStep?.('文件下载', true, link.download);
        setStatus(
          isBaked
            ? '导出成功：已下载立体 GLB（Depth 已烘焙为顶点几何）。'
            : '导出成功：已下载平面 GLB（保留材质位移贴图语义）。'
        );
      },
      (error) => {
        reportStep?.('GLB 导出', false, error?.message || '未知错误');
        setStatus(`导出失败：${error?.message || '未知错误'}`, true);
      },
      { binary: true, trs: false, onlyVisible: true, maxTextureSize: 4096 }
    );
  };
}
