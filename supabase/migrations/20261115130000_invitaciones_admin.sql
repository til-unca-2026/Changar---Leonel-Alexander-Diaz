-- =============================================================================
-- ChangAr · Invitaciones de administrador
--
-- El dueño de la app genera una invitación y comparte el link. La persona
-- invitada se registra con ese link y queda con rol 'admin', con su propia
-- contraseña (el dueño nunca ve credenciales ajenas).
--
-- El token es el único factor de autorización. El email NO lo es: el proyecto
-- no exige confirmar el email, así que cualquiera puede registrarse con
-- cualquier dirección. Por eso el trigger de alta busca la invitación por
-- token y nunca por email.
--
-- El token es de un solo uso: al aceptarse pasa a 'aceptada' y expira a los
-- 7 días.
-- =============================================================================

create table invitaciones_admin (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  nombre     text not null default '',
  apellido  text not null default '',
  token      uuid not null default gen_random_uuid() unique,
  estado     text not null default 'pendiente'
             check (estado in ('pendiente', 'aceptada', 'cancelada', 'expirada')),
  creado_por uuid not null references perfiles(id) on delete cascade,
  expira_at  timestamptz,
  created_at timestamptz not null default now()
);

create index invitaciones_admin_email_idx on invitaciones_admin (email);
create index invitaciones_admin_creado_por_idx on invitaciones_admin (creado_por);

alter table invitaciones_admin enable row level security;

-- Sin políticas a propósito: el acceso es únicamente por RPC (security
-- definer) y cada RPC valida es_superadmin(). Un `select` directo sobre la
-- tabla devuelve 0 filas para cualquier usuario autenticado.
--
-- El revoke explícito evita que los permisos por defecto de Supabase sobre el
-- esquema `public` dejen la tabla accesible si algún día se desactiva el RLS.
revoke all on table invitaciones_admin from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Crear una invitación (solo el dueño)
-- ---------------------------------------------------------------------------
create or replace function public.admin_crear_invitacion(
  p_email text,
  p_nombre text,
  p_apellido text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_inv   invitaciones_admin;
begin
  if not es_superadmin() then raise exception 'sin_permiso'; end if;

  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'email_invalido';
  end if;

  if exists (select 1 from auth.users where lower(email) = v_email) then
    raise exception 'email_ya_registrado';
  end if;

  if exists (
    select 1 from invitaciones_admin
    where email = v_email and estado = 'pendiente'
      and (expira_at is null or expira_at > now())
  ) then
    raise exception 'invitacion_ya_existe';
  end if;

  insert into invitaciones_admin (email, nombre, apellido, creado_por, expira_at)
  values (
    v_email,
    btrim(coalesce(p_nombre, '')),
    btrim(coalesce(p_apellido, '')),
    auth.uid(),
    now() + interval '7 days'
  )
  returning * into v_inv;

  return jsonb_build_object(
    'id', v_inv.id,
    'email', v_inv.email,
    'nombre', v_inv.nombre,
    'apellido', v_inv.apellido,
    'token', v_inv.token,
    'expira_at', v_inv.expira_at,
    'created_at', v_inv.created_at
  );
end $$;

-- ---------------------------------------------------------------------------
-- Listar invitaciones (solo el dueño)
-- ---------------------------------------------------------------------------
create or replace function public.admin_listar_invitaciones()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not es_superadmin() then raise exception 'sin_permiso'; end if;

  select coalesce(jsonb_agg(item), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'id', i.id,
      'email', i.email,
      'nombre', i.nombre,
      'apellido', i.apellido,
      'token', i.token,
      'estado', i.estado,
      'expira_at', i.expira_at,
      'created_at', i.created_at,
      'creado_por_nombre', (
        select p.nombre || ' ' || p.apellido from perfiles p where p.id = i.creado_por
      )
    ) as item
    from invitaciones_admin i
    order by i.created_at desc
  ) t;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- Cancelar una invitación pendiente (solo el dueño)
-- ---------------------------------------------------------------------------
create or replace function public.admin_cancelar_invitacion(p_invitacion_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_superadmin() then raise exception 'sin_permiso'; end if;

  update invitaciones_admin
     set estado = 'cancelada'
   where id = p_invitacion_id and estado = 'pendiente';

  if not found then raise exception 'invitacion_no_encontrada'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Consultar una invitación por token (público: lo usa el formulario de
-- registro, que corre sin sesión). Solo devuelve los datos de la invitación;
-- el token es el factor de acceso, así que no se filtra información sensible.
-- ---------------------------------------------------------------------------
create or replace function public.invitacion_por_token(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_inv   invitaciones_admin;
  v_existe boolean := false;
begin
  if p_token is null then return null; end if;

  select * into v_inv from invitaciones_admin where token = p_token;
  v_existe := found;
  if not v_existe then return null; end if;

  if v_inv.estado <> 'pendiente' then return null; end if;
  if v_inv.expira_at is not null and v_inv.expira_at <= now() then return null; end if;

  return jsonb_build_object(
    'email', v_inv.email,
    'nombre', v_inv.nombre,
    'apellido', v_inv.apellido,
    'expira_at', v_inv.expira_at
  );
end $$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
--
-- Postgres concede EXECUTE a PUBLIC por defecto en toda función nueva. Las
-- funciones de administración quedan restringidas a `authenticated` y la
-- consulta pública de invitación, a `anon` y `authenticated`.
-- ---------------------------------------------------------------------------
revoke execute on function public.admin_crear_invitacion(text, text, text) from public;
grant execute on function public.admin_crear_invitacion(text, text, text) to authenticated;

revoke execute on function public.admin_listar_invitaciones() from public;
grant execute on function public.admin_listar_invitaciones() to authenticated;

revoke execute on function public.admin_cancelar_invitacion(uuid) from public;
grant execute on function public.admin_cancelar_invitacion(uuid) to authenticated;

revoke execute on function public.invitacion_por_token(uuid) from public;
grant execute on function public.invitacion_por_token(uuid) to anon, authenticated;
