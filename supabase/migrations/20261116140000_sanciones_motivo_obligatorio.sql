-- =============================================================================
-- ChangAr · Sanciones con motivo obligatorio y reportes exclusivos de usuarios
--
-- 1. El flujo de denuncias queda reservado a cliente/trabajador: un
--    administrador no puede denunciar, ni se puede denunciar a un admin.
-- 2. Los baneos (temporales y permanentes) exigen motivo y quedan registrados
--    en `sanciones`. Las marcas de advertencia también exigen motivo.
-- 3. `admin_sanciones_de` expone el historial (sanciones + advertencias) con la
--    misma jerarquía que el resto de las RPCs de administración.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Reportes de perfiles: solo cliente/trabajador, y solo contra usuarios
-- ---------------------------------------------------------------------------
drop policy if exists "reportes alta propio" on reportes;
create policy "reportes alta propio" on reportes
  for insert to authenticated
  with check (
    reportante_id = auth.uid()
    and exists (
      select 1
      from perfiles p
      where p.id = auth.uid()
        and p.rol in ('cliente', 'trabajador')
    )
    and exists (
      select 1
      from perfiles t
      where t.id = perfil_id
        and t.rol in ('cliente', 'trabajador')
    )
  );

-- ---------------------------------------------------------------------------
-- Historial de sanciones
-- ---------------------------------------------------------------------------
create type tipo_sancion as enum ('suspension', 'bloqueo');

create table sanciones (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid not null references perfiles(id) on delete cascade,
  tipo         tipo_sancion not null,
  dias         integer,
  motivo       text not null,
  aplicada_por uuid references perfiles(id),
  created_at   timestamptz not null default now()
);

create index sanciones_perfil_idx on sanciones (perfil_id);

alter table sanciones enable row level security;
create policy "sanciones lectura admin" on sanciones
  for select to authenticated using (es_admin());

-- El historial se consulta solo a través de admin_sanciones_de(), que aplica
-- la jerarquía de administración. Se revoca el acceso directo a la tabla.
revoke all on sanciones from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Marcas de advertencia: motivo obligatorio
-- ---------------------------------------------------------------------------
create or replace function public.admin_marcar(p_perfil_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  if p_motivo is null or btrim(p_motivo) = '' then raise exception 'motivo_vacio'; end if;
  if exists (select 1 from perfiles where id = p_perfil_id and es_superadmin) then
    raise exception 'no_puede_modificar_al_dueno';
  end if;
  if not es_superadmin() and exists (
    select 1 from perfiles where id = p_perfil_id and rol = 'admin'
  ) then
    raise exception 'no_puede_modificar_al_admin';
  end if;
  insert into marcas_advertencia (perfil_id, motivo, aplicada_por)
  values (p_perfil_id, btrim(p_motivo), auth.uid());
end $$;

-- ---------------------------------------------------------------------------
-- Baneos: motivo obligatorio y registro en sanciones
-- ---------------------------------------------------------------------------
drop function if exists public.admin_banear(uuid, integer);

create function public.admin_banear(
  p_perfil_id uuid,
  p_dias integer,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol record;
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  if p_motivo is null or btrim(p_motivo) = '' then raise exception 'motivo_vacio'; end if;
  if p_perfil_id = auth.uid() then raise exception 'no_puede_banearse_a_si_mismo'; end if;
  if exists (select 1 from perfiles where id = p_perfil_id and es_superadmin) then
    raise exception 'no_puede_modificar_al_dueno';
  end if;
  if not es_superadmin() and exists (
    select 1 from perfiles where id = p_perfil_id and rol = 'admin'
  ) then
    raise exception 'no_puede_modificar_al_admin';
  end if;

  if p_dias is null then
    update perfiles set activo = false, baneado_hasta = null where id = p_perfil_id;

    update solicitudes set estado = 'cancelada' where cliente_id = p_perfil_id and estado = 'abierta';
    update propuestas set estado = 'retirada', updated_at = now()
     where trabajador_id = p_perfil_id and estado = 'enviada';

    for v_sol in
      select id, cliente_id
      from solicitudes
      where trabajador_destino_id = p_perfil_id
        and estado = 'abierta'
    loop
      update solicitudes set estado = 'rechazada' where id = v_sol.id;
      perform public.notificar(v_sol.cliente_id, 'solicitud_rechazada', v_sol.id);
    end loop;

    insert into sanciones (perfil_id, tipo, dias, motivo, aplicada_por)
    values (p_perfil_id, 'bloqueo', null, btrim(p_motivo), auth.uid());
  else
    update perfiles set baneado_hasta = now() + make_interval(days => p_dias) where id = p_perfil_id;

    insert into sanciones (perfil_id, tipo, dias, motivo, aplicada_por)
    values (p_perfil_id, 'suspension', p_dias, btrim(p_motivo), auth.uid());
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Resolución de reportes: bans con motivo obligatorio y registrados
-- ---------------------------------------------------------------------------
create or replace function public.admin_resolver_reporte(
  p_reporte_id uuid,
  p_accion text,
  p_dias integer,
  p_motivo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r reportes;
  v_sol record;
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;

  select * into r from reportes where id = p_reporte_id for update;
  if not found then raise exception 'reporte_no_encontrado'; end if;

  if exists (select 1 from perfiles where id = r.perfil_id and es_superadmin) then
    raise exception 'no_puede_modificar_al_dueno';
  end if;
  if not es_superadmin() and exists (
    select 1 from perfiles where id = r.perfil_id and rol = 'admin'
  ) then
    raise exception 'no_puede_modificar_al_admin';
  end if;

  if p_accion in ('marca', 'ban_temporal', 'ban_permanente')
     and (p_motivo is null or btrim(p_motivo) = '') then
    raise exception 'motivo_vacio';
  end if;

  if p_accion = 'descartar' then
    update reportes set estado = 'descartado', resuelto_por = auth.uid() where id = r.id;
  elsif p_accion = 'marca' then
    insert into marcas_advertencia (perfil_id, motivo, aplicada_por)
    values (r.perfil_id, btrim(p_motivo), auth.uid());
    update reportes set estado = 'resuelto', resuelto_por = auth.uid() where id = r.id;
  elsif p_accion = 'ban_temporal' then
    update perfiles set baneado_hasta = now() + make_interval(days => p_dias) where id = r.perfil_id;
    insert into sanciones (perfil_id, tipo, dias, motivo, aplicada_por)
    values (r.perfil_id, 'suspension', p_dias, btrim(p_motivo), auth.uid());
    update reportes set estado = 'resuelto', resuelto_por = auth.uid() where id = r.id;
  elsif p_accion = 'ban_permanente' then
    update perfiles set activo = false, baneado_hasta = null where id = r.perfil_id;
    update solicitudes set estado = 'cancelada' where cliente_id = r.perfil_id and estado = 'abierta';
    update propuestas set estado = 'retirada', updated_at = now()
     where trabajador_id = r.perfil_id and estado = 'enviada';

    for v_sol in
      select id, cliente_id
      from solicitudes
      where trabajador_destino_id = r.perfil_id
        and estado = 'abierta'
    loop
      update solicitudes set estado = 'rechazada' where id = v_sol.id;
      perform public.notificar(v_sol.cliente_id, 'solicitud_rechazada', v_sol.id);
    end loop;

    insert into sanciones (perfil_id, tipo, dias, motivo, aplicada_por)
    values (r.perfil_id, 'bloqueo', null, btrim(p_motivo), auth.uid());

    update reportes set estado = 'resuelto', resuelto_por = auth.uid() where id = r.id;
  else
    raise exception 'accion_invalida';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Historial de sanciones y advertencias de un perfil
-- ---------------------------------------------------------------------------
create or replace function public.admin_sanciones_de(p_perfil_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  if exists (select 1 from perfiles where id = p_perfil_id and es_superadmin) then
    raise exception 'no_puede_modificar_al_dueno';
  end if;
  if not es_superadmin() and exists (
    select 1 from perfiles where id = p_perfil_id and rol = 'admin'
  ) then
    raise exception 'no_puede_modificar_al_admin';
  end if;

  select coalesce(
    jsonb_agg(item order by (item->>'created_at') desc),
    '[]'::jsonb
  )
  into v_result
  from (
    select jsonb_build_object(
      'id', s.id,
      'tipo', s.tipo,
      'dias', s.dias,
      'motivo', s.motivo,
      'created_at', s.created_at,
      'aplicada_por', (
        select w.nombre || ' ' || w.apellido from perfiles w where w.id = s.aplicada_por
      )
    ) as item
    from sanciones s
    where s.perfil_id = p_perfil_id

    union all

    select jsonb_build_object(
      'id', m.id,
      'tipo', 'marca',
      'dias', null,
      'motivo', coalesce(m.motivo, ''),
      'created_at', m.created_at,
      'aplicada_por', (
        select w.nombre || ' ' || w.apellido from perfiles w where w.id = m.aplicada_por
      )
    )
    from marcas_advertencia m
    where m.perfil_id = p_perfil_id
  ) t;

  return v_result;
end $$;

grant execute on function public.admin_sanciones_de(uuid) to authenticated;
grant execute on function public.admin_banear(uuid, integer, text) to authenticated;
grant execute on function public.admin_marcar(uuid, text) to authenticated;
grant execute on function public.admin_resolver_reporte(uuid, text, integer, text) to authenticated;
