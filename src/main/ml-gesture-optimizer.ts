import { v4 as uuidv4 } from 'uuid'
import { Database } from './database'
import type {
  GestureTrainingData,
  GestureTimingConfig,
  GestureOptimizationResult,
  GestureRecommendation,
  MLModelStats
} from '../shared/types'

/**
 * Phase 19.2 — ML-Based Gesture Optimization
 *
 * Learns from detection test results to optimize gesture timing parameters.
 * Uses a statistical approach: analyzes which gesture configurations correlate
 * with higher detection scores and recommends timing adjustments.
 *
 * The "model" is a lightweight statistical analyzer — no external ML framework
 * needed. It computes feature importance via correlation analysis and generates
 * concrete parameter recommendations.
 */
export class MLGestureOptimizer {
  private static instance: MLGestureOptimizer

  static getInstance(): MLGestureOptimizer {
    if (!MLGestureOptimizer.instance) {
      MLGestureOptimizer.instance = new MLGestureOptimizer()
    }
    return MLGestureOptimizer.instance
  }

  /**
   * Record a training data point after a detection test completes.
   * Links the gesture config used with the resulting detection score.
   */
  recordTrainingData(input: {
    profileId: string
    testResultId: string
    archetypeId: string
    vectorScores: Record<string, boolean>
    gestureConfig: GestureTimingConfig
    detectionScore: number
  }): GestureTrainingData {
    const db = Database.getInstance()
    const data: GestureTrainingData = {
      id: uuidv4(),
      profile_id: input.profileId,
      test_result_id: input.testResultId,
      archetype_id: input.archetypeId,
      vector_scores: input.vectorScores,
      gesture_config: input.gestureConfig,
      detection_score: input.detectionScore,
      timestamp: new Date().toISOString()
    }

    db.addGestureTrainingData(data)
    return data
  }

  /**
   * Analyze all training data and generate optimized gesture configs.
   * Uses statistical correlation to find which timing parameters
   * lead to higher detection evasion scores.
   */
  optimize(profileId?: string): GestureOptimizationResult[] {
    const db = Database.getInstance()
    const allData = db.getGestureTrainingData(profileId, 500)

    if (allData.length < 3) {
      return [] // Need at least 3 data points to produce meaningful results
    }

    // Group by profile
    const byProfile = new Map<string, GestureTrainingData[]>()
    for (const d of allData) {
      const list = byProfile.get(d.profile_id) || []
      list.push(d)
      byProfile.set(d.profile_id, list)
    }

    const results: GestureOptimizationResult[] = []

    for (const [pid, dataPoints] of byProfile) {
      if (dataPoints.length < 2) continue

      // Find the config that produced the highest score
      const sorted = [...dataPoints].sort((a, b) => b.detection_score - a.detection_score)
      const bestRun = sorted[0]
      const currentRun = sorted[sorted.length - 1] // most recent is likely "current"

      const recommendations = this.generateRecommendations(
        pid, currentRun, bestRun, dataPoints
      )

      results.push({
        profileId: pid,
        currentScore: currentRun.detection_score,
        predictedScore: Math.min(100, bestRun.detection_score + 5),
        recommendations,
        optimizedConfig: this.computeOptimalConfig(dataPoints)
      })
    }

    return results
  }

  private generateRecommendations(
    profileId: string,
    current: GestureTrainingData,
    best: GestureTrainingData,
    allData: GestureTrainingData[]
  ): GestureRecommendation[] {
    const recommendations: GestureRecommendation[] = []

    // Find vectors that failed in current but passed in best
    for (const [vector, passed] of Object.entries(current.vector_scores)) {
      if (!passed && best.vector_scores[vector]) {
        recommendations.push({
          id: uuidv4(),
          vector_name: vector,
          issue: `Vector "${vector}" failing in current config`,
          fix: `Adjust timing to match config from test ${best.test_result_id}`,
          confidence: this.computeConfidence(vector, allData),
          applied: false
        })
      }
    }

    // Timing-specific recommendations
    const cfg = current.gesture_config
    const bestCfg = best.gesture_config

    if (cfg.pauseMin < bestCfg.pauseMin) {
      recommendations.push({
        id: uuidv4(),
        vector_name: 'gesture_timing',
        issue: `Pause interval too short (${cfg.pauseMin}ms)`,
        fix: `Increase minimum pause from ${cfg.pauseMin}ms to ${bestCfg.pauseMin}ms`,
        confidence: 0.75,
        applied: false
      })
    }

    if (cfg.missRate < 0.01) {
      recommendations.push({
        id: uuidv4(),
        vector_name: 'human_likeness',
        issue: 'Miss rate too low — appears robotic',
        fix: 'Increase miss rate to 0.02-0.05 for more human-like behavior',
        confidence: 0.8,
        applied: false
      })
    }

    if (cfg.tapDelayMax - cfg.tapDelayMin < 100) {
      recommendations.push({
        id: uuidv4(),
        vector_name: 'tap_variance',
        issue: 'Tap delay range too narrow — uniform timing is detectable',
        fix: `Widen tap delay range from [${cfg.tapDelayMin}-${cfg.tapDelayMax}] to at least 200ms spread`,
        confidence: 0.7,
        applied: false
      })
    }

    return recommendations
  }

  /** Compute confidence based on how consistently a vector fails across runs */
  private computeConfidence(vectorName: string, data: GestureTrainingData[]): number {
    let failCount = 0
    let total = 0
    for (const d of data) {
      if (vectorName in d.vector_scores) {
        total++
        if (!d.vector_scores[vectorName]) failCount++
      }
    }
    if (total === 0) return 0.5
    // Higher fail rate = higher confidence that it needs fixing
    return Math.min(0.95, 0.5 + (failCount / total) * 0.5)
  }

  /**
   * Compute the optimal config by averaging parameters from the top-scoring runs.
   */
  private computeOptimalConfig(data: GestureTrainingData[]): GestureTimingConfig {
    // Take top 30% of runs by score
    const sorted = [...data].sort((a, b) => b.detection_score - a.detection_score)
    const topN = Math.max(1, Math.floor(sorted.length * 0.3))
    const topRuns = sorted.slice(0, topN)

    const avg = (arr: number[]): number =>
      Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
    const avgFloat = (arr: number[]): number =>
      parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(4))

    return {
      tapDelayMin: avg(topRuns.map((r) => r.gesture_config.tapDelayMin)),
      tapDelayMax: avg(topRuns.map((r) => r.gesture_config.tapDelayMax)),
      swipeDurationMin: avg(topRuns.map((r) => r.gesture_config.swipeDurationMin)),
      swipeDurationMax: avg(topRuns.map((r) => r.gesture_config.swipeDurationMax)),
      pauseMin: avg(topRuns.map((r) => r.gesture_config.pauseMin)),
      pauseMax: avg(topRuns.map((r) => r.gesture_config.pauseMax)),
      scrollDistanceMin: avg(topRuns.map((r) => r.gesture_config.scrollDistanceMin)),
      scrollDistanceMax: avg(topRuns.map((r) => r.gesture_config.scrollDistanceMax)),
      missRate: avgFloat(topRuns.map((r) => r.gesture_config.missRate)),
      retapRate: avgFloat(topRuns.map((r) => r.gesture_config.retapRate))
    }
  }

  /** Get model statistics */
  getStats(): MLModelStats {
    const db = Database.getInstance()
    const data = db.getGestureTrainingData(undefined, 1000)

    if (data.length === 0) {
      return {
        trainingDataPoints: 0,
        lastTrainedAt: null,
        featureImportance: {},
        avgPredictionAccuracy: 0
      }
    }

    // Compute feature importance via variance analysis
    const features = [
      'tapDelayMin', 'tapDelayMax', 'swipeDurationMin', 'swipeDurationMax',
      'pauseMin', 'pauseMax', 'missRate', 'retapRate'
    ] as const

    const featureImportance: Record<string, number> = {}
    for (const feat of features) {
      featureImportance[feat] = this.computeFeatureImportance(data, feat)
    }

    return {
      trainingDataPoints: data.length,
      lastTrainedAt: data[0]?.timestamp ?? null,
      featureImportance,
      avgPredictionAccuracy: this.estimateAccuracy(data)
    }
  }

  private computeFeatureImportance(
    data: GestureTrainingData[],
    feature: keyof GestureTimingConfig
  ): number {
    if (data.length < 2) return 0

    const values = data.map((d) => d.gesture_config[feature])
    const scores = data.map((d) => d.detection_score)

    // Simple correlation coefficient
    const n = values.length
    const meanX = values.reduce((a, b) => a + b, 0) / n
    const meanY = scores.reduce((a, b) => a + b, 0) / n

    let numerator = 0
    let denomX = 0
    let denomY = 0
    for (let i = 0; i < n; i++) {
      const dx = values[i] - meanX
      const dy = scores[i] - meanY
      numerator += dx * dy
      denomX += dx * dx
      denomY += dy * dy
    }

    const denom = Math.sqrt(denomX * denomY)
    if (denom === 0) return 0
    return Math.abs(numerator / denom) // Return absolute correlation
  }

  private estimateAccuracy(data: GestureTrainingData[]): number {
    if (data.length < 4) return 0
    // Simple leave-one-out cross-validation proxy
    const scores = data.map((d) => d.detection_score)
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    const variance = scores.reduce((a, b) => a + (b - mean) ** 2, 0) / scores.length
    // Lower variance = higher "accuracy" (consistency)
    return Math.max(0, Math.min(1, 1 - Math.sqrt(variance) / 100))
  }
}
