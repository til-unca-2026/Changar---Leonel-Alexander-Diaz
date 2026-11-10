import { Link } from 'react-router-dom'
import Avatar from '@/components/ui/Avatar.jsx'
import InsigniaReputacion from '@/components/InsigniaReputacion.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'

export default function TarjetaProfesional({ perfil, oficioFiltro = '' }) {
  const datos = {
    total: perfil.totalValoraciones,
    promedio: perfil.promedio,
    bajas: perfil.bajas,
    reportes: perfil.reportes,
  }

  const urlSolicitud =
    `/cliente/solicitudes/nueva?trabajador=${perfil.id}` +
    (oficioFiltro ? `&oficio=${oficioFiltro}` : '')

  return (
    <Card className="flex h-full flex-col">
      <div className="flex items-start gap-3">
        <Avatar
          usuario={{
            nombre: perfil.nombre,
            apellido: perfil.apellido,
            avatarUrl: perfil.avatarUrl,
          }}
          tamano="md"
        />
        <div className="min-w-0 flex-1">
          <Link
            to={`/perfiles/${perfil.id}`}
            className="block truncate font-bold text-ink hover:underline"
          >
            {perfil.nombre} {perfil.apellido}
          </Link>
          {perfil.zona && <p className="truncate text-xs text-muted">{perfil.zona}</p>}
          <div className="mt-1">
            <InsigniaReputacion datos={datos} perfilId={perfil.id} />
          </div>
        </div>
      </div>

      {perfil.oficios?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {perfil.oficios.map((oficio) => (
            <span
              key={oficio}
              className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary"
            >
              {oficio}
            </span>
          ))}
        </div>
      )}

      {perfil.descripcion && (
        <p className="mt-3 line-clamp-2 text-sm text-muted">{perfil.descripcion}</p>
      )}

      {perfil.suspendido && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-warning">
          ⚠ Cuenta suspendida — no recibe solicitudes por ahora.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Link to={`/perfiles/${perfil.id}`} className="flex-1">
          <Button variante="outline" className="w-full">
            Ver perfil
          </Button>
        </Link>
        {perfil.suspendido ? (
          <Button className="w-full sm:flex-1" disabled>
            No disponible
          </Button>
        ) : (
          <Link to={urlSolicitud} className="flex-1">
            <Button className="w-full">Enviar solicitud</Button>
          </Link>
        )}
      </div>
    </Card>
  )
}
