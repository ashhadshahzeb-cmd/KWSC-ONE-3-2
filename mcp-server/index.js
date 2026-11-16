#!/usr/bin/env node
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
/**
 * KWSC File Tracking - MCP Server for Claude Desktop
 * v2.0 — Supabase paused hone par Google Sheet se fallback data fetch
 */

import readline from 'readline';
import fs from 'fs';
import path from 'path';
import os from 'os';
import https from 'https';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import * as xlsx from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL || "https://znzvvqgpnpyxjiamatpa.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_VRnMCh1jvkPuAg2ed-4rGA_O51khI6G";

// Google Sheet config (for fallback when Supabase is paused)
const GOOGLE_SHEET_ID = "1tLCMQ3wrDOiOqI21miNWhFq26IlhmOGT9k0h-LMtO6E";
const GOOGLE_SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Sheet1`;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ---- Helpers ----

function getLocalDateString() {
  const d = new Date();
  // Pakistan time (UTC+5)
  const pkTime = new Date(d.getTime() + (5 * 60 * 60 * 1000));
  const year = pkTime.getUTCFullYear();
  const month = String(pkTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(pkTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

// Supabase ke liye timeout wrapper (10 seconds)
function withTimeout(promise, ms = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
  ]);
}

// Google Sheet CSV fetch (plain HTTPS — no extra libs)
function fetchGoogleSheetCSV() {
  return new Promise((resolve, reject) => {
    const url = new URL(GOOGLE_SHEET_CSV_URL);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'User-Agent': 'KWSC-MCP-Server/2.0' }
    };
    let data = '';
    const req = https.request(options, res => {
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Sheet fetch timeout')); });
    req.end();
  });
}

// Parse CSV from Google Sheet into array of objects
function parseSheetCSV(csv) {
  const lines = csv.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Parse a CSV line handling quoted fields
  function parseLine(line) {
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

  const headers = parseLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    rows.push(row);
  }
  return rows;
}

// Map Google Sheet row to our standard record format
// Sheet column order (from googleSheetsClient.ts):
// A=Record ID, B=Tracking ID, C=CFO Diary No, D=Receiving No, E=Employee No,
// F=Inward Date, G=Main Category, H=Sub Category, I=Received From,
// J=Subject, K=Mark To, L=Gross Amount, M=Deduction, N=Net Amount,
// O=Outward Date, P=Remarks, Q=Received From (file_purpose), R=Budget Code,
// S=Handover Person, T=Date of Sign, U=Vehicle No, V=Voucher Code,
// W=Registration Date, X=Inward Time
function sheetRowToRecord(row) {
  return {
    id: row['Record ID'] || row['A'] || '',
    tracking_id: row['Tracking ID'] || row['B'] || '',
    cfo_diary_number: row['CFO Diary No'] || row['C'] || '',
    receiving_number: row['Receiving No'] || row['D'] || '',
    employee_number: row['Employee No'] || row['E'] || '',
    inward_date: row['Inward Date'] || row['F'] || '',
    main_category: row['Main Category'] || row['G'] || '',
    sub_category: row['Sub Category'] || row['H'] || '',
    received_from: row['Received From'] || row['I'] || '',
    subject: row['Subject'] || row['J'] || '',
    mark_to: row['Mark To'] || row['K'] || '',
    gross_amount: row['Gross Amount'] || row['L'] || '',
    deduction: row['Deduction'] || row['M'] || '',
    amount: row['Net Amount'] || row['N'] || '',
    outward_date: row['Outward Date'] || row['O'] || '',
    remarks: row['Remarks'] || row['P'] || '',
    file_purpose: row['Received From (Purpose)'] || row['Q'] || '',
    budget_code: row['Budget Code'] || row['R'] || '',
    handover_person_name: row['Handover Person'] || row['S'] || '',
    date_of_sign: row['Date of Sign'] || row['T'] || '',
    vehicle_no: row['Vehicle No'] || row['U'] || '',
    voucher_code: row['Voucher Code'] || row['V'] || '',
    created_at: row['Registration Date'] || row['W'] || '',
  };
}

// Fetch from Google Sheet (fallback)
async function fetchFromSheet() {
  const csv = await fetchGoogleSheetCSV();
  const rows = parseSheetCSV(csv);
  // Filter out ghost/empty rows
  return rows
    .map(sheetRowToRecord)
    .filter(r => r.cfo_diary_number || r.receiving_number || r.subject);
}

// ---- Tool Implementations ----

async function handleGetTodaySummary() {
  const today = getLocalDateString();
  let records = [];
  let source = 'Supabase';

  try {
    const startOfDay = `${today}T00:00:00.000Z`;
    const { data, count, error } = await withTimeout(
      supabase
        .from('file_tracking_records')
        .select('id, tracking_id, cfo_diary_number, receiving_number, subject, main_category, sub_category, received_from, amount, inward_date, outward_date, mark_to, created_at', { count: 'exact' })
        .or(`created_at.gte.${startOfDay},inward_date.eq.${today}`)
        .order('created_at', { ascending: false }),
      10000
    );
    if (error) throw new Error(error.message);
    records = data || [];
  } catch (err) {
    // Supabase unavailable — fallback to Google Sheet
    source = 'Google Sheet (Supabase paused)';
    const allRecords = await fetchFromSheet();
    records = allRecords.filter(r => {
      const inwardMatch = r.inward_date === today;
      const createdMatch = r.created_at && r.created_at.startsWith(today);
      return inwardMatch || createdMatch;
    });
  }

  if (records.length === 0) {
    return `📅 Aaj (${today}) KWSC system me abhi tak koi nayi file enter nahi hui hai.\n\n[Source: ${source}]`;
  }

  const categoryCount = {};
  for (const r of records) {
    const cat = r.main_category || 'Uncategorized';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  }

  const breakdownStr = Object.entries(categoryCount)
    .map(([cat, cnt]) => `• ${cat}: ${cnt} files`)
    .join('\n');

  const filesList = records.slice(0, 15).map((r, i) =>
    `${i + 1}. [${r.cfo_diary_number || 'N/A'}] (Rec: ${r.receiving_number || 'N/A'}) - ${r.subject || 'No Subject'} | Amt: ${r.amount ? 'PKR ' + Number(r.amount).toLocaleString('en-PK') : 'Nill'} | From: ${r.received_from || 'N/A'}`
  ).join('\n');

  return `📅 Aaj (${today}) ki Files Summary:\n\n• Total Files Entered Today: ${records.length}\n\n📊 Category Breakdown:\n${breakdownStr}\n\n📋 Recent Files Entered Today:\n${filesList}${records.length > 15 ? `\n...aur mazeed ${records.length - 15} files shamil hain.` : ''}\n\n[Source: ${source}]`;
}

async function handleGetRecords(args = {}) {
  const { limit = 25, category, date, search } = args;
  const maxLimit = Math.min(limit, 100);
  let records = [];
  let source = 'Supabase';

  try {
    let query = supabase
      .from('file_tracking_records')
      .select('id, tracking_id, cfo_diary_number, receiving_number, subject, main_category, sub_category, received_from, file_purpose, amount, inward_date, outward_date, mark_to, created_at')
      .order('created_at', { ascending: false })
      .limit(maxLimit);

    if (category) query = query.ilike('main_category', `%${category}%`);
    if (date) {
      const targetDate = date.toLowerCase() === 'today' ? getLocalDateString() : date;
      query = query.or(`created_at.gte.${targetDate}T00:00:00.000Z,inward_date.eq.${targetDate}`);
    }
    if (search) {
      query = query.or(`cfo_diary_number.ilike.%${search}%,receiving_number.ilike.%${search}%,subject.ilike.%${search}%,received_from.ilike.%${search}%`);
    }

    const { data, error } = await withTimeout(query, 10000);
    if (error) throw new Error(error.message);
    records = data || [];
  } catch (err) {
    source = 'Google Sheet (Supabase paused)';
    let allRecords = await fetchFromSheet();

    if (category) allRecords = allRecords.filter(r => (r.main_category || '').toLowerCase().includes(category.toLowerCase()));
    if (date) {
      const targetDate = date.toLowerCase() === 'today' ? getLocalDateString() : date;
      allRecords = allRecords.filter(r => r.inward_date === targetDate || (r.created_at || '').startsWith(targetDate));
    }
    if (search) {
      const s = search.toLowerCase();
      allRecords = allRecords.filter(r =>
        (r.cfo_diary_number || '').toLowerCase().includes(s) ||
        (r.receiving_number || '').toLowerCase().includes(s) ||
        (r.subject || '').toLowerCase().includes(s) ||
        (r.received_from || '').toLowerCase().includes(s)
      );
    }
    records = allRecords.slice(0, maxLimit);
  }

  const formatted = records.map(r => ({
    cfo_diary_number: r.cfo_diary_number || "",
    receiving_number: r.receiving_number || "",
    tracking_id: r.tracking_id || "",
    subject: r.subject || "",
    main_category: r.main_category || "",
    sub_category: r.sub_category || "",
    received_from: r.received_from || r.file_purpose || "",
    amount: r.amount ? Number(r.amount) : 0,
    inward_date: r.inward_date || "",
    status: r.outward_date ? `Outwarded (${r.outward_date})` : 'Active',
    mark_to: r.mark_to || ""
  }));

  return `[Source: ${source}]\n\n` + JSON.stringify(formatted, null, 2);
}

async function handleExportToExcel(args = {}) {
  const { category, status, limit = 50000, customFileName } = args;
  let allRecords = [];
  let source = 'Supabase';

  try {
    let query = supabase
      .from('file_tracking_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (category) query = query.ilike('main_category', `%${category}%`);
    if (status) {
      if (status.toLowerCase().includes('outward')) query = query.not('outward_date', 'is', null);
      else if (status.toLowerCase().includes('active')) query = query.is('outward_date', null);
    }

    const maxRecords = Math.min(limit, 50000);
    let page = 0;
    const pageSize = 1000;

    while (allRecords.length < maxRecords) {
      const from = page * pageSize;
      const to = Math.min(from + pageSize - 1, maxRecords - 1);
      const { data, error } = await withTimeout(query.range(from, to), 15000);
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) break;
      allRecords = allRecords.concat(data);
      if (data.length < pageSize) break;
      page++;
    }
  } catch (err) {
    source = 'Google Sheet (Supabase paused)';
    allRecords = await fetchFromSheet();
    if (category) allRecords = allRecords.filter(r => (r.main_category || '').toLowerCase().includes(category.toLowerCase()));
    if (status) {
      if (status.toLowerCase().includes('outward')) allRecords = allRecords.filter(r => r.outward_date);
      else if (status.toLowerCase().includes('active')) allRecords = allRecords.filter(r => !r.outward_date);
    }
  }

  if (allRecords.length === 0) {
    return "No file tracking records found matching the given filters.";
  }

  const formattedRows = allRecords.map((r, i) => ({
    "S.No": i + 1,
    "CFO Diary No": r.cfo_diary_number || "",
    "Receiving No": r.receiving_number || "",
    "Tracking ID": r.tracking_id || "",
    "Employee No": r.employee_number || "",
    "Subject": r.subject || "",
    "Main Category": r.main_category || "",
    "Sub Category": r.sub_category || "",
    "Received From": r.received_from || r.file_purpose || "",
    "Mark To (Section)": r.mark_to || "",
    "Net Amount (PKR)": r.amount !== null && r.amount !== undefined && r.amount !== '' ? Number(r.amount) : "",
    "Gross Amount (PKR)": r.gross_amount ? Number(r.gross_amount) : "",
    "Deduction (PKR)": r.deduction ? Number(r.deduction) : "",
    "Inward Date": r.inward_date || "",
    "Status": r.outward_date ? `Outwarded (${r.outward_date})` : "Active",
    "Remarks": r.remarks || "",
    "Handover Person": r.handover_person_name || "",
    "Budget Code": r.budget_code || "",
    "Voucher Code": r.voucher_code || "",
    "Vehicle No": r.vehicle_no || "",
    "Date of Sign": r.date_of_sign || "",
    "Outward Date": r.outward_date || "",
    "Registration Date": r.created_at ? new Date(r.created_at).toLocaleDateString('en-GB') : ""
  }));

  const worksheet = xlsx.utils.json_to_sheet(formattedRows);
  const colWidths = Object.keys(formattedRows[0]).map(key => {
    const maxLen = Math.max(key.length, ...formattedRows.slice(0, 50).map(row => String(row[key] || '').length));
    return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
  });
  worksheet['!cols'] = colWidths;

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "File Tracking");

  const desktopDir = path.join(os.homedir(), 'Desktop');
  const targetDir = fs.existsSync(desktopDir) ? desktopDir : os.homedir();

  const timestampStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = customFileName
    ? customFileName.replace(/\.xlsx$/i, '')
    : `KWSC_File_Tracking_${timestampStr}`;
  const finalFilePath = path.join(targetDir, `${baseName}.xlsx`);

  xlsx.writeFile(workbook, finalFilePath);

  return `✅ Excel File Exported Successfully!\n\n📁 File Path: ${finalFilePath}\n📊 Total Records: ${allRecords.length}\n📡 Data Source: ${source}\n🕒 Export Time: ${new Date().toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}\n\nAap is file ko Desktop par open kar sakte hain!`;
}

async function handleSearchFile(args = {}) {
  const { query: q } = args;
  if (!q) return "Search query is required.";
  let records = [];
  let source = 'Supabase';

  try {
    const { data, error } = await withTimeout(
      supabase
        .from('file_tracking_records')
        .select('id, tracking_id, cfo_diary_number, receiving_number, subject, main_category, sub_category, received_from, amount, inward_date, outward_date, mark_to')
        .or(`cfo_diary_number.ilike.%${q}%,receiving_number.ilike.%${q}%,tracking_id.ilike.%${q}%,subject.ilike.%${q}%`)
        .limit(5),
      10000
    );
    if (error) throw new Error(error.message);
    records = data || [];
  } catch (err) {
    source = 'Google Sheet (Supabase paused)';
    const allRecords = await fetchFromSheet();
    const ql = q.toLowerCase();
    records = allRecords.filter(r =>
      (r.cfo_diary_number || '').toLowerCase().includes(ql) ||
      (r.receiving_number || '').toLowerCase().includes(ql) ||
      (r.tracking_id || '').toLowerCase().includes(ql) ||
      (r.subject || '').toLowerCase().includes(ql)
    ).slice(0, 5);
  }

  if (!records || records.length === 0) return `No file found matching: "${q}"\n[Source: ${source}]`;
  return `[Source: ${source}]\n\n` + JSON.stringify(records, null, 2);
}

async function handleGetSummary() {
  let source = 'Supabase';
  try {
    const [totalRes, outRes, activeRes] = await Promise.all([
      withTimeout(supabase.from('file_tracking_records').select('*', { count: 'exact', head: true }), 10000),
      withTimeout(supabase.from('file_tracking_records').select('*', { count: 'exact', head: true }).not('outward_date', 'is', null), 10000),
      withTimeout(supabase.from('file_tracking_records').select('*', { count: 'exact', head: true }).is('outward_date', null), 10000),
    ]);
    if (totalRes.error) throw new Error(totalRes.error.message);
    return `📊 KWSC File Tracking Summary:\n\n• Total Records: ${totalRes.count || 0}\n• Active / In-Process: ${activeRes.count || 0}\n• Outwarded: ${outRes.count || 0}\n\n[Source: ${source}]`;
  } catch (err) {
    source = 'Google Sheet (Supabase paused)';
    const allRecords = await fetchFromSheet();
    const outwarded = allRecords.filter(r => r.outward_date).length;
    const active = allRecords.length - outwarded;

    const catBreakdown = {};
    for (const r of allRecords) {
      const cat = r.main_category || 'Other';
      catBreakdown[cat] = (catBreakdown[cat] || 0) + 1;
    }
    const catStr = Object.entries(catBreakdown).map(([k, v]) => `  • ${k}: ${v}`).join('\n');

    return `📊 KWSC File Tracking Summary:\n\n• Total Records: ${allRecords.length}\n• Active / In-Process: ${active}\n• Outwarded: ${outwarded}\n\n📁 Category Breakdown:\n${catStr}\n\n[Source: ${source}]`;
  }
}

// ---- Tool Schemas ----
const TOOLS = [
  {
    name: "get_today_files_summary",
    description: "Get the count and details of all files entered today in the KWSC system. Works even if Supabase is paused (falls back to Google Sheet).",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "get_file_tracking_records",
    description: "Fetch file tracking records from KWSC database. Works even if Supabase is paused (falls back to Google Sheet).",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max records to return (default: 25, max: 100)" },
        category: { type: "string", description: "Filter by: 'contractor', 'employee', 'pol_bills', 'others'" },
        date: { type: "string", description: "Date filter: 'today' or 'YYYY-MM-DD'" },
        search: { type: "string", description: "Search in Diary No, Receiving No, Subject, Received From" }
      }
    }
  },
  {
    name: "export_file_tracking_to_excel",
    description: "Export file tracking records to Excel (.xlsx) on Desktop. Works even if Supabase is paused (falls back to Google Sheet).",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Optional: 'contractor', 'employee', 'pol_bills', 'others'" },
        status: { type: "string", description: "Optional: 'Active' or 'Outwarded'" },
        limit: { type: "number", description: "Max rows (default: all, up to 50,000)" },
        customFileName: { type: "string", description: "Optional file name, e.g. 'Report.xlsx'" }
      }
    }
  },
  {
    name: "search_file",
    description: "Find a specific file by CFO Diary No, Receiving No, or Subject. Works even if Supabase is paused.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "CFO Diary No, Receiving No, or keywords" } },
      required: ["query"]
    }
  },
  {
    name: "get_file_summary",
    description: "Get overall stats: total files, active, outwarded, category breakdown. Works even if Supabase is paused.",
    inputSchema: { type: "object", properties: {} }
  }
];

// ---- MCP stdio protocol loop ----
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', async (line) => {
  if (!line.trim()) return;
  let id = null;
  try {
    const request = JSON.parse(line);
    id = request.id;
    const { method, params } = request;

    if (method === "initialize") {
      sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "kwsc-file-tracking", version: "2.0.0" }
      });
      return;
    }

    if (method === "notifications/initialized" || method === "notifications/cancelled") return;
    if (method === "ping") { sendResponse(id, {}); return; }

    if (method === "tools/list") {
      sendResponse(id, { tools: TOOLS });
      return;
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      let resultText = "";

      if (toolName === "get_today_files_summary") resultText = await handleGetTodaySummary();
      else if (toolName === "get_file_tracking_records") resultText = await handleGetRecords(toolArgs);
      else if (toolName === "export_file_tracking_to_excel") resultText = await handleExportToExcel(toolArgs);
      else if (toolName === "search_file") resultText = await handleSearchFile(toolArgs);
      else if (toolName === "get_file_summary") resultText = await handleGetSummary();
      else { sendError(id, -32601, `Tool not found: ${toolName}`); return; }

      sendResponse(id, { content: [{ type: "text", text: resultText }] });
      return;
    }

    sendError(id, -32601, `Method not supported: ${method}`);
  } catch (err) {
    if (id !== null && id !== undefined) {
      sendResponse(id, {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true
      });
    }
  }
});

process.stderr.write(`[KWSC MCP v2.0] Server started — Supabase + Google Sheet fallback ready\n`);
