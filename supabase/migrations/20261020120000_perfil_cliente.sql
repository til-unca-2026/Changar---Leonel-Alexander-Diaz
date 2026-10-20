-- =============================================================================
-- ChangAr · Perfil del cliente
-- Agrega los datos propios del cliente: zona (no dirección) y descripción.
-- =============================================================================

create table perfiles_cliente (
  id          uuid primary key references perfiles(id) on delete cascade,
  zona        text,
  descripcion text
);

alter table perfiles_cliente enable row level security;

create policy "pc lectura" on perfiles_cliente
  for select to authenticated using (true);
create policy "pc alta propia" on perfiles_cliente
  for insert to authenticated with check (id = auth.uid());
create policy "pc edicion propia" on perfiles_cliente
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "pc borrado admin" on perfiles_cliente
  for delete to authenticated using (es_admin());

grant select, insert, update, delete on perfiles_cliente to authenticated;
