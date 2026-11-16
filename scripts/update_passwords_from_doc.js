process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://znzvvqgpnpyxjiamatpa.supabase.co";
const SUPABASE_KEY = "sb_publishable_VRnMCh1jvkPuAg2ed-4rGA_O51khI6G";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const content = fs.readFileSync('scratch/doc_passwords.txt', 'utf8');
const lines = content.split('\n').map(l => l.trim()).filter(l => l);

// Find where credentials start (after Role)
const startIndex = lines.findIndex(l => l.toLowerCase() === 'role');
const credLines = lines.slice(startIndex + 1).filter(l => !l.toLowerCase().includes('confidential'));

const users = [];
for (let i = 0; i < credLines.length; i += 3) {
  const email = credLines[i];
  const password = credLines[i + 1];
  const role = credLines[i + 2];
  if (email && password && email.includes('@')) {
    users.push({
      email,
      password,
      role_id: role === 'unknown' ? (email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_')) : role,
      display_name: email.split('@')[0].toUpperCase().replace(/\./g, ' '),
      allow_override_dates: role === 'super_admin' || role === 'cfo' || role === 'admin'
    });
  }
}

console.log(`Parsed ${users.length} users from doc:`);
console.log(users.map(u => `${u.email} -> ${u.password} (${u.role_id})`).join('\n'));

async function updateSupabase() {
  for (const u of users) {
    const { error } = await supabase
      .from('department_users_settings')
      .upsert({
        role_id: u.role_id,
        email: u.email,
        password: u.password,
        display_name: u.display_name,
        allow_override_dates: u.allow_override_dates
      }, { onConflict: 'role_id' });

    if (error) {
      console.error(`Error updating ${u.email}:`, error.message);
    } else {
      console.log(`Updated ${u.email} in department_users_settings`);
    }
  }

  // Also ensure superadmin is mapped with super_admin role_id
  const superadmin = users.find(u => u.email === 'superadmin@kwsb.gov.pk');
  if (superadmin) {
    await supabase.from('department_users_settings').upsert({
      role_id: 'super_admin',
      email: superadmin.email,
      password: superadmin.password,
      display_name: 'SUPER ADMIN',
      allow_override_dates: true
    }, { onConflict: 'role_id' });
    console.log('Ensured super_admin role for superadmin@kwsb.gov.pk');
  }

  console.log('Done updating Supabase department_users_settings!');
}

updateSupabase().catch(console.error);
