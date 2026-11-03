import { supabase } from '@/lib/supabase.js'

/** Repositorio de notificaciones in-app. */

export async function listar(usuarioId) {
  const { data, error } = await supabase
    .from('notificaciones')
    .select('id, tipo, referencia_id, leida, created_at')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

export async function noLeidas(usuarioId) {
  const { count, error } = await supabase
    .from('notificaciones')
    .select('id', { count: 'exact', head: true })
    .eq('usuario_id', usuarioId)
    .eq('leida', false)
  if (error) throw error
  return count ?? 0
}

export async function marcarLeida(id) {
  const { error } = await supabase.from('notificaciones').update({ leida: true }).eq('id', id)
  if (error) throw error
}

export async function marcarTodas(usuarioId) {
  const { error } = await supabase
    .from('notificaciones')
    .update({ leida: true })
    .eq('usuario_id', usuarioId)
    .eq('leida', false)
  if (error) throw error
}
