interface ToolbarProps {
  title: string
  dirty: boolean
  editing: boolean
  onToggleEdit: () => void
  onCopy: () => void
}

export function Toolbar({ title, dirty, editing, onToggleEdit, onCopy }: ToolbarProps) {
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
        <button className="mdr-copy" type="button" onClick={onCopy}>
          Copy Comments
        </button>
      </div>
    </div>
  )
}
