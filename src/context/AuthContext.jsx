import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as authRepo from '@/lib/data/auth.repo.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    let activo = true
    authRepo
      .sesionActual()
      .then((u) => activo && setUsuario(u))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  const registrar = useCallback(async (datos) => {
    const u = await authRepo.registrar(datos)
    setUsuario(u)
    return u
  }, [])

  const iniciarSesion = useCallback(async (datos) => {
    const u = await authRepo.iniciarSesion(datos)
    setUsuario(u)
    return u
  }, [])

  const cerrarSesion = useCallback(async () => {
    await authRepo.cerrarSesion()
    setUsuario(null)
  }, [])

  const actualizarUsuario = useCallback(
    async (datos) => {
      const u = await authRepo.actualizarPerfil(usuario.id, datos)
      setUsuario(u)
      return u
    },
    [usuario],
  )

  const value = { usuario, cargando, registrar, iniciarSesion, cerrarSesion, actualizarUsuario }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
