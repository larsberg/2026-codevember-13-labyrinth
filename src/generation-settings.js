export function defaultCadence(){return {bars:6,rhythm:'x'};}

export function validateCadence(value={}){
  const result={...defaultCadence(),...value};
  if(!Number.isFinite(result.bars)||result.bars<.25||result.bars>128)throw Error('Invalid cadence.bars.');
  if(typeof result.rhythm!=='string'||!/^([xX.\-]){1,16}$/.test(result.rhythm)||!/[xX]/.test(result.rhythm))throw Error('Use 1–16 cadence steps with x for arrivals and . for rests.');
  return {bars:result.bars,rhythm:result.rhythm.toLowerCase().replaceAll('-','.')};
}
