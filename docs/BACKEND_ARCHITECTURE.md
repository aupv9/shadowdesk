# ShadowDesk Backend Common Core — Architecture Document

> Version: 1.0.0 | Date: 2026-04-08 | Status: Draft → Implementation

---

## 1. Executive Summary

**ShadowDesk Backend Core** là centralized API layer phục vụ toàn bộ ecosystem:

| App | Status | Uses Core For |
|-----|--------|---------------|
| ShadowDesk Desktop | Production | Auth, License, Team, Sync, Webhook |
| ShadowProxy | Planned | Auth, License, Proxy Pools |
| ShadowFlow | Planned | Auth, License, Workflow Marketplace |
| ShadowMonitor | Planned | Auth, License, Webhooks |
| ShadowContent | Planned | Auth, License, Content Pipeline |
| ShadowData | Planned | Auth, License, Data API |

**Design Principles:**
- **API-First**: REST JSON API, versioned (`/v1/`), OpenAPI documented
- **Modular Monolith**: Single deployable, cleanly separated modules → split to microservices khi cần
- **Zero-Knowledge Sync**: Backend lưu ciphertext only, không bao giờ thấy plaintext profile data
- **Multi-tenant RBAC**: Team workspace isolation, role-based permissions
- **Local-First Client**: Desktop app có SQLite local, backend chỉ là sync + auth + license layer

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ECOSYSTEM CLIENTS                            │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  ShadowDesk  │  │ ShadowProxy  │  │ ShadowFlow / others  │  │
│  │  Desktop     │  │  Web App     │  │  Web Apps            │  │
│  │  (Electron)  │  │  (Next.js)   │  │  (Next.js)           │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
└─────────┼─────────────────┼───────────────────────┼────────────┘
          │                 │                       │
          └─────────────────┴───────────────────────┘
                            │ HTTPS / REST + JSON
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                 API GATEWAY  (Fastify + Rate Limit)             │
│                  https://api.shadowdesk.io/v1                   │
├─────────────────────────────────────────────────────────────────┤
│                         MODULES                                 │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │   auth   │  │ license  │  │   team   │  │     sync      │  │
│  │          │  │          │  │          │  │  (E2E encrypted│  │
│  │ login    │  │ activate │  │  CRUD    │  │   bundles)    │  │
│  │ register │  │ validate │  │ members  │  │               │  │
│  │ refresh  │  │ devices  │  │ invites  │  │               │  │
│  └──────────┘  └──────────┘  │ audit   │  └───────────────┘  │
│                              └──────────┘                       │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────────────────┐ │
│  │ webhook  │  │  proxy   │  │     marketplace (future)      │ │
│  │          │  │  pools   │  │     workflow templates        │ │
│  │ configs  │  │ (Shadow  │  │                               │ │
│  │ delivery │  │  Proxy)  │  │                               │ │
│  └──────────┘  └──────────┘  └───────────────────────────────┘ │
├─────────────────────────────────────────────────────────────────┤
│               SHARED INFRASTRUCTURE                             │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────────┐  │
│  │  PostgreSQL  │  │    Redis     │  │   Object Storage    │  │
│  │  (Supabase)  │  │  (BullMQ +   │  │  (Supabase Storage) │  │
│  │              │  │   Cache)     │  │  sync bundles       │  │
│  └──────────────┘  └──────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Tech Stack

### 3.1 Decisions Table

| Layer | Choice | Alternatives | Rationale |
|-------|--------|-------------|-----------|
| Runtime | Node.js 20 LTS | Bun, Deno | Ecosystem maturity, TypeScript native, team familiarity |
| Framework | Fastify 4 | Express, Hono | 3x faster than Express, built-in TypeScript, schema validation |
| Language | TypeScript 5 | JavaScript | Type safety shared với ShadowDesk desktop |
| ORM | Drizzle ORM | Prisma, Kysely | Lightweight (no proxy process), type-safe, SQL-first, fast migrations |
| Database | PostgreSQL 15 (Supabase) | MySQL, MongoDB | ACID, JSONB support, Row-Level Security, Supabase MCP available |
| Cache/Queue | Redis + BullMQ | RabbitMQ, SQS | Simple setup, BullMQ cho webhook delivery + health checks |
| Auth tokens | jose (JWT) | jsonwebtoken | RFC 7519 compliant, no known CVEs, Web Crypto API |
| Password hash | Argon2id | bcrypt, scrypt | OWASP recommended 2024, memory-hard, phishing resistant |
| Schema validation | Zod | Joi, Yup | TypeScript-first, composable, runtime + compile time |
| Object Storage | Supabase Storage | S3, R2 | Same provider as DB, simple SDK |
| Monitoring | Pino + OpenTelemetry | Winston | Built into Fastify, structured JSON logs |
| Deploy | Docker + Railway | Fly.io, Render | Simple PaaS, auto SSL, env management |
| API Docs | Scalar + OpenAPI 3.1 | Swagger | Modern UI, type generated từ Zod schemas |

### 3.2 Dependency Graph

```
backend/
├── Core
│   ├── fastify ^4.x            # HTTP server
│   ├── @fastify/cors            # CORS
│   ├── @fastify/rate-limit      # Rate limiting
│   ├── @fastify/helmet          # Security headers
│   └── @fastify/swagger         # OpenAPI generation
│
├── Database
│   ├── drizzle-orm ^0.30        # ORM
│   ├── drizzle-kit              # Migration CLI
│   └── pg                      # PostgreSQL driver
│
├── Auth & Security
│   ├── jose ^5.x                # JWT (sign, verify, refresh)
│   ├── argon2                   # Password hashing
│   └── @fastify/rate-limit      # Brute force protection
│
├── Queue
│   ├── bullmq ^5.x              # Job queues
│   └── ioredis                  # Redis client
│
├── Validation
│   └── zod ^3.x                 # Schema validation
│
└── Utilities
    ├── nanoid                   # ID generation
    ├── dayjs                    # Date manipulation
    └── pino                     # Logging
```

---

## 4. Project Structure

```
backend/
├── src/
│   ├── server.ts                    # Entry point — starts HTTP server
│   ├── app.ts                       # Fastify app factory (testable)
│   ├── config.ts                    # Typed env config via Zod
│   │
│   ├── db/
│   │   ├── client.ts                # Drizzle singleton
│   │   ├── schema.ts                # ALL table definitions
│   │   └── migrations/              # Drizzle auto-generated SQL
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── routes.ts            # POST /auth/* handlers
│   │   │   ├── service.ts           # Business logic
│   │   │   └── schema.ts            # Zod request/response schemas
│   │   ├── license/
│   │   │   ├── routes.ts
│   │   │   ├── service.ts
│   │   │   └── schema.ts
│   │   ├── team/
│   │   │   ├── routes.ts
│   │   │   ├── service.ts
│   │   │   └── schema.ts
│   │   ├── sync/
│   │   │   ├── routes.ts
│   │   │   ├── service.ts
│   │   │   └── schema.ts
│   │   └── webhook/
│   │       ├── routes.ts
│   │       ├── service.ts
│   │       ├── schema.ts
│   │       └── queue.ts             # BullMQ delivery queue
│   │
│   └── shared/
│       ├── errors.ts                # AppError hierarchy
│       ├── types.ts                 # Shared TypeScript types
│       ├── crypto.ts                # Token helpers, HMAC, ID gen
│       └── middleware/
│           ├── auth.ts              # JWT preHandler
│           └── rate-limit.ts        # Per-route rate limits
│
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── Dockerfile
├── docker-compose.yml
└── .env.example
```

---

## 5. Database Schema (PostgreSQL)

### 5.1 Entity Relationship

```
users ──┬──< sessions (refresh tokens)
        │
        ├──< licenses
        │     └──< license_devices
        │
        ├── team_members >──── teams
        │                       │
        │                       ├──< team_invites
        │                       └──< shared_profiles
        │
        ├──< sync_bundles
        ├──< sync_logs
        ├──< audit_logs
        └──< webhooks
              └──< webhook_deliveries
```

### 5.2 Table Definitions

#### users
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
email         text UNIQUE NOT NULL
name          text NOT NULL
avatar_url    text
password_hash text NOT NULL
email_verified       boolean DEFAULT false
email_verified_at    timestamptz
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
deleted_at    timestamptz  -- soft delete
```

#### sessions
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
refresh_token text UNIQUE NOT NULL  -- hashed SHA256
user_agent    text
ip_address    text
last_used_at  timestamptz DEFAULT now()
expires_at    timestamptz NOT NULL
created_at    timestamptz DEFAULT now()
```

#### licenses
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
license_key   text UNIQUE NOT NULL
plan          text NOT NULL DEFAULT 'free'  -- free|starter|professional|enterprise
status        text NOT NULL DEFAULT 'active'  -- active|expired|suspended
valid_until   timestamptz
is_trial      boolean DEFAULT false
trial_ends_at timestamptz
seats_max     integer DEFAULT 1
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

#### license_devices
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
license_id    uuid NOT NULL REFERENCES licenses(id) ON DELETE CASCADE
machine_id    text NOT NULL  -- SHA256(MACs + CPU)
label         text
os            text
last_seen_at  timestamptz
activated_at  timestamptz DEFAULT now()
UNIQUE(license_id, machine_id)
```

#### teams
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
name          text NOT NULL
owner_id      uuid NOT NULL REFERENCES users(id)
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

#### team_members
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE
user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
role          text NOT NULL DEFAULT 'viewer'  -- admin|editor|viewer
joined_at     timestamptz DEFAULT now()
UNIQUE(team_id, user_id)
```

#### team_invites
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE
email         text NOT NULL
role          text NOT NULL DEFAULT 'viewer'
invited_by    uuid NOT NULL REFERENCES users(id)
token         text UNIQUE NOT NULL  -- secure random token in email link
status        text NOT NULL DEFAULT 'pending'  -- pending|accepted|expired
expires_at    timestamptz NOT NULL
created_at    timestamptz DEFAULT now()
```

#### shared_profiles
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
team_id       uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE
profile_id    text NOT NULL  -- local profile UUID from Desktop
profile_name  text NOT NULL
shared_by     uuid NOT NULL REFERENCES users(id)
member_id     uuid NOT NULL REFERENCES users(id)
permission    text NOT NULL DEFAULT 'read'  -- read|write
shared_at     timestamptz DEFAULT now()
UNIQUE(team_id, profile_id, member_id)
```

#### sync_bundles
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
data          bytea NOT NULL  -- AES-256-GCM encrypted blob
checksum      text NOT NULL   -- SHA256 of plaintext (client-computed)
profile_count integer NOT NULL DEFAULT 0
version       integer NOT NULL DEFAULT 1
created_at    timestamptz DEFAULT now()
updated_at    timestamptz DEFAULT now()
```

#### sync_logs
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
direction     text NOT NULL  -- push|pull
profile_count integer NOT NULL DEFAULT 0
status        text NOT NULL  -- success|error
error_message text
synced_at     timestamptz DEFAULT now()
```

#### audit_logs
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
team_id       uuid REFERENCES teams(id) ON DELETE SET NULL
user_id       uuid REFERENCES users(id) ON DELETE SET NULL
user_name     text
action        text NOT NULL
target_id     text
target_name   text
ip_address    text
created_at    timestamptz DEFAULT now()
INDEX(team_id, created_at DESC)
INDEX(user_id, created_at DESC)
```

#### webhooks
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
name          text NOT NULL
url           text NOT NULL
events        text[] NOT NULL  -- {profile.created, profile.launched, ...}
secret        text  -- HMAC-SHA256 signing key
enabled       boolean DEFAULT true
last_triggered_at  timestamptz
last_status   integer
created_at    timestamptz DEFAULT now()
```

#### webhook_deliveries
```sql
id            uuid PRIMARY KEY DEFAULT gen_random_uuid()
webhook_id    uuid NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE
event         text NOT NULL
payload       jsonb NOT NULL
response_status  integer
response_body    text
attempt       integer DEFAULT 1
delivered_at  timestamptz DEFAULT now()
INDEX(webhook_id, delivered_at DESC)
```

---

## 6. API Design

### 6.1 Conventions

```
Base URL:     https://api.shadowdesk.io/v1
Content-Type: application/json
Auth:         Authorization: Bearer <access_token>
Errors:       { "error": { "code": "AUTH_EXPIRED", "message": "..." } }
Success:      { "data": <payload> }
Pagination:   { "data": [...], "meta": { "total", "page", "limit" } }
```

### 6.2 Auth Endpoints

```
POST   /auth/register          Register new account
POST   /auth/login             Login → { user, tokens }
POST   /auth/logout            Revoke refresh token
POST   /auth/refresh           Rotate access + refresh token
GET    /auth/me                Current user profile
PUT    /auth/me                Update name, avatar
PUT    /auth/password          Change password
POST   /auth/verify-email      Verify email with token
POST   /auth/verify-email/resend  Resend verification email
POST   /auth/forgot-password   Send password reset email
POST   /auth/reset-password    Reset password with token
POST   /auth/me/export         Export all user data (GDPR)
DELETE /auth/me                Delete account (GDPR)
```

### 6.3 License Endpoints

```
GET    /licenses/current                      Current license + limits
POST   /licenses/activate                     Activate license key on device
POST   /licenses/deactivate                   Deactivate current device
GET    /licenses/devices                      List activated devices
DELETE /licenses/devices/:machineId           Remove device seat
```

### 6.4 Team Endpoints

```
POST   /team                                  Create team
GET    /team                                  Get current team
PUT    /team                                  Update team name
DELETE /team                                  Delete team

GET    /team/members                          List members
PUT    /team/members/:userId                  Update member role
DELETE /team/members/:userId                  Remove member

POST   /team/invites                          Send invite email
GET    /team/invites                          List pending invites
DELETE /team/invites/:inviteId                Cancel invite
POST   /team/invites/:token/accept            Accept invite (link from email)

POST   /team/profiles/share                   Share profile with members
GET    /team/profiles/shared                  List shared profiles
DELETE /team/profiles/share                   Unshare profile

GET    /team/audit                            Query audit log (paginated)
```

### 6.5 Sync Endpoints

```
POST   /sync/push                             Upload encrypted bundle
GET    /sync/pull                             Download encrypted bundle
GET    /sync/manifest                         Get version + checksum info
DELETE /sync/data                             Wipe cloud data
```

### 6.6 Webhook Endpoints

```
GET    /webhooks                              List webhooks
POST   /webhooks                              Create webhook
GET    /webhooks/:id                          Get webhook detail
PUT    /webhooks/:id                          Update webhook
DELETE /webhooks/:id                          Delete webhook
POST   /webhooks/:id/test                     Send test event
GET    /webhooks/:id/deliveries               List delivery history
```

### 6.7 Error Codes

```typescript
type ErrorCode =
  // Auth
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_TOKEN_EXPIRED'
  | 'AUTH_TOKEN_INVALID'
  | 'AUTH_EMAIL_NOT_VERIFIED'
  | 'AUTH_EMAIL_ALREADY_EXISTS'
  // License
  | 'LICENSE_INVALID_KEY'
  | 'LICENSE_ALREADY_ACTIVATED'
  | 'LICENSE_SEATS_EXCEEDED'
  | 'LICENSE_EXPIRED'
  | 'LICENSE_PLAN_LIMIT'
  // Team
  | 'TEAM_NOT_FOUND'
  | 'TEAM_MEMBER_LIMIT'
  | 'TEAM_INVITE_EXPIRED'
  | 'TEAM_PERMISSION_DENIED'
  // Sync
  | 'SYNC_CHECKSUM_MISMATCH'
  | 'SYNC_NOT_ENABLED'
  // General
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
```

---

## 7. Security Architecture

### 7.1 Auth Flow

```
[Desktop App]                    [Backend]
    │                                │
    │── POST /auth/login ──────────► │
    │                                │ verify password (argon2id)
    │◄── { access_token (15m),      │ generate JWT (jose)
    │      refresh_token (30d) } ─── │ store hashed refresh_token in sessions
    │                                │
    │── API request + Bearer ──────► │
    │                                │ verify JWT signature + expiry
    │◄── response ─────────────────  │
    │                                │
    │── POST /auth/refresh ────────► │
    │   { refresh_token }            │ verify hash in sessions table
    │◄── { new_access_token,        │ rotate: delete old, insert new session
    │      new_refresh_token } ───── │
```

**JWT Claims:**
```json
{
  "sub": "<user_id>",
  "email": "<email>",
  "plan": "professional",
  "team_id": "<team_id>",
  "role": "admin",
  "iat": 1712345678,
  "exp": 1712346578
}
```

### 7.2 Rate Limiting

```
POST /auth/login          → 10 req/15min per IP
POST /auth/register       → 5 req/hour per IP
POST /auth/refresh        → 30 req/min per user
POST /licenses/activate   → 5 req/hour per user
*                         → 300 req/min per user (global)
```

### 7.3 Zero-Knowledge Sync

```
Backend NEVER sees plaintext profile data:

Client side:
  1. profiles JSON → AES-256-GCM encrypt (key = scrypt(password, user_id))
  2. SHA256 checksum of plaintext
  3. POST /sync/push { data: base64(ciphertext), checksum, profile_count }

Backend side:
  4. Store binary blob AS-IS in sync_bundles.data
  5. Store checksum for integrity reference ONLY
  6. Never decrypt, never inspect

Pull side:
  7. GET /sync/pull → return raw blob
  8. Client decrypts locally, verify checksum
```

### 7.4 Webhook Security

```
Each delivery:
  X-ShadowDesk-Event:     profile.launched
  X-ShadowDesk-Delivery:  <uuid>
  X-ShadowDesk-Signature: sha256=<HMAC-SHA256(secret, payload)>
  X-ShadowDesk-Timestamp: <unix_ts>

Receiver should:
  1. Check X-ShadowDesk-Timestamp within ±5 minutes
  2. Compute HMAC-SHA256(secret, timestamp + "." + body)
  3. Compare with X-ShadowDesk-Signature
```

---

## 8. Queue System (BullMQ)

### 8.1 Queues

```
webhook-delivery
  ├── job: { webhookId, event, payload }
  ├── retries: 5 (exponential backoff: 30s, 2m, 10m, 30m, 2h)
  ├── remove on complete: after 7 days
  └── remove on fail: after 30 days (for debugging)

email-notification
  ├── job: { to, template, data }
  ├── retries: 3
  └── delay: none

license-expiry-alert
  ├── cron: "0 9 * * *" (daily 9am UTC)
  └── check: licenses expiring in 7 days → queue email-notification
```

### 8.2 Webhook Delivery Worker

```
Worker flow:
  1. Dequeue job { webhookId, event, payload }
  2. Load webhook config (url, secret, enabled)
  3. Skip if disabled
  4. Build headers (signature, timestamp, delivery ID)
  5. POST to webhook.url, timeout 10s
  6. Record delivery in webhook_deliveries
  7. Update webhooks.last_triggered_at + last_status
  8. On 4xx: do NOT retry (client error)
  9. On 5xx / timeout: BullMQ retry with backoff
```

---

## 9. Ecosystem Extension Points

### 9.1 ShadowProxy Integration

Thêm module `/proxy` với tables:

```sql
proxy_vendors    -- vendor credentials (BrightData, GeoNode, etc.)
proxy_pools      -- logical groupings with filter rules
proxy_pool_items -- individual proxy entries
proxy_health     -- health check records
```

Endpoint mới:
```
/proxy/vendors
/proxy/pools
/proxy/pools/:id/pull   -- pull 1 proxy theo filter
/proxy/analytics
```

### 9.2 ShadowFlow Integration

Thêm module `/marketplace` với tables:

```sql
workflow_templates   -- community workflow templates
template_installs    -- install tracking per user
template_ratings     -- star ratings
```

### 9.3 Feature Flags

```sql
feature_flags
  ├── key:   'shadowproxy_enabled'
  ├── plan:  'professional'  -- minimum plan required
  └── value: true/false
```

---

## 10. Deployment

### 10.1 Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=production
API_BASE_URL=https://api.shadowdesk.io

# Database
DATABASE_URL=postgresql://user:pass@db.supabase.co:5432/postgres

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<32+ random bytes, hex>
JWT_ACCESS_TTL=900          # 15 minutes in seconds
JWT_REFRESH_TTL=2592000     # 30 days in seconds

# Email
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<resend api key>
EMAIL_FROM=noreply@shadowdesk.io

# Storage (Supabase)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=<service role key>
SYNC_BUCKET=sync-bundles

# Optional: Sentry
SENTRY_DSN=https://...
```

### 10.2 Docker

```bash
# Development
docker-compose up

# Production build
docker build -t shadowdesk-backend .
docker run -p 3000:3000 --env-file .env shadowdesk-backend
```

### 10.3 Railway Deployment

```bash
railway login
railway init
railway add --database postgresql
railway add --database redis
railway up
```

### 10.4 Health Checks

```
GET /health
→ { status: "ok", version: "1.0.0", db: "ok", redis: "ok" }

GET /health/db    → DB connection test
GET /health/redis → Redis connection test
```

---

## 11. Migration Path from Current State

### Desktop App Changes Required

1. **Update `API_BASE_URL`** in `api-client.ts`:
   ```
   https://api.ghostbrowser.app → https://api.shadowdesk.io/v1
   ```

2. **Token format unchanged** — JWT claims compatible

3. **Sync endpoint path change**:
   ```
   /profiles/sync/push → /sync/push
   /profiles/sync/pull → /sync/pull
   /profiles/sync/manifest → /sync/manifest
   ```

4. **License endpoint path change**:
   ```
   /licenses/activate → /licenses/activate (same)
   /licenses/current → /licenses/current (same)
   ```

5. **No breaking changes** to team, auth, webhook endpoints

---

## 12. Development Workflow

```bash
# Install
cd backend && npm install

# Database setup
npm run db:generate   # generate migrations from schema
npm run db:migrate    # apply migrations
npm run db:studio     # open Drizzle Studio (GUI)

# Development
npm run dev           # ts-node-dev with hot reload

# Production build
npm run build         # tsc → dist/
npm start             # node dist/server.js

# Type check
npm run typecheck

# Test
npm test              # vitest
```
