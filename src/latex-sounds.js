import { modulateVoice } from './synth.js';

export const FOLEY_LIMITS = Object.freeze({ voices: 6, startsPerSecond: 18, burst: 5, gain: .5 });
export const FOLEY_DURATIONS = Object.freeze({laser:.18,cut:.16,tension:.24,release:.22,fall:.34,impact:.24});
export function foleySamples(kind,variant=0,rate=48000){
  const data=new Float32Array(Math.ceil(rate*FOLEY_DURATIONS[kind]));
  let seed=71+variant,low=0,prev=0;
  for(let i=0;i<data.length;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const t=i/rate,u=i/data.length,noise=seed/2147483648-1;
    low+=(noise-low)*.12;
    const ring=Math.sin(2*Math.PI*(180+variant*8)*t+2*Math.sin(60*t));
    const samples={laser:.35*Math.sin(2*Math.PI*(510+variant*22)*t+.4*Math.sin(440*t)),cut:(noise-prev)*.46,tension:ring*.5,release:(ring+low)*Math.exp(-u*5),fall:low*1.6,impact:(Math.sin(2*Math.PI*(96*t-100*t*t))+low)*Math.exp(-u*8)};
    data[i]=samples[kind]*Math.min(1,i/(rate*.004))*Math.sin(Math.PI*u)**.45;prev=noise;
  }
  return data;
}

export async function loadLatexSounds(api, context) {
  const buffers = Object.fromEntries(Object.keys(FOLEY_DURATIONS).map(kind => [kind, Array.from({ length: 6 }, (_, variant) => {
    const samples = foleySamples(kind, variant, context.sampleRate), buffer = context.createBuffer(1, samples.length, context.sampleRate);
    buffer.copyToChannel(samples, 0); return buffer;
  })]));
  const voices = new Map(), counts = {}, sequence = [0, 0];
  let settings, serial = 0, played = 0, dropped = 0, disposed = false, budget = FOLEY_LIMITS.burst, last = context.currentTime;
  const level = voice => settings?.enabled && settings.voices[voice.index].enabled ? settings.volume * settings.voices[voice.index].level : 0;
  for (const kind of Object.keys(buffers)) api.registerSound(`latex_${kind}`, (time, value, onended) => {
    const voice = voices.get(value.latexTicket); if (!voice || disposed) return;
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
    source.onended = () => { voices.delete(value.latexTicket); source.disconnect(); envelope.disconnect(); gain.disconnect(); source.onended = null; onended(); };
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
      const important = ['impact', 'release'].includes(event.effect);
      if (voices.size >= FOLEY_LIMITS.voices || (!important && (voices.size >= FOLEY_LIMITS.voices - 1 || budget < 1))) { dropped++; return false; }
      const ticket = ++serial, buffer = bank[(event.variant ?? serial) % bank.length];
      const rate = Math.max(.6, Math.min(1.5, (event.rate ?? 1) * 2 ** ((p.note - (index ? 43 : 77)) / 24)));
      const duration=buffer.duration/rate*Math.min(1.3,p.gate/.88);
      const voice = { buffer, rate, index, duration, parameters:p }; voices.set(ticket, voice); budget = Math.max(0, budget - 1);
      // Existing waveform choices select subtle friction color, not oscillators.
      const color = { sine: .85, triangle: 1, sawtooth: 1.15, square: 1.3 }[p.sound];
      const textureLevel = ['brush', 'flutter', 'body', 'pivot'].includes(event.effect) ? .7 : 1;
      try {
        await api.superdough({ s: `latex_${event.effect}`, latexTicket: ticket, orbit: index + 1,
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
