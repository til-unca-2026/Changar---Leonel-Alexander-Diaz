import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import * as adminRepo from '@/lib/data/admin.repo.js'
import { mensajeError } from '@/lib/errores.js'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

function StatCard({ etiqueta, valor, detalle }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{etiqueta}</p>
      <p className="mt-2 text-3xl font-extrabold text-ink">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-muted">{detalle}</p>}
    </Card>
  )
}

function suma(objeto) {
  return Object.values(objeto ?? {}).reduce((acc, n) => acc + n, 0)
}

const PERIODOS = [
  { id: 'todo', etiqueta: 'Todo' },
  { id: '7', etiqueta: '7 días' },
  { id: '30', etiqueta: '30 días' },
  { id: '90', etiqueta: '90 días' },
]

export default function Dashboard() {
  const [metricas, setMetricas] = useState(null)
  const [periodo, setPeriodo] = useState('todo')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    setCargando(true)
    const desde =
      periodo === 'todo'
        ? null
        : new Date(Date.now() - Number(periodo) * 86400000).toISOString()

    adminRepo
      .metricas(desde)
      .then((data) => activo && setMetricas(data))
      .catch((e) => activo && setError(mensajeError(e)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [periodo])

  if (cargando && !metricas) {
    return (
      <div className="flex justify-center py-16 text-primary">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (error) {
    return (
      <Card className="py-10 text-center">
        <p className="font-bold text-ink">No pudimos cargar las métricas</p>
        <p className="mt-1 text-sm text-muted">{error}</p>
      </Card>
    )
  }

  const usuarios = metricas?.usuarios_por_rol ?? {}
  const solicitudes = metricas?.solicitudes_por_estado ?? {}
  const propuestas = metricas?.propuestas_por_estado ?? {}
  const contrataciones = metricas?.contrataciones_por_estado ?? {}
  const top = metricas?.top_oficios ?? []
  const cola = metricas?.cola_pendientes ?? {}
  const maxTop = Math.max(1, ...top.map((t) => t.solicitudes))
  const pendientesTotal =
    (cola.oficios ?? 0) + (cola.reportes ?? 0) + (cola.contratos_reportados ?? 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold lg:text-3xl">Panel de administración</h1>
          <p className="mt-1 text-muted">Actividad general de ChangAr.</p>
        </div>

        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriodo(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                periodo === p.id ? 'bg-primary text-white' : 'text-muted hover:text-ink'
              }`}
            >
              {p.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          etiqueta="Usuarios"
          valor={suma(usuarios)}
          detalle={`${usuarios.cliente ?? 0} clientes · ${usuarios.trabajador ?? 0} trabajadores`}
        />
        <StatCard
          etiqueta="Solicitudes"
          valor={suma(solicitudes)}
          detalle={`${solicitudes.abierta ?? 0} abiertas`}
        />
        <StatCard
          etiqueta="Propuestas"
          valor={suma(propuestas)}
          detalle={`${propuestas.enviada ?? 0} pendientes`}
        />
        <StatCard
          etiqueta="Contrataciones"
          valor={suma(contrataciones)}
          detalle={`${contrataciones.en_curso ?? 0} en curso`}
        />
      </div>

      {pendientesTotal > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-center gap-4">
            <p className="font-bold text-warning">Pendientes de revisión:</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {cola.oficios > 0 && (
                <Link to="/admin/oficios" className="font-semibold text-warning underline">
                  {cola.oficios} oficio(s)
                </Link>
              )}
              {cola.reportes > 0 && (
                <Link to="/admin/reportes" className="font-semibold text-warning underline">
                  {cola.reportes} reporte(s) de perfil
                </Link>
              )}
              {cola.contratos_reportados > 0 && (
                <Link
                  to="/admin/reportes?tipo=contratos"
                  className="font-semibold text-warning underline"
                >
                  {cola.contratos_reportados} contrato(s) reportado(s)
                </Link>
              )}
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Top oficios por solicitudes</h2>
          {top.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No hay solicitudes en este período.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {top.map((item) => (
                <div key={item.oficio}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-semibold text-ink">{item.oficio}</span>
                    <span className="text-muted">{item.solicitudes}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-canvas">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(item.solicitudes / maxTop) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="font-bold">Accesos rápidos</h2>
          <div className="mt-4 space-y-2">
            <Link to="/admin/usuarios" className="block rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:border-primary/40">
              Gestión de usuarios
            </Link>
            <Link to="/admin/oficios" className="block rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:border-primary/40">
              Moderación de oficios
            </Link>
            <Link to="/admin/reportes" className="block rounded-xl border border-line px-4 py-3 text-sm font-semibold text-ink transition hover:border-primary/40">
              Reportes (perfiles y contratos)
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
