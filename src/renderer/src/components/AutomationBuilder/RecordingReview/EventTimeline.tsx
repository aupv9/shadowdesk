import React, { useState } from 'react'
import { MousePointer, Type, Navigation, ChevronDown, Scroll, Keyboard } from 'lucide-react'

interface RecordedEvent {
  type: string
  selector: string
  value?: string
  url?: string
  tag?: string
  label?: string
  timestamp: number
  timingMs?: number
  screenshotPath?: string
  domSnapshot?: string
  networkRequests?: string[]
}

interface RecordedScreenshot {
  eventTimestamp: number
  dataUrl: string
}

interface Props {
  events: RecordedEvent[]
  screenshots: RecordedScreenshot[]
}

const EVENT_COLORS: Record<string, string> = {
  navigate: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  click: 'text-green-400 bg-green-500/10 border-green-500/30',
  input: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  change: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  submit: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  scroll: 'text-slate-400 bg-slate-500/10 border-slate-500/30',
  keypress: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
}

function EventIcon({ type }: { type: string }) {
  switch (type) {
    case 'navigate': return <Navigation className="w-3 h-3" />
    case 'click':
    case 'submit': return <MousePointer className="w-3 h-3" />
    case 'input':
    case 'change': return <Type className="w-3 h-3" />
    case 'scroll': return <Scroll className="w-3 h-3" />
    case 'keypress': return <Keyboard className="w-3 h-3" />
    default: return <MousePointer className="w-3 h-3" />
  }
}

export function EventTimeline({ events, screenshots }: Props) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)

  function getScreenshot(ts: number): RecordedScreenshot | undefined {
    // Find closest screenshot taken at or after this timestamp
    return screenshots.find((s) => Math.abs(s.eventTimestamp - ts) < 3000)
  }

  return (
    <div className="flex flex-col gap-1 overflow-y-auto max-h-full pr-1">
      {events.length === 0 && (
        <div className="text-sm text-slate-500 p-4 text-center">No events recorded.</div>
      )}
      {events.map((ev, idx) => {
        const colorClass = EVENT_COLORS[ev.type] ?? 'text-slate-400 bg-slate-500/10 border-slate-500/30'
        const screenshot = getScreenshot(ev.timestamp)
        const isExpanded = expandedIdx === idx
        const timingLabel = ev.timingMs && ev.timingMs > 0
          ? `+${(ev.timingMs / 1000).toFixed(1)}s`
          : null

        return (
          <div key={idx} className="flex flex-col">
            {/* Timing gap indicator */}
            {timingLabel && (
              <div className="flex items-center gap-2 ml-5 my-0.5">
                <div className="w-px h-3 bg-slate-700 ml-2" />
                <span className="text-[10px] text-slate-600">{timingLabel}</span>
              </div>
            )}

            {/* Event row */}
            <div
              className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer hover:opacity-90 transition-opacity ${colorClass}`}
              onClick={() => setExpandedIdx(isExpanded ? null : idx)}
            >
              {/* Thumbnail */}
              {screenshot ? (
                <button
                  className="shrink-0 w-12 h-8 rounded border border-slate-600 overflow-hidden"
                  onClick={(e) => { e.stopPropagation(); setLightboxImg(screenshot.dataUrl) }}
                >
                  <img src={screenshot.dataUrl} alt="screenshot" className="w-full h-full object-cover" />
                </button>
              ) : (
                <div className="shrink-0 w-12 h-8 rounded border border-slate-700 bg-slate-800/50 flex items-center justify-center">
                  <EventIcon type={ev.type} />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-semibold opacity-70">{ev.type}</span>
                  <span className="text-xs truncate flex-1">{ev.label || ev.selector || ev.url}</span>
                  <ChevronDown className={`w-3 h-3 opacity-50 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
                {ev.value && (
                  <div className="text-[10px] opacity-60 truncate mt-0.5 font-mono">
                    {ev.type === 'input' && ev.value === '' ? '••••••' : ev.value}
                  </div>
                )}
              </div>
            </div>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="ml-14 mt-1 mb-2 p-2 bg-slate-900/70 rounded border border-slate-700/50 text-xs space-y-1">
                {ev.url && <div><span className="text-slate-500">URL:</span> <span className="text-slate-300 font-mono break-all">{ev.url}</span></div>}
                {ev.selector && <div><span className="text-slate-500">Selector:</span> <code className="text-ghost-400 font-mono break-all">{ev.selector}</code></div>}
                {ev.value && <div><span className="text-slate-500">Value:</span> <span className="text-slate-300 font-mono">{ev.value === '' && ev.type === 'input' ? '(password hidden)' : ev.value}</span></div>}
                {ev.networkRequests && ev.networkRequests.length > 0 && (
                  <div>
                    <span className="text-slate-500">Network ({ev.networkRequests.length}):</span>
                    <div className="mt-0.5 space-y-0.5 max-h-20 overflow-y-auto">
                      {ev.networkRequests.map((url, i) => (
                        <div key={i} className="text-slate-400 font-mono break-all truncate">{url}</div>
                      ))}
                    </div>
                  </div>
                )}
                {ev.domSnapshot && (
                  <div>
                    <span className="text-slate-500">DOM snapshot:</span>
                    <pre className="mt-0.5 text-[9px] text-slate-400 overflow-x-auto max-h-20 whitespace-pre-wrap break-all">{ev.domSnapshot.slice(0, 400)}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setLightboxImg(null)}
        >
          <img src={lightboxImg} alt="screenshot" className="max-w-[90vw] max-h-[90vh] rounded-lg border border-slate-700" />
        </div>
      )}
    </div>
  )
}
