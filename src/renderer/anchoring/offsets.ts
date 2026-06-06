import type { ExtractedText, TextSegment } from './extractText'

function segmentForGlobal(segments: TextSegment[], offset: number): { node: Text; local: number } | null {
  for (const segment of segments) {
    if (offset >= segment.start && offset <= segment.end) {
      return { node: segment.node, local: offset - segment.start }
    }
  }

  return null
}

function globalForNode(segments: TextSegment[], node: Node, local: number): number | null {
  for (const segment of segments) {
    if (segment.node === node) return segment.start + local
  }

  return null
}

export function rangeToOffsets(
  ext: ExtractedText,
  range: Range
): { startOffset: number; endOffset: number } | null {
  const start = globalForNode(ext.segments, range.startContainer, range.startOffset)
  const end = globalForNode(ext.segments, range.endContainer, range.endOffset)
  if (start === null || end === null) return null

  return start <= end
    ? { startOffset: start, endOffset: end }
    : { startOffset: end, endOffset: start }
}

export function offsetsToRange(
  ext: ExtractedText,
  startOffset: number,
  endOffset: number
): Range | null {
  const startPos = segmentForGlobal(ext.segments, startOffset)
  const endPos = segmentForGlobal(ext.segments, endOffset)
  if (!startPos || !endPos) return null

  const range = document.createRange()
  range.setStart(startPos.node, startPos.local)
  range.setEnd(endPos.node, endPos.local)
  return range
}
