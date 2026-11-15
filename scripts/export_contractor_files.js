import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function exportContractorRecords() {
  console.log("Starting Contractor export from 2026-05-01 to 2026-10-30...");

  const startDate = '2026-05-01T00:00:00';
  const endDate = '2026-10-30T23:59:59.999';

  let allRecords = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('file_tracking_records')
      .select('id, tracking_id, cfo_diary_number, inward_date, received_from, receiving_number, main_category, sub_category, subject, mark_to, outward_date, remarks, amount, created_at, employee_number, voucher_code, vehicle_no, date_of_sign, budget_code, file_purpose, handover_person_name')
      .eq('main_category', 'contractor')
      .gte('created_at', startDate)
      .lte('created_at', endDate)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      console.error("Error during batch fetch:", error);
      break;
    }

    if (!data || data.length === 0) break;
    allRecords.push(...data);
    console.log(`Fetched ${allRecords.length} records so far...`);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Total Contractor records fetched: ${allRecords.length}`);

  // CSV formatting helper
  const clean = (val) => {
    if (val === null || val === undefined) return '""';
    const s = String(val).replace(/"/g, '""').replace(/[\r\n]+/g, ' ');
    return `"${s}"`;
  };

  const headers = [
    "S#",
    "Diary No",
    "Tracking ID",
    "Receiving / Ref No",
    "Inward Date",
    "Subject / Contractor Name",
    "Amount",
    "Main Category",
    "Sub Category",
    "Employee No",
    "Voucher Code",
    "Vehicle No",
    "Received From",
    "Mark To",
    "Outward Date",
    "Reg Date (Created At)",
    "Date of Sign",
    "Budget Code",
    "File Purpose",
    "Handover Person",
    "Remarks"
  ];

  const rows = allRecords.map((r, idx) => [
    idx + 1,
    clean(r.cfo_diary_number),
    clean(r.tracking_id),
    clean(r.receiving_number),
    clean(r.inward_date),
    clean(r.subject),
    clean(r.amount),
    clean(r.main_category),
    clean(r.sub_category),
    clean(r.employee_number),
    clean(r.voucher_code),
    clean(r.vehicle_no),
    clean(r.received_from),
    clean(r.mark_to),
    clean(r.outward_date),
    clean(r.created_at ? r.created_at.split('T')[0] : ''),
    clean(r.date_of_sign),
    clean(r.budget_code),
    clean(r.file_purpose),
    clean(r.handover_person_name),
    clean(r.remarks)
  ]);

  const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\r\n");

  const outputPath = path.resolve('public', 'Contractor_Entries_May_to_Oct_2026.csv');
  fs.writeFileSync(outputPath, '\ufeff' + csvContent, 'utf-8'); // UTF-8 BOM for Excel compatibility
  console.log(`CSV successfully created at: ${outputPath}`);

  const rootOutputPath = path.resolve('Contractor_Entries_May_to_Oct_2026.csv');
  fs.writeFileSync(rootOutputPath, '\ufeff' + csvContent, 'utf-8');
  console.log(`CSV also saved to root at: ${rootOutputPath}`);
}

exportContractorRecords().catch(console.error);
