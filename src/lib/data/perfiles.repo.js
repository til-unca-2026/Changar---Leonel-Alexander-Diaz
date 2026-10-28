import { supabase } from '@/lib/supabase.js'
import { urlPublica } from './almacenamiento.js'

/**
 * Perfiles públicos: consulta la información visible de un usuario
 * (trabajador o cliente) y sus antecedentes de contratos reportados.
 */

export async function obtenerBase(id) {
  const { data, error } = await supabase
    .from('perfiles')
    .select('id, nombre, apellido, avatar_path, rol, created_at')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    id: data.id,
    nombre: data.nombre,
    apellido: data.apellido,
    rol: data.rol,
    avatarUrl: data.avatar_path ? urlPublica('avatares', data.avatar_path) : null,
    createdAt: data.created_at,
  }
}

export async function obtenerTrabajador(id) {
  const [base, pt, relaciones, portfolio] = await Promise.all([
    obtenerBase(id),
    supabase
      .from('perfiles_trabajador')
      .select('descripcion, experiencia, ubicacion')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('trabajador_oficios')
      .select('oficio_id, oficios(nombre, estado)')
      .eq('trabajador_id', id),
    supabase
      .from('portfolio_fotos')
      .select('storage_path, descripcion')
      .eq('trabajador_id', id)
      .order('created_at', { ascending: false }),
  ])

  return {
    ...base,
    descripcion: pt.data?.descripcion ?? '',
    experiencia: pt.data?.experiencia ?? '',
    ubicacion: pt.data?.ubicacion ?? '',
    oficios: (relaciones.data ?? [])
      .filter((r) => r.oficios?.estado === 'activo')
      .map((r) => r.oficios.nombre),
    portfolio: (portfolio.data ?? []).map((p) => ({
      url: urlPublica('portfolio-fotos', p.storage_path),
      descripcion: p.descripcion ?? '',
    })),
  }
}

export async function obtenerCliente(id) {
  const base = await obtenerBase(id)
  const { data: pc } = await supabase
    .from('perfiles_cliente')
    .select('zona, descripcion')
    .eq('id', id)
    .maybeSingle()
  return {
    ...base,
    zona: pc?.zona ?? '',
    descripcion: pc?.descripcion ?? '',
  }
}

/** Cantidad de contratos reportados donde participa el perfil. */
export async function reportadosDe(perfilId) {
  const { data, error } = await supabase.rpc('reportados_de', { p_perfil_id: perfilId })
  if (error) throw error
  return data ?? 0
}

/** Expediente público de contratos reportados. */
export async function reportesDe(perfilId) {
  const { data, error } = await supabase.rpc('reportes_de', { p_perfil_id: perfilId })
  if (error) throw error
  return (data ?? []).map((r) => ({
    contratacionId: r.contratacion_id,
    oficio: r.oficio,
    solicitudTitulo: r.solicitud_titulo,
    contraparteNombre: r.contraparte_nombre,
    contraparteApellido: r.contraparte_apellido,
    contraparteAvatar: r.contraparte_avatar
      ? urlPublica('avatares', r.contraparte_avatar)
      : null,
    createdAt: r.created_at,
    reporte: r.reporte
      ? {
          comentario: r.reporte.comentario ?? '',
          fotos: (r.reporte.fotos ?? []).map((p) =>
            urlPublica('contratacion-evidencias', p),
          ),
        }
      : null,
    descargo: r.descargo
      ? {
          comentario: r.descargo.comentario ?? '',
          fotos: (r.descargo.fotos ?? []).map((p) =>
            urlPublica('contratacion-evidencias', p),
          ),
        }
      : null,
  }))
}

/** Historial público de contratos cancelados. */
export async function canceladosDe(perfilId) {
  const { data, error } = await supabase.rpc('cancelados_de', { p_perfil_id: perfilId })
  if (error) throw error
  return (data ?? []).map((r) => ({
    contratacionId: r.contratacion_id,
    oficio: r.oficio,
    solicitudTitulo: r.solicitud_titulo,
    contraparteNombre: r.contraparte_nombre,
    contraparteApellido: r.contraparte_apellido,
    contraparteAvatar: r.contraparte_avatar
      ? urlPublica('avatares', r.contraparte_avatar)
      : null,
    createdAt: r.created_at,
    motivo: r.motivo ?? '',
    canceladoPorPerfil: Boolean(r.cancelado_por_perfil),
    respuesta: r.respuesta
      ? {
          comentario: r.respuesta.comentario ?? '',
          fotos: (r.respuesta.fotos ?? []).map((p) =>
            urlPublica('contratacion-evidencias', p),
          ),
        }
      : null,
  }))
}

/** Miniaturas del portfolio de un trabajador (hasta 3) para listados. */
export async function portfolioMini(trabajadorId) {
  const { data, error } = await supabase
    .from('portfolio_fotos')
    .select('storage_path')
    .eq('trabajador_id', trabajadorId)
    .order('created_at', { ascending: false })
    .limit(3)
  if (error) throw error
  return (data ?? []).map((p) => urlPublica('portfolio-fotos', p.storage_path))
}
