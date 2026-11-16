process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

import https from 'https';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || "https://znzvvqgpnpyxjiamatpa.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "sb_publishable_VRnMCh1jvkPuAg2ed-4rGA_O51khI6G";
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

function parseCSV(csv) {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

function safeIsoDate(dStr) {
  if (!dStr) return new Date().toISOString();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(dStr)) {
    const parts = dStr.split(/[\/\s:]/);
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}T12:00:00.000Z`;
  }
  const parsed = new Date(dStr);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function parseCleanNumber(val) {
  if (!val) return 0;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return isNaN(n) ? 0 : n;
}

async function run() {
  console.log('1. Fetching data from Google Sheet...');
  const csv = await fetchCSV();
  const rawRows = parseCSV(csv);
  console.log(`Fetched ${rawRows.length} total rows from Sheet.`);

  // Filter and format valid rows
  const records = [];
  const seenTrackingIds = new Set();

  for (let idx = 0; idx < rawRows.length; idx++) {
    const r = rawRows[idx];
    const diary = r['CFO Diary No'] || r['C'] || '';
    const recNo = r['Receiving No'] || r['D'] || '';
    const subj = r['Subject'] || r['J'] || '';
    if (!diary && !recNo && !subj) continue; // skip ghost row

    let trkId = r['Tracking ID'] || r['B'] || '';
    if (!trkId || seenTrackingIds.has(trkId)) {
      trkId = `TRK-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
    }
    seenTrackingIds.add(trkId);

    records.push({
      tracking_id: trkId,
      cfo_diary_number: diary,
      receiving_number: recNo,
      employee_number: r['Employee No'] || r['E'] || '',
      inward_date: r['Inward Date'] || r['F'] || '',
      main_category: r['Main Category'] || r['G'] || '',
      sub_category: r['Sub Category'] || r['H'] || '',
      received_from: r['Received From'] || r['I'] || '',
      subject: subj,
      mark_to: r['Mark To'] || r['K'] || '',
      gross_amount: parseCleanNumber(r['Gross Amount'] || r['L']),
      deduction: parseCleanNumber(r['Deduction'] || r['M']),
      amount: parseCleanNumber(r['Net Amount'] || r['N']),
      outward_date: r['Outward Date'] || r['O'] || null,
      remarks: r['Remarks'] || r['P'] || '',
      file_purpose: r['Received From'] || r['Q'] || '',
      budget_code: r['Budget Code'] || r['R'] || '',
      handover_person_name: r['Handover Person'] || r['S'] || '',
      date_of_sign: r['Date of Sign'] || r['T'] || null,
      vehicle_no: r['Vehicle No'] || r['U'] || '',
      voucher_code: r['Voucher Code'] || r['V'] || '',
      created_at: safeIsoDate(r['Registration Date'] || r['W'])
    });
  }

  console.log(`Found ${records.length} clean, valid records to import.`);

  // Insert in batches of 200
  const BATCH_SIZE = 200;
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
      if (inserted % 1000 === 0 || inserted === records.length) {
        console.log(`Progress: ${inserted} / ${records.length} records processed...`);
      }
    }
  }

  console.log(`\n🎉 Complete! Successfully imported ${inserted} records into the new Supabase database!`);
}

run().catch(console.error);
