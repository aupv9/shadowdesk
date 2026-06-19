import { Request, Response } from 'express'
import { supportService, CreateTicketInput, FeedbackInput } from './support.service'
import { validate, createTicketSchema, replyTicketSchema, feedbackSchema } from '../../utils/validators'
import { unauthorized, badRequest } from '../../utils/errors'
import { uploadBlob } from '../../utils/storage'
import { env } from '../../config/env'

function uid(req: Request): string {
  if (!req.userId) throw unauthorized('User not authenticated')
  return req.userId
}

export class SupportController {
  async create(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const input = validate<CreateTicketInput>(req.body, createTicketSchema)
    res.status(201).json(await supportService.createTicket(userId, input))
  }

  async list(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
    const status = req.query.status ? String(req.query.status) : undefined
    res.json(await supportService.listTickets(userId, { page, limit, status }))
  }

  async get(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    res.json(await supportService.getTicket(userId, req.params.id))
  }

  async reply(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const { message } = validate<{ message: string }>(req.body, replyTicketSchema)
    res.status(201).json(await supportService.reply(userId, req.params.id, message))
  }

  async close(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    res.json(await supportService.setStatus(userId, req.params.id, 'closed'))
  }

  async reopen(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    res.json(await supportService.setStatus(userId, req.params.id, 'open'))
  }

  async feedback(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const input = validate<FeedbackInput>(req.body, feedbackSchema)
    res.status(201).json(await supportService.submitFeedback(userId, input))
  }

  async uploadAttachment(req: Request, res: Response): Promise<void> {
    const userId = uid(req)
    const file = req.file
    if (!file) throw badRequest('No file uploaded', 'no_file')

    const safeName = (file.originalname || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const storagePath = `${req.params.id}/${Date.now()}-${safeName}`
    const contentType = file.mimetype || 'application/octet-stream'
    const url = await uploadBlob(env.SUPABASE_BUCKET_ATTACHMENTS, storagePath, file.buffer, contentType)

    const attachment = await supportService.addAttachment(userId, req.params.id, {
      filename: file.originalname || safeName,
      size_bytes: file.size,
      content_type: contentType,
      url,
      storage_path: storagePath
    })
    res.status(201).json(attachment)
  }
}

export const supportController = new SupportController()
