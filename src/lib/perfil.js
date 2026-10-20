/**
 * Regla de completitud del perfil del trabajador (única fuente de verdad).
 * El perfil está completo con: descripción + ubicación + al menos 1 oficio.
 * La experiencia es opcional.
 */
export function calcularCompletitud(perfil) {
  const items = [
    { clave: 'descripcion', ok: Boolean(perfil?.descripcion?.trim()), texto: 'Descripción profesional' },
    { clave: 'ubicacion', ok: Boolean(perfil?.ubicacion?.trim()), texto: 'Ubicación' },
    { clave: 'oficios', ok: (perfil?.oficios?.length ?? 0) > 0, texto: 'Al menos un oficio' },
  ]
  const completados = items.filter((i) => i.ok).length
  const total = items.length
  return {
    items,
    completados,
    total,
    porcentaje: Math.round((completados / total) * 100),
    completo: completados === total,
  }
}
