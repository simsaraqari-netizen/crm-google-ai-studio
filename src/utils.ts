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
  else if (clean === "ج ع م" || clean.includes(" ع م") && clean.includes("ج ")) clean = "جنوب عبدالله المبارك";
  else if (clean === "ش غ ص" || clean.includes(" غ ص") && clean.includes("ش ")) clean = "شمال غرب صليبيخات";
  else if (clean === "ج ص الاحمد" || clean === "ج ص ح" || clean.includes(" ص ح") && clean.includes("ج ")) clean = "جنوب صباح الاحمد";
  else if (clean === "غ ع م" || clean.includes(" ع م") && clean.includes("غ ")) clean = "غرب عبدالله المبارك";
  else if (clean === "ص الاحمد") clean = "صباح الاحمد";

  if (clean === "شمال غرب الصليبخات" || clean === "شمال غرب صليبخات") clean = "شمال غرب صليبيخات";

  return clean;
}

export function searchMatch(source: string, query: string): boolean {
  const normalizedSource = normalizeArabic(source.toLowerCase());
  const normalizedQuery = normalizeArabic(query.toLowerCase());
  return normalizedSource.includes(normalizedQuery);
}

export function generatePropertyTitle(property: any): string {
  if (!property) return "";
  const parts = [];
  
  // الاسم
  if (property.name) parts.push(property.name);
  
  // الغرض
  if (property.purpose) {
    let p = property.purpose.trim();
    if (p === 'بيع') p = 'للبيع';
    else if (p === 'إيجار' || p === 'ايجار') p = 'للايجار';
    else if (p === 'بدل') p = 'للبدل';
    else if (p === 'شراء') p = 'شراي';
    else if (p === 'مستأجر') p = 'مستأجر';
    else if (!p.startsWith('ل')) p = 'ل' + p;
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
  if (property.house_number) addressParts.push(`م ${property.house_number}`);
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
