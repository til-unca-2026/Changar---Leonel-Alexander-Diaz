/** Reglas de señales de riesgo de un perfil. */

export function analizarReputacion({ total = 0, promedio = 0, bajas = 0, reportes = 0 } = {}) {
  return {
    total,
    promedio,
    bajas,
    reportes,
    nueva: total === 0,
    conAdvertencia: bajas > 0 || reportes > 0,
    escalado: reportes >= 2,
  }
}

export function tooltipReputacion({ total = 0, promedio = 0, bajas = 0, reportes = 0 } = {}) {
  return [
    total > 0 ? `Reputación ${promedio} (${total} valoraciones)` : null,
    bajas > 0 ? `${bajas} valoración(es) baja(s)` : null,
    reportes > 0 ? `${reportes} contrato(s) reportado(s)` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}
