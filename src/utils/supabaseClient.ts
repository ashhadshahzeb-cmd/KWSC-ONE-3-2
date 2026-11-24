// src/utils/supabaseClient.ts
// Supabase client initialization. Adjust the env variable names if yours differ.
// Ensure that the environment variables SUPABASE_URL and SUPABASE_ANON_KEY are defined
// (e.g., in a .env file at the project root) and that Vite loads them via import.meta.env.

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or ANON KEY is missing. Check your .env file and Vite config.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
