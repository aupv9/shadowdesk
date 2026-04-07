/**
 * Phase 13.B — Lightweight virtual list hook.
 *
 * Renders only the items visible in the scroll container plus an
 * overscan buffer. No external dependencies — uses ResizeObserver and
 * a scroll listener.
 *
 * Usage:
 *   const { containerProps, visibleItems, totalHeight } = useVirtualList({
 *     items: filtered,
 *     itemHeight: CARD_HEIGHT,
 *     overscan: 4,
 *   })
 *
 *   return (
 *     <div {...containerProps} style={{ height: '100%', overflowY: 'auto' }}>
 *       <div style={{ height: totalHeight, position: 'relative' }}>
 *         {visibleItems.map(({ item, offsetTop, key }) => (
 *           <div key={key} style={{ position: 'absolute', top: offsetTop, width: '100%' }}>
 *             <Card item={item} />
 *           </div>
 *         ))}
 *       </div>
 *     </div>
 *   )
 */

import { useRef, useState, useCallback, useEffect } from 'react'

export interface VirtualItem<T> {
  item: T
  index: number
  offsetTop: number
  key: string | number
}

interface UseVirtualListOptions<T> {
  items: T[]
  /** Fixed pixel height of each row. */
  itemHeight: number
  /** Extra rows to render above and below the viewport. Default 4. */
  overscan?: number
  /** Key extractor — defaults to index. */
  getKey?: (item: T, index: number) => string | number
}

interface UseVirtualListResult<T> {
  containerRef: React.RefObject<HTMLDivElement>
  /** Total scrollable height in pixels. */
  totalHeight: number
  /** Items to render with their absolute offsetTop. */
  visibleItems: VirtualItem<T>[]
  /** Props to spread onto the scroll container div. */
  containerProps: {
    ref: React.RefObject<HTMLDivElement>
    onScroll: () => void
    style: React.CSSProperties
  }
}

export function useVirtualList<T>({
  items,
  itemHeight,
  overscan = 4,
  getKey,
}: UseVirtualListOptions<T>): UseVirtualListResult<T> {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)
  const [containerHeight, setContainerHeight] = useState(600)

  // Track container height via ResizeObserver
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height)
      }
    })
    ro.observe(el)
    setContainerHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  const totalHeight = items.length * itemHeight

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
  const endIndex   = Math.min(
    items.length - 1,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  )

  const visibleItems: VirtualItem<T>[] = []
  for (let i = startIndex; i <= endIndex; i++) {
    visibleItems.push({
      item:      items[i],
      index:     i,
      offsetTop: i * itemHeight,
      key:       getKey ? getKey(items[i], i) : i,
    })
  }

  return {
    containerRef,
    totalHeight,
    visibleItems,
    containerProps: {
      ref: containerRef,
      onScroll: handleScroll,
      style: { overflowY: 'auto' as const },
    },
  }
}
