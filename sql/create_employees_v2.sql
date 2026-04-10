-- =============================================================
-- إنشاء حسابات الموظفين (نسخة v2 — بدون ON CONFLICT على auth.users)
-- =============================================================
DO $$
DECLARE
  v1 uuid; v2 uuid; v3 uuid; v4 uuid;
  cid uuid := 'f9439b9d-8e44-4f8a-af31-c02d04a6f9d3';
BEGIN
  -- توليد UUIDs جديدة
  v1 := gen_random_uuid();
  v2 := gen_random_uuid();
  v3 := gen_random_uuid();
  v4 := gen_random_uuid();

  -- إدراج في auth.users فقط إذا لم يوجد المستخدم مسبقاً
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = '97335844@realestate.com') THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_user_meta_data,raw_app_meta_data,is_super_admin,is_sso_user)
    VALUES ('00000000-0000-0000-0000-000000000000',v1,'authenticated','authenticated','97335844@realestate.com',crypt('3847',gen_salt('bf')),NOW(),NOW(),NOW(),'{"full_name":"ابوسارة"}'::jsonb,'{"provider":"email","providers":["email"]}'::jsonb,false,false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = '66038736@realestate.com') THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_user_meta_data,raw_app_meta_data,is_super_admin,is_sso_user)
    VALUES ('00000000-0000-0000-0000-000000000000',v2,'authenticated','authenticated','66038736@realestate.com',crypt('6192',gen_salt('bf')),NOW(),NOW(),NOW(),'{"full_name":"ابوحفني"}'::jsonb,'{"provider":"email","providers":["email"]}'::jsonb,false,false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = '97335771@realestate.com') THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_user_meta_data,raw_app_meta_data,is_super_admin,is_sso_user)
    VALUES ('00000000-0000-0000-0000-000000000000',v3,'authenticated','authenticated','97335771@realestate.com',crypt('5073',gen_salt('bf')),NOW(),NOW(),NOW(),'{"full_name":"ابوفارس"}'::jsonb,'{"provider":"email","providers":["email"]}'::jsonb,false,false);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = '66899136@realestate.com') THEN
    INSERT INTO auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at,raw_user_meta_data,raw_app_meta_data,is_super_admin,is_sso_user)
    VALUES ('00000000-0000-0000-0000-000000000000',v4,'authenticated','authenticated','66899136@realestate.com',crypt('2461',gen_salt('bf')),NOW(),NOW(),NOW(),'{"full_name":"مروة"}'::jsonb,'{"provider":"email","providers":["email"]}'::jsonb,false,false);
  END IF;

  -- إعادة تحميل IDs الفعلية (سواء تم إنشاؤها الآن أو كانت موجودة)
  SELECT id INTO v1 FROM auth.users WHERE email = '97335844@realestate.com';
  SELECT id INTO v2 FROM auth.users WHERE email = '66038736@realestate.com';
  SELECT id INTO v3 FROM auth.users WHERE email = '97335771@realestate.com';
  SELECT id INTO v4 FROM auth.users WHERE email = '66899136@realestate.com';

  -- إدراج auth.identities (للسماح بتسجيل الدخول بالبريد وكلمة المرور)
  INSERT INTO auth.identities (id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
  SELECT gen_random_uuid(), v1, jsonb_build_object('sub',v1::text,'email','97335844@realestate.com'), 'email','97335844@realestate.com',NOW(),NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider_id = '97335844@realestate.com');

  INSERT INTO auth.identities (id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
  SELECT gen_random_uuid(), v2, jsonb_build_object('sub',v2::text,'email','66038736@realestate.com'), 'email','66038736@realestate.com',NOW(),NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider_id = '66038736@realestate.com');

  INSERT INTO auth.identities (id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
  SELECT gen_random_uuid(), v3, jsonb_build_object('sub',v3::text,'email','97335771@realestate.com'), 'email','97335771@realestate.com',NOW(),NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider_id = '97335771@realestate.com');

  INSERT INTO auth.identities (id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
  SELECT gen_random_uuid(), v4, jsonb_build_object('sub',v4::text,'email','66899136@realestate.com'), 'email','66899136@realestate.com',NOW(),NOW(),NOW()
  WHERE NOT EXISTS (SELECT 1 FROM auth.identities WHERE provider_id = '66899136@realestate.com');

  -- إدراج/تحديث profiles
  INSERT INTO public.profiles (id,email,name,full_name,phone,role,company_id,created_at,force_sign_out,is_deleted) VALUES
    (v1,'97335844@realestate.com','ابوسارة','ابوسارة','97335844','employee',cid,NOW(),false,false),
    (v2,'66038736@realestate.com','ابوحفني','ابوحفني','66038736','employee',cid,NOW(),false,false),
    (v3,'97335771@realestate.com','ابوفارس','ابوفارس','97335771','employee',cid,NOW(),false,false),
    (v4,'66899136@realestate.com','مروة','مروة','66899136','employee',cid,NOW(),false,false)
  ON CONFLICT (id) DO UPDATE SET
    name       = EXCLUDED.name,
    full_name  = EXCLUDED.full_name,
    phone      = EXCLUDED.phone,
    role       = EXCLUDED.role,
    company_id = EXCLUDED.company_id;

  RAISE NOTICE '✅ Done!';
  RAISE NOTICE 'ابوسارة  id=%', v1;
  RAISE NOTICE 'ابوحفني  id=%', v2;
  RAISE NOTICE 'ابوفارس  id=%', v3;
  RAISE NOTICE 'مروة     id=%', v4;
END $$;
