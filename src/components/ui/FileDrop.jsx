import { useRef, useState } from 'react'

/**
 * Selector de imágenes del prototipo.
 * Muestra previsualización local; hacia afuera entrega metadatos ({ nombre }).
 * El almacenamiento real de archivos llega con Supabase Storage.
 */
export default function FileDrop({ max = 3, onChange, className = '' }) {
  const [items, setItems] = useState([])
  const inputRef = useRef(null)

  function emitir(nuevos) {
    setItems(nuevos)
    onChange?.(nuevos.map(({ nombre, file, url }) => ({ nombre, file, url })))
  }

  function agregar(files) {
    const nuevos = [...items]
    for (const file of files) {
      if (nuevos.length >= max) break
      if (!file.type.startsWith('image/')) continue
      nuevos.push({
        id: crypto.randomUUID(),
        nombre: file.name,
        url: URL.createObjectURL(file),
        file,
      })
    }
    emitir(nuevos)
  }

  function quitar(id) {
    const nuevos = items.filter((i) => i.id !== id)
    emitir(nuevos)
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => (
          <div key={item.id} className="relative h-20 w-20 overflow-hidden rounded-xl border border-line">
            <img src={item.url} alt={item.nombre} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => quitar(item.id)}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-sm font-bold text-white"
              aria-label={`Quitar ${item.nombre}`}
            >
              ×
            </button>
          </div>
        ))}

        {items.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-canvas text-muted transition hover:border-primary hover:text-primary"
          >
            <span className="text-2xl leading-none">+</span>
            <span className="text-[10px] font-semibold">Foto</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          agregar(Array.from(e.target.files ?? []))
          e.target.value = ''
        }}
      />
      <p className="mt-2 text-xs text-muted">Hasta {max} fotos.</p>
    </div>
  )
}
