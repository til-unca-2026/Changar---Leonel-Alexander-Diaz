import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast.jsx'
import * as solicitudesRepo from '@/lib/data/solicitudes.repo.js'
import * as propuestasRepo from '@/lib/data/propuestas.repo.js'
import * as contratacionesRepo from '@/lib/data/contrataciones.repo.js'
import { mensajeError } from '@/lib/errores.js'
import { fechaRelativa, formatearPesos } from '@/lib/format.js'
import Avatar from '@/components/ui/Avatar.jsx'
import ReputacionResumen from '@/components/ReputacionResumen.jsx'
import PortfolioMini from '@/components/PortfolioMini.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

export default function DetalleSolicitud() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { mostrar } = useToast()

  const [solicitud, setSolicitud] = useState(null)
  const [propuestas, setPropuestas] = useState([])
  const [contratacion, setContratacion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [aceptando, setAceptando] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [cancelando, setCancelando] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([solicitudesRepo.obtener(id), propuestasRepo.listarPorSolicitud(id)])
      .then(async ([sol, props]) => {
        if (!activo) return
        setSolicitud(sol)
        setPropuestas(props)

        const aceptada = props.find((p) => p.estado === 'aceptada')
        if (aceptada) {
          const c = await contratacionesRepo.obtenerPorPropuesta(aceptada.id)
          if (activo) setContratacion(c)
        }
      })
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [id])

  async function aceptar(propuesta) {
    try {
      setProcesando(true)
      const contratacionId = await contratacionesRepo.aceptar(propuesta.id)
      mostrar('Propuesta aceptada.', 'exito')
      navigate(`/cliente/contrataciones/${contratacionId}`)
    } catch (err) {
      mostrar(mensajeError(err), 'error')
      setAceptando(null)
    } finally {
      setProcesando(false)
    }
  }

  async function rechazar(propuesta) {
    const quien = `${propuesta.trabajadorNombre} ${propuesta.trabajadorApellido}`.trim()
    if (
      !window.confirm(
        `¿Rechazar la propuesta de ${quien} por ${formatearPesos(propuesta.presupuesto)}?`,
      )
    ) {
      return
    }
    try {
      setProcesando(true)
      await contratacionesRepo.rechazarPropuesta(propuesta.id)
      mostrar('Propuesta rechazada.', 'info')
      await recargar()
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setProcesando(false)
    }
  }

  async function recargar() {
    const [sol, props] = await Promise.all([
      solicitudesRepo.obtener(id),
      propuestasRepo.listarPorSolicitud(id),
    ])
    setSolicitud(sol)
    setPropuestas(props)
    setContratacion(null)
    const aceptada = props.find((p) => p.estado === 'aceptada')
    if (aceptada) setContratacion(await contratacionesRepo.obtenerPorPropuesta(aceptada.id))
  }

  async function cancelarSolicitud() {
    if (!window.confirm('¿Cancelar esta solicitud?')) return
    try {
      setCancelando(true)
      await solicitudesRepo.cancelar(id)
      mostrar('Solicitud cancelada.', 'info')
      await recargar()
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setCancelando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-16 text-primary">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (contratacion) {
    return <Navigate to={`/cliente/contrataciones/${contratacion.id}`} replace />
  }

  if (!solicitud) {
    return (
      <Card className="py-10 text-center">
        <p className="font-bold text-ink">No encontramos la solicitud</p>
        <Link to="/cliente/solicitudes" className="mt-3 inline-block font-bold text-link">
          Volver a mis solicitudes
        </Link>
      </Card>
    )
  }

  const propuestaPendiente = propuestas.find((p) => p.estado === 'enviada')
  const esPersonal = Boolean(solicitud.trabajadorDestinoId)
  const superaPresupuesto =
    Boolean(propuestaPendiente) &&
    solicitud.presupuestoMax != null &&
    Number(propuestaPendiente.presupuesto) > Number(solicitud.presupuestoMax)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/cliente/solicitudes" className="font-bold text-link">
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

        {solicitud.estado === 'abierta' && (
          <div className="mt-4 border-t border-line pt-4">
            <Button
              variante="outline"
              className="w-full sm:w-auto"
              onClick={cancelarSolicitud}
              disabled={cancelando}
            >
              {cancelando ? 'Cancelando…' : 'Cancelar solicitud'}
            </Button>
          </div>
        )}
      </Card>

      {esPersonal && propuestaPendiente && solicitud.estado === 'abierta' && (
        <Card className="border-primary/40 bg-primary-soft">
          <p className="font-bold text-ink">
            {propuestaPendiente.trabajadorNombre} {propuestaPendiente.trabajadorApellido} aceptó
            tu solicitud
          </p>
          <p className="mt-1 text-sm text-muted">
            Propuso {formatearPesos(propuestaPendiente.presupuesto)}. Confirmá o rechazá su
            propuesta para continuar.
          </p>
          {superaPresupuesto && (
            <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-warning">
              ⚠ Supera tu presupuesto máximo de {formatearPesos(solicitud.presupuestoMax)}.
            </p>
          )}

          {aceptando === propuestaPendiente.id ? (
            <div className="mt-3 rounded-xl bg-surface p-3">
              <p className="text-sm font-semibold text-ink">
                ¿Confirmar la contratación por {formatearPesos(propuestaPendiente.presupuesto)}?
              </p>
              <p className="mt-1 text-xs text-muted">
                Se rechazarán automáticamente las demás propuestas.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Button
                  className="w-full sm:w-auto"
                  onClick={() => aceptar(propuestaPendiente)}
                  disabled={procesando}
                >
                  {procesando ? 'Confirmando…' : 'Confirmar'}
                </Button>
                <Button
                  variante="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setAceptando(null)}
                  disabled={procesando}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button
                className="w-full sm:w-auto"
                onClick={() => setAceptando(propuestaPendiente.id)}
                disabled={procesando}
              >
                Confirmar presupuesto
              </Button>
              <Button
                variante="outline"
                className="w-full sm:w-auto"
                onClick={() => rechazar(propuestaPendiente)}
                disabled={procesando}
              >
                Rechazar
              </Button>
            </div>
          )}
        </Card>
      )}

      {contratacion && (
        <Card className="border-primary/30 bg-primary-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-ink">Solicitud asignada</p>
              <p className="text-sm text-muted">
                Ya podés coordinar con la persona contratada.
              </p>
            </div>
            <Link to={`/cliente/contrataciones/${contratacion.id}`}>
              <Button>Ver contratación</Button>
            </Link>
          </div>
        </Card>
      )}

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
                  <Link
                    to={`/perfiles/${p.trabajadorId}`}
                    className="flex min-w-0 items-center gap-3"
                  >
                    <Avatar
                      usuario={{
                        nombre: p.trabajadorNombre,
                        apellido: p.trabajadorApellido,
                        avatarUrl: p.trabajadorAvatar,
                      }}
                      tamano="md"
                    />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">
                        {p.trabajadorNombre} {p.trabajadorApellido}
                      </p>
                      <p className="text-xs text-muted">{fechaRelativa(p.createdAt)}</p>
                    </div>
                  </Link>
                  <Badge estado={p.estado} />
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <ReputacionResumen perfilId={p.trabajadorId} />
                  <PortfolioMini trabajadorId={p.trabajadorId} />
                </div>

                <p className="mt-3 whitespace-pre-line text-sm text-ink">{p.descripcion}</p>
                <p className="mt-3 text-sm font-bold text-primary">
                  Presupuesto: {formatearPesos(p.presupuesto)}
                </p>

                {!p.trabajadorOficios?.includes(solicitud.oficioId) && (
                  <p className="mt-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-warning">
                    ⚠ Posible incompatibilidad: no declara el oficio "{solicitud.oficioNombre}".
                  </p>
                )}

                {solicitud.estado === 'abierta' && p.estado === 'enviada' && !esPersonal && (
                  <div className="mt-3">
                    {aceptando === p.id ? (
                      <div className="rounded-xl bg-primary-soft p-3">
                        <p className="text-sm font-semibold text-ink">
                          ¿Aceptar esta propuesta por {formatearPesos(p.presupuesto)}?
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          Se rechazarán automáticamente las demás propuestas.
                        </p>
                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <Button
                            className="w-full sm:w-auto"
                            onClick={() => aceptar(p)}
                            disabled={procesando}
                          >
                            {procesando ? 'Aceptando…' : 'Confirmar'}
                          </Button>
                          <Button
                            variante="outline"
                            className="w-full sm:w-auto"
                            onClick={() => setAceptando(null)}
                            disabled={procesando}
                          >
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Button
                          className="w-full sm:w-auto"
                          onClick={() => setAceptando(p.id)}
                        >
                          Aceptar propuesta
                        </Button>
                        <Button
                          variante="outline"
                          className="w-full sm:w-auto"
                          onClick={() => rechazar(p)}
                          disabled={procesando}
                        >
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
