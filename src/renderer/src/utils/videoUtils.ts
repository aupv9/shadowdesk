/**
 * Video utility functions for parsing and embedding videos in guides
 */

export interface VideoInfo {
  url: string
  type: 'youtube' | 'loom' | 'vimeo'
  embedUrl: string
  title?: string
  duration?: string
}

export function parseVideoUrl(url: string): VideoInfo | null {
  if (!url) return null

  // YouTube
  const youtubeMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/
  )
  if (youtubeMatch) {
    return {
      url,
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${youtubeMatch[1]}?rel=0`
    }
  }

  // Loom
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/)
  if (loomMatch) {
    return {
      url,
      type: 'loom',
      embedUrl: `https://www.loom.com/embed/${loomMatch[1]}`
    }
  }

  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/)
  if (vimeoMatch) {
    return {
      url,
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}`
    }
  }

  return null
}

export function getEmbedDimensions() {
  return {
    width: '100%',
    height: '400px',
    aspectRatio: '16 / 9'
  }
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  return `${secs}s`
}

export const VIDEO_LIBRARY = {
  record:
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ' /* placeholder */,
  template:
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ' /* placeholder */,
  ai: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' /* placeholder */,
  scratch: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' /* placeholder */
}
