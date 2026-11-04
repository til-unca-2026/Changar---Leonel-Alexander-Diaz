import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import * as adminRepo from '@/lib/data/admin.repo.js'
import { fechaRelativa } from '@/lib/format.js'
import Avatar from '@/components/ui/Avatar.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import Select from '@/components/ui/Select.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

const ROL = { cliente: 'Cliente', trabajador: 'Trabajador', admin: 'Administrador' }

export default function Explorar() {
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [query, setQuery] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')

  useEffect(() => {
    let activo = true
    adminRepo
      .listarUsuarios()
      .then((data) => activo && setUsuarios(data))
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [])

  const filtrados = useMemo(() => {
    return usuarios.filter((u) => {
      if (filtroRol !== 'todos' && u.rol !== filtroRol) return false
      if (!query) return true
      const q = query.toLowerCase()
      const nombre = `${u.nombre} ${u.apellido}`.toLowerCase()
      return nombre.includes(q) || (u.email ?? '').toLowerCase().includes(q)
    })
  }, [usuarios, query, filtroRol])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Explorar perfiles</h1>
        <p className="mt-1 text-muted">Todos los usuarios de la plataforma.</p>
      </div>

      <Card className="space-y-3">
        <Input
          placeholder="Buscar por nombre o email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={filtroRol} onChange={(e) => setFiltroRol(e.target.value)}>
          <option value="todos">Todos los roles</option>
          <option value="cliente">Clientes</option>
          <option value="trabajador">Trabajadores</option>
          <option value="admin">Administradores</option>
        </Select>
      </Card>

      {cargando ? (
        <div className="flex justify-center py-12 text-primary">
          <Spinner className="h-8 w-8" />
        </div>
      ) : filtrados.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-semibold text-ink">No hay perfiles que coincidan</p>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted">
            {filtrados.length} {filtrados.length === 1 ? 'perfil' : 'perfiles'}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {filtrados.map((u) => (
              <Card key={u.id}>
                <div className="flex items-start gap-3">
                  <Avatar usuario={u} tamano="md" />
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/perfiles/${u.id}`}
                      className="block truncate font-bold text-ink hover:underline"
                    >
                      {u.nombre} {u.apellido}
                    </Link>
                    <p className="truncate text-xs text-muted">{u.email}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge estado="neutral">{ROL[u.rol]}</Badge>
                      {!u.activo ? (
                        <Badge estado="cancelado">Baneado</Badge>
                      ) : u.baneadoHasta && new Date(u.baneadoHasta) > new Date() ? (
                        <Badge estado="asignada">Suspendido</Badge>
                      ) : (
                        <Badge estado="activo">Activo</Badge>
                      )}
                      {u.marcas > 0 && <Badge estado="asignada">{u.marcas} ⚠</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      En ChangAr {fechaRelativa(u.createdAt)}
                    </p>
                  </div>
                </div>

                <Link
                  to={`/perfiles/${u.id}`}
                  className="mt-3 block text-sm font-bold text-primary"
                >
                  Ver perfil público →
                </Link>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
