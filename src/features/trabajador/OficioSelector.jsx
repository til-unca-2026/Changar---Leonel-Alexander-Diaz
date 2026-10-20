import { useEffect, useMemo, useState } from 'react'
import { crearPendiente, listarParaTrabajador } from '@/lib/data/oficios.repo.js'
import { normalizar, similitud } from '@/lib/texto.js'
import Badge from '@/components/ui/Badge.jsx'

export default function OficioSelector({ value = [], onChange }) {
  const [disponibles, setDisponibles] = useState([])
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState(false)

  async function recargar() {
    setDisponibles(await listarParaTrabajador())
  }

  useEffect(() => {
    recargar()
  }, [])

  const porId = useMemo(() => new Map(disponibles.map((o) => [o.id, o])), [disponibles])

  const q = query.trim()
  const normalQ = normalizar(q)

  const { coincidencias, parecidos, exacto } = useMemo(() => {
    if (!q) return { coincidencias: [], parecidos: [], exacto: null }
    const coincidencias = disponibles
      .filter((o) => normalizar(o.nombre).includes(normalQ))
      .slice(0, 6)
    const idsCoinc = new Set(coincidencias.map((o) => o.id))
    const parecidos = disponibles
      .filter((o) => !idsCoinc.has(o.id) && similitud(q, o.nombre) >= 0.55)
      .slice(0, 4)
    const exacto = disponibles.find((o) => normalizar(o.nombre) === normalQ)
    return { coincidencias, parecidos, exacto }
  }, [q, normalQ, disponibles])

  function agregar(id) {
    if (!value.includes(id)) onChange([...value, id])
    setQuery('')
    setAbierto(false)
  }

  function quitar(id) {
    onChange(value.filter((v) => v !== id))
  }

  async function crear() {
    try {
      setCreando(true)
      const nuevo = await crearPendiente(q)
      await recargar()
      agregar(nuevo.id)
    } finally {
      setCreando(false)
    }
  }

  return (
    <div>
      {/* Seleccionados */}
      {value.length > 0 && (
        <div className="relative z-20 mb-3 flex flex-wrap gap-2">
          {value.map((id) => {
            const oficio = porId.get(id)
            return (
              <span
                key={id}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-semibold text-ink"
              >
                {oficio?.nombre ?? 'Oficio'}
                {oficio?.estado === 'pendiente' && (
                  <Badge estado="asignada" className="px-2 py-0.5">
                    Pendiente
                  </Badge>
                )}
                <button
                  type="button"
                  onClick={() => quitar(id)}
                  className="text-muted transition hover:text-danger"
                  aria-label={`Quitar ${oficio?.nombre ?? 'oficio'}`}
                >
                  ×
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Búsqueda */}
      <div className="relative">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setAbierto(true)
          }}
          onFocus={() => setAbierto(true)}
          placeholder="Buscar o agregar un oficio…"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        />

        {abierto && q && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
            {coincidencias.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => agregar(o.id)}
                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-canvas"
              >
                <span className="font-semibold text-ink">{o.nombre}</span>
                {o.estado === 'pendiente' && (
                  <Badge estado="asignada" className="px-2 py-0.5">
                    Pendiente
                  </Badge>
                )}
              </button>
            ))}

            {parecidos.length > 0 && (
              <div className="border-t border-line">
                <p className="px-4 pb-1 pt-2 text-xs font-semibold text-muted">¿Quisiste decir?</p>
                {parecidos.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => agregar(o.id)}
                    className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-canvas"
                  >
                    <span className="font-semibold text-ink">{o.nombre}</span>
                    <span className="text-xs text-muted">{Math.round(o.similitud * 100)}%</span>
                  </button>
                ))}
              </div>
            )}

            {!exacto && (
              <button
                type="button"
                onClick={crear}
                disabled={creando}
                className="w-full border-t border-line px-4 py-3 text-left text-sm font-bold text-primary hover:bg-primary-soft disabled:opacity-60"
              >
                {creando ? 'Creando…' : `+ Crear “${q}”`}
              </button>
            )}
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-muted">
        Los oficios nuevos quedan pendientes de aprobación, pero contás con ellos para tu perfil.
      </p>

      {abierto && q && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setAbierto(false)}
        />
      )}
    </div>
  )
}
