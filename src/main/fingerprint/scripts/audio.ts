import type { AudioConfig } from '../../../shared/types'

export function buildAudioScript(config: AudioConfig): string {
  if (config.mode === 'block') {
    return `
(function() {
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
})();
`
  }

  if (config.mode === 'noise') {
    return `
(function() {
  'use strict';

  function seededRng(seed) {
    let s = seed;
    return function() {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }
  const rng = seededRng(${config.noiseSeed});

  const OrigAudioContext = window.AudioContext || window.webkitAudioContext;
  if (!OrigAudioContext) return;

  class PatchedAudioContext extends OrigAudioContext {
    createAnalyser() {
      const analyser = super.createAnalyser();
      const origGetFloatFrequencyData = analyser.getFloatFrequencyData.bind(analyser);
      analyser.getFloatFrequencyData = function(array) {
        origGetFloatFrequencyData(array);
        for (let i = 0; i < array.length; i++) {
          array[i] += (rng() - 0.5) * 0.002; // micro-noise
        }
      };
      const origGetByteFrequencyData = analyser.getByteFrequencyData.bind(analyser);
      analyser.getByteFrequencyData = function(array) {
        origGetByteFrequencyData(array);
        for (let i = 0; i < array.length; i++) {
          array[i] = Math.max(0, Math.min(255, array[i] + Math.floor(rng() * 3) - 1));
        }
      };
      return analyser;
    }

    createOscillator() {
      const osc = super.createOscillator();
      // Slightly perturb frequency to generate unique audio fingerprint
      const origFreqValue = osc.frequency.value;
      osc.frequency.value = origFreqValue + (rng() - 0.5) * 0.1;
      return osc;
    }
  }

  window.AudioContext = PatchedAudioContext;
  if ('webkitAudioContext' in window) {
    window.webkitAudioContext = PatchedAudioContext;
  }
})();
`
  }

  return '' // mode === 'real'
}
