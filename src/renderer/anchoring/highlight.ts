import { extractText } from './extractText'
import type { CommentStatus } from '../types'

export interface HighlightRange {
  id: string
  startOffset: number
  endOffset: number
  status: CommentStatus
}

export function clearHighlights(root: HTMLElement): void {
  const marks = Array.from(root.querySelectorAll('mark[data-comment-id]'))
  for (const mark of marks) {
    const parent = mark.parentNode
    if (!parent) continue
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
    parent.removeChild(mark)
    parent.normalize()
  }
}

function wrapRange(root: HTMLElement, range: HighlightRange): void {
  const { segments } = extractText(root)
  for (const segment of segments) {
    const overlapStart = Math.max(range.startOffset, segment.start)
    const overlapEnd = Math.min(range.endOffset, segment.end)
    if (overlapStart >= overlapEnd) continue

    let node = segment.node
    const localStart = overlapStart - segment.start
    const localEnd = overlapEnd - segment.start

    if (localStart > 0) node = node.splitText(localStart)
    if (localEnd - localStart < node.data.length) node.splitText(localEnd - localStart)

    const mark = document.createElement('mark')
    mark.setAttribute('data-comment-id', range.id)
    mark.className = `mdr-highlight${range.status === 'stale' ? ' mdr-stale' : ''}`
    node.parentNode!.insertBefore(mark, node)
    mark.appendChild(node)
  }
}

export function applyHighlights(root: HTMLElement, ranges: HighlightRange[]): void {
  clearHighlights(root)
  for (const range of [...ranges].sort((a, b) => a.startOffset - b.startOffset)) {
    wrapRange(root, range)
  }
}
