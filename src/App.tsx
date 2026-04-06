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
import { GOVERNORATES, AREAS, PROPERTY_TYPES, PURPOSES, LOCATIONS, SUPER_ADMIN_EMAILS } from './constants';
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
  formatDateTime,
  isImageVideo,
  getImageUrl
} from './utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PropertyForm } from './components/PropertyForm';
import { PropertyDetails } from './components/PropertyDetails';
import { SearchableFilter } from './components/SearchableFilter';
import { LoadingSpinner } from './components/LoadingSpinner';
import { SyncModal } from './components/SyncModal';
import { ConfirmModal } from './components/ConfirmModal';
import { ImageViewer } from './components/ImageViewer';
import { PropertyCard } from './components/PropertyCard';
import { useAuth } from './contexts/AuthContext';

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
  description?: string;
  sector?: string;
  block?: string;
  street?: string;
  avenue?: string;
  plot_number?: string;
  house_number?: string;
  location?: string;
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

export default function App() {
  const { 
    user, 
    loading, 
    authError: contextAuthError, 
    isSuperAdmin, 
    isAdmin, 
    selectedCompanyId, 
    setSelectedCompanyId, 
    handleLogout,
    isPending
  } = useAuth();

  const isEmployee = user?.role === 'employee' || isAdmin;
  const isPopState = useRef(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localAuthError, setLocalAuthError] = useState(''); // Specifically for form errors
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
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [filters, setFilters] = useState({
    governorate: '',
    area: '',
    type: '',
    purpose: '',
    location: '',
    plot_number: '',
    house_number: '',
    marketer: '',
    status: '' // '', 'available', 'sold'
  });

  const searchSuggestions = []; // Dropdown disabled per user request

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
  const [companyActionConfirm, setCompanyActionConfirm] = useState<{ 
    isOpen: boolean; 
    company: Company | null; 
    action: 'delete' | 'edit' | null 
  }>({
    isOpen: false,
    company: null,
    action: null
  });
  const [permanentDeleteConfirmState, setPermanentDeleteConfirmState] = useState<{ isOpen: boolean; property_id: string | null }>({
    isOpen: false,
    property_id: null
  });

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isDetailedFiltersOpen, setIsDetailedFiltersOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserName, setEditUserName] = useState('');
  const [editUserPhone, setEditUserPhone] = useState('');
  const [editUserEmail, setEditUserEmail] = useState('');
  const [isSideMenuOpen, setIsSideMenuOpen] = useState(false);

  // Sync state from URL on load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPropertyId = params.get('propertyId');
    const urlView = params.get('view') as any;

    if (urlPropertyId) {
      const fetchProperty = async () => {
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('id', urlPropertyId)
          .single();
        
        if (data && !error) {
          setSelectedProperty(data);
          setView(urlView || 'details');
        }
      };
      fetchProperty();
    } else if (urlView) {
      setView(urlView);
    }
  }, []);

  // Sync state changes to history
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let changed = false;

    if (view === 'list') {
      if (params.has('view')) { params.delete('view'); changed = true; }
      if (params.has('propertyId')) { params.delete('propertyId'); changed = true; }
    } else {
      if (params.get('view') !== view) { params.set('view', view); changed = true; }
      if (view === 'details' || view === 'edit') {
        if (selectedProperty?.id && params.get('propertyId') !== selectedProperty.id) {
          params.set('propertyId', selectedProperty.id);
          changed = true;
        }
      } else {
        if (params.has('propertyId')) { params.delete('propertyId'); changed = true; }
      }
    }

    if (changed) {
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
      window.history.pushState({ view, propertyId: selectedProperty?.id }, '', newUrl);
    }
  }, [view, selectedProperty?.id]);

  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (e.state) {
        if (e.state.view) setView(e.state.view);
      }
    };
    window.addEventListener('popstate', handlePopState);
    
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
      let query = supabase.from('properties').select('*', { count: 'exact' });
      
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
        .limit(2000);
      
      if (error) {
        console.error("Properties error:", error);
        return;
      }

      const allProps = (data || []).map(p => ({
        ...p,
        location: p.location === 'شارع واحد | سد' ? 'شارع واحد' : p.location
      })) as Property[];
      
      const deleted = allProps.filter(p => p.status === 'deleted');
      const active = allProps.filter(p => p.status !== 'deleted');
      
      setProperties(active);
      setDeletedProperties(deleted);
    };

    fetchProperties();

    const subscription = supabase
      .channel('properties_changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'properties' }, (payload) => {
        const newProp = payload.new as Property;
        if (isSuperAdmin) {
          if (!selectedCompanyId || newProp.company_id === selectedCompanyId) {
            setProperties(prev => [newProp, ...prev]);
          }
        } else if (newProp.company_id === user?.company_id) {
          setProperties(prev => [newProp, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'properties' }, (payload) => {
        const updated = payload.new as Property;
        if (updated.status === 'deleted') {
          setProperties(prev => prev.filter(p => p.id !== updated.id));
          setDeletedProperties(prev => [updated, ...prev.filter(p => p.id !== updated.id)]);
        } else if (updated.status === 'approved' || updated.status === 'pending') {
          setProperties(prev => prev.map(p => p.id === updated.id ? updated : p));
          setDeletedProperties(prev => prev.filter(p => p.id !== updated.id));
        }
        if (selectedProperty?.id === updated.id) {
          setSelectedProperty(updated);
        }
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'properties' }, (payload) => {
        const deletedId = payload.old.id;
        setProperties(prev => prev.filter(p => p.id !== deletedId));
        setDeletedProperties(prev => prev.filter(p => p.id !== deletedId));
        if (selectedProperty?.id === deletedId) {
          setSelectedProperty(null);
          setView('list');
        }
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
    setLocalAuthError('');
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
              message: `الموظف ${username} يطلب الانضمام للنظام`,
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
        message = "هذا الموظف مسجل بالفعل. جرب تسجيل الدخول بدلاً من إنشاء حساب جديد.";
      }
      setLocalAuthError(message);
      toast.error(message);
    } finally {
      setIsAuthenticating(false);
    }
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

  const handleSearch = () => {
    setActiveSearchQuery(searchQuery);
  };

  const filteredProperties = useMemo(() => {
    const sourceProperties = view === 'trash' ? deletedProperties : properties;
    return sourceProperties.filter(p => {
      // View specific filtering
      if (view === 'my-listings' && p.created_by !== user?.id) return false;
      if (view === 'my-favorites' && !favorites.includes(p.id)) return false;
      if (view === 'user-listings' && selectedMarketerId && p.assigned_employee_id !== selectedMarketerId) return false;
      if (view === 'pending-properties' && p.status !== 'pending') return false;
      
      // Text Search - Manual Trigger Required
      if (activeSearchQuery) {
        const searchableText = [
          p.name,
          p.area,
          p.plot_number,
          p.details,
          p.assigned_employee_name,
          p.phone,
          p.details,
          p.governorate,
          p.type,
          p.purpose,
          p.location,
          p.house_number,
          p.sector
        ].join(' ');
        if (!searchMatch(searchableText, activeSearchQuery)) return false;
      }

      const matchesGov = !filters.governorate || normalizeArabic(p.governorate || '') === normalizeArabic(filters.governorate);
      const matchesArea = !filters.area || normalizeArabic(p.area || '') === normalizeArabic(filters.area);
      const matchesType = !filters.type || normalizeArabic(p.type || '') === normalizeArabic(filters.type);
      const matchesPurpose = !filters.purpose || normalizeArabic(p.purpose || '') === normalizeArabic(filters.purpose);
      const matchesLocation = !filters.location || normalizeArabic(p.location || '') === normalizeArabic(filters.location);
      const matchesPlot = !filters.plot_number || (p.plot_number && p.plot_number === normalizeDigits(filters.plot_number));
      const matchesHouse = !filters.house_number || (p.house_number && p.house_number === normalizeDigits(filters.house_number));
      const matchesMarketer = !filters.marketer || normalizeArabic(p.assigned_employee_name || '') === normalizeArabic(filters.marketer);
      const matchesStatus = !filters.status || 
                           (filters.status === 'sold' && p.is_sold) || 
                           (filters.status === 'available' && !p.is_sold);

      return matchesGov && matchesArea && matchesType && matchesPurpose && 
             matchesLocation && matchesPlot && matchesHouse && matchesMarketer && matchesStatus;
    }).sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  }, [properties, deletedProperties, activeSearchQuery, filters, view, favorites, user, selectedMarketerId, deletedProperties]);

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

          {(localAuthError || contextAuthError) && (
            <div className={`p-4 rounded-xl text-sm mb-6 text-center border shadow-sm font-medium ${(localAuthError || contextAuthError).includes('المراجعة') ? 'bg-amber-50 text-amber-800 border-amber-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
              <p>{localAuthError || contextAuthError}</p>
              {(localAuthError || contextAuthError).includes('المراجعة') && (
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
                        <span className="font-bold text-md">الموظفين</span>
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
              <div className="bg-white border border-stone-200 p-4 rounded-xl shadow-sm w-full relative z-[50]">
                <div className="space-y-4">
                  {/* Quick Search Section */}
                  <div className="flex flex-col md:flex-row gap-3 items-center">
                    <div className="bg-stone-50 border border-stone-200 rounded-lg flex-1 focus-within:border-emerald-500 transition-all flex items-center p-2 px-4 min-h-[46px] w-full">
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
                            className="w-full bg-transparent border-none outline-none text-xs py-1 pl-8 pr-8 text-right"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(normalizeDigits(e.target.value))}
                            onFocus={() => setIsSearchFocused(true)}
                            onBlur={() => {
                              setTimeout(() => setIsSearchFocused(false), 200);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setIsSearchFocused(false);
                                handleSearch();
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
                              className="absolute top-full right-0 left-0 mt-2 bg-white border border-stone-200 rounded-lg shadow-xl z-[100] overflow-hidden"
                            >
                              <div className="max-h-60 overflow-y-auto p-1">
                                {searchSuggestions.map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => { setSearchQuery(opt); setIsSearchFocused(false); }}
                                    className="w-full text-right p-3 text-sm rounded-lg hover:bg-stone-50 text-stone-600 transition-colors"
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
                    <button 
                      onClick={() => setIsDetailedFiltersOpen(!isDetailedFiltersOpen)}
                      className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all whitespace-nowrap"
                    >
                      <Filter size={16} />
                      {isDetailedFiltersOpen ? 'إخفاء البحث الدقيق' : 'البحث الدقيق'}
                    </button>
                  </div>

                  {/* Detailed Search Filters */}
                  <AnimatePresence>
                    {isDetailedFiltersOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-visible z-[60] relative"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
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

                           <input
                            type="text"
                            placeholder="رقم القسيمة..."
                            className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-right focus:border-emerald-500 outline-none w-full"
                            value={filters.plot_number}
                            onChange={(e) => setFilters({...filters, plot_number: e.target.value})}
                          />

                          <input
                            type="text"
                            placeholder="رقم المنزل..."
                            className="bg-white border border-stone-200 rounded-lg px-3 py-2 text-sm text-right focus:border-emerald-500 outline-none w-full"
                            value={filters.house_number}
                            onChange={(e) => setFilters({...filters, house_number: e.target.value})}
                          />

                          <SearchableFilter 
                            placeholder="ابحث بالموظف..."
                            options={availableFilterOptions.marketers}
                            value={filters.marketer}
                            onChange={(val) => setFilters({...filters, marketer: val})}
                          />

                          <div className="bg-white border border-stone-200 rounded-lg p-2 h-[46px] flex flex-col justify-center focus-within:border-emerald-500 transition-all shadow-sm">
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="flex flex-col gap-2 pt-4 border-t border-stone-100 mt-4">
                  <button 
                    onClick={handleSearch}
                    className="w-full py-3.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 hover:shadow-emerald-200/50 transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100 active:scale-[0.98]"
                  >
                    <Search size={18} />
                    بحث
                  </button>
                  {(searchQuery || filters.governorate || filters.area || filters.type || filters.purpose || filters.location || filters.plot_number || filters.house_number || filters.marketer || filters.status !== '') && (
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setFilters({ governorate: '', area: '', type: '', purpose: '', location: '', plot_number: '', house_number: '', marketer: '', status: '' });
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
                  {view === 'pending-properties' ? `عقارات قيد المراجعة (${filteredProperties.length})` : view === 'trash' ? `سلة المحذوفات (${filteredProperties.length})` : (searchQuery || filters.governorate || filters.area || filters.type || filters.purpose || filters.location || filters.plot_number || filters.house_number || filters.marketer || filters.status
                    ? `نتائج البحث (${filteredProperties.length})` 
                    : `${view === 'list' ? 'كل العقارات' : view === 'my-listings' ? 'إعلاناتي' : view === 'my-favorites' ? 'إعلاناتي المفضلة' : `عقارات ${employees.find(emp => emp.id === selectedMarketerId)?.display_name || 'الموظف'}`} (${filteredProperties.length})`)}
                </h2>
              </div>


              {/* Grid - Always show results */}
              {filteredProperties.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
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
                            إضافة موظف
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
                                setCompanyActionConfirm({ isOpen: true, company, action: 'edit' });
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                              title="تعديل"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => {
                                setCompanyActionConfirm({ isOpen: true, company, action: 'delete' });
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
                            <span className="text-lg">إضافة موظف جديد</span>
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
                              throw new Error(errData.error || 'فشل إنشاء الموظف');
                            }

                            toast.success('تمت إضافة الموظف بنجاح.');
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
                          <button type="submit" className="flex-1 bg-emerald-600 text-white py-3.5 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-100 transition-all active:scale-[0.98]">إضافة الموظف</button>
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
                    <h2 className="text-2xl font-bold tracking-tight">إدارة الموظفين</h2>
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
                    <h3 className="font-bold text-stone-900">قائمة الموظفين ({employees.length})</h3>
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
                  onPermanentDelete={() => setPermanentDeleteConfirmState({ isOpen: true, property_id: selectedProperty?.id })}
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
            userActionConfirm.action === 'approve' ? `هل أنت متأكد من الموافقة على الموظف ${userActionConfirm.extraData?.display_name || ''}؟` :
            userActionConfirm.action === 'reject' ? `هل أنت متأكد من رفض الموظف ${userActionConfirm.extraData?.display_name || ''}؟` :
            userActionConfirm.action === 'change-role' ? `هل أنت متأكد من تغيير صلاحية ${userActionConfirm.extraData?.display_name} إلى ${userActionConfirm.extraData?.newRole === 'admin' ? 'مدير نظام' : 'مستخدم'}؟` :
            `هل أنت متأكد من رغبتك في حذف ${userActionConfirm.extraData?.display_name || 'هذا الموظف'} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`
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
    try {
        const { data: propertyData, error: fetchError } = await supabase.from('properties').select('images').eq('id', id).single();
        if (fetchError) throw fetchError;
        
        if (propertyData?.images && Array.isArray(propertyData.images)) {
          const paths = propertyData.images
            .map((img: any) => {
              const url = typeof img === 'string' ? img : img?.url;
              if (url?.includes('storage/v1/object/public/properties_media/')) {
                return url.split('storage/v1/object/public/properties_media/')[1];
              }
              return null;
            })
            .filter(Boolean) as string[];
          
          if (paths.length > 0) {
            try {
              await supabase.storage.from('properties_media').remove(paths);
            } catch (e) {
              console.error("Error deleting files:", e);
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
          is_deleted: true,
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
            const paths = commentData.images
              .map((img: any) => {
                const url = typeof img === 'string' ? img : img?.url;
                if (url?.includes('storage/v1/object/public/properties_media/')) {
                  return url.split('storage/v1/object/public/properties_media/')[1];
                }
                return null;
              })
              .filter(Boolean) as string[];

            if (paths.length > 0) {
              try {
                await supabase.storage.from('properties_media').remove(paths);
              } catch (e) {
                console.error("Error deleting files:", e);
              }
            }
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
      toast.error("ليس لديك صلاحية لإدارة الموظفين");
      setUserActionConfirm({ isOpen: false, user_id: null, action: null, extraData: null });
      return;
    }
    try {
      if (userActionConfirm.action === 'bulk-delete') {
        const { error } = await supabase.from('user_profiles').delete().neq('role', 'super_admin');
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

  async function confirmCompanyAction() {
    if (!companyActionConfirm.company) return;
    
    if (companyActionConfirm.action === 'delete') {
      try {
        const { error } = await supabase.from('companies').delete().eq('id', companyActionConfirm.company.id);
        if (error) throw error;
        toast.success('تم حذف الشركة');
      } catch (err: any) {
        toast.error('خطأ: ' + err.message);
      }
    } else if (companyActionConfirm.action === 'edit') {
      setEditingCompany(companyActionConfirm.company);
      setIsEditingCompany(true);
    }
    
    setCompanyActionConfirm({ isOpen: false, company: null, action: null });
  }
}

