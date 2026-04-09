import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface DropdownMenuProps {
  open: boolean
  triggerRef: React.RefObject<HTMLElement>
  onClose: () => void
  children: React.ReactNode
  align?: 'right' | 'left'
  width?: number
}

/**
 * Portal-based dropdown that escapes overflow-hidden / overflow-y-auto ancestors.
 * Renders into document.body with fixed positioning anchored to the trigger element.
 */
export function DropdownMenu({ open, triggerRef, onClose, children, align = 'right', width = 176 }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ top: 0, right: 0, left: 0 })

  // Recalculate position whenever the menu opens
  useEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    setPos({
      top: rect.bottom + 4,
      right: window.innerWidth - rect.right,
      left: rect.left
    })
  }, [open, triggerRef])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (menuRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose, triggerRef])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  const style: React.CSSProperties = {
    position: 'fixed',
    top: pos.top,
    width,
    zIndex: 9999,
    ...(align === 'right' ? { right: pos.right } : { left: pos.left })
  }

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="bg-slate-800 border border-slate-700 rounded-xl shadow-2xl shadow-black/60 p-1"
    >
      {children}
    </div>,
    document.body
  )
}
