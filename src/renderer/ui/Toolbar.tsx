interface ToolbarProps {
  title: string
  dirty: boolean
  editing: boolean
  commentCount: number
  onToggleEdit: () => void
  onCopy: () => void
  onClear: () => void
}

export function Toolbar({
  title,
  dirty,
  editing,
  commentCount,
  onToggleEdit,
  onCopy,
  onClear
}: ToolbarProps) {
  return (
    <div className="mdr-toolbar">
      <div className="mdr-title">
        {title}
        {dirty ? ' •' : ''}
      </div>
      <div className="mdr-toolbar-actions">
        <button className={`mdr-toggle${editing ? ' on' : ''}`} type="button" onClick={onToggleEdit}>
          ✎ Edit
        </button>
        <button
          className="mdr-clear"
          type="button"
          onClick={onClear}
          disabled={commentCount === 0}
          title="Remove all comments"
        >
          Clear Comments
        </button>
        <button className="mdr-copy" type="button" onClick={onCopy}>
          Copy Comments
        </button>
      </div>
    </div>
  )
}
