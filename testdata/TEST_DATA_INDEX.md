# Ghost Browser Test Data Index

Complete reference for all generated test data files.

## 📦 Test Data Sets

### Multi-Login Testing
**Purpose:** Verify multi-profile isolation and fingerprint consistency

| File | Records | Purpose |
|------|---------|---------|
| `multilogin-profiles.json` | 5 | Browser profiles with unique fingerprints |
| `multilogin-proxies.json` | 5 | Proxy servers (USA, UK, Vietnam, Thailand, Indonesia) |
| `multilogin-groups.json` | 3 | Profile organization groups |
| `multilogin-credentials.json` | 5 | Test account credentials |
| `multilogin-test-guide.md` | - | Manual testing procedures (8 scenarios) |
| `multilogin-test-results-*.json` | - | Test execution results |

**Quick Commands:**
```bash
npm run test:multilogin:generate    # Create data
npm run test:multilogin:run         # Validate data
npm run test:multilogin             # Both
```

**Results:** ✅ 31/31 tests passed (100% success)

---

### Automation Testing
**Purpose:** Test RPA workflows and automation actions

| File | Records | Purpose |
|------|---------|---------|
| `automation-workflows.json` | 9 | Complete automation workflows |
| `workflow-profile-mapping.json` | 9 | Workflow-to-profile assignments |
| `AUTOMATION_GUIDE.md` | - | Workflow documentation (9 workflows detailed) |
| `automation-test-results-*.json` | - | Execution logs with step details |
| `automation-test-report-*.json` | - | Summary reports |

**Quick Commands:**
```bash
npm run test:automation:generate    # Create workflows
npm run test:automation:run         # Execute tests
npm run test:automation             # Both
```

**Results:** ✅ 8/9 workflows successful, 97.9% step success rate

---

## 🎯 Available Workflows

### 1. Simple Page Navigation (4 steps)
Navigate to website → wait → screenshot → log

### 2. Form Filling & Submission (8 steps)
Navigate → fill fields → validate → submit → wait

### 3. Conditional Login Flow (3 steps)
Navigate → conditional check (if logged in) → screenshot

### 4. Loop - Scrape Products (2 steps)
Navigate → loop through items → extract data

### 5. Multi-Step Search & Filter (9 steps)
Search → apply filters → extract results → screenshot

### 6. API Call & Data Processing (6 steps)
Call API → process response → fill form → submit

### 7. Error Handling & Retry (3 steps)
Navigate (with retries) → wait → condition

### 8. Social Media Follow & Like (4 steps)
Navigate → scroll → loop interactions

### 9. Data Entry & Validation (9 steps)
Register form → fill → validate → submit → wait

---

## 📊 Test Coverage

### Profiles (5 total)
- WIN10-CHROME120 (Windows 10, 1920x1080)
- WIN11-CHROME121 (Windows 11, 2560x1440)
- MAC-SONOMA-CHROME121 (macOS, Retina)
- LINUX-UBUNTU-CHROME120 (Ubuntu, 1920x1080)
- ANDROID-SAMSUNG-CHROME120 (Android 13)

### Proxies (5 total)
- 🇺🇸 USA - New York (Latency: 20-80ms)
- 🇬🇧 UK - London (Latency: 20-80ms)
- 🇻🇳 Vietnam - Ho Chi Minh (Latency: 20-80ms)
- 🇹🇭 Thailand - Bangkok (Latency: 20-80ms)
- 🇮🇩 Indonesia - Jakarta (Latency: 20-80ms)

### Action Types (14 total)
navigate, click, fill, wait, extract, condition, loop, screenshot, scroll, keyboard, http, log, delay, assert, api_call, js_execute, close_tab

---

## 📈 Performance Metrics

### Multi-Login Tests
```
Total Tests: 31
Passed: 31
Failed: 0
Success Rate: 100%
Duration: ~2 seconds
```

### Automation Tests
```
Total Workflows: 9
Successful: 8
Partial: 1
Workflow Success: 88.9%
Step Success: 97.9% (47/48)
Duration: ~5 seconds
```

---

## 🔄 Data Relationships

```
Profile (5)
├─ Fingerprint Config
├─ Proxy (1)
├─ Group (1)
└─ Credentials (1)
    └─ Service Account

Workflow (9)
├─ Steps (48 total)
│  ├─ Action Type
│  ├─ Selector
│  └─ Parameters
└─ Profiles (mapped)
```

---

## 🛠️ Usage Examples

### Import Profiles
```typescript
import profiles from './multilogin-profiles.json'
profiles.forEach(p => {
  console.log(`${p.name} → ${p.proxy_id}`)
})
```

### List Workflows
```bash
cat automation-workflows.json | jq '.[] | {name, steps: (.steps | length)}'
```

### Check Test Results
```bash
cat automation-test-report-*.json | jq '.summary'
```

### Count Action Types
```bash
cat automation-workflows.json | jq '.[].steps[].type' | sort | uniq -c
```

---

## 📋 File Sizes

| File | Size | Type |
|------|------|------|
| multilogin-profiles.json | 11 KB | JSON |
| automation-workflows.json | ~100 KB | JSON |
| multilogin-proxies.json | 2.0 KB | JSON |
| workflow-profile-mapping.json | 2 KB | JSON |
| automation-guide.md | ~50 KB | Markdown |
| multilogin-test-guide.md | ~60 KB | Markdown |

**Total:** ~230 KB (very lightweight!)

---

## ✅ Validation Checklist

- ✓ All profiles have unique IDs
- ✓ All proxies are configured
- ✓ All credentials mapped to profiles
- ✓ All workflows have steps
- ✓ All action types are valid
- ✓ Selectors are reasonable
- ✓ Timeouts are specified
- ✓ Error handling configured

---

## 🚀 Running Everything

```bash
# Generate all test data
npm run test:multilogin:generate
npm run test:automation:generate

# Run all tests
npm run test:multilogin:run
npm run test:automation:run

# Or one command
npm run test:all
```

---

## 📝 Documentation Files

| File | Purpose |
|------|---------|
| README.md | Setup & overview |
| multilogin-test-guide.md | Multi-login manual tests |
| AUTOMATION_GUIDE.md | Workflow documentation |
| TEST_DATA_INDEX.md | This file |

---

## 🔗 Quick Links

- **[Multi-Login Guide](multilogin-test-guide.md)** - Manual testing procedures
- **[Automation Guide](AUTOMATION_GUIDE.md)** - Workflow details
- **[Setup Guide](README.md)** - Getting started

---

## 💡 Pro Tips

1. **Explore Profiles:**
   ```bash
   cat multilogin-profiles.json | jq '.[0].fingerprint | keys'
   ```

2. **See Workflow Steps:**
   ```bash
   cat automation-workflows.json | jq '.[0].steps[] | {name, type}'
   ```

3. **Check Mappings:**
   ```bash
   cat workflow-profile-mapping.json | jq '.[] | {workflow_name, profile_ids: (.profile_ids | length)}'
   ```

4. **View Credentials:**
   ```bash
   cat multilogin-credentials.json | jq '.[] | {profile_id, username, service}'
   ```

---

**Generated:** 2024-04-08  
**Format Version:** 1.0  
**Updated:** 2024-04-08
