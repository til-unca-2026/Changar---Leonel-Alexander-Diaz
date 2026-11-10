-- =============================================================================
-- ChangAr · Exploración de perfiles y solicitudes personales
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Solicitudes dirigidas a un trabajador concreto
-- ---------------------------------------------------------------------------
alter table solicitudes add column trabajador_destino_id uuid references perfiles(id);

create index solicitudes_destino_idx on solicitudes (trabajador_destino_id, estado);

-- Las solicitudes personales solo se ven para el cliente y el trabajador destino.
drop policy if exists "solicitudes lectura" on solicitudes;
create policy "solicitudes lectura" on solicitudes
  for select to authenticated using (
    cliente_id = auth.uid()
    or trabajador_destino_id = auth.uid()
    or trabajador_destino_id is null
  );

-- ---------------------------------------------------------------------------
-- Validación: la solicitud personal debe apuntar a un trabajador con perfil
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
        and coalesce(btrim(pt.descripcion), '') <> ''
        and coalesce(btrim(pt.ubicacion), '') <> ''
        and exists (select 1 from trabajador_oficios t where t.trabajador_id = p.id)
    ) then
      raise exception 'destino_invalido';
    end if;
  end if;
  return new;
end $$;

create trigger tr_validar_solicitud_personal
  before insert on solicitudes
  for each row execute function public.tg_validar_solicitud_personal();

-- ---------------------------------------------------------------------------
-- Notificación: el trabajador recibe la solicitud personal
-- ---------------------------------------------------------------------------
create or replace function public.tg_notificar_solicitud_personal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.trabajador_destino_id is not null then
    perform public.notificar(new.trabajador_destino_id, 'solicitud_personal', new.id);
  end if;
  return new;
end $$;

create trigger tr_notificar_solicitud_personal
  after insert on solicitudes
  for each row execute function public.tg_notificar_solicitud_personal();

-- La propuesta creada desde una aceptación personal ya nace aceptada:
-- no debe generar el aviso de "nueva propuesta".
create or replace function public.tg_notificar_propuesta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_cliente uuid;
begin
  if TG_OP = 'INSERT' then
    if new.estado = 'enviada' then
      select cliente_id into v_cliente from solicitudes where id = new.solicitud_id;
      if v_cliente is not null and v_cliente <> new.trabajador_id then
        perform public.notificar(v_cliente, 'nueva_propuesta', new.solicitud_id);
      end if;
    end if;
  elsif TG_OP = 'UPDATE' and new.estado is distinct from old.estado then
    if new.estado = 'aceptada' then
      perform public.notificar(new.trabajador_id, 'propuesta_aceptada', new.solicitud_id);
    elsif new.estado = 'rechazada' then
      perform public.notificar(new.trabajador_id, 'propuesta_rechazada', new.solicitud_id);
    end if;
  end if;
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: buscar trabajadores con perfil completo
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
-- RPC: aceptar una solicitud personal (el trabajador fija su precio)
-- ---------------------------------------------------------------------------
create or replace function public.aceptar_solicitud_personal(
  p_solicitud_id uuid,
  p_presupuesto numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol solicitudes;
  v_prop_id uuid;
  v_cont_id uuid;
begin
  if p_presupuesto is null or p_presupuesto <= 0 then
    raise exception 'presupuesto_invalido';
  end if;

  select * into v_sol from solicitudes where id = p_solicitud_id for update;
  if not found then
    raise exception 'solicitud_no_encontrada';
  end if;
  if v_sol.trabajador_destino_id is null then
    raise exception 'no_es_solicitud_personal';
  end if;
  if v_sol.trabajador_destino_id <> auth.uid() then
    raise exception 'sin_permiso';
  end if;
  if v_sol.estado <> 'abierta' then
    raise exception 'solicitud_no_abierta';
  end if;

  -- El trabajador necesita perfil completo
  if not exists (
    select 1
    from perfiles_trabajador pt
    where pt.id = auth.uid()
      and coalesce(btrim(pt.descripcion), '') <> ''
      and coalesce(btrim(pt.ubicacion), '') <> ''
      and exists (
        select 1 from trabajador_oficios t
        join oficios o on o.id = t.oficio_id
        where t.trabajador_id = auth.uid()
          and (o.estado = 'activo' or (o.estado = 'pendiente' and o.creado_por = auth.uid()))
      )
  ) then
    raise exception 'perfil_incompleto';
  end if;

  insert into propuestas (solicitud_id, trabajador_id, descripcion, presupuesto, estado)
  values (v_sol.id, auth.uid(), v_sol.descripcion, p_presupuesto, 'aceptada')
  returning id into v_prop_id;

  insert into contrataciones (propuesta_id, cliente_id, trabajador_id)
  values (v_prop_id, v_sol.cliente_id, auth.uid())
  returning id into v_cont_id;

  update solicitudes set estado = 'asignada' where id = v_sol.id;

  perform public.notificar(v_sol.cliente_id, 'propuesta_aceptada', p_solicitud_id);
  perform public.notificar(v_sol.cliente_id, 'contratacion_creada', v_cont_id);

  return v_cont_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: rechazar una solicitud personal
-- ---------------------------------------------------------------------------
create or replace function public.rechazar_solicitud_personal(p_solicitud_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol solicitudes;
begin
  select * into v_sol from solicitudes where id = p_solicitud_id for update;
  if not found then
    raise exception 'solicitud_no_encontrada';
  end if;
  if v_sol.trabajador_destino_id is null then
    raise exception 'no_es_solicitud_personal';
  end if;
  if v_sol.trabajador_destino_id <> auth.uid() then
    raise exception 'sin_permiso';
  end if;
  if v_sol.estado <> 'abierta' then
    raise exception 'solicitud_no_abierta';
  end if;

  update solicitudes set estado = 'rechazada' where id = p_sol.id;

  perform public.notificar(v_sol.cliente_id, 'solicitud_rechazada', p_solicitud_id);
end $$;
