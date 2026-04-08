import React from 'react'

interface DropZoneIndicatorProps {
  isActive: boolean
  position: number
}

export function DropZoneIndicator({ isActive, position }: DropZoneIndicatorProps) {
  if (!isActive) return null

  return (
    <div
      className="h-1 bg-gradient-to-r from-transparent via-ghost-400 to-transparent rounded-full my-1 animate-pulse"
      role="status"
      aria-label={`Drop zone at position ${position}`}
    />
  )
}
