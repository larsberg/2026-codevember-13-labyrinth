// The inherited Audio tab and setup file own the complete synth configuration.
export const audioFields = {
  distortion: ['Voice distortion (%)', 0, 0, 100, 1],
  enabled: ['Sound', true], volume: ['Volume', .3, 0, 1, .01], tempo: ['Impact tempo (BPM)', 120, 20, 200, 1],
};
export const waveforms = ['triangle', 'sine', 'sawtooth', 'square'];
export const VOICE_NAMES = ['Laser heads', 'Latex'];
export const voiceFields = {
  level: ['Level', .6, 0, 1, .01], gate: ['Gesture length', .7, .1, 1, .01],
  attack: ['Attack (s)', .006, .001, 1, .001], decay: ['Decay (s)', .15, .01, 2, .01],
  sustain: ['Sustain', .8, 0, 1, .01], release: ['Release (s)', .025, .01, 2, .01],
  lowpass: ['Low-pass cutoff (Hz)', 4800, 20, 16000, 10], resonance: ['Filter resonance', .7, .1, 12, .1],
  highpass: ['High-pass cutoff (Hz)', 20, 10, 2000, 10],
  fm: ['Fibre contrast', .1, 0, 12, .05], harmonicity: ['Fibre scale', 2, .25, 8, .05],
  drive: ['Drive', .04, 0, 3, .01], pan: ['Pan', .5, 0, 1, .01],
  reverb: ['Reverb send', .12, 0, 1, .01], roomSize: ['Room size', .6, .1, 4, .1],
  delay: ['Delay send', .06, 0, 1, .01], delayTime: ['Delay spacing (beats)', .75, .125, 2, .125],
  delayFeedback: ['Delay feedback', .25, 0, .75, .01],
};
// Editable output endpoints bound the height mapping, including inverted ranges.
export const modulationTargets = {
  lowpass: ['Low-pass cutoff', 'Hz', 120, 4800], resonance: ['Filter resonance', '', .4, 6],
  highpass: ['High-pass cutoff', 'Hz', 15, 180], fm: ['Fibre contrast', '', .1, 5],
  harmonicity: ['Fibre scale', '', .5, 4], drive: ['Drive', '', .02, 1.5],
  delay: ['Delay send', '', .02, .65], reverb: ['Reverb send', '', .03, .8],
  pan: ['Pan', '', .2, .8],
};
export function defaultVoices() {
  return [0, 1].map(index => ({
    ...Object.fromEntries(Object.entries(voiceFields).map(([key, [, initial]]) => [key, initial])),
    enabled: true, sound: index ? 'triangle' : 'sine', note: index ? 43 : 77,
    rhythm: 'x',
    lowpass:index?7000:2600,fm:index?1:.18,attack:index?.006:.003,release:index?.14:.06,reverb:.02,delay:0,
    level: index ? .42 : .6, pan: index ? .65 : .35, gate: .88,
    modulations: Object.fromEntries(Object.entries(modulationTargets).map(([key, [,, min, max]], i) => [key, {
      enabled: false,
      corner: index ? 15 - i : i, heightMin: 0, heightMax: 4, min, max,
    }])),
  }));
}

// The requested instrument replaces the quiet, onset-only v8 patch. Retain
// independently edited endpoints/corners, while upgrading untouched routes.
export function migrateMoveAudio(audio = {}) {
  const next = structuredClone(audio), defaults = defaultVoices();
  next.enabled = true;
  if ([48, 84, 104].includes(next.tempo)) next.tempo = 120;
  const oldRanges = { lowpass: [180, 900], resonance: [.4, 1.1], highpass: [20, 240], fm: [.05, .4],
    harmonicity: [1, 3], drive: [0, .45], delay: [.02, .12], reverb: [.08, .25], pan: [.2, .8] };
  next.voices?.forEach((voice, i) => {
    const fresh = defaults[i]; if (!fresh) return;
    for (const [key, old] of Object.entries({ attack: .2, decay: .6, sustain: .75, release: .6, gate: .92 }))
      if (voice[key] === old) voice[key] = fresh[key];
    if (i === 1 && voice.sound === 'sine') voice.sound = fresh.sound;
    if (i === 1 && voice.level === .35) voice.level = fresh.level;
    for (const [key, [min, max]] of Object.entries(oldRanges)) {
      const route = voice.modulations?.[key];
      if (!route) continue;
      if (route.min === min && route.max === max) Object.assign(route, { min: fresh.modulations[key].min, max: fresh.modulations[key].max });
      if (route.heightMin === 0 && route.heightMax === 6) route.heightMax = 4;
      if (key !== 'pan') route.enabled = true;
    }
  });
  return next;
}

// Upgrade untouched v7 sounds once. Preserve edited notes, rhythms and mapping
// choices, as well as the user's explicit Sound toggle and master level.
export function migrateBassAudio(audio = {}) {
  const next = structuredClone(audio), defaults = defaultVoices();
  if ([84, 104].includes(next.tempo)) next.tempo = 48;
  next.voices?.forEach((voice, i) => {
    if (!defaults[i]) return;
    const previous = { note: i ? 55 : 36, rhythm: i ? '..x..x.x..x..x..' : 'x...x...x...x...',
      level: i ? .45 : .65, gate: i ? .6 : .85, attack: .008, decay: .15, sustain: .2, release: .12,
      lowpass: 1400, resonance: .8, fm: .25, drive: .08, delay: .16 };
    for (const [key, value] of Object.entries(previous)) if (voice[key] === value) voice[key] = defaults[i][key];
    for (const [key, [min, max]] of Object.entries({ lowpass: [250,2600], resonance: [.5,2.5], fm: [.1,1.2], delay: [.03,.35], reverb: [.04,.4] })) {
      const route = voice.modulations?.[key];
      if (route?.min === min && route.max === max) Object.assign(route, { min: defaults[i].modulations[key].min, max: defaults[i].modulations[key].max });
    }
  });
  return next;
}
export function validateVoices(value = defaultVoices()) {
  if (!Array.isArray(value) || value.length !== 2) throw Error('Use two synth voices.');
  return value.map((voice, i) => {
    const result = defaultVoices()[i], fail = key => { throw Error(`Invalid audio.voices.${i}.${key}.`); };
    if (!voice || typeof voice !== 'object') fail('voice');
    for (const [key, [,, min, max]] of Object.entries(voiceFields)) {
      const x = voice[key] ?? result[key];
      if (!Number.isFinite(x) || x < min || x > max) fail(key);
      result[key] = x;
    }
    result.enabled = voice.enabled ?? result.enabled; if (typeof result.enabled !== 'boolean') fail('enabled');
    result.sound = voice.sound ?? result.sound; if (!waveforms.includes(result.sound)) fail('sound');
    result.note = voice.note ?? result.note; if (!Number.isInteger(result.note) || result.note < 24 || result.note > 96) fail('note');
    result.rhythm = voice.rhythm ?? result.rhythm;
    if (typeof result.rhythm !== 'string' || !/^[xX.\-]{1,32}$/.test(result.rhythm)) fail('rhythm');
    result.rhythm = result.rhythm.toLowerCase().replaceAll('-', '.');
    for (const key of Object.keys(modulationTargets)) {
      const route = { ...result.modulations[key], ...voice.modulations?.[key] };
      if (typeof route.enabled !== 'boolean' || !Number.isInteger(route.corner) || route.corner < 0 || route.corner > 15
        || !['heightMin', 'heightMax', 'min', 'max'].every(field => Number.isFinite(route[field]))
        || route.heightMin === route.heightMax) fail(`modulations.${key}`);
      result.modulations[key] = route;
    }
    return result;
  });
}
