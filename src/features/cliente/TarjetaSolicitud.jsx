import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge.jsx'
import { fechaRelativa, formatearPesos } from '@/lib/format.js'

function IconoFoto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 16-5-5L5 19" />
    </svg>
  )
}

export default function TarjetaSolicitud({ solicitud, oficioNombre }) {
  const cantidad = solicitud.propuestasCount ?? 0
  const textoPropuestas =
    cantidad === 0 ? 'Sin propuestas' : `${cantidad} ${cantidad === 1 ? 'propuesta' : 'propuestas'}`

  return (
    <Link to={`/cliente/solicitudes/${solicitud.id}`} className="block">
      <article className="flex gap-4 rounded-card border border-line bg-surface p-4 shadow-sm transition hover:border-primary/40">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
          {solicitud.fotos?.[0]?.url ? (
            <img src={solicitud.fotos[0].url} alt="" className="h-full w-full object-cover" />
          ) : (
            <IconoFoto />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-bold text-ink">{solicitud.titulo}</h3>
            <Badge estado={solicitud.estado} />
          </div>

          <p className="mt-1 text-sm font-semibold text-primary">{oficioNombre}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className={cantidad > 0 ? 'font-semibold text-primary' : ''}>
              {textoPropuestas}
            </span>
            <span aria-hidden="true">·</span>
            <span>{formatearPesos(solicitud.presupuestoMax)}</span>
            <span aria-hidden="true">·</span>
            <span>{fechaRelativa(solicitud.createdAt)}</span>
          </div>
        </div>
      </article>
    </Link>
  )
}
