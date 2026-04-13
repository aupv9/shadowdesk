import { Router } from 'express'
import { workflowsController } from './workflows.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

// ── Workflows ──────────────────────────────────────────────────────────
router.post('/', asyncHandler(workflowsController.createWorkflow.bind(workflowsController)))
router.get('/', asyncHandler(workflowsController.listWorkflows.bind(workflowsController)))
router.get('/:id', asyncHandler(workflowsController.getWorkflow.bind(workflowsController)))
router.put('/:id', asyncHandler(workflowsController.updateWorkflow.bind(workflowsController)))
router.delete('/:id', asyncHandler(workflowsController.deleteWorkflow.bind(workflowsController)))

// ── Execution ──────────────────────────────────────────────────────────
router.post('/:id/execute', asyncHandler(workflowsController.executeWorkflow.bind(workflowsController)))
router.get('/:id/executions', asyncHandler(workflowsController.listExecutions.bind(workflowsController)))
router.get('/executions/:executionId', asyncHandler(workflowsController.getExecution.bind(workflowsController)))
router.post('/executions/:executionId/cancel', asyncHandler(workflowsController.cancelExecution.bind(workflowsController)))
router.get('/executions/:executionId/logs', asyncHandler(workflowsController.getExecutionLogs.bind(workflowsController)))

// ── Schedules ──────────────────────────────────────────────────────────
router.post('/schedules', asyncHandler(workflowsController.createSchedule.bind(workflowsController)))
router.get('/schedules', asyncHandler(workflowsController.listSchedules.bind(workflowsController)))
router.put('/schedules/:scheduleId', asyncHandler(workflowsController.updateSchedule.bind(workflowsController)))
router.delete('/schedules/:scheduleId', asyncHandler(workflowsController.deleteSchedule.bind(workflowsController)))

export default router
