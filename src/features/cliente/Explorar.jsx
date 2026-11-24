import { useEffect, useState } from 'react'
import { useOficios } from '@/hooks/useSolicitudes.js'
import * as perfilesRepo from '@/lib/data/perfiles.repo.js'
import { aproximarCoordenadas } from '@/lib/geo.js'
import Button from '@/components/ui/Button.jsx'
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
  const [cerca, setCerca] = useState(null)
  const [radioKm, setRadioKm] = useState(10)
  const [ubicando, setUbicando] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [resultados, setResultados] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    setCargando(true)
    const timer = setTimeout(() => {
      perfilesRepo
        .buscarTrabajadores({
          query,
          oficioId,
          zona,
          minRating,
          lat: cerca?.lat ?? null,
          lng: cerca?.lng ?? null,
          radioKm: cerca ? radioKm : null,
        })
        .then((r) => activo && setResultados(r))
        .catch(() => activo && setResultados([]))
        .finally(() => activo && setCargando(false))
    }, 300)
    return () => {
      activo = false
      clearTimeout(timer)
    }
  }, [query, oficioId, zona, minRating, cerca, radioKm])

  function alternarCerca() {
    if (cerca) {
      setCerca(null)
      setGeoError('')
      return
    }
    setGeoError('')
    if (!navigator.geolocation) {
      setGeoError('Tu navegador no permite obtener la ubicación.')
      return
    }
    setUbicando(true)
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setCerca(
          aproximarCoordenadas(posicion.coords.latitude, posicion.coords.longitude),
        )
        setUbicando(false)
      },
      (err) => {
        setUbicando(false)
        setGeoError(
          err?.code === 1
            ? 'No diste permiso para usar tu ubicación. Podés buscar por zona.'
            : 'No pudimos obtener tu ubicación. Probá buscando por zona.',
        )
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

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

        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <Button
            variante={cerca ? 'primary' : 'outline'}
            className="w-auto"
            onClick={alternarCerca}
            disabled={ubicando}
          >
            {ubicando ? 'Ubicando…' : cerca ? '✓ Cerca de mí' : 'Cerca de mí'}
          </Button>
          {cerca && (
            <Select
              className="w-36"
              value={radioKm}
              onChange={(e) => setRadioKm(Number(e.target.value))}
            >
              <option value={5}>A 5 km</option>
              <option value={10}>A 10 km</option>
              <option value={20}>A 20 km</option>
              <option value={50}>A 50 km</option>
            </Select>
          )}
          {cerca && (
            <span className="text-xs text-muted">
              Mostramos profesionales que cubren tu zona, ordenados por cercanía.
            </span>
          )}
        </div>
        {geoError && <p className="text-xs font-semibold text-danger">{geoError}</p>}
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
              <TarjetaProfesional key={p.id} perfil={p} oficioFiltro={oficioId} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
