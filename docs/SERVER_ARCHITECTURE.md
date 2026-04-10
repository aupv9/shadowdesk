# Ghost Browser Server Architecture

## Overview

The Ghost Browser backend is a **Node.js + Express** server that provides core functionality for the Electron desktop client:
- User authentication & account management
- License management & device activation
- Team collaboration & role-based access control
- Cloud sync with E2E encryption
- Audit logging & compliance

**Tech Stack:**
- **Runtime:** Node.js 18+
- **Framework:** Express.js + TypeScript
- **Database:** PostgreSQL 14+
- **Auth:** JWT (access + refresh tokens)
- **Encryption:** AES-256-GCM (profiles), bcrypt (passwords)
- **Deployment:** Docker + Kubernetes / Cloud Run

---

## Architecture Diagram

```
┌─────────────────────────────────────┐
│   Electron Desktop Client           │
│   (Desktop App)                     │
└────────────────┬────────────────────┘
                 │
        HTTP/REST API Calls
                 │
        ┌────────▼────────┐
        │   API Gateway   │  (auth, rate limit, validation)
        │   (middleware)  │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
┌───▼────┐ ┌────▼────┐ ┌────▼────┐
│ Auth   │ │ License │ │ Team    │  API Modules
│Service │ │Service  │ │Service  │
└───┬────┘ └────┬────┘ └────┬────┘
    │           │           │
┌───▼───────────▼───────────▼────────┐
│     PostgreSQL Database            │
│ (Users, Teams, Licenses, Sync Log)│
└────────────────────────────────────┘
     │
┌────▼──────────────────────┐
│ Cloud Storage (S3/GCS)    │  (encrypted sync bundles)
└───────────────────────────┘
```

---

## Directory Structure

```
ghost-browser-server/
├── src/
│   ├── config/
│   │   ├── database.ts         # PostgreSQL connection pool
│   │   ├── env.ts             # Environment variables validation
│   │   └── constants.ts       # App constants (grace period, limits, etc.)
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.controller.ts   # Login, register, refresh
│   │   │   ├── auth.service.ts      # User lookup, token generation
│   │   │   ├── auth.middleware.ts   # JWT verification, rate limiting
│   │   │   ├── auth.routes.ts       # Express route definitions
│   │   │   └── types.ts
│   │   ├── user/
│   │   │   ├── user.controller.ts   # Get current user, update profile, delete account
│   │   │   ├── user.service.ts      # User DB queries
│   │   │   ├── user.routes.ts
│   │   │   └── types.ts
│   │   ├── license/
│   │   │   ├── license.controller.ts    # Activate, fetch, deactivate
│   │   │   ├── license.service.ts       # License DB ops, validation
│   │   │   ├── license.routes.ts
│   │   │   └── types.ts
│   │   ├── team/
│   │   │   ├── team.controller.ts       # CRUD, members, invites
│   │   │   ├── team.service.ts          # Team DB ops
│   │   │   ├── team.routes.ts
│   │   │   └── types.ts
│   │   ├── sync/
│   │   │   ├── sync.controller.ts       # Push, pull, manifest
│   │   │   ├── sync.service.ts          # Encrypt/decrypt, S3 ops
│   │   │   ├── sync.routes.ts
│   │   │   └── types.ts
│   │   ├── audit/
│   │   │   ├── audit.service.ts         # Log events
│   │   │   └── audit.types.ts
│   │   └── health/
│   │       ├── health.controller.ts     # Readiness, liveness probes
│   │       └── health.routes.ts
│   ├── middleware/
│   │   ├── auth.ts            # JWT verification
│   │   ├── error.ts           # Error handler
│   │   ├── validation.ts      # Request validation
│   │   ├── rate-limit.ts      # Rate limiting (Redis)
│   │   └── request-logger.ts
│   ├── database/
│   │   ├── migrations/        # SQL migration files
│   │   ├── seed.ts            # Initial data
│   │   └── queries/           # SQL query builders
│   ├── utils/
│   │   ├── crypto.ts          # Encryption utilities
│   │   ├── jwt.ts             # Token generation/verification
│   │   ├── hash.ts            # Password hashing
│   │   ├── validators.ts      # Input validation schemas
│   │   └── errors.ts          # Custom error classes
│   ├── types/
│   │   └── index.ts           # Shared TypeScript interfaces
│   ├── app.ts                 # Express app setup
│   └── server.ts              # Entry point
├── tests/
│   ├── integration/
│   ├── unit/
│   └── fixtures/
├── scripts/
│   ├── migrate.ts             # Run migrations
│   └── seed-db.ts
├── docker/
│   ├── Dockerfile
│   └── docker-compose.yml
├── docs/
│   ├── API.md                 # API documentation
│   └── DATABASE.md            # Schema documentation
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## Database Schema

### Core Tables

#### `users`
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  email_verified_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  -- GDPR/deletion tracking
  deletion_requested_at TIMESTAMP,
  deletion_reason TEXT,
  
  -- Account status
  status ENUM('active', 'suspended', 'deleted'),
  
  -- IP tracking for suspicious login detection
  last_login_ip VARCHAR(45),
  last_login_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
```

#### `teams`
```sql
CREATE TABLE teams (
  id UUID PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,
  
  -- Team settings
  max_members INT DEFAULT -1 (unlimited),
  profile_sharing_enabled BOOLEAN DEFAULT TRUE,
  audit_logging_enabled BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_teams_owner_id ON teams(owner_id);
CREATE INDEX idx_teams_deleted_at ON teams(deleted_at);
```

#### `team_members`
```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  role ENUM('owner', 'admin', 'member') DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT NOW(),
  
  -- Rate limiting & access control
  last_action_at TIMESTAMP,
  action_count INT DEFAULT 0,
  
  UNIQUE(team_id, user_id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

CREATE INDEX idx_team_members_user_id ON team_members(user_id);
```

#### `team_invites`
```sql
CREATE TABLE team_invites (
  id UUID PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  invited_by_user_id UUID NOT NULL REFERENCES users(id),
  email VARCHAR(255) NOT NULL,
  role ENUM('admin', 'member') DEFAULT 'member',
  token VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(team_id, email)
);

CREATE INDEX idx_team_invites_token ON team_invites(token);
CREATE INDEX idx_team_invites_expires_at ON team_invites(expires_at);
```

#### `licenses`
```sql
CREATE TABLE licenses (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  license_key VARCHAR(64) UNIQUE NOT NULL,
  plan ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
  max_profiles INT DEFAULT 5,
  max_team_members INT DEFAULT 1,
  cloud_sync_enabled BOOLEAN DEFAULT FALSE,
  
  -- Activation tracking
  activated_at TIMESTAMP,
  activated_machine_id VARCHAR(32),
  valid_until TIMESTAMP,
  
  -- Status
  status ENUM('active', 'suspended', 'expired') DEFAULT 'active',
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_licenses_user_id ON licenses(user_id);
CREATE INDEX idx_licenses_license_key ON licenses(license_key);
CREATE INDEX idx_licenses_valid_until ON licenses(valid_until);
```

#### `license_devices`
```sql
CREATE TABLE license_devices (
  id UUID PRIMARY KEY,
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  machine_id VARCHAR(32) NOT NULL,
  machine_name VARCHAR(255),
  activated_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP,
  
  UNIQUE(license_id, machine_id)
);

CREATE INDEX idx_license_devices_machine_id ON license_devices(machine_id);
```

#### `sync_bundles`
```sql
CREATE TABLE sync_bundles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Encrypted data (binary)
  data BYTEA NOT NULL,
  
  -- Integrity check
  checksum VARCHAR(64) NOT NULL,
  
  -- Metadata
  profile_count INT DEFAULT 0,
  
  -- Versioning for schema evolution
  bundle_version INT DEFAULT 1,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_bundles_user_id ON sync_bundles(user_id);
```

#### `sync_history`
```sql
CREATE TABLE sync_history (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction ENUM('push', 'pull') NOT NULL,
  profile_count INT DEFAULT 0,
  status ENUM('success', 'error') NOT NULL,
  error_message TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sync_history_user_id ON sync_history(user_id);
CREATE INDEX idx_sync_history_created_at ON sync_history(created_at);
```

#### `audit_log`
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams(id),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(64) NOT NULL,
  resource_type VARCHAR(64),
  resource_id VARCHAR(255),
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  status ENUM('success', 'failure'),
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_log_team_id ON audit_log(team_id);
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
```

#### `auth_tokens` (blacklist for revocation)
```sql
CREATE TABLE auth_tokens (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_auth_tokens_user_id ON auth_tokens(user_id);
CREATE INDEX idx_auth_tokens_expires_at ON auth_tokens(expires_at);
```

---

## API Endpoints Reference

### Authentication
- `POST /auth/register` — Create account
- `POST /auth/login` — Login
- `POST /auth/refresh` — Refresh access token
- `POST /auth/logout` — Logout (blacklist refresh token)
- `GET /auth/me` — Current user profile
- `PUT /auth/password` — Change password
- `POST /auth/verify-email/resend` — Resend verification email
- `POST /auth/me/export` — GDPR data export
- `DELETE /auth/me` — Delete account

### License
- `POST /licenses/activate` — Activate license with machine ID
- `GET /licenses/current` — Fetch current user's license
- `POST /licenses/deactivate` — Deactivate license
- `GET /licenses/devices` — List devices for license
- `POST /licenses/devices/deactivate` — Deactivate specific device

### Team
- `POST /team` — Create team
- `GET /team` — Get current team
- `PUT /team` — Update team name
- `DELETE /team` — Delete team

**Members:**
- `GET /team/members` — List team members
- `PUT /team/members/:userId` — Update member role
- `DELETE /team/members/:userId` — Remove member

**Invites:**
- `POST /team/invites` — Send invite
- `GET /team/invites` — List sent invites
- `DELETE /team/invites/:inviteId` — Cancel invite
- `POST /team/invites/:inviteId/accept` — Accept invite (for invited user)

**Shared Profiles:**
- `POST /team/profiles/share` — Share profile with members
- `GET /team/profiles/shared` — List shared profiles
- `DELETE /team/profiles/share` — Unshare profile

**Audit:**
- `GET /team/audit` — List audit log (paginated)

### Cloud Sync
- `POST /profiles/sync/push` — Upload encrypted profile bundle
- `GET /profiles/sync/pull` — Download encrypted profile bundle
- `GET /profiles/sync/manifest` — Get sync metadata (profile count, last sync time)

### Health
- `GET /health/live` — Liveness probe
- `GET /health/ready` — Readiness probe

---

## Key Design Decisions

### 1. **JWT Authentication**
- **Access Token:** Short-lived (15 min), used for API requests
- **Refresh Token:** Long-lived (7 days), stored securely in DB (hashed)
- **Rotation:** New refresh token issued on every refresh, old one revoked
- **Blacklist:** Refresh tokens tracked in DB for explicit logout support

### 2. **E2E Encryption for Sync**
- Client encrypts all profiles before sending to server
- Server stores encrypted bundles as binary blobs (opaque to server)
- Server never has access to unencrypted profile data
- Checksum stored separately for integrity verification
- No attempt to decrypt on server side

### 3. **Machine ID Validation**
- Licenses tied to specific `machine_id` (SHA256 hash of MAC addresses + CPU model)
- Multiple devices can be registered under one license
- `max_profiles` & `cloud_sync_enabled` controlled at license level

### 4. **Team Role-Based Access Control**
- **Owner:** Can delete team, manage all members
- **Admin:** Can invite, manage members (except owner)
- **Member:** Read-only profile sharing, cannot manage team

### 5. **Audit Logging**
- All team actions logged (invite sent, member added, profile shared, etc.)
- Includes IP address, user agent for compliance
- Query by user_id, action, date range
- Immutable (no edit/delete after creation)

### 6. **Rate Limiting**
- Per-user, per-IP limits
- Sync endpoints rate-limited: 10 push/pull per hour per user
- Auth endpoints rate-limited: 5 failed logins per IP per 15 min
- Redis-backed for distributed systems

### 7. **Database Transactions**
- Team operations (create + add member) wrapped in transactions
- Invite acceptance (validate + update team_members) atomic
- License activation (check + insert device) atomic

### 8. **GDPR Compliance**
- Email verification before account use (optional, depends on config)
- Soft delete (deleted_at timestamp) for audit trail
- GDPR export endpoint returns all user data as JSON
- Account deletion removes: user, licenses, team memberships, invites, sync bundles

---

## Deployment

### Docker Compose (Local Development)
```yaml
version: '3.8'
services:
  postgres:
    image: postgres:14
    environment:
      POSTGRES_DB: ghost_browser
      POSTGRES_PASSWORD: dev_password
    ports:
      - "5432:5432"

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  api:
    build: .
    environment:
      DATABASE_URL: postgres://postgres:dev_password@postgres:5432/ghost_browser
      JWT_SECRET: dev_secret_key
      REDIS_URL: redis://redis:6379
    ports:
      - "3000:3000"
    depends_on:
      - postgres
      - redis
```

### Kubernetes / Cloud Run
- **Container Registry:** GitHub Container Registry or Docker Hub
- **Secrets:** Environment variables from secrets (JWT_SECRET, DB_PASSWORD, etc.)
- **Database:** Managed PostgreSQL (Cloud SQL, RDS, etc.)
- **Cache:** Managed Redis (Cloud Memorystore, ElastiCache)
- **Object Storage:** S3 or GCS for sync bundles
- **Monitoring:** Prometheus metrics, Stackdriver/CloudWatch logging

---

## Error Handling

All errors follow a consistent JSON format:
```json
{
  "error": "invalid_request",
  "message": "Email is already registered",
  "code": 400,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

**Standard Error Codes:**
- `400 Bad Request` — Validation failure
- `401 Unauthorized` — Invalid/expired JWT
- `403 Forbidden` — Insufficient permissions
- `404 Not Found` — Resource not found
- `409 Conflict` — Duplicate email, team already exists
- `429 Too Many Requests` — Rate limit exceeded
- `500 Internal Server Error` — Unexpected error (logged for debugging)

---

## Security Considerations

1. **Password:** bcrypt with salt rounds 12
2. **JWT Secret:** Minimum 32 bytes, rotate periodically
3. **HTTPS:** All traffic encrypted in transit
4. **CORS:** Configured to allow only Electron app domain
5. **CSRF:** Not needed (JWT-based, not session cookies)
6. **SQL Injection:** Parameterized queries via knex.js
7. **Input Validation:** Joi schemas for all inputs
8. **Rate Limiting:** Redis-backed per IP & user
9. **Audit Trail:** All sensitive actions logged
10. **Environment Variables:** Never hardcoded secrets

---

## Testing Strategy

### Unit Tests
- Service layer: User creation, token generation, validation
- Utilities: Encryption, hashing, JWT verification

### Integration Tests
- API endpoints: Auth flow, team operations, sync push/pull
- Database transactions: Atomic operations
- Error scenarios: Invalid input, auth failures

### E2E Tests (with Electron client)
- Login → Create team → Invite member → Share profile → Sync
- License activation with multiple devices
- GDPR export and account deletion

---

## Monitoring & Observability

### Metrics
- Request latency (p50, p95, p99)
- Error rate by endpoint
- JWT token refresh rate
- Database connection pool usage
- Redis hit/miss rate
- Sync bundle size & frequency

### Logging
- Structured JSON logging (Winston/Pino)
- Log levels: error, warn, info, debug
- Fields: timestamp, request_id, user_id, endpoint, duration
- Aggregate in centralized service (Stackdriver, Datadog)

### Alerts
- High error rate (>5% of requests)
- Database connection pool exhaustion
- Rate limit bypass attempts
- Failed login storms (potential brute force)

---

## Future Enhancements

1. **OAuth2 / Social Login** — Google, GitHub SSO
2. **2FA** — TOTP authenticator app support
3. **Profile Sharing Encryption** — Encrypt shared profiles with team key
4. **Webhook Events** — Notify integrations on profile updates
5. **Usage Analytics** — Track profile creation, sync frequency
6. **Subscription Management** — Stripe integration for license purchases
7. **Backup & Recovery** — Manual sync bundle snapshots
8. **Activity Feed** — Team activity timeline
