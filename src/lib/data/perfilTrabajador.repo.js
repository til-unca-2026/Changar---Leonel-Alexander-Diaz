import { supabase } from '@/lib/supabase.js'

/**
 * Perfil profesional del trabajador contra `perfiles_trabajador` +
 * la relación `trabajador_oficios`.
 */

export async function obtener(usuarioId) {
  const { data: perfil, error } = await supabase
    .from('perfiles_trabajador')
    .select('descripcion, experiencia, ubicacion, latitud, longitud, radio_km')
    .eq('id', usuarioId)
    .maybeSingle()
  if (error) throw error

  const { data: relaciones, error: errRel } = await supabase
    .from('trabajador_oficios')
    .select('oficio_id')
    .eq('trabajador_id', usuarioId)
  if (errRel) throw errRel

  const { data: subareas, error: errSub } = await supabase
    .from('trabajador_subareas')
    .select('subarea_id, oficio_subareas(oficio_id)')
    .eq('trabajador_id', usuarioId)
  if (errSub) throw errSub

  return {
    usuarioId,
    descripcion: perfil?.descripcion ?? '',
    experiencia: perfil?.experiencia ?? '',
    ubicacion: perfil?.ubicacion ?? '',
    latitud: perfil?.latitud ?? null,
    longitud: perfil?.longitud ?? null,
    radioKm: perfil?.radio_km ?? 10,
    oficios: (relaciones ?? []).map((r) => r.oficio_id),
    subareas: (subareas ?? []).map((s) => ({
      id: s.subarea_id,
      oficioId: s.oficio_subareas?.oficio_id ?? '',
    })),
  }
}

export async function guardar(
  usuarioId,
  {
    descripcion,
    experiencia,
    ubicacion,
    latitud = null,
    longitud = null,
    radioKm = 10,
    oficios = [],
    subareas = [],
  },
) {
  const { error } = await supabase.from('perfiles_trabajador').upsert({
    id: usuarioId,
    descripcion,
    experiencia,
    ubicacion,
    latitud,
    longitud,
    radio_km: radioKm,
  })
  if (error) throw error

  // Reemplazar las relaciones de oficios por el conjunto actual.
  const { error: errDel } = await supabase
    .from('trabajador_oficios')
    .delete()
    .eq('trabajador_id', usuarioId)
  if (errDel) throw errDel

  if (oficios.length > 0) {
    const filas = oficios.map((oficio_id) => ({ trabajador_id: usuarioId, oficio_id }))
    const { error: errIns } = await supabase.from('trabajador_oficios').insert(filas)
    if (errIns) throw errIns
  }

  // Las subáreas se validan contra los oficios recién guardados.
  const { error: errDelSub } = await supabase
    .from('trabajador_subareas')
    .delete()
    .eq('trabajador_id', usuarioId)
  if (errDelSub) throw errDelSub

  const idsSubareas = [...new Set(subareas.map((s) => (typeof s === 'string' ? s : s.id)))]
  if (idsSubareas.length > 0) {
    const { error: errInsSub } = await supabase.from('trabajador_subareas').insert(
      idsSubareas.map((subarea_id) => ({ trabajador_id: usuarioId, subarea_id })),
    )
    if (errInsSub) throw errInsSub
  }
}
