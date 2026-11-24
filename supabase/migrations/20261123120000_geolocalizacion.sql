-- =============================================================================
-- ChangAr · Geolocalización
-- Coordenadas aproximadas para la zona del cliente, la ubicación de cada
-- solicitud y la zona de trabajo del trabajador (base + radio de cobertura).
-- =============================================================================

alter table public.solicitudes
  add column latitud double precision,
  add column longitud double precision;

alter table public.perfiles_cliente
  add column latitud double precision,
  add column longitud double precision;

alter table public.perfiles_trabajador
  add column latitud double precision,
  add column longitud double precision,
  add column radio_km numeric(5,1) not null default 10;

alter table public.solicitudes
  add constraint solicitudes_latitud_rango check (latitud is null or latitud between -90 and 90),
  add constraint solicitudes_longitud_rango check (longitud is null or longitud between -180 and 180);

alter table public.perfiles_cliente
  add constraint perfiles_cliente_latitud_rango check (latitud is null or latitud between -90 and 90),
  add constraint perfiles_cliente_longitud_rango check (longitud is null or longitud between -180 and 180);

alter table public.perfiles_trabajador
  add constraint perfiles_trabajador_latitud_rango check (latitud is null or latitud between -90 and 90),
  add constraint perfiles_trabajador_longitud_rango check (longitud is null or longitud between -180 and 180),
  add constraint perfiles_trabajador_radio_rango check (radio_km between 1 and 100);

comment on column public.solicitudes.latitud is
  'Latitud aproximada de la zona de la solicitud (redondeada en el cliente).';
comment on column public.solicitudes.longitud is
  'Longitud aproximada de la zona de la solicitud (redondeada en el cliente).';
comment on column public.perfiles_cliente.latitud is
  'Latitud aproximada de la zona de residencia del cliente.';
comment on column public.perfiles_cliente.longitud is
  'Longitud aproximada de la zona de residencia del cliente.';
comment on column public.perfiles_trabajador.latitud is
  'Latitud de la base de trabajo del profesional.';
comment on column public.perfiles_trabajador.longitud is
  'Longitud de la base de trabajo del profesional.';
comment on column public.perfiles_trabajador.radio_km is
  'Radio de cobertura de la zona de trabajo, en kilómetros.';

-- ---------------------------------------------------------------------------
-- Búsqueda de trabajadores con filtro opcional por distancia
-- ---------------------------------------------------------------------------
drop function if exists public.buscar_trabajadores(text, uuid, text, integer);

create or replace function public.buscar_trabajadores(
  p_query text default null,
  p_oficio_id uuid default null,
  p_zona text default null,
  p_min_rating integer default 0,
  p_lat double precision default null,
  p_lng double precision default null,
  p_radio_km numeric default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(item), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'id', b.id,
      'nombre', b.nombre,
      'apellido', b.apellido,
      'avatar_path', b.avatar_path,
      'zona', b.ubicacion,
      'descripcion', b.descripcion,
      'experiencia', b.experiencia,
      'latitud', b.latitud,
      'longitud', b.longitud,
      'radio_km', b.radio_km,
      'distancia_km', case
        when b.distancia_km is null then null
        else round(b.distancia_km::numeric, 1)
      end,
      'suspendido', (b.baneado_hasta is not null and b.baneado_hasta > now()),
      'oficios', (
        select coalesce(jsonb_agg(o.nombre order by o.nombre), '[]'::jsonb)
        from trabajador_oficios t
        join oficios o on o.id = t.oficio_id
        where t.trabajador_id = b.id and o.estado = 'activo'
      ),
      'total_valoraciones', (
        select count(*)::int from valoraciones v where v.destinatario_id = b.id
      ),
      'promedio', (
        select coalesce(round(avg(v.puntuacion)::numeric, 1), 0)
        from valoraciones v where v.destinatario_id = b.id
      ),
      'bajas', (
        select count(*)::int from valoraciones v
        where v.destinatario_id = b.id and v.puntuacion <= 2
      ),
      'reportes', (
        select count(*)::int from contrataciones c
        where c.estado = 'reportado'
          and (c.cliente_id = b.id or c.trabajador_id = b.id)
      )
    ) as item
    from (
      select
        p.id,
        p.nombre,
        p.apellido,
        p.avatar_path,
        p.baneado_hasta,
        pt.ubicacion,
        pt.descripcion,
        pt.experiencia,
        pt.latitud,
        pt.longitud,
        pt.radio_km,
        case
          when p_lat is not null
            and p_lng is not null
            and pt.latitud is not null
            and pt.longitud is not null
          then 6371 * 2 * asin(sqrt(
            power(sin(radians((pt.latitud - p_lat) / 2)), 2)
            + cos(radians(p_lat)) * cos(radians(pt.latitud))
              * power(sin(radians((pt.longitud - p_lng) / 2)), 2)
          ))
        end as distancia_km
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
    ) b
    where (
      p_lat is null
      or p_lng is null
      or p_radio_km is null
      or b.distancia_km is null
      or (
        b.distancia_km <= p_radio_km
        and b.distancia_km <= coalesce(b.radio_km, 10)
      )
    )
    order by
      case when p_lat is not null and p_lng is not null then b.distancia_km end nulls last,
      (select count(*) from valoraciones v where v.destinatario_id = b.id) desc,
      b.nombre asc
  ) t;

  return v_result;
end $$;

grant execute on function public.buscar_trabajadores(
  text, uuid, text, integer, double precision, double precision, numeric
) to authenticated;
