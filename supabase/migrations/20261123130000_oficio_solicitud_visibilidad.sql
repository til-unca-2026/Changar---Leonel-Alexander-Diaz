-- =============================================================================
-- ChangAr · Visibilidad de un oficio usado en una solicitud
--
-- Un cliente puede crear un oficio nuevo desde el formulario de solicitud
-- (queda 'pendiente' hasta que un admin lo apruebe). La lectura estaba
-- limitada a activos + pendientes propios, por lo que el embed
-- `oficios(nombre)` de la solicitud devolvía vacío para los demás
-- participantes. Ahora también se puede leer el oficio de cualquier
-- solicitud que el usuario pueda ver (la RLS de `solicitudes` decide eso).
-- =============================================================================

drop policy if exists "oficios lectura" on oficios;

create policy "oficios lectura" on oficios
  for select to authenticated using (
    estado = 'activo'
    or es_admin()
    or (estado = 'pendiente' and creado_por = auth.uid())
    or exists (
      select 1
      from solicitudes s
      where s.oficio_id = oficios.id
    )
  );
