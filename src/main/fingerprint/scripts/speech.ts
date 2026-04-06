import type { SpeechConfig, OsConfig } from '../../../shared/types'

const OS_VOICES: Record<string, Array<{ name: string; lang: string; localService: boolean; default: boolean }>> = {
  Win32: [
    { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US', localService: true,  default: true  },
    { name: 'Microsoft Mark Desktop - English (United States)',  lang: 'en-US', localService: true,  default: false },
    { name: 'Microsoft Zira Desktop - English (United States)',  lang: 'en-US', localService: true,  default: false },
  ],
  MacIntel: [
    { name: 'Alex',     lang: 'en-US', localService: true, default: true  },
    { name: 'Samantha', lang: 'en-US', localService: true, default: false },
    { name: 'Victoria', lang: 'en-US', localService: true, default: false },
    { name: 'Karen',    lang: 'en-AU', localService: true, default: false },
    { name: 'Daniel',   lang: 'en-GB', localService: true, default: false },
  ],
  'Linux x86_64': []
}

export function buildSpeechScript(config: SpeechConfig, os: OsConfig): string {
  if (config.mode === 'real') return ''

  const voices = OS_VOICES[os.platform] ?? []

  // Linux with no voices — block the API or return empty
  if (voices.length === 0) {
    return `
(function() {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.getVoices = () => [];
  window.speechSynthesis.speak = () => {};
})();
`
  }

  return `
(function() {
  'use strict';
  if (!window.speechSynthesis) return;

  const VOICES = ${JSON.stringify(voices)};

  const origGetVoices = window.speechSynthesis.getVoices.bind(window.speechSynthesis);

  window.speechSynthesis.getVoices = function() {
    const real = origGetVoices();
    if (real && real.length > 0) {
      // Filter to only OS-appropriate voices
      return real.filter(v => VOICES.some(av => av.name === v.name));
    }
    // Voices not loaded yet — return fake voice objects
    return VOICES.map(v => ({
      name: v.name,
      lang: v.lang,
      localService: v.localService,
      default: v.default,
      voiceURI: v.name,
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    }));
  };
})();
`
}
