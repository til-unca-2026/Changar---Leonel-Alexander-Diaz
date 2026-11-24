-- =============================================================================
-- ChangAr · Auditoría de actividad
--
-- Escribe un evento por cada alta/cambio/baja en las tablas de negocio.
-- Visibilidad POR ACTOR (según lo pedido):
--   - admin: ve eventos cuyo actor sea cliente o trabajador.
--   - superadmin: ve todos, incluidos los eventos ejecutados por admins.
-- No se registran sesiones (login/logout).
-- =============================================================================

create table public.auditoria (
  id          uuid        primary key default gen_random_uuid(),
  usuario_id  uuid,
  accion      text        not null check (accion in ('alta', 'cambio', 'baja')),
  tabla       text        not null,
  registro_id uuid,
  detalle     jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  constraint auditoria_usuario_id_fkey
    foreign key (usuario_id) references perfiles(id) on delete set null
);

create index auditoria_usuario_fecha_idx on auditoria (usuario_id, created_at desc);
create index auditoria_tabla_fecha_idx   on auditoria (tabla, created_at desc);
create index auditoria_fecha_idx         on auditoria (created_at desc);

comment on column public.auditoria.usuario_id is 'Actor de la acción (auth.uid()).';
comment on column public.auditoria.detalle is
  'En cambios, diff compacto: {campo: {antes, después}}.';

-- ---------------------------------------------------------------------------
-- Trigger genérico de auditoría
-- ---------------------------------------------------------------------------
create or replace function public.tg_auditar()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_fila     jsonb;
  v_actor    uuid;
  v_id       uuid;
  v_detalle  jsonb := '{}'::jsonb;
begin
  v_fila := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  v_actor := auth.uid();

  -- El alta de perfil ocurre desde el trigger de auth.users, sin sesión:
  -- el actor es el usuario recién creado.
  if tg_op = 'INSERT' and tg_table_name = 'perfiles' then
    v_actor := nullif(v_fila->>'id', '')::uuid;
  end if;

  v_id := nullif(v_fila->>'id', '')::uuid;
  if v_id is null then
    v_id := nullif(v_fila->>'perfil_id', '')::uuid;
  end if;

  if tg_op = 'UPDATE' then
    select coalesce(
      jsonb_object_agg(n.key, jsonb_build_object('antes', o.value, 'despues', n.value)),
      '{}'::jsonb
    )
      into v_detalle
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o on o.key = n.key
     where n.value is distinct from o.value
       and n.key not in ('created_at', 'updated_at');
  end if;

  insert into public.auditoria (usuario_id, accion, tabla, registro_id, detalle)
  values (
    v_actor,
    case tg_op when 'INSERT' then 'alta' when 'UPDATE' then 'cambio' else 'baja' end,
    tg_table_name,
    v_id,
    v_detalle
  );

  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- Attach a todas las tablas de negocio (no notificaciones: ruido del sistema).
do $$
declare
  t text;
begin
  foreach t in array array[
    'perfiles',
    'perfiles_cliente',
    'perfiles_trabajador',
    'perfil_contacto',
    'oficios',
    'trabajador_oficios',
    'portfolio_fotos',
    'solicitudes',
    'solicitud_fotos',
    'propuestas',
    'contrataciones',
    'contratacion_evidencias',
    'valoraciones',
    'reportes',
    'sanciones',
    'marcas_advertencia',
    'invitaciones_admin'
  ]
  loop
    execute format('drop trigger if exists tr_auditar_%I on public.%I', t, t);
    execute format(
      'create trigger tr_auditar_%I after insert or update or delete on public.%I ' ||
      'for each row execute function public.tg_auditar()',
      t, t
    );
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Lectura: solo admin/super, filtrada por actor
-- ---------------------------------------------------------------------------
alter table public.auditoria enable row level security;

create policy "auditoria lectura" on auditoria
  for select to authenticated using (
    es_admin()
    and (
      es_superadmin()
      or exists (
        select 1 from perfiles p
        where p.id = auditoria.usuario_id
          and p.rol in ('cliente', 'trabajador')
      )
    )
  );

-- El trigger (security definer) es el único que escribe.
revoke all on auditoria from public, anon, authenticated;
grant select on auditoria to authenticated;
