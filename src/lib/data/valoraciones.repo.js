import { supabase } from '@/lib/supabase.js'
import { subirFotoValoracion, urlPublica } from './almacenamiento.js'

/**
 * Repositorio de valoraciones contra Supabase.
 * La creación pasa por la RPC `enviar_valoracion`.
 */
const BUCKET = 'valoracion-fotos'

export async function enviar(contratacionId, { usuarioId, puntuacion, comentario, fotos = [] }) {
  const paths = []
  for (const foto of fotos) {
    if (!foto?.file) continue
    paths.push(await subirFotoValoracion(usuarioId, foto.file))
  }

  const { data: valoracionId, error } = await supabase.rpc('enviar_valoracion', {
    p_contratacion_id: contratacionId,
    p_puntuacion: puntuacion,
    p_comentario: comentario || null,
    p_fotos: paths,
  })
  if (error) throw error
  return valoracionId
}

/** Valoración que el usuario ya hizo para una contratación, si existe. */
export async function miValoracion(contratacionId, autorId) {
  const { data, error } = await supabase
    .from('valoraciones')
    .select('id, puntuacion, comentario, created_at')
    .eq('contratacion_id', contratacionId)
    .eq('autor_id', autorId)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Todas las valoraciones de una contratación (en ambas direcciones). */
export async function porContratacion(contratacionId) {
  const { data, error } = await supabase
    .from('valoraciones')
    .select('id, puntuacion, comentario, created_at, autor_id, destinatario_id, valoracion_fotos(storage_path)')
    .eq('contratacion_id', contratacionId)
  if (error) throw error

  return (data ?? []).map((v) => ({
    id: v.id,
    puntuacion: v.puntuacion,
    comentario: v.comentario ?? '',
    createdAt: v.created_at,
    autorId: v.autor_id,
    destinatarioId: v.destinatario_id,
    fotos: (v.valoracion_fotos ?? []).map((f) => ({
      path: f.storage_path,
      url: urlPublica(BUCKET, f.storage_path),
    })),
  }))
}

/** Reputación pública de un perfil (promedio, total, bajas, distribución). */
export async function reputacion(perfilId) {
  const { data, error } = await supabase.rpc('reputacion_de', { p_perfil_id: perfilId })
  if (error) throw error
  return {
    total: data?.total ?? 0,
    promedio: data?.promedio ?? 0,
    bajas: data?.bajas ?? 0,
    distribucion: data?.distribucion ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  }
}

/** Valoraciones recibidas por un perfil, con autor y fotos. */
export async function listarRecibidas(perfilId) {
  const { data, error } = await supabase
    .from('valoraciones')
    .select(
      'id, puntuacion, comentario, created_at, autor:perfiles!valoraciones_autor_id_fkey(nombre, apellido, avatar_path), valoracion_fotos(storage_path)',
    )
    .eq('destinatario_id', perfilId)
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).map((v) => ({
    id: v.id,
    puntuacion: v.puntuacion,
    comentario: v.comentario ?? '',
    createdAt: v.created_at,
    autorNombre: v.autor?.nombre ?? '',
    autorApellido: v.autor?.apellido ?? '',
    autorAvatar: v.autor?.avatar_path ? urlPublica('avatares', v.autor.avatar_path) : null,
    fotos: (v.valoracion_fotos ?? []).map((f) => ({
      path: f.storage_path,
      url: urlPublica(BUCKET, f.storage_path),
    })),
  }))
}
