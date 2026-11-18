import { Color, BufferGeometry, Float32BufferAttribute, CanvasTexture, RepeatWrapping, SRGBColorSpace, Mesh, MeshPhysicalMaterial, SphereGeometry, Group, DoubleSide, CatmullRomCurve3, Vector3, MeshDepthMaterial, RGBADepthPacking, MeshStandardMaterial } from 'three';
import { applyMaterialSettings } from './material-settings.js';
import { pathPoint, pathNormal, CENTER_Y, TURNS } from './labyrinth-path.js';

function orangeTexture(){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff0db';ctx.fillRect(0,0,1024,512);
  let seed=713;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<48000;i++){
    const x=random()*1024,y=random()*512,r=.3+random()*1.5;
    ctx.fillStyle=`rgba(${random()<.5?'92,39,5':'255,221,126'},${.08+random()*.2})`;
    ctx.beginPath();ctx.ellipse(x,y,r,r*.8,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='rgba(255,223,156,.12)';ctx.beginPath();ctx.arc(x-.4,y-.6,r*.5,0,Math.PI*2);ctx.fill();
  }
  const map=new CanvasTexture(canvas);map.colorSpace=SRGBColorSpace;map.wrapS=map.wrapT=RepeatWrapping;map.anisotropy=8;return map;
}
// The fragment cut and pathPoint share exactly the same spherical coordinates.
// No per-frame texture upload: only the progress uniform changes.
function carved(material,progress,width){
  material.onBeforeCompile=shader=>{
    shader.uniforms.peelProgress=progress;
    shader.vertexShader='varying vec2 peelUv;\n'+shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\npeelUv=uv;');
    shader.fragmentShader=`varying vec2 peelUv; uniform float peelProgress;\n`+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
      float a=peelUv.x*6.28318530718;
      float phi=(1.0-peelUv.y)*3.14159265359;
      for(int winding=0;winding<${TURNS};winding++){
        float t=(a+float(winding)*6.28318530718)/${(TURNS*Math.PI*2).toFixed(9)};
        float centerPhi=.32+2.5*t+.095*sin(a*5.0);
        if(t<peelProgress && abs(phi-centerPhi)<${width.toFixed(4)})discard;
      }
    `);
  };
  material.customProgramCacheKey=()=>`orange-cut-${width}`;
}
function sphere(radius,material){
  const geometry=new SphereGeometry(radius,192,128),p=geometry.attributes.position;
  const v=new Vector3();
  for(let i=0;i<p.count;i++){
    v.fromBufferAttribute(p,i);const scale=1+.002*Math.sin(v.x*6)*Math.sin(v.y*5)*Math.sin(v.z*7);
    p.setXYZ(i,v.x*scale,v.y*.96*scale,v.z*scale);
  }
  geometry.computeVertexNormals();const mesh=new Mesh(geometry,material);mesh.position.y=CENTER_Y;return mesh;
}
export function createOrangeView(scene,sim){
  const group=new Group();group.name='Orange / continuous carved labyrinth';scene.add(group);
  const texture=orangeTexture(),progress={value:sim.progress};
  const materials={panels:new MeshPhysicalMaterial({map:texture,bumpMap:texture,bumpScale:.055,clearcoat:.23,clearcoatRoughness:.4,side:DoubleSide}),
    struts:new MeshPhysicalMaterial({map:texture,bumpMap:texture,bumpScale:.035,clearcoat:.23,side:DoubleSide}),
    pistons:new MeshStandardMaterial({bumpMap:texture,bumpScale:.025,side:DoubleSide}),
    joints:new MeshPhysicalMaterial({bumpMap:texture,bumpScale:.025,clearcoat:.1})};
  carved(materials.panels,progress,.063);carved(materials.pistons,progress,.054);
  const skin=sphere(4,materials.panels),pith=sphere(3.965,materials.pistons),core=sphere(3.79,materials.joints);
  for(const mesh of [skin,pith,core]){mesh.castShadow=mesh.receiveShadow=true;mesh.layers.enable(1);group.add(mesh);}
  for(const [mesh,width]of [[skin,.063],[pith,.054]]){mesh.customDepthMaterial=new MeshDepthMaterial({depthPacking:RGBADepthPacking,side:DoubleSide});carved(mesh.customDepthMaterial,progress,width);}
  // The stem socket and tiny dried stalk retain the visual scale of real fruit.
  const socket=new Mesh(new SphereGeometry(.19,24,12),new MeshStandardMaterial({color:'#696034',roughness:.95}));socket.scale.set(1,.16,1);socket.position.set(0,CENTER_Y+3.85,0);group.add(socket);
  const stalk=new Mesh(new SphereGeometry(.065,12,8),socket.material);stalk.scale.set(1,2,1);stalk.position.set(0,CENTER_Y+3.92,0);group.add(stalk);
  // Four faces: orange outside, fibrous underside, and both pale cut edges.
  const maxSamples=2200,positions=new Float32Array(maxSamples*8*3),uv=new Float32Array(maxSamples*8*2),indices=[];
  for(let i=0;i<maxSamples;i++)for(let k=0;k<8;k++){uv[(i*8+k)*2]=(k%2);uv[(i*8+k)*2+1]=i*.035;}
  for(let face=0;face<4;face++)for(let i=0;i<maxSamples-1;i++){const a=i*8+face*2,b=a+8;indices.push(a,b,a+1,a+1,b,b+1);}
  const ribbonGeometry=new BufferGeometry();ribbonGeometry.setAttribute('position',new Float32BufferAttribute(positions,3));ribbonGeometry.setAttribute('uv',new Float32BufferAttribute(uv,2));ribbonGeometry.setIndex(indices);
  const faceIndices=(maxSamples-1)*6;
  for(let f=0;f<4;f++)ribbonGeometry.addGroup(f*faceIndices,0,f===0?0:1);
  const ribbonPith=materials.pistons.clone();
  const ribbon=new Mesh(ribbonGeometry,[materials.struts,ribbonPith]);ribbon.frustumCulled=false;ribbon.castShadow=ribbon.receiveShadow=true;ribbon.layers.enable(1);group.add(ribbon);
  let sampleCount=0;
  function update(){
    progress.value=sim.progress;
    ribbonPith.envMapIntensity=materials.pistons.envMapIntensity;
    ribbonPith.envMapRotation.copy(materials.pistons.envMapRotation);
    const points=[pathPoint(sim.progress).addScaledVector(pathNormal(sim.progress),.055),...sim.nodes.toReversed().map(e=>new Vector3().copy(e.body.getPosition()))];
    if(points.length<3)return;
    // Prevent duplicate feed points from producing a singular spline tangent.
    const curve=new CatmullRomCurve3(points,false,'centripetal');
    sampleCount=Math.min(maxSamples,Math.max(16,points.length*6));
    const attr=ribbonGeometry.attributes.position,v=new Vector3(),binormal=new Vector3();
    for(let i=0;i<sampleCount;i++){
      const t=i/(sampleCount-1),p=curve.getPoint(t),tangent=curve.getTangent(t).normalize();
      const normal=pathNormal(sim.progress).lerp(new Vector3(Math.sin(t*12+sim.time*.1),.3,Math.cos(t*12+sim.time*.1)),Math.min(1,t*8)).normalize();
      binormal.crossVectors(tangent,normal).normalize();if(binormal.lengthSq()<.1)binormal.set(1,0,0);
      normal.crossVectors(binormal,tangent).normalize();
      const taper=Math.min(1,(sampleCount-1-i)/3+.12),width=.225*taper;
      const corners=[[-1,1],[1,1],[1,-1],[-1,-1]];
      const order=[0,1,2,3,3,0,1,2];
      for(let k=0;k<8;k++){const [side,depth]=corners[order[k]];v.copy(p).addScaledVector(binormal,side*width).addScaledVector(normal,depth*.024);attr.setXYZ(i*8+k,v.x,v.y,v.z);}
    }
    attr.needsUpdate=true;
    for(let f=0;f<4;f++)ribbonGeometry.groups[f].count=(sampleCount-1)*6;
    ribbonGeometry.computeVertexNormals();
  }
  return {materials,update,configure(settings,palette){
    for(const [key,mat]of Object.entries(materials))applyMaterialSettings(mat,settings.materials[key],key);
    // Palette selections tint the carved flesh; natural rind remains controlled
    // by its dedicated material editor.
    if(palette?.environment?.keyColor)materials.joints.color.lerp(new Color(palette.environment.keyColor),.15);
    ribbonPith.copy(materials.pistons);
    update();
  },get diagnostics(){return {surface:'procedural citrus pores / PBR',passages:TURNS,continuousStrands:1,samples:sampleCount,progress:sim.progress};},dispose(){
    scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.customDepthMaterial?.dispose();});for(const mat of Object.values(materials))mat.dispose();ribbonPith.dispose();socket.material.dispose();texture.dispose();
  }};
}
