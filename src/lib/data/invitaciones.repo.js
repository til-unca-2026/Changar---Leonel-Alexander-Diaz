import { supabase } from '@/lib/supabase.js'

/**
 * Invitaciones de administrador.
 *
 * La consulta por token es pública: la hace el formulario de registro, que
 * corre sin sesión. El token es el factor de acceso; si no es válido la
 * función devuelve `null` y no se muestra el formulario de invitación.
 */
export async function porToken(token) {
  if (!token) return null
  const { data, error } = await supabase.rpc('invitacion_por_token', { p_token: token })
  if (error) throw error
  return data ?? null
}
