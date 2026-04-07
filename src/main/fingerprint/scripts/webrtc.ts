import type { WebRtcConfig } from '../../../shared/types'

export function buildWebRtcScript(config: WebRtcConfig, noiseSeed: number = 0): string {
  if (config.mode === 'disabled') {
    return `
(function() {
  'use strict';
  const Blocked = function RTCPeerConnection() {
    throw new DOMException('WebRTC is disabled by the browser profile', 'NotAllowedError')
  }
  Blocked.prototype = Object.create(
    typeof RTCPeerConnection !== 'undefined' ? RTCPeerConnection.prototype : Object.prototype
  )
  Object.defineProperty(Blocked.prototype, 'constructor', { value: Blocked, enumerable: false })
  if (typeof RTCPeerConnection !== 'undefined') {
    Object.defineProperty(window, 'RTCPeerConnection', { value: Blocked, writable: true, configurable: true })
  }
  if (typeof webkitRTCPeerConnection !== 'undefined') {
    Object.defineProperty(window, 'webkitRTCPeerConnection', { value: Blocked, writable: true, configurable: true })
  }
  if (typeof mozRTCPeerConnection !== 'undefined') {
    Object.defineProperty(window, 'mozRTCPeerConnection', { value: Blocked, writable: true, configurable: true })
  }
})();
`
  }

  if (config.mode === 'fake') {
    // Derive a stable fake LAN IP from noiseSeed
    const a = ((noiseSeed >> 16) & 0xff) || 1
    const b = ((noiseSeed >> 8) & 0xff) || 1
    const fakeLanIp = `192.168.${a % 10}.${(b % 253) + 1}`
    const fakeHostname = `host-${(noiseSeed >>> 0).toString(16).padStart(8, '0')}.local`

    return `
(function() {
  'use strict';
  if (typeof RTCPeerConnection === 'undefined') return;

  const _RTCPeerConnection = RTCPeerConnection;
  const fakeLan = '${fakeLanIp}';
  const fakeMdns = '${fakeHostname}';

  function patchCandidate(cand) {
    if (!cand) return cand;
    // Allow relay (TURN) — pass through. Rewrite host/srflx IPs.
    const c = cand.candidate || cand;
    if (typeof c !== 'string') return cand;
    if (c.includes(' relay ')) return cand;
    // Replace IPv4/IPv6 addresses with fake LAN IP
    const patched = c
      .replace(/\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b/g, fakeLan)
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.local/gi, fakeMdns);
    if (typeof cand === 'string') return patched;
    return Object.assign(Object.create(Object.getPrototypeOf(cand)), cand, { candidate: patched });
  }

  const FakeRTC = function RTCPeerConnection(config, constraints) {
    const pc = new _RTCPeerConnection(config, constraints);
    const _addIce = pc.addIceCandidate.bind(pc);
    const origOnIce = Object.getOwnPropertyDescriptor(_RTCPeerConnection.prototype, 'onicecandidate');
    const listeners = new Map();

    pc.addEventListener('icecandidate', function(e) {
      if (e.candidate) {
        const faked = new RTCIceCandidate(patchCandidate({ candidate: e.candidate.candidate, sdpMid: e.candidate.sdpMid, sdpMLineIndex: e.candidate.sdpMLineIndex }));
        Object.defineProperty(e, 'candidate', { value: faked });
      }
    }, true);
    return pc;
  };
  FakeRTC.prototype = _RTCPeerConnection.prototype;
  Object.defineProperty(FakeRTC, 'name', { value: 'RTCPeerConnection' });
  Object.defineProperty(window, 'RTCPeerConnection', { value: FakeRTC, writable: true, configurable: true });
})();
`
  }

  return '' // mode === 'real'
}
