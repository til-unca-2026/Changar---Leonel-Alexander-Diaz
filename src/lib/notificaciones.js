const ETIQUETAS = {
  nueva_propuesta: 'Recibiste una nueva propuesta',
  propuesta_aceptada: 'Tu propuesta fue aceptada',
  propuesta_rechazada: 'Tu propuesta fue rechazada',
  contratacion_creada: 'Se creó una contratación',
  contratacion_pendiente_confirmacion: 'Contratación pendiente de confirmación',
  contratacion_completada: 'Contratación completada',
  contratacion_cancelada: 'Contratación cancelada',
  contratacion_reportada: 'Contratación reportada',
  contratacion_resuelta: 'Contratación resuelta',
  nueva_valoracion: 'Recibiste una valoración',
  oficio_pendiente: 'Nuevo oficio pendiente de aprobación',
  oficio_aprobado: 'Tu oficio fue aprobado',
  oficio_rechazado: 'Tu oficio fue rechazado',
  cuenta_bloqueada: 'Tu cuenta fue bloqueada',
  cuenta_suspendida: 'Tu cuenta fue suspendida',
  reporte_nuevo: 'Nuevo reporte de perfil',
  contrato_reportado: 'Nuevo contrato reportado',
}

export function etiqueta(tipo) {
  return ETIQUETAS[tipo] ?? tipo
}

export function destino(tipo, ref, rol) {
  if (!ref) return null
  const base = rol === 'cliente' ? '/cliente' : rol === 'trabajador' ? '/trabajador' : '/admin'

  switch (tipo) {
    case 'nueva_propuesta':
      return `/cliente/solicitudes/${ref}`
    case 'propuesta_aceptada':
    case 'propuesta_rechazada':
      return `/trabajador/solicitudes/${ref}`
    case 'contratacion_creada':
    case 'contratacion_pendiente_confirmacion':
    case 'contratacion_completada':
    case 'contratacion_cancelada':
    case 'contratacion_reportada':
    case 'contratacion_resuelta':
    case 'nueva_valoracion':
      return `${base}/contrataciones/${ref}`
    case 'oficio_pendiente':
      return '/admin/oficios'
    case 'oficio_aprobado':
    case 'oficio_rechazado':
      return '/trabajador/perfil'
    case 'reporte_nuevo':
    case 'contrato_reportado':
      return '/admin/reportes'
    default:
      return null
  }
}
