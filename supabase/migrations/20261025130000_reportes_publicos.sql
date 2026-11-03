-- =============================================================================
-- ChangAr · Etapa B: antecedentes públicos de contratos reportados
-- Funciones de consulta pública para perfiles y advertencias.
-- =============================================================================

-- Cantidad de contratos reportados donde participa el perfil (advertencia "!").
create or replace function public.reportados_de(p_perfil_id uuid)
returns int
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::int
  from contrataciones
  where estado = 'reportado'
    and (cliente_id = p_perfil_id or trabajador_id = p_perfil_id);
$$;

-- Expediente público: contratos reportados de un perfil, con reporte y descargo.
create or replace function public.reportes_de(p_perfil_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_result jsonb;
begin
  select coalesce(jsonb_agg(item), '[]'::jsonb) into v_result
  from (
    select jsonb_build_object(
      'contratacion_id', c.id,
      'oficio', o.nombre,
      'solicitud_titulo', s.titulo,
      'contraparte_nombre', cp.nombre,
      'contraparte_apellido', cp.apellido,
      'contraparte_avatar', cp.avatar_path,
      'created_at', c.created_at,
      'reporte', (
        select jsonb_build_object(
          'comentario', e.comentario,
          'fotos', coalesce(
            (select jsonb_agg(f.storage_path)
               from contratacion_evidencia_fotos f
              where f.evidencia_id = e.id),
            '[]'::jsonb
          )
        )
        from contratacion_evidencias e
        where e.contratacion_id = c.id and e.tipo = 'reporte'
        limit 1
      ),
      'descargo', (
        select jsonb_build_object(
          'comentario', e2.comentario,
          'fotos', coalesce(
            (select jsonb_agg(f2.storage_path)
               from contratacion_evidencia_fotos f2
              where f2.evidencia_id = e2.id),
            '[]'::jsonb
          )
        )
        from contratacion_evidencias e2
        where e2.contratacion_id = c.id and e2.tipo = 'descargo'
        limit 1
      )
    ) as item
    from contrataciones c
    join propuestas p on p.id = c.propuesta_id
    join solicitudes s on s.id = p.solicitud_id
    join oficios o on o.id = s.oficio_id
    join perfiles cp on cp.id = case
      when c.cliente_id = p_perfil_id then c.trabajador_id
      else c.cliente_id
    end
    where c.estado = 'reportado'
      and (c.cliente_id = p_perfil_id or c.trabajador_id = p_perfil_id)
    order by c.created_at desc
  ) t;

  return v_result;
end $$;
