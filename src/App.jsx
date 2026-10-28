import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import AppLayout from '@/components/layout/AppLayout.jsx'
import RoleGuard from '@/components/layout/RoleGuard.jsx'
import Login from '@/features/auth/Login.jsx'
import Registro from '@/features/auth/Registro.jsx'
import OnboardingTrabajador from '@/features/auth/OnboardingTrabajador.jsx'
import Perfil from '@/features/auth/Perfil.jsx'
import PublicProfile from '@/features/perfiles/PublicProfile.jsx'
import ClienteDashboard from '@/features/cliente/Dashboard.jsx'
import MisSolicitudes from '@/features/cliente/MisSolicitudes.jsx'
import NuevaSolicitud from '@/features/cliente/NuevaSolicitud.jsx'
import ClienteDetalleSolicitud from '@/features/cliente/DetalleSolicitud.jsx'
import ListaContrataciones from '@/features/contrataciones/ListaContrataciones.jsx'
import DetalleContratacion from '@/features/contrataciones/DetalleContratacion.jsx'
import TrabajadorDashboard from '@/features/trabajador/Dashboard.jsx'
import Explorar from '@/features/trabajador/Explorar.jsx'
import TrabajadorDetalleSolicitud from '@/features/trabajador/DetalleSolicitud.jsx'
import MisPropuestas from '@/features/trabajador/MisPropuestas.jsx'
import PerfilTrabajadorPage from '@/features/trabajador/Perfil.jsx'
import Portfolio from '@/features/trabajador/Portfolio.jsx'
import AdminDashboard from '@/features/admin/Dashboard.jsx'
import AdminOficios from '@/features/admin/Oficios.jsx'

const DESTINO_POR_ROL = {
  cliente: '/cliente',
  trabajador: '/trabajador',
  admin: '/admin',
}

function Inicio() {
  const { usuario, cargando } = useAuth()
  if (cargando) return null
  if (!usuario) return <Navigate to="/login" replace />
  return <Navigate to={DESTINO_POR_ROL[usuario.rol] ?? '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      {/* Públicas */}
      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Registro />} />

      {/* Onboarding: requiere sesión, sin layout de app */}
      <Route element={<RoleGuard roles={['trabajador']} />}>
        <Route path="/onboarding/trabajador" element={<OnboardingTrabajador />} />
      </Route>

      {/* Cliente */}
      <Route element={<RoleGuard roles={['cliente']} />}>
        <Route element={<AppLayout />}>
          <Route path="/cliente" element={<ClienteDashboard />} />
          <Route path="/cliente/solicitudes" element={<MisSolicitudes />} />
          <Route path="/cliente/solicitudes/nueva" element={<NuevaSolicitud />} />
          <Route path="/cliente/solicitudes/:id" element={<ClienteDetalleSolicitud />} />
          <Route path="/cliente/contrataciones" element={<ListaContrataciones />} />
          <Route path="/cliente/contrataciones/:id" element={<DetalleContratacion />} />
        </Route>
      </Route>

      {/* Trabajador */}
      <Route element={<RoleGuard roles={['trabajador']} />}>
        <Route element={<AppLayout />}>
          <Route path="/trabajador" element={<TrabajadorDashboard />} />
          <Route path="/trabajador/explorar" element={<Explorar />} />
          <Route path="/trabajador/solicitudes/:id" element={<TrabajadorDetalleSolicitud />} />
          <Route path="/trabajador/propuestas" element={<MisPropuestas />} />
          <Route path="/trabajador/contrataciones" element={<ListaContrataciones />} />
          <Route path="/trabajador/contrataciones/:id" element={<DetalleContratacion />} />
          <Route path="/trabajador/perfil" element={<PerfilTrabajadorPage />} />
          <Route path="/trabajador/portfolio" element={<Portfolio />} />
        </Route>
      </Route>

      {/* Admin */}
      <Route element={<RoleGuard roles={['admin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/oficios" element={<AdminOficios />} />
        </Route>
      </Route>

      {/* Perfil: cualquier rol autenticado */}
      <Route element={<RoleGuard />}>
        <Route element={<AppLayout />}>
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/perfiles/:id" element={<PublicProfile />} />
        </Route>
      </Route>

      <Route path="/" element={<Inicio />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
