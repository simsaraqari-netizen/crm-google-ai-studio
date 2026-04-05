import { ErrorBoundary } from './components/ErrorBoundary';
import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { 
  Search, 
  Plus, 
  LogOut, 
  LogIn, 
  Heart, 
  MessageSquare, 
  Edit, 
  Trash2, 
  ChevronRight, 
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Filter,
  Image as ImageIcon,
  Link as LinkIcon,
  User as UserIcon,
  MapPin,
  Home,
  Phone,
  Tag,
  Info,
  ClipboardCheck,
  Eye,
  EyeOff,
  Menu,
  X,
  LayoutList,
  Upload,
  UserPlus,
  ExternalLink,
  MessageCircle,
  Share2,
  Leaf,
  RefreshCw,
  Bell,
  Building2,
  AlertTriangle,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from './lib/supabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { propertyService } from './services/propertyService';
import { userService } from './services/userService';
import { GOVERNORATES, AREAS, PROPERTY_TYPES, PURPOSES, LOCATIONS } from './constants';
import { 
  normalizeArabic, 
  cleanAreaName, 
  inferGovernorate,
  inferPurpose,
  inferType,
  searchMatch, 
  normalizeDigits, 
  generatePropertyTitle, 
  usernameToEmail, 
  extractSpreadsheetId,
  formatRelativeDate,
  formatDateTime
} from './utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Global Helpers ---

enum OperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  GET = 'GET',
  WRITE = 'WRITE'
}

const handleError = (error: any, operation: OperationType, entity: string) => {
  console.error(`Error during ${operation} on ${entity}:`, error);
  toast.error(`حدث خطأ أثناء ${operation === OperationType.CREATE ? 'إضافة' : operation === OperationType.UPDATE ? 'تعديل' : operation === OperationType.DELETE ? 'حذف' : 'جلب'} ${entity}`);
};

// --- Types ---

interface Property {
  id: string;
  name: string;
  governorate: string;
  area: string;
  type: string;
  purpose: string;
  phone: string;
  company_id: string;
  assigned_employee_id?: string;
  assigned_employee_name?: string;
  images: string[];
  location_link?: string;
  is_sold?: boolean;
  sector?: string;
  block?: string;
  street?: string;
  avenue?: string;
  plot_number?: string;
  house_number?: string;
  location: string;
  price?: string;
  details?: string;
  last_comment?: string;
  status_label?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  created_by: string;
  created_at: any;
  deleted_at?: any;
}

interface Company {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  created_at: any;
}

interface Comment {
  id: string;
  property_id: string;
  user_id: string;
  user_name: string;
  text: string;
  images?: string[];
  image_url?: string;
  user_phone?: string;
  created_at: any;
}

interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: 'super_admin' | 'admin' | 'employee' | 'pending' | 'rejected';
  company_id?: string;
  created_at?: string;
  force_sign_out?: boolean;
  phone?: string;
}

interface Notification {
  id: string;
  type: 'new-user' | 'property-update' | 'price-change' | 'status-change' | 'new-comment';
  title: string;
  message: string;
  user_id?: string; // Triggering user
  recipient_id?: string; // Target user (if null, it's for admins)
  property_id?: string;
  read: boolean;
  created_at: any;
}

// --- Components ---

function SyncModal({ isOpen, onClose, onSyncFrom, onSyncTo, spreadsheet_id, setSpreadsheetId }: any) {
  const [range, setRange] = useState('Sheet1!A1:Z5000');
  
  useEffect(() => {
    if (isOpen && !spreadsheet_id) {
      supabase.from('settings').select('*').eq('id', 'sync').maybeSingle()
        .then(({ data }) => {
          if (data) {
            setSpreadsheetId(data.spreadsheet_id || '');
          }
        });
    }
  }, [isOpen, spreadsheet_id, setSpreadsheetId]);

  const handleSyncFrom = async (id: string, rng: string) => {
    const extractedId = extractSpreadsheetId(id);
    await supabase.from('settings').upsert({ id: 'sync', spreadsheet_id: extractedId });
    onSyncFrom(extractedId, rng);
  };

  const handleSyncTo = async (id: string, rng: string) => {
    const extractedId = extractSpreadsheetId(id);
    await supabase.from('settings').upsert({ id: 'sync', spreadsheet_id: extractedId });
    onSyncTo(extractedId, rng);
  };
  
  const handleCreateSheet = async () => {
    const title = prompt('أدخل اسم الملف الجديد:');
    if (!title) return;
    
    const { data: { session } } = await supabase.auth.getSession();
    const idToken = session?.access_token;
    if (!idToken) return;
    
    try {
      const response = await fetch('/api/create-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, title })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to create sheet');
      }
      const { spreadsheet_id } = await response.json();
      setSpreadsheetId(spreadsheet_id);
      try {
        await supabase.from('settings').upsert({ id: 'sync', spreadsheet_id });
      } catch (err) {
        handleError(err, OperationType.WRITE, 'settings/sync');
      }
      toast.success('تم إنشاء الملف بنجاح');
    } catch (e: any) {
      console.error(e);
      toast.error(`حدث خطأ أثناء إنشاء الملف: ${e.message}`);
    }
  };

  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-stone-200">
        <h3 className="text-xl font-bold mb-4 text-stone-900 text-center">مزامنة Google Sheets</h3>
        
        <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-lg text-[11px] text-amber-800 leading-relaxed">
          <p className="font-bold mb-1">الخطوات المطلوبة:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>قم بإنشاء ملف Google Sheet جديد.</li>
            <li>اضغط على "Share" في الملف.</li>
            <li>أضف البريد الخاص بـ Service Account (الموجود في ملف JSON الخاص بك) كـ Editor:</li>
            <li className="font-mono bg-white p-1 rounded border border-amber-200 break-all select-all text-[9px]">
              {/* This will be replaced by the user with their own service account email */}
              يمكنك العثور على البريد في ملف الـ JSON (حقل client_email)
            </li>
            <li>انسخ رابط الملف أو الـ ID الخاص به وضعه بالأسفل.</li>
          </ol>
        </div>

        <input 
          type="text" 
          placeholder="Spreadsheet ID أو رابط الملف" 
          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg mb-3"
          value={spreadsheet_id}
          onChange={(e) => setSpreadsheetId(e.target.value)}
        />
        <button 
          onClick={handleCreateSheet}
          className="w-full mb-4 text-emerald-600 text-sm font-bold hover:underline"
        >
          أو إنشاء ملف جديد
        </button>
        <input 
          type="text" 
          placeholder="Range (e.g., Sheet1!A1:Z100)" 
          className="w-full p-3 bg-stone-50 border border-stone-200 rounded-lg mb-6"
          value={range}
          onChange={(e) => setRange(e.target.value)}
        />
        <div className="flex gap-3 mb-3">
          <button 
            onClick={() => handleSyncFrom(spreadsheet_id, range)}
            className="flex-1 bg-emerald-600 text-white py-3 rounded-full font-bold hover:bg-emerald-700 transition-all"
          >
            مزامنة من الشيت
          </button>
          <button 
            onClick={() => handleSyncTo(spreadsheet_id, range)}
            className="flex-1 bg-stone-600 text-white py-3 rounded-full font-bold hover:bg-stone-700 transition-all"
          >
            مزامنة إلى الشيت
          </button>
        </div>
        <button 
          onClick={onClose}
          className="w-full bg-stone-100 text-stone-600 py-3 rounded-full font-bold hover:bg-stone-200 transition-all"
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({ isOpen, onConfirm, onCancel, title, message, confirmText = "تأكيد الحذف", confirmColor = "bg-red-600 hover:bg-red-700" }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-stone-200"
      >
        <h3 className="text-xl font-bold mb-2 text-stone-900 text-center">{title}</h3>
        <p className="text-stone-600 mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button 
            onClick={onConfirm}
            className={`flex-1 ${confirmColor} text-white py-3 rounded-xl font-bold transition-all`}
          >
            {confirmText}
          </button>
          <button 
            onClick={onCancel}
            className="flex-1 bg-stone-100 text-stone-600 py-3 rounded-xl font-bold hover:bg-stone-200 transition-all"
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function ImageViewer({ images, initialIndex, onClose, is_sold }: any) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  return (
    <div className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-6 right-6 text-white/70 hover:text-white p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all z-[120]"
      >
        <X size={32} />
      </button>

      {images?.length > 1 && (
        <>
          <button 
            onClick={() => setCurrentIndex((prev: number) => (prev === 0 ? (images?.length || 0) - 1 : prev - 1))}
            className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 bg-white/10 rounded-full transition-all"
          >
            <ChevronLeft size={32} />
          </button>
          <button 
            onClick={() => setCurrentIndex((prev: number) => (prev === (images?.length || 0) - 1 ? 0 : prev + 1))}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 bg-white/10 rounded-full transition-all"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}

        <div className="max-w-5xl w-full h-full flex items-center justify-center relative">
        {images?.[currentIndex]?.startsWith('data:video/') ? (
          <video 
            src={images[currentIndex]} 
            controls 
            autoPlay
            className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl ${is_sold ? 'grayscale opacity-60' : ''}`}
          />
        ) : (
          <img 
            src={images?.[currentIndex]} 
            className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl ${is_sold ? 'grayscale opacity-60' : ''}`} 
            referrerPolicy="no-referrer"
            alt=""
          />
        )}
        {is_sold && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className="text-white font-black text-6xl tracking-wider transform -rotate-12 border-4 border-white px-8 py-3 rounded-2xl shadow-2xl bg-stone-700/80 backdrop-blur-sm">مباع</span>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm font-bold">
        {currentIndex + 1} / {images?.length || 0}
      </div>
    </div>
  );
}

function SearchableFilter({ 
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
  placeholder: string,
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
      <div className={`relative bg-white/70 backdrop-blur-md border border-stone-200 rounded-lg p-2 px-4 flex flex-col justify-center focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all shadow-sm hover:border-stone-300 hover:shadow-md ${disabled ? 'opacity-50' : ''} ${!label ? 'h-[46px]' : ''}`}>
        {label && <label className="text-[10px] font-bold text-stone-500 text-right px-1 mb-0.5">{label}</label>}
        <div className="relative flex items-center">
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            placeholder={placeholder}
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
                    className="w-full text-right p-2 text-sm hover:bg-emerald-50/50 rounded-lg text-emerald-600 font-bold border-b border-white/10"
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

const SUPER_ADMIN_EMAILS = ["simsaraqari@gmail.com", "mostafasoliman550@gmail.com"];

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const isSuperAdmin = user?.role === 'super_admin' || (user?.email && SUPER_ADMIN_EMAILS.includes(user.email));
  const isAdmin = user?.role === 'admin' || isSuperAdmin;
  const isEmployee = user?.role === 'employee' || isAdmin;
  const isPending = user?.role === 'pending';
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [properties, setProperties] = useState<Property[]>([]);
  const [deletedProperties, setDeletedProperties] = useState<Property[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [view, setView] = useState<'list' | 'add' | 'edit' | 'details' | 'my-listings' | 'my-favorites' | 'search-results' | 'manage-marketers' | 'user-listings' | 'pending-properties' | 'manage-companies' | 'notifications' | 'trash'>('list');
  const [isAddingUserToCompany, setIsAddingUserToCompany] = useState(false);
  const [targetCompanyForUser, setTargetCompanyForUser] = useState<any>(null);
  const [isEditingCompany, setIsEditingCompany] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [prevView, setPrevView] = useState<'list' | 'search-results' | 'my-listings' | 'my-favorites' | 'manage-marketers' | 'user-listings' | 'pending-properties' | 'manage-companies' | 'notifications'>('list');
  const [selectedMarketerId, setSelectedMarketerId] = useState<string>('');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSyncManagementOpen, setIsSyncManagementOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [spreadsheet_id, setSpreadsheetId] = useState('');
  const [tempSpreadsheetId, setTempSpreadsheetId] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [filters, setFilters] = useState({
    governorate: '',
    area: '',
    type: '',
    purpose: '',
    location: '',
    marketer: '',
    status: '' // '', 'available', 'sold'
  });

  const lastProcessedSessionId = useRef<string | null>(null);

  const searchSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const query = normalizeArabic(searchQuery);
    const suggestions = new Set<string>();
    
    properties.forEach(p => {
      if (normalizeArabic(p.name).includes(query)) suggestions.add(p.name);
      if (normalizeArabic(p.phone).includes(query)) suggestions.add(p.phone);
      if (normalizeArabic(p.area).includes(query)) suggestions.add(p.area);
      if (p.assigned_employee_name && normalizeArabic(p.assigned_employee_name).includes(query)) suggestions.add(p.assigned_employee_name);
    });
    
    return Array.from(suggestions).slice(0, 8);
  }, [searchQuery, properties]);

  const [users, setUsers] = useState<UserProfile[]>([]);
  
  useEffect(() => {
    if (isAdmin) {
      const fetchEmployees = async () => {
        let query = supabase.from('user_profiles').select('*');
        if (isSuperAdmin) {
          if (selectedCompanyId) {
            query = query.eq('company_id', selectedCompanyId);
          }
        } else {
          query = query.eq('company_id', user?.company_id);
        }
        
        const { data, error } = await query;
        if (error) {
          handleError(error, OperationType.GET, 'users');
          return;
        }
        setEmployees(data.filter(u => u.id !== user?.id) as UserProfile[]);
      };

      fetchEmployees();
      
      // Real-time subscription for users
      const subscription = supabase
        .channel('users_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => {
          fetchEmployees();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [isAdmin, isSuperAdmin, selectedCompanyId, user?.company_id, user?.id]);

  const [visibleCount, setVisibleCount] = useState(50);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; property_id: string | null }>({
    isOpen: false,
    property_id: null
  });
  const [userActionConfirm, setUserActionConfirm] = useState<{ 
    isOpen: boolean; 
    user_id: string | null; 
    action: 'delete' | 'bulk-delete' | 'approve' | 'reject' | 'change-role' | null;
    extraData?: any;
  }>({
    isOpen: false,
    user_id: null,
    action: null
  });
  const [accountDeleteConfirm, setAccountDeleteConfirm] = useState(false);
  const [commentDeleteConfirm, setCommentDeleteConfirm] = useState<{ isOpen: boolean; commentId: string | null; property_id: string | null }>({
    isOpen: false,
    commentId: null,
    property_id: null
  });

  const isPopState = useRef(false);
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      isPopState.current = true;
      if (event.state) {
        setView(event.state.view || 'list');
        setSelectedProperty(event.state.property || null);
        if (event.state.prevView) setPrevView(event.state.prevView);
      } else {
        setView('list');
        setSelectedProperty(null);
        setPrevView('list');
      }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Initialize history state
    if (!window.history.state) {
      window.history.replaceState({ view: 'list', property: null, prevView: 'list' }, '');
    }

    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Handle URL search query on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
    }
    
    const property_id = params.get('property_id');
    if (property_id && properties.length > 0) {
      const property = properties.find(p => p.id === property_id);
      if (property) {
        setSelectedProperty(property);
        setView('details');
        setPrevView('list');
      }
    }
  }, [properties]);

  useEffect(() => {
    if (view === 'details' && selectedProperty && properties.length > 0) {
      const exists = properties.find(p => p.id === selectedProperty.id);
      if (!exists) {
        setSelectedProperty(null);
        setView('list');
        toast.error('هذا العقار لم يعد متاحاً');
      }
    }
  }, [properties, view, selectedProperty]);

  // Sync state changes to history
  useEffect(() => {
    if (isPopState.current) {
      isPopState.current = false;
      return;
    }
    
    const currentState = window.history.state;
    if (!currentState || currentState.view !== view || currentState.property?.id !== selectedProperty?.id) {
      window.history.pushState({ view, property: selectedProperty, prevView }, '');
    }
  }, [view, selectedProperty, prevView]);

  // Reset visible count when filters or search change
  useEffect(() => {
    console.log("App state updated:", { 
      view, 
      hasUser: !!user, 
      hasSelectedProperty: !!selectedProperty,
      selectedPropertyId: selectedProperty?.id 
    });
  }, [view, user, selectedProperty]);

  // Auth Listener
  useEffect(() => {
    console.log("Setting up Supabase Auth Listener...");
    
    const handleSession = async (session: any) => {
      // Prevent redundant processing if session hasn't changed
      if (session?.user?.id === lastProcessedSessionId.current && user) {
        console.log("Session already processed, skipping...");
        return;
      }
      lastProcessedSessionId.current = session?.user?.id || null;

      if (!session) {
        console.log("No active session found.");
        setUser(null);
        setSelectedCompanyId(null);
        setLoading(false);
        return;
      }

      console.log("Processing session for user:", session.user.id);
      const sbUser = session.user;
      try {
        const { data: userData, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', sbUser.id)
          .maybeSingle();

        if (error) throw error;

        if (userData) {
          if (userData.force_sign_out) {
            await supabase.from('user_profiles').update({ force_sign_out: false }).eq('id', sbUser.id);
            setAuthError('تم تسجيل خروجك من قبل المسؤول.');
            await supabase.auth.signOut();
            setUser(null);
            return;
          }
          if (userData.role === 'rejected') {
            setAuthError('تم رفض حسابك من قبل الإدارة.');
            await supabase.auth.signOut();
            setUser(null);
            return;
          }

          if (SUPER_ADMIN_EMAILS.includes(sbUser.email || '') && userData.role !== 'super_admin') {
            await supabase.from('user_profiles').update({ role: 'super_admin' }).eq('id', sbUser.id);
            userData.role = 'super_admin';
          }

          setUser(userData);
          if (userData.company_id) {
            setSelectedCompanyId(userData.company_id);
          }
        } else {
          console.log("Creating new profile for user:", sbUser.id);
          const isSuper = SUPER_ADMIN_EMAILS.includes(sbUser.email || '');
          const role = isSuper ? 'super_admin' : 'pending';
          const newProfile = {
            id: sbUser.id,
            email: sbUser.email || '',
            display_name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User',
            role: role,
            created_at: new Date().toISOString()
          };
          
          await supabase.from('user_profiles').insert(newProfile);
          
          if (role === 'pending') {
            await supabase.from('notifications').insert({
              type: 'new-user',
              title: 'طلب انضمام جديد',
              message: `المستخدم ${newProfile.display_name} يطلب الانضمام للنظام`,
              user_id: sbUser.id,
              read: false
            });
          }
          setUser(newProfile as UserProfile);
        }
      } catch (err: any) {
        console.error("Auth error details:", err);
        setAuthError(`خطأ في الوصول لقاعدة البيانات: ${err.message}`);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth Event Triggered:", event);
      handleSession(session);
    });

    return () => subscription.unsubscribe();
  }, [user]); // user dependency is safe now due to lastProcessedSessionId ref gating


  // Companies Listener (for Super Admin)
  useEffect(() => {
    if (!isSuperAdmin) {
      setCompanies([]);
      return;
    }
    
    const fetchCompanies = async () => {
      const { data, error } = await supabase.from('companies').select('*');
      if (error) {
        handleError(error, OperationType.GET, 'companies');
        return;
      }
      setCompanies(data as Company[]);
    };

    fetchCompanies();

    const subscription = supabase
      .channel('companies_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
        fetchCompanies();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [isSuperAdmin]);

  // Sync Settings Listener
  useEffect(() => {
    const fetchSyncSettings = async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'sync')
        .maybeSingle();
      
      if (error) {
        console.error("Error fetching sync settings:", error);
        return;
      }
      
      if (data) {
        setSpreadsheetId(data.spreadsheet_id || '');
      }
    };

    fetchSyncSettings();
  }, []);

  // Properties Listener
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchProperties = async () => {
      let allData: any[] = [];
      let from = 0;
      let step = 1000;
      let fetchMore = true;

      while (fetchMore) {
        let query = supabase.from('properties').select('*');
        
        if (isSuperAdmin) {
          if (selectedCompanyId) {
            query = query.eq('company_id', selectedCompanyId);
          }
        } else if (user.company_id) {
          query = query.eq('company_id', user.company_id);
        } else {
          setProperties([]);
          return;
        }

        const { data, error } = await query
          .order('created_at', { ascending: false })
          .range(from, from + step - 1);
        
        if (error) {
          console.error("Properties error:", error);
          break;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += step;
          if (data.length < step) {
            fetchMore = false; // We fetched less than 1000, so we reached the end
          }
        } else {
          fetchMore = false; // No data returned
        }
      }

      const allProps = allData.map(p => ({
        ...p,
        location: p.location === 'شارع واحد | سد' ? 'شارع واحد' : p.location
      })) as Property[];
      
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
      
      const deleted = allProps.filter(p => p.status === 'deleted');
      const active = allProps.filter(p => p.status !== 'deleted');
      
      setProperties(active);
      setDeletedProperties(deleted);
      
      if (isAdmin) {
        deleted.forEach(async (p) => {
          if (p.deleted_at) {
            const deletedTime = new Date(p.deleted_at).getTime();
            if (now - deletedTime > thirtyDaysMs) {
              await supabase.from('properties').delete().eq('id', p.id);
            }
          }
        });
      }
    };

    fetchProperties();

    const subscription = supabase
      .channel('properties_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => {
        fetchProperties();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, isSuperAdmin, selectedCompanyId]);

  // Notifications Listener
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchNotifications = async () => {
      let query = supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(50);
      
      if (isSuperAdmin) {
        // No additional filters
      } else if (user.role === 'admin') {
        query = query.eq('company_id', user.company_id);
      } else {
        query = query.eq('recipient_id', user.id);
      }

      const { data, error } = await query;
      if (error) {
        handleError(error, OperationType.GET, 'notifications');
        return;
      }
      setNotifications(data as Notification[]);
    };

    fetchNotifications();

    const subscription = supabase
      .channel('notifications_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  // Favorites Listener
  useEffect(() => {
    if (!user?.id) return;
    
    const fetchFavorites = async () => {
      const { data, error } = await supabase
        .from('favorites')
        .select('property_id')
        .eq('user_id', user.id);
      
      if (error) {
        console.error("Favorites error:", error);
        return;
      }
      setFavorites(data.map(f => f.property_id));
    };

    fetchFavorites();

    const subscription = supabase
      .channel('favorites_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${user.id}` }, () => {
        fetchFavorites();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  // All Users Listener (for Admin Management) - REMOVED, consolidated above

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);
    try {
      const generatedEmail = usernameToEmail(username);
      if (authMode === 'register') {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email: generatedEmail,
          password: password,
          options: {
            data: {
              full_name: username
            }
          }
        });

        if (signUpError) throw signUpError;
        
        const sbUser = authData.user;
        if (sbUser) {
          const isSuper = SUPER_ADMIN_EMAILS.includes(generatedEmail);
          const role = isSuper ? 'super_admin' : 'pending';
          const newProfile = {
            id: sbUser.id,
            email: generatedEmail,
            display_name: username,
            role: role,
            created_at: new Date().toISOString()
          };
          
          await supabase.from('user_profiles').insert(newProfile);
          
          if (role === 'pending') {
            await supabase.from('notifications').insert({
              type: 'new-user',
              title: 'طلب انضمام جديد',
              message: `المستخدم ${username} يطلب الانضمام للنظام`,
              user_id: sbUser.id,
              read: false
            });
          }
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: generatedEmail,
          password: password
        });
        if (signInError) throw signInError;
      }
    } catch (error: any) {
      console.error("Auth failed", error);
      let message = `خطأ: ${error.message || "حدث خطأ أثناء تسجيل الدخول"}`;
      if (error.message?.includes('Invalid login credentials')) {
        message = "اسم المستخدم أو كلمة المرور غير صحيحة، أو الحساب غير موجود. تأكد من اختيار 'إنشاء حساب' إذا كنت تسجل لأول مرة.";
      } else if (error.message?.includes('User already registered')) {
        message = "هذا المستخدم مسجل بالفعل. جرب تسجيل الدخول بدلاً من إنشاء حساب جديد.";
      }
      setAuthError(message);
      toast.error(message);
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const handleDeleteAccount = () => {
    if (!user?.id) return;
    setAccountDeleteConfirm(true);
  };

  const confirmAccountDelete = async () => {
    if (!user?.id) return;
    
    setIsAuthenticating(true);
    try {
      // With Supabase, we usually delete the user profile and let a trigger handle auth deletion 
      // or we use the admin API if we have permissions.
      // For now, let's delete the profile.
      await supabase.from('user_profiles').delete().eq('id', user.id);
      
      await supabase.auth.signOut();
      toast.success("تم حذف الحساب بنجاح. يمكنك الآن إعادة التسجيل.");
      window.location.reload();
    } catch (error: any) {
      console.error("Account deletion failed", error);
      toast.error(`حدث خطأ أثناء حذف الحساب: ${error.message}`);
    } finally {
      setIsAuthenticating(false);
      setAccountDeleteConfirm(false);
    }
  };



  const availableFilterOptions = useMemo(() => {
    let currentAreas: string[] = [];
    if (filters.governorate && AREAS[filters.governorate]) {
      currentAreas = [...AREAS[filters.governorate]].sort();
    } else {
      currentAreas = Array.from(new Set(Object.values(AREAS).flat())).sort();
    }

    const marketers = new Set<string>();

    properties.forEach(p => {
      if (p.assigned_employee_name) marketers.add(p.assigned_employee_name);
    });

    return {
      governorates: [...GOVERNORATES],
      areas: currentAreas,
      types: [...PROPERTY_TYPES],
      purposes: [...PURPOSES],
      locations: [...LOCATIONS],
      marketers: Array.from(marketers).sort()
    };
  }, [properties, filters.governorate]);

  const filteredProperties = useMemo(() => {
    const sourceProperties = view === 'trash' ? deletedProperties : properties;
    return sourceProperties.filter(p => {
      // View specific filtering
      if (view === 'my-listings' && p.created_by !== user?.id) return false;
      if (view === 'my-favorites' && !favorites.includes(p.id)) return false;
      if (view === 'user-listings' && selectedMarketerId && p.assigned_employee_id !== selectedMarketerId) return false;
      if (view === 'pending-properties' && p.status !== 'pending') return false;
      
      // Approval status filtering - REMOVED to allow all users to see all properties
      // if (!isAdmin && view !== 'pending-properties' && p.status !== 'approved' && p.created_by !== user?.id) return false;

      const matchesSearch = 
        searchMatch(p.name, searchQuery) || 
        searchMatch(p.phone, searchQuery) || 
        searchMatch(p.area, searchQuery) || 
        searchMatch(p.assigned_employee_name || '', searchQuery);
      
      const matchesGov = !filters.governorate || p.governorate === filters.governorate;
      const matchesArea = !filters.area || p.area === filters.area;
      const matchesType = !filters.type || p.type === filters.type;
      const matchesPurpose = !filters.purpose || p.purpose === filters.purpose;
      const matchesLocation = !filters.location || p.location === filters.location;
      const matchesMarketer = !filters.marketer || p.assigned_employee_name === filters.marketer;
      const matchesStatus = !filters.status || 
                           (filters.status === 'sold' && p.is_sold) || 
                           (filters.status === 'available' && !p.is_sold);

      return matchesSearch && matchesGov && matchesArea && matchesType && matchesPurpose && matchesLocation && matchesMarketer && matchesStatus;
    }).sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [properties, deletedProperties, searchQuery, filters, view, favorites, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f5f5f0] p-4 sm:p-6" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 sm:p-10 rounded-2xl shadow-xl max-w-4xl w-full border border-stone-200"
        >
          <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
            <Home className="text-emerald-600 w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900 mb-2 text-center serif">شركة مصادقة العقارية</h1>
          <p className="text-stone-500 mb-8 text-center text-sm sm:text-base">نظام إدارة العقارات المتكامل</p>

          {window.self !== window.top && (
            <div className="bg-amber-50 text-amber-800 p-4 rounded-xl text-sm mb-6 border border-amber-200 shadow-sm">
              <p className="font-bold mb-2 flex items-center gap-2">
                <span className="text-lg">⚠️</span> تنبيه هام:
              </p>
              <p className="leading-relaxed">أنت تشاهد التطبيق داخل نافذة معاينة. لتسجيل الدخول بنجاح، يرجى الضغط على زر "فتح في نافذة مستقلة" في الأسفل.</p>
              <a 
                href={window.location.href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-2.5 rounded-lg hover:bg-amber-700 transition-colors font-bold shadow-sm"
              >
                <ExternalLink size={16} />
                فتح في نافذة مستقلة
              </a>
            </div>
          )}

          {authError && (
            <div className={`p-4 rounded-xl text-sm mb-6 text-center border shadow-sm font-medium ${authError.includes('المراجعة') ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
              <p>{authError}</p>
              {authError.includes('المراجعة') && (
                <a 
                  href={`https://wa.me/96565814909?text=${encodeURIComponent('من فضلك اقبل الدخول الي حسابي ( اكتب هنا اسم الحساب )')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors font-bold shadow-sm"
                >
                  <MessageCircle size={18} />
                  راسل المسؤول للموافقة
                </a>
              )}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-5">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 px-1">
                  {authMode === 'login' ? 'اسم المستخدم أو رقم الهاتف أو البريد الإلكتروني' : 'اسم المستخدم (الاسم الكامل)'}
                </label>
                <input 
                  type="text"
                  placeholder={authMode === 'login' ? "أدخل اسم المستخدم أو رقم الهاتف" : "أدخل اسمك الكامل"}
                  required
                  className="w-full p-3.5 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm text-right"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5 px-1">كلمة المرور</label>
                <div className="relative flex items-center">
                  <input 
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    required
                    className="w-full p-3.5 pr-12 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all text-sm text-left"
                    dir="ltr"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 p-1.5 text-stone-500 hover:text-stone-600 rounded-lg transition-colors flex items-center justify-center"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            <button 
              type="submit"
              disabled={isAuthenticating}
              className="w-full bg-emerald-600 text-white py-4 rounded-xl hover:bg-emerald-700 transition-all font-bold disabled:opacity-50 flex items-center justify-center shadow-md hover:shadow-lg mt-6"
            >
              {isAuthenticating ? (
                <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-white"></div>
              ) : (
                authMode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'
              )}
            </button>
            
            <div className="flex flex-col gap-3 items-center pt-4 border-t border-stone-100 mt-6">
              <button 
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                className="text-stone-600 text-sm font-medium hover:text-stone-900 transition-colors"
              >
                {authMode === 'login' ? 'ليس لديك حساب؟ ' : 'لديك حساب بالفعل؟ '}
                <span className="text-emerald-600 font-bold hover:underline">
                  {authMode === 'login' ? 'سجل الآن' : 'سجل دخولك'}
                </span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  const handleSyncFrom = async (spreadsheet_id: string, range: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const idToken = session?.access_token;
    if (!idToken) return;
    
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, spreadsheet_id, range })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Sync failed');
      }
      const data = await response.json();
      
      if (data && Array.isArray(data)) {
        const startIdx = (data[0] && data[0][0] === 'ID') ? 1 : 0;
        
        for (let i = startIdx; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 2) continue;
          
          const [
            id, name, governorate, area, type, purpose, phone, 
            assigned_employee_id, assigned_employee_name, imagesStr, linksStr, 
            location_link, is_soldStr, sector, block, street, avenue, 
            plot_number, house_number, location, details, last_comment, 
            status_label, created_by, created_atStr
          ] = row;

          const cleanVal = (val: string) => val ? val.replace(/resedintal|residental|residential/gi, '').trim() : '';

          const cPurpose = cleanVal(purpose);
          const cType = cleanVal(type);
          const cName = cleanVal(name);
          const cArea = cleanAreaName(cleanVal(area));

          const newPurpose = inferPurpose(cPurpose) || inferPurpose(cType) || inferPurpose(cName);
          const newType = inferType(cType) || inferType(cPurpose) || inferType(cName);
          const newGov = inferGovernorate(cArea, cleanVal(governorate));

          const propertyData: any = {
            name: cName,
            governorate: newGov,
            area: cArea,
            type: newType,
            purpose: newPurpose,
            phone: cleanVal(phone),
            assigned_employee_id: assigned_employee_id || '',
            assigned_employee_name: assigned_employee_name || '',
            images: imagesStr ? imagesStr.split(',').filter(Boolean) : [],
            links: linksStr ? linksStr.split(',').filter(Boolean) : [],
            location_link: location_link || '',
            is_sold: is_soldStr === 'TRUE' || is_soldStr === 'نعم' || is_soldStr === 'مباع',
            sector: cleanVal(sector),
            block: cleanVal(block),
            street: cleanVal(street),
            avenue: cleanVal(avenue),
            plot_number: cleanVal(plot_number),
            house_number: cleanVal(house_number),
            location: cleanVal(location),
            details: cleanVal(details),
            status_label: cleanVal(status_label),
            updated_at: new Date().toISOString()
          };

          if (last_comment) {
            propertyData.last_comment = cleanVal(last_comment);
          }

          if (id && id.length > 5) {
            const { error: updateError } = await supabase.from('properties').update(propertyData).eq('id', id);
            if (updateError) {
              await supabase.from('properties').insert({
                ...propertyData,
                created_at: created_atStr ? new Date(created_atStr).toISOString() : new Date().toISOString(),
                created_by: created_by || user?.id
              });
            }
          } else {
            await supabase.from('properties').insert({
              ...propertyData,
              created_at: created_atStr ? new Date(created_atStr).toISOString() : new Date().toISOString(),
              created_by: created_by || user?.id
            });
          }
        }
      }
      
      toast.success('تمت المزامنة من الشيت بنجاح');
      setSpreadsheetId(spreadsheet_id);
      setIsSyncModalOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(`حدث خطأ أثناء المزامنة من الشيت: ${e.message}`);
    }
  };

  const handleSyncTo = async (id: string, rng: string) => {
    const targetId = id || spreadsheet_id;
    if (!targetId) {
      toast.error('يرجى حفظ رابط الشيت أولاً');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const idToken = session?.access_token;
    if (!idToken) return;
    
    // Prepare data from properties state
    const header = [
      'ID', 'الاسم', 'المحافظة', 'المنطقة', 'النوع', 'الغرض', 'الهاتف', 
      'ID الموظف', 'اسم الموظف', 'الصور', 'الروابط', 'رابط الموقع', 
      'مباع', 'القطاع', 'القطعة', 'الشارع', 'الجادة', 'القسيمة', 
      'المنزل', 'الموقع الوصفي', 'التفاصيل', 'آخر تعليق', 'ملصق الحالة', 
      'أنشئ بواسطة', 'تاريخ الإنشاء'
    ];
    
    const data = [header, ...properties.map(p => [
      p.id, 
      p.name || '', 
      p.governorate || '', 
      p.area || '', 
      p.type || '', 
      p.purpose || '', 
      p.phone || '', 
      p.assigned_employee_id || '', 
      p.assigned_employee_name || '', 
      (p.images || []).join(','), 
      p.location_link || '', 
      p.is_sold ? 'TRUE' : 'FALSE', 
      p.sector || '', 
      p.block || '', 
      p.street || '', 
      p.avenue || '', 
      p.plot_number || '', 
      p.house_number || '', 
      p.location || '', 
      p.details || '', 
      p.last_comment || '', 
      p.status_label || '', 
      p.created_by || '', 
      p.created_at ? (typeof p.created_at === 'string' ? p.created_at : new Date(p.created_at).toISOString()) : ''
    ])];
    
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, spreadsheet_id: targetId, range: rng, data })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Sync failed');
      }
      toast.success('تمت المزامنة إلى الشيت بنجاح');
      setIsSyncModalOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(`حدث خطأ أثناء المزامنة إلى الشيت: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-stone-900 font-sans" dir="rtl">
      <SyncModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)} 
        onSyncFrom={handleSyncFrom}
        onSyncTo={handleSyncTo}
        spreadsheet_id={spreadsheet_id}
        setSpreadsheetId={setSpreadsheetId}
      />
      {/* Drawer Overlay */}
      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImages.length > 0 && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-10"
            onClick={() => setPreviewImages([])}
          >
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-3 rounded-full backdrop-blur-md transition-all z-10"
              onClick={() => setPreviewImages([])}
            >
              <X size={24} />
            </motion.button>
            
            <motion.img 
              key={previewIndex}
              initial={{ x: 300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -300, opacity: 0 }}
              src={previewImages[previewIndex]}
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={(e, { offset, velocity }) => {
                const swipe = offset.x;
                if (swipe < -100) {
                  setPreviewIndex(prev => Math.min(prev + 1, previewImages.length - 1));
                } else if (swipe > 100) {
                  setPreviewIndex(prev => Math.max(prev - 1, 0));
                }
              }}
            />
            
            {previewImages.length > 1 && (
              <div className="absolute bottom-6 text-white text-sm font-bold bg-black/50 px-4 py-2 rounded-full">
                {previewIndex + 1} / {previewImages.length}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/50 z-[60] backdrop-blur-sm"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-80 bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600">
                    <UserIcon size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-stone-900">{user.display_name}</p>
                    <p className="text-xs text-stone-500">
                      {isSuperAdmin ? 'مدير النظام العام' : user.role === 'admin' ? 'مدير الشركة' : user.role === 'pending' ? 'قيد المراجعة' : 'موظف'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 hover:bg-stone-100 rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-1">

                <button 
                  onClick={() => { setView('list'); setIsDrawerOpen(false); }}
                  className={`w-full flex items-center gap-4 p-3 rounded-lg transition-colors ${view === 'list' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-stone-50 text-stone-600'}`}
                >
                  <Home size={20} />
                  <span className="font-bold text-md">الرئيسية</span>
                </button>

                {isEmployee && (
                  <button 
                    onClick={() => { setView('add'); setIsDrawerOpen(false); }}
                    className={`w-full flex items-center gap-4 p-3 rounded-lg transition-colors ${view === 'add' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-stone-50 text-stone-600'}`}
                  >
                    <Plus size={20} className="text-emerald-600" />
                    <span className="font-bold text-md">إضافة عقار</span>
                  </button>
                )}

                <button 
                  onClick={() => { setView('my-listings'); setIsDrawerOpen(false); }}
                  className={`w-full flex items-center gap-4 p-3 rounded-lg transition-colors ${view === 'my-listings' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-stone-50 text-stone-600'}`}
                >
                  <LayoutList size={20} />
                  <span className="font-bold text-md">إعلاناتي</span>
                </button>

                <button 
                  onClick={() => { setView('my-favorites'); setIsDrawerOpen(false); }}
                  className={`w-full flex items-center gap-4 p-3 rounded-lg transition-colors ${view === 'my-favorites' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-stone-50 text-stone-600'}`}
                >
                  <Heart size={20} />
                  <span className="font-bold text-md">إعلاناتي المفضلة</span>
                </button>

                {isAdmin && (
                  <>
                    <button 
                      onClick={() => { setView('notifications'); setIsDrawerOpen(false); }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${view === 'notifications' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-stone-50 text-stone-600'}`}
                    >
                      <div className="flex items-center gap-4">
                        <Bell size={20} className="text-stone-500" />
                        <span className="font-bold text-md">الإشعارات</span>
                      </div>
                      {notifications.filter(n => !n.read).length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {notifications.filter(n => !n.read).length}
                        </span>
                      )}
                    </button>

                    <button 
                      onClick={() => { setView('pending-properties'); setIsDrawerOpen(false); }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${view === 'pending-properties' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-stone-50 text-stone-600'}`}
                    >
                      <div className="flex items-center gap-4">
                        <ClipboardCheck size={20} />
                        <span className="font-bold text-md">عقارات قيد المراجعة</span>
                      </div>
                      {properties.filter(p => p.status === 'pending').length > 0 && (
                        <span className="w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                      )}
                    </button>

                    <button 
                      onClick={() => { setView('manage-marketers'); setIsDrawerOpen(false); }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${view === 'manage-marketers' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-stone-50 text-stone-600'}`}
                    >
                      <div className="flex items-center gap-4">
                        <UserIcon size={20} />
                        <span className="font-bold text-md">المستخدمين</span>
                      </div>
                      {employees.filter(e => e.role === 'pending').length > 0 && (
                        <span className="w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                      )}
                    </button>

                    <button 
                      onClick={() => { setView('trash'); setIsDrawerOpen(false); }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${view === 'trash' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-stone-50 text-stone-600'}`}
                    >
                      <div className="flex items-center gap-4">
                        <Trash2 size={20} />
                        <span className="font-bold text-md">سلة المحذوفات</span>
                      </div>
                      {deletedProperties.length > 0 && (
                        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {deletedProperties.length}
                        </span>
                      )}
                    </button>

                    <button 
                      onClick={handleBackup}
                      className="w-full flex items-center gap-4 p-3 rounded-lg transition-colors hover:bg-stone-50 text-stone-600"
                    >
                      <Download size={20} />
                      <span className="font-bold text-md">نسخة احتياطية</span>
                    </button>

                    <button 
                      onClick={() => {
                        if (!spreadsheet_id) {
                          toast.error('يرجى حفظ رابط الشيت أولاً');
                          return;
                        }
                        setIsSyncModalOpen(true);
                        setIsDrawerOpen(false);
                      }}
                      className="w-full flex items-center gap-4 p-3 rounded-lg transition-colors hover:bg-stone-50 text-stone-600"
                    >
                      <RefreshCw size={20} className="text-stone-500" />
                      <span className="font-bold text-md">مزامنة البيانات</span>
                    </button>
                  </>
                )}

                {isSuperAdmin && (
                  <>
                    <button 
                      onClick={() => { setView('manage-companies'); setIsDrawerOpen(false); }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg transition-colors ${view === 'manage-companies' ? 'bg-emerald-50 text-emerald-700' : 'hover:bg-stone-50 text-stone-600'}`}
                    >
                      <div className="flex items-center gap-4">
                        <Building2 size={20} />
                        <span className="font-bold text-md">إدارة الشركات</span>
                      </div>
                    </button>

                    {companies.length > 0 && (
                      <div className="p-3 bg-stone-50 rounded-lg border border-stone-100 space-y-1 mt-1">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider px-1">عرض بيانات شركة:</label>
                        <select 
                          value={selectedCompanyId || ''}
                          onChange={(e) => {
                            setSelectedCompanyId(e.target.value);
                            setIsDrawerOpen(false);
                            setView('list');
                          }}
                          className="w-full p-1.5 text-sm border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                        >
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}



                {/* Sync Management moved to bottom */}
                {isAdmin && (
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-100 space-y-2 mt-4">
                    <button 
                      onClick={() => setIsSyncManagementOpen(!isSyncManagementOpen)}
                      className="w-full flex items-center justify-between text-sm font-bold text-stone-700"
                    >
                      <span>إدارة المزامنة</span>
                      <span>{isSyncManagementOpen ? '▲' : '▼'}</span>
                    </button>
                    {isSyncManagementOpen && (
                      <div className="space-y-3 pt-2">
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-[10px] font-bold text-blue-800 mb-1 uppercase tracking-wider">بريد حساب الخدمة (للمشاركة):</p>
                          <p className="text-[9px] text-blue-600 break-all font-mono select-all">
                            firebase-adminsdk-fbsvc@gen-lang-client-0876291410.iam.gserviceaccount.com
                          </p>
                          <p className="text-[9px] text-blue-500 mt-2 italic">* يجب إضافة هذا البريد كـ Editor في ملف الشيت.</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-stone-500 px-1">رابط ملف Google Sheet</label>
                          <input 
                            type="text"
                            value={tempSpreadsheetId}
                            onChange={(e) => setTempSpreadsheetId(e.target.value)}
                            placeholder="أدخل رابط الشيت هنا"
                            className="w-full p-2 text-sm border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <button 
                          onClick={async () => {
                            const extractedId = extractSpreadsheetId(tempSpreadsheetId);
                            try {
                              const { error } = await supabase.from('settings').upsert({ id: 'sync', spreadsheet_id: extractedId });
                              if (error) throw error;
                              setSpreadsheetId(extractedId);
                              toast.success('تم حفظ الرابط');
                            } catch (err) {
                              handleError(err, OperationType.WRITE, 'settings/sync');
                            }
                          }}
                          className="w-full bg-emerald-600 text-white p-2 rounded-lg text-sm font-bold hover:bg-emerald-700"
                        >
                          حفظ الرابط
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 mt-4 border-t border-stone-100">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={20} />
                    <span className="font-medium">تسجيل الخروج</span>
                  </button>
                </div>
              </div>

              <div className="p-6 bg-stone-50 text-center">
                <p className="text-xs text-stone-500">شركة مصادقة العقارية v1.0</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <Toaster position="top-center" />
      <header className="ios-glass sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsDrawerOpen(true)}
              className="p-2 hover:bg-stone-100/50 rounded-full transition-colors text-stone-600 relative"
            >
              <svg 
                width="32" 
                height="32" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <line x1="3" y1="5" x2="21" y2="5" />
                <line x1="3" y1="10" x2="21" y2="10" />
                <line x1="3" y1="15" x2="21" y2="15" />
                <line x1="3" y1="20" x2="21" y2="20" />
              </svg>
            </button>
            <div 
              onClick={() => setView('list')}
              className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-emerald-100">
                <Home size={24} />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-emerald-900 hidden sm:block text-center">
                {isSuperAdmin && selectedCompanyId 
                  ? (companies.find(c => c.id === selectedCompanyId)?.name || 'شركة مصادقة العقارية')
                  : 'شركة مصادقة العقارية'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              {isEmployee && (
                <button 
                  onClick={() => setView('add')}
                  className="ios-button-primary flex items-center gap-2 px-3 md:px-4 py-2 text-sm"
                >
                  <Plus size={18} />
                  <span className="hidden sm:inline">إضافة عقار</span>
                </button>
              )}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-sm font-semibold">{user.display_name}</p>
              <p className="text-xs text-stone-500">{user.role === 'admin' ? 'مدير النظام' : user.role === 'pending' ? 'قيد المراجعة' : 'موظف'}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full">
        <AnimatePresence mode="wait">
          {(view === 'list' || view === 'my-listings' || view === 'my-favorites' || view === 'user-listings' || view === 'pending-properties' || view === 'trash') && (
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
                      
                      {Object.entries(filters).filter(([_, val]) => val !== '').map(([key, value]) => (
                        <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-bold whitespace-nowrap">
                          {value}
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
                            // Delay blur to allow clicking suggestions or the clear button
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
                              {searchSuggestions.map(opt => (
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
                    onChange={(val) => setFilters({...filters, governorate: val, area: ''})}
                  />

                  <SearchableFilter 
                    placeholder="المنطقة..."
                    options={availableFilterOptions.areas}
                    value={filters.area}
                    onChange={(val) => setFilters({...filters, area: val})}
                  />

                  <SearchableFilter 
                    placeholder="نوع العقار..."
                    options={availableFilterOptions.types}
                    value={filters.type}
                    onChange={(val) => setFilters({...filters, type: val})}
                  />

                  <SearchableFilter 
                    placeholder="الغرض..."
                    options={availableFilterOptions.purposes}
                    value={filters.purpose}
                    onChange={(val) => setFilters({...filters, purpose: val})}
                  />

                  <SearchableFilter 
                    placeholder="الموقع..."
                    options={availableFilterOptions.locations}
                    value={filters.location}
                    onChange={(val) => setFilters({...filters, location: val})}
                  />

                  <SearchableFilter 
                    placeholder="ابحث بالمستخدم..."
                    options={availableFilterOptions.marketers}
                    value={filters.marketer}
                    onChange={(val) => setFilters({...filters, marketer: val})}
                  />

                  <div className="bg-white/70 backdrop-blur-md border border-stone-200 rounded-lg p-2 h-[46px] flex flex-col justify-center focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all shadow-sm hover:border-stone-300">
                    <div className="relative flex items-center">
                      <select 
                        className="w-full bg-transparent border-none p-0 text-sm text-right outline-none focus:ring-0 appearance-none"
                        value={filters.status}
                        onChange={(e) => setFilters({...filters, status: e.target.value})}
                      >
                        <option value="">ابحث بالحالة (الكل)</option>
                        <option value="available">متاح</option>
                        <option value="sold">مباع</option>
                      </select>
                      <ChevronDown size={14} className="mr-2 text-stone-300 pointer-events-none shrink-0" />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-4 border-t border-stone-100">
                  <button 
                    className="w-full py-3.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 hover:shadow-emerald-200/50 transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-[0.98]"
                  >
                    <Search size={18} />
                    بحث
                  </button>
                  {(searchQuery || filters.governorate || filters.area || filters.type || filters.purpose || filters.location || filters.marketer || filters.status !== '') && (
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setFilters({ governorate: '', area: '', type: '', purpose: '', location: '', marketer: '', status: '' });
                      }}
                      className="w-full py-3 bg-stone-100 text-stone-600 rounded-lg hover:bg-stone-200 transition-all font-bold flex items-center justify-center gap-2"
                    >
                      <X size={16} />
                      مسح كافة الفلاتر والبحث
                    </button>
                  )}
                </div>
              </div>

              {/* Actions & Results Header */}
              <div className="flex justify-center items-center">
                <h2 className="text-2xl font-bold serif text-center">
                  {view === 'pending-properties' ? `عقارات قيد المراجعة (${filteredProperties.length})` : view === 'trash' ? `سلة المحذوفات (${filteredProperties.length})` : (searchQuery || filters.governorate || filters.area || filters.type || filters.purpose || filters.location || filters.marketer || filters.status
                    ? `نتائج البحث (${filteredProperties.length})` 
                    : `${view === 'list' ? 'كل العقارات' : view === 'my-listings' ? 'إعلاناتي' : view === 'my-favorites' ? 'إعلاناتي المفضلة' : `عقارات ${employees.find(emp => emp.id === selectedMarketerId)?.display_name || 'المستخدم'}`} (${filteredProperties.length})`)}
                </h2>
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
                        onFavorite={() => toggleFavorite(p.id)}
                        onClick={() => {
                          setSelectedProperty(p);
                          setPrevView(view as any);
                          setView('details');
                        }}
                        onImageClick={(images: string[], index: number) => {
                          setPreviewImages(images);
                          setPreviewIndex(index);
                        }}
                        isAdmin={isAdmin}
                        onApprove={async (id: string) => {
                          const { error } = await supabase.from('properties').update({ status: 'approved' }).eq('id', id);
                          if (error) handleError(error, OperationType.UPDATE, 'properties');
                          else toast.success('تم قبول العقار');
                        }}
                        onReject={async (id: string) => {
                          const { error } = await supabase.from('properties').update({ status: 'rejected' }).eq('id', id);
                          if (error) handleError(error, OperationType.UPDATE, 'properties');
                          else toast.success('تم رفض العقار');
                        }}
                        onEdit={(p: any) => {
                          setSelectedProperty(p);
                          setView('edit');
                        }}
                        onDelete={(id: string) => {
                          setDeleteConfirm({ isOpen: true, property_id: id });
                        }}
                        onRestore={restoreProperty}
                        onPermanentDelete={permanentDeleteProperty}
                        view={view}
                        onFilter={(key: string, value: string) => {
                          setFilters(prev => ({ ...prev, [key]: value }));
                          setSearchQuery('');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onUserClick={(user_id: string) => {
                          setSelectedMarketerId(user_id);
                          setPrevView(view as any);
                          setView('user-listings');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      />
                    ))}
                  </div>

                  {visibleCount < filteredProperties.length && (
                    <div className="flex justify-center pt-8">
                      <button 
                        onClick={() => setVisibleCount(prev => prev + 50)}
                        className="bg-white text-emerald-600 border-2 border-emerald-600 px-12 py-3 rounded-xl hover:bg-emerald-50 transition-all font-bold"
                      >
                        عرض المزيد من العقارات
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
          )}

          {(view === 'add' || view === 'edit') && (
            <div className="px-4 py-6 w-full max-w-5xl mx-auto">
              <PropertyForm 
                property={view === 'edit' ? selectedProperty : null}
                isAdmin={isAdmin}
                user={user}
                selectedCompanyId={selectedCompanyId}
                companies={companies}
                onCancel={() => window.history.back()}
                onSave={() => setView('list')}
              />
            </div>
          )}



          {view === 'notifications' && isAdmin && (
            <motion.div 
              key="notifications-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 w-full px-4 py-8"
            >
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => setView('list')}
                      className="p-2 hover:bg-stone-100/50 rounded-full transition-all text-stone-500 ios-glass"
                    >
                      <ChevronRight size={24} />
                    </button>
                    <h2 className="text-2xl font-bold tracking-tight">الإشعارات</h2>
                  </div>
                  <button 
                    onClick={async () => {
                      const unread = notifications.filter(n => !n.read);
                      for (const n of unread) {
                        await supabase.from('notifications').update({ read: true }).eq('id', n.id);
                      }
                    }}
                    className="text-sm text-emerald-600 font-bold hover:underline"
                  >
                    تحديد الكل كمقروء
                  </button>
                </div>

                <div className="space-y-2">
                  {notifications.length > 0 ? (
                    notifications.map(n => (
                      <div 
                        key={n.id} 
                        className={`p-4 rounded-xl border border-stone-100 hover:bg-stone-50 transition-colors cursor-pointer ${!n.read ? 'bg-emerald-50/30' : ''}`}
                        onClick={async () => {
                          if (!n.read) await supabase.from('notifications').update({ read: true }).eq('id', n.id);
                          if (n.type === 'new-user') {
                            setView('manage-marketers');
                          } else if (n.property_id) {
                            const prop = properties.find(p => p.id === n.property_id);
                            if (prop) {
                              setSelectedProperty(prop);
                              setView('details');
                            }
                          }
                        }}
                      >
                        <div className="flex gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            n.type === 'new-user' ? 'bg-blue-100 text-blue-600' : 
                            n.type === 'price-change' ? 'bg-amber-100 text-amber-600' :
                            n.type === 'status-change' ? 'bg-purple-100 text-purple-600' :
                            n.type === 'new-comment' ? 'bg-emerald-100 text-emerald-600' :
                            'bg-stone-100 text-stone-600'
                          }`}>
                            {n.type === 'new-user' ? <UserPlus size={20} /> : 
                             n.type === 'price-change' ? <Tag size={20} /> :
                             n.type === 'status-change' ? <LayoutList size={20} /> :
                             n.type === 'new-comment' ? <MessageSquare size={20} /> :
                             <Bell size={20} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-stone-900">{n.title}</p>
                            <p className="text-sm text-stone-500 mt-1">{n.message}</p>
                            <p className="text-xs text-stone-500 mt-2">{formatRelativeDate(n.created_at)}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-12 text-center text-stone-500">
                      <Bell size={48} className="mx-auto mb-4 opacity-20" />
                      <p>لا توجد إشعارات حالياً</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view === 'manage-companies' && isSuperAdmin && (
            <motion.div 
              key="manage-companies-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 w-full px-4 py-8"
            >
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6">
                <div className="flex items-center gap-4 mb-8">
                  <button 
                    onClick={() => window.history.back()}
                    className="p-2 hover:bg-stone-100/50 rounded-full transition-all text-stone-500 ios-glass"
                  >
                    <ChevronRight size={24} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">إدارة الشركات</h2>
                    <p className="text-sm text-stone-500">إضافة وإدارة الشركات المشتركة في النظام</p>
                  </div>
                </div>

                <div className="ios-glass p-6 rounded-2xl mb-8 border border-white/20 shadow-sm">
                  <h3 className="font-bold text-stone-900 mb-6 flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                      <Building2 size={18} />
                    </div>
                    إضافة شركة جديدة
                  </h3>
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const name = (form.elements.namedItem('companyName') as HTMLInputElement).value;
                      const company_id = (form.elements.namedItem('company_id') as HTMLInputElement).value;
                      const address = (form.elements.namedItem('companyAddress') as HTMLInputElement).value;
                      const phone = (form.elements.namedItem('companyPhone') as HTMLInputElement).value;
                      
                      if (company_id.length !== 4) {
                        toast.error('يجب أن يكون كود الشركة مكوناً من 4 خانات');
                        return;
                      }

                      try {
                        const { error } = await supabase.from('companies').insert({
                          name,
                          company_id,
                          address,
                          phone,
                          created_at: new Date().toISOString()
                        });
                        if (error) throw error;
                        toast.success('تمت إضافة الشركة بنجاح');
                        form.reset();
                      } catch (err: any) {
                        toast.error('حدث خطأ: ' + err.message);
                      }
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider px-1">اسم الشركة</label>
                      <input name="companyName" placeholder="مثال: شركة العقارات المتحدة" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">كود الشركة (4 خانات)</label>
                      <input name="company_id" placeholder="مثال: A1B2" maxLength={4} className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-mono" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">رقم الهاتف (اختياري)</label>
                      <input name="companyPhone" placeholder="99xxxxxx" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" />
                    </div>
                    <div className="space-y-1 md:col-span-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">العنوان</label>
                      <input name="companyAddress" placeholder="العنوان بالتفصيل" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" />
                    </div>
                    <button type="submit" className="md:col-span-2 ios-button-primary py-3 mt-2">إضافة الشركة</button>
                  </form>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold text-stone-900 px-2">قائمة الشركات ({companies.length})</h3>
                  <div className="grid grid-cols-1 gap-3">
                    {companies.map(company => (
                      <div key={company.id} className="ios-glass p-4 rounded-2xl border border-white/20 flex flex-col gap-3 shadow-sm group hover:shadow-md transition-all">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors shrink-0">
                            <Building2 size={20} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-stone-800 truncate">{company.name}</h3>
                            <p className="text-xs text-stone-500 truncate mt-0.5">
                              {company.phone} • {company.address || 'بدون عنوان'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 py-2 border-y border-stone-50">
                          <button 
                            onClick={() => {
                              setTargetCompanyForUser(company);
                              setIsAddingUserToCompany(true);
                            }}
                            className="flex-1 px-3 py-2 bg-blue-50 text-blue-600 text-[11px] font-bold rounded-xl hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                          >
                            <UserPlus size={14} />
                            إضافة مستخدم
                          </button>
                          <button 
                            onClick={() => {
                              setSelectedCompanyId(company.id);
                              setView('add');
                              toast(`إضافة عقار لشركة: ${company.name}`);
                            }}
                            className="flex-1 px-3 py-2 bg-amber-50 text-amber-600 text-[11px] font-bold rounded-xl hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                          >
                            <Plus size={14} />
                            إضافة عقار
                          </button>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button 
                            onClick={() => {
                              setSelectedCompanyId(company.id);
                              setView('list');
                              toast(`تم الانتقال لعرض بيانات: ${company.name}`);
                            }}
                            className="flex-1 px-3 py-1.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-lg hover:bg-emerald-100 transition-all flex items-center justify-center gap-1"
                          >
                            <Eye size={14} />
                            عرض البيانات
                          </button>
                          
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                if (confirm(`هل أنت متأكد من تعديل بيانات شركة ${company.name}؟`)) {
                                  setEditingCompany(company);
                                  setIsEditingCompany(true);
                                }
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="تعديل"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={async () => {
                                if (confirm(`هل أنت متأكد من حذف شركة ${company.name}؟ سيؤدي ذلك لحذف جميع بياناتها.`)) {
                                  try {
                                    const { error } = await supabase.from('companies').delete().eq('id', company.id);
                                    if (error) throw error;
                                    toast.success('تم حذف الشركة');
                                  } catch (err: any) {
                                    toast.error('خطأ: ' + err.message);
                                  }
                                }
                              }}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                              title="حذف"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Edit Company Modal */}
              <AnimatePresence>
                {isEditingCompany && editingCompany && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                  >
                    <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar border border-stone-100">
                      <div className="flex items-center justify-between sticky top-0 bg-white pb-4 z-10 border-b border-stone-50">
                        <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
                            <Edit size={20} className="text-blue-600" />
                          </div>
                          تعديل بيانات الشركة
                        </h3>
                        <button onClick={() => setIsEditingCompany(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400">
                          <X size={20} />
                        </button>
                      </div>

                      <form 
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const form = e.target as HTMLFormElement;
                          const name = (form.elements.namedItem('name') as HTMLInputElement).value;
                          const phone = (form.elements.namedItem('phone') as HTMLInputElement).value;
                          const address = (form.elements.namedItem('address') as HTMLInputElement).value;
                          
                          try {
                            const { error } = await supabase.from('companies').update({
                              name,
                              phone,
                              address
                            }).eq('id', editingCompany.id);
                            if (error) throw error;
                            toast.success('تم تحديث بيانات الشركة بنجاح');
                            setIsEditingCompany(false);
                          } catch (err: any) {
                            toast.error('حدث خطأ: ' + err.message);
                          }
                        }}
                        className="space-y-5 py-2"
                      >
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-stone-500 mr-1">اسم الشركة</label>
                          <input name="name" defaultValue={editingCompany.name} placeholder="اسم الشركة" className="w-full p-3.5 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm" required />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-stone-500 mr-1">رقم الهاتف</label>
                          <input name="phone" defaultValue={editingCompany.phone} placeholder="رقم الهاتف" className="w-full p-3.5 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-stone-500 mr-1">العنوان</label>
                          <input name="address" defaultValue={editingCompany.address} placeholder="العنوان" className="w-full p-3.5 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm" />
                        </div>
                        <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2">
                          <button type="button" onClick={() => setIsEditingCompany(false)} className="flex-1 py-3.5 rounded-xl border border-stone-200 text-stone-600 font-bold hover:bg-stone-50 transition-all active:scale-[0.98]">إلغاء</button>
                          <button type="submit" className="flex-1 bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-100 transition-all active:scale-[0.98]">حفظ التعديلات</button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Add User to Company Modal/Section */}
              <AnimatePresence>
                {isAddingUserToCompany && targetCompanyForUser && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                  >
                    <div className="bg-white rounded-3xl p-6 w-full max-w-4xl shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar border border-stone-100">
                      <div className="flex items-center justify-between sticky top-0 bg-white pb-4 z-10 border-b border-stone-50">
                        <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
                          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                            <UserPlus size={20} className="text-emerald-600" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-lg">إضافة مستخدم جديد</span>
                            <span className="text-xs text-stone-400 font-normal">شركة {targetCompanyForUser.name}</span>
                          </div>
                        </h3>
                        <button onClick={() => setIsAddingUserToCompany(false)} className="p-2 hover:bg-stone-100 rounded-full transition-colors text-stone-400">
                          <X size={20} />
                        </button>
                      </div>

                      <form 
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const form = e.target as HTMLFormElement;
                          const username = (form.elements.namedItem('username') as HTMLInputElement).value;
                          const password = (form.elements.namedItem('password') as HTMLInputElement).value;
                          const role = (form.elements.namedItem('role') as HTMLSelectElement).value;
                          const phone = (form.elements.namedItem('phone') as HTMLInputElement).value;
                          const email = (form.elements.namedItem('email') as HTMLInputElement).value;
                          
                          try {
                          try {
                            const { data: { session } } = await supabase.auth.getSession();
                            const token = session?.access_token;
                            
                            const response = await fetch('/api/create-user', {
                              method: 'POST',
                              headers: { 
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${token}`
                              },
                              body: JSON.stringify({
                                email: email || usernameToEmail(username),
                                password,
                                full_name: username,
                                role,
                                company_id: targetCompanyForUser.id,
                                phone: phone || ''
                              })
                            });

                            if (!response.ok) {
                              const errData = await response.json();
                              throw new Error(errData.error || 'فشل إنشاء المستخدم');
                            }

                            toast.success('تمت إضافة المستخدم بنجاح.');
                            setIsAddingUserToCompany(false);
                          } catch (err: any) {
                            toast.error('حدث خطأ: ' + err.message);
                          }
                          } catch (err: any) {
                            toast.error('حدث خطأ: ' + err.message);
                          }
                        }}
                        className="space-y-5 py-2"
                      >
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-stone-500 mr-1">الاسم الكامل</label>
                          <input name="username" placeholder="مثال: محمد علي" className="w-full p-3.5 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm" required />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-stone-500 mr-1">كلمة المرور</label>
                          <input name="password" type="password" placeholder="••••••••" className="w-full p-3.5 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm" required />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-stone-500 mr-1">رقم الهاتف (اختياري)</label>
                          <input name="phone" placeholder="99xxxxxx" className="w-full p-3.5 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-stone-500 mr-1">البريد الإلكتروني (اختياري)</label>
                          <input name="email" type="email" placeholder="user@example.com" className="w-full p-3.5 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-stone-500 mr-1">الصلاحية</label>
                          <div className="relative">
                            <select name="role" className="w-full p-3.5 rounded-xl bg-stone-50 border border-stone-200 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all text-sm appearance-none" required>
                              <option value="employee">موظف (إضافة وعرض العقارات)</option>
                              <option value="admin">مدير نظام (إدارة العقارات والموظفين للشركة)</option>
                            </select>
                            <ChevronDown size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                          </div>
                          <p className="text-[10px] text-stone-400 mt-1 px-1">
                            * المدير يمكنه حذف وتعديل العقارات وإدارة حسابات الموظفين التابعين لشركته.
                          </p>
                        </div>
                        <div className="flex gap-3 pt-4 sticky bottom-0 bg-white pb-2">
                          <button type="button" onClick={() => setIsAddingUserToCompany(false)} className="flex-1 py-3.5 rounded-xl border border-stone-200 text-stone-600 font-bold hover:bg-stone-50 transition-all active:scale-[0.98]">إلغاء</button>
                          <button type="submit" className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-[0.98]">إضافة المستخدم</button>
                        </div>
                      </form>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {view === 'manage-marketers' && isAdmin && (
            <motion.div 
              key="manage-marketers-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 w-full px-4 py-8"
            >
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-6">
                <div className="flex items-center gap-4 mb-8">
                  <button 
                    onClick={() => window.history.back()}
                    className="p-2 hover:bg-stone-100/50 rounded-full transition-all text-stone-500 ios-glass"
                  >
                    <ChevronRight size={24} />
                  </button>
                  <div>
                    <h2 className="text-2xl font-bold tracking-tight">إدارة المستخدمين</h2>
                    <p className="text-sm text-stone-500">إدارة جميع الحسابات والصلحيات في النظام</p>
                  </div>
                </div>

                <div className="ios-glass p-6 rounded-2xl mb-8 border border-white/20 shadow-sm">
                  <h3 className="font-bold text-stone-900 mb-6 flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 text-emerald-600 rounded-lg flex items-center justify-center">
                      <UserPlus size={18} />
                    </div>
                    إضافة حساب جديد
                  </h3>
                  <form 
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const username = (form.elements.namedItem('username') as HTMLInputElement).value;
                      const password = (form.elements.namedItem('password') as HTMLInputElement).value;
                      const role = (form.elements.namedItem('role') as HTMLSelectElement).value;
                      const phone = (form.elements.namedItem('phone') as HTMLInputElement).value;
                      const email = (form.elements.namedItem('email') as HTMLInputElement).value;
                      
                      try {
                        if (isSuperAdmin && !selectedCompanyId) {
                          toast.error('يرجى اختيار شركة أولاً');
                          return;
                        }
                        try {
                          if (isSuperAdmin && !selectedCompanyId) {
                            toast.error('يرجى اختيار شركة أولاً');
                            return;
                          }
                          
                          const { data: { session } } = await supabase.auth.getSession();
                          const token = session?.access_token;

                          const response = await fetch('/api/create-user', {
                            method: 'POST',
                            headers: { 
                              'Content-Type': 'application/json',
                              'Authorization': `Bearer ${token}`
                            },
                            body: JSON.stringify({
                              email: email || usernameToEmail(username),
                              password,
                              full_name: username,
                              role,
                              company_id: isSuperAdmin ? (form.elements.namedItem('company_id') as HTMLSelectElement).value : user?.company_id,
                              phone: phone || ''
                            })
                          });

                          if (!response.ok) {
                            const errData = await response.json();
                            throw new Error(errData.error || 'فشل إنشاء المستخدم');
                          }

                          toast.success('تمت إضافة المستخدم بنجاح.');
                          form.reset();
                        } catch (err: any) {
                          toast.error('حدث خطأ: ' + err.message);
                        }
                      } catch (err: any) {
                        toast.error('حدث خطأ: ' + err.message);
                      }
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {isSuperAdmin && (
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">الشركة</label>
                        <select name="company_id" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm appearance-none" required>
                          <option value="">اختر الشركة...</option>
                          {companies.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">الاسم الكامل</label>
                      <input name="username" placeholder="مثال: محمد علي" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">كلمة المرور</label>
                      <input name="password" type="password" placeholder="••••••••" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">رقم الهاتف (اختياري)</label>
                      <input name="phone" placeholder="99xxxxxx" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">البريد الإلكتروني (اختياري)</label>
                      <input name="email" type="email" placeholder="user@example.com" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm" />
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">الصلاحية</label>
                      <div className="relative">
                        <select name="role" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm appearance-none" required>
                          <option value="employee">موظف (إضافة وعرض العقارات)</option>
                          <option value="admin">مدير نظام (إدارة العقارات والموظفين للشركة)</option>
                        </select>
                        <ChevronDown size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1 px-1">
                        * المدير يمكنه حذف وتعديل العقارات وإدارة حسابات الموظفين التابعين لشركته.
                      </p>
                    </div>
                    <button type="submit" className="md:col-span-2 ios-button-primary py-3 mt-2">إضافة المستخدم</button>
                  </form>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="font-bold text-stone-900">قائمة المستخدمين ({employees.length})</h3>
                    <button
                      onClick={() => {
                        setUserActionConfirm({ isOpen: true, user_id: null, action: 'bulk-delete' });
                      }}
                      className="text-xs text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-bold"
                    >
                      حذف الكل
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {employees.map(emp => (
                      <div key={emp.id} className="ios-glass p-4 rounded-2xl border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm group hover:shadow-md transition-all">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors shrink-0">
                            <UserIcon size={20} />
                          </div>
                          
                          {editingUser?.id === emp.id ? (
                            <div className="flex flex-col gap-3 flex-1 bg-white/30 p-3 rounded-xl border border-white/40">
                              <div className="space-y-2">
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-stone-400 px-1">الاسم</label>
                                  <input 
                                    type="text"
                                    value={editUserName}
                                    onChange={(e) => setEditUserName(e.target.value)}
                                    className="w-full p-2 text-sm border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white/80 shadow-sm"
                                    placeholder="الاسم الكامل"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-stone-400 px-1">رقم الهاتف</label>
                                  <input 
                                    type="text"
                                    value={editUserPhone}
                                    onChange={(e) => setEditUserPhone(e.target.value)}
                                    className="w-full p-2 text-sm border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white/80 shadow-sm"
                                    placeholder="رقم الهاتف"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-stone-400 px-1">البريد الإلكتروني</label>
                                  <input 
                                    type="email"
                                    value={editUserEmail}
                                    onChange={(e) => setEditUserEmail(e.target.value)}
                                    className="w-full p-2 text-sm border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white/80 shadow-sm"
                                    placeholder="البريد الإلكتروني"
                                  />
                                </div>
                                <div className="flex flex-col gap-1">
                                  <label className="text-[10px] font-bold text-stone-400 px-1">كلمة المرور الجديدة (اختياري)</label>
                                  <input 
                                    type="password"
                                    value={editUserPassword}
                                    onChange={(e) => setEditUserPassword(e.target.value)}
                                    className="w-full p-2 text-sm border border-stone-200 rounded-lg outline-none focus:ring-2 focus:ring-emerald-500 bg-white/80 shadow-sm"
                                    placeholder="اتركها فارغة إذا لم ترد تغييرها"
                                  />
                                </div>
                              </div>
                              <div className="flex gap-2 pt-1">
                                <button 
                                  onClick={async () => {
                                    if (!editUserName.trim()) return;
                                    try {
                                      // Update Firestore data
                                      const { error } = await supabase
                                        .from('user_profiles')
                                        .update({ 
                                          display_name: editUserName.trim(),
                                          phone: editUserPhone.trim(),
                                          email: editUserEmail.trim()
                                        })
                                        .eq('id', emp.id);
                                      if (error) throw error;

                                      // Update Password if provided
                                      if (editUserPassword.trim()) {
                                        if (editUserPassword.trim().length < 6) {
                                          toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                                          return;
                                        }
                                        const { data: { session } } = await supabase.auth.getSession();
                                        const token = session?.access_token;
                                        const response = await fetch('/api/update-user-password', {
                                          method: 'POST',
                                          headers: { 
                                            'Content-Type': 'application/json',
                                            'Authorization': `Bearer ${token}`
                                          },
                                          body: JSON.stringify({
                                            target_id: emp.id,
                                            newPassword: editUserPassword.trim()
                                          })
                                        });
                                        if (!response.ok) {
                                          const msg = await response.text();
                                          throw new Error(msg || 'فشل تحديث كلمة المرور');
                                        }
                                      }

                                      setEditingUser(null);
                                      setEditUserPassword('');
                                      toast.success('تم التحديث بنجاح');
                                    } catch (err: any) {
                                      toast.error('خطأ: ' + err.message);
                                    }
                                  }}
                                  className="flex-1 py-2 bg-emerald-600 text-white text-xs rounded-lg font-bold shadow-sm hover:bg-emerald-700 transition-colors"
                                >
                                  حفظ التغييرات
                                </button>
                                <button 
                                  onClick={() => setEditingUser(null)}
                                  className="px-4 py-2 bg-stone-100 text-stone-600 text-xs rounded-lg font-bold hover:bg-stone-200 transition-colors"
                                >
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm font-bold text-stone-800 truncate">{emp.display_name}</h3>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                  emp.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                                  emp.role === 'employee' ? 'bg-blue-100 text-blue-600' :
                                  'bg-amber-100 text-amber-600'
                                }`}>
                                  {emp.role === 'admin' ? 'مدير' : emp.role === 'employee' ? 'موظف' : 'معلق'}
                                </span>
                                {isSuperAdmin && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-stone-100 text-stone-600">
                                    {companies.find(c => c.id === emp.company_id)?.name || 'بدون شركة'}
                                  </span>
                                )}
                              </div>
                              <p className={`text-stone-500 truncate mt-0.5 ${emp.email?.endsWith('@simsaraqari.com') ? 'text-[7px] leading-tight tracking-tighter' : 'text-[11px]'}`}>
                                {emp.phone || 'بدون هاتف'} • {emp.email} • {formatRelativeDate(emp.created_at)}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 justify-end shrink-0">
                          {emp.role === 'pending' && (
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => setUserActionConfirm({ isOpen: true, user_id: emp.id, action: 'approve', extraData: { display_name: emp.display_name } })}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                              >
                                موافقة
                              </button>
                              <button 
                                onClick={() => setUserActionConfirm({ isOpen: true, user_id: emp.id, action: 'reject', extraData: { display_name: emp.display_name } })}
                                className="px-3 py-1.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100 transition-all"
                              >
                                رفض
                              </button>
                            </div>
                          )}
                          
                          {emp.role !== 'pending' && emp.id !== user.id && (
                            <div className="relative">
                              <select
                                value={emp.role}
                                onChange={(e) => setUserActionConfirm({ isOpen: true, user_id: emp.id, action: 'change-role', extraData: { newRole: e.target.value, display_name: emp.display_name } })}
                                className="text-[10px] p-1.5 pr-6 rounded-lg border border-stone-200 bg-stone-50/50 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none font-bold text-stone-600"
                              >
                                <option value="employee">موظف (إضافة وعرض العقارات)</option>
                                <option value="admin">مدير نظام (إدارة العقارات والموظفين للشركة)</option>
                              </select>
                              <ChevronDown size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                            </div>
                          )}
                        </div>
                      
                      {emp.id !== user.id && (
                        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-stone-100">
                          <button 
                            onClick={() => {
                              setEditingUser(emp);
                              setEditUserName(emp.display_name);
                              setEditUserPhone(emp.phone || '');
                              setEditUserEmail(emp.email || '');
                              setEditUserPassword('');
                            }}
                            className="flex items-center gap-1 px-3 py-1.5 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all text-xs font-bold"
                          >
                            <Edit size={14} />
                            تعديل
                          </button>
                          <button 
                            onClick={() => setUserActionConfirm({ isOpen: true, user_id: emp.id, action: 'delete', extraData: { display_name: emp.display_name } })}
                            className="flex items-center gap-1 px-3 py-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-xs font-bold"
                          >
                            <Trash2 size={14} />
                            حذف
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  </div>
                </div>
                </div>
            </motion.div>
          )}

          {view === 'details' && selectedProperty && (
            <div className="px-4 py-8">
              <ErrorBoundary>
                <PropertyDetails 
                  property={selectedProperty}
                  user={user}
                  onBack={() => {
                    setView('list');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  isAdmin={isAdmin}
                  isFavorite={favorites.includes(selectedProperty?.id)}
                  onFavorite={() => toggleFavorite(selectedProperty?.id)}
                  onEdit={() => {
                    setSelectedProperty(selectedProperty);
                    setView('edit');
                  }}
                  onDelete={() => setDeleteConfirm({ isOpen: true, property_id: selectedProperty?.id })}
                  onRestore={() => restoreProperty(selectedProperty?.id)}
                  onPermanentDelete={() => permanentDeleteProperty(selectedProperty?.id)}
                  onDeleteComment={(commentId: string) => setCommentDeleteConfirm({ isOpen: true, commentId, property_id: selectedProperty?.id })}
                  onUserClick={(user_id: string) => {
                    setSelectedMarketerId(user_id);
                    setPrevView(view as any);
                    setView('user-listings');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  onFilter={(key: string, value: string) => {
                    setFilters(prev => ({ ...prev, [key]: value }));
                    setSearchQuery('');
                    setView('list');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
              </ErrorBoundary>
            </div>
          )}
        </AnimatePresence>

        <ConfirmModal 
          isOpen={deleteConfirm.isOpen}
          title="تأكيد الحذف"
          message="هل أنت متأكد من رغبتك في حذف هذا العقار نهائياً؟ لا يمكن التراجع عن هذا الإجراء."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm({ isOpen: false, property_id: null })}
          confirmText="تأكيد الحذف"
          confirmColor="bg-red-600 hover:bg-red-700"
        />

        <ConfirmModal 
          isOpen={userActionConfirm.isOpen}
          title={
            userActionConfirm.action === 'approve' ? "تأكيد الموافقة" :
            userActionConfirm.action === 'reject' ? "تأكيد الرفض" :
            userActionConfirm.action === 'change-role' ? "تغيير الصلاحية" :
            "تأكيد الحذف"
          }
          message={
            userActionConfirm.action === 'bulk-delete' ? "⚠️ تحذير: هل أنت متأكد من حذف جميع الحسابات المسجلة؟ سيتم مسح صلاحياتهم وبياناتهم من قاعدة البيانات." :
            userActionConfirm.action === 'approve' ? `هل أنت متأكد من الموافقة على المستخدم ${userActionConfirm.extraData?.display_name || ''}؟` :
            userActionConfirm.action === 'reject' ? `هل أنت متأكد من رفض المستخدم ${userActionConfirm.extraData?.display_name || ''}؟` :
            userActionConfirm.action === 'change-role' ? `هل أنت متأكد من تغيير صلاحية ${userActionConfirm.extraData?.display_name} إلى ${userActionConfirm.extraData?.newRole === 'admin' ? 'مدير نظام' : 'مستخدم'}؟` :
            `هل أنت متأكد من رغبتك في حذف ${userActionConfirm.extraData?.display_name || 'هذا المستخدم'} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`
          }
          onConfirm={confirmUserAction}
          onCancel={() => setUserActionConfirm({ isOpen: false, user_id: null, action: null })}
          confirmText={
            userActionConfirm.action === 'approve' ? "تأكيد الموافقة" :
            userActionConfirm.action === 'reject' ? "تأكيد الرفض" :
            userActionConfirm.action === 'change-role' ? "تغيير الصلاحية" :
            "تأكيد الحذف"
          }
          confirmColor={
            userActionConfirm.action === 'approve' ? "bg-emerald-600 hover:bg-emerald-700" :
            userActionConfirm.action === 'reject' ? "bg-red-600 hover:bg-red-700" :
            userActionConfirm.action === 'change-role' ? "bg-blue-600 hover:bg-blue-700" :
            "bg-red-600 hover:bg-red-700"
          }
        />

        <ConfirmModal 
          isOpen={accountDeleteConfirm}
          title="تأكيد حذف الحساب"
          message="هل أنت متأكد من رغبتك في حذف حسابك نهائياً؟ سيتم حذف جميع بياناتك الشخصية ولا يمكن التراجع عن هذه الخطوة."
          onConfirm={confirmAccountDelete}
          onCancel={() => setAccountDeleteConfirm(false)}
          confirmText="حذف الحساب"
          confirmColor="bg-red-600 hover:bg-red-700"
        />

        <ConfirmModal 
          isOpen={commentDeleteConfirm.isOpen}
          title="تأكيد حذف التعليق"
          message="هل أنت متأكد من حذف هذا التعليق؟"
          onConfirm={confirmCommentDelete}
          onCancel={() => setCommentDeleteConfirm({ isOpen: false, commentId: null, property_id: null })}
          confirmText="تأكيد الحذف"
          confirmColor="bg-red-600 hover:bg-red-700"
        />
      </main>
    </div>
  );

  // --- Actions ---

  async function toggleFavorite(property_id: string) {
    if (!user?.id) return;
    const isFav = favorites.includes(property_id);
    if (isFav) {
      try {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('property_id', property_id);
        if (error) throw error;
      } catch (error) {
        console.error("Error removing favorite:", error);
      }
    } else {
      try {
        const { error } = await supabase.from('favorites').insert({
          user_id: user.id,
          property_id,
          created_at: new Date().toISOString()
        });
        if (error) throw error;
      } catch (error) {
        console.error("Error adding favorite:", error);
      }
    }
  }

  async function handleBackup() {
    if (!isAdmin) {
      toast.error("ليس لديك صلاحية لعمل نسخة احتياطية");
      return;
    }
    
    toast.loading("جاري تجهيز النسخة الاحتياطية...", { id: 'backup' });
    try {
      const backupData: any = {};
      
      const tablesToBackup = ['properties', 'users', 'comments', 'companies', 'notifications'];
      
      for (const tableName of tablesToBackup) {
        const { data, error } = await supabase.from(tableName).select('*');
        if (error) throw error;
        backupData[tableName] = data;
      }
      
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href",     dataStr);
      downloadAnchorNode.setAttribute("download", `backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      toast.success("تم تحميل النسخة الاحتياطية بنجاح", { id: 'backup' });
    } catch (error) {
      console.error("Backup error:", error);
      toast.error("حدث خطأ أثناء عمل النسخة الاحتياطية", { id: 'backup' });
    }
  }

  async function restoreProperty(id: string) {
    if (!isAdmin) {
      toast.error("ليس لديك صلاحية لاستعادة العقارات");
      return;
    }
    try {
      const { error } = await supabase.from('properties').update({
        status: 'approved',
        deleted_at: null
      }).eq('id', id);
      if (error) throw error;
      toast.success('تم استعادة العقار بنجاح');
    } catch (error) {
      console.error("Error restoring property:", error);
      toast.error("حدث خطأ أثناء محاولة استعادة العقار");
    }
  }

  async function permanentDeleteProperty(id: string) {
    if (!isAdmin) {
      toast.error("ليس لديك صلاحية لحذف العقارات نهائياً");
      return;
    }
    if (window.confirm('هل أنت متأكد من حذف هذا العقار نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) {
      try {
        const { data: propertyData, error: fetchError } = await supabase.from('properties').select('images').eq('id', id).single();
        if (fetchError) throw fetchError;
        
        if (propertyData?.images && Array.isArray(propertyData.images)) {
          for (const img of propertyData.images) {
            try {
              const url = typeof img === 'string' ? img : img.url;
              // Extract path from Supabase URL if needed, but here we assume the helper might be needed.
              // For now, focusing on removing the record.
              if (url.includes('storage/v1/object/public/')) {
                const path = url.split('storage/v1/object/public/properties_media/')[1];
                if (path) await supabase.storage.from('properties_media').remove([path]);
              }
            } catch (e) {
              console.error("Error deleting file:", e);
            }
          }
        }
        
        const { error: deleteError } = await supabase.from('properties').delete().eq('id', id);
        if (deleteError) throw deleteError;
        
        toast.success('تم حذف العقار نهائياً');
        if (view === 'details') setView('list');
      } catch (error) {
        console.error("Error permanently deleting property:", error);
        toast.error("حدث خطأ أثناء محاولة حذف العقار نهائياً");
      }
    }
  }

  async function deleteProperty(id: string) {
    setDeleteConfirm({ isOpen: true, property_id: id });
  }

  async function confirmDelete() {
    if (!isAdmin) {
      toast.error("ليس لديك صلاحية لحذف العقارات");
      setDeleteConfirm({ isOpen: false, property_id: null });
      return;
    }
    if (deleteConfirm.property_id) {
      try {
        const { error } = await supabase.from('properties').update({
          status: 'deleted',
          deleted_at: new Date().toISOString()
        }).eq('id', deleteConfirm.property_id);
        
        if (error) throw error;
        setDeleteConfirm({ isOpen: false, property_id: null });
        if (view === 'details') setView('list');
        toast.success('تم نقل العقار إلى سلة المحذوفات');
      } catch (error) {
        console.error("Error deleting property:", error);
        toast.error("حدث خطأ أثناء محاولة حذف العقار");
      }
    }
  }

  async function confirmCommentDelete() {
    if (!isAdmin) {
      toast.error("ليس لديك صلاحية لحذف التعليقات");
      setCommentDeleteConfirm({ isOpen: false, commentId: null, property_id: null });
      return;
    }
    if (commentDeleteConfirm.commentId && commentDeleteConfirm.property_id) {
      try {
        if (commentDeleteConfirm.commentId) {
          const { data: commentData } = await supabase.from('comments').select('*').eq('id', commentDeleteConfirm.commentId).single();
          if (commentData?.images && Array.isArray(commentData.images)) {
            await Promise.all((commentData.images || []).map(async (img: any) => {
              try {
                const url = typeof img === 'string' ? img : img.url;
                if (url.includes('storage/v1/object/public/properties_media/')) {
                  const path = url.split('storage/v1/object/public/properties_media/')[1];
                  if (path) await supabase.storage.from('properties_media').remove([path]);
                }
              } catch (e) {
                console.error("Error deleting file:", e);
              }
            }));
          }
          await supabase.from('comments').delete().eq('id', commentDeleteConfirm.commentId);
          
          // Update last comment on property card
          const { data: latestComments } = await supabase
            .from('comments')
            .select('text')
            .eq('property_id', commentDeleteConfirm.property_id)
            .order('created_at', { ascending: false })
            .limit(1);
          
          const newLastComment = latestComments && latestComments.length > 0 ? latestComments[0].text : '';
          
          await supabase.from('properties').update({
            last_comment: newLastComment
          }).eq('id', commentDeleteConfirm.property_id);
        }

        setCommentDeleteConfirm({ isOpen: false, commentId: null, property_id: null });
        toast.success("تم حذف التعليق بنجاح");
      } catch (error) {
        console.error("Error deleting comment:", error);
        toast.error("حدث خطأ أثناء حذف التعليق");
      }
    }
  }

  async function confirmUserAction() {
    if (!isAdmin) {
      toast.error("ليس لديك صلاحية لإدارة المستخدمين");
      setUserActionConfirm({ isOpen: false, user_id: null, action: null, extraData: null });
      return;
    }
    try {
      if (userActionConfirm.action === 'bulk-delete') {
        const { error } = await supabase.from('user_profiles').delete().neq('role', 'superadmin');
        if (error) throw error;
      } else if (userActionConfirm.user_id) {
        if (userActionConfirm.action === 'delete') {
          const { error } = await supabase.from('user_profiles').delete().eq('id', userActionConfirm.user_id);
          if (error) throw error;
        } else if (userActionConfirm.action === 'approve') {
          const { error } = await supabase.from('user_profiles').update({ role: 'employee' }).eq('id', userActionConfirm.user_id);
          if (error) throw error;
        } else if (userActionConfirm.action === 'reject') {
          const { error } = await supabase.from('user_profiles').update({ role: 'rejected' }).eq('id', userActionConfirm.user_id);
          if (error) throw error;
        } else if (userActionConfirm.action === 'change-role') {
          const { error } = await supabase.from('user_profiles').update({ role: userActionConfirm.extraData.newRole }).eq('id', userActionConfirm.user_id);
          if (error) throw error;
        }
      }
      setUserActionConfirm({ isOpen: false, user_id: null, action: null });
    } catch (err: any) {
      console.error("Error performing user action:", err);
      toast.error("حدث خطأ أثناء تنفيذ الإجراء");
    }
  }
}

// --- Sub-Components ---

const PropertyCard = memo(function PropertyCard({ property, isFavorite, onFavorite, onClick, onImageClick, isAdmin, onFilter, onUserClick, onApprove, onReject, onEdit, onDelete, onRestore, onPermanentDelete, view }: any) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`ios-card overflow-hidden hover:shadow-lg transition-all group relative flex flex-col p-4 pb-3 min-h-[140px] cursor-pointer ${view === 'pending-properties' ? 'border-amber-300' : ''}`}
      onClick={onClick}
    >
      {/* Title - Full Width */}
      <h3 className="text-sm font-bold text-stone-900 mb-2 line-clamp-2 leading-tight w-full text-right">
        {generatePropertyTitle(property)}
      </h3>

      <div className="flex gap-3 flex-1 items-end mb-3">
        {/* Image on the right (first child in RTL) - Smaller and at bottom */}
        <div 
          className="w-16 h-16 bg-stone-100 relative shrink-0 rounded-lg overflow-hidden shadow-inner group/img" 
          onClick={(e) => {
            e.stopPropagation();
            if (property.images?.length > 0) onImageClick(property.images, 0);
          }}
        >
          {property.images?.[0] ? (
            <>
              {(property.images || [])[0].startsWith('data:video/') ? (
                <video 
                  src={(property.images || [])[0]} 
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110 ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                />
              ) : (
                <img 
                  src={(property.images || [])[0]} 
                  alt={generatePropertyTitle(property)} 
                  className={`w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110 ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                <ImageIcon className="text-white" size={14} />
              </div>
              {property.is_sold && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-700/80 backdrop-blur-sm z-20">
                  <span className="text-white font-black text-[10px] tracking-wider transform -rotate-12 border-2 border-white px-1 py-0.5 rounded shadow-lg">مباع</span>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-stone-50 relative overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center opacity-50">
                <svg viewBox="0 0 100 100" className="w-16 h-16">
                  <path d="M10,65 L30,45 L50,65 L50,85 L10,85 Z" fill="#e0e7ff" />
                  <path d="M30,65 L50,35 L70,65 L70,85 L30,85 Z" fill="#c7d2fe" />
                  <path d="M50,65 L70,45 L90,65 L90,85 L50,85 Z" fill="#e0e7ff" />
                  <path d="M25,40 C15,25 35,20 45,35 C35,45 25,45 25,40 Z" fill="#bbf7d0" />
                  <path d="M45,35 C55,20 75,25 65,45 C55,45 45,45 45,35 Z" fill="#86efac" />
                  <rect x="25" y="70" width="10" height="10" fill="#ffffff" rx="2" />
                  <rect x="45" y="70" width="10" height="10" fill="#ffffff" rx="2" />
                  <rect x="65" y="70" width="10" height="10" fill="#ffffff" rx="2" />
                </svg>
              </div>
              <span className="text-[9px] font-bold text-emerald-800 text-center z-10 leading-tight drop-shadow-sm px-1 bg-white/70 rounded py-0.5 max-w-[90%] truncate">
                {cleanAreaName(property.area)}
              </span>
              {property.is_sold && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-700/80 backdrop-blur-sm z-20">
                  <span className="text-white font-black text-[10px] tracking-wider transform -rotate-12 border-2 border-white px-1 py-0.5 rounded shadow-lg">مباع</span>
                </div>
              )}
            </div>
          )}
          
          {/* Badge on Image */}
          {property.status_label && (
            <div className="absolute top-0 right-0 left-0 z-10">
              <span className="bg-amber-500/90 text-white px-1 py-0.5 text-[8px] font-black uppercase block text-center tracking-widest shadow-sm">
                {property.status_label}
              </span>
            </div>
          )}

          {property.images && property.images.length > 1 && (
            <div className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[7px] px-1 rounded font-bold">
              +{property.images.length - 1}
            </div>
          )}
        </div>

        {/* Text/Content on the left */}
        <div className="flex-1 flex flex-col justify-between h-full min-w-0">
          <div className="space-y-1">
            {property.details && (
              <p className="text-xs text-stone-600 leading-relaxed font-medium line-clamp-2 text-right">
                {property.details}
              </p>
            )}
            {property.last_comment && (
              <div className="mt-2 p-2 rounded-lg border-r-2 border-emerald-500">
                <p className="text-xs text-stone-700 line-clamp-1">
                  {property.last_comment}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer: Marketer Name + Purpose + Area + Phone + WhatsApp */}
      <div className="flex items-center gap-1.5 mt-auto pt-3 border-t border-stone-100 text-[9px] font-bold text-stone-700">
        {/* Area */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onFilter && property.area) onFilter('area', property.area);
          }}
          className="text-stone-500 hover:underline truncate max-w-[35%]"
        >
          {cleanAreaName(property.area) || '-'}
        </button>
        <span>|</span>
        {/* Purpose */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onFilter && property.purpose) onFilter('purpose', property.purpose);
          }}
          className="text-emerald-600 hover:underline truncate max-w-[15%]"
        >
          {property.purpose || '-'}
        </button>
        <span>|</span>
        {/* Property Type (Instead of Marketer Name) */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (onFilter && property.type) {
              onFilter('type', property.type);
            }
          }}
          className="hover:text-emerald-600 hover:underline truncate max-w-[25%]"
        >
          {property.type || 'غير محدد'}
        </button>
        {property.created_at && (
          <span className="text-[9px] text-stone-400 font-normal">
            {formatRelativeDate(property.created_at)}
          </span>
        )}
        <span className="flex-1"></span>
        {view === 'pending-properties' && isAdmin ? (
          <div className="flex gap-2">
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onApprove(property.id);
              }}
              className="bg-emerald-600 text-white px-2 py-1 rounded text-[10px]"
            >
              قبول
            </button>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onReject(property.id);
              }}
              className="bg-red-600 text-white px-2 py-1 rounded text-[10px]"
            >
              رفض
            </button>
          </div>
        ) : view === 'trash' && isAdmin ? (
          <div className="flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onRestore) onRestore(property.id);
              }}
              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
              title="استعادة"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onPermanentDelete) onPermanentDelete(property.id);
              }}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
              title="حذف نهائي"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {isAdmin && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onEdit) onEdit(property);
                  }}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                  title="تعديل"
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDelete) onDelete(property.id);
                  }}
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="حذف"
                >
                  <Trash2 size={16} />
                </button>
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                const shareUrl = `${window.location.origin}?property_id=${property.id}`;
                if (navigator.share) {
                  navigator.share({
                    text: property.details,
                    url: shareUrl,
                  }).catch(console.error);
                } else {
                  navigator.clipboard.writeText(shareUrl);
                  toast.success('تم نسخ رابط العقار');
                }
              }}
              className="p-1.5 text-stone-500 hover:bg-stone-100 rounded-lg transition-all"
              title="مشاركة"
            >
              <Share2 size={16} />
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
});


const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200;
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          resolve(blob as Blob);
        }, 'image/jpeg', 0.6);
      };
    };
  });
};

const PropertyForm = memo(function PropertyForm({ property, isAdmin, user, selectedCompanyId, companies, onCancel, onSave }: any) {
  const isSuperAdmin = user?.role === 'super_admin' || (user?.email && SUPER_ADMIN_EMAILS.includes(user.email));
  const [formData, setFormData] = useState({
    name: property?.name || '',
    governorate: property?.governorate || '',
    area: property?.area || '',
    type: property?.type || '',
    purpose: property?.purpose || '',
    assigned_employee_id: property?.assigned_employee_id || '',
    assigned_employee_name: property?.assigned_employee_name || '',
    assigned_employee_phone: property?.assigned_employee_phone || '',
    images: (property?.images || []).map((img: any) => typeof img === 'string' ? { url: img, type: img.startsWith('data:video/') ? 'video' : 'image' } : img),
    location_link: property?.location_link || '',
    is_sold: property?.is_sold || false,
    sector: property?.sector || '',
    block: property?.block || '',
    street: property?.street || '',
    avenue: property?.avenue || '',
    plot_number: property?.plot_number || '',
    house_number: property?.house_number || '',
    location: property?.location || '',
    price: property?.price || '',
    details: property?.details || '',
    status_label: property?.status_label || '',
    company_id: property?.company_id || ''
  });

  const [employees, setEmployees] = useState<UserProfile[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const fetchEmployees = async () => {
      const targetCompanyId = property?.company_id || selectedCompanyId || user?.company_id;
      if (!targetCompanyId) return;

      let query = supabase
        .from('user_profiles')
        .select('*')
        .eq('role', 'employee')
        .eq('company_id', targetCompanyId);

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching employees:", error);
      } else {
        setEmployees(data as UserProfile[]);
      }
    };

    fetchEmployees();
    
    const channel = supabase
      .channel('employees-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_profiles' }, () => {
        fetchEmployees();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [property?.company_id, selectedCompanyId, user?.company_id]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if ((formData.images?.length || 0) + files.length > 20) {
      toast.error('لا يمكن رفع أكثر من 20 ملفاً');
      return;
    }

    setIsUploading(true);
    try {
      const newImages = [...formData.images];
      for (const file of files) {
        let fileToUpload: Blob;
        let fileType = file.type;
        if (file.type.startsWith('image/')) {
          fileToUpload = await compressImage(file);
          fileType = 'image/jpeg';
        } else {
          fileToUpload = file;
        }
        
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') || 'file';
        const fileName = `properties/${Date.now()}_${safeName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('properties_media')
          .upload(fileName, fileToUpload, { contentType: fileType });
        
        if (uploadError) {
          console.error("Supabase Storage Error:", uploadError);
          throw new Error(uploadError.message || "فشل الرفع للخادم");
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('properties_media')
          .getPublicUrl(fileName);
          
        newImages.push({ url: publicUrl, type: file.type.startsWith('video/') ? 'video' : 'image' });
      }
      setFormData({ ...formData, images: newImages });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("خطأ الرفع: " + (error.message || "حدث خطأ أثناء رفع الملفات"));
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const newImages = formData.images.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, images: newImages });
  };

  const [isSaving, setIsSaving] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [missingFieldsList, setMissingFieldsList] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent, force: boolean = false) => {
    if (e) e.preventDefault();
    
    if (!force) {
      const missing: string[] = [];
      if (!formData.name) missing.push('اسم العميل');
      if (!formData.governorate) missing.push('المحافظة');
      if (!formData.area) missing.push('المنطقة');
      if (!formData.type) missing.push('نوع العقار');
      if (!formData.purpose) missing.push('الغرض');
      if (!formData.location) missing.push('الموقع');
      
      if (missing.length > 0) {
        setMissingFieldsList(missing);
        setShowConfirm(true);
        return;
      }
    }

    setIsSaving(true);
    setShowConfirm(false);
    
    try {
      let empId = formData.assigned_employee_id;
      let empName = formData.assigned_employee_name;

      // If we have a name but no ID, it means it's a new marketer
      if (empName && !empId) {
        try {
          const { data: newEmp, error: empError } = await supabase.from('user_profiles').insert({
            full_name: empName,
            role: 'employee',
            company_id: isSuperAdmin ? selectedCompanyId : user?.company_id,
            created_at: new Date().toISOString()
          }).select().single();

          if (empError) throw empError;
          if (newEmp) {
            empId = newEmp.id;
          }
        } catch (error) {
          handleError(error, OperationType.CREATE, 'users');
        }
      }

      const data = {
        ...formData,
        company_id: isSuperAdmin ? selectedCompanyId : user?.company_id,
        assigned_employee_id: empId,
        assigned_employee_name: empName,
        images: formData.images,
        location_link: formData.location_link.trim(),
        is_sold: formData.is_sold,
        updated_at: new Date().toISOString(),
        created_at: property ? property.created_at : new Date().toISOString(),
        created_by: property ? property.created_by : (user?.id),
        status: isAdmin ? (property?.status || 'approved') : 'pending'
      };

      try {
        if (property) {
          const { error: updateError } = await supabase.from('properties').update(data).eq('id', property.id);
          if (updateError) throw updateError;
          
          const priceChanged = property.price !== data.price;
          const statusChanged = property.is_sold !== data.is_sold || property.status_label !== data.status_label;
          
          if (priceChanged || statusChanged) {
            const { data: favoritesData, error: favError } = await supabase
              .from('favorites')
              .select('user_id')
              .eq('property_id', property.id);

            if (favError) throw favError;
            
            const interestedUserIds = favoritesData.map(d => d.user_id);
            
            for (const recipient_id of interestedUserIds) {
              if (recipient_id === user?.id) continue;
              
              let title = 'تحديث في عقار يهمك';
              let message = `تم تحديث بيانات العقار: ${generatePropertyTitle(property)}`;
              let type: 'price-change' | 'status-change' = 'status-change';
              
              if (priceChanged && statusChanged) {
                message = `تم تغيير السعر والحالة للعقار: ${generatePropertyTitle(property)}`;
              } else if (priceChanged) {
                type = 'price-change';
                message = `تغير السعر إلى ${data.price} للعقار: ${generatePropertyTitle(property)}`;
              } else if (statusChanged) {
                type = 'status-change';
                message = `تغيرت حالة العقار: ${generatePropertyTitle(property)}`;
              }

              await supabase.from('notifications').insert({
                type,
                title,
                message,
                recipient_id,
                user_id: user?.id,
                property_id: property.id,
                read: false,
                created_at: new Date().toISOString()
              });
            }
          }
        } else {
          const { error: insertError } = await supabase.from('properties').insert(data);
          if (insertError) throw insertError;
        }
      } catch (error) {
        handleError(error, property ? OperationType.UPDATE : OperationType.CREATE, 'properties');
      }
      toast.success(property ? 'تم تحديث العقار بنجاح' : 'تمت إضافة العقار بنجاح');
      onSave();
    } catch (error: any) {
      console.error("Error saving property:", error);
      let message = error.message;
      try {
        const parsed = JSON.parse(error.message);
        message = parsed.error;
      } catch (e) {}
      toast.error(`حدث خطأ أثناء حفظ البيانات: ${message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full ios-card overflow-hidden"
    >
      <div className="bg-emerald-500 p-8 text-white">
        <h2 className="text-2xl font-bold flex items-center gap-3 justify-center">
          {property ? <Edit size={24} /> : <Plus size={24} />}
          {property ? 'تعديل بيانات العقار' : 'إضافة عقار جديد للنظام'}
        </h2>
        <p className="text-emerald-50 mt-2 opacity-80 text-center text-sm">يرجى ملء البيانات بدقة لضمان أفضل تجربة للمستخدمين</p>
      </div>

      <form onSubmit={handleSubmit} className="p-8 space-y-10">
        {isSuperAdmin && companies && companies.length > 0 && (
          <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 mb-6">
            <p className="text-sm text-emerald-800 font-medium flex items-center gap-2">
              <Building2 size={16} />
              الشركة: {(companies || []).find(c => c.id === (property?.company_id || selectedCompanyId))?.name || 'غير محدد'}
            </p>
          </div>
        )}
        {/* Section 1: Client Info */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-emerald-600 border-b border-emerald-100 pb-2">
            <UserIcon size={20} />
            <h3 className="font-bold text-lg text-center">بيانات العميل</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                placeholder="اسم العميل (الاسم الثلاثي)"
                className="w-full pr-10 pl-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-sm"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
              />
            </div>
            <SearchableFilter 
              label="نوع العقار"
              placeholder="ابحث عن نوع العقار..."
              options={PROPERTY_TYPES}
              value={formData.type}
              onChange={(val) => setFormData({...formData, type: val})}
            />
            <SearchableFilter 
              label="الغرض من العملية"
              placeholder="ابحث عن الغرض..."
              options={PURPOSES}
              value={formData.purpose}
              onChange={(val) => setFormData({...formData, purpose: val})}
            />
          </div>
        </div>

        {/* Section 2: Location Info */}
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SearchableFilter 
              label="المحافظة"
              placeholder="ابحث عن محافظة..."
              options={GOVERNORATES}
              value={formData.governorate}
              onChange={(val) => setFormData({...formData, governorate: val, area: ''})}
            />
            <SearchableFilter 
              label="المنطقة"
              placeholder="ابحث عن منطقة..."
              options={formData.governorate ? AREAS[formData.governorate] : Array.from(new Set(Object.values(AREAS).flat())).sort()}
              value={formData.area}
              onChange={(val) => setFormData({...formData, area: val})}
            />
            <SearchableFilter 
              label="الموقع"
              placeholder="ابحث عن موقع..."
              options={LOCATIONS}
              value={formData.location}
              onChange={(val) => setFormData({...formData, location: val})}
            />
            <div className="relative">
              <Tag className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                placeholder="السعر (مثال: 250,000 د.ك)"
                className="w-full pr-10 pl-4 py-3 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all outline-none text-sm"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: e.target.value})}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input 
              type="url"
              placeholder="رابط العنوان (مثال: رابط خرائط جوجل)"
              className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
              value={formData.location_link}
              onChange={(e) => setFormData({...formData, location_link: e.target.value})}
              dir="ltr"
            />
            {isAdmin && property && (
              <div className="flex flex-col md:flex-row gap-4 w-full">
                <label className="flex-1 flex items-center gap-3 p-3 bg-stone-50 border border-stone-100 rounded-xl cursor-pointer hover:bg-stone-100 transition-colors">
                  <input 
                    type="checkbox"
                    className="w-5 h-5 text-emerald-600 rounded focus:ring-emerald-500 border-stone-300"
                    checked={formData.is_sold}
                    onChange={(e) => setFormData({...formData, is_sold: e.target.checked})}
                  />
                  <span className="text-sm font-bold text-stone-700">تم بيع العقار (مباع)</span>
                </label>
                <div className="flex-1">
                  <SearchableFilter 
                    label="ملصق الحالة (يظهر على الصورة)"
                    placeholder="اختر ملصقاً..."
                    options={['هام', 'جاد', 'مستعجل']}
                    value={formData.status_label}
                    onChange={(val) => setFormData({...formData, status_label: val})}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {[
              { id: 'sector', label: 'القطاع' },
              { id: 'block', label: 'القطعة' },
              { id: 'street', label: 'الشارع' },
              { id: 'avenue', label: 'الجادة' },
              { id: 'plot_number', label: 'القسيمة' },
              { id: 'house_number', label: 'المنزل' }
            ].map((field) => (
              <input 
                key={field.id}
                placeholder={field.label}
                className="w-full p-3 bg-stone-50 border border-stone-100 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-center"
                value={(formData as any)[field.id]}
                onChange={(e) => setFormData({...formData, [field.id]: e.target.value})}
              />
            ))}
          </div>
        </div>

        {/* Section 3: Property Details */}
        <div className="space-y-6">
          <textarea 
            rows={4}
            placeholder="وصف إضافي وتفاصيل العقار..."
            className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
            value={formData.details}
            onChange={(e) => setFormData({...formData, details: e.target.value})}
          />
        </div>

        {/* Section 4: Company and Marketer */}
        <div className="space-y-6">
          {isSuperAdmin ? (
            <SearchableFilter
              label="الشركة"
              placeholder="اختر الشركة..."
              options={companies.map(c => c.name)}
              value={companies.find(c => c.id === (formData as any).company_id)?.name || ''}
              onChange={(val) => {
                const company = companies.find(c => c.name === val);
                setFormData({
                  ...formData,
                  company_id: company ? company.id : ''
                });
              }}
            />
          ) : (
            <div className="p-4 bg-stone-50 rounded-xl border border-stone-100">
              <label className="text-xs font-bold text-stone-500 mb-1 block">الشركة</label>
              <p className="text-sm font-bold text-stone-900">
                {companies.find(c => c.id === (user?.company_id))?.name || 'غير محدد'}
              </p>
            </div>
          )}

          <SearchableFilter 
            label="المستخدم / الموظف المسؤول"
            placeholder="ابحث عن مستخدم أو اكتب اسماً جديداً..."
            options={employees.map(emp => emp.display_name)}
            value={formData.assigned_employee_name}
            creatable={true}
            onChange={(val) => {
              const emp = employees.find(e => e.display_name === val);
              setFormData({
                ...formData,
                assigned_employee_id: emp ? emp.id : '',
                assigned_employee_name: val
              });
            }}
          />
          
          <button
            type="button"
            onClick={() => {
              setFormData({
                ...formData,
                assigned_employee_id: user?.id || '',
                assigned_employee_name: user?.display_name || ''
              });
            }}
            className="text-xs text-emerald-600 hover:underline mt-1"
          >
            تعيين نفسي كمسؤول عن الإدخال
          </button>

          <input 
            type="tel"
            placeholder="رقم هاتف المسؤول..."
            className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm mt-2"
            value={formData.assigned_employee_phone || ''}
            onChange={(e) => setFormData({...formData, assigned_employee_phone: e.target.value})}
          />
        </div>

        {/* Section 5: Media */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-emerald-600 border-b border-emerald-100 pb-2">
            <ImageIcon size={20} />
            <h3 className="font-bold text-lg text-center">إضافة صور أو فيديو</h3>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
            {(formData.images || []).map((img: { url: string, type: 'image' | 'video' }, index: number) => (
              <motion.div 
                key={index} 
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative aspect-square rounded-2xl overflow-hidden border border-stone-200 group shadow-sm"
              >
                {img.type === 'video' ? (
                  <video src={img.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={img.url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button 
                    type="button"
                    onClick={() => removeImage(index)}
                    className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transform hover:scale-110 transition-all"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))}
            
            {(formData.images?.length || 0) < 20 && (
              <label htmlFor="image-upload" className={`aspect-square rounded-2xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50 transition-all group ${isUploading ? 'opacity-50 cursor-wait' : ''}`}>
                <input 
                  id="image-upload"
                  type="file" 
                  multiple 
                  accept="image/*,video/*" 
                  className="block text-xs truncate w-full" 
                  onChange={handleImageUpload}
                  disabled={isUploading}
                />
                <div className="bg-stone-100 p-3 rounded-full group-hover:bg-emerald-100 transition-colors">
                  <Upload className="text-stone-400 group-hover:text-emerald-600" size={24} />
                </div>
                <span className="text-xs font-bold text-stone-500 mt-2">{isUploading ? 'جاري الرفع...' : 'إضافة صور أو فيديو'}</span>
                <span className="text-[10px] text-stone-400 mt-1">{(formData.images?.length || 0)}/20</span>
              </label>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-4 pt-6 border-t border-stone-100">
          <button 
            type="submit"
            disabled={isSaving || isUploading}
            className={`flex-[2] bg-emerald-600 text-white py-4 rounded-lg font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 shadow-xl shadow-emerald-100 transform active:scale-95 ${(isSaving || isUploading) ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جاري الحفظ...
              </>
            ) : isUploading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                جاري رفع الملفات...
              </>
            ) : (
              <>
                <Tag size={20} />
                {property ? 'تحديث البيانات' : 'حفظ العقار الجديد'}
              </>
            )}
          </button>
          <button 
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-lg font-bold hover:bg-stone-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <X size={20} />
            إلغاء
          </button>
        </div>
      </form>

      <AnimatePresence>
        {showConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center gap-3 text-amber-600">
                <Info size={24} />
                <h3 className="text-lg font-bold text-center">تنبيه: حقول ناقصة</h3>
              </div>
              <p className="text-stone-600 text-sm leading-relaxed">
                الحقول التالية لم يتم ملؤها:
                <br />
                <span className="font-bold text-stone-900">{missingFieldsList.join('، ')}</span>
                <br />
                هل أنت متأكد من رغبتك في حفظ العقار بدون هذه البيانات؟
              </p>
              <div className="flex gap-3 pt-2">
                <button 
                  type="button"
                  onClick={() => handleSubmit(null as any, true)}
                  className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all"
                >
                  نعم، احفظ الآن
                </button>
                <button 
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 bg-stone-100 text-stone-600 py-3 rounded-xl font-bold hover:bg-stone-200 transition-all"
                >
                  تراجع للإكمال
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
});

const PropertyDetails = memo(function PropertyDetails({ property, user, onBack, isAdmin, isFavorite, onFavorite, onEdit, onDelete, onRestore, onPermanentDelete, onDeleteComment, onUserClick, onFilter }: any) {
  console.log("Component PropertyDetails Rendering:", { 
    propertyID: property?.id, 
    hasImages: !!property?.images, 
    imagesCount: property?.images?.length,
    userRole: user?.role
  });

  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentImages, setCommentImages] = useState<Array<{ url: string, type: 'image' | 'video' }>>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showViewer, setShowViewer] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  useEffect(() => {
    if (!property?.id) {
      setComments([]);
      return;
    }

    const fetchComments = async () => {
      try {
        const { data, error } = await supabase
          .from('comments')
          .select('*')
          .eq('property_id', property.id)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error("Error fetching comments:", error);
        } else {
          setComments(data as Comment[]);
        }
      } catch (err) {
        console.error("Unexpected error fetching comments:", err);
      }
    };

    fetchComments();

    const channel = supabase
      .channel(`comments-${property.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'comments',
        filter: `property_id=eq.${property.id}`
      }, () => {
        fetchComments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [property?.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && commentImages.length === 0) return;
    const isEmployee = user?.role === 'employee' || isAdmin;
    if (!isEmployee) {
      toast.error('عذراً، التعليقات متاحة للموظفين فقط.');
      return;
    }
    
    setIsUploading(true);
    try {
      const { error: commentError } = await supabase.from('comments').insert({
        property_id: property.id,
        user_id: user.id,
        user_name: user.display_name,
        user_phone: user.phone || '',
        text: newComment,
        images: commentImages,
        created_at: new Date().toISOString()
      });
      if (commentError) throw commentError;
      
      // Update last comment on property
      await supabase.from('properties').update({
        last_comment: newComment || (commentImages.length > 0 ? 'تم إضافة صور' : '')
      }).eq('id', property.id);

      // Notify interested users (who favorited the property)
      const { data: favoritesData } = await supabase
        .from('favorites')
        .select('user_id')
        .eq('property_id', property.id);
      
      const interestedUserIds = (favoritesData || []).map(d => d.user_id);
      
      for (const recipient_id of interestedUserIds) {
        if (recipient_id === user.id) continue; // Don't notify the commenter
        
        await supabase.from('notifications').insert({
          type: 'new-comment',
          title: 'تعليق جديد على عقار يهمك',
          message: `أضاف ${user.display_name} تعليقاً جديداً على العقار: ${generatePropertyTitle(property)}`,
          recipient_id,
          user_id: user.id,
          property_id: property.id,
          read: false,
          created_at: new Date().toISOString()
        });
      }
      
      setNewComment('');
      setCommentImages([]);
      toast.success('تم إضافة التعليق بنجاح');
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("حدث خطأ أثناء إضافة التعليق");
    } finally {
      setIsUploading(false);
    }
  };

  const insertAtCursor = (textToInsert: string) => {
    const textarea = document.getElementById('comment-textarea') as HTMLTextAreaElement;
    if (!textarea) {
      setNewComment(prev => prev + textToInsert);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    setNewComment(prev => {
      const before = prev.substring(0, start);
      const after = prev.substring(end, prev.length);
      return before + textToInsert + after;
    });
    
    // Set focus back to textarea
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + textToInsert.length, start + textToInsert.length);
    }, 0);
  };

  const whatsappUrl = `https://wa.me/${(property.assigned_employee_phone || property.phone || '').replace(/\+/g, '').replace(/\s/g, '')}`;

  const handleCommentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (commentImages.length + files.length > 10) {
      toast.error('لا يمكن اختيار أكثر من 10 ملفات');
      return;
    }

    setIsUploading(true);
    try {
      const newImages = [...commentImages];
      for (const file of files) {
        let fileToUpload: Blob;
        let fileType = file.type;
        if (file.type.startsWith('image/')) {
          fileToUpload = await compressImage(file);
          fileType = 'image/jpeg';
        } else {
          fileToUpload = file;
        }
        
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') || 'file';
        const fileName = `comments/${Date.now()}_${safeName}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('properties_media')
          .upload(fileName, fileToUpload, { contentType: fileType });
        
        if (uploadError) {
          console.error("Supabase Storage Error:", uploadError);
          throw new Error(uploadError.message || "فشل الرفع للخادم");
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('properties_media')
          .getPublicUrl(fileName);

        newImages.push({ url: publicUrl, type: file.type.startsWith('video/') ? 'video' : 'image' });
      }
      setCommentImages(newImages);
    } catch (error: any) {
      console.error("Comment media upload error:", error);
      toast.error("خطأ الرفع: " + (error.message || "حدث خطأ أثناء رفع الملفات"));
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeCommentImage = (index: number) => {
    setCommentImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleShare = async () => {
    const shareData = {
      title: generatePropertyTitle(property),
      text: property.details,
      url: window.location.href,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('تم نسخ الرابط للمشاركة');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-8"
    >
      {showViewer && (
        <ImageViewer 
          images={viewerImages} 
          initialIndex={viewerIndex} 
          onClose={() => setShowViewer(false)} 
          is_sold={property.is_sold}
        />
      )}

      {/* Left: Info */}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-all text-sm font-bold p-2">
            <ChevronRight size={18} />
            العودة للقائمة
          </button>
          
          <div className="flex items-center gap-1">
            {isAdmin && property.status === 'deleted' ? (
              <>
                <button 
                  onClick={onRestore}
                  className="p-2.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50 rounded-full transition-all active:scale-90"
                  title="استعادة"
                >
                  <RefreshCw size={18} />
                </button>
                <button 
                  onClick={onPermanentDelete}
                  className="p-2.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-all active:scale-90"
                  title="حذف نهائي"
                >
                  <Trash2 size={18} />
                </button>
              </>
            ) : (
              <>
                {isAdmin && (
                  <button 
                    onClick={onEdit}
                    className="p-2.5 text-blue-500 hover:text-blue-700 rounded-full transition-all active:scale-90"
                    title="تعديل"
                  >
                    <Edit size={18} />
                  </button>
                )}
                {isAdmin && (
                  <button 
                    onClick={onDelete}
                    className="p-2.5 text-red-500 hover:text-red-700 hover:bg-white rounded-full transition-all active:scale-90"
                    title="حذف"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </>
            )}
            <button 
              onClick={handleShare}
              className="p-2.5 text-stone-600 hover:text-emerald-600 rounded-full transition-all active:scale-90"
              title="مشاركة"
            >
              <Share2 size={18} />
            </button>
            <button 
              onClick={onFavorite}
              className={`p-2.5 rounded-full transition-all active:scale-90 ${isFavorite ? 'text-red-500' : 'text-stone-600 hover:text-red-500'}`}
              title="المفضلة"
            >
              <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>

        <div className="ios-card overflow-hidden">
          <div className="relative aspect-square bg-stone-50 group">
             {property.images?.[activeImageIndex] ? (
              <>
                {(property.images || [])[activeImageIndex].startsWith('data:video/') ? (
                  <video 
                    src={(property.images || [])[activeImageIndex]} 
                    controls 
                    className={`w-full h-full object-cover ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                  />
                ) : (
                  <img 
                    src={(property.images || [])[activeImageIndex]} 
                    alt={generatePropertyTitle(property)} 
                    className={`w-full h-full object-cover cursor-zoom-in ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                    referrerPolicy="no-referrer"
                    onClick={() => {
                      setViewerImages(property.images);
                      setViewerIndex(activeImageIndex);
                      setShowViewer(true);
                    }}
                  />
                )}
                {property.is_sold && (
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-700/80 backdrop-blur-sm pointer-events-none z-10">
                    <span className="text-white font-black text-4xl tracking-wider transform -rotate-12 border-4 border-white px-6 py-2 rounded-xl shadow-2xl">مباع</span>
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300 relative">
                <ImageIcon size={48} />
                {property.is_sold && (
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-700/80 backdrop-blur-sm pointer-events-none z-10">
                    <span className="text-white font-black text-4xl tracking-wider transform -rotate-12 border-4 border-white px-6 py-2 rounded-xl shadow-2xl">مباع</span>
                  </div>
                )}
              </div>
            )}
            
            {(property.images?.length || 0) > 1 && (
              <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setActiveImageIndex(prev => (prev === 0 ? (property.images?.length || 0) - 1 : prev - 1))}
                  className="p-2 bg-white/80 backdrop-blur rounded-full text-stone-800 hover:bg-white transition-all shadow-md"
                >
                  <ChevronRight size={20} />
                </button>
                <button 
                  onClick={() => setActiveImageIndex(prev => (prev === (property.images?.length || 0) - 1 ? 0 : prev + 1))}
                  className="p-2 bg-white/80 backdrop-blur rounded-full text-stone-800 hover:bg-white transition-all shadow-md"
                >
                  <ChevronLeft size={20} />
                </button>
              </div>
            )}

            <div className="absolute bottom-4 right-4 flex gap-1.5">
              {(property.images || []).map((_: any, i: number) => (
                <button 
                  key={i}
                  onClick={() => setActiveImageIndex(i)}
                  className={`w-2 h-2 rounded-full transition-all ${i === activeImageIndex ? 'bg-white w-4' : 'bg-white/50'}`}
                />
              ))}
            </div>
          </div>
          
          <div className="p-6">
            <div className="flex flex-col gap-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <h1 className="text-xl font-bold serif text-stone-900 text-right">{generatePropertyTitle(property)}</h1>
                  {property.created_at && (
                    <p className="text-[10px] text-stone-400 text-right">
                      تم الإضافة {formatRelativeDate(property.created_at)}
                    </p>
                  )}
                </div>
                {property.details && (
                  <div className="text-base text-stone-700 leading-relaxed whitespace-pre-wrap text-right bg-stone-50 p-4 rounded-xl border border-stone-100">
                    {property.details}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col md:flex-row gap-3 w-full">
                <a 
                  href={`tel:${property.assigned_employee_phone || property.phone || ''}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm shadow-sm"
                >
                  <span>{property.assigned_employee_phone || property.phone || ''}</span>
                  <Phone size={16} />
                </a>
                <a 
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl hover:bg-green-600 active:scale-95 transition-all font-bold text-sm shadow-sm"
                >
                  <MessageCircle size={16} />
                  واتساب مباشر
                </a>
              </div>
            </div>

            {(property.images?.length || 0) > 1 && (
              <div className="mt-8 pt-6 border-t border-stone-100">
                <h3 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2 justify-center">
                  <ImageIcon size={16} className="text-emerald-600" />
                  معرض الصور ({(property.images?.length || 0)})
                </h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {(property.images || []).map((img: string, i: number) => (
                    <button 
                      key={i} 
                      onClick={() => {
                        setViewerImages(property.images);
                        setViewerIndex(i);
                        setShowViewer(true);
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${i === activeImageIndex ? 'border-emerald-500 scale-95' : 'border-transparent hover:border-stone-300'}`}
                    >
                      {img.startsWith('data:video/') ? (
                        <video src={img} className="w-full h-full object-cover" />
                      ) : (
                        <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Comments & Info */}
      <div className="space-y-4">
        {/* Comments List Box */}
        <div className="ios-card p-5 h-[500px] flex flex-col">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-sm font-bold flex items-center gap-2 text-stone-900 justify-center">
              <MessageSquare size={16} className="text-emerald-600" /> 
              الملاحظات والتعليقات
            </h3>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
            {comments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-2 opacity-50">
                <MessageSquare size={32} />
                <p className="text-sm">لا توجد تعليقات بعد</p>
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex flex-col items-start w-full">
                  <div className={`w-full p-4 rounded-xl shadow-sm ${c.user_id === user.id ? 'bg-emerald-50 border border-emerald-100' : 'bg-stone-50 border border-stone-100'}`}>
                    <div className="flex items-center justify-between gap-4 mb-2">
                      <p className="text-sm font-bold text-stone-900">{c.user_name}</p>
                      {c.user_phone && (
                        <a
                          href={`https://wa.me/${c.user_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`السلام عليكم، بخصوص هذا العقار: ${window.location.href}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-green-700 flex items-center gap-1 hover:underline"
                        >
                          {c.user_phone}
                          <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        </a>
                      )}
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-stone-500">
                          {formatDateTime(c.created_at) || 'جاري التحميل...'}
                        </p>
                        <div className="flex items-center gap-2">
                          {(c.user_id === user.id || isAdmin) && (
                            <button 
                              onClick={() => {
                                setEditingCommentId(c.id);
                                setEditCommentText(c.text);
                              }}
                              className="text-stone-400 hover:text-emerald-600 transition-colors"
                              title="تعديل"
                            >
                              <Edit size={14} />
                            </button>
                          )}
                          {isAdmin && (
                            <button 
                              onClick={() => {
                                onDeleteComment(c.id);
                              }}
                              className="text-stone-400 hover:text-red-600 transition-colors"
                              title="حذف"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {editingCommentId === c.id ? (
                      <div className="mt-2 space-y-2">
                        <textarea 
                          className="w-full p-3 bg-white border border-stone-200 rounded-lg text-base focus:ring-1 focus:ring-emerald-500 transition-all resize-none"
                          rows={3}
                          value={editCommentText}
                          onChange={(e) => setEditCommentText(e.target.value)}
                        />
                        <div className="flex gap-2 justify-end">
                          <button 
                            onClick={() => setEditingCommentId(null)}
                            className="px-3 py-1.5 text-sm text-stone-500 hover:bg-stone-100 rounded-md transition-colors"
                          >
                            إلغاء
                          </button>
                          <button 
                            onClick={async () => {
                              if (!editCommentText.trim()) return;
                              try {
                                await supabase.from('comments').update({
                                  text: editCommentText,
                                  updated_at: new Date().toISOString()
                                }).eq('id', c.id);
                                
                                // Update last comment on property card if this was the latest
                                const sorted = [...comments].sort((a, b) => {
                                  const timeA = new Date(a.created_at || 0).getTime();
                                  const timeB = new Date(b.created_at || 0).getTime();
                                  return timeB - timeA;
                                });
                                if (c.id === sorted[0]?.id) {
                                  await supabase.from('properties').update({
                                    last_comment: editCommentText
                                  }).eq('id', property.id);
                                }
                                
                                setEditingCommentId(null);
                              } catch (error) {
                                console.error("Error updating comment:", error);
                              }
                            }}
                            className="px-3 py-1.5 text-sm bg-emerald-600 text-white hover:bg-emerald-700 rounded-md transition-colors"
                          >
                            حفظ التعديل
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 space-y-3">
                        {c.text && (
                          <div className="text-stone-800 text-sm leading-relaxed whitespace-pre-wrap">
                            <Markdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                img: () => null
                              }}
                            >
                              {c.text}
                            </Markdown>
                          </div>
                        )}
                        
                        {(c.images && (c.images?.length || 0) > 0) ? (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {(c.images || []).map((img, idx) => (
                              <motion.div
                                key={idx}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setViewerImages(c.images!);
                                  setViewerIndex(idx);
                                  setShowViewer(true);
                                }}
                                className="relative w-20 h-20 rounded-lg overflow-hidden border border-stone-200 cursor-pointer shadow-sm"
                              >
                                {img.startsWith('data:video/') ? (
                                  <video src={img} className="w-full h-full object-cover" />
                                ) : (
                                  <img src={img} alt="" className="w-full h-full object-cover" />
                                )}
                              </motion.div>
                            ))}
                          </div>
                        ) : c.image_url ? (
                          <div className="mt-2">
                            <motion.div
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => {
                                setViewerImages([c.image_url!]);
                                setViewerIndex(0);
                                setShowViewer(true);
                              }}
                              className="relative w-24 h-24 rounded-lg overflow-hidden border border-stone-200 cursor-pointer shadow-sm"
                            >
                              {c.image_url.startsWith('data:video/') ? (
                                <video src={c.image_url} className="w-full h-full object-cover" />
                              ) : (
                                <img src={c.image_url} alt="" className="w-full h-full object-cover" />
                              )}
                            </motion.div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Note Box */}
        <div className="ios-card p-5">
          <h3 className="text-sm font-bold mb-5 flex items-center gap-2 text-stone-900 justify-center">
            <Plus size={16} className="text-emerald-500" /> 
            إضافة ملاحظة
          </h3>
          {(user.role === 'employee' || user.role === 'admin' || user.role === 'super_admin' || (user.email && SUPER_ADMIN_EMAILS.includes(user.email))) ? (
            <form onSubmit={handleAddComment} className="space-y-2">
              <div className="relative">
                <textarea 
                  id="comment-textarea"
                  placeholder="أضف ملاحظة أو تعليق... (يمكنك استخدام Markdown)"
                  rows={4}
                  className="w-full p-4 bg-stone-50/50 border border-stone-100 rounded-xl text-base focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none pb-14"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <div className="absolute bottom-3 right-3 left-3 flex gap-3 items-center">
                  <input 
                    id="comment-image-upload"
                    type="file" 
                    onChange={handleCommentImageUpload}
                    multiple
                    accept="image/*,video/*"
                    className="hidden"
                  />
                  <label 
                    htmlFor="comment-image-upload"
                    className={`p-2.5 bg-white border border-stone-100 rounded-full text-emerald-600 hover:bg-emerald-50 hover:border-emerald-500 transition-all shadow-sm flex items-center justify-center cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                    title="إضافة صور أو فيديو (حتى 10)"
                  >
                    {isUploading ? (
                      <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ImageIcon size={24} />
                    )}
                  </label>
                  <div className="flex-1 flex items-center gap-2">
                    <input 
                      type="text"
                      placeholder="رابط الصورة/الفيديو..."
                      className="w-full p-2 text-sm border border-stone-200 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      onBlur={(e) => {
                        if (e.target.value) {
                          insertAtCursor(`[رابط](${e.target.value})`);
                          e.target.value = '';
                        }
                      }}
                    />
                    <LinkIcon size={20} className="text-stone-400" />
                  </div>
                </div>
              </div>

              {commentImages.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-stone-50 rounded-xl border border-stone-100">
                  {commentImages.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 group">
                      {img.type === 'video' ? (
                        <video src={img.url} className="w-full h-full object-cover" />
                      ) : (
                        <img src={img.url} alt="" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => removeCommentImage(idx)}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button 
                type="submit"
                disabled={isUploading || (!newComment.trim() && commentImages.length === 0)}
                className="w-full bg-emerald-500 text-white px-4 py-3 rounded-xl hover:bg-emerald-600 active:scale-[0.98] transition-all text-sm font-bold mt-2 shadow-sm disabled:opacity-50"
              >
                {isUploading ? 'جاري الإرسال...' : 'إرسال التعليق'}
              </button>
            </form>
          ) : (
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-100 text-center">
              <p className="text-[10px] text-stone-500">التعليقات متاحة للمستخدمين فقط</p>
            </div>
          )}
        </div>

        {/* Marketer Info Box */}
        <div className="ios-card p-5">
          <div className="flex items-center gap-4 p-4 bg-stone-50 rounded-xl border border-stone-100 w-full">
            <div className="flex flex-col items-start gap-2" dir="ltr">
              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/${(property.assigned_employee_phone || property.phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`السلام عليكم، بخصوص هذا العقار: ${window.location.href}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 flex items-center justify-center text-green-600 bg-white border border-stone-100 hover:bg-green-50 rounded-full transition-colors shadow-sm"
                  title="واتساب"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </a>
                <a 
                  href={`tel:${property.assigned_employee_phone || property.phone}`}
                  className="w-10 h-10 flex items-center justify-center text-emerald-600 bg-white border border-stone-100 hover:bg-emerald-50 rounded-full transition-colors shadow-sm"
                  title="اتصال"
                >
                  <Phone size={18} />
                </a>
              </div>
              <span className="text-xs font-bold text-stone-600">
                {property.assigned_employee_phone || property.phone}
              </span>
              {property.created_at && (
                <p className="text-xs text-stone-400 mt-1">
                  تاريخ الإدخال: {formatDateTime(property.created_at) || 'جاري التحميل...'}
                </p>
              )}
            </div>
            <div className="flex-1 min-w-0 text-right">
              <button 
                onClick={() => {
                  if (onUserClick && property.assigned_employee_id) {
                    onUserClick(property.assigned_employee_id);
                  }
                }}
                className="text-xs font-bold text-stone-900 hover:text-emerald-700 transition-colors text-right truncate w-full block"
              >
                {property.assigned_employee_name || 'غير محدد'}
              </button>
              <p className="text-[10px] text-stone-500 mt-0.5">مستخدم معتمد</p>
            </div>
          </div>
        </div>

        {/* Property Attributes Box */}
        <div className="ios-card p-5">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2 text-stone-900 justify-center">
            <MapPin size={16} className="text-emerald-600" /> 
            تفاصيل الموقع والمواصفات
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {/* Governorate */}
            <button onClick={() => onFilter('governorate', property.governorate)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
              <span className="text-[10px] text-stone-500 mb-1">المحافظة</span>
              <span className="text-xs font-bold text-stone-800">{property.governorate}</span>
            </button>
            {/* Area */}
            <button onClick={() => onFilter('area', property.area)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
              <span className="text-[10px] text-stone-500 mb-1">المنطقة</span>
              <span className="text-xs font-bold text-stone-800">{cleanAreaName(property.area)}</span>
            </button>
            {/* Type */}
            <button onClick={() => onFilter('type', property.type)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
              <span className="text-[10px] text-stone-500 mb-1">النوع</span>
              <span className="text-xs font-bold text-stone-800">{property.type}</span>
            </button>
            {/* Purpose */}
            {property.purpose !== 'بيع' && (
              <button onClick={() => onFilter('purpose', property.purpose)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
                <span className="text-[10px] text-stone-500 mb-1">الغرض</span>
                <span className="text-xs font-bold text-stone-800">{property.purpose}</span>
              </button>
            )}
            {/* Sector */}
            {property.sector && (
              <div className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 text-right">
                <span className="text-[10px] text-stone-500 mb-1">القطاع</span>
                <span className="text-xs font-bold text-stone-800">{property.sector}</span>
              </div>
            )}
            {/* Block */}
            {property.block && (
              <button onClick={() => onFilter('block', property.block)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
                <span className="text-[10px] text-stone-500 mb-1">القطعة</span>
                <span className="text-xs font-bold text-stone-800">{property.block}</span>
              </button>
            )}
            {/* Plot Number */}
            {property.plot_number && (
              <button onClick={() => onFilter('plot_number', property.plot_number)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
                <span className="text-[10px] text-stone-500 mb-1">القسيمة</span>
                <span className="text-xs font-bold text-stone-800">{property.plot_number}</span>
              </button>
            )}
            {/* Street */}
            {property.street && (
              <button onClick={() => onFilter('street', property.street)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
                <span className="text-[10px] text-stone-500 mb-1">الموقع</span>
                <span className="text-xs font-bold text-stone-800">{property.street}</span>
              </button>
            )}
            {/* Avenue */}
            {property.avenue && (
              <button onClick={() => onFilter('avenue', property.avenue)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
                <span className="text-[10px] text-stone-500 mb-1">الجادة</span>
                <span className="text-xs font-bold text-stone-800">{property.avenue}</span>
              </button>
            )}
            {/* House Number */}
            {property.house_number && (
              <button onClick={() => onFilter('house_number', property.house_number)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
                <span className="text-[10px] text-stone-500 mb-1">المنزل</span>
                <span className="text-xs font-bold text-stone-800">{property.house_number}</span>
              </button>
            )}
            {/* Location */}
            {property.location && (
              <button onClick={() => onFilter('location', property.location)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right col-span-2">
                <span className="text-[10px] text-stone-500 mb-1">الموقع العام</span>
                <span className="text-xs font-bold text-stone-800">{property.location}</span>
              </button>
            )}
            {/* Location Link */}
            {property.location_link && (
              <div className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 text-right col-span-2">
                <span className="text-[10px] text-stone-500 mb-1">رابط العنوان</span>
                <a href={property.location_link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline truncate w-full" dir="ltr">
                  عرض على الخريطة
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
});
