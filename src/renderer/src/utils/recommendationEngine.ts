/**
 * Smart recommendation engine analyzing user's workflow history
 */

import type { WorkflowCreationMethod } from '../components/AutomationBuilder/WorkflowCreationFlow'

export interface WorkflowHistoryItem {
  method: WorkflowCreationMethod
  success: boolean
  duration: number // milliseconds
  timestamp: number
}

export interface MethodRecommendation {
  method: WorkflowCreationMethod
  score: number
  reason: string
  confidence: 'high' | 'medium' | 'low'
}

/**
 * Analyze workflow history and generate a recommendation
 */
export function getRecommendation(
  history: WorkflowHistoryItem[]
): MethodRecommendation | null {
  if (history.length === 0) {
    return null
  }

  // Calculate method distribution
  const methodStats = calculateMethodStats(history)
  const recommendedMethod = findBestMethod(methodStats, history)

  if (!recommendedMethod) {
    return null
  }

  const stats = methodStats[recommendedMethod]
  const reason = generateReason(recommendedMethod, stats, history)
  const confidence = calculateConfidence(stats, history.length)

  return {
    method: recommendedMethod,
    score: stats.successRate,
    reason,
    confidence
  }
}

interface MethodStats {
  count: number
  successCount: number
  successRate: number
  avgDuration: number
  lastUsed: number
}

function calculateMethodStats(
  history: WorkflowHistoryItem[]
): Record<WorkflowCreationMethod, MethodStats> {
  const stats: Record<WorkflowCreationMethod, MethodStats> = {
    record: { count: 0, successCount: 0, successRate: 0, avgDuration: 0, lastUsed: 0 },
    template: { count: 0, successCount: 0, successRate: 0, avgDuration: 0, lastUsed: 0 },
    ai: { count: 0, successCount: 0, successRate: 0, avgDuration: 0, lastUsed: 0 },
    scratch: { count: 0, successCount: 0, successRate: 0, avgDuration: 0, lastUsed: 0 }
  }

  const durations: Record<WorkflowCreationMethod, number[]> = {
    record: [],
    template: [],
    ai: [],
    scratch: []
  }

  history.forEach((item) => {
    const stat = stats[item.method]
    stat.count++
    if (item.success) {
      stat.successCount++
    }
    stat.lastUsed = Math.max(stat.lastUsed, item.timestamp)
    durations[item.method].push(item.duration)
  })

  // Calculate averages and success rates
  Object.keys(stats).forEach((method) => {
    const stat = stats[method as WorkflowCreationMethod]
    if (stat.count > 0) {
      stat.successRate = stat.successCount / stat.count
      const durationList = durations[method as WorkflowCreationMethod]
      stat.avgDuration =
        durationList.length > 0
          ? durationList.reduce((a, b) => a + b, 0) / durationList.length
          : 0
    }
  })

  return stats
}

function findBestMethod(
  stats: Record<WorkflowCreationMethod, MethodStats>,
  history: WorkflowHistoryItem[]
): WorkflowCreationMethod | null {
  const methods: WorkflowCreationMethod[] = ['record', 'template', 'ai', 'scratch']
  let bestMethod: WorkflowCreationMethod | null = null
  let bestScore = -1

  methods.forEach((method) => {
    const stat = stats[method]
    if (stat.count === 0) return

    // Score = (successRate * 0.5) + (frequency / total * 0.3) + (recency factor * 0.2)
    const frequency = stat.count / history.length
    const recencyFactor = Math.min(
      1,
      (Date.now() - stat.lastUsed) / (30 * 24 * 60 * 60 * 1000)
    ) // 30 days
    const score = stat.successRate * 0.5 + frequency * 0.3 + recencyFactor * 0.2

    if (score > bestScore) {
      bestScore = score
      bestMethod = method
    }
  })

  return bestMethod
}

function generateReason(
  method: WorkflowCreationMethod,
  stats: MethodStats,
  history: WorkflowHistoryItem[]
): string {
  const percentage = Math.round((stats.count / history.length) * 100)
  const methodLabel = {
    record: 'Recording',
    template: 'Templates',
    ai: 'AI generation',
    scratch: 'Building from scratch'
  }[method]

  if (percentage >= 70) {
    return `${methodLabel} is your most-used method (${percentage}% of your workflows)`
  } else if (stats.successRate > 0.8) {
    return `${methodLabel} has your highest success rate (${Math.round(stats.successRate * 100)}%)`
  } else if (stats.count >= 5) {
    return `Based on your workflow history, ${methodLabel} works well for you`
  } else {
    return `We recommend ${methodLabel} based on your past workflows`
  }
}

function calculateConfidence(
  stats: MethodStats,
  totalItems: number
): 'high' | 'medium' | 'low' {
  const frequency = stats.count / totalItems
  const hasGoodHistory = stats.count >= 5
  const hasHighSuccessRate = stats.successRate > 0.75

  if (frequency > 0.6 && hasGoodHistory) {
    return 'high'
  } else if (frequency > 0.3 || hasHighSuccessRate) {
    return 'medium'
  }
  return 'low'
}

/**
 * Get analytics about workflow history
 */
export function getWorkflowHistoryAnalytics(
  history: WorkflowHistoryItem[]
): Record<string, any> {
  if (history.length === 0) {
    return {
      totalWorkflows: 0,
      methodDistribution: {},
      overallSuccessRate: 0
    }
  }

  const stats = calculateMethodStats(history)
  const methodDistribution: Record<WorkflowCreationMethod, string> = {
    record: '',
    template: '',
    ai: '',
    scratch: ''
  }

  const methods: WorkflowCreationMethod[] = ['record', 'template', 'ai', 'scratch']
  methods.forEach((method) => {
    const percentage = ((stats[method].count / history.length) * 100).toFixed(0)
    methodDistribution[method] = `${percentage}%`
  })

  const totalSuccessful = history.filter((h) => h.success).length
  const overallSuccessRate = totalSuccessful / history.length

  return {
    totalWorkflows: history.length,
    successfulWorkflows: totalSuccessful,
    methodDistribution,
    overallSuccessRate: (overallSuccessRate * 100).toFixed(1),
    methodStats: stats
  }
}
