import { supabase } from '@/lib/supabase.js'

const SELECT =
  '*, actor:perfiles!auditoria_usuario_id_fkey(id, nombre, apellido, rol, es_superadmin)'

const POR_PAGINA = 50

/**
 * Eventos de auditoría visibles según la RLS:
 * admin → acciones de clientes/trabajadores; superadmin → todas.
 * Devuelve ${POR_PAGINA} eventos por página, más recientes primero.
 */
export async function listar({
  usuarioId = '',
  tabla = '',
  desde = '',
  hasta = '',
  offset = 0,
} = {}) {
  let query = supabase
    .from('auditoria')
    .select(SELECT)
    .order('created_at', { ascending: false })
    .range(offset, offset + POR_PAGINA - 1)

  if (usuarioId) query = query.eq('usuario_id', usuarioId)
  if (tabla) query = query.eq('tabla', tabla)
  if (desde) query = query.gte('created_at', `${desde}T00:00:00`)
  if (hasta) query = query.lte('created_at', `${hasta}T23:59:59.999`)

  const { data, error } = await query
  if (error) throw error

  return (data ?? []).map((e) => ({
    id: e.id,
    actorId: e.usuario_id,
    actorNombre: `${e.actor?.nombre ?? ''} ${e.actor?.apellido ?? ''}`.trim() || 'Usuario',
    actorRol: e.actor?.rol ?? '',
    esSuperadmin: Boolean(e.actor?.es_superadmin),
    accion: e.accion,
    tabla: e.tabla,
    registroId: e.registro_id,
    detalle: e.detalle ?? {},
    createdAt: e.created_at,
  }))
}

export { POR_PAGINA }
