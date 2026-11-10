import { useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import * as solicitudesRepo from '@/lib/data/solicitudes.repo.js'
import { mensajeError } from '@/lib/errores.js'
import { fechaRelativa, formatearPesos } from '@/lib/format.js'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

export default function SolicitudesPersonales() {
  const { usuario } = useAuth()
  const { mostrar } = useToast()

  const [solicitudes, setSolicitudes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [aceptando, setAceptando] = useState(null)
  const [presupuesto, setPresupuesto] = useState('')
  const [error, setError] = useState('')
  const [procesando, setProcesando] = useState(false)

  async function recargar() {
    setSolicitudes(await solicitudesRepo.listarPersonales(usuario.id))
    setCargando(false)
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id])

  async function aceptar(s) {
    setError('')
    if (!presupuesto || Number(presupuesto) <= 0) {
      setError('Ingresá tu presupuesto.')
      return
    }
    try {
      setProcesando(true)
      await solicitudesRepo.aceptarPersonal(s.id, Number(presupuesto))
      mostrar(
        `Le enviamos tu presupuesto de ${formatearPesos(Number(presupuesto))} a ${s.clienteNombre}. Esperando su confirmación.`,
        'exito',
      )
      setAceptando(null)
      setPresupuesto('')
      await recargar()
    } catch (err) {
      setError(mensajeError(err))
    } finally {
      setProcesando(false)
    }
  }

  async function rechazar(s) {
    if (!window.confirm('¿Rechazar esta solicitud?')) return
    try {
      setProcesando(true)
      await solicitudesRepo.rechazarPersonal(s.id)
      mostrar('Solicitud rechazada.', 'info')
      await recargar()
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setProcesando(false)
    }
  }

  if (cargando) {
    return (
      <div className="flex justify-center py-8 text-primary">
        <Spinner className="h-7 w-7" />
      </div>
    )
  }

  if (solicitudes.length === 0) return null

  const pendientes = solicitudes.filter((s) => s.miPropuesta?.estado !== 'enviada')
  const esperando = solicitudes.filter((s) => s.miPropuesta?.estado === 'enviada')

  return (
    <div className="space-y-6">
      {pendientes.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold">Solicitudes personales</h2>
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-bold text-primary">
              {pendientes.length}
            </span>
          </div>

          <div className="space-y-3">
            {pendientes.map((s) => (
              <Card key={s.id} className="border-primary/30">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-primary">{s.oficioNombre}</p>
                    <p className="font-bold text-ink">{s.titulo}</p>
                    <p className="text-xs text-muted">
                      {s.clienteNombre} · {s.ubicacion}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-primary">
                    {formatearPesos(s.presupuestoMax)}
                  </p>
                </div>

                <p className="mt-2 whitespace-pre-line text-sm text-muted">{s.descripcion}</p>

                {s.miPropuesta && (
                  <p className="mt-2 text-xs font-semibold text-muted">
                    Retiraste tu propuesta anterior. Podés enviar un nuevo presupuesto.
                  </p>
                )}

                {aceptando === s.id ? (
                  <div className="mt-3 space-y-3 border-t border-line pt-3">
                    <Input
                      label="Tu presupuesto"
                      type="number"
                      min="0"
                      value={presupuesto}
                      onChange={(e) => setPresupuesto(e.target.value)}
                      placeholder={s.presupuestoMax ? String(s.presupuestoMax) : 'Ej: 15000'}
                    />
                    {Number(presupuesto) > 0 &&
                      s.presupuestoMax != null &&
                      Number(presupuesto) > Number(s.presupuestoMax) && (
                        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-warning">
                          Tu presupuesto supera el máximo que indicó el cliente. Igual podés
                          enviarlo.
                        </p>
                      )}
                    <p className="text-xs text-muted">
                      El cliente deberá confirmar tu presupuesto antes de que se cree la
                      contratación.
                    </p>
                    {error && <p className="text-sm font-semibold text-danger">{error}</p>}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <Button
                        className="w-full sm:w-auto"
                        onClick={() => aceptar(s)}
                        disabled={procesando}
                      >
                        {procesando ? 'Enviando…' : 'Enviar presupuesto'}
                      </Button>
                      <Button
                        variante="outline"
                        className="w-full sm:w-auto"
                        onClick={() => {
                          setAceptando(null)
                          setPresupuesto('')
                          setError('')
                        }}
                        disabled={procesando}
                      >
                        Volver
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2 border-t border-line pt-3 sm:flex-row">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setAceptando(s.id)
                        setPresupuesto(s.presupuestoMax ? String(s.presupuestoMax) : '')
                        setError('')
                      }}
                    >
                      Aceptar
                    </Button>
                    <Button
                      variante="outline"
                      className="w-full sm:w-auto"
                      onClick={() => rechazar(s)}
                      disabled={procesando}
                    >
                      Rechazar
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      {esperando.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Esperando confirmación del cliente</h2>
          <div className="space-y-3">
            {esperando.map((s) => (
              <Card key={s.id} className="border-dashed">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-ink">{s.titulo}</p>
                    <p className="text-xs text-muted">
                      {s.clienteNombre} · {s.ubicacion}
                    </p>
                  </div>
                  <Badge estado={s.miPropuesta.estado} />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <p className="text-sm text-muted">
                    Tu presupuesto:{' '}
                    <span className="font-bold text-primary">
                      {formatearPesos(s.miPropuesta.presupuesto)}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    Enviado {fechaRelativa(s.miPropuesta.createdAt)}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
