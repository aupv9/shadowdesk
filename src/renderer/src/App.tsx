import React, { useCallback, useEffect, useState } from 'react'
import { Sidebar } from './components/Layout/Sidebar'
import { ProfileManager } from './components/ProfileManager'
import { ProxyManager } from './components/ProxyManager'
import { FingerprintEditor } from './components/FingerprintEditor'
import { BehavioralConfig } from './components/BehavioralConfig'
import { CorrelationDashboard } from './components/CorrelationDashboard'
import { DetectionDashboard } from './components/DetectionDashboard'
import { AutomationBuilder } from './components/AutomationBuilder'
import { RunDashboard } from './components/RunDashboard'
import { SettingsPage } from './components/Settings'
import { AccountPage } from './components/Account'
import { TeamManager } from './components/TeamManager'
import { PatchManager } from './components/PatchManager'
import { Marketplace } from './components/Marketplace'
import { AIAssistant } from './components/AIAssistant'
import { SEAPlatforms } from './components/SEAPlatforms'
import { SmartWarmUp } from './components/SmartWarmUp'
import { ImportHistory } from './components/ImportHistory'
import { ImportWizard } from './components/ImportWizard'
import { MobileWorkflowBuilder } from './components/MobileWorkflowBuilder'
import { MobileDeviceManager } from './components/MobileDeviceManager'
import { AnalyticsDashboardPage } from './components/AnalyticsDashboardPage'
import { BillingPortal } from './components/BillingPortal'
import { SupportCenter } from './components/SupportCenter'
import { ErrorBoundary } from './components/UI/ErrorBoundary'
import { ToastContainer } from './components/UI/Toast'
import { ConfirmDialog } from './components/UI/ConfirmDialog'
import { OfflineBanner } from './components/UI/OfflineBanner'
import { WelcomeWizard, useWelcomeWizard } from './components/WelcomeWizard'
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts'
import { useProfileStore } from './stores/profileStore'
import { useAuthStore } from './stores/authStore'
import { useLicenseStore } from './stores/licenseStore'
import { useToastStore } from './stores/toastStore'
import type { NavSection } from './types'

export default function App() {
  const [section, setSection] = useState<NavSection>('profiles')
  const { profiles, activeSessions } = useProfileStore()
  const auth = useAuthStore()
  const license = useLicenseStore()
  const { show: showWizard, dismiss: dismissWizard } = useWelcomeWizard()
  const pushToast = useToastStore((s) => s.push)

  // Phase 13.C — Global keyboard shortcuts
  const handleNewProfile = useCallback(() => {
    setSection('profiles')
  }, [])
  const handleSearch = useCallback(() => {
    setSection('profiles')
  }, [])
  const handleRefresh = useCallback(() => {
    useProfileStore.getState().fetchProfiles()
    useProfileStore.getState().fetchActiveSessions()
  }, [])
  useGlobalShortcuts({
    onNavigate: setSection,
    onNewProfile: handleNewProfile,
    onSearch: handleSearch,
    onRefresh: handleRefresh,
  })

  useEffect(() => {
    auth.checkAuth()
    license.fetchLicense()
    // Apply saved theme
    window.api.settings.get().then((s: any) => {
      const theme = s?.theme ?? 'dark'
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light')
      } else {
        document.documentElement.setAttribute('data-theme', theme)
      }
    })

    // Phase 13.E — Subscribe to structured error events from main process
    const unsubError = (window.api as any).onError?.((event: { category: string; message: string }) => {
      pushToast(`[${event.category}] ${event.message}`, 'error', 5000)
    })
    return () => { unsubError?.() }
  }, [])

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-900">
      {/* Phase 13.E — Offline status banner */}
      <OfflineBanner />

      <div className="flex flex-1 overflow-hidden">
      <Sidebar
        active={section}
        onChange={setSection}
        profileCount={profiles.length}
        activeSessionCount={activeSessions.length}
        user={auth.user}
        plan={license.license?.plan ?? 'free'}
      />
      <main className="flex-1 overflow-hidden flex flex-col bg-slate-900/50">
        <ErrorBoundary section="Profiles">
          {section === 'profiles'    && <ProfileManager />}
        </ErrorBoundary>
        <ErrorBoundary section="Import History">
          {section === 'import-history' && <ImportHistory />}
        </ErrorBoundary>
        <ErrorBoundary section="Proxies">
          {section === 'proxies'     && <ProxyManager />}
        </ErrorBoundary>
        <ErrorBoundary section="Fingerprint">
          {section === 'fingerprint' && <FingerprintEditor />}
        </ErrorBoundary>
        <ErrorBoundary section="Behavior">
          {section === 'behavior'    && <BehavioralConfig />}
        </ErrorBoundary>
        <ErrorBoundary section="Correlation">
          {section === 'correlation' && <CorrelationDashboard />}
        </ErrorBoundary>
        <ErrorBoundary section="Detection">
          {section === 'detection'   && <DetectionDashboard onNavigate={setSection} />}
        </ErrorBoundary>
        <ErrorBoundary section="Automation">
          {section === 'automation'  && <AutomationBuilder onNavigate={setSection} />}
        </ErrorBoundary>
        <ErrorBoundary section="Run Dashboard">
          {section === 'runs'        && <RunDashboard />}
        </ErrorBoundary>
        <ErrorBoundary section="Marketplace">
          {section === 'marketplace' && <Marketplace />}
        </ErrorBoundary>
        <ErrorBoundary section="Team">
          {section === 'team'        && <TeamManager />}
        </ErrorBoundary>
        <ErrorBoundary section="Patches">
          {section === 'patches'     && <PatchManager />}
        </ErrorBoundary>
        <ErrorBoundary section="Account">
          {section === 'account'     && <AccountPage />}
        </ErrorBoundary>
        <ErrorBoundary section="Settings">
          {section === 'settings'    && <SettingsPage />}
        </ErrorBoundary>
        <ErrorBoundary section="AI Assistant">
          {section === 'ai'          && <AIAssistant onNavigate={setSection} />}
        </ErrorBoundary>
        <ErrorBoundary section="SEA Platforms">
          {section === 'sea-platforms' && <SEAPlatforms onNavigate={setSection} />}
        </ErrorBoundary>
        <ErrorBoundary section="Smart Warm-Up">
          {section === 'smart-warmup' && <SmartWarmUp />}
        </ErrorBoundary>
        <ErrorBoundary section="Mobile Workflows">
          {section === 'mobile-workflows' && <MobileWorkflowBuilder />}
        </ErrorBoundary>
        <ErrorBoundary section="Mobile Devices">
          {section === 'mobile-devices' && <MobileDeviceManager />}
        </ErrorBoundary>
        <ErrorBoundary section="Analytics">
          {section === 'analytics' && <AnalyticsDashboardPage />}
        </ErrorBoundary>
        <ErrorBoundary section="Billing">
          {section === 'billing' && <BillingPortal />}
        </ErrorBoundary>
        <ErrorBoundary section="Support">
          {section === 'support' && <SupportCenter />}
        </ErrorBoundary>
      </main>
      <ToastContainer />
      </div>

      {/* Phase 1+2 — Bulk Import Wizard */}
      <ImportWizard />

      {/* Phase 13.C — Confirm dialog (mounts once, imperative API) */}
      <ConfirmDialog />

      {/* Phase 13.C — Welcome wizard for first-time users */}
      {showWizard && <WelcomeWizard onDismiss={dismissWizard} />}
    </div>
  )
}
