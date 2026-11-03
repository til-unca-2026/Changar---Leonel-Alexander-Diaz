import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import { mensajeError } from '@/lib/errores.js'
import Button from '@/components/ui/Button.jsx'
import Input from '@/components/ui/Input.jsx'
import Logo from '@/components/ui/Logo.jsx'

const DESTINO_POR_ROL = {
  cliente: '/cliente',
  trabajador: '/trabajador',
  admin: '/admin',
}

export default function Login() {
  const { iniciarSesion } = useAuth()
  const { mostrar } = useToast()
  const navigate = useNavigate()

  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    if (!form.email || !form.password) {
      setError('Completá email y contraseña.')
      return
    }

    try {
      setEnviando(true)
      const usuario = await iniciarSesion(form)
      mostrar(`Hola de nuevo, ${usuario.nombre}.`, 'exito')
      const destino = DESTINO_POR_ROL[usuario.rol] ?? '/'
      navigate(destino, { replace: true })
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 pb-10 pt-16 lg:my-10 lg:min-h-0 lg:rounded-card lg:border lg:border-line lg:bg-surface lg:px-10 lg:py-10 lg:shadow-sm">
      <Logo />
      <p className="mt-2 text-center text-sm text-muted">
        Conectando trabajo de confianza en tu barrio
      </p>

      <h1 className="mt-10 text-2xl font-extrabold">Iniciá sesión</h1>
      <p className="mt-1 text-muted">Ingresá con tu email y contraseña</p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          placeholder="valeria@email.com"
          autoComplete="email"
        />
        <Input
          label="Contraseña"
          name="password"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          placeholder="Tu contraseña"
          autoComplete="current-password"
        />

        {error && <p className="text-sm font-semibold text-danger">{error}</p>}

        <Button tipo="submit" className="w-full" disabled={enviando}>
          {enviando ? 'Ingresando…' : 'Ingresar'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        ¿No tenés cuenta?{' '}
        <Link to="/registro" className="font-bold text-primary">
          Creá una
        </Link>
      </p>
    </div>
  )
}
