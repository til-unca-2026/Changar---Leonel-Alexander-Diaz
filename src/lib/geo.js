import { normalizar } from './texto.js'

/**
 * Utilidades de geolocalización con OpenStreetMap.
 *
 * - Nominatim se usa para buscar zonas y hacer geocodificación inversa.
 * - Se respeta el límite de 1 request por segundo del servicio público:
 *   las consultas se encolan y se cachean.
 * - Para producción con mucho tráfico conviene self-hostear Nominatim o usar
 *   otro proveedor; el endpoint público no está pensado para uso masivo.
 */

const NOMINATIM_URL = (
  import.meta.env.VITE_NOMINATIM_URL || 'https://nominatim.openstreetmap.org'
).replace(/\/+$/, '')

const NOMINATIM_EMAIL = import.meta.env.VITE_NOMINATIM_EMAIL || ''
// Códigos ISO de países para priorizar resultados (vacío = sin filtro).
const NOMINATIM_PAISES = import.meta.env.VITE_NOMINATIM_PAISES ?? 'ar'
const INTERVALO_MINIMO_MS = 1100
const CENTRO_POR_DEFECTO = { lat: -34.6037, lng: -58.3816 }

let ultimaConsulta = 0
let cola = Promise.resolve()

const cacheBusquedas = new Map()
const cacheReversas = new Map()

function enCola(tarea) {
  const siguiente = cola.then(async () => {
    const espera = Math.max(0, INTERVALO_MINIMO_MS - (Date.now() - ultimaConsulta))
    if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera))
    try {
      return await tarea()
    } finally {
      ultimaConsulta = Date.now()
    }
  })

  // Una consulta fallida no debe bloquear las siguientes.
  cola = siguiente.catch(() => {})
  return siguiente
}

async function pedirJson(url, signal) {
  const res = await fetch(url, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('geocodificacion_no_disponible')
  return res.json()
}

function nombreCorto(lugar) {
  const a = lugar.address ?? {}
  const local = [
    a.neighbourhood,
    a.suburb,
    a.city_district,
    a.town,
    a.village,
  ]
    .filter(Boolean)
    .map((parte) => parte.trim())
    .find(Boolean)

  const region = [a.city, a.municipality, a.state, a.county]
    .filter(Boolean)
    .map((parte) => parte.trim())
    .find(Boolean)

  if (local && region && normalizar(local) !== normalizar(region)) {
    return `${local}, ${region}`
  }
  if (local || region) return local || region

  return (
    lugar.name ||
    (lugar.display_name ? lugar.display_name.split(',')[0].trim() : '') ||
    'Ubicación'
  )
}

function mapearLugar(lugar) {
  const lat = Number(lugar.lat)
  const lng = Number(lugar.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  return {
    id: `${lugar.osm_type ?? 'lugar'}-${lugar.osm_id ?? lugar.place_id ?? `${lat},${lng}`}`,
    nombre: nombreCorto(lugar),
    displayName: lugar.display_name ?? '',
    lat,
    lng,
  }
}

function paramsBase() {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'es',
  })
  if (NOMINATIM_EMAIL) params.set('email', NOMINATIM_EMAIL)
  return params
}

/** Busca zonas/direcciones. Devuelve entre 0 y 5 resultados. */
export async function buscarLugares(query, { signal } = {}) {
  const texto = query?.trim()
  if (!texto || texto.length < 3) return []

  const clave = normalizar(texto)
  if (cacheBusquedas.has(clave)) return cacheBusquedas.get(clave)

  const params = paramsBase()
  params.set('q', texto)
  params.set('limit', '5')
  params.set('dedupe', '1')
  if (NOMINATIM_PAISES) params.set('countrycodes', NOMINATIM_PAISES)

  const datos = await enCola(() =>
    pedirJson(`${NOMINATIM_URL}/search?${params.toString()}`, signal),
  )

  const resultados = (Array.isArray(datos) ? datos : [])
    .map(mapearLugar)
    .filter(Boolean)

  cacheBusquedas.set(clave, resultados)
  return resultados
}

/** Geocodificación inversa: obtiene una zona legible a partir de un punto. */
export async function reverseGeocodificar(lat, lng, { signal } = {}) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null

  const clave = `${lat.toFixed(3)},${lng.toFixed(3)}`
  if (cacheReversas.has(clave)) return cacheReversas.get(clave)

  const params = paramsBase()
  params.set('lat', String(lat))
  params.set('lon', String(lng))
  params.set('zoom', '16')

  const dato = await enCola(() =>
    pedirJson(`${NOMINATIM_URL}/reverse?${params.toString()}`, signal),
  )

  if (!dato || dato.error) {
    cacheReversas.set(clave, null)
    return null
  }

  const resultado = mapearLugar(dato)
  cacheReversas.set(clave, resultado)
  return resultado
}

/** Redondea a ~100-150 m para no exponer el domicilio exacto del cliente. */
export function aproximarCoordenadas(lat, lng) {
  const numeroLat = numeroCoordenada(lat)
  const numeroLng = numeroCoordenada(lng)
  if (numeroLat == null || numeroLng == null) {
    return { lat: null, lng: null }
  }
  return {
    lat: Number(numeroLat.toFixed(3)),
    lng: Number(numeroLng.toFixed(3)),
  }
}

function numeroCoordenada(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const numero = Number(valor)
  return Number.isFinite(numero) ? numero : null
}

/** Distancia Haversine en kilómetros. */
export function distanciaKm(a, b) {
  if (!a || !b) return null
  const lat1 = numeroCoordenada(a.lat)
  const lng1 = numeroCoordenada(a.lng)
  const lat2 = numeroCoordenada(b.lat)
  const lng2 = numeroCoordenada(b.lng)
  if ([lat1, lng1, lat2, lng2].some((valor) => valor == null)) return null

  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2

  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
}

/**
 * Compara la zona elegida con la zona del perfil.
 * Si hay coordenadas en ambos lados usa distancia; si no, compara el texto.
 */
export function mismaZona(a, b, { umbralKm = 2 } = {}) {
  const textoA = normalizar(a?.texto ?? '')
  const textoB = normalizar(b?.texto ?? '')
  const distancia = distanciaKm(a, b)

  if (distancia != null) return distancia <= umbralKm
  if (!textoA && !textoB) return true
  if (!textoA || !textoB) return false
  return textoA === textoB
}

export function formatearDistancia(km) {
  const numero = numeroCoordenada(km)
  if (numero == null) return ''
  if (numero < 1) return `${Math.round(numero * 1000)} m`
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(numero)} km`
}

export { CENTRO_POR_DEFECTO }
