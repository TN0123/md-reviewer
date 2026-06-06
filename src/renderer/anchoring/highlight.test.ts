import { describe, expect, it } from 'vitest'
import { applyHighlights, clearHighlights } from './highlight'

function root(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe('applyHighlights', () => {
  it('wraps a single-paragraph range in one mark', () => {
    const r = root('<p>Hello world</p>')
    applyHighlights(r, [{ id: 'c1', startOffset: 6, endOffset: 11, status: 'anchored' }])
    const marks = r.querySelectorAll('mark[data-comment-id="c1"]')
    expect(marks).toHaveLength(1)
    expect(marks[0].textContent).toBe('world')
  })

  it('wraps a cross-paragraph range in one mark per text node', () => {
    const r = root('<p>abc</p><p>def</p>')
    applyHighlights(r, [{ id: 'c2', startOffset: 2, endOffset: 5, status: 'anchored' }])
    const marks = Array.from(r.querySelectorAll('mark[data-comment-id="c2"]'))
    expect(marks.map((mark) => mark.textContent)).toEqual(['c', 'de'])
  })

  it('adds a stale class for stale comments', () => {
    const r = root('<p>Hello world</p>')
    applyHighlights(r, [{ id: 'c3', startOffset: 0, endOffset: 5, status: 'stale' }])
    expect(r.querySelector('mark[data-comment-id="c3"]')!.classList.contains('mdr-stale')).toBe(true)
  })

  it('clearHighlights unwraps marks and restores text', () => {
    const r = root('<p>Hello world</p>')
    applyHighlights(r, [{ id: 'c4', startOffset: 6, endOffset: 11, status: 'anchored' }])
    clearHighlights(r)
    expect(r.querySelectorAll('mark').length).toBe(0)
    expect(r.textContent).toBe('Hello world')
  })
})
