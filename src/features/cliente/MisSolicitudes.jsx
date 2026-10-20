import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useSolicitudesCliente } from '@/hooks/useSolicitudes.js'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'
import TarjetaSolicitud from './TarjetaSolicitud.jsx'

export default function MisSolicitudes() {
  const { usuario } = useAuth()
  const { solicitudes, cargando } = useSolicitudesCliente(usuario.id)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Mis solicitudes</h1>
        <Link to="/cliente/solicitudes/nueva">
          <Button className="w-auto px-4 py-2.5 text-sm">+ Nueva</Button>
        </Link>
      </div>

      {cargando ? (
        <div className="flex justify-center py-10 text-primary">
          <Spinner className="h-8 w-8" />
        </div>
      ) : solicitudes.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-bold text-ink">Todavía no publicaste ninguna solicitud</p>
          <p className="mt-1 text-sm text-muted">
            Publicá tu primera solicitud para empezar a recibir propuestas.
          </p>
          <Link to="/cliente/solicitudes/nueva" className="mt-4 block">
            <Button className="w-full">Publicar solicitud</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {solicitudes.map((s) => (
            <TarjetaSolicitud key={s.id} solicitud={s} oficioNombre={s.oficioNombre} />
          ))}
        </div>
      )}
    </div>
  )
}
