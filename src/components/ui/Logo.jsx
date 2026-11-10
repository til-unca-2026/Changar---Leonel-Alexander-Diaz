export default function Logo({ className = '' }) {
  return (
    <img
      src="/logo-changar.png"
      alt="ChangAr"
      draggable="false"
      className={`mx-auto block h-40 w-auto select-none object-contain ${className}`}
    />
  )
}
