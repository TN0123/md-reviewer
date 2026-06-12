import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Preview } from './markdown/Preview'
import { EditorPane } from './editor/EditorPane'
import { CommentsRail } from './comments/CommentsRail'
import { Composer } from './comments/Composer'
import { Toolbar } from './ui/Toolbar'
import { Toast } from './ui/Toast'
import { useComments } from './comments/useComments'
import { makeComment } from './comments/commentsState'
import { extractText } from './anchoring/extractText'
import { rangeToOffsets } from './anchoring/offsets'
import { buildAnchorFields, resolveOffsets } from './anchoring/anchor'
import { applyHighlights } from './anchoring/highlight'
import { formatComments } from './clipboard/formatComments'

interface PendingSelection {
  startOffset: number
  endOffset: number
  quote: string
  prefix: string
  suffix: string
  top: number
}

export default function App() {
  const [filePath, setFilePath] = useState<string | null>(null)
  const [source, setSource] = useState(
    '# Open a markdown file\n\nUse md-reviewer as the default app for `.md` files.'
  )
  const [editing, setEditing] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingSelection | null>(null)
  const [composing, setComposing] = useState(false)

  const { comments, dispatch } = useComments()
  const previewRef = useRef<HTMLDivElement>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const unsubscribe = window.api.onFileOpened(({ path, content, comments: loadedComments }) => {
      setFilePath(path)
      setSource(content)
      setEditing(false)
      setDirty(false)
      setToast(null)
      setActiveId(null)
      setPending(null)
      setComposing(false)
      dispatch({ type: 'load', comments: loadedComments })
    })

    return unsubscribe
  }, [dispatch])

  useEffect(() => {
    window.api.setDirty(dirty)
  }, [dirty])

  useLayoutEffect(() => {
    const root = previewRef.current
    if (!root) return

    const { text } = extractText(root)
    const resolved = comments.map((comment) => ({
      id: comment.id,
      ...resolveOffsets(text, comment)
    }))

    const changed = resolved.some((resolvedComment) => {
      const existing = comments.find((comment) => comment.id === resolvedComment.id)
      return (
        !existing ||
        existing.startOffset !== resolvedComment.startOffset ||
        existing.endOffset !== resolvedComment.endOffset ||
        existing.status !== resolvedComment.status
      )
    })

    applyHighlights(
      root,
      resolved.map((comment) => ({
        id: comment.id,
        startOffset: comment.startOffset,
        endOffset: comment.endOffset,
        status: comment.status
      }))
    )

    if (changed) {
      dispatch({ type: 'resolve', resolved })
    }
  }, [source, comments, dispatch])

  useEffect(() => {
    if (!filePath) return
    if (saveTimer.current) clearTimeout(saveTimer.current)

    saveTimer.current = setTimeout(() => {
      window.api.saveComments(comments, source).catch(() => {
        setToast('Failed to save comments')
      })
    }, 400)

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [comments, source, filePath])

  const handleSelection = useCallback(() => {
    const root = previewRef.current
    if (!root) return

    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0) return

    const range = sel.getRangeAt(0)
    if (!root.contains(range.commonAncestorContainer)) return

    if (sel.isCollapsed) {
      // A plain click (no selection) dismisses any pending comment affordance
      // and, if it landed on an existing highlight, focuses that comment.
      setPending(null)
      setComposing(false)
      const node = sel.anchorNode?.parentElement?.closest('mark[data-comment-id]')
      if (node) setActiveId(node.getAttribute('data-comment-id'))
      return
    }

    const ext = extractText(root)
    const offsets = rangeToOffsets(ext, range)
    if (!offsets || offsets.startOffset === offsets.endOffset) return

    const fields = buildAnchorFields(ext.text, offsets.startOffset, offsets.endOffset)
    const rect = range.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    // Don't open the composer yet (it would steal focus and collapse the
    // selection, breaking copy). Just mark a pending selection; the user
    // clicks the "Comment" affordance to actually start commenting.
    setComposing(false)
    setPending({
      ...offsets,
      ...fields,
      top: rect.top - rootRect.top + root.scrollTop
    })
  }, [])

  const saveComment = useCallback(
    (text: string) => {
      if (!pending || !text.trim()) return

      const comment = makeComment({
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        fields: { quote: pending.quote, prefix: pending.prefix, suffix: pending.suffix },
        startOffset: pending.startOffset,
        endOffset: pending.endOffset,
        commentText: text
      })

      dispatch({ type: 'add', comment })
      setActiveId(comment.id)
      setPending(null)
      setComposing(false)
      window.getSelection()?.removeAllRanges()
    },
    [pending, dispatch]
  )

  const handleEdit = useCallback((value: string) => {
    setSource(value)
    setDirty(true)
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        if (!filePath) {
          setToast('Open a file first')
          return
        }

        window.api
          .saveFile(source)
          .then(() => {
            setDirty(false)
            setToast('Saved ✓')
          })
          .catch(() => {
            setToast('Save failed')
          })
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [source, filePath])

  const focusComment = useCallback((id: string) => {
    setActiveId(id)
    const mark = previewRef.current?.querySelector(`mark[data-comment-id="${id}"]`)
    if (mark) {
      mark.scrollIntoView({ block: 'center', behavior: 'smooth' })
      mark.classList.add('mdr-flash')
      window.setTimeout(() => mark.classList.remove('mdr-flash'), 700)
    }
  }, [])

  const copyComments = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(formatComments(comments))
      setToast('Copied ✓')
    } catch {
      setToast('Copy failed')
    }
  }, [comments])

  const clearComments = useCallback(() => {
    if (comments.length === 0) return
    const plural = comments.length === 1 ? 'comment' : 'comments'
    if (!window.confirm(`Clear all ${comments.length} ${plural}? This cannot be undone.`)) return

    dispatch({ type: 'clearAll' })
    setActiveId(null)
    setPending(null)
    setComposing(false)
    setToast('Comments cleared')
  }, [comments.length, dispatch])

  const title = filePath ? filePath.split('/').pop() ?? filePath : 'md-reviewer'
  const baseDir = filePath ? filePath.slice(0, filePath.lastIndexOf('/')) : null

  return (
    <div className="mdr-app">
      <Toolbar
        title={title}
        dirty={dirty}
        editing={editing}
        commentCount={comments.length}
        onToggleEdit={() => setEditing((current) => !current)}
        onCopy={copyComments}
        onClear={clearComments}
      />

      <div className="mdr-body">
        {editing && (
          <div className="mdr-editor-pane">
            <EditorPane value={source} onChange={handleEdit} />
          </div>
        )}

        <Preview ref={previewRef} source={source} basePath={baseDir} onMouseUp={handleSelection} />

        <div className="mdr-rail-pane">
          {pending && !composing && (
            <div style={{ position: 'absolute', top: pending.top, right: 12, left: 12 }}>
              <button
                className="mdr-btn mdr-comment-cta"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setComposing(true)}
                title="Comment on selection"
              >
                💬 Comment
              </button>
            </div>
          )}
          {pending && composing && (
            <div style={{ position: 'absolute', top: pending.top, right: 12, left: 12 }}>
              <Composer
                quote={pending.quote}
                onSave={saveComment}
                onCancel={() => {
                  setPending(null)
                  setComposing(false)
                }}
              />
            </div>
          )}
          <CommentsRail
            comments={comments}
            activeId={activeId}
            onFocus={focusComment}
            onUpdate={(id, text) => dispatch({ type: 'updateText', id, commentText: text })}
            onDelete={(id) => dispatch({ type: 'delete', id })}
          />
        </div>
      </div>

      <Toast message={toast} onClear={() => setToast(null)} />
    </div>
  )
}
