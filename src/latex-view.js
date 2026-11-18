import * as T from 'three';
import {TILE,ROWS,COLS,SHEET_Y,THICKNESS,cornerPoint} from './maze-topology.js';
import {applyMaterialSettings} from './material-settings.js';

// Adjacent cells in a released patch share their corner transforms. This keeps
// the flexible skin continuous as its individual Box3D frames bend and twist.
function sheetMesh(cells, patch, sim, materials) {
  const vertices=[], indices=[[],[],[]], bindings=[], neighbors=new Map();
  const occupied=new Set(cells.map(c=>c.join(',')));
  cells.forEach(([x,y],i)=>{
    for(const [a,b] of [[x,y],[x+1,y],[x+1,y+1],[x,y+1]]){
      const k=[a,b].join(',');if(!neighbors.has(k))neighbors.set(k,[]);
      neighbors.get(k).push(i);
    }
  });
  function quad(points,material){
    const base=vertices.length/3;
    for(const [x,y,z] of points){
      const p=cornerPoint(x,y);vertices.push(p.x,p.y,z);
      bindings.push({x:p.x,y:p.y,z,weights:neighbors.get([x,y].join(','))});
    }
    indices[material].push(base,base+1,base+2,base,base+2,base+3);
  }
  const h=THICKNESS/2;
  for(const [x,y] of cells){
    const corners=[[x,y],[x+1,y],[x+1,y+1],[x,y+1]];
    quad(corners.map(c=>[...c,h]),0);quad(corners.toReversed().map(c=>[...c,-h]),1);
    [[0,-1],[1,0],[0,1],[-1,0]].forEach(([dx,dy],i)=>{
      if(occupied.has([x+dx,y+dy].join(',')))return;
      const a=corners[i],b=corners[(i+1)%4];quad([[...a,-h],[...b,-h],[...b,h],[...a,h]],2);
    });
  }
  const g=new T.BufferGeometry(),pos=new T.Float32BufferAttribute(vertices,3);
  g.setAttribute('position',pos);g.setIndex(indices.flat());let start=0;
  indices.forEach((ind,i)=>{g.addGroup(start,ind.length,i);start+=ind.length;});
  const mesh=new T.Mesh(g,materials);mesh.castShadow=mesh.receiveShadow=true;mesh.layers.enable(1);mesh.frustumCulled=false;
  const point=new T.Vector3(),sum=new T.Vector3();
  return {mesh,update(){
    const frames=patch?.bones.map(b=>({p:b.body.getPosition(),q:new T.Quaternion().copy(b.body.getRotation()),rest:b.rest}));
    bindings.forEach(({x,y,z,weights},i)=>{
      if(frames?.length){sum.set(0,0,0);for(const j of weights){const f=frames[j];sum.add(point.set(x-f.rest.x,y-f.rest.y,z).applyQuaternion(f.q).add(f.p));}point.copy(sum).multiplyScalar(1/weights.length);}
      else {sim.sheetPoint(x,y,point);point.z+=z;}
      pos.setXYZ(i,point.x,point.y,point.z);
    });
    pos.needsUpdate=true;g.computeVertexNormals();
  }};
}
export function createLatexView(scene,sim){
  const root=new T.Group();scene.add(root);
  const physical=()=>new T.MeshPhysicalMaterial({clearcoat:.65,clearcoatRoughness:.18,ior:1.48});
  const materials={panels:physical(),struts:physical(),pistons:physical(),joints:physical()};
  const faces=[materials.panels,materials.struts,materials.pistons];
  const sheets=[sheetMesh(sim.maze.walls,null,sim,faces),...sim.patches.map(p=>sheetMesh(p.cells,p,sim,faces))];
  sheets.forEach(s=>root.add(s.mesh));
  const top=SHEET_Y+ROWS*TILE/2;
  function box(w,h,d,x,y,z){const m=new T.Mesh(new T.BoxGeometry(w,h,d),materials.joints);m.position.set(x,y,z);root.add(m);return m;}
  box(COLS*TILE+.45,.12,.15,0,top+.12,0);
  for(const side of [-1,1]){box(.06,8,.06,side*6,top+4,0);box(.42,.34,.21,side*6,top,0);}
  const tools=sim.lasers.map((l,i)=>{
    const color=i?0xff543a:0x72dcff,mat=new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(3)});
    const beam=new T.Mesh(new T.CylinderGeometry(.016,.008,1,8),mat),dot=new T.Mesh(new T.SphereGeometry(.055,12,8),mat);
    const head=new T.Mesh(new T.CylinderGeometry(.11,.18,.52,24),materials.joints);
    const light=new T.PointLight(color,3,2);root.add(beam,dot,head,light);
    return {beam,dot,head,light};
  });
  // Each bead records when the cutter crossed it; successive sections cool independently.
  const marks=sim.patches.flatMap(p=>p.contour.points.flatMap((a,i)=>{
    const b=p.contour.points[(i+1)%p.contour.points.length];return Array.from({length:8},(_,j)=>({p,x:a.x+(b.x-a.x)*(j+.5)/8,y:a.y+(b.y-a.y)*(j+.5)/8,d:p.contour.lengths[i]+TILE*(j+.5)/8,at:null}));
  }));
  const trace=new T.InstancedMesh(new T.SphereGeometry(1,6,4),new T.MeshBasicMaterial(),marks.length);
  trace.frustumCulled=false;root.add(trace);
  const matrix=new T.Object3D(),color=new T.Color(),axis=new T.Vector3(0,1,0);
  let last=-1;
  function update(){
    if(last===sim.time)return;last=sim.time;sheets.forEach(s=>s.update());
    let count=0;
    for(const m of marks){
      const half=m.p.contour.length/2,id=Number(m.d>=half);
      if(m.d-id*half>m.p.cut[id])continue;
      m.at??=sim.time;const heat=Math.exp(-(sim.time-m.at)*2);
      if(m.p.releasedAt!==null&&heat<.025)continue;
      sim.sheetPoint(m.x,m.y,matrix.position);matrix.position.z+=THICKNESS/2+.009;
      matrix.scale.setScalar(.047);matrix.scale.z=.17;matrix.updateMatrix();
      trace.setMatrixAt(count,matrix.matrix);trace.setColorAt(count++,color.setRGB(.012+4*heat,.005+.7*heat,.015+.04*heat));
    }
    trace.count=count;trace.instanceMatrix.needsUpdate=true;if(trace.instanceColor)trace.instanceColor.needsUpdate=true;
    sim.lasers.forEach((l,i)=>{
      const {head,beam,dot,light}=tools[i],tip=l.position.clone();tip.z+=.055;
      const dir=new T.Vector3(i?1:-1,.64,2.2),len=dir.length();dir.normalize();
      head.position.copy(tip).addScaledVector(dir,len+.26);head.quaternion.setFromUnitVectors(axis,dir);
      beam.position.copy(tip).addScaledVector(dir,len/2);beam.quaternion.copy(head.quaternion);beam.scale.y=len;
      dot.position.copy(tip);light.position.copy(tip);light.position.z+=.2;beam.visible=dot.visible=light.visible=l.cutting;
    });
  }
  return {materials,update,configure(settings,palette){for(const [key,mat]of Object.entries(materials)){applyMaterialSettings(mat,settings.materials[key],key);mat.envMap=scene.environment;}if(palette?.environment?.keyColor)materials.joints.color.lerp(color.set(palette.environment.keyColor),.1);},get diagnostics(){return {patches:sheets.length-1,hotMarks:trace.count};},dispose(){scene.remove(root);const mats=new Set();root.traverse(o=>{o.geometry?.dispose();for(const m of [].concat(o.material??[]))mats.add(m);if(o.isInstancedMesh)o.dispose();});mats.forEach(m=>m.dispose());}};
}
