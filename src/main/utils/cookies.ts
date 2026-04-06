/** Parse Netscape-format cookie file into cookie objects */
export function parseNetscapeCookies(text: string): any[] {
  return text
    .split('\n')
    .filter((line) => line.trim() && (!line.startsWith('#') || line.startsWith('#HttpOnly_')))
    .map((line) => {
      const parts = line.split('\t')
      if (parts.length < 7) return null
      return {
        domain: parts[0].replace(/^#HttpOnly_/, ''),
        httpOnly: parts[0].startsWith('#HttpOnly_'),
        path: parts[2],
        secure: parts[3].toUpperCase() === 'TRUE',
        expires: parseInt(parts[4]) || undefined,
        name: parts[5],
        value: parts[6].trim()
      }
    })
    .filter(Boolean)
}

/** Serialize cookie objects to Netscape-format string */
export function toNetscapeFormat(cookies: any[]): string {
  const lines = ['# Netscape HTTP Cookie File', '']
  for (const c of cookies) {
    lines.push(
      [
        c.httpOnly ? `#HttpOnly_${c.domain}` : c.domain,
        'TRUE',
        c.path || '/',
        c.secure ? 'TRUE' : 'FALSE',
        c.expires || '0',
        c.name,
        c.value
      ].join('\t')
    )
  }
  return lines.join('\n')
}
