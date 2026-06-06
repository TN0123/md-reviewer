import { useReducer, type Dispatch } from 'react'
import { commentsReducer, type CommentsAction } from './commentsState'
import type { ReviewComment } from '../types'

export function useComments(initial: ReviewComment[] = []) {
  const [comments, dispatch] = useReducer(commentsReducer, initial)
  return { comments, dispatch: dispatch as Dispatch<CommentsAction> }
}
