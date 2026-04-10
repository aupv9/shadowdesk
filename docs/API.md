# Ghost Browser API Documentation

## Base URL

```
https://api.ghostbrowser.app
```

For local development:
```
http://localhost:3000
```

## Authentication

All authenticated endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <access_token>
```

Access tokens are short-lived (15 minutes). Use the refresh token to obtain a new access token.

## Response Format

### Success Response
```json
{
  "id": "uuid",
  "name": "resource name",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Error Response
```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "code": 400,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Endpoints

### Authentication (`/auth`)

#### Register
Create a new user account.

```
POST /auth/register
Content-Type: application/json
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123",
  "full_name": "John Doe"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "email_verified": false,
    "status": "active",
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-15T10:30:00Z"
  },
  "tokens": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "expires_at": 1705321200
  }
}
```

**Errors:**
- `409 Conflict` — Email already registered
- `400 Bad Request` — Invalid password (must be 8+ chars)

---

#### Login
Authenticate user and receive tokens.

```
POST /auth/login
Content-Type: application/json
```

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Response (200):**
```json
{
  "user": { ... },
  "tokens": {
    "access_token": "eyJhbGc...",
    "refresh_token": "eyJhbGc...",
    "expires_at": 1705321200
  }
}
```

**Errors:**
- `401 Unauthorized` — Invalid credentials
- `401 Unauthorized` — Account suspended or deleted

---

#### Refresh Token
Get a new access token using a refresh token.

```
POST /auth/refresh
Content-Type: application/json
```

**Request:**
```json
{
  "refresh_token": "eyJhbGc..."
}
```

**Response (200):**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "expires_at": 1705321200
}
```

**Errors:**
- `401 Unauthorized` — Invalid or expired refresh token

---

#### Logout
Revoke the refresh token.

```
POST /auth/logout
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "refresh_token": "eyJhbGc..."
}
```

**Response (204):** No content

---

#### Get Current User
Fetch the authenticated user's profile.

```
GET /auth/me
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "email_verified": false,
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `401 Unauthorized` — Invalid token
- `404 Not Found` — User not found

---

#### Change Password
Change the user's password.

```
PUT /auth/password
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "current_password": "OldPassword123",
  "new_password": "NewPassword456"
}
```

**Response (204):** No content

**Errors:**
- `401 Unauthorized` — Current password incorrect
- `400 Bad Request` — New password too short

---

#### Delete Account
Permanently delete the user account (GDPR).

```
DELETE /auth/me
Authorization: Bearer <access_token>
```

**Response (204):** No content

All user data (profiles, licenses, team memberships, sync data) is soft-deleted.

---

#### Export User Data
Export all personal data as JSON (GDPR).

```
POST /auth/me/export
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "user": { ... },
  "exported_at": "2024-01-15T10:30:00Z"
}
```

---

#### Resend Verification Email
Request a new verification email.

```
POST /auth/verify-email/resend
Authorization: Bearer <access_token>
```

**Response (204):** No content

---

### Licenses (`/licenses`)

#### Activate License
Activate a license key on a machine.

```
POST /licenses/activate
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "license_key": "GHOST-XXXX-XXXX-XXXX-XXXX",
  "machine_id": "sha256_hash_of_mac_addresses"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "license_key": "GHOST-XXXX-XXXX-XXXX-XXXX",
  "plan": "pro",
  "max_profiles": 100,
  "max_team_members": 10,
  "cloud_sync_enabled": true,
  "activated_at": "2024-01-15T10:30:00Z",
  "valid_until": "2025-01-15T23:59:59Z",
  "status": "active",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `404 Not Found` — License key not found
- `409 Conflict` — License already expired
- `401 Unauthorized` — You do not own this license

---

#### Fetch Current License
Get the user's active license.

```
GET /licenses/current
Authorization: Bearer <access_token>
```

**Response (200):** License object (see above)

**Response (200):** `null` if no active license

---

#### Deactivate License
Deactivate the current license.

```
POST /licenses/deactivate
Authorization: Bearer <access_token>
```

**Response (204):** No content

---

#### List License Devices
List all devices activated under the license.

```
GET /licenses/devices
Authorization: Bearer <access_token>
```

**Response (200):**
```json
[
  {
    "id": "uuid",
    "license_id": "uuid",
    "machine_id": "sha256...",
    "machine_name": "MacBook Pro",
    "activated_at": "2024-01-15T10:30:00Z",
    "last_used_at": "2024-01-20T14:45:00Z",
    "is_current": true
  }
]
```

---

#### Deactivate Device
Deactivate a specific device (remotely).

```
POST /licenses/devices/deactivate
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "machine_id": "sha256..."
}
```

**Response (204):** No content

**Errors:**
- `400 Bad Request` — Cannot deactivate current device (use deactivate license instead)

---

### Cloud Sync (`/profiles/sync`)

#### Push Profiles
Upload encrypted profile bundle to server.

```
POST /profiles/sync/push
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request:**
```json
{
  "data": "base64_encoded_encrypted_bundle",
  "checksum": "sha256_hex_of_plaintext",
  "profile_count": 15
}
```

**Response (204):** No content

**Errors:**
- `400 Bad Request` — Invalid checksum format
- `413 Payload Too Large` — Bundle exceeds size limit

---

#### Pull Profiles
Download encrypted profile bundle from server.

```
GET /profiles/sync/pull
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "data": "base64_encoded_encrypted_bundle",
  "checksum": "sha256_hex_of_plaintext"
}
```

**Errors:**
- `404 Not Found` — No sync data available for user

---

#### Get Sync Manifest
Fetch metadata about user's sync state (profile count, last sync).

```
GET /profiles/sync/manifest
Authorization: Bearer <access_token>
```

**Response (200):**
```json
{
  "profile_ids": ["id1", "id2", "id3"],
  "profile_count": 15,
  "last_synced_at": "2024-01-20T14:45:00Z"
}
```

**Response (200):** `null` if no sync data yet

---

### Health Checks

#### Liveness Probe
Check if server is running.

```
GET /health/live
```

**Response (200):**
```json
{
  "status": "alive",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

#### Readiness Probe
Check if server is ready to handle requests.

```
GET /health/ready
```

**Response (200):**
```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

---

## Team Endpoints (Coming Soon)

The following endpoints are planned for Phase 2:

- `POST /team` — Create team
- `GET /team` — Fetch team
- `PUT /team` — Update team
- `DELETE /team` — Delete team
- `GET /team/members` — List members
- `PUT /team/members/:userId` — Update member role
- `DELETE /team/members/:userId` — Remove member
- `POST /team/invites` — Send invite
- `GET /team/invites` — List invites
- `DELETE /team/invites/:inviteId` — Cancel invite
- `POST /team/invites/:inviteId/accept` — Accept invite
- `POST /team/profiles/share` — Share profile
- `GET /team/profiles/shared` — List shared profiles
- `DELETE /team/profiles/share` — Unshare profile
- `GET /team/audit` — Audit log

---

## Error Codes Reference

| Code | Status | Meaning |
|------|--------|---------|
| `bad_request` | 400 | Invalid request data |
| `validation_error` | 400 | Request validation failed |
| `unauthorized` | 401 | Missing or invalid authentication |
| `forbidden` | 403 | Insufficient permissions |
| `not_found` | 404 | Resource not found |
| `conflict` | 409 | Resource already exists |
| `rate_limit_exceeded` | 429 | Too many requests |
| `internal_error` | 500 | Server error |

---

## Rate Limiting

API endpoints are rate-limited per user and per IP:

- **Auth endpoints:** 5 failed attempts per 15 minutes
- **Sync endpoints:** 10 operations per hour per user
- **Other endpoints:** 100 requests per hour per user

Rate limit info is included in response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1705408200
```

---

## Pagination

List endpoints support pagination with `page` and `limit` query parameters:

```
GET /team/audit?page=1&limit=20
```

Response includes metadata:
```json
{
  "data": [...],
  "total": 150,
  "page": 1,
  "limit": 20,
  "pages": 8
}
```

---

## Webhooks (Coming Soon)

Webhooks for event notifications:
- License activation/expiration
- Team member additions/removals
- Profile sharing changes
- Sync history updates

---

## SDKs

Official SDK libraries (coming soon):
- **Node.js/TypeScript** — `@ghostbrowser/api-client`
- **Python** — `ghostbrowser-api`
- **Go** — `ghostbrowser-go`

---

## Support

- **Issues:** GitHub Issues in parent repository
- **Email:** support@ghostbrowser.app
- **Slack:** Join community on Slack (link in app)
