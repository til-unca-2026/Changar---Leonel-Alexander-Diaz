import { supabase } from '@/lib/supabase.js'

/**
 * Repositorio de oficios contra la tabla `oficios`.
 * La RLS ya limita lo visible: activos para todos, y los pendientes propios
 * (o todos si el usuario es admin).
 */

/** Catálogo público: oficios activos. */
export async function listar() {
  const { data, error } = await supabase
    .from('oficios')
    .select('id, nombre')
    .eq('estado', 'activo')
    .order('nombre')
  if (error) throw error
  return data ?? []
}

/** Oficios visibles para el trabajador (activos + propios pendientes). */
export async function listarParaTrabajador() {
  const { data, error } = await supabase
    .from('oficios')
    .select('id, nombre, estado')
    .order('nombre')
  if (error) throw error
  return data ?? []
}

/** Sugerencias difusas para atrapar typos. */
export async function sugerir(query) {
  const { data, error } = await supabase.rpc('buscar_oficios', { p_query: query })
  if (error) throw error
  return data ?? []
}

/**
 * Crea un oficio (pendiente) o devuelve el existente con el mismo nombre
 * normalizado. Devuelve el oficio resultante.
 */
export async function crearPendiente(nombre) {
  const { data: id, error } = await supabase.rpc('crear_oficio', { p_nombre: nombre })
  if (error) throw error

  const { data, error: errGet } = await supabase
    .from('oficios')
    .select('id, nombre, estado')
    .eq('id', id)
    .single()
  if (errGet) throw errGet
  return data
}

/** Listado completo para el panel de administración (RLS deja ver todo al admin). */
export async function listarTodos() {
  const { data, error } = await supabase
    .from('oficios')
    .select('id, nombre, estado, creado_por, created_at')
    .order('estado')
    .order('nombre')
  if (error) throw error
  return data ?? []
}

/** Aprueba o rechaza un oficio pendiente. */
export async function aprobar(oficioId, aprobar) {
  const { error } = await supabase.rpc('admin_aprobar_oficio', {
    p_oficio_id: oficioId,
    p_aprobar: aprobar,
  })
  if (error) throw error
}

/** Fusiona un oficio duplicado en otro. */
export async function fusionar(origen, destino) {
  const { error } = await supabase.rpc('admin_fusionar_oficios', {
    p_origen: origen,
    p_destino: destino,
  })
  if (error) throw error
}
