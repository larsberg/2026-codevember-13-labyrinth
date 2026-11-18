import { seededRandom } from './maze-topology.js';

export const PAPER = { width: 900, height: 1080 };
export const GRID = { x: 65, y: 333, cols: 15, rows: 14, width: 770, height: 539 };
export const INK = 3.5, WAX = 14;
export const GO_RADIUS = 24;
const startCellSize = 80;
const point = (x, y) => ({x,y});
// Give GO a square starting cell, sharing the remaining paper evenly among the other lanes.
function gridLines(origin, span, count) {
  const lane = (span - startCellSize) / (count - 1);
  return Array.from({length:count+1}, (_,i) => i===0 ? origin : origin+startCellSize+(i-1)*lane);
}
const columnEdges = gridLines(GRID.x, GRID.width, GRID.cols);
const rowEdges = gridLines(GRID.y, GRID.height, GRID.rows);
export const center = (x,y) => point((columnEdges[x]+columnEdges[x+1])/2,(rowEdges[y]+rowEdges[y+1])/2);

export function menuMaze(seed) {
  const {cols,rows}=GRID, random=seededRandom(seed);
  const edge = (a,b) => [Math.min(a,b),Math.max(a,b)].join('/');
  const visited=new Set([0]), stack=[0], doors=new Set();
  while(stack.length){
    const a=stack.at(-1), x=a%cols, y=Math.floor(a/cols);
    const choices=[[x+1,y],[x-1,y],[x,y+1],[x,y-1]]
      .filter(([i,j])=>i>=0&&i<cols&&j>=0&&j<rows)
      .map(([i,j])=>j*cols+i).filter(b=>!visited.has(b));
    if(!choices.length){stack.pop();continue;}
    const b=choices[Math.floor(random()*choices.length)];
    visited.add(b);doors.add(edge(a,b));stack.push(b);
  }
  const walls=[];
  function wall(x,y,dx,dy){
    walls.push([point(columnEdges[x],rowEdges[y]),point(columnEdges[x+dx],rowEdges[y+dy])]);
  }
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
    const a=y*cols+x;
    if(x===0)wall(x,y,0,1);
    if(y===0)wall(x,y,1,0);
    if(x===cols-1||!doors.has(edge(a,a+1)))wall(x+1,y,0,1);
    if(y===rows-1||!doors.has(edge(a,a+cols)))wall(x,y+1,1,0);
  }
  return {walls,start:center(0,0),finish:center(cols-1,rows-1)};
}
function distanceToSegment(p,a,b){
  const dx=b.x-a.x,dy=b.y-a.y;
  const u=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p.x-a.x-u*dx,p.y-a.y-u*dy);
}
export function touches(a,b,[c,d]){
  const cross=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x);
  if(cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)return true;
  return Math.min(distanceToSegment(a,c,d),distanceToSegment(b,c,d),
    distanceToSegment(c,a,b),distanceToSegment(d,a,b))<=(INK+WAX)/2;
}
export class MenuGame {
  constructor(seed){Object.assign(this,menuMaze(seed));this.reset();}
  reset(){this.phase='pickup';this.last=null;this.drawing=false;}
  pickup(){if(this.phase==='pickup')this.phase='ready';}
  press(p){
    if(this.phase==='ready'){
      if(Math.hypot(p.x-this.start.x,p.y-this.start.y)>GO_RADIUS+4)return false;
      this.last=p;this.phase='drawing';
    }else if(this.phase!=='drawing'||Math.hypot(p.x-this.last.x,p.y-this.last.y)>14)return false;
    this.drawing=true;return true;
  }
  move(p){
    if(!this.drawing)return;
    if(this.walls.some(w=>touches(this.last,p,w))){
      // Locate the first point of contact even on a long, coalesced stroke.
      const from=this.last;
      const along=t=>({x:from.x+(p.x-from.x)*t,y:from.y+(p.y-from.y)*t});
      let lo=0,hi=1;
      for(let i=0;i<16;i++){
        const mid=(lo+hi)/2;
        if(this.walls.some(w=>touches(from,along(mid),w)))hi=mid;else lo=mid;
      }
      this.last=along(hi);this.phase='lost';this.drawing=false;return;
    }
    this.last=p;
    if(distanceToSegment(p,this.finish,this.finish)<=13){this.phase='won';this.drawing=false;}
  }
  lift(){this.drawing=false;}
}
