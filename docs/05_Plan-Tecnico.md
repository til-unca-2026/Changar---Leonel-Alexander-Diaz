# Plan Técnico

Documento de planificación. Consolida el modelo de datos, la seguridad, las reglas de
negocio y la arquitectura del frontend de ChangAr, tomando como base
`01_Introduccion.md`, `02_Objetivos.md`, `03_Alcance.md` y `04_Metodologia.md`.

**Tipo de producto:** aplicación web (cliente-servidor en el navegador). Sin app nativa,
sin tiendas de apps. Acceso por URL, diseño responsive mobile-first.

---

# DECISIONES TOMADAS

| # | Decisión | Impacto |
|---|---|---|
| 1 | Al aceptar una propuesta, las demás pasan automáticamente a `rechazada` y se notifica a cada trabajador | RPC `aceptar_propuesta` |
| 2 | Un trabajador puede proponer un presupuesto mayor al `presupuesto_max` del cliente: **se advierte en la UI, no se bloquea** | Pantalla comparar propuestas |
| 3 | Estilos con **Tailwind CSS** | Proyecto frontend |
| 4 | Se agregan la tabla `reportes` y el campo `perfiles.avatar_path` (pedidos por la doc pero sin modelo) | Migración |
| 5 | Para enviar propuestas el perfil debe estar completo (oficios + descripción + ubicación). **Sin antigüedad mínima**: los trabajadores nuevos pueden postular | RPC `enviar_propuesta` |
| 6 | Ubicación: **solo texto libre**, sin mapas ni GPS | Formularios |
| 7 | Notificaciones solo dentro de la app (sin push ni email), generadas por triggers | Tabla `notificaciones` |

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
create type estado_contratacion as enum ('en_curso', 'completado', 'cancelado');
create type tipo_notificacion  as enum (
  'nueva_propuesta', 'propuesta_aceptada', 'propuesta_rechazada',
  'contratacion_creada', 'contratacion_completada', 'contratacion_cancelada',
  'nueva_valoracion', 'cuenta_bloqueada'
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

create table oficios (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  descripcion text,
  activo      boolean not null default true
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

## Solicitudes, propuestas y contrataciones

```sql
create table solicitudes (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references perfiles(id) on delete cascade,
  oficio_id      uuid not null references oficios(id),
  titulo         text not null,
  descripcion    text not null,
  ubicacion      text not null,
  presupuesto_max numeric(12,2),
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
```

## Vista de reputación

El Flujo 3 pide *"actualizar promedio de estrellas y perfiles"* pero no existe dónde
guardarlo. Se resuelve con una vista: siempre consistente y sin triggers que mantener.

```sql
create view v_perfil_publico as
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

`es_admin()` protege la lectura, pero una policy `for update using (id = auth.uid())`
también permitiría al usuario cambiar su propio `rol` o `activo`. Se controla con
privilegios a nivel de columna: el usuario solo puede tocar su nombre, apellido y avatar.
El `rol` y `activo` se modifican únicamente mediante RPCs de administración.

```sql
revoke update on perfiles from authenticated;
grant  update (nombre, apellido, avatar_path) on perfiles to authenticated;
```

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

-- ===== oficios =====
alter table oficios enable row level security;
create policy "oficios lectura" on oficios
  for select to authenticated using (activo or es_admin());
create policy "oficios escritura admin" on oficios
  for all using (es_admin()) with check (es_admin());

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
-- nunca directo desde el cliente: crearlas manualmente rompería la máquina de estados.
alter table contrataciones enable row level security;
create policy "contrataciones lectura participantes" on contrataciones
  for select to authenticated using (
    cliente_id = auth.uid() or trabajador_id = auth.uid() or es_admin()
  );

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
-- Sin policy de insert: las notificaciones las crean solo los triggers.

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

Cuatro buckets, todos de **lectura pública** y **escritura restringida a la carpeta del
propio usuario**:

| Bucket | Contenido | Path |
|---|---|---|
| `avatares` | Foto de perfil | `{user_id}/avatar.{ext}` |
| `solicitud-fotos` | Fotos de la solicitud | `{user_id}/{solicitud_id}/{n}.{ext}` |
| `portfolio-fotos` | Portfolio del trabajador | `{user_id}/{n}.{ext}` |
| `valoracion-fotos` | Evidencia de la valoración | `{user_id}/{contratacion_id}/{n}.{ext}` |

```sql
-- Patrón repetido en los 4 buckets
create policy "escritura solo en carpeta propia"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatares'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

Límites a definir en la configuración del bucket: tamaño máximo por archivo (recomendado
5 MB) y tipos permitidos (`image/jpeg`, `image/png`, `image/webp`).

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
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

El perfil se crea por trigger y no por `INSERT` del cliente para que ningún usuario pueda
darse de alta sin perfil o con un rol manipulado.

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

  -- Decisión 5: perfil completo, SIN antigüedad mínima
  if not exists (
    select 1 from perfiles_trabajador pt
    where pt.id = auth.uid()
      and pt.descripcion is not null
      and pt.ubicacion   is not null
      and exists (select 1 from trabajador_oficios t
                  where t.trabajador_id = auth.uid())
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

## `completar_contratacion`

Solo el cliente. Habilita las valoraciones de ambos lados.

```sql
create or replace function public.completar_contratacion(p_contratacion_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  c contrataciones;
  v_solicitud_id uuid;
begin
  select * into c from contrataciones where id = p_contratacion_id for update;
  if not found then raise exception 'contratacion_no_encontrada'; end if;
  if auth.uid() <> c.cliente_id then raise exception 'solo_el_cliente'; end if;
  if c.estado <> 'en_curso' then raise exception 'estado_invalido'; end if;

  select s.id into v_solicitud_id
    from solicitudes s join propuestas p on p.solicitud_id = s.id
   where p.id = c.propuesta_id;

  update contrataciones set estado = 'completado', updated_at = now() where id = c.id;
  update solicitudes    set estado = 'cerrada'            where id = v_solicitud_id;

  insert into notificaciones (usuario_id, tipo, referencia_id)
  values (c.trabajador_id, 'contratacion_completada', c.id);
end $$;
```

## `cancelar_contratacion`

Cualquiera de los dos participantes. El motivo es obligatorio.

```sql
create or replace function public.cancelar_contratacion(
  p_contratacion_id uuid, p_motivo text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  c contrataciones;
  v_solicitud_id uuid;
  v_otro uuid;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select * into c from contrataciones where id = p_contratacion_id for update;
  if not found then raise exception 'contratacion_no_encontrada'; end if;
  if auth.uid() not in (c.cliente_id, c.trabajador_id) then
    raise exception 'sin_permiso';
  end if;
  if c.estado <> 'en_curso' then raise exception 'estado_invalido'; end if;

  v_otro := case when auth.uid() = c.cliente_id
                 then c.trabajador_id else c.cliente_id end;

  select s.id into v_solicitud_id
    from solicitudes s join propuestas p on p.solicitud_id = s.id
   where p.id = c.propuesta_id;

  update contrataciones
     set estado = 'cancelado', cancelado_por = auth.uid(),
         motivo_cancelacion = p_motivo, updated_at = now()
   where id = c.id;

  update solicitudes set estado = 'cancelada' where id = v_solicitud_id;

  insert into notificaciones (usuario_id, tipo, referencia_id)
  values (v_otro, 'contratacion_cancelada', c.id);
end $$;
```

## `enviar_valoracion`

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

  v_dest := case when auth.uid() = c.cliente_id
                 then c.trabajador_id else c.cliente_id end;

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

## `admin_bloquear_usuario`

Bloquear en cascada: sus solicitudes abiertas se cancelan y sus propuestas enviadas se
retiran, para no dejar trabajo huérfano en el feed.

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

## `admin_asignar_rol`

Mecanismo confiable para crear administradores, ya que el registro público no lo permite.

```sql
create or replace function public.admin_asignar_rol(p_usuario_id uuid, p_rol rol_usuario)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  update perfiles set rol = p_rol where id = p_usuario_id;
end $$;
```

## Errores de las RPC

El front debe traducir los `raise exception` a mensajes en español.
Convención: `codigo_error` en minúscula y snake_case, mapeada en un único lugar
(`lib/errores.js`), para no dispersar strings por la UI.

---

# REGLAS DE NEGOCIO

## Máquinas de estado

```
SOLICITUD
   abierta ─── aceptar propuesta ───▶ asignada ─── completar ───▶ cerrada
     │                                                        ▲
     └──────────────────── cancelar ─────────────────────────┴─▶ cancelada

PROPUESTA
   enviada ─┬─ el cliente la acepta ─────▶ aceptada   (crea contratación)
            ├─ no fue elegida ───────────▶ rechazada  (automático)
            └─ el trabajador se arrepintió▶ retirada

CONTRATACIÓN
   en_curso ─┬─ completar (solo cliente) ▶ completado  (habilita valoraciones)
             └─ cancelar (cualquiera) ───▶ cancelado

VALORACIÓN
   creada ──▶ inmutable. Sin edición ni borrado por el autor.
             Solo el admin puede borrarla (moderación).
```

## Solicitudes

- El feed muestra todas las solicitudes `abierta` a cualquier trabajador autenticado,
  incluyendo foto y presupuesto máximo.
- Un trabajador solo puede enviar **una** propuesta por solicitud (unique index).
- No se puede proponer sobre una solicitud `cerrada`, `asignada` o `cancelada`.
- El cliente puede cancelar su solicitud mientras esté `abierta`.
- El `presupuesto_max` es orientativo: el trabajador puede proponer por encima
  (**decisión 2**), y la UI debe advertirlo visualmente al comparar propuestas.

## Propuestas

- El trabajador puede editar o retirar su propuesta mientras esté `enviada`.
- El cliente ve todas las propuestas + el perfil del trabajador para comparar.
- Solo puede existir **una** propuesta `aceptada` por solicitud.
- Al aceptar una, las demás pasan automáticamente a `rechazada` y sus autores reciben
  notificación (**decisión 1**).

## Contrataciones

- Solo se crean desde `aceptar_propuesta`. Nunca por un `INSERT` directo del cliente.
- Solo el **cliente** marca `completado`.
- Cualquiera de los dos puede cancelar, con motivo obligatorio; queda registrado quién
  canceló (`cancelado_por`).
- Al completarse, se habilitan las valoraciones de ambos participantes.

## Valoraciones

- ⭐ de 1 a 5. Comentario opcional. Fotos de evidencia opcionales.
- Una por participante por contratación (unique index).
- Inmutables: ni editar ni borrar. Moderación solo del admin.
- Visibles públicamente en el perfil del destinatario.

## Perfil trabajador

- **Requisito para enviar propuestas** (decisión 5): al menos 1 oficio asignado,
  `descripcion` y `ubicacion` completas.
- **Sin antigüedad mínima**: un trabajador recién registrado puede postular.
  Se muestra con el badge "Nuevo" y no se lo penaliza en los ordenamientos.

## Administración

- Bloqueo de usuario: `activo = false`, propagando a solicitudes `abierta` → `cancelada`
  y propuestas `enviada` → `retirada`.
- El bloqueo se verifica en el middleware del front tras el login (no en RLS, más simple).
- `admin_asignar_rol` es el único camino para crear administradores.
- Reportes: el admin los lista por estado y puede resolverlos o descartarlos.

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
│  └─ format.js                # moneda, fechas
├─ context/
│  └─ AuthContext.jsx          # sesión + perfil + rol + activo
├─ hooks/
│  ├─ usePerfil.js
│  ├─ useSolicitudes.js
│  ├─ usePropuestas.js
│  ├─ useContrataciones.js
│  ├─ useNotificaciones.js
│  └─ useRealtime.js           # wrapper de supabase.channel()
├─ components/
│  ├─ ui/                      # Button, Input, Select, Modal, Card, Badge,
│  │                           # Rating, Spinner, Toast, EmptyState, FileDrop
│  └─ layout/                  # Navbar, Sidebar, PageHeader, RoleGuard
└─ features/
   ├─ auth/                    # Login, Registro, SeleccionRol, OnboardingTrabajador
   ├─ cliente/                 # Dashboard, MisSolicitudes, NuevaSolicitud,
   │                           # DetalleSolicitud, CompararPropuestas,
   │                           # Contrataciones, Valorar
   ├─ trabajador/              # Dashboard, ExplorarSolicitudes, DetalleSolicitud,
   │                           # EnviarPropuesta, MisPropuestas, MiPerfil,
   │                           # Portfolio, Contrataciones, Valorar
   ├─ admin/                   # DashboardMetricas, Usuarios, Reportes
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
| `/cliente/valorar/:contratacionId` | cliente | valoracion-y-reputacion.png |
| `/trabajador` | trabajador | — (a diseñar) |
| `/trabajador/explorar` | trabajador | — |
| `/trabajador/propuestas` | trabajador | — |
| `/trabajador/perfil` | trabajador | perfil-del-trabajador.png |
| `/trabajador/portfolio` | trabajador | perfil-del-trabajador.png |
| `/trabajador/valorar/:contratacionId` | trabajador | valoracion-y-reputacion.png |
| `/admin` | admin | Panel de administración.png |
| `/admin/usuarios` | admin | — |
| `/admin/reportes` | admin | — |

Los 7 mockups existentes quedan cubiertos. Faltan diseñar los dashboards de cliente y
trabajador.

## Roles y guards

`RoleGuard` envuelve cada grupo de rutas y resuelve tres casos: sin sesión → `/login`;
rol incorrecto → página de "acceso no autorizado"; perfil con `activo = false` → pantalla
de cuenta bloqueada. El chequeo de `activo` se hace en un único punto tras el login, no
disperso por la app.

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
| `enviar_propuesta` | `['solicitudes','abiertas']`, `['mis-propuestas']` |
| `aceptar_propuesta` | `['propuestas', id]`, `['solicitud', id]`, `['contrataciones']` |
| `completar_contratacion` | `['contrataciones']`, `['valoraciones-pendientes']` |
| `enviar_valoracion` | `['perfil', id]`, `['contrataciones']` |

`AuthContext` maneja únicamente sesión, perfil y rol.

---

# ORDEN DE IMPLEMENTACIÓN SUGERIDO

1. **Andamiaje**: Vite + React + Tailwind + rutas + `AuthContext` + layout base.
2. **Migración SQL**: enums, tablas, índices, constraints, vista.
3. **Seguridad**: RLS + privilegios de columna + políticas de Storage.
4. **RPCs y triggers**: alta de usuario, `enviar_propuesta`, `aceptar_propuesta`,
   `completar_contratacion`, `cancelar_contratacion`, `enviar_valoracion`, admin.
5. **Seed**: catálogo de oficios (plomería, electricidad, herrería, albañilería,
   carpintería, pintura, gas, jardinería, limpieza) + un usuario admin.
6. **Flujo cliente**: registro, publicar solicitud, recibir propuestas, comparar, aceptar.
7. **Flujo trabajador**: onboarding, perfil, portfolio, explorar, enviar propuesta.
8. **Cierre**: completar/cancelar contratación, valoraciones, reputación en perfiles.
9. **Notificaciones y Realtime**.
10. **Panel admin**: métricas, usuarios, reportes.
11. **Despliegue** y verificación de límites del plan gratuito.

---

# PENDIENTES

- **Diseño**: falta mockupear los dashboards de cliente y trabajador.
- **Hosting**: definir entre Vercel / Netlify y verificar límites del plan gratuito.
- **Formato de presupuesto**: ¿se muestra en pesos? Falta definir moneda y formato.
- **Límite de fotos**: cuántas fotos por solicitud, propuesta y valoración.
- **Edición de solicitudes**: ¿el cliente puede editar una solicitud `abierta`? (Hoy solo
  cancelarla.)
- **PWA**: no está en el MVP. Podría agregarse después para que se instale en el celular,
  sin cambiar el stack.
