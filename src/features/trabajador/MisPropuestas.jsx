import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import * as propuestasRepo from '@/lib/data/propuestas.repo.js'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'
import TarjetaPropuesta from './TarjetaPropuesta.jsx'

export default function MisPropuestas() {
  const { usuario } = useAuth()
  const [propuestas, setPropuestas] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    propuestasRepo
      .listarPorTrabajador(usuario.id)
      .then((data) => activo && setPropuestas(data))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [usuario.id])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Mis propuestas</h1>
        <p className="mt-1 text-muted">Seguí el estado de lo que enviaste.</p>
      </div>

      {cargando ? (
        <div className="flex justify-center py-12 text-primary">
          <Spinner className="h-8 w-8" />
        </div>
      ) : propuestas.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-bold text-ink">Todavía no enviaste propuestas</p>
          <p className="mt-1 text-sm text-muted">
            Explorá las solicitudes abiertas y postulate al que más te sirva.
          </p>
          <Link to="/trabajador/explorar" className="mt-4 block sm:inline-block">
            <Button className="w-full sm:w-auto">Explorar solicitudes</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {propuestas.map((p) => (
            <TarjetaPropuesta key={p.id} propuesta={p} />
          ))}
        </div>
      )}
    </div>
  )
}
