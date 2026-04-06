import React, { useState } from 'react'
import { Sidebar } from './components/Layout/Sidebar'
import { ProfileManager } from './components/ProfileManager'
import { ProxyManager } from './components/ProxyManager'
import { FingerprintEditor } from './components/FingerprintEditor'
import { useProfileStore } from './stores/profileStore'
import type { NavSection } from './types'

function SettingsPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-slate-800">
        <h1 className="text-lg font-semibold text-white">Settings</h1>
      </div>
      <div className="flex-1 p-6">
        <div className="card max-w-lg">
          <h2 className="text-sm font-semibold text-white mb-4">About Ghost Browser</h2>
          <div className="space-y-2 text-sm text-slate-400">
            <div className="flex justify-between"><span>Version</span><span className="text-slate-300">0.1.0 Beta</span></div>
            <div className="flex justify-between"><span>Phase</span><span className="text-slate-300">1 - MVP</span></div>
            <div className="flex justify-between"><span>Fingerprint Layer</span><span className="text-slate-300">CDP + JS Injection</span></div>
            <div className="flex justify-between"><span>Vectors Protected</span><span className="text-green-400">16 / 18</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}

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
