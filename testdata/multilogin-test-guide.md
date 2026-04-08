# Multi-Login Testing Guide for Ghost Browser

## Overview
This guide will help you verify Ghost Browser's multi-login effectiveness using the generated test data.

## What is Multi-Login Testing?
Multi-login testing validates that Ghost Browser can:
- ✅ Launch multiple independent browser profiles simultaneously
- ✅ Each profile maintains separate identity (fingerprint, cookies, storage)
- ✅ No data leakage between sessions
- ✅ Proxies work correctly for each profile
- ✅ Each profile appears as unique user to servers

## Test Data Files
The following files are generated in `testdata/` directory:

### 1. `multilogin-groups.json`
Profile groups for organization:
- E-commerce Testing (Blue)
- Social Media Testing (Red)
- Geo-Testing (Green)

### 2. `multilogin-proxies.json`
5 Proxy servers from different countries:
```json
{
  "name": "USA - New York",
  "country": "US",
  "host": "proxy-ny.example.com",
  "port": 8080,
  "username": "user_ny",
  "password": "pass_ny_123"
}
```

### 3. `multilogin-profiles.json`
5 Unique profiles with different:
- Operating Systems (Windows 10, Windows 11, macOS, Linux, Android)
- Browser versions (Chrome 120, 121)
- Screen resolutions
- Hardware specs
- Timezones

Example:
```json
{
  "id": "profile-uuid",
  "name": "WIN10-CHROME120 - Account 1",
  "fingerprint": { /* full fingerprint config */ },
  "proxy_id": "proxy-uuid",
  "status": "active"
}
```

### 4. `multilogin-credentials.json`
Test account credentials for each profile:
```json
{
  "id": "cred-uuid",
  "profile_id": "profile-uuid",
  "username": "john.doe.us@gmail.com",
  "password": "SecurePass123!",
  "service": "Gmail",
  "description": "US-based Gmail account"
}
```

## Testing Scenarios

### Scenario 1: Basic Multi-Session Launch
**Goal**: Verify 5 profiles can run simultaneously without data leakage

```bash
Steps:
1. Start Profile 1 (WIN10-CHROME120)
2. Start Profile 2 (WIN11-CHROME121)
3. Start Profile 3 (MAC-SONOMA-CHROME121)
4. Start Profile 4 (LINUX-UBUNTU-CHROME120)
5. Start Profile 5 (ANDROID-SAMSUNG-CHROME120)
6. All windows should be open and responsive
```

**Verification**:
- ✓ All 5 windows launch without errors
- ✓ Each window responds to input independently
- ✓ No crashes or hangs
- ✓ CPU/Memory usage is reasonable

---

### Scenario 2: IP Address Verification
**Goal**: Each profile appears from different IP address

```bash
Steps for each profile:
1. Launch profile
2. Navigate to: https://whatismyipaddress.com
3. Record the IP address
4. Note the country/city
5. Verify matches proxy country
```

**Expected Results**:
```
Profile 1: 1.1.1.1 (USA - New York)
Profile 2: 2.2.2.2 (UK - London)
Profile 3: 3.3.3.3 (Vietnam - Ho Chi Minh)
Profile 4: 4.4.4.4 (Thailand - Bangkok)
Profile 5: 5.5.5.5 (Indonesia - Jakarta)
```

---

### Scenario 3: Fingerprint Isolation
**Goal**: Verify each profile has unique, consistent fingerprint

```bash
Tools:
- https://browserleaks.com
- https://whoer.net
- https://deviceinfo.me

Steps:
1. Launch Profile 1
2. Visit browserleaks.com
3. Record all detection results
4. Close Profile 1
5. Wait 30 seconds
6. Launch Profile 1 again
7. Visit browserleaks.com
8. Verify fingerprint is IDENTICAL to first session
```

**Detection Vectors to Check**:
- ✓ User Agent String
- ✓ Platform/OS
- ✓ Screen Resolution
- ✓ Hardware Concurrency
- ✓ Device Memory
- ✓ Canvas Fingerprint
- ✓ WebGL Fingerprint
- ✓ Audio Fingerprint
- ✓ Timezone
- ✓ Language

---

### Scenario 4: Account Login Test
**Goal**: Verify multiple accounts can stay logged in simultaneously

```bash
Steps:
1. Launch Profile 1 (Gmail - john.doe.us@gmail.com)
2. Launch Profile 2 (Outlook - alice.smith.uk@outlook.com)
3. In Profile 1: Login to Gmail with john.doe.us@gmail.com
4. In Profile 2: Login to Outlook with alice.smith.uk@outlook.com
5. Keep both sessions open for 5 minutes
6. Verify no session cross-contamination
```

**Verification**:
- ✓ Profile 1 stays logged in as john.doe.us
- ✓ Profile 2 stays logged in as alice.smith.uk
- ✓ Switching between windows shows correct accounts
- ✓ No unexpected logouts
- ✓ Each profile's cookies/storage is isolated

---

### Scenario 5: Cookie Isolation Test
**Goal**: Verify cookies don't leak between profiles

```bash
Steps:
1. Launch Profile 1
2. Visit: https://www.amazon.com
3. Login with test account from Profile 1
4. In browser console, run:
   console.log(document.cookie)
5. Note some cookies like "ubid-main", "session-id"
6. Switch to Profile 2
7. Visit: https://www.amazon.com
8. In console, run:
   console.log(document.cookie)
9. Verify DIFFERENT cookies
```

**Expected**:
- Profile 1 has: ubid-main=xxx, session-id=yyy
- Profile 2 has: ubid-main=zzz, session-id=www
- **No overlap!**

---

### Scenario 6: WebRTC Leak Detection
**Goal**: Ensure WebRTC doesn't leak real IP

```bash
Steps:
1. Launch Profile 1
2. Visit: https://browserleaks.com/webrtc
3. Should show ONLY the proxy IP
4. Should NOT show your real machine IP

Repeat for all 5 profiles
```

**Expected Result**:
- All WebRTC IPs match proxy country
- No real IP exposed

---

### Scenario 7: Concurrent Profile Stress Test
**Goal**: Test system stability with all profiles running simultaneously

```bash
Steps:
1. Launch all 5 profiles
2. In each profile window, open 5 tabs
3. Navigate each tab to different website
4. Wait 5 minutes
5. Switch between windows
6. Monitor resource usage
```

**Success Criteria**:
- ✓ All windows remain responsive
- ✓ No crashes after 5 minutes
- ✓ CPU usage < 80%
- ✓ Memory usage < 4GB total
- ✓ No tab crashes

---

### Scenario 8: Profile Switching Performance
**Goal**: Measure launch/switch speed

```bash
Steps:
1. Close all profiles
2. Time from clicking "Launch Profile 1" to window ready
3. Record time
4. Time from clicking "Launch Profile 2" to window ready
5. Record time
6. Repeat for all 5
7. Calculate average launch time
```

**Expected Performance**:
- Launch time: < 10 seconds per profile
- Switch time: < 2 seconds
- Total 5-profile launch: < 50 seconds

---

## Testing Matrix

| Test | Profile 1 | Profile 2 | Profile 3 | Profile 4 | Profile 5 | Status |
|------|-----------|-----------|-----------|-----------|-----------|--------|
| Launch | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| IP Test | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| Fingerprint (1st) | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| Fingerprint (2nd) | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| Cookie Isolation | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| WebRTC Check | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| Login Test | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |
| Concurrent | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | ✓/✗ | |

---

## Common Issues & Solutions

### Issue 1: All profiles get same IP
**Cause**: Proxy not configured or failed
**Solution**:
- Check proxy credentials in test data
- Test proxy connectivity: `curl -x proxy-ny.example.com:8080 https://whatismyipaddress.com`
- Verify proxy server is online

### Issue 2: Fingerprints change between sessions
**Cause**: Random seeds in fingerprint config
**Solution**:
- Check that `noiseSeed` is deterministic (not random per session)
- Verify profile UUID is consistent
- Seeds should hash from UUID for consistency

### Issue 3: Cookies leak between profiles
**Cause**: Shared user-data-dir or cookie storage
**Solution**:
- Verify each profile has unique `user_data_path`
- Check that Chromium profiles are isolated
- Monitor file system: `ls -la ~/.ghost-browser/profiles/`

### Issue 4: WebRTC leaks real IP
**Cause**: STUN servers returning real IP
**Solution**:
- Verify WebRTC is disabled in fingerprint
- Check IP leak sites show only proxy IP
- Use browser console: `navigator.mediaDevices.enumerateDevices()`

---

## Performance Benchmarks

For successful multi-login, aim for these targets:

```
Memory per profile: 200-300 MB
CPU per profile: 5-15% (idle), 20-30% (active)
Launch time: < 10 seconds
Response time: < 500ms
Concurrent stability: 5+ hours
```

---

## Reporting Results

Create a test report with:
1. ✓/✗ for each scenario
2. Screenshots of successful tests
3. Logs from console/DevTools
4. Performance metrics
5. Any errors or issues found

Example report file:
```
MULTILOGIN_TEST_RESULTS_2024-04-08.md

## Summary
✓ Scenario 1: PASS
✓ Scenario 2: PASS
✗ Scenario 3: FAIL (Fingerprint changed between sessions)
✓ Scenario 4: PASS
✗ Scenario 5: FAIL (Cookie leakage detected)
...

## Details
### Scenario 3 Failure
- First session fingerprint: [data]
- Second session fingerprint: [data]
- Difference: noiseSeed was randomized

### Scenario 5 Failure
- Profile 1 cookie: ubid-main=1234
- Profile 2 cookie: ubid-main=1234
- Issue: Cookies not isolated
```

---

## Next Steps

After completing all tests:

1. **Success** ✓
   - Document which vectors work best
   - Set benchmarks for CI/CD
   - Use profiles in production

2. **Failures** ✗
   - Open GitHub issues
   - Provide logs and screenshots
   - Include test environment info

3. **Optimization**
   - Fine-tune fingerprint presets
   - Optimize launch performance
   - Add more edge case tests

---

**Test Data Generated**: 2024-04-08  
**Profiles Available**: 5  
**Proxies Available**: 5  
**Test Credentials**: 5  
**Estimated Test Time**: 2-3 hours
