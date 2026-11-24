import { useEffect, useId, useMemo, useState } from 'react'
import { crearPendiente, listarVisibles } from '@/lib/data/oficios.repo.js'
import { mensajeError } from '@/lib/errores.js'
import { normalizar, similitud } from '@/lib/texto.js'
import Badge from '@/components/ui/Badge.jsx'

/**
 * Buscador de oficios con creación de categorías nuevas.
 *
 * - `multiple`: permite varios oficios (perfil del trabajador).
 * - `multiple = false`: selecciona uno solo (solicitud del cliente).
 * - `opciones`: lista fija; si se pasa, no consulta la base (solicitud personal).
 * - `permitirCrear`: habilita el alta de un oficio pendiente.
 */
export default function OficioPicker({
  value,
  onChange = () => {},
  multiple = false,
  permitirCrear = true,
  opciones = null,
  label,
  ayuda,
  placeholder = 'Buscar o agregar un oficio…',
}) {
  const [disponibles, setDisponibles] = useState(opciones ?? [])
  const [query, setQuery] = useState('')
  const [abierto, setAbierto] = useState(false)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  const idCampo = useId()

  const seleccionados = multiple ? (Array.isArray(value) ? value : []) : value ? [value] : []

  async function recargar() {
    if (opciones) {
      setDisponibles(opciones)
      return
    }
    setDisponibles(await listarVisibles())
  }

  useEffect(() => {
    if (opciones) {
      setDisponibles(opciones)
      return
    }
    let activo = true
    listarVisibles()
      .then((lista) => activo && setDisponibles(lista))
      .catch(() => activo && setDisponibles([]))
    return () => {
      activo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opciones])

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
      .map((o) => ({ ...o, similitud: similitud(q, o.nombre) }))
      .slice(0, 4)
    const exacto = disponibles.find((o) => normalizar(o.nombre) === normalQ)
    return { coincidencias, parecidos, exacto }
  }, [q, normalQ, disponibles])

  function agregar(id) {
    const oficio = porId.get(id)
    if (multiple) {
      if (!seleccionados.includes(id)) onChange([...seleccionados, id], oficio)
    } else {
      onChange(id, oficio)
    }
    setQuery('')
    setAbierto(false)
    setError('')
  }

  function quitar(id) {
    if (multiple) onChange(seleccionados.filter((v) => v !== id))
    else onChange('', null)
  }

  async function crear() {
    if (!q || !permitirCrear) return
    try {
      setCreando(true)
      setError('')
      const nuevo = await crearPendiente(q)
      await recargar()
      if (multiple) {
        if (!seleccionados.includes(nuevo.id)) onChange([...seleccionados, nuevo.id], nuevo)
      } else {
        onChange(nuevo.id, nuevo)
      }
      setQuery('')
      setAbierto(false)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCreando(false)
    }
  }

  return (
    <div>
      {label && (
        <label htmlFor={idCampo} className="mb-1.5 block text-sm font-semibold text-ink">
          {label}
        </label>
      )}

      {seleccionados.length > 0 && (
        <div className="relative z-20 mb-3 flex flex-wrap gap-2">
          {seleccionados.map((id) => {
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

      <div className="relative">
        <input
          id={idCampo}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setAbierto(true)
            setError('')
          }}
          onFocus={() => setAbierto(true)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20"
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

            {coincidencias.length === 0 && parecidos.length === 0 && (
              <p className="px-4 py-3 text-sm text-muted">
                No encontramos ese oficio
                {permitirCrear ? '.' : ' entre los disponibles.'}
              </p>
            )}

            {permitirCrear && !exacto && (
              <button
                type="button"
                onClick={crear}
                disabled={creando}
                className="w-full border-t border-line px-4 py-3 text-left text-sm font-bold text-primary hover:bg-primary-soft disabled:opacity-60"
              >
                {creando ? 'Creando…' : `+ Crear «${q}»`}
              </button>
            )}
          </div>
        )}
      </div>

      {abierto && q && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          className="fixed inset-0 z-10 cursor-default"
          onClick={() => setAbierto(false)}
        />
      )}

      {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}

      <p className="mt-2 text-xs text-muted">
        {ayuda ??
          (permitirCrear
            ? 'Los oficios nuevos quedan pendientes de aprobación, pero ya podés usarlos.'
            : 'Mostramos solo los oficios disponibles para esta solicitud.')}
      </p>
    </div>
  )
}
