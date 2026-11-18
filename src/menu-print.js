import { PAPER,INK,WAX } from './menu-game.js';
import { seededRandom } from './maze-topology.js';
const BLACK='#171717',WHITE='#fafafa';
function type(c,text,x,y,size,font='Georgia',weight='bold',align='center'){
  c.font=weight+' '+size+'px '+font;c.textAlign=align;c.fillText(text,x,y);
}
function checker(c,x,y,count){
  for(let i=0;i<count;i++)for(let j=0;j<2;j++)if((i+j)%2===0)c.fillRect(x+i*12,y+j*12,12,12);
}
function burger(c,x,y,scale){
  c.save();c.translate(x,y);c.scale(scale,scale);c.lineWidth=4;c.lineJoin='round';c.fillStyle=WHITE;
  for(const path of ['M-54 0 Q-52 -43 0 -43 Q48 -42 54 0 Z','M-54 8 Q-43 -1 -32 8 T-10 8 T12 8 T35 8 Q47 3 54 9 Q55 16 45 17 L-45 17 Q-58 16 -54 8Z','M-50 23 L50 23 Q48 40 30 40 L-30 40 Q-49 39 -50 23Z']){
    const shape=new Path2D(path);c.fill(shape);c.stroke(shape);
  }
  for(const [a,b] of [[-30,-14],[-12,-26],[5,-13],[20,-25],[34,-12]]){c.beginPath();c.moveTo(a,b);c.lineTo(a+4,b-2);c.stroke();}
  c.restore();
}
function shake(c,x,y){
  c.save();c.translate(x,y);c.rotate(.13);c.lineWidth=4;c.fillStyle=WHITE;
  for(const p of ['M8 -33 L18 -62 L27 -60 L17 -30Z','M-33 -20 Q-44 -34 -29 -37 Q-25 -51 -12 -46 Q-2 -59 11 -47 Q27 -52 33 -37 Q42 -32 34 -22Z','M-34 -22 L34 -22 L24 50 L-24 50 Z','M-36 -22 L36 -22 L36 -14 L-36 -14Z']){
    const shape=new Path2D(p);c.fill(shape);c.stroke(shape);
  }
  c.beginPath();c.arc(0,14,15,0,Math.PI*2);c.stroke();c.beginPath();c.arc(0,13,8,.15,Math.PI-.15);c.stroke();c.restore();
}
export const BLACK_WAX='#161616';
function waxPigment(context){
  const tile=document.createElement('canvas');tile.width=tile.height=64;
  const pigment=tile.getContext('2d'),random=seededRandom(239);
  pigment.fillStyle=BLACK_WAX;pigment.fillRect(0,0,64,64);
  // Small breaks in the wax let the raised tooth of the paper show through.
  for(let i=0;i<470;i++){
    pigment.fillStyle='rgba(246,246,246,'+(.12+random()*.44)+')';
    pigment.fillRect(random()*64,random()*64,1+random()*1.3,1);
  }
  return context.createPattern(tile,'repeat');
}
export function menuPrint(game){
  const canvas=document.createElement('canvas');canvas.width=PAPER.width;canvas.height=PAPER.height;
  const c=canvas.getContext('2d'),base=document.createElement('canvas');base.width=canvas.width;base.height=canvas.height;
  const b=base.getContext('2d');b.fillStyle=WHITE;b.fillRect(0,0,900,1080);
  const r=seededRandom(1331);b.fillStyle='rgba(0,0,0,.045)';
  for(let i=0;i<32000;i++)b.fillRect(r()*900,r()*1080,r()*1.8+.2,1);
  b.fillStyle=b.strokeStyle=BLACK;b.lineWidth=2;b.strokeRect(21,21,858,1038);
  checker(b,51,49,15);checker(b,669,49,15);
  type(b,'★    FAMILY DINER    ★',450,68,23,'monospace');
  burger(b,119,156,1.04);shake(b,785,150);
  type(b,'Little Bites',450,175,100,'Georgia','italic bold');
  type(b,'K I D S ’   M E N U',450,213,22,'sans-serif');
  b.fillRect(65,241,770,3);type(b,'BERGER MAZE',66,299,43,'sans-serif','900','left');
  type(b,'Get to the grill!',835,296,26,'Georgia','italic','right');
  b.lineWidth=INK;b.lineCap='round';b.beginPath();
  for(const [a,d]of game.walls){b.moveTo(a.x,a.y);b.lineTo(d.x,d.y);}b.stroke();
  b.beginPath();b.arc(game.start.x,game.start.y,12,0,Math.PI*2);b.stroke();
  type(b,'GO',game.start.x,game.start.y+5,13,'sans-serif');burger(b,game.finish.x,game.finish.y,.28);
  b.fillRect(65,905,770,2);
  type(b,'★    GRILLED CHEESE    •    MINI BURGERS    •    MILKSHAKES    ★',450,1040,16,'monospace');
  const ink=document.createElement('canvas');ink.width=900;ink.height=1080;
  const pen=ink.getContext('2d');pen.strokeStyle=waxPigment(pen);pen.lineWidth=WAX;pen.lineCap='round';
  function stroke(a,d){pen.beginPath();pen.moveTo(a.x,a.y);pen.lineTo(d.x,d.y);pen.stroke();}
  function refresh(){
    c.drawImage(base,0,0);c.drawImage(ink,0,0);c.fillStyle=BLACK;
    const msg={pickup:'Pick up the crayon',ready:'Press GO. Draw to the burger.',drawing:game.drawing?'Stay between the lines!':'Resume at your last mark.'};
    if(msg[game.phase]){
      type(c,msg[game.phase],65,957,33,'Georgia','italic bold','left');
      type(c,'Keep the crayon clear of every wall.',65,1000,21,'sans-serif','normal','left');
      if(game.phase==='pickup')type(c,'➜',428,957,34,'sans-serif');
    }else{
      c.save();c.translate(450,595);c.rotate(-.085);c.fillStyle=WHITE;c.fillRect(-403,-105,806,210);
      c.fillStyle=BLACK;c.fillRect(-394,-96,788,192);c.fillStyle=WHITE;
      type(c,game.phase==='lost'?'FAILURE':'ORDER UP!',0,game.phase==='lost'?38:19,106,'Impact, sans-serif','900');
      if(game.phase==='won')type(c,'YOU FOUND THE GRILL!',0,69,25,'monospace');
      c.restore();
      type(c,'Tap the paper to play again.',450,970,35,'Georgia','italic bold');
    }
  }
  refresh();return {canvas,refresh,stroke,clear(){pen.clearRect(0,0,900,1080);}};
}
