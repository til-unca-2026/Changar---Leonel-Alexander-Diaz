-- =============================================================================
-- ChangAr · Conteo público de postulantes de una solicitud
-- =============================================================================

create or replace function public.postulantes_de(p_solicitud_id uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int from propuestas where solicitud_id = p_solicitud_id;
$$;
