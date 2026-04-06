import React, { useState } from 'react'
import { Sidebar } from './components/Layout/Sidebar'
import { ProfileManager } from './components/ProfileManager'
import { ProxyManager } from './components/ProxyManager'
import { FingerprintEditor } from './components/FingerprintEditor'
import { SettingsPage } from './components/Settings'
import { useProfileStore } from './stores/profileStore'
import type { NavSection } from './types'

export default function App() {
  const [section, setSection] = useState<NavSection>('profiles')
  const { profiles, activeSessions } = useProfileStore()

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      <Sidebar
        active={section}
        onChange={setSection}
        profileCount={profiles.length}
        activeSessionCount={activeSessions.length}
      />
      <main className="flex-1 overflow-hidden flex flex-col bg-slate-900/50">
        {section === 'profiles'    && <ProfileManager />}
        {section === 'proxies'     && <ProxyManager />}
        {section === 'fingerprint' && <FingerprintEditor />}
        {section === 'settings'   && <SettingsPage />}
      </main>
    </div>
  )
}
