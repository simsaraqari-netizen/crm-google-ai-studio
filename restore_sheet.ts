import "dotenv/config";
import { createClient } from '@supabase/supabase-js';
import { google } from "googleapis";
import { normalizeDigits } from "./src/utils.ts";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS || '{}');
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

const spreadsheetId = '1hM6w17MweG7llut28DUqJJV2ImZcpEYWzZAeWVEWyYo';
const range = 'Sheet1!A1:Z5000';

async function restore() {
  try {
    console.log('--- EMERGENCY RESTORATION START ---');
    console.log('1. Fetching from Supabase...');
    
    let allProps: any[] = [];
    let from = 0;
    const step = 1000;
    let fetchMore = true;

    while (fetchMore) {
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false })
        .range(from, from + step - 1);

      if (error) throw error;
      if (data && data.length > 0) {
        allProps = [...allProps, ...data];
        from += step;
        console.log(`   Fetched ${allProps.length} properties...`);
      } else {
        fetchMore = false;
      }
    }

    console.log(`2. Total properties to restore: ${allProps.length}`);
    if (allProps.length < 4000) {
      console.error('Warning: Expected ~4011 properties, but found fewer. Aborting for safety.');
      return;
    }

    const header = [
      "ID", "الاسم", "المحافظة", "المنطقة", "النوع", "الغرض", "تليفون",
      "المسؤول الرقمي", "المسؤول", "الصور", "الروابط", 
      "رابط الموقع", "مباع؟", "القطاع", "القطعة", "الشارع", "الجادة", 
      "القسيمة", "المنزل", "الموقع", "التفاصيل", "آخر تعليق", 
      "حالة الحجز", "بواسطة", "تاريخ الإضافة"
    ];

    const writeData = [
      header,
      ...allProps.map(p => [
        p.id,
        normalizeDigits(p.name || ''),
        normalizeDigits(p.governorate || ''),
        normalizeDigits(p.area || ''),
        normalizeDigits(p.type || ''),
        normalizeDigits(p.purpose || ''),
        normalizeDigits(p.phone || ''),
        p.assigned_employee_id || '',
        normalizeDigits(p.assigned_employee_name || ''),
        (p.images || []).map((img: any) => typeof img === 'string' ? img : (img.url || '')).filter(Boolean).join(','),
        (p.links || []).join(','),
        p.location_link || '',
        p.is_sold ? "مباع" : "متاح",
        normalizeDigits(p.sector || ''),
        normalizeDigits(p.block || ''),
        normalizeDigits(p.street || ''),
        normalizeDigits(p.avenue || ''),
        normalizeDigits(p.plot_number || ''),
        normalizeDigits(p.house_number || ''),
        normalizeDigits(p.location || ''),
        normalizeDigits(p.details || ''),
        normalizeDigits(p.last_comment || ''),
        normalizeDigits(p.status_label || ''),
        normalizeDigits(p.created_by || ''),
        new Date(p.created_at).toLocaleString('ar-KW')
      ])
    ];

    console.log('3. Writing to Google Sheet...');
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: { values: writeData },
    });

    console.log('--- RESTORATION COMPLETE SUCCESSFULLY ---');
    console.log(`Sheet updated with ${allProps.length} properties.`);
  } catch (e) {
    console.error('CRITICAL ERROR DURING RESTORATION:', e);
  }
}

restore();
