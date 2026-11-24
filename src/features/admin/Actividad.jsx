import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext.jsx'
import * as auditoriaRepo from '@/lib/data/auditoria.repo.js'
import * as adminRepo from '@/lib/data/admin.repo.js'
import { fechaHora } from '@/lib/format.js'
import { mensajeError } from '@/lib/errores.js'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import Select from '@/components/ui/Select.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

const ENTIDADES = {
  perfiles: 'Cuenta',
  perfiles_cliente: 'Perfil de cliente',
  perfiles_trabajador: 'Perfil de trabajador',
  perfil_contacto: 'Teléfono',
  oficios: 'Oficio',
  trabajador_oficios: 'Oficios del trabajador',
  portfolio_fotos: 'Portfolio',
  solicitudes: 'Solicitud',
  solicitud_fotos: 'Fotos de solicitud',
  propuestas: 'Propuesta',
  contrataciones: 'Contratación',
  contratacion_evidencias: 'Evidencia',
  valoraciones: 'Valoración',
  reportes: 'Reporte',
  sanciones: 'Sanción',
  marcas_advertencia: 'Advertencia',
  invitaciones_admin: 'Invitación',
}

const CAMPOS = {
  nombre: 'nombre',
  estado: 'estado',
  titulo: 'título',
  descripcion: 'descripción',
  zona: 'zona',
  ubicacion: 'ubicación',
  telefono: 'teléfono',
  activo: 'activo',
  rol: 'rol',
  presupuesto_max: 'presupuesto',
  baneado_hasta: 'sanción',
  radio_km: 'radio',
}

const ACCIONES = {
  alta: { estado: 'aceptada', texto: 'Alta' },
  cambio: { estado: 'pendiente', texto: 'Cambio' },
  baja: { estado: 'cancelada', texto: 'Baja' },
}

function legible(valor) {
  if (valor === null || valor === undefined) return '—'
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor).slice(0, 70)
}

function resumen(detalle) {
  const pares = Object.entries(detalle ?? {})
  if (pares.length === 0) return ''
  return pares
    .slice(0, 4)
    .map(([campo, cambios]) => {
      const antes = legible(cambios?.antes)
      const despues = legible(cambios?.despues)
      return `${CAMPOS[campo] ?? campo}: ${antes} → ${despues}`
    })
    .join(' · ')
}

export default function Actividad() {
  const { usuario } = useAuth()
  const esSuper = Boolean(usuario?.esSuperadmin)

  const [usuarios, setUsuarios] = useState([])
  const [filtros, setFiltros] = useState({ usuarioId: '', tabla: '', desde: '', hasta: '' })
  const [eventos, setEventos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cargandoMas, setCargandoMas] = useState(false)
  const [error, setError] = useState('')
  const [hayMas, setHayMas] = useState(false)

  useEffect(() => {
    adminRepo
      .listarUsuarios()
      .then(setUsuarios)
      .catch(() => setUsuarios([]))
  }, [])

  useEffect(() => {
    let activo = true
    setCargando(true)
    setError('')
    const timer = setTimeout(() => {
      auditoriaRepo
        .listar(filtros)
        .then((lista) => {
          if (!activo) return
          setEventos(lista)
          setHayMas(lista.length === auditoriaRepo.POR_PAGINA)
        })
        .catch((err) => activo && setError(mensajeError(err)))
        .finally(() => activo && setCargando(false))
    }, 250)
    return () => {
      activo = false
      clearTimeout(timer)
    }
  }, [filtros])

  async function cargarMas() {
    try {
      setCargandoMas(true)
      const lista = await auditoriaRepo.listar({ ...filtros, offset: eventos.length })
      setEventos((actual) => [...actual, ...lista])
      setHayMas(lista.length === auditoriaRepo.POR_PAGINA)
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setCargandoMas(false)
    }
  }

  function cambiarFiltro(nombre, valor) {
    setFiltros((f) => ({ ...f, [nombre]: valor }))
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Actividad</h1>
        <p className="mt-1 text-muted">
          {esSuper
            ? 'Registro de acciones de todos los usuarios, incluidos los administradores.'
            : 'Registro de acciones de clientes y trabajadores.'}
        </p>
      </div>

      <Card className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Usuario"
            value={filtros.usuarioId}
            onChange={(e) => cambiarFiltro('usuarioId', e.target.value)}
          >
            <option value="">Todos</option>
            {usuarios
              .filter((u) => esSuper || u.rol !== 'admin')
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre} {u.apellido} · {u.rol}
                </option>
              ))}
          </Select>
          <Select
            label="Acción sobre"
            value={filtros.tabla}
            onChange={(e) => cambiarFiltro('tabla', e.target.value)}
          >
            <option value="">Todo</option>
            {Object.entries(ENTIDADES).map(([clave, texto]) => (
              <option key={clave} value={clave}>
                {texto}
              </option>
            ))}
          </Select>
          <Input
            label="Desde"
            type="date"
            value={filtros.desde}
            onChange={(e) => cambiarFiltro('desde', e.target.value)}
          />
          <Input
            label="Hasta"
            type="date"
            value={filtros.hasta}
            onChange={(e) => cambiarFiltro('hasta', e.target.value)}
          />
        </div>
        {(filtros.usuarioId || filtros.tabla || filtros.desde || filtros.hasta) && (
          <Button
            variante="ghost"
            className="px-3 py-2 text-sm"
            onClick={() => setFiltros({ usuarioId: '', tabla: '', desde: '', hasta: '' })}
          >
            Limpiar filtros
          </Button>
        )}
      </Card>

      {error && <p className="text-sm font-semibold text-danger">{error}</p>}

      {cargando ? (
        <div className="flex justify-center py-12 text-primary">
          <Spinner className="h-8 w-8" />
        </div>
      ) : eventos.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="font-semibold text-ink">No hay actividad para mostrar</p>
          <p className="mt-1 text-sm text-muted">Probá con otros filtros.</p>
        </Card>
      ) : (
        <>
          <Card className="divide-y divide-line p-0">
            {eventos.map((e) => {
              const accion = ACCIONES[e.accion] ?? ACCIONES.cambio
              return (
                <div key={e.id} className="space-y-2 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">
                        {e.actorNombre}
                        {e.esSuperadmin && (
                          <span className="ml-2 text-xs font-bold text-success">Dueño</span>
                        )}
                      </p>
                      <p className="text-xs capitalize text-muted">{e.actorRol || 'Sistema'}</p>
                    </div>
                    <p className="text-xs text-muted">{fechaHora(e.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge estado={accion.estado}>{accion.texto}</Badge>
                    <span className="text-sm font-semibold text-ink">
                      {ENTIDADES[e.tabla] ?? e.tabla}
                    </span>
                  </div>
                  {resumen(e.detalle) && (
                    <p className="break-words text-xs text-muted">{resumen(e.detalle)}</p>
                  )}
                </div>
              )
            })}
          </Card>

          {hayMas && (
            <div className="flex justify-center">
              <Button variante="outline" onClick={cargarMas} disabled={cargandoMas}>
                {cargandoMas ? 'Cargando…' : 'Cargar más'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
