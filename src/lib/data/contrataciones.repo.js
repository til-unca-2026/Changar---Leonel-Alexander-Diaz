import { supabase } from '@/lib/supabase.js'
import { subirEvidencia, urlPublica } from './almacenamiento.js'

/**
 * Repositorio de contrataciones contra Supabase.
 * Las escrituras pasan por RPCs: aceptar_propuesta, confirmar_fin,
 * cancelar_contratacion y agregar_respuesta.
 */
const BUCKET = 'contratacion-evidencias'

const SELECT = `
  id, propuesta_id, cliente_id, trabajador_id, estado,
  cancelado_por, motivo_cancelacion, created_at, updated_at,
  cliente:perfiles!contrataciones_cliente_id_fkey(nombre, apellido, avatar_path),
  trabajador:perfiles!contrataciones_trabajador_id_fkey(nombre, apellido, avatar_path),
  propuestas!contrataciones_propuesta_id_fkey(presupuesto, solicitud_id, solicitudes(titulo, ubicacion, oficios(nombre)))
`

function persona(p) {
  return {
    nombre: p?.nombre ?? '',
    apellido: p?.apellido ?? '',
    avatarUrl: p?.avatar_path ? urlPublica('avatares', p.avatar_path) : null,
  }
}

function mapear(c) {
  const prop = c.propuestas ?? {}
  const sol = prop.solicitudes ?? {}
  return {
    id: c.id,
    propuestaId: c.propuesta_id,
    clienteId: c.cliente_id,
    trabajadorId: c.trabajador_id,
    estado: c.estado,
    canceladoPor: c.cancelado_por,
    motivoCancelacion: c.motivo_cancelacion,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    cliente: persona(c.cliente),
    trabajador: persona(c.trabajador),
    presupuesto: prop.presupuesto ?? null,
    solicitudId: prop.solicitud_id,
    solicitudTitulo: sol.titulo ?? '',
    solicitudUbicacion: sol.ubicacion ?? '',
    oficioNombre: sol.oficios?.nombre ?? '',
  }
}

/** Contrataciones visibles para el usuario (RLS filtra por participación). */
export async function listar() {
  const { data, error } = await supabase
    .from('contrataciones')
    .select(SELECT)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapear)
}

export async function obtener(id) {
  const { data, error } = await supabase
    .from('contrataciones')
    .select(SELECT)
    .eq('id', id)
    .single()
  if (error) throw error
  return mapear(data)
}

export async function obtenerPorPropuesta(propuestaId) {
  const { data, error } = await supabase
    .from('contrataciones')
    .select(SELECT)
    .eq('propuesta_id', propuestaId)
    .maybeSingle()
  if (error) throw error
  return data ? mapear(data) : null
}

/** Acepta la propuesta y crea la contratación. Devuelve el id. */
export async function aceptar(propuestaId) {
  const { data, error } = await supabase.rpc('aceptar_propuesta', {
    p_propuesta_id: propuestaId,
  })
  if (error) throw error
  return data
}

async function subirFotos(usuarioId, contratacionId, fotos = []) {
  const paths = []
  for (const foto of fotos) {
    if (!foto?.file) continue
    paths.push(await subirEvidencia(usuarioId, contratacionId, foto.file))
  }
  return paths
}

export async function confirmarFin(contratacionId, { usuarioId, comentario, fotos = [] }) {
  const paths = await subirFotos(usuarioId, contratacionId, fotos)
  const { data, error } = await supabase.rpc('confirmar_fin', {
    p_contratacion_id: contratacionId,
    p_comentario: comentario || null,
    p_fotos: paths,
  })
  if (error) throw error
  return data
}

export async function cancelar(contratacionId, { usuarioId, motivo, fotos = [] }) {
  const paths = await subirFotos(usuarioId, contratacionId, fotos)
  const { error } = await supabase.rpc('cancelar_contratacion', {
    p_contratacion_id: contratacionId,
    p_motivo: motivo,
    p_fotos: paths,
  })
  if (error) throw error
}

export async function agregarRespuesta(contratacionId, { usuarioId, comentario, fotos = [] }) {
  const paths = await subirFotos(usuarioId, contratacionId, fotos)
  const { error } = await supabase.rpc('agregar_respuesta', {
    p_contratacion_id: contratacionId,
    p_comentario: comentario,
    p_fotos: paths,
  })
  if (error) throw error
}

export async function reportar(contratacionId, { usuarioId, comentario, fotos = [] }) {
  const paths = await subirFotos(usuarioId, contratacionId, fotos)
  const { error } = await supabase.rpc('reportar_contratacion', {
    p_contratacion_id: contratacionId,
    p_comentario: comentario,
    p_fotos: paths,
  })
  if (error) throw error
}

export async function agregarDescargo(contratacionId, { usuarioId, comentario, fotos = [] }) {
  const paths = await subirFotos(usuarioId, contratacionId, fotos)
  const { error } = await supabase.rpc('agregar_descargo', {
    p_contratacion_id: contratacionId,
    p_comentario: comentario,
    p_fotos: paths,
  })
  if (error) throw error
}

export async function evidencias(contratacionId) {
  const { data, error } = await supabase
    .from('contratacion_evidencias')
    .select(
      'id, tipo, comentario, created_at, autor_id, autor:perfiles!contratacion_evidencias_autor_id_fkey(nombre, apellido, avatar_path), contratacion_evidencia_fotos(storage_path)',
    )
    .eq('contratacion_id', contratacionId)
    .order('created_at', { ascending: true })
  if (error) throw error

  return (data ?? []).map((e) => ({
    id: e.id,
    tipo: e.tipo,
    comentario: e.comentario ?? '',
    createdAt: e.created_at,
    autorId: e.autor_id,
    autorNombre: e.autor?.nombre ?? '',
    autorApellido: e.autor?.apellido ?? '',
    autorAvatar: e.autor?.avatar_path ? urlPublica('avatares', e.autor.avatar_path) : null,
    fotos: (e.contratacion_evidencia_fotos ?? []).map((f) => ({
      path: f.storage_path,
      url: urlPublica(BUCKET, f.storage_path),
    })),
  }))
}

/** Teléfono de la contraparte (la RLS lo permite con contratación vigente). */
export async function contacto(perfilId) {
  const { data, error } = await supabase
    .from('perfil_contacto')
    .select('telefono')
    .eq('perfil_id', perfilId)
    .maybeSingle()
  if (error) throw error
  return data?.telefono ?? null
}
