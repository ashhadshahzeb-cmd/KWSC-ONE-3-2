-- ========================================================================
-- KWSC SYSTEM - COMPLETE REMAINING TABLES SETUP
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/znzvvqgpnpyxjiamatpa/sql
-- ========================================================================

-- ========================================================================
-- 1. BOOK SECTION EMPLOYEES (54,000+ Employee Ledger Records)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.book_section_employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    serial_no TEXT,
    employee_no TEXT,
    pension_no TEXT,
    full_name TEXT NOT NULL,
    cnic_no TEXT,
    nominees TEXT,
    appointment_date TEXT,
    retired_date TEXT,
    disbursed_date TEXT,
    category TEXT DEFAULT 'Regular',
    sub_category_regular TEXT,
    sub_category_retired TEXT,
    status TEXT DEFAULT 'Active',
    bank_details TEXT,
    total_amount NUMERIC DEFAULT 0,
    balance_amount NUMERIC DEFAULT 0,
    cheque_amount NUMERIC DEFAULT 0,
    amount_in_words TEXT,
    photo_url TEXT,
    nature_of_bill TEXT,
    pmr_no TEXT,
    cheque_date TEXT,
    cheque_break_up TEXT,
    cheque_no TEXT,
    paid_amount NUMERIC DEFAULT 0,
    deduction NUMERIC DEFAULT 0,
    passing_date TEXT,
    entry_date TEXT,
    payment_date TEXT,
    ref_care_of TEXT,
    fund_amount NUMERIC DEFAULT 0,
    sal_amount NUMERIC DEFAULT 0,
    pen_amount NUMERIC DEFAULT 0,
    lpr_amount NUMERIC DEFAULT 0,
    disb_amount NUMERIC DEFAULT 0,
    med_amount NUMERIC DEFAULT 0,
    gins_amount NUMERIC DEFAULT 0,
    other_amount NUMERIC DEFAULT 0,
    total_disbursement NUMERIC DEFAULT 0,
    bank_status TEXT,
    pmr_date TEXT,
    source_tab TEXT
);

CREATE INDEX IF NOT EXISTS idx_bse_emp_no ON public.book_section_employees (employee_no);
CREATE INDEX IF NOT EXISTS idx_bse_name ON public.book_section_employees (full_name);
CREATE INDEX IF NOT EXISTS idx_bse_cnic ON public.book_section_employees (cnic_no);
CREATE INDEX IF NOT EXISTS idx_bse_pension ON public.book_section_employees (pension_no);

ALTER TABLE public.book_section_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on book_section_employees" ON public.book_section_employees;
CREATE POLICY "Allow all on book_section_employees" ON public.book_section_employees FOR ALL USING (true) WITH CHECK (true);

-- ========================================================================
-- 2. TRANSFER ADVICE TABLES
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.transfer_advices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advice_no TEXT NOT NULL,
    date DATE NOT NULL,
    bank_name TEXT NOT NULL,
    subject TEXT DEFAULT 'TRANSFER ADVICE.',
    total_amount NUMERIC NOT NULL,
    created_by TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.transfer_advice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_advice_id UUID REFERENCES public.transfer_advices(id) ON DELETE CASCADE,
    s_no INTEGER NOT NULL,
    transfer_amount NUMERIC NOT NULL,
    amount_in_words TEXT NOT NULL,
    ac_no_debit TEXT NOT NULL,
    ac_no_credit TEXT NOT NULL,
    in_respect_of TEXT NOT NULL,
    payment_method TEXT,
    payment_number TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.transfer_advices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_advice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on transfer_advices" ON public.transfer_advices;
CREATE POLICY "Allow all on transfer_advices" ON public.transfer_advices FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Allow all on transfer_advice_items" ON public.transfer_advice_items;
CREATE POLICY "Allow all on transfer_advice_items" ON public.transfer_advice_items FOR ALL USING (true) WITH CHECK (true);

-- ========================================================================
-- 3. HRMS MODULE (Attendance, Employees, Shifts, Leaves, Payroll)
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.hrms_employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    department TEXT NOT NULL,
    designation TEXT NOT NULL,
    email TEXT,
    password TEXT,
    basic_salary NUMERIC NOT NULL DEFAULT 0,
    face_descriptor TEXT,
    join_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.hrms_shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.hrms_attendance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.hrms_employees(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    status TEXT NOT NULL DEFAULT 'Present',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, date)
);

CREATE TABLE IF NOT EXISTS public.hrms_leave_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.hrms_employees(id) ON DELETE CASCADE,
    leave_type TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.hrms_payroll (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id UUID REFERENCES public.hrms_employees(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    basic_salary NUMERIC NOT NULL,
    deductions NUMERIC NOT NULL DEFAULT 0,
    net_salary NUMERIC NOT NULL,
    status TEXT NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, month)
);

CREATE TABLE IF NOT EXISTS public.hrms_announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hrms_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hrms_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on hrms_employees" ON public.hrms_employees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hrms_shifts" ON public.hrms_shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hrms_attendance" ON public.hrms_attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hrms_leave_requests" ON public.hrms_leave_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hrms_payroll" ON public.hrms_payroll FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on hrms_announcements" ON public.hrms_announcements FOR ALL USING (true) WITH CHECK (true);

-- ========================================================================
-- 4. BILL DISPATCH & CHEQUES
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.bill_dispatch (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    diary_no TEXT,
    tracking_id TEXT,
    received_date TEXT,
    party_name TEXT,
    subject TEXT,
    amount NUMERIC DEFAULT 0,
    ref_no TEXT,
    scan_url TEXT,
    status TEXT DEFAULT 'pending',
    remarks TEXT,
    history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cheque_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cheque_no TEXT,
    cheque_date TEXT,
    amount NUMERIC DEFAULT 0,
    payee_name TEXT,
    status TEXT DEFAULT 'pending',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.bill_dispatch ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cheque_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on bill_dispatch" ON public.bill_dispatch FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on cheque_records" ON public.cheque_records FOR ALL USING (true) WITH CHECK (true);

-- ========================================================================
-- 5. NOTIFICATIONS & MESSAGES
-- ========================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    user_role TEXT,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sender TEXT,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT,
    content TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fcm_tokens (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    token TEXT UNIQUE,
    user_role TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on notifications" ON public.notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on notices" ON public.notices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fcm_tokens" ON public.fcm_tokens FOR ALL USING (true) WITH CHECK (true);

-- ========================================================================
-- 6. ALL REMAINING STORAGE BUCKETS (Signatures, Avatars, Attendance Selfies)
-- ========================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('attendance_selfies', 'attendance_selfies', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_all_storage_select" ON storage.objects;
CREATE POLICY "public_all_storage_select" ON storage.objects FOR SELECT TO public USING (true);
DROP POLICY IF EXISTS "public_all_storage_insert" ON storage.objects;
CREATE POLICY "public_all_storage_insert" ON storage.objects FOR INSERT TO public WITH CHECK (true);
DROP POLICY IF EXISTS "public_all_storage_update" ON storage.objects;
CREATE POLICY "public_all_storage_update" ON storage.objects FOR UPDATE TO public USING (true);
DROP POLICY IF EXISTS "public_all_storage_delete" ON storage.objects;
CREATE POLICY "public_all_storage_delete" ON storage.objects FOR DELETE TO public USING (true);

SELECT 'All KWSC Remaining Tables & Storage Buckets Created Successfully!' AS result;
