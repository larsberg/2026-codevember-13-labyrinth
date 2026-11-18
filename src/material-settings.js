// Material schema and editor structure inherited from 02-shatter-drafting,
// with groups corresponding to this rig's actual rendered surfaces.
export const materialFields = [
  ['metalness', 'Metalness', 0, 1, .01, .65],
  ['roughness', 'Roughness', 0, 1, .005, .28],
  ['emissiveIntensity', 'Emission strength', 0, 5, .01, 0],
  ['envMapIntensity', 'Environment intensity', 0, 3, .01, 1],
  ['opacity', 'Opacity', 0, 1, .005, 1],
];
export const materialFieldsFor = group => group === 'panels'
  ? materialFields.map(field => field[0] === 'opacity' ? [field[0], 'Skin opacity', ...field.slice(2)] : field) : materialFields;
export const materialGroups = [['panels', 'Printed paper'], ['struts', 'Graphite wax'], ['pistons', 'Paper edge'], ['joints', 'Crayon wrapper']];
export function defaultMaterials() {
  const defaults = Object.fromEntries(materialGroups.map(([group]) => [group, {
    ...Object.fromEntries(materialFieldsFor(group).map(([key,,,,,value]) => [key, value])),
    color: '#ffffff', emissive: '#ffffff', wireframe: false, flatShading: false,
  }]));
  for(const group of Object.values(defaults))Object.assign(group,{metalness:0,roughness:.48,emissiveIntensity:0,envMapIntensity:.7});
  Object.assign(defaults.panels,{color:'#ffffff',roughness:.29,depthWrite:true});
  Object.assign(defaults.struts,{color:'#262626',roughness:.33});
  Object.assign(defaults.pistons,{color:'#cecece',roughness:.85});
  Object.assign(defaults.joints,{color:'#bdbdbd',roughness:.32,metalness:0});
  return defaults;
}
export function validateMaterials(value) {
  const result = defaultMaterials();
  for (const [group, defaults] of Object.entries(result)) for (const [key, initial] of Object.entries(defaults)) {
    const field = value?.[group]?.[key] ?? initial, range = materialFieldsFor(group).find(([name]) => name === key);
    const valid = range ? Number.isFinite(field) && field >= range[2] && field <= range[3]
      : typeof initial === 'boolean' ? typeof field === 'boolean' : typeof field === 'string' && /^#[0-9a-f]{6}$/i.test(field);
    if (!valid) throw Error(`Invalid materials.${group}.${key}.`);
    result[group][key] = typeof field === 'string' ? field.toLowerCase() : field;
  }
  return result;
}

export function applyMaterialSettings(material, values, group) {
  const flatShading = values.flatShading;
  const transparent = values.opacity < 1;
  if (material.flatShading !== flatShading || material.transparent !== transparent) material.needsUpdate = true;
  material.transparent = transparent; material.depthWrite = group === 'panels' ? values.depthWrite : !transparent;
  material.color.set(values.color); material.emissive.set(values.emissive);
  material.wireframe = values.wireframe; material.flatShading = flatShading;
  for (const [key] of materialFieldsFor(group)) material[key] = values[key];
  if (group === 'panels') {
    material.forceSinglePass = true;
  }
}
