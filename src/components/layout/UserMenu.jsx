import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import Avatar from '@/components/ui/Avatar.jsx'

const ETIQUETA_ROL = {
  cliente: 'Cliente',
  trabajador: 'Trabajador',
  admin: 'Administrador',
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 text-muted"
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/**
 * Menú de usuario global: cuenta y cierre de sesión accesibles desde cualquier pantalla.
 */
export default function UserMenu() {
  const { usuario, cerrarSesion } = useAuth()
  const { mostrar } = useToast()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)

  async function salir() {
    setAbierto(false)
    await cerrarSesion()
    mostrar('Cerraste sesión.', 'info')
    navigate('/login', { replace: true })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-2 rounded-full p-1 transition hover:bg-canvas"
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <Avatar usuario={usuario} tamano="md" />
        <span className="hidden max-w-[9rem] truncate text-sm font-bold text-ink sm:block">
          {usuario?.nombre}
        </span>
        <span className="hidden sm:block">
          <Chevron />
        </span>
      </button>

      {abierto && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setAbierto(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-line bg-surface p-2 shadow-xl"
          >
            <div className="flex items-center gap-3 rounded-xl px-3 py-2">
              <Avatar usuario={usuario} tamano="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">
                  {usuario?.nombre} {usuario?.apellido}
                </p>
                <p className="text-xs text-muted">{ETIQUETA_ROL[usuario?.rol]}</p>
              </div>
            </div>

            <div className="my-1 h-px bg-line" />

            <Link
              to="/perfil"
              role="menuitem"
              onClick={() => setAbierto(false)}
              className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas"
            >
              Mi cuenta
            </Link>

            {usuario?.rol === 'trabajador' && (
              <Link
                to="/trabajador/perfil"
                role="menuitem"
                onClick={() => setAbierto(false)}
                className="block rounded-xl px-3 py-2.5 text-sm font-semibold text-ink transition hover:bg-canvas"
              >
                Mi perfil profesional
              </Link>
            )}

            <div className="my-1 h-px bg-line" />

            <button
              type="button"
              role="menuitem"
              onClick={salir}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-bold text-danger transition hover:bg-red-50"
            >
              Cerrar sesión
            </button>
          </div>
        </>
      )}
    </div>
  )
}
