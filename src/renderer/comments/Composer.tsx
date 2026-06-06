import { useState } from 'react'

interface ComposerProps {
  quote: string
  onSave: (text: string) => void
  onCancel: () => void
}

export function Composer({ quote, onSave, onCancel }: ComposerProps) {
  const [text, setText] = useState('')

  return (
    <div className="mdr-card mdr-card-active">
      <div className="mdr-quote">"{quote}"</div>
      <textarea
        className="mdr-composer"
        autoFocus
        placeholder="Add a comment…"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) onSave(text)
          if (event.key === 'Escape') onCancel()
        }}
      />
      <div className="mdr-card-actions">
        <button className="mdr-btn" type="button" onClick={onCancel} title="Cancel">
          ✕
        </button>
        <button
          className="mdr-btn mdr-btn-ok"
          type="button"
          onClick={() => onSave(text)}
          disabled={!text.trim()}
          title="Save"
        >
          ✓
        </button>
      </div>
    </div>
  )
}
