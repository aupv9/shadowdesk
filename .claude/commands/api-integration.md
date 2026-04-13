# Ghost Browser API Integration

Review or implement backend API features using Ghost Browser's HTTP client and authentication patterns.

## Quick Reference

**HTTP Client**: Axios with token auth, auto-refresh, retry logic  
**Key Files**: `src/main/api-client.ts`, `src/main/auth.ts`  
**Authentication**: JWT tokens (access + refresh)  
**Base URL**: `https://api.ghostbrowser.io/v1` (via `VITE_API_URL` env)

---

## API Client Setup

```typescript
// src/main/api-client.ts
class APIClient {
  private token?: string
  private refreshToken?: string
  
  async request(method: string, path: string, data?: any): Promise<any> {
    // 1. Validate token (refresh if needed)
    if (!this.token) {
      await this.refresh()
    }
    
    // 2. Make request with Bearer token
    try {
      return await axios({
        method,
        url: `${API_URL}${path}`,
        data,
        headers: { Authorization: `Bearer ${this.token}` }
      })
    } catch (e: any) {
      // 3. Auto-retry on 401 (token expired)
      if (e.response?.status === 401 && this.refreshToken) {
        await this.refresh()
        return axios({
          method, url, data,
          headers: { Authorization: `Bearer ${this.token}` }
        })
      }
      throw e
    }
  }
  
  async refresh(): Promise<void> {
    const res = await axios.post(`${API_URL}/auth/refresh`, {
      refreshToken: this.refreshToken
    })
    
    this.token = res.data.accessToken
    this.refreshToken = res.data.refreshToken  // rotated
  }
}
```

---

## Authentication Flow

### Register

```typescript
async function register(email: string, password: string, name: string) {
  const res = await apiClient.post('/auth/register', {
    email, password, name
  })
  
  // Response: { user, accessToken, refreshToken }
  const { user, accessToken, refreshToken } = res.data
  
  // Store tokens in memory + secure storage
  saveTokens(accessToken, refreshToken)
  
  return user
}
```

### Login

```typescript
async function login(email: string, password: string) {
  const res = await apiClient.post('/auth/login', {
    email, password
  })
  
  const { user, accessToken, refreshToken } = res.data
  saveTokens(accessToken, refreshToken)
  
  return user
}
```

### Logout

```typescript
async function logout() {
  try {
    await apiClient.post('/auth/logout')
  } finally {
    // Clear tokens even if request fails
    clearTokens()
  }
}
```

---

## Token Management

**Access Token Lifecycle**:
- **Duration**: 15 minutes
- **Usage**: Every API request (`Authorization: Bearer <token>`)
- **Storage**: In-memory (cleared on app restart)

**Refresh Token Lifecycle**:
- **Duration**: 7 days
- **Usage**: Obtain new access token when expired
- **Storage**: Secure disk storage + DB backup
- **Rotation**: Each refresh returns a new refresh token (old one invalidated)

**Token Refresh Trigger**:
```typescript
// Auto-refresh on 401
catch (e) {
  if (e.response?.status === 401) {
    await apiClient.refresh()
    // Retry original request
  }
}

// Or manual check before request
if (shouldRefresh(expiresAt)) {
  await apiClient.refresh()
}
```

---

## Profile API

### List Profiles

```typescript
GET /profiles?limit=50&offset=0

Response: {
  profiles: Profile[],
  total: number
}
```

```typescript
const res = await apiClient.get('/profiles?limit=50&offset=0')
const { profiles, total } = res.data
```

### Get Profile

```typescript
GET /profiles/:id

Response: { profile: Profile }
```

### Create Profile

```typescript
POST /profiles

Body: {
  name: string
  fingerprintPreset: string  // 'win10-chrome120', etc.
  groupId?: string
  proxyId?: string
  notes?: string
}

Response: { profile: Profile }
```

```typescript
const res = await apiClient.post('/profiles', {
  name: 'My Profile',
  fingerprintPreset: 'win10-chrome120',
  groupId: 'group-1'
})

const { profile } = res.data
```

### Update Profile

```typescript
PUT /profiles/:id

Body: {
  name?: string
  fingerprint?: FingerprintConfig
  proxyId?: string | null
  notes?: string
  localOnly?: boolean  // sync opt-out
}

Response: { profile: Profile }
```

### Delete Profile

```typescript
DELETE /profiles/:id

Response: { ok: true }
```

### Launch Profile

```typescript
POST /profiles/:id/launch

Body: {
  proxyId?: string
  extensions?: string[]
}

Response: {
  port: number,
  wsUrl: string,
  pid: number
}
```

---

## Workflow API

### Create Workflow

```typescript
POST /workflows

Body: {
  name: string
  description?: string
  steps: AutomationStep[]
  variables?: Record<string, string>
  templateId?: string
}

Response: { workflow: Workflow }
```

### Execute Workflow

```typescript
POST /workflows/:id/run

Body: {
  profileIds: string[]
  variables?: Record<string, any>
  concurrency?: number  // default 1
}

Response: {
  executionId: string
} (HTTP 202 Accepted)
```

### Get Last Execution

```typescript
GET /workflows/:id/runs/last

Response: {
  execution: WorkflowExecution
}
```

### Export Execution Results

```typescript
GET /workflows/:id/runs/export?format=csv&status=completed

Response: CSV/JSON stream (file download)
```

---

## Detection Test API

### Run Test

```typescript
POST /profiles/:id/detection-test

Response: {
  testId: string
} (HTTP 202 Accepted, async)
```

### Get Test Result

```typescript
GET /detection-tests/:id

Response: {
  test: {
    id: string
    profileId: string
    tested_at: number
    overall_score: number  // 0-100
    vectors: {
      name: string
      status: 'pass' | 'warn' | 'fail'
      score: number
    }[]
  }
}
```

### List Profile Tests

```typescript
GET /profiles/:id/detection-tests?limit=20&offset=0

Response: {
  tests: DetectionTest[],
  total: number
}
```

---

## Captcha API

### Get Balance

```typescript
POST /captcha/balance

Body: {
  provider: '2captcha' | 'anticaptcha' | 'capmonster'
}

Response: {
  balance: number,
  currency: string  // 'USD', etc.
}
```

### Solve Captcha

```typescript
POST /captcha/solve

Body: {
  provider: string
  captchaType: 'reCAPTCHA_v2' | 'reCAPTCHA_v3' | 'hCaptcha' | 'image'
  captchaParams: {
    websiteURL: string
    websiteKey: string
    // or other params depending on type
  }
}

Response: {
  taskId: string
}

// Poll for result
GET /captcha/result/:taskId

Response: {
  status: 'processing' | 'completed' | 'error',
  result?: string,
  error?: string
}
```

---

## Error Handling

**Common HTTP Status Codes**:

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Use response data |
| 201 | Created | Use response data |
| 202 | Accepted | Poll for completion |
| 400 | Bad request | Validate input, show error |
| 401 | Unauthorized | Refresh token, retry |
| 403 | Forbidden | User lacks permission |
| 404 | Not found | Resource doesn't exist |
| 429 | Rate limited | Implement backoff |
| 500 | Server error | Retry with exponential backoff |

**Error Response Format**:
```typescript
{
  error: {
    code: 'VALIDATION_ERROR' | 'AUTH_FAILED' | 'NOT_FOUND' | ...
    message: string
    details?: Record<string, string>  // field-level errors
  }
}
```

**Error Handling Pattern**:
```typescript
try {
  const res = await apiClient.post('/profiles', data)
  return res.data.profile
} catch (e: any) {
  if (e.response?.status === 400) {
    const { details } = e.response.data.error
    if (details?.name) {
      throw new Error(`Invalid name: ${details.name}`)
    }
  }
  if (e.response?.status === 401) {
    throw new Error('Session expired. Please log in again.')
  }
  throw new Error(e.response?.data?.error?.message || e.message)
}
```

---

## Retry Logic

**Built-in retry for network errors**:

```typescript
const MAX_RETRIES = 3
const BACKOFF = [1000, 2000, 4000]  // ms

async function requestWithRetry(fn: () => Promise<any>): Promise<any> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      return await fn()
    } catch (e: any) {
      const isNetworkError = !e.response || e.response.status >= 500
      const isRateLimited = e.response?.status === 429
      
      if ((isNetworkError || isRateLimited) && i < MAX_RETRIES - 1) {
        await sleep(BACKOFF[i])
        continue
      }
      throw e
    }
  }
}
```

---

## Rate Limiting

**Recommended limits** (per user):
- 100 requests/minute for read operations
- 10 requests/minute for write operations
- 1 request/second for streaming endpoints

**Handling rate limit (429)**:
```typescript
if (e.response?.status === 429) {
  const retryAfter = parseInt(e.response.headers['retry-after'] || '60')
  console.log(`Rate limited. Retry after ${retryAfter}s`)
  
  await sleep(retryAfter * 1000)
  // Retry request
}
```

---

## Webhook Triggers

**Workflow webhook**:
```bash
POST /api/webhooks/workflows/:workflowId/run

{
  "profileIds": ["profile-1"],
  "variables": { "myVar": "value" }
}

Response: 202 Accepted
{ "executionId": "exec-uuid" }
```

**Polling endpoint** (for webhook confirmation):
```bash
GET /api/workflows/:workflowId/runs/last

Response:
{
  "execution": {
    "id": "exec-uuid",
    "status": "completed",
    "stepsResult": { ... }
  }
}
```

---

## API Client Usage Examples

### With Zustand Store

```typescript
// stores/profileStore.ts
export const useProfileStore = create((set) => ({
  profiles: [],
  loading: false,
  error: null,
  
  loadProfiles: async () => {
    set({ loading: true, error: null })
    try {
      const res = await apiClient.get('/profiles?limit=50')
      set({ profiles: res.data.profiles })
    } catch (e: any) {
      set({ error: e.message })
    } finally {
      set({ loading: false })
    }
  },
  
  createProfile: async (input) => {
    try {
      const res = await apiClient.post('/profiles', input)
      set((state) => ({
        profiles: [res.data.profile, ...state.profiles]
      }))
      return res.data.profile
    } catch (e) {
      set({ error: e.message })
      throw e
    }
  }
}))
```

### In React Component

```typescript
function ProfileList() {
  const { profiles, loading, error, loadProfiles } = useProfileStore()
  
  useEffect(() => {
    loadProfiles()
  }, [])
  
  if (loading) return <div>Loading...</div>
  if (error) return <div className="text-red-500">{error}</div>
  
  return (
    <div>
      {profiles.map(p => (
        <div key={p.id}>{p.name}</div>
      ))}
    </div>
  )
}
```

---

## Configuration

**Environment Variables**:
```bash
VITE_API_URL=https://api.ghostbrowser.io/v1
VITE_SYNC_WS_URL=wss://sync.ghostbrowser.io
```

**Custom Headers**:
```typescript
apiClient.setHeader('X-App-Version', '1.0.0')
apiClient.setHeader('X-Client-ID', machineFingerprint)
```

---

## Debugging

**Log all requests**:
```typescript
// In api-client.ts
private async request(method, path, data) {
  console.log(`[API] ${method.toUpperCase()} ${path}`, data)
  const res = await axios(...)
  console.log(`[API] → ${res.status}`, res.data)
  return res
}
```

**Monitor network tab**: DevTools → Network → filter by API domain
