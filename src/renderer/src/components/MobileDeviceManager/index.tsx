import React, { useEffect, useState } from 'react'
import {
  Smartphone,
  RefreshCw,
  Power,
  Settings,
  AlertCircle,
  CheckCircle2,
  Clock,
  Wifi,
  Activity,
  ExternalLink
} from 'lucide-react'
import type { RealAndroidDevice, RealIosDevice, RealDevice } from '../../types'

type DeviceTab = 'android' | 'ios'

export function MobileDeviceManager() {
  const [androidDevices, setAndroidDevices] = useState<RealAndroidDevice[]>([])
  const [iosDevices, setIosDevices] = useState<RealIosDevice[]>([])
  const [tab, setTab] = useState<DeviceTab>('android')
  const [isLoading, setIsLoading] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<RealDevice | null>(null)
  const [webdriverStatus, setWebdriverStatus] = useState<Record<string, boolean>>({})

  useEffect(() => {
    discoverDevices()
  }, [])

  const discoverDevices = async () => {
    setIsLoading(true)
    try {
      const [android, ios] = await Promise.all([
        window.api.mobileDevice.listAndroid().catch(() => []),
        window.api.mobileDevice.listIos().catch(() => [])
      ])
      setAndroidDevices(android)
      setIosDevices(ios)
    } catch {
      // Error handled by API
    } finally {
      setIsLoading(false)
    }
  }

  const checkDeviceHealth = async (device: RealDevice) => {
    try {
      const healthy = await window.api.mobileDevice.checkHealth(device.id, device.type)
      console.log(`Device ${device.id} health: ${healthy ? 'OK' : 'FAIL'}`)
    } catch (err) {
      console.error('Health check failed:', err)
    }
  }

  const enableWebDriver = async (device: RealDevice) => {
    try {
      await window.api.mobileDevice.enableWebDriver(device.id, device.type)
      setWebdriverStatus((s) => ({ ...s, [device.id]: true }))
    } catch (err: any) {
      alert(`Failed to enable WebDriver: ${err.message}`)
    }
  }

  const launchChrome = async (device: RealDevice, url?: string) => {
    try {
      await window.api.mobileDevice.launchChrome(device.id, device.type, url)
    } catch (err: any) {
      alert(`Failed to launch Chrome: ${err.message}`)
    }
  }

  const closeChrome = async (device: RealDevice) => {
    try {
      await window.api.mobileDevice.closeChrome(device.id, device.type)
    } catch (err: any) {
      alert(`Failed to close Chrome: ${err.message}`)
    }
  }

  const getCdpEndpoint = async (device: RealDevice) => {
    try {
      const endpoint = await window.api.mobileDevice.getCdpEndpoint(device.id, device.type)
      return endpoint
    } catch (err: any) {
      alert(`Failed to get CDP endpoint: ${err.message}`)
      return null
    }
  }

  const devices = tab === 'android' ? androidDevices : iosDevices

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Real Device Manager</h1>
            <p className="text-xs text-slate-500">Phase 18 — ADB (Android) & Appium (iOS)</p>
          </div>
        </div>

        <button
          onClick={discoverDevices}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          {isLoading ? 'Scanning...' : 'Scan Devices'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-900 border-b border-slate-800 px-6">
        <button
          onClick={() => setTab('android')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            tab === 'android'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Android ({androidDevices.length})
        </button>
        <button
          onClick={() => setTab('ios')}
          className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
            tab === 'ios'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          iOS ({iosDevices.length})
        </button>
      </div>

      {/* Device List */}
      <div className="flex-1 overflow-y-auto p-4">
        {devices.length === 0 ? (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-600 text-sm mb-2">
              {tab === 'android'
                ? 'No Android devices found. Connect via USB or start emulator.'
                : 'No iOS devices found. Connect via USB and trust developer certificate.'}
            </p>
            <p className="text-slate-700 text-xs">
              {tab === 'android'
                ? 'Enable USB debugging in Developer Options'
                : 'Ensure Appium and WebDriverAgent are installed'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.id}
                className={`bg-slate-800/60 border border-slate-700/50 rounded-lg p-4 transition-colors cursor-pointer ${
                  selectedDevice?.id === device.id ? 'ring-2 ring-blue-500/50' : 'hover:bg-slate-800'
                }`}
                onClick={() => setSelectedDevice(device)}
              >
                {/* Device Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3 flex-1">
                    <Smartphone className="w-5 h-5 text-blue-400" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{device.name}</p>
                      <p className="text-xs text-slate-500">
                        {device.model} • {tab === 'android' ? (device as any).androidVersion : (device as any).osVersion}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      {device.isConnected ? (
                        <div className="flex items-center gap-1 px-2 py-1 bg-green-600/20 rounded text-[10px] text-green-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Connected
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 px-2 py-1 bg-red-600/20 rounded text-[10px] text-red-400">
                          <AlertCircle className="w-3 h-3" />
                          Disconnected
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Device Details */}
                <div className="grid grid-cols-3 gap-2 mb-3 text-[10px]">
                  <div className="bg-slate-900/60 rounded px-2 py-1">
                    <span className="text-slate-500">Device ID</span>
                    <p className="text-slate-300 font-mono truncate">{device.id.slice(0, 12)}</p>
                  </div>
                  <div className="bg-slate-900/60 rounded px-2 py-1">
                    <span className="text-slate-500">WebDriver Port</span>
                    <p className="text-slate-300 font-mono">{device.webdriverPort}</p>
                  </div>
                  <div className="bg-slate-900/60 rounded px-2 py-1">
                    <span className="text-slate-500">Type</span>
                    <p className="text-slate-300">{tab === 'android' ? 'ADB' : 'Appium'}</p>
                  </div>
                </div>

                {/* Device Error (if any) */}
                {device.error && (
                  <div className="mb-3 p-2 bg-red-900/20 border border-red-800/50 rounded text-[10px] text-red-400">
                    {device.error}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); checkDeviceHealth(device) }}
                    className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-medium rounded transition-colors"
                  >
                    <Activity className="w-3 h-3" /> Health
                  </button>

                  {device.isConnected && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); enableWebDriver(device) }}
                        disabled={webdriverStatus[device.id]}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-green-600 text-white text-[10px] font-medium rounded transition-colors"
                      >
                        <Settings className="w-3 h-3" />
                        {webdriverStatus[device.id] ? 'WebDriver On' : 'Enable WebDriver'}
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); launchChrome(device) }}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 hover:bg-green-500 text-white text-[10px] font-medium rounded transition-colors"
                      >
                        <Power className="w-3 h-3" /> Launch Chrome
                      </button>

                      <button
                        onClick={(e) => { e.stopPropagation(); closeChrome(device) }}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-medium rounded transition-colors"
                      >
                        <Power className="w-3 h-3" /> Close Chrome
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Panel */}
      <div className="border-t border-slate-800 bg-slate-900/50 px-6 py-3 text-xs text-slate-500">
        <p>
          💡 <strong>Phase 18:</strong> ADB (Android) connects via USB + enables Chrome WebDriver. iOS requires Appium + WebDriverAgent. Real device workflows execute via CDP endpoints.
        </p>
      </div>
    </div>
  )
}
