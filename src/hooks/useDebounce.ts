import { useState, useEffect } from 'react';

/**
 * useDebounce Hook
 * 
 * يسمح بتأخير تحديث القيمة حتى يتوقف المستخدم عن الكتابة لفترة معينة.
 * مفيد جداً لتحسين أداء البحث وتقليل عدد طلبات الـ API.
 */
export const useDebounce = <T,>(value: T, delay: number = 500): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};
