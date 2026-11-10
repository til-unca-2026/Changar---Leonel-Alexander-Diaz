-- =============================================================================
-- ChangAr · Confirmación del cliente en solicitudes personales
-- =============================================================================
-- Antes: el trabajador "aceptaba" una solicitud personal y se creaba la
-- contratación en el acto con el precio que él fijaba.
-- Ahora: aceptar = enviar una propuesta con su precio. La solicitud sigue
-- abierta hasta que el cliente la confirma (`aceptar_propuesta`, RPC que ya
-- existe) o la rechaza (`rechazar_propuesta`, nueva).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- RPC: el trabajador acepta una solicitud personal enviando su presupuesto.
-- Devuelve el id de la propuesta creada (ya no crea la contratación).
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

  if exists (
    select 1 from propuestas p
    where p.solicitud_id = v_sol.id
      and p.trabajador_id = auth.uid()
  ) then
    -- Si la había retirado, se reenvía con el nuevo presupuesto.
    update propuestas
       set estado = 'enviada',
           descripcion = v_sol.descripcion,
           presupuesto = p_presupuesto,
           updated_at = now()
     where solicitud_id = v_sol.id
       and trabajador_id = auth.uid()
       and estado = 'retirada'
     returning id into v_prop_id;

    if v_prop_id is not null then
      perform public.notificar(v_sol.cliente_id, 'nueva_propuesta', v_sol.id);
      return v_prop_id;
    end if;

    raise exception 'propuesta_ya_enviada';
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

  -- Nace 'enviada': el cliente debe confirmarla antes de contratar.
  insert into propuestas (solicitud_id, trabajador_id, descripcion, presupuesto)
  values (v_sol.id, auth.uid(), v_sol.descripcion, p_presupuesto)
  returning id into v_prop_id;

  return v_prop_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: el cliente rechaza una propuesta enviada.
-- En solicitudes personales el rechazo cierra la solicitud.
-- ---------------------------------------------------------------------------
create or replace function public.rechazar_propuesta(p_propuesta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prop propuestas;
  v_sol  solicitudes;
begin
  select * into v_prop from propuestas where id = p_propuesta_id for update;
  if not found then
    raise exception 'propuesta_no_encontrada';
  end if;

  select * into v_sol from solicitudes where id = v_prop.solicitud_id for update;

  if v_sol.cliente_id <> auth.uid() then
    raise exception 'sin_permiso';
  end if;
  if v_prop.estado <> 'enviada' then
    raise exception 'propuesta_no_disponible';
  end if;

  update propuestas set estado = 'rechazada', updated_at = now() where id = v_prop.id;

  if v_sol.trabajador_destino_id is not null then
    update solicitudes set estado = 'rechazada' where id = v_sol.id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Endurecido: solo el trabajador destino puede proponer en una personal.
-- ---------------------------------------------------------------------------
create or replace function public.enviar_propuesta(
  p_solicitud_id uuid,
  p_descripcion text,
  p_presupuesto numeric
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol solicitudes;
  v_id uuid;
begin
  if p_descripcion is null or btrim(p_descripcion) = '' then
    raise exception 'descripcion_vacia';
  end if;
  if p_presupuesto is null or p_presupuesto <= 0 then
    raise exception 'presupuesto_invalido';
  end if;

  select * into v_sol from solicitudes where id = p_solicitud_id for update;
  if not found then
    raise exception 'solicitud_no_encontrada';
  end if;
  if v_sol.estado <> 'abierta' then
    raise exception 'solicitud_no_abierta';
  end if;
  if v_sol.cliente_id = auth.uid() then
    raise exception 'no_podes_postularte_a_tu_solicitud';
  end if;
  if v_sol.trabajador_destino_id is not null
     and v_sol.trabajador_destino_id <> auth.uid() then
    raise exception 'sin_permiso';
  end if;

  if not exists (
    select 1
    from perfiles_trabajador pt
    where pt.id = auth.uid()
      and coalesce(btrim(pt.descripcion), '') <> ''
      and coalesce(btrim(pt.ubicacion), '') <> ''
      and exists (
        select 1
        from trabajador_oficios t
        join oficios o on o.id = t.oficio_id
        where t.trabajador_id = auth.uid()
          and (o.estado = 'activo' or (o.estado = 'pendiente' and o.creado_por = auth.uid()))
      )
  ) then
    raise exception 'perfil_incompleto';
  end if;

  insert into propuestas (solicitud_id, trabajador_id, descripcion, presupuesto)
  values (p_solicitud_id, auth.uid(), btrim(p_descripcion), p_presupuesto)
  returning id into v_id;

  return v_id;
end $$;
