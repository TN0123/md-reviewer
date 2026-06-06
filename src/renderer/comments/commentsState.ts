import type { CommentStatus, ReviewComment } from '../types'

export type CommentsAction =
  | { type: 'load'; comments: ReviewComment[] }
  | { type: 'add'; comment: ReviewComment }
  | { type: 'updateText'; id: string; commentText: string }
  | { type: 'delete'; id: string }
  | {
      type: 'resolve'
      resolved: { id: string; startOffset: number; endOffset: number; status: CommentStatus }[]
    }

export function commentsReducer(state: ReviewComment[], action: CommentsAction): ReviewComment[] {
  switch (action.type) {
    case 'load':
      return action.comments
    case 'add':
      return [...state, action.comment]
    case 'updateText':
      return state.map((comment) =>
        comment.id === action.id ? { ...comment, commentText: action.commentText } : comment
      )
    case 'delete':
      return state.filter((comment) => comment.id !== action.id)
    case 'resolve': {
      const byId = new Map(action.resolved.map((resolved) => [resolved.id, resolved]))
      return state.map((comment) => {
        const resolved = byId.get(comment.id)
        return resolved
          ? {
              ...comment,
              startOffset: resolved.startOffset,
              endOffset: resolved.endOffset,
              status: resolved.status
            }
          : comment
      })
    }
    default:
      return state
  }
}

export function makeComment(params: {
  id: string
  createdAt: string
  fields: { quote: string; prefix: string; suffix: string }
  startOffset: number
  endOffset: number
  commentText: string
}): ReviewComment {
  return {
    id: params.id,
    quote: params.fields.quote,
    prefix: params.fields.prefix,
    suffix: params.fields.suffix,
    startOffset: params.startOffset,
    endOffset: params.endOffset,
    commentText: params.commentText,
    createdAt: params.createdAt,
    status: 'anchored'
  }
}
