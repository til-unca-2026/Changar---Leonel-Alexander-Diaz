import { useEffect, useId, useRef, useState } from 'react'
import L from 'leaflet'
import {
  CENTRO_POR_DEFECTO,
  aproximarCoordenadas,
  buscarLugares,
  reverseGeocodificar,
} from '@/lib/geo.js'

const ATRIBUCION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const ICONO_PUNTO = L.divIcon({
  className: '',
  html:
    '<span style="display:block;width:18px;height:18px;border-radius:9999px;' +
    'background:#2563eb;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function coordenadas(valor) {
  if (valor?.lat == null || valor?.lng == null || valor.lat === '' || valor.lng === '') {
    return null
  }
  const lat = Number(valor.lat)
  const lng = Number(valor.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

export default function MapaUbicacion({
  valor = {},
  onChange = () => {},
  label,
  ayuda,
  altura = 'h-64',
  soloLectura = false,
  modo = 'aproximado',
  radioKm = null,
  mostrarBuscador = true,
  mostrarGeolocalizacion = true,
  placeholder = 'Buscar barrio, ciudad o dirección…',
}) {
  const idBusqueda = useId()
  const contenedorRef = useRef(null)
  const mapaRef = useRef(null)
  const capaRef = useRef(null)
  const centroRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const valorRef = useRef(valor)
  const reverseId = useRef(0)

  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState('')
  const [geolocalizando, setGeolocalizando] = useState(false)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    valorRef.current = valor
  }, [valor])

  async function elegirPunto(lat, lng, textoInicial) {
    const aprox = aproximarCoordenadas(lat, lng)
    const actual = valorRef.current ?? {}
    onChangeRef.current({
      ...actual,
      texto: textoInicial || actual.texto || 'Ubicación seleccionada',
      lat: aprox.lat,
      lng: aprox.lng,
    })

    const id = ++reverseId.current
    try {
      const lugar = await reverseGeocodificar(aprox.lat, aprox.lng)
      if (id !== reverseId.current || !lugar) return
      onChangeRef.current({
        ...(valorRef.current ?? {}),
        texto: lugar.nombre,
        lat: aprox.lat,
        lng: aprox.lng,
      })
    } catch {
      // Si falla la geocodificación inversa, queda el texto genérico.
    }
  }

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    if (!contenedorRef.current || mapaRef.current) return undefined

    const inicial = coordenadas(valorRef.current) ?? CENTRO_POR_DEFECTO
    const mapa = L.map(contenedorRef.current, {
      center: [inicial.lat, inicial.lng],
      zoom: coordenadas(valorRef.current) ? 14 : 11,
      scrollWheelZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: ATRIBUCION,
    }).addTo(mapa)

    if (!soloLectura) {
      mapa.on('click', (evento) => {
        elegirPunto(evento.latlng.lat, evento.latlng.lng)
      })
    }

    mapaRef.current = mapa
    const timer = setTimeout(() => mapa.invalidateSize(), 120)

    return () => {
      clearTimeout(timer)
      mapa.remove()
      mapaRef.current = null
      capaRef.current = null
      centroRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [soloLectura])

  // Dibuja el círculo/marcador y centra el mapa cuando cambian las coordenadas.
  useEffect(() => {
    const mapa = mapaRef.current
    if (!mapa) return

    if (capaRef.current) {
      capaRef.current.remove()
      capaRef.current = null
    }

    const punto = coordenadas(valor)
    if (!punto) return

    const capa = L.layerGroup().addTo(mapa)

    if (modo === 'punto') {
      if (Number(radioKm) > 0) {
        L.circle([punto.lat, punto.lng], {
          radius: Number(radioKm) * 1000,
          color: '#2563eb',
          weight: 1,
          fillColor: '#2563eb',
          fillOpacity: 0.08,
        }).addTo(capa)
      }
      L.marker([punto.lat, punto.lng], { icon: ICONO_PUNTO }).addTo(capa)
    } else {
      L.circle([punto.lat, punto.lng], {
        radius: 300,
        color: '#2563eb',
        weight: 1,
        fillColor: '#2563eb',
        fillOpacity: 0.16,
      }).addTo(capa)
    }

    capaRef.current = capa

    const anterior = centroRef.current
    if (!anterior || anterior.lat !== punto.lat || anterior.lng !== punto.lng) {
      mapa.setView([punto.lat, punto.lng], Math.max(mapa.getZoom(), 13))
      centroRef.current = punto
    }
  }, [valor?.lat, valor?.lng, modo, radioKm])

  // Búsqueda con debounce y cancelación de consultas viejas.
  useEffect(() => {
    if (soloLectura || !mostrarBuscador) return undefined

    const texto = query.trim()
    if (texto.length < 3) {
      setResultados([])
      setBuscando(false)
      return undefined
    }

    const controller = new AbortController()
    setBuscando(true)
    setError('')

    const timer = setTimeout(() => {
      buscarLugares(texto, { signal: controller.signal })
        .then((lista) => {
          setResultados(lista)
          setAbierto(true)
        })
        .catch((err) => {
          if (err?.name !== 'AbortError') {
            setError('No pudimos buscar esa zona. Probá de nuevo o hacé clic en el mapa.')
          }
        })
        .finally(() => setBuscando(false))
    }, 850)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, soloLectura, mostrarBuscador])

  function elegirLugar(lugar) {
    setQuery('')
    setResultados([])
    setAbierto(false)
    const aprox = aproximarCoordenadas(lugar.lat, lugar.lng)
    onChangeRef.current({
      ...(valorRef.current ?? {}),
      texto: lugar.nombre,
      lat: aprox.lat,
      lng: aprox.lng,
    })
  }

  function usarMiUbicacion() {
    setError('')
    if (!navigator.geolocation) {
      setError('Tu navegador no permite obtener la ubicación.')
      return
    }

    setGeolocalizando(true)
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        elegirPunto(posicion.coords.latitude, posicion.coords.longitude).finally(() =>
          setGeolocalizando(false),
        )
      },
      (err) => {
        setGeolocalizando(false)
        setError(
          err?.code === 1
            ? 'No diste permiso para usar tu ubicación. Buscala manualmente.'
            : 'No pudimos obtener tu ubicación. Buscala manualmente.',
        )
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    )
  }

  return (
    <div>
      {label && (
        <label
          htmlFor={soloLectura ? undefined : idBusqueda}
          className="mb-1.5 block text-sm font-semibold text-ink"
        >
          {label}
        </label>
      )}

      {/* `isolate` confina el z-index interno de Leaflet (400-1000) dentro del
          mapa; sin eso pisa el header sticky (z-30) al scrollear. */}
      <div className="relative isolate overflow-hidden rounded-xl border border-line">
        <div ref={contenedorRef} className={`${altura} w-full`} />
      </div>

      {!soloLectura && mostrarBuscador && (
        <div className="relative z-20 mt-2">
          <input
            id={idBusqueda}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setAbierto(true)
            }}
            onFocus={() => setAbierto(true)}
            placeholder={valor?.texto || placeholder}
            className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition placeholder:text-muted/70 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />

          {abierto && query.trim().length >= 3 && (
            <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-lg">
              {buscando ? (
                <p className="px-4 py-3 text-sm text-muted">Buscando…</p>
              ) : resultados.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">
                  Sin resultados. Probá con otro nombre o hacé clic en el mapa.
                </p>
              ) : (
                resultados.map((lugar) => (
                  <button
                    key={lugar.id}
                    type="button"
                    onClick={() => elegirLugar(lugar)}
                    className="block w-full border-b border-line px-4 py-2.5 text-left last:border-0 hover:bg-canvas"
                  >
                    <span className="block text-sm font-semibold text-ink">{lugar.nombre}</span>
                    <span className="block truncate text-xs text-muted">{lugar.displayName}</span>
                  </button>
                ))
              )}
            </div>
          )}

          {abierto && query.trim().length >= 3 && (
            <button
              type="button"
              aria-hidden="true"
              tabIndex={-1}
              className="fixed inset-0 z-10 cursor-default"
              onClick={() => setAbierto(false)}
            />
          )}
        </div>
      )}

      {!soloLectura && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {mostrarGeolocalizacion && (
            <button
              type="button"
              onClick={usarMiUbicacion}
              disabled={geolocalizando}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink transition hover:border-primary hover:text-primary disabled:opacity-60"
            >
              {geolocalizando ? 'Ubicando…' : 'Usar mi ubicación'}
            </button>
          )}
          {valor?.texto && (
            <span className="rounded-full bg-primary-soft px-3 py-1.5 text-xs font-semibold text-primary">
              {valor.texto}
            </span>
          )}
        </div>
      )}

      {soloLectura && valor?.texto && (
        <p className="mt-2 text-sm text-muted">{valor.texto}</p>
      )}

      {ayuda && <p className="mt-2 text-xs text-muted">{ayuda}</p>}
      {error && <p className="mt-2 text-xs font-semibold text-danger">{error}</p>}
    </div>
  )
}
