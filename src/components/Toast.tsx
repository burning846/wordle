import './Toast.css'

interface ToastProps {
  message: string | null
}

export function Toast({ message }: ToastProps) {
  return (
    <div className="toast-layer" aria-live="polite" aria-atomic="true">
      {message && (
        // Keyed by content so a new message replays the entrance animation.
        <div className="toast" key={message}>
          {message}
        </div>
      )}
    </div>
  )
}
