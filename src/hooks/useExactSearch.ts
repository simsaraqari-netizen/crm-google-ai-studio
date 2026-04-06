import { useMemo } from 'react';
import { normalizeArabic, normalizeDigits, searchMatch } from '../utils';

/**
 * useExactSearch Hook
 * 
 * هوك مخصص للقيام بعمليات بحث عالية الأداء مع مراعاة خصائص اللغة العربية
 * والأرقام، وتجنب الرندر المتكرر في القوائم الكبيرة.
 */
export const useExactSearch = <T,>(
  items: T[],
  searchQuery: string,
  searchFields: (item: T) => (string | undefined | null)[]
): T[] => {
  return useMemo(() => {
    // إذا لم يكن هناك استعلام، ارجع القائمة كما هي
    if (!searchQuery || !searchQuery.trim()) return items;

    const normalizedQuery = normalizeArabic(normalizeDigits(searchQuery.trim()));
    if (!normalizedQuery) return items;

    return items.filter((item) => {
      // جمع كل النصوص التي يمكن البحث فيها للعنصر الواحد
      const searchableTexts = searchFields(item)
        .filter(text => text !== null && text !== undefined)
        .map(text => normalizeArabic(normalizeDigits(String(text))))
        .join(' ');

      // استخدام دالة البحث الموحدة التي نملكها في utils
      return searchMatch(searchableTexts, normalizedQuery);
    });
  }, [items, searchQuery, searchFields]);
};
