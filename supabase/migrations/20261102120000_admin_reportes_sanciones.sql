-- =============================================================================
-- ChangAr · Administración: usuarios, reportes, marcas de advertencia y bans
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Marcas de advertencia (privadas, solo admin)
-- ---------------------------------------------------------------------------
create table marcas_advertencia (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid not null references perfiles(id) on delete cascade,
  motivo      text,
  aplicada_por uuid references perfiles(id),
  created_at  timestamptz not null default now()
);

create index marcas_perfil_idx on marcas_advertencia (perfil_id);

alter table marcas_advertencia enable row level security;
create policy "marcas admin" on marcas_advertencia
  for all to authenticated using (es_admin()) with check (es_admin());

-- ---------------------------------------------------------------------------
-- Reportes de perfiles (denuncias)
-- ---------------------------------------------------------------------------
create type estado_reporte as enum ('pendiente', 'resuelto', 'descartado');

create table reportes (
  id            uuid primary key default gen_random_uuid(),
  reportante_id uuid not null references perfiles(id) on delete cascade,
  perfil_id     uuid not null references perfiles(id) on delete cascade,
  motivo        text not null,
  estado        estado_reporte not null default 'pendiente',
  resuelto_por  uuid references perfiles(id),
  created_at    timestamptz not null default now()
);

create index reportes_estado_idx on reportes (estado);
create index reportes_perfil_idx on reportes (perfil_id);

alter table reportes enable row level security;
create policy "reportes alta propio" on reportes
  for insert to authenticated with check (reportante_id = auth.uid());
create policy "reportes lectura propio o admin" on reportes
  for select to authenticated using (reportante_id = auth.uid() or es_admin());
create policy "reportes resolucion admin" on reportes
  for update to authenticated using (es_admin()) with check (es_admin());

grant select, insert, update on reportes to authenticated;

-- ---------------------------------------------------------------------------
-- Ban temporal en perfiles
-- ---------------------------------------------------------------------------
alter table perfiles add column baneado_hasta timestamptz;
grant select (baneado_hasta) on perfiles to authenticated;

-- ---------------------------------------------------------------------------
-- Resolución de contratos reportados
-- ---------------------------------------------------------------------------
alter table contrataciones add column resuelto_a_favor uuid references perfiles(id);
alter table contrataciones add column sancionado uuid references perfiles(id);
alter table contrataciones add column resuelto_por uuid references perfiles(id);
alter table contrataciones add column resuelto_at timestamptz;

-- ---------------------------------------------------------------------------
-- Métricas con filtro por período
-- ---------------------------------------------------------------------------
create or replace function public.admin_metricas(p_desde timestamptz default null)
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
      from (select estado, count(*) n from solicitudes
            where (p_desde is null or created_at >= p_desde) group by estado) t
    ),
    'propuestas_por_estado', (
      select coalesce(jsonb_object_agg(estado::text, n), '{}'::jsonb)
      from (select estado, count(*) n from propuestas
            where (p_desde is null or created_at >= p_desde) group by estado) t
    ),
    'contrataciones_por_estado', (
      select coalesce(jsonb_object_agg(estado::text, n), '{}'::jsonb)
      from (select estado, count(*) n from contrataciones
            where (p_desde is null or created_at >= p_desde) group by estado) t
    ),
    'oficios_por_estado', (
      select coalesce(jsonb_object_agg(estado::text, n), '{}'::jsonb)
      from (select estado, count(*) n from oficios group by estado) t
    ),
    'reportes_por_estado', (
      select coalesce(jsonb_object_agg(estado::text, n), '{}'::jsonb)
      from (select estado, count(*) n from reportes group by estado) t
    ),
    'top_oficios', (
      select coalesce(
        jsonb_agg(jsonb_build_object('oficio', nombre, 'solicitudes', n)),
        '[]'::jsonb
      )
      from (
        select o.nombre, count(s.id) n
        from oficios o join solicitudes s on s.oficio_id = o.id
        where (p_desde is null or s.created_at >= p_desde)
        group by o.nombre order by n desc limit 5
      ) t
    ),
    'cola_pendientes', jsonb_build_object(
      'oficios', (select count(*) from oficios where estado = 'pendiente'),
      'reportes', (select count(*) from reportes where estado = 'pendiente'),
      'contratos_reportados', (
        select count(*) from contrataciones
        where estado = 'reportado' and resuelto_por is null
      )
    )
  ) into v_result;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- Listados para el admin
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
      'created_at', p.created_at,
      'marcas', (select count(*) from marcas_advertencia m where m.perfil_id = p.id),
      'reportes_pendientes', (select count(*) from reportes r where r.perfil_id = p.id and r.estado = 'pendiente')
    ) as item
    from perfiles p
    order by p.created_at desc
  ) t;

  return v_result;
end $$;

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
    order by (r.estado = 'pendiente') desc, r.created_at desc
  ) t;

  return v_result;
end $$;

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
    order by (c.resuelto_por is null) desc, c.created_at desc
  ) t;

  return v_result;
end $$;

-- ---------------------------------------------------------------------------
-- Sanciones
-- ---------------------------------------------------------------------------
create or replace function public.admin_marcar(p_perfil_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  insert into marcas_advertencia (perfil_id, motivo, aplicada_por)
  values (p_perfil_id, p_motivo, auth.uid());
end $$;

create or replace function public.admin_banear(p_perfil_id uuid, p_dias integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  if p_perfil_id = auth.uid() then raise exception 'no_puede_banearse_a_si_mismo'; end if;

  if p_dias is null then
    update perfiles set activo = false, baneado_hasta = null where id = p_perfil_id;
    update solicitudes set estado = 'cancelada' where cliente_id = p_perfil_id and estado = 'abierta';
    update propuestas set estado = 'retirada', updated_at = now()
     where trabajador_id = p_perfil_id and estado = 'enviada';
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
  update perfiles set activo = true, baneado_hasta = null where id = p_perfil_id;
end $$;

create or replace function public.admin_cambiar_rol(p_perfil_id uuid, p_rol rol_usuario)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not es_admin() then raise exception 'sin_permiso'; end if;
  if p_perfil_id = auth.uid() then raise exception 'no_puede_cambiar_su_rol'; end if;
  update perfiles set rol = p_rol where id = p_perfil_id;
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
    update reportes set estado = 'resuelto', resuelto_por = auth.uid() where id = r.id;
  else
    raise exception 'accion_invalida';
  end if;
end $$;

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

  update contrataciones
     set resuelto_a_favor = p_a_favor_id,
         sancionado = v_sanc,
         resuelto_por = auth.uid(),
         resuelto_at = now()
   where id = c.id;

  insert into marcas_advertencia (perfil_id, motivo, aplicada_por)
  values (v_sanc, 'Resolución de contrato reportado', auth.uid());
end $$;
