import { supabase } from '@/lib/supabase.js'
import { estaHabilitado } from '@/lib/cuentas.js'
import { subirFotoSolicitud, urlPublica } from './almacenamiento.js'

/**
 * Repositorio de solicitudes contra Supabase.
 * Incluye el oficio, las fotos y (para el cliente) el conteo de propuestas.
 */
const BUCKET = 'solicitud-fotos'

const SELECT =
  '*, oficios(nombre), solicitud_fotos(storage_path), ' +
  'cliente:perfiles!solicitudes_cliente_id_fkey(activo, baneado_hasta), ' +
  'propuestas(estado, trabajador:perfiles!propuestas_trabajador_id_fkey(activo, baneado_hasta))'

function mapear(s) {
  // Las propuestas enviadas por una cuenta sancionada se ocultan al cliente.
  const propuestas = (s.propuestas ?? []).filter(
    (p) => p.estado !== 'enviada' || estaHabilitado(p.trabajador),
  )

  return {
    id: s.id,
    clienteId: s.cliente_id,
    trabajadorDestinoId: s.trabajador_destino_id,
    oficioId: s.oficio_id,
    oficioNombre: s.oficios?.nombre ?? '',
    titulo: s.titulo,
    descripcion: s.descripcion,
    ubicacion: s.ubicacion,
    presupuestoMax: s.presupuesto_max,
    estado: s.estado,
    createdAt: s.created_at,
    fotos: (s.solicitud_fotos ?? []).map((f) => ({
      path: f.storage_path,
      url: urlPublica(BUCKET, f.storage_path),
    })),
    propuestasCount: propuestas.length,
    propuestaPendiente: propuestas.some((p) => p.estado === 'enviada'),
    clienteHabilitado: estaHabilitado(s.cliente),
  }
}

/** Crea la solicitud y sube sus fotos al Storage. */
export async function crear({
  clienteId,
  oficioId,
  titulo,
  descripcion,
  ubicacion,
  presupuestoMax,
  fotos = [],
  trabajadorDestinoId = null,
}) {
  const { data: sol, error } = await supabase
    .from('solicitudes')
    .insert({
      cliente_id: clienteId,
      oficio_id: oficioId,
      trabajador_destino_id: trabajadorDestinoId,
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      ubicacion: ubicacion.trim(),
      presupuesto_max: presupuestoMax ? Number(presupuestoMax) : null,
    })
    .select('id')
    .single()
  if (error) throw error

  for (const foto of fotos) {
    if (!foto?.file) continue
    const path = await subirFotoSolicitud(clienteId, sol.id, foto.file)
    const { error: errFoto } = await supabase
      .from('solicitud_fotos')
      .insert({ solicitud_id: sol.id, storage_path: path })
    if (errFoto) throw errFoto
  }

  return sol.id
}

export async function listarPorCliente(clienteId) {
  const { data, error } = await supabase
    .from('solicitudes')
    .select(SELECT)
    .eq('cliente_id', clienteId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapear)
}

/** Solicitudes abiertas; si se pasa `oficioIds`, filtra por esos oficios. */
export async function listarAbiertas({ oficioIds } = {}) {
  let query = supabase
    .from('solicitudes')
    .select(SELECT)
    .eq('estado', 'abierta')
    .is('trabajador_destino_id', null)

  if (oficioIds && oficioIds.length > 0) {
    query = query.in('oficio_id', oficioIds)
  }

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) throw error
  // Las solicitudes de clientes suspendidos o bloqueados no se muestran en el feed.
  return (data ?? []).map(mapear).filter((s) => s.clienteHabilitado)
}

export async function obtener(id) {
  const { data, error } = await supabase.from('solicitudes').select(SELECT).eq('id', id).single()
  if (error) throw error
  return mapear(data)
}

/** Cancela la solicitud (mientras esté 'abierta') y rechaza sus propuestas enviadas. */
export async function cancelar(id) {
  const { error } = await supabase.rpc('cancelar_solicitud', { p_solicitud_id: id })
  if (error) throw error
}

/**
 * Solicitudes personales abiertas dirigidas a un trabajador.
 * Incluye la propuesta propia (si ya respondió) para mostrar el estado.
 */
export async function listarPersonales(trabajadorId) {
  const { data, error } = await supabase
    .from('solicitudes')
    .select(
      '*, oficios(nombre), perfiles!solicitudes_cliente_id_fkey(nombre, apellido, activo, baneado_hasta), propuestas(id, estado, presupuesto, trabajador_id, created_at)',
    )
    .eq('trabajador_destino_id', trabajadorId)
    .eq('estado', 'abierta')
    .order('created_at', { ascending: false })
  if (error) throw error

  return (data ?? []).filter((s) => estaHabilitado(s.perfiles)).map((s) => {
    const propia = (s.propuestas ?? []).find((p) => p.trabajador_id === trabajadorId)
    return {
      id: s.id,
      titulo: s.titulo,
      descripcion: s.descripcion,
      ubicacion: s.ubicacion,
      presupuestoMax: s.presupuesto_max,
      oficioNombre: s.oficios?.nombre ?? '',
      clienteNombre: `${s.perfiles?.nombre ?? ''} ${s.perfiles?.apellido ?? ''}`.trim(),
      createdAt: s.created_at,
      miPropuesta: propia
        ? {
            id: propia.id,
            estado: propia.estado,
            presupuesto: propia.presupuesto,
            createdAt: propia.created_at,
          }
        : null,
    }
  })
}

/**
 * El trabajador acepta una solicitud personal enviando su presupuesto.
 * Devuelve el id de la propuesta: el cliente todavía debe confirmarla.
 */
export async function aceptarPersonal(solicitudId, presupuesto) {
  const { data, error } = await supabase.rpc('aceptar_solicitud_personal', {
    p_solicitud_id: solicitudId,
    p_presupuesto: presupuesto,
  })
  if (error) throw error
  return data
}

/** El trabajador rechaza una solicitud personal. */
export async function rechazarPersonal(solicitudId) {
  const { error } = await supabase.rpc('rechazar_solicitud_personal', {
    p_solicitud_id: solicitudId,
  })
  if (error) throw error
}
