import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import * as solicitudesRepo from '@/lib/data/solicitudes.repo.js'
import * as perfilRepo from '@/lib/data/perfilTrabajador.repo.js'
import { calcularCompletitud } from '@/lib/perfil.js'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'
import TarjetaOferta from './TarjetaOferta.jsx'

export default function Explorar() {
  const { usuario } = useAuth()
  const [solicitudes, setSolicitudes] = useState([])
  const [perfil, setPerfil] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [verTodas, setVerTodas] = useState(false)

  useEffect(() => {
    let activo = true
    Promise.all([solicitudesRepo.listarAbiertas(), perfilRepo.obtener(usuario.id)])
      .then(([sols, p]) => {
        if (!activo) return
        setSolicitudes(sols)
        setPerfil(p)
      })
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [usuario.id])

  const oficios = perfil?.oficios ?? []
  const completitud = perfil ? calcularCompletitud(perfil) : null
  const sinOficios = oficios.length === 0

  const filtradas = useMemo(() => {
    if (verTodas || sinOficios) return solicitudes
    return solicitudes.filter((s) => oficios.includes(s.oficioId))
  }, [solicitudes, oficios, verTodas, sinOficios])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Explorar solicitudes</h1>
        <p className="mt-1 text-muted">Encontrá trabajos que coincidan con tus oficios.</p>
      </div>

      {completitud && !completitud.completo && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="font-bold text-warning">Tu perfil está incompleto</p>
          <p className="mt-1 text-sm text-muted">
            Para postularte necesitás descripción, ubicación y al menos un oficio.
          </p>
          <Link to="/trabajador/perfil" className="mt-3 block sm:inline-block">
            <Button variante="outline" className="w-full sm:w-auto">
              Completar perfil
            </Button>
          </Link>
        </Card>
      )}

      {/* Filtro */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setVerTodas(false)}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${
            !verTodas ? 'bg-primary text-white' : 'border border-line bg-surface text-muted'
          }`}
        >
          Mis oficios
        </button>
        <button
          type="button"
          onClick={() => setVerTodas(true)}
          className={`rounded-full px-4 py-2 text-sm font-bold transition ${
            verTodas ? 'bg-primary text-white' : 'border border-line bg-surface text-muted'
          }`}
        >
          Ver todas
        </button>
      </div>

      {cargando ? (
        <div className="flex justify-center py-12 text-primary">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filtradas.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-bold text-ink">
            {sinOficios
              ? 'Todavía no elegiste oficios'
              : verTodas
                ? 'No hay solicitudes abiertas'
                : 'No hay solicitudes para tus oficios'}
          </p>
          <p className="mt-1 text-sm text-muted">
            {sinOficios
              ? 'Agregá tus oficios en tu perfil para ver trabajos.'
              : 'Probá con "Ver todas" o volvé más tarde.'}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {filtradas.map((s) => (
            <TarjetaOferta key={s.id} solicitud={s} />
          ))}
        </div>
      )}
    </div>
  )
}
