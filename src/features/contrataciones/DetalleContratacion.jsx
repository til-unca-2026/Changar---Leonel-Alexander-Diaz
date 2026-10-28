import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import * as contratacionesRepo from '@/lib/data/contrataciones.repo.js'
import * as valoracionesRepo from '@/lib/data/valoraciones.repo.js'
import * as propuestasRepo from '@/lib/data/propuestas.repo.js'
import { mensajeError } from '@/lib/errores.js'
import { fechaRelativa, formatearPesos } from '@/lib/format.js'
import Avatar from '@/components/ui/Avatar.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import FileDrop from '@/components/ui/FileDrop.jsx'
import Spinner from '@/components/ui/Spinner.jsx'
import Textarea from '@/components/ui/Textarea.jsx'
import Bitacora from './Bitacora.jsx'

const FORMULARIOS = {
  fin: {
    titulo: 'Confirmar fin del servicio',
    etiqueta: 'Comentario (opcional)',
    placeholder: 'Contá cómo quedó el trabajo.',
    obligatorio: false,
    boton: 'Confirmar fin',
  },
  cancelar: {
    titulo: 'Cancelar servicio',
    etiqueta: 'Motivo de la cancelación',
    placeholder: 'Explicá por qué se cancela el servicio.',
    obligatorio: true,
    boton: 'Cancelar servicio',
  },
  respuesta: {
    titulo: 'Agregar mi versión',
    etiqueta: 'Tu versión de los hechos',
    placeholder: 'Contá lo que pasó desde tu lado.',
    obligatorio: true,
    boton: 'Enviar respuesta',
  },
  reportar: {
    titulo: 'Reportar el contrato',
    etiqueta: 'Motivo del reporte',
    placeholder: 'Explicá qué pasó y por qué reportás este contrato.',
    obligatorio: true,
    boton: 'Enviar reporte',
  },
  descargo: {
    titulo: 'Presentar mi descargo',
    etiqueta: 'Tu versión de los hechos',
    placeholder: 'Contá tu lado del caso (una sola vez).',
    obligatorio: true,
    boton: 'Enviar descargo',
  },
}

function EstrellasSeleccion({ valor, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="text-2xl leading-none"
          aria-label={`${n} estrellas`}
        >
          <span className={n <= valor ? 'text-warning' : 'text-line'}>★</span>
        </button>
      ))}
    </div>
  )
}

export default function DetalleContratacion() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const { mostrar } = useToast()

  const esCliente = usuario.rol === 'cliente'
  const base = esCliente ? '/cliente' : '/trabajador'

  const [contratacion, setContratacion] = useState(null)
  const [evidencias, setEvidencias] = useState([])
  const [contacto, setContacto] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [accion, setAccion] = useState(null)
  const [comentario, setComentario] = useState('')
  const [fotos, setFotos] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const [valoraciones, setValoraciones] = useState([])
  const [postulantes, setPostulantes] = useState(null)
  const [valorar, setValorar] = useState(false)
  const [puntuacion, setPuntuacion] = useState(0)
  const [valoracionComentario, setValoracionComentario] = useState('')
  const [valoracionFotos, setValoracionFotos] = useState([])
  const [valoracionError, setValoracionError] = useState('')
  const [enviandoValoracion, setEnviandoValoracion] = useState(false)

  async function recargar() {
    const [c, ev, vals] = await Promise.all([
      contratacionesRepo.obtener(id),
      contratacionesRepo.evidencias(id),
      valoracionesRepo.porContratacion(id),
    ])
    setContratacion(c)
    setEvidencias(ev)
    setValoraciones(vals)

    setPostulantes(null)
    propuestasRepo
      .postulantesDe(c.solicitudId)
      .then(setPostulantes)
      .catch(() => setPostulantes(null))

    if (['en_curso', 'pendiente_confirmacion', 'completado'].includes(c.estado)) {
      const contraparteId = esCliente ? c.trabajadorId : c.clienteId
      contratacionesRepo
        .contacto(contraparteId)
        .then(setContacto)
        .catch(() => setContacto(null))
    } else {
      setContacto(null)
    }

    setCargando(false)
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function enviar() {
    setError('')
    const cfg = FORMULARIOS[accion]

    if (cfg.obligatorio && !comentario.trim()) {
      setError('Completá este campo para continuar.')
      return
    }

    try {
      setEnviando(true)
      if (accion === 'fin') {
        await contratacionesRepo.confirmarFin(id, {
          usuarioId: usuario.id,
          comentario,
          fotos,
        })
        mostrar('Fin del servicio confirmado.', 'exito')
      } else if (accion === 'cancelar') {
        await contratacionesRepo.cancelar(id, {
          usuarioId: usuario.id,
          motivo: comentario,
          fotos,
        })
        mostrar('Servicio cancelado.', 'info')
      } else if (accion === 'respuesta') {
        await contratacionesRepo.agregarRespuesta(id, {
          usuarioId: usuario.id,
          comentario,
          fotos,
        })
        mostrar('Respuesta agregada.', 'exito')
      } else if (accion === 'reportar') {
        await contratacionesRepo.reportar(id, {
          usuarioId: usuario.id,
          comentario,
          fotos,
        })
        mostrar('Contrato reportado.', 'info')
      } else if (accion === 'descargo') {
        await contratacionesRepo.agregarDescargo(id, {
          usuarioId: usuario.id,
          comentario,
          fotos,
        })
        mostrar('Descargo enviado.', 'exito')
      }
      setAccion(null)
      setComentario('')
      setFotos([])
      await recargar()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  function abrirFormulario(tipo) {
    setAccion(tipo)
    setComentario('')
    setFotos([])
    setError('')
  }

  async function enviarValoracion() {
    setValoracionError('')
    if (puntuacion < 1) {
      setValoracionError('Elegí una cantidad de estrellas.')
      return
    }
    try {
      setEnviandoValoracion(true)
      await valoracionesRepo.enviar(id, {
        usuarioId: usuario.id,
        puntuacion,
        comentario: valoracionComentario,
        fotos: valoracionFotos,
      })
      mostrar('Valoración enviada.', 'exito')
      setValorar(false)
      setPuntuacion(0)
      setValoracionComentario('')
      setValoracionFotos([])
      await recargar()
    } catch (err) {
      setValoracionError(mensajeError(err))
    } finally {
      setEnviandoValoracion(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-16 text-primary">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!contratacion) {
    return (
      <Card className="py-10 text-center">
        <p className="font-bold text-ink">No encontramos la contratación</p>
        <Link to={`${base}/contrataciones`} className="mt-3 inline-block font-bold text-primary">
          Volver a contrataciones
        </Link>
      </Card>
    )
  }

  const contraparte = esCliente ? contratacion.trabajador : contratacion.cliente
  const yaConfirmeFin = evidencias.some(
    (e) => e.tipo === 'fin' && e.autorId === usuario.id,
  )
  const reporte = evidencias.find((e) => e.tipo === 'reporte')
  const soyReportante = reporte?.autorId === usuario.id
  const hayDescargo = evidencias.some((e) => e.tipo === 'descargo')
  const cfg = accion ? FORMULARIOS[accion] : null
  const miVal = valoraciones.find((v) => v.autorId === usuario.id)
  const recibida = valoraciones.find((v) => v.destinatarioId === usuario.id)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center gap-3">
        <Link to={`${base}/contrataciones`} className="font-bold text-primary">
          ←
        </Link>
        <h1 className="text-2xl font-extrabold">Detalle de la contratación</h1>
      </div>

      {/* Resumen */}
      <Card>
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar usuario={contraparte} tamano="lg" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">{contratacion.oficioNombre}</p>
              <h2 className="truncate text-lg font-extrabold text-ink">
                {contraparte.nombre} {contraparte.apellido}
              </h2>
              <p className="truncate text-sm text-muted">{contratacion.solicitudTitulo}</p>
            </div>
          </div>
          <Badge estado={contratacion.estado} />
        </div>

        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Presupuesto acordado</dt>
            <dd className="font-bold text-ink">{formatearPesos(contratacion.presupuesto)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Ubicación</dt>
            <dd className="font-semibold text-ink">{contratacion.solicitudUbicacion}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Contratado</dt>
            <dd className="font-semibold text-ink">{fechaRelativa(contratacion.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Postulantes</dt>
            <dd className="font-semibold text-ink">{postulantes ?? '…'}</dd>
          </div>
        </dl>

        {contratacion.estado === 'cancelado' && contratacion.motivoCancelacion && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-danger">
            Cancelado: {contratacion.motivoCancelacion}
          </p>
        )}
      </Card>

      {/* Contacto */}
      {contacto && (
        <Card className="border-primary/30 bg-primary-soft">
          <h2 className="font-bold text-ink">Contacto para coordinar</h2>
          <p className="mt-1 text-sm text-muted">
            La coordinación de fecha, hora y dirección se hace por fuera de la plataforma.
          </p>
          <p className="mt-2 text-lg font-extrabold text-primary">{contacto}</p>
        </Card>
      )}

      {/* Acciones */}
      <Card>
        <h2 className="font-bold">Acciones</h2>

        {contratacion.estado === 'completado' && !valorar && (
          <div className="mt-3 space-y-3">
            {recibida ? (
              <div className="rounded-xl bg-canvas p-3">
                <p className="text-xs font-bold text-muted">Recibiste una valoración</p>
                <p className="mt-1 text-lg text-warning">
                  {'★'.repeat(recibida.puntuacion)}
                  <span className="text-line">{'★'.repeat(5 - recibida.puntuacion)}</span>
                </p>
                {recibida.comentario && (
                  <p className="mt-1 whitespace-pre-line text-sm text-ink">{recibida.comentario}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">
                El servicio quedó completado. Todavía no recibiste una valoración de la otra
                parte.
              </p>
            )}

            {miVal ? (
              <p className="rounded-xl bg-primary-soft px-3 py-2 text-sm font-semibold text-primary">
                Ya valoraste este servicio con {miVal.puntuacion}{' '}
                {miVal.puntuacion === 1 ? 'estrella' : 'estrellas'}.
              </p>
            ) : (
              <Button
                className="w-full sm:w-auto"
                onClick={() => {
                  setValorar(true)
                  setValoracionError('')
                }}
              >
                Valorar el servicio
              </Button>
            )}
          </div>
        )}

        {contratacion.estado === 'completado' && valorar && (
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            <h3 className="font-bold">Valorar el servicio</h3>
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">Tu puntuación</p>
              <EstrellasSeleccion valor={puntuacion} onChange={setPuntuacion} />
            </div>
            <Textarea
              label="Comentario (opcional)"
              value={valoracionComentario}
              onChange={(e) => setValoracionComentario(e.target.value)}
              placeholder="Contá tu experiencia."
            />
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">Fotos (opcional)</p>
              <FileDrop max={3} onChange={setValoracionFotos} />
            </div>
            {valoracionError && (
              <p className="text-sm font-semibold text-danger">{valoracionError}</p>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                className="w-full sm:w-auto"
                onClick={enviarValoracion}
                disabled={enviandoValoracion}
              >
                {enviandoValoracion ? 'Enviando…' : 'Enviar valoración'}
              </Button>
              <Button
                variante="outline"
                className="w-full sm:w-auto"
                onClick={() => setValorar(false)}
                disabled={enviandoValoracion}
              >
                Volver
              </Button>
            </div>
          </div>
        )}

        {contratacion.estado === 'en_curso' && !accion && (
          <div className="mt-3 space-y-3">
            <Button className="w-full sm:w-auto" onClick={() => abrirFormulario('fin')}>
              Confirmar fin del servicio
            </Button>
            <Button
              variante="outline"
              className="w-full sm:w-auto"
              onClick={() => abrirFormulario('cancelar')}
            >
              Cancelar servicio
            </Button>
          </div>
        )}

        {contratacion.estado === 'pendiente_confirmacion' && !accion && (
          <div className="mt-3 space-y-3">
            {yaConfirmeFin ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
                Ya confirmaste el fin. Esperando la confirmación de la otra parte.
              </p>
            ) : (
              <>
                <Button className="w-full sm:w-auto" onClick={() => abrirFormulario('fin')}>
                  Confirmar fin del servicio
                </Button>
                <Button
                  variante="outline"
                  className="w-full sm:w-auto"
                  onClick={() => abrirFormulario('reportar')}
                >
                  Reportar el contrato
                </Button>
              </>
            )}
          </div>
        )}

        {contratacion.estado === 'reportado' && !accion && (
          <div className="mt-3">
            {soyReportante ? (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
                Reporte enviado. Quedó registrado como antecedente del contrato.
              </p>
            ) : hayDescargo ? (
              <p className="rounded-xl bg-canvas px-3 py-2 text-sm font-semibold text-ink">
                Tu descargo quedó registrado.
              </p>
            ) : (
              <>
                <p className="text-sm text-muted">
                  Este contrato fue reportado. Podés presentar tu descargo una sola vez.
                </p>
                <Button
                  variante="outline"
                  className="mt-3 w-full sm:w-auto"
                  onClick={() => abrirFormulario('descargo')}
                >
                  Presentar mi descargo
                </Button>
              </>
            )}
          </div>
        )}

        {contratacion.estado === 'cancelado' && !accion && (
          <div className="mt-3">
            <p className="text-sm text-muted">
              El servicio fue cancelado. Podés dejar tu versión con texto y fotos.
            </p>
            <Button
              variante="outline"
              className="mt-3 w-full sm:w-auto"
              onClick={() => abrirFormulario('respuesta')}
            >
              Agregar mi versión
            </Button>
          </div>
        )}

        {cfg && (
          <div className="mt-4 space-y-4 border-t border-line pt-4">
            <h3 className="font-bold">{cfg.titulo}</h3>
            <Textarea
              label={cfg.etiqueta}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder={cfg.placeholder}
            />
            <div>
              <p className="mb-1.5 text-sm font-semibold text-ink">Fotos (opcional)</p>
              <FileDrop max={3} onChange={setFotos} />
            </div>
            {error && <p className="text-sm font-semibold text-danger">{error}</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="w-full sm:w-auto" onClick={enviar} disabled={enviando}>
                {enviando ? 'Enviando…' : cfg.boton}
              </Button>
              <Button
                variante="outline"
                className="w-full sm:w-auto"
                onClick={() => setAccion(null)}
                disabled={enviando}
              >
                Volver
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Bitácora */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Historial</h2>
        <Bitacora evidencias={evidencias} />
      </section>
    </div>
  )
}
