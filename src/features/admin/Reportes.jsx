import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast.jsx'
import * as adminRepo from '@/lib/data/admin.repo.js'
import { mensajeError } from '@/lib/errores.js'
import { fechaRelativa } from '@/lib/format.js'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

function Galeria({ fotos }) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      {fotos.map((url, i) => (
        <a key={i} href={url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-lg border border-line">
          <img src={url} alt="" className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  )
}

export default function Reportes() {
  const { mostrar } = useToast()
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tipo') === 'contratos' ? 'contratos' : 'perfiles')
  const [reportes, setReportes] = useState([])
  const [contratos, setContratos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [accionando, setAccionando] = useState(null)

  async function recargar() {
    const [rep, cont] = await Promise.all([
      adminRepo.listarReportes(),
      adminRepo.listarContratosReportados(),
    ])
    setReportes(rep)
    setContratos(cont)
    setCargando(false)
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function resolverReporte(r, accion, dias) {
    if (!window.confirm(`Aplicar "${accion}" sobre ${r.perfilNombre}?`)) return
    try {
      setAccionando(r.id)
      await adminRepo.resolverReporte(r.id, accion, dias, r.motivo)
      mostrar('Reporte resuelto.', 'exito')
      await recargar()
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAccionando(null)
    }
  }

  async function resolverContrato(c, aFavorId) {
    if (!window.confirm('Dar la razón y sancionar a la contraparte?')) return
    try {
      setAccionando(c.contratacionId)
      await adminRepo.resolverContrato(c.contratacionId, aFavorId)
      mostrar('Contrato resuelto.', 'exito')
      await recargar()
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAccionando(null)
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
        <h1 className="text-2xl font-extrabold lg:text-3xl">Reportes</h1>
        <p className="mt-1 text-muted">Denuncias de perfiles y contratos reportados.</p>
      </div>

      <div className="flex gap-1 rounded-xl border border-line bg-surface p-1 sm:w-fit">
        <button
          type="button"
          onClick={() => setTab('perfiles')}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tab === 'perfiles' ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}
        >
          Perfiles ({reportes.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('contratos')}
          className={`rounded-lg px-4 py-2 text-sm font-bold transition ${tab === 'contratos' ? 'bg-primary text-white' : 'text-muted hover:text-ink'}`}
        >
          Contratos ({contratos.length})
        </button>
      </div>

      {tab === 'perfiles' && (
        <>
          {reportes.length === 0 ? (
            <Card className="py-10 text-center">
              <p className="font-semibold text-ink">No hay reportes de perfiles</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {reportes.map((r) => (
                <Card key={r.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-ink">
                        <Link to={`/perfiles/${r.perfilId}`} className="underline">
                          {r.perfilNombre}
                        </Link>{' '}
                        <span className="text-sm font-normal text-muted">reportado por {r.reportanteNombre}</span>
                      </p>
                      <p className="mt-1 text-sm text-ink">{r.motivo}</p>
                      <p className="mt-1 text-xs text-muted">{fechaRelativa(r.createdAt)}</p>
                    </div>
                    <Badge estado={r.estado === 'pendiente' ? 'pendiente' : r.estado === 'resuelto' ? 'activo' : 'neutral'}>
                      {r.estado === 'pendiente' ? 'Pendiente' : r.estado === 'resuelto' ? 'Resuelto' : 'Descartado'}
                    </Badge>
                  </div>

                  {r.estado === 'pendiente' && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => resolverReporte(r, 'descartar')} disabled={accionando === r.id}>
                        Descartar
                      </Button>
                      <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => resolverReporte(r, 'marca')} disabled={accionando === r.id}>
                        Marcar
                      </Button>
                      <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => resolverReporte(r, 'ban_temporal', 7)} disabled={accionando === r.id}>
                        Ban 7d
                      </Button>
                      <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => resolverReporte(r, 'ban_temporal', 30)} disabled={accionando === r.id}>
                        Ban 30d
                      </Button>
                      <Button variante="danger" className="px-3 py-2 text-sm" onClick={() => resolverReporte(r, 'ban_permanente')} disabled={accionando === r.id}>
                        Ban permanente
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'contratos' && (
        <>
          {contratos.length === 0 ? (
            <Card className="py-10 text-center">
              <p className="font-semibold text-ink">No hay contratos reportados</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {contratos.map((c) => (
                <Card key={c.contratacionId} className={c.resuelto ? '' : 'border-amber-200'}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-ink">
                        {c.oficio} · {c.solicitudTitulo}
                      </p>
                      <p className="mt-1 text-sm text-muted">
                        Cliente: {c.clienteNombre} · Trabajador: {c.trabajadorNombre}
                      </p>
                      <p className="text-xs text-muted">{fechaRelativa(c.createdAt)}</p>
                    </div>
                    {c.resuelto ? (
                      <Badge estado="activo">Resuelto</Badge>
                    ) : (
                      <Badge estado="pendiente">Pendiente</Badge>
                    )}
                  </div>

                  <div className="mt-3 space-y-3">
                    {c.reporte && (
                      <div className="rounded-xl bg-red-50 p-3">
                        <p className="text-xs font-bold text-danger">Reporte</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink">{c.reporte.comentario}</p>
                        {c.reporte.fotos?.length > 0 && <Galeria fotos={c.reporte.fotos} />}
                      </div>
                    )}
                    {c.descargo && (
                      <div className="rounded-xl bg-canvas p-3">
                        <p className="text-xs font-bold text-primary">Descargo</p>
                        <p className="mt-1 whitespace-pre-line text-sm text-ink">{c.descargo.comentario}</p>
                        {c.descargo.fotos?.length > 0 && <Galeria fotos={c.descargo.fotos} />}
                      </div>
                    )}
                  </div>

                  {c.resuelto ? (
                    <p className="mt-3 text-sm font-semibold text-success">
                      Resuelto a favor de {c.resueltoAFavorNombre}.
                      {c.sancionadoNombre && ` Sanción aplicada a ${c.sancionadoNombre}.`}
                    </p>
                  ) : (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button className="px-3 py-2 text-sm" onClick={() => resolverContrato(c, c.clienteId)} disabled={accionando === c.contratacionId}>
                        A favor del cliente
                      </Button>
                      <Button className="px-3 py-2 text-sm" onClick={() => resolverContrato(c, c.trabajadorId)} disabled={accionando === c.contratacionId}>
                        A favor del trabajador
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
