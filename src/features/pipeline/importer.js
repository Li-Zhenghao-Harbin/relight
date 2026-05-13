import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { forceNormalMapAsShadingNormal } from './common.js';

export function createModelImporter({
  state,
  scene,
  fitCameraToObject,
  setStatus,
  applyModelShadowFlags,
  cleanupBeforeImport
}) {
  return async function importModelForLighting() {
    const input = document.getElementById('importModel');
    if (!input.files || input.files.length === 0) {
      setStatus('请先选择一个 GLB/GLTF 文件。', true);
      return;
    }

    const file = input.files[0];
    const fileName = file.name.toLowerCase();
    setStatus(`正在导入模型：${file.name}`);

    try {
      cleanupBeforeImport();

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
        if (!node.isMesh) return;
        node.frustumCulled = false;
        if (Array.isArray(node.material)) {
          node.material.forEach((mat) => forceNormalMapAsShadingNormal(mat));
        } else {
          forceNormalMapAsShadingNormal(node.material);
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
        setStatus(
          '模型导入失败：文件可能已损坏，或该 GLTF 依赖外部 .bin/.贴图但未一起提供。建议优先使用内嵌资源的 .glb。',
          true
        );
        return;
      }
      if (message.includes('could not be read') || message.includes('permission')) {
        setStatus(
          '模型导入失败：浏览器无法读取该文件。请将文件复制到本地普通目录（如桌面）后重试，或重新导出一个新的 .glb。',
          true
        );
        return;
      }
      setStatus(`模型导入失败：${message}`, true);
    }
  };
}
