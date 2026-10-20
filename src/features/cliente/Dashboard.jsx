import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useSolicitudesCliente } from '@/hooks/useSolicitudes.js'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'
import TarjetaSolicitud from './TarjetaSolicitud.jsx'

export default function Dashboard() {
  const { usuario } = useAuth()
  const { solicitudes, cargando } = useSolicitudesCliente(usuario.id)
  const recientes = solicitudes.slice(0, 3)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Hola, {usuario.nombre} 👋</h1>
        <p className="mt-1 text-muted">Esto es lo que pasa con tus solicitudes.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Acción principal */}
          <Card className="bg-primary-soft">
            <h2 className="font-bold text-ink">¿Necesitás un profesional?</h2>
            <p className="mt-1 text-sm text-muted">
              Publicá lo que necesitás y recibí propuestas de trabajadores de tu zona.
            </p>
            <Link to="/cliente/solicitudes/nueva" className="mt-4 block sm:inline-block">
              <Button className="w-full sm:w-auto">Publicar solicitud</Button>
            </Link>
          </Card>

          {/* Solicitudes recientes */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">Tus solicitudes</h2>
              {solicitudes.length > 0 && (
                <Link to="/cliente/solicitudes" className="text-sm font-bold text-primary">
                  Ver todas
                </Link>
              )}
            </div>

            {cargando ? (
              <div className="flex justify-center py-8 text-primary">
                <Spinner className="h-7 w-7" />
              </div>
            ) : recientes.length === 0 ? (
              <Card className="text-center">
                <p className="font-semibold text-ink">Todavía no publicaste nada</p>
                <p className="mt-1 text-sm text-muted">
                  Cuando publiques una solicitud, la vas a ver acá.
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {recientes.map((s) => (
                  <TarjetaSolicitud key={s.id} solicitud={s} oficioNombre={s.oficioNombre} />
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section>
            <h2 className="mb-3 text-lg font-bold">Contrataciones en curso</h2>
            <Card className="text-center">
              <p className="text-sm text-muted">
                Las contrataciones aparecerán cuando aceptes una propuesta.
              </p>
            </Card>
          </section>

          <Card className="border-0 bg-ink text-white">
            <p className="text-sm font-bold">Consejo</p>
            <p className="mt-1 text-sm text-white/70">
              Cuanto más detalle y fotos incluyas en tu solicitud, mejores propuestas vas a
              recibir.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  )
}
