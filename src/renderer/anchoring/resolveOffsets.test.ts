import { describe, expect, it } from 'vitest'
import { resolveOffsets } from './anchor'

const base = { commentText: '', id: '', createdAt: '' }

describe('resolveOffsets', () => {
  it('anchors exactly when text is unchanged', () => {
    const text = 'The quick brown fox'
    const r = resolveOffsets(text, {
      ...base,
      quote: 'brown',
      prefix: 'quick ',
      suffix: ' fox',
      startOffset: 10,
      endOffset: 15,
      status: 'anchored'
    })
    expect(r).toEqual({ startOffset: 10, endOffset: 15, status: 'anchored' })
  })

  it('re-anchors when text shifted (content inserted before)', () => {
    const text = 'INTRO. The quick brown fox'
    const r = resolveOffsets(text, {
      ...base,
      quote: 'brown',
      prefix: 'quick ',
      suffix: ' fox',
      startOffset: 10,
      endOffset: 15,
      status: 'anchored'
    })
    expect(text.slice(r.startOffset, r.endOffset)).toBe('brown')
    expect(r.status).toBe('anchored')
  })

  it('uses context to disambiguate duplicate quotes', () => {
    const text = 'set x to value. later set y to value.'
    const second = text.lastIndexOf('value')
    const r = resolveOffsets(text, {
      ...base,
      quote: 'value',
      prefix: 'y to ',
      suffix: '.',
      startOffset: second,
      endOffset: second + 5,
      status: 'anchored'
    })
    expect(r.startOffset).toBe(second)
    expect(r.status).toBe('anchored')
  })

  it('re-anchors a long quote (>32 chars) without throwing "Pattern too long"', () => {
    // A quote longer than diff-match-patch's Match_MaxBits (32) used to throw in
    // the fuzzy fallback. Edit the tail (dog -> cat) so the exact paths miss and
    // the fuzzy path runs, which is where it threw.
    const quote = 'The quick brown fox jumps over the lazy dog'
    expect(quote.length).toBeGreaterThan(32)
    const text = 'Intro. The quick brown fox jumps over the lazy cat.'
    const expectedStart = text.indexOf('The quick')
    let r: ReturnType<typeof resolveOffsets> | undefined
    expect(() => {
      r = resolveOffsets(text, {
        ...base,
        quote,
        prefix: 'Intro. ',
        suffix: '.',
        startOffset: 7,
        endOffset: 7 + quote.length,
        status: 'anchored'
      })
    }).not.toThrow()
    expect(r!.status).toBe('anchored')
    expect(r!.startOffset).toBe(expectedStart)
  })

  it('marks stale when the quote is gone', () => {
    const text = 'completely different content now'
    const r = resolveOffsets(text, {
      ...base,
      quote: 'brown fox',
      prefix: 'quick ',
      suffix: ' jumps',
      startOffset: 10,
      endOffset: 19,
      status: 'anchored'
    })
    expect(r.status).toBe('stale')
  })
})
