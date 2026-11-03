import { Link } from 'react-router-dom'
import { useReputacion } from '@/hooks/useReputacion.js'

function Triangulo({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 3 2 20h20L12 3z" fill="currentColor" />
      <path d="M12 9.5v4.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.2" fill="#fff" />
    </svg>
  )
}

/**
 * Resumen de reputación en listados: estrellas promedio (o "Nuevo") y advertencias.
 * - Triángulo ámbar: hay una valoración baja o un contrato reportado.
 * - "!" rojo: tiene 2 o más reportes.
 */
export default function ReputacionResumen({ perfilId }) {
  const rep = useReputacion(perfilId)
  if (!rep) return null

  const { total, promedio, bajas, reportes } = rep
  const conAdvertencia = bajas > 0 || reportes > 0
  const escalado = reportes >= 2

  const tooltip = [
    total > 0 ? `Reputación ${promedio} (${total} valoraciones)` : null,
    bajas > 0 ? `${bajas} valoración(es) baja(s)` : null,
    reportes > 0 ? `${reportes} contrato(s) reportado(s)` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <span className="inline-flex items-center gap-1.5">
      {total > 0 ? (
        <>
          <span className="text-sm leading-none text-warning">★</span>
          <span className="text-sm font-semibold text-ink">{promedio}</span>
          <span className="text-xs text-muted">({total})</span>
        </>
      ) : (
        <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-bold text-new">
          Nuevo
        </span>
      )}

      {conAdvertencia && (
        <Link
          to={`/perfiles/${perfilId}`}
          title={tooltip}
          aria-label="Ver advertencias"
          className="inline-flex items-center gap-1"
        >
          <Triangulo className="h-4 w-4 text-warning" />
          {escalado && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-extrabold text-white">
              !
            </span>
          )}
        </Link>
      )}
    </span>
  )
}
