export interface TextSegment {
  node: Text
  start: number
  end: number
}

export interface ExtractedText {
  text: string
  segments: TextSegment[]
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])

export function extractText(root: Node): ExtractedText {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement
      if (parent && SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    }
  })

  const segments: TextSegment[] = []
  let text = ''
  let current = walker.nextNode() as Text | null

  while (current) {
    const value = current.data
    const start = text.length
    segments.push({ node: current, start, end: start + value.length })
    text += value
    current = walker.nextNode() as Text | null
  }

  return { text, segments }
}
