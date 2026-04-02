import React, { useState, useEffect } from 'react';
import { Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { normalizeArabic } from '../utils';

export function SearchableFilter({ 
  label, 
  options, 
  value, 
  onChange, 
  placeholder,
  disabled = false,
  creatable = false
}: { 
  label?: string, 
  options: string[], 
  value: string, 
  onChange: (val: string) => void,
  placeholder?: string,
  disabled?: boolean,
  creatable?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || '');
  const inputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearch(value || '');
  }, [value]);

  const filteredOptions = options.filter(opt => 
    normalizeArabic(opt).includes(normalizeArabic(search))
  );

  const showCreateOption = creatable && search && !options.some(opt => normalizeArabic(opt) === normalizeArabic(search));

  return (
    <div className="relative">
      <div className={`relative bg-white/70 backdrop-blur-md border border-stone-200 rounded-lg p-1 px-2 flex flex-col justify-center focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all shadow-sm hover:border-stone-300 hover:shadow-md ${disabled ? 'opacity-50' : ''} ${!label ? 'h-[40px]' : 'h-[50px]'}`}>
        {label && <label className="text-[10px] font-bold text-stone-500 text-right px-1 mb-0">{label}</label>}
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            placeholder={label || placeholder}
            className={`w-full bg-transparent border-none p-0 text-sm text-right outline-none focus:ring-0 ${disabled ? 'cursor-not-allowed' : ''}`}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setIsOpen(true);
              if (e.target.value === '') {
                onChange('');
              }
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (filteredOptions.length > 0) {
                  onChange(filteredOptions[0]);
                  setSearch(filteredOptions[0]);
                  setIsOpen(false);
                } else if (showCreateOption) {
                  onChange(search);
                  setIsOpen(false);
                }
              }
            }}
          />
          <Filter size={12} className="mr-2 text-stone-300 shrink-0" />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-[80]" onClick={() => {
              setIsOpen(false);
              if (!options.includes(search) && !creatable) {
                setSearch(value || '');
              } else if (creatable && search !== value) {
                onChange(search);
              }
            }} />
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute top-full right-0 left-0 mt-2 bg-white/90 backdrop-blur-xl border border-stone-100 rounded-lg shadow-xl z-[90] overflow-hidden"
            >
              <div className="max-h-60 overflow-y-auto p-1">
                {!creatable && (
                  <button
                    type="button"
                    onClick={() => { onChange(''); setIsOpen(false); setSearch(''); }}
                    className="w-full text-right p-2 text-sm hover:bg-white/50 rounded-lg text-stone-500"
                  >
                    الكل
                  </button>
                )}
                
                {showCreateOption && (
                  <button
                    type="button"
                    onClick={() => { onChange(search); setIsOpen(false); }}
                    className="w-full text-right p-2 text-sm hover:bg-emerald-50/50 rounded-lg text-emerald-600 font-bold border-b border-stone-200/50"
                  >
                    إضافة: "{search}"
                  </button>
                )}

                {filteredOptions.map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => { onChange(opt); setIsOpen(false); setSearch(opt); }}
                    className={`w-full text-right p-2 text-sm rounded-lg transition-colors ${value === opt ? 'bg-emerald-50/50 text-emerald-700 font-bold' : 'hover:bg-white/50 text-stone-600'}`}
                  >
                    {opt}
                  </button>
                ))}
                
                {filteredOptions.length === 0 && !showCreateOption && (
                  <div className="p-3 text-sm text-stone-500 text-center">لا توجد نتائج</div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
