# Ghost Browser API Server

Node.js + Express backend for the Ghost Browser anti-detect Electron application.

## Features

- **User Authentication** — Register, login, password management, account deletion (GDPR)
- **License Management** — License activation, device tracking, plan enforcement
- **Team Collaboration** — Team CRUD, member management, role-based access control
- **Cloud Sync** — E2E encrypted profile synchronization with integrity verification
- **Audit Logging** — Team action logging for compliance
- **Security** — JWT auth, bcrypt passwords, SQL injection prevention, rate limiting

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+ (for caching/rate limiting)

### Installation

```bash
npm install
```

### Configuration

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Key environment variables:
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — Secret key for signing JWTs (32+ chars)
- `REDIS_URL` — Redis connection string

### Database Setup

Run migrations:

```bash
npm run migrate
```

(Optional) Seed test data:

```bash
npm run seed
```

### Development

Start dev server with auto-reload:

```bash
npm run dev
```

Server runs on `http://localhost:3000`

### Testing

Run test suite:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

### Production Build

Build TypeScript:

```bash
npm run build
```

Start production server:

```bash
npm start
```

## API Endpoints

### Authentication (`/auth`)
- `POST /auth/register` — Create account
- `POST /auth/login` — Login
- `POST /auth/refresh` — Refresh access token
- `POST /auth/logout` — Logout
- `GET /auth/me` — Current user profile
- `PUT /auth/password` — Change password
- `DELETE /auth/me` — Delete account (GDPR)
- `POST /auth/me/export` — Export user data (GDPR)

### Licenses (`/licenses`)
- `POST /licenses/activate` — Activate license with machine ID
- `GET /licenses/current` — Fetch current license
- `POST /licenses/deactivate` — Deactivate license
- `GET /licenses/devices` — List activated devices
- `POST /licenses/devices/deactivate` — Deactivate specific device

### Team (`/team`)
- `POST /team` — Create team
- `GET /team` — Fetch team
- `PUT /team` — Update team name
- `DELETE /team` — Delete team
- `GET /team/members` — List members
- `PUT /team/members/:userId` — Update member role
- `DELETE /team/members/:userId` — Remove member
- `POST /team/invites` — Send invite
- `GET /team/invites` — List invites
- `DELETE /team/invites/:inviteId` — Cancel invite
- `POST /team/invites/:inviteId/accept` — Accept invite
- `POST /team/profiles/share` — Share profile with members
- `GET /team/profiles/shared` — List shared profiles
- `DELETE /team/profiles/share` — Unshare profile
- `GET /team/audit` — Audit log

### Cloud Sync (`/profiles/sync`)
- `POST /profiles/sync/push` — Upload encrypted bundle
- `GET /profiles/sync/pull` — Download encrypted bundle
- `GET /profiles/sync/manifest` — Get sync metadata

### Health Checks
- `GET /health/live` — Liveness probe
- `GET /health/ready` — Readiness probe

## Architecture

See `docs/SERVER_ARCHITECTURE.md` for detailed documentation on:
- Database schema
- API design
- Security & encryption
- Deployment strategies
- Monitoring & observability

## Database Schema

Core tables:
- `users` — User accounts
- `teams` — Team workspaces
- `team_members` — Team membership
- `team_invites` — Pending invitations
- `licenses` — License records
- `license_devices` — Device activation tracking
- `sync_bundles` — Encrypted profile data
- `sync_history` — Sync operation log
- `audit_log` — Team action log
- `auth_tokens` — Refresh token blacklist

## Error Handling

All errors return JSON format:

```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "code": 400,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

Standard HTTP status codes:
- `200` — Success
- `201` — Created
- `204` — No content
- `400` — Bad request / validation error
- `401` — Unauthorized / invalid token
- `403` — Forbidden / insufficient permissions
- `404` — Not found
- `409` — Conflict / duplicate resource
- `429` — Rate limit exceeded
- `500` — Internal server error

## Security

- **Passwords:** bcrypt with 12 rounds
- **Tokens:** JWT (15m access, 7d refresh)
- **Encryption:** AES-256-GCM for sync bundles
- **SQL:** Parameterized queries (no injection)
- **CORS:** Electron client only
- **Validation:** Joi schemas on all inputs
- **Rate Limiting:** Redis-backed per IP & user
- **Logging:** Audit trail of all sensitive actions

## Deployment

### Docker

Build image:

```bash
docker build -f docker/Dockerfile -t ghost-browser-api .
```

Run with docker-compose:

```bash
docker-compose -f docker/docker-compose.yml up
```

### Kubernetes

See `k8s/` directory for deployment manifests (service, deployment, secrets)

### Cloud Platforms

- **Google Cloud Run** — Serverless deployment
- **AWS App Runner** — Container deployment
- **Heroku** — PaaS (deprecated but still supported)

## Monitoring

- **Prometheus metrics** — `/metrics` endpoint
- **Structured logging** — JSON logs with request IDs
- **Error tracking** — Integration with Sentry (optional)
- **Database monitoring** — Connection pool stats
- **Rate limit metrics** — Redis usage tracking

## License

Ghost Browser Server © 2024. Proprietary software.

## Support

Issues and feature requests: GitHub issues in parent repo
