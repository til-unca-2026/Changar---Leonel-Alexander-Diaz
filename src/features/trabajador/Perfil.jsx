import { Link } from 'react-router-dom'
import PerfilTrabajador from './PerfilTrabajador.jsx'

export default function Perfil() {
  return (
    <div className="space-y-5">
      <PerfilTrabajador />

      <Link
        to="/trabajador/portfolio"
        className="flex items-center justify-between rounded-card border border-line bg-surface p-5 shadow-sm"
      >
        <span>
          <span className="block font-bold text-ink">Mi portfolio</span>
          <span className="block text-sm text-muted">Mostrá fotos de tus trabajos.</span>
        </span>
        <span className="font-bold text-primary">→</span>
      </Link>
    </div>
  )
}
