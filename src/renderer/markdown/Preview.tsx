import { forwardRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'

interface PreviewProps {
  source: string
  onMouseUp: () => void
}

export const Preview = forwardRef<HTMLDivElement, PreviewProps>(function Preview(
  { source, onMouseUp },
  ref
) {
  return (
    <div className="mdr-preview" ref={ref} onMouseUp={onMouseUp}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {source}
      </ReactMarkdown>
    </div>
  )
})
