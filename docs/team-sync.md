# Team Features & Cloud Sync

## Team Workspace

### Roles

| Role | Permissions |
|------|------------|
| `admin` | Full access: manage members, invites, shared profiles, team settings |
| `editor` | Launch profiles, run automation, read audit log |
| `viewer` | View profiles and shared data only |

### Member Management

```typescript
// Invite member
await window.api.team.invite('user@example.com', 'editor')

// List pending invites
const invites = await window.api.team.invites()
// [{ id, email, role, invited_by, created_at, expires_at, status }]

// Cancel invite
await window.api.team.cancelInvite(inviteId)

// Update member role
await window.api.team.updateMemberRole(userId, 'viewer')

// Remove member
await window.api.team.removeMember(userId)
```

### Profile Sharing

```typescript
// Share a profile with members
await window.api.team.shareProfile(profileId, [memberId1, memberId2], 'read')
// permission: 'read' | 'write'

// List all shared profiles
const shared = await window.api.team.sharedProfiles()

// Unshare
await window.api.team.unshareProfile(profileId, memberId)
```

### Audit Log

All significant actions are recorded with user identity, target, and timestamp.

**Tracked actions:**
- `profile:launch`, `profile:create`, `profile:delete`, `profile:export`
- `team:invite`, `team:remove`
- `settings:update`

```typescript
const log = await window.api.team.auditLog({
  page: 1,
  limit: 50,
  user_id: 'filter-by-user',     // optional
  action: 'profile:launch'       // optional
})
```

---

## Cloud Sync

### Encryption

All synced data is encrypted **client-side** before upload. The server never sees plaintext.

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-256-GCM |
| Key derivation | `scryptSync(password, salt, 32)` |
| Nonce/IV | 12 bytes, random per sync |
| Auth tag | 16 bytes |
| Payload format | `[IV (12B)] [authTag (16B)] [ciphertext]` |
| Integrity | SHA-256 checksum on manifest |

### Sync Operations

```typescript
// Push local profiles to cloud (encrypted)
await window.api.sync.push('encryption-password')

// Pull profiles from cloud (decrypted)
await window.api.sync.pull('encryption-password')

// Get current sync status
const status = await window.api.sync.status()
// { status: 'idle'|'syncing'|'error'|'offline'|'disabled', last_synced_at, pending_changes }

// Get sync manifest (profile list + checksum)
const manifest = await window.api.sync.manifest()
```

### Plan Requirements

Cloud sync is available on **Starter**, **Professional**, and **Enterprise** plans.
Free plan accounts cannot push or pull.

---

## License Plans

| Plan | Max Profiles | Max Members | Cloud Sync |
|------|-------------|-------------|------------|
| Free | 5 | 1 | No |
| Starter | 50 | 3 | Yes |
| Professional | 500 | 15 | Yes |
| Enterprise | Unlimited | Unlimited | Yes |

### Activating a License

```typescript
// Activate by key
const license = await window.api.license.activate('XXXX-XXXX-XXXX-XXXX')

// Get current license
const current = await window.api.license.current()
// { id, plan, max_profiles, max_team_members, cloud_sync_enabled, valid_until, machine_id }

// Check if profile creation is allowed
const { allowed, reason } = await window.api.license.checkProfileLimit()

// Get usage
const usage = await window.api.license.usage()
// { profiles: number, members: number }
```

### Machine Fingerprint

Each activation is tied to the machine it runs on. The fingerprint is a hash of:
- Network interface MAC addresses
- CPU model string

```typescript
const machineId = await window.api.license.machineId()
```
