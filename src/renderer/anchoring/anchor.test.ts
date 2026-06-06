import { describe, expect, it } from 'vitest'
import { buildAnchorFields } from './anchor'

describe('buildAnchorFields', () => {
  it('captures quote, prefix, and suffix', () => {
    const text = 'The quick brown fox jumps over the lazy dog'
    const start = text.indexOf('brown fox')
    const end = start + 'brown fox'.length
    const fields = buildAnchorFields(text, start, end, 5)
    expect(fields.quote).toBe('brown fox')
    expect(fields.prefix).toBe('uick ')
    expect(fields.suffix).toBe(' jump')
  })

  it('clamps context at the start and end of the document', () => {
    const text = 'abcde'
    const fields = buildAnchorFields(text, 0, 2, 10)
    expect(fields.quote).toBe('ab')
    expect(fields.prefix).toBe('')
    expect(fields.suffix).toBe('cde')
  })
})
