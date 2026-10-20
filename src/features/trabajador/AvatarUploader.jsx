import { useRef, useState } from 'react'

/**
 * Selector de avatar. Muestra la foto actual o una previsualización local,
 * y entrega el `File` elegido al padre (que lo sube al guardar).
 */
export default function AvatarUploader({ usuario, onChange, className = '' }) {
  const [preview, setPreview] = useState(null)
  const inputRef = useRef(null)

  const iniciales = `${usuario?.nombre?.[0] ?? ''}${usuario?.apellido?.[0] ?? ''}`.toUpperCase()
  const mostrar = preview ?? usuario?.avatarUrl ?? null

  function elegir(files) {
    const file = files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setPreview(URL.createObjectURL(file))
    onChange(file)
  }

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="relative h-20 w-20 overflow-hidden rounded-full border border-line bg-primary-soft">
        {mostrar ? (
          <img src={mostrar} alt="Avatar" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-2xl font-extrabold text-primary">
            {iniciales || '?'}
          </span>
        )}
      </div>

      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-xl border border-line bg-surface px-4 py-2 text-sm font-bold text-ink transition hover:bg-canvas"
        >
          Cambiar foto
        </button>
        <p className="mt-1 text-xs text-muted">JPG, PNG o WEBP.</p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          elegir(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
