import { supabase } from '@/lib/supabase.js'

/**
 * Datos propios del cliente contra `perfiles_cliente`.
 * Corresponde a la zona (no dirección) y una descripción breve.
 */

export async function obtener(usuarioId) {
  const { data, error } = await supabase
    .from('perfiles_cliente')
    .select('zona, descripcion, latitud, longitud')
    .eq('id', usuarioId)
    .maybeSingle()
  if (error) throw error
  return {
    zona: data?.zona ?? '',
    descripcion: data?.descripcion ?? '',
    latitud: data?.latitud ?? null,
    longitud: data?.longitud ?? null,
  }
}

export async function guardar(usuarioId, { zona, descripcion, latitud = null, longitud = null }) {
  const { error } = await supabase.from('perfiles_cliente').upsert({
    id: usuarioId,
    zona: zona?.trim() ?? '',
    descripcion: descripcion?.trim() ?? '',
    latitud,
    longitud,
  })
  if (error) throw error
}
