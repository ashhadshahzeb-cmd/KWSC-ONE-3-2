import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data, error } = await sb.from('file_tracking_records').select('*').limit(1);
if (error) { console.log('ERR:', error.message); process.exit(1); }
if (data && data[0]) console.log('COLUMNS:\n' + Object.keys(data[0]).join('\n'));
