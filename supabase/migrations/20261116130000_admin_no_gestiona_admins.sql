-- =============================================================================
-- ChangAr · Los administradores no ven ni gestionan cuentas de administrador
--
-- Jerarquía:
--   - El dueño (`es_superadmin`) ve y gestiona a todos (incluidos admins),
--     salvo a sí mismo (ya bloqueado por las RPCs y la UI).
--   - Un administrador normal solo ve clientes y trabajadores, y solo puede
--     sancionarlos. No ve ni puede tocar ninguna cuenta con rol 'admin'
--     (ni al dueño ni a otros admins), tampoco a través de reportes/contratos.
--
-- Se conservan las protecciones vigentes del dueño (`no_puede_modificar_al_dueno`)
-- y el bloqueo de auto-sanção.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Listado de usuarios
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
    where es_superadmin() or p.rol <> 'admin'
    order by p.created_at desc
  ) t;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- Reportes de perfiles: un admin normal no ve reportes contra admins
-- ---------------------------------------------------------------------------
create or replace function public.admin_listar_reportes()
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
      'id', r.id,
      'motivo', r.motivo,
      'estado', r.estado,
      'created_at', r.created_at,
      'reportante_nombre', rep.nombre || ' ' || rep.apellido,
      'perfil_id', p.id,
      'perfil_nombre', p.nombre || ' ' || p.apellido,
      'perfil_rol', p.rol
    ) as item
    from reportes r
    join perfiles rep on rep.id = r.reportante_id
    join perfiles p on p.id = r.perfil_id
    where es_superadmin() or p.rol <> 'admin'
    order by (r.estado = 'pendiente') desc, r.created_at desc
  ) t;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- Contratos reportados: un admin normal no ve contratos con un admin
-- ---------------------------------------------------------------------------
create or replace function public.admin_listar_contratos_reportados()
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
      'contratacion_id', c.id,
      'oficio', o.nombre,
      'solicitud_titulo', s.titulo,
      'cliente_id', c.cliente_id,
      'cliente_nombre', cli.nombre || ' ' || cli.apellido,
      'trabajador_id', c.trabajador_id,
      'trabajador_nombre', tra.nombre || ' ' || tra.apellido,
      'created_at', c.created_at,
      'resuelto', (c.resuelto_por is not null),
      'resuelto_a_favor_nombre', (
        select w.nombre || ' ' || w.apellido from perfiles w where w.id = c.resuelto_a_favor
      ),
      'sancionado_nombre', (
        select w.nombre || ' ' || w.apellido from perfiles w where w.id = c.sancionado
      ),
      'reporte', (
        select jsonb_build_object(
          'comentario', e.comentario,
          'fotos', coalesce(
            (select jsonb_agg(f.storage_path) from contratacion_evidencia_fotos f where f.evidencia_id = e.id),
            '[]'::jsonb
          )
        )
        from contratacion_evidencias e where e.contratacion_id = c.id and e.tipo = 'reporte' limit 1
      ),
      'descargo', (
        select jsonb_build_object(
          'comentario', e2.comentario,
          'fotos', coalesce(
            (select jsonb_agg(f2.storage_path) from contratacion_evidencia_fotos f2 where f2.evidencia_id = e2.id),
            '[]'::jsonb
          )
        )
        from contratacion_evidencias e2 where e2.contratacion_id = c.id and e2.tipo = 'descargo' limit 1
      )
    ) as item
    from contrataciones c
    join propuestas p on p.id = c.propuesta_id
    join solicitudes s on s.id = p.solicitud_id
    join oficios o on o.id = s.oficio_id
    join perfiles cli on cli.id = c.cliente_id
    join perfiles tra on tra.id = c.trabajador_id
    where c.estado = 'reportado'
      and (es_superadmin() or (cli.rol <> 'admin' and tra.rol <> 'admin'))
    order by (c.resuelto_por is null) desc, c.created_at desc
  ) t;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- Sanciones: un admin normal no puede marcar/banear/desbanear admins
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
  if not es_superadmin() and exists (
    select 1 from perfiles where id = p_perfil_id and rol = 'admin'
  ) then
    raise exception 'no_puede_modificar_al_admin';
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
  else
    update perfiles set baneado_hasta = now() + make_interval(days => p_dias) where id = p_perfil_id;
  end if;
end $$;

create or replace function public.admin_desbanear(p_perfil_id uuid)
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
  if not es_superadmin() and exists (
    select 1 from perfiles where id = p_perfil_id and rol = 'admin'
  ) then
    raise exception 'no_puede_modificar_al_admin';
  end if;
  update perfiles set activo = true, baneado_hasta = null where id = p_perfil_id;
end $$;

-- ---------------------------------------------------------------------------
-- Resolución de reportes: un admin normal no sanciona admins
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
-- Resolución de contratos: la parte sancionada no puede ser un admin
-- (salvo que resuelva el dueño)
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
  if not es_superadmin() and exists (
    select 1 from perfiles where id = v_sanc and rol = 'admin'
  ) then
    raise exception 'no_puede_modificar_al_admin';
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
