import { describe, expect, it } from 'vitest'
import { commentsReducer, makeComment } from './commentsState'
import type { ReviewComment } from '../types'

const sample = (over: Partial<ReviewComment> = {}): ReviewComment => ({
  id: 'a',
  quote: 'q',
  prefix: '',
  suffix: '',
  startOffset: 0,
  endOffset: 1,
  commentText: 'hi',
  createdAt: 't',
  status: 'anchored',
  ...over
})

describe('makeComment', () => {
  it('assembles a comment from fields + injected id/time', () => {
    const c = makeComment({
      id: 'id1',
      createdAt: '2026-01-01',
      fields: { quote: 'fox', prefix: 'the ', suffix: ' runs' },
      startOffset: 4,
      endOffset: 7,
      commentText: 'why?'
    })
    expect(c).toEqual({
      id: 'id1',
      quote: 'fox',
      prefix: 'the ',
      suffix: ' runs',
      startOffset: 4,
      endOffset: 7,
      commentText: 'why?',
      createdAt: '2026-01-01',
      status: 'anchored'
    })
  })
})

describe('commentsReducer', () => {
  it('load replaces all comments', () => {
    const next = commentsReducer([sample()], { type: 'load', comments: [sample({ id: 'b' })] })
    expect(next.map((comment) => comment.id)).toEqual(['b'])
  })

  it('add appends', () => {
    const next = commentsReducer([sample()], { type: 'add', comment: sample({ id: 'b' }) })
    expect(next.map((comment) => comment.id)).toEqual(['a', 'b'])
  })

  it('updateText changes only the matching comment', () => {
    const next = commentsReducer([sample()], { type: 'updateText', id: 'a', commentText: 'new' })
    expect(next[0].commentText).toBe('new')
  })

  it('delete removes the matching comment', () => {
    const next = commentsReducer([sample(), sample({ id: 'b' })], { type: 'delete', id: 'a' })
    expect(next.map((comment) => comment.id)).toEqual(['b'])
  })

  it('resolve updates offsets and status by id', () => {
    const next = commentsReducer([sample()], {
      type: 'resolve',
      resolved: [{ id: 'a', startOffset: 9, endOffset: 12, status: 'stale' }]
    })
    expect(next[0]).toMatchObject({ startOffset: 9, endOffset: 12, status: 'stale' })
  })
})
