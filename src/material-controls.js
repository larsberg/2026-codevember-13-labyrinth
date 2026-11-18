import { applyMaterialSettings, defaultMaterials, materialFieldsFor, materialGroups } from "./material-settings.js";

export function materialControlsMarkup() {
  const defaults = defaultMaterials();
  return materialGroups.map(([group, name], index) => {
    const values = defaults[group];
    const color = (key, label) => `<label class="color-label" for="material-${group}-${key}">
      ${label}<output>${values[key]}</output><input id="material-${group}-${key}" type="color" value="${values[key]}">
    </label>`;
    const slider = ([key, label, min, max, step]) => `<label class="slider-label" for="material-${group}-${key}">${label} <output>${values[key]}</output></label>
      <input id="material-${group}-${key}" type="range" min="${min}" max="${max}" step="${step}" value="${values[key]}">`;
    const fields = materialFieldsFor(group);
    return `<details class="material-group" ${index === 0 ? "open" : ""}>
      <summary>${name}</summary>
      ${color('color', 'Color tint')}
      <p class="control-heading">Emission</p>
      ${color('emissive', 'Emission color')}
      ${slider(fields.find(([key]) => key === 'emissiveIntensity'))}
      <p class="control-heading">Surface</p>
      ${fields.filter(([key]) => key !== 'emissiveIntensity').map(slider).join('')}
      <div class="visibility-controls material-toggles">
        ${[["wireframe", "Wireframe"], group === 'panels' ? ['depthWrite', 'Write depth'] : ["flatShading", "Flat shading"]].map(([key, label]) =>
          `<label><input id="material-${group}-${key}" type="checkbox">${label}</label>`).join("")}
      </div>
    </details>`;
  }).join("");
}

// One editor implementation shared by the skin and info surfaces.
export function bindMaterialControls(root, materials, onChange) {
  const defaults = defaultMaterials();
  const inputs = Object.fromEntries(materialGroups.map(([group]) => [group,
    Object.fromEntries(Object.keys(defaults[group]).filter(key => root.querySelector(`#material-${group}-${key}`)).map(key =>
      [key, root.querySelector(`#material-${group}-${key}`)])),
  ]));
  function get() {
    return Object.fromEntries(materialGroups.map(([group]) => [group,
      { ...defaults[group], ...Object.fromEntries(Object.entries(inputs[group]).map(([key, input]) => [key,
        input.type === "checkbox" ? input.checked : input.type === "range" ? Number(input.value) : input.value,
      ])) },
    ]));
  }
  function apply() {
    const settings = get();
    for (const [group] of materialGroups) {
      const material = materials[group], values = settings[group];
      applyMaterialSettings(material, values, group);
      for (const [key, input] of Object.entries(inputs[group])) {
        const output = root.querySelector(`label[for="${input.id}"] output`);
        if (output) output.value = String(values[key]);
      }
    }

  }
  for (const group of Object.values(inputs))
    for (const input of Object.values(group))
      input.addEventListener("input", () => { apply(); onChange(); });
  apply();
  return {
    get,
    set(settings) {
      for (const [group] of materialGroups)
        for (const [key, input] of Object.entries(inputs[group])) {
          if (input.type === "checkbox") input.checked = settings[group][key];
          else input.value = settings[group][key];
        }
      apply();
    },
  };
}
