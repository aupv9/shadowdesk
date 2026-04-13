import { Request, Response } from 'express'
import { detectionService } from './detection.service'
import {
  validate,
  createDetectionTestSchema,
  completeDetectionTestSchema,
  compareTestsSchema
} from '../../utils/validators'
import { unauthorized } from '../../utils/errors'
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

interface CompareTestsRequest {
  test_id_a: string
  test_id_b: string
}

function userId(req: Request): string {
  if (!req.userId) throw unauthorized('User not authenticated')
  return req.userId
}

export class DetectionController {
  async createTest(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const input = validate<CreateTestRequest>(req.body, createDetectionTestSchema)

    const test = await detectionService.createTest(uid, input)

    logger.info('Detection test created', {
      userId: uid,
      testId: test.id,
      profileId: input.profile_id
    })

    res.status(201).json(test)
  }

  async listTests(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const filters = {
      profile_id: req.query.profile_id as string | undefined,
      status: req.query.status as string | undefined,
      limit: parseInt(req.query.limit as string) || 50,
      offset: parseInt(req.query.offset as string) || 0
    }

    const tests = await detectionService.listTests(uid, filters)
    res.json(tests)
  }

  async getTest(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const testId = req.params.id

    const test = await detectionService.getTest(uid, testId)
    res.json(test)
  }

  async deleteTest(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const testId = req.params.id

    await detectionService.deleteTest(uid, testId)

    logger.info('Detection test deleted', {
      userId: uid,
      testId
    })

    res.status(204).send()
  }

  async completeTest(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const testId = req.params.id
    const input = validate<CompleteTestRequest>(req.body, completeDetectionTestSchema)

    const test = await detectionService.completeTest(uid, testId, input)

    logger.info('Detection test completed', {
      userId: uid,
      testId,
      overallScore: input.overall_score
    })

    res.json(test)
  }

  async listTestsByProfile(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const profileId = req.params.profileId
    const limit = parseInt(req.query.limit as string) || 50

    const tests = await detectionService.listTestsByProfile(uid, profileId, limit)
    res.json(tests)
  }

  async compareTests(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const input = validate<CompareTestsRequest>(req.body, compareTestsSchema)

    const comparison = await detectionService.compareTests(
      uid,
      input.test_id_a,
      input.test_id_b
    )

    logger.info('Detection tests compared', {
      userId: uid,
      testIdA: input.test_id_a,
      testIdB: input.test_id_b
    })

    res.json(comparison)
  }

  async listVectors(req: Request, res: Response): Promise<void> {
    const vectors = await detectionService.listVectors()
    res.json(vectors)
  }

  async getVector(req: Request, res: Response): Promise<void> {
    const vectorId = req.params.id
    const vector = await detectionService.getVector(vectorId)
    res.json(vector)
  }
}

export const detectionController = new DetectionController()
