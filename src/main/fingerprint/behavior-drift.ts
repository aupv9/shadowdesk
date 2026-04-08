/**
 * P2 FIX: Behavior Drift Detection
 *
 * Detects if a profile's behavior patterns are too consistent,
 * which would indicate automation/bot-like activity to detection systems.
 *
 * Real users have natural variation in:
 * - Mouse movement patterns (never identical curves)
 * - Typing speed (varies by context, fatigue, focus)
 * - Scroll timing (different on different pages)
 * - Navigation patterns (random intervals between actions)
 *
 * This module warns if a profile's behavior is TOO CONSISTENT across sessions,
 * suggesting it needs behavior randomization enabled or updated.
 */

import type { FingerprintConfig } from '../../shared/types'
import type { DetectionVectorResult } from '../../shared/types'

export interface BehaviorConsistencyReport {
  profileId: string
  profileName: string
  riskLevel: 'low' | 'medium' | 'high'
  issues: string[]
  recommendations: string[]
  timestamp: string
}

/**
 * Analyze a profile's behavior configuration for drift risk
 */
export function analyzeBehaiorDrift(
  profileId: string,
  profileName: string,
  fp: FingerprintConfig,
  sessionCount: number
): BehaviorConsistencyReport {
  const issues: string[] = []
  const recommendations: string[] = []
  let riskLevel: 'low' | 'medium' | 'high' = 'low'

  // Check 1: Behavior simulation enabled?
  if (!fp.behavior || !fp.behavior.mouseJitter) {
    issues.push('Mouse jitter disabled — movements will be perfectly reproducible')
    recommendations.push('Enable behavior.mouseJitter for natural mouse patterns')
    riskLevel = 'high'
  }

  if (!fp.behavior || !fp.behavior.typingNoise) {
    issues.push('Typing noise disabled — keystroke timing will be perfectly deterministic')
    recommendations.push('Enable behavior.typingNoise for natural typing patterns')
    riskLevel = 'high'
  }

  if (!fp.behavior || !fp.behavior.scrollInertia) {
    issues.push('Scroll inertia disabled — scrolling will be uniform across sessions')
    recommendations.push('Enable behavior.scrollInertia for natural scroll deceleration')
    riskLevel = 'high'
  }

  // Check 2: Timing defenses enabled?
  if (!fp.timing || !fp.timing.rafJitter) {
    issues.push('RAF jitter disabled — animation timing will be identical across sessions')
    recommendations.push('Enable timing.rafJitter to vary frame rendering times')
    if (riskLevel === 'low') riskLevel = 'medium'
  }

  if (!fp.timing || !fp.timing.performanceClamp) {
    issues.push('Performance timing not clamped — high precision timing exposed')
    recommendations.push('Enable timing.performanceClamp to quantize performance.now()')
    if (riskLevel === 'low') riskLevel = 'medium'
  }

  // Check 3: Session consistency warning (for heavy use)
  if (sessionCount > 20) {
    issues.push(`Profile launched ${sessionCount}+ times — behavior patterns may be learnable`)
    recommendations.push('Consider creating new profiles or enabling stronger behavior randomization')
    if (riskLevel === 'low') riskLevel = 'medium'
  }

  // Check 4: WebRTC enabled creates identifiable patterns
  if (fp.webrtc && fp.webrtc.enabled !== false) {
    issues.push('WebRTC enabled — IP address exposed, can be correlated with behavior')
    recommendations.push('Disable WebRTC or use VPN/proxy to hide real IP')
    if (riskLevel === 'low' || riskLevel === 'medium') riskLevel = 'medium'
  }

  return {
    profileId,
    profileName,
    riskLevel,
    issues,
    recommendations,
    timestamp: new Date().toISOString()
  }
}

/**
 * Check if behavior configuration meets minimum realism standards
 */
export function isBehaviorRealismSufficient(fp: FingerprintConfig, threshold: 'strict' | 'moderate' | 'lenient' = 'moderate'): boolean {
  const thresholds = {
    strict: {
      jitterRequired: true,
      timingRequired: true,
      webrtcMustBeDisabled: true
    },
    moderate: {
      jitterRequired: true,
      timingRequired: false,
      webrtcMustBeDisabled: false
    },
    lenient: {
      jitterRequired: false,
      timingRequired: false,
      webrtcMustBeDisabled: false
    }
  }

  const t = thresholds[threshold]

  if (t.jitterRequired && (!fp.behavior?.mouseJitter || !fp.behavior?.typingNoise)) {
    return false
  }

  if (t.timingRequired && !fp.timing?.rafJitter) {
    return false
  }

  if (t.webrtcMustBeDisabled && fp.webrtc?.enabled) {
    return false
  }

  return true
}

/**
 * Generate a detection vector result for behavior consistency
 */
export function createBehaviorConsistencyVector(report: BehaviorConsistencyReport): DetectionVectorResult {
  const passed = report.riskLevel === 'low'

  return {
    name: 'Behavior consistency & drift risk',
    category: 'Behavior',
    passed,
    detail: passed
      ? 'Behavior patterns vary naturally — low detection risk'
      : `${report.riskLevel.toUpperCase()} RISK: ${report.issues.length} issues detected`
  }
}
