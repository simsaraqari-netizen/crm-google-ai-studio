import { createClient } from '@supabase/supabase-js';
import { readSheet, writeToSheet } from './googleSheetsService.ts';
import { cleanAreaName, inferGovernorate, inferPurpose, inferType, cleanNameText, cleanNameWithContext, normalizeDigits, extractDetailsFromName } from '../utils.ts';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const syncSupabaseWithSheets = async () => {
  console.log('[SYNC] Starting Google Sheets Sync at', new Date().toISOString());

  try {
    // 1. Get the target spreadsheet ID
    const { data: settings, error: settingsError } = await supabaseAdmin.from('settings').select('spreadsheet_id').eq('id', 1).single();
    
    if (settingsError || !settings?.spreadsheet_id) {
      console.log('[SYNC] No spreadsheet_id found in settings. Skipping sync.');
      return;
    }
    
    const spreadsheetId = settings.spreadsheet_id;
    const range = 'Sheet1!A1:Z5000'; // Default range

    // ============================================
    // STEP A: SYNC FROM SHEET TO SUPABASE
    // ============================================
    console.log('[SYNC] Reading sheet data...');
    const sheetData = await readSheet(spreadsheetId, range);
    
    if (sheetData && Array.isArray(sheetData)) {
      const startIdx = (sheetData[0] && sheetData[0][0] === 'ID') ? 1 : 0;
      
      for (let i = startIdx; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.length < 2) continue;
        
        const [
          created_atStr, name, purpose, phone, phone2, area, type, 
          governorate, sector, distribution, block, street, avenue, 
          plot_number, house_number, details, last_comment
        ] = row;

        if (!name || name.trim() === '') continue;

        const cleanVal = (val: string) => {
          if (!val) return '';
          let v = normalizeDigits(val); // Always convert digits first
          v = v.replace(/resedintal|residental|residential/gi, '').trim();
          // Standardize standalone "م" contextually
          v = v.replace(/\bم\s+(\d+)/g, 'منزل $1');
          return v;
        };

        const cPurpose = cleanVal(purpose);
        const cType = cleanVal(type);
        const cName = cleanVal(name);
        const cArea = cleanAreaName(cleanVal(area));

        let newPurpose = cPurpose;
        let newType = cType;

        if (!newPurpose || !inferPurpose(newPurpose)) {
          newPurpose = inferPurpose(cPurpose) || inferPurpose(cType) || inferPurpose(cName);
        }
        
        if (!newType || !inferType(newType)) {
          newType = inferType(cType) || inferType(cPurpose) || inferType(cName);
        }

        const newGov = inferGovernorate(cArea, cleanVal(governorate));

        // Deduplicate name using contextual metadata
        let finalName = cleanNameWithContext(cName, cArea, newPurpose, newType);
        finalName = cleanNameText(finalName);

        const propertyData: any = {
          name: finalName,
          governorate: newGov,
          area: cArea,
          type: newType,
          purpose: newPurpose,
          phone: cleanVal(phone),
          sector: cleanVal(sector) || extractDetailsFromName(cName).sector || '',
          block: cleanVal(block) || extractDetailsFromName(cName).block || '',
          street: cleanVal(street) || extractDetailsFromName(cName).street || '',
          avenue: cleanVal(avenue) || extractDetailsFromName(cName).avenue || '',
          plot_number: cleanVal(plot_number) || extractDetailsFromName(cName).plot_number || '',
          house_number: cleanVal(house_number) || extractDetailsFromName(cName).house_number || '',
          details: cleanVal(details) || row[15] || '', // Using index since destructuring might miss some
          updated_at: new Date().toISOString()
        };

        // Add additional fields if they exist
        if (last_comment) propertyData.last_comment = cleanVal(last_comment);
        if (created_atStr) propertyData.created_at = new Date(created_atStr).toISOString();

        // Find existing property in Supabase by name and area to avoid duplicates if ID is missing
        const { data: existing } = await supabaseAdmin.from('properties')
          .select('id')
          .eq('name', finalName)
          .eq('area', cArea)
          .maybeSingle();

        if (existing) {
          await supabaseAdmin.from('properties').update(propertyData).eq('id', existing.id);
        } else {
          await supabaseAdmin.from('properties').insert({ ...propertyData });
        }
      }
      console.log('[SYNC] Successfully imported data from Sheets.');
    }

    // ============================================
    // STEP B: SYNC FROM SUPABASE TO SHEET
    // ============================================
    console.log('[SYNC] Overwriting sheet with latest Supabase data...');
    
    let allProps: any[] = [];
    let from = 0;
    let step = 1000;
    let fetchMore = true;

    while (fetchMore) {
      const { data: dbData, error: dbError } = await supabaseAdmin
        .from('properties')
        .select('*')
        .eq('is_deleted', false)
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .range(from, from + step - 1);
        
      if (dbError) throw dbError;
      if (dbData && dbData.length > 0) {
        allProps = [...allProps, ...dbData];
        from += step;
        if (dbData.length < step) fetchMore = false;
      } else {
        fetchMore = false;
      }
    }

    const header = [
      "تاريخ الادخال", "الاسم", "الغرض", "الهاتف", "الهاتف 2", "المنطقة", "نوع العقار", 
      "المحافظة", "القطاع", "التوزيعة", "القطعة", "الشارع", "الجادة", 
      "رقم القسيمة", "المنزل", "التفاصيل", "آخر تعليق"
    ];

    const writeData = [
      header,
      ...allProps.map(p => [
        p.created_at ? new Date(p.created_at).toLocaleString('ar-KW') : '',
        normalizeDigits(p.name || ''),
        normalizeDigits(p.purpose || ''),
        normalizeDigits(p.phone || ''),
        '', // Phone 2 (not in DB yet)
        normalizeDigits(p.area || ''),
        normalizeDigits(p.type || ''),
        normalizeDigits(p.governorate || ''),
        normalizeDigits(p.sector || ''),
        '', // Distribution (not in DB yet)
        normalizeDigits(p.block || ''),
        normalizeDigits(p.street || ''),
        normalizeDigits(p.avenue || ''),
        normalizeDigits(p.plot_number || ''),
        normalizeDigits(p.house_number || ''),
        normalizeDigits(p.details || ''),
        normalizeDigits(p.last_comment || '')
      ])
    ];

    await writeToSheet(spreadsheetId, range, writeData);
    console.log('[SYNC] Sync process completed successfully!');
  } catch (e: any) {
    console.error('[SYNC] Error during synchronization:', e);
  }
};
