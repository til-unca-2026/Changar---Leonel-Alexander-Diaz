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
- **Panel de administración**: métricas con filtro por período, moderación de oficios
  (aprobar, rechazar y fusionar duplicados), gestión de usuarios (marcas de advertencia
  privadas, ban temporal/permanente, cambio de rol) y reportes de perfiles y contratos
  reportados (con resolución a favor de una parte).
- **Dueño de la app y administradores**: una cuenta `es_superadmin` (el dueño) es la
  única que puede crear cuentas de administrador, mediante links de invitación de un solo
  uso. El dueño es intocable y los demás administradores no pueden generar administradores.
- **Notificaciones in-app**: avisos por propuestas, contrataciones, valoraciones, oficios y
  reportes, con centro de notificaciones y badge en el header.
- **Exploración de perfiles y solicitudes personales**: el cliente busca trabajadores con
  perfil completo (por texto, oficio, zona y reputación) y les envía una solicitud directa.
  El trabajador la acepta enviando su presupuesto o la rechaza; si la acepta, el cliente debe
  confirmar o rechazar ese presupuesto antes de que se cree la contratación.
- **Próxima etapa**: Realtime (opcional), despliegue y documentación.

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

Para levantar un entorno local con datos de arranque (catálogo de oficios y un
usuario dueño `owner@changar.local` / `changar1234`):

```bash
npx supabase start
npx supabase db reset
```

El seed es `supabase/seed.sql` (el que declara `config.toml` en `[db.seed]`).

### Operaciones de base de datos

El password de la base y el project ref viven en `.env.local` (gitignored), con
nombres sin prefijo `VITE_` para que Vite no los meta en el bundle del cliente.
Para aplicar migraciones contra el proyecto alojado:

```bash
$env:SUPABASE_DB_PASSWORD = (Get-Content .env.local | Where-Object { $_ -match '^SUPABASE_DB_PASSWORD=' }) -replace '^SUPABASE_DB_PASSWORD=', ''
npx supabase link --project-ref faoksfvrvbomttngwiqg
npx supabase db push
```

> Si usás el flag `--password`, escapá los caracteres especiales (`#`, `!`): en
> PowerShell se manglinguean y el login falla con `password authentication failed`.
> Pasarlo por variable de entorno es lo seguro.

### Crear el primer administrador (dueño)

El registro público no permite los roles `admin` ni de dueño: el trigger de alta
rechaza esos valores y ninguna RPC acepta crear un dueño. La primera cuenta de
administración se promueve a mano desde el SQL Editor de Supabase.

1. Registrate en la app (`/registro`) con el email que vas a usar como dueño.
2. Promové la cuenta:

   ```sql
   update perfiles
      set rol = 'admin',
          es_superadmin = true
    where email = 'tu-email@ejemplo.com';
   ```

3. Recargá la app (o volvé a iniciar sesión) para que tome el rol nuevo.

`es_superadmin` marca al dueño de la app: es un administrador con la prerrogativa
extra de gestionar cuentas de administrador. La marca es un booleano y no un valor
del enum `rol_usuario` a propósito, así que **no existe ninguna RPC que pueda
asignarla**: crearla es una decisión manual del dueño.

### Gestionar administradores

Desde el panel de administración, la sección **Crear administrador** (solo visible
para el dueño) genera un link de invitación de un solo uso:

1. Completás email, nombre y apellido de la persona a invitar.
2. Copiás el link y se lo compartís por el canal que quieras.
3. La persona se registra con ese link, elige su propia contraseña y entra
   directo al panel.

El link vence a los 7 días y se invalida al usarse. La persona invitada **nunca ve
una contraseña que le haya generado el dueño**: cada administrador elige la suya.
Desde esa misma sección se cancelan las invitaciones pendientes.

Detalles de seguridad del diseño:

- El **token es el único factor**: la invitación se busca por token y nunca por
  email, porque el proyecto no exige confirmar el email y cualquiera puede
  registrarse con cualquier dirección.
- El dueño es **intocable**: ninguna RPC de administración lo marca, lo suspende
  ni lo degrada.
- **Solo el dueño da o quita el rol `admin`**. Los demás administradores
  moderan oficios, reportes y sanciones, pero no gestionan cuentas.
- La tabla de invitaciones queda como registro de qué administrador creó cada
  cuenta.

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
│  └─ admin/      # Dashboard (métricas + filtro), Oficios, Usuarios, Reportes
├─ hooks/         # useSolicitudes, useOficios, useReputacion
└─ lib/
   ├─ data/       # repositorios Supabase: auth, oficios, perfiles, solicitudes,
   │              #   propuestas, contrataciones, valoraciones, portfolio, admin,
   │              #   invitaciones + almacenamiento (Storage)
   ├─ supabase.js # cliente de Supabase
   ├─ errores.js  # mapeo de códigos de error a mensajes
   ├─ format.js   # moneda ARS y fechas
   ├─ perfil.js   # regla de completitud del perfil
   └─ texto.js    # normalización y similitud (oficios)
```

Los repositorios devuelven promesas y aíslan la UI del origen de los datos. Toda la
persistencia (incluidas las imágenes de avatar, portfolio y solicitudes) va contra Supabase.
