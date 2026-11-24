import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import * as solicitudesRepo from '@/lib/data/solicitudes.repo.js'
import * as perfilClienteRepo from '@/lib/data/perfilCliente.repo.js'
import * as perfilesRepo from '@/lib/data/perfiles.repo.js'
import { mensajeError } from '@/lib/errores.js'
import { formatearPesos } from '@/lib/format.js'
import { mismaZona } from '@/lib/geo.js'
import MapaUbicacion from '@/components/mapa/MapaUbicacion.jsx'
import OficioPicker from '@/features/oficios/OficioPicker.jsx'
import Avatar from '@/components/ui/Avatar.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import Textarea from '@/components/ui/Textarea.jsx'
import FileDrop from '@/components/ui/FileDrop.jsx'

const VACIO = {
  oficioId: '',
  titulo: '',
  descripcion: '',
  ubicacion: '',
  latitud: null,
  longitud: null,
  presupuestoMax: '',
}

function TarjetaPreview({ nombreOficio, form, fotos, avisoZona, zonaPerfil }) {
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

      {avisoZona && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-warning">
          Esta ubicación es distinta a tu zona de perfil ({zonaPerfil?.texto}). Los
          profesionales verán la zona que elegiste para este trabajo.
        </p>
      )}

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
  const { mostrar } = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const trabajadorParam = params.get('trabajador')
  const oficioParam = params.get('oficio')

  const [paso, setPaso] = useState('form')
  const [form, setForm] = useState(VACIO)
  const [nombreOficio, setNombreOficio] = useState('')
  const [zonaPerfil, setZonaPerfil] = useState(null)
  const [fotos, setFotos] = useState([])
  const [error, setError] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [destino, setDestino] = useState(null)
  const [oficiosDestino, setOficiosDestino] = useState([])
  const [cargandoDestino, setCargandoDestino] = useState(Boolean(trabajadorParam))

  const esPersonal = Boolean(trabajadorParam)
  const avisoZona = Boolean(
    zonaPerfil?.texto &&
      form.ubicacion &&
      !mismaZona(
        { texto: form.ubicacion, lat: form.latitud, lng: form.longitud },
        zonaPerfil,
      ),
  )

  // Precarga la ubicación con la zona declarada en el perfil del cliente.
  useEffect(() => {
    if (usuario?.rol !== 'cliente') return undefined
    let activo = true
    perfilClienteRepo.obtener(usuario.id).then((perfil) => {
      if (!activo) return
      if (perfil.zona || perfil.latitud) {
        setZonaPerfil({
          texto: perfil.zona,
          lat: perfil.latitud,
          lng: perfil.longitud,
        })
      }
      if (perfil.zona || perfil.latitud) {
        setForm((f) =>
          f.ubicacion
            ? f
            : {
                ...f,
                ubicacion: perfil.zona ?? '',
                latitud: perfil.latitud ?? null,
                longitud: perfil.longitud ?? null,
              },
        )
      }
    })
    return () => {
      activo = false
    }
  }, [usuario?.id, usuario?.rol])

  // Si viene dirigido a un trabajador, lo cargamos y pre-seleccionamos su oficio.
  useEffect(() => {
    if (!trabajadorParam) {
      setDestino(null)
      setOficiosDestino([])
      setCargandoDestino(false)
      return undefined
    }
    let activo = true
    setCargandoDestino(true)
    Promise.all([
      perfilesRepo.obtenerTrabajador(trabajadorParam),
      perfilesRepo.oficiosDe(trabajadorParam),
    ])
      .then(([perfil, oficiosTrabajador]) => {
        if (!activo) return
        setDestino(perfil)
        setOficiosDestino(oficiosTrabajador)
        const elegido =
          oficiosTrabajador.find((o) => o.id === oficioParam) ?? oficiosTrabajador[0]
        if (elegido) {
          setForm((f) => (f.oficioId ? f : { ...f, oficioId: elegido.id }))
          setNombreOficio((actual) => actual || elegido.nombre)
        }
      })
      .catch(() => {})
      .finally(() => activo && setCargandoDestino(false))
    return () => {
      activo = false
    }
  }, [trabajadorParam, oficioParam])

  function campo(nombre) {
    return (e) => setForm((f) => ({ ...f, [nombre]: e.target.value }))
  }

  function cambiarOficio(id, oficio) {
    setForm((f) => ({ ...f, oficioId: id }))
    setNombreOficio(oficio?.nombre ?? '')
  }

  function usarZonaPerfil() {
    if (!zonaPerfil) return
    setForm((f) => ({
      ...f,
      ubicacion: zonaPerfil.texto ?? '',
      latitud: zonaPerfil.lat ?? null,
      longitud: zonaPerfil.lng ?? null,
    }))
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
        latitud: form.latitud,
        longitud: form.longitud,
        presupuestoMax: form.presupuestoMax || null,
        fotos,
        trabajadorDestinoId: destino?.id ?? null,
      })
      mostrar(
        destino ? 'Solicitud enviada.' : 'Solicitud publicada.',
        'exito',
      )
      navigate('/cliente/solicitudes', { replace: true })
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setEnviando(false)
    }
  }

  if (esPersonal && !cargandoDestino && destino?.id && !destino.habilitado) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card className="py-10 text-center">
          <p className="font-bold text-ink">Este profesional no está disponible</p>
          <p className="mt-1 text-sm text-muted">
            Tiene la cuenta suspendida, así que no puede recibir solicitudes por ahora.
          </p>
          <Link to="/cliente/explorar" className="mt-4 inline-block font-bold text-link">
            Volver a explorar
          </Link>
        </Card>
      </div>
    )
  }

  if (paso === 'preview') {
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-warning">
          Previsualización — {destino ? 'todavía no fue enviada' : 'todavía no está publicada'}
        </div>

        <TarjetaPreview
          nombreOficio={nombreOficio}
          form={form}
          fotos={fotos}
          avisoZona={avisoZona}
          zonaPerfil={zonaPerfil}
        />

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
        <Link to="/cliente" className="font-bold text-link">
          ←
        </Link>
        <h1 className="text-2xl font-extrabold lg:text-3xl">
          {destino ? 'Enviar solicitud' : 'Publicar solicitud'}
        </h1>
      </div>

      {destino && (
        <Card className="border-primary/30 bg-primary-soft">
          <p className="text-xs font-semibold text-primary">Solicitud dirigida a</p>
          <div className="mt-2 flex items-center gap-3">
            <Avatar usuario={destino} tamano="md" />
            <div className="min-w-0">
              <p className="truncate font-bold text-ink">
                {destino.nombre} {destino.apellido}
              </p>
              <p className="text-xs text-muted">
                Solo {destino.nombre} va a recibir esta solicitud.
              </p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
        <form onSubmit={irAPreview} className="space-y-4">
          <div>
            <OficioPicker
              label="¿Qué servicio necesitás?"
              value={form.oficioId}
              onChange={cambiarOficio}
              permitirCrear={!esPersonal}
              opciones={esPersonal ? oficiosDestino : null}
              placeholder={
                esPersonal ? 'Elegí uno de sus oficios…' : 'Buscar o agregar un oficio…'
              }
            />
            {esPersonal && (
              <p
                className={`mt-1.5 text-xs ${
                  !cargandoDestino && oficiosDestino.length === 0
                    ? 'font-semibold text-danger'
                    : 'text-muted'
                }`}
              >
                {cargandoDestino
                  ? 'Cargando los oficios del profesional…'
                  : oficiosDestino.length === 0
                    ? 'Este profesional no tiene oficios activos cargados.'
                    : `Solo se muestran los oficios que ofrece ${destino?.nombre ?? 'el profesional'}.`}
              </p>
            )}
          </div>

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

          <MapaUbicacion
            label="Ubicación de la solicitud"
            valor={{ texto: form.ubicacion, lat: form.latitud, lng: form.longitud }}
            onChange={({ texto, lat, lng }) =>
              setForm((f) => ({
                ...f,
                ubicacion: texto ?? '',
                latitud: lat ?? null,
                longitud: lng ?? null,
              }))
            }
            ayuda="Tu perfil ya tiene una zona. Si el trabajo es en otro lugar, cambiala acá."
            altura="h-60"
          />

          {avisoZona && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-warning">
              <p className="font-semibold">
                La ubicación es distinta a tu zona de perfil ({zonaPerfil?.texto}).
              </p>
              <button
                type="button"
                onClick={usarZonaPerfil}
                className="mt-1 font-bold text-link hover:underline"
              >
                Usar mi zona de perfil
              </button>
            </div>
          )}

          <Input
            label="Presupuesto máximo (opcional)"
            name="presupuestoMax"
            type="number"
            min="0"
            value={form.presupuestoMax}
            onChange={campo('presupuestoMax')}
            placeholder="Ej: 15000"
          />

          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink">Fotos (opcional)</p>
            <FileDrop max={5} onChange={setFotos} />
          </div>

          {error && <p className="text-sm font-semibold text-danger">{error}</p>}

          <Button
            tipo="submit"
            className="w-full sm:w-auto"
            disabled={esPersonal && !cargandoDestino && oficiosDestino.length === 0}
          >
            Previsualizar
          </Button>
        </form>

        {/* Previsualización en vivo (solo desktop) */}
        <div className="hidden lg:block lg:sticky lg:top-20">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Previsualización
          </p>
          <TarjetaPreview
            nombreOficio={nombreOficio}
            form={form}
            fotos={fotos}
            avisoZona={avisoZona}
            zonaPerfil={zonaPerfil}
          />
        </div>
      </div>
    </div>
  )
}
