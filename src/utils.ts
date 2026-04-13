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

export function unifyAbuName(name: string): string {
  if (!name) return "";
  // 1. Basic Arabic normalization (normalize digits, hamzas, etc.)
  const normalized = normalizeArabic(name.trim());
  // 2. Targeted "Abu" normalization:
  // If it starts with "ابو " (normalized from "أبو " or "ابو "), remove the space.
  return normalized.replace(/^ابو\s+/g, "ابو");
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

export function searchMatch(source: string, query: string, property?: any): boolean {
  if (!query) return true;
  
  const normalizedQuery = normalizeArabic(query.toLowerCase().replace(/#/g, ''));
  const queryTokens = normalizedQuery.split(/[\s,،;؛|]+/).filter(Boolean);
  if (queryTokens.length === 0) return true;

  // 1. Check for exact property code match (High Priority)
  // If the query is a 4-digit number and matches the property code exactly, it's a direct hit.
  if (property && property.property_code) {
    const code = String(property.property_code);
    if (queryTokens.some(t => t === code)) return true;
  }

  // 2. Normalize source for general search
  const normalizedSource = normalizeArabic(source.toLowerCase());
  const sourceTokens = normalizedSource.split(/[\s,،;؛|]+/).filter(Boolean);
  
  // 3. Strict Phone Search
  // If a token is 8 digits, it's very likely a phone number. Check for exact match in phone fields.
  const isPhoneSearch = queryTokens.some(t => /^\d{8}$/.test(t));
  if (isPhoneSearch && property) {
    const p1 = String(property.phone || '').replace(/\s/g, '');
    const p2 = String(property.phone_2 || '').replace(/\s/g, '');
    return queryTokens.some(t => t === p1 || t === p2);
  }

  // 4. Default partial matching for other cases
  return queryTokens.every(qToken => 
    sourceTokens.some(sToken => sToken.includes(qToken)) || 
    normalizedSource.includes(qToken)
  );
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

  // Normalize Abu name format for email generation
  const nameOnly = unifyAbuName(normalized);

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
  if (/^[a-zA-Z0-9._-]+$/.test(nameOnly)) {
    return `${nameOnly}@realestate.com`;
  }

  // Convert username to a valid email prefix using hex encoding
  const hex = Array.from(new TextEncoder().encode(nameOnly))
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
  // Timeout safety: if canvas.toBlob hangs, fall back to original file after 8s
  return Promise.race([
    new Promise<Blob>((resolve, reject) => {
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
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
          } else {
            if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(file); return; }
          ctx.drawImage(img, 0, 0, width, height);
          canvas.toBlob((blob) => {
            resolve(blob || file);
          }, 'image/jpeg', 0.7);
        };
      };
    }),
    // Fallback: if compression hangs for 8 seconds, use original file
    new Promise<Blob>((resolve) => setTimeout(() => resolve(file), 8000))
  ]);
};

export const formatDateTime = (date: any) => {
  if (!date) return '';
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    // Requested format: 13:15 3-3-2026
    return `${hours}:${minutes} ${day}-${month}-${year}`;
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
  
  // Use a better mixing function (FNV-1a like) to reduce collisions
  const hex = (property.id as string).replace(/-/g, '');
  let hash = 2166136261;
  for (let i = 0; i < hex.length; i += 2) {
    const byte = parseInt(hex.slice(i, i + 2), 16) || 0;
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  const code = (Math.abs(hash) % 9000) + 1000;
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

/**
 * Generates and triggers download of a vCard (.vcf) file for a contact.
 * This works on both desktop and mobile (iOS/Android) browsers.
 */
export function exportToVCard(name: string, phones: string[], notes: string = '') {
  const vcfContent = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${name}`,
    ...phones.filter(Boolean).map(phone => `TEL;TYPE=CELL:${phone.replace(/\s+/g, '')}`),
    `NOTE:${notes.replace(/\n/g, '\\n')}`,
    'PRODID:-//Musadaqa Real Estate CRM//EN',
    'END:VCARD'
  ].join('\n');

  const blob = new Blob([vcfContent], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  
  // Clean filename: replace spaces with underscores and remove special characters
  const safeName = name.replace(/[^\u0600-\u06FFa-zA-Z0-9]/g, '_');
  link.download = `${safeName}.vcf`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
