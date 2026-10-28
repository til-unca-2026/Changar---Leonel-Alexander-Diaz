-- =============================================================================
-- ChangAr · Reporte de contratos (antecedente público)
-- Agrega el estado `reportado` y las evidencias `reporte` y `descargo`.
-- El reporte deja un expediente; no lo arbitra el admin.
-- =============================================================================

alter type estado_contratacion add value 'reportado' after 'cancelado';
alter type tipo_evidencia add value 'reporte' after 'fin';
alter type tipo_evidencia add value 'descargo' after 'reporte';

-- ---------------------------------------------------------------------------
-- RPC: reportar contrato (desde pendiente_confirmacion)
-- ---------------------------------------------------------------------------
create or replace function public.reportar_contratacion(
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
  if c.estado <> 'pendiente_confirmacion' then
    raise exception 'estado_invalido';
  end if;

  if exists (
    select 1 from contratacion_evidencias e
    where e.contratacion_id = c.id and e.tipo = 'reporte'
  ) then
    raise exception 'reporte_ya_enviado';
  end if;

  insert into contratacion_evidencias (contratacion_id, autor_id, tipo, comentario)
  values (c.id, auth.uid(), 'reporte', p_comentario)
  returning id into v_evidencia;

  if p_fotos is not null and array_length(p_fotos, 1) > 0 then
    insert into contratacion_evidencia_fotos (evidencia_id, storage_path)
    select v_evidencia, unnest(p_fotos);
  end if;

  update contrataciones set estado = 'reportado', updated_at = now()
   where id = c.id;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: presentar descargo (la contraparte, una sola vez)
-- ---------------------------------------------------------------------------
create or replace function public.agregar_descargo(
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
  if c.estado <> 'reportado' then
    raise exception 'estado_invalido';
  end if;

  -- El que reportó ya se explayó en el reporte.
  if exists (
    select 1 from contratacion_evidencias e
    where e.contratacion_id = c.id and e.tipo = 'reporte' and e.autor_id = auth.uid()
  ) then
    raise exception 'reportante_sin_descargo';
  end if;

  if exists (
    select 1 from contratacion_evidencias e
    where e.contratacion_id = c.id and e.tipo = 'descargo'
  ) then
    raise exception 'descargo_ya_enviado';
  end if;

  insert into contratacion_evidencias (contratacion_id, autor_id, tipo, comentario)
  values (c.id, auth.uid(), 'descargo', p_comentario)
  returning id into v_evidencia;

  if p_fotos is not null and array_length(p_fotos, 1) > 0 then
    insert into contratacion_evidencia_fotos (evidencia_id, storage_path)
    select v_evidencia, unnest(p_fotos);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- La cancelación queda restringida a `en_curso`
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
  if c.estado <> 'en_curso' then
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
-- La respuesta queda restringida a contrataciones canceladas
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
  if c.estado <> 'cancelado' then
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
