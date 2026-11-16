-- ========================================================================
-- KWSC ONE-WINDOW SYSTEM - COMPLETE DATABASE INITIALIZATION
-- Project: znzvvqgpnpyxjiamatpa
-- Run this in Supabase SQL Editor (1-click complete setup)
-- ========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================================================
-- 1. FILE TRACKING RECORDS TABLE (Core Table)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.file_tracking_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tracking_id TEXT UNIQUE NOT NULL,
    cfo_diary_number TEXT,
    receiving_number TEXT,
    employee_number TEXT,
    inward_date TEXT,
    main_category TEXT,
    sub_category TEXT,
    received_from TEXT,
    file_purpose TEXT,
    subject TEXT,
    mark_to TEXT,
    additional_mark_to TEXT,
    gross_amount NUMERIC DEFAULT 0,
    deduction NUMERIC DEFAULT 0,
    amount NUMERIC DEFAULT 0,
    outward_date TEXT,
    remarks TEXT,
    budget_code TEXT,
    voucher_code TEXT,
    vehicle_no TEXT,
    date_of_sign TEXT,
    signature_data TEXT,
    handover_person_name TEXT,
    print_date TEXT,
    file_image TEXT,
    file_images JSONB DEFAULT '[]'::jsonb,
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Fast Search Indexes
CREATE INDEX IF NOT EXISTS idx_ftr_cfo_diary ON public.file_tracking_records (cfo_diary_number);
CREATE INDEX IF NOT EXISTS idx_ftr_receiving_no ON public.file_tracking_records (receiving_number);
CREATE INDEX IF NOT EXISTS idx_ftr_tracking_id ON public.file_tracking_records (tracking_id);
CREATE INDEX IF NOT EXISTS idx_ftr_main_category ON public.file_tracking_records (main_category);
CREATE INDEX IF NOT EXISTS idx_ftr_inward_date ON public.file_tracking_records (inward_date);
CREATE INDEX IF NOT EXISTS idx_ftr_created_at ON public.file_tracking_records (created_at DESC);

-- Enable RLS and Allow Public Access
ALTER TABLE public.file_tracking_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access on file_tracking_records" ON public.file_tracking_records;
CREATE POLICY "Allow all access on file_tracking_records"
    ON public.file_tracking_records FOR ALL
    USING (true)
    WITH CHECK (true);

-- ========================================================================
-- 2. DEPARTMENT USERS SETTINGS (Authentication & Roles)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.department_users_settings (
    role_id TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    password TEXT,
    avatar_url TEXT,
    allow_override_dates BOOLEAN DEFAULT false,
    is_blocked BOOLEAN DEFAULT false,
    enforce_attendance BOOLEAN DEFAULT false,
    fcm_token TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.department_users_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access on department_users_settings" ON public.department_users_settings;
CREATE POLICY "Allow all access on department_users_settings"
    ON public.department_users_settings FOR ALL
    USING (true)
    WITH CHECK (true);

-- Seed System Users
INSERT INTO public.department_users_settings (email, password, role_id, display_name) VALUES
    ('admin@kwsb.gov.pk', 'admin', 'admin', 'SYSTEM ADMINISTRATOR'),
    ('cfo@kwsb.gov.pk', 'cfo@12345', 'cfo', 'CFO'),
    ('cia@kwsb.gov.pk', 'cia@12345', 'cia', 'CIA'),
    ('budget@kwsb.gov.pk', 'budget@12345', 'budget', 'BUDGET'),
    ('pension@kwsb.gov.pk', 'pension@12345', 'pension', 'PENSION'),
    ('fund@kwsb.gov.pk', 'fund@12345', 'fund', 'FUND'),
    ('audit1@kwsb.gov.pk', 'audit1@12345', 'internal_audit_1', 'INTERNAL AUDIT-1'),
    ('director.account@kwsb.gov.pk', 'da@12345', 'director_account', 'DIRECTOR ACCOUNT'),
    ('director.finance@kwsb.gov.pk', 'df@12345', 'director_finance', 'DIRECTOR FINANCE'),
    ('director.it@kwsb.gov.pk', 'dit@12345', 'director_it', 'DIRECTOR IT'),
    ('subcfo@kwsb.gov.pk', 'sub@12345', 'sub_cfo', 'ASST. CFO'),
    ('books@kwsb.gov.pk', 'books@12345', 'books', 'BOOKS'),
    ('establishment@kwsb.gov.pk', 'est@12345', 'establishment', 'ESTABLISHMENT'),
    ('director.audit@kwsb.gov.pk', 'daudit@12345', 'director_audit', 'DIRECTOR AUDIT'),
    ('audit2@kwsb.gov.pk', 'audit2@12345', 'internal_audit_2', 'INTERNAL AUDIT-2'),
    ('law@kwsb.gov.pk', 'law@12345', 'law_department', 'LAW DEPARTMENT'),
    ('chro@kwsb.gov.pk', 'chro@12345', 'chro', 'CHRO'),
    ('asst.cfo1@kwsb.gov.pk', 'acfo1@12345', 'sub_cfo_1', 'ASST. CFO-1'),
    ('asst.cfo2@kwsb.gov.pk', 'acfo2@12345', 'sub_cfo_2', 'ASST. CFO-2'),
    ('asst.cfo3@kwsb.gov.pk', 'acfo3@12345', 'sub_cfo_3', 'ASST. CFO-3'),
    ('asst.cfo4@kwsb.gov.pk', 'acfo4@12345', 'sub_cfo_4', 'ASST. CFO-4'),
    ('asst.cfo5@kwsb.gov.pk', 'acfo5@12345', 'sub_cfo_5', 'ASST. CFO-5'),
    ('mdoffice@kwsb.gov.pk', 'md@12345', 'md_office', 'MD OFFICE'),
    ('emp1@kwsb.gov.pk', 'emp1@12345', 'emp_operator', 'EMPLOYEE REGISTRY 1'),
    ('transfer@kwsb.gov.pk', 'transfer@12345', 'transfer_user', 'TRANSFER ADVICE')
ON CONFLICT (role_id) DO NOTHING;

-- ========================================================================
-- 3. ACTIVITY LOG TABLE
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.activity_log (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_role         TEXT NOT NULL,
  user_name         TEXT NOT NULL,
  action            TEXT NOT NULL,
  record_id         TEXT,
  diary_number      TEXT,
  receiving_number  TEXT,
  subject           TEXT,
  details           JSONB DEFAULT '{}',
  session_id        TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_log_user ON public.activity_log (user_role);
CREATE INDEX IF NOT EXISTS idx_activity_log_action ON public.activity_log (action);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_diary ON public.activity_log (diary_number);

ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access on activity_log" ON public.activity_log;
CREATE POLICY "Allow all access on activity_log"
    ON public.activity_log FOR ALL
    USING (true)
    WITH CHECK (true);

-- ========================================================================
-- 4. APP CONFIG TABLE (Categories, Subcategories, Sections)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.app_config (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_type TEXT NOT NULL,
  config_key  TEXT NOT NULL,
  config_label TEXT NOT NULL,
  parent_key  TEXT DEFAULT NULL,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (config_type, config_key, parent_key)
);

CREATE INDEX IF NOT EXISTS idx_app_config_type ON public.app_config (config_type);
CREATE INDEX IF NOT EXISTS idx_app_config_parent ON public.app_config (parent_key);

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access on app_config" ON public.app_config;
CREATE POLICY "Allow all access on app_config"
    ON public.app_config FOR ALL
    USING (true)
    WITH CHECK (true);

-- Seed Main Categories
INSERT INTO public.app_config (config_type, config_key, config_label, parent_key, sort_order) VALUES
  ('main_category', 'employee',    'Employee',    NULL, 1),
  ('main_category', 'contractor',  'Contractor',  NULL, 2),
  ('main_category', 'others',      'Others',      NULL, 3),
  ('main_category', 'pol_bills',   'POL Bills',   NULL, 4),
  ('main_category', 'impress',     'Impress',     NULL, 5)
ON CONFLICT (config_type, config_key, parent_key) DO NOTHING;

-- Seed Sub-Categories
INSERT INTO public.app_config (config_type, config_key, config_label, parent_key, sort_order) VALUES
  ('sub_category', 'medical',            'Medical',               'employee',   1),
  ('sub_category', 'pension',            'Pension',               'employee',   2),
  ('sub_category', 'salary-arrears',     'Salary / Arrears',      'employee',   3),
  ('sub_category', 'loans-advances',     'Loans / Advances',      'employee',   4),
  ('sub_category', 'daily-wages',        'Daily Wages',           'employee',   5),
  ('sub_category', 'establishment',      'Establishment',         'employee',   6),
  ('sub_category', 'funds',              'Funds',                 'employee',   7),
  ('sub_category', 'cp-fund',            'CP Fund',               'employee',   8),
  ('sub_category', 'supp-salary',        'Supp Salary',           'employee',   9),
  ('sub_category', 'house-building',     'House Building',        'employee',   10),
  ('sub_category', 'tada',               'TADA',                  'employee',   11),
  ('sub_category', 'overtime',           'Overtime',              'employee',   12),
  ('sub_category', 'emp-others',         'Others',                'employee',   13),
  ('sub_category', 'security-deposit',   'Security Deposit',      'contractor', 1),
  ('sub_category', 'contingencies',      'Contingencies',         'contractor', 2),
  ('sub_category', 'contractor-pol',     'POL Bills',             'contractor', 3),
  ('sub_category', 'contractor-bills',   'Contractor Bills',      'contractor', 4),
  ('sub_category', 'contractor-concerns','Contractor Concerns',   'contractor', 5),
  ('sub_category', 'others-pol',         'POL Bills',             'others',     1),
  ('sub_category', 'others-contingencies','Contingencies',        'others',     2),
  ('sub_category', 'legal',              'Legal',                 'others',     3),
  ('sub_category', 'books-registers',    'Books/Registers',       'others',     4),
  ('sub_category', 'general-misc',       'General / Miscellaneous','others',    5)
ON CONFLICT (config_type, config_key, parent_key) DO NOTHING;

-- Seed Sections (Mark To)
INSERT INTO public.app_config (config_type, config_key, config_label, parent_key, sort_order) VALUES
  ('section', 'cfo',              'CFO',                NULL, 1),
  ('section', 'cia',              'CIA',                NULL, 2),
  ('section', 'budget',           'Budget',             NULL, 3),
  ('section', 'pension',          'Pension',            NULL, 4),
  ('section', 'fund',             'Fund',               NULL, 5),
  ('section', 'internal_audit_1', 'Internal Audit-1',   NULL, 6),
  ('section', 'director_account', 'Director Account',   NULL, 7),
  ('section', 'director_finance', 'Director Finance',   NULL, 8),
  ('section', 'director_it',      'Director IT',        NULL, 9),
  ('section', 'sub_cfo',          'Asst. CFO',          NULL, 10),
  ('section', 'books',            'Books',              NULL, 11),
  ('section', 'establishment',    'Establishment',      NULL, 12),
  ('section', 'director_audit',   'Director Audit',     NULL, 13),
  ('section', 'internal_audit_2', 'Internal Audit-2',   NULL, 14),
  ('section', 'law_department',   'Law Department',     NULL, 15),
  ('section', 'chro',             'CHRO',               NULL, 16),
  ('section', 'md_office',        'MD Office',          NULL, 17)
ON CONFLICT (config_type, config_key, parent_key) DO NOTHING;

-- ========================================================================
-- 5. BILLING SECTION TABLES
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.medical_billings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  budget_year     date,
  budget_head     text,
  hospital_name   text NOT NULL,
  vendor_name     text NOT NULL,
  party_code      text,
  pmr_voucher     text,
  voucher_no      text,
  cheque_no       text,
  balance_amount  numeric DEFAULT 0,
  income_tax      numeric DEFAULT 0,
  gross_amount    numeric DEFAULT 0,
  net_amount      numeric DEFAULT 0,
  bill_passed_on  date,
  payment_date    date,
  vendor_type     text DEFAULT 'medical'
);
ALTER TABLE public.medical_billings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on medical_billings" ON public.medical_billings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.contractor_billings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  budget_year       date,
  budget_head       text,
  pmr_voucher       text,
  contractor_name   text NOT NULL,
  party_code        text,
  city_town         text,
  voucher_no        text,
  cheque_no         text,
  balance_amount    numeric DEFAULT 0,
  water_charges     numeric DEFAULT 0,
  security_deposit  numeric DEFAULT 0,
  gst_other         numeric DEFAULT 0,
  income_tax        numeric DEFAULT 0,
  gross_amount      numeric DEFAULT 0,
  net_amount        numeric DEFAULT 0,
  bill_passed_on    date,
  payment_date      date,
  work_description  text,
  vendor_type       text DEFAULT 'contractor'
);
ALTER TABLE public.contractor_billings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contractor_billings" ON public.contractor_billings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.security_deposits (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  year_sd           date,
  budget_head       text,
  party_code        text,
  vendor_name       text NOT NULL,
  zone_wise         text,
  voucher_no        text,
  voucher_date      date,
  bill_passed_on    date,
  gross_amount      numeric DEFAULT 0,
  net_amount        numeric DEFAULT 0,
  receiving_status  text,
  cheque_no         text,
  balance_amount    numeric DEFAULT 0,
  payment_date      date,
  vendor_type       text DEFAULT 'security_deposit'
);
ALTER TABLE public.security_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on security_deposits" ON public.security_deposits FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.pol_billings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  budget_year       date,
  budget_head       text,
  party_code        text,
  vendor_name       text NOT NULL,
  voucher_no        text,
  cheque_no         text,
  balance_amount    numeric DEFAULT 0,
  income_tax        numeric DEFAULT 0,
  gross_amount      numeric DEFAULT 0,
  net_amount        numeric DEFAULT 0,
  bill_passed_on    date,
  payment_date      date,
  vendor_type       text DEFAULT 'pol'
);
ALTER TABLE public.pol_billings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on pol_billings" ON public.pol_billings FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.contingency_billings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        timestamptz NOT NULL DEFAULT now(),
  budget_year       date,
  budget_head       text,
  party_code        text,
  vendor_name       text NOT NULL,
  voucher_no        text,
  cheque_no         text,
  balance_amount    numeric DEFAULT 0,
  income_tax        numeric DEFAULT 0,
  gross_amount      numeric DEFAULT 0,
  net_amount        numeric DEFAULT 0,
  bill_passed_on    date,
  payment_date      date,
  vendor_type       text DEFAULT 'contingency'
);
ALTER TABLE public.contingency_billings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contingency_billings" ON public.contingency_billings FOR ALL USING (true) WITH CHECK (true);

-- ========================================================================
-- 6. PENDING FILES TABLE
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.file_tracking_pending (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tracking_code TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    subject TEXT,
    file_image TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);
ALTER TABLE public.file_tracking_pending ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on file_tracking_pending" ON public.file_tracking_pending FOR ALL USING (true) WITH CHECK (true);

-- ========================================================================
-- 7. STORAGE BUCKETS (Images & System Assets)
-- ========================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('file-tracking-images', 'file-tracking-images', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('bucket_assets', 'bucket_assets', true)
ON CONFLICT (id) DO NOTHING;

-- Public Storage Access Policies
DROP POLICY IF EXISTS "public_file_tracking_images_select" ON storage.objects;
CREATE POLICY "public_file_tracking_images_select"
  ON storage.objects FOR SELECT TO public USING (bucket_id = 'file-tracking-images' OR bucket_id = 'bucket_assets');

DROP POLICY IF EXISTS "public_file_tracking_images_insert" ON storage.objects;
CREATE POLICY "public_file_tracking_images_insert"
  ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'file-tracking-images' OR bucket_id = 'bucket_assets');

DROP POLICY IF EXISTS "public_file_tracking_images_update" ON storage.objects;
CREATE POLICY "public_file_tracking_images_update"
  ON storage.objects FOR UPDATE TO public USING (bucket_id = 'file-tracking-images' OR bucket_id = 'bucket_assets');

DROP POLICY IF EXISTS "public_file_tracking_images_delete" ON storage.objects;
CREATE POLICY "public_file_tracking_images_delete"
  ON storage.objects FOR DELETE TO public USING (bucket_id = 'file-tracking-images' OR bucket_id = 'bucket_assets');

-- Done!
SELECT 'KWSC Database Setup Completed Successfully!' as status;
