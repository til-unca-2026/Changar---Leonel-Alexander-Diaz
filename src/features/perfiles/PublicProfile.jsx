import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import * as adminRepo from '@/lib/data/admin.repo.js'
import * as perfilesRepo from '@/lib/data/perfiles.repo.js'
import * as valoracionesRepo from '@/lib/data/valoraciones.repo.js'
import { mensajeError } from '@/lib/errores.js'
import { fechaRelativa } from '@/lib/format.js'
import Avatar from '@/components/ui/Avatar.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import ConfirmarAccion from '@/components/ui/ConfirmarAccion.jsx'
import Spinner from '@/components/ui/Spinner.jsx'
import Textarea from '@/components/ui/Textarea.jsx'

const ROL = {
  cliente: 'Cliente',
  trabajador: 'Trabajador',
  admin: 'Administrador',
}

/** Etiquetas del historial de sanciones. */
const ETIQUETA_SANCION = {
  suspension: 'Suspensión',
  bloqueo: 'Bloqueo permanente',
  marca: 'Advertencia',
}

/** Acciones de sanción disponibles para administradores. */
const ACCIONES_GESTION = {
  ban7: {
    titulo: 'Suspender 7 días',
    mensaje: 'La cuenta quedará suspendida 7 días: no podrá recibir solicitudes.',
    textoConfirmar: 'Suspender 7 días',
    varianteConfirmar: 'outline',
    dias: 7,
    motivo: true,
  },
  ban30: {
    titulo: 'Suspender 30 días',
    mensaje: 'La cuenta quedará suspendida 30 días: no podrá recibir solicitudes.',
    textoConfirmar: 'Suspender 30 días',
    varianteConfirmar: 'outline',
    dias: 30,
    motivo: true,
  },
  ban: {
    titulo: 'Banear permanentemente',
    mensaje:
      'La cuenta quedará bloqueada. Se cancelan sus solicitudes abiertas y se retiran sus propuestas enviadas.',
    textoConfirmar: 'Banear',
    varianteConfirmar: 'danger',
    dias: null,
    motivo: true,
  },
  marcar: {
    titulo: 'Marcar perfil',
    mensaje: 'Se registrará una advertencia privada en el historial del perfil.',
    textoConfirmar: 'Marcar',
    varianteConfirmar: 'primary',
    motivo: true,
  },
  reactivar: {
    titulo: 'Reactivar cuenta',
    mensaje: 'La cuenta volverá a estar habilitada y podrá operar con normalidad.',
    textoConfirmar: 'Reactivar',
    varianteConfirmar: 'primary',
  },
}

function Galeria({ fotos }) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {fotos.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="aspect-square overflow-hidden rounded-lg border border-line"
        >
          <img src={url} alt="" className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  )
}

function Estrellas({ n }) {
  return (
    <span className="text-sm leading-none text-warning">
      {'★'.repeat(n)}
      <span className="text-line">{'★'.repeat(5 - n)}</span>
    </span>
  )
}

export default function PublicProfile() {
  const { id } = useParams()
  const { usuario } = useAuth()
  const { mostrar } = useToast()
  const [perfil, setPerfil] = useState(null)
  const [reportes, setReportes] = useState([])
  const [cancelados, setCancelados] = useState([])
  const [reputacion, setReputacion] = useState(null)
  const [valoraciones, setValoraciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [reportando, setReportando] = useState(false)
  const [motivoReporte, setMotivoReporte] = useState('')
  const [enviandoReporte, setEnviandoReporte] = useState(false)
  const [historial, setHistorial] = useState([])
  const [accion, setAccion] = useState(null)
  const [aplicando, setAplicando] = useState(false)
  const [recarga, setRecarga] = useState(0)

  useEffect(() => {
    let activo = true

    async function cargar() {
      try {
        const base = await perfilesRepo.obtenerBase(id)
        if (!base) {
          if (activo) setCargando(false)
          return
        }
        const perfil =
          base.rol === 'trabajador'
            ? await perfilesRepo.obtenerTrabajador(id)
            : base.rol === 'cliente'
              ? await perfilesRepo.obtenerCliente(id)
              : base

        const [reps, rep, vals, canc] = await Promise.all([
          perfilesRepo.reportesDe(id),
          valoracionesRepo.reputacion(id),
          valoracionesRepo.listarRecibidas(id),
          perfilesRepo.canceladosDe(id),
        ])

        if (activo) {
          setPerfil(perfil)
          setReportes(reps)
          setCancelados(canc)
          setReputacion(rep)
          setValoraciones(vals)
          setCargando(false)
        }
      } catch {
        if (activo) setCargando(false)
      }
    }

    cargar()
    return () => {
      activo = false
    }
  }, [id, recarga])

  const esAdmin = usuario?.rol === 'admin'
  const esSuperadmin = Boolean(usuario?.esSuperadmin)
  const puedeGestionar =
    esAdmin &&
    Boolean(perfil) &&
    perfil.id !== usuario?.id &&
    !perfil.esSuperadmin &&
    (perfil.rol !== 'admin' || esSuperadmin)

  useEffect(() => {
    if (!puedeGestionar) {
      setHistorial([])
      return undefined
    }

    let activo = true
    adminRepo
      .sancionesDe(id)
      .then((h) => activo && setHistorial(h))
      .catch(() => activo && setHistorial([]))
    return () => {
      activo = false
    }
  }, [id, puedeGestionar, recarga])

  async function enviarReporte() {
    if (!motivoReporte.trim()) {
      mostrar('Escribí el motivo del reporte.', 'error')
      return
    }
    try {
      setEnviandoReporte(true)
      await perfilesRepo.reportar(id, usuario.id, motivoReporte)
      mostrar('Reporte enviado.', 'exito')
      setReportando(false)
      setMotivoReporte('')
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setEnviandoReporte(false)
    }
  }

  async function confirmarGestion(motivo) {
    if (!accion || !perfil) return
    const definicion = ACCIONES_GESTION[accion]
    setAplicando(true)
    try {
      if (accion === 'reactivar') {
        await adminRepo.desbanear(perfil.id)
        mostrar('Cuenta reactivada.', 'exito')
      } else if (accion === 'marcar') {
        await adminRepo.marcar(perfil.id, motivo)
        mostrar('Advertencia aplicada.', 'exito')
      } else {
        await adminRepo.banear(perfil.id, definicion.dias, motivo)
        mostrar(definicion.dias ? 'Cuenta suspendida.' : 'Cuenta bloqueada.', 'exito')
      }
      setAccion(null)
      setRecarga((n) => n + 1)
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAplicando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-16 text-primary">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!perfil) {
    return (
      <Card className="py-10 text-center">
        <p className="font-bold text-ink">No encontramos este perfil</p>
        <Link to="/" className="mt-3 inline-block font-bold text-link">
          Volver al inicio
        </Link>
      </Card>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Card className="flex items-center gap-4">
        <Avatar usuario={perfil} tamano="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-extrabold text-ink">
              {perfil.nombre} {perfil.apellido}
            </h1>
            <Badge estado="neutral">{ROL[perfil.rol]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted">En ChangAr {fechaRelativa(perfil.createdAt)}</p>
        </div>
      </Card>

      {!perfil.habilitado && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="font-bold text-warning">
            {perfil.activo === false ? 'Cuenta bloqueada' : 'Cuenta suspendida'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {perfil.activo === false
              ? 'Esta cuenta fue bloqueada por el administrador.'
              : `Esta cuenta está suspendida hasta el ${new Date(
                  perfil.suspendidoHasta,
                ).toLocaleDateString('es-AR')}. No puede recibir solicitudes.`}
          </p>
        </Card>
      )}

      {/* Reputación */}
      {reputacion && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Reputación</h2>
            {reputacion.total > 0 ? (
              <span className="text-lg font-extrabold text-warning">
                ★ {reputacion.promedio}
              </span>
            ) : (
              <span className="rounded-full bg-violet-50 px-2 py-0.5 text-xs font-bold text-new">
                Nuevo
              </span>
            )}
          </div>

          {reputacion.total > 0 ? (
            <>
              <p className="mt-1 text-xs text-muted">{reputacion.total} valoraciones</p>
              <div className="mt-3 space-y-1.5">
                {[5, 4, 3, 2, 1].map((n) => {
                  const count = reputacion.distribucion?.[n] ?? 0
                  const pct = reputacion.total ? (count / reputacion.total) * 100 : 0
                  return (
                    <div key={n} className="flex items-center gap-2 text-xs">
                      <span className="w-8 text-muted">{n} ★</span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-canvas">
                        <div
                          className="h-full rounded-full bg-warning"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-muted">{count}</span>
                    </div>
                  )
                })}
              </div>

              {reputacion.bajas > 0 && (
                <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
                  ⚠ Recibió {reputacion.bajas}{' '}
                  {reputacion.bajas === 1 ? 'valoración baja' : 'valoraciones bajas'} (1-2
                  estrellas).
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">Todavía no recibió valoraciones.</p>
          )}
        </Card>
      )}

      {perfil.rol === 'trabajador' && (
        <>
          <Card className="space-y-4">
            <div>
              <h2 className="font-bold">Sobre mí</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">
                {perfil.descripcion || 'Sin descripción.'}
              </p>
            </div>
            {perfil.experiencia && (
              <div>
                <h3 className="text-sm font-bold">Experiencia</h3>
                <p className="mt-1 whitespace-pre-line text-sm text-muted">{perfil.experiencia}</p>
              </div>
            )}
            {perfil.ubicacion && <p className="text-sm text-muted">📍 {perfil.ubicacion}</p>}
          </Card>

          {perfil.oficios?.length > 0 && (
            <Card>
              <h2 className="font-bold">Oficios</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {perfil.oficios.map((nombre) => (
                  <span
                    key={nombre}
                    className="rounded-full bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary"
                  >
                    {nombre}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {perfil.portfolio?.length > 0 && (
            <Card>
              <h2 className="font-bold">Portfolio</h2>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {perfil.portfolio.map((p, i) => (
                  <div key={i}>
                    <div className="aspect-square overflow-hidden rounded-xl border border-line">
                      <img src={p.url} alt={p.descripcion || ''} className="h-full w-full object-cover" />
                    </div>
                    {p.descripcion && <p className="mt-1 truncate text-xs text-muted">{p.descripcion}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}

      {perfil.rol === 'cliente' && (
        <Card className="space-y-4">
          {perfil.zona && (
            <div>
              <h2 className="font-bold">Zona</h2>
              <p className="mt-1 text-sm text-ink">{perfil.zona}</p>
            </div>
          )}
          {perfil.descripcion && (
            <div>
              <h2 className="font-bold">Sobre mí</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-ink">{perfil.descripcion}</p>
            </div>
          )}
        </Card>
      )}

      {valoraciones.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Valoraciones recibidas</h2>
          <div className="space-y-3">
            {valoraciones.map((v) => (
              <Card key={v.id}>
                <div className="flex items-center gap-3">
                  <Avatar
                    usuario={{
                      nombre: v.autorNombre,
                      apellido: v.autorApellido,
                      avatarUrl: v.autorAvatar,
                    }}
                    tamano="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">
                      {v.autorNombre} {v.autorApellido}
                    </p>
                    <p className="text-xs text-muted">{fechaRelativa(v.createdAt)}</p>
                  </div>
                  <Estrellas n={v.puntuacion} />
                </div>
                {v.comentario && (
                  <p className="mt-2 whitespace-pre-line text-sm text-ink">{v.comentario}</p>
                )}
                {v.fotos?.length > 0 && <Galeria fotos={v.fotos.map((f) => f.url)} />}
              </Card>
            ))}
          </div>
        </section>
      )}

      {cancelados.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-warning">Contratos cancelados</h2>
          <div className="space-y-3">
            {cancelados.map((r) => (
              <Card key={r.contratacionId} className="border-amber-200">
                <div className="flex items-center gap-3">
                  <Avatar
                    usuario={{
                      nombre: r.contraparteNombre,
                      apellido: r.contraparteApellido,
                      avatarUrl: r.contraparteAvatar,
                    }}
                    tamano="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {r.oficio} · {r.solicitudTitulo}
                    </p>
                    <p className="text-xs text-muted">
                      Con {r.contraparteNombre} {r.contraparteApellido} ·{' '}
                      {fechaRelativa(r.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="rounded-xl bg-amber-50 p-3">
                    <p className="text-xs font-bold text-warning">
                      {r.canceladoPorPerfil
                        ? 'Cancelado por este perfil'
                        : 'Cancelado por la contraparte'}
                    </p>
                    {r.motivo && <p className="mt-1 text-sm text-ink">{r.motivo}</p>}
                  </div>
                  {r.respuesta && (
                    <div className="rounded-xl bg-canvas p-3">
                      <p className="text-xs font-bold text-primary">Respuesta</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink">
                        {r.respuesta.comentario}
                      </p>
                      {r.respuesta.fotos?.length > 0 && <Galeria fotos={r.respuesta.fotos} />}
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {reportes.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-danger">Contratos reportados</h2>
          <div className="space-y-3">
            {reportes.map((r) => (
              <Card key={r.contratacionId} className="border-red-200">
                <div className="flex items-center gap-3">
                  <Avatar
                    usuario={{
                      nombre: r.contraparteNombre,
                      apellido: r.contraparteApellido,
                      avatarUrl: r.contraparteAvatar,
                    }}
                    tamano="sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {r.oficio} · {r.solicitudTitulo}
                    </p>
                    <p className="text-xs text-muted">
                      Con {r.contraparteNombre} {r.contraparteApellido} · {fechaRelativa(r.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-3">
                  {r.reporte && (
                    <div className="rounded-xl bg-red-50 p-3">
                      <p className="text-xs font-bold text-danger">Reporte</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink">{r.reporte.comentario}</p>
                      {r.reporte.fotos?.length > 0 && <Galeria fotos={r.reporte.fotos} />}
                    </div>
                  )}
                  {r.descargo && (
                    <div className="rounded-xl bg-canvas p-3">
                      <p className="text-xs font-bold text-primary">Descargo</p>
                      <p className="mt-1 whitespace-pre-line text-sm text-ink">{r.descargo.comentario}</p>
                      {r.descargo.fotos?.length > 0 && <Galeria fotos={r.descargo.fotos} />}
                    </div>
                  )}
                </div>

                {r.resuelto && (
                  <p className="mt-3 text-sm font-semibold text-success">
                    Resuelto a favor de {r.resueltoAFavorNombre}.
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Gestión de administración: reemplaza al reporte para admin/superadmin */}
      {puedeGestionar && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">Gestión de la cuenta</h2>
              <p className="mt-1 text-sm text-muted">
                Sanciones y advertencias de administración.
              </p>
            </div>
            {perfil.activo === false ? (
              <Badge estado="cancelado">Baneado</Badge>
            ) : perfil.suspendidoHasta && new Date(perfil.suspendidoHasta) > new Date() ? (
              <Badge estado="asignada">Suspendido</Badge>
            ) : (
              <Badge estado="activo">Activo</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {perfil.habilitado ? (
              <>
                <Button
                  variante="outline"
                  className="px-3 py-2 text-sm"
                  onClick={() => setAccion('ban7')}
                >
                  Suspender 7 días
                </Button>
                <Button
                  variante="outline"
                  className="px-3 py-2 text-sm"
                  onClick={() => setAccion('ban30')}
                >
                  Suspender 30 días
                </Button>
                <Button
                  variante="danger"
                  className="px-3 py-2 text-sm"
                  onClick={() => setAccion('ban')}
                >
                  Banear
                </Button>
              </>
            ) : (
              <Button className="px-3 py-2 text-sm" onClick={() => setAccion('reactivar')}>
                Reactivar
              </Button>
            )}
            <Button
              variante="outline"
              className="px-3 py-2 text-sm"
              onClick={() => setAccion('marcar')}
            >
              Marcar
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">
              Historial de sanciones
            </h3>
            {historial.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Sin sanciones ni advertencias.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {historial.map((h) => (
                  <li
                    key={h.id}
                    className="rounded-xl border border-line bg-canvas px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold text-ink">
                        {ETIQUETA_SANCION[h.tipo] ?? h.tipo}
                      </span>
                      <span className="text-xs text-muted">{fechaRelativa(h.createdAt)}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-ink">
                      {h.motivo || 'Sin motivo registrado.'}
                    </p>
                    {h.aplicadaPor && (
                      <p className="mt-1 text-xs text-muted">Aplicada por {h.aplicadaPor}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}

      {puedeGestionar && (
        <ConfirmarAccion
          abierto={Boolean(accion)}
          titulo={accion ? ACCIONES_GESTION[accion].titulo : ''}
          mensaje={accion ? ACCIONES_GESTION[accion].mensaje : ''}
          motivoRequerido={Boolean(accion && ACCIONES_GESTION[accion].motivo)}
          etiquetaMotivo="Motivo de la sanción"
          textoConfirmar={accion ? ACCIONES_GESTION[accion].textoConfirmar : 'Confirmar'}
          varianteConfirmar={accion ? ACCIONES_GESTION[accion].varianteConfirmar : 'primary'}
          cargando={aplicando}
          onConfirmar={confirmarGestion}
          onCancelar={() => setAccion(null)}
        />
      )}

      {!esAdmin && perfil.rol !== 'admin' && perfil.id !== usuario?.id && (
        <Card>
          {reportando ? (
            <div className="space-y-3">
              <h2 className="font-bold">Reportar perfil</h2>
              <Textarea
                label="Motivo"
                value={motivoReporte}
                onChange={(e) => setMotivoReporte(e.target.value)}
                placeholder="Explicá por qué reportás este perfil."
              />
              <div className="flex gap-2">
                <Button className="w-full sm:w-auto" onClick={enviarReporte} disabled={enviandoReporte}>
                  {enviandoReporte ? 'Enviando…' : 'Enviar reporte'}
                </Button>
                <Button
                  variante="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    setReportando(false)
                    setMotivoReporte('')
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variante="outline"
              className="w-full sm:w-auto"
              onClick={() => setReportando(true)}
            >
              Reportar perfil
            </Button>
          )}
        </Card>
      )}
    </div>
  )
}
