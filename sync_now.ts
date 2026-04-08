import 'dotenv/config';
import { syncSupabaseWithSheets } from './src/services/syncService.ts';

async function runSync() {
  console.log('--- STARTING MANUAL SYNC ---');
  try {
    await syncSupabaseWithSheets();
    console.log('--- SYNC COMPLETED ---');
  } catch (error) {
    console.error('--- SYNC FAILED ---', error);
  }
}

runSync();
