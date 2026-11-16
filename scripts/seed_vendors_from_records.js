process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://znzvvqgpnpyxjiamatpa.supabase.co";
const SUPABASE_KEY = "sb_publishable_VRnMCh1jvkPuAg2ed-4rGA_O51khI6G";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function seedVendors() {
  console.log('1. Checking vendors table...');
  const { error: testErr } = await supabase.from('vendors').select('id').limit(1);
  if (testErr) {
    console.error('Vendors table not ready yet:', testErr.message);
    return;
  }

  console.log('2. Extracting vendors from 14,433 file tracking records...');
  // Paginate to get all records
  let allRecords = [];
  let page = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('file_tracking_records')
      .select('received_from, employee_number, main_category, voucher_code')
      .range(page * pageSize, (page + 1) * pageSize - 1);
    if (error || !data || data.length === 0) break;
    allRecords = allRecords.concat(data);
    if (data.length < pageSize) break;
    page++;
  }

  console.log(`Scanned ${allRecords.length} records.`);

  const map = new Map();
  for (const r of allRecords) {
    const name = (r.received_from || '').trim();
    if (!name || name.length < 2 || name === 'N/A' || name === 'nill' || name === '-') continue;
    const key = name.toLowerCase();
    if (!map.has(key)) {
      const isEmp = r.main_category === 'employee' || !!r.employee_number;
      map.set(key, {
        vendor_name: name,
        vendor_role: isEmp ? 'employee' : 'contractor',
        employee_no: r.employee_number || null,
        vendor_number: r.voucher_code || null,
        companies: [{ id: Date.now().toString(), name }],
        custom_fields: []
      });
    }
  }

  const vendors = Array.from(map.values());
  console.log(`3. Found ${vendors.length} unique vendors to insert.`);

  // Insert in batches of 100
  const BATCH_SIZE = 100;
  let inserted = 0;
  for (let i = 0; i < vendors.length; i += BATCH_SIZE) {
    const batch = vendors.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('vendors').insert(batch);
    if (error) {
      console.error(`Batch error:`, error.message);
    } else {
      inserted += batch.length;
    }
  }

  console.log(`🎉 Successfully seeded ${inserted} vendors into vendors table!`);
}

seedVendors().catch(console.error);
