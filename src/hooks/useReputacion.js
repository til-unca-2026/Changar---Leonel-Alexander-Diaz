import { useEffect, useState } from 'react'
import * as valoracionesRepo from '@/lib/data/valoraciones.repo.js'
import * as perfilesRepo from '@/lib/data/perfiles.repo.js'

/** Reputación y señales de riesgo de un perfil (promedio, total, bajas, reportes). */
export function useReputacion(perfilId) {
  const [data, setData] = useState(null)

  useEffect(() => {
    if (!perfilId) return
    let activo = true
    Promise.all([
      valoracionesRepo.reputacion(perfilId),
      perfilesRepo.reportadosDe(perfilId),
    ])
      .then(([rep, reportes]) => activo && setData({ ...rep, reportes }))
      .catch(() =>
        activo && setData({ total: 0, promedio: 0, bajas: 0, distribucion: {}, reportes: 0 }),
      )
    return () => {
      activo = false
    }
  }, [perfilId])

  return data
}
