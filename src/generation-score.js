// Import Strudel's pure pattern engine without its audio/WebAudio entry point.
// Creature arrivals must work before a gesture and with Sound switched off.
import { pure, sequence, silence } from '@strudel/core/pattern.mjs';
import { validateCadence } from './generation-settings.js';

export function createGenerationPattern(cadence){
  const {bars,rhythm}=validateCadence(cadence);
  return sequence(...[...rhythm].map(hit=>hit==='x'?pure('arrive'):silence)).slow(bars);
}

export class GenerationScore {
  constructor(cadence,tempo){this.cycle=0;this.arrivals=0;this.lastOnset=0;this.configure(cadence,tempo);}
  configure(cadence,tempo){
    if(!Number.isFinite(tempo)||tempo<=0)throw Error('Invalid generation tempo.');
    const next=validateCadence(cadence),key=JSON.stringify(next);
    if(key!==this.key){this.pattern=createGenerationPattern(next);this.key=key;this.cadence=next;}
    this.tempo=tempo;
  }
  reset(){this.cycle=0;this.arrivals=0;this.lastOnset=0;}
  advance(seconds){
    const from=this.cycle;
    if(!Number.isFinite(seconds)||seconds<=0)return {from,to:from,events:[]};
    const to=from+seconds*this.tempo/240,events=[];
    // Query around exact boundaries, then deduplicate rational Strudel onsets.
    // The already-present first creature owns onset zero.
    for(const hap of this.pattern.queryArc(Math.max(0,from-1e-6),to+1e-6)){
      const cycle=Number(hap.whole?.begin);
      if(!hap.hasOnset()||!Number.isFinite(cycle)||cycle<=this.lastOnset+1e-9||cycle>to+1e-9)continue;
      events.push({cycle,offset:Math.max(0,Math.min(seconds,(cycle-from)*240/this.tempo))});
    }
    events.sort((a,b)=>a.cycle-b.cycle);
    for(const event of events){this.arrivals++;this.lastOnset=event.cycle;}
    this.cycle=to;
    return {from,to,events};
  }
  get diagnostics(){return {engine:'Strudel',cycle:this.cycle,arrivals:this.arrivals,tempo:this.tempo,...this.cadence};}
}
