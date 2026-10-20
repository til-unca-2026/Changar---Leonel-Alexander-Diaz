const VARIANTES = {
  abierta: 'bg-primary-soft text-primary',
  asignada: 'bg-amber-50 text-warning',
  cerrada: 'bg-green-50 text-success',
  cancelada: 'bg-red-50 text-danger',
  enviada: 'bg-primary-soft text-primary',
  aceptada: 'bg-green-50 text-success',
  rechazada: 'bg-red-50 text-danger',
  retirada: 'bg-slate-100 text-muted',
  activo: 'bg-green-50 text-success',
  pendiente: 'bg-amber-50 text-warning',
  inactivo: 'bg-slate-100 text-muted',
  neutral: 'bg-slate-100 text-muted',
}

const ETIQUETAS = {
  abierta: 'Abierta',
  asignada: 'Asignada',
  cerrada: 'Cerrada',
  cancelada: 'Cancelada',
  enviada: 'Enviada',
  aceptada: 'Aceptada',
  rechazada: 'Rechazada',
  retirada: 'Retirada',
  activo: 'Activo',
  pendiente: 'Pendiente',
  inactivo: 'Inactivo',
}

export default function Badge({ estado = 'neutral', children, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${VARIANTES[estado] ?? VARIANTES.neutral} ${className}`}
    >
      {children ?? ETIQUETAS[estado] ?? estado}
    </span>
  )
}
