import { forwardRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { resolveResourceUrl } from './resolveUrl'

interface PreviewProps {
  source: string
  basePath?: string | null
  onMouseUp: () => void
}

export const Preview = forwardRef<HTMLDivElement, PreviewProps>(function Preview(
  { source, basePath, onMouseUp },
  ref
) {
  return (
    <div className="mdr-preview" ref={ref} onMouseUp={onMouseUp}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        urlTransform={(url) => resolveResourceUrl(url, basePath)}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
})
