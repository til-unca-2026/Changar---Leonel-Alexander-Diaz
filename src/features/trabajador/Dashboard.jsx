import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import * as perfilRepo from '@/lib/data/perfilTrabajador.repo.js'
import * as propuestasRepo from '@/lib/data/propuestas.repo.js'
import * as contratacionesRepo from '@/lib/data/contrataciones.repo.js'
import { calcularCompletitud } from '@/lib/perfil.js'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'
import TarjetaPropuesta from './TarjetaPropuesta.jsx'
import TarjetaContratacion from '../contrataciones/TarjetaContratacion.jsx'

const ACTIVOS = ['en_curso', 'pendiente_confirmacion', 'reportado']

export default function Dashboard() {
  const { usuario } = useAuth()
  const [perfil, setPerfil] = useState(null)
  const [propuestas, setPropuestas] = useState([])
  const [contrataciones, setContrataciones] = useState([])
  const [cargandoPropuestas, setCargandoPropuestas] = useState(true)

  useEffect(() => {
    let activo = true
    perfilRepo.obtener(usuario.id).then((p) => activo && setPerfil(p))
    propuestasRepo
      .listarPorTrabajador(usuario.id)
      .then((data) => activo && setPropuestas(data))
      .finally(() => activo && setCargandoPropuestas(false))
    contratacionesRepo
      .listar()
      .then((data) => activo && setContrataciones(data))
      .catch(() => {})
    return () => {
      activo = false
    }
  }, [usuario.id])

  const completitud = perfil ? calcularCompletitud(perfil) : null
  const activas = contrataciones.filter((c) => ACTIVOS.includes(c.estado))

  const pendientes = useMemo(
    () =>
      propuestas.filter(
        (p) => p.estado === 'enviada' && p.solicitudEstado !== 'cancelada',
      ),
    [propuestas],
  )
  const modificadas = useMemo(
    () =>
      propuestas.filter(
        (p) =>
          (p.estado === 'enviada' && p.solicitudEstado === 'cancelada') ||
          p.estado === 'rechazada' ||
          p.estado === 'retirada',
      ),
    [propuestas],
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Hola, {usuario.nombre} 👋</h1>
        <p className="mt-1 text-muted">Este es tu panel de trabajador.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {completitud && (
            <Card>
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Estado de tu perfil</h2>
                <span
                  className={`text-sm font-bold ${completitud.completo ? 'text-success' : 'text-primary'}`}
                >
                  {completitud.porcentaje}%
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas">
                <div
                  className={`h-full rounded-full ${completitud.completo ? 'bg-success' : 'bg-primary'}`}
                  style={{ width: `${completitud.porcentaje}%` }}
                />
              </div>

              {completitud.completo ? (
                <p className="mt-3 text-sm text-muted">
                  ¡Listo! Tu perfil está completo y podés postular a trabajos.
                </p>
              ) : (
                <>
                  <ul className="mt-3 space-y-1 text-sm text-muted">
                    {completitud.items
                      .filter((i) => !i.ok)
                      .map((i) => (
                        <li key={i.clave}>• Te falta: {i.texto}</li>
                      ))}
                  </ul>
                  <Link to="/trabajador/perfil" className="mt-4 block sm:inline-block">
                    <Button className="w-full sm:w-auto">Completar perfil</Button>
                  </Link>
                </>
              )}
            </Card>
          )}

          {activas.length > 0 && (
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-lg font-bold">Contrataciones en curso</h2>
                <Link to="/trabajador/contrataciones" className="text-sm font-bold text-primary">
                  Ver todas
                </Link>
              </div>
              <div className="space-y-3">
                {activas.map((c) => (
                  <TarjetaContratacion key={c.id} contratacion={c} base="/trabajador" />
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Mis propuestas</h2>
              {propuestas.length > 0 && (
                <Link to="/trabajador/propuestas" className="text-sm font-bold text-primary">
                  Ver todas
                </Link>
              )}
            </div>

            {cargandoPropuestas ? (
              <div className="flex justify-center py-8 text-primary">
                <Spinner className="h-7 w-7" />
              </div>
            ) : propuestas.length === 0 ? (
              <Card className="text-center">
                <p className="font-semibold text-ink">Todavía no enviaste propuestas</p>
                <p className="mt-1 text-sm text-muted">
                  Explorá las solicitudes abiertas y postulate a la que más te sirva.
                </p>
                <Link to="/trabajador/explorar" className="mt-4 block sm:inline-block">
                  <Button className="w-full sm:w-auto">Explorar solicitudes</Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-4">
                {pendientes.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      Pendientes
                    </p>
                    {pendientes.slice(0, 2).map((p) => (
                      <TarjetaPropuesta key={p.id} propuesta={p} />
                    ))}
                  </div>
                )}
                {modificadas.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-muted">
                      Con cambios
                    </p>
                    {modificadas.slice(0, 2).map((p) => (
                      <TarjetaPropuesta key={p.id} propuesta={p} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <Card className="bg-primary-soft">
            <p className="font-bold text-ink">¿Buscás más trabajo?</p>
            <p className="mt-1 text-sm text-muted">
              Hay solicitudes abiertas esperando propuestas.
            </p>
            <Link to="/trabajador/explorar" className="mt-4 block">
              <Button className="w-full">Explorar solicitudes</Button>
            </Link>
          </Card>

          <Link to="/trabajador/portfolio" className="block">
            <Card className="flex items-center justify-between">
              <span>
                <span className="block font-bold text-ink">Mi portfolio</span>
                <span className="block text-sm text-muted">Mostrá fotos de tus trabajos.</span>
              </span>
              <span className="font-bold text-primary">→</span>
            </Card>
          </Link>
        </aside>
      </div>
    </div>
  )
}
