import type { ReviewComment } from '../types'

function clean(value: string): string {
  return value.replace(/\s*\n\s*/g, ' ').trim()
}

export function formatComments(comments: ReviewComment[]): string {
  const sorted = [...comments].sort((a, b) => a.startOffset - b.startOffset)
  const lines = sorted.map((comment) => `- "${clean(comment.quote)}" <-- ${clean(comment.commentText)}`)
  return ['Comments:', ...lines].join('\n')
}
