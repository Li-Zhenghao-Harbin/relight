import * as THREE from 'three';

export async function loadTextureFromInput(state, inputId) {
  const input = document.getElementById(inputId);
  if (!input.files || input.files.length === 0) return null;

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

export function getAspectSize(width, height) {
  if (width <= 0 || height <= 0) return { w: 1, h: 1 };
  if (width >= height) return { w: 1, h: height / width };
  return { w: width / height, h: 1 };
}

export function getTextureImageData(texture) {
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

export function sampleDepthFromImageData(imageData, u, v) {
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
