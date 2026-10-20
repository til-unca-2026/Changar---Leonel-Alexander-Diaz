import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import UserMenu from './UserMenu.jsx'

function Icono({ d, className = 'h-6 w-6' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

function Logo() {
  return (
    <div className="flex items-center gap-2">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-6 w-6"
        aria-hidden="true"
      >
        <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3z" />
        <path d="M14.7 6.3 18 3l3 3-3.3 3.3" />
      </svg>
      <span className="text-lg font-extrabold text-primary">ChangAr</span>
    </div>
  )
}

const ICONOS = {
  inicio: 'M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5',
  solicitudes: 'M4 4h16v16H4zM4 9h16M8 4v16',
  publicar: 'M12 5v14M5 12h14',
  perfil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  portafolio: 'M3 7h18v13H3zM8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18',
  explorar: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  propuestas: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  oficios: 'M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3zM14.7 6.3 18 3l3 3-3.3 3.3',
}

const NAV_POR_ROL = {
  cliente: {
    mobile: [
      { a: '/cliente', icono: 'inicio', texto: 'Inicio' },
      { a: '/cliente/solicitudes', icono: 'solicitudes', texto: 'Solicitudes' },
      { a: '/cliente/solicitudes/nueva', icono: 'publicar', texto: 'Publicar' },
      { a: '/perfil', icono: 'perfil', texto: 'Mi cuenta' },
    ],
    desktop: [
      { a: '/cliente', icono: 'inicio', texto: 'Inicio' },
      { a: '/cliente/solicitudes', icono: 'solicitudes', texto: 'Solicitudes' },
      { a: '/cliente/solicitudes/nueva', icono: 'publicar', texto: 'Publicar' },
      { a: '/perfil', icono: 'perfil', texto: 'Mi cuenta' },
    ],
  },
  trabajador: {
    mobile: [
      { a: '/trabajador', icono: 'inicio', texto: 'Inicio' },
      { a: '/trabajador/explorar', icono: 'explorar', texto: 'Explorar' },
      { a: '/trabajador/propuestas', icono: 'propuestas', texto: 'Propuestas' },
      { a: '/trabajador/perfil', icono: 'perfil', texto: 'Mi perfil' },
    ],
    desktop: [
      { a: '/trabajador', icono: 'inicio', texto: 'Inicio' },
      { a: '/trabajador/explorar', icono: 'explorar', texto: 'Explorar' },
      { a: '/trabajador/propuestas', icono: 'propuestas', texto: 'Propuestas' },
      { a: '/trabajador/perfil', icono: 'perfil', texto: 'Mi perfil' },
      { a: '/trabajador/portfolio', icono: 'portafolio', texto: 'Portfolio' },
      { a: '/perfil', icono: 'solicitudes', texto: 'Mi cuenta' },
    ],
  },
  admin: {
    mobile: [
      { a: '/admin', icono: 'inicio', texto: 'Panel' },
      { a: '/admin/oficios', icono: 'oficios', texto: 'Oficios' },
      { a: '/perfil', icono: 'perfil', texto: 'Mi cuenta' },
    ],
    desktop: [
      { a: '/admin', icono: 'inicio', texto: 'Panel' },
      { a: '/admin/oficios', icono: 'oficios', texto: 'Oficios' },
      { a: '/perfil', icono: 'perfil', texto: 'Mi cuenta' },
    ],
  },
}

const INICIO_POR_ROL = {
  cliente: '/cliente',
  trabajador: '/trabajador',
  admin: '/admin',
}

export default function AppLayout() {
  const { usuario } = useAuth()
  const nav = NAV_POR_ROL[usuario?.rol] ?? { mobile: [], desktop: [] }
  const inicio = INICIO_POR_ROL[usuario?.rol] ?? '/'

  return (
    <div className="min-h-screen bg-canvas">
      {/* Header: presente en mobile y desktop, con el nombre de la app */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 lg:px-8">
          <Link to={inicio} aria-label="Inicio de ChangAr">
            <Logo />
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary-soft text-primary transition hover:brightness-95"
              aria-label="Notificaciones"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5"
              >
                <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
            </button>
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar (solo desktop) */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 flex-col border-r border-line px-4 py-6 lg:flex">
          <nav className="flex flex-col gap-1">
            {nav.desktop.map((item) => (
              <NavLink
                key={item.a}
                to={item.a}
                end={item.a !== '/perfil'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-primary-soft text-primary'
                      : 'text-muted hover:bg-canvas hover:text-ink'
                  }`
                }
              >
                <Icono d={ICONOS[item.icono]} className="h-5 w-5" />
                {item.texto}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl bg-primary-soft p-4">
            <p className="text-xs font-bold text-primary">ChangAr</p>
            <p className="mt-1 text-xs text-muted">
              Conectando trabajo de confianza en tu barrio.
            </p>
          </div>
        </aside>

        {/* Contenido */}
        <main className="min-w-0 flex-1 px-5 py-6 pb-28 lg:px-8 lg:py-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      {/* Navegación inferior (solo mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-safe lg:hidden">
        <div className="flex items-stretch justify-around">
          {nav.mobile.map((item) => (
            <NavLink
              key={item.a}
              to={item.a}
              end={item.a !== '/perfil'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-primary' : 'text-muted'
                }`
              }
            >
              <Icono d={ICONOS[item.icono]} />
              {item.texto}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
