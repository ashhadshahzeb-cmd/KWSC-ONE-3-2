import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const SPREADSHEET_ID = '1tLCMQ3wrDOiOqI21miNWhFq26IlhmOGT9k0h-LMtO6E';
const CREDS_PATH = path.resolve('whatsapp-service', 'google-service-account.json');

async function formatGoogleSheet() {
  console.log('Connecting to Google Sheets API for design upgrade...');
  const credentials = JSON.parse(fs.readFileSync(CREDS_PATH, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });

  const requests = [];

  // Column width definitions
  const colWidths = [
    { start: 0, end: 1, width: 165 },  // Timestamp
    { start: 1, end: 2, width: 140 },  // CFO Diary No
    { start: 2, end: 3, width: 120 },  // Receiving No
    { start: 3, end: 4, width: 130 },  // Tracking ID
    { start: 4, end: 5, width: 110 },  // Employee No
    { start: 5, end: 6, width: 280 },  // Subject
    { start: 6, end: 7, width: 130 },  // Main Category
    { start: 7, end: 8, width: 160 },  // Sub Category
    { start: 8, end: 9, width: 190 },  // Received From
    { start: 9, end: 10, width: 120 }, // Mark To
    { start: 10, end: 11, width: 140 },// Net Amount PKR
    { start: 11, end: 12, width: 115 },// Inward Date
    { start: 12, end: 13, width: 120 },// Status
    { start: 13, end: 14, width: 220 },// Remarks
    { start: 14, end: 15, width: 100 },// Record ID
    { start: 15, end: 16, width: 160 },// Handover Person
    { start: 16, end: 17, width: 220 },// File Purpose
    { start: 17, end: 18, width: 120 },// Reg Date
    { start: 18, end: 19, width: 120 },// Print Date
    { start: 19, end: 20, width: 130 },// Additional Mark To
    { start: 20, end: 21, width: 140 },// Gross Amount
    { start: 21, end: 22, width: 130 },// Deduction
    { start: 22, end: 30, width: 120 } // Budget Code, Voucher, etc.
  ];

  for (const sheet of meta.data.sheets) {
    const sheetId = sheet.properties.sheetId;
    const title = sheet.properties.title;

    // Header color scheme per category group
    let headerColor = { red: 0.08, green: 0.12, blue: 0.2 }; // Slate Master
    if (title.startsWith('Contractor')) {
      headerColor = { red: 0.12, green: 0.26, blue: 0.58 }; // Navy Blue
    } else if (title.startsWith('Employee')) {
      headerColor = { red: 0.04, green: 0.42, blue: 0.3 }; // Emerald Green
    } else if (title.includes('POL')) {
      headerColor = { red: 0.52, green: 0.25, blue: 0.06 }; // Dark Amber
    }

    // 1. Freeze Row 1
    requests.push({
      updateSheetProperties: {
        properties: {
          sheetId,
          gridProperties: {
            frozenRowCount: 1
          }
        },
        fields: 'gridProperties.frozenRowCount'
      }
    });

    // 2. Format Header Row (Row 1): Background color, bold white text, vertical center
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 30
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: headerColor,
            textFormat: {
              foregroundColor: { red: 1, green: 1, blue: 1 },
              bold: true,
              fontSize: 10
            },
            verticalAlignment: 'MIDDLE',
            wrapStrategy: 'WRAP'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)'
      }
    });

    // Row Height for Header
    requests.push({
      updateDimensionProperties: {
        range: {
          sheetId,
          dimension: 'ROWS',
          startIndex: 0,
          endIndex: 1
        },
        properties: {
          pixelSize: 38
        },
        fields: 'pixelSize'
      }
    });

    // 3. Format Data Rows: Font size 10, vertical alignment middle
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 30
        },
        cell: {
          userEnteredFormat: {
            textFormat: {
              fontSize: 10
            },
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(textFormat.fontSize,verticalAlignment)'
      }
    });

    // 4. Set professional column widths
    for (const cw of colWidths) {
      requests.push({
        updateDimensionProperties: {
          range: {
            sheetId,
            dimension: 'COLUMNS',
            startIndex: cw.start,
            endIndex: cw.end
          },
          properties: {
            pixelSize: cw.width
          },
          fields: 'pixelSize'
        }
      });
    }

    // 5. Currency formatting for Net Amount (Col 10), Gross Amount (Col 20), Deduction (Col 21)
    const amountCols = [10, 20, 21];
    for (const cIdx of amountCols) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            startColumnIndex: cIdx,
            endColumnIndex: cIdx + 1
          },
          cell: {
            userEnteredFormat: {
              numberFormat: {
                type: 'NUMBER',
                pattern: '#,##0'
              },
              horizontalAlignment: 'RIGHT'
            }
          },
          fields: 'userEnteredFormat(numberFormat,horizontalAlignment)'
        }
      });
    }

    // 6. Center alignment for IDs and Dates (Diary No, Receiving No, Tracking ID, Dates)
    const centerCols = [0, 1, 2, 3, 4, 11, 12, 17, 18];
    for (const cIdx of centerCols) {
      requests.push({
        repeatCell: {
          range: {
            sheetId,
            startRowIndex: 1,
            startColumnIndex: cIdx,
            endColumnIndex: cIdx + 1
          },
          cell: {
            userEnteredFormat: {
              horizontalAlignment: 'CENTER'
            }
          },
          fields: 'userEnteredFormat(horizontalAlignment)'
        }
      });
    }
  }

  console.log(`Executing design update with ${requests.length} formatting actions...`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests }
  });

  console.log('✨ Google Sheet design formatting completed successfully!');
}

formatGoogleSheet().catch(console.error);
