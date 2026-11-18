import {DataTexture, LinearFilter, LinearMipmapLinearFilter, RepeatWrapping, SRGBColorSpace} from 'three';
import {seededRandom} from './maze-topology.js';

// A seamless four-check repeat. The mixed checks use the diagonal red yarn
// from the reference. Colour and thread relief share the same weave.
export function dressTable(material, renderer){
  const size=512, rgb=new Uint8Array(size*size*4), relief=new Uint8Array(rgb.length);
  const random=seededRandom(1313), tau=Math.PI*2;
  const white=[248,246,241], red=[143,17,33];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size, v=y/size;
    const warp=x+1.1*Math.sin(tau*v)+.35*Math.sin(4*tau*v);
    const weft=y+.85*Math.cos(tau*u)+.3*Math.cos(3*tau*u);
    const column=Math.cos(tau*warp/size)>0, row=Math.cos(tau*weft/size)>0;
    const stripe=Math.sin(tau*(warp+weft)/16);
    const dye=column===row?(row?1:0):Math.max(0,Math.min(1,.5+2.4*stripe));
    const thread=Math.cos(tau*warp/4)*Math.cos(tau*weft/4);
    const grain=random()-.5, light=1+.024*thread+.033*grain;
    const index=(y*size+x)*4;
    for(let c=0;c<3;c++){
      rgb[index+c]=Math.min(255,(white[c]+dye*(red[c]-white[c]))*light);
      relief[index+c]=128+43*thread+19*grain;
    }
    rgb[index+3]=relief[index+3]=255;
  }
  function repeat(data){
    const map=new DataTexture(data,size,size);
    map.wrapS=map.wrapT=RepeatWrapping;
    map.repeat.set(8000,8000);
    map.magFilter=LinearFilter;map.minFilter=LinearMipmapLinearFilter;map.generateMipmaps=true;
    map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());map.needsUpdate=true;
    return map;
  }
  const color=repeat(rgb),bump=repeat(relief);color.colorSpace=SRGBColorSpace;
  material.map=color;material.bumpMap=bump;material.bumpScale=.006;material.roughness=.96;
  material.color.set('#ffffff');
  return ()=>{color.dispose();bump.dispose();};
}
