import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useSolicitudesCliente } from '@/hooks/useSolicitudes.js'
import * as contratacionesRepo from '@/lib/data/contrataciones.repo.js'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'
import TarjetaSolicitud from './TarjetaSolicitud.jsx'
import TarjetaContratacion from '../contrataciones/TarjetaContratacion.jsx'

const ACTIVOS = ['en_curso', 'pendiente_confirmacion', 'reportado']

export default function MisSolicitudes() {
  const { usuario } = useAuth()
  const { solicitudes, cargando } = useSolicitudesCliente(usuario.id)
  const [contrataciones, setContrataciones] = useState([])

  useEffect(() => {
    let activo = true
    contratacionesRepo
      .listar()
      .then((data) => activo && setContrataciones(data))
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [])

  const activas = contrataciones.filter((c) => ACTIVOS.includes(c.estado))

  const ordenadas = [...solicitudes].sort((a, b) => {
    const pa = a.propuestasCount > 0 ? 1 : 0
    const pb = b.propuestasCount > 0 ? 1 : 0
    if (pa !== pb) return pb - pa
    return new Date(b.createdAt) - new Date(a.createdAt)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Mis solicitudes</h1>
        <Link to="/cliente/solicitudes/nueva">
          <Button className="w-auto px-4 py-2.5 text-sm">+ Nueva</Button>
        </Link>
      </div>

      {activas.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">En curso / requiere acción</h2>
          <div className="space-y-3">
            {activas.map((c) => (
              <TarjetaContratacion key={c.id} contratacion={c} esCliente base="/cliente" />
            ))}
          </div>
        </section>
      )}

      {cargando ? (
        <div className="flex justify-center py-10 text-primary">
          <Spinner className="h-8 w-8" />
        </div>
      ) : ordenadas.length === 0 ? (
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
          {ordenadas.map((s) => (
            <TarjetaSolicitud key={s.id} solicitud={s} oficioNombre={s.oficioNombre} />
          ))}
        </div>
      )}
    </div>
  )
}
