import "dotenv/config";
import { readSheet, writeToSheet } from './src/services/googleSheetsService.ts';
import { extractDetailsFromName, normalizeDigits } from './src/utils.ts';

const spreadsheetId = '1hM6w17MweG7llut28DUqJJV2ImZcpEYWzZAeWVEWyYo';
const range = 'Sheet1!A1:Z5000';

// Mapping Column B to Name, Column I to Sector
const COL_NAME = 1;   // B
const COL_SECTOR = 8; // I (Index 8)

async function populateSectors() {
  console.log('[SECTORS] Reading sheet data...');
  const data = await readSheet(spreadsheetId, range);
  
  if (!data || !Array.isArray(data)) {
    console.log('[SECTORS] No data found.');
    return;
  }

  const header = data[0];
  console.log(`[SECTORS] Header: ${JSON.stringify(header)}`);
  console.log(`[SECTORS] Processing ${data.length - 1} data rows...`);

  let updateCount = 0;
  const newData = [...data];

  for (let i = 1; i < newData.length; i++) {
    const row = newData[i];
    if (!row || row.length < 2) continue;

    const name = row[COL_NAME];
    const currentSector = row[COL_SECTOR];

    // Ignore empty Name
    if (!name || name.trim() === '') continue;

    // Fill only if sector is empty
    if (!currentSector || currentSector.trim() === '') {
      const details = extractDetailsFromName(name);
      if (details.sector) {
        // Ensure Sector column exists in the row array
        if (row.length <= COL_SECTOR) {
          while (row.length <= COL_SECTOR) row.push('');
        }
        row[COL_SECTOR] = details.sector;
        updateCount++;
      }
    }
  }

  if (updateCount > 0) {
    console.log(`[SECTORS] Writing ${updateCount} updates back to sheet...`);
    await writeToSheet(spreadsheetId, range, newData);
    console.log(`[SECTORS] Success! Filled ${updateCount} sectors.`);
  } else {
    console.log('[SECTORS] No sectors were missing or could be extracted.');
  }
}

populateSectors().catch(err => {
  console.error('[SECTORS] Error:', err);
  process.exit(1);
});
