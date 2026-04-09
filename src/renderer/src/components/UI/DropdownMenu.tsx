import React, { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface DropdownMenuProps {
  open: boolean
  triggerRef: React.RefObject<HTMLElement>
  onClose: () => void
  children: React.ReactNode
  align?: 'right' | 'left'
  width?: number
}

interface Position {
  top: number | undefined
  bottom: number | undefined
  left: number | undefined
  right: number | undefined
}

const VIEWPORT_PADDING = 8
const MAX_HEIGHT = 420

/**
 * Portal-based dropdown that escapes overflow-hidden / overflow-y-auto ancestors.
 * Renders into document.body with fixed positioning anchored to the trigger element.
 * Auto-flips above the trigger when it would overflow the viewport bottom.
 */
export function DropdownMenu({ open, triggerRef, onClose, children, align = 'right', width = 176 }: DropdownMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<Position>({ top: undefined, bottom: undefined, left: undefined, right: undefined })

  const reposition = useCallback(() => {
    if (!triggerRef.current) return
    const triggerRect = triggerRef.current.getBoundingClientRect()
    const menuEl = menuRef.current
    const menuHeight = menuEl ? menuEl.scrollHeight : 300
    const vh = window.innerHeight

    // Decide vertical placement: below trigger, or above if not enough space below
    const spaceBelow = vh - triggerRect.bottom - VIEWPORT_PADDING
    const spaceAbove = triggerRect.top - VIEWPORT_PADDING
    const fitsBelow = spaceBelow >= Math.min(menuHeight, MAX_HEIGHT)

    const next: Position = { top: undefined, bottom: undefined, left: undefined, right: undefined }

    if (fitsBelow) {
      next.top = triggerRect.bottom + 4
    } else if (spaceAbove > spaceBelow) {
      // Flip above
      next.bottom = vh - triggerRect.top + 4
    } else {
      // Neither fits well — place below but it will scroll with max-height
      next.top = triggerRect.bottom + 4
    }

    // Horizontal alignment
    if (align === 'right') {
      next.right = Math.max(VIEWPORT_PADDING, window.innerWidth - triggerRect.right)
    } else {
      next.left = Math.max(VIEWPORT_PADDING, triggerRect.left)
    }

    setPos(next)
  }, [triggerRef, align])

  // Calculate position after DOM paint so menuRef.scrollHeight is available
  useLayoutEffect(() => {
    if (!open) return
    // Run on next frame so the portal DOM is mounted
    const raf = requestAnimationFrame(() => reposition())
    return () => cancelAnimationFrame(raf)
  }, [open, reposition])

  // Reposition on scroll / resize while open
  useEffect(() => {
    if (!open) return
    const handler = () => reposition()
    window.addEventListener('resize', handler)
    // Capture phase to catch scroll on any ancestor
    document.addEventListener('scroll', handler, true)
    return () => {
      window.removeEventListener('resize', handler)
      document.removeEventListener('scroll', handler, true)
    }
  }, [open, reposition])

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
    width,
    zIndex: 9999,
    maxHeight: MAX_HEIGHT,
    overflowY: 'auto',
    // Only set the values that were calculated (top OR bottom, left OR right)
    ...(pos.top !== undefined ? { top: pos.top } : {}),
    ...(pos.bottom !== undefined ? { bottom: pos.bottom } : {}),
    ...(pos.left !== undefined ? { left: pos.left } : {}),
    ...(pos.right !== undefined ? { right: pos.right } : {}),
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
