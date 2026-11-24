/** Moneda ARS, ej: 15000 -> "$ 15.000" */
export function formatearPesos(valor) {
  if (valor === null || valor === undefined || valor === '') return 'Sin definir'
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(Number(valor))
}

/** Fecha y hora completa en formato local, p. ej. "24/11/2026, 14:35". */
export function fechaHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Fecha relativa simple: "Hace 2 días", "Hoy". */
export function fechaRelativa(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Recién'
  if (min < 60) return `Hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `Hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(horas / 24)
  if (dias === 1) return 'Ayer'
  return `Hace ${dias} días`
}
