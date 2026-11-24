import { supabase } from '@/lib/supabase.js'

const SELECT = 'id, oficio_id, nombre, estado, oficios(nombre)'

/** Subáreas visibles de un oficio: activas + las propias pendientes (RLS). */
export async function listarVisibles(oficioId) {
  const { data, error } = await supabase
    .from('oficio_subareas')
    .select(SELECT)
    .eq('oficio_id', oficioId)
    .order('nombre')
  if (error) throw error
  return (data ?? []).map(mapear)
}

/** Todas las subáreas (el Admin las ve todas por RLS). */
export async function listarTodas() {
  const { data, error } = await supabase
    .from('oficio_subareas')
    .select(SELECT)
    .order('oficios(nombre)')
    .order('nombre')
  if (error) throw error
  return (data ?? []).map(mapear)
}

/** Subáreas declaradas por un trabajador, con su oficio. */
export async function listarDelTrabajador(trabajadorId) {
  const { data, error } = await supabase
    .from('trabajador_subareas')
    .select(
      'subarea_id, oficio_subareas(id, nombre, estado, oficio_id, oficios(nombre, estado))',
    )
    .eq('trabajador_id', trabajadorId)
  if (error) throw error

  return (data ?? []).map((f) => ({
    id: f.subarea_id,
    nombre: f.oficio_subareas?.nombre ?? '',
    oficioId: f.oficio_subareas?.oficio_id ?? '',
    oficioNombre: f.oficio_subareas?.oficios?.nombre ?? '',
    estado: f.oficio_subareas?.estado ?? '',
  }))
}

/** Propone una subárea nueva (queda pendiente) o devuelve la existente. */
export async function crear(oficioId, nombre) {
  const { data, error } = await supabase.rpc('crear_subarea', {
    p_oficio_id: oficioId,
    p_nombre: nombre,
  })
  if (error) throw error

  const { data: fila, error: errGet } = await supabase
    .from('oficio_subareas')
    .select(SELECT)
    .eq('id', data)
    .single()
  if (errGet) throw errGet
  return mapear(fila)
}

/** Reemplaza las subáreas del trabajador (el trigger valida los oficios). */
export async function guardar(trabajadorId, ids = []) {
  const { error: errDel } = await supabase
    .from('trabajador_subareas')
    .delete()
    .eq('trabajador_id', trabajadorId)
  if (errDel) throw errDel

  if (ids.length > 0) {
    const { error: errIns } = await supabase.from('trabajador_subareas').insert(
      ids.map((subarea_id) => ({ trabajador_id: trabajadorId, subarea_id })),
    )
    if (errIns) throw errIns
  }
}

export async function aprobar(subareaId, aprobar) {
  const { error } = await supabase.rpc('admin_aprobar_subarea', {
    p_subarea_id: subareaId,
    p_aprobar: aprobar,
  })
  if (error) throw error
}

export async function renombrar(subareaId, nombre) {
  const { error } = await supabase.rpc('admin_renombrar_subarea', {
    p_subarea_id: subareaId,
    p_nombre: nombre,
  })
  if (error) throw error
}

function mapear(s) {
  return {
    id: s.id,
    oficioId: s.oficio_id,
    nombre: s.nombre,
    estado: s.estado,
    oficioNombre: s.oficios?.nombre ?? '',
  }
}
