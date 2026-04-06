import { create } from 'zustand';
import { FilterOptions } from '../types';

interface SearchState {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  activeSearchQuery: string;
  setActiveSearchQuery: (query: string) => void;

  filters: FilterOptions;
  setFilters: (filters: Partial<FilterOptions>) => void;
  resetFilters: () => void;
}

const initialFilters: FilterOptions = {
  governorate: '',
  area: '',
  type: '',
  purpose: '',
  location: '',
  marketer: '',
  status: '',
  plot_number: '',
  house_number: '',
};

/**
 * useSearchStore
 * 
 * متجر مخصص لإدارة عمليات البحث والتصفية.
 * تقسيم البحث في متجر مستقل يقلل من إعادة رندر الأجزاء الثابتة من التطبيق أثناء الكتابة.
 */
export const useSearchStore = create<SearchState>((set) => ({
  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  activeSearchQuery: '',
  setActiveSearchQuery: (activeSearchQuery) => set({ activeSearchQuery }),

  filters: initialFilters,
  setFilters: (newFilters) => set((state) => ({ 
    filters: { ...state.filters, ...newFilters } 
  })),
  resetFilters: () => set({ filters: initialFilters }),
}));
