import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import * as perfilesRepo from '@/lib/data/perfiles.repo.js'
import * as valoracionesRepo from '@/lib/data/valoraciones.repo.js'
import { fechaRelativa } from '@/lib/format.js'
import Avatar from '@/components/ui/Avatar.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

const ROL = {
  cliente: 'Cliente',
  trabajador: 'Trabajador',
  admin: 'Administrador',
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
  const [perfil, setPerfil] = useState(null)
  const [reportes, setReportes] = useState([])
  const [cancelados, setCancelados] = useState([])
  const [reputacion, setReputacion] = useState(null)
  const [valoraciones, setValoraciones] = useState([])
  const [cargando, setCargando] = useState(true)

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
  }, [id])

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
        <Link to="/" className="mt-3 inline-block font-bold text-primary">
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
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
