import React from 'react'

interface ActivityChartProps {
  data: { date: string; count: number }[]
}

function getDayName(dateStr: string): string {
  try {
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  } catch {
    return dateStr
  }
}

export function ActivityChart({ data }: ActivityChartProps) {
  // Fill in missing days for the last 7 days
  const days: { date: string; count: number; dayName: string }[] = []
  const now = new Date()

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const match = data.find((item) => item.date === dateStr)
    days.push({
      date: dateStr,
      count: match?.count ?? 0,
      dayName: getDayName(dateStr)
    })
  }

  const maxCount = Math.max(...days.map((d) => d.count), 1)

  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-white mb-4">Session Activity (Last 7 Days)</h3>
      <div className="flex items-end gap-2 h-40">
        {days.map((day) => {
          const heightPct = (day.count / maxCount) * 100
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-slate-400 font-medium">{day.count}</span>
              <div className="w-full flex justify-center" style={{ height: '120px' }}>
                <div
                  className="w-full max-w-[36px] rounded-t-md bg-ghost-600/60 hover:bg-ghost-500/80 transition-colors"
                  style={{ height: `${Math.max(heightPct, 2)}%` }}
                  title={`${day.date}: ${day.count} sessions`}
                />
              </div>
              <span className="text-[10px] text-slate-500">{day.dayName}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
