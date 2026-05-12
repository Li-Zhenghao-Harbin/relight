import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export function createSceneController({ viewer }) {
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

  function updateRendererSize() {
    const width = viewer.clientWidth;
    const height = viewer.clientHeight;
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
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

  function updateMainLightPosition() {
    keyLight.position.set(
      Number(document.getElementById('lightX').value),
      Number(document.getElementById('lightY').value),
      Number(document.getElementById('lightZ').value)
    );
  }

  function renderFrame() {
    controls.update();
    renderer.render(scene, camera);
  }

  return {
    scene,
    camera,
    renderer,
    controls,
    keyLight,
    updateRendererSize,
    fitCameraToObject,
    updateMainLightPosition,
    renderFrame
  };
}
