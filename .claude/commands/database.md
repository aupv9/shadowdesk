# Ghost Browser Database Layer

Review or implement database features using Ghost Browser's sql.js wrapper and schema patterns.

## Quick Reference

**Technology**: sql.js (SQLite in WASM)  
**File**: `src/main/database.ts`  
**Initialization**: Async at app startup, sync queries after  
**Persistence**: Auto-saves to `userData/db.sqlite` after every write

---

## Database Initialization

```typescript
// In main/index.ts (startup)
async function initializeApp() {
  const db = Database.getInstance()
  await db.initialize()  // WASM load, schema creation
  
  // Now IPC handlers can use:
  const profile = db.getProfile(id)  // synchronous
}
```

**Schema Creation** (in `initialize()`):
```typescript
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  fingerprint TEXT NOT NULL,  -- JSON string
  proxy_id TEXT,
  created_at INTEGER NOT NULL,
  ...
)

CREATE INDEX idx_profiles_user_id ON profiles(user_id)
```

---

## Query Patterns

### SELECT

```typescript
// Single row
const profile = db.exec(
  'SELECT * FROM profiles WHERE id = ?',
  [id]
)[0]

// Multiple rows
const profiles = db.exec(
  'SELECT * FROM profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
  [userId, limit, offset]
)

// Aggregate
const count = db.exec(
  'SELECT COUNT(*) as count FROM profiles WHERE user_id = ?',
  [userId]
)[0].count
```

### INSERT

```typescript
db.run(
  'INSERT INTO profiles (id, user_id, name, fingerprint, created_at) VALUES (?, ?, ?, ?, ?)',
  [uuid(), userId, 'My Profile', JSON.stringify(fp), Date.now()]
)

// Auto-saves to disk after run()
```

### UPDATE

```typescript
db.run(
  'UPDATE profiles SET name = ?, updated_at = ? WHERE id = ?',
  ['New Name', Date.now(), id]
)
```

### DELETE

```typescript
db.run(
  'DELETE FROM profiles WHERE id = ?',
  [id]
)
```

### TRANSACTION

```typescript
db.exec('BEGIN')
try {
  db.run('INSERT INTO profiles ...')
  db.run('INSERT INTO audit_log ...')
  db.exec('COMMIT')
} catch (e) {
  db.exec('ROLLBACK')
  throw e
}
```

---

## Parameter Types

**Positional parameters only** (not named):
- `?` — placeholder for any value

```typescript
// GOOD
db.run('INSERT INTO x (a, b) VALUES (?, ?)', [10, 'text'])

// BAD (not supported)
db.run('INSERT INTO x (a, b) VALUES (:a, :b)', { a: 10, b: 'text' })
```

**Type handling**:
- Number: stored as-is
- String: stored as-is
- Boolean: convert to 0/1
- Date: convert to ISO string or timestamp
- JSON: `JSON.stringify()` before insert, `JSON.parse()` after select
- NULL: pass `null`

---

## Common Operations

### Create Profile

```typescript
function createProfile(userId: string, input: ProfileInput): Profile {
  const id = generateUUID()
  const now = Date.now()
  
  db.run(
    'INSERT INTO profiles (id, user_id, name, fingerprint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, userId, input.name, JSON.stringify(input.fingerprint), now, now]
  )
  
  // Fetch and return
  return getProfile(id)!
}
```

### Update Profile

```typescript
function updateProfile(id: string, input: Partial<ProfileInput>): Profile {
  const updates: string[] = []
  const values: any[] = []
  
  if (input.name !== undefined) {
    updates.push('name = ?')
    values.push(input.name)
  }
  
  if (input.fingerprint !== undefined) {
    updates.push('fingerprint = ?')
    values.push(JSON.stringify(input.fingerprint))
  }
  
  updates.push('updated_at = ?')
  values.push(Date.now())
  values.push(id)
  
  db.run(
    `UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`,
    values
  )
  
  return getProfile(id)!
}
```

### List with Pagination

```typescript
function listProfiles(userId: string, limit = 50, offset = 0): { profiles: Profile[]; total: number } {
  const profiles = db.exec(
    'SELECT * FROM profiles WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
    [userId, limit, offset]
  ).map(parseProfile)
  
  const [{ total }] = db.exec(
    'SELECT COUNT(*) as total FROM profiles WHERE user_id = ?',
    [userId]
  )
  
  return { profiles, total }
}
```

### Delete with Cascade

```typescript
function deleteProfile(profileId: string): void {
  db.exec('BEGIN')
  try {
    // Delete dependent records first
    db.run('DELETE FROM profile_versions WHERE profile_id = ?', [profileId])
    db.run('DELETE FROM detection_tests WHERE profile_id = ?', [profileId])
    
    // Then the main record
    db.run('DELETE FROM profiles WHERE id = ?', [profileId])
    
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
```

### Batch Insert

```typescript
function createProxies(userId: string, proxies: ProxyInput[]): Proxy[] {
  db.exec('BEGIN')
  try {
    proxies.forEach(p => {
      db.run(
        'INSERT INTO proxies (id, user_id, name, host, port, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [generateUUID(), userId, p.name, p.host, p.port, p.type, Date.now()]
      )
    })
    db.exec('COMMIT')
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
  
  return listProxies(userId).proxies
}
```

---

## Schema Reference

### profiles
```sql
id (TEXT, PK)
user_id (TEXT, FK users)
name (TEXT)
group_id (TEXT, FK groups)
fingerprint (TEXT, JSON)
proxy_id (TEXT, FK proxies)
cookies (TEXT, JSON)
notes (TEXT)
last_used_at (INTEGER)
created_at (INTEGER)
updated_at (INTEGER)
user_data_path (TEXT)
status (TEXT: 'active'|'inactive')
extensions (TEXT, JSON array)
warm_up_completed (BOOLEAN)
warm_up_list (TEXT, JSON array)
local_only (BOOLEAN, sync opt-out)
```

### workflows
```sql
id (TEXT, PK)
user_id (TEXT, FK users)
name (TEXT)
description (TEXT)
steps (TEXT, JSON array)
variables (TEXT, JSON object)
template_id (TEXT)
created_at (INTEGER)
updated_at (INTEGER)
```

### workflow_executions
```sql
id (TEXT, PK)
workflow_id (TEXT, FK workflows)
profile_ids (TEXT, JSON array)
status (TEXT: 'running'|'completed'|'error')
steps_result (TEXT, JSON)
variables (TEXT, JSON)
concurrency (INTEGER)
started_at (INTEGER)
completed_at (INTEGER)
```

### detection_tests
```sql
id (TEXT, PK)
profile_id (TEXT, FK profiles)
profile_name (TEXT)
tested_at (INTEGER)
overall_score (INTEGER: 0-100)
vectors (TEXT, JSON array of { vector, status, score })
status (TEXT: 'completed'|'error')
```

### audit_log
```sql
id (TEXT, PK)
user_id (TEXT, FK users)
user_name (TEXT)
action (TEXT: 'launch'|'create'|'delete'|'export'|...)
target_id (TEXT)
target_name (TEXT)
ip_address (TEXT)
timestamp (INTEGER)
```

---

## Performance Tips

1. **Index frequently queried columns**:
   ```typescript
   CREATE INDEX idx_profiles_user_id ON profiles(user_id)
   CREATE INDEX idx_workflows_user_id ON workflows(user_id)
   ```

2. **Paginate large result sets**: Always use `LIMIT ? OFFSET ?`

3. **Lazy-load JSON**: Only parse fingerprint when needed
   ```typescript
   // Don't: fetch all fingerprints
   const profiles = db.exec('SELECT * FROM profiles').map(p => ({
     ...p,
     fingerprint: JSON.parse(p.fingerprint)  // expensive!
   }))
   
   // Do: defer parsing
   const profiles = db.exec('SELECT id, name FROM profiles')
   const fullProfile = {
     ...profiles[0],
     fingerprint: JSON.parse(db.getProfile(profiles[0].id).fingerprint)
   }
   ```

4. **Batch operations in transaction**:
   ```typescript
   db.exec('BEGIN')
   for (let i = 0; i < 1000; i++) {
     db.run('INSERT INTO x VALUES (?)', [i])
   }
   db.exec('COMMIT')  // Single flush to disk
   ```

5. **Cleanup old data**: Archive execution history >30 days old
   ```typescript
   db.run('DELETE FROM workflow_executions WHERE completed_at < ?', 
     [Date.now() - 30 * 24 * 60 * 60 * 1000])
   ```

---

## Error Handling

```typescript
try {
  db.run('INSERT INTO profiles ...', values)
} catch (e: any) {
  if (e.message.includes('UNIQUE constraint failed')) {
    throw new Error(`Profile with name "${name}" already exists`)
  }
  if (e.message.includes('NOT NULL constraint failed')) {
    throw new Error('Required field missing')
  }
  throw e  // Re-throw unknown errors
}
```

---

## Debugging

**Enable query logging**:
```typescript
// src/main/database.ts
private exec(sql: string, params?: any[]) {
  console.log(`[DB] ${sql}`, params)
  const result = this.db.exec(sql, params)
  console.log(`[DB] → result:`, result)
  return result
}
```

**Inspect database**:
```bash
sqlite3 ~/.config/ghostbrowser/db.sqlite
> .tables
> .schema profiles
> SELECT * FROM profiles LIMIT 5;
> .exit
```

---

## Migration Checklist

When adding a new table:

1. Add schema in `database.ts` → `initialize()`
2. Add type in `shared/types.ts`
3. Create CRUD methods (get, list, create, update, delete)
4. Register IPC handlers in `ipc/handlers.ts`
5. Create Zustand store in `renderer/src/stores/`
6. Build UI components
7. Test via `npm run dev`
