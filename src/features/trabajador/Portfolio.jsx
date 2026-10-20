import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext.jsx'
import { useToast } from '@/components/ui/Toast.jsx'
import * as portfolioRepo from '@/lib/data/portfolio.repo.js'
import { fechaRelativa } from '@/lib/format.js'
import { mensajeError } from '@/lib/errores.js'
import Button from '@/components/ui/Button.jsx'
import Card from '@/components/ui/Card.jsx'
import Input from '@/components/ui/Input.jsx'
import FileDrop from '@/components/ui/FileDrop.jsx'
import Spinner from '@/components/ui/Spinner.jsx'

function IconoFoto() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="10" r="1.5" />
      <path d="m21 16-5-5L5 19" />
    </svg>
  )
}

export default function Portfolio() {
  const { usuario } = useAuth()
  const { mostrar } = useToast()

  const [fotos, setFotos] = useState([])
  const [cargando, setCargando] = useState(true)
  const [seleccion, setSeleccion] = useState([])
  const [descripcion, setDescripcion] = useState('')
  const [agregando, setAgregando] = useState(false)

  async function recargar() {
    setFotos(await portfolioRepo.listar(usuario.id))
    setCargando(false)
  }

  useEffect(() => {
    recargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario.id])

  async function agregar() {
    if (seleccion.length === 0) {
      mostrar('Elegí al menos una foto.', 'error')
      return
    }
    try {
      setAgregando(true)
      for (const archivo of seleccion) {
        await portfolioRepo.agregar(usuario.id, {
          file: archivo.file,
          descripcion,
        })
      }
      setSeleccion([])
      setDescripcion('')
      await recargar()
      mostrar('Fotos agregadas al portfolio.', 'exito')
    } catch (err) {
      mostrar(mensajeError(err), 'error')
    } finally {
      setAgregando(false)
    }
  }

  async function eliminar(id) {
    await portfolioRepo.eliminar(id)
    await recargar()
    mostrar('Foto eliminada.', 'info')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link to="/trabajador/perfil" className="font-bold text-primary">
          ←
        </Link>
        <h1 className="text-2xl font-extrabold">Mi portfolio</h1>
      </div>

      <Card className="space-y-4">
        <h2 className="font-bold">Agregar fotos</h2>
        <FileDrop max={5} onChange={setSeleccion} />
        <Input
          label="Descripción (opcional)"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="Ej: Instalación eléctrica en departamento"
        />
        <Button className="w-full" onClick={agregar} disabled={agregando}>
          {agregando ? 'Agregando…' : 'Agregar al portfolio'}
        </Button>
      </Card>

      {cargando ? (
        <div className="flex justify-center py-10 text-primary">
          <Spinner className="h-8 w-8" />
        </div>
      ) : fotos.length === 0 ? (
        <Card className="text-center">
          <p className="font-semibold text-ink">Tu portfolio está vacío</p>
          <p className="mt-1 text-sm text-muted">
            Subí fotos de trabajos para mostrar tu experiencia.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {fotos.map((foto) => (
            <Card key={foto.id} className="flex flex-col gap-3 p-3">
              <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-primary-soft text-primary">
                {foto.url ? (
                  <img src={foto.url} alt={foto.descripcion || foto.nombre} className="h-full w-full object-cover" />
                ) : (
                  <IconoFoto />
                )}
              </div>
              <div>
                <p className="truncate text-sm font-semibold text-ink">
                  {foto.descripcion || foto.nombre}
                </p>
                <p className="text-xs text-muted">{fechaRelativa(foto.createdAt)}</p>
              </div>
              <button
                type="button"
                onClick={() => eliminar(foto.id)}
                className="text-xs font-bold text-danger"
              >
                Eliminar
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
