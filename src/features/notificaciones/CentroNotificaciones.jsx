import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import * as notifRepo from '@/lib/data/notificaciones.repo.js'
import { destino, etiqueta } from '@/lib/notificaciones.js'
import { fechaRelativa } from '@/lib/format.js'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

export default function CentroNotificaciones() {
  const { usuario } = useAuth()
  const { mostrar } = useToast()
  const [notificaciones, setNotificaciones] = useState([])
  const [cargando, setCargando] = useState(true)

  async function recargar() {
    setNotificaciones(await notifRepo.listar(usuario.id))
    setCargando(false)
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id])

  async function marcar(id) {
    await notifRepo.marcarLeida(id)
    await recargar()
  }

  async function marcarTodas() {
    await notifRepo.marcarTodas(usuario.id)
    await recargar()
    mostrar('Notificaciones marcadas como leídas.', 'info')
  }

  const hayNoLeidas = notificaciones.some((n) => !n.leida)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold lg:text-3xl">Notificaciones</h1>
        {hayNoLeidas && (
          <Button variante="outline" className="w-auto px-4 py-2 text-sm" onClick={marcarTodas}>
            Marcar todas como leídas
          </Button>
        )}
      </div>

      {cargando ? (
        <div className="flex justify-center py-12 text-primary">
          <Spinner className="h-8 w-8" />
        </div>
      ) : notificaciones.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-semibold text-ink">No tenés notificaciones</p>
          <p className="mt-1 text-sm text-muted">
            Acá vas a ver novedades sobre propuestas, contrataciones y valoraciones.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {notificaciones.map((n) => {
            const enlace = destino(n.tipo, n.referencia_id, usuario.rol)
            const contenido = (
              <Card
                className={`flex items-start gap-3 ${n.leida ? '' : 'border-primary/40'}`}
              >
                {!n.leida && (
                  <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm ${n.leida ? 'text-ink' : 'font-bold text-ink'}`}>
                    {etiqueta(n.tipo)}
                  </p>
                  <p className="text-xs text-muted">{fechaRelativa(n.created_at)}</p>
                </div>
                {!n.leida && (
                  <button
                    type="button"
                    onClick={() => marcar(n.id)}
                    className="text-xs font-bold text-primary"
                  >
                    Marcar leída
                  </button>
                )}
              </Card>
            )

            return enlace ? (
              <Link key={n.id} to={enlace} onClick={() => !n.leida && marcar(n.id)} className="block">
                {contenido}
              </Link>
            ) : (
              <div key={n.id}>{contenido}</div>
            )
          })}
        </div>
      )}
    </div>
  )
}
