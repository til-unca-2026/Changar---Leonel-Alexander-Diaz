import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as solicitudesRepo from '@/lib/data/solicitudes.repo.js'
import * as propuestasRepo from '@/lib/data/propuestas.repo.js'
import { fechaRelativa, formatearPesos } from '@/lib/format.js'
import Avatar from '@/components/ui/Avatar.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

export default function DetalleSolicitud() {
  const { id } = useParams()
  const [solicitud, setSolicitud] = useState(null)
  const [propuestas, setPropuestas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    Promise.all([solicitudesRepo.obtener(id), propuestasRepo.listarPorSolicitud(id)])
      .then(([sol, props]) => {
        if (!activo) return
        setSolicitud(sol)
        setPropuestas(props)
      })
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [id])

  if (cargando) {
    return (
      <div className="flex justify-center py-16 text-primary">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!solicitud) {
    return (
      <Card className="py-10 text-center">
        <p className="font-bold text-ink">No encontramos la solicitud</p>
        <Link to="/cliente/solicitudes" className="mt-3 inline-block font-bold text-primary">
          Volver a mis solicitudes
        </Link>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/cliente/solicitudes" className="font-bold text-primary">
          ←
        </Link>
        <h1 className="text-2xl font-extrabold">Detalle de la solicitud</h1>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-primary">{solicitud.oficioNombre}</p>
          <Badge estado={solicitud.estado} />
        </div>
        <h2 className="mt-1 text-xl font-extrabold">{solicitud.titulo}</h2>
        <p className="mt-3 whitespace-pre-line text-ink">{solicitud.descripcion}</p>

        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Ubicación</dt>
            <dd className="font-semibold text-ink">{solicitud.ubicacion}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Presupuesto máximo</dt>
            <dd className="font-semibold text-ink">{formatearPesos(solicitud.presupuestoMax)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Publicada</dt>
            <dd className="font-semibold text-ink">{fechaRelativa(solicitud.createdAt)}</dd>
          </div>
        </dl>

        {solicitud.fotos?.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {solicitud.fotos.map((foto) => (
              <div key={foto.path} className="aspect-square overflow-hidden rounded-xl border border-line">
                <img src={foto.url} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}
      </Card>

      <section>
        <h2 className="mb-3 text-lg font-bold">
          Propuestas recibidas{' '}
          <span className="text-muted">({propuestas.length})</span>
        </h2>

        {propuestas.length === 0 ? (
          <Card className="py-8 text-center">
            <p className="font-semibold text-ink">Todavía no recibiste propuestas</p>
            <p className="mt-1 text-sm text-muted">
              Cuando un trabajador se postule, la vas a ver acá.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {propuestas.map((p) => (
              <Card key={p.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar
                      usuario={{
                        nombre: p.trabajadorNombre,
                        apellido: p.trabajadorApellido,
                        avatarUrl: p.trabajadorAvatar,
                      }}
                      tamano="md"
                    />
                    <div>
                      <p className="font-bold text-ink">
                        {p.trabajadorNombre} {p.trabajadorApellido}
                      </p>
                      <p className="text-xs text-muted">{fechaRelativa(p.createdAt)}</p>
                    </div>
                  </div>
                  <Badge estado={p.estado} />
                </div>

                <p className="mt-3 whitespace-pre-line text-sm text-ink">{p.descripcion}</p>
                <p className="mt-3 text-sm font-bold text-primary">
                  Presupuesto: {formatearPesos(p.presupuesto)}
                </p>
              </Card>
            ))}
          </div>
        )}

        <p className="mt-4 text-center text-xs text-muted">
          Aceptar una propuesta y coordinar la contratación llega en la próxima etapa.
        </p>
      </section>
    </div>
  )
}
