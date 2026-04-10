import { Router } from 'express'
import { authController } from './auth.controller'
import { authMiddleware } from '../../middleware/auth'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

// Public routes
router.post('/register', asyncHandler(authController.register.bind(authController)))
router.post('/login', asyncHandler(authController.login.bind(authController)))
router.post('/refresh', asyncHandler(authController.refresh.bind(authController)))

// Protected routes
router.post('/logout', authMiddleware, asyncHandler(authController.logout.bind(authController)))
router.get('/me', authMiddleware, asyncHandler(authController.getCurrentUser.bind(authController)))
router.put('/password', authMiddleware, asyncHandler(authController.changePassword.bind(authController)))
router.delete('/me', authMiddleware, asyncHandler(authController.deleteAccount.bind(authController)))
router.post('/me/export', authMiddleware, asyncHandler(authController.exportUserData.bind(authController)))
router.post('/verify-email/resend', authMiddleware, asyncHandler(authController.resendVerificationEmail.bind(authController)))

export default router
