import { useEffect, useState } from 'react'
import Button from './Button.jsx'
import Modal from './Modal.jsx'
import Textarea from './Textarea.jsx'

/**
 * Diálogo de confirmación para acciones sensibles (baneos, advertencias, etc.).
 * Si `motivoRequerido` está activo, el motivo es obligatorio.
 */
export default function ConfirmarAccion({
  abierto,
  titulo,
  mensaje,
  motivoRequerido = false,
  etiquetaMotivo = 'Motivo',
  placeholderMotivo = '',
  textoConfirmar = 'Confirmar',
  varianteConfirmar = 'primary',
  cargando = false,
  onConfirmar,
  onCancelar,
}) {
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!abierto) return
    setMotivo('')
    setError('')
  }, [abierto])

  function confirmar() {
    const texto = motivo.trim()
    if (motivoRequerido && !texto) {
      setError('Escribí el motivo de la sanción.')
      return
    }
    setError('')
    onConfirmar?.(texto)
  }

  return (
    <Modal
      abierto={abierto}
      onCerrar={() => {
        if (!cargando) onCancelar?.()
      }}
      titulo={titulo}
      pie={
        <>
          <Button variante="outline" onClick={onCancelar} disabled={cargando}>
            Cancelar
          </Button>
          <Button variante={varianteConfirmar} onClick={confirmar} disabled={cargando}>
            {cargando ? 'Aplicando…' : textoConfirmar}
          </Button>
        </>
      }
    >
      {mensaje && <p className="text-sm text-ink">{mensaje}</p>}
      {motivoRequerido && (
        <Textarea
          label={etiquetaMotivo}
          name="motivo-sancion"
          rows={3}
          value={motivo}
          onChange={(e) => {
            setMotivo(e.target.value)
            if (error) setError('')
          }}
          placeholder={placeholderMotivo || 'Explicá el motivo de la sanción.'}
          error={error}
        />
      )}
    </Modal>
  )
}
