/**
 * Utilidades para contactarse por teléfono/WhatsApp.
 *
 * wa.me necesita el número en formato internacional, solo dígitos.
 * Como ChangAr se usa en Argentina, los formatos locales se interpretan así:
 *   "+54 11 5824-9102" / "5411..."      → internacional, se toma tal cual.
 *   "011 15 4444-4444" (celular)        → 549 + área + abonado (se quita el 15).
 *   "011 4444-4444" (fijo con 0)        → 54 + área + abonado.
 *   "341 15 512 3456" (celular sin 0)   → 549 + área + abonado.
 * Cualquier otra cosa no se puede normalizar: la UI cae a un link `tel:`.
 */

/** El área argentina empieza con 11 (CABA) o con 2/3 (interior). */
function esAreaArgentina(digitos) {
  return digitos.startsWith('11') || ['2', '3'].includes(digitos[0])
}

/**
 * Si es un celular argentino, el prefijo "15" va pegado al área (2-4 dígitos).
 * Devuelve el número internacional (549 + área + abonado sin 15) o null.
 */
function celularArgentina(resto) {
  if (!esAreaArgentina(resto)) return null
  // CABA es área de 2 dígitos (11); el interior usa 3 o 4.
  const largos = resto.startsWith('11') ? [2] : [3, 4]
  for (const largo of largos) {
    const area = resto.slice(0, largo)
    const ab = resto.slice(largo)
    if (ab.startsWith('15') && ab.length > 2) {
      return `549${area}${ab.slice(2)}`
    }
  }
  return null
}

/** Devuelve el número internacional para wa.me, o null si no se reconoce. */
export function normalizarTelefonoWhatsapp(telefono) {
  const texto = String(telefono ?? '').trim()
  const digitos = texto.replace(/\D/g, '')
  if (digitos.length < 6) return null

  // Ya escrito en formato internacional.
  if (texto.startsWith('+')) return digitos

  // Internacional sin el signo "+" (empieza con el código país 54).
  if (digitos.startsWith('54')) return digitos

  const resto = digitos.startsWith('0') ? digitos.slice(1) : digitos
  if (!esAreaArgentina(resto)) return null

  const celular = celularArgentina(resto)
  if (celular) return celular

  // Fijo: 54 + área + abonado.
  if (resto.length >= 9 && resto.length <= 12) return `54${resto}`
  return null
}

/** Link deep-link de WhatsApp, o null si el número no se puede normalizar. */
export function linkWhatsApp(telefono, mensaje = '') {
  const numero = normalizarTelefonoWhatsapp(telefono)
  if (!numero) return null
  const texto = mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''
  return `https://wa.me/${numero}${texto}`
}

/** Link de marcado como respaldo (tel:), o null si no hay nada marcable. */
export function linkTelefono(telefono) {
  const texto = String(telefono ?? '').trim()
  if (!texto) return null
  if (texto.startsWith('+')) return `tel:${texto.replace(/\s/g, '')}`
  const digitos = texto.replace(/\D/g, '')
  return digitos ? `tel:${digitos}` : null
}
