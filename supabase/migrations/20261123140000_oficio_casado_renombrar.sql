-- =============================================================================
-- ChangAr · Oficios: casado al crear + renombrar admin
-- - crear_oficio guarda el nombre nuevo con la primera letra en mayúscula y el
--   resto en minúscula (lo crean trabajadores o clientes).
-- - Nuevo admin_renombrar_oficio: el admin corrige nombres mal tipeados, tanto
--   de pendientes (antes de aprobarlos) como del catálogo ya cargado.
-- - Desactivar/reactivar del catálogo usa admin_aprobar_oficio (ya existe),
--   que deja el oficio activo/inactivo sin importar su estado previo.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Crea un oficio nuevo (pendiente) o devuelve el existente, sin duplicar.
-- Ahora el alta normaliza el casado: "plomero MIGUEL" -> "Plomero miguel".
-- ---------------------------------------------------------------------------
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
  v_nombre text;
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

  -- Alta con formato de catálogo: primera mayúscula, resto minúscula.
  v_nombre := btrim(p_nombre);
  v_nombre := upper(left(v_nombre, 1)) || lower(substr(v_nombre, 2));

  insert into oficios (nombre, estado, creado_por)
  values (v_nombre, 'pendiente', auth.uid())
  returning id into v_id;

  if exists (select 1 from perfiles where id = auth.uid() and rol = 'trabajador') then
    insert into trabajador_oficios (trabajador_id, oficio_id)
    values (auth.uid(), v_id)
    on conflict do nothing;
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- Admin: corrige el nombre de un oficio. El trigger tr_normalizar_oficio
-- recalcula nombre_normalizado; el índice único resiste carreras.
-- ---------------------------------------------------------------------------
create or replace function public.admin_renombrar_oficio(
  p_oficio_id uuid,
  p_nombre text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
begin
  if not es_admin() then
    raise exception 'sin_permiso';
  end if;

  v_nombre := btrim(coalesce(p_nombre, ''));
  if v_nombre = '' then
    raise exception 'nombre_vacio';
  end if;

  if not exists (select 1 from oficios where id = p_oficio_id) then
    raise exception 'oficio_no_encontrado';
  end if;

  if exists (
    select 1 from oficios
    where nombre_normalizado = public.normalizar_oficio(v_nombre)
      and id <> p_oficio_id
  ) then
    raise exception 'oficio_duplicado';
  end if;

  update oficios set nombre = v_nombre where id = p_oficio_id;
end $$;

grant execute on function public.admin_renombrar_oficio(uuid, text) to authenticated;
