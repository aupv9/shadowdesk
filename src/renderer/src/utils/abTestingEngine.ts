/**
 * A/B testing framework for guide variants
 */

import type { WorkflowCreationMethod } from '../components/AutomationBuilder/WorkflowCreationFlow'

export type GuideVariant = 'A' | 'B' | 'C' | 'D'

export interface VariantMetrics {
  variant: GuideVariant
  viewCount: number
  avgViewTime: number
  completionRate: number
  methodSelectionRate: number
  feedbackScore: number
}

export interface ABTestConfig {
  method: WorkflowCreationMethod
  activeVariants: GuideVariant[]
  variantWeights: Record<GuideVariant, number>
  startDate: number
  endDate?: number
}

/**
 * Assign a consistent variant to a user based on their ID hash
 */
export function assignVariant(
  userId: string,
  activeVariants: GuideVariant[] = ['A', 'B', 'C', 'D']
): GuideVariant {
  // Simple hash function for consistent assignment
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    const char = userId.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32-bit integer
  }

  const index = Math.abs(hash) % activeVariants.length
  return activeVariants[index]
}

/**
 * Get variant configuration
 */
export function getVariantConfig(
  variant: GuideVariant
): Record<string, any> {
  const configs: Record<GuideVariant, Record<string, any>> = {
    A: {
      name: 'Control',
      description: 'Current design with all features',
      showVideo: true,
      showSteps: true,
      showTiming: true,
      stepStyle: 'detailed' // Full step descriptions
    },
    B: {
      name: 'Concise',
      description: 'Text-only, minimal design',
      showVideo: false,
      showSteps: true,
      showTiming: false,
      stepStyle: 'concise' // Single-line descriptions
    },
    C: {
      name: 'Video-First',
      description: 'Large video with minimal text',
      showVideo: true,
      showSteps: true,
      showTiming: false,
      stepStyle: 'minimal' // Short summaries only
    },
    D: {
      name: 'Interactive',
      description: 'Hands-on with step actions',
      showVideo: true,
      showSteps: true,
      showTiming: true,
      stepStyle: 'interactive' // Steps with try buttons
    }
  }

  return configs[variant]
}

/**
 * Track variant metrics
 */
export function trackVariantMetric(
  method: WorkflowCreationMethod,
  variant: GuideVariant,
  eventType: string,
  value?: any
): void {
  const event = {
    event: 'variant_metric',
    method,
    variant,
    eventType,
    value,
    timestamp: Date.now()
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[A/B Testing]', event)
  }

  try {
    const key = `ab_test_${method}_${variant}`
    const metrics = JSON.parse(localStorage.getItem(key) || '{}')
    metrics[eventType] = (metrics[eventType] || 0) + 1
    if (value !== undefined) {
      metrics[`${eventType}_value`] = value
    }
    localStorage.setItem(key, JSON.stringify(metrics))
  } catch (e) {
    console.error('Failed to track variant metric:', e)
  }
}

/**
 * Calculate winner based on metrics
 */
export function calculateWinner(
  methodMetrics: Record<GuideVariant, VariantMetrics>
): { winner: GuideVariant; score: number } | null {
  const variants = Object.entries(methodMetrics)

  if (variants.length === 0) {
    return null
  }

  // Scoring: completion rate (0.4) + feedback (0.3) + view count (0.2) + method selection (0.1)
  let bestVariant: GuideVariant = 'A'
  let bestScore = -1

  variants.forEach(([variant, metrics]) => {
    const score =
      (metrics.completionRate || 0) * 0.4 +
      (metrics.feedbackScore || 0) * 0.3 +
      Math.min(metrics.viewCount / 1000, 1) * 0.2 +
      (metrics.methodSelectionRate || 0) * 0.1

    if (score > bestScore) {
      bestScore = score
      bestVariant = variant as GuideVariant
    }
  })

  return { winner: bestVariant, score: bestScore }
}

/**
 * Check statistical significance (simplified Chi-square)
 */
export function isSignificant(
  variantA: VariantMetrics,
  variantB: VariantMetrics,
  confidenceLevel: number = 0.95
): boolean {
  // Simplified: need minimum sample size and difference threshold
  const minSampleSize = 100
  const minDifference = 0.1 // 10% difference

  if (
    variantA.viewCount < minSampleSize ||
    variantB.viewCount < minSampleSize
  ) {
    return false
  }

  const difference = Math.abs(
    variantA.completionRate - variantB.completionRate
  )
  return difference >= minDifference
}

/**
 * Get current A/B test status
 */
export function getABTestStatus(
  method: WorkflowCreationMethod
): Record<string, any> {
  const variants: GuideVariant[] = ['A', 'B', 'C', 'D']
  const status: Record<string, any> = {
    method,
    variants: {},
    status: 'running'
  }

  variants.forEach((variant) => {
    try {
      const key = `ab_test_${method}_${variant}`
      const metrics = JSON.parse(localStorage.getItem(key) || '{}')
      status.variants[variant] = {
        viewCount: metrics.view_shown || 0,
        config: getVariantConfig(variant)
      }
    } catch (e) {
      status.variants[variant] = { viewCount: 0 }
    }
  })

  return status
}
