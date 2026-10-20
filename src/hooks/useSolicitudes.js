import { useCallback, useEffect, useState } from 'react'
import * as solicitudesRepo from '@/lib/data/solicitudes.repo.js'
import * as oficiosRepo from '@/lib/data/oficios.repo.js'

export function useSolicitudesCliente(clienteId) {
  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(true)

  const recargar = useCallback(async () => {
    if (!clienteId) return
    setCargando(true)
    try {
      setSolicitudes(await solicitudesRepo.listarPorCliente(clienteId))
    } finally {
      setCargando(false)
    }
  }, [clienteId])

  useEffect(() => {
    recargar()
  }, [recargar])

  return { solicitudes, cargando, recargar }
}

export function useOficios() {
  const [oficios, setOficios] = useState([])

  useEffect(() => {
    let activo = true
    oficiosRepo.listar().then((lista) => activo && setOficios(lista))
    return () => {
      activo = false
    }
  }, [])

  return oficios
}
