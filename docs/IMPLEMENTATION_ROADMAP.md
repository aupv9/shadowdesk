# Ghost Browser Server - Implementation Roadmap

**Current Date:** April 2026  
**Current Status:** Phase 1 (MVP) ✅ Complete  
**Next Phase:** Phase 2 (Team Features)

---

## Executive Summary

This document outlines the detailed implementation plan for Ghost Browser Server's remaining features across 4 phases (Phase 2-5). The plan is organized by dependencies, with each phase building on the previous one.

**Total Estimated Effort:** ~20-24 weeks  
**Team Size:** 2-3 developers  
**Sprint Duration:** 2-week sprints

---

## Phase 2: Team Collaboration Features

**Duration:** 4-5 weeks  
**Priority:** CRITICAL - Required for team functionality  
**Dependencies:** Phase 1 (Auth, License, Sync) ✅

### Overview
Complete team management system including CRUD operations, member management, invitations, and shared profiles.

### 2.1 Database Migrations

**File:** `server/src/database/migrations/002_team_features.ts`

```sql
-- Already designed, no new migrations needed
-- All tables in initial schema:
- teams
- team_members
- team_invites
- audit_log (for team actions)
```

**Effort:** 0 files (schema already in place)

### 2.2 Team Module Implementation

#### **Files to Create:** 5 new files

**1. `server/src/modules/team/team.service.ts` (250 lines)**
- `createTeam(userId, name)` → Create team & add owner
- `getTeam(teamId, userId)` → Fetch team with validation
- `updateTeamName(teamId, userId, name)` → Update team
- `deleteTeam(teamId, userId)` → Soft delete team & remove members
- `getTeamMembers(teamId)` → List all members
- `addTeamMember(teamId, userId, role)` → Add/invite member
- `updateMemberRole(teamId, userId, role)` → Change member role
- `removeMember(teamId, userId)` → Remove member from team
- Error handling: Only owner can delete/manage team

**2. `server/src/modules/team/team.controller.ts` (200 lines)**
- `createTeam()` — POST /team
- `getTeam()` — GET /team
- `updateTeamName()` — PUT /team
- `deleteTeam()` — DELETE /team
- `listMembers()` — GET /team/members
- `updateMember()` — PUT /team/members/:userId
- `removeMember()` — DELETE /team/members/:userId
- Input validation using Joi schemas
- User authentication checks

**3. `server/src/modules/team/invites.service.ts` (150 lines)**
- `sendInvite(teamId, invitedBy, email, role)` → Create invite token
- `getInvites(teamId)` → List pending invites
- `cancelInvite(inviteId, teamId)` → Delete invite
- `acceptInvite(inviteId, userId)` → Accept & add to team
- Invite token generation (random 32 chars)
- Expiry validation (7-day default)
- Email notification trigger

**4. `server/src/modules/team/shared-profiles.service.ts` (150 lines)**
- `shareProfile(profileId, teamId, memberIds, permission)` → Share profile
- `getSharedProfiles(userId)` → List profiles shared with user
- `unshareProfile(profileId, memberId)` → Revoke access
- Permissions: 'read' (view only) | 'write' (edit)
- Store sharing in sync with cloud sync bundles

**5. `server/src/modules/team/audit.service.ts` (100 lines)**
- `logAction(teamId, userId, action, resourceType, resourceId, changes)` → Log event
- `getAuditLog(teamId, filters)` → Query by date, user, action
- Immutable audit trail (no delete/edit)
- Pagination support

#### Files to Modify: 3 files

**1. `server/src/modules/team/team.routes.ts` (80 lines)**
- Replace placeholder routes with actual implementations
- All 15+ endpoints wired up
- Middleware for team ownership verification

**2. `server/src/utils/validators.ts`** (50 lines added)
- `createTeamSchema` — name required, 1-255 chars
- `updateMemberSchema` — role validation (owner/admin/member)
- `inviteMemberSchema` — email + role
- `shareProfileSchema` — profile_id + member_ids + permission

**3. `server/src/app.ts`** (5 lines updated)
- Import audit service for logging middleware
- Initialize audit logging on team actions

### 2.3 API Endpoints (15 endpoints)

#### Team CRUD (4)
```
POST   /team                      — Create team
GET    /team                      — Get current team
PUT    /team                      — Update team name
DELETE /team                      — Delete team
```

#### Members (3)
```
GET    /team/members              — List members
PUT    /team/members/:userId      — Update role
DELETE /team/members/:userId      — Remove member
```

#### Invitations (4)
```
POST   /team/invites              — Send invite
GET    /team/invites              — List pending invites
DELETE /team/invites/:inviteId    — Cancel invite
POST   /team/invites/:inviteId/accept — Accept invite (token-based)
```

#### Shared Profiles (3)
```
POST   /team/profiles/share       — Share profile with members
GET    /team/profiles/shared      — List shared profiles
DELETE /team/profiles/share       — Unshare profile
```

#### Audit Log (1)
```
GET    /team/audit                — List team audit log
```

### 2.4 Testing Strategy

**Unit Tests:** `tests/unit/team/`
- Team creation & validation
- Member role updates
- Invite token generation
- Audit logging

**Integration Tests:** `tests/integration/team/`
- Full team creation workflow
- Member invitation flow
- Shared profile access control
- Audit trail verification

**Test Coverage:** Target 90%

### 2.5 Implementation Checklist

- [ ] Create team.service.ts with all team operations
- [ ] Create invites.service.ts with invite flow
- [ ] Create shared-profiles.service.ts
- [ ] Create audit.service.ts
- [ ] Create team.controller.ts with all endpoints
- [ ] Update team.routes.ts with real implementations
- [ ] Add validation schemas for all team operations
- [ ] Write unit tests (40+ test cases)
- [ ] Write integration tests (20+ scenarios)
- [ ] Update API.md with team endpoints
- [ ] Load testing (100 concurrent team operations)

### 2.6 Estimated Effort

| Component | Files | Lines | Hours |
|-----------|-------|-------|-------|
| Services | 4 | ~600 | 12 |
| Controllers | 1 | ~200 | 4 |
| Routes | 1 | ~80 | 2 |
| Validation | 1 | ~50 | 1 |
| Tests | 4 | ~800 | 16 |
| Documentation | 1 | ~200 | 2 |
| **Total** | **12** | **~1,930** | **37 hours** |

---

## Phase 3: Email & Communication

**Duration:** 3-4 weeks  
**Priority:** HIGH - Required for user engagement  
**Dependencies:** Phase 2 (Team) ✅

### Overview
Email service integration, verification flows, password reset, and compliance notifications.

### 3.1 Email Service Setup

#### Files to Create: 3 files

**1. `server/src/services/email.service.ts` (200 lines)**
```typescript
- initializeEmailClient() — Setup SendGrid/SMTP
- sendVerificationEmail(email, token)
- sendInvitationEmail(email, teamName, inviteLink)
- sendPasswordResetEmail(email, resetToken)
- sendLicenseExpiryEmail(email, daysLeft)
- Template management (HTML + plain text)
```

**2. `server/src/services/templates/email-templates.ts` (300 lines)**
- Verification email HTML template
- Invitation email template
- Password reset template
- License expiry warning template
- Styled responsive templates (mjml format)

**3. `server/src/config/email.ts` (50 lines)**
- Email provider configuration
- Template path resolution
- Rate limiting per recipient

### 3.2 Authentication Flow Updates

#### Files to Modify: 2 files

**1. `server/src/modules/auth/auth.controller.ts`** (100 lines added)
- `verifyEmail(token)` — POST /auth/verify-email/:token
- `requestPasswordReset(email)` — POST /auth/forgot-password
- `resetPassword(token, newPassword)` — POST /auth/reset-password/:token
- Rate limiting: 3 reset requests per hour per email

**2. `server/src/modules/auth/auth.routes.ts`** (30 lines added)
- Add 3 new routes for email verification & password reset
- Token validation middleware

### 3.3 Database Migration

**File:** `server/src/database/migrations/003_email_verification.ts`

```sql
ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(64);
ALTER TABLE users ADD COLUMN email_verification_expires_at TIMESTAMP;
ALTER TABLE users ADD COLUMN password_reset_token VARCHAR(64);
ALTER TABLE users ADD COLUMN password_reset_expires_at TIMESTAMP;

CREATE INDEX idx_email_verification_token ON users(email_verification_token);
CREATE INDEX idx_password_reset_token ON users(password_reset_token);
```

### 3.4 New API Endpoints (3)

```
POST   /auth/verify-email/:token          — Verify email with token
POST   /auth/forgot-password              — Request password reset
POST   /auth/reset-password/:token        — Reset password with token
```

### 3.5 Implementation Checklist

- [ ] Integrate SendGrid or SMTP provider
- [ ] Create email service with templating
- [ ] Implement email verification flow
- [ ] Implement password reset flow
- [ ] Create email templates (HTML & responsive)
- [ ] Add token generation & validation
- [ ] Write tests for email flows
- [ ] Set up email rate limiting
- [ ] Update API documentation

### 3.6 Estimated Effort

| Component | Files | Lines | Hours |
|-----------|-------|-------|-------|
| Email Service | 3 | ~550 | 10 |
| Auth Updates | 2 | ~130 | 4 |
| Migrations | 1 | ~15 | 1 |
| Templates | 1 | ~300 | 6 |
| Tests | 3 | ~400 | 8 |
| **Total** | **10** | **~1,395** | **29 hours** |

---

## Phase 4: Advanced Features

**Duration:** 5-6 weeks  
**Priority:** MEDIUM - Enhance security & functionality  
**Dependencies:** Phase 3 (Email) ✅

### 4.1 Rate Limiting (Redis-backed)

**Files to Create:** 2

**1. `server/src/middleware/rate-limit.ts` (150 lines)**
- Per-IP rate limiting
- Per-user rate limiting
- Per-endpoint rate limiting
- Sliding window algorithm

**2. `server/src/services/rate-limiter.service.ts` (100 lines)**
- Redis integration
- Key generation strategies
- Whitelist management

**Implementation:**
```typescript
// Apply to endpoints
app.use('/auth/login', rateLimitMiddleware(5, '15m')); // 5 attempts per 15 min
app.use('/auth/register', rateLimitMiddleware(3, '1h')); // 3 registrations per hour
app.use('/profiles/sync', rateLimitMiddleware(10, '1h')); // 10 syncs per hour
```

### 4.2 Two-Factor Authentication (TOTP)

**Files to Create:** 4

**1. `server/src/services/2fa.service.ts` (150 lines)**
- Generate TOTP secret (using speakeasy)
- Verify TOTP code
- Backup codes generation
- 2FA enable/disable

**2. `server/src/modules/auth/2fa.routes.ts` (100 lines)**
- Setup 2FA endpoints
- Verification endpoints

**3. Database Migration:** `004_2fa_support.ts`
```sql
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255);
ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN totp_backup_codes TEXT[]; -- Array of codes
```

### 4.3 OAuth/SSO Integration

**Files to Create:** 3

**1. `server/src/services/oauth.service.ts` (200 lines)**
- Google OAuth strategy
- GitHub OAuth strategy
- Token exchange & user creation

**2. `server/src/modules/auth/oauth.routes.ts` (100 lines)**
- `/auth/oauth/google/callback`
- `/auth/oauth/github/callback`

### 4.4 Webhook Events

**Files to Create:** 3

**1. `server/src/services/webhooks.service.ts` (150 lines)**
- Register webhook
- Trigger webhook
- Retry logic with exponential backoff

**2. Database Migration:** `005_webhooks.ts`
```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type VARCHAR(64),
  url VARCHAR(2048),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP
);

CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY,
  webhook_id UUID NOT NULL,
  event_type VARCHAR(64),
  payload JSONB,
  status_code INT,
  created_at TIMESTAMP
);
```

### 4.5 Usage Analytics

**Files to Create:** 2

**1. `server/src/services/analytics.service.ts` (150 lines)**
- Track profile creation
- Track sync frequency
- Track team activity
- Store in TimescaleDB or influxDB

**Database Migration:** `006_analytics.ts`
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  user_id UUID,
  event_type VARCHAR(64),
  event_data JSONB,
  created_at TIMESTAMP
);
CREATE INDEX idx_events_user_created ON events(user_id, created_at);
```

### 4.6 Estimated Effort

| Feature | Files | Hours |
|---------|-------|-------|
| Rate Limiting | 2 | 6 |
| 2FA (TOTP) | 4 | 10 |
| OAuth/SSO | 3 | 12 |
| Webhooks | 3 | 8 |
| Analytics | 2 | 6 |
| Tests | 5 | 20 |
| **Total** | **19** | **62 hours** |

---

## Phase 5: Production Readiness

**Duration:** 4-5 weeks  
**Priority:** HIGH - Required for production launch  
**Dependencies:** Phase 4 (Advanced) ✅

### 5.1 Stripe Integration

**Files to Create:** 4

**1. `server/src/services/stripe.service.ts` (250 lines)**
- Create customer
- Create subscription
- Handle webhooks
- Plan management

**2. `server/src/modules/billing/billing.routes.ts` (100 lines)**
- `/billing/plans`
- `/billing/subscribe`
- `/billing/cancel`
- `/billing/invoice/:id`

**3. Database Migration:** `007_billing.ts`
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  plan VARCHAR(64),
  status ENUM('active', 'cancelled', 'past_due'),
  current_period_end TIMESTAMP,
  created_at TIMESTAMP
);
```

### 5.2 Error Tracking (Sentry)

**Files to Create:** 1

**1. `server/src/config/sentry.ts` (50 lines)**
- Initialize Sentry
- Configure error reporting
- Set environment & release

**Integration in `server.ts`:**
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: env.SENTRY_DSN,
  environment: env.NODE_ENV,
  tracesSampleRate: 0.1
});
```

### 5.3 Metrics & Monitoring (Prometheus)

**Files to Create:** 2

**1. `server/src/middleware/metrics.ts` (150 lines)**
- Request duration histograms
- Request count by endpoint
- Error rate by endpoint
- Database connection pool metrics

**2. `server/src/config/prometheus.ts` (50 lines)**
- Metrics registry
- Custom metrics initialization

**Endpoint:** `GET /metrics` — Returns Prometheus format

### 5.4 Database Optimization

**Effort:** 6-8 hours

**Tasks:**
- [ ] Add missing indexes
- [ ] Analyze slow queries (pg_stat_statements)
- [ ] Configure connection pooling (max 20 connections)
- [ ] Set up replication for HA
- [ ] Configure automated VACUUM

### 5.5 Comprehensive Test Suite

**Files to Create:** 8-10

**Unit Tests** (300+ test cases)
```
tests/unit/
├── auth/
├── license/
├── team/
├── sync/
└── services/
```

**Integration Tests** (150+ scenarios)
```
tests/integration/
├── auth-flow.test.ts
├── team-workflow.test.ts
├── billing-flow.test.ts
└── email-notifications.test.ts
```

**E2E Tests** (50+ scenarios)
```
tests/e2e/
├── full-signup-flow.test.ts
├── team-creation-workflow.test.ts
└── license-activation-flow.test.ts
```

**Performance Tests**
```
tests/performance/
├── sync-bundle-large-payload.test.ts
├── concurrent-auth-requests.test.ts
└── database-query-performance.test.ts
```

**Test Coverage Target:** 85%+

### 5.6 Documentation Updates

**Files to Update/Create:** 5
- API.md — Complete with all endpoints
- DEPLOYMENT.md — Production checklist
- MONITORING.md — Metrics & alerts
- TROUBLESHOOTING.md — Common issues
- SECURITY.md — Security best practices

### 5.7 Estimated Effort

| Component | Files | Hours |
|-----------|-------|-------|
| Stripe Integration | 4 | 12 |
| Sentry Setup | 1 | 2 |
| Prometheus Metrics | 2 | 6 |
| DB Optimization | 1 | 8 |
| Test Suite | 10 | 40 |
| Documentation | 5 | 10 |
| Code Review & QA | - | 15 |
| **Total** | **23** | **93 hours** |

---

## Cross-Phase Tasks

### Dependency Graph

```
Phase 1: Auth, License, Sync ✅
    ↓
Phase 2: Team Features
    ├→ Needs: User context, Role verification
    ↓
Phase 3: Email & Communication
    ├→ Needs: Team invitations, User notifications
    ↓
Phase 4: Advanced Features
    ├→ Rate limiting (global, all phases)
    ├→ 2FA (auth enhancement)
    ├→ OAuth (auth alternative)
    ├→ Webhooks (event system)
    ↓
Phase 5: Production Ready
    ├→ Billing (subscription mgmt)
    ├→ Monitoring (all phases)
    ├→ Testing (all phases)
```

### Shared Utilities to Enhance

**1. `server/src/utils/validators.ts`**
- Add schemas for each phase (+100 lines total)

**2. `server/src/utils/errors.ts`**
- Add error types as needed (+30 lines)

**3. Middleware**
- Rate limiting middleware (Phase 4)
- Audit logging middleware (Phase 2)
- Error tracking middleware (Phase 5)

---

## Development Timeline

### Realistic Sprint Schedule (2-week sprints)

| Sprint | Phase | Focus | Hours/Sprint | Team |
|--------|-------|-------|--------------|------|
| 1-2 | Phase 2 | Team CRUD & Members | 40 | 2 devs |
| 3 | Phase 2 | Invites & Shared Profiles | 40 | 2 devs |
| 4 | Phase 3 | Email Service | 30 | 1 dev |
| 5 | Phase 3 | Auth Flows & Templates | 30 | 1 dev |
| 6 | Phase 4 | Rate Limiting & 2FA | 35 | 2 devs |
| 7 | Phase 4 | OAuth & Webhooks | 35 | 2 devs |
| 8 | Phase 4 | Analytics | 20 | 1 dev |
| 9 | Phase 5 | Stripe Integration | 30 | 1 dev |
| 10 | Phase 5 | Monitoring & Metrics | 25 | 1 dev |
| 11 | Phase 5 | Test Suite | 40 | 2 devs |
| 12 | Phase 5 | QA & Documentation | 25 | 2 devs |

**Total:** ~320 hours = ~8 weeks for 2-person team or ~16 weeks for 1-person

---

## Critical Success Factors

### Code Quality
- **Maintain** 85%+ test coverage
- **Code review** all pull requests (2 approvals for Phase 2+)
- **Lint & type check** on every commit

### Security
- **Secrets management** — Use environment variables, never commit secrets
- **SQL injection prevention** — Parameterized queries everywhere
- **CORS configuration** — Whitelist Electron app origins
- **Rate limiting** — Protect auth endpoints
- **Password security** — bcrypt 12 rounds minimum

### Performance
- **Database indexes** — Add after schema changes
- **Query optimization** — Use EXPLAIN ANALYZE
- **Connection pooling** — Max 20 connections
- **Response time target** — p95 < 500ms, p99 < 1s

### Reliability
- **Graceful error handling** — No 500 errors for user input
- **Logging** — Structured JSON with request IDs
- **Health checks** — /health/live and /health/ready
- **Data backup** — Daily automated backups

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Team feature complexity | High | High | Start with CRUD, add complexity incrementally |
| Email deliverability | Medium | High | Use SendGrid (99.9% uptime), monitor bounces |
| Database performance | Medium | High | Implement caching, optimize queries, monitor |
| OAuth provider outages | Low | Medium | Implement fallback to email/password |
| Stripe integration issues | Low | High | Thorough webhook testing, retry logic |
| Test flakiness | Medium | Medium | Isolate tests, use transactions, mock APIs |

---

## Definition of Done

Each phase is complete when:

1. ✅ All features implemented and code reviewed
2. ✅ Unit tests pass (90%+ coverage)
3. ✅ Integration tests pass (all workflows)
4. ✅ No security vulnerabilities found
5. ✅ Performance benchmarks met
6. ✅ API documentation updated
7. ✅ Deployment tested on staging
8. ✅ Team sign-off on feature completeness

---

## Next Steps (After This Planning)

### Immediate (Week 1)
1. [ ] Team estimates review with engineering team
2. [ ] Sprint 1 planning (Team CRUD implementation)
3. [ ] Set up CI/CD pipeline for automated testing
4. [ ] Create branch protection rules for main/production

### Week 1-2
1. [ ] Implement Phase 2 (Team Features)
2. [ ] Write comprehensive tests
3. [ ] Deploy to staging environment
4. [ ] Security review of team module

### Week 3-4
1. [ ] Complete Phase 2 (Shared Profiles, Audit)
2. [ ] Start Phase 3 (Email Service)
3. [ ] Gather feedback from product team

---

## Appendix: File Structure Summary

```
server/src/
├── modules/
│   ├── team/
│   │   ├── team.service.ts (NEW)
│   │   ├── team.controller.ts (NEW)
│   │   ├── invites.service.ts (NEW)
│   │   ├── shared-profiles.service.ts (NEW)
│   │   ├── audit.service.ts (NEW)
│   │   └── team.routes.ts (UPDATED)
│   ├── auth/
│   │   ├── 2fa.routes.ts (NEW - Phase 4)
│   │   ├── oauth.routes.ts (NEW - Phase 4)
│   │   └── auth.controller.ts (UPDATED)
│   └── billing/
│       └── billing.routes.ts (NEW - Phase 5)
├── services/
│   ├── email.service.ts (NEW - Phase 3)
│   ├── rate-limiter.service.ts (NEW - Phase 4)
│   ├── 2fa.service.ts (NEW - Phase 4)
│   ├── oauth.service.ts (NEW - Phase 4)
│   ├── webhooks.service.ts (NEW - Phase 4)
│   ├── analytics.service.ts (NEW - Phase 4)
│   ├── stripe.service.ts (NEW - Phase 5)
│   └── templates/
│       └── email-templates.ts (NEW - Phase 3)
├── middleware/
│   ├── rate-limit.ts (NEW - Phase 4)
│   └── metrics.ts (NEW - Phase 5)
├── database/migrations/
│   ├── 002_team_features.ts (Phase 2)
│   ├── 003_email_verification.ts (Phase 3)
│   ├── 004_2fa_support.ts (Phase 4)
│   ├── 005_webhooks.ts (Phase 4)
│   ├── 006_analytics.ts (Phase 4)
│   └── 007_billing.ts (Phase 5)
└── config/
    ├── email.ts (NEW - Phase 3)
    ├── sentry.ts (NEW - Phase 5)
    └── prometheus.ts (NEW - Phase 5)

tests/
├── unit/
│   ├── team/ (NEW - Phase 2)
│   ├── email/ (NEW - Phase 3)
│   └── 2fa/ (NEW - Phase 4)
├── integration/
│   ├── team-workflow.test.ts (NEW - Phase 2)
│   ├── email-flow.test.ts (NEW - Phase 3)
│   └── billing-flow.test.ts (NEW - Phase 5)
└── e2e/
    ├── team-creation.test.ts (NEW - Phase 2)
    └── full-signup.test.ts (NEW - Phase 3)
```

---

## Document Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Apr 2026 | Claude | Initial implementation roadmap |

---

**Last Updated:** April 10, 2026  
**Status:** Ready for Development Planning  
**Owner:** Engineering Team
