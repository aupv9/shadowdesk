/**
 * Workflow creation analytics tracking
 * Logs user behavior to understand which creation methods are most popular
 */

export interface WorkflowCreationEvent {
  event: string
  method: 'record' | 'template' | 'ai' | 'scratch'
  isFirstTime: boolean
  timestamp: number
  deviceInfo?: {
    userAgent: string
    platform: string
  }
}

/**
 * Track when a user selects a workflow creation method
 */
export function trackWorkflowCreationMethodSelected(
  method: 'record' | 'template' | 'ai' | 'scratch',
  isFirstTime: boolean
): void {
  const event: WorkflowCreationEvent = {
    event: 'workflow_creation_method_selected',
    method,
    isFirstTime,
    timestamp: Date.now(),
    deviceInfo: {
      userAgent: navigator.userAgent,
      platform: navigator.platform
    }
  }

  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event)
  }

  // Store in local analytics queue (future: send to backend)
  try {
    const queue = JSON.parse(localStorage.getItem('analytics_queue') || '[]')
    queue.push(event)
    // Keep last 100 events
    if (queue.length > 100) {
      queue.shift()
    }
    localStorage.setItem('analytics_queue', JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to store analytics event:', e)
  }
}

/**
 * Track when a user views a method guide
 */
export function trackMethodGuideViewed(method: 'record' | 'template' | 'ai' | 'scratch'): void {
  const event = {
    event: 'method_guide_viewed',
    method,
    timestamp: Date.now()
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event)
  }

  try {
    const queue = JSON.parse(localStorage.getItem('analytics_queue') || '[]')
    queue.push(event)
    if (queue.length > 100) {
      queue.shift()
    }
    localStorage.setItem('analytics_queue', JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to store analytics event:', e)
  }
}

/**
 * Get analytics summary (for debugging)
 */
export function getAnalyticsSummary(): Record<string, number> {
  try {
    const queue = JSON.parse(localStorage.getItem('analytics_queue') || '[]')
    const summary: Record<string, number> = {}

    queue.forEach((event: any) => {
      const key = `${event.event}_${event.method || 'all'}`
      summary[key] = (summary[key] || 0) + 1
    })

    return summary
  } catch (e) {
    console.error('Failed to get analytics summary:', e)
    return {}
  }
}

/**
 * Clear analytics queue
 */
export function clearAnalyticsQueue(): void {
  try {
    localStorage.removeItem('analytics_queue')
  } catch (e) {
    console.error('Failed to clear analytics queue:', e)
  }
}

/**
 * Track when a user watches a guide video
 */
export function trackVideoWatched(
  method: 'record' | 'template' | 'ai' | 'scratch',
  duration: number
): void {
  const event = {
    event: 'video_watched',
    method,
    duration, // seconds watched
    timestamp: Date.now()
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event)
  }

  try {
    const queue = JSON.parse(localStorage.getItem('analytics_queue') || '[]')
    queue.push(event)
    if (queue.length > 100) {
      queue.shift()
    }
    localStorage.setItem('analytics_queue', JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to store analytics event:', e)
  }
}

/**
 * Track when a user rates a guide as helpful/not helpful
 */
export function trackGuideRated(
  method: 'record' | 'template' | 'ai' | 'scratch',
  isHelpful: boolean
): void {
  const event = {
    event: 'guide_rated_helpful',
    method,
    isHelpful,
    timestamp: Date.now()
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event)
  }

  try {
    const queue = JSON.parse(localStorage.getItem('analytics_queue') || '[]')
    queue.push(event)
    if (queue.length > 100) {
      queue.shift()
    }
    localStorage.setItem('analytics_queue', JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to store analytics event:', e)
  }
}

/**
 * Track when a recommendation is shown to user
 */
export function trackRecommendationShown(
  method: 'record' | 'template' | 'ai' | 'scratch'
): void {
  const event = {
    event: 'recommendation_shown',
    method,
    timestamp: Date.now()
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event)
  }

  try {
    const queue = JSON.parse(localStorage.getItem('analytics_queue') || '[]')
    queue.push(event)
    if (queue.length > 100) {
      queue.shift()
    }
    localStorage.setItem('analytics_queue', JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to store analytics event:', e)
  }
}

/**
 * Track when a user accepts or rejects a recommendation
 */
export function trackRecommendationSelected(
  method: 'record' | 'template' | 'ai' | 'scratch',
  accepted: boolean
): void {
  const event = {
    event: 'recommendation_selected',
    method,
    accepted,
    timestamp: Date.now()
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event)
  }

  try {
    const queue = JSON.parse(localStorage.getItem('analytics_queue') || '[]')
    queue.push(event)
    if (queue.length > 100) {
      queue.shift()
    }
    localStorage.setItem('analytics_queue', JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to store analytics event:', e)
  }
}

/**
 * Track A/B test variant assignment
 */
export function trackVariantAssigned(
  method: 'record' | 'template' | 'ai' | 'scratch',
  variant: string
): void {
  const event = {
    event: 'variant_assigned',
    method,
    variant,
    timestamp: Date.now()
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event)
  }

  try {
    const queue = JSON.parse(localStorage.getItem('analytics_queue') || '[]')
    queue.push(event)
    if (queue.length > 100) {
      queue.shift()
    }
    localStorage.setItem('analytics_queue', JSON.stringify(queue))
  } catch (e) {
    console.error('Failed to store analytics event:', e)
  }
}

/**
 * Get guide analytics summary
 */
export function getGuideAnalytics(): Record<string, any> {
  try {
    const queue = JSON.parse(localStorage.getItem('analytics_queue') || '[]')
    const analytics: Record<string, any> = {}

    const methods = ['record', 'template', 'ai', 'scratch']
    methods.forEach((method) => {
      const events = queue.filter((e: any) => e.method === method)
      if (events.length > 0) {
        const helpfulRatings = events.filter(
          (e: any) => e.event === 'guide_rated_helpful'
        )
        const helpful = helpfulRatings.filter((e: any) => e.isHelpful).length
        const total = helpfulRatings.length

        analytics[`guide_${method}`] = {
          views: events.filter((e: any) => e.event === 'method_guide_viewed').length,
          videoWatches: events.filter((e: any) => e.event === 'video_watched').length,
          ratings: {
            total,
            helpful,
            score: total > 0 ? ((helpful / total) * 5).toFixed(2) : 'N/A'
          }
        }
      }
    })

    return analytics
  } catch (e) {
    console.error('Failed to get guide analytics:', e)
    return {}
  }
}
