import { supabase } from '@/lib/supabase.js'
import { urlPublica } from './almacenamiento.js'

/** Métricas del dashboard de administración (con filtro por período). */
export async function metricas(desde = null) {
  const { data, error } = await supabase.rpc('admin_metricas', { p_desde: desde })
  if (error) throw error
  return data
}

export async function listarUsuarios() {
  const { data, error } = await supabase.rpc('admin_listar_usuarios')
  if (error) throw error
  return (data ?? []).map((u) => ({
    id: u.id,
    nombre: u.nombre,
    apellido: u.apellido,
    email: u.email,
    rol: u.rol,
    activo: u.activo,
    baneadoHasta: u.baneado_hasta,
    esSuperadmin: Boolean(u.es_superadmin),
    createdAt: u.created_at,
    marcas: u.marcas ?? 0,
    reportesPendientes: u.reportes_pendientes ?? 0,
  }))
}

export async function listarReportes() {
  const { data, error } = await supabase.rpc('admin_listar_reportes')
  if (error) throw error
  return (data ?? []).map((r) => ({
    id: r.id,
    motivo: r.motivo,
    estado: r.estado,
    createdAt: r.created_at,
    reportanteNombre: r.reportante_nombre,
    perfilId: r.perfil_id,
    perfilNombre: r.perfil_nombre,
    perfilRol: r.perfil_rol,
  }))
}

export async function listarContratosReportados() {
  const { data, error } = await supabase.rpc('admin_listar_contratos_reportados')
  if (error) throw error
  return (data ?? []).map((c) => ({
    contratacionId: c.contratacion_id,
    oficio: c.oficio,
    solicitudTitulo: c.solicitud_titulo,
    clienteId: c.cliente_id,
    clienteNombre: c.cliente_nombre,
    trabajadorId: c.trabajador_id,
    trabajadorNombre: c.trabajador_nombre,
    createdAt: c.created_at,
    resuelto: c.resuelto,
    resueltoAFavorNombre: c.resuelto_a_favor_nombre,
    sancionadoNombre: c.sancionado_nombre,
    reporte: c.reporte
      ? {
          comentario: c.reporte.comentario ?? '',
          fotos: (c.reporte.fotos ?? []).map((p) =>
            urlPublica('contratacion-evidencias', p),
          ),
        }
      : null,
    descargo: c.descargo
      ? {
          comentario: c.descargo.comentario ?? '',
          fotos: (c.descargo.fotos ?? []).map((p) =>
            urlPublica('contratacion-evidencias', p),
          ),
        }
      : null,
  }))
}

export async function marcar(perfilId, motivo) {
  const { error } = await supabase.rpc('admin_marcar', {
    p_perfil_id: perfilId,
    p_motivo: motivo || null,
  })
  if (error) throw error
}

export async function banear(perfilId, dias, motivo) {
  const { error } = await supabase.rpc('admin_banear', {
    p_perfil_id: perfilId,
    p_dias: dias,
    p_motivo: motivo,
  })
  if (error) throw error
}

export async function desbanear(perfilId) {
  const { error } = await supabase.rpc('admin_desbanear', { p_perfil_id: perfilId })
  if (error) throw error
}

/** Historial de sanciones y advertencias de un perfil (solo admin). */
export async function sancionesDe(perfilId) {
  const { data, error } = await supabase.rpc('admin_sanciones_de', { p_perfil_id: perfilId })
  if (error) throw error
  return (data ?? []).map((s) => ({
    id: s.id,
    tipo: s.tipo,
    dias: s.dias ?? null,
    motivo: s.motivo ?? '',
    aplicadaPor: s.aplicada_por ?? '',
    createdAt: s.created_at,
  }))
}

export async function cambiarRol(perfilId, rol) {
  const { error } = await supabase.rpc('admin_cambiar_rol', {
    p_perfil_id: perfilId,
    p_rol: rol,
  })
  if (error) throw error
}

export async function resolverReporte(reporteId, accion, dias = null, motivo = null) {
  const { error } = await supabase.rpc('admin_resolver_reporte', {
    p_reporte_id: reporteId,
    p_accion: accion,
    p_dias: dias,
    p_motivo: motivo,
  })
  if (error) throw error
}

export async function resolverContrato(contratacionId, aFavorId) {
  const { error } = await supabase.rpc('admin_resolver_contrato', {
    p_contratacion_id: contratacionId,
    p_a_favor_id: aFavorId,
  })
  if (error) throw error
}

/** Crea una invitación de administrador y devuelve el token del link. */
export async function crearInvitacion({ email, nombre, apellido }) {
  const { data, error } = await supabase.rpc('admin_crear_invitacion', {
    p_email: email,
    p_nombre: nombre,
    p_apellido: apellido,
  })
  if (error) throw error
  return data
}

/** Lista las invitaciones de administrador (pendientes y las ya usadas). */
export async function listarInvitaciones() {
  const { data, error } = await supabase.rpc('admin_listar_invitaciones')
  if (error) throw error
  return (data ?? []).map((i) => ({
    id: i.id,
    email: i.email,
    nombre: i.nombre,
    apellido: i.apellido,
    token: i.token,
    estado: i.estado,
    expiraAt: i.expira_at,
    createdAt: i.created_at,
    creadoPorNombre: i.creado_por_nombre ?? '',
  }))
}

/** Cancela una invitación pendiente. */
export async function cancelarInvitacion(invitacionId) {
  const { error } = await supabase.rpc('admin_cancelar_invitacion', {
    p_invitacion_id: invitacionId,
  })
  if (error) throw error
}
