import { useEffect } from 'react'

interface ToastProps {
  message: string | null
  onClear: () => void
}

export function Toast({ message, onClear }: ToastProps) {
  useEffect(() => {
    if (!message) return
    const timer = window.setTimeout(onClear, 1800)
    return () => window.clearTimeout(timer)
  }, [message, onClear])

  if (!message) return null
  return <div className="mdr-toast">{message}</div>
}
