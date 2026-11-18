import { modulateVoice } from './synth.js';

export const FOLEY_LIMITS = Object.freeze({ voices: 6, startsPerSecond: 18, burst: 5, gain: .5 });
export const FOLEY_DURATIONS = Object.freeze({ landing: .23, foot: .085, lift: .055, pivot: .14,
  brush: .21, flutter: .32, body: .29, air: .32, wood: .075, glass: .095 });

// Original procedural foley, baked once into sample banks. Broad-band friction
// and damped impacts only: no pitched carriers, calls, downloaded samples or loops.
export function foleySamples(kind, variant = 0, rate = 48000) {
  if (!(kind in FOLEY_DURATIONS)) throw Error(`Unknown foley texture: ${kind}`);
  const data = new Float32Array(Math.ceil(rate * FOLEY_DURATIONS[kind]));
  let seed = (17041 + variant * 7919 + Object.keys(FOLEY_DURATIONS).indexOf(kind) * 104729) >>> 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const cutoff = [80, 300, 1100, 4500].map(hz => 1 - Math.exp(-2 * Math.PI * hz / rate));
  const lows = [0, 0, 0, 0], grainCount = ['brush', 'flutter', 'pivot'].includes(kind) ? 19 : 7;
  const grains = Array.from({ length: grainCount }, () => ({ at: random(), width: .012 + random() * .055, power: .2 + random() * .8 }));
  const flutter = [.04, .38 + random() * .08, .7 + random() * .07];
  let peak = 0;
  for (let i = 0; i < data.length; i++) {
    const u = i / (data.length - 1), t = i / rate, noise = random() * 2 - 1;
    lows.forEach((_, j) => lows[j] += cutoff[j] * (noise - lows[j]));
    const soft = lows[1] - lows[0], fibre = lows[3] - lows[2], mid = lows[2] - lows[1];
    let grain = .12;
    for (const g of grains) { const d = (u - g.at) / g.width; if (Math.abs(d) < 3) grain += g.power * Math.exp(-d * d * 2); }
    let value = 0;
    if (kind === 'landing') value = (lows[0] * 7 + soft * 1.6) * Math.exp(-u * 8) + mid * .25 * Math.exp(-u * 20);
    if (kind === 'foot') value = (soft * 2.2 + mid * .5) * Math.exp(-u * 10) + fibre * grain * .12 * Math.exp(-u * 6);
    if (kind === 'lift') value = (mid * .7 + fibre * .17) * grain * Math.sin(Math.PI * u) ** 2;
    if (kind === 'pivot') value = (mid * .6 + fibre * .33) * grain * Math.sin(Math.PI * u) ** .8;
    if (kind === 'brush') value = (fibre * .45 + mid * .36 + soft * .12) * grain * Math.sin(Math.PI * u) ** 1.3;
    if (kind === 'flutter') {
      const envelope = flutter.reduce((n, at, j) => n + Math.exp(-(((u - at) / (.11 - j * .015)) ** 2)) * (1 - j * .3), 0);
      value = (mid * .5 + fibre * .26) * grain * envelope;
    }
    if (kind === 'body') value = (soft * .6 + mid * .4 + fibre * .1) * grain * Math.sin(Math.PI * u) ** 1.5;
    if (kind === 'air') value = (mid * .45 + fibre * .15) * (.7 + grain * .2) * Math.sin(Math.PI * u) ** 1.5;
    if (kind === 'wood') value = (soft * 1.2 + mid * .6) * Math.exp(-u * 13);
    if (kind === 'glass') value = (mid * .3 + fibre * .3) * grain * Math.exp(-u * 7);
    const fade = Math.min(1, t / .003) * Math.min(1, (data.length - 1 - i) / (rate * .008));
    data[i] = value * fade; peak = Math.max(peak, Math.abs(data[i]));
  }
  const scale = .65 / Math.max(peak, .001);
  for (let i = 0; i < data.length; i++) data[i] *= scale;
  return data;
}

export async function loadRindSounds(api, context) {
  const buffers = Object.fromEntries(Object.keys(FOLEY_DURATIONS).map(kind => [kind, Array.from({ length: 6 }, (_, variant) => {
    const samples = foleySamples(kind, variant, context.sampleRate), buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(samples, 0); return buffer;
  })]));
  const voices = new Map(), counts = {}, sequence = [0, 0];
  let settings, serial = 0, played = 0, dropped = 0, disposed = false, budget = FOLEY_LIMITS.burst, last = context.currentTime;
  const level = voice => settings?.enabled && settings.voices[voice.index].enabled ? settings.volume * settings.voices[voice.index].level : 0;
  for (const kind of Object.keys(buffers)) api.registerSound(`rind_${kind}`, (time, value, onended) => {
    const voice = voices.get(value.rindTicket); if (!voice || disposed) return;
    const source = context.createBufferSource(), gain = context.createGain(), envelope = context.createGain();
    voice.source = source; voice.gain = gain; source.buffer = voice.buffer; source.playbackRate.value = voice.rate;
    const length=Math.min(voice.duration,voice.buffer.duration/voice.rate),p=voice.parameters;
    const attack=Math.min(p.attack,length*.3),decay=Math.min(p.decay,length*.3),release=Math.min(p.release,length*.3);
    envelope.gain.setValueAtTime(0,time);
    envelope.gain.linearRampToValueAtTime(1,time+attack);
    envelope.gain.linearRampToValueAtTime(p.sustain,time+attack+decay);
    envelope.gain.setValueAtTime(p.sustain,time+length-release);
    envelope.gain.linearRampToValueAtTime(0,time+length);
    gain.gain.value = level(voice); source.connect(envelope); envelope.connect(gain);
    source.onended = () => { voices.delete(value.rindTicket); source.disconnect(); envelope.disconnect(); gain.disconnect(); source.onended = null; onended(); };
    source.start(time); source.stop(time+length); played++; counts[kind] = (counts[kind] ?? 0) + 1;
    return { node: gain, nodes: { source: [source], foleyEnvelope:[envelope], foleyGain: [gain] }, stop: at => { try { source.stop(at ?? context.currentTime); } catch {} } };
  }, { type: 'sample' });
  return {
    configure(next) {
      settings = next;
      for (const voice of voices.values()) voice.gain?.gain.setTargetAtTime(level(voice), context.currentTime, .01);
    },
    async play(event, volume, savedVoices, positions, floor) {
      const bank = buffers[event.effect], now = context.currentTime, index = event.voice ?? 1;
      if (!bank || disposed || context.state !== 'running' || !(volume > 0) || !(event.power > 0)) return false;
      const p = modulateVoice(savedVoices[index], positions, floor).parameters;
      const step = sequence[index]++;
      if (!p.enabled || p.level <= 0 || p.rhythm[step % p.rhythm.length] !== 'x') return false;
      budget = Math.min(FOLEY_LIMITS.burst, budget + Math.max(0, now - last) * FOLEY_LIMITS.startsPerSecond); last = now;
      const important = ['landing', 'foot'].includes(event.effect);
      if (voices.size >= FOLEY_LIMITS.voices || (!important && (voices.size >= FOLEY_LIMITS.voices - 1 || budget < 1))) { dropped++; return false; }
      const ticket = ++serial, buffer = bank[(event.variant ?? serial) % bank.length];
      const rate = Math.max(.6, Math.min(1.5, (event.rate ?? 1) * 2 ** ((p.note - (index ? 43 : 77)) / 24)));
      const duration=buffer.duration/rate*Math.min(1.3,p.gate/.88);
      const voice = { buffer, rate, index, duration, parameters:p }; voices.set(ticket, voice); budget = Math.max(0, budget - 1);
      // Existing waveform choices select subtle friction color, not oscillators.
      const color = { sine: .85, triangle: 1, sawtooth: 1.15, square: 1.3 }[p.sound];
      const textureLevel = ['brush', 'flutter', 'body', 'pivot'].includes(event.effect) ? .7 : 1;
      try {
        await api.superdough({ s: `rind_${event.effect}`, rindTicket: ticket, orbit: index + 1,
          gain: FOLEY_LIMITS.gain * textureLevel * Math.min(1, event.power) / Math.sqrt(Math.max(1, voices.size * .65)),
          pan: Math.max(.15, Math.min(.85, (event.pan ?? .5) + (p.pan - (index ? .65 : .35)) * .5)),
          cutoff: Math.min(18000,p.lowpass * color * (event.brightness??1) * (p.harmonicity/2)**.2), hcutoff: p.highpass, resonance: Math.min(p.resonance, 2),
          attack: p.attack, decay: p.decay, sustain: p.sustain, release: Math.min(.15, p.release),
          room: p.reverb, roomsize: p.roomSize, delay: p.delay, delaytime: p.delayTime * 60 / settings.tempo,
          delayfeedback: p.delayFeedback, distort: (p.drive+p.fm*.08) * .1 }, now + .008, duration);
        if (!voice.source) voices.delete(ticket); return !!voice.source;
      } catch (error) { voices.delete(ticket); voice.source?.stop(); throw error; }
    },
    stop() {
      const active = [...voices.values()]; voices.clear(); budget = FOLEY_LIMITS.burst; last = context.currentTime;
      for (const voice of active) { try { voice.source?.stop(context.currentTime); } catch {} }
    },
    dispose() { this.stop(); disposed = true; for(const bank of Object.values(buffers))bank.length=0; },
    get diagnostics() { return { voices: voices.size, maxVoices: FOLEY_LIMITS.voices, played, dropped, counts: { ...counts },
      bufferBytes: Object.values(buffers).flat().reduce((n, b) => n + b.length * 4, 0) }; },
  };
}
