import { create } from 'zustand';
import { FilterOptions, Property } from '../types';

interface AppState {
  view: string;
  setView: (view: string) => void;
  
  filters: FilterOptions;
  setFilters: (filters: Partial<FilterOptions>) => void;
  resetFilters: () => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;
  
  activeSearchQuery: string;
  setActiveSearchQuery: (query: string) => void;

  selectedProperty: Property | null;
  setSelectedProperty: (property: Property | null) => void;

  selectedMarketerId: string | null;
  setSelectedMarketerId: (id: string | null) => void;

  isSidebarOpen: boolean;
  setSidebarOpen: (isOpen: boolean) => void;

  showFilters: boolean;
  setShowFilters: (show: boolean) => void;

  favorites: string[];
  setFavorites: (favorites: string[]) => void;
  toggleFavorite: (propertyId: string) => void;
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

export const useStore = create<AppState>((set) => ({
  view: 'list',
  setView: (view) => set({ view, selectedProperty: null }),

  filters: initialFilters,
  setFilters: (newFilters) => set((state) => ({ 
    filters: { ...state.filters, ...newFilters } 
  })),
  resetFilters: () => set({ filters: initialFilters }),

  searchQuery: '',
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  activeSearchQuery: '',
  setActiveSearchQuery: (activeSearchQuery) => set({ activeSearchQuery }),

  selectedProperty: null,
  setSelectedProperty: (selectedProperty) => set({ selectedProperty }),

  selectedMarketerId: null,
  setSelectedMarketerId: (selectedMarketerId) => set({ selectedMarketerId }),

  isSidebarOpen: false,
  setSidebarOpen: (isSidebarOpen) => set({ isSidebarOpen }),

  showFilters: false,
  setShowFilters: (showFilters) => set({ showFilters }),

  favorites: [],
  setFavorites: (favorites) => set({ favorites }),
  toggleFavorite: (propertyId) => set((state) => ({
    favorites: state.favorites.includes(propertyId)
      ? state.favorites.filter(id => id !== propertyId)
      : [...state.favorites, propertyId]
  })),
}));
