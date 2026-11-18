import { sequence, pure } from '@strudel/core/pattern.mjs';
import announcerUrl from './assets/you-failed.mp3?url';

// Two low impacts underneath the spoken cue, timed on the audio clock.
const impacts = sequence(pure(78), pure(54));
export function menuAudio(status) {
  let context, settings, loading, running = true, events = 0, revision = 0;
  const active = new Set();
  let currentVoice;
  function updateVoice() {
    if (!currentVoice) return;
    const {gain, filter, shaper} = currentVoice;
    const voice = settings.voices[0], now = context.currentTime;
    gain.gain.setTargetAtTime(Math.sqrt(settings.volume * voice.level), now, .012);
    filter.frequency.setTargetAtTime(Math.min(20000, voice.lowpass * 2), now, .012);
    const amount = settings.distortion ?? 0;
    if (currentVoice.amount === amount) return;
    currentVoice.amount = amount;
    if (!amount) { shaper.curve = null; return; }
    const drive = 1 + 12 * amount / 100;
    const curve = new Float32Array(2049);
    for (let i = 0; i < curve.length; i++) {
      const x = 2 * i / (curve.length - 1) - 1;
      curve[i] = Math.tanh(drive * x) / Math.tanh(drive);
    }
    shaper.curve = curve;
  }

  function stop() {
    revision++;
    currentVoice = null;
    for (const source of active) source.stop();
    active.clear();
  }
  function report(message) {
    status({enabled: !!settings?.enabled, playing: context?.state === 'running' && running && settings?.enabled,
      message: message ?? (settings?.enabled ? 'Game sounds enabled' : 'Game sounds muted')});
  }
  function loadClip() {
    if (!loading) loading = fetch(announcerUrl).then(response => {
      if (!response.ok) throw Error('Could not load the failure announcement.');
      return response.arrayBuffer();
    }).then(bytes => context.decodeAudioData(bytes)).catch(error => {
      loading = null;
      throw error;
    });
    return loading;
  }
  function track(source, ...nodes) {
    active.add(source);
    source.onended = () => {
      active.delete(source);
      if (currentVoice?.source === source) currentVoice = null;
      source.disconnect();
      for (const node of nodes) node.disconnect();
    };
  }
  async function alarm(preview = false) {
    if (!context || !settings?.enabled || (!running && !preview)) return;
    stop();
    const request = revision;
    try {
      const clip = await loadClip();
      if (request !== revision || !settings.voices[0].enabled) return;
      const voice = settings.voices[0], level = Math.sqrt(settings.volume * voice.level);
      if (!level) return;
      const at = context.currentTime + .005;
      const spoken = context.createBufferSource(), gain = context.createGain(), filter = context.createBiquadFilter();
      spoken.buffer = clip;
      filter.frequency.value = Math.min(20000, voice.lowpass * 2);
      gain.gain.value = level;
      const shaper = context.createWaveShaper();
      shaper.oversample = '2x';
      currentVoice = {source: spoken, gain, filter, shaper};
      updateVoice();
      spoken.connect(shaper).connect(filter).connect(gain).connect(context.destination);
      track(spoken, gain, filter, shaper);
      spoken.start(at);
      for (const hit of impacts.queryArc(0, 1)) {
        const osc = context.createOscillator(), env = context.createGain();
        const time = at + Number(hit.whole.begin) * .85 * 120 / settings.tempo;
        osc.frequency.setValueAtTime(hit.value, time);
        osc.frequency.exponentialRampToValueAtTime(36, time + .15);
        env.gain.setValueAtTime(.0001, time);
        env.gain.exponentialRampToValueAtTime(Math.max(.0001, level * .09), time + .009);
        env.gain.exponentialRampToValueAtTime(.0001, time + .18);
        osc.connect(env).connect(context.destination);
        track(osc, env);
        osc.start(time);
        osc.stop(time + .19);
      }
      events++;
    } catch (error) { if (request === revision) report(error.message); }
  }
  return {
    configure(value) { settings = value; if (!value.enabled) stop(); else updateVoice(); report(); },
    async unlock() {
      if (!settings?.enabled) return;
      context ??= new AudioContext();
      await Promise.all([context.resume(), loadClip()]);
      report();
    },
    alarm, clearEffects: stop,
    update(_dt, play) { if (running && !play) stop(); running = play; },
    get diagnostics() { return {engine:'Strudel', events}; },
    get unlocked() { return context?.state === 'running'; },
    get modulation() { return []; },
    dispose() { stop(); if (context) void context.close(); }
  };
}
