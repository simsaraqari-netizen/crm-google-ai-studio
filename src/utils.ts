import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { AREAS } from './constants';

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

export function normalizeHamza(text: string): string {
  if (!text) return "";
  return normalizeDigits(text).replace(/[أإآ]/g, "ا");
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
  return name.replace(/مدينة\s+/g, "").trim();
}

export function splitMultiValue(value: any): string[] {
  return String(value || '')
    .split(/[,\n،;|/]+/g)
    .map(part => part.trim())
    .filter(Boolean);
}

export function inferGovernorate(areaValue?: string, fallbackGovernorate?: string): string {
  const fallback = (fallbackGovernorate || '').trim();
  const areas = splitMultiValue(areaValue || '').map(a => normalizeArabic(cleanAreaName(a)));
  if (areas.length === 0) return fallback;

  for (const governorate of Object.keys(AREAS)) {
    const known = AREAS[governorate].map(a => normalizeArabic(cleanAreaName(a)));
    const matched = areas.some(a => known.includes(a));
    if (matched) return governorate;
  }
  return fallback;
}

export function inferPurpose(value?: string): string {
  const v = normalizeArabic(String(value || '').toLowerCase());
  if (!v) return '';
  // بدل أولاً لأنه قد يحتوي على كلمة بيع
  if (v.includes('بدل')) return 'بدل';
  if (v.includes('ايجار') || v.includes('اجار') || v.includes('للايجار') || v.includes('استيجار')) return 'ايجار';
  if (v.includes('مستاجر')) return 'مستأجر';
  if (v.includes('شراء') || v.includes('شراي') || v.includes('شري') || v.includes('سراء') || v.includes('شراي')) return 'شراء';
  if (v.includes('بيع') || v.includes('للبيع')) return 'بيع';
  return '';
}

export function inferType(value?: string): string {
  const v = normalizeArabic(String(value || '').toLowerCase());
  if (!v) return '';
  // ترتيب مهم: المركّب قبل البسيط
  if (v.includes('بيت') && v.includes('حكومي')) return 'بيت حكومي';
  if ((v.includes('قسيمه') || v.includes('قسيمة')) && (v.includes('مبني') || v.includes('مبنيه') || v.includes('مبنية'))) return 'قسيمة مبنية';
  if (v.includes('ارض') || v.includes('أرض')) return 'ارض';
  if (v.includes('بيت')) return 'بيت';
  if (v.includes('عماره') || v.includes('عمارة')) return 'عمارة';
  if (v.includes('شاليه') || v.includes('شالية')) return 'شالية';
  if (v.includes('مزرعه') || v.includes('مزرعة')) return 'مزرعة';
  if (v.includes('استثماري')) return 'استثماري';
  if (v.includes('تجاري')) return 'تجاري';
  if (v.includes('طلب')) return 'طلب';
  return '';
}

export function cleanNameText(name: any): string {
  return String(name || '').replace(/\s+/g, ' ').trim();
}

export function cleanNameWithContext(name: any, purpose?: string, type?: string): string {
  const cleaned = cleanNameText(name);
  if (cleaned) return cleaned;
  const p = inferPurpose(purpose) || cleanNameText(purpose);
  const t = inferType(type) || cleanNameText(type);
  return [p, t].filter(Boolean).join(' ').trim();
}

export function searchMatch(source: string, query: string): boolean {
  if (!query) return true;
  const normalizedSource = normalizeArabic(source.toLowerCase());
  const normalizedQuery = normalizeArabic(query.toLowerCase());
  
  // Split both source and query into tokens primarily by whitespace and major separators
  const sourceTokens = normalizedSource.split(/[\s,،;؛|]+/).filter(Boolean);
  const queryTokens = normalizedQuery.split(/[\s,،;؛|]+/).filter(Boolean);
  
  if (queryTokens.length === 0) return true;
  
  // Every word/token in the query must match one of the tokens in the source exactly
  return queryTokens.every(qToken => sourceTokens.includes(qToken));
}

export function generatePropertyTitle(property: any): string {
  if (!property) return "";
  return property.name || 'عقار بدون اسم';
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
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('فشل تحميل الصورة'));
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
        if (!ctx) return reject(new Error('فشل إنشاء سياق الرسم'));
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('فشل ضغط الصورة'));
          resolve(blob);
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

/**
 * Returns the stored 4-digit property code if present,
 * otherwise derives a stable 4-digit display code from the UUID.
 * Uniqueness is guaranteed only for newly created properties
 * (where property_code is stored in the DB).
 */
export function getPropertyCode(property: any): string {
  if (property?.property_code) return String(property.property_code).padStart(4, '0');
  if (!property?.id) return '----';
  // Deterministic fallback from UUID bytes
  const hex = (property.id as string).replace(/-/g, '');
  const a = parseInt(hex.slice(0, 2), 16);
  const b = parseInt(hex.slice(8, 10), 16);
  const c = parseInt(hex.slice(16, 18), 16);
  const d = parseInt(hex.slice(24, 26), 16);
  const code = (((a ^ c) * 97 + (b ^ d) * 31) % 9000) + 1000;
  return String(code);
}

/**
 * Generates a unique 4-digit code not already in use by
 * the provided list of existing properties.
 */
export function generateUniqueCode(existingProperties: any[]): string {
  const used = new Set(
    existingProperties
      .map(p => p.property_code)
      .filter(Boolean)
      .map(String)
  );
  let attempts = 0;
  while (attempts < 5000) {
    const code = String(Math.floor(Math.random() * 9000) + 1000);
    if (!used.has(code)) return code;
    attempts++;
  }
  // Fallback: 5-digit if 4-digit space exhausted
  return String(Math.floor(Math.random() * 90000) + 10000);
}

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
