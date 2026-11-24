import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast.jsx'
import * as oficiosRepo from '@/lib/data/oficios.repo.js'
import * as subareasRepo from '@/lib/data/subareas.repo.js'
import { mensajeError } from '@/lib/errores.js'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import Select from '@/components/ui/Select.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

export default function Oficios() {
  const { mostrar } = useToast()
  const [oficios, setOficios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [accionando, setAccionando] = useState(null)
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [editando, setEditando] = useState(null)
  const [editNombre, setEditNombre] = useState('')
  const [guardandoEdit, setGuardandoEdit] = useState(false)

  const [subareas, setSubareas] = useState([])
  const [subOficio, setSubOficio] = useState('')
  const [subNombre, setSubNombre] = useState('')
  const [editandoSub, setEditandoSub] = useState(null)
  const [editSubNombre, setEditSubNombre] = useState('')
  const [accionandoSub, setAccionandoSub] = useState(null)

  async function recargar() {
    const [data, subs] = await Promise.all([
      oficiosRepo.listarTodos(),
      subareasRepo.listarTodas(),
    ])
    setOficios(data)
    setSubareas(subs)
    if (!subOficio && data.length > 0) setSubOficio(data[0].id)
    setCargando(false)
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const pendientes = oficios.filter((o) => o.estado === 'pendiente')

  async function resolver(id, aprobar) {
    try {
      setAccionando(id)
      await oficiosRepo.aprobar(id, aprobar)
      await recargar()
      mostrar(aprobar ? 'Oficio aprobado.' : 'Oficio rechazado.', 'exito')
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAccionando(null)
    }
  }

  async function fusionar() {
    if (!origen || !destino) {
      mostrar('Elegí el duplicado y el oficio destino.', 'error')
      return
    }
    try {
      setAccionando('fusion')
      await oficiosRepo.fusionar(origen, destino)
      setOrigen('')
      setDestino('')
      await recargar()
      mostrar('Oficios fusionados.', 'exito')
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAccionando(null)
    }
  }

  function iniciarEdicion(o) {
    setEditando(o.id)
    setEditNombre(o.nombre)
  }

  function cancelarEdicion() {
    setEditando(null)
    setEditNombre('')
  }

  async function guardarNombre(id) {
    const nombre = editNombre.trim()
    if (!nombre) {
      mostrar('El nombre no puede quedar vacío.', 'error')
      return
    }
    try {
      setGuardandoEdit(true)
      await oficiosRepo.renombrar(id, nombre)
      await recargar()
      cancelarEdicion()
      mostrar('Oficio renombrado.', 'exito')
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setGuardandoEdit(false)
    }
  }

  async function cambiarEstado(o, activar) {
    if (
      !activar &&
      !window.confirm(`¿Desactivar «${o.nombre}»? Dejará de aparecer en el catálogo y las búsquedas.`)
    ) {
      return
    }
    try {
      setAccionando(o.id)
      await oficiosRepo.aprobar(o.id, activar)
      await recargar()
      mostrar(activar ? 'Oficio reactivado.' : 'Oficio desactivado.', 'exito')
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAccionando(null)
    }
  }

  async function resolverSub(id, aprobar) {
    try {
      setAccionandoSub(id)
      await subareasRepo.aprobar(id, aprobar)
      await recargar()
      mostrar(aprobar ? 'Especialidad aprobada.' : 'Especialidad rechazada.', 'exito')
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAccionandoSub(null)
    }
  }

  async function crearSub() {
    if (!subOficio || !subNombre.trim()) {
      mostrar('Elegí el oficio y escribí el nombre.', 'error')
      return
    }
    try {
      setAccionandoSub('crear')
      await subareasRepo.crear(subOficio, subNombre.trim())
      setSubNombre('')
      await recargar()
      mostrar('Especialidad propuesta. Aprobala para publicarla.', 'exito')
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAccionandoSub(null)
    }
  }

  async function guardarNombreSub(id) {
    const nombre = editSubNombre.trim()
    if (!nombre) {
      mostrar('El nombre no puede quedar vacío.', 'error')
      return
    }
    try {
      setAccionandoSub(id)
      await subareasRepo.renombrar(id, nombre)
      setEditandoSub(null)
      await recargar()
      mostrar('Especialidad renombrada.', 'exito')
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAccionandoSub(null)
    }
  }

  async function cambiarEstadoSub(s, activar) {
    try {
      setAccionandoSub(s.id)
      await subareasRepo.aprobar(s.id, activar)
      await recargar()
      mostrar(activar ? 'Especialidad reactivada.' : 'Especialidad desactivada.', 'exito')
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAccionandoSub(null)
    }
  }

  function editorDeNombreSub(s) {
    if (editandoSub !== s.id) return null
    return (
      <div className="mt-2 flex items-center gap-2">
        <Input
          className="min-w-0 flex-1"
          value={editSubNombre}
          onChange={(e) => setEditSubNombre(e.target.value)}
          placeholder="Nombre de la especialidad"
        />
        <Button
          className="px-3 py-2 text-sm"
          onClick={() => guardarNombreSub(s.id)}
          disabled={accionandoSub === s.id}
        >
          Guardar
        </Button>
        <Button
          variante="ghost"
          className="px-3 py-2 text-sm"
          onClick={() => setEditandoSub(null)}
        >
          Cancelar
        </Button>
      </div>
    )
  }

  function editorDeNombre(o) {
    if (editando !== o.id) return null
    return (
      <div className="flex items-center gap-2">
        <Input
          className="min-w-0 flex-1"
          value={editNombre}
          onChange={(e) => setEditNombre(e.target.value)}
          placeholder="Nombre del oficio"
        />
        <Button
          className="px-3 py-2 text-sm"
          onClick={() => guardarNombre(o.id)}
          disabled={guardandoEdit}
        >
          {guardandoEdit ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button variante="ghost" className="px-3 py-2 text-sm" onClick={cancelarEdicion}>
          Cancelar
        </Button>
      </div>
    )
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-16 text-primary">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Oficios</h1>
        <p className="mt-1 text-muted">
          Aprobá, corregí el nombre, desactivá oficios y fusioná duplicados.
        </p>
      </div>

      {/* Cola de pendientes */}
      <section>
        <h2 className="mb-3 text-lg font-bold">
          Pendientes <span className="text-muted">({pendientes.length})</span>
        </h2>

        {pendientes.length === 0 ? (
          <Card className="text-center">
            <p className="text-sm text-muted">No hay oficios pendientes de aprobación.</p>
          </Card>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {pendientes.map((o) => (
              <Card key={o.id} className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{o.nombre}</p>
                    <Badge estado="pendiente" className="mt-1">
                      Pendiente
                    </Badge>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variante="outline"
                      className="px-3 py-2 text-sm"
                      onClick={() => iniciarEdicion(o)}
                      disabled={guardandoEdit}
                    >
                      Renombrar
                    </Button>
                    <Button
                      className="px-3 py-2 text-sm"
                      onClick={() => resolver(o.id, true)}
                      disabled={accionando === o.id}
                    >
                      Aprobar
                    </Button>
                    <Button
                      variante="outline"
                      className="px-3 py-2 text-sm"
                      onClick={() => resolver(o.id, false)}
                      disabled={accionando === o.id}
                    >
                      Rechazar
                    </Button>
                  </div>
                </div>
                {editorDeNombre(o)}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Subáreas / especialidades */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-bold">Especialidades por oficio</h2>
          <p className="mt-1 text-sm text-muted">
            Las proponen los trabajadores. Aprobá, corregí o desactivá cada subárea.
          </p>
        </div>

        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <Select
              label="Oficio"
              value={subOficio}
              onChange={(e) => setSubOficio(e.target.value)}
            >
              <option value="">Elegí un oficio</option>
              {oficios.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </Select>
            <Input
              label="Nueva especialidad"
              value={subNombre}
              onChange={(e) => setSubNombre(e.target.value)}
              placeholder="Ej: Instalaciones sanitarias"
            />
            <Button onClick={crearSub} disabled={!subOficio || !subNombre.trim() || accionandoSub === 'crear'}>
              {accionandoSub === 'crear' ? 'Agregando…' : 'Agregar'}
            </Button>
          </div>

          {(() => {
            const pendientesSub = subareas.filter((s) => s.estado === 'pendiente')
            if (pendientesSub.length === 0) return null
            return (
              <div className="space-y-2 border-t border-line pt-4">
                <h3 className="text-sm font-bold text-warning">
                  Pendientes ({pendientesSub.length})
                </h3>
                {pendientesSub.map((s) => (
                  <div key={s.id} className="rounded-xl bg-canvas p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{s.nombre}</p>
                        <p className="text-xs text-muted">{s.oficioNombre}</p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variante="outline"
                          className="px-3 py-2 text-sm"
                          onClick={() => {
                            setEditandoSub(s.id)
                            setEditSubNombre(s.nombre)
                          }}
                        >
                          Renombrar
                        </Button>
                        <Button
                          className="px-3 py-2 text-sm"
                          onClick={() => resolverSub(s.id, true)}
                          disabled={accionandoSub === s.id}
                        >
                          Aprobar
                        </Button>
                        <Button
                          variante="outline"
                          className="px-3 py-2 text-sm"
                          onClick={() => resolverSub(s.id, false)}
                          disabled={accionandoSub === s.id}
                        >
                          Rechazar
                        </Button>
                      </div>
                    </div>
                    {editorDeNombreSub(s)}
                  </div>
                ))}
              </div>
            )
          })()}

          <div className="space-y-2 border-t border-line pt-4">
            <h3 className="text-sm font-bold">Activas e inactivas</h3>
            {subareas.filter((s) => s.estado !== 'pendiente').length === 0 ? (
              <p className="text-sm text-muted">Todavía no hay especialidades aprobadas.</p>
            ) : (
              subareas
                .filter((s) => s.estado !== 'pendiente')
                .map((s) => (
                  <div key={s.id} className="rounded-xl border border-line p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{s.nombre}</p>
                        <p className="text-xs text-muted">{s.oficioNombre}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge estado={s.estado} />
                        <Button
                          variante="ghost"
                          className="px-3 py-2 text-sm"
                          onClick={() => {
                            setEditandoSub(s.id)
                            setEditSubNombre(s.nombre)
                          }}
                        >
                          Renombrar
                        </Button>
                        <Button
                          variante="outline"
                          className="px-3 py-2 text-sm"
                          onClick={() => cambiarEstadoSub(s, s.estado !== 'activo')}
                          disabled={accionandoSub === s.id}
                        >
                          {s.estado === 'activo' ? 'Desactivar' : 'Reactivar'}
                        </Button>
                      </div>
                    </div>
                    {editorDeNombreSub(s)}
                  </div>
                ))
            )}
          </div>
        </Card>
      </section>

      {/* Fusionar */}
      <Card className="space-y-4">
        <div>
          <h2 className="font-bold">Fusionar oficios duplicados</h2>
          <p className="mt-1 text-sm text-muted">
            Reasigna trabajadores y solicitudes del duplicado al oficio destino, y desactiva
            el duplicado.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Duplicado (a desactivar)" value={origen} onChange={(e) => setOrigen(e.target.value)}>
            <option value="">Elegí un oficio</option>
            {oficios
              .filter((o) => o.estado !== 'inactivo')
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
          </Select>
          <Select label="Oficio destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Elegí un oficio</option>
            {oficios
              .filter((o) => o.estado !== 'inactivo' && o.id !== origen)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
          </Select>
        </div>
        <Button
          className="w-full sm:w-auto"
          onClick={fusionar}
          disabled={accionando === 'fusion' || !origen || !destino}
        >
          {accionando === 'fusion' ? 'Fusionando…' : 'Fusionar oficios'}
        </Button>
      </Card>

      {/* Catálogo completo */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Catálogo</h2>
        <Card className="divide-y divide-line p-0">
          {oficios.map((o) => (
            <div key={o.id} className="space-y-3 px-5 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-semibold text-ink">{o.nombre}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge estado={o.estado} />
                  <Button
                    variante="ghost"
                    className="px-3 py-1.5 text-sm"
                    onClick={() => iniciarEdicion(o)}
                    disabled={guardandoEdit}
                  >
                    Renombrar
                  </Button>
                  {o.estado === 'activo' && (
                    <Button
                      variante="outline"
                      className="px-3 py-1.5 text-sm"
                      onClick={() => cambiarEstado(o, false)}
                      disabled={accionando === o.id}
                    >
                      Desactivar
                    </Button>
                  )}
                  {o.estado === 'inactivo' && (
                    <Button
                      variante="outline"
                      className="px-3 py-1.5 text-sm"
                      onClick={() => cambiarEstado(o, true)}
                      disabled={accionando === o.id}
                    >
                      Reactivar
                    </Button>
                  )}
                </div>
              </div>
              {editorDeNombre(o)}
            </div>
          ))}
        </Card>
      </section>
    </div>
  )
}
