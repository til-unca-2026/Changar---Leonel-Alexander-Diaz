import { supabase } from '@/lib/supabase.js'
import { eliminarArchivo, subirFotoPortfolio, urlPublica } from './almacenamiento.js'

/**
 * Portfolio de fotos contra `portfolio_fotos` + Storage (bucket portfolio-fotos).
 */
const BUCKET = 'portfolio-fotos'

function aFicha(f) {
  return {
    id: f.id,
    nombre: f.storage_path.split('/').pop(),
    descripcion: f.descripcion ?? '',
    url: urlPublica(BUCKET, f.storage_path),
    createdAt: f.created_at,
  }
}

export async function listar(trabajadorId) {
  const { data, error } = await supabase
    .from('portfolio_fotos')
    .select('id, storage_path, descripcion, created_at')
    .eq('trabajador_id', trabajadorId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(aFicha)
}

export async function agregar(trabajadorId, { file, descripcion }) {
  const path = await subirFotoPortfolio(trabajadorId, file)

  const { data, error } = await supabase
    .from('portfolio_fotos')
    .insert({
      trabajador_id: trabajadorId,
      storage_path: path,
      descripcion: descripcion?.trim() ?? '',
    })
    .select('id, storage_path, descripcion, created_at')
    .single()
  if (error) throw error

  return aFicha(data)
}

export async function eliminar(id) {
  const { data, error } = await supabase
    .from('portfolio_fotos')
    .select('storage_path')
    .eq('id', id)
    .single()
  if (error) throw error

  await eliminarArchivo(BUCKET, data.storage_path).catch(() => {})

  const { error: errDel } = await supabase.from('portfolio_fotos').delete().eq('id', id)
  if (errDel) throw errDel
}
