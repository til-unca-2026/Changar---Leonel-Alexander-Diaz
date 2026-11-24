-- =============================================================================
-- ChangAr · Subáreas (especialidades) de oficios
-- Cada subárea pertenece a un oficio. El trabajador la propone (pendiente),
-- el admin la aprueba/corrige. El trabajador solo puede asociarse a subáreas
-- de oficios que ya declaró. Opcional: no cambia la completitud del perfil.
-- =============================================================================

create table public.oficio_subareas (
  id                 uuid        primary key default gen_random_uuid(),
  oficio_id          uuid        not null references oficios(id) on delete cascade,
  nombre             text        not null,
  nombre_normalizado text,
  estado             estado_oficio not null default 'pendiente',
  creado_por         uuid        references perfiles(id),
  created_at         timestamptz not null default now()
);

-- Mismo nombre dentro de un oficio no se repite; entre oficios, sí puede.
create unique index oficio_subareas_oficio_nombre_idx
  on oficio_subareas (oficio_id, nombre_normalizado);
create index oficio_subareas_estado_idx on oficio_subareas (estado);
create index oficio_subareas_oficio_idx on oficio_subareas (oficio_id);

create table public.trabajador_subareas (
  trabajador_id uuid not null references perfiles(id) on delete cascade,
  subarea_id    uuid not null references oficio_subareas(id) on delete cascade,
  primary key (trabajador_id, subarea_id)
);
create index trabajador_subareas_subarea_idx on trabajador_subareas (subarea_id);

-- Reutiliza el trigger de normalización de oficios (setea nombre_normalizado).
create trigger tr_normalizar_subarea
  before insert or update of nombre on oficio_subareas
  for each row execute function public.tg_normalizar_oficio();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.oficio_subareas     enable row level security;
alter table public.trabajador_subareas enable row level security;

-- Activas para todos; pendientes/propias solo para quien la creó y admins.
create policy "subareas lectura" on oficio_subareas
  for select to authenticated using (
    estado = 'activo'
    or es_admin()
    or (estado = 'pendiente' and creado_por = auth.uid())
  );

create policy "ts lectura" on trabajador_subareas
  for select to authenticated using (true);

create policy "ts escritura propia" on trabajador_subareas
  for all to authenticated
  using (trabajador_id = auth.uid())
  with check (trabajador_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Integridad: el trabajador solo puede declarar subáreas de sus oficios activos
-- ---------------------------------------------------------------------------
create or replace function public.tg_validar_subarea_trabajador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
      from trabajador_oficios t
      join oficios o on o.id = t.oficio_id and o.estado = 'activo'
      join oficio_subareas s on s.oficio_id = t.oficio_id and s.estado = 'activo'
     where t.trabajador_id = new.trabajador_id
       and s.id = new.subarea_id
  ) then
    raise exception 'subarea_no_disponible';
  end if;
  return new;
end $$;

create trigger tr_validar_subarea_trabajador
  before insert or update on trabajador_subareas
  for each row execute function public.tg_validar_subarea_trabajador();

-- Al quitar un oficio, se limpian sus subáreas de ese trabajador.
create or replace function public.tg_limpiar_subareas_oficio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from trabajador_subareas ts
   where ts.trabajador_id = old.trabajador_id
     and ts.subarea_id in (
       select id from oficio_subareas where oficio_id = old.oficio_id
     );
  return old;
end $$;

create trigger tr_limpiar_subareas_oficio
  after delete on trabajador_oficios
  for each row execute function public.tg_limpiar_subareas_oficio();

-- ---------------------------------------------------------------------------
-- RPC: el trabajador/cliente propone una subárea nueva (pendiente)
-- ---------------------------------------------------------------------------
create or replace function public.crear_subarea(p_oficio_id uuid, p_nombre text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id      uuid;
  v_norm    text;
  v_estado  estado_oficio;
  v_nombre  text;
begin
  if p_nombre is null or btrim(p_nombre) = '' then
    raise exception 'nombre_vacio';
  end if;

  if not exists (select 1 from oficios where id = p_oficio_id and estado = 'activo') then
    raise exception 'oficio_no_permitido';
  end if;

  v_norm := public.normalizar_oficio(p_nombre);

  select id, estado into v_id, v_estado
    from oficio_subareas
   where oficio_id = p_oficio_id and nombre_normalizado = v_norm;

  if found then
    if v_estado = 'inactivo' then
      raise exception 'subarea_no_permitida';
    end if;
    return v_id;
  end if;

  v_nombre := btrim(p_nombre);
  v_nombre := upper(left(v_nombre, 1)) || lower(substr(v_nombre, 2));

  insert into oficio_subareas (oficio_id, nombre, estado, creado_por)
  values (p_oficio_id, v_nombre, 'pendiente', auth.uid())
  returning id into v_id;

  return v_id;
end $$;

grant execute on function public.crear_subarea(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs de moderación admin
-- ---------------------------------------------------------------------------
create or replace function public.admin_aprobar_subarea(
  p_subarea_id uuid,
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

  update oficio_subareas
     set estado = case when p_aprobar then 'activo'::estado_oficio
                                    else 'inactivo'::estado_oficio end
   where id = p_subarea_id;

  if not found then
    raise exception 'subarea_no_encontrado';
  end if;
end $$;

create or replace function public.admin_renombrar_subarea(
  p_subarea_id uuid,
  p_nombre text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_oficio uuid;
  v_nombre text;
begin
  if not es_admin() then
    raise exception 'sin_permiso';
  end if;

  v_nombre := btrim(coalesce(p_nombre, ''));
  if v_nombre = '' then
    raise exception 'nombre_vacio';
  end if;

  select oficio_id into v_oficio from oficio_subareas where id = p_subarea_id;
  if not found then
    raise exception 'subarea_no_encontrado';
  end if;

  if exists (
    select 1 from oficio_subareas
     where oficio_id = v_oficio
       and nombre_normalizado = public.normalizar_oficio(v_nombre)
       and id <> p_subarea_id
  ) then
    raise exception 'subarea_duplicada';
  end if;

  update oficio_subareas set nombre = v_nombre where id = p_subarea_id;
end $$;

grant execute on function public.admin_aprobar_subarea(uuid, boolean) to authenticated;
grant execute on function public.admin_renombrar_subarea(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Notificaciones (análogo a oficios)
-- ---------------------------------------------------------------------------
create or replace function public.tg_notificar_subarea()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.estado = 'pendiente' then
      insert into notificaciones (usuario_id, tipo, referencia_id)
      select id, 'subarea_pendiente', new.id from perfiles where rol = 'admin';
    end if;
  elsif TG_OP = 'UPDATE'
    and new.estado is distinct from old.estado
    and new.creado_por is not null
  then
    if new.estado = 'activo' then
      perform public.notificar(new.creado_por, 'subarea_aprobada', new.id);
    elsif new.estado = 'inactivo' then
      perform public.notificar(new.creado_por, 'subarea_rechazada', new.id);
    end if;
  end if;
  return new;
end $$;

create trigger tr_notificar_subarea
  after insert or update of estado on oficio_subareas
  for each row execute function public.tg_notificar_subarea();

-- ---------------------------------------------------------------------------
-- Auditoría: mismas tablas entran en tg_auditar()
-- ---------------------------------------------------------------------------
create trigger tr_auditar_oficio_subareas
  after insert or update or delete on oficio_subareas
  for each row execute function public.tg_auditar();

create trigger tr_auditar_trabajador_subareas
  after insert or update or delete on trabajador_subareas
  for each row execute function public.tg_auditar();
