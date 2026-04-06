import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

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
  return typeof img === 'string' ? img : img.url || '';
}

export function isImageVideo(img: any): boolean {
  if (!img) return false;
  if (typeof img === 'string') return img.startsWith('data:video/');
  return img.type === 'video';
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
  if (nGov.includes('عاصمه') || nGov.includes('عاصمة')) return 'محافظة العاصمة';
  if (nGov.includes('حولي')) return 'محافظة حولي';
  if (nGov.includes('فروانيه') || nGov.includes('فروانية') || nGov.includes('رابعه') || nGov.includes('رابعة')) return 'محافظة الفروانية';
  if (nGov.includes('مبارك')) return 'محافظة مبارك الكبير';
  if (nGov.includes('احمدي') || nGov.includes('عاشره') || nGov.includes('عاشرة')) return 'محافظة الأحمدي';
  if (nGov.includes('جهراء')) return 'محافظة الجهراء';
  if (nGov.includes('مطلاع')) return 'محافظة الجهراء';

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
  if (property.sector) addressParts.push(property.sector);
  if (property.block) addressParts.push(`ق ${property.block}`);
  if (property.street) addressParts.push(`ش ${property.street}`);
  if (property.plot_number) addressParts.push(`قسيمة ${property.plot_number}`);
  if (property.house_number) addressParts.push(`منزل ${property.house_number}`);
  if (property.location) addressParts.push(`موقع ${property.location}`);
  
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

export function extractDetailsFromName(name: string) {
  if (!name) return {};
  const normalized = normalizeArabic(name);
  const details: any = {};

  // Extract Block (ق)
  const blockMatch = normalized.match(/ق\s*(\d+)/);
  if (blockMatch) details.block = blockMatch[1];

  // Extract Street (ش)
  const streetMatch = normalized.match(/ش\s*(\d+)/);
  if (streetMatch) details.street = streetMatch[1];

  // Extract Avenue (جاده/جادة)
  const avenueMatch = normalized.match(/جاده?\s*(\d+)/);
  if (avenueMatch) details.avenue = avenueMatch[1];

  // Extract Plot (قسيمه/قسيمة)
  const plotMatch = normalized.match(/قسيمه?\s*(\d+)/);
  if (plotMatch) details.plot_number = plotMatch[1];

  // Extract House (منزل/م)
  // To avoid confusion with "منطقة", we check for "منزل" or standalone "م" before a number
  const houseMatch = normalized.match(/(?:منزل|م)\s*(\d+)/);
  if (houseMatch) details.house_number = houseMatch[1];

  // Extract Sector (قطاع)
  const sectorMatch = normalized.match(/قطاع\s*(\d+)/);
  if (sectorMatch) details.sector = sectorMatch[1];

  return details;
}
