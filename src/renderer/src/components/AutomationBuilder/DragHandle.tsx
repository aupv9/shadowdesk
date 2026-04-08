import React, { useState } from 'react'
import { GripVertical } from 'lucide-react'

interface DragHandleProps {
  index: number
  isDragging: boolean
  onDragStart: (e: React.DragEvent<HTMLButtonElement>) => void
  onDragEnd: () => void
}

export function DragHandle({ index, isDragging, onDragStart, onDragEnd }: DragHandleProps) {
  const [isHovering, setIsHovering] = useState(false)

  return (
    <button
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      type="button"
      className={`
        flex items-center justify-center w-6 h-6 rounded
        transition-all duration-200
        ${isDragging
          ? 'text-white opacity-100 bg-slate-600 cursor-grabbing'
          : isHovering
            ? 'text-slate-400 opacity-100 cursor-grab hover:bg-slate-800/50'
            : 'text-slate-600 opacity-50 cursor-grab'
        }
      `}
      title={`Drag to reorder step ${index + 1}`}
      aria-label={`Drag handle for step ${index + 1}`}
    >
      <GripVertical className="w-4 h-4" />
    </button>
  )
}
