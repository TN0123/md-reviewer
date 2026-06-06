import type { ReviewComment } from '../types'
import { CommentCard } from './CommentCard'

interface CommentsRailProps {
  comments: ReviewComment[]
  activeId: string | null
  onFocus: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onDelete: (id: string) => void
}

export function CommentsRail({ comments, activeId, onFocus, onUpdate, onDelete }: CommentsRailProps) {
  const sorted = [...comments].sort((a, b) => a.startOffset - b.startOffset)

  return (
    <div className="mdr-rail">
      <div className="mdr-rail-header">Comments</div>
      {sorted.length === 0 && (
        <div className="mdr-rail-empty">Highlight text in the preview to add a comment.</div>
      )}
      {sorted.map((comment) => (
        <CommentCard
          key={comment.id}
          comment={comment}
          active={comment.id === activeId}
          onFocus={onFocus}
          onUpdate={onUpdate}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
