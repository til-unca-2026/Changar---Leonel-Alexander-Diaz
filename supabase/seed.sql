-- =============================================================================
-- ChangAr · Seed local
--
-- `supabase/config.toml` declara `[db.seed] sql_paths = ["./seed.sql"]`: este
-- archivo se ejecuta después de las migraciones en cada `supabase db reset`.
--
--   - Repone el catálogo base de oficios (idempotente).
--   - Crea el usuario dueño local (`owner@changar.local` / `changar1234`) con la
--     marca de dueño de la app.
--
-- En el proyecto alojado el dueño se crea a mano (ver README): el registro
-- público nunca puede crear administradores.
-- =============================================================================

-- Catálogo base -------------------------------------------------------------
insert into oficios (nombre, estado)
values
  ('Plomería', 'activo'),
  ('Electricidad', 'activo'),
  ('Herrería', 'activo'),
  ('Albañilería', 'activo'),
  ('Carpintería', 'activo'),
  ('Pintura', 'activo'),
  ('Gas', 'activo'),
  ('Jardinería', 'activo'),
  ('Limpieza', 'activo')
on conflict (nombre_normalizado) do nothing;

-- Usuario dueño local ------------------------------------------------------
-- El alta se hace sobre `auth.users` porque el registro público rechaza los
-- roles de administración. Si algo no está disponible (pgcrypto, esquema auth
-- con otra forma), se avisa con un NOTICE y el seed no corta el reset.
do $$
declare
  v_ns   text;
  v_id   uuid;
begin
  select n.nspname into v_ns
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pgcrypto';

  if v_ns is null then
    raise notice 'pgcrypto no está disponible: se omite el usuario dueño local.';
    return;
  end if;

  if exists (select 1 from auth.users where email = 'owner@changar.local') then
    return;
  end if;

  v_id := gen_random_uuid();

  execute format(
    'insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
       email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     values (%L, %L, %L, %L, %L, %I.crypt(%L, %I.gen_salt(%L)), now(),
       %L::jsonb, %L::jsonb, now(), now())',
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    'owner@changar.local',
    v_ns, 'changar1234', v_ns, 'bf',
    '{"provider":"email","providers":["email"]}',
    '{"nombre":"Dueño","apellido":"ChangAr","telefono":""}'
  );

  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  )
  values (
    gen_random_uuid(), v_id, v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', 'owner@changar.local', 'email_verified', true),
    'email', now(), now(), now()
  );

  -- El trigger de alta ya creó el perfil con rol 'cliente': se promueve a dueño.
  update perfiles set rol = 'admin', es_superadmin = true where id = v_id;

  raise notice 'Usuario dueño local creado: owner@changar.local / changar1234';
exception when others then
  raise notice 'No se pudo crear el usuario dueño local: %', sqlerrm;
end $$;
