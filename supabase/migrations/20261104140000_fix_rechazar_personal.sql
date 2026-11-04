-- =============================================================================
-- ChangAr · Fix: rechazar_solicitud_personal usaba una variable inexistente
-- =============================================================================

create or replace function public.rechazar_solicitud_personal(p_solicitud_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol solicitudes;
begin
  select * into v_sol from solicitudes where id = p_solicitud_id for update;
  if not found then
    raise exception 'solicitud_no_encontrada';
  end if;
  if v_sol.trabajador_destino_id is null then
    raise exception 'no_es_solicitud_personal';
  end if;
  if v_sol.trabajador_destino_id <> auth.uid() then
    raise exception 'sin_permiso';
  end if;
  if v_sol.estado <> 'abierta' then
    raise exception 'solicitud_no_abierta';
  end if;

  update solicitudes set estado = 'rechazada' where id = v_sol.id;

  perform public.notificar(v_sol.cliente_id, 'solicitud_rechazada', p_solicitud_id);
end $$;
