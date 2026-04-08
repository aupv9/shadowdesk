import React, { useState } from 'react'
import { ThumbsUp, ThumbsDown } from 'lucide-react'

interface GuideRatingProps {
  method: 'record' | 'template' | 'ai' | 'scratch'
  onRate: (helpful: boolean) => void
  helpfulCount?: number
}

export function GuideRating({
  method,
  onRate,
  helpfulCount = 0
}: GuideRatingProps) {
  const [hasRated, setHasRated] = useState(false)
  const [rating, setRating] = useState<boolean | null>(null)

  const handleRate = (helpful: boolean) => {
    if (!hasRated) {
      setRating(helpful)
      setHasRated(true)
      onRate(helpful)
    }
  }

  if (hasRated) {
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
        <p className="text-sm text-emerald-300 font-medium">
          {rating
            ? '✓ Thanks for the feedback!'
            : '✓ We appreciate your feedback'}
        </p>
        {helpfulCount > 0 && (
          <p className="text-xs text-emerald-300/70 mt-1">
            {helpfulCount} people found this helpful
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-300 font-medium">
          Was this guide helpful?
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleRate(true)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700/50 hover:border-emerald-500/50 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-300 transition-all"
          >
            <ThumbsUp className="w-4 h-4" />
            <span className="text-xs">Yes</span>
          </button>
          <button
            onClick={() => handleRate(false)}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-700/50 hover:border-rose-500/50 hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 transition-all"
          >
            <ThumbsDown className="w-4 h-4" />
            <span className="text-xs">No</span>
          </button>
        </div>
      </div>
      {helpfulCount > 0 && (
        <p className="text-xs text-slate-500 mt-2">
          {helpfulCount} people found this helpful
        </p>
      )}
    </div>
  )
}
