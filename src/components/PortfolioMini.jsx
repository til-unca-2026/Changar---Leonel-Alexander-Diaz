import { useEffect, useState } from 'react'
import * as perfilesRepo from '@/lib/data/perfiles.repo.js'

/** Miniaturas del portfolio (hasta 3) para la tarjeta del postulante. */
export default function PortfolioMini({ trabajadorId }) {
  const [fotos, setFotos] = useState([])

  useEffect(() => {
    let activo = true
    perfilesRepo
      .portfolioMini(trabajadorId)
      .then((f) => activo && setFotos(f))
      .catch(() => activo && setFotos([]))
    return () => {
      activo = false
    }
  }, [trabajadorId])

  if (fotos.length === 0) return null

  return (
    <div className="flex gap-1.5">
      {fotos.map((url, i) => (
        <div key={i} className="h-10 w-10 overflow-hidden rounded-lg border border-line">
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      ))}
    </div>
  )
}
