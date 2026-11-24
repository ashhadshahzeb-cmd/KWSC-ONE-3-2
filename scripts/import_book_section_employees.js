process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import fs from 'fs';
import readline from 'readline';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://znzvvqgpnpyxjiamatpa.supabase.co";
const SUPABASE_KEY = "sb_publishable_VRnMCh1jvkPuAg2ed-4rGA_O51khI6G";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CSV_PATH = 'full_data.csv';

function parseNumber(v) {
  if (!v || v === '' || v === 'null') return 0;
  const cleaned = String(v).replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function parseCsvLine(line) {
  const cols = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  cols.push(cur.trim());
  return cols;
}

async function run() {
  console.log('1. Checking book_section_employees table...');
  const { error: testErr } = await supabase.from('book_section_employees').select('id').limit(1);
  if (testErr) {
    console.error('Table not found or error:', testErr.message);
    return;
  }

  console.log('2. Reading full_data.csv...');
  const fileStream = fs.createReadStream(CSV_PATH);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let headers = [];
  let isHeader = true;
  let batch = [];
  let count = 0;
  const BATCH_SIZE = 500;

  for await (const line of rl) {
    if (!line.trim()) continue;
    if (isHeader) {
      headers = parseCsvLine(line);
      isHeader = false;
      continue;
    }

    const cols = parseCsvLine(line);
    const r = {};
    headers.forEach((h, idx) => { r[h] = cols[idx] || ''; });

    if (!r.full_name && !r.employee_no && !r.pension_no) continue;

    batch.push({
      employee_no: r.employee_no || null,
      pension_no: r.pension_no || null,
      full_name: r.full_name || 'N/A',
      cnic_no: r.cnic_no || null,
      nominees: r.nominees || null,
      appointment_date: r.appointment_date || null,
      retired_date: r.retired_date || null,
      disbursed_date: r.disbursed_date || null,
      sub_category_regular: r.sub_category_regular || null,
      sub_category_retired: r.sub_category_retired || null,
      status: r.status || 'Active',
      bank_details: r.bank_details || null,
      total_amount: parseNumber(r.total_amount),
      balance_amount: parseNumber(r.balance_amount),
      cheque_amount: parseNumber(r.cheque_amount),
      amount_in_words: r.amount_in_words || null,
      category: r.category || 'Regular',
      serial_no: r.serial_no || null,
      nature_of_bill: r.nature_of_bill || null,
      pmr_no: r.pmr_no || null,
      cheque_date: r.cheque_date || null,
      cheque_break_up: r.cheque_break_up || null,
      cheque_no: r.cheque_no || null,
      paid_amount: parseNumber(r.paid_amount),
      deduction: parseNumber(r.deduction),
      passing_date: r.passing_date || null,
      entry_date: r.entry_date || null,
      payment_date: r.payment_date || null,
      ref_care_of: r.ref_care_of || null,
      fund_amount: parseNumber(r.fund_amount),
      sal_amount: parseNumber(r.sal_amount),
      pen_amount: parseNumber(r.pen_amount),
      lpr_amount: parseNumber(r.lpr_amount),
      disb_amount: parseNumber(r.disb_amount),
      med_amount: parseNumber(r.med_amount),
      gins_amount: parseNumber(r.gins_amount),
      other_amount: parseNumber(r.other_amount),
      total_disbursement: parseNumber(r.total_disbursement),
      bank_status: r.bank_status || null,
      pmr_date: r.pmr_date || null,
      source_tab: r.source_tab || null
    });

    if (batch.length >= BATCH_SIZE) {
      const { error } = await supabase.from('book_section_employees').insert(batch);
      if (error) console.error('Batch error:', error.message);
      else {
        count += batch.length;
        if (count % 2500 === 0) console.log(`Imported ${count} records into book_section_employees...`);
      }
      batch = [];
    }
  }

  if (batch.length > 0) {
    const { error } = await supabase.from('book_section_employees').insert(batch);
    if (!error) count += batch.length;
  }

  console.log(`🎉 Complete! Total ${count} records imported into book_section_employees!`);
}

run().catch(console.error);
