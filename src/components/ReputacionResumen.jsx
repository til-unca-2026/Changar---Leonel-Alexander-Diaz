import { useReputacion } from '@/hooks/useReputacion.js'
import InsigniaReputacion from '@/components/InsigniaReputacion.jsx'

/** Resumen de reputación en listados (obtiene los datos y delega la presentación). */
export default function ReputacionResumen({ perfilId }) {
  const rep = useReputacion(perfilId)
  if (!rep) return null
  return <InsigniaReputacion datos={rep} perfilId={perfilId} />
}
