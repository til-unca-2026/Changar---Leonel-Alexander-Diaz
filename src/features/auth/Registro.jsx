import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import { mensajeError } from '@/lib/errores.js'
import * as invitacionesRepo from '@/lib/data/invitaciones.repo.js'
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

const DESTINO_POR_ROL = {
  cliente: '/cliente',
  trabajador: '/onboarding/trabajador',
  admin: '/admin',
}

// El token de invitación llega en la URL. Se guarda en sessionStorage y se saca
// de la barra de direcciones para que no quede en el historial del navegador ni
// en el encabezado Referer de las peticiones a terceros.
const LLAVE_TOKEN = 'changar_invitacion_admin'

function leerTokenGuardado() {
  try {
    return window.sessionStorage.getItem(LLAVE_TOKEN) || ''
  } catch {
    return ''
  }
}

function guardarToken(token) {
  try {
    window.sessionStorage.setItem(LLAVE_TOKEN, token)
  } catch {
    /* almacenamiento bloqueado: el token sigue en la URL de esta sesión */
  }
}

function borrarTokenGuardado() {
  try {
    window.sessionStorage.removeItem(LLAVE_TOKEN)
  } catch {
    /* nada que hacer */
  }
}

export default function Registro() {
  const { registrar } = useAuth()
  const { mostrar } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

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

  const [token, setToken] = useState('')
  const [invitacion, setInvitacion] = useState(null)
  const [invitacionInvalida, setInvitacionInvalida] = useState(false)

  // Si el link trae el token, se aparta de la URL apenas se lee.
  useEffect(() => {
    const deUrl = searchParams.get('invitacion')
    if (!deUrl) return
    guardarToken(deUrl)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  // Carga la invitación (sin sesión: es un link que puede llegar por correo o
  // mensajería). Si el token no es válido se avisa y se sigue con el registro
  // normal.
  useEffect(() => {
    let activo = true
    const t = searchParams.get('invitacion') || leerTokenGuardado()
    if (!t) return

    setToken(t)
    invitacionesRepo
      .porToken(t)
      .then((inv) => {
        if (!activo) return
        if (!inv) {
          setInvitacionInvalida(true)
          return
        }
        setInvitacion(inv)
        setForm((f) => ({
          ...f,
          nombre: f.nombre || inv.nombre || '',
          apellido: f.apellido || inv.apellido || '',
          email: f.email || inv.email || '',
        }))
      })
      .catch(() => {
        if (activo) setInvitacionInvalida(true)
      })
    return () => {
      activo = false
    }
  }, [searchParams])

  function campo(nombre) {
    return (e) => setForm((f) => ({ ...f, [nombre]: e.target.value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.nombre || !form.apellido || !form.email || !form.password) {
      setError('Completá todos los campos obligatorios.')
      return
    }
    if (!invitacion && !form.telefono) {
      setError('Completá el número de teléfono.')
      return
    }
    if (form.password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    try {
      setEnviando(true)
      const usuario = await registrar({
        ...form,
        rol: invitacion ? 'cliente' : form.rol,
        invitacion: invitacion ? token : null,
      })
      borrarTokenGuardado()
      if (invitacion && usuario.rol !== 'admin') {
        // La invitación se consumió entre la apertura del link y el envío.
        mostrar('La invitación ya había sido usada. Tu cuenta se creó como cliente.', 'info')
      } else {
        mostrar(
          invitacion
            ? '¡Cuenta creada! Ya sos administrador de ChangAr.'
            : '¡Cuenta creada! Bienvenido a ChangAr.',
          'exito'
        )
      }
      navigate(DESTINO_POR_ROL[usuario.rol] ?? '/cliente', { replace: true })
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="tema-admin mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-12 lg:my-10 lg:min-h-0 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:px-10 lg:py-10 lg:shadow-sm">
      <Logo />
      <p className="mt-2 text-center text-sm text-muted">
        Conectando trabajo de confianza en tu barrio
      </p>

      <h1 className="mt-8 text-2xl font-extrabold">¡Te damos la bienvenida!</h1>
      <p className="mt-1 text-muted">Elegí cómo querés usar la aplicación para comenzar</p>

      {invitacion && (
        <div className="mt-5 rounded-2xl border border-primary/30 bg-primary-soft p-4">
          <p className="font-bold text-primary">Te invitaron a ser administrador</p>
          <p className="mt-1 text-sm text-muted">
            Creá tu cuenta con este acceso y vas a entrar al panel de administración de ChangAr.
          </p>
        </div>
      )}

      {invitacionInvalida && !invitacion && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-bold text-warning">Invitación no válida</p>
          <p className="mt-1 text-sm text-muted">
            El link venció, ya se usó o fue cancelado. Podés registrarte igual como cliente o
            trabajador.
          </p>
        </div>
      )}

      {!invitacion && (
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
      )}

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
          required={!invitacion}
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
        <Link to="/login" className="font-bold text-primary hover:text-primary-dark">
          Iniciá sesión
        </Link>
      </p>
    </div>
  )
}
