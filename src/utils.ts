import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from './lib/supabaseClient';

export const triggerAutoSync = async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      await fetch('/api/sync/auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: session.access_token })
      });
    }
  } catch (err) {
    console.error("Auto-sync trigger error:", err);
  }
};

export function formatRelativeDate(date: any): string {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return formatDistanceToNow(d, { addSuffix: true, locale: ar });
  } catch (e) {
    return '';
  }
}

export function normalizeDigits(text: string): string {
  if (!text) return "";
  const arabicDigits: { [key: string]: string } = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
  };
  return text.replace(/[٠-٩۰-۹]/g, (d) => arabicDigits[d] || d);
}

export function getImageUrl(img: any): string {
  if (!img) return '';
  if (typeof img === 'string') {
    if (img.startsWith('[object')) return ''; // Catch sync errors
    return img;
  }
  return img.url || '';
}

export function isImageVideo(img: any): boolean {
  if (!img) return false;
  const actualUrl = typeof img === 'string' ? img : (img.url || '');
  if (!actualUrl) return false;
  
  if (typeof img !== 'string' && img.type === 'video') return true;
  
  const videoExtensions = ['.mp4', '.mov', '.webm', '.ogg', '.m4v'];
  const isVideoUrl = videoExtensions.some(ext => actualUrl.toLowerCase().endsWith(ext)) || 
                     actualUrl.includes('video') || 
                     actualUrl.startsWith('data:video/');
  
  return isVideoUrl;
}

export function normalizeArabic(text: string): string {
  if (!text) return "";
  // 1. تحويل الأرقام أولاً
  let normalized = normalizeDigits(text);
  
  // 2. تحويل الحروف العربية
  normalized = normalized
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652]/g, ""); // إزالة التشكيل
  
  return normalized;
}

export function cleanAreaName(name: string): string {
  if (!name) return "";
  let clean = name.replace(/(مدينة|ضاحية)\s+/g, "").trim();
  clean = clean.replace(/^[أإآ]/, 'ا'); // ignore hamza at the beginning

  // Abbreviations mapping
  if (clean === "ج س ع" || clean.includes(" س ع") && clean.includes("ج ")) clean = "جنوب سعد العبدالله";
  else if (clean === "ج ع م" || clean === "ج ع" || (clean.includes(" ع") && clean.includes("ج ")) || clean === "جنوب ع") clean = "جنوب عبدالله المبارك";
  else if (clean === "ش غ ص" || clean.includes(" غ ص") && clean.includes("ش ")) clean = "شمال غرب صليبيخات";
  else if (clean === "ج ص الاحمد" || clean === "ج ص ح" || clean.includes(" ص ح") && clean.includes("ج ")) clean = "جنوب صباح الاحمد";
  else if (clean === "غ ع م" || clean === "غ ع" || (clean.includes(" ع") && clean.includes("غ ")) || clean === "غرب ع") clean = "غرب عبدالله المبارك";
  else if (clean === "غرب") clean = "غرب عبدالله المبارك";
  else if (clean === "جنوب") clean = "جنوب عبدالله المبارك";
  else if (clean === "ص الاحمد") clean = "صباح الاحمد";

  if (clean === "شمال غرب الصليبخات" || clean === "شمال غرب صليبخات") clean = "شمال غرب صليبيخات";

  return clean;
}

export function inferArea(text: string): string {
  if (!text) return '';
  const normalized = normalizeArabic(text);

  // 1. Identify the primary part of the text (ignore everything after "مع" or "بدل مع")
  let primaryText = normalized;
  const exchangeTerms = ['مع', 'بدل مع', 'نبدل مع', 'نبدل', 'للبدل'];
  for (const term of exchangeTerms) {
    const termPos = normalized.indexOf(term);
    if (termPos !== -1 && termPos > 5) { // Ensure the term isn't at the very start
      primaryText = normalized.substring(0, termPos);
      break;
    }
  }

  // Import AREAS here to avoid circular dependency
  const { AREAS } = require('./constants');
  const allAreas = Array.from(new Set(Object.values(AREAS).flat())) as string[];

  // 2. Look for "في <area>" pattern in the primary part
  const inPatternMatch = primaryText.match(/في\s+([^\s]+(?:\s+[^\s]+)?)/);
  if (inPatternMatch) {
    const captured = cleanAreaName(inPatternMatch[1]);
    const normalizedCaptured = normalizeArabic(captured);
    const matchedArea = allAreas.find(a => 
      normalizeArabic(a).includes(normalizedCaptured) || 
      normalizedCaptured.includes(normalizeArabic(a))
    );
    if (matchedArea) return matchedArea;
  }

  // 3. Just look for any area name in the primary part, return the first one found
  for (const area of allAreas) {
    const normalizedArea = normalizeArabic(area);
    if (primaryText.includes(normalizedArea)) {
      return area;
    }
  }

  // 4. Fallback search in the whole text if not found in primary
  for (const area of allAreas) {
    const normalizedArea = normalizeArabic(area);
    if (normalized.includes(normalizedArea)) {
      return area;
    }
  }

  return '';
}

export function inferGovernorate(areaName: string, currentGov: string = ""): string {
  if (!areaName && !currentGov) return "محافظة غير محددة";
  
  const nArea = normalizeArabic(cleanAreaName(areaName));
  const nGov = normalizeArabic(currentGov);

  // Import AREAS here to avoid circular dependency issues at top-level
  const { AREAS } = require('./constants');
  
  if (nArea) {
    for (const gov of Object.keys(AREAS)) {
      if (AREAS[gov].some((x: string) => normalizeArabic(x).includes(nArea) || nArea.includes(normalizeArabic(x)))) {
        return gov;
      }
    }
  }

  // Fallback to text matching on currentGov
  const t = nGov || nArea;
  if (t.includes('عاصمه') || t.includes('عاصمة')) return 'محافظة العاصمة';
  if (t.includes('حولي')) return 'محافظة حولي';
  if (t.includes('فروانيه') || t.includes('فروانية') || t.includes('رابعه') || t.includes('رابعة')) return 'محافظة الفروانية';
  if (t.includes('مبارك')) return 'محافظة مبارك الكبير';
  if (t.includes('احمدي') || t.includes('عاشره') || t.includes('عاشرة')) return 'محافظة الأحمدي';
  if (t.includes('جهراء')) return 'محافظة الجهراء';
  if (t.includes('مطلاع')) return 'محافظة الجهراء';

  return 'محافظة غير محددة';
}


export function inferPurpose(text: string): string {
  if (!text) return '';
  const t = normalizeArabic(text);
  if (t.includes('بدل') || t.includes('للبدل') || t.includes('بدا') || t.includes('بيدل') || t.includes('يدل')) return 'بدل';
  if (t.includes('شرا') || t.includes('مشتري') || t.includes('يبي') || t.includes('مطلوب') || t.includes('للشراء')) return 'شراء';
  if (t.includes('مستاجر') || t.includes('يستاجر') || t.includes('يبحث عن ايجار') || t.includes('استئجار') || t.includes('استاجار')) return 'استئجار';
  if (t.includes('ايجار') || t.includes('تأجير') || t.includes('تاجير') || t.includes('للايجار')) return 'ايجار';
  if (t.includes('بيع') || t.includes('للبيع')) return 'بيع';
  return '';
}

export function inferType(text: string): string {
  if (!text) return '';
  const t = normalizeArabic(text);
  // Specific check for "طلب"
  if (t.includes('طلب')) return 'طلب';
  if (t.includes('ارض')) return 'ارض';
  if (t.includes('قسيمه') || t.includes('قسيمة') || t.includes('مبنيه') || t.includes('مبنية')) return 'قسيمة مبنية';
  if (t.includes('بيت حكومي') || t.includes('بيت حكومى') || t.includes('بيت')) return 'بيت حكومي';
  if (t.includes('شقه') || t.includes('شقة')) return 'شقة';
  if (t.includes('عماره') || t.includes('عمارة')) return 'عمارة';
  if (t.includes('استثماري') || t.includes('استثمار')) return 'استثماري';
  if (t.includes('تجاري') || t.includes('تجار')) return 'تجاري';
  if (t.includes('صناعي') || t.includes('صناعيه') || t.includes('حرفي')) return 'صناعي';
  if (t.includes('مخزن') || t.includes('مخازن')) return 'مخازن';
  if (t.includes('مزرعه') || t.includes('مزرعة')) return 'مزرعة';
  if (t.includes('شاليه') || t.includes('شالية')) return 'شالية';
  return '';
}

export function searchMatch(source: string, query: string): boolean {
  if (!query) return true;
  const normalizedSource = normalizeArabic(source.toLowerCase());
  const normalizedQuery = normalizeArabic(query.toLowerCase());
  
  const queryParts = normalizedQuery.split(/\s+/).filter(Boolean);
  
  // Split source into tokens (words/numbers) using non-alphanumeric/non-Arabic characters as boundaries
  // This effectively treats anything that isn't a letter or digit as a separator
  const sourceTokens = normalizedSource.split(/[^a-zA-Z0-9\u0600-\u06FF]+/).filter(Boolean);
  
  // Every part of the search query must exist as an EXACT token in the source
  return queryParts.every(part => sourceTokens.includes(part));
}

export function cleanPropertyName(name: string): string {
  if (!name) return "";
  // Define purpose words that may appear at the end of the name (to be removed from title)
  const purposeWords = [
    'بيع', 'للبيع', 'شراء', 'شراي', 'مشتري', 'مشترين', 'شرايين', 
    'بدل', 'للبدل', 'ايجار', 'إيجار', 'للايجار', 'للإيجار', 
    'استئجار', 'استاجار', 'طلب'
  ];
  // Trim whitespace
  let cleaned = name.trim();
  // Remove any trailing purpose word (case‑insensitive, handles variations and optional punctuation)
  const regex = new RegExp(`\\s+(?:(?:ل|ال)?(${purposeWords.join('|')}))[\\s.،,]*$`, 'i');
  cleaned = cleaned.replace(regex, '');
  
  // Standardize "م" as "منزل" (standalone m followed by space or number)
  cleaned = cleaned.replace(/\bم\s+(\d+|[٠-٩]+)/g, 'منزل $1');
  cleaned = cleaned.replace(/\s+م\s+/g, ' منزل ');

  // Collapse multiple spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}


export function generatePropertyTitle(property: any): string {
  if (!property) return "";
  const parts = [];
  
  // الاسم بعد تنظيفه من الكلمات المكررة
  if (property.name) {
    const cleanedName = cleanPropertyName(property.name);
    if (cleanedName) parts.push(cleanedName);
  }
  
  // الغرض - إذا كان مفقوداً، نحاول استخلاصه من الاسم
  let purpose = property.purpose;
  if (!purpose && property.name) {
    purpose = inferPurpose(property.name);
  }

  if (purpose) {
    let p = purpose.trim();
    if (p === 'بيع' || p === 'للبيع') p = 'للبيع';
    else if (p === 'إيجار' || p === 'ايجار') p = 'للايجار';
    else if (p === 'بدل' || p === 'للبدل') p = 'للبدل';
    else if (p === 'استئجار' || p.includes('مستاجر') || p.includes('مستأجر')) p = 'استئجار';
    else if (p.includes('مشترين') || p.includes('شرايين')) p = 'شراء';
    else if (p === 'شراي' || p === 'مشتري') { /* Keep as is */ }
    else if (p === 'شراء' || p === 'للشراء') p = 'شراء';
    else if (!p.startsWith('ل') && p !== 'شراء' && p !== 'شراي' && p !== 'مشتري' && p !== 'استئجار') p = 'ل' + p;
    
    parts.push(p);
  }
  
  // المنطقة مسبوقة بحرف في
  if (property.area) {
    parts.push(`في ${cleanAreaName(property.area)}`);
  }
  
  // النوع
  if (property.type) {
    parts.push(property.type);
  }
  
  // الموقع
  const addressParts = [];
  const ext = extractDetailsFromName(property.name);
  
  const sector = property.sector || ext.sector;
  const block = property.block || ext.block;
  const street = property.street || ext.street;
  const avenue = property.avenue || ext.avenue;
  const plot = property.plot_number || ext.plot_number;
  const house = property.house_number || ext.house_number;

  if (sector) addressParts.push(`قطاع ${sector}`);
  if (block) addressParts.push(`ق ${block}`);
  if (street) addressParts.push(`ش ${street}`);
  if (avenue) addressParts.push(`ج ${avenue}`);
  if (plot) addressParts.push(`قسيمة ${plot}`);
  if (house) addressParts.push(`منزل ${house}`);
  if (property.location) addressParts.push(property.location);
  
  if (addressParts.length > 0) {
    parts.push(addressParts.join(' '));
  }
  
  return parts.filter(Boolean).join(' ');
}

export function employeeIdToEmail(employeeId: string): string {
  const normalized = toEnglishNumerals(employeeId.trim().toLowerCase());
  return `${normalized}@realestate.com`;
}

export function usernameToEmail(username: string): string {
  const normalized = toEnglishNumerals(username.trim().toLowerCase());
  
  // If it's already an email, return it
  if (normalized.includes('@')) {
    return normalized;
  }

  if (
    normalized === 'simsaraqari@gmail.com' || 
    normalized === 'ادمن' || 
    normalized === 'admin'
  ) {
    return 'simsaraqari@gmail.com';
  }
  if (normalized === '65814909') {
    return '65814909@realestate.com';
  }
  if (normalized === '66155981') {
    return '66155981@realestate.com';
  }
  if (normalized === 'mostafasoliman550@gmail.com') {
    return 'mostafasoliman550@gmail.com';
  }
  
  // For other usernames, use a simple format if possible, or fallback to hex if it has non-ascii
  if (/^[a-zA-Z0-9._-]+$/.test(normalized)) {
    return `${normalized}@realestate.com`;
  }

  // Convert username to a valid email prefix using hex encoding
  const hex = Array.from(new TextEncoder().encode(normalized))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  return `${hex}@realestate.com`;
}

export function extractSpreadsheetId(input: string): string {
  if (!input) return "";
  const match = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : input.trim();
}

export function toEnglishNumerals(str: string): string {
  if (!str) return str;
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return str.replace(/[٠-٩]/g, function(w) {
    return arabicNumbers.indexOf(w).toString();
  });
}

export const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          resolve(blob as Blob);
        }, 'image/jpeg', 0.6);
      };
    };
  });
};

export const formatDateTime = (date: any) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${hours}:${minutes} | ${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
};

export const formatPropertyDate = (date: any) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const minutes = d.getMinutes().toString().padStart(2, '0');
    
    return `${hours}:${minutes} | ${day}/${month}/${year}`;
  } catch (e) {
    return '';
  }
};

export function cleanNameText(text: string): string {
  if (!text) return "";
  let clean = text.trim();
  
  // Suffixes that are often redundant if they appear earlier
  const redundantSuffixes = ["طلب", "عرض", "للبيع", "للبدل", "للايجار", "مشترى", "شراء", "شراي", "مشترين", "شرايين", "شراية", "مطلوب", "للشراء"];
  
  let changed = true;
  while (changed) {
    changed = false;
    for (const word of redundantSuffixes) {
      const lastWordRegex = new RegExp(`\\s*${word}$`, 'i');
      if (lastWordRegex.test(clean)) {
        const remainingText = clean.replace(lastWordRegex, "").trim();
        // Only remove if it's already present earlier in the text or it's a very common redundant suffix
        if (normalizeArabic(remainingText).includes(normalizeArabic(word)) || remainingText.length > 3) {
           // We are more aggressive now: if there's enough text left, remove the redundant suffix
           clean = remainingText;
           changed = true;
        }
      }
    }
  }
  
  return clean;
}

/**
 * Advanced cleaning that uses the property's other fields to remove redundancies from the name
 */
export function cleanNameWithContext(name: string, area: string, purpose: string, type: string): string {
  if (!name) return "";
  let clean = name.trim();

  // 1. Map of purpose variations
  const purposeMap: { [key: string]: string[] } = {
    'شراء': ['شراء', 'للشراء', 'شراي', 'شراية', 'مشترك', 'مشتري', 'مطلوب', 'مشترين', 'شرايين'],
    'بدل': ['بدل', 'للبدل', 'تبديل'],
    'بيع': ['بيع', 'للبيع', 'بياع'],
    'ايجار': ['ايجار', 'للايجار', 'تاجير', 'تأجير', 'للإيجار'],
    'استئجار': ['استئجار', 'مستاجر', 'مستأجر', 'استاجار']
  };

  const currentPurposeTokens = purposeMap[purpose] || [];
  const nArea = normalizeArabic(area || "");
  const nType = normalizeArabic(type || "");

  // Tokenize
  let tokens = clean.split(/\s+/);
  if (tokens.length <= 1) return clean; // Don't wipe out single-word names

  // 2. Filter tokens by comparing with context
  tokens = tokens.filter((token, index) => {
    const nToken = normalizeArabic(token);
    
    // Skip very short tokens unless they are the only thing
    if (nToken.length <= 1) return true;

    // Remove if it's a redundant purpose word
    if (purpose && currentPurposeTokens.some(p => normalizeArabic(p) === nToken)) {
      return false;
    }
    
    // Remove if it matches the type
    if (type && nType.includes(nToken) && nToken.length > 2) {
      return false;
    }

    // Remove if it matches the area name (only if at the end of the string)
    if (area && nArea.includes(nToken) && index >= tokens.length - 2 && nToken.length > 2) {
      // Avoid removing "عبدالله" if the area is "عبدالله المبارك" but it's part of a person's name
      // But usually if it's at the very end, it's the area redundancy
      return false;
    }

    return true;
  });

  clean = tokens.join(' ').trim();
  
  // 3. Final cleanup for common garbage left at the end
  const trailingGarbage = ["في", "منطقة", "المنطقة", "عرض", "طلب"];
  for (const word of trailingGarbage) {
    const reg = new RegExp(`\\s+${word}$`, 'i');
    if (reg.test(clean)) {
      clean = clean.replace(reg, "").trim();
    }
  }

  return clean;
}

export function extractDetailsFromName(name: string) {
  if (!name) return {};
  const normalized = normalizeArabic(name);
  const details: any = {};

  // Extract Block (ق)
  const blockMatch = normalized.match(/(?:ق|قطعه|قطعة)\s*(\d+)/);
  if (blockMatch) details.block = blockMatch[1];

  // Extract Street (ش)
  const streetMatch = normalized.match(/(?:ش|شارع)\s*(\d+)/);
  if (streetMatch) details.street = streetMatch[1];

  // Extract Avenue (جاده|جادة|ج)
  const avenueMatch = normalized.match(/(?:جاده|جادة|ج)\s*(\d+)/);
  if (avenueMatch) details.avenue = avenueMatch[1];

  // Extract Plot (قسيمه|قسيمة)
  const plotMatch = normalized.match(/(?:قسيمه|قسيمة)\s*(\d+)/);
  if (plotMatch) details.plot_number = plotMatch[1];

  // Extract House (منزل|م)
  const houseMatch = normalized.match(/(?:منزل|\bم)\s*(\d+)/);
  if (houseMatch) details.house_number = houseMatch[1];

  // Extract Sector (قطاع | ان)
  const sectorMatch = normalized.match(/(?:قطاع|ان)\s*(\d+)/);
  if (sectorMatch) details.sector = sectorMatch[1];

  return details;
}
