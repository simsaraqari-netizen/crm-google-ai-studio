import { create } from 'zustand';

interface UIState {
  view: string;
  setView: (view: string) => void;
  
  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;
  
  showFilters: boolean;
  setShowFilters: (show: boolean) => void;
}

/**
 * useUIStore
 * 
 * متجر مخصص لإدارة حالة واجهة المستخدم فقط.
 * هذا يساعد في منع إعادة رندر المكونات التي لا تتعلق بالـ UI عند تغيير البيانات.
 */
export const useUIStore = create<UIState>((set) => ({
  view: 'list',
  setView: (view) => set({ view }),

  isSidebarOpen: false,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

  showFilters: false,
  setShowFilters: (showFilters) => set({ showFilters }),
}));
