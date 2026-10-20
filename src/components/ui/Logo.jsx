export default function Logo({ className = '' }) {
  return (
    <div className={`flex items-center justify-center gap-2 ${className}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#2563EB"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-7 w-7"
        aria-hidden="true"
      >
        <path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3z" />
        <path d="M14.7 6.3 18 3l3 3-3.3 3.3" />
      </svg>
      <span className="text-2xl font-extrabold text-primary">ChangAr</span>
    </div>
  )
}
