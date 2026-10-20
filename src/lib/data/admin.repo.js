import { supabase } from '@/lib/supabase.js'

/** Métricas del dashboard de administración. */
export async function metricas() {
  const { data, error } = await supabase.rpc('admin_metricas')
  if (error) throw error
  return data
}
