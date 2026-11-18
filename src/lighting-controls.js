import { defaultLighting, lightingGroups } from './lighting-settings.js';

const controlGroups = lightingGroups.map(group => group.key === 'environment'
  ? { ...group, label: 'Softbox reflections', fields: group.fields.filter(([name]) => ['enabled', 'intensity', 'rotation', 'blur'].includes(name)) }
  : { ...group, label: group.key === 'directional' ? 'Studio key light' : group.key === 'hemisphere' ? 'Soft fill' : group.label });

export function lightingControlsMarkup() {
  return `<p class="camera-hint">The stage spotlight lights the paper and table. Each light's shadow controls affect that light only when it is enabled.</p>` + controlGroups.map(({ key, label, fields }) => `
    <details class="material-group" ${key === 'spotlight' ? 'open' : ''}>
      <summary>${label}</summary>
      ${key === 'environment' ? '<p class="camera-hint">Neutral studio softboxes shape the reflections. Adjust their strength, rotation and blur.</p>' : ''}
      ${fields.map(([name, title, initial, min, max, step]) => {
        const id = `lighting-${key}-${name}`;
        if (typeof initial === 'boolean') return `<label class="lighting-toggle"><input id="${id}" type="checkbox" ${initial ? 'checked' : ''}>${title}</label>`;
        if (typeof initial === 'string') return `<label class="color-label" for="${id}">${title}<output>${initial}</output><input id="${id}" type="color" value="${initial}"></label>`;
        return `<label class="slider-label" for="${id}">${title}<output>${initial}</output></label>
          <input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${initial}">`;
      }).join('')}
    </details>`).join('');
}

export function bindLightingControls(root, directional, hemisphere, materials, getMaterials, onChange, applyOcclusion, applySceneLighting = () => {}, initialLighting = defaultLighting(), spotlight, fillLight) {
  const inputs = Object.fromEntries(controlGroups.map(({ key, fields }) => [key,
    Object.fromEntries(fields.map(([name]) => [name, root.querySelector(`#lighting-${key}-${name}`)])),
  ]));
  let settings = structuredClone(initialLighting);
  const center = { x: 0, y: 0, z: 0 };
  function updatePosition(point) {
    Object.assign(center, { x: point.x, y: point.y, z: point.z });
    for (const [key, light] of [['directional', directional], ['spotlight', spotlight], ['fill', fillLight]]) if (light) {
      const { offsetX, height, offsetZ } = settings[key];
      light.position.set(center.x + offsetX, center.y + height, center.z + offsetZ);
      light.target.position.set(center.x, center.y, center.z);
    }
  }
  function refreshEnvironment() {
    const values = getMaterials(), { enabled, intensity, rotation } = settings.environment;
    for (const [key, material] of Object.entries(materials)) {
      material.envMapIntensity = values[key].envMapIntensity * (enabled ? intensity : 0);
      material.envMapRotation.y = rotation * Math.PI / 180;
    }
    applySceneLighting(settings);
  }
  function apply() {
    for (const { key } of controlGroups) for (const [name, input] of Object.entries(inputs[key])) {
      settings[key][name] = input.type === 'checkbox' ? input.checked : input.type === 'color' ? input.value : Number(input.value);
      const output = root.querySelector(`label[for="${input.id}"] output`);
      if (output) output.value = String(settings[key][name]);
    }
    const main = settings.directional, fill = settings.hemisphere;
    directional.visible = main.enabled; directional.color.set(main.color); directional.intensity = main.intensity;
    directional.castShadow = main.castShadow; directional.shadow.radius = main.softness;
    directional.shadow.bias = main.shadowBias; directional.shadow.normalBias = main.normalBias;
    if (fillLight) {
      const fill = settings.fill;
      fillLight.visible = fill.enabled; fillLight.color.set(fill.color); fillLight.intensity = fill.intensity;
      fillLight.castShadow = fill.castShadow; fillLight.shadow.radius = fill.softness;
      fillLight.shadow.bias = fill.shadowBias; fillLight.shadow.normalBias = fill.normalBias;
    }
    if (spotlight) {
      const spot = settings.spotlight;
      spotlight.visible = spot.enabled; spotlight.color.set(spot.color); spotlight.intensity = spot.intensity;
      spotlight.angle = spot.angle * Math.PI / 180; spotlight.penumbra = spot.penumbra;
      spotlight.castShadow = spot.castShadow; spotlight.shadow.radius = spot.softness;
      spotlight.shadow.bias = spot.shadowBias; spotlight.shadow.normalBias = spot.normalBias;
    }
    hemisphere.visible = fill.enabled; hemisphere.color.set(fill.skyColor); hemisphere.groundColor.set(fill.groundColor);
    hemisphere.intensity = fill.intensity;
    hemisphere.position.setFromSphericalCoords(1, fill.tilt * Math.PI / 180, fill.yaw * Math.PI / 180);
    updatePosition(center); refreshEnvironment(); applyOcclusion(settings.occlusion);
  }
  for (const group of Object.values(inputs)) for (const input of Object.values(group))
    input.addEventListener('input', () => { apply(); onChange(); });
  const controls = {
    get: () => structuredClone(settings), updatePosition, refreshEnvironment, dispose() {},
    set(value) {
      settings = structuredClone(value);
      for (const { key } of controlGroups) for (const [name, input] of Object.entries(inputs[key])) {
        if (input.type === 'checkbox') input.checked = settings[key][name];
        else input.value = settings[key][name];
      }
      apply();
    },
  };
  controls.set(initialLighting);
  return controls;
}
