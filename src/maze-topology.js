// A seeded perfect maze. Its corridor tiles are partitioned into connected
// polyominoes; their exact grid boundaries are the laser tool paths.
export function seededRandom(seed){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};}
export const TILE=.68, COLS=19, ROWS=13, SHEET_Y=9.2, THICKNESS=.065;
export function tileCenter(x,y){return {x:(x-COLS/2+.5)*TILE,y:SHEET_Y+(y-ROWS/2+.5)*TILE,z:0};}
export function cornerPoint(x,y){return {x:(x-COLS/2)*TILE,y:SHEET_Y+(y-ROWS/2)*TILE,z:0};}
const key=(x,y)=>`${x},${y}`;
const directions=[[1,0],[0,1],[-1,0],[0,-1]];
export function outline(cells){
  const set=new Set(cells.map(([x,y])=>key(x,y))),edges=[];
  for(const [x,y]of cells){
    if(!set.has(key(x,y-1)))edges.push([[x,y],[x+1,y]]);
    if(!set.has(key(x+1,y)))edges.push([[x+1,y],[x+1,y+1]]);
    if(!set.has(key(x,y+1)))edges.push([[x+1,y+1],[x,y+1]]);
    if(!set.has(key(x-1,y)))edges.push([[x,y+1],[x,y]]);
  }
  const byStart=new Map(edges.map(e=>[key(...e[0]),e])),loop=[];let edge=edges[0];
  do{loop.push(edge[0]);edge=byStart.get(key(...edge[1]));if(loop.length>edges.length)throw Error('Non-simple cut contour');}while(edge!==edges[0]);
  if(loop.length!==edges.length)throw Error('Cut section has a hole');
  const points=loop.map(([x,y])=>cornerPoint(x,y)),lengths=[0];
  for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];lengths.push(lengths.at(-1)+Math.hypot(a.x-b.x,a.y-b.y));}
  return {grid:loop,points,lengths,length:lengths.at(-1)};
}
export function sampleContour(contour,distance){
  const d=Math.max(0,Math.min(contour.length,distance));let i=0;
  while(i<contour.points.length-1&&contour.lengths[i+1]<d)i++;
  const a=contour.points[i],b=contour.points[(i+1)%contour.points.length],u=(d-contour.lengths[i])/(contour.lengths[i+1]-contour.lengths[i]);
  return {x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u,z:0,edge:i};
}
export function generateMaze(seed=732234){
  const random=seededRandom(seed),open=new Set(),visited=new Set(),stack=[[0,0]],w=(COLS-1)/2,h=(ROWS-1)/2;
  visited.add('0,0');open.add('1,1');
  while(stack.length){
    const [x,y]=stack.at(-1),next=directions.map(([dx,dy])=>[x+dx,y+dy,dx,dy]).filter(([a,b])=>a>=0&&a<w&&b>=0&&b<h&&!visited.has(key(a,b)));
    if(!next.length){stack.pop();continue;}
    const [a,b,dx,dy]=next[Math.floor(random()*next.length)];
    open.add(key(x*2+1+dx,y*2+1+dy));open.add(key(a*2+1,b*2+1));visited.add(key(a,b));stack.push([a,b]);
  }
  // Partition the maze tree into short ribbons with bends and branching pieces.
  // Because the maze is a tree, every union has one simple closed perimeter.
  const remaining=new Set(open),patches=[];
  while(remaining.size){
    const start=[...remaining][Math.floor(random()*remaining.size)].split(',').map(Number),cells=[start];remaining.delete(key(...start));
    const target=3+Math.floor(random()*6);
    while(cells.length<target){
      const frontier=cells.flatMap(([x,y])=>directions.map(([dx,dy])=>[x+dx,y+dy])).filter(([x,y])=>remaining.has(key(x,y)));
      if(!frontier.length)break;
      const cell=frontier[Math.floor(random()*frontier.length)];remaining.delete(key(...cell));cells.push(cell);
    }
    patches.push({id:patches.length,cells,contour:outline(cells)});
  }
  // Cut large and small pieces in an interleaved spatial sweep, for a legible
  // reveal instead of random jumps across the entire sheet.
  patches.sort((a,b)=>{
    const center=p=>p.cells.reduce((n,[x,y])=>n+x*.32+y,0)/p.cells.length;
    return center(b)-center(a);
  });
  const walls=[];for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(!open.has(key(x,y)))walls.push([x,y]);
  return {seed,patches,walls,open,cols:COLS,rows:ROWS,tile:TILE};
}
