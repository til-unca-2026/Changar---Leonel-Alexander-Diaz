import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useOficios } from '@/hooks/useSolicitudes.js'
import { useToast } from '@/components/ui/Toast.jsx'
import * as solicitudesRepo from '@/lib/data/solicitudes.repo.js'
import * as perfilClienteRepo from '@/lib/data/perfilCliente.repo.js'
import { formatearPesos } from '@/lib/format.js'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import Textarea from '@/components/ui/Textarea.jsx'
import Select from '@/components/ui/Select.jsx'
import FileDrop from '@/components/ui/FileDrop.jsx'

const VACIO = {
  oficioId: '',
  titulo: '',
  descripcion: '',
  ubicacion: '',
  presupuestoMax: '',
}

function TarjetaPreview({ nombreOficio, form, fotos }) {
  return (
    <Card>
      <p className="text-sm font-semibold text-primary">
        {nombreOficio || 'Oficio sin elegir'}
      </p>
      <h2 className="mt-1 text-xl font-extrabold">
        {form.titulo || 'Título de la solicitud'}
      </h2>
      <p className="mt-3 whitespace-pre-line text-ink">
        {form.descripcion || 'La descripción va a aparecer acá.'}
      </p>

      <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Ubicación</dt>
          <dd className="font-semibold text-ink">{form.ubicacion || 'Sin definir'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted">Presupuesto máximo</dt>
          <dd className="font-semibold text-ink">
            {formatearPesos(form.presupuestoMax || null)}
          </dd>
        </div>
      </dl>

      {fotos.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <p className="text-xs font-semibold text-muted">Fotos ({fotos.length})</p>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {fotos.map((foto, i) => (
              <div
                key={i}
                className="aspect-square overflow-hidden rounded-xl border border-line bg-canvas"
              >
                {foto.url && (
                  <img src={foto.url} alt={foto.nombre} className="h-full w-full object-cover" />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export default function NuevaSolicitud() {
  const { usuario } = useAuth()
  const oficios = useOficios()
  const { mostrar } = useToast()
  const navigate = useNavigate()

  const [paso, setPaso] = useState('form')
  const [form, setForm] = useState(VACIO)
  const [fotos, setFotos] = useState([])
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)

  const nombreOficio = oficios.find((o) => o.id === form.oficioId)?.nombre ?? ''

  // Precarga la ubicación con la zona declarada en el perfil del cliente.
  useEffect(() => {
    if (usuario?.rol !== 'cliente') return undefined
    let activo = true
    perfilClienteRepo.obtener(usuario.id).then((perfil) => {
      if (activo && perfil.zona) {
        setForm((f) => (f.ubicacion ? f : { ...f, ubicacion: perfil.zona }))
      }
    })
    return () => {
      activo = false
    }
  }, [usuario?.id, usuario?.rol])

  function campo(nombre) {
    return (e) => setForm((f) => ({ ...f, [nombre]: e.target.value }))
  }

  function irAPreview(e) {
    e.preventDefault()
    setError('')
    if (!form.oficioId || !form.titulo || !form.descripcion || !form.ubicacion) {
      setError('Completá oficio, título, descripción y ubicación.')
      return
    }
    setPaso('preview')
    window.scrollTo({ top: 0 })
  }

  async function confirmar() {
    try {
      setEnviando(true)
      await solicitudesRepo.crear({
        clienteId: usuario.id,
        oficioId: form.oficioId,
        oficioNombre: nombreOficio,
        titulo: form.titulo,
        descripcion: form.descripcion,
        ubicacion: form.ubicacion,
        presupuestoMax: form.presupuestoMax || null,
        fotos,
      })
      mostrar('Solicitud publicada.', 'exito')
      navigate('/cliente/solicitudes', { replace: true })
    } catch {
      setError('No pudimos publicar la solicitud. Intentá de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  if (paso === 'preview') {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-warning">
          Previsualización — todavía no está publicada
        </div>

        <TarjetaPreview nombreOficio={nombreOficio} form={form} fotos={fotos} />

        {error && <p className="text-sm font-semibold text-danger">{error}</p>}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button className="w-full sm:flex-1" onClick={confirmar} disabled={enviando}>
            {enviando ? 'Publicando…' : 'Confirmar publicación'}
          </Button>
          <Button
            variante="outline"
            className="w-full sm:flex-1"
            onClick={() => setPaso('form')}
            disabled={enviando}
          >
            Editar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/cliente" className="font-bold text-primary">
          ←
        </Link>
        <h1 className="text-2xl font-extrabold lg:text-3xl">Publicar solicitud</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <form onSubmit={irAPreview} className="space-y-4">
          <Select label="¿Qué servicio necesitás?" name="oficioId" value={form.oficioId} onChange={campo('oficioId')}>
            <option value="">Elegí un oficio</option>
            {oficios.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </Select>

          <Input
            label="Título"
            name="titulo"
            value={form.titulo}
            onChange={campo('titulo')}
            placeholder="Ej: Arreglar canilla de cocina"
          />

          <Textarea
            label="Descripción"
            name="descripcion"
            value={form.descripcion}
            onChange={campo('descripcion')}
            placeholder="Contá qué necesitás, el problema y cualquier detalle útil."
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Ubicación"
              name="ubicacion"
              value={form.ubicacion}
              onChange={campo('ubicacion')}
              placeholder="Ej: Villa Crespo, CABA"
            />
            <Input
              label="Presupuesto máximo (opcional)"
              name="presupuestoMax"
              type="number"
              min="0"
              value={form.presupuestoMax}
              onChange={campo('presupuestoMax')}
              placeholder="Ej: 15000"
            />
          </div>

          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink">Fotos (opcional)</p>
            <FileDrop max={5} onChange={setFotos} />
          </div>

          {error && <p className="text-sm font-semibold text-danger">{error}</p>}

          <Button tipo="submit" className="w-full sm:w-auto">
            Previsualizar
          </Button>
        </form>

        {/* Previsualización en vivo (solo desktop) */}
        <div className="hidden lg:block lg:sticky lg:top-20">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Previsualización
          </p>
          <TarjetaPreview nombreOficio={nombreOficio} form={form} fotos={fotos} />
        </div>
      </div>
    </div>
  )
}
