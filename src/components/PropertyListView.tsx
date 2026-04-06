import React, { useMemo, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, RefreshCw, Filter } from 'lucide-react';
import { experimental_VGrid as VGrid } from 'virtua';
import { PropertyCard } from './PropertyCard';
import { LoadingSpinner } from './LoadingSpinner';
import { useUIStore } from '../stores/useUIStore';
import { usePropertyStore } from '../stores/usePropertyStore';
import { useSearchStore } from '../stores/useSearchStore';
import { useProperties } from '../hooks/useProperties';
import { useAuth } from '../contexts/AuthContext';
import { useDebounce } from '../hooks/useDebounce';
import { useExactSearch } from '../hooks/useExactSearch';
import { normalizeArabic, normalizeDigits, extractDetailsFromName } from '../utils';
import { useRenderTracker, usePerformanceTimer } from '../hooks/usePerformanceDiagnostic';

export const PropertyListView = memo(function PropertyListView() {
  // 1. UI Store
  const { view, setView, showFilters, setShowFilters } = useUIStore();
  
  // 2. Property Store
  const { setSelectedProperty, favorites, toggleFavorite, selectedMarketerId } = usePropertyStore();
  
  // 3. Search Store
  const { searchQuery, setSearchQuery, activeSearchQuery, setActiveSearchQuery, filters } = useSearchStore();

  // Performance Tracking
  useRenderTracker('PropertyListView');
  usePerformanceTimer('PropertyListView-Root');

  const { user, isAdmin } = useAuth();
  const { data: properties = [], isLoading, refetch, isFetching } = useProperties(user?.company_id);

  // Search Debouncing (Using the new hook)
  const debouncedSearch = useDebounce(searchQuery, 400);
  
  React.useEffect(() => {
    setActiveSearchQuery(debouncedSearch);
  }, [debouncedSearch, setActiveSearchQuery]);

  // Step 1: Base View Filtering
  const baseFilteredProperties = useMemo(() => {
    return properties.filter(p => {
      if (view === 'my-listings' && p.created_by !== user?.id) return false;
      if (view === 'my-favorites' && !favorites.includes(p.id)) return false;
      if (view === 'user-listings' && selectedMarketerId && p.assigned_employee_id !== selectedMarketerId) return false;
      if (view === 'pending-properties' && p.status !== 'pending') return false;
      if (view === 'trash' && p.status !== 'deleted') return false;
      if (view !== 'trash' && p.status === 'deleted') return false;
      
      const matchesGov = !filters.governorate || normalizeArabic(p.governorate || '') === normalizeArabic(filters.governorate);
      const matchesArea = !filters.area || normalizeArabic(p.area || '') === normalizeArabic(filters.area);
      const matchesType = !filters.type || normalizeArabic(p.type || '') === normalizeArabic(filters.type);
      const matchesPurpose = !filters.purpose || normalizeArabic(p.purpose || '') === normalizeArabic(filters.purpose);
      const matchesLocation = !filters.location || normalizeArabic(p.location || '') === normalizeArabic(filters.location);
      const matchesStatus = !filters.status || 
                           (filters.status === 'sold' && p.is_sold) || 
                           (filters.status === 'available' && !p.is_sold);

      return matchesGov && matchesArea && matchesType && matchesPurpose && 
             matchesLocation && matchesStatus;
    });
  }, [properties, view, user?.id, favorites, selectedMarketerId, filters]);

  // Step 2: Advanced Text Search using useExactSearch
  const filteredProperties = useExactSearch(baseFilteredProperties, activeSearchQuery, (p) => {
    const extracted = extractDetailsFromName(p.name);
    return [
      p.name, p.area, p.plot_number, p.details, p.assigned_employee_name,
      p.phone, p.governorate, p.type, p.purpose, p.location, p.house_number, p.sector,
      extracted.sector ? `قطاع ${extracted.sector}` : '',
      extracted.block ? `قطعة ${extracted.block}` : '',
      extracted.street ? `شارع ${extracted.street}` : '',
      extracted.avenue ? `جادة ${extracted.avenue}` : '',
      extracted.plot_number ? `قسيمة ${extracted.plot_number}` : '',
      extracted.house_number ? `منزل ${extracted.house_number}` : '',
    ];
  });

  const handlePropertyClick = useCallback((p: any) => {
    setSelectedProperty(p);
    setView('details');
  }, [setSelectedProperty, setView]);

  const handleFavoriteToggle = useCallback((id: string) => {
    toggleFavorite(id);
  }, [toggleFavorite]);

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden bg-stone-50">
      {/* Search Bar - Fixed at top */}
      <div className="bg-white border-b border-stone-200 p-4 shadow-sm z-30">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row gap-3 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
            <input 
              type="text"
              placeholder="ابحث بالعقار، المنطقة، أو رقم القسيمة..."
              className="w-full bg-stone-50 border border-stone-200 rounded-2xl py-3 pr-12 pl-4 text-right outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all text-sm font-medium"
              value={searchQuery}
              onChange={(e) => setSearchQuery(normalizeDigits(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setActiveSearchQuery(searchQuery);
              }}
            />
            {searchQuery && (
              <button 
                onClick={() => { setSearchQuery(''); setActiveSearchQuery(''); }}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X size={16} />
              </button>
            )}
          </div>
          
          <div className="flex gap-2 w-full md:w-auto">
            <button 
              onClick={() => setActiveSearchQuery(searchQuery)}
              className="flex-1 md:flex-none bg-emerald-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
            >
              <Search size={18} />
              بحث
            </button>
            <button 
              onClick={() => setShowFilters(!showFilters)}
              className={`p-3 rounded-2xl border transition-all ${showFilters ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
              title="تصفية النتائج"
            >
              <Filter size={20} />
            </button>
            <button 
              onClick={() => refetch()}
              className={`p-3 rounded-2xl border bg-white border-stone-200 text-stone-600 hover:bg-stone-50 transition-all ${isFetching ? 'animate-spin' : ''}`}
              title="تحديث البيانات"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-stone-100 mt-4 pt-4"
            >
              <div className="max-w-7xl mx-auto flex items-center justify-center p-4">
                <p className="text-stone-400 text-sm font-medium">الفلاتر المتقدمة يتم تحميلها...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Virtual Table/Grid */}
      <div className="flex-1 overflow-hidden relative">
        {filteredProperties.length > 0 ? (
          <VGrid
            data={filteredProperties}
            className="h-full p-4 md:p-6"
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}
          >
            {(p) => (
              <PropertyCard 
                key={p.id} 
                property={p} 
                isFavorite={favorites.includes(p.id)}
                onFavorite={handleFavoriteToggle}
                onClick={handlePropertyClick}
                isAdmin={isAdmin}
                view={view}
              />
            )}
          </VGrid>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="w-20 h-20 bg-stone-100 rounded-full flex items-center justify-center text-stone-300">
              <Search size={40} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">لا توجد نتائج</h3>
              <p className="text-stone-500">جرب البحث بكلمات مختلفة أو تغيير الفلاتر.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
