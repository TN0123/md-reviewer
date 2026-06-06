import { describe, expect, it } from 'vitest'
import { extractText } from './extractText'
import { offsetsToRange, rangeToOffsets } from './offsets'

function root(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe('rangeToOffsets', () => {
  it('converts a single-node range to global offsets', () => {
    const r = root('<p>Hello world</p>')
    const textNode = r.querySelector('p')!.firstChild as Text
    const range = document.createRange()
    range.setStart(textNode, 6)
    range.setEnd(textNode, 11)
    const ext = extractText(r)
    expect(rangeToOffsets(ext, range)).toEqual({ startOffset: 6, endOffset: 11 })
  })

  it('converts a range spanning two nodes', () => {
    const r = root('<p>abc</p><p>def</p>')
    const ext = extractText(r)
    const range = document.createRange()
    range.setStart(ext.segments[0].node, 2)
    range.setEnd(ext.segments[1].node, 2)
    expect(rangeToOffsets(ext, range)).toEqual({ startOffset: 2, endOffset: 5 })
  })
})

describe('offsetsToRange', () => {
  it('round-trips offsets back to a range whose text matches', () => {
    const r = root('<p>Hello world</p>')
    const ext = extractText(r)
    const range = offsetsToRange(ext, 6, 11)!
    expect(range.toString()).toBe('world')
  })

  it('round-trips a multi-node range', () => {
    const r = root('<p>abc</p><p>def</p>')
    const ext = extractText(r)
    const range = offsetsToRange(ext, 2, 5)!
    expect(range.toString()).toBe('cde')
  })
})
