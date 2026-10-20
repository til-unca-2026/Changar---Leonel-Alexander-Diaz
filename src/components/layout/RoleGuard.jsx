import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

function Pantalla({ titulo, texto }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="text-xl font-extrabold text-ink">{titulo}</h1>
      <p className="text-muted">{texto}</p>
    </div>
  )
}

/**
 * Envuelve un grupo de rutas y resuelve:
 *  - sin sesión -> /login
 *  - cuenta bloqueada -> pantalla de bloqueo
 *  - rol no autorizado -> 403
 */
export default function RoleGuard({ roles }) {
  const { usuario, cargando } = useAuth()
  const location = useLocation()

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center text-primary">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (!usuario) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (!usuario.activo) {
    return (
      <Pantalla
        titulo="Cuenta bloqueada"
        texto="Tu cuenta está bloqueada. Contactá al administrador."
      />
    )
  }

  if (roles && !roles.includes(usuario.rol)) {
    return (
      <Pantalla
        titulo="Acceso no autorizado"
        texto="No tenés permiso para ver esta sección."
      />
    )
  }

  return <Outlet />
}
