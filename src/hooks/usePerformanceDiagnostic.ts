import React from 'react';

/**
 * دليل تشخيص المشاكل والحلول - أدوات التشخيص
 * 
 * 1. useRenderTracker: لتتبع عدد المرات التي يتم فيها رندر المكون
 * 2. usePerformanceTimer: لقياس الوقت المستغرق في تنفيذ العمليات
 * 3. useMemoryMonitor: لمراقبة استهلاك الذاكرة
 */

// ✅ أداة لتتبع الـ Re-renders
export const useRenderTracker = (componentName: string) => {
  React.useEffect(() => {
    console.log(`🔄 ${componentName} rendered at ${new Date().toLocaleTimeString()}`);
  });
};

// ✅ أداة لقياس الوقت
export const usePerformanceTimer = (label: string) => {
  React.useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      console.log(`⏱️ ${label}: ${(endTime - startTime).toFixed(2)}ms`);
    };
  }, [label]);
};

// ✅ أداة لتتبع الـ Memory Leaks
export const useMemoryMonitor = () => {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const logMemory = () => {
      if ((performance as any).memory) {
        const mem = (performance as any).memory;
        const used = (mem.usedJSHeapSize / 1048576).toFixed(2);
        const limit = (mem.jsHeapSizeLimit / 1048576).toFixed(2);
        console.log(`💾 Memory: ${used}MB / ${limit}MB`);
      }
    };

    const interval = setInterval(logMemory, 2000);
    return () => clearInterval(interval);
  }, []);
};
