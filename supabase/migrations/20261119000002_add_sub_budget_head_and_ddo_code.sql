-- Add sub_budget_head and ddo_code to file_tracking_records
ALTER TABLE file_tracking_records 
ADD COLUMN IF NOT EXISTS sub_budget_head text,
ADD COLUMN IF NOT EXISTS ddo_code text;
