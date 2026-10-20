import { supabase } from '@/lib/supabase.js'

/**
 * Datos propios del cliente contra `perfiles_cliente`.
 * Corresponde a la zona (no dirección) y una descripción breve.
 */

export async function obtener(usuarioId) {
  const { data, error } = await supabase
    .from('perfiles_cliente')
    .select('zona, descripcion')
    .eq('id', usuarioId)
    .maybeSingle()
  if (error) throw error
  return {
    zona: data?.zona ?? '',
    descripcion: data?.descripcion ?? '',
  }
}

export async function guardar(usuarioId, { zona, descripcion }) {
  const { error } = await supabase.from('perfiles_cliente').upsert({
    id: usuarioId,
    zona: zona?.trim() ?? '',
    descripcion: descripcion?.trim() ?? '',
  })
  if (error) throw error
}
