/**
 * Traduce los códigos de error (repos mock, RPCs y Supabase) a mensajes en español.
 * Punto único para no dispersar strings por la UI.
 */
const MENSAJES = {
  email_ya_registrado: 'Ya existe una cuenta con ese email.',
  credenciales_invalidas: 'Email o contraseña incorrectos.',
  cuenta_bloqueada: 'Tu cuenta está bloqueada. Contactá al administrador.',
  rol_no_permitido: 'No podés registrarte como administrador.',
  usuario_no_encontrado: 'No encontramos tu usuario.',
  registro_incompleto: 'No pudimos crear tu cuenta. Intentá de nuevo.',
  nombre_vacio: 'El nombre del oficio no puede estar vacío.',
  oficio_no_permitido: 'Ese oficio no está permitido.',
  solicitud_no_encontrada: 'La solicitud no existe.',
  solicitud_no_abierta: 'La solicitud ya no acepta propuestas.',
  perfil_incompleto:
    'Completá tu perfil (descripción, ubicación y al menos un oficio) para poder postular.',
  no_podes_postularte_a_tu_solicitud: 'No podés postularte a tu propia solicitud.',
  descripcion_vacia: 'Escribí una descripción para tu propuesta.',
  presupuesto_invalido: 'Ingresá un presupuesto válido.',
  reporte_ya_enviado: 'Este contrato ya fue reportado.',
  descargo_ya_enviado: 'El descargo ya fue presentado.',
  reportante_sin_descargo: 'Ya te explayaste en el reporte; no corresponde un descargo.',
  puntuacion_invalida: 'La puntuación debe estar entre 1 y 5 estrellas.',
  contratacion_no_completada: 'Solo se puede valorar una contratación completada.',
  valoracion_duplicada: 'Ya valoraste esta contratación.',
}

const MENSAJES_SUPABASE = {
  'Invalid login credentials': 'Email o contraseña incorrectos.',
  'User already registered': 'Ya existe una cuenta con ese email.',
  'Email not confirmed': 'Tenés que confirmar tu email.',
  'Email not confirmed.': 'Tenés que confirmar tu email.',
  'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres.',
  'Unable to validate email address: invalid format': 'El email no tiene un formato válido.',
  'new row violates row-level security policy': 'No tenés permiso para realizar esa acción.',
}

const GENERICO = 'Ocurrió un error inesperado. Intentá de nuevo.'

export function mensajeError(error) {
  if (!error) return GENERICO

  const codigo = typeof error === 'string' ? error : error.message ?? ''

  if (MENSAJES[codigo]) return MENSAJES[codigo]
  if (MENSAJES_SUPABASE[codigo]) return MENSAJES_SUPABASE[codigo]

  if (/invalid login credentials/i.test(codigo)) return MENSAJES_SUPABASE['Invalid login credentials']
  if (/already registered|already been registered/i.test(codigo)) return MENSAJES_SUPABASE['User already registered']
  if (/rol_no_permitido/i.test(codigo)) return MENSAJES.rol_no_permitido
  if (/nombre_vacio/i.test(codigo)) return MENSAJES.nombre_vacio
  if (/oficio_no_permitido/i.test(codigo)) return MENSAJES.oficio_no_permitido
  if (/solicitud_no_abierta/i.test(codigo)) return MENSAJES.solicitud_no_abierta
  if (/solicitud_no_encontrada/i.test(codigo)) return MENSAJES.solicitud_no_encontrada
  if (/perfil_incompleto/i.test(codigo)) return MENSAJES.perfil_incompleto
  if (/no_podes_postularte/i.test(codigo)) return MENSAJES.no_podes_postularte_a_tu_solicitud
  if (/descripcion_vacia/i.test(codigo)) return MENSAJES.descripcion_vacia
  if (/presupuesto_invalido/i.test(codigo)) return MENSAJES.presupuesto_invalido
  if (/reporte_ya_enviado/i.test(codigo)) return MENSAJES.reporte_ya_enviado
  if (/descargo_ya_enviado/i.test(codigo)) return MENSAJES.descargo_ya_enviado
  if (/reportante_sin_descargo/i.test(codigo)) return MENSAJES.reportante_sin_descargo
  if (/puntuacion_invalida/i.test(codigo)) return MENSAJES.puntuacion_invalida
  if (/contratacion_no_completada/i.test(codigo)) return MENSAJES.contratacion_no_completada
  if (/valoracion_duplicada/i.test(codigo)) return MENSAJES.valoracion_duplicada

  if (/propuestas_solicitud_id_trabajador_id_key/i.test(codigo)) {
    return 'Ya enviaste una propuesta a esta solicitud.'
  }
  if (error?.code === '23505') return 'Ese registro ya existe.'
  if (error?.code === '42501') return 'No tenés permiso para realizar esa acción.'

  return GENERICO
}
