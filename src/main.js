import { dressTable } from './diner-cloth.js';
import { attachPlayerBridge } from './player-bridge.js';
// Studio shell inherited from 12-feather; only the subject is replaced.
import './style.css';
import './mesh-style.css';
import {
  ACESFilmicToneMapping, Color, DirectionalLight, HemisphereLight, PCFShadowMap,
  MOUSE, TOUCH, PerspectiveCamera, PMREMGenerator, Scene, SpotLight, SRGBColorSpace, Vector3, WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { applyCameraView as applyStudioCameraView, captureCameraView as captureStudioCameraView, configureOrbitInputs, createCameraFollow } from './camera.js';
import { initPhysics } from './physics.js';
import { menuTable } from './menu-table.js';
const STAGE_SPOT_TARGET = new Vector3(0,0,0);
import { createControls } from './controls.js';
import { defaultSetup, validateSetup, DEFAULT_CAMERA } from './settings.js';
import { requestSetup } from './persistence.js';
import { libraryPalettes } from './palette-library.js';

import { createStageFloor, createShadowFollow } from './shadows.js';
import { bindLightingControls } from './lighting-controls.js';
import { bindMaterialControls } from './material-controls.js';
import { materialGroups } from './material-settings.js';
import { createSceneEffects } from './scene-effects.js';
import { menuAudio } from './menu-audio.js';

let cameraAngle=0;
function applyCameraView(view,camera,orbit,focus){applyStudioCameraView({...view,yaw:view.yaw+cameraAngle*180/Math.PI},camera,orbit,focus);}
function captureCameraView(camera,orbit,focus){const view=captureStudioCameraView(camera,orbit,focus);view.yaw-=cameraAngle*180/Math.PI;view.yaw=((view.yaw+180)%360+360)%360-180;return view;}
let settings = defaultSetup(), setupLoadError;
try { settings = await requestSetup(); } catch (error) { setupLoadError = error.message; console.warn(error.message); }
await initPhysics();
const canvas = document.querySelector('canvas');
const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.outputColorSpace = SRGBColorSpace;
renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = .9;
renderer.shadowMap.enabled = true; renderer.shadowMap.type = PCFShadowMap;
const scene = new Scene(); scene.background = new Color(settings.studio.background);
// Preserve the studio camera range.
const camera = new PerspectiveCamera(42, innerWidth / innerHeight, .1, 900);
const orbit = new OrbitControls(camera, canvas);
configureOrbitInputs(orbit);
orbit.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
orbit.enablePan = true; orbit.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
orbit.minDistance = 5; orbit.maxDistance = 600; orbit.minPolarAngle = .09; orbit.maxPolarAngle = Math.PI - .09;
orbit.enableDamping = true; orbit.dampingFactor = .07;
const focus = new Vector3(), follow = createCameraFollow();
const pmrem = new PMREMGenerator(renderer), room = new RoomEnvironment();
let environmentBlur = settings.lighting.environment.blur;
let environment = pmrem.fromScene(room, environmentBlur); scene.environment = environment.texture;
function configureEnvironment() {
  const blur = settings.lighting.environment.blur;
  if (blur === environmentBlur) return;
  const previous = environment;
  environment = pmrem.fromScene(room, blur); environmentBlur = blur;
  scene.environment = environment.texture;
  for (const material of Object.values(surface.materials)) material.envMap = environment.texture;
  previous.dispose();
}
const hemisphere = new HemisphereLight('#fff8ed', '#7e8b9d', 1.4); scene.add(hemisphere);
const light = new DirectionalLight('#fff5df', 3.1);
light.position.set(-8, 18, 10); light.castShadow = true; light.shadow.mapSize.set(2048, 2048);
Object.assign(light.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: .5, far: 900 });
light.shadow.camera.updateProjectionMatrix();
light.shadow.bias = -.00015; light.shadow.normalBias = .04; light.shadow.radius = 3;
scene.add(light, light.target);
const lightOffset = new Vector3();
const followShadow = createShadowFollow(light, () => { const l = settings.lighting.directional; return lightOffset.set(l.offsetX, l.height, l.offsetZ); });
const fill = new DirectionalLight('#c0e4ff', 1.1); fill.position.set(12, 8, -10);
fill.shadow.mapSize.set(2048, 2048); Object.assign(fill.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: .5, far: 900 });
fill.shadow.camera.updateProjectionMatrix();
scene.add(fill, fill.target);
const spotlight = new SpotLight(); spotlight.shadow.mapSize.set(2048, 2048);
spotlight.shadow.camera.near = 1; spotlight.shadow.camera.far = 240; scene.add(spotlight, spotlight.target);
const effects = createSceneEffects(renderer, scene, camera, { clampBeauty: false });
const floor = createStageFloor();scene.add(floor); floor.layers.enable(1);
const disposeCloth=dressTable(floor.material,renderer);
const palette = () => libraryPalettes(settings.paletteLibrary).find(p => p.id === settings.paletteId);
const audio=menuAudio(state=>controls?.audioStatus(state));
let surface, controls, materialControls, lightingControls, rigKey, generation=0;
const keyForRig=()=>settings.feather.seed;
function rebuild(){
  surface?.dispose();audio.clearEffects();
  surface=menuTable(scene,canvas,camera,settings,generation,()=>audio.alarm());
  rigKey=keyForRig();floor.position.y=0;
  follow.reset(focus);applyCameraView(settings.camera,camera,orbit,focus);
}
function configure(restoreCamera=false){
  if(rigKey!==keyForRig())rebuild();
  surface.setPlaying(settings.motion.playing);
  scene.background.set(settings.studio.background);
  materialControls?.set(settings.materials);
  configureEnvironment();
  // An explicit map makes Three use the material's zero envMapIntensity;
  // falling back to scene.environment would use scene.environmentIntensity.
  floor.material.envMap = environment.texture;
  surface.configure(settings, palette());
  audio.update(0,settings.motion.playing && !document.hidden); audio.configure(settings.audio);
  lightingControls?.set(settings.lighting);
  renderer.toneMappingExposure = settings.studio.exposure;
  for(const source of [light,fill,spotlight])source.shadow.intensity=Math.min(1,settings.studio.shadowOpacity/.24);
  effects.configure(settings.lighting.occlusion); effects.configureBloom(settings.bloom); effects.configureFocus(settings.focus);
  if (restoreCamera) applyCameraView(settings.camera, camera, orbit, follow.position);
  controls?.set(settings);
}
function render() {

  lightingControls?.updatePosition(follow.position);
  spotlight.target.position.copy(STAGE_SPOT_TARGET);
  followShadow(follow.position); effects.render(follow.position);
}
function togglePlaying() {
  settings.motion.playing = !settings.motion.playing;

  surface.setPlaying(settings.motion.playing); audio.update(0,settings.motion.playing); controls.set(settings);
}
function setSoundEnabled(enabled) {
  settings.audio.enabled = enabled; audio.configure(settings.audio); controls.set(settings); controls.status('Unsaved changes');
  if (enabled) void audio.unlock();
}
function toggleSound() { setSoundEnabled(!settings.audio.enabled); }
function change(group, key, value) {
  const previous = structuredClone(settings);
  settings[group][key] = value;
  try {
    settings = validateSetup(settings);
    configure(group === 'camera'); controls.status('Unsaved changes');
    if (group === 'audio' && key === 'enabled' && value) audio.unlock().catch(error => controls.status(error.message, true));
  } catch (error) { settings = previous; configure(); controls.status(error.message, true); }
}
const controlActions = { settings, change,
  async audition(){
    if (!settings.audio.enabled) { controls.status('Enable sounds to preview the announcer.'); return; }
    await audio.unlock();
    await audio.alarm(true);
  },
  async save() {
    settings.camera = captureCameraView(camera, orbit, follow.position);
    const saved = await requestSetup('PUT', settings);
    controls.status(`${import.meta.env.PROD ? 'Saved on this device.' : 'Saved to public/settings.json.'} Sound ${saved.audio.enabled ? 'on' : 'off'}.`);
  },
  async reload() {
    const next = await requestSetup(); document.activeElement?.blur(); settings = next; rebuild(); configure(true); controls.syncPalette(); controls.status('Settings reloaded.');
  },
  reset() { generation=0; settings = defaultSetup(); rebuild(); configure(true); controls.syncPalette(); controls.status('Default settings restored.'); },
  regenerate() { generation++; rebuild(); configure(true); },
  resetView() { settings.camera = { ...DEFAULT_CAMERA }; configure(true); },
  selectPalette(id) { settings.paletteId = id; configure(); },
  changeLibrary(library) { settings.paletteLibrary = library; configure(); },
  exportDrawing() {
    render();
    canvas.toBlob(blob => {
      if (!blob) { controls.status('Could not export the image.', true); return; }
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = '13-labyrinth.png'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    }, 'image/png');
  },
  togglePlaying, toggleSound, setSoundEnabled,
};
controls = createControls(controlActions);
configure(true);
// Editors retain live references across creature generations.
const editableMaterials = Object.fromEntries(materialGroups.map(([key]) => [key, null]));
for (const [key] of materialGroups) Object.defineProperty(editableMaterials, key, { enumerable: true, get: () => surface.materials[key] });
materialControls = bindMaterialControls(controls.element, editableMaterials, () => {
  settings.materials = materialControls.get(); settings = validateSetup(settings); configure(); controls.status('Unsaved changes');
});
lightingControls = bindLightingControls(controls.element, light, hemisphere, editableMaterials, () => settings.materials,
  () => { settings.lighting = lightingControls.get(); settings = validateSetup(settings); configure(); controls.status('Unsaved changes'); },
  effects.configure, () => {}, settings.lighting, spotlight, fill);
configure(true);
if (setupLoadError) controls.status(setupLoadError, true);
orbit.enabled=false;
canvas.style.touchAction='none';
canvas.addEventListener('pointerdown',()=>{if(settings.audio.enabled)void audio.unlock().catch(e=>controls.status(e.message,true));},{capture:true});
function newMenu(e){
  if(e.code==='Space'&&!e.repeat&&!e.ctrlKey&&!e.metaKey&&!e.target.closest('input,button,textarea,select,[contenteditable="true"]')){
    e.preventDefault();controlActions.regenerate();
  }
}
document.addEventListener('keydown',newMenu);
function resize(){
  renderer.setSize(innerWidth,innerHeight,false);effects.resize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;camera.fov=42;
  camera.zoom=Math.min(1,camera.aspect/.87);camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);resize();
let previous=performance.now();
renderer.setAnimationLoop(now=>{
  const running=settings.motion.playing&&!document.hidden;
  if(running)surface.step(Math.min((now-previous)/1000,1/15));
  previous=now;render();controls.frame(surface.diagnostics,audio.modulation);
});
document.addEventListener('visibilitychange',()=>{
  previous=performance.now();surface.setPlaying(settings.motion.playing&&!document.hidden);
  audio.update(0,settings.motion.playing&&!document.hidden);
});
window.addEventListener('pagehide', () => {
  document.removeEventListener('keydown',newMenu);
  renderer.setAnimationLoop(null); audio.dispose(); lightingControls.dispose(); effects.dispose(); surface.dispose();  orbit.dispose();
  floor.geometry.dispose(); floor.material.dispose(); disposeCloth();
  for(const source of [light,fill,spotlight])source.shadow.dispose();
  environment.dispose(); room.dispose(); pmrem.dispose(); renderer.dispose();
  window.removeEventListener('resize',resize);
}, { once: true });
window.__labyrinthSketch = {
  getSetup: () => structuredClone(settings),
  getState:()=>({...surface.diagnostics,playing:settings.motion.playing,generation,audio:audio.diagnostics}),
  renderer,scene,camera,orbit,effects,render,change,
  get view(){return surface;},
  rebuild(){rebuild();configure(true);},
  regenerate() { controlActions.regenerate(); },
  pause() { if (settings.motion.playing) togglePlaying(); },
  play() { if (!settings.motion.playing) togglePlaying(); },
};

// Reuse the existing drawer actions for the gallery's sketch-player:v1 contract.
Object.assign(window.__labyrinthSketch, {
  reset() {
    controlActions.reset();
  },
  setup(value) {
    settings = validateSetup(value); rebuild(); configure(true); controls.syncPalette();
    return window.__labyrinthSketch.getSetup();
  },
  async saveSetup() { await controlActions.save(); return window.__labyrinthSketch.getSetup(); },
  async loadSetup() { await controlActions.reload(); return window.__labyrinthSketch.getSetup(); },
});
const detachPlayerBridge = attachPlayerBridge(window.__labyrinthSketch);
window.addEventListener('pagehide', detachPlayerBridge, { once: true });
