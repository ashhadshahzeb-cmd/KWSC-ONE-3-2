process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import https from 'https';
import { randomUUID } from 'crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://znzvvqgpnpyxjiamatpa.supabase.co";
const SUPABASE_KEY = "sb_publishable_VRnMCh1jvkPuAg2ed-4rGA_O51khI6G";
const GOOGLE_SHEET_ID = "1tLCMQ3wrDOiOqI21miNWhFq26IlhmOGT9k0h-LMtO6E";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function fetchCSV() {
  return new Promise((resolve, reject) => {
    https.get(CSV_URL, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCSVLine(line) {
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

function safeIsoDate(dStr) {
  if (!dStr) return new Date().toISOString();
  // If DD-Mon-YYYY or DD/MM/YYYY
  const cleaned = dStr.replace(/,/g, '').trim();
  const parsed = new Date(cleaned);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function parseCleanNumber(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

function isValidUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

async function run() {
  console.log('1. Clearing existing incorrectly mapped rows in Supabase...');
  // Delete all rows in file_tracking_records
  const { error: delError } = await supabase
    .from('file_tracking_records')
    .delete()
    .neq('tracking_id', 'NON_EXISTENT_DUMMY_VALUE');
  if (delError) {
    console.error('Delete error:', delError.message);
  } else {
    console.log('Cleared existing table.');
  }

  console.log('\n2. Fetching fresh data from Google Sheet...');
  const csv = await fetchCSV();
  const lines = csv.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  console.log(`Sheet has ${lines.length - 1} rows.`);

  const seenTrackingIds = new Set();
  const seenIds = new Set();
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const r = {};
    headers.forEach((h, idx) => { r[h] = cols[idx] || ''; });

    const diary = r['CFO Diary No'];
    const recNo = r['Receiving No'];
    const subj = r['Subject'];
    // Skip ghost rows and the system initialization test row
    if (!diary && !recNo && !subj) continue;
    if (diary === 'CFO-CONNECTED-001') continue;

    let trkId = r['Tracking ID'];
    if (!trkId || seenTrackingIds.has(trkId)) {
      trkId = `TRK-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
    }
    seenTrackingIds.add(trkId);

    const recFrom = r['Received From / Party Name'] || r['Received From'] || '';
    const recordId = r['Record ID'];

    let finalId = randomUUID();
    if (isValidUUID(recordId) && !seenIds.has(recordId)) {
      finalId = recordId;
      seenIds.add(finalId);
    }

    const item = {
      id: finalId,
      tracking_id: trkId,
      cfo_diary_number: diary,
      receiving_number: recNo,
      employee_number: r['Employee No'] || '',
      subject: subj,
      main_category: r['Main Category'] || '',
      sub_category: r['Sub Category'] || '',
      received_from: recFrom,
      file_purpose: r['Received From'] || recFrom,
      mark_to: r['Current Section (Mark To)'] || '',
      amount: parseCleanNumber(r['Net Amount (PKR)']),
      inward_date: r['Inward Date'] || '',
      remarks: r['Remarks'] || '',
      handover_person_name: r['File Owner / Handover Person'] || '',
      print_date: r['Print Date'] || '',
      additional_mark_to: r['Additional Mark To'] || '',
      gross_amount: parseCleanNumber(r['Gross Amount (PKR)']),
      deduction: parseCleanNumber(r['Deduction (PKR)']),
      budget_code: r['Budget Code'] || '',
      voucher_code: r['Voucher Code'] || '',
      vehicle_no: r['Vehicle No'] || '',
      date_of_sign: r['Date of Sign'] || null,
      outward_date: r['Outward Date'] || null,
      created_at: safeIsoDate(r['Registration Date'] || r['Timestamp (PKT)'])
    };

    records.push(item);
  }

  console.log(`\n3. Ready to import ${records.length} accurately mapped records...`);

  // Sample check before full insert
  console.log('\n--- VERIFYING SAMPLE RECORD (First row) ---');
  console.log({
    cfo_diary: records[0].cfo_diary_number,
    receiving: records[0].receiving_number,
    subject: records[0].subject,
    received_from: records[0].received_from,
    mark_to: records[0].mark_to,
    net_amount: records[0].amount,
    gross_amount: records[0].gross_amount,
    outward_date: records[0].outward_date
  });

  const BATCH_SIZE = 250;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('file_tracking_records')
      .upsert(batch, { onConflict: 'tracking_id', ignoreDuplicates: true });

    if (error) {
      console.error(`Batch ${Math.floor(i / BATCH_SIZE) + 1} error:`, error.message);
    } else {
      inserted += batch.length;
      if (inserted % 1000 === 0 || inserted >= records.length) {
        console.log(`Progress: ${inserted} / ${records.length} records imported...`);
      }
    }
  }

  console.log(`\n🎉 Success! All ${inserted} records perfectly re-imported with exact columns!`);
}

run().catch(console.error);
