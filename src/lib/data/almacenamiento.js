import { supabase } from '@/lib/supabase.js'

/** Utilidades de Supabase Storage para avatares y portfolio. */

function extension(nombre = '') {
  const partes = nombre.split('.')
  return partes.length > 1 ? partes.pop().toLowerCase() : 'jpg'
}

export async function subirAvatar(usuarioId, file) {
  const path = `${usuarioId}/avatar-${Date.now()}.${extension(file.name)}`
  const { error } = await supabase.storage
    .from('avatares')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  return path
}

export async function subirFotoPortfolio(usuarioId, file) {
  const path = `${usuarioId}/${crypto.randomUUID()}.${extension(file.name)}`
  const { error } = await supabase.storage
    .from('portfolio-fotos')
    .upload(path, file, { contentType: file.type })
  if (error) throw error
  return path
}

export async function subirFotoSolicitud(clienteId, solicitudId, file) {
  const path = `${clienteId}/${solicitudId}/${crypto.randomUUID()}.${extension(file.name)}`
  const { error } = await supabase.storage
    .from('solicitud-fotos')
    .upload(path, file, { contentType: file.type })
  if (error) throw error
  return path
}

export async function subirEvidencia(usuarioId, contratacionId, file) {
  const path = `${usuarioId}/${contratacionId}/${crypto.randomUUID()}.${extension(file.name)}`
  const { error } = await supabase.storage
    .from('contratacion-evidencias')
    .upload(path, file, { contentType: file.type })
  if (error) throw error
  return path
}

export async function subirFotoValoracion(usuarioId, file) {
  const path = `${usuarioId}/valoraciones/${crypto.randomUUID()}.${extension(file.name)}`
  const { error } = await supabase.storage
    .from('valoracion-fotos')
    .upload(path, file, { contentType: file.type })
  if (error) throw error
  return path
}

export async function eliminarArchivo(bucket, path) {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) throw error
}

export function urlPublica(bucket, path) {
  if (!path) return null
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}
