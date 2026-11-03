import Avatar from '@/components/ui/Avatar.jsx'
import { fechaRelativa } from '@/lib/format.js'

const ETIQUETAS = {
  fin: 'Confirmó el fin del servicio',
  cancelacion: 'Canceló el servicio',
  respuesta: 'Agregó una respuesta',
  reporte: 'Reportó el contrato',
  descargo: 'Presentó su descargo',
}

export default function Bitacora({ evidencias }) {
  if (!evidencias || evidencias.length === 0) {
    return <p className="text-sm text-muted">Todavía no hay novedades registradas.</p>
  }

  return (
    <ol className="space-y-4">
      {evidencias.map((e) => (
        <li key={e.id} className="flex gap-3">
          <Avatar
            usuario={{
              nombre: e.autorNombre,
              apellido: e.autorApellido,
              avatarUrl: e.autorAvatar,
            }}
            tamano="sm"
          />
          <div className="min-w-0 flex-1 rounded-xl border border-line bg-surface p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-bold text-ink">
                {e.autorNombre} {e.autorApellido}
              </p>
              <p className="text-xs text-muted">{fechaRelativa(e.createdAt)}</p>
            </div>
            <p className="mt-0.5 text-xs font-semibold text-primary">
              {ETIQUETAS[e.tipo] ?? e.tipo}
            </p>
            {e.comentario && (
              <p className="mt-2 whitespace-pre-line text-sm text-ink">{e.comentario}</p>
            )}
            {e.fotos?.length > 0 && (
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {e.fotos.map((foto) => (
                  <a
                    key={foto.path}
                    href={foto.url}
                    target="_blank"
                    rel="noreferrer"
                    className="aspect-square overflow-hidden rounded-lg border border-line"
                  >
                    <img src={foto.url} alt="" className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
