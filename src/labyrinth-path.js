import { Vector3 } from 'three';
export const RADIUS=4, CENTER_Y=12, TURNS=7;
// One uninterrupted winding; the oscillating latitude folds each passage back
// toward its neighbours, making a labyrinth rather than a plain helical cut.
export function pathPoint(t,r=RADIUS){
  const a=t*Math.PI*2*TURNS, phi=.32+2.5*t+.095*Math.sin(a*5);
  return new Vector3(-r*Math.cos(a)*Math.sin(phi), CENTER_Y+r*Math.cos(phi)*.96, r*Math.sin(a)*Math.sin(phi));
}
export function pathNormal(t){return pathPoint(t).sub(new Vector3(0,CENTER_Y,0)).normalize();}
export function pathTangent(t){return pathPoint(Math.min(1,t+.0001)).sub(pathPoint(Math.max(0,t-.0001))).normalize();}
