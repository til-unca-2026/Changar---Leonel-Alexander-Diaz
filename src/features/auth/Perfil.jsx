import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import * as perfilClienteRepo from '@/lib/data/perfilCliente.repo.js'
import * as propuestasRepo from '@/lib/data/propuestas.repo.js'
import * as solicitudesRepo from '@/lib/data/solicitudes.repo.js'
import { subirAvatar } from '@/lib/data/almacenamiento.js'
import { mensajeError } from '@/lib/errores.js'
import AvatarUploader from '@/features/trabajador/AvatarUploader.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import Textarea from '@/components/ui/Textarea.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

const ETIQUETA_ROL = {
  cliente: 'Cliente',
  trabajador: 'Trabajador',
  admin: 'Administrador',
}

export default function Perfil() {
  const { usuario, actualizarUsuario, cerrarSesion } = useAuth()
  const { mostrar } = useToast()
  const navigate = useNavigate()

  const esCliente = usuario?.rol === 'cliente'

  const [cargando, setCargando] = useState(esCliente)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [apellido, setApellido] = useState(usuario?.apellido ?? '')
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '')
  const [avatarFile, setAvatarFile] = useState(null)
  const [zona, setZona] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!esCliente) {
      setCargando(false)
      return
    }
    let activo = true
    perfilClienteRepo
      .obtener(usuario.id)
      .then((p) => {
        if (!activo) return
        setZona(p.zona)
        setDescripcion(p.descripcion)
      })
      .finally(() => activo && setCargando(false))
    return () => {
      activo = false
    }
  }, [usuario?.id, esCliente])

  useEffect(() => {
    let activo = true

    if (usuario?.rol === 'trabajador') {
      propuestasRepo.listarPorTrabajador(usuario.id).then((props) => {
        if (!activo) return
        setStats([
          { etiqueta: 'Propuestas enviadas', valor: props.length },
          { etiqueta: 'Pendientes', valor: props.filter((p) => p.estado === 'enviada').length },
          { etiqueta: 'Aceptadas', valor: props.filter((p) => p.estado === 'aceptada').length },
        ])
      })
    } else if (usuario?.rol === 'cliente') {
      solicitudesRepo.listarPorCliente(usuario.id).then((sols) => {
        if (!activo) return
        setStats([
          { etiqueta: 'Solicitudes publicadas', valor: sols.length },
          { etiqueta: 'Abiertas', valor: sols.filter((s) => s.estado === 'abierta').length },
          {
            etiqueta: 'Propuestas recibidas',
            valor: sols.reduce((acc, s) => acc + (s.propuestasCount ?? 0), 0),
          },
        ])
      })
    }

    return () => {
      activo = false
    }
  }, [usuario?.id, usuario?.rol])

  async function guardar() {
    setError('')
    if (!nombre.trim() || !apellido.trim()) {
      setError('El nombre y el apellido no pueden quedar vacíos.')
      return
    }

    try {
      setGuardando(true)
      const datos = { nombre, apellido, telefono }
      if (avatarFile) datos.avatar = await subirAvatar(usuario.id, avatarFile)

      await actualizarUsuario(datos)
      if (esCliente) {
        await perfilClienteRepo.guardar(usuario.id, { zona, descripcion })
      }
      setAvatarFile(null)
      mostrar('Datos actualizados.', 'exito')
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setGuardando(false)
    }
  }

  async function salir() {
    await cerrarSesion()
    mostrar('Cerraste sesión.', 'info')
    navigate('/login', { replace: true })
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-16 text-primary">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Mi cuenta</h1>
        <p className="mt-1 text-muted">
          {usuario?.nombre} {usuario?.apellido} · {ETIQUETA_ROL[usuario?.rol]}
        </p>
      </div>

      <Card className="space-y-4">
        <h2 className="font-bold">Datos personales</h2>
        <AvatarUploader usuario={{ ...usuario, nombre, apellido }} onChange={setAvatarFile} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input label="Apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
        </div>
        <Input
          label="Teléfono"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          placeholder="+54 11 5824-9102"
        />
        <Input label="Email" value={usuario?.email ?? ''} disabled />
      </Card>

      {stats && (
        <Card>
          <h2 className="font-bold">Tu actividad</h2>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {stats.map((item) => (
              <div key={item.etiqueta} className="rounded-xl bg-canvas p-3 text-center">
                <p className="text-2xl font-extrabold text-ink">{item.valor}</p>
                <p className="mt-1 text-xs text-muted">{item.etiqueta}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {esCliente && (
        <Card className="space-y-4">
          <h2 className="font-bold">Sobre vos</h2>
          <Input
            label="Zona donde vivís"
            value={zona}
            onChange={(e) => setZona(e.target.value)}
            placeholder="Ej: Villa Crespo, CABA"
          />
          <p className="-mt-2 text-xs text-muted">
            Solo la zona, no la dirección. Se usa para ubicar tus solicitudes.
          </p>
          <Textarea
            label="Descripción (opcional)"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Contá brevemente qué tipo de trabajos solés necesitar."
          />
        </Card>
      )}

      {usuario?.rol === 'trabajador' && (
        <Link
          to="/trabajador/perfil"
          className="flex items-center justify-between rounded-card border border-line bg-surface p-5 shadow-sm"
        >
          <span>
            <span className="block font-bold text-ink">Editar perfil profesional</span>
            <span className="block text-sm text-muted">Oficios, experiencia y portfolio.</span>
          </span>
          <span className="font-bold text-primary">→</span>
        </Link>
      )}

      {error && <p className="text-sm font-semibold text-danger">{error}</p>}

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button className="w-full sm:flex-1" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </Button>
        <Button variante="outline" className="w-full sm:w-auto" onClick={salir}>
          Cerrar sesión
        </Button>
      </div>
    </div>
  )
}
