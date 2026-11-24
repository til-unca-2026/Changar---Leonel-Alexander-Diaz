import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import * as adminRepo from '@/lib/data/admin.repo.js'
import { mensajeError } from '@/lib/errores.js'
import Avatar from '@/components/ui/Avatar.jsx'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import ConfirmarAccion from '@/components/ui/ConfirmarAccion.jsx'
import Input from '@/components/ui/Input.jsx'
import Select from '@/components/ui/Select.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

const ROL = { cliente: 'Cliente', trabajador: 'Trabajador', admin: 'Administrador' }

const ESTADO_INVITACION = {
  pendiente: { etiqueta: 'Pendiente', estado: 'asignada' },
  aceptada: { etiqueta: 'Aceptada', estado: 'activo' },
  cancelada: { etiqueta: 'Cancelada', estado: 'cancelado' },
  expirada: { etiqueta: 'Vencida', estado: 'cancelado' },
}

/** Diálogos de sanción: textos y configuración de cada acción. */
const DIALOGOS = {
  marcar: {
    titulo: 'Marcar perfil',
    mensaje: (u) =>
      `Se registrará una advertencia privada en el historial de ${u.nombre} ${u.apellido}.`,
    textoConfirmar: 'Marcar',
    varianteConfirmar: 'primary',
    motivo: true,
    ok: 'Marca de advertencia aplicada.',
  },
  ban7: {
    titulo: 'Suspender 7 días',
    mensaje: (u) =>
      `Se suspenderá a ${u.nombre} ${u.apellido} por 7 días: no podrá recibir solicitudes.`,
    textoConfirmar: 'Suspender 7 días',
    varianteConfirmar: 'outline',
    motivo: true,
    ok: 'Cuenta suspendida.',
  },
  ban30: {
    titulo: 'Suspender 30 días',
    mensaje: (u) =>
      `Se suspenderá a ${u.nombre} ${u.apellido} por 30 días: no podrá recibir solicitudes.`,
    textoConfirmar: 'Suspender 30 días',
    varianteConfirmar: 'outline',
    motivo: true,
    ok: 'Cuenta suspendida.',
  },
  ban: {
    titulo: 'Banear permanentemente',
    mensaje: (u) =>
      `Se bloqueará la cuenta de ${u.nombre} ${u.apellido}. Se cancelan sus solicitudes abiertas y se retiran sus propuestas enviadas.`,
    textoConfirmar: 'Banear',
    varianteConfirmar: 'danger',
    motivo: true,
    ok: 'Cuenta bloqueada.',
  },
  desbanear: {
    titulo: 'Reactivar cuenta',
    mensaje: (u) =>
      `La cuenta de ${u.nombre} ${u.apellido} volverá a estar habilitada y podrá operar con normalidad.`,
    textoConfirmar: 'Reactivar',
    varianteConfirmar: 'primary',
    motivo: false,
    ok: 'Cuenta reactivada.',
  },
}

const DIAS_DIALOGO = { ban7: 7, ban30: 30, ban: null }

/** Link de registro de una invitación de administrador. */
function linkDeInvitacion(token) {
  return `${window.location.origin}/registro?invitacion=${token}`
}

function CopiarLink({ token, onCopiado }) {
  async function copiar() {
    try {
      await navigator.clipboard.writeText(linkDeInvitacion(token))
      onCopiado()
    } catch {
      // sin permiso de portapapeles: el link queda visible para copiar a mano
      onCopiado(false)
    }
  }
  return (
    <Button variante="outline" className="px-3 py-2 text-sm" onClick={copiar}>
      Copiar link
    </Button>
  )
}

export default function Usuarios() {
  const { usuario } = useAuth()
  const { mostrar } = useToast()
  const [usuarios, setUsuarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [filtroRol, setFiltroRol] = useState('todos')
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [dialogo, setDialogo] = useState(null)
  const [procesandoDialogo, setProcesandoDialogo] = useState(false)

  const esDueño = Boolean(usuario?.esSuperadmin)
  const [invitaciones, setInvitaciones] = useState([])
  const [cargandoInvitaciones, setCargandoInvitaciones] = useState(false)
  const [creandoInvitacion, setCreandoInvitacion] = useState(false)
  const [formInvitacion, setFormInvitacion] = useState({ email: '', nombre: '', apellido: '' })
  const [ultimaInvitacion, setUltimaInvitacion] = useState(null)

  async function recargar() {
    setUsuarios(await adminRepo.listarUsuarios())
    setCargando(false)
  }

  async function recargarInvitaciones() {
    if (!esDueño) return
    setCargandoInvitaciones(true)
    try {
      setInvitaciones(await adminRepo.listarInvitaciones())
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setCargandoInvitaciones(false)
    }
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    recargarInvitaciones()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esDueño])

  const filtrados = useMemo(() => {
    return usuarios.filter((u) => {
      // Un administrador normal no ve cuentas de administrador.
      if (!esDueño && u.rol === 'admin') return false
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
  }, [usuarios, busqueda, filtroRol, filtroEstado, esDueño])

  async function aplicar(fn, okMsg) {
    try {
      await fn()
      mostrar(okMsg, 'exito')
      await recargar()
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    }
  }

  function abrirDialogo(tipo, u) {
    setDialogo({ tipo, usuario: u })
  }

  async function confirmarDialogo(motivoSancion) {
    if (!dialogo) return
    const { tipo, usuario: u } = dialogo
    const config = DIALOGOS[tipo]
    setProcesandoDialogo(true)
    try {
      if (tipo === 'desbanear') {
        await adminRepo.desbanear(u.id)
      } else if (tipo === 'marcar') {
        await adminRepo.marcar(u.id, motivoSancion)
      } else {
        await adminRepo.banear(u.id, DIAS_DIALOGO[tipo], motivoSancion)
      }
      mostrar(config.ok, 'exito')
      setDialogo(null)
      await recargar()
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setProcesandoDialogo(false)
    }
  }

  function cambiarRol(u, rol) {
    aplicar(() => adminRepo.cambiarRol(u.id, rol), 'Rol actualizado.')
  }

  async function crearInvitacion(e) {
    e.preventDefault()
    const { email, nombre, apellido } = formInvitacion
    if (!email.trim()) {
      mostrar('Ingresá el email de quien vas a invitar.', 'error')
      return
    }
    setCreandoInvitacion(true)
    try {
      const inv = await adminRepo.crearInvitacion({ email, nombre, apellido })
      setUltimaInvitacion(inv)
      setFormInvitacion({ email: '', nombre: '', apellido: '' })
      mostrar('Invitación generada. Compartí el link con la persona invitada.', 'exito')
      await recargarInvitaciones()
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setCreandoInvitacion(false)
    }
  }

  async function cancelarInvitacion(inv) {
    if (!window.confirm(`Cancelar la invitación para ${inv.email}?`)) return
    try {
      await adminRepo.cancelarInvitacion(inv.id)
      mostrar('Invitación cancelada.', 'exito')
      await recargarInvitaciones()
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    }
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

      {esDueño && (
        <Card className="space-y-4">
          <div>
            <h2 className="font-bold">Crear administrador</h2>
            <p className="mt-1 text-sm text-muted">
              Generás un link de un solo uso y lo compartís con la persona invitada. Ella crea su
              cuenta con su propia contraseña y entra directo al panel.
            </p>
          </div>

          <form onSubmit={crearInvitacion} className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Email"
              type="email"
              value={formInvitacion.email}
              onChange={(e) =>
                setFormInvitacion((f) => ({ ...f, email: e.target.value }))
              }
              placeholder="admin@changar.com"
            />
            <Input
              label="Nombre"
              value={formInvitacion.nombre}
              onChange={(e) =>
                setFormInvitacion((f) => ({ ...f, nombre: e.target.value }))
              }
              placeholder="Ana"
            />
            <Input
              label="Apellido"
              value={formInvitacion.apellido}
              onChange={(e) =>
                setFormInvitacion((f) => ({ ...f, apellido: e.target.value }))
              }
              placeholder="Gómez"
            />
            <div className="sm:col-span-3">
              <Button tipo="submit" disabled={creandoInvitacion}>
                {creandoInvitacion ? 'Generando…' : 'Generar invitación'}
              </Button>
            </div>
          </form>

          {ultimaInvitacion && (
            <div className="rounded-xl border border-primary/30 bg-primary-soft p-4">
              <p className="font-bold text-primary">Invitación para {ultimaInvitacion.email}</p>
              <p className="mt-1 break-all text-sm text-ink">{linkDeInvitacion(ultimaInvitacion.token)}</p>
              <p className="mt-1 text-xs text-muted">
                Vence el {new Date(ultimaInvitacion.expira_at).toLocaleDateString('es-AR')} y se
                puede usar una sola vez.
              </p>
              <div className="mt-3">
                <CopiarLink
                  token={ultimaInvitacion.token}
                  onCopiado={(ok = true) =>
                    mostrar(ok ? 'Link copiado.' : 'Copiá el link manualmente.', ok ? 'exito' : 'info')
                  }
                />
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Invitaciones</h3>
            {cargandoInvitaciones ? (
              <div className="mt-3 flex justify-center py-6 text-primary">
                <Spinner className="h-6 w-6" />
              </div>
            ) : invitaciones.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Todavía no generaste ninguna invitación.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {invitaciones.map((inv) => {
                  const est = ESTADO_INVITACION[inv.estado] ?? {
                    etiqueta: inv.estado,
                    estado: 'neutral',
                  }
                  return (
                    <div
                      key={inv.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{inv.email}</p>
                        <p className="truncate text-xs text-muted">
                          {[inv.nombre, inv.apellido].filter(Boolean).join(' ') || 'Sin nombre'} ·
                          creada por {inv.creadoPorNombre || '—'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge estado={est.estado}>{est.etiqueta}</Badge>
                        {inv.estado === 'pendiente' && (
                          <>
                            <CopiarLink
                              token={inv.token}
                              onCopiado={(ok = true) =>
                                mostrar(
                                  ok ? 'Link copiado.' : 'Copiá el link manualmente.',
                                  ok ? 'exito' : 'info'
                                )
                              }
                            />
                            <Button
                              variante="danger"
                              className="px-3 py-2 text-sm"
                              onClick={() => cancelarInvitacion(inv)}
                            >
                              Cancelar
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Card>
      )}

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
            {esDueño && <option value="admin">Administrador</option>}
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
                        {u.esSuperadmin && <Badge estado="activo">Dueño</Badge>}
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

                  {!esYo && (esDueño || u.rol !== 'admin') && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variante="outline"
                        className="px-3 py-2 text-sm"
                        onClick={() => abrirDialogo('marcar', u)}
                      >
                        Marcar
                      </Button>
                      {u.activo && !suspendido ? (
                        <>
                          <Button
                            variante="outline"
                            className="px-3 py-2 text-sm"
                            onClick={() => abrirDialogo('ban7', u)}
                          >
                            7d
                          </Button>
                          <Button
                            variante="outline"
                            className="px-3 py-2 text-sm"
                            onClick={() => abrirDialogo('ban30', u)}
                          >
                            30d
                          </Button>
                          <Button
                            variante="danger"
                            className="px-3 py-2 text-sm"
                            onClick={() => abrirDialogo('ban', u)}
                          >
                            Ban
                          </Button>
                        </>
                      ) : (
                        <Button
                          className="px-3 py-2 text-sm"
                          onClick={() => abrirDialogo('desbanear', u)}
                        >
                          Desbanear
                        </Button>
                      )}
                      {u.esSuperadmin ? (
                        <span className="text-xs text-muted">Dueño</span>
                      ) : u.rol !== 'admin' || esDueño ? (
                        <Select
                          className="w-auto"
                          value=""
                          onChange={(e) => e.target.value && cambiarRol(u, e.target.value)}
                        >
                          <option value="">Rol…</option>
                          <option value="cliente">Cliente</option>
                          <option value="trabajador">Trabajador</option>
                          {esDueño && <option value="admin">Admin</option>}
                        </Select>
                      ) : (
                        <span className="text-xs text-muted">Admin</span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {dialogo && (
        <ConfirmarAccion
          abierto
          titulo={DIALOGOS[dialogo.tipo].titulo}
          mensaje={DIALOGOS[dialogo.tipo].mensaje(dialogo.usuario)}
          motivoRequerido={Boolean(DIALOGOS[dialogo.tipo].motivo)}
          etiquetaMotivo="Motivo de la sanción"
          textoConfirmar={DIALOGOS[dialogo.tipo].textoConfirmar}
          varianteConfirmar={DIALOGOS[dialogo.tipo].varianteConfirmar}
          cargando={procesandoDialogo}
          onConfirmar={confirmarDialogo}
          onCancelar={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
