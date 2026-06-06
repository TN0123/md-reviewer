export type CommentStatus = 'anchored' | 'stale'

export interface ReviewComment {
  id: string
  quote: string
  prefix: string
  suffix: string
  startOffset: number
  endOffset: number
  commentText: string
  createdAt: string
  status: CommentStatus
}

export interface CommentsDoc {
  version: 1
  sourceFile: string
  sourceHash: string
  comments: ReviewComment[]
}
