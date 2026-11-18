import { defaultVoices, modulationTargets, voiceFields, waveforms, VOICE_NAMES } from './synth-settings.js';

const noteName = midi => `${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][midi % 12]}${Math.floor(midi / 12) - 1}`;
export function synthControlsMarkup() {
  const slider = (voice, key) => {
    const [label,, min, max, step] = voiceFields[key], id = `synth-${voice}-${key}`;
    return `<label class="slider-label" for="${id}">${label}<output></output></label><input id="${id}" data-synth-voice="${voice}" data-synth-key="${key}" type="range" min="${min}" max="${max}" step="${step}">`;
  };
  return `<details class="material-group"><summary>Failure announcer</summary>
    ${slider(0,'level')}${slider(0,'lowpass')}</details>`;
}

export function bindSynthControls(root, { getVoices, change }) {
  const inputs = [...root.querySelectorAll('[data-synth-voice][data-synth-key]')];
  function sync() {
    const voices = getVoices();
    for (const input of inputs) {
      const { synthVoice, synthKey, synthRoute } = input.dataset;
      const values = synthRoute ? voices[synthVoice].modulations[synthRoute] : voices[synthVoice], value = values[synthKey];
      if (input.type === 'checkbox') input.checked = value;
      else if (input !== root.ownerDocument?.activeElement) input.value = value;
      const output = root.querySelector(`label[for="${input.id}"] output`); if (output) output.value = String(value);
    }
  }
  for (const input of inputs) {
    input.addEventListener(input.type === 'range' || input.type === 'checkbox' ? 'input' : 'change', () => {
      if (!input.checkValidity() || input.value === '') return;
      const { synthVoice, synthKey, synthRoute } = input.dataset, voices = structuredClone(getVoices());
      const values = synthRoute ? voices[synthVoice].modulations[synthRoute] : voices[synthVoice];
      values[synthKey] = input.type === 'checkbox' ? input.checked : ['sound', 'rhythm'].includes(synthKey) ? input.value : Number(input.value);
      change(voices);
    });
    input.addEventListener('blur', sync);
  }
  return { sync, frame(modulation) {
    for (const output of root.querySelectorAll('[data-synth-value]')) {
      const [index, key] = output.dataset.synthValue.split(':'), route = modulation[index]?.[key];
      if (route) output.value = `${route.enabled ? `Body ${route.corner + 1} · ${route.height.toFixed(2)} →` : 'Base →'} ${Number(route.value.toFixed(3))} ${modulationTargets[key][1]}`;
    }
  } };
}
