import { Link } from 'react-router-dom'
import Avatar from '@/components/ui/Avatar.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Card from '@/components/ui/Card.jsx'
import { fechaRelativa, formatearPesos } from '@/lib/format.js'

export default function TarjetaContratacion({ contratacion, esCliente, base }) {
  const contraparte = esCliente ? contratacion.trabajador : contratacion.cliente

  return (
    <Link to={`${base}/contrataciones/${contratacion.id}`} className="block">
      <Card className="transition hover:border-primary/40">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar usuario={contraparte} tamano="md" />
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">
                {contraparte.nombre} {contraparte.apellido}
              </p>
              <p className="truncate text-xs text-muted">
                {contratacion.oficioNombre} · {contratacion.solicitudTitulo}
              </p>
            </div>
          </div>
          <Badge estado={contratacion.estado} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="font-bold text-ink">{formatearPesos(contratacion.presupuesto)}</span>
          <span aria-hidden="true">·</span>
          <span>{contratacion.solicitudUbicacion}</span>
          <span aria-hidden="true">·</span>
          <span>{fechaRelativa(contratacion.createdAt)}</span>
        </div>
      </Card>
    </Link>
  )
}
