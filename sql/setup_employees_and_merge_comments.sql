-- =============================================================
-- 1. FIX BROKEN handle_new_user TRIGGER
--    (Old trigger tried to insert into public.users which no
--     longer exists; app now uses public.profiles)
-- =============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, full_name, role, created_at)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'pending',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =============================================================
-- 2. MERGE comments_2 + comments_3 INTO details
--    (Combines the three comment columns into one field)
-- =============================================================
UPDATE public.properties
SET
  details = TRIM(
    CONCAT_WS(
      E'\n',
      NULLIF(TRIM(COALESCE(details, last_comment, '')), ''),
      NULLIF(TRIM(COALESCE(comments_2, '')), ''),
      NULLIF(TRIM(COALESCE(comments_3, '')), '')
    )
  ),
  comments_2 = '',
  comments_3 = ''
WHERE
  (comments_2 IS NOT NULL AND TRIM(comments_2) != '')
  OR (comments_3 IS NOT NULL AND TRIM(comments_3) != '');

-- =============================================================
-- 3. CREATE EMPLOYEE ACCOUNTS
--    Company: شركة مصادقة العقارية (f9439b9d-8e44-4f8a-af31-c02d04a6f9d3)
--
--    Login credentials (username = phone number):
--      ابوسارة  → 97335844  / password: Sara#7842
--      ابوحفني  → 66038736  / password: Hafni#3619
--      ابوفارس  → 97335771  / password: Faris#2085
--      مروة    → 66899136  / password: Marwa#5463
-- =============================================================
DO $$
DECLARE
  v_emp1_id uuid;
  v_emp2_id uuid;
  v_emp3_id uuid;
  v_emp4_id uuid;
  v_company_id uuid := 'f9439b9d-8e44-4f8a-af31-c02d04a6f9d3';
BEGIN

  -- Generate UUIDs
  v_emp1_id := gen_random_uuid();
  v_emp2_id := gen_random_uuid();
  v_emp3_id := gen_random_uuid();
  v_emp4_id := gen_random_uuid();

  -- Create auth users
  INSERT INTO auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_user_meta_data, raw_app_meta_data,
    is_super_admin, is_sso_user
  ) VALUES
    ('00000000-0000-0000-0000-000000000000', v_emp1_id, 'authenticated', 'authenticated',
     '97335844@realestate.com', crypt('Sara#7842', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"full_name":"ابوسارة"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, false),
    ('00000000-0000-0000-0000-000000000000', v_emp2_id, 'authenticated', 'authenticated',
     '66038736@realestate.com', crypt('Hafni#3619', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"full_name":"ابوحفني"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, false),
    ('00000000-0000-0000-0000-000000000000', v_emp3_id, 'authenticated', 'authenticated',
     '97335771@realestate.com', crypt('Faris#2085', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"full_name":"ابوفارس"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, false),
    ('00000000-0000-0000-0000-000000000000', v_emp4_id, 'authenticated', 'authenticated',
     '66899136@realestate.com', crypt('Marwa#5463', gen_salt('bf')), NOW(), NOW(), NOW(),
     '{"full_name":"مروة"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, false)
  ON CONFLICT (email) DO NOTHING;

  -- Re-fetch IDs in case they already existed
  SELECT id INTO v_emp1_id FROM auth.users WHERE email = '97335844@realestate.com';
  SELECT id INTO v_emp2_id FROM auth.users WHERE email = '66038736@realestate.com';
  SELECT id INTO v_emp3_id FROM auth.users WHERE email = '97335771@realestate.com';
  SELECT id INTO v_emp4_id FROM auth.users WHERE email = '66899136@realestate.com';

  -- Create auth identities (required for email+password login)
  INSERT INTO auth.identities (
    id, user_id, identity_data, provider, provider_id,
    last_sign_in_at, created_at, updated_at
  ) VALUES
    (gen_random_uuid(), v_emp1_id,
     jsonb_build_object('sub', v_emp1_id::text, 'email', '97335844@realestate.com'),
     'email', '97335844@realestate.com', NOW(), NOW(), NOW()),
    (gen_random_uuid(), v_emp2_id,
     jsonb_build_object('sub', v_emp2_id::text, 'email', '66038736@realestate.com'),
     'email', '66038736@realestate.com', NOW(), NOW(), NOW()),
    (gen_random_uuid(), v_emp3_id,
     jsonb_build_object('sub', v_emp3_id::text, 'email', '97335771@realestate.com'),
     'email', '97335771@realestate.com', NOW(), NOW(), NOW()),
    (gen_random_uuid(), v_emp4_id,
     jsonb_build_object('sub', v_emp4_id::text, 'email', '66899136@realestate.com'),
     'email', '66899136@realestate.com', NOW(), NOW(), NOW())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  -- Create profiles
  INSERT INTO public.profiles (
    id, email, name, full_name, phone, role,
    company_id, created_at, force_sign_out, is_deleted
  ) VALUES
    (v_emp1_id, '97335844@realestate.com', 'ابوسارة', 'ابوسارة', '97335844',
     'employee', v_company_id, NOW(), false, false),
    (v_emp2_id, '66038736@realestate.com', 'ابوحفني', 'ابوحفني', '66038736',
     'employee', v_company_id, NOW(), false, false),
    (v_emp3_id, '97335771@realestate.com', 'ابوفارس', 'ابوفارس', '97335771',
     'employee', v_company_id, NOW(), false, false),
    (v_emp4_id, '66899136@realestate.com', 'مروة', 'مروة', '66899136',
     'employee', v_company_id, NOW(), false, false)
  ON CONFLICT (id) DO UPDATE SET
    name        = EXCLUDED.name,
    full_name   = EXCLUDED.full_name,
    phone       = EXCLUDED.phone,
    role        = EXCLUDED.role,
    company_id  = EXCLUDED.company_id;

  RAISE NOTICE '=== Done! ===';
  RAISE NOTICE 'ابوسارة  id=%', v_emp1_id;
  RAISE NOTICE 'ابوحفني  id=%', v_emp2_id;
  RAISE NOTICE 'ابوفارس  id=%', v_emp3_id;
  RAISE NOTICE 'مروة     id=%', v_emp4_id;

END $$;
