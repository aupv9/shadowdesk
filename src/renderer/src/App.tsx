import React, { useEffect, useState } from 'react'
import { Sidebar } from './components/Layout/Sidebar'
import { ProfileManager } from './components/ProfileManager'
import { ProxyManager } from './components/ProxyManager'
import { FingerprintEditor } from './components/FingerprintEditor'
import { BehavioralConfig } from './components/BehavioralConfig'
import { DetectionDashboard } from './components/DetectionDashboard'
import { AutomationBuilder } from './components/AutomationBuilder'
import { RunDashboard } from './components/RunDashboard'
import { SettingsPage } from './components/Settings'
import { AccountPage } from './components/Account'
import { TeamManager } from './components/TeamManager'
import { PatchManager } from './components/PatchManager'
import { Marketplace } from './components/Marketplace'
import { AIAssistant } from './components/AIAssistant'
import { ErrorBoundary } from './components/UI/ErrorBoundary'
import { ToastContainer } from './components/UI/Toast'
import { ConfirmDialog } from './components/UI/ConfirmDialog'
import { OfflineBanner } from './components/UI/OfflineBanner'
import { WelcomeWizard, useWelcomeWizard } from './components/WelcomeWizard'
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
        <ErrorBoundary section="Proxies">
          {section === 'proxies'     && <ProxyManager />}
        </ErrorBoundary>
        <ErrorBoundary section="Fingerprint">
          {section === 'fingerprint' && <FingerprintEditor />}
        </ErrorBoundary>
        <ErrorBoundary section="Behavior">
          {section === 'behavior'    && <BehavioralConfig />}
        </ErrorBoundary>
        <ErrorBoundary section="Detection">
          {section === 'detection'   && <DetectionDashboard onNavigate={setSection} />}
        </ErrorBoundary>
        <ErrorBoundary section="Automation">
          {section === 'automation'  && <AutomationBuilder />}
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
      </main>
      <ToastContainer />
      </div>

      {/* Phase 13.C — Confirm dialog (mounts once, imperative API) */}
      <ConfirmDialog />

      {/* Phase 13.C — Welcome wizard for first-time users */}
      {showWizard && <WelcomeWizard onDismiss={dismissWizard} />}
    </div>
  )
}
