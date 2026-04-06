import React, { useEffect, useState } from 'react'
import { Sidebar } from './components/Layout/Sidebar'
import { DashboardPage } from './components/Dashboard'
import { ProfileManager } from './components/ProfileManager'
import { ProxyManager } from './components/ProxyManager'
import { FingerprintEditor } from './components/FingerprintEditor'
import { DetectionDashboard } from './components/DetectionDashboard'
import { AutomationBuilder } from './components/AutomationBuilder'
import { SettingsPage } from './components/Settings'
import { AccountPage } from './components/Account'
import { TeamManager } from './components/TeamManager'
import { useProfileStore } from './stores/profileStore'
import { useAuthStore } from './stores/authStore'
import { useLicenseStore } from './stores/licenseStore'
import type { NavSection } from './types'

export default function App() {
  const [section, setSection] = useState<NavSection>('dashboard')
  const { profiles, activeSessions } = useProfileStore()
  const auth = useAuthStore()
  const license = useLicenseStore()

  useEffect(() => {
    auth.checkAuth()
    license.fetchLicense()
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
        {section === 'dashboard'   && <DashboardPage />}
        {section === 'profiles'    && <ProfileManager />}
        {section === 'proxies'     && <ProxyManager />}
        {section === 'fingerprint' && <FingerprintEditor />}
        {section === 'detection'   && <DetectionDashboard />}
        {section === 'automation'  && <AutomationBuilder />}
        {section === 'team'        && <TeamManager />}
        {section === 'account'     && <AccountPage />}
        {section === 'settings'    && <SettingsPage />}
      </main>
    </div>
  )
}
