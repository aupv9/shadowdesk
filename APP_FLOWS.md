# Ghost Browser Application Flows

**Version**: Current as of Phase 21  
**Last Updated**: 2026-04-09  

This document provides a comprehensive overview of all the application flows currently supported by Ghost Browser. The application is organized into distinct functional areas, each with specific capabilities and workflows.

---

## Table of Contents

1. [Core Flows](#core-flows)
2. [Profile Management Flows](#profile-management-flows)
3. [Proxy Management Flows](#proxy-management-flows)
4. [Fingerprint & Detection Flows](#fingerprint--detection-flows)
5. [Automation Flows](#automation-flows)
6. [Team & Collaboration Flows](#team--collaboration-flows)
7. [Account & Licensing Flows](#account--licensing-flows)
8. [Advanced Flows](#advanced-flows)

---

## Core Flows

### 1. Authentication Flow

**Path**: Account → Login/Register  
**Components**: `AuthStore`, `auth.ts`

#### Sub-flows:
- **User Registration**
  - Input: Email, Password, Name (optional)
  - Output: User account created, verification email sent
  - IPC: `auth:register`

- **User Login**
  - Input: Email, Password
  - Output: Authentication token, User profile loaded
  - IPC: `auth:login`
  - Stores: `authStore` (user, token, isAuthenticated)

- **Password Change**
  - Input: Current password, New password
  - Output: Password updated
  - IPC: `auth:updatePassword`

- **Email Verification**
  - Input: Verification token
  - Output: Email verified
  - IPC: `auth:resendVerificationEmail`

- **Logout**
  - Output: Token cleared, User profile cleared
  - IPC: `auth:logout`

- **Session Persistence**
  - Automatic token refresh
  - Automatic session recovery on app restart

---

### 2. Application Initialization Flow

**Path**: App startup  
**Components**: `App.tsx`, `main/index.ts`

#### Startup Sequence:
1. Database initialization (`sql.js` WASM load)
2. Authentication check
3. License verification
4. Settings load (theme, preferences)
5. Profile metadata load
6. Store initialization (Zustand stores)
7. UI render

#### Features:
- Welcome Wizard (first-time users)
- Error boundary setup
- Offline detection
- Theme application (dark/light/system)

---

## Profile Management Flows

**Path**: Profiles (main section)  
**Components**: `ProfileManager/`, `profileStore.ts`, `main/database.ts`

### 1. Profile CRUD Operations

#### Create Profile
- **Input**: Profile name, Group, Fingerprint preset (optional)
- **Output**: Profile created with unique ID, directory created at `userData/profiles/<id>/`
- **IPC**: `profiles:create`
- **Validation**: Input validation, preset validation
- **Database**: INSERT into `profiles` table

#### List Profiles
- **Output**: All profiles with metadata (name, fingerprint summary, proxy, last used)
- **Filtering**: By group, by status
- **Pagination**: Configurable page size
- **Sorting**: By name, created date, last used
- **IPC**: `profiles:list`
- **Store**: `profileStore.profiles`

#### Read Profile
- **Input**: Profile ID
- **Output**: Full profile data with fingerprint (JSON parsed), cookies, proxy, notes
- **IPC**: `profiles:get`

#### Update Profile
- **Input**: Profile ID, Updated fields (name, fingerprint, proxy, notes, cookies)
- **Output**: Profile updated in database
- **Validation**: Input validation, fingerprint validation
- **IPC**: `profiles:update`
- **Triggers**: Profile version creation (if enabled)

#### Delete Profile
- **Input**: Profile ID
- **Output**: Profile deleted from database, user-data-dir cleaned up
- **IPC**: `profiles:delete`

#### Bulk Operations
- **Bulk Delete**: Delete multiple profiles
- **Bulk Update**: Update field across multiple profiles (proxy, group)
- **IPC**: `profiles:bulkDelete`, `profiles:bulkUpdate`

---

### 2. Profile Launch & Session Flow

**Path**: Click "Launch" on profile card  
**Components**: `ProfileCard.tsx`, `browser-manager.ts`, `profileStore.ts`

#### Launch Sequence:
1. Validate profile exists and is not already running
2. Pre-flight validation (detection hardening checks)
3. Browser process launch via Puppeteer-core
4. Fingerprint injection (JavaScript + CDP)
5. Chromium patches application
6. Proxy configuration (if assigned)
7. Cookies restoration (if stored)
8. Browser window shown to user
9. Session tracked in `activeSessions` store

#### Features:
- **Automatic cleanup** on close
- **Profile locking** (prevent duplicate launches)
- **Background/headless mode** support
- **Port management** (dynamic CDP port allocation)

#### Session Management:
- **Get Active Sessions**: List running profiles
- **Close Session**: Kill browser process, cleanup
- **IPC**: `profiles:getActiveSessions`, `profiles:closeSession`

---

### 3. Cookie Management Flow

**Path**: Profile card → Cookies icon  
**Components**: `CookieModal.tsx`

#### Import Cookies
- **Formats Supported**:
  - Netscape Cookie Format
  - JSON format
- **Input**: Cookie file or paste
- **Output**: Cookies stored in profile database
- **IPC**: `profiles:importCookies`
- **Validation**: Cookie format validation

#### Export Cookies
- **Format**: Netscape format or JSON
- **Output**: Downloadable file
- **IPC**: `profiles:exportCookies`

#### Clear Cookies
- **Action**: Delete all cookies from profile
- **IPC**: `profiles:clearCookies`

---

### 4. Profile History & Versioning Flow

**Path**: Profile card → History icon  
**Components**: `ProfileHistory.tsx`, `ProfileListRow.tsx`

#### Features:
- **Track Changes**: Last launched time, creation date
- **Profile Snapshots**: Save up to 20 versions per profile
- **Restore Version**: Revert to a previous fingerprint state
- **IPC**: `profiles:getHistory`, `profiles:createSnapshot`, `profiles:restoreSnapshot`
- **Database**: `profile_versions` table

---

### 5. Profile Collision Detection Flow

**Path**: Profile card → Collision icon  
**Components**: `CollisionsDrawer.tsx`

#### Detection:
- **Analyze fingerprints** across all profiles
- **Identify collisions**: Same canvas fingerprint, WebGL fingerprint, etc.
- **Risk scoring**: Shows profiles at risk of detection
- **Suggest fixes**: Recommend fingerprint changes

#### IPC:
- `profiles:detectCollisions`
- `profiles:getFingerprintEntropy`

---

### 6. Profile Import/Export Flow

**Path**: Settings → Import/Export  
**Components**: `ImportGuideModal.tsx`

#### Export Profiles
- **Format**: ZIP archive containing encrypted profiles
- **Encryption**: AES-256-GCM per profile
- **Output**: Downloadable backup file
- **IPC**: `profiles:exportProfiles`

#### Import Profiles
- **Format**: ZIP archive from previous export
- **Decryption**: Automatic AES-256-GCM decryption
- **Conflict handling**: Skip or overwrite existing
- **IPC**: `profiles:importProfiles`

---

## Proxy Management Flows

**Path**: Proxies (section)  
**Components**: `ProxyManager/`, `proxyStore.ts`

### 1. Proxy CRUD Operations

#### Add Proxy
- **Types**: HTTP, HTTPS, SOCKS5
- **Input**: Host, Port, Protocol, Auth (optional), Country (optional)
- **Output**: Proxy created with ID
- **Validation**: Input validation, health check optional
- **IPC**: `proxies:create`
- **Database**: INSERT into `proxies` table

#### List Proxies
- **Output**: All proxies with metadata (health, latency, country)
- **IPC**: `proxies:list`
- **Store**: `proxyStore.proxies`

#### Update Proxy
- **Input**: Proxy ID, Updated fields
- **IPC**: `proxies:update`

#### Delete Proxy
- **Input**: Proxy ID
- **IPC**: `proxies:delete`

#### Test Proxy
- **Action**: Test connectivity and latency
- **Output**: Status (healthy/unhealthy), Latency in ms
- **IPC**: `proxies:testProxy`
- **Updates**: `is_healthy`, `latency_ms`, `last_checked_at`

---

### 2. Proxy Provider Integration Flow

**Path**: Proxies → Provider Panel  
**Components**: `ProviderPanel.tsx`

#### Supported Providers:
- **SmartProxy**
- **BrightData**
- **Oxylabs**
- **Custom** (manual list)

#### Configuration:
1. Select provider type
2. Enter API credentials
3. Generate proxy list
4. Auto-add to profiles or manage separately

#### Features:
- **Auto-rotation**: Configure rotating vs sticky sessions
- **Credential vault**: Encrypted storage
- **Generation**: Generate list with filters (country, type, pool)
- **IPC**: 
  - `proxyProviders:addCredentials`
  - `proxyProviders:generateProxies`
  - `proxyProviders:testCredentials`

---

### 3. Proxy Rotation Flow

**Path**: During automation or manual workflow  
**Components**: `automation.ts`

#### Within Workflow:
- **Action**: `switchProxy` in automation step
- **Effect**: Changes proxy mid-execution
- **IPC**: Executed within workflow context

#### Manual:
- **Right-click profile → Change proxy**
- **Assign to active session**

---

## Fingerprint & Detection Flows

**Path**: Fingerprint (section)  
**Components**: `FingerprintEditor/`, `fingerprint/`, `DetectionDashboard/`

### 1. Fingerprint Configuration Flow

**Components**: `FingerprintEditor/index.tsx`

#### Preset Selection
- **11 Built-in Presets**: Desktop (5), Android (3), iOS (3)
- **Auto-apply**: Fingerprint config loaded to profile
- **IPC**: `fingerprint:applyPreset`

#### Manual Vector Configuration
- **Vectors Covered** (45+ total):
  - Navigator (UA, platform, hardwares)
  - Canvas (noise injection)
  - WebGL (vendor/renderer spoof)
  - Audio (AudioContext noise)
  - Fonts (whitelist + measurement noise)
  - Permissions API
  - Storage quota
  - Network Information
  - Performance API
  - WebRTC
  - SharedArrayBuffer
  - Intl (locale, collation)
  - User-Agent Data (UACH)
  - WebGPU
  - ClientRects
  - Plugins & Mime Types
  - Speech synthesis
  - And more...

#### Fingerprint Editor Actions:
- **Toggle vector protection**: Enable/disable specific vector
- **Edit vector parameters**: Configure noise levels, return values
- **Save configuration**: Store as profile fingerprint
- **Live preview**: See generated JavaScript
- **IPC**: `fingerprint:updateVector`, `fingerprint:getVectorStatus`

---

### 2. Fingerprint Injection Flow

**When**: Profile launch  
**Components**: `fingerprint/injector.ts`, `fingerprint/presets.ts`

#### Layers:
1. **Layer 1 — Core Spoofing**
   - JS overrides via `evaluateOnNewDocument`
   - CDP API calls
   - Deterministic noise seeding

2. **Layer 2 — Advanced CDP Evasion**
   - Hide DevTools presence
   - Remove automation markers
   - Stack trace sanitization
   - chrome.runtime stubs

3. **Layer 3 — Behavior Simulation**
   - Mouse jitter patterns
   - Typing cadence
   - Scroll inertia
   - Timing quantization

4. **Layer 4 — Chromium Patches** (phase 8+)
   - Native C++ modifications
   - FPU randomization
   - Proto chain spoofing
   - Media capabilities masking

---

### 3. Behavior Correlation Flow

**Path**: Correlation Dashboard  
**Components**: `CorrelationDashboard/index.tsx`

#### Features:
- **Scan profiles** for correlated behavior patterns
- **Record behavior samples** during workflows
- **Detect anomalies**: Behavior drift, timing patterns, execution signatures
- **Risk scoring**: Profiles flagged as correlated
- **Detailed reports**: Timeline of correlated events

#### IPC:
- `correlation:runScan`
- `correlation:recordSample`
- `correlation:listReports`
- `correlation:getReport`
- `correlation:deleteReport`

---

### 4. Detection Testing Flow

**Path**: Detection Dashboard  
**Components**: `DetectionDashboard/`

#### Test Execution:
1. **Select profile(s)**
2. **Run detection test**
3. System evaluates 20+ vectors:
   - Automation detection
   - Headless detection
   - Timezone accuracy
   - Screen resolution consistency
   - Font rendering
   - Canvas fingerprinting
   - WebGL
   - And more...

#### Features:
- **Detailed scoring**: Per-vector score + overall
- **Historical tracking**: Compare runs over time
- **Category breakdown**: See which categories fail
- **Vector details**: Each vector shows test method + result
- **Trends**: Chart overall health over time

#### IPC:
- `detection:runTests`
- `detection:listTests`
- `detection:getTest`
- `detection:deleteTest`

---

### 5. Chromium Patch Management Flow

**Path**: Patches (section)  
**Components**: `PatchManager/`

#### Features:
- **Browse patch catalog**: 30+ patches available
- **Apply patches** to profile
- **View patch details**: What each patch does
- **Patch groups**: By category (rendering, timing, API behavior)

#### Patches Include:
- Math FPU randomization
- Proto chain spoofing
- Media capabilities masking
- Trust tokens API
- And more...

#### IPC:
- `patches:listPatches`
- `patches:getPatch`
- `patches:applyPatch`
- `patches:removePatch`

---

## Automation Flows

**Path**: Automation (section)  
**Components**: `AutomationBuilder/`, `automation.ts`

### 1. Workflow Builder Flow

**Path**: Automation → Create Workflow  
**Components**: `WorkflowCreationFlow.tsx`, `WorkflowCreateModal.tsx`

#### Creation Methods:
1. **Blank Workflow**: Start from scratch
2. **From Template**: Choose from 20+ templates
3. **Record & Refine**: Record browser actions, refine in builder

#### Workflow Structure:
- **Metadata**: Name, description, category, profile assignment
- **Variables**: Input/output variables for parameterization
- **Steps**: Ordered list of automation actions
- **Hooks**: Pre-run, post-run, on-error triggers
- **Schedules**: CRON-based execution

---

### 2. Step Editor Flow

**Path**: In workflow builder, click step  
**Components**: `StepEditor.tsx`

#### Supported Actions (50+):

**Navigation & Page Interaction:**
- `navigate`: Open URL with wait condition
- `waitForNavigation`: Wait for page load
- `waitForSelector`: Wait for element presence
- `click`: Click element by selector
- `rightClick`: Right-click element
- `doubleClick`: Double-click element
- `clickByText`: Click by element text content
- `hover`: Hover over element
- `scroll`: Scroll page by Y pixels
- `scrollIntoView`: Scroll element into view

**Form & Input:**
- `type`: Type text into input
- `select`: Select dropdown option
- `setRangeInput`: Set range/slider value
- `upload`: Upload file
- `setAttribute`: Set HTML attribute

**Keyboard & Advanced:**
- `keyPress`: Press single key
- `keyCombo`: Press key combination
- `dragAndDrop`: Drag element to target
- `selectContextMenu`: Right-click context menu

**Data Extraction:**
- `extractText`: Extract text from element(s)
- `extractJson`: Extract and parse JSON
- `forEachElement`: Loop over elements
- `forEachRow`: Loop over CSV rows
- `evaluate`: Run JavaScript, get result

**Network & API:**
- `httpRequest`: Make HTTP request
- `interceptRequest`: Block/mock/modify request
- `clearIntercepts`: Clear all intercepts
- `waitForRequest`: Wait for matching request
- `waitForResponse`: Wait for matching response

**File Operations:**
- `readFile`: Read local file
- `writeFile`: Write local file
- `download`: Download file to disk
- `waitForDownload`: Wait for download completion

**Control Flow:**
- `wait`: Wait N milliseconds
- `conditional`: If-then-else branching
- `loop`: Loop N times or while condition
- `tryCatch`: Error recovery
- `jumpToStep`: Jump to specific step
- `parallelSteps`: Run steps in parallel
- `whileLoop`: While condition loop

**Storage & Cookies:**
- `getCookies`: Get all cookies
- `setCookies`: Set cookies
- `deleteCookies`: Delete cookies
- `getStorage`: Get localStorage/sessionStorage
- `setStorage`: Set localStorage/sessionStorage
- `clearStorage`: Clear storage

**Advanced:**
- `switchFrame`: Switch to iframe
- `switchTab`: Switch to different tab
- `openTab`: Open new tab
- `closeTab`: Close tab
- `getTabs`: List all tabs
- `switchProxy`: Change proxy mid-workflow
- `solveCaptcha`: Solve CAPTCHA (reCAPTCHA, hCaptcha, image)
- `injectCaptchaToken`: Inject solved token
- `useCredential`: Use from credential vault
- `callWorkflow`: Call another workflow
- `screenshot`: Capture screenshot
- `assert`: Assert condition
- `paginate`: Auto-paginate through results

#### Step Features:
- **Parameters**: Configurable per action
- **Retries**: Retry N times with backoff (fixed/linear/exponential)
- **Timeout**: Per-step timeout in ms
- **Error Handling**: onErrorGoto, retryOn filters
- **Validation**: Pre-flight validation checks
- **Placeholder Help**: Selector examples, parameter hints

---

### 3. Variable System Flow

**Path**: Workflow → Variables tab  
**Components**: `VariablesEditor.tsx`

#### Variable Types:
- **Input variables**: Parameterize workflow (keyword, email, etc.)
- **Output variables**: Extract and return values
- **Step variables**: Capture results from previous steps
- **Transforms**: Process extracted data

#### Interpolation:
- `{variableName}`: Basic substitution
- `{cred.username}`: Nested variable access
- Supports dots for JSON path lookups

#### Transforms:
- `trim`, `upper`, `lower`, `number`, `length`
- `jsonPath:$.a.b.c`: Extract from JSON
- `regex:pattern`: Capture group extraction
- `split:sep:index`: Split and pick
- `replace:find:with` or `replace:re:pattern:with`: Replace
- `prefix:str`, `suffix:str`: Add strings

---

### 4. Template System Flow

**Path**: Automation → New Workflow → From Template  
**Components**: `TemplatePickerModal.tsx`

#### Built-in Templates (20+):

**General:**
- Web Page Scraper
- Login Flow
- Form Auto-Fill
- Site Health Check

**Social Media:**
- Social Media Feed Scroll

**E-Commerce:**
- E-Commerce Price Checker
- Shopee — Search & Extract Listings
- Lazada — Product Details Extractor
- TikTok — Video Feed Scraper
- Facebook — Page Like Simulator

**Platform-Specific:**
- Shopee, Lazada, TikTok, Facebook, Instagram templates
- With pre-built steps for common actions

#### Customization:
- Load template as base
- Modify steps as needed
- Save as new template

---

### 5. Workflow Execution Flow

**Path**: Click "Run" or schedule  
**Components**: `AutomationEngine`, execution context

#### Execution Phases:

1. **Pre-flight**:
   - Validate all steps
   - Check platform/detection hardening
   - Parse variables
   - Prepare profile

2. **Launch**:
   - Start browser with profile
   - Load cookies if available
   - Apply fingerprint

3. **Execution**:
   - Execute steps in order
   - Handle branching (conditional, loop)
   - Capture step results
   - Track timing
   - On error: retry or jump to error handler

4. **Post-execution**:
   - Close browser
   - Save run result
   - Return output variables
   - Trigger post-run hooks

#### Features:
- **Progress tracking**: Real-time step-by-step progress
- **Variable capture**: Extract data between steps
- **Error recovery**: tryCatch, retries, error goto
- **Parallel execution**: Run independent steps in parallel
- **Data pipelines**: forEachRow with transforms
- **Screenshots**: Capture at key steps

#### IPC:
- `automation:runWorkflow`
- `automation:stopWorkflow`
- `automation:pauseWorkflow`
- `automation:resumeWorkflow`

---

### 6. Recording Flow

**Path**: Automation → Record New  
**Components**: `RecordingReview/`

#### Process:
1. **Start recording** on target profile
2. **Browser opens** with devtools for manual interaction
3. **Record user actions**: Clicks, types, scrolls, navigations
4. **Stop recording**
5. **Review and refine**:
   - Edit selectors (selectorValidator)
   - Add variables (VariableWizard)
   - Merge similar steps
   - Add delays/waits
   - Add error handling

#### Refinement Features:
- **Event timeline**: Visual timeline of recorded events
- **Step diff**: Compare raw events vs refined steps
- **Selector validator**: Test selectors work
- **Variable extraction**: Mark data for capture
- **Refinement panel**: Adjust parameters

#### Output:
- Clean automation workflow ready to execute

---

### 7. Scheduling Flow

**Path**: Workflow → Schedules tab  
**Components**: `SchedulesModal.tsx`, `scheduler.ts`

#### Schedule Types:
- **One-time**: Run at specific date/time
- **Recurring**: CRON expression
- **Examples**:
  - `0 0 * * *` — Daily at midnight
  - `0 9 * * 1` — Weekly Monday 9 AM
  - `0 */4 * * *` — Every 4 hours

#### Features:
- **Timezone support**
- **Profile assignment**: Run on specific profile
- **Variable defaults**: Set input variables
- **Webhook triggers**: POST webhook on completion
- **Retry policy**: Retry on failure

#### IPC:
- `automation:createSchedule`
- `automation:updateSchedule`
- `automation:deleteSchedule`
- `automation:listSchedules`

---

### 8. Run History & Monitoring Flow

**Path**: Run Dashboard (section)  
**Components**: `RunDashboard/`

#### Tabs:

**Run History**:
- List all past workflow runs
- Filter by workflow, profile, status
- Download results (CSV/JSON)
- View step-by-step execution log
- See variable outputs

**Live Monitor**:
- Real-time execution progress
- Current step highlighted
- Screenshots from execution
- Performance metrics
- Pause/resume/stop controls

**Schedules**:
- List active schedules
- View next execution time
- Edit schedule details
- Disable/enable schedule

**Metrics**:
- Success rate by workflow
- Average execution time
- Error rate tracking
- Performance trends
- Data extraction stats

#### Export Options:
- **Format**: CSV or JSON
- **Granularity**: Per-workflow or per-step
- **Date range**: Filter by date range

---

## Team & Collaboration Flows

**Path**: Team (section)  
**Components**: `TeamManager/`, `team.ts`

### 1. Team Management Flow

**Create Team**:
- **Input**: Team name, optional logo
- **Output**: Team created, user is owner
- **IPC**: `team:createTeam`

**Invite Members**:
- **Input**: Email address, role
- **Roles**: Admin, Editor, Viewer
- **Output**: Invitation email sent
- **IPC**: `team:inviteMember`

**Manage Members**:
- **Update role**: Change member permissions
- **Remove member**: Revoke access
- **IPC**: `team:updateMember`, `team:removeMember`

**Accept Invitation**:
- **Input**: Invitation link/token
- **Output**: User joins team
- **IPC**: `team:acceptInvite`

---

### 2. Shared Profiles Flow

**Within Team**:
- **Browse shared profiles**: See team members' profiles
- **Clone profile**: Copy to own workspace
- **Shared metadata**: View fingerprint, proxy, notes
- **Permissions**: View only (no edit/delete)

---

### 3. Audit Log Flow

**Path**: Team → Audit Log  
**Features**:
- **Track changes**: Who did what, when
- **Logged actions**:
  - Profile create/update/delete
  - Member add/remove
  - Permission changes
  - Workflow execution
- **Filter**: By user, action, date range
- **Export**: Download audit trail

#### Database:
- Table: `audit_log` (user_id, action, target_id, timestamp, ip_address)

---

## Account & Licensing Flows

**Path**: Account (section)  
**Components**: `AccountPage/`, `auth.ts`, `license.ts`

### 1. Account Management Flow

**Profile Settings**:
- Update email
- Update password
- Delete account
- Export user data

#### IPC:
- `auth:updatePassword`
- `auth:deleteAccount`
- `auth:exportUserData`

---

### 2. License Activation Flow

**Fetch License**:
- **Input**: User account
- **Output**: License data (plan, expiry, profile limit, team seats)
- **IPC**: `license:fetchLicense`

**Activate License**:
- **Input**: License key
- **Output**: License activated on machine
- **Stores**: `licenseStore.license`

**Deactivate License**:
- **Output**: License removed from device
- **IPC**: `license:deactivateLicense`

**Check Limits**:
- **Free plan**: 5 profiles
- **Pro plan**: 50 profiles
- **Team plan**: Unlimited (per seat quota)
- **IPC**: `license:checkProfileLimit`

**Machine Fingerprinting**:
- **Get machine ID**: Unique identifier for device
- **Multi-device support**: Activate same license on 3 devices
- **IPC**: `license:getMachineId`

---

### 3. Cloud Sync Flow

**Path**: Account → Cloud Sync  
**Components**: `SyncSetupModal.tsx`, `sync.ts`

#### Enable Cloud Sync:
1. **Sign in** to account
2. **Authorize** encryption key setup
3. **Initial sync**: Upload profiles
4. **Enable daemon**: Background sync every N minutes

#### Push (Upload):
- **Trigger**: Manual "Sync Now" or automatic daemon
- **Process**:
  1. Identify local changes
  2. Encrypt profiles (AES-256-GCM)
  3. Upload to backend
  4. Update sync manifest
- **Conflict**: Last-write-wins or merge

#### Pull (Download):
- **Trigger**: Detect remote changes
- **Process**:
  1. Fetch sync manifest
  2. Download changed profiles
  3. Decrypt
  4. Merge with local

#### Daemon:
- **Background**: Checks for changes every 5 minutes
- **Enable/disable**: Toggle in settings
- **IPC**: `sync:enableDaemon`, `sync:disableSyncDaemon`

#### Features:
- **E2E encryption**: Keys never leave device
- **Conflict resolution**: View diffs, choose version
- **Selective sync**: Sync specific profiles
- **Sync history**: Track all changes

#### IPC:
- `sync:pushProfiles`
- `sync:pullProfiles`
- `sync:getSyncState`
- `sync:getSyncManifest`
- `sync:getSyncHistory`

---

## Advanced Flows

### 1. AI-Assisted Automation Flow

**Path**: AI Assistant (section)  
**Components**: `AIAssistant/`, `ai-assistant.ts`

#### Feature 1 — Workflow Generator:
**Generate from NL description**:
- **Input**: "Automate login to Shopee, search for shoes, extract first 10 prices"
- **Output**: Complete workflow with steps
- **IPC**: `ai:generateWorkflow`

#### Feature 2 — Detection Advisor:
**Analyze detection test results**:
- **Input**: Failed detection vectors
- **Output**: Recommendations to improve score
- **IPC**: `ai:analyzeDetection`

#### Feature 3 — Smart Selector Healing:
**Fix broken selectors**:
- **Input**: Failed selector from workflow
- **Output**: Suggested alternatives (XPath, CSS, text-based)
- **IPC**: `ai:healSelector`

#### Feature 4 — Behavior Archetype Library:
**Browse behavior patterns**:
- **10 archetypes**: Casual surfer, researcher, bot, etc.
- **Apply archetype**: Apply behavior pattern to profile
- **IPC**: `ai:getBehaviorArchetypes`, `ai:applyArchetype`

#### Configuration:
- **API key**: Optional, uses cloud-hosted Claude
- **Enable/disable**: Toggle AI features on/off
- **IPC**: `ai:getStatus`, `ai:setApiKey`, `ai:setEnabled`

---

### 2. SEA Platform Templates Flow

**Path**: SEA Platforms (section)  
**Components**: `SEAPlatforms/`

#### Supported Platforms:
- **Shopee** (Vietnam, Thailand, Malaysia, Singapore, Philippines, Indonesia)
- **Lazada** (same regions)
- **TikTok Shop** (SEA regions)
- **Facebook** (SEA regions)
- **Instagram** (SEA regions)
- And more...

#### Features:
- **Region-specific templates**: Pre-built workflows for each platform
- **Localization**: UI translated to local languages
- **Platform tips**: Best practices for detection avoidance
- **Workflow examples**: Copy-paste ready workflows

#### Workflow Categories:
- Search & extract
- Login & verification
- Like/follow simulation
- Comment automation
- Product upload
- Marketplace management

---

### 3. Smart Warm-Up Flow

**Path**: Smart Warm-Up (section)  
**Components**: `SmartWarmUp/`

#### Purpose:
**Gradually increase profile activity** to avoid detection

#### Configuration:
- **Profile selection**: Choose profiles to warm up
- **Activity types**: Browse, click, scroll, like
- **Duration**: Spread activity over N days/hours
- **Intensity**: Low, medium, high
- **Targets**: Specific websites or random

#### Execution:
- **Scheduler**: Runs on schedule
- **Monitoring**: Track activity levels
- **Adjustment**: Automatically adjust intensity based on detection scores

#### IPC:
- `warmup:startWarmup`
- `warmup:stopWarmup`
- `warmup:getStatus`

---

### 4. Behavior Configuration Flow

**Path**: Behavior (section)  
**Components**: `BehavioralConfig/`

#### Features:
- **Browse presets**: 10+ behavior patterns
- **Configure timing**: Mouse speed, typing cadence, scroll inertia
- **Randomization**: Add variance to timing
- **Session tracking**: Track behavior drift across runs
- **Visual feedback**: See behavior simulation in action

#### Configurable Aspects:
- **Mouse movement**: Speed, acceleration, pause distribution
- **Typing**: Words per minute, error rate, backspace frequency
- **Scrolling**: Speed, pause distribution, direction
- **Clicking**: Double-click frequency, pause between clicks
- **Navigation**: Time on page, scroll behavior

#### Archetype Presets:
1. **Casual Surfer**: Natural, human-like behavior
2. **Researcher**: Slow, deliberate, many clicks
3. **Power User**: Fast, efficient, minimal pauses
4. **Bot-like**: Regular, predictable (for testing)
5. And 6 more...

---

### 5. Marketplace Flow

**Path**: Marketplace (section)  
**Components**: `Marketplace/`, `marketplace.ts`

#### Available Items:
- **Workflow templates**: Community-shared workflows
- **Profiles**: Pre-configured profiles for specific tasks
- **Patches**: Additional Chromium patches
- **Presets**: Fingerprint presets
- **Behaviors**: Behavior patterns

#### Browsing:
- **Categories**: Filter by use case (scraping, social, ecommerce)
- **Search**: Find workflows/profiles
- **Ratings**: Community ratings & reviews
- **Preview**: See workflow steps before importing

#### Import:
- **Click import**: Add to local workspace
- **Edit**: Customize as needed
- **Share back**: Contribute workflows

#### IPC:
- `marketplace:listItems`
- `marketplace:getItem`
- `marketplace:importItem`

---

### 6. Remote Nodes Flow

**Path**: Settings → Remote Nodes  
**Components**: `RemoteNodesPanel.tsx`, `remote-nodes.ts`

#### Purpose:
**Run automation on remote machines** for distributed load

#### Configuration:
- **Add node**: Register remote machine
- **Credentials**: SSH key or token auth
- **Node details**: CPU, RAM, active slots

#### Assignment:
- **Route workflow**: Assign workflow to specific node
- **Load balancing**: Distribute across nodes

#### Monitoring:
- **Node status**: Health check each node
- **Utilization**: CPU/RAM usage
- **Active jobs**: Running workflows

---

### 7. Webhooks Flow

**Path**: Settings → Webhooks  
**Components**: `WebhooksPanel.tsx`, `webhooks.ts`

#### Event Triggers:
- **Workflow completed**: POST data when run finishes
- **Workflow failed**: Triggered on error
- **Workflow scheduled**: Triggered by schedule
- **Profile created/updated/deleted**
- **Detection test completed**

#### Webhook Payload:
- **Event type**: Event name
- **Timestamp**: When event occurred
- **Data**: Relevant context (workflow ID, results, etc.)
- **Signature**: HMAC-SHA256 for verification

#### Management:
- **Add webhook**: Enter URL, select events
- **Test**: Send test payload
- **Retry**: Automatic retry on failure
- **History**: View past deliveries

#### IPC:
- `webhooks:createWebhook`
- `webhooks:updateWebhook`
- `webhooks:deleteWebhook`
- `webhooks:testWebhook`
- `webhooks:listWebhooks`

---

### 8. Credential Vault Flow

**Path**: Settings → Vault  
**Components**: `vault.ts`

#### Storage:
- **Encrypted vault**: AES-256 encryption
- **Master password**: Protects vault
- **Credential types**: Username/password, API keys, tokens

#### Usage in Workflows:
- **useCredential**: Action in step
- **Reference by name**: `{vault:credential_name}`
- **Automatic injection**: Passwords never exposed

#### IPC:
- `vault:addCredential`
- `vault:updateCredential`
- `vault:deleteCredential`
- `vault:listCredentials`

---

### 9. Captcha Solving Flow

**During Workflow Execution**:
- **Action**: `solveCaptcha`
- **Types supported**:
  - reCAPTCHA v2 (checkbox, invisible)
  - reCAPTCHA v3
  - hCaptcha
  - Image CAPTCHA

#### Configuration:
- **Select solver**: Choose service (2captcha, Anti-Captcha, etc.)
- **API key**: Provider credentials
- **Pricing**: Pay-as-you-go

#### IPC:
- `captcha:getSolver`
- `captcha:listSolvers`

---

### 10. Settings & Preferences Flow

**Path**: Settings (section)  
**Components**: `SettingsPage/`, `settings.ts`

#### Available Settings:
- **Theme**: Dark, light, system
- **Language**: English, Vietnamese, Thai, etc. (planned)
- **Startup**: Launch on system start
- **Updates**: Auto-update preference
- **Community presets**: Download presets from community
- **API server**: Enable local API for external control
- **Remote nodes**: Configure distributed execution

#### Persistence:
- Stored in `settings.json`
- Auto-load on app start

#### IPC:
- `settings:get`
- `settings:update`
- `settings:getSettingsByKey`
- `settings:updateSettingsByKey`

---

## Data Flow Diagrams

### Profile Launch Data Flow
```
User clicks "Launch" 
  ↓
profileStore validates
  ↓
IPC: profiles:launch
  ↓
main process:
  1. Check profile exists
  2. Run pre-flight checks
  3. Resolve fingerprint from DB
  4. Build injection scripts
  5. Launch browser via Puppeteer
  6. Inject fingerprint + patches
  7. Restore cookies if stored
  8. Track in activeSessions
  ↓
Browser window visible
```

### Automation Execution Data Flow
```
User clicks "Run Workflow"
  ↓
IPC: automation:runWorkflow
  ↓
main process:
  1. Parse workflow steps
  2. Resolve variables
  3. Launch profile
  4. For each step:
     - Validate parameters
     - Execute action
     - Capture result
     - Handle errors (retry, goto, tryCatch)
  5. Close browser
  6. Save run result
  ↓
RunDashboard updates with results
```

### Cloud Sync Data Flow
```
User clicks "Sync Now"
  ↓
IPC: sync:pushProfiles
  ↓
main process:
  1. Get changed profiles (local manifest)
  2. Encrypt each with AES-256-GCM
  3. POST to backend
  4. Merge remote changes on return
  ↓
syncStore updates sync state
  ↓
UI confirms sync complete
```

---

## Summary

Ghost Browser supports a comprehensive set of application flows designed to handle:

- ✅ **Profile Management**: CRUD, versioning, collision detection, import/export
- ✅ **Proxy Management**: Add/test/rotate, provider integration, credential storage
- ✅ **Fingerprint Control**: 45+ vectors, 11 presets, behavioral simulation, patch management
- ✅ **Detection Evasion**: 4-layer injection system, advanced CDP evasion, behavior tracking
- ✅ **Automation**: 50+ action types, workflow builder, recording, scheduling, parallel execution
- ✅ **Team Collaboration**: Shared profiles, member management, audit logs
- ✅ **Cloud Sync**: E2E encrypted profile sync, conflict resolution, background daemon
- ✅ **AI Assistance**: NL workflow generation, detection advisor, selector healing, archetype library
- ✅ **Advanced Features**: Distributed execution, webhooks, credential vault, marketplace, warm-up

Each flow is fully integrated with the Electron IPC layer, Zustand state management, and SQLite database persistence.

---

**For Questions or Updates**: Refer to CLAUDE.md for architecture details and implementation patterns.
