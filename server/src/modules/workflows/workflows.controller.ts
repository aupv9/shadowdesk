import { Request, Response } from 'express'
import { workflowsService } from './workflows.service'
import {
  validate,
  createWorkflowSchema,
  updateWorkflowSchema,
  executeWorkflowSchema,
  createScheduleSchema,
  updateScheduleSchema
} from '../../utils/validators'
import { unauthorized, notFound } from '../../utils/errors'
import { logger } from '../../utils/logger'

function userId(req: Request): string {
  if (!req.userId) throw unauthorized('User not authenticated')
  return req.userId
}

export class WorkflowsController {
  // ── Workflows ──────────────────────────────────────────────────────────

  async createWorkflow(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const input = validate(req.body, createWorkflowSchema)

    const workflow = await workflowsService.createWorkflow(uid, input)

    logger.info('Workflow created', { workflowId: workflow.id, userId: uid })
    res.status(201).json(workflow)
  }

  async listWorkflows(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const status = req.query.status as string | undefined
    const tags = req.query.tags as string | undefined
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    const workflows = await workflowsService.listWorkflows(uid, {
      status,
      tags: tags ? tags.split(',') : undefined,
      limit,
      offset
    })

    res.json(workflows)
  }

  async getWorkflow(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { id } = req.params

    const workflow = await workflowsService.getWorkflow(id)
    if (!workflow) {
      res.status(404).json({ error: 'not_found', message: 'Workflow not found' })
      return
    }

    logger.info('Workflow retrieved', { workflowId: id, userId: uid })
    res.json(workflow)
  }

  async updateWorkflow(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { id } = req.params
    const input = validate(req.body, updateWorkflowSchema)

    const workflow = await workflowsService.updateWorkflow(id, input)
    if (!workflow) {
      res.status(404).json({ error: 'not_found', message: 'Workflow not found' })
      return
    }

    logger.info('Workflow updated', { workflowId: id, userId: uid })
    res.json(workflow)
  }

  async deleteWorkflow(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { id } = req.params

    const success = await workflowsService.deleteWorkflow(id)
    if (!success) {
      res.status(404).json({ error: 'not_found', message: 'Workflow not found' })
      return
    }

    logger.info('Workflow deleted', { workflowId: id, userId: uid })
    res.status(204).send()
  }

  // ── Execution ──────────────────────────────────────────────────────────

  async executeWorkflow(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { id } = req.params
    const input = validate(req.body, executeWorkflowSchema)

    const execution = await workflowsService.executeWorkflow(uid, id, input)

    logger.info('Workflow execution started', {
      workflowId: id,
      executionId: execution.id,
      userId: uid
    })
    res.status(201).json(execution)
  }

  async getExecution(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { executionId } = req.params

    const execution = await workflowsService.getExecution(executionId)
    if (!execution) {
      res.status(404).json({ error: 'not_found', message: 'Execution not found' })
      return
    }

    logger.info('Execution retrieved', { executionId, userId: uid })
    res.json(execution)
  }

  async listExecutions(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { id } = req.params
    const status = req.query.status as string | undefined
    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0

    const executions = await workflowsService.listExecutions(id, {
      status,
      limit,
      offset
    })

    res.json(executions)
  }

  async cancelExecution(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { executionId } = req.params

    const execution = await workflowsService.cancelExecution(executionId)
    if (!execution) {
      res.status(404).json({ error: 'not_found', message: 'Execution not found' })
      return
    }

    logger.info('Execution cancelled', { executionId, userId: uid })
    res.json(execution)
  }

  async getExecutionLogs(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { executionId } = req.params

    const logs = await workflowsService.getExecutionLogs(executionId)

    logger.info('Execution logs retrieved', { executionId, userId: uid })
    res.json(logs)
  }

  // ── Schedules ──────────────────────────────────────────────────────────

  async createSchedule(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const input = validate(req.body, createScheduleSchema)

    const schedule = await workflowsService.createSchedule(uid, input)

    logger.info('Schedule created', {
      scheduleId: schedule.id,
      workflowId: schedule.workflow_id,
      userId: uid
    })
    res.status(201).json(schedule)
  }

  async listSchedules(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const workflowId = req.query.workflow_id as string | undefined

    const schedules = await workflowsService.listSchedules(uid, { workflowId })

    res.json(schedules)
  }

  async updateSchedule(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { scheduleId } = req.params
    const input = validate(req.body, updateScheduleSchema)

    const schedule = await workflowsService.updateSchedule(scheduleId, input)
    if (!schedule) {
      res.status(404).json({ error: 'not_found', message: 'Schedule not found' })
      return
    }

    logger.info('Schedule updated', { scheduleId, userId: uid })
    res.json(schedule)
  }

  async deleteSchedule(req: Request, res: Response): Promise<void> {
    const uid = userId(req)
    const { scheduleId } = req.params

    const success = await workflowsService.deleteSchedule(scheduleId)
    if (!success) {
      res.status(404).json({ error: 'not_found', message: 'Schedule not found' })
      return
    }

    logger.info('Schedule deleted', { scheduleId, userId: uid })
    res.status(204).send()
  }
}

export const workflowsController = new WorkflowsController()
