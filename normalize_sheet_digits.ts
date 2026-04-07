import "dotenv/config";
import { readSheet, writeToSheet } from './src/services/googleSheetsService.ts';

function normalizeDigits(text: string): string {
  if (!text) return "";
  const arabicDigits: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  return text.replace(/[٠-٩۰-۹]/g, (d) => arabicDigits[d] || d);
}

const spreadsheetId = '1hM6w17MweG7llut28DUqJJV2ImZcpEYWzZAeWVEWyYo';
const range = 'Sheet1!A1:Z5000';

async function cleanup() {
  console.log('[CLEANUP] Reading sheet data...');
  const data = await readSheet(spreadsheetId, range);
  
  if (!data || !Array.isArray(data)) {
    console.log('[CLEANUP] No data found in the sheet.');
    return;
  }

  console.log(`[CLEANUP] Processing ${data.length} rows...`);
  
  const optimizedData = data.map(row => 
    row.map(cell => {
      if (typeof cell === 'string') {
        const normalized = normalizeDigits(cell);
        if (normalized !== cell) {
            // Track changes if needed
        }
        return normalized;
      }
      return cell;
    })
  );

  console.log('[CLEANUP] Writing normalized data back to sheet...');
  await writeToSheet(spreadsheetId, range, optimizedData);
  console.log('[CLEANUP] Success! All Arabic digits have been converted to English digits in the sheet.');
}

cleanup().catch(err => {
  console.error('[CLEANUP] Error during cleanup:', err);
  process.exit(1);
});
