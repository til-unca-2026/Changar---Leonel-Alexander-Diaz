-- =============================================================================
-- ChangAr · Permisos de ejecución de las RPCs de invitación
--
-- Los default privileges de Supabase otorgan EXECUTE a `anon` y `authenticated`
-- sobre toda función nueva del esquema `public`:
--
--   {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,...}
--
-- Por eso un `revoke execute ... from public` no alcanza: esos son grants
-- directos a los roles y sobreviven al revoke de PUBLIC. Hay que revocar
-- explícitamente a `anon`.
--
-- Las tres RPCs de administración quedan restringidas a `authenticated`
-- (además de validar `es_superadmin()` adentro). La consulta por token sigue
-- disponible para `anon`: el formulario de registro corre sin sesión.
--
-- Nota: no se aplica este revoke a las funciones ya existentes del proyecto
-- porque varias se invocan desde políticas de RLS (`es_admin()`), donde el rol
-- que evalúa la política puede ser `anon`. Esas dependen del chequeo interno.
-- =============================================================================

revoke execute on function public.admin_crear_invitacion(text, text, text) from anon;
revoke execute on function public.admin_listar_invitaciones() from anon;
revoke execute on function public.admin_cancelar_invitacion(uuid) from anon;

revoke execute on function public.invitacion_por_token(uuid) from public;
grant execute on function public.invitacion_por_token(uuid) to anon, authenticated;
