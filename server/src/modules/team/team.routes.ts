import { Router } from 'express'

const router = Router()

// Team CRUD
router.post('/', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Team creation coming soon' })
})

router.get('/', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Team fetch coming soon' })
})

router.put('/', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Team update coming soon' })
})

router.delete('/', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Team deletion coming soon' })
})

// Members
router.get('/members', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Members listing coming soon' })
})

router.put('/members/:userId', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Member update coming soon' })
})

router.delete('/members/:userId', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Member removal coming soon' })
})

// Invites
router.post('/invites', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Invite creation coming soon' })
})

router.get('/invites', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Invite listing coming soon' })
})

router.delete('/invites/:inviteId', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Invite cancellation coming soon' })
})

router.post('/invites/:inviteId/accept', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Invite acceptance coming soon' })
})

// Shared profiles
router.post('/profiles/share', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Profile sharing coming soon' })
})

router.get('/profiles/shared', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Shared profiles listing coming soon' })
})

router.delete('/profiles/share', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Profile unsharing coming soon' })
})

// Audit log
router.get('/audit', (req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Audit log coming soon' })
})

export default router
