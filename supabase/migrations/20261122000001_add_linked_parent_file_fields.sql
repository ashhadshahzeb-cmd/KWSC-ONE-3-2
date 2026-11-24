-- Add parent_diary_number and linked_file_id for linking note sheets to bills
ALTER TABLE file_tracking_records 
ADD COLUMN IF NOT EXISTS parent_diary_number text,
ADD COLUMN IF NOT EXISTS linked_file_id text;

-- Create index for fast parent diary lookup
CREATE INDEX IF NOT EXISTS idx_file_tracking_parent_diary_number ON file_tracking_records(parent_diary_number);
