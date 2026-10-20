import { supabase } from '@/lib/supabase.js'

/**
 * Perfil profesional del trabajador contra `perfiles_trabajador` +
 * la relación `trabajador_oficios`.
 */

export async function obtener(usuarioId) {
  const { data: perfil, error } = await supabase
    .from('perfiles_trabajador')
    .select('descripcion, experiencia, ubicacion')
    .eq('id', usuarioId)
    .maybeSingle()
  if (error) throw error

  const { data: relaciones, error: errRel } = await supabase
    .from('trabajador_oficios')
    .select('oficio_id')
    .eq('trabajador_id', usuarioId)
  if (errRel) throw errRel

  return {
    usuarioId,
    descripcion: perfil?.descripcion ?? '',
    experiencia: perfil?.experiencia ?? '',
    ubicacion: perfil?.ubicacion ?? '',
    oficios: (relaciones ?? []).map((r) => r.oficio_id),
  }
}

export async function guardar(usuarioId, { descripcion, experiencia, ubicacion, oficios = [] }) {
  const { error } = await supabase
    .from('perfiles_trabajador')
    .upsert({ id: usuarioId, descripcion, experiencia, ubicacion })
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
}
