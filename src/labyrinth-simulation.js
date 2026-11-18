import { Quaternion, Vector3 } from 'three';
import { createPhysics, initPhysics } from './physics.js';
import { generateMaze, sampleContour, tileCenter, TILE, SHEET_Y, THICKNESS, COLS, ROWS } from './maze-topology.js';
export { initPhysics };
const identity={x:0,y:0,z:0,w:1},clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
export class LabyrinthSimulation {
  constructor(settings,generation=0){
    this.settings=settings;this.generation=generation;this.time=0;this.floor=0;this.progress=0;this.position=new Float64Array(48);
    this.seed=(settings.feather.seed+generation*104729)>>>0;this.maze=generateMaze(this.seed);
    this.patches=this.maze.patches.map(p=>({...p,cut:[0,0],startedAt:null,releasedAt:null,bones:[],links:[],landed:false,heat:0}));
    this.lasers=[0,1].map(id=>({id,position:new Vector3(id?-3:3,13,0),previous:new Vector3(),cutting:false,speed:0,travel:0,target:null}));
    this.physics=createPhysics(settings.physics);this.sounds=[];this.soundCounts={};this.lastSounds=new Map();this.contacts=0;this.shapeOwners=new Map();
    this.floorBody=this.physics.addBody({body:{type:'static',position:{x:0,y:-.5,z:0}},shapes:[{type:'box',halfExtents:{x:80,y:.5,z:80}}]});
    this.floorBody.shapes[0].enableContactEvents(true);this.shapeOwners.set(this.floorBody.shapes[0].getUserData(),{floor:true});
    // A pair works from opposite points of the same contour. Their independent
    // feed rates differ, so each can finish its half and wait for its partner.
    this.activeIndex=-1;this.phase='travel';this.phaseTime=0;this.assignNext();
    this.physics.onBeforeStep(()=>this.beforeStep());
    this.physics.onAfterStep(()=>this.afterStep());
  }
  emit(effect,power,position,voice=1,cooldown=.08,extra={}){
    const key=`${effect}:${voice}`;if(this.time-(this.lastSounds.get(key)??-100)<cooldown||power<.015)return;
    this.lastSounds.set(key,this.time);this.soundCounts[effect]=(this.soundCounts[effect]??0)+1;
    this.sounds.push({effect,power:clamp(power),position:[position.x,position.y,position.z],time:this.time,generation:this.generation,voice,...extra});
  }
  assignNext(){
    this.activeIndex++;this.active=this.patches[this.activeIndex];this.phaseTime=0;
    if(!this.active){this.phase='complete';for(const l of this.lasers)l.cutting=false;return;}
    this.phase='travel';
    for(const l of this.lasers){l.from=l.position.clone();l.target=sampleContour(this.active.contour,l.id?this.active.contour.length/2:0);l.cutting=false;}
  }
  // Shared by the attached mesh, cut kerfs, laser tips and release bind pose.
  sheetPoint(x,y,target=new Vector3()){
    const edge=Math.sin(Math.PI*clamp((x/TILE+COLS/2)/COLS))*Math.sin(Math.PI*clamp((y-SHEET_Y)/TILE/ROWS+.5));
    const remaining=1-this.patches.filter(p=>p.releasedAt!==null).length/this.patches.length;
    let z=edge*(.08*Math.sin(x*.65+this.time*.8)+.045*Math.sin(y*.9-this.time*1.15))*(1.1-.5*remaining);
    for(const l of this.lasers)if(l.cutting){const d=(x-l.position.x)**2+(y-l.position.y)**2;z+=.055*Math.exp(-d*2.8)*Math.sin(this.time*8-d*3);}
    return target.set(x,y,z);
  }
  release(patch){
    if(patch.releasedAt!==null||patch.cut[0]+patch.cut[1]<patch.contour.length-1e-7)throw Error('Cannot release an unclosed contour');
    patch.releasedAt=this.time;patch.heat=1;
    const byCell=new Map();
    for(const [i,[x,y]]of patch.cells.entries()){
      const rest=tileCenter(x,y),pos=this.sheetPoint(rest.x,rest.y),entry=this.physics.addBody({body:{type:'dynamic',position:pos,linearDamping:this.settings.physics.damping*.16,angularDamping:.3},shapes:[{type:'box',halfExtents:{x:TILE*.46,y:TILE*.46,z:THICKNESS*.65},density:this.settings.physics.mass*1.6,restitution:.08}]});
      const bone={...entry,rest:new Vector3(rest.x,rest.y,0),index:i,patch};
      for(const shape of entry.shapes){shape.enableContactEvents(true);this.shapeOwners.set(shape.getUserData(),bone);}
      entry.body.setLinearVelocity({x:Math.sin(patch.id*2.4)*.16,y:-.05,z:.3+Math.sin(i+patch.id)*.2});
      entry.body.setAngularVelocity({x:.35*Math.cos(i*.8+patch.id),y:.3*Math.sin(patch.id),z:.08*Math.sin(i)});
      patch.bones.push(bone);byCell.set(`${x},${y}`,bone);
    }
    for(const [x,y]of patch.cells)for(const [dx,dy]of [[1,0],[0,1]]){
      const a=byCell.get(`${x},${y}`),b=byCell.get(`${x+dx},${y+dy}`);if(!b)continue;
      const joint=this.physics.addSphericalJoint(a,b,{localFrameA:{position:{x:dx*TILE/2,y:dy*TILE/2,z:0},rotation:identity},localFrameB:{position:{x:-dx*TILE/2,y:-dy*TILE/2,z:0},rotation:identity},collideConnected:false,enableConeLimit:true,coneAngle:.9,enableTwistLimit:true,lowerTwistAngle:-.35,upperTwistAngle:.35});
      patch.links.push({a,b,joint,dx,dy});
    }
    this.emit('release',.45,patch.bones[0].body.getPosition(),1,.01);
  }
  beforeStep(){
    const qa=new Quaternion(),qb=new Quaternion(),delta=new Quaternion();
    for(const p of this.patches)if(p.releasedAt!==null){
      // Elastic bending torque between actual rigid tile frames, plus their
      // shared-edge constraints. Gravity and contacts determine the fall.
      for(const link of p.links){
        qa.copy(link.a.body.getRotation());qb.copy(link.b.body.getRotation());delta.copy(qb).multiply(qa.invert());
        if(delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
        const va=link.a.body.getAngularVelocity(),vb=link.b.body.getAngularVelocity(),stiffness=.018*this.settings.physics.mass;
        const torque={x:stiffness*(delta.x*18+(vb.x-va.x)*.4),y:stiffness*(delta.y*18+(vb.y-va.y)*.4),z:stiffness*(delta.z*18+(vb.z-va.z)*.4)};
        link.a.body.applyTorque(torque,true);link.b.body.applyTorque({x:-torque.x,y:-torque.y,z:-torque.z},true);
      }
      for(const b of p.bones){
        b.velocity=b.body.getLinearVelocity();
        if(this.time-p.releasedAt<2.5){const mass=b.body.getMass(),v=b.velocity;b.body.applyForceToCenter({x:-v.x*Math.abs(v.x)*mass*.025,y:-v.y*Math.abs(v.y)*mass*.025,z:-v.z*Math.abs(v.z)*mass*.04},true);}
      }
    }
  }
  afterStep(){
    const events=this.physics.world.getContactEvents();
    for(const contact of events.begin){
      const a=this.shapeOwners.get(contact.shapeUserDataA),b=this.shapeOwners.get(contact.shapeUserDataB);
      if(!a||!b||a.patch===b.patch)continue;
      const moving=a.floor?b:a,velocity=moving.velocity??moving.body.getLinearVelocity(),speed=Math.hypot(velocity.x,velocity.y,velocity.z);
      this.contacts++;
      if(speed>.25){this.emit('impact',clamp(speed/12,.05,.85),moving.body.getPosition(),1,.06,{rate:1/Math.sqrt(moving.patch.cells.length/3)});moving.patch.landed=true;}
    }
  }
  configure(settings){
    this.settings=settings;this.physics.configure(settings.physics);
    for(const p of this.patches)for(const b of p.bones){b.body.setLinearDamping(settings.physics.damping*.16);for(const shape of b.shapes)shape.setDensity(settings.physics.mass*1.6,false);b.body.applyMassFromShapes();}
  }
  update(dt){
    if(!(dt>0)||!Number.isFinite(dt))return;
    // Advance in bounded frame steps so scripted jumps and render frames have
    // identical closure/release ordering and stable Box3D integration.
    if(dt>1/60+1e-8){let rest=dt;while(rest>1e-8){const step=Math.min(rest,1/60);this.update(step);rest-=step;}return;}
    this.time+=dt;this.phaseTime+=dt;
    const p=this.active;
    if(p&&this.phase==='travel'){
      const u=clamp(this.phaseTime/.9),ease=u*u*(3-2*u);
      for(const l of this.lasers){l.previous.copy(l.position);l.position.copy(l.from).lerp(new Vector3(l.target.x,l.target.y,0),ease);l.speed=l.position.distanceTo(l.previous)/dt;}
      if(u===1){this.phase='cut';this.phaseTime=0;p.startedAt=this.time;}
    }else if(p&&this.phase==='cut'){
      for(const l of this.lasers){
        const half=p.contour.length/2,old=p.cut[l.id],remaining=half-old;
        const point=sampleContour(p.contour,(l.id?half:0)+old);
        const edgeRemaining=p.contour.lengths[point.edge+1]-((l.id?half:0)+old);
        const cornerEase=.35+.65*Math.min(1,Math.max(.08,edgeRemaining)/.16);
        const speed=(l.id?1.8:1.65)*cornerEase*(.94+.06*Math.sin(this.phaseTime*1.4+l.id));
        p.cut[l.id]=Math.min(half,old+speed*dt);l.cutting=p.cut[l.id]<half-1e-8;
        const next=sampleContour(p.contour,(l.id?half:0)+p.cut[l.id]);l.previous.copy(l.position);l.position.copy(this.sheetPoint(next.x,next.y));l.speed=(p.cut[l.id]-old)/dt;l.travel+=p.cut[l.id]-old;
        if(remaining>0){this.emit('laser',.11+l.speed*.06,l.position,l.id,.12,{rate:.8+l.speed*.18});this.emit('cut',.12,l.position,l.id,.28,{brightness:1.1});}
      }
      if(p.cut[0]+p.cut[1]>=p.contour.length-1e-7){this.release(p);this.phase='hold';this.phaseTime=0;for(const l of this.lasers)l.cutting=false;}
      else if(this.phaseTime>.2)this.emit('tension',.08+p.cut.reduce((a,b)=>a+b,0)/p.contour.length*.16,this.lasers[0].position,1,.7);
    }else if(this.phase==='hold'&&this.phaseTime>.65)this.assignNext();
    this.physics.step(dt);
    for(const p of this.patches){
      if(p.releasedAt!==null){p.heat=Math.exp(-(this.time-p.releasedAt)*1.8);if(!p.landed&&this.time-p.releasedAt>.25&&this.time-p.releasedAt<2)this.emit('fall',.12,p.bones[0].body.getPosition(),1,.25);}
    }
    for(let i=0;i<16;i++){const l=this.lasers[i%2];l.position.toArray(this.position,i*3);}
    this.progress=this.patches.reduce((sum,p)=>sum+(p.cut[0]+p.cut[1])/p.contour.length,0)/this.patches.length;
  }
  drainSounds(){return this.sounds.splice(0);}
  getCenter(target){
    const reveal=this.reveal;
    target.copy(this.lasers[0].position).add(this.lasers[1].position).multiplyScalar(.5);
    return target.lerp(new Vector3(0,SHEET_Y*.65,0),reveal);
  }
  get reveal(){return this.phase==='complete'?1:Math.max(0,Math.sin(this.time*.17-.8))**6;}
  get cameraAngle(){return .23*Math.sin(this.time*.105)+.22*this.reveal;}
  get stats(){return {physicsEngine:'Box3D',seed:this.seed,time:this.time,phase:this.phase,progress:this.progress,bodies:this.physics.entries.length,joints:this.physics.joints.length,sections:this.patches.length,detached:this.patches.filter(p=>p.releasedAt!==null).length,contacts:this.contacts,laserDistances:this.lasers.map(l=>l.travel),audioEvents:{...this.soundCounts},generation:this.generation};}
  dispose(){this.physics.dispose();}
}
