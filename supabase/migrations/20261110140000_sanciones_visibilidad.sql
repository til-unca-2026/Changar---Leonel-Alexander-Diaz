-- =============================================================================
-- ChangAr · Sanciones: visibilidad y contratación
-- =============================================================================
-- Reglas:
--  · Suspensión temporal (baneado_hasta > now(), activo = true):
--      - el trabajador sigue apareciendo al explorar, pero marcado como
--        suspendido y sin poder recibir solicitudes personales;
--      - sus propuestas 'enviada' se ocultan al cliente hasta que termine;
--      - las solicitudes abiertas de un cliente suspendido no se muestran
--        a los trabajadores (las contrataciones existentes no se tocan).
--  · Bloqueo permanente (activo = false): no aparece en ningún lado y, al
--    aplicarse, se rechazan las solicitudes personales dirigidas a esa cuenta.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Explorar: marcar a los suspendidos (los bloqueados ya quedan fuera por activo)
-- ---------------------------------------------------------------------------
create or replace function public.buscar_trabajadores(
  p_query text default null,
  p_oficio_id uuid default null,
  p_zona text default null,
  p_min_rating integer default 0
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(item), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'id', p.id,
      'nombre', p.nombre,
      'apellido', p.apellido,
      'avatar_path', p.avatar_path,
      'zona', pt.ubicacion,
      'descripcion', pt.descripcion,
      'experiencia', pt.experiencia,
      'suspendido', (p.baneado_hasta is not null and p.baneado_hasta > now()),
      'oficios', (
        select coalesce(jsonb_agg(o.nombre order by o.nombre), '[]'::jsonb)
        from trabajador_oficios t
        join oficios o on o.id = t.oficio_id
        where t.trabajador_id = p.id and o.estado = 'activo'
      ),
      'total_valoraciones', (
        select count(*)::int from valoraciones v where v.destinatario_id = p.id
      ),
      'promedio', (
        select coalesce(round(avg(v.puntuacion)::numeric, 1), 0)
        from valoraciones v where v.destinatario_id = p.id
      ),
      'bajas', (
        select count(*)::int from valoraciones v
        where v.destinatario_id = p.id and v.puntuacion <= 2
      ),
      'reportes', (
        select count(*)::int from contrataciones c
        where c.estado = 'reportado'
          and (c.cliente_id = p.id or c.trabajador_id = p.id)
      )
    ) as item
    from perfiles p
    join perfiles_trabajador pt on pt.id = p.id
    where p.rol = 'trabajador'
      and p.activo = true
      and coalesce(btrim(pt.descripcion), '') <> ''
      and coalesce(btrim(pt.ubicacion), '') <> ''
      and exists (
        select 1 from trabajador_oficios t
        join oficios o on o.id = t.oficio_id
        where t.trabajador_id = p.id and o.estado = 'activo'
      )
      and (
        p_query is null or btrim(p_query) = ''
        or p.nombre ilike '%' || p_query || '%'
        or p.apellido ilike '%' || p_query || '%'
        or pt.ubicacion ilike '%' || p_query || '%'
        or exists (
          select 1 from trabajador_oficios t
          join oficios o on o.id = t.oficio_id
          where t.trabajador_id = p.id and o.nombre ilike '%' || p_query || '%'
        )
      )
      and (
        p_oficio_id is null
        or exists (
          select 1 from trabajador_oficios t
          where t.trabajador_id = p.id and t.oficio_id = p_oficio_id
        )
      )
      and (
        p_zona is null or btrim(p_zona) = '' or pt.ubicacion ilike '%' || p_zona || '%'
      )
      and (
        p_min_rating is null or p_min_rating <= 0
        or coalesce(
             (select avg(v.puntuacion) from valoraciones v where v.destinatario_id = p.id),
             0
           ) >= p_min_rating
      )
    order by (select count(*) from valoraciones v where v.destinatario_id = p.id) desc, p.nombre asc
  ) t;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- Solicitud personal: el destino no puede estar suspendido ni bloqueado
-- ---------------------------------------------------------------------------
create or replace function public.tg_validar_solicitud_personal()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.trabajador_destino_id is not null then
    if new.trabajador_destino_id = new.cliente_id then
      raise exception 'destino_invalido';
    end if;

    if not exists (
      select 1
      from perfiles p
      join perfiles_trabajador pt on pt.id = p.id
      where p.id = new.trabajador_destino_id
        and p.rol = 'trabajador'
        and p.activo = true
        and (p.baneado_hasta is null or p.baneado_hasta <= now())
        and coalesce(btrim(pt.descripcion), '') <> ''
        and coalesce(btrim(pt.ubicacion), '') <> ''
        and exists (select 1 from trabajador_oficios t where t.trabajador_id = p.id)
    ) then
      raise exception 'destino_invalido';
    end if;

    -- El oficio solicitado tiene que estar entre los que ofrece el trabajador.
    if not exists (
      select 1
      from trabajador_oficios t
      where t.trabajador_id = new.trabajador_destino_id
        and t.oficio_id = new.oficio_id
    ) then
      raise exception 'oficio_no_disponible';
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Aceptar propuesta: no se contrata a una cuenta sancionada
-- ---------------------------------------------------------------------------
create or replace function public.aceptar_propuesta(p_propuesta_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prop propuestas;
  v_sol  solicitudes;
  v_sol_id uuid;
  v_contratacion_id uuid;
begin
  select * into v_prop from propuestas where id = p_propuesta_id for update;
  if not found then
    raise exception 'propuesta_no_encontrada';
  end if;

  select * into v_sol from solicitudes where id = v_prop.solicitud_id for update;
  v_sol_id := v_sol.id;

  if v_sol.cliente_id <> auth.uid() then
    raise exception 'sin_permiso';
  end if;
  if v_sol.estado <> 'abierta' then
    raise exception 'solicitud_no_abierta';
  end if;
  if v_prop.estado <> 'enviada' then
    raise exception 'propuesta_no_disponible';
  end if;

  if not exists (
    select 1 from perfiles p
    where p.id = v_prop.trabajador_id
      and p.activo = true
      and (p.baneado_hasta is null or p.baneado_hasta <= now())
  ) then
    raise exception 'profesional_no_disponible';
  end if;

  insert into contrataciones (propuesta_id, cliente_id, trabajador_id)
  values (v_prop.id, v_sol.cliente_id, v_prop.trabajador_id)
  returning id into v_contratacion_id;

  update propuestas set estado = 'aceptada', updated_at = now() where id = v_prop.id;

  update propuestas set estado = 'rechazada', updated_at = now()
   where solicitud_id = v_sol_id
     and id <> v_prop.id
     and estado = 'enviada';

  update solicitudes set estado = 'asignada' where id = v_sol_id;

  return v_contratacion_id;
end $$;

-- ---------------------------------------------------------------------------
-- Banear: el bloqueo permanente también cierra las personales pendientes
-- ---------------------------------------------------------------------------
create or replace function public.admin_banear(p_perfil_id uuid, p_dias integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol record;
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  if p_perfil_id = auth.uid() then raise exception 'no_puede_banearse_a_si_mismo'; end if;

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
  else
    update perfiles set baneado_hasta = now() + make_interval(days => p_dias) where id = p_perfil_id;
  end if;
end $$;

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

  if p_accion = 'descartar' then
    update reportes set estado = 'descartado', resuelto_por = auth.uid() where id = r.id;
  elsif p_accion = 'marca' then
    insert into marcas_advertencia (perfil_id, motivo, aplicada_por)
    values (r.perfil_id, p_motivo, auth.uid());
    update reportes set estado = 'resuelto', resuelto_por = auth.uid() where id = r.id;
  elsif p_accion = 'ban_temporal' then
    update perfiles set baneado_hasta = now() + make_interval(days => p_dias) where id = r.perfil_id;
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

    update reportes set estado = 'resuelto', resuelto_por = auth.uid() where id = r.id;
  else
    raise exception 'accion_invalida';
  end if;
end $$;
