/**
 * APICache Utility
 * 
 * فلاس لإدارة كاش طلبات الـ API.
 * يساعد في تقليل عدد الطلبات للسيرفر وتحسين سرعة استجابة التطبيق.
 */
class APICache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private maxAge = 5 * 60 * 1000; // 5 دقائق كاش افتراضي

  /**
   * الحصول على بيانات من الكاش إذا كانت موجودة وغير منتهية الصلاحية
   */
  get(key: string) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.timestamp > this.maxAge;
    if (isExpired) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * حفظ بيانات في الكاش
   */
  set(key: string, data: any) {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  /**
   * مسح الكاش بالكامل
   */
  clear() {
    this.cache.clear();
  }

  /**
   * حذف مفتاح محدد من الكاش
   */
  delete(key: string) {
    this.cache.delete(key);
  }
}

export const apiCache = new APICache();
