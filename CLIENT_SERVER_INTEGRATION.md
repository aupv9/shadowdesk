# Ghost Browser — Client-Server Integration Guide

## Architecture Overview

The Ghost Browser platform consists of two main components:

1. **Client** (`/src/renderer` + `/src/main`) — Electron desktop application
2. **Server** (`../shadowdesk-backend`) — Node.js/Fastify REST API

## Communication Flow

```
┌─────────────────┐
│  Electron App   │
│   (Client)      │
└────────┬────────┘
         │
         │ HTTP/HTTPS
         │ JWT Auth
         ▼
┌─────────────────┐
│  REST API       │
│  (Server)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  PostgreSQL DB  │
│  Redis Cache    │
└─────────────────┘
```

## Authentication Flow

### 1. User Registration

```
Client                          Server
  │                               │
  ├─ POST /auth/register ────────►│
  │  {email, name, password}     │
  │                              ├─ Hash password (bcrypt)
  │                              ├─ Create user record
  │                              ├─ Generate tokens
  │◄───── 201 Created ───────────┤
  │  {user, tokens}              │
  │                              │
  ├─ Save tokens locally ◄───────┤
  │  (auth-tokens.json)          │
```

### 2. User Login

```
Client                          Server
  │                               │
  ├─ POST /auth/login ───────────►│
  │  {email, password}           │
  │                              ├─ Find user
  │                              ├─ Verify password
  │                              ├─ Generate tokens
  │◄───── 200 OK ────────────────┤
  │  {user, tokens}              │
  │                              │
  ├─ Save tokens locally         │
  ├─ Start polling for updates   │
```

### 3. Token Refresh

When access token expires:

```
Client                          Server
  │                               │
  ├─ Token expired              │
  │                              │
  ├─ POST /auth/refresh ────────►│
  │  {refresh_token}            │
  │                              ├─ Validate refresh token
  │                              ├─ Generate new access token
  │◄───── 200 OK ────────────────┤
  │  {accessToken, expiresAt}    │
  │                              │
  ├─ Update stored token        │
  ├─ Retry original request     │
```

## API Integration Points

### Auth Endpoints (`src/main/auth.ts`)

Maps to server endpoints:

```typescript
// src/main/auth.ts → server /api/v1/auth

login(email, password)
  → POST /auth/login

register(email, name, password)
  → POST /auth/register

getCurrentUser()
  → GET /auth/me

updatePassword(currentPwd, newPwd)
  → PUT /auth/password

updateProfile(updates)
  → PUT /auth/me

deleteAccount()
  → DELETE /auth/me

logout()
  → POST /auth/logout
```

### Team Endpoints (`src/main/team.ts`)

Maps to server endpoints:

```typescript
// src/main/team.ts → server /api/v1/team

createTeam(name)
  → POST /team

getTeam()
  → GET /team

updateTeam(updates)
  → PUT /team

deleteTeam()
  → DELETE /team

listMembers()
  → GET /team/members

addMember(email, role)
  → POST /team/members

updateMember(userId, role)
  → PUT /team/members/{userId}

removeMember(userId)
  → DELETE /team/members/{userId}

listInvites()
  → GET /team/invites

acceptInvite(inviteId)
  → POST /team/invites/{inviteId}/accept
```

### Profile Sync (`src/main/sync.ts`)

Maps to server endpoints:

```typescript
// src/main/sync.ts → server /api/v1/profiles/sync

pushProfiles(encryptedData)
  → POST /profiles/sync/push
  // Body: {data: string, checksum: string}

pullProfiles()
  → GET /profiles/sync/pull
  // Returns: {data: string, checksum: string}

getSyncManifest()
  → GET /profiles/sync/manifest

getSyncLogs()
  → GET /profiles/sync/logs
```

### License Endpoints (`src/main/license.ts`)

Maps to server endpoints:

```typescript
// src/main/license.ts → server /api/v1/licenses

activateLicense(licenseKey)
  → POST /licenses/activate

getCurrentLicense()
  → GET /licenses/current

deactivateLicense()
  → POST /licenses/deactivate

getDevices()
  → GET /licenses/devices

deactivateDevice(fingerprint)
  → POST /licenses/devices/deactivate
```

## Request/Response Format

### Standard Success Response

```json
{
  "status": "success",
  "data": {
    // Response payload
  }
}
```

### Standard Error Response

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "statusCode": 400,
  "details": {
    // Optional validation errors
  }
}
```

## Authentication Headers

All authenticated requests must include:

```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

## Data Encryption (Cloud Sync)

### Push Flow (Client → Server)

```
1. Client gets profile JSON
   {profiles: [...], profiles_metadata: {...}}

2. Client generates encryption key from master password
   key = PBKDF2(masterPassword, salt, iterations)

3. Client encrypts with AES-256-GCM
   {iv, ciphertext, authTag} = AES256GCM.encrypt(data, key)

4. Client computes checksum
   checksum = SHA256(ciphertext)

5. Client POSTs encrypted data
   POST /profiles/sync/push
   {
     data: base64(iv + ciphertext + authTag),
     checksum: checksum
   }

6. Server stores encrypted blob (cannot read)
   - Cannot decrypt without master password
   - Can verify checksum for integrity
   - Creates audit log entry
```

### Pull Flow (Server → Client)

```
1. Client requests profiles
   GET /profiles/sync/pull

2. Server returns encrypted blob
   {
     data: base64(iv + ciphertext + authTag),
     checksum: checksum
   }

3. Client verifies checksum
   if (SHA256(ciphertext) !== checksum)
     throw IntegrityError()

4. Client decrypts with master password
   key = PBKDF2(masterPassword, salt, iterations)
   plaintext = AES256GCM.decrypt(ciphertext, key, iv, authTag)

5. Client parses and merges profiles
   local_profiles.merge(decrypted_profiles)
```

## State Synchronization

### Client-Side State (Zustand Stores)

```typescript
// src/renderer/src/stores/
authStore      // Login state, tokens
profileStore   // Local profiles, active sessions
proxyStore     // Proxy list
licenseStore   // License plan, usage
teamStore      // Team info, members
syncStore      // Cloud sync status
```

### Server-Side State (PostgreSQL)

```sql
-- Users table: authentication state
-- Teams table: team metadata
-- Profiles table: shared profile definitions
-- Licenses table: license/plan info
-- Audit logs: all operations
-- Sync logs: cloud sync history
```

### Sync Strategy

When user opens client:

```
1. Load saved tokens from disk
2. Verify tokens with GET /auth/me
3. If valid:
   - Fetch team data from GET /team
   - Fetch profiles from GET /profiles/sync/manifest
   - Compare local vs. server version
4. If token expired:
   - Refresh with POST /auth/refresh
   - Retry original request
5. If token invalid:
   - Redirect to login
```

## Concurrency Handling

### Conflict Resolution for Cloud Sync

```
Scenario: Two devices push profiles simultaneously

Device A                    Server                    Device B
  │                           │                         │
  ├─ Push v1 ───────────────►│                         │
  │                           ├─ Store v1              │
  │                           │                         │
  │                          │◄─ Push v2 ──────────────┤
  │                           │                         │
  │                           ├─ Detect conflict       │
  │                           │  (both pushing)        │
  │                           │                         │
  │◄─ Conflict Response ──────┤                         │
  │                           ├─ Return v2 ────────────►│
```

Resolution: Server returns manifest version number. Higher version wins.

## Error Handling

### Client-Side Error Handling

```typescript
// src/main/api-client.ts

async apiRequest(path, options) {
  if (authenticated && isTokenExpired()) {
    // Auto-refresh token
    const tokens = await refreshAccessToken()
    if (!tokens) {
      // Token refresh failed, redirect to login
      redirectToLogin()
      return
    }
  }

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  if (response.status === 401) {
    // Unauthorized, clear tokens
    clearTokens()
    redirectToLogin()
  } else if (response.status === 429) {
    // Rate limited, show toast notification
    pushToast('Too many requests, please try again later', 'error')
  } else if (response.status >= 500) {
    // Server error
    pushToast('Server error, please try again later', 'error')
  }

  return response.json()
}
```

### Server-Side Error Handling

```typescript
// src/routes/auth.ts

try {
  const result = await authService.login(email, password)
  reply.status(200).send({user: result.user, tokens: result.tokens})
} catch (error) {
  if (error.message === 'Invalid email or password') {
    reply.status(401).send({
      error: 'authentication_failed',
      message: error.message
    })
  } else {
    reply.status(500).send({
      error: 'internal_server_error',
      message: 'An unexpected error occurred'
    })
  }
}
```

## Rate Limiting

Both client and server implement rate limiting:

### Server-Side

```
POST /auth/login:    5 attempts / 15 minutes (IP-based)
POST /auth/register: 3 attempts / 1 hour (IP-based)
General endpoints:   100 requests / minute (IP-based)
Authenticated:       1000 requests / minute (User-based)
```

### Client-Side

```typescript
// Exponential backoff for retries
const delays = [1000, 2000, 4000, 8000] // ms

async function retryWithBackoff(fn, maxAttempts = 4) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxAttempts - 1) throw error
      await sleep(delays[i])
    }
  }
}
```

## Deployment Architecture

### Development Environment

```
localhost:5173  ← Electron Dev Server (React)
       ↓
localhost:3000  ← Node.js API
       ↓
localhost:5432  ← PostgreSQL
localhost:6379  ← Redis
```

### Production Environment

```
https://app.ghostbrowser.app    ← Electron App
                 ↓
https://api.ghostbrowser.app    ← Production API
                 ↓
PostgreSQL (RDS/Managed)
Redis (Elasticache/Managed)
CloudFront/CDN (caching)
```

## Environment Configuration

### Client (.env)

```env
VITE_API_URL=https://api.ghostbrowser.app
```

### Server (.env)

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
CORS_ORIGIN=https://app.ghostbrowser.app
JWT_SECRET=...
```

## Monitoring & Debugging

### Client Logging

```typescript
// Logs stored in:
// macOS: ~/Library/Logs/ghost-browser.log
// Windows: %APPDATA%\Ghost Browser\logs\
// Linux: ~/.config/Ghost Browser/logs/

// Enable debug logging:
window.localStorage.setItem('DEBUG', 'ghostbrowser:*')
```

### Server Logging

```bash
# View logs
docker-compose logs -f api

# Filter by level
docker-compose logs api | grep ERROR
docker-compose logs api | grep WARN
```

### Monitoring Endpoints

```
GET /health              # Service health check
GET /api/version         # API version info
GET /api/v1/audit        # Audit logs (team-scoped)
```

## Testing Integration

### End-to-End Testing

```typescript
// Example test
describe('Auth Flow', () => {
  it('should register, login, and access protected resource', async () => {
    // Register
    const registerRes = await api.post('/auth/register')
      .send({email: 'test@example.com', name: 'Test', password: 'Pass123!'})
    expect(registerRes.status).toBe(201)

    // Login
    const loginRes = await api.post('/auth/login')
      .send({email: 'test@example.com', password: 'Pass123!'})
    expect(loginRes.status).toBe(200)

    // Use token
    const meRes = await api.get('/auth/me')
      .set('Authorization', `Bearer ${loginRes.body.tokens.accessToken}`)
    expect(meRes.status).toBe(200)
  })
})
```

## Troubleshooting Integration Issues

### 401 Unauthorized

- Check token is included in request
- Verify token hasn't expired
- Try refreshing token
- Clear auth tokens and re-login

### 403 Forbidden

- User doesn't have permission for this resource
- Check team membership
- Verify user role

### CORS Errors

- Check CORS_ORIGIN in server .env
- Ensure client URL is whitelisted
- Verify Content-Type header

### Network Errors

- Check API_BASE_URL in client config
- Verify server is running
- Check firewall/network connectivity
- Enable request logging

## Security Best Practices

1. **Token Storage**
   - Never store in localStorage (XSS vulnerable)
   - Use secure file storage (client does this)
   - Rotate refresh tokens

2. **HTTPS Only**
   - All production requests over HTTPS
   - Enable HSTS header

3. **Password Security**
   - Never log passwords
   - Bcrypt hashing (12 rounds)
   - Rate limit login attempts

4. **Data Encryption**
   - E2E encryption for cloud sync
   - AES-256-GCM algorithm
   - Master password as encryption key

5. **API Security**
   - Input validation (Zod)
   - Rate limiting
   - CORS whitelist
   - JWT signature verification

## Next Steps

1. **Implement remaining endpoints** (Teams, Profiles, Licenses, Sync, Detection)
2. **Add comprehensive tests** (unit, integration, e2e)
3. **Setup CI/CD pipeline** (GitHub Actions)
4. **Deploy to staging** for testing
5. **Configure monitoring** (Datadog, Sentry)
6. **Setup database backups** and disaster recovery
7. **Launch to production**
