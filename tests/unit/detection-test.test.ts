import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { Page } from 'puppeteer-core'
import type { DetectionTestResult, DetectionVectorResult } from '../../src/shared/types'

/**
 * Unit tests for DetectionTestRunner
 * Tests timeout protection, input validation, vector evaluation, and persistence
 */
describe('DetectionTestRunner', () => {
  let mockDb: any
  let mockBm: any
  let mockPage: any
  let runner: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Mock Page interface
    mockPage = {
      evaluate: vi.fn(),
      goto: vi.fn(),
      browser: vi.fn()
    }

    // Mock Database singleton
    mockDb = {
      getProfile: vi.fn(),
      saveDetectionTestResult: vi.fn(),
      getDetectionTestResults: vi.fn(),
      deleteDetectionTestResult: vi.fn(),
      deleteAllDetectionTestResults: vi.fn(),
      getDetectionTestSummary: vi.fn()
    }

    // Mock BrowserManager singleton
    mockBm = {
      isRunning: vi.fn(),
      launchProfile: vi.fn(),
      closeProfile: vi.fn(),
      getSessions: vi.fn()
    }

    // Mock the module imports
    vi.doMock('../../src/main/database', () => ({
      Database: {
        getInstance: () => mockDb
      }
    }))

    vi.doMock('../../src/main/browser-manager', () => ({
      BrowserManager: {
        getInstance: () => mockBm
      }
    }))

    // Import the module after mocking dependencies
    const { DetectionTestRunner } = require('../../src/main/detection-test')
    runner = DetectionTestRunner.getInstance()
  })

  afterEach(() => {
    vi.unmock('../../src/main/database')
    vi.unmock('../../src/main/browser-manager')
  })

  describe('runTest', () => {
    it('should throw error if profile not found', async () => {
      mockDb.getProfile.mockReturnValue(null)

      await expect(runner.runTest('invalid-id')).rejects.toThrow('not found')
    })

    it('should launch browser if not already running', async () => {
      const profile = {
        id: 'p1',
        name: 'Test Profile',
        fingerprint: { preset: 'win10-chrome120' }
      }
      mockDb.getProfile.mockReturnValue(profile)
      mockBm.isRunning.mockReturnValue(false)
      mockBm.launchProfile.mockResolvedValue(undefined)
      mockBm.getSessions.mockReturnValue(new Map([
        ['p1', {
          browser: {
            pages: async () => [mockPage]
          }
        }]
      ]))
      mockBm.closeProfile.mockResolvedValue(undefined)

      // Mock page methods
      mockPage.goto.mockResolvedValue(undefined)
      mockPage.evaluate.mockResolvedValue(undefined)

      // Skip actual vector evaluation
      vi.spyOn(runner, 'evaluateVectors').mockResolvedValue([
        {
          name: 'test',
          category: 'Automation',
          passed: true,
          detail: 'test'
        }
      ])

      await runner.runTest('p1')

      expect(mockBm.launchProfile).toHaveBeenCalledWith('p1', profile.fingerprint)
    })

    it('should close browser if it opened it', async () => {
      const profile = {
        id: 'p1',
        name: 'Test Profile',
        fingerprint: { preset: 'win10-chrome120' }
      }
      mockDb.getProfile.mockReturnValue(profile)
      mockBm.isRunning.mockReturnValue(false)
      mockBm.launchProfile.mockResolvedValue(undefined)
      mockBm.closeProfile.mockResolvedValue(undefined)
      mockBm.getSessions.mockReturnValue(new Map([
        ['p1', {
          browser: {
            pages: async () => [mockPage]
          }
        }]
      ]))
      mockPage.goto.mockResolvedValue(undefined)

      vi.spyOn(runner, 'evaluateVectors').mockResolvedValue([
        {
          name: 'test',
          category: 'Automation',
          passed: true,
          detail: 'test'
        }
      ])

      await runner.runTest('p1')

      expect(mockBm.closeProfile).toHaveBeenCalledWith('p1')
    })

    it('should not close browser if it was already running', async () => {
      const profile = {
        id: 'p1',
        name: 'Test Profile',
        fingerprint: { preset: 'win10-chrome120' }
      }
      mockDb.getProfile.mockReturnValue(profile)
      mockBm.isRunning.mockReturnValue(true) // Already running
      mockBm.getSessions.mockReturnValue(new Map([
        ['p1', {
          browser: {
            pages: async () => [mockPage]
          }
        }]
      ]))
      mockPage.goto.mockResolvedValue(undefined)

      vi.spyOn(runner, 'evaluateVectors').mockResolvedValue([
        {
          name: 'test',
          category: 'Automation',
          passed: true,
          detail: 'test'
        }
      ])

      await runner.runTest('p1')

      expect(mockBm.closeProfile).not.toHaveBeenCalled()
    })

    it('should return DetectionTestResult with correct structure', async () => {
      const profile = {
        id: 'p1',
        name: 'Test Profile',
        fingerprint: { preset: 'win10-chrome120' }
      }
      mockDb.getProfile.mockReturnValue(profile)
      mockBm.isRunning.mockReturnValue(false)
      mockBm.launchProfile.mockResolvedValue(undefined)
      mockBm.closeProfile.mockResolvedValue(undefined)
      mockBm.getSessions.mockReturnValue(new Map([
        ['p1', {
          browser: {
            pages: async () => [mockPage]
          }
        }]
      ]))
      mockPage.goto.mockResolvedValue(undefined)

      const mockVectors: DetectionVectorResult[] = [
        { name: 'v1', category: 'Automation', passed: true, detail: 'test1' },
        { name: 'v2', category: 'Browser', passed: false, detail: 'test2' }
      ]
      vi.spyOn(runner, 'evaluateVectors').mockResolvedValue(mockVectors)

      const result: DetectionTestResult = await runner.runTest('p1')

      expect(result).toHaveProperty('id')
      expect(result).toHaveProperty('profileId', 'p1')
      expect(result).toHaveProperty('profileName', 'Test Profile')
      expect(result).toHaveProperty('testedAt')
      expect(result).toHaveProperty('overallScore')
      expect(result).toHaveProperty('vectors')
      expect(result).toHaveProperty('status')
      expect(result.vectors).toEqual(mockVectors)
    })

    it('should calculate overall score correctly (50% passed = 50)', async () => {
      const profile = {
        id: 'p1',
        name: 'Test Profile',
        fingerprint: { preset: 'win10-chrome120' }
      }
      mockDb.getProfile.mockReturnValue(profile)
      mockBm.isRunning.mockReturnValue(false)
      mockBm.launchProfile.mockResolvedValue(undefined)
      mockBm.closeProfile.mockResolvedValue(undefined)
      mockBm.getSessions.mockReturnValue(new Map([
        ['p1', {
          browser: {
            pages: async () => [mockPage]
          }
        }]
      ]))
      mockPage.goto.mockResolvedValue(undefined)

      const mockVectors = Array.from({ length: 10 }, (_, i) => ({
        name: `v${i}`,
        category: 'Test',
        passed: i < 5, // First 5 pass, last 5 fail
        detail: 'test'
      }))
      vi.spyOn(runner, 'evaluateVectors').mockResolvedValue(mockVectors)

      const result = await runner.runTest('p1')

      expect(result.overallScore).toBe(50)
    })

    it('should set status to "passed" when score >= 90', async () => {
      const profile = {
        id: 'p1',
        name: 'Test Profile',
        fingerprint: { preset: 'win10-chrome120' }
      }
      mockDb.getProfile.mockReturnValue(profile)
      mockBm.isRunning.mockReturnValue(false)
      mockBm.launchProfile.mockResolvedValue(undefined)
      mockBm.closeProfile.mockResolvedValue(undefined)
      mockBm.getSessions.mockReturnValue(new Map([
        ['p1', {
          browser: {
            pages: async () => [mockPage]
          }
        }]
      ]))
      mockPage.goto.mockResolvedValue(undefined)

      const mockVectors = Array.from({ length: 10 }, (_, i) => ({
        name: `v${i}`,
        category: 'Test',
        passed: i < 9, // 9 out of 10 pass = 90%
        detail: 'test'
      }))
      vi.spyOn(runner, 'evaluateVectors').mockResolvedValue(mockVectors)

      const result = await runner.runTest('p1')

      expect(result.status).toBe('passed')
    })

    it('should set status to "warning" when 70 <= score < 90', async () => {
      const profile = {
        id: 'p1',
        name: 'Test Profile',
        fingerprint: { preset: 'win10-chrome120' }
      }
      mockDb.getProfile.mockReturnValue(profile)
      mockBm.isRunning.mockReturnValue(false)
      mockBm.launchProfile.mockResolvedValue(undefined)
      mockBm.closeProfile.mockResolvedValue(undefined)
      mockBm.getSessions.mockReturnValue(new Map([
        ['p1', {
          browser: {
            pages: async () => [mockPage]
          }
        }]
      ]))
      mockPage.goto.mockResolvedValue(undefined)

      const mockVectors = Array.from({ length: 10 }, (_, i) => ({
        name: `v${i}`,
        category: 'Test',
        passed: i < 8, // 8 out of 10 pass = 80%
        detail: 'test'
      }))
      vi.spyOn(runner, 'evaluateVectors').mockResolvedValue(mockVectors)

      const result = await runner.runTest('p1')

      expect(result.status).toBe('warning')
    })

    it('should set status to "failed" when score < 70', async () => {
      const profile = {
        id: 'p1',
        name: 'Test Profile',
        fingerprint: { preset: 'win10-chrome120' }
      }
      mockDb.getProfile.mockReturnValue(profile)
      mockBm.isRunning.mockReturnValue(false)
      mockBm.launchProfile.mockResolvedValue(undefined)
      mockBm.closeProfile.mockResolvedValue(undefined)
      mockBm.getSessions.mockReturnValue(new Map([
        ['p1', {
          browser: {
            pages: async () => [mockPage]
          }
        }]
      ]))
      mockPage.goto.mockResolvedValue(undefined)

      const mockVectors = Array.from({ length: 10 }, (_, i) => ({
        name: `v${i}`,
        category: 'Test',
        passed: i < 6, // 6 out of 10 pass = 60%
        detail: 'test'
      }))
      vi.spyOn(runner, 'evaluateVectors').mockResolvedValue(mockVectors)

      const result = await runner.runTest('p1')

      expect(result.status).toBe('failed')
    })

    it('should persist result to database', async () => {
      const profile = {
        id: 'p1',
        name: 'Test Profile',
        fingerprint: { preset: 'win10-chrome120' }
      }
      mockDb.getProfile.mockReturnValue(profile)
      mockBm.isRunning.mockReturnValue(false)
      mockBm.launchProfile.mockResolvedValue(undefined)
      mockBm.closeProfile.mockResolvedValue(undefined)
      mockBm.getSessions.mockReturnValue(new Map([
        ['p1', {
          browser: {
            pages: async () => [mockPage]
          }
        }]
      ]))
      mockPage.goto.mockResolvedValue(undefined)

      const mockVectors = [
        { name: 'v1', category: 'Test', passed: true, detail: 'test' }
      ]
      vi.spyOn(runner, 'evaluateVectors').mockResolvedValue(mockVectors)

      await runner.runTest('p1')

      expect(mockDb.saveDetectionTestResult).toHaveBeenCalled()
      const savedResult = mockDb.saveDetectionTestResult.mock.calls[0][0]
      expect(savedResult).toHaveProperty('id')
      expect(savedResult).toHaveProperty('profileId', 'p1')
    })
  })

  describe('getResults', () => {
    it('should return all results when no profileId specified', () => {
      const mockResults = [
        { id: 'r1', profileId: 'p1', overallScore: 90 },
        { id: 'r2', profileId: 'p2', overallScore: 80 }
      ]
      mockDb.getDetectionTestResults.mockReturnValue(mockResults)

      const results = runner.getResults()

      expect(mockDb.getDetectionTestResults).toHaveBeenCalledWith(undefined)
      expect(results).toEqual(mockResults)
    })

    it('should filter results by profileId when specified', () => {
      const mockResults = [
        { id: 'r1', profileId: 'p1', overallScore: 90 }
      ]
      mockDb.getDetectionTestResults.mockReturnValue(mockResults)

      const results = runner.getResults('p1')

      expect(mockDb.getDetectionTestResults).toHaveBeenCalledWith('p1')
      expect(results).toEqual(mockResults)
    })
  })

  describe('Timeout Protection', () => {
    it('should timeout if vector evaluation takes too long', async () => {
      const profile = {
        id: 'p1',
        name: 'Test Profile',
        fingerprint: { preset: 'win10-chrome120' }
      }
      mockDb.getProfile.mockReturnValue(profile)
      mockBm.isRunning.mockReturnValue(false)
      mockBm.launchProfile.mockResolvedValue(undefined)
      mockBm.closeProfile.mockResolvedValue(undefined)
      mockBm.getSessions.mockReturnValue(new Map([
        ['p1', {
          browser: {
            pages: async () => [mockPage]
          }
        }]
      ]))
      mockPage.goto.mockResolvedValue(undefined)

      // Mock evaluateVectors to hang
      vi.spyOn(runner, 'evaluateVectors').mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 60000)) // 60 seconds
      )

      // Test should timeout (30s) instead of hanging
      await expect(
        runner.runTest('p1')
      ).rejects.toThrow(/timeout|timed out/)
    }, { timeout: 35000 })
  })

  describe('Error Handling', () => {
    it('should continue with partial results if a vector fails', async () => {
      const profile = {
        id: 'p1',
        name: 'Test Profile',
        fingerprint: { preset: 'win10-chrome120' }
      }
      mockDb.getProfile.mockReturnValue(profile)
      mockBm.isRunning.mockReturnValue(false)
      mockBm.launchProfile.mockResolvedValue(undefined)
      mockBm.closeProfile.mockResolvedValue(undefined)
      mockBm.getSessions.mockReturnValue(new Map([
        ['p1', {
          browser: {
            pages: async () => [mockPage]
          }
        }]
      ]))
      mockPage.goto.mockResolvedValue(undefined)

      // Mix of successful and failed vectors
      const mockVectors = [
        { name: 'v1', category: 'Automation', passed: true, detail: 'success' },
        { name: 'v2', category: 'Browser', passed: false, detail: 'Error: timeout' },
        { name: 'v3', category: 'Graphics', passed: true, detail: 'success' }
      ]
      vi.spyOn(runner, 'evaluateVectors').mockResolvedValue(mockVectors)

      const result = await runner.runTest('p1')

      // Should still complete successfully with 2/3 vectors
      expect(result.vectors).toHaveLength(3)
      expect(result.overallScore).toBe(67) // 2 out of 3
    })
  })

  describe('Batch Mode Integration', () => {
    it('should handle multiple profiles in sequence', async () => {
      const profiles = [
        { id: 'p1', name: 'Profile 1', fingerprint: { preset: 'win10-chrome120' } },
        { id: 'p2', name: 'Profile 2', fingerprint: { preset: 'mac-sonoma-chrome121' } }
      ]

      let callCount = 0
      mockDb.getProfile.mockImplementation((id: string) =>
        profiles.find(p => p.id === id) || null
      )
      mockBm.isRunning.mockReturnValue(false)
      mockBm.launchProfile.mockResolvedValue(undefined)
      mockBm.closeProfile.mockResolvedValue(undefined)
      mockBm.getSessions.mockImplementation((id: string) =>
        new Map([[id, { browser: { pages: async () => [mockPage] } }]])
      )
      mockPage.goto.mockResolvedValue(undefined)

      vi.spyOn(runner, 'evaluateVectors').mockImplementation(async () => {
        callCount++
        return [
          { name: `v${callCount}`, category: 'Test', passed: true, detail: 'test' }
        ]
      })

      // Simulate batch testing by calling runTest multiple times
      const result1 = await runner.runTest('p1')
      const result2 = await runner.runTest('p2')

      expect(result1.profileId).toBe('p1')
      expect(result2.profileId).toBe('p2')
      expect(mockBm.launchProfile).toHaveBeenCalledTimes(2)
      expect(mockBm.closeProfile).toHaveBeenCalledTimes(2)
    })
  })
})
