import type { WebRtcConfig } from '../../../shared/types'

export function buildWebRtcScript(config: WebRtcConfig): string {
  if (config.mode !== 'disabled') return ''

  return `
(function() {
  'use strict';

  // Replace RTCPeerConnection with a version that throws — prevents IP leaks
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
