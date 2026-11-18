// Browser-only regression check, run against the existing sketch/renderer.
// Uses the complete scene and its real occluders, without changing the visible camera.
export function checkStageLighting(sketch, THREE) {
  const { renderer, scene, lights, view } = sketch, spot = lights.spotlight;
  const floor = scene.children.find(object => object.material?.name === 'Matte stage floor');
  const size = 384, target = new THREE.WebGLRenderTarget(size, size);
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 180);
  camera.position.set(24, 28, 55); camera.lookAt(0, 10, -5); camera.updateMatrixWorld(true);
  const black = new THREE.MeshBasicMaterial({ color: 0, side: THREE.DoubleSide, toneMapped: false });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, toneMapped: false });
  const original = { target: renderer.getRenderTarget(), autoUpdate: renderer.shadowMap.autoUpdate,
    override: scene.overrideMaterial, position: spot.position.clone(), visible: spot.visible,
    castShadow: spot.castShadow, callbacks: view.room.mirrors.map(m => m.onBeforeRender) };
  const materials = [], hidden = [];
  scene.traverse(object => {
    if (object.isMesh) materials.push([object, object.material]);
    else if (object.isLine || object.isPoints) hidden.push([object, object.visible]);
  });
  const restoreMaterials = () => materials.forEach(([object, material]) => object.material = material);
  function render() {
    renderer.setRenderTarget(target); renderer.render(scene, camera);
    const pixels = new Uint8Array(size * size * 4);
    renderer.readRenderTargetPixels(target, 0, 0, size, size, pixels);
    return pixels;
  }
  function mask(objects) {
    const members = new Set(objects);
    materials.forEach(([object]) => object.material = members.has(object) ? white : black);
    hidden.forEach(([object]) => object.visible = false);
    try { return render(); } finally {
      restoreMaterials(); hidden.forEach(([object, visible]) => object.visible = visible);
    }
  }
  function measure(maskPixels, lit, unshadowed, off, moved, movedUnshadowed, isFloor) {
    const result = { pixels: 0, lit: 0, shadowed: 0, offMaximum: 0, movedLight: 0, movedShadow: 0 };
    if (isFloor) Object.assign(result, { outsideCone: 0, outsideMaximum: 0 });
    const ray = new THREE.Vector3(), point = new THREE.Vector3();
    const axis = spot.target.getWorldPosition(new THREE.Vector3()).sub(original.position).normalize();
    for (let i = 0; i < maskPixels.length; i += 4) {
      if (maskPixels[i] < 250) continue;
      result.pixels++;
      const level = Math.max(lit[i], lit[i + 1], lit[i + 2]);
      const shadow = Math.max(...[0, 1, 2].map(c => unshadowed[i + c] - lit[i + c]));
      if (level > 3) result.lit++;
      if (shadow > 3) result.shadowed++;
      result.offMaximum = Math.max(result.offMaximum, off[i], off[i + 1], off[i + 2]);
      if ([0, 1, 2].some(c => Math.abs(movedUnshadowed[i + c] - unshadowed[i + c]) > 3)) result.movedLight++;
      if ([0, 1, 2].some(c => Math.abs((movedUnshadowed[i + c] - moved[i + c]) - (unshadowed[i + c] - lit[i + c])) > 3)) result.movedShadow++;
      if (isFloor) {
        const pixel = i / 4, x = pixel % size, y = Math.floor(pixel / size);
        ray.set((x + .5) / size * 2 - 1, (y + .5) / size * 2 - 1, .5).unproject(camera).sub(camera.position).normalize();
        point.copy(camera.position).addScaledVector(ray, (floor.position.y - camera.position.y) / ray.y);
        if (point.sub(original.position).normalize().dot(axis) < Math.cos(spot.angle) - .01) {
          result.outsideCone++; result.outsideMaximum = Math.max(result.outsideMaximum, level);
        }
      }
    }
    return result;
  }
  try {
    scene.overrideMaterial = null;
    view.room.mirrors.forEach(m => m.onBeforeRender = () => {});
    renderer.shadowMap.autoUpdate = true;
    spot.visible = true; spot.castShadow = true;
    const lit = render();
    spot.castShadow = false; const unshadowed = render();
    spot.visible = false; const off = render();
    spot.visible = true; spot.position.x += 10;
    const movedUnshadowed = render();
    spot.castShadow = true; const moved = render();
    spot.position.copy(original.position);
    renderer.shadowMap.autoUpdate = false;
    const floorMask = mask([floor]), curtainMask = mask(view.room.curtains);
    const result = {
      floor: measure(floorMask, lit, unshadowed, off, moved, movedUnshadowed, true),
      curtains: measure(curtainMask, lit, unshadowed, off, moved, movedUnshadowed, false),
    };
    for (const [name, stats] of Object.entries(result)) {
      if (!stats.lit || !stats.shadowed || !stats.movedLight || !stats.movedShadow || stats.offMaximum !== 0)
        throw Error(`${name} failed the real spotlight check: ${JSON.stringify(stats)}`);
    }
    if (!result.floor.outsideCone || result.floor.outsideMaximum !== 0)
      throw Error(`Floor receives light outside the actual cone: ${JSON.stringify(result.floor)}`);
    return result;
  } finally {
    restoreMaterials(); hidden.forEach(([object, visible]) => object.visible = visible);
    view.room.mirrors.forEach((m, i) => m.onBeforeRender = original.callbacks[i]);
    scene.overrideMaterial = original.override; spot.position.copy(original.position);
    spot.visible = original.visible; spot.castShadow = original.castShadow;
    renderer.shadowMap.autoUpdate = original.autoUpdate; renderer.setRenderTarget(original.target);
    target.dispose(); black.dispose(); white.dispose(); sketch.render();
  }
}
