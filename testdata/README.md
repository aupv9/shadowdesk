# Multi-Login Testing Setup for Ghost Browser

## Quick Start

### 1. Generate Test Data

```bash
npm run test:multilogin:generate
```

This creates:
- `testdata/multilogin-groups.json` - 3 profile groups
- `testdata/multilogin-proxies.json` - 5 proxies (USA, UK, Vietnam, Thailand, Indonesia)
- `testdata/multilogin-profiles.json` - 5 profiles with different fingerprints
- `testdata/multilogin-credentials.json` - Test account credentials

### 2. Run Automated Tests

```bash
npm run test:multilogin:run
```

This validates:
- ✓ Data integrity
- ✓ Fingerprint consistency
- ✓ Proxy configuration
- ✓ Group assignments
- ✓ Credential mappings
- ✓ Proxy-profile relationships

### 3. Manual Testing

See **multilogin-test-guide.md** for detailed manual testing procedures.

---

## Generated Data Structure

### Profiles (multilogin-profiles.json)

5 unique profiles with different configurations:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "WIN10-CHROME120 - Account 1",
  "group_id": "e1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6",
  "fingerprint": {
    "preset": "win10-chrome120",
    "os": { "platform": "Win32", "version": "10.0.0" },
    "browser": {
      "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36...",
      "version": "120",
      "languages": ["en-US", "en"]
    },
    "screen": { "width": 1920, "height": 1080, ... },
    "hardware": { "deviceMemory": 8, "hardwareConcurrency": 8, ... },
    "locale": { "timezone": "America/New_York", ... },
    "canvas": { "mode": "noise" },
    "webgl": { "mode": "noise" },
    "audio": { "mode": "noise" }
  },
  "proxy_id": "f0e1d2c3-b4a5-96e7-f8d9-c0b1a2e3f4d5",
  "status": "active",
  "created_at": "2024-04-08T10:30:00Z"
}
```

**Profiles by Preset:**
1. WIN10-CHROME120 - Windows 10, Chrome 120
2. WIN11-CHROME121 - Windows 11, Chrome 121
3. MAC-SONOMA-CHROME121 - macOS Sonoma, Chrome 121
4. LINUX-UBUNTU-CHROME120 - Linux Ubuntu, Chrome 120
5. ANDROID-SAMSUNG-CHROME120 - Android, Samsung Chrome 120

### Proxies (multilogin-proxies.json)

```json
{
  "id": "f0e1d2c3-b4a5-96e7-f8d9-c0b1a2e3f4d5",
  "name": "USA - New York",
  "type": "http",
  "host": "proxy-ny.example.com",
  "port": 8080,
  "username": "user_ny",
  "password": "pass_ny_123",
  "country": "US",
  "latency_ms": 45,
  "is_healthy": true,
  "last_checked_at": "2024-04-08T10:30:00Z",
  "created_at": "2024-04-08T10:30:00Z"
}
```

**Available Proxies:**
- 🇺🇸 USA - New York
- 🇬🇧 UK - London
- 🇻🇳 Vietnam - Ho Chi Minh
- 🇹🇭 Thailand - Bangkok
- 🇮🇩 Indonesia - Jakarta

### Groups (multilogin-groups.json)

```json
{
  "id": "e1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6",
  "name": "E-commerce Testing",
  "color": "#3b82f6",
  "created_at": "2024-04-08T10:30:00Z"
}
```

**Groups:**
- 🔵 E-commerce Testing (Blue)
- 🔴 Social Media Testing (Red)
- 🟢 Geo-Testing (Green)

### Credentials (multilogin-credentials.json)

```json
{
  "id": "a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6",
  "profile_id": "550e8400-e29b-41d4-a716-446655440000",
  "username": "john.doe.us@gmail.com",
  "password": "SecurePass123!",
  "service": "Gmail",
  "description": "US-based Gmail account"
}
```

**Available Credentials:**
1. john.doe.us@gmail.com (Gmail, USA)
2. alice.smith.uk@outlook.com (Outlook, UK)
3. vietnam.user.2024@gmail.com (Gmail, Vietnam)
4. bangkok.seller@email.com (Custom, Thailand)
5. jakarta.entrepreneur@mail.com (Custom, Indonesia)

---

## Testing Workflow

### Step 1: Verify Installation
```bash
# Check Ghost Browser is running
npm run dev

# In another terminal:
npm run test:multilogin:generate
```

### Step 2: Check Generated Data
```bash
# View profiles
cat testdata/multilogin-profiles.json | jq '.[0]'

# View proxies
cat testdata/multilogin-proxies.json | jq '.[] | {name, country}'

# View credentials
cat testdata/multilogin-credentials.json | jq '.[0]'
```

### Step 3: Run Automated Tests
```bash
npm run test:multilogin:run
```

Expected output:
```
============================================================
Ghost Browser Multi-Login Test Suite
============================================================

🧪 Test: Data Integrity
✓ profiles: PASS
✓ proxies: PASS
✓ credentials: PASS
✓ profileCount: PASS
✓ proxyCount: PASS
✓ uniqueIds: PASS

🧪 Test: Fingerprint Consistency
✓ WIN10-CHROME120 - Account 1: PASS
✓ WIN11-CHROME121 - Account 2: PASS
...

Test Summary
============================================================
✓ Passed: 30
✗ Failed: 0
⏱ Duration: 2.45s
📊 Pass Rate: 100.0%
```

### Step 4: Manual Testing

For each profile, verify:
1. **Launch**: Opens without errors
2. **IP Address**: Correct country from proxy
3. **Fingerprint**: Consistent between sessions
4. **Cookies**: Isolated from other profiles
5. **Performance**: Responsive and stable

See **multilogin-test-guide.md** for detailed procedures.

### Step 5: Analyze Results

Results are saved to `testdata/multilogin-test-results-YYYY-MM-DD.json`

```bash
# View test results
cat testdata/multilogin-test-results-2024-04-08.json | jq '.[] | {profile, test, passed}'

# Count failures
cat testdata/multilogin-test-results-2024-04-08.json | jq '[.[] | select(.passed == false)] | length'
```

---

## Integration with Ghost Browser

### Importing Profiles via IPC

```typescript
// In renderer process
const profiles = await window.api.profiles.import(
  JSON.parse(fs.readFileSync('testdata/multilogin-profiles.json'))
)

const proxies = await window.api.proxies.create(
  JSON.parse(fs.readFileSync('testdata/multilogin-proxies.json'))
)
```

### Creating Test Workflow

```typescript
// Launch all 5 profiles
for (const profile of profiles) {
  await window.api.browser.launch(profile.id)
}

// Verify isolation
const session1 = await window.api.browser.getInfo(profiles[0].id)
const session2 = await window.api.browser.getInfo(profiles[1].id)

// Should have different process IDs, IPs, fingerprints
console.assert(session1.pid !== session2.pid)
console.assert(session1.ip !== session2.ip)
```

---

## Troubleshooting

### Test Data Not Generated?

```bash
# Check for errors
npm run test:multilogin:generate 2>&1 | head -20

# Verify UUID module is installed
npm ls uuid

# Regenerate with verbose output
rm -rf testdata/*.json
npm run test:multilogin:generate
```

### Proxies Show as Unhealthy?

```bash
# Test proxy connectivity manually
curl -x proxy-ny.example.com:8080 https://whatismyipaddress.com

# Check credentials
# username: user_ny
# password: pass_ny_123
```

### Profiles Not Launching?

- Verify `fingerprint` JSON is valid: `cat testdata/multilogin-profiles.json | jq '.[0].fingerprint' | jq empty`
- Check `user_data_path` directories are accessible
- Verify Chrome/Chromium is installed

### Fingerprints Changing Between Sessions?

Check that `noiseSeed` values are:
- Consistent (not random)
- Deterministic based on profile UUID
- Same for each profile between launches

```bash
# Compare fingerprints
jq '.[0].fingerprint.canvas' testdata/multilogin-profiles.json
# Should show: { "mode": "noise", "noiseSeed": 0 }
```

---

## Performance Benchmarks

Targeting these metrics for successful multi-login:

| Metric | Target |
|--------|--------|
| Profile Launch Time | < 10 seconds |
| Memory per Profile | 200-300 MB |
| CPU per Profile | 5-15% idle |
| Concurrent Profiles | 5+ stable |
| Session Duration | 5+ hours |
| Data Isolation | 100% |

Run benchmarks:
```bash
# Time profile launches
time npm run test:multilogin:run

# Monitor resources
watch -n 1 'ps aux | grep -i ghost'
```

---

## Extending Test Data

### Add More Profiles

Edit `scripts/generate-multilogin-testdata.ts`:

```typescript
const fingerprintPresets = {
  'ios-iphone15-safari17': { /* iOS fingerprint */ },
  // Add more presets...
}
```

### Add More Proxies

Add to `proxyDataTemplate`:

```typescript
{
  name: 'Singapore - Singapore',
  country: 'SG',
  host: 'proxy-sg.example.com',
  port: 8080,
  username: 'user_sg',
  password: 'pass_sg_999'
}
```

### Custom Credentials

Modify `testCredentialsTemplate`:

```typescript
{
  username: 'your-test@domain.com',
  password: 'YourTestPass123!',
  service: 'YourService',
  description: 'Custom test account'
}
```

Then regenerate:
```bash
npm run test:multilogin:generate
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Multi-Login Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: npm install
      - run: npm run test:multilogin:generate
      - run: npm run test:multilogin:run
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-results
          path: testdata/multilogin-test-results-*.json
```

---

## Documentation Files

- **README.md** - This file, setup & overview
- **multilogin-test-guide.md** - Detailed manual testing procedures
- **multilogin-profiles.json** - Profile test data
- **multilogin-proxies.json** - Proxy test data
- **multilogin-credentials.json** - Account test data
- **multilogin-test-results-YYYY-MM-DD.json** - Test results

---

## Support

For issues:
1. Check **multilogin-test-guide.md** troubleshooting section
2. Review test results: `cat testdata/multilogin-test-results-*.json`
3. Enable debug logging: `DEBUG=* npm run test:multilogin:run`
4. Open GitHub issue with test results and environment info

---

**Generated**: 2024-04-08  
**Test Data Version**: 1.0  
**Profiles**: 5  
**Proxies**: 5  
**Credentials**: 5  
**Estimated Test Time**: 2-3 hours
