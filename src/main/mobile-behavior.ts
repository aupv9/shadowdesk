import type { MobileBehaviorArchetype, MobileBehaviorArchetypeId } from '../shared/types'

/**
 * Phase 17: Mobile Behavior Library — 10 pre-defined archetypes.
 *
 * Each archetype defines timing ranges for gestures + error rates.
 * The MobileWorkflowEngine picks random values within the range
 * to produce human-like variance across runs.
 */

export const MOBILE_BEHAVIOR_ARCHETYPES: MobileBehaviorArchetype[] = [
  {
    id: 'casual_browser',
    name: 'Casual Browser',
    description: 'Slow, random interactions mimicking a relaxed browsing session',
    tapDelayRange: [200, 500],
    swipeDurationRange: [600, 1000],
    pauseRange: [1000, 3000],
    scrollDistanceRange: [300, 500],
    missRate: 0.05,
    retapRate: 0.02
  },
  {
    id: 'power_user',
    name: 'Power User',
    description: 'Fast, precise interactions — someone who knows what they want',
    tapDelayRange: [50, 150],
    swipeDurationRange: [300, 450],
    pauseRange: [300, 800],
    scrollDistanceRange: [500, 800],
    missRate: 0.01,
    retapRate: 0.005
  },
  {
    id: 'bot_evasion',
    name: 'Bot Evasion',
    description: 'Highly randomized timing to avoid anti-bot detection systems',
    tapDelayRange: [100, 600],
    swipeDurationRange: [400, 1000],
    pauseRange: [1500, 4000],
    scrollDistanceRange: [200, 600],
    missRate: 0.04,
    retapRate: 0.03
  },
  {
    id: 'rapid_interactor',
    name: 'Rapid Interactor',
    description: 'Very fast, minimal delays — rapid actions with purpose',
    tapDelayRange: [30, 80],
    swipeDurationRange: [200, 350],
    pauseRange: [100, 400],
    scrollDistanceRange: [600, 1000],
    missRate: 0.005,
    retapRate: 0.003
  },
  {
    id: 'mobile_native',
    name: 'Mobile Native',
    description: 'Thumb-based mobile-first user — natural gestures, occasional misses',
    tapDelayRange: [120, 350],
    swipeDurationRange: [500, 800],
    pauseRange: [800, 2000],
    scrollDistanceRange: [350, 600],
    missRate: 0.06,
    retapRate: 0.04
  },
  {
    id: 'careful_shopper',
    name: 'Careful Shopper',
    description: 'Deliberate, slow scrolling and reading — lingers on product pages',
    tapDelayRange: [250, 600],
    swipeDurationRange: [700, 1200],
    pauseRange: [2000, 5000],
    scrollDistanceRange: [200, 400],
    missRate: 0.03,
    retapRate: 0.02
  },
  {
    id: 'bulk_operator',
    name: 'Bulk Operator',
    description: 'High action count, minimal pausing — batch processing workflows',
    tapDelayRange: [60, 120],
    swipeDurationRange: [250, 400],
    pauseRange: [200, 600],
    scrollDistanceRange: [500, 900],
    missRate: 0.01,
    retapRate: 0.005
  },
  {
    id: 'social_lurker',
    name: 'Social Lurker',
    description: 'Lots of scrolling, minimal tap interaction — passive social media user',
    tapDelayRange: [300, 700],
    swipeDurationRange: [500, 900],
    pauseRange: [1500, 4000],
    scrollDistanceRange: [400, 700],
    missRate: 0.02,
    retapRate: 0.01
  },
  {
    id: 'form_filler',
    name: 'Form Filler',
    description: 'Deliberate field-by-field input — accurate typing with tab between fields',
    tapDelayRange: [150, 400],
    swipeDurationRange: [400, 600],
    pauseRange: [500, 1500],
    scrollDistanceRange: [200, 350],
    missRate: 0.02,
    retapRate: 0.015
  },
  {
    id: 'idler',
    name: 'Idler',
    description: 'Very long pauses between sparse actions — background tab behavior',
    tapDelayRange: [400, 1000],
    swipeDurationRange: [800, 1500],
    pauseRange: [5000, 15000],
    scrollDistanceRange: [150, 300],
    missRate: 0.08,
    retapRate: 0.05
  }
]

const ARCHETYPE_MAP = new Map<string, MobileBehaviorArchetype>(
  MOBILE_BEHAVIOR_ARCHETYPES.map((a) => [a.id, a])
)

export function getMobileBehaviorArchetypes(): MobileBehaviorArchetype[] {
  return MOBILE_BEHAVIOR_ARCHETYPES
}

export function getMobileBehaviorArchetype(id: MobileBehaviorArchetypeId): MobileBehaviorArchetype | null {
  return ARCHETYPE_MAP.get(id) ?? null
}

/**
 * Return a random value within a range defined by the archetype.
 */
export function randomInRange(min: number, max: number): number {
  return min + Math.random() * (max - min)
}
