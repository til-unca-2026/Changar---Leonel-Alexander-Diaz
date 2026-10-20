export default function Avatar({ usuario, tamano = 'md', className = '' }) {
  const tamanos = {
    sm: 'h-9 w-9 text-sm',
    md: 'h-10 w-10 text-base',
    lg: 'h-14 w-14 text-xl',
  }
  const iniciales = `${usuario?.nombre?.[0] ?? ''}${usuario?.apellido?.[0] ?? ''}`.toUpperCase()

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-extrabold text-primary ${tamanos[tamano]} ${className}`}
    >
      {usuario?.avatarUrl ? (
        <img src={usuario.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        iniciales || '?'
      )}
    </span>
  )
}
