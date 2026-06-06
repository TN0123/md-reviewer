import { describe, expect, it } from 'vitest'
import { formatComments } from './formatComments'
import type { ReviewComment } from '../types'

function c(partial: Partial<ReviewComment>): ReviewComment {
  return {
    id: 'x',
    quote: '',
    prefix: '',
    suffix: '',
    startOffset: 0,
    endOffset: 0,
    commentText: '',
    createdAt: '',
    status: 'anchored',
    ...partial
  }
}

describe('formatComments', () => {
  it('formats comments in document order', () => {
    const out = formatComments([
      c({ quote: '15 minutes of inactivity', commentText: 'Make this configurable?', startOffset: 50 }),
      c({ quote: 'expire', commentText: 'Why expire at all?', startOffset: 10 })
    ])
    expect(out).toBe(
      'Comments:\n' +
        '- "expire" <-- Why expire at all?\n' +
        '- "15 minutes of inactivity" <-- Make this configurable?'
    )
  })

  it('collapses internal newlines in quote and comment to single spaces', () => {
    const out = formatComments([c({ quote: 'line one\nline two', commentText: 'has\nnewline', startOffset: 0 })])
    expect(out).toBe('Comments:\n- "line one line two" <-- has newline')
  })

  it('returns a header-only string when there are no comments', () => {
    expect(formatComments([])).toBe('Comments:')
  })
})
