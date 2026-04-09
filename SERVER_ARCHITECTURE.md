# Ghost Browser Backend — Server Architecture Plan

## Overview
RESTful API server for Ghost Browser anti-detect platform, handling authentication, profile management, team collaboration, licensing, cloud sync, and audit logging.

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Runtime | Node.js 18+ | Fast, async-first, event-driven |
| Framework | Fastify | High-performance, minimal overhead, excellent validation |
| Database | PostgreSQL | ACID compliance, JSON support, strong data integrity |
| Cache | Redis | Session management, rate limiting, pub/sub for real-time updates |
| Auth | JWT + Refresh Tokens | Stateless, scalable, standard industry practice |
| Encryption | libsodium (tweetnacl.js) | E2E encryption for cloud sync, industry standard |
| Monitoring | Pino + Datadog | Structured logging, observability, performance tracking |
| Testing | Jest + SuperTest | Fast, comprehensive test coverage |
| CI/CD | GitHub Actions | Native GitHub integration |

## Database Schema

### Core Tables

```sql
-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  INDEX(email)
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Team Members
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'owner', 'admin', 'member'
  joined_at TIMESTAMP DEFAULT now(),
  UNIQUE(team_id, user_id)
);

-- Shared Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  fingerprint JSONB NOT NULL,
  proxy_id UUID,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  INDEX(team_id)
);

-- Profile Versions (history)
CREATE TABLE profile_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  fingerprint JSONB NOT NULL,
  label VARCHAR(255),
  saved_by UUID REFERENCES users(id),
  saved_at TIMESTAMP DEFAULT now(),
  INDEX(profile_id)
);

-- Licenses
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  plan VARCHAR(50) NOT NULL, -- 'free', 'starter', 'professional', 'enterprise'
  profile_limit INT NOT NULL,
  active_devices INT NOT NULL DEFAULT 0,
  max_devices INT NOT NULL,
  renewal_date TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'expired', 'canceled'
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- License Devices
CREATE TABLE license_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
  fingerprint VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  activated_at TIMESTAMP DEFAULT now(),
  last_seen_at TIMESTAMP,
  UNIQUE(license_id, fingerprint)
);

-- Cloud Sync
CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  direction VARCHAR(20) NOT NULL, -- 'push', 'pull'
  profile_count INT,
  data_size INT,
  status VARCHAR(50) NOT NULL, -- 'pending', 'in_progress', 'success', 'failed'
  error TEXT,
  synced_at TIMESTAMP DEFAULT now(),
  INDEX(team_id, synced_at DESC)
);

-- Encrypted Sync Data
CREATE TABLE sync_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  encrypted_data TEXT NOT NULL, -- AES-256-GCM encrypted JSON
  checksum VARCHAR(64) NOT NULL,
  version INT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),
  UNIQUE(team_id, version)
);

-- Audit Log
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  status VARCHAR(50) NOT NULL, -- 'success', 'failure'
  error_message TEXT,
  created_at TIMESTAMP DEFAULT now(),
  INDEX(team_id, created_at DESC),
  INDEX(user_id, created_at DESC)
);

-- Detection Test Results
CREATE TABLE detection_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID,
  team_id UUID REFERENCES teams(id),
  tested_by UUID REFERENCES users(id),
  overall_score FLOAT NOT NULL,
  vectors JSONB NOT NULL,
  status VARCHAR(50), -- 'pending', 'in_progress', 'completed', 'failed'
  tested_at TIMESTAMP DEFAULT now(),
  INDEX(team_id, tested_at DESC),
  INDEX(profile_id, tested_at DESC)
);

-- Webhooks (for external integrations)
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  event_type VARCHAR(100) NOT NULL, -- 'profile.created', 'sync.completed', etc.
  url TEXT NOT NULL,
  secret VARCHAR(255) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);
```

## API Endpoints

### Authentication (`/api/v1/auth`)
- `POST /login` — Login with email/password
- `POST /register` — Register new account
- `POST /logout` — Logout (invalidate refresh token)
- `POST /refresh` — Refresh access token
- `GET /me` — Get current user profile
- `PUT /me` — Update profile
- `PUT /password` — Change password
- `POST /verify-email` — Send verification email
- `POST /verify-email/confirm` — Confirm email verification
- `POST /me/export` — Export user data (GDPR)
- `DELETE /me` — Delete account

### Teams (`/api/v1/team`)
- `POST /` — Create team
- `GET /` — Get team details
- `PUT /` — Update team
- `DELETE /` — Delete team
- `GET /members` — List team members
- `POST /members` — Add member (invite)
- `PUT /members/{userId}` — Update member role
- `DELETE /members/{userId}` — Remove member
- `GET /invites` — List pending invites
- `POST /invites/{inviteId}/accept` — Accept invite
- `DELETE /invites/{inviteId}` — Decline invite

### Profiles (`/api/v1/profiles`)
- `GET /` — List team profiles (paginated)
- `GET /{id}` — Get profile details
- `POST /` — Create profile
- `PUT /{id}` — Update profile
- `DELETE /{id}` — Delete profile
- `POST /{id}/clone` — Clone profile

### Profile Versions (`/api/v1/profiles/{id}/versions`)
- `GET /` — List versions
- `GET /{versionId}` — Get specific version
- `POST /` — Save as version
- `PUT /{versionId}` — Update version label
- `DELETE /{versionId}` — Delete version

### Cloud Sync (`/api/v1/profiles/sync`)
- `POST /push` — Push profiles to cloud (encrypted)
- `GET /pull` — Pull profiles from cloud
- `GET /manifest` — Get sync manifest (metadata)
- `GET /logs` — List sync history

### Licenses (`/api/v1/licenses`)
- `POST /activate` — Activate license key
- `GET /current` — Get current license
- `POST /deactivate` — Deactivate license
- `GET /devices` — List activated devices
- `POST /devices/deactivate` — Deactivate device
- `POST /cancel` — Cancel subscription

### Detection Tests (`/api/v1/detection`)
- `POST /test` — Submit detection test
- `GET /results/{testId}` — Get test results
- `GET /history` — List test history
- `GET /stats` — Get aggregated detection stats

### Audit Log (`/api/v1/audit`)
- `GET /` — List audit logs (team-scoped)

## Authentication Flow

```
1. User registers/logs in
2. Server validates credentials
3. Server returns access_token (15m) + refresh_token (7d)
4. Client stores tokens in secure storage
5. Client includes access_token in Authorization header
6. On token expiry, client calls /auth/refresh with refresh_token
7. Server validates refresh_token, returns new access_token
8. If refresh_token invalid, user must re-authenticate
```

## Cloud Sync Flow (E2E Encrypted)

```
1. Client generates encryption key from user's master password
2. Client encrypts profile JSON using AES-256-GCM
3. Client POSTs encrypted data + checksum to /profiles/sync/push
4. Server stores encrypted blob (cannot read contents)
5. Server computes backup & creates audit log
6. On sync pull, server returns encrypted blob
7. Client decrypts using master password
8. Client validates checksum, merges profiles
```

## Rate Limiting

- **Per IP**: 100 req/min for public endpoints
- **Per User**: 1000 req/min for authenticated endpoints
- **Auth endpoints**: 5 attempts/15min (brute-force protection)
- **Webhook deliveries**: Exponential backoff (3, 9, 27 seconds)

## Error Handling

All errors return JSON with:
```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": {...}, // Optional validation errors
  "statusCode": 400
}
```

## Deployment

- **Development**: `npm run dev` (localhost:3000)
- **Production**: Docker container, behind reverse proxy (Nginx)
- **Database**: PostgreSQL 14+ with SSL
- **Redis**: For caching & sessions
- **Monitoring**: Datadog APM, log aggregation

## Project Structure

```
backend/
├── src/
│   ├── server.ts              # Fastify app setup
│   ├── config.ts              # Environment configuration
│   ├── middleware/
│   │   ├── auth.ts            # JWT verification
│   │   ├── rateLimit.ts       # Rate limiting
│   │   ├── errorHandler.ts    # Global error handling
│   │   ├── validation.ts      # Schema validation
│   │   └── audit.ts           # Audit logging
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── team.ts
│   │   ├── profiles.ts
│   │   ├── sync.ts
│   │   ├── licenses.ts
│   │   ├── detection.ts
│   │   └── audit.ts
│   ├── services/
│   │   ├── AuthService.ts
│   │   ├── TeamService.ts
│   │   ├── ProfileService.ts
│   │   ├── SyncService.ts
│   │   ├── LicenseService.ts
│   │   └── AuditService.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Team.ts
│   │   ├── Profile.ts
│   │   └── ...
│   ├── database/
│   │   ├── connection.ts
│   │   ├── migrations/
│   │   └── seeds/
│   └── utils/
│       ├── crypto.ts          # E2E encryption/decryption
│       ├── jwt.ts             # Token generation
│       └── validation.ts      # Input validation
├── tests/
│   ├── auth.test.ts
│   ├── teams.test.ts
│   └── ...
├── docker-compose.yml
├── Dockerfile
└── package.json
```

## Development Roadmap

### Phase 1: Core Backend (Weeks 1-3)
- ✅ Project setup (Fastify, TypeScript, PostgreSQL)
- ✅ Database schema & migrations
- ✅ Authentication (register, login, JWT)
- ✅ User profile endpoints
- ✅ Basic error handling & validation
- ✅ Docker setup

### Phase 2: Team & Collaboration (Weeks 4-5)
- ✅ Team CRUD
- ✅ Team members management
- ✅ Invite system
- ✅ Role-based access control
- ✅ Audit logging

### Phase 3: Profile Management (Weeks 6-7)
- ✅ Profile CRUD (team-scoped)
- ✅ Profile versioning
- ✅ Shared profiles
- ✅ Clone/export functionality

### Phase 4: Cloud Sync (Weeks 8-10)
- ✅ E2E encryption (AES-256-GCM)
- ✅ /sync/push endpoint
- ✅ /sync/pull endpoint
- ✅ Manifest/metadata handling
- ✅ Conflict resolution

### Phase 5: Licensing (Weeks 11-12)
- ✅ License validation
- ✅ Device activation/deactivation
- ✅ Plan limits enforcement
- ✅ Subscription integration (Stripe)

### Phase 6: Advanced Features (Weeks 13+)
- ✅ Webhooks for external integrations
- ✅ Real-time updates (WebSocket)
- ✅ Analytics & reporting
- ✅ Performance optimization
- ✅ CDN integration

## Security Considerations

1. **Passwords**: Bcrypt with salt rounds = 12
2. **Tokens**: JWT with RS256 signature (private key)
3. **Encryption**: AES-256-GCM for cloud sync
4. **HTTPS Only**: All production endpoints require TLS
5. **CORS**: Whitelist specific origins (electron app URL)
6. **CSRF**: Not applicable (stateless JWT auth)
7. **Rate Limiting**: Protect against brute force & DoS
8. **Input Validation**: Zod schemas for all endpoints
9. **Audit Logging**: Log all sensitive operations
10. **Secrets Management**: Use environment variables, never commit keys

## Monitoring & Observability

- **Structured Logging**: Pino with JSON output
- **Tracing**: Distributed tracing with Datadog APM
- **Metrics**: Prometheus-compatible endpoints
- **Alerts**: PagerDuty integration for critical errors
- **Health Checks**: `/health` endpoint for load balancers
