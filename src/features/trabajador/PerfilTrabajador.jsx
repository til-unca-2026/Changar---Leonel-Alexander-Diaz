import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import * as perfilRepo from '@/lib/data/perfilTrabajador.repo.js'
import { subirAvatar } from '@/lib/data/almacenamiento.js'
import { calcularCompletitud } from '@/lib/perfil.js'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import Textarea from '@/components/ui/Textarea.jsx'
import Spinner from '@/components/ui/Spinner.jsx'
import OficioSelector from './OficioSelector.jsx'
import AvatarUploader from './AvatarUploader.jsx'

function Completitud({ perfil }) {
  const { items, porcentaje, completo } = calcularCompletitud(perfil)
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Completá tu perfil</h2>
        <span className={`text-sm font-bold ${completo ? 'text-success' : 'text-primary'}`}>
          {porcentaje}%
        </span>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-canvas">
        <div
          className={`h-full rounded-full transition-all ${completo ? 'bg-success' : 'bg-primary'}`}
          style={{ width: `${porcentaje}%` }}
        />
      </div>

      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item.clave} className="flex items-center gap-2 text-sm">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                item.ok ? 'bg-success text-white' : 'border border-line text-transparent'
              }`}
            >
              ✓
            </span>
            <span className={item.ok ? 'text-ink' : 'text-muted'}>{item.texto}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function PerfilTrabajador({ modo = 'edicion', onGuardado }) {
  const { usuario, actualizarUsuario, cerrarSesion } = useAuth()
  const { mostrar } = useToast()
  const navigate = useNavigate()

  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const [nombre, setNombre] = useState(usuario?.nombre ?? '')
  const [apellido, setApellido] = useState(usuario?.apellido ?? '')
  const [telefono, setTelefono] = useState(usuario?.telefono ?? '')
  const [avatarFile, setAvatarFile] = useState(null)

  const [descripcion, setDescripcion] = useState('')
  const [experiencia, setExperiencia] = useState('')
  const [ubicacion, setUbicacion] = useState('')
  const [oficios, setOficios] = useState([])

  useEffect(() => {
    let activo = true
    perfilRepo.obtener(usuario.id).then((perfil) => {
      if (!activo) return
      setDescripcion(perfil.descripcion ?? '')
      setExperiencia(perfil.experiencia ?? '')
      setUbicacion(perfil.ubicacion ?? '')
      setOficios(perfil.oficios ?? [])
      setCargando(false)
    })
    return () => {
      activo = false
    }
  }, [usuario.id])

  async function guardar() {
    setError('')
    if (!nombre.trim() || !apellido.trim()) {
      setError('El nombre y el apellido no pueden quedar vacíos.')
      return
    }
    try {
      setGuardando(true)
      const datos = { nombre, apellido, telefono }
      if (avatarFile) {
        datos.avatar = await subirAvatar(usuario.id, avatarFile)
      }
      await actualizarUsuario(datos)
      await perfilRepo.guardar(usuario.id, { descripcion, experiencia, ubicacion, oficios })
      mostrar('Perfil actualizado.', 'exito')
      onGuardado?.()
    } catch {
      setError('No pudimos guardar los cambios. Intentá de nuevo.')
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
    <div className="space-y-5">
      {modo === 'onboarding' ? (
        <div>
          <h1 className="text-2xl font-extrabold">Armemos tu perfil</h1>
          <p className="mt-1 text-muted">
            Cuanto más completo, más chances de conseguir trabajos.
          </p>
        </div>
      ) : (
        <h1 className="text-2xl font-extrabold">Mi perfil profesional</h1>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:items-start">
        <div className="order-2 space-y-5 lg:order-1">
          <Card>
            <h2 className="mb-4 font-bold">Foto de perfil</h2>
            <AvatarUploader usuario={{ ...usuario, nombre, apellido }} onChange={setAvatarFile} />
          </Card>

          <Card className="space-y-4">
            <h2 className="font-bold">Datos personales</h2>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              <Input label="Apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} />
            </div>
            <Input
              label="Teléfono"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="+54 11 5824-9102"
            />
          </Card>

          <Card className="space-y-4">
            <h2 className="font-bold">Datos profesionales</h2>
            <Textarea
              label="Descripción"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Contá qué hacés y cómo trabajás."
            />
            <Textarea
              label="Experiencia (opcional)"
              rows={3}
              value={experiencia}
              onChange={(e) => setExperiencia(e.target.value)}
              placeholder="Años de experiencia, formación, tipos de trabajo."
            />
            <Input
              label="Ubicación"
              value={ubicacion}
              onChange={(e) => setUbicacion(e.target.value)}
              placeholder="Ej: Villa Crespo, CABA"
            />
          </Card>

          <Card>
            <h2 className="mb-3 font-bold">Oficios</h2>
            <OficioSelector value={oficios} onChange={setOficios} />
          </Card>

          {error && <p className="text-sm font-semibold text-danger">{error}</p>}

          <Button className="w-full sm:w-auto" onClick={guardar} disabled={guardando}>
            {guardando
              ? 'Guardando…'
              : modo === 'onboarding'
                ? 'Guardar y continuar'
                : 'Guardar cambios'}
          </Button>

          {modo !== 'onboarding' && (
            <Button variante="outline" className="w-full sm:w-auto" onClick={salir}>
              Cerrar sesión
            </Button>
          )}
        </div>

        <div className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-20">
            <Completitud perfil={{ descripcion, ubicacion, oficios }} />
          </div>
        </div>
      </div>
    </div>
  )
}
