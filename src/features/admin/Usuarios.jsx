import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import * as adminRepo from '@/lib/data/admin.repo.js'
import { mensajeError } from '@/lib/errores.js'
import Avatar from '@/components/ui/Avatar.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import Select from '@/components/ui/Select.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

const ROL = { cliente: 'Cliente', trabajador: 'Trabajador', admin: 'Administrador' }

export default function Usuarios() {
  const { usuario } = useAuth()
  const { mostrar } = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [marcando, setMarcando] = useState(null)
  const [motivo, setMotivo] = useState('')
  const [accionando, setAccionando] = useState(null)

  async function recargar() {
    setUsuarios(await adminRepo.listarUsuarios())
    setCargando(false)
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtrados = useMemo(() => {
    return usuarios.filter((u) => {
      if (busqueda) {
        const q = busqueda.toLowerCase()
        const nombre = `${u.nombre} ${u.apellido}`.toLowerCase()
        if (!nombre.includes(q) && !u.email?.toLowerCase().includes(q)) return false
      }
      if (filtroRol !== 'todos' && u.rol !== filtroRol) return false
      const suspendido = u.baneadoHasta && new Date(u.baneadoHasta) > new Date()
      const estado = !u.activo ? 'baneado' : suspendido ? 'suspendido' : 'activo'
      if (filtroEstado === 'con_marcas') {
        if (!(u.marcas > 0)) return false
      } else if (filtroEstado !== 'todos' && estado !== filtroEstado) {
        return false
      }
      return true
    })
  }, [usuarios, busqueda, filtroRol, filtroEstado])

  async function aplicar(fn, okMsg) {
    try {
      await fn()
      mostrar(okMsg, 'exito')
      await recargar()
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAccionando(null)
    }
  }

  function banear(u, dias) {
    if (!window.confirm(dias ? `Suspender a ${u.nombre} por ${dias} días?` : `BLOQUEAR permanentemente a ${u.nombre}?`)) return
    setAccionando(u.id)
    aplicar(() => adminRepo.banear(u.id, dias), dias ? 'Cuenta suspendida.' : 'Cuenta bloqueada.')
  }

  function desbanear(u) {
    setAccionando(u.id)
    aplicar(() => adminRepo.desbanear(u.id), 'Cuenta reactivada.')
  }

  function cambiarRol(u, rol) {
    setAccionando(u.id)
    aplicar(() => adminRepo.cambiarRol(u.id, rol), 'Rol actualizado.')
  }

  function marcar(u) {
    if (!motivo.trim()) {
      mostrar('Escribí el motivo de la advertencia.', 'error')
      return
    }
    setAccionando(u.id)
    aplicar(() => adminRepo.marcar(u.id, motivo), 'Marca de advertencia aplicada.')
    setMarcando(null)
    setMotivo('')
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-16 text-primary">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Usuarios</h1>
        <p className="mt-1 text-muted">Gestioná cuentas, sanciones y roles.</p>
      </div>

      <Card className="space-y-3">
        <Input
          placeholder="Buscar por nombre o email…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
            <option value="todos">Todos los roles</option>
            <option value="cliente">Cliente</option>
            <option value="trabajador">Trabajador</option>
            <option value="admin">Administrador</option>
          </Select>
          <Select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="todos">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
            <option value="baneado">Baneado</option>
            <option value="con_marcas">Con advertencias</option>
          </Select>
        </div>
      </Card>

      {filtrados.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-semibold text-ink">No hay usuarios que coincidan</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtrados.map((u) => {
            const suspendido = u.baneadoHasta && new Date(u.baneadoHasta) > new Date()
            const esYo = u.id === usuario.id
            return (
              <Card key={u.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar usuario={u} tamano="md" />
                    <div className="min-w-0">
                      <p className="truncate font-bold text-ink">
                        {u.nombre} {u.apellido} {esYo && <span className="text-muted">(vos)</span>}
                      </p>
                      <p className="truncate text-xs text-muted">{u.email}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <Badge estado="neutral">{ROL[u.rol]}</Badge>
                        {!u.activo ? (
                          <Badge estado="cancelado">Baneado</Badge>
                        ) : suspendido ? (
                          <Badge estado="asignada">Suspendido</Badge>
                        ) : (
                          <Badge estado="activo">Activo</Badge>
                        )}
                        {u.marcas > 0 && <Badge estado="asignada">{u.marcas} ⚠</Badge>}
                        {u.reportesPendientes > 0 && (
                          <Badge estado="cancelado">{u.reportesPendientes} reporte(s)</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {!esYo && (
                    <div className="flex flex-wrap gap-2">
                      {marcando === u.id ? (
                        <div className="flex w-full items-center gap-2">
                          <Input
                            placeholder="Motivo de la advertencia"
                            value={motivo}
                            onChange={(e) => setMotivo(e.target.value)}
                            className="flex-1"
                          />
                          <Button className="px-3 py-2 text-sm" onClick={() => marcar(u)} disabled={accionando === u.id}>
                            Aplicar
                          </Button>
                          <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => { setMarcando(null); setMotivo('') }}>
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <>
                          <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => { setMarcando(u.id); setMotivo('') }}>
                            Marcar
                          </Button>
                          {u.activo && !suspendido ? (
                            <>
                              <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => banear(u, 7)} disabled={accionando === u.id}>
                                7d
                              </Button>
                              <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => banear(u, 30)} disabled={accionando === u.id}>
                                30d
                              </Button>
                              <Button variante="danger" className="px-3 py-2 text-sm" onClick={() => banear(u, null)} disabled={accionando === u.id}>
                                Ban
                              </Button>
                            </>
                          ) : (
                            <Button className="px-3 py-2 text-sm" onClick={() => desbanear(u)} disabled={accionando === u.id}>
                              Desbanear
                            </Button>
                          )}
                          {u.rol !== 'admin' ? (
                            <Select
                              className="w-auto"
                              value=""
                              onChange={(e) => e.target.value && cambiarRol(u, e.target.value)}
                            >
                              <option value="">Rol…</option>
                              <option value="cliente">Cliente</option>
                              <option value="trabajador">Trabajador</option>
                              <option value="admin">Admin</option>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted">Admin</span>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
