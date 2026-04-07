import "dotenv/config";
import { readSheet, writeToSheet } from './src/services/googleSheetsService.ts';
import { extractDetailsFromName, normalizeDigits } from './src/utils.ts';

const SPREADSHEET_ID = '1hM6w17MweG7llut28DUqJJV2ImZcpEYWzZAeWVEWyYo';
const RANGE = 'Sheet1!A1:Z5000'; // Reading up to row 5000

async function fixSheet() {
  console.log('🚀 Starting Force Fix for Google Sheet...');
  
  try {
    const data = await readSheet(SPREADSHEET_ID, RANGE);
    if (!data || data.length === 0) {
      console.error('❌ Could not read data or sheet is empty.');
      return;
    }

    console.log(`📦 Read ${data.length} rows.`);
    const header = data[0];
    const rows = data.slice(1);
    
    // Mapping identified from browser subagent:
    // A:0 (Entry Date), B:1 (Name), I:8 (Sector)
    
    const updatedRows = rows.map((row, index) => {
      // Skip empty name rows
      const name = row[1];
      if (!name || name.trim() === '') return row;

      const normName = normalizeDigits(name);
      const extracted = extractDetailsFromName(normName);
      
      // Update Name with normalized digits
      row[1] = normName;

      // Update Sector (Column I, Index 8) if empty
      const currentSector = row[8] ? row[8].toString().trim() : '';
      if (!currentSector && extracted.sector) {
        console.log(`✅ Row ${index + 2}: Extracted Sector ${extracted.sector} from "${name}"`);
        row[8] = extracted.sector;
      }

      // Normalize digits for all other potentially numeric columns (Block, Street, etc.)
      // Block: K (10), Street: L (11), Avenue: M (12), Plot: N (13), House: O (14)
      [8, 10, 11, 12, 13, 14].forEach(idx => {
        if (row[idx]) row[idx] = normalizeDigits(row[idx].toString());
      });

      return row;
    });

    const finalData = [header, ...updatedRows];
    
    console.log('📤 Writing updated data back to Google Sheet...');
    await writeToSheet(SPREADSHEET_ID, RANGE, finalData);
    
    console.log('✨ SUCCESS! The sheet has been updated with English digits and extracted sectors.');
  } catch (error: any) {
    console.error('❌ Error during fix:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

fixSheet();
