import "dotenv/config";
import { syncSupabaseWithSheets } from "./src/services/syncService.ts";

async function testSync() {
  console.log("--- Starting Sync Test ---");
  try {
    // This will use the logic in syncService.ts which handles
    // reading from the sheet, prioritizing, and updating Supabase.
    // It uses SUPABASE_SERVICE_ROLE_KEY and GOOGLE_SHEETS_CREDENTIALS from .env
    await syncSupabaseWithSheets();
    console.log("--- Sync Test Completed Successfully ---");
  } catch (error) {
    console.error("--- Sync Test Failed ---", error);
  }
}

testSync();
