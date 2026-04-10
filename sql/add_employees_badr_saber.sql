-- إضافة موظفين جدد: ابوبدر وابوصابر
-- ابوبدر  → 97335811 / 7419
-- ابوصابر → 97335779 / 8526

DO $$
DECLARE
  v1 uuid; v2 uuid;
  cid uuid := 'f9439b9d-8e44-4f8a-af31-c02d04a6f9d3';
BEGIN
  v1 := gen_random_uuid();
  v2 := gen_random_uuid();

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = '97335811@realestate.com') THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_user_meta_data,raw_app_meta_data,is_super_admin,is_sso_user)
    VALUES ('00000000-0000-0000-0000-000000000000',v1,'authenticated','authenticated','97335811@realestate.com',crypt('7419',gen_salt('bf')),NOW(),NOW(),NOW(),'{"full_name":"ابوبدر"}'::jsonb,'{"provider":"email","providers":["email"]}'::jsonb,false,false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = '97335779@realestate.com') THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_user_meta_data,raw_app_meta_data,is_super_admin,is_sso_user)
    VALUES ('00000000-0000-0000-0000-000000000000',v2,'authenticated','authenticated','97335779@realestate.com',crypt('8526',gen_salt('bf')),NOW(),NOW(),NOW(),'{"full_name":"ابوصابر"}'::jsonb,'{"provider":"email","providers":["email"]}'::jsonb,false,false);
  END IF;

  SELECT id INTO v1 FROM auth.users WHERE email = '97335811@realestate.com';
  SELECT id INTO v2 FROM auth.users WHERE email = '97335779@realestate.com';

  INSERT INTO auth.identities (id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
  SELECT gen_random_uuid(),v1,jsonb_build_object('sub',v1::text,'email','97335811@realestate.com'),'email','97335811@realestate.com',NOW(),NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider_id='97335811@realestate.com');

  INSERT INTO auth.identities (id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
  SELECT gen_random_uuid(),v2,jsonb_build_object('sub',v2::text,'email','97335779@realestate.com'),'email','97335779@realestate.com',NOW(),NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider_id='97335779@realestate.com');

  UPDATE auth.users SET
    confirmation_token='', recovery_token='', email_change_token_new='', email_change='', phone_change=''
  WHERE email IN ('97335811@realestate.com','97335779@realestate.com');

  INSERT INTO public.profiles (id,email,name,full_name,phone,role,company_id,created_at,force_sign_out,is_deleted) VALUES
    (v1,'97335811@realestate.com','ابوبدر','ابوبدر','97335811','employee',cid,NOW(),false,false),
    (v2,'97335779@realestate.com','ابوصابر','ابوصابر','97335779','employee',cid,NOW(),false,false)
  ON CONFLICT (id) DO UPDATE SET
    name=EXCLUDED.name, full_name=EXCLUDED.full_name,
    phone=EXCLUDED.phone, role=EXCLUDED.role, company_id=EXCLUDED.company_id;

  RAISE NOTICE '✅ Done! ابوبدر=% ابوصابر=%',v1,v2;
END $$;
