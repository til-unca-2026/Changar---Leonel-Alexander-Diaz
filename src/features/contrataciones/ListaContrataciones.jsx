import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import * as contratacionesRepo from '@/lib/data/contrataciones.repo.js'
import { fechaRelativa, formatearPesos } from '@/lib/format.js'
import Avatar from '@/components/ui/Avatar.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

export default function ListaContrataciones() {
  const { usuario } = useAuth()
  const [contrataciones, setContrataciones] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    contratacionesRepo
      .listar()
      .then((data) => activo && setContrataciones(data))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  const esCliente = usuario.rol === 'cliente'
  const base = esCliente ? '/cliente' : '/trabajador'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Contrataciones</h1>
        <p className="mt-1 text-muted">Seguí el estado de tus servicios acordados.</p>
      </div>

      {cargando ? (
        <div className="flex justify-center py-12 text-primary">
          <Spinner className="h-8 w-8" />
        </div>
      ) : contrataciones.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-bold text-ink">Todavía no tenés contrataciones</p>
          <p className="mt-1 text-sm text-muted">
            {esCliente
              ? 'Cuando aceptes una propuesta, la contratación va a aparecer acá.'
              : 'Cuando un cliente acepte una de tus propuestas, la vas a ver acá.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {contrataciones.map((c) => {
            const contraparte = esCliente ? c.trabajador : c.cliente
            return (
              <Link key={c.id} to={`${base}/contrataciones/${c.id}`} className="block">
                <Card className="transition hover:border-primary/40">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar usuario={contraparte} tamano="md" />
                      <div className="min-w-0">
                        <p className="truncate font-bold text-ink">
                          {contraparte.nombre} {contraparte.apellido}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {c.oficioNombre} · {c.solicitudTitulo}
                        </p>
                      </div>
                    </div>
                    <Badge estado={c.estado} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="font-bold text-ink">{formatearPesos(c.presupuesto)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{c.solicitudUbicacion}</span>
                    <span aria-hidden="true">·</span>
                    <span>{fechaRelativa(c.createdAt)}</span>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
