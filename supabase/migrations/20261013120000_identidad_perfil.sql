-- =============================================================================
-- ChangAr · Identidad y perfil del trabajador
-- Crea: enums, tablas de identidad y perfil, oficios, portfolio, trigger de alta,
-- normalización/sugerencia de oficios, RLS y políticas de Storage.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensiones (se instalan en el esquema `extensions`, el habitual de Supabase)
-- ---------------------------------------------------------------------------
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------------
create type rol_usuario as enum ('cliente', 'trabajador', 'admin');
create type estado_oficio as enum ('pendiente', 'activo', 'inactivo');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table perfiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  apellido    text not null,
  email       text not null,
  rol         rol_usuario not null,
  avatar_path text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table perfil_contacto (
  perfil_id  uuid primary key references perfiles(id) on delete cascade,
  telefono   text not null,
  updated_at timestamptz not null default now()
);

create table perfiles_trabajador (
  id          uuid primary key references perfiles(id) on delete cascade,
  descripcion text,
  experiencia text,
  ubicacion   text
);

create table oficios (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  nombre_normalizado text,
  descripcion        text,
  estado             estado_oficio not null default 'activo',
  creado_por         uuid references perfiles(id),
  created_at         timestamptz not null default now()
);

create unique index oficios_nombre_normalizado_idx on oficios (nombre_normalizado);
create index oficios_nombre_trgm_idx on oficios using gin (nombre_normalizado gin_trgm_ops);
create index oficios_estado_idx on oficios (estado);

create table trabajador_oficios (
  trabajador_id uuid not null references perfiles(id) on delete cascade,
  oficio_id     uuid not null references oficios(id) on delete cascade,
  primary key (trabajador_id, oficio_id)
);

create table portfolio_fotos (
  id           uuid primary key default gen_random_uuid(),
  trabajador_id uuid not null references perfiles(id) on delete cascade,
  storage_path text not null,
  descripcion  text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Alta de usuario: crea el perfil y el contacto desde los metadatos
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.raw_user_meta_data->>'rol' = 'admin' then
    raise exception 'rol_no_permitido';
  end if;

  insert into public.perfiles (id, nombre, apellido, email, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'apellido', ''),
    new.email,
    coalesce((new.raw_user_meta_data->>'rol')::rol_usuario, 'cliente')
  );

  if coalesce(new.raw_user_meta_data->>'telefono', '') <> '' then
    insert into public.perfil_contacto (perfil_id, telefono)
    values (new.id, new.raw_user_meta_data->>'telefono');
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Oficios: normalización y búsqueda difusa
-- ---------------------------------------------------------------------------
create or replace function public.normalizar_oficio(t text)
returns text
language sql
stable
set search_path = public, extensions
as $$
  select regexp_replace(lower(unaccent(btrim(t))), '\s+', ' ', 'g');
$$;

create or replace function public.tg_normalizar_oficio()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.nombre_normalizado := public.normalizar_oficio(new.nombre);
  return new;
end $$;

create trigger tr_normalizar_oficio
  before insert or update of nombre on oficios
  for each row execute function public.tg_normalizar_oficio();

-- Sugerencias para la UI (coincidencia por subcadena + similitud difusa)
create or replace function public.buscar_oficios(p_query text)
returns table (id uuid, nombre text, similitud real)
language sql
stable
security definer
set search_path = public, extensions
as $$
  select o.id, o.nombre,
         similarity(o.nombre_normalizado, public.normalizar_oficio(p_query)) as similitud
  from oficios o
  where o.estado = 'activo'
    and (
      o.nombre_normalizado like '%' || public.normalizar_oficio(p_query) || '%'
      or similarity(o.nombre_normalizado, public.normalizar_oficio(p_query)) > 0.3
    )
  order by similitud desc
  limit 10;
$$;

-- Crea un oficio nuevo (pendiente) o devuelve el existente, sin duplicar.
-- Nota: la notificación al admin se agrega cuando exista la tabla `notificaciones`.
create or replace function public.crear_oficio(p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid;
  v_norm text;
  v_estado estado_oficio;
begin
  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'nombre_vacio';
  end if;

  v_norm := public.normalizar_oficio(p_nombre);

  select id, estado into v_id, v_estado
    from oficios where nombre_normalizado = v_norm;

  if found then
    if v_estado = 'inactivo' then
      raise exception 'oficio_no_permitido';
    end if;

    if exists (select 1 from perfiles where id = auth.uid() and rol = 'trabajador') then
      insert into trabajador_oficios (trabajador_id, oficio_id)
      values (auth.uid(), v_id)
      on conflict do nothing;
    end if;

    return v_id;
  end if;

  insert into oficios (nombre, estado, creado_por)
  values (btrim(p_nombre), 'pendiente', auth.uid())
  returning id into v_id;

  if exists (select 1 from perfiles where id = auth.uid() and rol = 'trabajador') then
    insert into trabajador_oficios (trabajador_id, oficio_id)
    values (auth.uid(), v_id)
    on conflict do nothing;
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Catálogo base
-- ---------------------------------------------------------------------------
insert into oficios (nombre, estado) values
  ('Plomería', 'activo'),
  ('Electricidad', 'activo'),
  ('Herrería', 'activo'),
  ('Albañilería', 'activo'),
  ('Carpintería', 'activo'),
  ('Pintura', 'activo'),
  ('Gas', 'activo'),
  ('Jardinería', 'activo'),
  ('Limpieza', 'activo');

-- ---------------------------------------------------------------------------
-- Helper de administración
-- ---------------------------------------------------------------------------
create or replace function public.es_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and rol = 'admin' and activo
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table perfiles            enable row level security;
alter table perfil_contacto     enable row level security;
alter table perfiles_trabajador enable row level security;
alter table oficios             enable row level security;
alter table trabajador_oficios  enable row level security;
alter table portfolio_fotos     enable row level security;

-- perfiles ------------------------------------------------------------------
create policy "perfiles lectura" on perfiles
  for select to authenticated using (true);
create policy "perfiles alta propia" on perfiles
  for insert to authenticated with check (id = auth.uid());
create policy "perfiles edicion propia" on perfiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "perfiles borrado admin" on perfiles
  for delete to authenticated using (es_admin());

-- perfiles: el usuario solo puede cambiar nombre, apellido y avatar
revoke update on perfiles from authenticated;
grant  update (nombre, apellido, avatar_path) on perfiles to authenticated;

-- perfiles: el rol, el activo y el email no son legibles/editables por el usuario
revoke select on perfiles from authenticated;
grant  select (id, nombre, apellido, avatar_path, rol, activo, created_at)
  on perfiles to authenticated;
grant  delete on perfiles to authenticated;

-- perfil_contacto -----------------------------------------------------------
-- La visibilidad para la contraparte con contratación se agrega cuando exista
-- la tabla `contrataciones`. Por ahora: dueño y admin.
create policy "contacto lectura" on perfil_contacto
  for select to authenticated using (perfil_id = auth.uid() or es_admin());
create policy "contacto alta propia" on perfil_contacto
  for insert to authenticated with check (perfil_id = auth.uid());
create policy "contacto edicion propia" on perfil_contacto
  for update to authenticated using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());

-- perfiles_trabajador -------------------------------------------------------
create policy "pt lectura" on perfiles_trabajador
  for select to authenticated using (true);
create policy "pt alta propia" on perfiles_trabajador
  for insert to authenticated with check (id = auth.uid());
create policy "pt edicion propia" on perfiles_trabajador
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "pt borrado admin" on perfiles_trabajador
  for delete to authenticated using (es_admin());

-- oficios -------------------------------------------------------------------
create policy "oficios lectura" on oficios
  for select to authenticated using (
    estado = 'activo'
    or es_admin()
    or (estado = 'pendiente' and creado_por = auth.uid())
  );
create policy "oficios alta" on oficios
  for insert to authenticated with check (
    creado_por = auth.uid() and (estado = 'pendiente' or es_admin())
  );
create policy "oficios edicion admin" on oficios
  for update to authenticated using (es_admin()) with check (es_admin());
create policy "oficios borrado admin" on oficios
  for delete to authenticated using (es_admin());

-- trabajador_oficios --------------------------------------------------------
create policy "to lectura" on trabajador_oficios
  for select to authenticated using (true);
create policy "to escritura propia" on trabajador_oficios
  for all to authenticated using (trabajador_id = auth.uid()) with check (trabajador_id = auth.uid());

-- portfolio_fotos -----------------------------------------------------------
create policy "pf lectura" on portfolio_fotos
  for select to authenticated using (true);
create policy "pf alta duenio" on portfolio_fotos
  for insert to authenticated with check (trabajador_id = auth.uid());
create policy "pf borrado duenio o admin" on portfolio_fotos
  for delete to authenticated using (trabajador_id = auth.uid() or es_admin());

-- Grants explícitos (por si las default privileges no alcanzan)
grant select, insert, update, delete on perfiles_trabajador to authenticated;
grant select, insert, update, delete on trabajador_oficios  to authenticated;
grant select, insert, delete         on portfolio_fotos     to authenticated;
grant select, insert, update         on oficios             to authenticated;
grant select, insert, update         on perfil_contacto     to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: buckets y políticas
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('avatares', 'avatares', true),
  ('portfolio-fotos', 'portfolio-fotos', true)
on conflict (id) do nothing;

-- avatares
create policy "avatares lectura" on storage.objects
  for select using (bucket_id = 'avatares');
create policy "avatares alta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatares edicion" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatares borrado" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = auth.uid()::text);

-- portfolio-fotos
create policy "portfolio lectura" on storage.objects
  for select using (bucket_id = 'portfolio-fotos');
create policy "portfolio alta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portfolio-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "portfolio borrado" on storage.objects
  for delete to authenticated
  using (bucket_id = 'portfolio-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
