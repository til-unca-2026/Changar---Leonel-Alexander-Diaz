-- =============================================================================
-- ChangAr · Panel de administración (etapa 1)
-- Métricas y moderación de oficios.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Métricas del dashboard
-- ---------------------------------------------------------------------------
create or replace function public.admin_metricas()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not es_admin() then
    raise exception 'sin_permiso';
  end if;

  select jsonb_build_object(
    'usuarios_por_rol', (
      select coalesce(jsonb_object_agg(rol::text, n), '{}'::jsonb)
      from (select rol, count(*) n from perfiles group by rol) t
    ),
    'solicitudes_por_estado', (
      select coalesce(jsonb_object_agg(estado::text, n), '{}'::jsonb)
      from (select estado, count(*) n from solicitudes group by estado) t
    ),
    'propuestas_por_estado', (
      select coalesce(jsonb_object_agg(estado::text, n), '{}'::jsonb)
      from (select estado, count(*) n from propuestas group by estado) t
    ),
    'oficios_por_estado', (
      select coalesce(jsonb_object_agg(estado::text, n), '{}'::jsonb)
      from (select estado, count(*) n from oficios group by estado) t
    ),
    'ultimos_30_dias', jsonb_build_object(
      'registros',   (select count(*) from perfiles   where created_at > now() - interval '30 days'),
      'solicitudes', (select count(*) from solicitudes where created_at > now() - interval '30 days'),
      'propuestas',  (select count(*) from propuestas  where created_at > now() - interval '30 days')
    ),
    'top_oficios', (
      select coalesce(
        jsonb_agg(jsonb_build_object('oficio', nombre, 'solicitudes', n)),
        '[]'::jsonb
      )
      from (
        select o.nombre, count(s.id) n
        from oficios o
        join solicitudes s on s.oficio_id = o.id
        group by o.nombre
        order by n desc
        limit 5
      ) t
    ),
    'cola_pendientes', jsonb_build_object(
      'oficios', (select count(*) from oficios where estado = 'pendiente')
    )
  ) into v_result;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- Aprobar o rechazar un oficio
-- ---------------------------------------------------------------------------
create or replace function public.admin_aprobar_oficio(
  p_oficio_id uuid,
  p_aprobar boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin() then
    raise exception 'sin_permiso';
  end if;

  update oficios
     set estado = case when p_aprobar then 'activo'::estado_oficio
                                  else 'inactivo'::estado_oficio end
   where id = p_oficio_id;

  if not found then
    raise exception 'oficio_no_encontrado';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Fusionar oficios duplicados
-- ---------------------------------------------------------------------------
create or replace function public.admin_fusionar_oficios(
  p_origen uuid,
  p_destino uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin() then
    raise exception 'sin_permiso';
  end if;
  if p_origen = p_destino then
    raise exception 'mismo_oficio';
  end if;
  if not exists (select 1 from oficios where id = p_destino) then
    raise exception 'oficio_no_encontrado';
  end if;

  -- Reasignar trabajadores del duplicado al destino
  insert into trabajador_oficios (trabajador_id, oficio_id)
  select trabajador_id, p_destino
  from trabajador_oficios
  where oficio_id = p_origen
  on conflict do nothing;

  delete from trabajador_oficios where oficio_id = p_origen;

  -- Reasignar solicitudes del duplicado al destino
  update solicitudes set oficio_id = p_destino where oficio_id = p_origen;

  -- El duplicado queda inactivo
  update oficios set estado = 'inactivo' where id = p_origen;
end $$;
