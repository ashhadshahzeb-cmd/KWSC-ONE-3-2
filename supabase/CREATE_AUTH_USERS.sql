-- ========================================================================
-- KWSC AUTH USERS CREATION (Supabase Auth & Login Setup)
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/znzvvqgpnpyxjiamatpa/sql
-- ========================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Helper function to create auth user safely
CREATE OR REPLACE FUNCTION create_kwsc_user(
  user_email TEXT,
  user_password TEXT,
  user_role TEXT,
  user_display_name TEXT
) RETURNS VOID AS $$
DECLARE
  new_user_id UUID := gen_random_uuid();
BEGIN
  -- Insert into auth.users if not exists
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = user_email) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      new_user_id,
      'authenticated',
      'authenticated',
      user_email,
      crypt(user_password, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      json_build_object('role_id', user_role, 'display_name', user_display_name)::jsonb,
      now(),
      now(),
      ''
    );

    -- Insert into auth.identities
    INSERT INTO auth.identities (
      id,
      user_id,
      identity_data,
      provider,
      provider_id,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      new_user_id,
      new_user_id,
      json_build_object('sub', new_user_id, 'email', user_email)::jsonb,
      'email',
      user_email,
      now(),
      now(),
      now()
    );
  ELSE
    -- If already exists, update password and metadata
    UPDATE auth.users
    SET 
      encrypted_password = crypt(user_password, gen_salt('bf')),
      raw_user_meta_data = json_build_object('role_id', user_role, 'display_name', user_display_name)::jsonb,
      updated_at = now()
    WHERE email = user_email;
  END IF;

  -- Upsert into department_users_settings
  INSERT INTO public.department_users_settings (
    email, password, role_id, display_name, allow_override_dates
  ) VALUES (
    user_email, user_password, user_role, user_display_name, (user_role IN ('super_admin', 'cfo', 'admin'))
  )
  ON CONFLICT (role_id) DO UPDATE SET
    email = EXCLUDED.email,
    password = EXCLUDED.password,
    display_name = EXCLUDED.display_name,
    allow_override_dates = EXCLUDED.allow_override_dates;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create All System Users
SELECT create_kwsc_user('superadmin@kwsb.gov.pk', 'super@12345', 'super_admin', 'SUPER ADMIN');
SELECT create_kwsc_user('admin@kwsb.gov.pk', 'admin', 'admin', 'SYSTEM ADMINISTRATOR');
SELECT create_kwsc_user('cfo@kwsb.gov.pk', 'cfo@12345', 'cfo', 'CFO');
SELECT create_kwsc_user('cia@kwsb.gov.pk', 'cia@12345', 'cia', 'CIA');
SELECT create_kwsc_user('budget@kwsb.gov.pk', 'budget@12345', 'budget', 'BUDGET');
SELECT create_kwsc_user('pension@kwsb.gov.pk', 'pension@12345', 'pension', 'PENSION');
SELECT create_kwsc_user('fund@kwsb.gov.pk', 'fund@12345', 'fund', 'FUND');
SELECT create_kwsc_user('books@kwsb.gov.pk', 'books@12345', 'books', 'BOOKS');
SELECT create_kwsc_user('establishment@kwsb.gov.pk', 'est@12345', 'establishment', 'ESTABLISHMENT');
SELECT create_kwsc_user('director.account@kwsb.gov.pk', 'da@12345', 'director_account', 'DIRECTOR ACCOUNT');
SELECT create_kwsc_user('director.finance@kwsb.gov.pk', 'df@12345', 'director_finance', 'DIRECTOR FINANCE');
SELECT create_kwsc_user('director.it@kwsb.gov.pk', 'dit@12345', 'director_it', 'DIRECTOR IT');
SELECT create_kwsc_user('director.audit@kwsb.gov.pk', 'daudit@12345', 'director_audit', 'DIRECTOR AUDIT');
SELECT create_kwsc_user('audit1@kwsb.gov.pk', 'audit1@12345', 'internal_audit_1', 'INTERNAL AUDIT-1');
SELECT create_kwsc_user('audit2@kwsb.gov.pk', 'audit2@12345', 'internal_audit_2', 'INTERNAL AUDIT-2');
SELECT create_kwsc_user('subcfo@kwsb.gov.pk', 'sub@12345', 'sub_cfo', 'ASST. CFO');
SELECT create_kwsc_user('asst.cfo1@kwsb.gov.pk', 'acfo1@12345', 'sub_cfo_1', 'ASST. CFO-1');
SELECT create_kwsc_user('asst.cfo2@kwsb.gov.pk', 'acfo2@12345', 'sub_cfo_2', 'ASST. CFO-2');
SELECT create_kwsc_user('asst.cfo3@kwsb.gov.pk', 'acfo3@12345', 'sub_cfo_3', 'ASST. CFO-3');
SELECT create_kwsc_user('asst.cfo4@kwsb.gov.pk', 'acfo4@12345', 'sub_cfo_4', 'ASST. CFO-4');
SELECT create_kwsc_user('asst.cfo5@kwsb.gov.pk', 'acfo5@12345', 'sub_cfo_5', 'ASST. CFO-5');
SELECT create_kwsc_user('law@kwsb.gov.pk', 'law@12345', 'law_department', 'LAW DEPARTMENT');
SELECT create_kwsc_user('chro@kwsb.gov.pk', 'chro@12345', 'chro', 'CHRO');
SELECT create_kwsc_user('mdoffice@kwsb.gov.pk', 'md@12345', 'md_office', 'MD OFFICE');
SELECT create_kwsc_user('emp1@kwsb.gov.pk', 'emp1@12345', 'emp_operator', 'EMPLOYEE REGISTRY 1');
SELECT create_kwsc_user('transfer@kwsb.gov.pk', 'transfer@12345', 'transfer_user', 'TRANSFER ADVICE');
SELECT create_kwsc_user('hr.admin@kwsb.gov.pk', 'hradmin', 'hr_admin', 'HR ADMIN');
SELECT create_kwsc_user('entry@kwsb.gov.pk', 'entry@12345', 'entry_operator', 'ENTRY OPERATOR');
SELECT create_kwsc_user('viewer@kwsb.gov.pk', 'viewer@12345', 'file_viewer', 'FILE VIEWER');

-- Clean up helper function
DROP FUNCTION create_kwsc_user(TEXT, TEXT, TEXT, TEXT);

SELECT 'All KWSC Auth Users Created Successfully!' AS result;
