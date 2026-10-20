import { supabase } from '@/lib/supabase.js'
import { urlPublica } from './almacenamiento.js'

/**
 * Repositorio de autenticación contra Supabase Auth.
 * El perfil se compone de `perfiles` + `perfil_contacto`; el email no se lee
 * de la base (está oculto por grants), se toma de la sesión de Auth.
 */

const COLUMNAS_PERFIL = 'id, nombre, apellido, avatar_path, rol, activo, created_at'

function componer(perfil, telefono, email) {
  const avatar = perfil.avatar_path ?? null
  return {
    id: perfil.id,
    nombre: perfil.nombre,
    apellido: perfil.apellido,
    email: email ?? null,
    telefono: telefono ?? '',
    rol: perfil.rol,
    activo: perfil.activo,
    avatar,
    avatarUrl: avatar ? urlPublica('avatares', avatar) : null,
    createdAt: perfil.created_at,
  }
}

async function cargarPerfil(id, emailFallback) {
  const { data: perfil, error } = await supabase
    .from('perfiles')
    .select(COLUMNAS_PERFIL)
    .eq('id', id)
    .single()
  if (error) throw error

  const { data: contacto } = await supabase
    .from('perfil_contacto')
    .select('telefono')
    .eq('perfil_id', id)
    .maybeSingle()

  let email = emailFallback
  if (email === undefined || email === null) {
    const { data } = await supabase.auth.getUser()
    email = data.user?.email ?? null
  }

  return componer(perfil, contacto?.telefono, email)
}

/** Registra un usuario y devuelve su perfil. */
export async function registrar({ nombre, apellido, email, telefono, password, rol }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nombre, apellido, telefono, rol } },
  })
  if (error) throw error
  if (!data.user) throw new Error('registro_incompleto')

  return cargarPerfil(data.user.id, data.user.email)
}

/** Inicia sesión con email y contraseña. */
export async function iniciarSesion({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return cargarPerfil(data.user.id, data.user.email)
}

/** Devuelve el perfil de la sesión actual, o null. */
export async function sesionActual() {
  const { data } = await supabase.auth.getSession()
  const user = data.session?.user
  if (!user) return null
  try {
    return await cargarPerfil(user.id, user.email)
  } catch {
    return null
  }
}

/** Cierra la sesión actual. */
export async function cerrarSesion() {
  await supabase.auth.signOut()
}

/** Devuelve un perfil por id. */
export async function obtener(usuarioId) {
  return cargarPerfil(usuarioId)
}

/** Actualiza los datos editables del perfil. */
export async function actualizarPerfil(usuarioId, { nombre, apellido, telefono, avatar }) {
  const cambios = {}
  if (nombre !== undefined) cambios.nombre = nombre.trim()
  if (apellido !== undefined) cambios.apellido = apellido.trim()
  if (avatar !== undefined) cambios.avatar_path = avatar

  if (Object.keys(cambios).length > 0) {
    const { error } = await supabase.from('perfiles').update(cambios).eq('id', usuarioId)
    if (error) throw error
  }

  if (telefono !== undefined) {
    const { error } = await supabase.from('perfil_contacto').upsert({
      perfil_id: usuarioId,
      telefono: telefono.trim(),
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  }

  return cargarPerfil(usuarioId)
}
