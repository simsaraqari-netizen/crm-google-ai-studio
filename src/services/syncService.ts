import { createClient } from '@supabase/supabase-js';
import { readSheet, writeToSheet } from './googleSheetsService.ts';
import { cleanAreaName, inferGovernorate, inferPurpose, inferType, cleanNameText, cleanNameWithContext, normalizeDigits, splitMultiValue } from '../utils.ts';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const KNOWN_EMPLOYEE_ALIASES = [
  'ابوبدر',
  'ابو بدر',
  'ابوحفني',
  'ابو حفني',
  'ابوادم',
  'ابو ادم',
  'ابوزياد',
  'ابو زياد',
  'ابوفارس',
  'ابو فارس',
  'مصادقة',
  'ابومروان',
  'ابو مروان',
  'ابوسارة',
  'ابو سارة',
  'ابواحمد',
  'ابو احمد',
  'ام احمد',
];

function normalizeLoose(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim();
}

function toArabicDigits(input: string): string {
  const map: Record<string, string> = {
    '0': '٠',
    '1': '١',
    '2': '٢',
    '3': '٣',
    '4': '٤',
    '5': '٥',
    '6': '٦',
    '7': '٧',
    '8': '٨',
    '9': '٩',
  };
  return String(input).replace(/[0-9]/g, d => map[d] ?? d);
}

function parseIssueDate(value: any): Date | null {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const iso = raw.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const dmy = raw.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const y = Number(dmy[3]);
    const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  return null;
}

function formatDateArabic(date: Date): string {
  const d = date.getUTCDate();
  const m = date.getUTCMonth() + 1;
  const y = date.getUTCFullYear();
  return `${toArabicDigits(String(d))}-${toArabicDigits(String(m))}-${toArabicDigits(String(y))}`;
}

function extractSheetComment(rawBlock: any, rawDate: any, rawInterviewer: any) {
  const block = String(rawBlock || '').trim();
  const issueDate =
    parseIssueDate(rawDate) ||
    parseIssueDate(block.match(/ISSUE\s*DATE\s*:\s*([0-9\-\/]+)/i)?.[1]) ||
    parseIssueDate(block.match(/تاريخ\s*[:：]\s*([0-9\-\/]+)/i)?.[1]);

  let textBody = String(rawInterviewer || block || '').trim();
  textBody = textBody
    .replace(/ISSUE\s*DATE\s*:\s*[0-9\-\/]+/gi, '')
    .replace(/INTERVIEWER\s*:\s*/gi, '')
    .replace(/تاريخ\s*[:：]\s*[0-9\-\/]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!textBody) return null;

  const finalText = issueDate ? `${formatDateArabic(issueDate)} - ${textBody}` : textBody;
  const createdAt = issueDate ? issueDate.toISOString() : null;
  return { finalText, createdAt, rawText: textBody };
}

async function syncSheetCommentsForProperty(
  propertyId: string,
  row: any[],
  readCell: (row: any[], aliases: string[], fallbackIndex: number) => any
) {
  const commentCells = [
    {
      raw: readCell(row, ['التعليق 1', 'تعليق 1', 'COMMENT 1', 'COMMENT1', 'comment 1'], 25),
      date: readCell(row, ['ISSUE DATE 1', 'تاريخ التعليق 1', 'تاريخ 1'], 26),
      interviewer: readCell(row, ['INTERVIEWER 1', 'المعلق 1', 'الموظف 1'], 27),
    },
    {
      raw: readCell(row, ['التعليق 2', 'تعليق 2', 'COMMENT 2', 'COMMENT2', 'comment 2'], 28),
      date: readCell(row, ['ISSUE DATE 2', 'تاريخ التعليق 2', 'تاريخ 2'], 29),
      interviewer: readCell(row, ['INTERVIEWER 2', 'المعلق 2', 'الموظف 2'], 30),
    },
    {
      raw: readCell(row, ['التعليق 3', 'تعليق 3', 'COMMENT 3', 'COMMENT3', 'comment 3'], 31),
      date: readCell(row, ['ISSUE DATE 3', 'تاريخ التعليق 3', 'تاريخ 3'], 32),
      interviewer: readCell(row, ['INTERVIEWER 3', 'المعلق 3', 'الموظف 3'], 33),
    },
  ];

  const { data: existingComments } = await supabaseAdmin
    .from('comments')
    .select('id,text,user_name,created_at')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: users } = await supabaseAdmin
    .from('user_profiles')
    .select('id,full_name,name')
    .in('role', ['employee', 'admin', 'super_admin']);

  const userPool = users || [];
  const insertedComments: Array<{ text: string; created_at: string }> = [];

  for (const cell of commentCells) {
    const parsed = extractSheetComment(cell.raw, cell.date, cell.interviewer);
    if (!parsed) continue;

    const textNorm = normalizeLoose(parsed.finalText);
    const duplicate = (existingComments || []).some((c: any) => normalizeLoose(c.text || '') === textNorm);
    if (duplicate) continue;

    const aliases = KNOWN_EMPLOYEE_ALIASES.filter(alias =>
      normalizeLoose(parsed.rawText).includes(normalizeLoose(alias))
    );
    const uniqueAliases = Array.from(new Set(aliases));

    const matchedUsers = userPool.filter((u: any) => {
      const name = normalizeLoose(u.full_name || u.name || '');
      return uniqueAliases.some(alias => name.includes(normalizeLoose(alias)));
    });

    const userNames = matchedUsers.length > 0
      ? matchedUsers.map((u: any) => u.full_name || u.name).filter(Boolean)
      : uniqueAliases;
    const userName = userNames.length > 0 ? Array.from(new Set(userNames)).join('، ') : 'مزامنة الشيت';
    const userId = matchedUsers.length === 1 ? matchedUsers[0].id : null;

    const payload: any = {
      property_id: propertyId,
      user_id: userId,
      user_name: userName,
      text: parsed.finalText,
      images: [],
      created_at: parsed.createdAt || new Date().toISOString(),
    };

    const { error } = await supabaseAdmin.from('comments').insert(payload);
    if (!error) {
      insertedComments.push({ text: parsed.finalText, created_at: payload.created_at });
    }
  }

  if (insertedComments.length > 0) {
    const latest = insertedComments.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
    await supabaseAdmin
      .from('properties')
      .update({ last_comment: latest.text, last_comment_at: latest.created_at })
      .eq('id', propertyId);
  }
}

const DEFAULT_SYNC_RANGE = 'Sheet1!A1:Z5000';

async function getSyncSettings() {
  const { data: settingsRows, error: settingsError } = await supabaseAdmin
    .from('settings')
    .select('id,spreadsheet_id')
    .in('id', ['sync', '1']);
  const settings = settingsRows && settingsRows.length > 0
    ? (settingsRows.find((row: any) => row.id === 'sync') || settingsRows.find((row: any) => row.id === '1') || settingsRows[0])
    : null;

  if (settingsError || !settings?.spreadsheet_id) return null;
  return { spreadsheetId: settings.spreadsheet_id as string, range: DEFAULT_SYNC_RANGE };
}

async function saveSyncSnapshot(params: {
  direction: 'app_to_sheet' | 'sheet_to_app' | 'rollback';
  spreadsheetId: string;
  range: string;
  payload: any[][];
  triggeredBy?: string;
  note?: string;
}) {
  const rowCount = Math.max(0, (params.payload?.length || 0) - 1);
  const { error } = await supabaseAdmin.from('sync_snapshots').insert({
    direction: params.direction,
    spreadsheet_id: params.spreadsheetId,
    sheet_range: params.range,
    payload: params.payload,
    row_count: rowCount,
    triggered_by: params.triggeredBy || null,
    note: params.note || null,
  });
  if (error) {
    // The table may not exist yet until migration is applied.
    console.warn('[SYNC] Snapshot insert skipped:', error.message);
  }
}

function buildSheetHeader() {
  return [
    "الاسم", "الغرض", "الهاتف", "الهاتف ٢", "المنطقة", "نوع العقار",
    "المحافظة", "القطاع", "التوزيعة", "القطعة", "الشارع", "الجادة",
    "رقم القسيمة", "المنزل", "الموقع", "رابط الموقع", "حالة العقار",
    "موظف الادخال", "تعليقات", "تعليقات ٢", "تعليقات ٣", "ID", "تاريخ الادخال"
  ];
}

async function buildSupabaseSheetPayload(): Promise<any[][]> {
  let allProps: any[] = [];
  let from = 0;
  const step = 1000;
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

  const header = buildSheetHeader();
  const rows = allProps.map(p => [
    normalizeDigits(p.name || ''),
    normalizeDigits(p.purpose || ''),
    normalizeDigits(p.phone || ''),
    normalizeDigits(p.phone_2 || ''),
    normalizeDigits(p.area || ''),
    normalizeDigits(p.type || ''),
    normalizeDigits(p.governorate || ''),
    normalizeDigits(p.sector || ''),
    normalizeDigits(p.distribution || ''),
    normalizeDigits(p.block || ''),
    normalizeDigits(p.street || ''),
    normalizeDigits(p.avenue || ''),
    normalizeDigits(p.plot_number || ''),
    normalizeDigits(p.house_number || ''),
    normalizeDigits(p.location || ''),
    p.location_link || '',
    normalizeDigits(p.status_label || ''),
    normalizeDigits(p.assigned_employee_name || ''),
    normalizeDigits(p.last_comment || ''),
    normalizeDigits(p.comments_2 || ''),
    normalizeDigits(p.comments_3 || ''),
    p.id,
    p.created_at ? new Date(p.created_at).toLocaleString('ar-KW') : '',
  ]);

  return [header, ...rows];
}

export async function syncAppToSheets(options?: { triggeredBy?: string; note?: string }) {
  const settings = await getSyncSettings();
  if (!settings) {
    console.log('[SYNC] No spreadsheet_id found in settings. Skipping app->sheet sync.');
    return;
  }
  const payload = await buildSupabaseSheetPayload();
  await writeToSheet(settings.spreadsheetId, settings.range, payload);
  await saveSyncSnapshot({
    direction: 'app_to_sheet',
    spreadsheetId: settings.spreadsheetId,
    range: settings.range,
    payload,
    triggeredBy: options?.triggeredBy,
    note: options?.note,
  });
}

export async function getSyncHistory(limit = 20) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const { data, error } = await supabaseAdmin
    .from('sync_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) {
    console.warn('[SYNC] History read skipped:', error.message);
    return [];
  }
  return data || [];
}

export async function rollbackSyncSnapshot(snapshotId: string, triggeredBy?: string) {
  const settings = await getSyncSettings();
  if (!settings) throw new Error('Spreadsheet settings are missing.');

  const { data: snapshot, error } = await supabaseAdmin
    .from('sync_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .single();
  if (error || !snapshot) throw new Error(error?.message || 'Snapshot not found.');

  const payload = Array.isArray(snapshot.payload) ? snapshot.payload : null;
  if (!payload || payload.length === 0) throw new Error('Snapshot payload is empty.');

  await writeToSheet(settings.spreadsheetId, settings.range, payload);
  await saveSyncSnapshot({
    direction: 'rollback',
    spreadsheetId: settings.spreadsheetId,
    range: settings.range,
    payload,
    triggeredBy,
    note: `rollback:${snapshotId}`,
  });

  // Align application data with the restored sheet version.
  await syncSupabaseWithSheets();
}

export const syncSupabaseWithSheets = async () => {
  console.log('[SYNC] Starting Google Sheets Sync at', new Date().toISOString());

  try {
    const settings = await getSyncSettings();
    if (!settings) {
      console.log('[SYNC] No spreadsheet_id found in settings. Skipping sync.');
      return;
    }

    const spreadsheetId = settings.spreadsheetId;
    const range = settings.range;

    // ============================================
    // STEP A: SYNC FROM SHEET TO SUPABASE
    // ============================================
    console.log('[SYNC] Reading sheet data...');
    const sheetData = await readSheet(spreadsheetId, range);
    if (sheetData && Array.isArray(sheetData) && sheetData.length > 0) {
      await saveSyncSnapshot({
        direction: 'sheet_to_app',
        spreadsheetId,
        range,
        payload: sheetData as any[][],
        note: 'sheet-priority-import',
      });
    }
    
    if (sheetData && Array.isArray(sheetData)) {
      const headerRow = (sheetData[0] || []).map((h: any) => String(h || '').trim());
      const startIdx = headerRow.length > 0 ? 1 : 0;
      const headerMap = new Map<string, number>();
      headerRow.forEach((h: string, i: number) => headerMap.set(h, i));

      const readCell = (row: any[], aliases: string[], fallbackIndex: number) => {
        for (const alias of aliases) {
          const idx = headerMap.get(alias);
          if (idx !== undefined) return row[idx];
        }
        return row[fallbackIndex];
      };
      
      for (let i = startIdx; i < sheetData.length; i++) {
        const row = sheetData[i];
        if (!row || row.length < 2) continue;
        
        const name = readCell(row, ['الاسم', 'name'], 0);
        const purpose = readCell(row, ['الغرض', 'purpose'], 1);
        const phone = readCell(row, ['الهاتف', 'phone'], 2);
        const phone_2 = readCell(row, ['الهاتف ٢', 'phone_2'], 3);
        const area = readCell(row, ['المنطقة', 'area'], 4);
        const type = readCell(row, ['نوع العقار', 'type'], 5);
        const governorate = readCell(row, ['المحافظة', 'governorate'], 6);
        const sector = readCell(row, ['القطاع', 'sector'], 7);
        const distribution = readCell(row, ['التوزيعة', 'distribution'], 8);
        const block = readCell(row, ['القطعة', 'block'], 9);
        const street = readCell(row, ['الشارع', 'street'], 10);
        const avenue = readCell(row, ['الجادة', 'avenue'], 11);
        const plot_number = readCell(row, ['رقم القسيمة', 'plot_number'], 12);
        const house_number = readCell(row, ['المنزل', 'house_number'], 13);
        const location = readCell(row, ['الموقع', 'location'], 14);
        const location_link = readCell(row, ['رابط الموقع', 'location_link'], 15);
        const status_label = readCell(row, ['حالة العقار', 'status_label'], 16);
        const assigned_employee_name = readCell(row, ['موظف الادخال', 'assigned_employee_name'], 17);
        const last_comment = readCell(row, ['تعليقات', 'last_comment'], 18);
        const comments_2 = readCell(row, ['تعليقات ٢', 'comments_2'], 19);
        const comments_3 = readCell(row, ['تعليقات ٣', 'comments_3'], 20);
        const id = readCell(row, ['ID', 'id'], 21);
        const created_atStr = readCell(row, ['تاريخ الادخال', 'created_at'], 22);

        // Fetch existing record to preserve fields if sheet is empty
        let existing: any = null;
        if (id) {
          const { data } = await supabaseAdmin.from('properties').select('*').eq('id', id).single();
          existing = data;
        }

        const cleanStr = (val: any) => {
          if (val === undefined || val === null || val === '') return '';
          return normalizeDigits(String(val)).trim();
        };

        // PRIORITY LOGIC: Use sheet if not empty, otherwise keep existing
        const getVal = (sheetVal: any, dbKey: string) => {
          const s = cleanStr(sheetVal);
          if (s) return s;
          return existing ? existing[dbKey] : '';
        };

        // Multi-value handling for Area and Governorate
        const rawArea = cleanStr(area);
        let finalArea = existing?.area || '';
        let finalGov = existing?.governorate || '';

        if (rawArea) {
          const areas = splitMultiValue(rawArea).map(cleanAreaName);
          finalArea = Array.from(new Set(areas)).join(', ');
          finalGov = inferGovernorate(finalArea, cleanStr(governorate));
        } else if (cleanStr(governorate)) {
          finalGov = cleanStr(governorate);
        }

        // Multi-employee handling
        const rawEmployeeName = cleanStr(assigned_employee_name);
        let finalEmployeeName = existing?.assigned_employee_name || '';
        if (rawEmployeeName) {
          const names = splitMultiValue(rawEmployeeName);
          finalEmployeeName = Array.from(new Set(names)).join(', ');
        }

        const cName = getVal(name, 'title');
        const cPurpose = getVal(purpose, 'purpose');
        const cType = getVal(type, 'type');

        // Infer missing purpose/type if needed
        let newPurpose = cPurpose;
        let newType = cType;
        if (!newPurpose || !inferPurpose(newPurpose)) {
          newPurpose = inferPurpose(cPurpose) || inferPurpose(cType) || inferPurpose(cName);
        }
        if (!newType || !inferType(newType)) {
          newType = inferType(cType) || inferType(cPurpose) || inferType(cName);
        }

        const propertyData: any = {
          name: cleanNameText(cName),
          governorate: finalGov,
          area: finalArea,
          type: newType || cType,
          purpose: newPurpose || cPurpose,
          phone: getVal(phone, 'phone'),
          phone_2: getVal(phone_2, 'phone_2'),
          assigned_employee_id: existing?.assigned_employee_id || null, // Keep existing if present
          assigned_employee_name: finalEmployeeName,
          location_link: getVal(location_link, 'location_link'),
          is_sold: existing?.is_sold || false, // Use existing as sheet doesn't have it explicitly yet
          sector: getVal(sector, 'sector'),
          distribution: getVal(distribution, 'distribution'),
          block: getVal(block, 'block'),
          street: getVal(street, 'street'),
          avenue: getVal(avenue, 'avenue'),
          plot_number: getVal(plot_number, 'plot_number'),
          house_number: getVal(house_number, 'house_number'),
          location: getVal(location, 'location'),
          details: getVal(last_comment, 'details'), // Map first comment to details for legacy
          status_label: getVal(status_label, 'status_label'),
          comments_2: getVal(comments_2, 'comments_2'),
          comments_3: getVal(comments_3, 'comments_3'),
          last_comment: cleanStr(last_comment)
        };

        if (created_atStr) propertyData.created_at = new Date(created_atStr).toISOString();

        let targetPropertyId = '';
        if (id) {
          const { error: updateError } = await supabaseAdmin.from('properties').update(propertyData).eq('id', id);
          if (updateError) {
             // Handle case where ID might not exist yet but was provided
            const { data: inserted } = await supabaseAdmin.from('properties').insert({ ...propertyData, id }).select('id').single();
            targetPropertyId = inserted?.id || id;
          } else {
            targetPropertyId = id;
          }
        } else {
          const { data: inserted } = await supabaseAdmin.from('properties').insert({ ...propertyData }).select('id').single();
          targetPropertyId = inserted?.id || '';
        }

        if (targetPropertyId) {
          await syncSheetCommentsForProperty(targetPropertyId, row, readCell);
        }
      }
      console.log('[SYNC] Successfully imported data from Sheets with Priority logic.');
    }
    console.log('[SYNC] Sync process completed successfully (Sheet -> Supabase only).');
  } catch (e: any) {
    console.error('[SYNC] Error during synchronization:', e);
  }
};
