# Phase 25 — Provider Accounts UX Enhancements

> Proposal to add missing conveniences and bulk operations to Provider Accounts

## Overview

Provider Accounts (Phase 20) has a solid foundation: all 4 adapters work, credentials are secure, proxy generation succeeds, and the UI is functional. However, it lacks several conveniences that would make it production-grade. This proposal suggests 5 high-impact enhancements, each taking 20–40 minutes.

## Enhancement 1: Edit Account Modal ⭐ (Highest Priority)

### Problem
Users cannot modify account settings after creation without deleting and re-adding. If a user enters the wrong API key or wants to change session type, they must delete the account and lose history.

### Solution
Add an **Edit Modal** similar to the Proxy Manager's edit flow.

### Implementation (25 min)
```tsx
function EditProviderModal({
  account,
  catalog,
  onSave,
  onCancel,
}: {...}) {
  // Form state for label, endpoint, port, defaultSession
  // Password field optional (clear = remove)
  // API key field (for providers with usage API)
  // Validation: endpoint required, port 1-65535
  // Credentials update triggers immediate test
}
```

### Changes Required
1. Add to ProviderPanel.tsx state: `const [editAccount, setEditAccount] = useState<ProxyProviderAccountView | null>(null)`
2. New edit modal component (reuse UpdateProviderInput pattern from backend)
3. Button on account row: "⋯" menu or dedicated edit icon
4. Update handler: `proxyProviders:update` already exists, just needs UI

### Wire-up
- Store has `updateAccount()` already ✅
- IPC handler `proxyProviders:update` already exists ✅
- Just needs UI modal

---

## Enhancement 2: Filter & Search ⭐ (High Priority)

### Problem
With many accounts, users want to find specific ones quickly.

### Solution
Add filter dropdown above account list.

### Implementation (15 min)
```tsx
const [filterType, setFilterType] = useState<ProxyProviderType | 'all'>('all')
const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'invalid'>('all')
const [searchText, setSearchText] = useState('')

const filtered = accounts.filter(a =>
  (filterType === 'all' || a.type === filterType) &&
  (filterStatus === 'all' || a.status === filterStatus) &&
  a.label.toLowerCase().includes(searchText)
)
```

### UI
- **Search box** (top of accounts list, search by label)
- **Provider type filter** (dropdown: All / Smartproxy / BrightData / Oxylabs / Custom)
- **Status filter** (dropdown: All / Active / Invalid)

---

## Enhancement 3: Bulk Account Operations ⭐ (High Priority)

### Problem
Testing 5 accounts requires clicking "Test" 5 times and waiting between each.

### Solution
Add multi-select checkboxes + bulk actions toolbar.

### Implementation (30 min)
```tsx
const [selected, setSelected] = useState<Set<string>>(new Set())
const [testingBatch, setTestingBatch] = useState(false)

const handleTestBatch = async () => {
  setTestingBatch(true)
  const results = await Promise.allSettled(
    Array.from(selected).map(id => testAccount(id))
  )
  setTestingBatch(false)
  // Show summary toast
}
```

### UI
- Checkbox on each account row
- "Select all" checkbox in header
- Bulk actions bar appears when selected > 0:
  - `[N selected] [Test All] [Delete] [Clear]`
- Visual highlight on selected accounts

---

## Enhancement 4: Credential Validation Before Save ⭐ (Medium Priority)

### Problem
Users submit credentials, account is created, but then fails on first test. Better to validate upfront.

### Solution
Add "Test Connection" button in AddProviderForm that validates before submit.

### Implementation (20 min)
```tsx
const [testingPreSubmit, setTestingPreSubmit] = useState(false)
const [preSubmitError, setPreSubmitError] = useState<string | null>(null)

const handleTestBeforeSubmit = async () => {
  setTestingPreSubmit(true)
  try {
    // Call adapter.testConnection() with current form values
    setPreSubmitError(null)
  } catch (err) {
    setPreSubmitError(err.message)
  } finally {
    setTestingPreSubmit(false)
  }
}
```

### UI
- "Test Connection" button next to "Connect Account"
- Shows result inline: ✅ Connected or ❌ Failed
- Only allows submit if test passes

---

## Enhancement 5: Last Used Country Persistence ⭐ (Low Priority)

### Problem
Users frequently generate proxies from the same country but have to re-select each time.

### Solution
Save user's last selected country in localStorage.

### Implementation (10 min)
```tsx
const lastCountry = localStorage.getItem('provider:lastCountry') || 'VN'
useEffect(() => {
  localStorage.setItem('provider:lastCountry', country)
}, [country])
```

### Benefits
- Reduces friction for power users
- 90% of users probably target same region repeatedly

---

## Enhancement 6: Account Export/Import (Bonus - Phase 26)

### Problem
Users can't backup account credentials or move accounts between machines.

### Solution
Add "Export" button (downloads encrypted JSON) and "Import" button.

### Implementation (40 min)
- Export: Encrypt credentials again with user-provided password
- Import: Parse JSON, decrypt, validate, re-encrypt with master key
- Show in "⋯" menu on each account

---

## Implementation Roadmap

### Week 1 (Phase 25.A)
1. Edit Modal ✅ (20 min)
2. Filter & Search ✅ (15 min)
3. Bulk Operations ✅ (30 min)
4. **Total: 65 minutes**

### Week 2 (Phase 25.B)
1. Credential Validation ✅ (20 min)
2. Last Used Country ✅ (10 min)
3. **Total: 30 minutes**

### Week 3 (Phase 25.C / Phase 26)
1. Usage Analytics Dashboard (60 min)
2. Connection Health Monitoring (45 min)
3. Account Export/Import (40 min)

---

## Backend Requirements

All backend support is **already implemented** ✅:
- `proxyProviders:update` handler exists
- Database updateProxyProvider() exists
- Adapters can test connections
- No new IPC handlers needed

---

## Testing Checklist (Phase 25.A)

### Edit Modal
- [ ] Click edit on account → Modal opens with current values
- [ ] Change label, endpoint, port → Values update
- [ ] Change default session → Sticky duration appears
- [ ] Clear API key → Refreshed state updates
- [ ] Test on save → If test fails, don't close modal
- [ ] Cancel → Changes discarded

### Filter & Search
- [ ] Search "smart" → Shows only Smartproxy accounts
- [ ] Filter by Active status → Shows only active accounts
- [ ] Filter by provider type → Shows only selected type
- [ ] Combine filters → Works as AND logic
- [ ] Clear filter → Shows all accounts

### Bulk Operations
- [ ] Check boxes → Row highlights
- [ ] Select all → All rows highlighted
- [ ] Test all → Progress indicator, all tests run
- [ ] Delete all → Confirmation, all deleted
- [ ] Deselect clears button toolbar

### Pre-submit Validation
- [ ] Click "Test Connection" with invalid creds → Error shown
- [ ] Fix creds, click again → ✅ Connected shows
- [ ] Can only submit after successful test

### Last Used Country
- [ ] Select Vietnam in generate modal
- [ ] Close modal, open again → Vietnam pre-selected
- [ ] Select Thailand → Persists on reload

---

## Estimated User Impact

| Enhancement | Frequency | Time Saved | Pain Points Resolved |
|---|---|---|---|
| Edit Modal | Every account change | 3 min/change | Delete & re-add friction |
| Filter & Search | Daily (3-5 accounts) | 30 sec/day | Hard to find account |
| Bulk Test | Weekly | 2 min/session | Manual clicking tedium |
| Pre-submit Validation | Every new account | 1 min | Delayed error feedback |
| Last Used Country | 90% of sessions | 10 sec/session | Repetitive selection |

---

## Effort Breakdown

| Feature | Design | Implementation | Testing | Total |
|---|---|---|---|---|
| Edit Modal | 5 min | 20 min | 5 min | **30 min** |
| Filter & Search | 5 min | 15 min | 5 min | **25 min** |
| Bulk Operations | 10 min | 30 min | 10 min | **50 min** |
| Pre-submit Validation | 5 min | 15 min | 5 min | **25 min** |
| Last Used Country | 0 min | 10 min | 5 min | **15 min** |
| **Total Phase 25** | **25 min** | **90 min** | **30 min** | **145 min (2.4 hrs)** |

---

## Recommendation

**Implement 1-3 in Week 1, 4-5 in Week 2.** These are all UI-only enhancements with zero backend risk. Edit Modal is the highest ROI.

**Do NOT implement** until Provider Accounts is tested in production for 1-2 weeks to ensure adapters are stable.
