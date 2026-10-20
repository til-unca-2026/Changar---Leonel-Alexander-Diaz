export default function Card({ as: Etiqueta = 'div', className = '', children, ...props }) {
  return (
    <Etiqueta
      className={`rounded-card border border-line bg-surface p-5 shadow-sm ${className}`}
      {...props}
    >
      {children}
    </Etiqueta>
  )
}
