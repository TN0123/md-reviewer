import { describe, expect, it } from 'vitest'
import { extractText } from './extractText'

function root(html: string): HTMLElement {
  const el = document.createElement('div')
  el.innerHTML = html
  return el
}

describe('extractText', () => {
  it('concatenates text nodes in document order', () => {
    const { text } = extractText(root('<p>Hello </p><p>world</p>'))
    expect(text).toBe('Hello world')
  })

  it('maps each segment to its text node and global offsets', () => {
    const r = root('<p>ab</p><p>cd</p>')
    const { text, segments } = extractText(r)
    expect(text).toBe('abcd')
    expect(segments).toHaveLength(2)
    expect(segments[0].start).toBe(0)
    expect(segments[0].end).toBe(2)
    expect(segments[0].node.data).toBe('ab')
    expect(segments[1].start).toBe(2)
    expect(segments[1].end).toBe(4)
    expect(segments[1].node.data).toBe('cd')
  })

  it('skips script/style content', () => {
    const { text } = extractText(root('<p>keep</p><style>.x{}</style><script>1</script>'))
    expect(text).toBe('keep')
  })
})
