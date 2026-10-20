import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import { mensajeError } from '@/lib/errores.js'
import Button from '@/components/ui/Button.jsx'
import Input from '@/components/ui/Input.jsx'
import Logo from '@/components/ui/Logo.jsx'

function OpcionRol({ activo, titulo, texto, icono, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
        activo ? 'border-primary bg-primary-soft ring-2 ring-primary/20' : 'border-line bg-surface'
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        {icono}
      </span>
      <span className="flex-1">
        <span className="block font-bold text-ink">{titulo}</span>
        <span className="block text-sm text-muted">{texto}</span>
      </span>
      <span
        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
          activo ? 'border-primary bg-primary text-white' : 'border-line'
        }`}
      >
        {activo && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="h-3.5 w-3.5">
            <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </button>
  )
}

const ICONO_CLIENTE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
)

const ICONO_TRABAJADOR = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

export default function Registro() {
  const { registrar } = useAuth()
  const { mostrar } = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    rol: 'cliente',
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    password: '',
  })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  function campo(nombre) {
    return (e) => setForm((f) => ({ ...f, [nombre]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.nombre || !form.apellido || !form.email || !form.telefono || !form.password) {
      setError('Completá todos los campos.')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    try {
      setEnviando(true)
      const usuario = await registrar(form)
      mostrar('¡Cuenta creada! Bienvenido a ChangAr.', 'exito')
      navigate(usuario.rol === 'trabajador' ? '/onboarding/trabajador' : '/cliente', {
        replace: true,
      })
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-12 lg:my-10 lg:min-h-0 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:px-10 lg:py-10 lg:shadow-sm">
      <Logo />
      <p className="mt-2 text-center text-sm text-muted">
        Conectando trabajo de confianza en tu barrio
      </p>

      <h1 className="mt-8 text-2xl font-extrabold">¡Te damos la bienvenida!</h1>
      <p className="mt-1 text-muted">Elegí cómo querés usar la aplicación para comenzar</p>

      <div className="mt-5 space-y-3">
        <OpcionRol
          activo={form.rol === 'cliente'}
          titulo="Busco un Profesional"
          texto="Para resolver reparaciones, reformas o tareas del hogar."
          icono={ICONO_CLIENTE}
          onClick={() => setForm((f) => ({ ...f, rol: 'cliente' }))}
        />
        <OpcionRol
          activo={form.rol === 'trabajador'}
          titulo="Quiero Ofrecer mi Oficio"
          texto="Para postular a solicitudes y conseguir nuevos clientes."
          icono={ICONO_TRABAJADOR}
          onClick={() => setForm((f) => ({ ...f, rol: 'trabajador' }))}
        />
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" name="nombre" value={form.nombre} onChange={campo('nombre')} placeholder="Valeria" />
          <Input label="Apellido" name="apellido" value={form.apellido} onChange={campo('apellido')} placeholder="Fernández" />
        </div>
        <Input label="Email" name="email" type="email" value={form.email} onChange={campo('email')} placeholder="valeria@email.com" />
        <Input
          label="Número de Teléfono"
          name="telefono"
          value={form.telefono}
          onChange={campo('telefono')}
          placeholder="+54 11 5824-9102"
        />
        <Input
          label="Contraseña"
          name="password"
          type="password"
          value={form.password}
          onChange={campo('password')}
          placeholder="Mínimo 6 caracteres"
        />

        {error && <p className="text-sm font-semibold text-danger">{error}</p>}

        <Button tipo="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear Cuenta'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿Ya tenés cuenta?{' '}
        <Link to="/login" className="font-bold text-primary">
          Iniciá sesión
        </Link>
      </p>
    </div>
  )
}
