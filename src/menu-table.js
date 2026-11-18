import * as T from 'three';
import { MenuGame,PAPER } from './menu-game.js';
import { menuPrint } from './menu-print.js';
import { applyMaterialSettings } from './material-settings.js';
import { createPhysics } from './physics.js';

const TOP=.095, SCALE=.014, UP=new T.Vector3(0,1,0);
const onTable=(p,y=TOP)=>new T.Vector3((p.x-PAPER.width/2)*SCALE,y,(p.y-PAPER.height/2)*SCALE);
const rest=onTable({x:535,y:952},TOP+.16);
export function menuTable(scene,canvas,camera,settings,generation,alarm){
  const game=new MenuGame(settings.feather.seed+generation*104729),print=menuPrint(game);
  const group=new T.Group();scene.add(group);
  const texture=new T.CanvasTexture(print.canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=8;
  const materials=Object.fromEntries(['panels','struts','pistons','joints'].map(k=>[k,new T.MeshStandardMaterial()]));
  materials.panels.map=texture;
  const mesh=(geom,material,parent=group)=>{const obj=new T.Mesh(geom,material);obj.castShadow=obj.receiveShadow=true;parent.add(obj);return obj;};
  const page=mesh(new T.PlaneGeometry(PAPER.width*SCALE,PAPER.height*SCALE),materials.panels);
  page.rotation.x=-Math.PI/2;page.position.y=TOP;
  const backing=mesh(new T.BoxGeometry(PAPER.width*SCALE,.045,PAPER.height*SCALE),materials.pistons);
  backing.position.y=TOP-.026;
  const crayon=new T.Group();group.add(crayon);
  function tube(bottom,top,height,base,mat){const obj=mesh(new T.CylinderGeometry(top,bottom,height,24),mat,crayon);obj.position.y=base+height/2;}
  tube(.017,.136,.37,0,materials.struts);tube(.136,.136,2.65,.37,materials.struts);
  tube(.14,.14,2.2,.62,materials.joints);
  for(const y of [.68,.77,2.62,2.71])tube(.143,.143,.034,y,materials.struts);
  const label=document.createElement('canvas');label.width=512;label.height=128;
  const lc=label.getContext('2d');lc.fillStyle='#eee';lc.fillRect(0,0,512,128);lc.fillStyle='#171717';lc.font='bold 68px Georgia';lc.textAlign='center';lc.fillText('CRAYON',256,87);
  const labelMap=new T.CanvasTexture(label);labelMap.colorSpace=T.SRGBColorSpace;
  const lm=new T.MeshStandardMaterial({map:labelMap,roughness:.86});
  const tag=mesh(new T.PlaneGeometry(1.42,.28),lm,crayon);tag.position.set(0,1.68,.129);tag.rotation.z=-Math.PI/2;
  const physics=createPhysics(settings.physics);
  physics.addBody({body:{type:'static',position:{x:0,y:TOP-.55,z:0}},shapes:[{type:'box',halfExtents:{x:40,y:.55,z:40}}]});
  let tossed=null,activePointer=null,playing=true;
  const restDir=new T.Vector3(.99,.011,-.12).normalize(),heldDir=new T.Vector3(.55,.82,.14).normalize();
  function park(){crayon.position.copy(rest);crayon.quaternion.setFromUnitVectors(UP,restDir);crayon.rotateY(-Math.PI/2);}
  park();
  const ray=new T.Raycaster(),tablePlane=new T.Plane(UP,-TOP);
  function input(e){
    const rect=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    const hit=ray.ray.intersectPlane(tablePlane,new T.Vector3());if(!hit)return null;
    return {x:hit.x/SCALE+PAPER.width/2,y:hit.z/SCALE+PAPER.height/2};
  }
  function onPaper(p){return p&&p.x>=0&&p.y>=0&&p.x<=PAPER.width&&p.y<=PAPER.height;}
  function paint(){print.refresh();texture.needsUpdate=true;}
  function hold(p,lift=0){crayon.position.copy(onTable(p,TOP+lift));crayon.quaternion.setFromUnitVectors(UP,heldDir);}
  function release(){const id=activePointer;activePointer=null;game.lift();if(id!==null&&canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);}
  function toss(){
    const q=crayon.quaternion.clone(),pos=crayon.position.clone().addScaledVector(heldDir,1.5);
    tossed=physics.addBody({body:{type:'dynamic',position:pos,rotation:q,angularDamping:1.6,linearDamping:.8},shapes:[{type:'box',halfExtents:{x:.135,y:1.5,z:.135}}]});
    tossed.body.setLinearVelocity({x:2,y:2.2,z:.7});tossed.body.setAngularVelocity({x:.4,y:.5,z:-3});
  }
  function reset(){release();if(tossed){physics.removeBody(tossed);tossed=null;}game.reset();print.clear();park();paint();}
  function draw(p){
    const from=game.last;game.move(p);
    if(game.phase==='lost'){
      print.stroke(from,game.last);hold(game.last);release();toss();alarm();
    }else{print.stroke(from,p);hold(p);if(game.phase==='won')release();}
    paint();
  }
  function down(e){
    if(!playing||activePointer!==null||e.button!==0||!e.isPrimary)return;
    const p=input(e);if(!p)return;
    if(game.phase==='lost'||game.phase==='won'){if(onPaper(p))reset();return;}
    if(game.phase==='pickup'){
      const dist=ray.ray.distanceSqToSegment(rest,rest.clone().addScaledVector(restDir,3.05));
      if(dist>.40**2)return;
      game.pickup();hold(p,.2);paint();return;
    }
    if(game.press(p)){activePointer=e.pointerId;canvas.setPointerCapture(e.pointerId);draw(p);}
  }
  function move(e){
    if(!playing||!e.isPrimary)return;
    if(activePointer!==null&&e.pointerId!==activePointer)return;
    for(const sample of [...(e.getCoalescedEvents?.()??[]),e]){
      const p=input(sample);if(!p)continue;
      if(game.drawing)draw(p);
      else if((game.phase==='ready'||game.phase==='drawing')&&onPaper(p))hold(p,.16);
    }
  }
  function up(e){if(activePointer===e.pointerId){move(e);release();paint();}}
  function cancel(){if(activePointer!==null){release();paint();}}
  const handlers={pointerdown:down,pointermove:move,pointerup:up,pointercancel:cancel,lostpointercapture:cancel};
  for(const [key,fn]of Object.entries(handlers))canvas.addEventListener(key,fn);
  window.addEventListener('blur',cancel);
  return {materials,game,reset,get diagnostics(){return {phase:game.phase,drawing:game.drawing};},
    setPlaying(value){playing=value;if(!value)cancel();},
    configure(setup,palette){
      physics.configure(setup.physics);
      for(const [k,m]of Object.entries(materials))applyMaterialSettings(m,setup.materials[k],k);
      if(palette?.environment?.keyColor){
        const tint=new T.Color(palette.environment.keyColor);
        materials.joints.color.multiplyScalar(.72+.28*(tint.r+tint.g+tint.b)/3);
      }
    },
    step(dt){if(!tossed)return;physics.step(dt);crayon.quaternion.copy(tossed.body.getRotation());crayon.position.copy(tossed.body.getPosition()).addScaledVector(UP.clone().applyQuaternion(crayon.quaternion),-1.5);},
    dispose(){cancel();window.removeEventListener('blur',cancel);for(const [key,fn]of Object.entries(handlers))canvas.removeEventListener(key,fn);physics.dispose();scene.remove(group);group.traverse(o=>o.geometry?.dispose());Object.values(materials).forEach(m=>m.dispose());lm.dispose();texture.dispose();labelMap.dispose();}
  };
}

