import test from 'node:test';
import assert from 'node:assert/strict';
import { MenuGame, GRID, INK, WAX, center, touches } from '../src/menu-game.js';
import { validateSetup } from '../src/settings.js';

test('the full enlarged GO target starts a safe stroke and resume still requires the last mark',()=>{
  const g=new MenuGame(13);
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
test('each printed maze has a drawable route to the burger',()=>{
  for(const seed of [1,13,732234,999999]){
    const g=new MenuGame(seed),queue=[0],prev=new Map([[0,null]]);
    for(let i=0;i<queue.length;i++){
      const n=queue[i],x=n%GRID.cols,y=Math.floor(n/GRID.cols);
      for(const [a,b]of [[x-1,y],[x+1,y],[x,y-1],[x,y+1]]){
        const k=b*GRID.cols+a;if(a<0||b<0||a>=GRID.cols||b>=GRID.rows||prev.has(k))continue;
        if(g.walls.some(w=>touches(center(x,y),center(a,b),w)))continue;
        prev.set(k,n);queue.push(k);
      }
    }
    assert.equal(prev.size,GRID.rows*GRID.cols);
    const route=[];for(let k=GRID.rows*GRID.cols-1;k!==null;k=prev.get(k))route.unshift(center(k%GRID.cols,Math.floor(k/GRID.cols)));
    g.pickup();g.press(g.start);for(const p of route)g.move(p);assert.equal(g.phase,'won');
  }
});
test('existing saves retain edited camera and sound preferences when migrated',()=>{
  const migrated=validateSetup({version:13,camera:{yaw:12},audio:{enabled:false},materials:{panels:{color:'#007e80'}}});
  assert.equal(migrated.camera.yaw,12);assert.equal(migrated.audio.enabled,false);assert.equal(migrated.materials.panels.color,'#ffffff');
  assert.deepEqual(validateSetup(migrated),migrated);
});
