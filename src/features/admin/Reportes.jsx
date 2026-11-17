import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast.jsx'
import * as adminRepo from '@/lib/data/admin.repo.js'
import { mensajeError } from '@/lib/errores.js'
import { fechaRelativa } from '@/lib/format.js'
import Badge from '@/components/ui/Badge.jsx'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import ConfirmarAccion from '@/components/ui/ConfirmarAccion.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

const REPORTE_DIALOGOS = {
  descartar: {
    titulo: 'Descartar reporte',
    textoConfirmar: 'Descartar',
    varianteConfirmar: 'outline',
    motivo: false,
  },
  marca: {
    titulo: 'Marcar perfil',
    textoConfirmar: 'Marcar',
    varianteConfirmar: 'primary',
    motivo: true,
  },
  ban_temporal_7: {
    titulo: 'Suspender 7 días',
    textoConfirmar: 'Suspender 7 días',
    varianteConfirmar: 'outline',
    motivo: true,
  },
  ban_temporal_30: {
    titulo: 'Suspender 30 días',
    textoConfirmar: 'Suspender 30 días',
    varianteConfirmar: 'outline',
    motivo: true,
  },
  ban_permanente: {
    titulo: 'Banear permanentemente',
    textoConfirmar: 'Banear',
    varianteConfirmar: 'danger',
    motivo: true,
  },
}

function claveDialogo(accion, dias) {
  return accion === 'ban_temporal' ? `ban_temporal_${dias}` : accion
}

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
  const [dialogo, setDialogo] = useState(null)
  const [procesando, setProcesando] = useState(false)

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

  function abrirResolucion(reporte, accion, dias = null) {
    setDialogo({ tipo: 'reporte', reporte, accion, dias })
  }

  function abrirContrato(contrato, aFavorId) {
    setDialogo({ tipo: 'contrato', contrato, aFavorId })
  }

  function configuracionDialogo() {
    if (!dialogo) return null

    if (dialogo.tipo === 'contrato') {
      const { contrato: c, aFavorId } = dialogo
      const aFavorNombre =
        aFavorId === c.clienteId ? c.clienteNombre : c.trabajadorNombre
      const sancionadoNombre =
        aFavorId === c.clienteId ? c.trabajadorNombre : c.clienteNombre
      return {
        titulo: 'Resolver contrato reportado',
        mensaje: `Se dará la razón a ${aFavorNombre} y se aplicará una advertencia a ${sancionadoNombre}.`,
        textoConfirmar: 'Resolver',
        varianteConfirmar: 'primary',
        motivo: false,
      }
    }

    const { reporte: r, accion, dias } = dialogo
    const base = REPORTE_DIALOGOS[claveDialogo(accion, dias)]
    if (!base) return null

    const mensajes = {
      descartar: `El reporte contra ${r.perfilNombre} se descarta y no se aplica ninguna sanción.`,
      marca: `Se aplicará una advertencia a ${r.perfilNombre} y el reporte quedará resuelto.`,
      ban_temporal: `Se suspenderá a ${r.perfilNombre} por ${dias} días: no podrá recibir solicitudes.`,
      ban_permanente: `Se bloqueará la cuenta de ${r.perfilNombre}. Se cancelan sus solicitudes abiertas y se retiran sus propuestas enviadas.`,
    }

    return { ...base, mensaje: mensajes[accion] ?? '' }
  }

  async function confirmarDialogo(motivo) {
    if (!dialogo) return
    setProcesando(true)
    try {
      if (dialogo.tipo === 'contrato') {
        await adminRepo.resolverContrato(
          dialogo.contrato.contratacionId,
          dialogo.aFavorId,
        )
        mostrar('Contrato resuelto.', 'exito')
      } else {
        await adminRepo.resolverReporte(
          dialogo.reporte.id,
          dialogo.accion,
          dialogo.dias,
          motivo || null,
        )
        mostrar('Reporte resuelto.', 'exito')
      }
      setDialogo(null)
      await recargar()
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setProcesando(false)
    }
  }

  const config = configuracionDialogo()

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
                      <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => abrirResolucion(r, 'descartar')}>
                        Descartar
                      </Button>
                      <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => abrirResolucion(r, 'marca')}>
                        Marcar
                      </Button>
                      <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => abrirResolucion(r, 'ban_temporal', 7)}>
                        Ban 7d
                      </Button>
                      <Button variante="outline" className="px-3 py-2 text-sm" onClick={() => abrirResolucion(r, 'ban_temporal', 30)}>
                        Ban 30d
                      </Button>
                      <Button variante="danger" className="px-3 py-2 text-sm" onClick={() => abrirResolucion(r, 'ban_permanente')}>
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
                      <Button className="px-3 py-2 text-sm" onClick={() => abrirContrato(c, c.clienteId)}>
                        A favor del cliente
                      </Button>
                      <Button className="px-3 py-2 text-sm" onClick={() => abrirContrato(c, c.trabajadorId)}>
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

      {config && (
        <ConfirmarAccion
          abierto
          titulo={config.titulo}
          mensaje={config.mensaje}
          motivoRequerido={Boolean(config.motivo)}
          etiquetaMotivo="Motivo de la sanción"
          textoConfirmar={config.textoConfirmar}
          varianteConfirmar={config.varianteConfirmar}
          cargando={procesando}
          onConfirmar={confirmarDialogo}
          onCancelar={() => setDialogo(null)}
        />
      )}
    </div>
  )
}
