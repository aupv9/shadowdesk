import { Router } from 'express'
import { detectionController } from './detection.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

// ── Detection Tests ────────────────────────────────────────────────────────
// Create a new detection test
router.post('/', asyncHandler(detectionController.createTest.bind(detectionController)))

// List all detection tests (with optional filters)
router.get('/', asyncHandler(detectionController.listTests.bind(detectionController)))

// Get a specific detection test
router.get('/:id', asyncHandler(detectionController.getTest.bind(detectionController)))

// Delete a detection test
router.delete('/:id', asyncHandler(detectionController.deleteTest.bind(detectionController)))

// Complete/submit results for a detection test
router.put('/:id/complete', asyncHandler(detectionController.completeTest.bind(detectionController)))

// List detection tests for a specific profile
router.get('/profile/:profileId', asyncHandler(detectionController.listTestsByProfile.bind(detectionController)))

// ── Comparison ─────────────────────────────────────────────────────────────
// Compare two detection tests
router.post('/compare', asyncHandler(detectionController.compareTests.bind(detectionController)))

// ── Detection Vectors ──────────────────────────────────────────────────────
// List all available detection vectors
router.get('/vectors', asyncHandler(detectionController.listVectors.bind(detectionController)))

// Get a specific detection vector
router.get('/vectors/:id', asyncHandler(detectionController.getVector.bind(detectionController)))

export default router
