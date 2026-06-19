import { v4 as uuid } from 'uuid'
import { notFound, internalError } from '../../utils/errors'
import { logger } from '../../utils/logger'
import type {
  CreateWorkflowRequest,
  ExecuteWorkflowRequest,
  CreateScheduleRequest,
  UpdateScheduleRequest
} from '../../types'

/**
 * HTTP client for calling cloud Automation Service
 */
class ApiClient {
  private baseUrl: string
  private apiKey: string

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl
    this.apiKey = apiKey
  }

  private async request<T = any>(method: string, path: string, body?: any): Promise<T> {
    try {
      const url = `${this.baseUrl}${path}`
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: body ? JSON.stringify(body) : undefined
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        logger.error(`API request failed: ${method} ${path}`, {
          status: response.status,
          error
        })
        throw internalError(`Cloud service error: ${response.statusText}`)
      }

      const data = await response.json()
      return data as T
    } catch (e: any) {
      logger.error(`API request exception: ${method} ${path}`, { error: e.message })
      throw e instanceof Error ? e : internalError(String(e))
    }
  }

  async get<T = any>(path: string): Promise<T> {
    return this.request<T>('GET', path)
  }

  async post<T = any>(path: string, body: any): Promise<T> {
    return this.request<T>('POST', path, body)
  }

  async put<T = any>(path: string, body: any): Promise<T> {
    return this.request<T>('PUT', path, body)
  }

  async delete(path: string): Promise<void> {
    await this.request('DELETE', path)
  }
}

/**
 * Workflows Service
 * Bridges local app with cloud Automation Service
 */
export class WorkflowsService {
  private apiClient: ApiClient

  constructor() {
    const baseUrl = process.env.AUTOMATION_SERVICE_URL || 'https://api.automation.ghostbrowser.app'
    const apiKey = process.env.AUTOMATION_SERVICE_KEY || 'dev-key'
    this.apiClient = new ApiClient(baseUrl, apiKey)
  }

  // ── Workflows ──────────────────────────────────────────────────────────

  async createWorkflow(userId: string, input: CreateWorkflowRequest): Promise<any> {
    try {
      const workflow = await this.apiClient.post('/v1/workflows', {
        user_id: userId,
        ...input
      })

      logger.debug('Workflow created in cloud service', { workflowId: workflow.id, userId })
      return workflow
    } catch (e) {
      logger.error('Failed to create workflow', { error: e, userId })
      throw e
    }
  }

  async listWorkflows(userId: string, filters?: any): Promise<any> {
    try {
      const queryParams = new URLSearchParams({
        user_id: userId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.limit && { limit: filters.limit.toString() }),
        ...(filters?.offset && { offset: filters.offset.toString() })
      })

      if (filters?.tags && Array.isArray(filters.tags)) {
        filters.tags.forEach((tag: string) => queryParams.append('tags', tag))
      }

      const workflows = await this.apiClient.get(`/v1/workflows?${queryParams}`)
      return workflows
    } catch (e) {
      logger.error('Failed to list workflows', { error: e, userId })
      throw e
    }
  }

  async getWorkflow(id: string): Promise<any> {
    try {
      const workflow = await this.apiClient.get(`/v1/workflows/${id}`)
      return workflow
    } catch (e) {
      logger.error('Failed to get workflow', { error: e, workflowId: id })
      throw e
    }
  }

  async updateWorkflow(id: string, input: any): Promise<any> {
    try {
      const workflow = await this.apiClient.put(`/v1/workflows/${id}`, input)
      logger.debug('Workflow updated in cloud service', { workflowId: id })
      return workflow
    } catch (e) {
      logger.error('Failed to update workflow', { error: e, workflowId: id })
      throw e
    }
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    try {
      await this.apiClient.delete(`/v1/workflows/${id}`)
      logger.debug('Workflow deleted in cloud service', { workflowId: id })
      return true
    } catch (e) {
      if ((e as any).statusCode === 404) {
        return false
      }
      logger.error('Failed to delete workflow', { error: e, workflowId: id })
      throw e
    }
  }

  // ── Execution ──────────────────────────────────────────────────────────

  async executeWorkflow(userId: string, workflowId: string, input: ExecuteWorkflowRequest): Promise<any> {
    try {
      const execution = await this.apiClient.post(`/v1/workflows/${workflowId}/execute`, {
        user_id: userId,
        profile_id: input.profile_id,
        variables: input.variables || {}
      })

      logger.debug('Workflow execution started', {
        workflowId,
        executionId: execution.id,
        userId
      })
      return execution
    } catch (e) {
      logger.error('Failed to execute workflow', { error: e, workflowId, userId })
      throw e
    }
  }

  async getExecution(id: string): Promise<any> {
    try {
      const execution = await this.apiClient.get(`/v1/executions/${id}`)
      return execution
    } catch (e) {
      logger.error('Failed to get execution', { error: e, executionId: id })
      throw e
    }
  }

  async listExecutions(workflowId: string, filters?: any): Promise<any> {
    try {
      const queryParams = new URLSearchParams({
        ...(filters?.status && { status: filters.status }),
        ...(filters?.limit && { limit: filters.limit.toString() }),
        ...(filters?.offset && { offset: filters.offset.toString() })
      })

      const executions = await this.apiClient.get(
        `/v1/workflows/${workflowId}/executions?${queryParams}`
      )
      return executions
    } catch (e) {
      logger.error('Failed to list executions', { error: e, workflowId })
      throw e
    }
  }

  async cancelExecution(executionId: string): Promise<any> {
    try {
      const execution = await this.apiClient.post(`/v1/executions/${executionId}/cancel`, {})
      logger.debug('Execution cancelled', { executionId })
      return execution
    } catch (e) {
      logger.error('Failed to cancel execution', { error: e, executionId })
      throw e
    }
  }

  async getExecutionLogs(executionId: string): Promise<any> {
    try {
      const logs = await this.apiClient.get(`/v1/executions/${executionId}/logs`)
      return logs
    } catch (e) {
      logger.error('Failed to get execution logs', { error: e, executionId })
      throw e
    }
  }

  // ── Schedules ──────────────────────────────────────────────────────────

  async createSchedule(userId: string, input: CreateScheduleRequest): Promise<any> {
    try {
      const schedule = await this.apiClient.post('/v1/schedules', {
        user_id: userId,
        ...input
      })

      logger.debug('Schedule created in cloud service', {
        scheduleId: schedule.id,
        workflowId: schedule.workflow_id,
        userId
      })
      return schedule
    } catch (e) {
      logger.error('Failed to create schedule', { error: e, userId })
      throw e
    }
  }

  async listSchedules(userId: string, filters?: any): Promise<any> {
    try {
      const queryParams = new URLSearchParams({
        user_id: userId,
        ...(filters?.workflowId && { workflow_id: filters.workflowId })
      })

      const schedules = await this.apiClient.get(`/v1/schedules?${queryParams}`)
      return schedules
    } catch (e) {
      logger.error('Failed to list schedules', { error: e, userId })
      throw e
    }
  }

  async updateSchedule(id: string, input: UpdateScheduleRequest): Promise<any> {
    try {
      const schedule = await this.apiClient.put(`/v1/schedules/${id}`, input)
      logger.debug('Schedule updated in cloud service', { scheduleId: id })
      return schedule
    } catch (e) {
      logger.error('Failed to update schedule', { error: e, scheduleId: id })
      throw e
    }
  }

  async deleteSchedule(id: string): Promise<boolean> {
    try {
      await this.apiClient.delete(`/v1/schedules/${id}`)
      logger.debug('Schedule deleted in cloud service', { scheduleId: id })
      return true
    } catch (e) {
      if ((e as any).statusCode === 404) {
        return false
      }
      logger.error('Failed to delete schedule', { error: e, scheduleId: id })
      throw e
    }
  }
}

export const workflowsService = new WorkflowsService()
