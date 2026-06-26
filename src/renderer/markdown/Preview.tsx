import { forwardRef } from 'react'
import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { resolveResourceUrl } from './resolveUrl'

interface PreviewProps {
  source: string
  basePath?: string | null
  onMouseUp: () => void
}

// Wrap tables so wide ones scroll horizontally inside a rounded, bordered frame
// instead of overflowing the whole preview pane.
const components: Components = {
  table({ node: _node, children, ...props }) {
    return (
      <div className="mdr-table-wrap">
        <table {...props}>{children}</table>
      </div>
    )
  }
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
        components={components}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
})
