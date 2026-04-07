import React, { useEffect, useState } from 'react'
import { Sidebar } from './components/Layout/Sidebar'
import { ProfileManager } from './components/ProfileManager'
import { ProxyManager } from './components/ProxyManager'
import { FingerprintEditor } from './components/FingerprintEditor'
import { DetectionDashboard } from './components/DetectionDashboard'
import { AutomationBuilder } from './components/AutomationBuilder'
import { SettingsPage } from './components/Settings'
import { AccountPage } from './components/Account'
import { TeamManager } from './components/TeamManager'
import { PatchManager } from './components/PatchManager'
import { ErrorBoundary } from './components/UI/ErrorBoundary'
import { ToastContainer } from './components/UI/Toast'
import { useProfileStore } from './stores/profileStore'
import { useAuthStore } from './stores/authStore'
import { useLicenseStore } from './stores/licenseStore'
import type { NavSection } from './types'

export default function App() {
  const [section, setSection] = useState<NavSection>('profiles')
  const { profiles, activeSessions } = useProfileStore()
  const auth = useAuthStore()
  const license = useLicenseStore()

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
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
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
        <ErrorBoundary section="Detection">
          {section === 'detection'   && <DetectionDashboard />}
        </ErrorBoundary>
        <ErrorBoundary section="Automation">
          {section === 'automation'  && <AutomationBuilder />}
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
      </main>
      <ToastContainer />
    </div>
  )
}
