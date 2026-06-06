import { useEffect, useState } from 'react'
import type { ReviewComment } from '../types'

interface CommentCardProps {
  comment: ReviewComment
  active: boolean
  onFocus: (id: string) => void
  onUpdate: (id: string, text: string) => void
  onDelete: (id: string) => void
}

export function CommentCard({ comment, active, onFocus, onUpdate, onDelete }: CommentCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.commentText)

  useEffect(() => {
    setDraft(comment.commentText)
  }, [comment.commentText])

  return (
    <div
      className={`mdr-card${active ? ' mdr-card-active' : ''}${comment.status === 'stale' ? ' mdr-card-stale' : ''}`}
      onClick={() => onFocus(comment.id)}
    >
      <div className="mdr-quote">
        {comment.status === 'stale' && <span className="mdr-stale-badge">⚠ couldn't locate</span>}
        "{comment.quote}"
      </div>

      {editing ? (
        <>
          <textarea className="mdr-composer" autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="mdr-card-actions">
            <button
              className="mdr-btn"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setDraft(comment.commentText)
                setEditing(false)
              }}
            >
              ✕
            </button>
            <button
              className="mdr-btn mdr-btn-ok"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onUpdate(comment.id, draft)
                setEditing(false)
              }}
            >
              ✓
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mdr-card-text">{comment.commentText}</div>
          <div className="mdr-card-meta">
            <button
              className="mdr-link"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                setEditing(true)
              }}
            >
              ✎ edit
            </button>
            <button
              className="mdr-link"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onDelete(comment.id)
              }}
            >
              🗑 delete
            </button>
          </div>
        </>
      )}
    </div>
  )
}
