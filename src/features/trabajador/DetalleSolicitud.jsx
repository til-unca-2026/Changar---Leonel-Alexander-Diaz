import { useEffect, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import * as solicitudesRepo from '@/lib/data/solicitudes.repo.js'
import * as propuestasRepo from '@/lib/data/propuestas.repo.js'
import * as contratacionesRepo from '@/lib/data/contrataciones.repo.js'
import * as perfilRepo from '@/lib/data/perfilTrabajador.repo.js'
import { calcularCompletitud } from '@/lib/perfil.js'
import { mensajeError } from '@/lib/errores.js'
import { fechaRelativa, formatearPesos } from '@/lib/format.js'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import Textarea from '@/components/ui/Textarea.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

export default function DetalleSolicitud() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const { mostrar } = useToast()
  const navigate = useNavigate()

  const [solicitud, setSolicitud] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [miPropuesta, setMiPropuesta] = useState(null)
  const [contratacion, setContratacion] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [descripcion, setDescripcion] = useState('')
  const [presupuesto, setPresupuesto] = useState('')

  useEffect(() => {
    let activo = true
    Promise.all([
      solicitudesRepo.obtener(id),
      perfilRepo.obtener(usuario.id),
      propuestasRepo.miPropuesta(id, usuario.id),
    ])
      .then(async ([sol, p, prop]) => {
        if (!activo) return
        setSolicitud(sol)
        setPerfil(p)
        setMiPropuesta(prop)
        if (prop?.estado === 'aceptada') {
          const c = await contratacionesRepo.obtenerPorPropuesta(prop.id)
          if (activo) setContratacion(c)
        }
      })
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [id, usuario.id])

  const completitud = perfil ? calcularCompletitud(perfil) : null
  const puedePostular = solicitud?.estado === 'abierta' && completitud?.completo && !miPropuesta

  async function enviar(e) {
    e.preventDefault()
    setError('')
    if (!descripcion.trim()) {
      setError('Contá brevemente cómo harías el trabajo.')
      return
    }
    if (!presupuesto || Number(presupuesto) <= 0) {
      setError('Ingresá un presupuesto estimado.')
      return
    }

    try {
      setEnviando(true)
      await propuestasRepo.enviar({
        solicitudId: id,
        descripcion,
        presupuesto: Number(presupuesto),
      })
      mostrar('Propuesta enviada.', 'exito')
      navigate('/trabajador/propuestas')
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
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
    return <Navigate to={`/trabajador/contrataciones/${contratacion.id}`} replace />
  }

  if (!solicitud) {
    return (
      <Card className="py-10 text-center">
        <p className="font-bold text-ink">No encontramos la solicitud</p>
        <Link to="/trabajador/explorar" className="mt-3 inline-block font-bold text-primary">
          Volver al feed
        </Link>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/trabajador/explorar" className="font-bold text-primary">
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

      {miPropuesta ? (
        <Card className="border-primary/30 bg-primary-soft">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-bold text-ink">Ya enviaste una propuesta</h2>
            <Badge estado={miPropuesta.estado} />
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-ink">{miPropuesta.descripcion}</p>
          <p className="mt-2 text-sm font-bold text-primary">
            Presupuesto: {formatearPesos(miPropuesta.presupuesto)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Enviada {fechaRelativa(miPropuesta.created_at).toLowerCase()}
          </p>
          {contratacion && (
            <Link
              to={`/trabajador/contrataciones/${contratacion.id}`}
              className="mt-3 block sm:inline-block"
            >
              <Button className="w-full sm:w-auto">Ver contratación</Button>
            </Link>
          )}
        </Card>
      ) : solicitud.estado !== 'abierta' ? (
        <Card className="text-center">
          <p className="font-semibold text-ink">Esta solicitud ya no acepta propuestas.</p>
        </Card>
      ) : !completitud?.completo ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="font-bold text-warning">Necesitás completar tu perfil</p>
          <p className="mt-1 text-sm text-muted">
            Para postularte necesitás descripción, ubicación y al menos un oficio.
          </p>
          <Link to="/trabajador/perfil" className="mt-3 block sm:inline-block">
            <Button variante="outline" className="w-full sm:w-auto">
              Completar perfil
            </Button>
          </Link>
        </Card>
      ) : (
        <Card>
          <h2 className="font-bold">Enviar propuesta</h2>
          <form onSubmit={enviar} className="mt-4 space-y-4">
            <Textarea
              label="¿Cómo harías el trabajo?"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Contá tu enfoque, materiales y tiempos estimados."
            />
            <Input
              label="Presupuesto estimado"
              type="number"
              min="0"
              value={presupuesto}
              onChange={(e) => setPresupuesto(e.target.value)}
              placeholder="Ej: 15000"
            />
            {Number(presupuesto) > 0 &&
              solicitud.presupuestoMax &&
              Number(presupuesto) > Number(solicitud.presupuestoMax) && (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
                  Tu presupuesto supera el máximo que indicó el cliente. Igual podés enviarlo.
                </p>
              )}
            {error && <p className="text-sm font-semibold text-danger">{error}</p>}
            <Button tipo="submit" className="w-full sm:w-auto" disabled={enviando || !puedePostular}>
              {enviando ? 'Enviando…' : 'Enviar propuesta'}
            </Button>
          </form>
        </Card>
      )}
    </div>
  )
}
