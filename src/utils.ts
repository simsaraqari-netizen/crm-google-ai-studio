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
  if (v.includes('بدل')) return 'بدل';
  if (v.includes('ايجار') || v.includes('اجار') || v.includes('للايجار')) return 'ايجار';
  if (v.includes('شراء') || v.includes('شراي')) return 'شراء';
  if (v.includes('مستاجر')) return 'مستأجر';
  if (v.includes('بيع') || v.includes('للبيع')) return 'بيع';
  return '';
}

export function inferType(value?: string): string {
  const v = normalizeArabic(String(value || '').toLowerCase());
  if (!v) return '';
  if (v.includes('ارض')) return 'أرض';
  if (v.includes('بيت')) return 'بيت';
  if (v.includes('قسيمه') && v.includes('مبني')) return 'قسيمة مبنية';
  if (v.includes('شقه') || v.includes('دور')) return 'شقة | دور';
  if (v.includes('عماره')) return 'عمارة';
  if (v.includes('شاليه')) return 'شالية';
  if (v.includes('مزرعه')) return 'مزرعة';
  if (v.includes('استثماري')) return 'استثماري';
  if (v.includes('صناعي')) return 'صناعي';
  if (v.includes('مخزن')) return 'مخازن';
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
  const normalizedSource = normalizeArabic(source.toLowerCase());
  const normalizedQuery = normalizeArabic(query.toLowerCase());
  return normalizedSource.includes(normalizedQuery);
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
