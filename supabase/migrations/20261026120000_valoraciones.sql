-- =============================================================================
-- ChangAr · Valoraciones y reputación
-- Valoración mutua al completar una contratación, reputación y distribución.
-- =============================================================================

create table valoraciones (
  id              uuid primary key default gen_random_uuid(),
  contratacion_id uuid not null references contrataciones(id) on delete cascade,
  autor_id        uuid not null references perfiles(id) on delete cascade,
  destinatario_id uuid not null references perfiles(id) on delete cascade,
  puntuacion      integer not null check (puntuacion between 1 and 5),
  comentario      text,
  created_at      timestamptz not null default now(),
  unique (contratacion_id, autor_id),
  check (autor_id <> destinatario_id)
);

create index valoraciones_destinatario_idx on valoraciones (destinatario_id);

create table valoracion_fotos (
  id           uuid primary key default gen_random_uuid(),
  valoracion_id uuid not null references valoraciones(id) on delete cascade,
  storage_path text not null
);

-- ---------------------------------------------------------------------------
-- RPC: enviar valoración (solo participantes de una contratación completada)
-- ---------------------------------------------------------------------------
create or replace function public.enviar_valoracion(
  p_contratacion_id uuid,
  p_puntuacion integer,
  p_comentario text,
  p_fotos text[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c contrataciones;
  v_id uuid;
  v_dest uuid;
begin
  if p_puntuacion is null or p_puntuacion not between 1 and 5 then
    raise exception 'puntuacion_invalida';
  end if;

  select * into c from contrataciones where id = p_contratacion_id for update;
  if not found then
    raise exception 'contratacion_no_encontrada';
  end if;
  if c.estado <> 'completado' then
    raise exception 'contratacion_no_completada';
  end if;
  if auth.uid() not in (c.cliente_id, c.trabajador_id) then
    raise exception 'sin_permiso';
  end if;

  v_dest := case when auth.uid() = c.cliente_id then c.trabajador_id else c.cliente_id end;

  insert into valoraciones (contratacion_id, autor_id, destinatario_id, puntuacion, comentario)
  values (c.id, auth.uid(), v_dest, p_puntuacion, p_comentario)
  on conflict (contratacion_id, autor_id) do nothing
  returning id into v_id;

  if v_id is null then
    raise exception 'valoracion_duplicada';
  end if;

  if p_fotos is not null and array_length(p_fotos, 1) > 0 then
    insert into valoracion_fotos (valoracion_id, storage_path)
    select v_id, unnest(p_fotos);
  end if;

  return v_id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: reputación pública de un perfil
-- ---------------------------------------------------------------------------
create or replace function public.reputacion_de(p_perfil_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*),
    'promedio', coalesce(round(avg(puntuacion)::numeric, 1), 0),
    'bajas', count(*) filter (where puntuacion <= 2),
    'distribucion', jsonb_build_object(
      '1', count(*) filter (where puntuacion = 1),
      '2', count(*) filter (where puntuacion = 2),
      '3', count(*) filter (where puntuacion = 3),
      '4', count(*) filter (where puntuacion = 4),
      '5', count(*) filter (where puntuacion = 5)
    )
  )
  from valoraciones
  where destinatario_id = p_perfil_id;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table valoraciones      enable row level security;
alter table valoracion_fotos  enable row level security;

create policy "valoraciones lectura" on valoraciones
  for select to authenticated using (true);
create policy "valoraciones borrado admin" on valoraciones
  for delete to authenticated using (es_admin());

create policy "vf lectura" on valoracion_fotos
  for select to authenticated using (true);
create policy "vf borrado admin" on valoracion_fotos
  for delete to authenticated using (es_admin());

grant select on valoraciones      to authenticated;
grant select on valoracion_fotos  to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: fotos de valoraciones
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('valoracion-fotos', 'valoracion-fotos', true)
on conflict (id) do nothing;

create policy "valoracion fotos lectura" on storage.objects
  for select using (bucket_id = 'valoracion-fotos');
create policy "valoracion fotos alta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'valoracion-fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "valoracion fotos borrado" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'valoracion-fotos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
