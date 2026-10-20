import { Link } from 'react-router-dom'
import Badge from '@/components/ui/Badge.jsx'
import Card from '@/components/ui/Card.jsx'
import { fechaRelativa, formatearPesos } from '@/lib/format.js'

export default function TarjetaPropuesta({ propuesta }) {
  return (
    <Link to={`/trabajador/solicitudes/${propuesta.solicitudId}`} className="block">
      <Card className="transition hover:border-primary/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-primary">{propuesta.oficioNombre}</p>
            <h2 className="truncate font-bold text-ink">{propuesta.solicitudTitulo}</h2>
          </div>
          <Badge estado={propuesta.estado} />
        </div>

        <p className="mt-2 line-clamp-2 text-sm text-muted">{propuesta.descripcion}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="font-bold text-ink">{formatearPesos(propuesta.presupuesto)}</span>
          <span aria-hidden="true">·</span>
          <span>{propuesta.solicitudUbicacion}</span>
          <span aria-hidden="true">·</span>
          <span>{fechaRelativa(propuesta.createdAt)}</span>
        </div>
      </Card>
    </Link>
  )
}
