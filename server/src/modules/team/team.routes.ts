import { Router } from 'express'
import { teamController } from './team.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

// ── Team CRUD ────────────────────────────────────────────────────────────
router.post('/', asyncHandler(teamController.createTeam.bind(teamController)))
router.get('/', asyncHandler(teamController.getTeam.bind(teamController)))
router.put('/', asyncHandler(teamController.updateTeamName.bind(teamController)))
router.delete('/', asyncHandler(teamController.deleteTeam.bind(teamController)))

// ── Members ──────────────────────────────────────────────────────────────
router.get('/members', asyncHandler(teamController.getMembers.bind(teamController)))
router.put('/members/:userId', asyncHandler(teamController.updateMemberRole.bind(teamController)))
router.delete('/members/:userId', asyncHandler(teamController.removeMember.bind(teamController)))

// ── Invitations ──────────────────────────────────────────────────────────
router.post('/invites', asyncHandler(teamController.sendInvite.bind(teamController)))
router.get('/invites', asyncHandler(teamController.getInvites.bind(teamController)))
router.delete('/invites/:inviteId', asyncHandler(teamController.cancelInvite.bind(teamController)))
router.post('/invites/:inviteId/accept', asyncHandler(teamController.acceptInvite.bind(teamController)))

// ── Shared Profiles ──────────────────────────────────────────────────────
router.post('/profiles/share', asyncHandler(teamController.shareProfile.bind(teamController)))
router.get('/profiles/shared', asyncHandler(teamController.getSharedProfiles.bind(teamController)))
router.delete('/profiles/share', asyncHandler(teamController.unshareProfile.bind(teamController)))

// ── Audit Log ────────────────────────────────────────────────────────────
router.get('/audit', asyncHandler(teamController.getAuditLog.bind(teamController)))

export default router
