import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/**
 * Modal genérico: overlay, card centrada y cierre con X, Escape o click afuera.
 * `pie` recibe los botones de acción.
 */
export default function Modal({
  abierto,
  onCerrar,
  titulo,
  descripcion,
  children,
  pie,
  className = '',
}) {
  useEffect(() => {
    if (!abierto) return undefined

    function alPresionarTecla(e) {
      if (e.key === 'Escape') onCerrar?.()
    }

    const overflowPrevio = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', alPresionarTecla)

    return () => {
      document.body.style.overflow = overflowPrevio
      document.removeEventListener('keydown', alPresionarTecla)
    }
  }, [abierto, onCerrar])

  if (!abierto) return null

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar?.()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`w-full max-w-md rounded-card border border-line bg-surface p-5 shadow-xl ${className}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-ink">{titulo}</h2>
            {descripcion && <p className="mt-1 text-sm text-muted">{descripcion}</p>}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
          >
            ✕
          </button>
        </div>

        {children && <div className="mt-4 space-y-3">{children}</div>}

        {pie && (
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            {pie}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
