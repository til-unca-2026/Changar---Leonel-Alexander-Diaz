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

export default function Dashboard() {
  const [metricas, setMetricas] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    adminRepo
      .metricas()
      .then((data) => activo && setMetricas(data))
      .catch((e) => activo && setError(mensajeError(e)))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  if (cargando) {
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
  const treinta = metricas?.ultimos_30_dias ?? {}
  const top = metricas?.top_oficios ?? []
  const pendientes = metricas?.cola_pendientes?.oficios ?? 0
  const maxTop = Math.max(1, ...top.map((t) => t.solicitudes))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Panel de administración</h1>
        <p className="mt-1 text-muted">Actividad general de ChangAr.</p>
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
          etiqueta="Oficios pendientes"
          valor={pendientes}
          detalle="Requieren revisión"
        />
      </div>

      {pendientes > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-bold text-warning">
                Tenés {pendientes} {pendientes === 1 ? 'oficio pendiente' : 'oficios pendientes'}
              </p>
              <p className="text-sm text-muted">
                Revisalos para que los trabajadores puedan usarlos en su perfil.
              </p>
            </div>
            <Link to="/admin/oficios">
              <Button variante="outline">Revisar oficios</Button>
            </Link>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-bold">Últimos 30 días</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-canvas p-3 text-center">
              <p className="text-2xl font-extrabold text-ink">{treinta.registros ?? 0}</p>
              <p className="mt-1 text-xs text-muted">Registros</p>
            </div>
            <div className="rounded-xl bg-canvas p-3 text-center">
              <p className="text-2xl font-extrabold text-ink">{treinta.solicitudes ?? 0}</p>
              <p className="mt-1 text-xs text-muted">Solicitudes</p>
            </div>
            <div className="rounded-xl bg-canvas p-3 text-center">
              <p className="text-2xl font-extrabold text-ink">{treinta.propuestas ?? 0}</p>
              <p className="mt-1 text-xs text-muted">Propuestas</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="font-bold">Top oficios por solicitudes</h2>
          {top.length === 0 ? (
            <p className="mt-3 text-sm text-muted">Todavía no hay solicitudes publicadas.</p>
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
      </div>
    </div>
  )
}
