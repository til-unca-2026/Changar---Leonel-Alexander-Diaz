# ChangAr

Plataforma web que conecta clientes con trabajadores independientes (plomeros,
electricistas, herreros y otros oficios), con perfiles, publicaciones de servicio y
un sistema de reputación basado en trabajos realizados y valoraciones.

> Documentación del proyecto en [`docs/`](docs/). El plan técnico completo está en
> [`docs/05_Plan-Tecnico.md`](docs/05_Plan-Tecnico.md).

## Estado actual

- **Identidad y perfiles en Supabase**: registro, login y cierre de sesión reales; perfil
  del trabajador (oficios, avatar, portfolio) y perfil del cliente (zona y descripción).
- **Solicitudes y propuestas en Supabase**: el cliente publica solicitudes con fotos, el
  trabajador explora el feed, se postula y el cliente ve las propuestas recibidas.
- **Contrataciones**: el cliente acepta una propuesta (se rechazan las demás), el servicio
  se cierra con **doble confirmación** de fin, se puede cancelar mientras está en curso y,
  ante un desacuerdo, se puede **reportar el contrato** (reporte + descargo, una vez cada
  parte) como antecedente público.
- **Perfiles públicos y advertencias**: cada usuario tiene un perfil público con su
  información, su **reputación** (promedio + distribución) y su **historial**: valoraciones
  recibidas, contratos cancelados y contratos reportados (con fotos). Un triángulo de
  advertencia ⚠ señala una valoración baja o un contrato reportado, y un "!" rojo cuando
  hay 2+ reportes. En las propuestas, el cliente ve además miniaturas de los trabajos
  previos del postulante.
- **Valoraciones y reputación**: valoración mutua (1-5 + comentario + fotos) al completar
  una contratación; promedio y distribución visibles en perfiles y listados.
- **Panel de administración (etapa 1)**: métricas generales y moderación de oficios
  (aprobar, rechazar y fusionar duplicados).
- **Próxima etapa**: valoraciones y reputación, notificaciones, gestión de usuarios y
  reportes, y despliegue.

## Configuración

1. Copiá `.env.example` a `.env.local` y completá:

   ```env
   VITE_SUPABASE_URL=...
   VITE_SUPABASE_ANON_KEY=...
   ```

2. Aplicá las migraciones de base:

   ```bash
   npx supabase link --project-ref <project-ref>
   npx supabase db push
   ```

### Crear el primer administrador

El registro público no permite el rol `admin`. Promové una cuenta desde el SQL Editor de
Supabase:

```sql
update perfiles
   set rol = 'admin'
 where email = 'tu-email@ejemplo.com';
```

Después recargá la app (o volvé a iniciar sesión) para que tome el rol nuevo.

## Requisitos

- Node.js 20 o superior
- npm

## Puesta en marcha

```bash
npm install
npm run dev
```

La app queda disponible en `http://localhost:5173`.

### Otros comandos

```bash
npm run build     # build de producción en dist/
npm run preview   # sirve el build de producción
```

## Estructura

```
src/
├─ components/
│  ├─ ui/         # Button, Input, Select, Textarea, Card, Badge, Spinner, Toast, FileDrop, Logo
│  └─ layout/     # AppLayout, RoleGuard
├─ context/       # AuthContext
├─ features/
│  ├─ auth/       # Login, Registro, OnboardingTrabajador, Perfil (Mi cuenta)
│  ├─ cliente/    # Dashboard, MisSolicitudes, NuevaSolicitud, DetalleSolicitud, TarjetaSolicitud
│  ├─ trabajador/ # Dashboard, Explorar, DetalleSolicitud, MisPropuestas, TarjetaPropuesta,
│  │              # Perfil, PerfilTrabajador, OficioSelector, AvatarUploader, Portfolio,
│  │              # TarjetaOferta
│  ├─ contrataciones/ # ListaContrataciones, DetalleContratacion, Bitacora
│  ├─ perfiles/      # PublicProfile (perfil público con reputación y reportes)
│  └─ admin/      # Dashboard (métricas), Oficios (moderación)
├─ hooks/         # useSolicitudes, useOficios, useReputacion
└─ lib/
   ├─ data/       # repositorios Supabase: auth, oficios, perfiles, solicitudes,
   │              #   propuestas, contrataciones, valoraciones, portfolio, admin
   │              #   + almacenamiento (Storage)
   ├─ supabase.js # cliente de Supabase
   ├─ errores.js  # mapeo de códigos de error a mensajes
   ├─ format.js   # moneda ARS y fechas
   ├─ perfil.js   # regla de completitud del perfil
   └─ texto.js    # normalización y similitud (oficios)
```

Los repositorios devuelven promesas y aíslan la UI del origen de los datos. Toda la
persistencia (incluidas las imágenes de avatar, portfolio y solicitudes) va contra Supabase.
