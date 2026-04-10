# Phase 2 Implementation Guide - Team Features

**Target Duration:** 4-5 weeks | **Team:** 2 developers  
**Sprint Schedule:** 3 sprints of 2 weeks each

---

## Overview

Phase 2 completes the team collaboration system that makes Ghost Browser a platform rather than a solo tool. All database tables are already defined in the schema—this phase focuses on implementing the services, controllers, and API endpoints.

**Scope:** 15 API endpoints across 5 features
- Team CRUD (4 endpoints)
- Member Management (3 endpoints)
- Invitations (4 endpoints)
- Shared Profiles (3 endpoints)
- Audit Logging (1 endpoint)

**New Files:** 12 files  
**Modified Files:** 5 files  
**Lines of Code:** ~2,500

---

## Sprint 1: Team CRUD & Member Management (Weeks 1-2)

### Sprint Goal
Enable users to create teams, manage team structure, and invite members to collaborate.

### Files to Implement

#### 1. **team.service.ts** (150 lines)
**Location:** `server/src/modules/team/team.service.ts`

```typescript
import { v4 as uuid } from 'uuid'
import { getDatabase } from '../../config/database'
import { unauthorized, forbidden, notFound, conflict } from '../../utils/errors'
import type { Team, TeamMember } from '../../types'

export class TeamService {
  /**
   * Create a new team with the authenticated user as owner
   */
  async createTeam(
    userId: string,
    input: { name: string; description?: string; maxMembers?: number }
  ): Promise<{ team: Team; member: TeamMember }> {
    const db = getDatabase()

    const teamId = uuid()

    // Transaction: create team + add owner
    const trx = await db.transaction()

    try {
      // Create team
      await trx('teams').insert({
        id: teamId,
        owner_id: userId,
        name: input.name,
        description: input.description || null,
        max_members: input.maxMembers ?? -1,
        created_at: new Date(),
        updated_at: new Date()
      })

      // Add owner as team member
      const memberId = uuid()
      await trx('team_members').insert({
        id: memberId,
        team_id: teamId,
        user_id: userId,
        role: 'owner',
        joined_at: new Date()
      })

      await trx.commit()

      const team = await this.fetchTeam(teamId)
      const member = await this.getMember(teamId, userId)

      return { team: team!, member: member! }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Get all teams for a user (as member)
   */
  async fetchUserTeams(
    userId: string,
    pagination: { page: number; limit: number }
  ): Promise<{ teams: Team[]; total: number }> {
    const db = getDatabase()

    const offset = (pagination.page - 1) * pagination.limit

    const teams = await db('teams')
      .join('team_members', 'teams.id', 'team_members.team_id')
      .where('team_members.user_id', userId)
      .where('teams.deleted_at', null)
      .select('teams.*')
      .orderBy('teams.updated_at', 'desc')
      .limit(pagination.limit)
      .offset(offset)

    const [{ count }] = await db('teams')
      .join('team_members', 'teams.id', 'team_members.team_id')
      .where('team_members.user_id', userId)
      .where('teams.deleted_at', null)
      .count('* as count')

    return {
      teams: teams.map(t => this.formatTeam(t)),
      total: parseInt(count)
    }
  }

  /**
   * Get single team by ID (verify user is member)
   */
  async fetchTeam(teamId: string, userId?: string): Promise<Team | null> {
    const db = getDatabase()

    const team = await db('teams')
      .where('id', teamId)
      .where('deleted_at', null)
      .first()

    if (!team) return null

    // If userId provided, verify membership
    if (userId) {
      const member = await db('team_members')
        .where('team_id', teamId)
        .where('user_id', userId)
        .first()
      if (!member) throw forbidden('You are not a member of this team')
    }

    return this.formatTeam(team)
  }

  /**
   * Update team name/description (owner/admin only)
   */
  async updateTeam(
    teamId: string,
    userId: string,
    input: { name?: string; description?: string; maxMembers?: number }
  ): Promise<Team> {
    const db = getDatabase()

    // Check permission
    await this.verifyOwnerOrAdmin(teamId, userId)

    await db('teams')
      .where('id', teamId)
      .update({
        name: input.name,
        description: input.description,
        max_members: input.maxMembers,
        updated_at: new Date()
      })

    const team = await this.fetchTeam(teamId, userId)
    if (!team) throw notFound('Team not found')
    return team
  }

  /**
   * Soft delete team (owner only)
   */
  async deleteTeam(teamId: string, userId: string): Promise<void> {
    const db = getDatabase()

    // Check ownership
    const team = await db('teams').where('id', teamId).first()
    if (!team) throw notFound('Team not found')
    if (team.owner_id !== userId) throw forbidden('Only owner can delete team')

    await db('teams')
      .where('id', teamId)
      .update({
        deleted_at: new Date(),
        updated_at: new Date()
      })
  }

  /**
   * Get all members of a team (with pagination)
   */
  async getTeamMembers(
    teamId: string,
    userId: string,
    pagination: { page: number; limit: number }
  ): Promise<{ members: (TeamMember & { user: any })[]; total: number }> {
    const db = getDatabase()

    // Verify membership
    await this.fetchTeam(teamId, userId)

    const offset = (pagination.page - 1) * pagination.limit

    const members = await db('team_members')
      .join('users', 'team_members.user_id', 'users.id')
      .where('team_members.team_id', teamId)
      .select('team_members.*', {
        user_id: 'users.id',
        user_email: 'users.email',
        user_name: 'users.full_name'
      })
      .orderBy('team_members.role', 'asc')
      .limit(pagination.limit)
      .offset(offset)

    const [{ count }] = await db('team_members')
      .where('team_id', teamId)
      .count('* as count')

    return {
      members: members.map(m => ({
        ...m,
        user: { id: m.user_id, email: m.user_email, fullName: m.user_name }
      })),
      total: parseInt(count)
    }
  }

  /**
   * Add member to team (owner/admin only)
   */
  async addMember(
    teamId: string,
    userId: string,
    newUserId: string,
    role: 'admin' | 'member',
    addedBy: string
  ): Promise<TeamMember> {
    const db = getDatabase()

    // Check permission
    await this.verifyOwnerOrAdmin(teamId, addedBy)

    // Check team max members
    const team = await db('teams').where('id', teamId).first()
    if (team.max_members > 0) {
      const [{ count }] = await db('team_members')
        .where('team_id', teamId)
        .count('* as count')
      if (count >= team.max_members) {
        throw conflict('Team has reached maximum members')
      }
    }

    const memberId = uuid()
    await db('team_members').insert({
      id: memberId,
      team_id: teamId,
      user_id: newUserId,
      role,
      joined_at: new Date()
    })

    return {
      id: memberId,
      team_id: teamId,
      user_id: newUserId,
      role,
      joined_at: new Date()
    }
  }

  /**
   * Update member role (owner/admin only, but admin can't demote owner)
   */
  async updateMemberRole(
    teamId: string,
    userId: string,
    targetUserId: string,
    newRole: 'owner' | 'admin' | 'member',
    updatedBy: string
  ): Promise<TeamMember> {
    const db = getDatabase()

    // Check permission
    const updaterRole = await this.getMemberRole(teamId, updatedBy)
    if (updaterRole !== 'owner' && updaterRole !== 'admin') {
      throw forbidden('Only owner/admin can update member roles')
    }

    // Get current role of target
    const currentRole = await this.getMemberRole(teamId, targetUserId)
    if (currentRole === 'owner' && updaterRole !== 'owner') {
      throw forbidden('Only owner can demote owner')
    }

    await db('team_members')
      .where('team_id', teamId)
      .where('user_id', targetUserId)
      .update({ role: newRole })

    const member = await this.getMember(teamId, targetUserId)
    return member!
  }

  /**
   * Remove member from team (owner/admin, or self-removal)
   */
  async removeMember(
    teamId: string,
    targetUserId: string,
    removedBy: string
  ): Promise<void> {
    const db = getDatabase()

    // Self-removal always allowed
    if (targetUserId !== removedBy) {
      // Check permission
      await this.verifyOwnerOrAdmin(teamId, removedBy)
    }

    // Can't remove owner
    const targetRole = await this.getMemberRole(teamId, targetUserId)
    if (targetRole === 'owner') {
      throw conflict('Cannot remove team owner')
    }

    await db('team_members')
      .where('team_id', teamId)
      .where('user_id', targetUserId)
      .delete()
  }

  /**
   * Helper: Get member role
   */
  async getMemberRole(teamId: string, userId: string): Promise<string | null> {
    const db = getDatabase()
    const member = await db('team_members')
      .where('team_id', teamId)
      .where('user_id', userId)
      .first()
    return member?.role ?? null
  }

  /**
   * Helper: Get single member
   */
  async getMember(teamId: string, userId: string): Promise<TeamMember | null> {
    const db = getDatabase()
    return db('team_members')
      .where('team_id', teamId)
      .where('user_id', userId)
      .first()
  }

  /**
   * Helper: Verify user is owner or admin of team
   */
  async verifyOwnerOrAdmin(teamId: string, userId: string): Promise<void> {
    const role = await this.getMemberRole(teamId, userId)
    if (!role || (role !== 'owner' && role !== 'admin')) {
      throw forbidden('Only owner/admin can perform this action')
    }
  }

  /**
   * Helper: Format team data
   */
  private formatTeam(team: any): Team {
    return {
      id: team.id,
      owner_id: team.owner_id,
      name: team.name,
      created_at: team.created_at,
      updated_at: team.updated_at
    }
  }
}

export const teamService = new TeamService()
```

#### 2. **team.controller.ts** (100 lines)
**Location:** `server/src/modules/team/team.controller.ts`

```typescript
import { Request, Response } from 'express'
import { teamService } from './team.service'
import { validate, createTeamSchema, updateTeamSchema } from '../../utils/validators'
import { unauthorized } from '../../utils/errors'
import { logger } from '../../utils/logger'

export class TeamController {
  async createTeam(req: Request, res: Response): Promise<void> {
    if (!req.userId) throw unauthorized('User not authenticated')

    const input = validate(req.body, createTeamSchema)
    const result = await teamService.createTeam(req.userId, input)

    logger.info('Team created', {
      teamId: result.team.id,
      userId: req.userId,
      name: result.team.name
    })

    res.status(201).json(result)
  }

  async getUserTeams(req: Request, res: Response): Promise<void> {
    if (!req.userId) throw unauthorized('User not authenticated')

    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

    const result = await teamService.fetchUserTeams(req.userId, { page, limit })
    res.json(result)
  }

  async getTeam(req: Request, res: Response): Promise<void> {
    if (!req.userId) throw unauthorized('User not authenticated')

    const { teamId } = req.params
    const team = await teamService.fetchTeam(teamId, req.userId)

    const memberCount = await this.getTeamMemberCount(teamId)

    res.json({
      team,
      memberCount
    })
  }

  async updateTeam(req: Request, res: Response): Promise<void> {
    if (!req.userId) throw unauthorized('User not authenticated')

    const { teamId } = req.params
    const input = validate(req.body, updateTeamSchema)
    const team = await teamService.updateTeam(teamId, req.userId, input)

    logger.info('Team updated', { teamId, userId: req.userId })
    res.json(team)
  }

  async deleteTeam(req: Request, res: Response): Promise<void> {
    if (!req.userId) throw unauthorized('User not authenticated')

    const { teamId } = req.params
    await teamService.deleteTeam(teamId, req.userId)

    logger.info('Team deleted', { teamId, userId: req.userId })
    res.status(204).send()
  }

  async getTeamMembers(req: Request, res: Response): Promise<void> {
    if (!req.userId) throw unauthorized('User not authenticated')

    const { teamId } = req.params
    const page = parseInt(req.query.page as string) || 1
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100)

    const result = await teamService.getTeamMembers(teamId, req.userId, { page, limit })
    res.json(result)
  }

  async updateMemberRole(req: Request, res: Response): Promise<void> {
    if (!req.userId) throw unauthorized('User not authenticated')

    const { teamId, userId } = req.params
    const { role } = validate(req.body, updateMemberSchema)

    const member = await teamService.updateMemberRole(teamId, req.userId, userId, role, req.userId)

    logger.info('Member role updated', { teamId, userId, role })
    res.json(member)
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    if (!req.userId) throw unauthorized('User not authenticated')

    const { teamId, userId } = req.params
    await teamService.removeMember(teamId, userId, req.userId)

    logger.info('Member removed', { teamId, userId })
    res.status(204).send()
  }

  private async getTeamMemberCount(teamId: string): Promise<number> {
    const db = require('../../config/database').getDatabase()
    const [{ count }] = await db('team_members')
      .where('team_id', teamId)
      .count('* as count')
    return parseInt(count)
  }
}

export const teamController = new TeamController()
```

#### 3. **Update team.routes.ts** (80 lines)
**Location:** `server/src/modules/team/team.routes.ts`

Replace the placeholder routes with:

```typescript
import { Router } from 'express'
import { teamController } from './team.controller'
import { asyncHandler } from '../../utils/async-handler'

const router = Router()

// Team CRUD
router.post('/', asyncHandler(teamController.createTeam.bind(teamController)))
router.get('/', asyncHandler(teamController.getUserTeams.bind(teamController)))
router.get('/:teamId', asyncHandler(teamController.getTeam.bind(teamController)))
router.put('/:teamId', asyncHandler(teamController.updateTeam.bind(teamController)))
router.delete('/:teamId', asyncHandler(teamController.deleteTeam.bind(teamController)))

// Members
router.get('/:teamId/members', asyncHandler(teamController.getTeamMembers.bind(teamController)))
router.put('/:teamId/members/:userId', asyncHandler(teamController.updateMemberRole.bind(teamController)))
router.delete('/:teamId/members/:userId', asyncHandler(teamController.removeMember.bind(teamController)))

// Invites, shared profiles, audit log (Phase 2.3+)
router.post('/:teamId/invites', asyncHandler((req, res) => {
  res.status(501).json({ error: 'not_implemented', message: 'Coming in Phase 2.3' })
}))

export default router
```

#### 4. **Update validators.ts** (Add schemas)
**Location:** `server/src/utils/validators.ts`

Add these schemas:

```typescript
export const createTeamSchema = Joi.object({
  name: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).optional(),
  maxMembers: Joi.number().integer().min(1).optional()
})

export const updateTeamSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional(),
  description: Joi.string().max(1000).optional(),
  maxMembers: Joi.number().integer().min(1).optional()
})

export const updateMemberSchema = Joi.object({
  role: Joi.string().valid('owner', 'admin', 'member').required()
})
```

### Sprint 1 Testing

Create `tests/integration/team.integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { teamService } from '../../../src/modules/team/team.service'
import { authService } from '../../../src/modules/auth/auth.service'
import { getDatabase } from '../../../src/config/database'

describe('Team Service', () => {
  let testUserId: string
  let testTeamId: string

  beforeAll(async () => {
    // Create test user
    const result = await authService.register({
      email: `team-test-${Date.now()}@example.com`,
      password: 'TestPassword123'
    })
    testUserId = result.user.id
  })

  describe('Team CRUD', () => {
    it('should create a team', async () => {
      const result = await teamService.createTeam(testUserId, {
        name: 'Test Team'
      })

      expect(result.team.id).toBeDefined()
      expect(result.team.name).toBe('Test Team')
      expect(result.member.role).toBe('owner')
      testTeamId = result.team.id
    })

    it('should fetch team', async () => {
      const team = await teamService.fetchTeam(testTeamId, testUserId)
      expect(team?.id).toBe(testTeamId)
    })

    it('should update team', async () => {
      const updated = await teamService.updateTeam(testTeamId, testUserId, {
        name: 'Updated Team Name'
      })
      expect(updated.name).toBe('Updated Team Name')
    })

    it('should delete team', async () => {
      await teamService.deleteTeam(testTeamId, testUserId)
      const team = await teamService.fetchTeam(testTeamId, testUserId)
      expect(team).toBeNull()
    })
  })

  describe('Member Management', () => {
    let teamId: string
    let memberId: string

    beforeAll(async () => {
      const result = await teamService.createTeam(testUserId, {
        name: 'Member Test Team'
      })
      teamId = result.team.id

      // Create second user
      const result2 = await authService.register({
        email: `member-test-${Date.now()}@example.com`,
        password: 'TestPassword123'
      })
      memberId = result2.user.id
    })

    it('should add member to team', async () => {
      const member = await teamService.addMember(teamId, testUserId, memberId, 'member', testUserId)
      expect(member.role).toBe('member')
    })

    it('should update member role', async () => {
      const member = await teamService.updateMemberRole(teamId, testUserId, memberId, 'admin', testUserId)
      expect(member.role).toBe('admin')
    })

    it('should remove member', async () => {
      await teamService.removeMember(teamId, memberId, testUserId)
      const members = await teamService.getTeamMembers(teamId, testUserId, { page: 1, limit: 10 })
      expect(members.total).toBe(1) // Only owner left
    })
  })

  afterAll(async () => {
    const db = getDatabase()
    await db('users').where('id', testUserId).delete()
  })
})
```

### Sprint 1 Checklist
- [ ] Implement team.service.ts (150 lines)
- [ ] Implement team.controller.ts (100 lines)
- [ ] Update team.routes.ts with real endpoints
- [ ] Add validation schemas
- [ ] Write integration tests (150+ lines)
- [ ] Run tests and ensure all pass
- [ ] Test endpoints with Postman/cURL
- [ ] Code review before merging

---

## Sprint 2: Invitations & Shared Profiles (Weeks 3-4)

**Depends on:** Sprint 1 completion

### Sprint 2 Files
- `team-invites.service.ts` (200 lines)
- `shared-profiles.service.ts` (150 lines)
- Migration `006_shared_profiles.ts`
- Tests and updated routes

*(Detailed implementation will follow similar pattern as Sprint 1)*

---

## Sprint 3: Audit Logging (Week 4-5)

**Depends on:** Sprint 1-2 completion

### Sprint 3 Files
- `audit.service.ts` (150 lines)
- `audit.middleware.ts` (100 lines)
- Tests

---

## Key Testing Strategy

### Unit Tests
- Service layer methods: 1 test per function
- Error scenarios: permission denied, not found, etc.
- Validation: invalid inputs

### Integration Tests
- Full workflows (create → add member → update role → remove)
- Transaction rollback on error
- Concurrent operations

### API Tests
- Status codes (201, 200, 204, 403, 404)
- Response format validation
- Authorization checks

---

## Success Criteria

✅ All 12 team endpoints working  
✅ 90%+ test coverage  
✅ No SQL injection vulnerabilities  
✅ Proper error handling  
✅ API documentation updated  
✅ Code review approved  

---

## Common Pitfalls to Avoid

1. **Forgetting transactions** — Always use DB transactions for multi-step operations
2. **Missing permission checks** — Verify user is owner/admin for all mutations
3. **N+1 queries** — Use joins instead of multiple queries
4. **Incomplete error handling** — Handle all user input validation
5. **Missing indexes** — Queries on team_id need indexes

---

## Next: Phase 2.3 (Invitations)

Once Sprint 1 is complete and merged, proceed with Sprint 2 using the same patterns.

---

**Ready to implement?** Start with Sprint 1 and follow the checklist above. Ask questions about:
- Database transaction syntax
- TypeScript types
- Error handling patterns
- Test fixtures

Good luck! 🚀
