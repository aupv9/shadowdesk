/**
 * P3: Behavior Profile Templates
 *
 * Pre-configured behavior patterns for different user archetypes:
 * - Business User: Productive, consistent, minimal gaming/media
 * - Casual User: Variable patterns, frequent breaks, multimedia
 * - Developer: Fast typer, frequent console/developer tools access
 * - Privacy-Conscious: VPN/proxy usage, script blockers, privacy extensions
 *
 * Each template includes optimized behavior + timing + geolocation patterns.
 */

import type { FingerprintConfig } from '../../shared/types'

export type BehaviorProfileTemplate = 'business' | 'casual' | 'developer' | 'privacy'

/**
 * Template configurations for different user types
 */
const BEHAVIOR_TEMPLATES: Record<BehaviorProfileTemplate, Partial<FingerprintConfig>> = {
  /**
   * Business User: Focused, productive work patterns
   * - Typing: Faster, more consistent (100-120 WPM)
   * - Mouse: Precise movements, less jitter
   * - Scroll: Deliberate, page-by-page
   * - Hours: 9-5 activity pattern
   */
  business: {
    behavior: {
      mouseJitter: true,      // Subtle jitter only
      typingNoise: true,      // Consistent typing speed
      scrollInertia: true     // Page-by-page scrolls
    },
    timing: {
      dateNoisePrecision: 250,   // Less frequent time updates
      rafJitter: true,           // Moderate frame jitter
      performanceClamp: true     // Hide precise timing
    },
    webrtc: {
      enabled: false,
      mode: 'disabled'
    }
  },

  /**
   * Casual User: Variable, entertainment-focused patterns
   * - Typing: Variable speed (60-100 WPM)
   * - Mouse: Free-form movements, lots of jitter
   * - Scroll: Smooth, continuous, random pauses
   * - Hours: Afternoon/evening activity, weekends heavy
   */
  casual: {
    behavior: {
      mouseJitter: true,      // Heavy jitter
      typingNoise: true,      // Variable typing speed
      scrollInertia: true     // Smooth scrolling
    },
    timing: {
      dateNoisePrecision: 100,   // Frequent time updates
      rafJitter: true,           // High frame variance
      performanceClamp: true
    },
    webrtc: {
      enabled: false,
      mode: 'disabled'
    }
  },

  /**
   * Developer: Fast, intense patterns
   * - Typing: Very fast (120+ WPM), consistent
   * - Mouse: Keyboard shortcuts, minimal mouse usage
   * - Scroll: Fast, scrollwheel heavy
   * - Hours: Variable (night coding sessions)
   */
  developer: {
    behavior: {
      mouseJitter: false,     // Minimal mouse movement
      typingNoise: true,      // Fast, consistent typing
      scrollInertia: true     // Fast scrolling
    },
    timing: {
      dateNoisePrecision: 50,     // Very precise timing (dev tools)
      rafJitter: false,           // Stable frame timing
      performanceClamp: false     // May use performance API
    },
    webrtc: {
      enabled: false,
      mode: 'disabled'
    }
  },

  /**
   * Privacy-Conscious: Minimal exposure patterns
   * - Typing: Slow, deliberate
   * - Mouse: Cautious movements, frequent pauses
   * - Scroll: Careful reading, frequent backtracking
   * - Maximizes all defenses
   */
  'privacy': {
    behavior: {
      mouseJitter: true,      // Heavy obfuscation
      typingNoise: true,      // Variable typing
      scrollInertia: true     // Natural scrolling
    },
    timing: {
      dateNoisePrecision: 250,    // Coarse timing
      rafJitter: true,            // Maximum variance
      performanceClamp: true      // Hide everything
    },
    webrtc: {
      enabled: false,
      mode: 'disabled'
    }
  }
}

/**
 * Apply a behavior template to a fingerprint config
 */
export function applyBehaviorTemplate(
  fp: FingerprintConfig,
  template: BehaviorProfileTemplate
): FingerprintConfig {
  const clone = JSON.parse(JSON.stringify(fp)) as FingerprintConfig
  const t = BEHAVIOR_TEMPLATES[template]

  if (t.behavior) {
    clone.behavior = { ...clone.behavior, ...t.behavior }
  }
  if (t.timing) {
    clone.timing = { ...clone.timing, ...t.timing }
  }
  if (t.webrtc) {
    clone.webrtc = { ...clone.webrtc, ...t.webrtc }
  }

  return clone
}

/**
 * Get description of a template
 */
export function getTemplateDescription(template: BehaviorProfileTemplate): string {
  const descriptions: Record<BehaviorProfileTemplate, string> = {
    business: 'Productive work patterns (9-5, consistent, focused)',
    casual: 'Entertainment-focused (variable, multimedia, breaks)',
    developer: 'Fast, intense patterns (keyboard-heavy, long sessions)',
    privacy: 'Privacy-maximized (all defenses enabled, careful)'
  }
  return descriptions[template]
}

/**
 * Recommend a template based on fingerprint config
 */
export function recommendTemplate(fp: FingerprintConfig): BehaviorProfileTemplate {
  // Developer if low mouse jitter and no RAF jitter
  if (!fp.behavior?.mouseJitter && !fp.timing?.rafJitter) {
    return 'developer'
  }

  // Privacy-conscious if all defenses enabled
  if (
    fp.behavior?.mouseJitter &&
    fp.behavior?.typingNoise &&
    fp.behavior?.scrollInertia &&
    fp.timing?.performanceClamp &&
    !fp.webrtc?.enabled
  ) {
    return 'privacy'
  }

  // Casual if high jitter but low precision timing
  if (fp.timing?.dateNoisePrecision && fp.timing.dateNoisePrecision <= 100) {
    return 'casual'
  }

  // Default to business
  return 'business'
}
