-- =============================================================================
-- ChangAr · Solicitudes y propuestas
-- Migra las solicitudes del cliente a Supabase y habilita la postulación del
-- trabajador con la RPC `enviar_propuesta`.
-- =============================================================================

create type estado_solicitud as enum ('abierta', 'asignada', 'cerrada', 'cancelada');
create type estado_propuesta as enum ('enviada', 'aceptada', 'rechazada', 'retirada');

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------
create table solicitudes (
  id             uuid primary key default gen_random_uuid(),
  cliente_id     uuid not null references perfiles(id) on delete cascade,
  oficio_id      uuid not null references oficios(id),
  titulo         text not null,
  descripcion    text not null,
  ubicacion      text not null,
  presupuesto_max numeric(12,2),
  estado         estado_solicitud not null default 'abierta',
  created_at     timestamptz not null default now()
);

create index solicitudes_oficio_estado_idx on solicitudes (oficio_id, estado, created_at desc);
create index solicitudes_cliente_idx on solicitudes (cliente_id);

create table solicitud_fotos (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references solicitudes(id) on delete cascade,
  storage_path text not null
);

create index solicitud_fotos_solicitud_idx on solicitud_fotos (solicitud_id);

create table propuestas (
  id            uuid primary key default gen_random_uuid(),
  solicitud_id  uuid not null references solicitudes(id) on delete cascade,
  trabajador_id uuid not null references perfiles(id) on delete cascade,
  descripcion   text not null,
  presupuesto   numeric(12,2) not null,
  estado        estado_propuesta not null default 'enviada',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (solicitud_id, trabajador_id)
);

create index propuestas_solicitud_idx on propuestas (solicitud_id);
create index propuestas_trabajador_idx on propuestas (trabajador_id);

-- ---------------------------------------------------------------------------
-- RPC: enviar propuesta (valida estado y perfil completo)
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

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table solicitudes     enable row level security;
alter table solicitud_fotos enable row level security;
alter table propuestas      enable row level security;

-- solicitudes
create policy "solicitudes lectura" on solicitudes
  for select to authenticated using (true);
create policy "solicitudes alta cliente" on solicitudes
  for insert to authenticated with check (cliente_id = auth.uid());
create policy "solicitudes edicion duenio" on solicitudes
  for update to authenticated using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());
create policy "solicitudes borrado duenio o admin" on solicitudes
  for delete to authenticated using (cliente_id = auth.uid() or es_admin());

-- solicitud_fotos
create policy "sf lectura" on solicitud_fotos
  for select to authenticated using (true);
create policy "sf alta duenio" on solicitud_fotos
  for insert to authenticated with check (
    exists (select 1 from solicitudes s where s.id = solicitud_id and s.cliente_id = auth.uid())
  );
create policy "sf borrado duenio o admin" on solicitud_fotos
  for delete to authenticated using (
    exists (select 1 from solicitudes s where s.id = solicitud_id and s.cliente_id = auth.uid())
    or es_admin()
  );

-- propuestas: lectura para el autor y el dueño de la solicitud.
-- La escritura se hace solo por RPC (security definer).
create policy "propuestas lectura participantes" on propuestas
  for select to authenticated using (
    trabajador_id = auth.uid()
    or exists (select 1 from solicitudes s where s.id = solicitud_id and s.cliente_id = auth.uid())
    or es_admin()
  );
create policy "propuestas retiro autor" on propuestas
  for update to authenticated
  using (trabajador_id = auth.uid())
  with check (trabajador_id = auth.uid());

grant select, insert, update, delete on solicitudes     to authenticated;
grant select, insert, delete         on solicitud_fotos to authenticated;
grant select, update                 on propuestas      to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: fotos de solicitudes
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('solicitud-fotos', 'solicitud-fotos', true)
on conflict (id) do nothing;

create policy "solicitud fotos lectura" on storage.objects
  for select using (bucket_id = 'solicitud-fotos');
create policy "solicitud fotos alta" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'solicitud-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "solicitud fotos borrado" on storage.objects
  for delete to authenticated
  using (bucket_id = 'solicitud-fotos' and (storage.foldername(name))[1] = auth.uid()::text);
