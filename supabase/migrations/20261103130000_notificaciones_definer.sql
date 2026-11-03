-- =============================================================================
-- ChangAr · Fix: triggers de notificación como security definer
-- =============================================================================

create or replace function public.tg_notificar_propuesta()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cliente uuid;
begin
  if TG_OP = 'INSERT' then
    select cliente_id into v_cliente from solicitudes where id = new.solicitud_id;
    if v_cliente is not null and v_cliente <> new.trabajador_id then
      perform public.notificar(v_cliente, 'nueva_propuesta', new.solicitud_id);
    end if;
  elsif TG_OP = 'UPDATE' and new.estado is distinct from old.estado then
    if new.estado = 'aceptada' then
      perform public.notificar(new.trabajador_id, 'propuesta_aceptada', new.solicitud_id);
    elsif new.estado = 'rechazada' then
      perform public.notificar(new.trabajador_id, 'propuesta_rechazada', new.solicitud_id);
    end if;
  end if;
  return new;
end $$;

create or replace function public.tg_notificar_contratacion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    perform public.notificar(new.cliente_id, 'contratacion_creada', new.id);
    perform public.notificar(new.trabajador_id, 'contratacion_creada', new.id);
    return new;
  end if;

  if new.estado is distinct from old.estado then
    case new.estado
      when 'pendiente_confirmacion' then
        perform public.notificar(new.cliente_id, 'contratacion_pendiente_confirmacion', new.id);
        perform public.notificar(new.trabajador_id, 'contratacion_pendiente_confirmacion', new.id);
      when 'completado' then
        perform public.notificar(new.cliente_id, 'contratacion_completada', new.id);
        perform public.notificar(new.trabajador_id, 'contratacion_completada', new.id);
      when 'cancelado' then
        perform public.notificar(new.cliente_id, 'contratacion_cancelada', new.id);
        perform public.notificar(new.trabajador_id, 'contratacion_cancelada', new.id);
      when 'reportado' then
        perform public.notificar(new.cliente_id, 'contratacion_reportada', new.id);
        perform public.notificar(new.trabajador_id, 'contratacion_reportada', new.id);
        insert into notificaciones (usuario_id, tipo, referencia_id)
        select id, 'contrato_reportado', new.id from perfiles where rol = 'admin';
      else null;
    end case;
  end if;

  if new.resuelto_por is not null and old.resuelto_por is null then
    perform public.notificar(new.cliente_id, 'contratacion_resuelta', new.id);
    perform public.notificar(new.trabajador_id, 'contratacion_resuelta', new.id);
  end if;

  return new;
end $$;

create or replace function public.tg_notificar_valoracion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.notificar(new.destinatario_id, 'nueva_valoracion', new.contratacion_id);
  return new;
end $$;

create or replace function public.tg_notificar_oficio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP = 'INSERT' then
    if new.estado = 'pendiente' then
      insert into notificaciones (usuario_id, tipo, referencia_id)
      select id, 'oficio_pendiente', new.id from perfiles where rol = 'admin';
    end if;
  elsif TG_OP = 'UPDATE' and new.estado is distinct from old.estado and new.creado_por is not null then
    if new.estado = 'activo' then
      perform public.notificar(new.creado_por, 'oficio_aprobado', new.id);
    elsif new.estado = 'inactivo' then
      perform public.notificar(new.creado_por, 'oficio_rechazado', new.id);
    end if;
  end if;
  return new;
end $$;

create or replace function public.tg_notificar_reporte()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notificaciones (usuario_id, tipo, referencia_id)
  select id, 'reporte_nuevo', new.id from perfiles where rol = 'admin';
  return new;
end $$;

create or replace function public.tg_notificar_sancion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.activo = false and old.activo = true then
    perform public.notificar(new.id, 'cuenta_bloqueada', null);
  end if;
  if new.baneado_hasta is not null
     and (old.baneado_hasta is null or old.baneado_hasta < now()) then
    perform public.notificar(new.id, 'cuenta_suspendida', null);
  end if;
  return new;
end $$;
