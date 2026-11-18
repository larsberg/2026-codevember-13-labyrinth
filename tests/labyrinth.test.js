import test from 'node:test';
import assert from 'node:assert/strict';
import { MenuGame, GRID, MOBILE_GRID, INK, WAX, center, touches } from '../src/menu-game.js';
import { validateSetup } from '../src/settings.js';

test('GO occupies a two-by-two entrance on the original uniform grid',()=>{
  const width=GRID.width/GRID.cols,height=GRID.height/GRID.rows;
  for(const seed of [1,13,732234,999999]){
    const g=new MenuGame(seed);
    assert.deepEqual(g.start,{x:GRID.x+width,y:GRID.y+height});
    for(const wall of g.walls){
      for(const p of wall){
        const col=(p.x-GRID.x)/width,row=(p.y-GRID.y)/height;
        assert.ok(Math.abs(col-Math.round(col))<1e-10);
        assert.ok(Math.abs(row-Math.round(row))<1e-10);
      }
      for(const x of [0,1])for(const y of [0,1]){
        assert.equal(touches(g.start,center(x,y),wall),false);
      }
    }
  }
});

test('a tangent wax edge loses immediately, including on fast and resumed strokes',()=>{
  const g=new MenuGame(13);assert.equal(g.press(g.start),false);g.pickup();assert.ok(g.press(g.start));
  g.move({x:g.start.x,y:GRID.y+(INK+WAX)/2});assert.equal(g.phase,'lost');
  g.reset();g.pickup();g.press(g.start);g.lift();
  assert.equal(g.press(g.finish),false);assert.ok(g.press(g.start));
  g.move({x:-1000,y:g.start.y});assert.equal(g.phase,'lost');
  assert.ok(Math.abs(g.last.x-(GRID.x+(INK+WAX)/2))<.02);
  const wall=[{x:0,y:0},{x:0,y:60}];
  assert.equal(touches({x:-500,y:30},{x:500,y:30},wall),true);
  const clearY=wall[1].y+(INK+WAX)/2+.01;
  assert.equal(touches({x:-10,y:clearY},{x:10,y:clearY},wall),false);
});

for(const grid of [GRID,MOBILE_GRID]){
  test(`the ${grid.cols}×${grid.rows} GO target starts safely and resume requires the last mark`,()=>{
    const g=new MenuGame(13,grid);
    for(const [dx,dy] of [[28,0],[-28,0],[0,28],[0,-28],[19,19]]){
      const tip={x:g.start.x+dx,y:g.start.y+dy};
      g.reset();g.pickup();
      assert.equal(g.press({x:g.start.x+29,y:g.start.y}),false);
      assert.ok(g.press(tip));g.move(tip);
      assert.equal(g.phase,'drawing');assert.deepEqual(g.last,tip);
      g.lift();assert.equal(g.press(g.start),false);assert.ok(g.press(tip));
      g.move(g.start);assert.equal(g.phase,'drawing');
    }
  });

  test(`each ${grid.cols}×${grid.rows} maze has a drawable route to the burger`,()=>{
    for(const seed of [1,13,732234,999999]){
      const g=new MenuGame(seed,grid),queue=[0],prev=new Map([[0,null]]);
      const cell=(x,y)=>center(x,y,grid);
      for(let i=0;i<queue.length;i++){
        const n=queue[i],x=n%grid.cols,y=Math.floor(n/grid.cols);
        for(const [a,b]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
          const k=b*grid.cols+a;if(a<0||b<0||a>=grid.cols||b>=grid.rows||prev.has(k))continue;
          if(g.walls.some(w=>touches(cell(x,y),cell(a,b),w)))continue;
          prev.set(k,n);queue.push(k);
        }
      }
      assert.equal(prev.size,grid.rows*grid.cols);
      const route=[];for(let k=grid.rows*grid.cols-1;k!==null;k=prev.get(k))route.unshift(cell(k%grid.cols,Math.floor(k/grid.cols)));
      g.pickup();g.press(g.start);for(const p of route)g.move(p);assert.equal(g.phase,'won');
    }
  });
}
test('existing saves retain edited camera and sound preferences when migrated',()=>{
  const migrated=validateSetup({version:13,camera:{yaw:12},audio:{enabled:false},materials:{panels:{color:'#007e80'}}});
  assert.equal(migrated.camera.yaw,12);assert.equal(migrated.audio.enabled,false);assert.equal(migrated.materials.panels.color,'#ffffff');
  assert.deepEqual(validateSetup(migrated),migrated);
});
