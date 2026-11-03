-- =============================================================================
-- ChangAr · Menores: editar/retirar propuesta y cancelar solicitud
-- =============================================================================

create or replace function public.editar_propuesta(
  p_propuesta_id uuid,
  p_descripcion text,
  p_presupuesto numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v propuestas;
begin
  if p_descripcion is null or btrim(p_descripcion) = '' then
    raise exception 'descripcion_vacia';
  end if;
  if p_presupuesto is null or p_presupuesto <= 0 then
    raise exception 'presupuesto_invalido';
  end if;

  select * into v from propuestas where id = p_propuesta_id for update;
  if not found then
    raise exception 'propuesta_no_encontrada';
  end if;
  if v.trabajador_id <> auth.uid() then
    raise exception 'sin_permiso';
  end if;
  if v.estado <> 'enviada' then
    raise exception 'estado_invalido';
  end if;

  update propuestas
     set descripcion = btrim(p_descripcion),
         presupuesto = p_presupuesto,
         updated_at = now()
   where id = p_propuesta_id;
end $$;

create or replace function public.cancelar_solicitud(p_solicitud_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v solicitudes;
begin
  select * into v from solicitudes where id = p_solicitud_id for update;
  if not found then
    raise exception 'solicitud_no_encontrada';
  end if;
  if v.cliente_id <> auth.uid() then
    raise exception 'sin_permiso';
  end if;
  if v.estado <> 'abierta' then
    raise exception 'solicitud_no_abierta';
  end if;

  update solicitudes set estado = 'cancelada' where id = p_solicitud_id;
  update propuestas set estado = 'rechazada', updated_at = now()
   where solicitud_id = p_solicitud_id and estado = 'enviada';
end $$;
