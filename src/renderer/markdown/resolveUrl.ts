const SAFE_PROTOCOL = /^(https?|mailto|tel|data):/i
const ANY_PROTOCOL = /^[a-z][a-z0-9+.-]*:/i

function normalizePosix(p: string): string {
  const isAbs = p.startsWith('/')
  const out: string[] = []
  for (const seg of p.split('/')) {
    if (!seg || seg === '.') continue
    if (seg === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop()
      else if (!isAbs) out.push('..')
    } else {
      out.push(seg)
    }
  }
  return (isAbs ? '/' : '') + out.join('/')
}

function toFileUrl(absPath: string): string {
  const encoded = absPath
    .split('/')
    .map((seg) => (seg ? encodeURIComponent(seg) : seg))
    .join('/')
  return `file://${encoded}`
}

/**
 * Resolve a markdown resource URL (image src / link href) for display in the
 * packaged app. Relative and absolute filesystem paths become file:// URLs
 * anchored at the open document's directory, so images load from next to the
 * markdown file instead of from inside the app bundle (which 404s with
 * net::ERR_FILE_NOT_FOUND). Web URLs, data URIs, fragments, and existing file:
 * URLs pass through unchanged; unknown/unsafe protocols are dropped.
 */
export function resolveResourceUrl(url: string, basePath?: string | null): string {
  if (!url) return url
  if (url.startsWith('#')) return url
  if (SAFE_PROTOCOL.test(url)) return url
  if (url.startsWith('file:')) return url
  if (ANY_PROTOCOL.test(url)) return '' // javascript:, vbscript:, etc.

  let abs: string
  if (url.startsWith('/')) abs = url
  else if (basePath) abs = `${basePath}/${url}`
  else return url

  return toFileUrl(normalizePosix(abs))
}
