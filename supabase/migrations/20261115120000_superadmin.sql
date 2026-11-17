-- =============================================================================
-- ChangAr · Dueño de la app (superadmin) y jerarquía de administración
--
-- El dueño es un administrador con una marca extra (`es_superadmin`). La marca
-- es un booleano y no un valor del enum `rol_usuario` a propósito: ninguna RPC
-- recibe un booleano, así que no existe el camino de código para crear un
-- dueño desde la app. Solo un UPDATE manual en el SQL Editor puede hacerlo.
--
-- Jerarquía:
--   - admin          -> modera oficios, reportes y sanciones.
--   - es_superadmin  -> además crea cuentas de administrador y da o quita el
--                       rol admin. Es intocable: nadie lo degrada ni lo sanciona.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Marca de dueño
-- ---------------------------------------------------------------------------
alter table perfiles add column es_superadmin boolean not null default false;

-- La columna es legible por el usuario autenticado (la usa la UI para mostrar
-- la sección de administradores). Los permisos son por columna, como el resto.
grant select (es_superadmin) on perfiles to authenticated;

create index perfiles_es_superadmin_idx on perfiles (es_superadmin)
  where es_superadmin;

-- ---------------------------------------------------------------------------
-- Helper de dueño
-- ---------------------------------------------------------------------------
create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from perfiles
    where id = auth.uid() and es_superadmin and rol = 'admin' and activo
  );
$$;

-- ---------------------------------------------------------------------------
-- El listado de usuarios expone la marca para que el panel la muestre
-- ---------------------------------------------------------------------------
create or replace function public.admin_listar_usuarios()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare v_result jsonb;
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;

  select coalesce(jsonb_agg(item), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'id', p.id,
      'nombre', p.nombre,
      'apellido', p.apellido,
      'email', p.email,
      'rol', p.rol,
      'activo', p.activo,
      'baneado_hasta', p.baneado_hasta,
      'es_superadmin', p.es_superadmin,
      'created_at', p.created_at,
      'marcas', (select count(*) from marcas_advertencia m where m.perfil_id = p.id),
      'reportes_pendientes', (select count(*) from reportes r where r.perfil_id = p.id and r.estado = 'pendiente')
    ) as item
    from perfiles p
    order by p.created_at desc
  ) t;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- Protección del dueño: nadie lo marca, lo suspende ni lo degrada
-- ---------------------------------------------------------------------------
create or replace function public.admin_marcar(p_perfil_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  if exists (select 1 from perfiles where id = p_perfil_id and es_superadmin) then
    raise exception 'no_puede_modificar_al_dueno';
  end if;
  insert into marcas_advertencia (perfil_id, motivo, aplicada_por)
  values (p_perfil_id, p_motivo, auth.uid());
end $$;

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
  if exists (select 1 from perfiles where id = p_perfil_id and es_superadmin) then
    raise exception 'no_puede_modificar_al_dueno';
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
  else
    update perfiles set baneado_hasta = now() + make_interval(days => p_dias) where id = p_perfil_id;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Rol: solo el dueño da o quita el rol de administrador
-- ---------------------------------------------------------------------------
create or replace function public.admin_cambiar_rol(p_perfil_id uuid, p_rol rol_usuario)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rol_actual rol_usuario;
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  if p_perfil_id = auth.uid() then raise exception 'no_puede_cambiar_su_rol'; end if;

  select rol into v_rol_actual from perfiles where id = p_perfil_id;
  if not found then raise exception 'usuario_no_encontrado'; end if;

  -- El dueño de la app no se degrada.
  if exists (select 1 from perfiles where id = p_perfil_id and es_superadmin) then
    raise exception 'no_puede_modificar_al_dueno';
  end if;

  -- Crear administradores (y degradarlos) es prerrogativa del dueño.
  if (p_rol = 'admin' or v_rol_actual = 'admin') and not es_superadmin() then
    raise exception 'sin_permiso';
  end if;

  update perfiles set rol = p_rol where id = p_perfil_id;
end $$;

-- ---------------------------------------------------------------------------
-- Resolución de reportes: no se sanciona ni se marca al dueño
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

-- ---------------------------------------------------------------------------
-- Resolución de contratos: la parte sancionada no puede ser el dueño
-- ---------------------------------------------------------------------------
create or replace function public.admin_resolver_contrato(
  p_contratacion_id uuid,
  p_a_favor_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c contrataciones;
  v_sanc uuid;
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;

  select * into c from contrataciones where id = p_contratacion_id for update;
  if not found then raise exception 'contratacion_no_encontrada'; end if;
  if c.estado <> 'reportado' then raise exception 'estado_invalido'; end if;
  if p_a_favor_id not in (c.cliente_id, c.trabajador_id) then raise exception 'parte_invalida'; end if;

  v_sanc := case when p_a_favor_id = c.cliente_id then c.trabajador_id else c.cliente_id end;

  if exists (select 1 from perfiles where id = v_sanc and es_superadmin) then
    raise exception 'no_puede_modificar_al_dueno';
  end if;

  update contrataciones
     set resuelto_a_favor = p_a_favor_id,
         sancionado = v_sanc,
         resuelto_por = auth.uid(),
         resuelto_at = now()
   where id = c.id;

  insert into marcas_advertencia (perfil_id, motivo, aplicada_por)
  values (v_sanc, 'Resolución de contrato reportado', auth.uid());
end $$;
