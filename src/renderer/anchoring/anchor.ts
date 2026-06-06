import DiffMatchPatch from 'diff-match-patch'
import type { CommentStatus } from '../types'

export const CONTEXT_LEN = 32

export function buildAnchorFields(
  text: string,
  startOffset: number,
  endOffset: number,
  contextLen = CONTEXT_LEN
): { quote: string; prefix: string; suffix: string } {
  return {
    quote: text.slice(startOffset, endOffset),
    prefix: text.slice(Math.max(0, startOffset - contextLen), startOffset),
    suffix: text.slice(endOffset, endOffset + contextLen)
  }
}

interface ResolveInput {
  quote: string
  prefix: string
  suffix: string
  startOffset: number
  endOffset: number
}

function commonPrefixLen(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

function commonSuffixLen(a: string, b: string): number {
  let i = 0
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++
  return i
}

function findExact(text: string, anchor: ResolveInput): { startOffset: number; endOffset: number } | null {
  const { quote, prefix, suffix, startOffset } = anchor
  if (!quote) return null

  const candidates: number[] = []
  let index = text.indexOf(quote)
  while (index !== -1) {
    candidates.push(index)
    index = text.indexOf(quote, index + 1)
  }

  if (candidates.length === 0) return null

  let best = candidates[0]
  let bestScore = Number.NEGATIVE_INFINITY

  for (const candidate of candidates) {
    const before = text.slice(Math.max(0, candidate - prefix.length), candidate)
    const after = text.slice(candidate + quote.length, candidate + quote.length + suffix.length)
    const score =
      commonSuffixLen(before, prefix) +
      commonPrefixLen(after, suffix) -
      Math.abs(candidate - startOffset) / 100000

    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }

  return { startOffset: best, endOffset: best + quote.length }
}

export function resolveOffsets(
  text: string,
  anchor: ResolveInput
): { startOffset: number; endOffset: number; status: CommentStatus } {
  const { quote, startOffset, endOffset } = anchor

  if (quote.length > 0 && text.slice(startOffset, endOffset) === quote) {
    return { startOffset, endOffset, status: 'anchored' }
  }

  const exact = findExact(text, anchor)
  if (exact) return { ...exact, status: 'anchored' }

  if (quote.length > 0) {
    const dmp = new DiffMatchPatch()
    dmp.Match_Threshold = 0.3
    dmp.Match_Distance = 1000
    const seed = Math.min(startOffset, Math.max(0, text.length - 1))
    const loc = dmp.match_main(text, quote, seed)
    if (loc !== -1) {
      return { startOffset: loc, endOffset: loc + quote.length, status: 'anchored' }
    }
  }

  return { startOffset, endOffset, status: 'stale' }
}
