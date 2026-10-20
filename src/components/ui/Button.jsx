const VARIANTES = {
  primary: 'bg-primary text-white hover:bg-primary-dark active:bg-primary-dark',
  soft: 'bg-primary-soft text-primary hover:bg-blue-100',
  outline: 'border border-line bg-surface text-ink hover:bg-canvas',
  ghost: 'text-primary hover:bg-primary-soft',
  danger: 'bg-danger text-white hover:opacity-90',
}

export default function Button({
  variante = 'primary',
  tipo = 'button',
  className = '',
  children,
  ...props
}) {
  return (
    <button
      type={tipo}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTES[variante]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
