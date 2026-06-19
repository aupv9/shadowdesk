import { Request, Response } from 'express'
import { apiKeyService, CreateApiKeyInput } from './api-keys.service'
import { validate, createApiKeySchema } from '../../utils/validators'
import { unauthorized, forbidden } from '../../utils/errors'
import { logger } from '../../utils/logger'

function uid(req: Request): string {
  if (!req.userId) throw unauthorized('User not authenticated')
  return req.userId
}

/** Routes scoped by /users/:userId must match the authenticated user. */
function ensureSelfParam(req: Request): string {
  const userId = uid(req)
  if (req.params.userId !== userId) throw forbidden("Cannot manage another user's API keys")
  return userId
}

export class ApiKeyController {
  async list(req: Request, res: Response): Promise<void> {
    const userId = ensureSelfParam(req)
    res.json(await apiKeyService.list(userId))
  }

  async create(req: Request, res: Response): Promise<void> {
    const userId = ensureSelfParam(req)
    const input = validate<CreateApiKeyInput>(req.body, createApiKeySchema)
    const key = await apiKeyService.create(userId, input)
    logger.info('API key created', { userId, keyId: key.id })
    res.status(201).json(key)
  }

  async rotate(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    res.json(await apiKeyService.rotate(userId, req.params.keyId))
  }

  async remove(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    await apiKeyService.remove(userId, req.params.keyId)
    res.status(204).send()
  }

  async usage(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const period = String(req.query.period ?? 'week')
    res.json(await apiKeyService.usage(userId, req.params.keyId, period))
  }
}

export const apiKeyController = new ApiKeyController()
