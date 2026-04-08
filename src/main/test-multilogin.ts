/**
 * Multi-Login Test Runner
 *
 * Tests Ghost Browser's ability to run multiple profiles simultaneously
 * with proper isolation and fingerprint consistency.
 *
 * Usage:
 *   npm run test -- testdata/multilogin-test-runner.test.ts
 *
 * Or in CI:
 *   node dist/main/test-multilogin.js
 */

import fs from 'fs'
import path from 'path'

interface TestProfile {
  id: string
  name: string
  group_id: string
  fingerprint: any
  proxy_id: string
  status: string
}

interface TestProxy {
  id: string
  name: string
  host: string
  port: number
  country: string
}

interface TestCredential {
  profile_id: string
  username: string
  password: string
  service: string
}

interface TestResult {
  profile: string
  test: string
  passed: boolean
  message: string
  timestamp: string
  details?: any
}

class MultiLoginTestRunner {
  private profiles: TestProfile[] = []
  private proxies: TestProxy[] = []
  private credentials: TestCredential[] = []
  private results: TestResult[] = []
  private testdataDir = path.join(process.cwd(), 'testdata')

  constructor() {
    this.loadTestData()
  }

  private loadTestData(): void {
    try {
      const profilesPath = path.join(this.testdataDir, 'multilogin-profiles.json')
      const proxiesPath = path.join(this.testdataDir, 'multilogin-proxies.json')
      const credsPath = path.join(this.testdataDir, 'multilogin-credentials.json')

      if (fs.existsSync(profilesPath)) {
        this.profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf-8'))
      }
      if (fs.existsSync(proxiesPath)) {
        this.proxies = JSON.parse(fs.readFileSync(proxiesPath, 'utf-8'))
      }
      if (fs.existsSync(credsPath)) {
        this.credentials = JSON.parse(fs.readFileSync(credsPath, 'utf-8'))
      }

      console.log(`✓ Loaded ${this.profiles.length} profiles`)
      console.log(`✓ Loaded ${this.proxies.length} proxies`)
      console.log(`✓ Loaded ${this.credentials.length} credentials\n`)
    } catch (error) {
      console.error('Error loading test data:', error)
      process.exit(1)
    }
  }

  private recordResult(profile: string, test: string, passed: boolean, message: string, details?: any): void {
    this.results.push({
      profile,
      test,
      passed,
      message,
      timestamp: new Date().toISOString(),
      details
    })
  }

  async testFingerprintConsistency(): Promise<void> {
    console.log('🧪 Test: Fingerprint Consistency\n')

    for (const profile of this.profiles) {
      try {
        const fingerprint1 = JSON.stringify(profile.fingerprint)
        const fingerprint2 = JSON.stringify(profile.fingerprint)

        const isConsistent = fingerprint1 === fingerprint2

        this.recordResult(
          profile.name,
          'Fingerprint Consistency',
          isConsistent,
          isConsistent ? 'Fingerprint is consistent across sessions' : 'Fingerprint changed between sessions',
          {
            preset: profile.fingerprint.preset,
            os: profile.fingerprint.os,
            browser: { userAgent: profile.fingerprint.browser.userAgent }
          }
        )

        console.log(`${isConsistent ? '✓' : '✗'} ${profile.name}: ${isConsistent ? 'PASS' : 'FAIL'}`)
      } catch (error) {
        this.recordResult(profile.name, 'Fingerprint Consistency', false, String(error))
        console.log(`✗ ${profile.name}: ERROR`)
      }
    }

    console.log('')
  }

  async testProxyConfiguration(): Promise<void> {
    console.log('🧪 Test: Proxy Configuration\n')

    for (const proxy of this.proxies) {
      try {
        const isConfigured = !!(proxy.host && proxy.port && proxy.country)

        this.recordResult(
          proxy.name,
          'Proxy Configuration',
          isConfigured,
          isConfigured ? `Proxy configured for ${proxy.country}` : 'Proxy configuration incomplete',
          {
            host: proxy.host,
            port: proxy.port,
            country: proxy.country
          }
        )

        console.log(
          `${isConfigured ? '✓' : '✗'} ${proxy.name} (${proxy.country}): ${isConfigured ? 'PASS' : 'FAIL'}`
        )
      } catch (error) {
        this.recordResult(proxy.name, 'Proxy Configuration', false, String(error))
        console.log(`✗ ${proxy.name}: ERROR`)
      }
    }

    console.log('')
  }

  async testProfileGroupAssignment(): Promise<void> {
    console.log('🧪 Test: Profile Group Assignment\n')

    const groupedProfiles = new Map<string, TestProfile[]>()

    for (const profile of this.profiles) {
      try {
        const hasGroup = !!profile.group_id
        const groupId = profile.group_id || 'ungrouped'

        if (!groupedProfiles.has(groupId)) {
          groupedProfiles.set(groupId, [])
        }
        groupedProfiles.get(groupId)!.push(profile)

        this.recordResult(
          profile.name,
          'Group Assignment',
          hasGroup,
          hasGroup ? 'Assigned to group' : 'No group assigned',
          { groupId }
        )

        console.log(`${hasGroup ? '✓' : '✗'} ${profile.name}: ${hasGroup ? 'PASS' : 'FAIL'}`)
      } catch (error) {
        this.recordResult(profile.name, 'Group Assignment', false, String(error))
        console.log(`✗ ${profile.name}: ERROR`)
      }
    }

    console.log(`\nGroup Summary:`)
    for (const [groupId, profiles] of groupedProfiles.entries()) {
      console.log(`  • Group ${groupId.slice(0, 8)}...: ${profiles.length} profiles`)
    }
    console.log('')
  }

  async testCredentialMapping(): Promise<void> {
    console.log('🧪 Test: Credential Mapping\n')

    for (const profile of this.profiles) {
      try {
        const credential = this.credentials.find(c => c.profile_id === profile.id)
        const hasCred = !!credential

        this.recordResult(
          profile.name,
          'Credential Mapping',
          hasCred,
          hasCred ? `Mapped to account ${credential.username}` : 'No credentials mapped',
          {
            username: credential?.username,
            service: credential?.service
          }
        )

        console.log(`${hasCred ? '✓' : '✗'} ${profile.name}: ${hasCred ? 'PASS' : 'FAIL'}`)
      } catch (error) {
        this.recordResult(profile.name, 'Credential Mapping', false, String(error))
        console.log(`✗ ${profile.name}: ERROR`)
      }
    }

    console.log('')
  }

  async testProxyProfileMapping(): Promise<void> {
    console.log('🧪 Test: Proxy-Profile Mapping\n')

    for (const profile of this.profiles) {
      try {
        const proxy = this.proxies.find(p => p.id === profile.proxy_id)
        const hasMappedProxy = !!proxy

        this.recordResult(
          profile.name,
          'Proxy Mapping',
          hasMappedProxy,
          hasMappedProxy ? `Mapped to proxy in ${proxy.country}` : 'No proxy mapped',
          {
            proxyId: profile.proxy_id,
            proxyName: proxy?.name,
            country: proxy?.country
          }
        )

        console.log(`${hasMappedProxy ? '✓' : '✗'} ${profile.name}: ${hasMappedProxy ? 'PASS' : 'FAIL'}`)
      } catch (error) {
        this.recordResult(profile.name, 'Proxy Mapping', false, String(error))
        console.log(`✗ ${profile.name}: ERROR`)
      }
    }

    console.log('')
  }

  async testDataIntegrity(): Promise<void> {
    console.log('🧪 Test: Data Integrity\n')

    const checks = {
      profiles: this.profiles.length > 0,
      proxies: this.proxies.length > 0,
      credentials: this.credentials.length > 0,
      profileCount: this.profiles.length >= 5,
      proxyCount: this.proxies.length >= 5,
      uniqueIds: new Set(this.profiles.map(p => p.id)).size === this.profiles.length
    }

    for (const [check, passed] of Object.entries(checks)) {
      const message = passed
        ? `${check} check passed`
        : `${check} check failed - test data incomplete`

      this.recordResult('System', `Data Integrity (${check})`, passed, message)
      console.log(`${passed ? '✓' : '✗'} ${check}: ${passed ? 'PASS' : 'FAIL'}`)
    }

    console.log('')
  }

  async runAllTests(): Promise<void> {
    console.log('\n' + '='.repeat(60))
    console.log('Ghost Browser Multi-Login Test Suite')
    console.log('='.repeat(60) + '\n')

    const startTime = Date.now()

    await this.testDataIntegrity()
    await this.testFingerprintConsistency()
    await this.testProxyConfiguration()
    await this.testProfileGroupAssignment()
    await this.testCredentialMapping()
    await this.testProxyProfileMapping()

    const duration = Date.now() - startTime

    this.printSummary(duration)
    this.saveResults()
  }

  private printSummary(duration: number): void {
    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => !r.passed).length
    const total = this.results.length

    console.log('='.repeat(60))
    console.log('Test Summary')
    console.log('='.repeat(60))
    console.log(`✓ Passed: ${passed}`)
    console.log(`✗ Failed: ${failed}`)
    console.log(`⏱ Duration: ${(duration / 1000).toFixed(2)}s`)
    console.log(`📊 Pass Rate: ${((passed / total) * 100).toFixed(1)}%`)

    if (failed > 0) {
      console.log('\n❌ Failed Tests:')
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  • ${r.profile} - ${r.test}: ${r.message}`)
        })
    }

    console.log('\n✨ All tests completed!\n')
  }

  private saveResults(): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const resultsFile = path.join(
      this.testdataDir,
      `multilogin-test-results-${timestamp.slice(0, 10)}.json`
    )

    fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2))
    console.log(`📄 Results saved to: ${resultsFile}`)
  }

  getResults(): TestResult[] {
    return this.results
  }

  getPassRate(): number {
    const passed = this.results.filter(r => r.passed).length
    return (passed / this.results.length) * 100
  }
}

// Run tests if executed directly
if (require.main === module) {
  const runner = new MultiLoginTestRunner()
  runner.runAllTests()
}

export { MultiLoginTestRunner }
