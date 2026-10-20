import { useNavigate } from 'react-router-dom'
import PerfilTrabajador from '@/features/trabajador/PerfilTrabajador.jsx'

export default function OnboardingTrabajador() {
  const navigate = useNavigate()

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-10 pt-8 lg:px-8 lg:pt-10">
      <PerfilTrabajador
        modo="onboarding"
        onGuardado={() => navigate('/trabajador', { replace: true })}
      />
    </div>
  )
}
