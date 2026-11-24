-- =============================================================================
-- ChangAr · Alta de usuario con invitación de administrador
--
-- Reemplaza el trigger de alta para que, si el registro trae un token de
-- invitación válido, el perfil nazca con rol 'admin'.
--
-- Reglas:
--   - El registro público nunca puede pedir un rol de administración: el rol
--     del metadata se valida contra una lista cerrada y falla cerrado.
--   - La invitación se busca SOLO por token. El email no es un factor de
--     confianza (el proyecto no exige confirmar el email), así que jamás se
--     decide el rol por dirección de correo.
--   - El token es de un solo uso: al aceptarse la invitación queda en
--     'aceptada' y no se puede reutilizar.
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv      invitaciones_admin;
  v_token    uuid;
  v_rol      rol_usuario;
  v_nombre   text;
  v_apellido text;
  v_rol_txt  text;
  v_acepta   boolean := false;
begin
  -- El registro público no permite pedir un rol de administración.
  v_rol_txt := coalesce(new.raw_user_meta_data->>'rol', 'cliente');
  if v_rol_txt not in ('cliente', 'trabajador') then
    raise exception 'rol_no_permitido';
  end if;

  -- Token de invitación (si viene). Un token mal formado no es un error de
  -- registro: se ignora y la cuenta queda con el rol del metadata.
  begin
    v_token := (new.raw_user_meta_data->>'invitacion')::uuid;
  exception when others then
    v_token := null;
  end;

  if v_token is not null then
    select * into v_inv
      from invitaciones_admin
     where token = v_token
       and estado = 'pendiente'
       and (expira_at is null or expira_at > now())
     limit 1;
    v_acepta := found;
  end if;

  if v_acepta then
    v_rol      := 'admin';
    v_nombre   := coalesce(nullif(btrim(new.raw_user_meta_data->>'nombre'), ''), v_inv.nombre);
    v_apellido := coalesce(nullif(btrim(new.raw_user_meta_data->>'apellido'), ''), v_inv.apellido);
  else
    v_rol      := v_rol_txt::rol_usuario;
    v_nombre   := coalesce(new.raw_user_meta_data->>'nombre', '');
    v_apellido := coalesce(new.raw_user_meta_data->>'apellido', '');
  end if;

  insert into public.perfiles (id, nombre, apellido, email, rol)
  values (new.id, v_nombre, v_apellido, new.email, v_rol);

  if v_acepta then
    update invitaciones_admin set estado = 'aceptada' where id = v_inv.id;
  end if;

  if coalesce(new.raw_user_meta_data->>'telefono', '') <> '' then
    insert into public.perfil_contacto (perfil_id, telefono)
    values (new.id, new.raw_user_meta_data->>'telefono');
  end if;

  return new;
end $$;
