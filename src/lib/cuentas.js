/**
 * Estado de una cuenta frente a las sanciones del administrador.
 *
 * - `activo = false` → bloqueo permanente: no vuelve y no se muestra en ningún lado.
 * - `baneado_hasta > now()` → suspensión temporal: se muestra, pero marcada y sin
 *   poder recibir solicitudes. Al vencer la fecha vuelve a estar habilitada.
 */
export function estaHabilitado(perfil) {
  if (!perfil) return true
  if (perfil.activo === false) return false
  if (!perfil.baneado_hasta) return true
  return new Date(perfil.baneado_hasta) <= new Date()
}

/** Suspensión temporal vigente (distinta del bloqueo permanente). */
export function estaSuspendido(perfil) {
  if (!perfil || perfil.activo === false) return false
  return Boolean(perfil.baneado_hasta) && new Date(perfil.baneado_hasta) > new Date()
}
