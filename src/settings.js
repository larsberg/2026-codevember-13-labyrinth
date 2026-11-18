import { defaultLighting, validateLighting } from './lighting-settings.js';
import { defaultMaterials, validateMaterials } from './material-settings.js';
import { defaultPaletteLibrary, validatePaletteLibrary, libraryPalettes } from './palette-library.js';
import causticPipeline from './caustic-mesh/pipeline.json' with { type: 'json' };
import { audioFields, defaultVoices, validateVoices } from './synth-settings.js';
import { defaultCadence, validateCadence } from './generation-settings.js';

export const DEFAULT_CAMERA = { yaw: 0, elevation: 82, distance: 21.7, offsetX: 0, offsetY: 0, offsetZ: 0 };
export const fields = {
  feather: {
    seed: ['Seed', 732234, 1, 2147483647, 1], count: ['Plumes', 64, 16, 100, 1],
    length: ['Length', 8, 3, 13, .1], width: ['Vane width', .7, .2, 1.2, .01],
    mirrorAngle: ['Mirror fold', 24, 5, 50, 1],
  },
  mesh: { size: ['Body size', 7.2, 2, 14, .1], spread: ['Box spread', 2.45, 0, 4, .05], dropHeight: ['Drop above floor', 5, .25, 80, .1] },
  pipeline: Object.fromEntries(Object.entries(causticPipeline).map(([key,value])=>{
    const ranges={insetScale:[.01,.99,.01],subdivisionIterations:[1,3,1],smoothingIterations:[1,20,1],smoothingStrength:[.01,1,.01]};
    return [key,[key,value,...(ranges[key]??[])]];
  })),
  motion: { playing: ['Playing', true] },
  physics: {
    originAttraction: ['Origin attraction', .8, 0, 2, .01],
    damping: ['Damping', .35, .1, 20, .1], mass: ['Body mass scale', 1, .1, 5, .1],
    gravity: ['Gravity', 35.1, 0, 1000, .1], friction: ['Ground friction', 1.1, 0, 10, .01],
  },
  shape: { construction: ['Construction lines', false] },
  drafting: {
    ink: ['Ink edges', false], guides: ['Projection guides', false], paper: ['Paper grain', false],
  },
  studio: { background: ['Background', '#000000'], exposure: ['Exposure', .9, .1, 3, .01], shadowOpacity: ['Ground shadow opacity', .32, 0, 1, .01] },
  bloom: { enabled: ['Enable bloom', true], strength: ['Bloom strength', .85, 0, 4, .05], radius: ['Bloom radius', .45, 0, 1, .01], threshold: ['Bloom threshold', 1.4, 0, 3, .01] },
  focus: { enabled: ['Tilt blur', false], tilt: ['Sharp band angle °', 0, -85, 85, 1], band: ['Sharp band half-width', .18, .02, .5, .01], strength: ['Blur amount', 1.5, 0, 8, .1], offset: ['Band vertical offset', 0, -.5, .5, .01] },
  audio: audioFields,
  visibility: { fps: ['Show frame-rate meter', false] },
  camera: {
    yaw: ['Yaw', 0, -360, 360, .1], elevation: ['Elevation', 82, -85, 85, .1],
    distance: ['Distance', 21.7, 5, 600, .1], offsetX: ['Target X', 0, -200, 200, .01],
    offsetY: ['Target Y', 0, -200, 200, .01], offsetZ: ['Target Z', 0, -200, 200, .01],
  },
};


export function defaultSetup() {
  const result = Object.fromEntries(Object.entries(fields).map(([group, entries]) => [group,
    Object.fromEntries(Object.entries(entries).map(([key, [, initial]]) => [key, initial]))]));
  result.version = 14; result.sketch = '13-labyrinth';result.cadence={bars:48,rhythm:'x'};
  result.audio.voices = defaultVoices();
  result.lighting = defaultLighting(); result.materials = defaultMaterials();
  Object.assign(result.lighting.spotlight, { enabled:true, castShadow:true, color:'#fff1dc', intensity:9000, angle:27, penumbra:.8,
    offsetX:-10, height:22, offsetZ:16, softness:9, shadowBias:-.00004, normalBias:.015 });
  result.lighting.hemisphere.intensity=.65; result.lighting.fill.intensity=.75;
  result.lighting.hemisphere.enabled=false;result.lighting.fill.enabled=false;
  result.lighting.environment.intensity=.5;
  result.paletteLibrary = defaultPaletteLibrary();
  result.paletteId = libraryPalettes(result.paletteLibrary)[0].id;
  result.physics.gravity=6;result.physics.damping=.8;
  result.studio.exposure=1.15;result.bloom.enabled=false;
  result.lighting.spotlight.intensity=12000;
  result.lighting.hemisphere.enabled=true;result.lighting.hemisphere.intensity=.45;
  result.lighting.fill.enabled=true;result.lighting.fill.intensity=.7;
  result.lighting.environment.intensity=.7;
  result.lighting.spotlight.color='#ffffff';result.lighting.spotlight.intensity=3400;
  result.lighting.fill.color='#ffffff';result.lighting.hemisphere.skyColor='#ffffff';result.lighting.hemisphere.groundColor='#969696';
  result.materials.panels.roughness=.96;
  result.audio.enabled=true;
  return result;
}
export function validateSetup(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid setup.');
  if ((value.version??0)<2) {
    value=structuredClone(value);
    if(value.feather?.seed===1207)value.feather.seed=732234;
    if(value.physics?.gravity===9.8)value.physics.gravity=35.1;
    if(value.materials?.panels?.flatShading===false)value.materials.panels.flatShading=true;
  }
  if((value.version??0)<3){
    value=structuredClone(value);
    const feather=value.materials?.struts;
    if(feather){if(feather.roughness===.42)feather.roughness=.7;if(feather.metalness===.3)feather.metalness=.04;if(feather.envMapIntensity===1)feather.envMapIntensity=.5;}
  }
  if((value.version??0)<4&&value.mesh?.dropHeight===32){value=structuredClone(value);value.mesh.dropHeight=5;}
  if((value.version??0)<6){
    value=structuredClone(value);
    const fresh=defaultSetup(),oldSpot={color:'#ffffff',intensity:15000,angle:32,penumbra:.65,offsetX:-14,height:28,offsetZ:22,softness:1.2,shadowBias:-.00001,normalBias:.002};
    for(const [key,previous]of Object.entries(oldSpot))if(value.lighting?.spotlight?.[key]===previous)value.lighting.spotlight[key]=fresh.lighting.spotlight[key];
    for(const [key,previous]of [['hemisphere',1.1],['fill',1.2],['environment',.65]])if(value.lighting?.[key]?.intensity===previous)value.lighting[key].intensity=fresh.lighting[key].intensity;
    if(value.studio?.shadowOpacity===.24)value.studio.shadowOpacity=fresh.studio.shadowOpacity;
  }
  if((value.version??0)<7&&value.materials?.panels?.color==='#48565c'){
    value=structuredClone(value);value.materials.panels.color='#ffffff';
  }
  if((value.version??0)<8&&value.studio?.background?.toLowerCase()==='#e9e2d4'){
    value=structuredClone(value);value.studio.background='#000000';
  }
  if((value.version??0)<10){
    value=structuredClone(value);
    const rejected={intensity:14000,angle:36,offsetX:-12,height:28,offsetZ:26},next=defaultSetup().lighting.spotlight;
    if(value.version===9)for(const [key,old]of Object.entries(rejected))if(value.lighting?.spotlight?.[key]===old)value.lighting.spotlight[key]=next[key];
    const fill=value.lighting?.fill,ambient=value.lighting?.hemisphere;
    if(fill?.intensity===.75&&fill.color==='#c0e4ff'&&fill.castShadow===false)fill.enabled=false;
    if(ambient?.intensity===.65&&ambient.skyColor==='#ffffff'&&ambient.groundColor==='#acaaa6'&&ambient.yaw===0&&ambient.tilt===0)ambient.enabled=false;
  }
  if((value.version??0)<11){
    value=structuredClone(value);
    if(value.audio?.voices?.[0]?.level===.38)value.audio.voices[0].level=.6;
    if(value.audio?.voices?.[1]?.level===.18)value.audio.voices[1].level=.42;
    if(value.audio?.voices?.[1]?.lowpass===1200)value.audio.voices[1].lowpass=7000;
    if(value.audio?.voices?.[0]?.attack===.02)value.audio.voices[0].attack=.003;
    if(value.audio?.voices?.[1]?.attack===.04)value.audio.voices[1].attack=.006;
  }
  if((value.version??0)<13 && value.materials){
    value=structuredClone(value);
    const fresh=defaultMaterials();
    for(const [key,old] of Object.entries({panels:'#ed6909',struts:'#ed6909',pistons:'#ffe2aa',joints:'#b87b27'})){
      if(value.materials[key]?.color===old)value.materials[key].color=fresh[key].color;
    }
  }
  if((value.version??0)<14){
    value=structuredClone(value);
    const fresh=defaultMaterials();
    for(const [key,prior] of Object.entries({panels:'#007e80',struts:'#dc4566',pistons:'#703d56',joints:'#676e79'})){
      if(value.materials?.[key]?.color===prior)value.materials[key].color=fresh[key].color;
    }
    if(value.camera?.yaw===35&&value.camera.elevation===12&&value.camera.distance===24)Object.assign(value.camera,DEFAULT_CAMERA);
  }
  const result = defaultSetup();
  // Missing Feather fields migrate to defaults; shared studio edits remain intact.
  for (const [group, entries] of Object.entries(fields)) for (const [key, [, initial, min, max]] of Object.entries(entries)) {
    const x = value[group]?.[key] ?? result[group][key];
    const valid = typeof initial === 'number' ? Number.isFinite(x) && x >= min && x <= max
      : typeof initial === 'boolean' ? typeof x === 'boolean' : typeof x === 'string' && /^#[0-9a-f]{6}$/i.test(x);
    if (!valid) throw Error(`Invalid ${group}.${key}.`);
    result[group][key] = x;
  }
  for(const [group,key]of [['feather','seed'],['feather','count'],['pipeline','subdivisionIterations'],['pipeline','smoothingIterations']])if(!Number.isInteger(result[group][key]))throw Error(`Use a whole number for ${group}.${key}.`);
  // Retain legacy keys for saved setups, with the retired drafting mode disabled.
  result.shape.construction=false;
  result.drafting={ink:false,guides:false,paper:false};
  result.audio.voices = validateVoices(value.audio?.voices);
  const legacyBars=value.feather?.cycle&&value.feather.cycle!==36?value.feather.cycle*result.audio.tempo/240:undefined;
  result.cadence=validateCadence(value.cadence??(legacyBars?{bars:legacyBars}:undefined));
  result.lighting = validateLighting(Object.fromEntries(Object.entries(result.lighting).map(([key, defaults]) => [key, { ...defaults, ...value.lighting?.[key] }])));
  result.materials = validateMaterials(value.materials);
  result.paletteLibrary = validatePaletteLibrary(value.paletteLibrary ?? result.paletteLibrary);
  result.paletteId = value.paletteId ?? result.paletteId;
  if (!libraryPalettes(result.paletteLibrary).some(p => p.id === result.paletteId)) throw Error('Invalid palette.');
  return result;
}
