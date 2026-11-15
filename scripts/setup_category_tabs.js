import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SPREADSHEET_ID = '1tLCMQ3wrDOiOqI21miNWhFq26IlhmOGT9k0h-LMtO6E';
const CREDS_PATH = path.resolve('whatsapp-service', 'google-service-account.json');

async function setupCategoryTabs() {
  console.log('Connecting to Google Sheets API...');
  const credentials = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive'
    ]
  });

  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Get existing sheets
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const existingSheets = meta.data.sheets.map(s => s.properties.title);
  console.log('Existing sheets:', existingSheets);

  const targetTabs = [
    {
      title: 'Contractor',
      color: { red: 0.12, green: 0.25, blue: 0.69 }, // Blue
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE Col7 IS NOT NULL AND lower(Col7) contains 'contractor'", 1)`
    },
    {
      title: 'Employee',
      color: { red: 0.06, green: 0.72, blue: 0.51 }, // Green
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE Col7 IS NOT NULL AND lower(Col7) contains 'employee'", 1)`
    },
    {
      title: 'POL Bills',
      color: { red: 0.96, green: 0.62, blue: 0.04 }, // Amber
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE Col7 IS NOT NULL AND (lower(Col7) contains 'pol' or lower(Col8) contains 'pol')", 1)`
    },
    {
      title: 'Others & Contingencies',
      color: { red: 0.55, green: 0.36, blue: 0.96 }, // Purple
      formula: `=QUERY(Sheet1!A:AD, "SELECT * WHERE Col7 IS NOT NULL AND (lower(Col7) contains 'other' or lower(Col7) contains 'imprest' or lower(Col7) contains 'contingenc')", 1)`
    }
  ];

  // 2. Create missing tabs
  const requests = [];
  for (const tab of targetTabs) {
    if (!existingSheets.includes(tab.title)) {
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

  if (requests.length > 0) {
    console.log(`Adding ${requests.length} new tabs...`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { requests }
    });
    console.log('New tabs created successfully.');
  } else {
    console.log('All category tabs already exist.');
  }

  // 3. Set QUERY formulas in cell A1 of each tab
  for (const tab of targetTabs) {
    console.log(`Setting formula for ${tab.title}...`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${tab.title}'!A1`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[tab.formula]]
      }
    });
    console.log(`✓ ${tab.title} formula updated.`);
  }

  console.log('Category tabs setup complete!');
}

setupCategoryTabs().catch(console.error);
