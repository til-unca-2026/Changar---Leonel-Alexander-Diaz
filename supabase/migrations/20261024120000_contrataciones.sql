-- =============================================================================
-- ChangAr · Contrataciones
-- Aceptación de propuesta, doble validación de fin, cancelación y evidencias.
-- =============================================================================

create type estado_contratacion as enum ('en_curso', 'pendiente_confirmacion', 'completado', 'cancelado');
create type tipo_evidencia as enum ('fin', 'cancelacion', 'respuesta');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table contrataciones (
  id                 uuid primary key default gen_random_uuid(),
  propuesta_id       uuid not null unique references propuestas(id),
  cliente_id         uuid not null references perfiles(id),
  trabajador_id      uuid not null references perfiles(id),
  estado             estado_contratacion not null default 'en_curso',
  cancelado_por      uuid references perfiles(id),
  motivo_cancelacion text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index contrataciones_cliente_idx on contrataciones (cliente_id);
create index contrataciones_trabajador_idx on contrataciones (trabajador_id);

create table contratacion_evidencias (
  id              uuid primary key default gen_random_uuid(),
  contratacion_id uuid not null references contrataciones(id) on delete cascade,
  autor_id        uuid not null references perfiles(id),
  tipo            tipo_evidencia not null,
  comentario      text,
  created_at      timestamptz not null default now()
);

create unique index contratacion_evidencias_fin_idx
  on contratacion_evidencias (contratacion_id, autor_id)
  where tipo = 'fin';

create index contratacion_evidencias_contratacion_idx
  on contratacion_evidencias (contratacion_id);

create table contratacion_evidencia_fotos (
  id           uuid primary key default gen_random_uuid(),
  evidencia_id uuid not null references contratacion_evidencias(id) on delete cascade,
  storage_path text not null
);

-- ---------------------------------------------------------------------------
-- RPC: aceptar propuesta
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
-- RPC: confirmar fin (doble validación)
-- ---------------------------------------------------------------------------
create or replace function public.confirmar_fin(
  p_contratacion_id uuid,
  p_comentario text,
  p_fotos text[]
)
returns estado_contratacion
language plpgsql
security definer
set search_path = public
as $$
declare
  c contrataciones;
  v_evidencia uuid;
  v_confirmaciones int;
begin
  select * into c from contrataciones where id = p_contratacion_id for update;
  if not found then
    raise exception 'contratacion_no_encontrada';
  end if;
  if auth.uid() not in (c.cliente_id, c.trabajador_id) then
    raise exception 'sin_permiso';
  end if;
  if c.estado not in ('en_curso', 'pendiente_confirmacion') then
    raise exception 'estado_invalido';
  end if;

  if exists (
    select 1 from contratacion_evidencias e
    where e.contratacion_id = c.id and e.autor_id = auth.uid() and e.tipo = 'fin'
  ) then
    raise exception 'fin_ya_confirmado';
  end if;

  insert into contratacion_evidencias (contratacion_id, autor_id, tipo, comentario)
  values (c.id, auth.uid(), 'fin', p_comentario)
  returning id into v_evidencia;

  if p_fotos is not null and array_length(p_fotos, 1) > 0 then
    insert into contratacion_evidencia_fotos (evidencia_id, storage_path)
    select v_evidencia, unnest(p_fotos);
  end if;

  select count(distinct autor_id) into v_confirmaciones
    from contratacion_evidencias
   where contratacion_id = c.id and tipo = 'fin';

  if v_confirmaciones >= 2 then
    update contrataciones set estado = 'completado', updated_at = now() where id = c.id;

    update solicitudes set estado = 'cerrada'
     where id = (select s.id from solicitudes s
                 join propuestas p on p.solicitud_id = s.id
                where p.id = c.propuesta_id);

    return 'completado';
  end if;

  update contrataciones set estado = 'pendiente_confirmacion', updated_at = now()
   where id = c.id;

  return 'pendiente_confirmacion';
end $$;

-- ---------------------------------------------------------------------------
-- RPC: cancelar contratación (unilateral)
-- ---------------------------------------------------------------------------
create or replace function public.cancelar_contratacion(
  p_contratacion_id uuid,
  p_motivo text,
  p_fotos text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c contrataciones;
  v_evidencia uuid;
begin
  if p_motivo is null or btrim(p_motivo) = '' then
    raise exception 'motivo_obligatorio';
  end if;

  select * into c from contrataciones where id = p_contratacion_id for update;
  if not found then
    raise exception 'contratacion_no_encontrada';
  end if;
  if auth.uid() not in (c.cliente_id, c.trabajador_id) then
    raise exception 'sin_permiso';
  end if;
  if c.estado not in ('en_curso', 'pendiente_confirmacion') then
    raise exception 'estado_invalido';
  end if;

  insert into contratacion_evidencias (contratacion_id, autor_id, tipo, comentario)
  values (c.id, auth.uid(), 'cancelacion', p_motivo)
  returning id into v_evidencia;

  if p_fotos is not null and array_length(p_fotos, 1) > 0 then
    insert into contratacion_evidencia_fotos (evidencia_id, storage_path)
    select v_evidencia, unnest(p_fotos);
  end if;

  update contrataciones
     set estado = 'cancelado',
         cancelado_por = auth.uid(),
         motivo_cancelacion = p_motivo,
         updated_at = now()
   where id = c.id;

  update solicitudes set estado = 'cancelada'
   where id = (select s.id from solicitudes s
               join propuestas p on p.solicitud_id = s.id
              where p.id = c.propuesta_id);
end $$;

-- ---------------------------------------------------------------------------
-- RPC: agregar respuesta de la contraparte
-- ---------------------------------------------------------------------------
create or replace function public.agregar_respuesta(
  p_contratacion_id uuid,
  p_comentario text,
  p_fotos text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  c contrataciones;
  v_evidencia uuid;
begin
  if p_comentario is null or btrim(p_comentario) = '' then
    raise exception 'comentario_obligatorio';
  end if;

  select * into c from contrataciones where id = p_contratacion_id for update;
  if not found then
    raise exception 'contratacion_no_encontrada';
  end if;
  if auth.uid() not in (c.cliente_id, c.trabajador_id) then
    raise exception 'sin_permiso';
  end if;
  if c.estado not in ('en_curso', 'pendiente_confirmacion', 'cancelado') then
    raise exception 'estado_invalido';
  end if;

  insert into contratacion_evidencias (contratacion_id, autor_id, tipo, comentario)
  values (c.id, auth.uid(), 'respuesta', p_comentario)
  returning id into v_evidencia;

  if p_fotos is not null and array_length(p_fotos, 1) > 0 then
    insert into contratacion_evidencia_fotos (evidencia_id, storage_path)
    select v_evidencia, unnest(p_fotos);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table contrataciones              enable row level security;
alter table contratacion_evidencias     enable row level security;
alter table contratacion_evidencia_fotos enable row level security;

create policy "contrataciones lectura participantes" on contrataciones
  for select to authenticated using (
    cliente_id = auth.uid() or trabajador_id = auth.uid() or es_admin()
  );

create policy "evidencias lectura participantes" on contratacion_evidencias
  for select to authenticated using (
    es_admin()
    or exists (
      select 1 from contrataciones c
      where c.id = contratacion_id
        and (c.cliente_id = auth.uid() or c.trabajador_id = auth.uid())
    )
  );

create policy "evidencias fotos lectura participantes" on contratacion_evidencia_fotos
  for select to authenticated using (
    es_admin()
    or exists (
      select 1 from contratacion_evidencias e
      join contrataciones c on c.id = e.contratacion_id
      where e.id = evidencia_id
        and (c.cliente_id = auth.uid() or c.trabajador_id = auth.uid())
    )
  );

create policy "evidencias borrado admin" on contratacion_evidencias
  for delete to authenticated using (es_admin());
create policy "evidencias fotos borrado admin" on contratacion_evidencia_fotos
  for delete to authenticated using (es_admin());

grant select on contrataciones               to authenticated;
grant select on contratacion_evidencias      to authenticated;
grant select on contratacion_evidencia_fotos to authenticated;

-- ---------------------------------------------------------------------------
-- Contacto visible a la contraparte con contratación vigente o completada
-- ---------------------------------------------------------------------------
drop policy if exists "contacto lectura" on perfil_contacto;

create policy "contacto lectura" on perfil_contacto
  for select to authenticated using (
    perfil_id = auth.uid()
    or es_admin()
    or exists (
      select 1 from contrataciones c
      where c.estado in ('en_curso', 'pendiente_confirmacion', 'completado')
        and (
          (c.cliente_id = auth.uid() and c.trabajador_id = perfil_contacto.perfil_id)
          or (c.trabajador_id = auth.uid() and c.cliente_id = perfil_contacto.perfil_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: evidencias de contratación
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('contratacion-evidencias', 'contratacion-evidencias', true)
on conflict (id) do nothing;

create policy "contratacion evidencias lectura" on storage.objects
  for select using (bucket_id = 'contratacion-evidencias');
create policy "contratacion evidencias alta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'contratacion-evidencias'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "contratacion evidencias borrado" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'contratacion-evidencias'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
