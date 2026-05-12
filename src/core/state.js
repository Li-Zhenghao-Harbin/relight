export function createAppState() {
  return {
    uiMode: 'build',
    textures: {},
    objectUrls: [],
    mesh: null,
    importedRoot: null,
    material: null,
    geometry: null,
    dimensions: { width: 1, height: 1 }
  };
}
