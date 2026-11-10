import { useEffect, useState } from 'react'
import { useOficios } from '@/hooks/useSolicitudes.js'
import * as perfilesRepo from '@/lib/data/perfiles.repo.js'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import Select from '@/components/ui/Select.jsx'
import Spinner from '@/components/ui/Spinner.jsx'
import TarjetaProfesional from './TarjetaProfesional.jsx'

export default function Explorar() {
  const oficios = useOficios()
  const [query, setQuery] = useState('')
  const [oficioId, setOficioId] = useState('')
  const [zona, setZona] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    setCargando(true)
    const timer = setTimeout(() => {
      perfilesRepo
        .buscarTrabajadores({ query, oficioId, zona, minRating })
        .then((r) => activo && setResultados(r))
        .catch(() => activo && setResultados([]))
        .finally(() => activo && setCargando(false))
    }, 300)
    return () => {
      activo = false
      clearTimeout(timer)
    }
  }, [query, oficioId, zona, minRating])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Buscar profesional</h1>
        <p className="mt-1 text-muted">
          Encontrá trabajadores con perfil completo y enviales una solicitud directa.
        </p>
      </div>

      <Card className="space-y-3">
        <Input
          placeholder="Buscar por nombre, oficio o zona…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <Select value={oficioId} onChange={(e) => setOficioId(e.target.value)}>
            <option value="">Todos los oficios</option>
            {oficios.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </Select>
          <Input
            placeholder="Zona"
            value={zona}
            onChange={(e) => setZona(e.target.value)}
          />
          <Select value={minRating} onChange={(e) => setMinRating(Number(e.target.value))}>
            <option value={0}>Cualquier valoración</option>
            <option value={1}>1★ o más</option>
            <option value={2}>2★ o más</option>
            <option value={3}>3★ o más</option>
            <option value={4}>4★ o más</option>
            <option value={5}>5★</option>
          </Select>
        </div>
      </Card>

      {cargando ? (
        <div className="flex justify-center py-12 text-primary">
          <Spinner className="h-8 w-8" />
        </div>
      ) : resultados.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-semibold text-ink">No encontramos profesionales</p>
          <p className="mt-1 text-sm text-muted">
            Probá con otros filtros. Solo mostramos quienes tienen el perfil completo.
          </p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted">
            {resultados.length} {resultados.length === 1 ? 'profesional' : 'profesionales'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {resultados.map((p) => (
              <TarjetaProfesional key={p.id} perfil={p} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
