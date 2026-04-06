import { create } from 'zustand';
import { Property } from '../types';

interface PropertyState {
  selectedProperty: Property | null;
  setSelectedProperty: (property: Property | null) => void;
  
  selectedMarketerId: string | null;
  setSelectedMarketerId: (id: string | null) => void;
  
  favorites: string[];
  setFavorites: (favorites: string[]) => void;
  toggleFavorite: (propertyId: string) => void;
}

/**
 * usePropertyStore
 * 
 * متجر مخصص لإدارة البيانات المتعلقة بالعقارات (العقار المختار، المفضلة، المسوق).
 */
export const usePropertyStore = create<PropertyState>((set) => ({
  selectedProperty: null,
  setSelectedProperty: (selectedProperty) => set({ selectedProperty }),

  selectedMarketerId: null,
  setSelectedMarketerId: (selectedMarketerId) => set({ selectedMarketerId }),

  favorites: [],
  setFavorites: (favorites) => set({ favorites }),
  toggleFavorite: (propertyId) => set((state) => ({
    favorites: state.favorites.includes(propertyId)
      ? state.favorites.filter(id => id !== propertyId)
      : [...state.favorites, propertyId]
  })),
}));
