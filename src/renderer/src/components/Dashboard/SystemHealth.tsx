import React from 'react'
import {
  Globe, Database, CloudOff, Cloud, Cpu, Info
} from 'lucide-react'

interface SystemHealthProps {
  proxyHealth: { total: number; healthy: number; unhealthy: number; untested: number }
  activeSessions: number
  dbSizeBytes: number
  lastSync: any
  appVersion: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

export function SystemHealth({ proxyHealth, activeSessions, dbSizeBytes, lastSync, appVersion }: SystemHealthProps) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-white mb-4">System Health</h3>
      <div className="space-y-3">
        {/* Proxy Health */}
        <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5">
          <Globe className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-300 font-medium">Proxy Health</div>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-green-400">{proxyHealth.healthy}</span>
              </span>
              <span className="flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-red-400">{proxyHealth.unhealthy}</span>
              </span>
              <span className="flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-slate-500">{proxyHealth.untested}</span>
              </span>
            </div>
          </div>
          <span className="text-xs text-slate-500">{proxyHealth.total} total</span>
        </div>

        {/* Active Sessions */}
        <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5">
          <Cpu className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-300 font-medium">Active Sessions</div>
          </div>
          <span className={`text-sm font-bold ${activeSessions > 0 ? 'text-green-400' : 'text-slate-500'}`}>
            {activeSessions}
          </span>
        </div>

        {/* Database Size */}
        <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5">
          <Database className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-300 font-medium">Database Size</div>
          </div>
          <span className="text-xs text-slate-400">{formatBytes(dbSizeBytes)}</span>
        </div>

        {/* Last Sync */}
        <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5">
          {lastSync ? (
            <Cloud className="w-4 h-4 text-slate-400 shrink-0" />
          ) : (
            <CloudOff className="w-4 h-4 text-slate-600 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-300 font-medium">Cloud Sync</div>
          </div>
          {lastSync ? (
            <div className="text-right">
              <span className={`text-xs ${lastSync.status === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {lastSync.status}
              </span>
              <div className="text-[10px] text-slate-500">
                {new Date(lastSync.synced_at).toLocaleDateString()}
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-600">Not configured</span>
          )}
        </div>

        {/* App Version */}
        <div className="flex items-center gap-3 bg-slate-800/50 rounded-lg px-3 py-2.5">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-slate-300 font-medium">App Version</div>
          </div>
          <span className="text-xs text-slate-400">v{appVersion}</span>
        </div>
      </div>
    </div>
  )
}
