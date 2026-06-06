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
