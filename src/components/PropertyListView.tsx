import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Search, X } from 'lucide-react';
import { PropertyCard } from './PropertyCard';
import { LoadingSpinner } from './LoadingSpinner';
import { SearchableFilter } from './SearchableFilter';
import { Property, UserProfile } from '../types';

interface FilterOptions {
  governorate: string;
  area: string;
  type: string;
  purpose: string;
  location: string;
  marketer: string;
  status: string;
}

interface PropertyListViewProps {
  view: string;
  properties: Property[];
  filteredProperties: Property[];
  searchQuery: string;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  filters: FilterOptions;
  setFilters: React.Dispatch<React.SetStateAction<FilterOptions>>;
  availableFilterOptions: any;
  visibleCount: number;
  setVisibleCount: React.Dispatch<React.SetStateAction<number>>;
  hasMoreProperties: boolean;
  isLoadingProperties: boolean;
  fetchProperties: (loadMore?: boolean) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  handlePropertyClick: (property: Property) => void;
  handleImageClick: (images: string[], index: number) => void;
  isAdmin: boolean;
  handleApproveProperty: (id: string) => void;
  handleRejectProperty: (id: string) => void;
  handleEditProperty: (property: Property) => void;
  handleDeleteProperty: (id: string) => void;
  restoreProperty: (id: string) => void;
  permanentDeleteProperty: (id: string) => void;
  handleFilterChange: (key: keyof FilterOptions, value: string) => void;
  handleUserClick: (userId: string) => void;
  normalizeDigits: (str: string) => string;
  isSearchFocused: boolean;
  setIsSearchFocused: React.Dispatch<React.SetStateAction<boolean>>;
  searchSuggestions: string[];
  employees: UserProfile[];
  selectedMarketerId: string | null;
}

export const PropertyListView: React.FC<PropertyListViewProps> = ({
  view,
  properties,
  filteredProperties,
  searchQuery,
  setSearchQuery,
  filters,
  setFilters,
  availableFilterOptions,
  visibleCount,
  setVisibleCount,
  hasMoreProperties,
  isLoadingProperties,
  fetchProperties,
  favorites,
  toggleFavorite,
  handlePropertyClick,
  handleImageClick,
  isAdmin,
  handleApproveProperty,
  handleRejectProperty,
  handleEditProperty,
  handleDeleteProperty,
  restoreProperty,
  permanentDeleteProperty,
  handleFilterChange,
  handleUserClick,
  normalizeDigits,
  isSearchFocused,
  setIsSearchFocused,
  searchSuggestions,
  employees,
  selectedMarketerId,
}) => {
  return (
    <motion.div 
      key="list"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="space-y-6 px-4 py-8"
    >
      {/* Search & Filters */}
      <div className="bg-white/40 backdrop-blur-xl border border-white/40 p-4 rounded-xl shadow-xl shadow-stone-200/50 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          <div className="relative w-full bg-white/70 backdrop-blur-md border border-stone-200 rounded-lg focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all flex items-center p-2 px-4 min-h-[46px] shadow-sm hover:border-stone-300">
            <div 
              className="flex flex-1 items-center gap-2 cursor-text"
              onClick={() => {
                if (!isSearchFocused) {
                  setIsSearchFocused(true);
                  setTimeout(() => {
                    const input = document.getElementById('main-search-input');
                    if (input) input.focus();
                  }, 0);
                }
              }}
            >
              <Search className="text-stone-500 ml-1" size={16} />
              
              {(filters ? Object.entries(filters) : []).filter(([_, val]) => val !== '').map(([key, value]) => (
                <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold whitespace-nowrap">
                  {value as React.ReactNode}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (key === 'governorate') {
                        setFilters({ ...filters, governorate: '', area: '' });
                      } else {
                        setFilters({ ...filters, [key]: '' });
                      }
                    }}
                    className="hover:bg-emerald-200 rounded-full p-0.5 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}

              {searchQuery && !isSearchFocused && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold whitespace-nowrap">
                  {searchQuery}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                    }}
                    className="hover:bg-emerald-200 rounded-full p-0.5 transition-colors"
                  >
                    <X size={10} />
                  </button>
                </span>
              )}

              <div className={`flex-1 flex items-center relative min-w-[80px] ${searchQuery && !isSearchFocused ? 'hidden' : ''}`}>
                <Search className="absolute left-2 text-stone-400" size={14} />
                <input 
                  id="main-search-input"
                  type="text"
                  placeholder="الاسم، رقم الهاتف، أو المنطقة..."
                  className="w-full bg-transparent border-none outline-none text-xs py-1 pl-8 pr-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(normalizeDigits(e.target.value))}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => {
                    setTimeout(() => setIsSearchFocused(false), 200);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (searchSuggestions.length > 0) {
                        setSearchQuery(searchSuggestions[0]);
                      }
                      setIsSearchFocused(false);
                    }
                  }}
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 text-stone-500 hover:text-stone-600 p-1 rounded-full hover:bg-stone-200 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
            <AnimatePresence>
              {isSearchFocused && searchSuggestions.length > 0 && (
                <>
                  <div className="fixed inset-0 z-[80]" onClick={() => setIsSearchFocused(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute top-full right-0 left-0 mt-2 bg-white/90 backdrop-blur-xl border border-stone-100 rounded-lg shadow-xl z-[90] overflow-hidden"
                  >
                    <div className="max-h-60 overflow-y-auto p-1">
                      {searchSuggestions.map((opt: string) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => { setSearchQuery(opt); setIsSearchFocused(false); }}
                          className="w-full text-right p-3 text-sm rounded-lg hover:bg-white/50 text-stone-600 transition-colors"
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <SearchableFilter 
            placeholder="المحافظة..."
            options={availableFilterOptions.governorates}
            value={filters.governorate}
            onChange={(val: string) => setFilters({...filters, governorate: val, area: ''})}
          />

          <SearchableFilter 
            placeholder="المنطقة..."
            options={availableFilterOptions.areas}
            value={filters.area}
            onChange={(val: string) => setFilters({...filters, area: val})}
          />

          <SearchableFilter 
            placeholder="نوع العقار..."
            options={availableFilterOptions.types}
            value={filters.type}
            onChange={(val: string) => setFilters({...filters, type: val})}
          />

          <SearchableFilter 
            placeholder="الغرض..."
            options={availableFilterOptions.purposes}
            value={filters.purpose}
            onChange={(val: string) => setFilters({...filters, purpose: val})}
          />

          <SearchableFilter 
            placeholder="الموقع..."
            options={availableFilterOptions.locations}
            value={filters.location}
            onChange={(val: string) => setFilters({...filters, location: val})}
          />

          <SearchableFilter 
            placeholder="ابحث بالمستخدم..."
            options={availableFilterOptions.marketers}
            value={filters.marketer}
            onChange={(val: string) => setFilters({...filters, marketer: val})}
          />

          <SearchableFilter 
            placeholder="الحالة..."
            options={availableFilterOptions.statuses}
            value={filters.status}
            onChange={(val: string) => setFilters({...filters, status: val})}
          />
        </div>
      </div>

      {/* Actions & Results Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold serif text-center flex-1">
          {view === 'pending-properties' ? `عقارات قيد المراجعة (${filteredProperties.length})` : (searchQuery || filters.governorate || filters.area || filters.type || filters.purpose || filters.location || filters.marketer || filters.status
            ? `نتائج البحث (${filteredProperties.length})` 
            : `${view === 'list' ? 'كل العقارات' : view === 'my-listings' ? 'عقاراتي' : view === 'my-favorites' ? 'عقاراتي المفضلة' : `عقارات ${employees.find(emp => emp.uid === selectedMarketerId)?.full_name || 'المستخدم'}`} (${filteredProperties.length})`)}
        </h2>
        <button 
          onClick={() => fetchProperties(false)}
          className="flex items-center gap-2 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors"
        >
          <RefreshCw size={18} />
          تحديث
        </button>
      </div>

      {/* Grid - Always show results */}
      {filteredProperties.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredProperties.slice(0, visibleCount).map((p) => (
                <PropertyCard 
                  key={p.id} 
                  property={p} 
                  isFavorite={favorites.includes(p.id)}
                  onFavorite={toggleFavorite}
                  onClick={handlePropertyClick}
                  onImageClick={handleImageClick}
                  isAdmin={isAdmin}
                  onApprove={handleApproveProperty}
                  onReject={handleRejectProperty}
                  onEdit={handleEditProperty}
                  onDelete={handleDeleteProperty}
                  onRestore={restoreProperty}
                  onPermanentDelete={permanentDeleteProperty}
                  view={view}
                  onFilter={handleFilterChange}
                  onUserClick={handleUserClick}
                />
            ))}
          </div>

          {(visibleCount < filteredProperties.length || hasMoreProperties) && (
            <div className="flex justify-center pt-8">
              <button 
                onClick={() => {
                  setVisibleCount(prev => prev + 12);
                  if (visibleCount + 12 >= filteredProperties.length && hasMoreProperties) {
                    fetchProperties(true);
                  }
                }}
                disabled={isLoadingProperties}
                className="bg-white text-emerald-600 border-2 border-emerald-600 px-12 py-3 rounded-xl hover:bg-emerald-50 transition-all font-bold disabled:opacity-50"
              >
                {isLoadingProperties ? 'جاري التحميل...' : 'عرض المزيد من العقارات'}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-white p-16 rounded-2xl border border-stone-200 text-center space-y-4">
          <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center mx-auto text-stone-300">
            <Search size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-stone-900 text-lg text-center">لا توجد نتائج</h3>
            <p className="text-stone-500">لم نجد أي عقارات تطابق معايير البحث الحالية.</p>
          </div>
        </div>
      )}
    </motion.div>
  );
};
