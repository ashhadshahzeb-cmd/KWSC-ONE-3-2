import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SPREADSHEET_ID = '1tLCMQ3wrDOiOqI21miNWhFq26IlhmOGT9k0h-LMtO6E';
const CREDS_PATH = path.resolve('whatsapp-service', 'google-service-account.json');

async function setupSubCategoryTabs() {
  console.log('Connecting to Google Sheets API...');
  const credentials = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive']
  });

  const sheets = google.sheets({ version: 'v4', auth });

  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingMap = new Map();
  meta.data.sheets.forEach(s => existingMap.set(s.properties.title, s.properties.sheetId));
  console.log('Existing sheets:', Array.from(existingMap.keys()));

  const subCategoryTabs = [
    // --- CONTRACTOR SUB-CATEGORIES ---
    {
      title: 'Contractor - Bills',
      color: { red: 0.12, green: 0.35, blue: 0.8 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'contractor' AND (lower(Col8) contains 'bill')", 1)`
    },
    {
      title: 'Contractor - Contingencies',
      color: { red: 0.2, green: 0.45, blue: 0.85 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'contractor' AND lower(Col8) contains 'contingenc'", 1)`
    },
    {
      title: 'Contractor - Security Deposit',
      color: { red: 0.3, green: 0.55, blue: 0.9 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'contractor' AND lower(Col8) contains 'security'", 1)`
    },

    // --- EMPLOYEE SUB-CATEGORIES ---
    {
      title: 'Employee - Salary & Arrears',
      color: { red: 0.05, green: 0.65, blue: 0.4 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'employee' AND (lower(Col8) contains 'salar' or lower(Col8) contains 'arrear')", 1)`
    },
    {
      title: 'Employee - Pension',
      color: { red: 0.1, green: 0.72, blue: 0.45 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'employee' AND lower(Col8) contains 'pension'", 1)`
    },
    {
      title: 'Employee - Funds',
      color: { red: 0.15, green: 0.78, blue: 0.5 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'employee' AND lower(Col8) contains 'fund'", 1)`
    },
    {
      title: 'Employee - Fixation & Cader',
      color: { red: 0.2, green: 0.82, blue: 0.55 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'employee' AND (lower(Col8) contains 'fixation' or lower(Col8) contains 'cader')", 1)`
    },
    {
      title: 'Employee - Loans & Advances',
      color: { red: 0.25, green: 0.85, blue: 0.6 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'employee' AND (lower(Col8) contains 'loan' or lower(Col8) contains 'advance' or lower(Col8) contains 'house')", 1)`
    },
    {
      title: 'Employee - LPR & Leaves',
      color: { red: 0.3, green: 0.88, blue: 0.65 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'employee' AND (lower(Col8) contains 'lpr' or lower(Col8) contains 'leave')", 1)`
    },
    {
      title: 'Employee - Daily Wages',
      color: { red: 0.35, green: 0.9, blue: 0.7 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'employee' AND lower(Col8) contains 'wage'", 1)`
    },
    {
      title: 'Employee - Others & Misc',
      color: { red: 0.4, green: 0.92, blue: 0.75 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'employee' AND NOT (lower(Col8) contains 'salar' or lower(Col8) contains 'pension' or lower(Col8) contains 'fund' or lower(Col8) contains 'fixation' or lower(Col8) contains 'cader' or lower(Col8) contains 'loan' or lower(Col8) contains 'advance' or lower(Col8) contains 'house' or lower(Col8) contains 'lpr' or lower(Col8) contains 'leave' or lower(Col8) contains 'wage')", 1)`
    },

    // --- POL BILLS ---
    {
      title: 'POL Bills',
      color: { red: 0.96, green: 0.62, blue: 0.04 },
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE lower(Col7) contains 'pol' or lower(Col8) contains 'pol'", 1)`
    }
  ];

  // Create any tabs that don't exist yet
  const requests = [];
  for (const tab of subCategoryTabs) {
    if (!existingMap.has(tab.title)) {
      requests.push({
        addSheet: {
          properties: {
            title: tab.title,
            tabColor: tab.color,
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }
      });
    }
  }

  // Also remove redundant broad tabs if user wants purely sub-category breakdown
  const redundantTabs = ['Contractor', 'Employee', 'Others & Contingencies'];
  for (const rTab of redundantTabs) {
    if (existingMap.has(rTab)) {
      requests.push({
        deleteSheet: {
          sheetId: existingMap.get(rTab)
        }
      });
    }
  }

  if (requests.length > 0) {
    console.log(`Executing batch update with ${requests.length} requests...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { requests }
    });
    console.log('Tabs structure updated.');
  }

  // Update formula in cell A1 for each sub-category tab
  for (const tab of subCategoryTabs) {
    console.log(`Setting formula for: ${tab.title}`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${tab.title}'!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[tab.formula]]
      }
    });
  }

  console.log('All sub-category tabs successfully set up!');
}

setupSubCategoryTabs().catch(console.error);
