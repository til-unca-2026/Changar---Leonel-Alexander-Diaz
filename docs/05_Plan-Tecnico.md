# Plan Técnico

Documento de planificación. Consolida el modelo de datos, la seguridad, las reglas de
negocio y la arquitectura del frontend de ChangAr, tomando como base
`01_Introduccion.md`, `02_Objetivos.md`, `03_Alcance.md` y `04_Metodologia.md`.

**Tipo de producto:** aplicación web (cliente-servidor en el navegador). Sin app nativa,
sin tiendas de apps. Acceso por URL, diseño responsive mobile-first.

**Moneda:** pesos argentinos (ARS), formato `$ 1.234.567`.

---

# DECISIONES TOMADAS

| # | Decisión | Impacto |
|---|---|---|
| 1 | Al aceptar una propuesta, las demás pasan automáticamente a `rechazada` y se notifica a cada trabajador | RPC `aceptar_propuesta` |
| 2 | Un trabajador puede proponer un presupuesto mayor al `presupuesto_max` del cliente: **se advierte en la UI, no se bloquea** | Pantalla comparar propuestas |
| 3 | Estilos con **Tailwind CSS** | Proyecto frontend |
| 4 | Se agregan la tabla `reportes` y el campo `perfiles.avatar_path` (pedidos por la doc pero sin modelo) | Migración |
| 5 | Para enviar propuestas el perfil debe estar completo (al menos 1 oficio + descripción + ubicación). **Sin antigüedad mínima**: los trabajadores nuevos pueden postular | RPC `enviar_propuesta` |
| 6 | Ubicación: **solo texto libre**, sin mapas ni GPS | Formularios |
| 7 | Notificaciones solo dentro de la app (sin push ni email), generadas por triggers | Tabla `notificaciones` |
| 8 | El teléfono vive en `perfil_contacto` y **solo lo ve la contraparte con la que existe una contratación activa o completada** | Tabla `perfil_contacto` + RLS |
| 9 | El **email no es visible** para otros usuarios; se protege con privilegios por columna | RLS / grants |
| 10 | El bloqueo se hace **real**: `activo = false` + ban en Supabase Auth vía Edge Function | Edge Function + RPC |
| 11 | `presupuesto_max` es **opcional**: la advertencia por excederlo aplica solo cuando el cliente cargó un monto | Formulario / UI |
| 12 | Los **trabajadores pueden proponer oficios nuevos**, que **requieren aprobación del admin**. Se evitan duplicados por mayúsculas/acentos (columna normalizada) y por typos (sugerencia difusa `pg_trgm`). El admin puede fusionar duplicados | RPCs de oficios + RLS |
| 13 | Un oficio **pendiente cuenta para que el trabajador pueda postular**, pero **no se muestra público** hasta ser aprobado | RPC `enviar_propuesta` + RLS de oficios |
| 14 | El panel del admin muestra **métricas completas**: totales, tendencia 30 días, top de oficios y cola de pendientes | RPC `admin_metricas` |
| 15 | El **fin de servicio requiere doble validación** (cliente y trabajador). La **cancelación es unilateral**. En ambos casos ambas partes pueden aportar texto y fotos de evidencia | RPCs `confirmar_fin`, `cancelar_contratacion`, `agregar_respuesta` |
| 16 | La solicitud se **previsualiza y se puede editar entero** antes de confirmar la publicación. Una vez publicada no se edita | Pantalla nueva-solicitud (paso de preview) |

> **Consecuencia de la decisión 5:** como los trabajadores nuevos arrancan con 0 reseñas y la
> reputación es la única señal de confianza, el perfil debe mostrar un badge **"Nuevo"** en
> lugar de "0 estrellas", y el ordenamiento de resultados no debe penalizarlos. De lo contrario
> se genera un círculo vicioso: sin reseñas → sin trabajo → sin reseña.

---

# ESTRUCTURA DE LAS TABLAS

## Tipos enumerados

```sql
create type rol_usuario        as enum ('cliente', 'trabajador', 'admin');
create type estado_solicitud   as enum ('abierta', 'asignada', 'cerrada', 'cancelada');
create type estado_propuesta   as enum ('enviada', 'aceptada', 'rechazada', 'retirada');
create type estado_contratacion as enum ('en_curso', 'pendiente_confirmacion', 'completado', 'cancelado');
create type estado_oficio      as enum ('pendiente', 'activo', 'inactivo');
create type tipo_evidencia     as enum ('fin', 'cancelacion', 'respuesta');
create type tipo_notificacion  as enum (
  'nueva_propuesta', 'propuesta_aceptada', 'propuesta_rechazada',
  'contratacion_creada', 'contratacion_completada', 'contratacion_cancelada',
  'contratacion_pendiente_confirmacion',
  'nueva_valoracion', 'cuenta_bloqueada',
  'oficio_pendiente', 'oficio_aprobado', 'oficio_rechazado'
);
create type tipo_referencia   as enum ('solicitud', 'valoracion', 'perfil');
create type estado_reporte    as enum ('pendiente', 'resuelto', 'descartado');
```

## Identidad, perfiles y roles

```sql
create table perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  apellido    text not null,
  email       text not null,
  rol         rol_usuario not null,
  avatar_path text,                                      -- NUEVO (ver brechas)
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table perfiles_trabajador (
  id          uuid primary key references perfiles(id) on delete cascade,
  descripcion text,
  experiencia text,
  ubicacion   text
);

-- NUEVO: el teléfono es necesario porque no hay chat (ver decisión 8).
create table perfil_contacto (
  perfil_id  uuid primary key references perfiles(id) on delete cascade,
  telefono   text not null,
  updated_at timestamptz not null default now()
);

create table oficios (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  nombre_normalizado text,                         -- llenado por trigger (decisión 12)
  descripcion        text,
  estado             estado_oficio not null default 'activo',   -- el seed entra activo
  creado_por         uuid references perfiles(id),
  created_at         timestamptz not null default now()
);

create table trabajador_oficios (
  trabajador_id uuid not null references perfiles(id) on delete cascade,
  oficio_id     uuid not null references oficios(id) on delete cascade,
  primary key (trabajador_id, oficio_id)
);
```

### Reglas

- Cada perfil se vincula a una identidad de Supabase Auth mediante el mismo UUID.
- Un único rol por usuario en el MVP.
- Un trabajador puede ofrecer varios oficios y un oficio puede tener muchos trabajadores.
- El rol `admin` **no** se asigna desde el registro público: se crea mediante la RPC
  `admin_asignar_rol` ejecutada por otro administrador, y el trigger de alta de usuario
  rechaza explícitamente ese valor.
- Las fotos del portfolio viven en `portfolio_fotos` + Storage, no como listas en el perfil.
- La separación `perfiles` / `perfiles_trabajador` permite agregar un rol dual en el futuro
  sin duplicar la identidad.
- Los oficios nacen `pendiente` cuando los crea un trabajador y `activo` cuando los crea el
  admin o vienen del seed.

## Solicitudes, propuestas y contrataciones

```sql
create table solicitudes (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references perfiles(id) on delete cascade,
  oficio_id      uuid not null references oficios(id),
  titulo         text not null,
  descripcion    text not null,
  ubicacion      text not null,
  presupuesto_max numeric(12,2),                       -- opcional (decisión 11)
  estado        estado_solicitud not null default 'abierta',
  created_at    timestamptz not null default now()
);

create table solicitud_fotos (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references solicitudes(id) on delete cascade,
  storage_path text not null
);

create table propuestas (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references solicitudes(id) on delete cascade,
  trabajador_id uuid not null references perfiles(id) on delete cascade,
  descripcion  text not null,
  presupuesto  numeric(12,2) not null,
  estado       estado_propuesta not null default 'enviada',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (solicitud_id, trabajador_id)     -- una propuesta por trabajador por solicitud
);

create table contrataciones (
  id                 uuid primary key default gen_random_uuid(),
  propuesta_id       uuid not null unique references propuestas(id),
  cliente_id         uuid not null references perfiles(id),
  trabajador_id      uuid not null references perfiles(id),
  estado             estado_contratacion not null default 'en_curso',
  cancelado_por      uuid references perfiles(id),
  motivo_cancelacion text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- NUEVO (decisión 15): evidencia textual/fotográfica del fin, la cancelación o la
-- respuesta de la contraparte. La fuente de verdad de la doble validación es el
-- conteo de evidencias tipo 'fin'.
create table contratacion_evidencias (
  id              uuid primary key default gen_random_uuid(),
  contratacion_id uuid not null references contrataciones(id) on delete cascade,
  autor_id        uuid not null references perfiles(id),
  tipo            tipo_evidencia not null,
  comentario      text,
  created_at      timestamptz not null default now()
);

-- Una sola evidencia de tipo 'fin' por participante por contratación.
create unique index on contratacion_evidencias (contratacion_id, autor_id)
  where tipo = 'fin';

create table contratacion_evidencia_fotos (
  id           uuid primary key default gen_random_uuid(),
  evidencia_id uuid not null references contratacion_evidencias(id) on delete cascade,
  storage_path text not null
);
```

## Valoraciones y fotografías

```sql
create table valoraciones (
  id             uuid primary key default gen_random_uuid(),
  contratacion_id uuid not null references contrataciones(id) on delete cascade,
  autor_id       uuid not null references perfiles(id),
  destinatario_id uuid not null references perfiles(id),
  puntuacion     integer not null check (puntuacion between 1 and 5),
  comentario     text,
  created_at     timestamptz not null default now(),
  unique (contratacion_id, autor_id),    -- una valoración por participante
  check (autor_id <> destinatario_id)
);

create table valoracion_fotos (
  id           uuid primary key default gen_random_uuid(),
  valoracion_id uuid not null references valoraciones(id) on delete cascade,
  storage_path text not null
);

create table portfolio_fotos (
  id           uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references perfiles(id) on delete cascade,
  storage_path text not null,
  descripcion  text,
  created_at   timestamptz not null default now()
);
```

## Administración

```sql
create table notificaciones (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references perfiles(id) on delete cascade,
  tipo          tipo_notificacion not null,
  referencia_id uuid,
  leida         boolean not null default false,
  created_at    timestamptz not null default now()
);

-- NUEVO: Existía el requisito en el Flujo 4 (revisar denuncias / moderar)
-- pero no había tabla que lo soportara.
create table reportes (
  id              uuid primary key default gen_random_uuid(),
  reportante_id   uuid not null references perfiles(id),
  tipo_referencia tipo_referencia not null,
  referencia_id   uuid not null,           -- id polimórfico
  motivo          text not null,
  estado          estado_reporte not null default 'pendiente',
  resuelto_por    uuid references perfiles(id),
  created_at      timestamptz not null default now()
);
```

## Extensiones

```sql
create extension if not exists pg_trgm;    -- sugerencia difusa de oficios (decisión 12)
create extension if not exists unaccent;   -- normalización de acentos
```

## Índices

```sql
create index on solicitudes (oficio_id, estado, created_at desc);
create index on solicitudes (cliente_id);
create index on propuestas (solicitud_id);
create index on propuestas (trabajador_id);
create index on contrataciones (cliente_id);
create index on contrataciones (trabajador_id);
create index on notificaciones (usuario_id, leida);
create index on valoraciones (destinatario_id);
create index on reportes (estado, created_at desc);

-- Oficios: unicidad normalizada + búsqueda difusa
create unique index on oficios (nombre_normalizado);
create index on oficios using gin (nombre_normalizado gin_trgm_ops);
create index on oficios (estado);
```

## Vista de reputación

El Flujo 3 pide *"actualizar promedio de estrellas y perfiles"* pero no existe dónde
guardarlo. Se resuelve con una vista: siempre consistente y sin triggers que mantener.

```sql
create view v_perfil_publico
with (security_invoker = true)          -- respeta RLS y los grants por columna
as
select p.id, p.nombre, p.apellido, p.avatar_path, p.rol, p.activo, p.created_at,
       pt.descripcion, pt.experiencia, pt.ubicacion,
       coalesce(avg(v.puntuacion), 0)::numeric(3,2) as puntuacion_promedio,
       count(v.id)                                as valoraciones_count,
       count(v.id) = 0                           as es_nuevo
from perfiles p
left join perfiles_trabajador pt on pt.id = p.id
left join valoraciones v        on v.destinatario_id = p.id
group by p.id, pt.id;
```

Para el perfil público de un trabajador, sus oficios se listan aparte filtrando
`trabajador_oficios` por oficios `activo` (los `pendiente` no se muestran a terceros,
según la decisión 13).

Si más adelante el panel de admin se pone lento, se puede migrar a columnas cacheadas
(`puntuacion_promedio`, `valoraciones_count`) mantenidas por trigger sobre `valoraciones`.
No es necesario para el MVP.

---

# SEGURIDAD (RLS)

## Helper reutilizable

Evita recursión infinita en las policies que consultan `perfiles`:

```sql
create or replace function public.es_admin() returns boolean
language sql security definer stable set search_path = public
as $$ select exists (
  select 1 from perfiles where id = auth.uid() and rol = 'admin' and activo
) $$;
```

## Protección de columnas sensibles

Una policy `for update using (id = auth.uid())` dejaría al usuario cambiar su propio `rol`
o `activo`. Y una lectura abierta expondría el `email` de todos (decisión 9). Ambas cosas
se controlan con privilegios a nivel de columna: el usuario solo puede **leer** datos
públicos y **escribir** su nombre, apellido y avatar. El `rol`, el `activo` y el email
quedan fuera del alcance del usuario común.

```sql
-- Escritura: solo estas columnas
revoke update on perfiles from authenticated;
grant  update (nombre, apellido, avatar_path) on perfiles to authenticated;

-- Lectura: sin email (decisión 9)
revoke select on perfiles from authenticated;
grant  select (id, nombre, apellido, avatar_path, rol, activo, created_at)
  on perfiles to authenticated;
```

El propio email el usuario lo obtiene de la sesión (`supabase.auth.getUser()`), no de
`perfiles`. El admin lo consulta mediante `admin_listar_usuarios()`.

## Policies por tabla

```sql
-- ===== perfiles =====
alter table perfiles enable row level security;
create policy "perfiles lectura publica" on perfiles
  for select to authenticated using (true);
create policy "perfiles alta propia" on perfiles
  for insert with check (id = auth.uid());
create policy "perfiles edicion propia" on perfiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy "perfiles borrado admin" on perfiles
  for delete using (es_admin());

-- ===== perfiles_trabajador =====
alter table perfiles_trabajador enable row level security;
create policy "pt lectura publica" on perfiles_trabajador
  for select to authenticated using (true);
create policy "pt alta propia" on perfiles_trabajador
  for insert with check (id = auth.uid());
create policy "pt edicion propia" on perfiles_trabajador
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ===== perfil_contacto (decisión 8) =====
-- Lectura: el dueño, el admin, o la contraparte con una contratación no cancelada.
alter table perfil_contacto enable row level security;
create policy "contacto lectura duenio o contraparte" on perfil_contacto
  for select to authenticated using (
    perfil_id = auth.uid()
    or es_admin()
    or exists (
      select 1 from contrataciones c
      where c.estado in ('en_curso', 'pendiente_confirmacion', 'completado')
        and (
          (c.cliente_id = auth.uid()    and c.trabajador_id = perfil_contacto.perfil_id)
          or (c.trabajador_id = auth.uid() and c.cliente_id = perfil_contacto.perfil_id)
        )
    )
  );
create policy "contacto alta propia" on perfil_contacto
  for insert with check (perfil_id = auth.uid());
create policy "contacto edicion propia" on perfil_contacto
  for update using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- ===== oficios (decisiones 12 y 13) =====
-- Lectura: activos para todos; pendientes solo su creador y el admin; inactivos solo admin.
alter table oficios enable row level security;
create policy "oficios lectura" on oficios
  for select to authenticated using (
    estado = 'activo'
    or es_admin()
    or (estado = 'pendiente' and creado_por = auth.uid())
  );
-- Alta: cualquier autenticado, pero forzada a 'pendiente' (el admin puede crear activo).
-- En la práctica el alta ocurre por la RPC crear_oficio, que además asocia al trabajador.
create policy "oficios alta" on oficios
  for insert with check (
    creado_por = auth.uid() and (estado = 'pendiente' or es_admin())
  );
create policy "oficios edicion admin" on oficios
  for update using (es_admin()) with check (es_admin());
create policy "oficios borrado admin" on oficios
  for delete using (es_admin());

-- ===== trabajador_oficios =====
alter table trabajador_oficios enable row level security;
create policy "to lectura publica" on trabajador_oficios
  for select to authenticated using (true);
create policy "to escritura propia" on trabajador_oficios
  for all using (trabajador_id = auth.uid()) with check (trabajador_id = auth.uid());

-- ===== solicitudes =====
alter table solicitudes enable row level security;
create policy "solicitudes lectura publica" on solicitudes
  for select to authenticated using (true);   -- feed de solicitudes
create policy "solicitudes alta cliente" on solicitudes
  for insert with check (cliente_id = auth.uid());
create policy "solicitudes edicion duenio" on solicitudes
  for update using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());
create policy "solicitudes borrado duenio o admin" on solicitudes
  for delete using (cliente_id = auth.uid() or es_admin());

-- ===== solicitud_fotos =====
alter table solicitud_fotos enable row level security;
create policy "sf lectura publica" on solicitud_fotos
  for select to authenticated using (true);
create policy "sf alta duenio" on solicitud_fotos
  for insert with check (exists (
    select 1 from solicitudes s where s.id = solicitud_id and s.cliente_id = auth.uid()
  ));
create policy "sf borrado duenio o admin" on solicitud_fotos
  for delete using (exists (
    select 1 from solicitudes s where s.id = solicitud_id and s.cliente_id = auth.uid()
  ) or es_admin());

-- ===== propuestas =====
alter table propuestas enable row level security;
create policy "propuestas lectura participantes" on propuestas
  for select to authenticated using (
    trabajador_id = auth.uid()
    or exists (select 1 from solicitudes s
               where s.id = solicitud_id and s.cliente_id = auth.uid())
  );
create policy "propuestas alta trabajador" on propuestas
  for insert with check (trabajador_id = auth.uid());
create policy "propuestas edicion trabajador" on propuestas
  for update using (trabajador_id = auth.uid())
  with check (trabajador_id = auth.uid() and estado = 'retirada');
create policy "propuestas borrado admin" on propuestas
  for delete using (es_admin());

-- ===== contrataciones =====
-- Lectura para participantes. Las escrituras van SOLO por RPC (security definer),
-- nunca directo desde el cliente: crearlas o modificarlas a mano rompería la máquina de estados.
alter table contrataciones enable row level security;
create policy "contrataciones lectura participantes" on contrataciones
  for select to authenticated using (
    cliente_id = auth.uid() or trabajador_id = auth.uid() or es_admin()
  );

-- ===== contratacion_evidencias (decisión 15) =====
-- Lectura para participantes; sin INSERT (solo por RPC); borrado solo admin.
alter table contratacion_evidencias enable row level security;
create policy "evidencias lectura participantes" on contratacion_evidencias
  for select to authenticated using (
    es_admin()
    or exists (
      select 1 from contrataciones c
      where c.id = contratacion_id
        and (c.cliente_id = auth.uid() or c.trabajador_id = auth.uid())
    )
  );
create policy "evidencias borrado admin" on contratacion_evidencias
  for delete using (es_admin());

alter table contratacion_evidencia_fotos enable row level security;
create policy "evidencias fotos lectura participantes" on contratacion_evidencia_fotos
  for select to authenticated using (
    es_admin()
    or exists (
      select 1 from contratacion_evidencias e
      join contrataciones c on c.id = e.contratacion_id
      where e.id = evidencia_id
        and (c.cliente_id = auth.uid() or c.trabajador_id = auth.uid())
    )
  );
create policy "evidencias fotos borrado admin" on contratacion_evidencia_fotos
  for delete using (es_admin());

-- ===== valoraciones =====
alter table valoraciones enable row level security;
create policy "valoraciones lectura publica" on valoraciones
  for select to authenticated using (true);
create policy "valoraciones alta participante" on valoraciones
  for insert with check (autor_id = auth.uid());
-- Sin policy de update: las valoraciones son inmutables.
create policy "valoraciones borrado admin" on valoraciones
  for delete using (es_admin());   -- moderación

-- ===== valoracion_fotos =====
alter table valoracion_fotos enable row level security;
create policy "vf lectura publica" on valoracion_fotos
  for select to authenticated using (true);
create policy "vf alta autor" on valoracion_fotos
  for insert with check (exists (
    select 1 from valoraciones v where v.id = valoracion_id and v.autor_id = auth.uid()
  ));
create policy "vf borrado admin" on valoracion_fotos
  for delete using (es_admin());

-- ===== portfolio_fotos =====
alter table portfolio_fotos enable row level security;
create policy "pf lectura publica" on portfolio_fotos
  for select to authenticated using (true);
create policy "pf alta duenio" on portfolio_fotos
  for insert with check (trabajador_id = auth.uid());
create policy "pf borrado duenio o admin" on portfolio_fotos
  for delete using (trabajador_id = auth.uid() or es_admin());

-- ===== notificaciones =====
alter table notificaciones enable row level security;
create policy "notif lectura propia" on notificaciones
  for select to authenticated using (usuario_id = auth.uid());
create policy "notif marcar leida" on notificaciones
  for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "notif borrado admin" on notificaciones
  for delete using (es_admin());
-- Sin policy de insert: las notificaciones las crean solo los triggers y las RPCs.

-- ===== reportes =====
alter table reportes enable row level security;
create policy "reportes alta propio" on reportes
  for insert with check (reportante_id = auth.uid());
create policy "reportes lectura propio o admin" on reportes
  for select to authenticated using (reportante_id = auth.uid() or es_admin());
create policy "reportes resolucion admin" on reportes
  for update using (es_admin()) with check (es_admin());
```

> **Nota:** la política de `propuestas` para update del trabajador solo permite pasar a
> `retirada`. Cualquier otro cambio de estado se hace por RPC, para que el flujo no pueda
> manipularse desde el cliente.

## Storage

Cinco buckets, todos de **lectura pública** y **escritura restringida a la carpeta del
propio usuario**:

| Bucket | Contenido | Path |
|---|---|---|
| `avatares` | Foto de perfil | `{user_id}/avatar.{ext}` |
| `solicitud-fotos` | Fotos de la solicitud | `{user_id}/{solicitud_id}/{n}.{ext}` |
| `portfolio-fotos` | Portfolio del trabajador | `{user_id}/{n}.{ext}` |
| `valoracion-fotos` | Evidencia de la valoración | `{user_id}/{contratacion_id}/{n}.{ext}` |
| `contratacion-evidencias` | Evidencia de fin / cancelación / respuesta | `{user_id}/{contratacion_id}/{n}.{ext}` |

```sql
-- Patrón repetido en los 5 buckets
create policy "escritura solo en carpeta propia"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatares'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

**Límites definidos:** máx. 5 MB por archivo y tipos `image/jpeg`, `image/png`,
`image/webp`.

**Cantidad de fotos:** 5 por solicitud, 5 por evidencia de contratación, 3 por valoración.

---

# LÓGICA DE BASE DE DATOS

Toda operación que escribe en más de una tabla vive en una **función RPC con
`security definer`**. Es la única forma de garantizar atomicidad y de que el cliente no
dependa de que el usuario respete el orden de las llamadas.

> Con `security definer` se hace bypass de RLS, por lo que **cada función debe validar
> explícitamente** que `auth.uid()` tiene derecho. Esta validación es la barrera real.

## Alta de usuario (trigger)

```sql
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.raw_user_meta_data->>'rol' = 'admin' then
    raise exception 'rol_no_permitido';
  end if;

  insert into perfiles (id, nombre, apellido, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    new.email,
    coalesce((new.raw_user_meta_data->>'rol')::rol_usuario, 'cliente')
  );

  -- Teléfono (decisión 8): el registro lo pide para todos los roles.
  if new.raw_user_meta_data->>'telefono' is not null then
    insert into perfil_contacto (perfil_id, telefono)
    values (new.id, new.raw_user_meta_data->>'telefono');
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

El perfil se crea por trigger y no por `INSERT` del cliente para que ningún usuario pueda
darse de alta sin perfil o con un rol manipulado.

## Oficios

### Normalización y búsqueda difusa (decisión 12)

```sql
-- Normaliza: minúsculas, sin acentos, sin espacios sobrantes.
create or replace function public.normalizar_oficio(t text) returns text
language sql stable as $$
  select regexp_replace(lower(unaccent(btrim(t))), '\s+', ' ', 'g');
$$;

-- Llena la columna normalizada en cada alta/edición (unaccent no es inmutable,
-- por eso se usa un trigger y no un índice funcional).
create or replace function public.tg_normalizar_oficio() returns trigger
language plpgsql as $$
begin
  new.nombre_normalizado := normalizar_oficio(new.nombre);
  return new;
end $$;

create trigger tr_normalizar_oficio
  before insert or update of nombre on oficios
  for each row execute function public.tg_normalizar_oficio();
```

```sql
-- Sugerencias para la UI: coincidencia por subcadena + similitud difusa (atrapa typos).
create or replace function public.buscar_oficios(p_query text)
returns table (id uuid, nombre text, similitud real)
language sql stable security definer set search_path = public
as $$
  select o.id, o.nombre,
         similarity(o.nombre_normalizado, normalizar_oficio(p_query)) as similitud
  from oficios o
  where o.estado = 'activo'
    and (
      o.nombre_normalizado like '%' || normalizar_oficio(p_query) || '%'
      or similarity(o.nombre_normalizado, normalizar_oficio(p_query)) > 0.3
    )
  order by similitud desc
  limit 10;
$$;
```

### Crear oficio (sin duplicados)

```sql
create or replace function public.crear_oficio(p_nombre text)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_id uuid; v_norm text; v_estado estado_oficio;
begin
  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'nombre_vacio';
  end if;

  v_norm := normalizar_oficio(p_nombre);

  -- ¿Ya existe con el mismo nombre normalizado? (evita duplicados por mayúsculas/acentos)
  select id, estado into v_id, v_estado from oficios where nombre_normalizado = v_norm;
  if found then
    if v_estado = 'inactivo' then
      raise exception 'oficio_no_permitido';   -- fue rechazado antes
    end if;
    -- asociar al trabajador que lo pidió
    if exists (select 1 from perfiles where id = auth.uid() and rol = 'trabajador') then
      insert into trabajador_oficios (trabajador_id, oficio_id)
      values (auth.uid(), v_id) on conflict do nothing;
    end if;
    return v_id;
  end if;

  insert into oficios (nombre, estado, creado_por)
  values (btrim(p_nombre), 'pendiente', auth.uid())
  returning id into v_id;

  if exists (select 1 from perfiles where id = auth.uid() and rol = 'trabajador') then
    insert into trabajador_oficios (trabajador_id, oficio_id)
    values (auth.uid(), v_id) on conflict do nothing;
  end if;

  -- avisar a los administradores
  insert into notificaciones (usuario_id, tipo, referencia_id)
  select p.id, 'oficio_pendiente', v_id from perfiles p where p.rol = 'admin';

  return v_id;
end $$;
```

### Aprobar / rechazar y fusionar (admin)

```sql
create or replace function public.admin_aprobar_oficio(
  p_oficio_id uuid, p_aprobar boolean)
returns void language plpgsql security definer set search_path = public
as $$
declare v_creador uuid;
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;

  update oficios
     set estado = case when p_aprobar then 'activo'::estado_oficio
                                  else 'inactivo'::estado_oficio end
   where id = p_oficio_id
  returning creado_por into v_creador;

  if not found then raise exception 'oficio_no_encontrado'; end if;

  if v_creador is not null then
    insert into notificaciones (usuario_id, tipo, referencia_id)
    values (v_creador,
            case when p_aprobar then 'oficio_aprobado' else 'oficio_rechazado' end,
            p_oficio_id);
  end if;
end $$;

create or replace function public.admin_fusionar_oficios(
  p_origen uuid, p_destino uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  if p_origen = p_destino then raise exception 'mismo_oficio'; end if;

  -- reasignar trabajadores y solicitudes del duplicado al destino
  insert into trabajador_oficios (trabajador_id, oficio_id)
  select trabajador_id, p_destino from trabajador_oficios where oficio_id = p_origen
  on conflict do nothing;
  delete from trabajador_oficios where oficio_id = p_origen;

  update solicitudes set oficio_id = p_destino where oficio_id = p_origen;

  -- el duplicado queda inactivo
  update oficios set estado = 'inactivo' where id = p_origen;
end $$;
```

> Al rechazar un oficio, el trabajador que lo pidió recibe la notificación. Si era su único
> oficio, queda con perfil incompleto y no podrá postular hasta elegir o crear otro.

## `enviar_propuesta`

```sql
create or replace function public.enviar_propuesta(
  p_solicitud_id uuid, p_descripcion text, p_presupuesto numeric)
returns uuid language plpgsql security definer set search_path = public
as $$
declare v_sol solicitudes; v_id uuid;
begin
  select * into v_sol from solicitudes where id = p_solicitud_id for update;
  if not found then raise exception 'solicitud_no_encontrada'; end if;
  if v_sol.estado <> 'abierta' then raise exception 'solicitud_no_abierta'; end if;

  -- Decisiones 5 y 13: perfil completo. Un oficio propio 'pendiente' cuenta para postular
  -- (aunque no se muestre público). Sin antigüedad mínima.
  if not exists (
    select 1 from perfiles_trabajador pt
    where pt.id = auth.uid()
      and pt.descripcion is not null
      and pt.ubicacion   is not null
      and exists (
        select 1 from trabajador_oficios t
        join oficios o on o.id = t.oficio_id
        where t.trabajador_id = auth.uid()
          and (o.estado = 'activo'
               or (o.estado = 'pendiente' and o.creado_por = auth.uid()))
      )
  ) then
    raise exception 'perfil_incompleto';
  end if;

  insert into propuestas (solicitud_id, trabajador_id, descripcion, presupuesto)
  values (p_solicitud_id, auth.uid(), p_descripcion, p_presupuesto)
  returning id into v_id;

  insert into notificaciones (usuario_id, tipo, referencia_id)
  values (v_sol.cliente_id, 'nueva_propuesta', v_id);

  return v_id;
end $$;
```

Si el trabajador ya había propuesto, el `unique (solicitud_id, trabajador_id)` aborta la
transacción. El front debe mapear ese error a un mensaje en español.

## `aceptar_propuesta`

La operación más crítica del sistema: escribe en 3 tablas + notificaciones.

```sql
create or replace function public.aceptar_propuesta(p_propuesta_id uuid)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  v_prop propuestas;
  v_sol  solicitudes;
  v_sol_id uuid;
  v_contratacion_id uuid;
begin
  select * into v_prop from propuestas where id = p_propuesta_id for update;
  if not found then raise exception 'propuesta_no_encontrada'; end if;

  select * into v_sol from solicitudes where id = v_prop.solicitud_id for update;
  v_sol_id := v_sol.id;
  if v_sol.cliente_id <> auth.uid() then raise exception 'sin_permiso'; end if;
  if v_sol.estado <> 'abierta' then raise exception 'solicitud_no_abierta'; end if;

  -- 1. Crear la contratación
  insert into contrataciones (propuesta_id, cliente_id, trabajador_id)
  values (v_prop.id, v_sol.cliente_id, v_prop.trabajador_id)
  returning id into v_contratacion_id;

  -- 2. Aceptar la elegida
  update propuestas set estado = 'aceptada', updated_at = now()
   where id = v_prop.id;

  -- 3. Decisión 1: rechazar el resto automáticamente y avisar a cada uno
  with rechazadas as (
    update propuestas
       set estado = 'rechazada', updated_at = now()
     where solicitud_id = v_sol_id
       and id <> v_prop.id
       and estado = 'enviada'
    returning trabajador_id, id
  )
  insert into notificaciones (usuario_id, tipo, referencia_id)
  select trabajador_id, 'propuesta_rechazada', id from rechazadas;

  -- 4. La solicitud pasa a asignada
  update solicitudes set estado = 'asignada' where id = v_sol_id;

  -- 5. Notificar
  insert into notificaciones (usuario_id, tipo, referencia_id) values
    (v_prop.trabajador_id, 'propuesta_aceptada', v_prop.id),
    (v_sol.cliente_id,     'contratacion_creada',  v_contratacion_id);

  return v_contratacion_id;
end $$;
```

## `confirmar_fin` — doble validación (decisión 15)

Reemplaza al viejo `completar_contratacion`. **No se completa con una sola confirmación**:
la contratación pasa a `pendiente_confirmacion` con la primera y a `completado` con la
segunda. Cada parte adjunta texto y fotos con su confirmación.

```sql
create or replace function public.confirmar_fin(
  p_contratacion_id uuid, p_comentario text, p_fotos text[])
returns estado_contratacion
language plpgsql security definer set search_path = public
as $$
declare
  c contrataciones;
  v_otro uuid;
  v_evidencia uuid;
  v_confirmaciones int;
begin
  select * into c from contrataciones where id = p_contratacion_id for update;
  if not found then raise exception 'contratacion_no_encontrada'; end if;
  if auth.uid() not in (c.cliente_id, c.trabajador_id) then
    raise exception 'sin_permiso';
  end if;
  if c.estado not in ('en_curso', 'pendiente_confirmacion') then
    raise exception 'estado_invalido';
  end if;

  -- una sola confirmación de fin por persona
  if exists (select 1 from contratacion_evidencias e
             where e.contratacion_id = c.id
               and e.autor_id = auth.uid()
               and e.tipo = 'fin') then
    raise exception 'fin_ya_confirmado';
  end if;

  v_otro := case when auth.uid() = c.cliente_id then c.trabajador_id else c.cliente_id end;

  -- registrar la evidencia de este participante
  insert into contratacion_evidencias (contratacion_id, autor_id, tipo, comentario)
  values (c.id, auth.uid(), 'fin', p_comentario)
  returning id into v_evidencia;

  if p_fotos is not null and array_length(p_fotos, 1) > 0 then
    insert into contratacion_evidencia_fotos (evidencia_id, storage_path)
    select v_evidencia, unnest(p_fotos);
  end if;

  -- ¿confirmaron los dos?
  select count(distinct autor_id) into v_confirmaciones
    from contratacion_evidencias
   where contratacion_id = c.id and tipo = 'fin';

  if v_confirmaciones >= 2 then
    update contrataciones set estado = 'completado', updated_at = now() where id = c.id;

    update solicitudes set estado = 'cerrada'
     where id = (select s.id from solicitudes s
                 join propuestas p on p.solicitud_id = s.id
                where p.id = c.propuesta_id);

    insert into notificaciones (usuario_id, tipo, referencia_id) values
      (c.cliente_id,    'contratacion_completada', c.id),
      (c.trabajador_id, 'contratacion_completada', c.id);

    return 'completado';
  else
    update contrataciones set estado = 'pendiente_confirmacion', updated_at = now()
     where id = c.id;

    insert into notificaciones (usuario_id, tipo, referencia_id)
    values (v_otro, 'contratacion_pendiente_confirmacion', c.id);

    return 'pendiente_confirmacion';
  end if;
end $$;
```

## `cancelar_contratacion` — unilateral (decisión 15)

Cualquiera de los dos participantes. Motivo obligatorio. Adjetiva fotos. Cancelable tanto
en curso como con la otra parte esperando confirmación.

```sql
create or replace function public.cancelar_contratacion(
  p_contratacion_id uuid, p_motivo text, p_fotos text[])
returns void language plpgsql security definer set search_path = public
as $$
declare
  c contrataciones;
  v_otro uuid;
  v_evidencia uuid;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select * into c from contrataciones where id = p_contratacion_id for update;
  if not found then raise exception 'contratacion_no_encontrada'; end if;
  if auth.uid() not in (c.cliente_id, c.trabajador_id) then
    raise exception 'sin_permiso';
  end if;
  if c.estado not in ('en_curso', 'pendiente_confirmacion') then
    raise exception 'estado_invalido';
  end if;

  v_otro := case when auth.uid() = c.cliente_id then c.trabajador_id else c.cliente_id end;

  -- registrar la evidencia de la cancelación
  insert into contratacion_evidencias (contratacion_id, autor_id, tipo, comentario)
  values (c.id, auth.uid(), 'cancelacion', p_motivo)
  returning id into v_evidencia;

  if p_fotos is not null and array_length(p_fotos, 1) > 0 then
    insert into contratacion_evidencia_fotos (evidencia_id, storage_path)
    select v_evidencia, unnest(p_fotos);
  end if;

  update contrataciones
     set estado = 'cancelado', cancelado_por = auth.uid(),
         motivo_cancelacion = p_motivo, updated_at = now()
   where id = c.id;

  update solicitudes set estado = 'cancelada'
   where id = (select s.id from solicitudes s
               join propuestas p on p.solicitud_id = s.id
              where p.id = c.propuesta_id);

  insert into notificaciones (usuario_id, tipo, referencia_id)
  values (v_otro, 'contratacion_cancelada', c.id);
end $$;
```

## `agregar_respuesta` — evidencia de la contraparte (decisión 15)

Permite que la parte que **no** canceló deje su versión con texto y fotos, que después ve
el admin en el panel de reportes. No cambia el estado de la contratación.

```sql
create or replace function public.agregar_respuesta(
  p_contratacion_id uuid, p_comentario text, p_fotos text[])
returns void language plpgsql security definer set search_path = public
as $$
declare
  c contrataciones;
  v_evidencia uuid;
begin
  if p_comentario is null or btrim(p_comentario) = '' then
    raise exception 'comentario_obligatorio';
  end if;

  select * into c from contrataciones where id = p_contratacion_id for update;
  if not found then raise exception 'contratacion_no_encontrada'; end if;
  if auth.uid() not in (c.cliente_id, c.trabajador_id) then
    raise exception 'sin_permiso';
  end if;
  if c.estado not in ('en_curso', 'pendiente_confirmacion', 'cancelado') then
    raise exception 'estado_invalido';
  end if;

  insert into contratacion_evidencias (contratacion_id, autor_id, tipo, comentario)
  values (c.id, auth.uid(), 'respuesta', p_comentario)
  returning id into v_evidencia;

  if p_fotos is not null and array_length(p_fotos, 1) > 0 then
    insert into contratacion_evidencia_fotos (evidencia_id, storage_path)
    select v_evidencia, unnest(p_fotos);
  end if;
end $$;
```

## `enviar_valoracion`

Solo se habilita cuando la contratación está `completado`, es decir, con la doble
validación (decisión 15). Sin las dos confirmaciones no hay reputación.

```sql
create or replace function public.enviar_valoracion(
  p_contratacion_id uuid, p_puntuacion integer,
  p_comentario text, p_fotos text[])
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  c contrataciones;
  v_id uuid;
  v_dest uuid;
begin
  if p_puntuacion not between 1 and 5 then raise exception 'puntuacion_invalida'; end if;

  select * into c from contrataciones where id = p_contratacion_id for update;
  if not found then raise exception 'contratacion_no_encontrada'; end if;
  if c.estado <> 'completado' then raise exception 'contratacion_no_completada'; end if;
  if auth.uid() not in (c.cliente_id, c.trabajador_id) then
    raise exception 'sin_permiso';
  end if;

  v_dest := case when auth.uid() = c.cliente_id then c.trabajador_id else c.cliente_id end;

  insert into valoraciones
    (contratacion_id, autor_id, destinatario_id, puntuacion, comentario)
  values (c.id, auth.uid(), v_dest, p_puntuacion, p_comentario)
  on conflict (contratacion_id, autor_id) do nothing
  returning id into v_id;

  if v_id is null then raise exception 'valoracion_duplicada'; end if;

  if p_fotos is not null and array_length(p_fotos, 1) > 0 then
    insert into valoracion_fotos (valoracion_id, storage_path)
    select v_id, unnest(p_fotos);
  end if;

  insert into notificaciones (usuario_id, tipo, referencia_id)
  values (v_dest, 'nueva_valoracion', v_id);

  return v_id;
end $$;
```

## Administración

```sql
create or replace function public.admin_asignar_rol(p_usuario_id uuid, p_rol rol_usuario)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  update perfiles set rol = p_rol where id = p_usuario_id;
end $$;

create or replace function public.admin_listar_usuarios()
returns table (
  id uuid, nombre text, apellido text, email text,
  rol rol_usuario, activo boolean, created_at timestamptz)
language sql security definer stable set search_path = public
as $$
  select id, nombre, apellido, email, rol, activo, created_at
  from perfiles
  where es_admin()
  order by created_at desc;
$$;
```

### Bloqueo (decisión 10)

La cascada se hace en base de datos; el ban de sesión se hace en Auth, que requiere
service role.

```sql
create or replace function public.admin_bloquear_usuario(p_usuario_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  if p_usuario_id = auth.uid() then raise exception 'no_puede_bloquearse_a_si_mismo'; end if;

  update perfiles set activo = false where id = p_usuario_id;

  update solicitudes set estado = 'cancelada'
   where cliente_id = p_usuario_id and estado = 'abierta';

  update propuestas set estado = 'retirada', updated_at = now()
   where trabajador_id = p_usuario_id and estado = 'enviada';

  insert into notificaciones (usuario_id, tipo, referencia_id)
  values (p_usuario_id, 'cuenta_bloqueada', null);
end $$;

revoke all on function public.admin_bloquear_usuario(uuid) from authenticated, anon;
grant execute on function public.admin_bloquear_usuario(uuid) to authenticated;
```

**Edge Function `admin-bloquear-usuario`:** como el ban en Auth necesita la service role
key (que no puede vivir en el front), se implementa una Edge Function que:
1. verifica que quien llama es un admin,
2. llama a la RPC `admin_bloquear_usuario` (cascada),
3. llama a `auth.admin.updateUserById(id, { ban_duration: '876000h' })`.

El desbloqueo es la misma función con `ban_duration: 'none'` y `activo = true`.

### Métricas del dashboard (decisión 14)

```sql
create or replace function public.admin_metricas()
returns jsonb language plpgsql security definer set search_path = public
as $$
declare v_result jsonb;
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;

  select jsonb_build_object(
    'usuarios_por_rol', (
      select jsonb_object_agg(rol, n) from (
        select rol, count(*) n from perfiles group by rol) t),
    'solicitudes_por_estado', (
      select jsonb_object_agg(estado, n) from (
        select estado, count(*) n from solicitudes group by estado) t),
    'contrataciones_por_estado', (
      select jsonb_object_agg(estado, n) from (
        select estado, count(*) n from contrataciones group by estado) t),
    'valoraciones_total', (select count(*) from valoraciones),
    'puntuacion_promedio', (
      select coalesce(round(avg(puntuacion)::numeric, 2), 0) from valoraciones),
    'ultimos_30_dias', jsonb_build_object(
      'registros',      (select count(*) from perfiles
                         where created_at > now() - interval '30 days'),
      'solicitudes',    (select count(*) from solicitudes
                         where created_at > now() - interval '30 days'),
      'completadas',    (select count(*) from contrataciones
                         where estado = 'completado'
                           and updated_at > now() - interval '30 days')),
    'top_oficios', (
      select jsonb_agg(jsonb_build_object('oficio', nombre, 'solicitudes', n)) from (
        select o.nombre, count(s.id) n
        from oficios o join solicitudes s on s.oficio_id = o.id
        group by o.nombre order by n desc limit 5) t),
    'cola_pendientes', jsonb_build_object(
      'oficios',  (select count(*) from oficios where estado = 'pendiente'),
      'reportes', (select count(*) from reportes where estado = 'pendiente'))
  ) into v_result;

  return v_result;
end $$;
```

## Errores de las RPC

El front debe traducir los `raise exception` a mensajes en español.
Convención: `codigo_error` en minúscula y snake_case, mapeada en un único lugar
(`lib/errores.js`), para no dispersar strings por la UI.

Códigos de oficios: `nombre_vacio`, `oficio_no_permitido`, `oficio_no_encontrado`,
`mismo_oficio`.
Códigos de contratación: `contratacion_no_encontrada`, `estado_invalido`,
`fin_ya_confirmado`, `motivo_obligatorio`, `comentario_obligatorio`, `sin_permiso`.

---

# REGLAS DE NEGOCIO

## Máquinas de estado

```
SOLICITUD
   abierta ── aceptar propuesta ──▶ asignada ── doble confirmación de fin ──▶ cerrada
     │                                                                         ▲
     └──────────────── cancelar (cliente) ────────────────┐                    │
                                                          ▼                    │
                                                      cancelada ───────────────┘
                                                       (o cancelación de la contratación)

PROPUESTA
   enviada ─┬─ el cliente la acepta ─────▶ aceptada   (crea contratación)
            ├─ no fue elegida ───────────▶ rechazada  (automático)
            └─ el trabajador se arrepintió▶ retirada

CONTRATACIÓN
   en_curso ── confirmar_fin (uno de los dos) ──▶ pendiente_confirmacion
   pendiente_confirmacion ── confirmar_fin (el otro) ──▶ completado
                                                              (habilita valoraciones)

   en_curso | pendiente_confirmacion ── cancelar (uno solo) ──▶ cancelado

VALORACIÓN
   creada ──▶ inmutable. Sin edición ni borrado por el autor.
             Solo el admin puede borrarla (moderación).
```

## Solicitudes

- El feed muestra todas las solicitudes `abierta` a cualquier trabajador autenticado,
  incluyendo foto y presupuesto máximo (si el cliente lo cargó).
- **Publicación con previsualización (decisión 16):** el cliente completa el formulario,
  pulsa *Previsualizar*, ve la solicitud como la verán los trabajadores y puede modificar
  **cualquier campo, incluido el oficio**, antes de *Confirmar publicación*. Recién en ese
  momento se escribe en la base: la previsualización vive en el estado del formulario, no
  requiere estado `borrador`.
- **Una vez publicada no se edita** (decisión 16). Si el cliente se equivocó, cancela y
  publica otra.
- Un trabajador solo puede enviar **una** propuesta por solicitud (unique index).
- No se puede proponer sobre una solicitud `cerrada`, `asignada` o `cancelada`.
- El cliente puede cancelar su solicitud mientras esté `abierta`.
- El `presupuesto_max` es **opcional** (decisión 11). Cuando existe, es orientativo: el
  trabajador puede proponer por encima (decisión 2) y la UI debe advertirlo visualmente al
  comparar propuestas.

## Oficios

- El catálogo base viene por seed, `activo`.
- Un trabajador puede asociarse a oficios activos y **crear nuevos** (decisión 12). Los
  nuevos quedan `pendiente` y requieren aprobación del admin.
- **Sin duplicados:** la columna `nombre_normalizado` (minúsculas + sin acentos + espacios
  colapsados) más su índice único impiden cargar dos veces el mismo oficio con distinto
  formato. `crear_oficio` devuelve el existente en vez de duplicarlo.
- **Typos:** la UI muestra sugerencias difusas (`buscar_oficios`) con "¿Quisiste decir...?"
  antes de permitir crear. Los que se cuelen se corrigen con la fusión.
- **Fusión (admin):** reasigna trabajadores y solicitudes del duplicado al destino y deja
  el duplicado `inactivo`.
- **Pendiente y publicación (decisión 13):** un oficio `pendiente` cuenta para que su
  creador pueda postular, pero **no se muestra público** ni aparece para que los clientes
  lo elijan hasta ser aprobado.

## Contacto

- El teléfono vive en `perfil_contacto` (decisión 8). Se pide en el registro para todos
  los roles.
- Solo lo ven: el dueño, el admin y **la contraparte con una contratación `en_curso`,
  `pendiente_confirmacion` o `completado`**. Al cancelarse la contratación, deja de verse.
- La coordinación de fecha, hora y dirección ocurre **por fuera de la plataforma**, porque
  el chat está fuera de alcance. El teléfono es el dato que lo hace posible.

## Propuestas

- El trabajador puede editar o retirar su propuesta mientras esté `enviada`.
- El cliente ve todas las propuestas + el perfil del trabajador para comparar.
- Solo puede existir **una** propuesta `aceptada` por solicitud.
- Al aceptar una, las demás pasan automáticamente a `rechazada` y sus autores reciben
  notificación (**decisión 1**).

## Contrataciones (decisión 15)

- Solo se crean desde `aceptar_propuesta`. Nunca por un `INSERT` directo del cliente.
- **El fin requiere doble validación:** la primera confirmación deja la contratación en
  `pendiente_confirmacion`; recién la segunda la pasa a `completado`. Cada parte confirma
  una sola vez y puede adjuntar texto y fotos.
- La contraparte **ve la evidencia del primero** antes de confirmar: es lo que da sentido a
  la doble validación.
- **Cancelar es unilateral**, tanto en `en_curso` como en `pendiente_confirmacion`, con
  motivo obligatorio y fotos opcionales. Queda registrado quién canceló.
- Tras una cancelación, la contraparte puede agregar su versión (`agregar_respuesta`) con
  texto y fotos; queda como insumo para el admin.
- Al `completado`, se habilitan las valoraciones de ambos participantes. Mientras esté
  `en_curso` o `pendiente_confirmacion`, no.

## Valoraciones

- ⭐ de 1 a 5. Comentario opcional. Hasta 3 fotos de evidencia.
- Una por participante por contratación (unique index).
- Inmutables: ni editar ni borrar. Moderación solo del admin.
- Visibles públicamente en el perfil del destinatario.

## Perfil trabajador

- **Requisito para enviar propuestas** (decisiones 5 y 13): al menos 1 oficio (activo o
  propio pendiente), `descripcion` y `ubicacion` completas.
- **Sin antigüedad mínima**: un trabajador recién registrado puede postular.
  Se muestra con el badge "Nuevo" y no se lo penaliza en los ordenamientos.

## Administración

- **Bloqueo real (decisión 10):** `activo = false` + cascada (solicitudes `abierta` →
  `cancelada`, propuestas `enviada` → `retirada`) + **ban en Supabase Auth** vía Edge
  Function. El chequeo de `activo` en el front complementa, pero el corte real lo hace el
  ban, que también frena llamadas directas a la API con sesión válida.
- `admin_asignar_rol` es el único camino para crear administradores.
- **Oficios:** el admin aprueba o rechaza los pendientes y fusiona duplicados.
- **Reportes:** el admin los lista por estado y puede resolverlos o descartarlos.
- **Métricas:** totales por rol y estado, tendencia de 30 días, top de oficios y cola de
  pendientes (oficios por aprobar, reportes abiertos).

## Notificaciones

- Generadas exclusivamente por triggers y RPCs.
- El usuario solo puede marcarlas como leídas.
- Sin push ni correo (fuera de alcance según `03_Alcance.md`).

---

# ARQUITECTURA DEL FRONTEND

## Stack

- React + Vite + JavaScript
- `react-router-dom` — routing con guards por rol
- `@tanstack/react-query` — listados, caché e invalidación tras mutaciones
- `@supabase/supabase-js` — Auth, base, Storage, Realtime
- **Tailwind CSS** (decisión 3)
- `react-hook-form` + `zod` — formularios y validación alineada a las constraints

## Estructura

Feature-based, organizada por dominio y rol:

```
src/
├─ main.jsx
├─ App.jsx
├─ routes.jsx                  # definición centralizada de rutas por rol
├─ lib/
│  ├─ supabase.js              # cliente + helper de errores
│  ├─ errores.js               # mapeo codigo_error → mensaje en español
│  └─ format.js                # moneda ARS, fechas
├─ context/
│  └─ AuthContext.jsx          # sesión + perfil + rol + activo
├─ hooks/
│  ├─ usePerfil.js
│  ├─ useSolicitudes.js
│  ├─ usePropuestas.js
│  ├─ useContrataciones.js
│  ├─ useOficios.js
│  ├─ useNotificaciones.js
│  └─ useRealtime.js           # wrapper de supabase.channel()
├─ components/
│  ├─ ui/                      # Button, Input, Select, Combobox (oficios), Modal,
│  │                           # Card, Badge, Rating, Spinner, Toast, EmptyState, FileDrop
│  └─ layout/                  # Navbar, Sidebar, PageHeader, RoleGuard
└─ features/
   ├─ auth/                    # Login, Registro, SeleccionRol, OnboardingTrabajador
   ├─ cliente/                 # Dashboard, MisSolicitudes, NuevaSolicitud (con preview),
   │                           # DetalleSolicitud, CompararPropuestas,
   │                           # Contrataciones, BitacoraContratacion, Valorar
   ├─ trabajador/              # Dashboard, ExplorarSolicitudes, DetalleSolicitud,
   │                           # EnviarPropuesta, MisPropuestas, MiPerfil,
   │                           # Portfolio, Contrataciones, BitacoraContratacion, Valorar
   ├─ admin/                   # DashboardMetricas, Usuarios, Reportes, Oficios
   └─ notificaciones/          # Centro de notificaciones
```

## Rutas

| Ruta | Rol | Mockup |
|---|---|---|
| `/login`, `/registro`, `/registro/rol` | público | registro-y-rol.png |
| `/onboarding/trabajador` | trabajador | registro-y-rol.png |
| `/cliente` | cliente | — (a diseñar) |
| `/cliente/solicitudes/nueva` | cliente | publicar-solicitud.png |
| `/cliente/solicitudes/:id` | cliente | solicitudes-y-propuesta.png |
| `/cliente/solicitudes/:id/propuestas` | cliente | comparar-propuestas.png |
| `/cliente/contrataciones` | cliente | — |
| `/cliente/contrataciones/:id` | cliente | — (bitácora de evidencias) |
| `/cliente/valorar/:contratacionId` | cliente | valoracion-y-reputacion.png |
| `/trabajador` | trabajador | — (a diseñar) |
| `/trabajador/explorar` | trabajador | — |
| `/trabajador/propuestas` | trabajador | — |
| `/trabajador/perfil` | trabajador | perfil-del-trabajador.png |
| `/trabajador/portfolio` | trabajador | perfil-del-trabajador.png |
| `/trabajador/contrataciones` | trabajador | — |
| `/trabajador/contrataciones/:id` | trabajador | — (bitácora de evidencias) |
| `/trabajador/valorar/:contratacionId` | trabajador | valoracion-y-reputacion.png |
| `/admin` | admin | Panel de administración.png |
| `/admin/usuarios` | admin | — |
| `/admin/oficios` | admin | — (cola de aprobación) |
| `/admin/reportes` | admin | — |

Los 7 mockups existentes quedan cubiertos. Faltan diseñar los dashboards de cliente y
trabajador.

## Roles y guards

`RoleGuard` envuelve cada grupo de rutas y resuelve tres casos: sin sesión → `/login`;
rol incorrecto → página de "acceso no autorizado"; perfil con `activo = false` → pantalla
de cuenta bloqueada. El chequeo de `activo` se hace en un único punto tras el login.

## Realtime (alcance acotado)

Tres suscripciones, nada más:

1. `notificaciones` donde `usuario_id = auth.uid()` → badge del navbar.
2. `propuestas` de las solicitudes propias → las propuestas entrantes aparecen sin recargar
   (vista del cliente).
3. `contrataciones` del usuario → cambio de estado en vivo.

## Gestión de estado

Con TanStack Query no hace falta un store global. El estado del servidor vive en queries
y las mutaciones invalidan las claves afectadas:

| Mutación | Claves a invalidar |
|---|---|
| `crear_oficio` | `['oficios']`, `['mi-perfil']` |
| `admin_aprobar_oficio` / `admin_fusionar_oficios` | `['oficios']`, `['admin-metricas']` |
| `enviar_propuesta` | `['solicitudes','abiertas']`, `['mis-propuestas']` |
| `aceptar_propuesta` | `['propuestas', id]`, `['solicitud', id]`, `['contrataciones']` |
| `confirmar_fin` | `['contrataciones']`, `['contratacion', id]`, `['valoraciones-pendientes']` |
| `cancelar_contratacion` | `['contrataciones']`, `['contratacion', id]` |
| `agregar_respuesta` | `['contratacion', id]` |
| `enviar_valoracion` | `['perfil', id]`, `['contrataciones']` |

`AuthContext` maneja únicamente sesión, perfil y rol.

## Moneda

Los montos se formatean en el front con
`Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`, que produce
`$ 1.234.567`. La base guarda `numeric(12,2)`.

---

# ORDEN DE IMPLEMENTACIÓN SUGERIDO

1. **Andamiaje**: Vite + React + Tailwind + rutas + `AuthContext` + layout base.
2. **Migración SQL**: extensiones, enums, tablas, índices, constraints, vista.
3. **Seguridad**: RLS + privilegios por columna + políticas de Storage.
4. **RPCs y triggers base**: alta de usuario (perfil + contacto), oficios
   (`buscar_oficios`, `crear_oficio`, `admin_aprobar_oficio`, `admin_fusionar_oficios`).
5. **RPCs del flujo**: `enviar_propuesta`, `aceptar_propuesta`, `confirmar_fin`,
   `cancelar_contratacion`, `agregar_respuesta`, `enviar_valoracion`.
6. **Seed**: catálogo de oficios (plomería, electricidad, herrería, albañilería,
   carpintería, pintura, gas, jardinería, limpieza) + un usuario admin.
7. **Flujo cliente**: registro, publicar solicitud con preview, recibir propuestas,
   comparar, aceptar.
8. **Flujo trabajador**: onboarding, perfil, portfolio, oficios (crear/ asociar), explorar,
   enviar propuesta.
9. **Cierre**: doble confirmación de fin, cancelación, respuesta, bitácora de evidencias,
   valoraciones, reputación en perfiles.
10. **Notificaciones y Realtime**.
11. **Panel admin**: métricas, usuarios (ban), oficios (aprobación/fusión), reportes.
12. **Edge Function** `admin-bloquear-usuario`.
13. **Despliegue** y verificación de límites del plan gratuito.

---

# PENDIENTES

- **Diseño**: falta mockupear los dashboards de cliente y trabajador y la bitácora de
  evidencias de la contratación.
- **Hosting**: definir entre Vercel / Netlify y verificar límites del plan gratuito.
- **PWA**: no está en el MVP. Podría agregarse después para que se instale en el celular,
  sin cambiar el stack.
- **Limpieza de Storage**: los archivos se suben antes de llamar a la RPC, así que puede
  quedar algún huérfano sin referencia. Pendiente de una purga periódica; no bloquea el MVP.
- **Vencimiento de `pendiente_confirmacion`**: hoy no expira (siempre queda la salida de
  cancelar unilateralmente). Opcional a futuro: cancelación automática tras N días sin
  respuesta.
