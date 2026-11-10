-- =============================================================================
-- ChangAr · Solicitud personal: el oficio debe ser uno del trabajador destino
-- =============================================================================
-- Evita que se cree (por RPC o API) una solicitud personal con un oficio que
-- el profesional no declara. Aplica solo a solicitudes dirigidas
-- (`trabajador_destino_id is not null`).
-- =============================================================================

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
