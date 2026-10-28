import { supabase } from '@/lib/supabase.js'
import { urlPublica } from './almacenamiento.js'

/**
 * Repositorio de propuestas contra Supabase.
 * La creación pasa por la RPC `enviar_propuesta`, que valida el estado de la
 * solicitud y la completitud del perfil del trabajador.
 */
export async function enviar({ solicitudId, descripcion, presupuesto }) {
  const { data, error } = await supabase.rpc('enviar_propuesta', {
    p_solicitud_id: solicitudId,
    p_descripcion: descripcion,
    p_presupuesto: presupuesto,
  })
  if (error) throw error
  return data
}

export async function listarPorTrabajador(trabajadorId) {
  const { data, error } = await supabase
    .from('propuestas')
    .select(
      'id, solicitud_id, descripcion, presupuesto, estado, created_at, solicitudes(titulo, ubicacion, estado, oficios(nombre))',
    )
    .eq('trabajador_id', trabajadorId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((p) => ({
    id: p.id,
    solicitudId: p.solicitud_id,
    descripcion: p.descripcion,
    presupuesto: p.presupuesto,
    estado: p.estado,
    createdAt: p.created_at,
    solicitudTitulo: p.solicitudes?.titulo ?? '',
    solicitudUbicacion: p.solicitudes?.ubicacion ?? '',
    solicitudEstado: p.solicitudes?.estado ?? '',
    oficioNombre: p.solicitudes?.oficios?.nombre ?? '',
  }))
}

export async function listarPorSolicitud(solicitudId) {
  const { data, error } = await supabase
    .from('propuestas')
    .select(
      'id, descripcion, presupuesto, estado, created_at, trabajador_id, trabajador:perfiles!propuestas_trabajador_id_fkey(nombre, apellido, avatar_path, trabajador_oficios(oficio_id))',
    )
    .eq('solicitud_id', solicitudId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((p) => ({
    id: p.id,
    descripcion: p.descripcion,
    presupuesto: p.presupuesto,
    estado: p.estado,
    createdAt: p.created_at,
    trabajadorId: p.trabajador_id,
    trabajadorNombre: p.trabajador?.nombre ?? '',
    trabajadorApellido: p.trabajador?.apellido ?? '',
    trabajadorAvatar: p.trabajador?.avatar_path
      ? urlPublica('avatares', p.trabajador.avatar_path)
      : null,
    trabajadorOficios: (p.trabajador?.trabajador_oficios ?? []).map((r) => r.oficio_id),
  }))
}

/** Cantidad de propuestas que recibió una solicitud (público). */
export async function postulantesDe(solicitudId) {
  const { data, error } = await supabase.rpc('postulantes_de', { p_solicitud_id: solicitudId })
  if (error) throw error
  return data ?? 0
}

/** Propuesta del trabajador para una solicitud, si existe. */
export async function miPropuesta(solicitudId, trabajadorId) {
  const { data, error } = await supabase
    .from('propuestas')
    .select('id, descripcion, presupuesto, estado, created_at')
    .eq('solicitud_id', solicitudId)
    .eq('trabajador_id', trabajadorId)
    .maybeSingle()
  if (error) throw error
  return data
}
