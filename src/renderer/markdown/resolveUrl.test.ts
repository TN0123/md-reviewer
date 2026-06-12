import { describe, expect, it } from 'vitest'
import { resolveResourceUrl } from './resolveUrl'

const base = '/Users/me/notes'

describe('resolveResourceUrl', () => {
  it('resolves a relative image path against the doc directory', () => {
    expect(resolveResourceUrl('pic.png', base)).toBe('file:///Users/me/notes/pic.png')
  })

  it('resolves a relative subdirectory path', () => {
    expect(resolveResourceUrl('images/pic.png', base)).toBe('file:///Users/me/notes/images/pic.png')
  })

  it('resolves ../ relative paths', () => {
    expect(resolveResourceUrl('../assets/pic.png', base)).toBe('file:///Users/me/assets/pic.png')
  })

  it('turns an absolute filesystem path into a file:// url', () => {
    expect(resolveResourceUrl('/tmp/pic.png', base)).toBe('file:///tmp/pic.png')
  })

  it('percent-encodes spaces in paths', () => {
    expect(resolveResourceUrl('my pic.png', '/a b')).toBe('file:///a%20b/my%20pic.png')
  })

  it('passes through http(s), data, and fragment urls', () => {
    expect(resolveResourceUrl('https://x.com/a.png', base)).toBe('https://x.com/a.png')
    expect(resolveResourceUrl('data:image/png;base64,AAAA', base)).toBe('data:image/png;base64,AAAA')
    expect(resolveResourceUrl('#section', base)).toBe('#section')
  })

  it('passes through an existing file: url', () => {
    expect(resolveResourceUrl('file:///tmp/x.png', base)).toBe('file:///tmp/x.png')
  })

  it('drops unsafe protocols', () => {
    expect(resolveResourceUrl('javascript:alert(1)', base)).toBe('')
  })

  it('leaves relative paths alone when no base path is known', () => {
    expect(resolveResourceUrl('pic.png', null)).toBe('pic.png')
  })
})
