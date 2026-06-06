import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import type { CommentsDoc } from '../renderer/types'

export function sidecarPath(filePath: string): string {
  return join(dirname(filePath), '.md-reviewer', `${basename(filePath)}.comments.json`)
}

export function hashContent(content: string): string {
  return createHash('sha1').update(content).digest('hex')
}

function freshDoc(filePath: string): CommentsDoc {
  return {
    version: 1,
    sourceFile: basename(filePath),
    sourceHash: '',
    comments: []
  }
}

export function readComments(filePath: string): CommentsDoc {
  const p = sidecarPath(filePath)
  if (!existsSync(p)) return freshDoc(filePath)

  const raw = readFileSync(p, 'utf-8')
  try {
    const parsed = JSON.parse(raw) as CommentsDoc
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.comments)) {
      throw new Error('invalid comments doc')
    }
    return parsed
  } catch {
    const backup = `${p}.corrupt-${Date.now()}`
    renameSync(p, backup)
    return freshDoc(filePath)
  }
}

export function writeComments(filePath: string, doc: CommentsDoc): void {
  const p = sidecarPath(filePath)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(doc, null, 2), 'utf-8')
}
