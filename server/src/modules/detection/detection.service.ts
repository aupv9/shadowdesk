import { notFound, unauthorized, internalError } from '../../utils/errors'
import { logger } from '../../utils/logger'

interface CreateTestRequest {
  profile_id: string
  profile_name?: string
  fingerprint_preset?: string
}

interface CompleteTestRequest {
  overall_score: number
  test_duration_ms?: number
  results: {
    vector_name: string
    vector_category: string
    passed: boolean
    score?: number
    risk_level?: 'low' | 'medium' | 'high' | 'critical'
    detail?: string
    raw_data?: Record<string, any>
  }[]
}

/**
 * DetectionService handles detection testing by communicating with the cloud Detection Service.
 * All methods call cloud Detection Service endpoints via HTTP client.
 */
export class DetectionService {
  private detectionServiceUrl: string

  constructor() {
    this.detectionServiceUrl = process.env.DETECTION_SERVICE_URL || 'http://localhost:3001/api'
  }

  /**
   * Create a new detection test by calling cloud Detection Service
   */
  async createTest(userId: string, input: CreateTestRequest): Promise<any> {
    try {
      const response = await fetch(`${this.detectionServiceUrl}/tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId
        },
        body: JSON.stringify({
          profile_id: input.profile_id,
          profile_name: input.profile_name,
          fingerprint_preset: input.fingerprint_preset
        })
      })

      if (!response.ok) {
        throw new Error(`Detection Service error: ${response.statusText}`)
      }

      const test = await response.json()
      logger.debug('Detection test created in cloud service', { testId: test.id })
      return test
    } catch (error) {
      logger.error('Failed to create detection test', { userId, error })
      throw internalError('Failed to create detection test')
    }
  }

  /**
   * List detection tests for user with optional filters
   */
  async listTests(userId: string, filters?: any): Promise<any> {
    try {
      const query = new URLSearchParams()
      if (filters?.profile_id) query.append('profile_id', filters.profile_id)
      if (filters?.status) query.append('status', filters.status)
      if (filters?.limit) query.append('limit', filters.limit.toString())
      if (filters?.offset) query.append('offset', filters.offset.toString())

      const response = await fetch(`${this.detectionServiceUrl}/tests?${query.toString()}`, {
        method: 'GET',
        headers: {
          'X-User-ID': userId
        }
      })

      if (!response.ok) {
        throw new Error(`Detection Service error: ${response.statusText}`)
      }

      const tests = await response.json()
      logger.debug('Detection tests retrieved', { userId, count: tests.length })
      return tests
    } catch (error) {
      logger.error('Failed to list detection tests', { userId, error })
      throw internalError('Failed to list detection tests')
    }
  }

  /**
   * Get a single detection test by ID
   */
  async getTest(userId: string, testId: string): Promise<any> {
    try {
      const response = await fetch(`${this.detectionServiceUrl}/tests/${testId}`, {
        method: 'GET',
        headers: {
          'X-User-ID': userId
        }
      })

      if (response.status === 404) {
        throw notFound('Detection test not found')
      }

      if (!response.ok) {
        throw new Error(`Detection Service error: ${response.statusText}`)
      }

      const test = await response.json()

      // Verify authorization - ensure user owns this test
      if (test.user_id !== userId) {
        throw unauthorized('You do not have access to this test')
      }

      return test
    } catch (error) {
      if (error instanceof Error && (error.message.includes('404') || error.message.includes('not found'))) {
        throw notFound('Detection test not found')
      }
      logger.error('Failed to get detection test', { userId, testId, error })
      throw internalError('Failed to get detection test')
    }
  }

  /**
   * Delete a detection test
   */
  async deleteTest(userId: string, testId: string): Promise<void> {
    try {
      // First verify ownership
      await this.getTest(userId, testId)

      const response = await fetch(`${this.detectionServiceUrl}/tests/${testId}`, {
        method: 'DELETE',
        headers: {
          'X-User-ID': userId
        }
      })

      if (!response.ok && response.status !== 204) {
        throw new Error(`Detection Service error: ${response.statusText}`)
      }

      logger.debug('Detection test deleted', { testId })
    } catch (error) {
      logger.error('Failed to delete detection test', { userId, testId, error })
      throw internalError('Failed to delete detection test')
    }
  }

  /**
   * Complete a detection test by submitting results
   */
  async completeTest(userId: string, testId: string, input: CompleteTestRequest): Promise<any> {
    try {
      // First verify ownership
      await this.getTest(userId, testId)

      const response = await fetch(`${this.detectionServiceUrl}/tests/${testId}/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId
        },
        body: JSON.stringify({
          overall_score: input.overall_score,
          test_duration_ms: input.test_duration_ms,
          results: input.results
        })
      })

      if (!response.ok) {
        throw new Error(`Detection Service error: ${response.statusText}`)
      }

      const test = await response.json()
      logger.debug('Detection test completed', { testId, overallScore: input.overall_score })
      return test
    } catch (error) {
      logger.error('Failed to complete detection test', { userId, testId, error })
      throw internalError('Failed to complete detection test')
    }
  }

  /**
   * List detection tests for a specific profile
   */
  async listTestsByProfile(userId: string, profileId: string, limit?: number): Promise<any> {
    try {
      const query = new URLSearchParams()
      query.append('profile_id', profileId)
      if (limit) query.append('limit', limit.toString())

      const response = await fetch(`${this.detectionServiceUrl}/tests?${query.toString()}`, {
        method: 'GET',
        headers: {
          'X-User-ID': userId
        }
      })

      if (!response.ok) {
        throw new Error(`Detection Service error: ${response.statusText}`)
      }

      const tests = await response.json()
      logger.debug('Detection tests retrieved for profile', { profileId, count: tests.length })
      return tests
    } catch (error) {
      logger.error('Failed to list tests by profile', { userId, profileId, error })
      throw internalError('Failed to list tests by profile')
    }
  }

  /**
   * Compare two detection test results
   */
  async compareTests(userId: string, testIdA: string, testIdB: string): Promise<any> {
    try {
      // Verify ownership of both tests
      await this.getTest(userId, testIdA)
      await this.getTest(userId, testIdB)

      const response = await fetch(`${this.detectionServiceUrl}/tests/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': userId
        },
        body: JSON.stringify({
          test_id_a: testIdA,
          test_id_b: testIdB
        })
      })

      if (!response.ok) {
        throw new Error(`Detection Service error: ${response.statusText}`)
      }

      const comparison = await response.json()
      logger.debug('Detection tests compared', { testIdA, testIdB })
      return comparison
    } catch (error) {
      logger.error('Failed to compare detection tests', { userId, testIdA, testIdB, error })
      throw internalError('Failed to compare detection tests')
    }
  }

  /**
   * List all available detection vectors
   */
  async listVectors(): Promise<any> {
    try {
      const response = await fetch(`${this.detectionServiceUrl}/vectors`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Detection Service error: ${response.statusText}`)
      }

      const vectors = await response.json()
      logger.debug('Detection vectors retrieved', { count: vectors.length })
      return vectors
    } catch (error) {
      logger.error('Failed to list detection vectors', { error })
      throw internalError('Failed to list detection vectors')
    }
  }

  /**
   * Get a specific detection vector by ID
   */
  async getVector(vectorId: string): Promise<any> {
    try {
      const response = await fetch(`${this.detectionServiceUrl}/vectors/${vectorId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      if (response.status === 404) {
        throw notFound('Detection vector not found')
      }

      if (!response.ok) {
        throw new Error(`Detection Service error: ${response.statusText}`)
      }

      const vector = await response.json()
      logger.debug('Detection vector retrieved', { vectorId })
      return vector
    } catch (error) {
      if (error instanceof Error && error.message.includes('404')) {
        throw notFound('Detection vector not found')
      }
      logger.error('Failed to get detection vector', { vectorId, error })
      throw internalError('Failed to get detection vector')
    }
  }
}

export const detectionService = new DetectionService()
