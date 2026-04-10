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
  Download,
  Clock,
  Maximize,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from './lib/supabaseClient';
import { API_BASE } from './lib/apiBase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { GOVERNORATES, AREAS, PROPERTY_TYPES, PURPOSES, LOCATIONS } from './constants';
import { normalizeArabic, cleanAreaName, searchMatch, normalizeDigits, generatePropertyTitle, usernameToEmail, extractSpreadsheetId, formatRelativeDate, formatDateTime } from './utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// --- Types ---

interface Property {
  id: string;
  name: string;
  governorate: string;
  area: string;
  type: string;
  purpose: string;
  phone: string;
  phone_2?: string;
  company_id: string;
  assigned_employee_id?: string;
  assigned_employee_name?: string;
  images: any[];
  location_link?: string;
  is_sold?: boolean;
  sector?: string;
  distribution?: string;
  block?: string;
  street?: string;
  avenue?: string;
  plot_number?: string;
  house_number?: string;
  location: string;
  price?: string;
  details?: string;
  last_comment?: string;
  comments_2?: string;
  comments_3?: string;
  status_label?: string;
  status: 'pending' | 'approved' | 'rejected' | 'deleted';
  is_deleted?: boolean;
  deleted_at?: any;
  created_by: string;
  created_at: any;
}

interface Company {
  id: string;
  name: string;
  phone?: string;
  address?: string;
  createdAt: any;
}

interface PropertyComment {
  id: string;
  property_id?: string;
  propertyId?: string;
  user_id?: string;
  userId?: string;
  user_name?: string;
  userName?: string;
  text: string;
  images?: any[];
  image_url?: string;
  imageUrl?: string;
  user_phone?: string;
  userPhone?: string;
  created_at?: any;
  createdAt?: any;
  is_deleted?: boolean;
  isDeleted?: boolean;
}

interface UserProfile {
  uid: string;
  email: string;
  name: string;
  role: 'super_admin' | 'admin' | 'employee' | 'pending' | 'rejected';
  companyId?: string;
  createdAt?: string;
  forceSignOut?: boolean;
  phone?: string;
}

interface Notification {
  id: string;
  type: 'new-user' | 'property-update' | 'price-change' | 'status-change' | 'new-comment';
  title: string;
  message: string;
  userId?: string; // Triggering user
  recipientId?: string; // Target user (if null, it's for admins)
  propertyId?: string;
  read: boolean;
  createdAt: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface SupabaseErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      name: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

async function handleSupabaseError(error: unknown, operationType: OperationType, path: string | null) {
  console.error(`[DIAGNOSTIC] Supabase Error (${operationType} on ${path}):`, error);
  const { data: { session } } = await supabase.auth.getSession();
  
  let errorMessage = 'An unknown error occurred';
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'object' && error !== null) {
    // Handle Supabase/Postgres error objects
    const anyErr = error as any;
    errorMessage = anyErr.message || anyErr.error || anyErr.details || JSON.stringify(error);
  } else {
    errorMessage = String(error);
  }

  const errInfo: SupabaseErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: session?.user?.id,
      email: session?.user?.email || null,
      emailVerified: !!session?.user?.email_confirmed_at,
      isAnonymous: session?.user?.is_anonymous,
      tenantId: null,
      providerInfo: session?.user?.app_metadata?.provider || []
    },
    operationType,
    path
  }
  
  console.error('Unified Error Info:', errInfo);
  throw new Error(JSON.stringify(errInfo));
}
  
// --- Helper Functions ---
const compressImage = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    // If it's a small image (e.g. < 200KB), don't bother compressing
    if (file.size < 200 * 1024) {
      resolve(file);
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('فشل تحميل الصورة'));
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        // Slightly larger dimensions for high-quality real estate shots
        const MAX_WIDTH = 1600; 
        const MAX_HEIGHT = 1600;
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
        if (!ctx) return reject(new Error('فشل إنشاء سياق الرسم'));
        
        // Improved rendering quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) return reject(new Error('فشل ضغط الصورة'));
          resolve(blob);
        }, 'image/jpeg', 0.82); // Balanced quality vs size
      };
    };
  });
};

function getMediaType(url: string, fileType?: string): 'image' | 'video' {
  if (fileType) {
    if (fileType.startsWith('video/')) return 'video';
    if (fileType.startsWith('image/')) return 'image';
  }
  
  const lowerUrl = url?.toLowerCase() || '';
  if (lowerUrl.endsWith('.mp4') || lowerUrl.endsWith('.mov') || lowerUrl.endsWith('.webm') || lowerUrl.startsWith('data:video/')) {
    return 'video';
  }
  return 'image';
}

// --- Sub-Components ---

const PropertyCard = memo(function PropertyCard({ property, isFavorite, onFavorite, onClick, onImageClick, isAdmin, onFilter, onUserClick, onApprove, onReject, onEdit, onDelete, onRestore, onPermanentDelete, view }: any) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`ios-card overflow-hidden hover:shadow-xl transition-all group relative flex flex-col cursor-pointer bg-white border border-stone-100 ${view === 'pending-properties' ? 'border-amber-300 ring-2 ring-amber-100' : 'hover:border-emerald-200'}`}
      onClick={onClick}
    >
      <div 
        className="relative aspect-[16/10] bg-stone-100 overflow-hidden group/img cursor-zoom-in" 
        onClick={(e) => {
          e.stopPropagation();
          if ((property.images || []).length > 0) {
            const imageList = property.images.map((img: any) => typeof img === 'string' ? img : (img?.url || ''));
            onImageClick(imageList, 0);
          }
        }}
      >
        {property.images?.[0] ? (
          <div className="w-full h-full relative">
            {(() => {
              const img = property.images[0];
              const url = typeof img === 'string' ? img : (img?.url || '');
              const isVideo = typeof img === 'string' 
                ? (img.startsWith('data:video/') || img.toLowerCase().endsWith('.mp4')) 
                : (img?.type === 'video' || (img?.url && img.url.toLowerCase().endsWith('.mp4')));
              
              return isVideo ? (
                <video 
                  src={url} 
                  autoPlay muted loop playsInline
                  className={`w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110 ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                />
              ) : (
                <img 
                  loading="lazy"
                  src={url} 
                  alt={generatePropertyTitle(property)} 
                  className={`w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110 ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                  referrerPolicy="no-referrer"
                />
              );
            })()}
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/img:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2">
              <div className="bg-white/30 backdrop-blur-md p-3 rounded-full border border-white/40 shadow-2xl transform scale-75 group-hover/img:scale-100 transition-transform duration-500">
                <Maximize className="text-white" size={24} />
              </div>
            </div>
            {property.is_sold && (
              <div className="absolute inset-0 flex items-center justify-center bg-stone-900/60 backdrop-blur-[2px] z-20">
                <span className="text-white font-black text-xl tracking-wider transform -rotate-12 border-4 border-white px-4 py-1 rounded-lg shadow-2xl">مباع</span>
              </div>
            )}
            {property.status_label && (
              <div className="absolute top-3 right-3 z-10">
                <span className="bg-amber-500 text-white px-2.5 py-1 text-[10px] font-black rounded-lg shadow-lg border border-amber-400/50">
                  {property.status_label}
                </span>
              </div>
            )}
            {property.images && property.images.length > 1 && (
              <div className="absolute bottom-3 left-3 bg-black/50 backdrop-blur-md text-white text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1 border border-white/10">
                <ImageIcon size={12} />
                <span>{property.images.length}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-stone-50 gap-2 border-b border-stone-100">
            <ImageIcon className="text-stone-300" size={32} />
            <span className="text-[11px] font-bold text-stone-400">لا توجد صور</span>
          </div>
        )}
        {property.purpose && (
          <div className="absolute bottom-3 right-3 z-10">
            <span className="bg-white/90 backdrop-blur-md text-emerald-800 px-2 py-1 text-[10px] font-black rounded-lg shadow-sm border border-stone-100">
              {property.purpose}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 pt-4 flex flex-col flex-1 min-w-0">
        <div className="flex justify-between items-start gap-2 mb-2">
          <h3 className="text-sm font-extrabold text-stone-900 line-clamp-1 flex-1 text-right group-hover:text-emerald-700 transition-colors">
            {property.name || 'عقار بدون اسم'}
          </h3>
          {property.price && (
            <span className="text-emerald-600 font-black text-sm whitespace-nowrap">
              {property.price}
            </span>
          )}
        </div>
        {property.details && (
          <p className="text-[11px] text-stone-500 leading-relaxed line-clamp-2 text-right mb-4 min-h-[32px]">
            {property.details}
          </p>
        )}
        {property.last_comment && (
          <div className="mb-4 p-2 bg-emerald-50/50 rounded-lg border-r-2 border-emerald-400 overflow-hidden text-right">
            <p className="text-[10px] text-stone-700 font-medium line-clamp-1 italic">
              "{property.last_comment}"
            </p>
          </div>
        )}
        <div className="mt-auto pt-3 border-t border-stone-100">
          <div className="flex items-center flex-wrap gap-y-2 gap-x-1.5 text-[10px] font-bold text-stone-700">
            <button
              onClick={(e) => { e.stopPropagation(); onFilter('area', property.area); }}
              className="px-2 py-0.5 bg-stone-100 rounded text-stone-600 hover:bg-stone-200 transition-colors truncate max-w-[120px]"
            >
              {cleanAreaName(property.area) || '-'}
            </button>
            <span className="text-stone-300">/</span>
            <button
              onClick={(e) => { e.stopPropagation(); onFilter('type', property.type); }}
              className="px-2 py-0.5 bg-emerald-50 rounded text-emerald-700 hover:bg-emerald-100 transition-colors truncate"
            >
              {property.type || 'غير محدد'}
            </button>
            <div className="flex-1"></div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const shareUrl = `${window.location.origin}?propertyId=${property.id}`;
                  if (navigator.share) navigator.share({ title: property.name, url: shareUrl }).catch(() => {});
                  else { navigator.clipboard.writeText(shareUrl); toast.success('تم نسخ الرابط'); }
                }}
                className="p-1.5 text-stone-500 hover:bg-stone-100 rounded-lg transition-all"
              ><Share2 size={14} /></button>
              {isAdmin && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); onEdit(property); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"><Edit size={14} /></button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(property.id); }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={14} /></button>
                </>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onFavorite(); }}
                className={`p-1.5 rounded-lg transition-all ${isFavorite ? 'text-red-500 bg-red-50' : 'text-stone-400 hover:bg-stone-50'}`}
              ><Heart size={14} fill={isFavorite ? 'currentColor' : 'none'} /></button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});

const PropertyForm = memo(function PropertyForm({ property, isAdmin, user, selectedCompanyId, companies, onCancel, onSave }: any) {
  const isSuperAdmin = useMemo(() =>
    user?.role === 'super_admin' || (user?.email && SUPER_ADMIN_EMAILS.includes(user.email)),
    [user?.role, user?.email]
  );
  const [formData, setFormData] = useState({
    name: property?.name || '',
    governorate: property?.governorate || '',
    area: property?.area || '',
    type: property?.type || '',
    purpose: property?.purpose || '',
    assigned_employee_id: property?.assigned_employee_id || '',
    assigned_employee_name: property?.assigned_employee_name || '',
    assigned_employee_phone: property?.assigned_employee_phone || '',
    images: (property?.images || []).map((img: any) => {
      const url = typeof img === 'string' ? img : (img?.url || '');
      return { url, type: getMediaType(url) };
    }),
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
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });

  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        let query = supabase.from('profiles').select('*').eq('role', 'employee');

        if (isSuperAdmin) {
          const targetCompanyId = property?.company_id || selectedCompanyId;
          if (targetCompanyId) {
            query = query.eq('company_id', targetCompanyId);
          }
        } else {
          query = query.eq('company_id', user?.company_id);
        }

        const { data: employeesData, error } = await query;

        if (error) throw error;

        setEmployees((employeesData || []).map(doc => ({ uid: doc.id, ...doc })) as UserProfile[]);

        // Subscribe to changes
        const channel = supabase.channel('employees-changes');
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'profiles' },
          () => {
            // Re-fetch on any change
            query.then(({ data: updated }) => {
              setEmployees((updated || []).map(doc => ({ uid: doc.id, ...doc })) as UserProfile[]);
            });
          }
        ).subscribe();

        return () => { channel.unsubscribe(); };
      } catch (error) {
        console.error("PropertyForm employees listener error:", error);
      }
    })();
  }, [isSuperAdmin, selectedCompanyId, user?.companyId, property?.companyId]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;

    if ((formData.images || []).length + files.length > 20) {
      toast.error('لا يمكن رفع أكثر من 20 ملفاً');
      if (e.target) e.target.value = '';
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    
    try {
      // Process files in parallel but with a slight throttle to avoid memory issues
      // chunkING them into batches of 3
      const chunks = [];
      for (let i = 0; i < files.length; i += 3) {
        chunks.push(files.slice(i, i + 3));
      }

      for (const chunk of chunks) {
        const uploadPromises = chunk.map(async (file) => {
          try {
            let fileToUpload: Blob;
            if (file.type.startsWith('image/')) {
              fileToUpload = await compressImage(file);
            } else {
              fileToUpload = file;
            }

            const ext = file.type.startsWith('image/') ? 'jpg' : (file.name.split('.').pop() || 'mp4');
            const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
            
            const { error: uploadError } = await supabase.storage
              .from('properties_media')
              .upload(`properties/${safeFileName}`, fileToUpload, { 
                contentType: file.type.startsWith('image/') ? 'image/jpeg' : (file.type || 'video/mp4'),
                cacheControl: '3600'
              });

            if (uploadError) throw uploadError;

            const { data: publicUrl } = supabase.storage
              .from('properties_media')
              .getPublicUrl(`properties/${safeFileName}`);

            const newImageData = { 
              url: publicUrl.publicUrl, 
              type: getMediaType(publicUrl.publicUrl, file.type) 
            };

            // Update state incrementally so user sees success immediately
            setFormData(prev => ({
              ...prev,
              images: [...prev.images, newImageData]
            }));
            
            setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
            return true;
          } catch (err) {
            console.error("Individual file upload error:", err);
            toast.error(`فشل رفع الملف: ${file.name}`);
            return false;
          }
        });

        await Promise.all(uploadPromises);
      }
    } catch (error) {
      console.error("Batch upload error:", error);
      toast.error("حدث خطأ أثناء معالجة بعض الملفات");
    } finally {
      setIsUploading(false);
      setUploadProgress({ current: 0, total: 0 });
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
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      let empId = formData.assigned_employee_id;
      let empName = formData.assigned_employee_name;

      if (empName && !empId) {
        try {
          const { data: existingEmp } = await supabase
            .from('profiles')
            .select('id')
            .eq('name', empName)
            .maybeSingle();

          if (existingEmp) {
            empId = existingEmp.id;
          } else {
            const { data: newEmp, error: insertError } = await supabase
              .from('profiles')
              .insert({
                name: empName,
                role: 'employee',
                company_id: isSuperAdmin ? selectedCompanyId : user?.company_id,
                created_at: new Date().toISOString()
              })
              .select('id')
              .single();

            if (!insertError && newEmp) {
              empId = newEmp.id;
            }
          }
        } catch (error) {
          console.error("Error in marketer lookup/creation:", error);
        }
      }

      const formattedImages = (formData.images || []).map((img: any) => 
        typeof img === 'string' ? img : (img?.url || '')
      ).filter(Boolean);

      const data = {
        ...formData,
        images: formattedImages,
        company_id: isSuperAdmin ? selectedCompanyId : user?.companyId,
        assigned_employee_id: empId,
        assigned_employee_name: empName,
        updated_at: new Date().toISOString(),
        created_at: property ? property.created_at : new Date().toISOString(),
        created_by: property ? property.created_by : userId,
        status: isAdmin ? (property?.status || 'approved') : 'pending'
      };

      try {
        if (property) {
          const { data: updatedObj, error: updateError } = await supabase.from('properties').update(data).eq('id', property.id).select().single();
          if (updateError) throw updateError;
          
          const finalData = { ...updatedObj };

          const priceChanged = property.price !== data.price;
          const statusChanged = property.is_sold !== data.is_sold || property.status_label !== data.status_label;

          if (priceChanged || statusChanged) {
            const { data: favs, error: favsError } = await supabase
              .from('favorites')
              .select('user_id')
              .eq('property_id', property.id);

            if (favsError) throw favsError;

            const interestedUserIds = (favs || []).map(f => f.user_id);

            for (const recipientId of interestedUserIds) {
              if (recipientId === userId) continue;

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
                recipient_id: recipientId,
                user_id: userId,
                property_id: property.id,
                read: false,
                created_at: new Date().toISOString()
              });
            }
          }
        } else {
          const { data: insertedObj, error: insertError } = await supabase.from('properties').insert(data).select().single();
          if (insertError) throw insertError;
          
          const finalData = { ...insertedObj };
          
          toast.success('تمت إضافة العقار بنجاح');
          onSave(finalData);
          return;
        }
      } catch (error) {
        handleSupabaseError(error, property ? OperationType.UPDATE : OperationType.CREATE, 'properties');
      }
      toast.success('تم تحديث العقار بنجاح');
      onSave(property);
    } catch (error: any) {
      console.error("Error saving property:", error);
      let message = error.message;
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
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-emerald-600 border-b border-emerald-100 pb-2">
            <UserIcon size={20} />
            <h3 className="font-bold text-lg text-center">بيانات العميل</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative">
              <UserIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" size={18} />
              <input 
                type="text"
                autoComplete="off"
                placeholder="اسم العميل"
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

        <div className="space-y-6">
          <textarea 
            rows={4}
            placeholder="وصف إضافي وتفاصيل العقار..."
            className="w-full p-4 bg-stone-50 border border-stone-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm resize-none"
            value={formData.details}
            onChange={(e) => setFormData({...formData, details: e.target.value})}
          />
        </div>

        <div className="space-y-6">
          <div className="flex items-center gap-2 text-emerald-600 border-b border-emerald-100 pb-2">
            <ImageIcon size={20} />
            <h3 className="font-bold text-lg text-center">الصور والملفات</h3>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {(formData.images || []).map((img: any, idx: number) => (
              <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shadow-sm">
                {img.type === 'video' ? (
                  <video src={img.url} className="w-full h-full object-cover" />
                ) : (
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                )}
                <button 
                  type="button"
                  onClick={() => removeImage(idx)}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:bg-red-600"
                >
                  <X size={14} />
                </button>
                {img.type === 'video' && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <div className="w-8 h-8 bg-white/30 backdrop-blur-md rounded-full flex items-center justify-center text-white">
                      <Play size={16} fill="currentColor" />
                    </div>
                  </div>
                )}
              </div>
            ))}
            
            <label className="aspect-square rounded-xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-emerald-50 hover:border-emerald-300 transition-all group shadow-inner">
              <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-emerald-600 shadow-sm group-hover:scale-110 transition-transform">
                <Upload size={24} />
              </div>
              <span className="text-xs font-bold text-emerald-700">إضافة صور/فيديو</span>
              <input 
                type="file" 
                multiple 
                accept="image/*,video/*" 
                className="hidden" 
                onChange={handleImageUpload}
                disabled={isUploading}
              />
            </label>
          </div>
          
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-700">
                <div className="flex items-center gap-2">
                  <RefreshCw className="animate-spin" size={14} />
                  <span>جاري رفع ومعالجة الملفات...</span>
                </div>
                <span>{uploadProgress.current} من {uploadProgress.total}</span>
              </div>
              <div className="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                  className="bg-emerald-500 h-full"
                />
              </div>
            </div>
          )}
          <p className="text-[10px] text-stone-400">يمكنك رفع حتى 20 صورة أو فيديو للعقار الواحد.</p>
        </div>

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
            options={employees.map(emp => emp.name)}
            value={formData.assigned_employee_name}
            creatable={true}
            onChange={(val) => {
              const emp = employees.find(e => e.name === val);
              setFormData({
                ...formData,
                assigned_employee_id: emp ? emp.uid : '',
                assigned_employee_name: val
              });
            }}
          />
          
          <button
            type="button"
            onClick={() => {
              setFormData({
                ...formData,
                assigned_employee_id: user?.uid || '',
                assigned_employee_name: user?.name || ''
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

        <div className="flex gap-4 pt-8 border-t border-stone-100">
          <button
            type="submit"
            disabled={isSaving || isUploading}
            className="flex-1 bg-emerald-600 text-white py-4 rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:bg-stone-300 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
            ) : (
              <Plus size={20} />
            )}
            {property ? 'حفظ التعديلات' : 'إضافة العقار للنظام'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-stone-100 text-stone-600 py-4 rounded-2xl font-bold hover:bg-stone-200 transition-all"
          >
            إلغاء
          </button>
        </div>
      </form>

      <ConfirmModal 
        isOpen={showConfirm}
        title="تنبيه: بيانات ناقصة"
        message={`هناك بيانات أساسية ناقصة: (${missingFieldsList.join(', ')}). هل تريد الاستمرار وحفظ العقار رغم ذلك؟`}
        onConfirm={() => handleSubmit(null as any, true)}
        onCancel={() => setShowConfirm(false)}
        confirmText="نعم، احفظ على أي حال"
        confirmColor="bg-amber-600 hover:bg-amber-700"
      />
    </motion.div>
  );
});

const PropertyDetails = memo(function PropertyDetails({ property, user, onBack, isAdmin, isFavorite, onFavorite, onEdit, onDelete, onRestore, onPermanentDelete, onDeleteComment, onUserClick, onFilter }: any) {
  const [comments, setComments] = useState<PropertyComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentImages, setCommentImages] = useState<Array<{ url: string, type: 'image' | 'video' }>>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showViewer, setShowViewer] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!property.id) return;
    (async () => {
      try {
        const { data: commentsData } = await supabase.from('comments').select('*').eq('property_id', property.id).order('created_at', { ascending: false });
        setComments((commentsData || []) as PropertyComment[]);
        const channel = supabase.channel(`comments-${property.id}`).on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `property_id=eq.${property.id}` }, () => {
          supabase.from('comments').select('*').eq('property_id', property.id).order('created_at', { ascending: false }).then(({ data: updated }) => {
            setComments((updated || []) as PropertyComment[]);
          });
        }).subscribe();
        return () => { channel.unsubscribe(); };
      } catch (error) { console.error("Comments listener error:", error); }
    })();
  }, [property.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() && commentImages.length === 0) return;
    setIsUploading(true);
    try {
      await supabase.from('comments').insert({
        property_id: property.id,
        user_id: user.uid,
        user_name: user.name,
        user_phone: user.phone || '',
        text: newComment,
        images: commentImages,
        created_at: new Date().toISOString()
      });
      await supabase.from('properties').update({ last_comment: newComment || (commentImages.length > 0 ? 'تم إضافة صور' : '') }).eq('id', property.id);
      setNewComment('');
      setCommentImages([]);
      toast.success('تم إضافة التعليق بنجاح');
    } catch (error) { toast.error("حدث خطأ أثناء إضافة التعليق"); } finally { setIsUploading(false); }
  };

  const handleCommentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;

    setIsUploading(true);
    try {
      const chunks = [];
      for (let i = 0; i < files.length; i += 3) {
        chunks.push(files.slice(i, i + 3));
      }

      for (const chunk of chunks) {
        const uploadPromises = chunk.map(async (file) => {
          try {
            const fileToUpload = file.type.startsWith('image/') ? await compressImage(file) : file;
            const ext = file.type.startsWith('image/') ? 'jpg' : (file.name.split('.').pop() || 'mp4');
            const safeName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
            
            await supabase.storage
              .from('comment-images')
              .upload(`comments/${safeName}`, fileToUpload, {
                contentType: file.type.startsWith('image/') ? 'image/jpeg' : (file.type || 'video/mp4')
              });
              
            const { data: publicUrl } = supabase.storage
              .from('comment-images')
              .getPublicUrl(`comments/${safeName}`);

            const newImageData = { 
              url: publicUrl.publicUrl, 
              type: getMediaType(publicUrl.publicUrl, file.type) 
            };

            setCommentImages(prev => [...prev, newImageData]);
            return true;
          } catch (err) {
            console.error("Comment image upload error:", err);
            toast.error(`فشل رفع الملف: ${file.name}`);
            return false;
          }
        });
        await Promise.all(uploadPromises);
      }
    } catch (error) {
      console.error("Batch comment upload error:", error);
      toast.error("حدث خطأ أثناء رفع ملفات التعليق");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleShare = async () => {
    const shareData = { title: property.name || 'عقار', text: property.details, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else { await navigator.clipboard.writeText(window.location.href); toast.success('تم نسخ الرابط'); }
    } catch (err) { console.error('Error sharing:', err); }
  };

  const safeImages = Array.isArray(property.images) ? property.images : [];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {showViewer && <ImageViewer images={viewerImages} initialIndex={viewerIndex} onClose={() => setShowViewer(false)} isSold={property.is_sold} />}
      <div className="lg:col-span-2 space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 text-stone-500 hover:text-stone-900 font-bold p-2"><ChevronRight size={18} />العودة للقائمة</button>
          <div className="flex items-center gap-1">
            {isAdmin && (
              <div className="flex gap-1">
                <button onClick={onEdit} className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-full transition-all"><Edit size={18} /></button>
                <button onClick={onDelete} className="p-2.5 text-red-500 hover:bg-red-50 rounded-full transition-all"><Trash2 size={18} /></button>
              </div>
            )}
            <button onClick={handleShare} className="p-2.5 text-stone-600 hover:bg-stone-50 rounded-full transition-all"><Share2 size={18} /></button>
            <button onClick={onFavorite} className={`p-2.5 rounded-full transition-all ${isFavorite ? 'text-red-500 bg-red-50' : 'text-stone-600'}`}><Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} /></button>
          </div>
        </div>
        <div className="ios-card overflow-hidden">
          <div className="relative aspect-square bg-stone-50 group">
            {safeImages.length > 0 ? (
              <div 
                ref={galleryRef}
                className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scrollbar-none scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {safeImages.map((img: any, i: number) => {
                  const url = typeof img === 'string' ? img : (img?.url || '');
                  const isVideo = getMediaType(url) === 'video';
                  return (
                    <div 
                      key={i} 
                      className="w-full h-full flex-shrink-0 snap-center relative cursor-zoom-in"
                      onClick={() => { 
                        setViewerImages(safeImages.map((img: any) => typeof img === 'string' ? img : (img?.url || ''))); 
                        setViewerIndex(i); 
                        setShowViewer(true); 
                      }}
                    >
                      {isVideo ? (
                        <video src={url} controls className="w-full h-full object-contain bg-black" />
                      ) : (
                        <img src={url} alt="" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      )}
                      {property.is_sold && (
                        <div className="absolute inset-0 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm pointer-events-none z-10">
                          <span className="text-white font-black text-4xl transform -rotate-12 border-4 border-white px-6 py-2 rounded-xl shadow-2xl">مباع</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-stone-300">
                <ImageIcon size={48} />
              </div>
            )}
            
            {safeImages.length > 1 && (
              <>
                <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <button className="p-2 bg-white/80 rounded-full shadow-md pointer-events-auto"><ChevronRight size={20} /></button>
                  <button className="p-2 bg-white/80 rounded-full shadow-md pointer-events-auto"><ChevronLeft size={20} /></button>
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                  {safeImages.map((_: any, i: number) => (
                    <div key={i} className="w-1.5 h-1.5 rounded-full bg-white/50 shadow-sm" />
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-bold text-stone-900">{property.name || 'عقار بدون اسم'}</h1>
              <span className="text-emerald-600 font-black text-xl">{property.price}</span>
            </div>
            <div className="bg-stone-50 p-4 rounded-xl border border-stone-100 italic text-stone-700 leading-relaxed whitespace-pre-wrap mb-6">{property.details}</div>
            {safeImages.length > 1 && (
              <div className="grid grid-cols-5 sm:grid-cols-6 gap-2">
                {safeImages.map((img:any, i:number) => (
                  <button 
                    key={i} 
                    onClick={() => {
                      setActiveImageIndex(i);
                      const container = galleryRef.current;
                      if (container) {
                        const targetPos = container.offsetWidth * i;
                        container.scrollTo({ left: targetPos, behavior: 'smooth' });
                      }
                    }} 
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${i === activeImageIndex ? 'border-emerald-500 ring-2 ring-emerald-100' : 'border-transparent hover:border-emerald-200'}`}
                  >
                    <img src={typeof img === 'string' ? img : img.url} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="space-y-4">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
            <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
              <MessageSquare size={16} className="text-emerald-600" />
              التعليقات والملاحظات ({comments.length})
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {comments.map((comment) => (
              <div key={comment.id} className="bg-stone-50 p-3 rounded-xl">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs font-bold text-emerald-700" onClick={() => comment.user_id && onUserClick(comment.user_id)}>{comment.user_name}</span>
                  <span className="text-[10px] text-stone-400">{formatRelativeDate(comment.created_at || comment.createdAt)}</span>
                </div>
                <p className="text-sm text-stone-800">{comment.text}</p>
                {comment.images && comment.images.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {comment.images.map((img: any, idx: number) => (
                      <div key={idx} className="w-12 h-12 rounded border cursor-pointer" onClick={() => { setViewerImages(comment.images.map((i:any)=>i.url)); setViewerIndex(idx); setShowViewer(true); }}>
                        <img src={img.url} className="w-full h-full object-cover" alt="" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          <form onSubmit={handleAddComment} className="p-4 border-t border-stone-100">
            <textarea placeholder="أضف تعليقاً..." className="ios-input w-full text-sm h-20 resize-none mb-2" value={newComment} onChange={e => setNewComment(e.target.value)} />
            <div className="flex gap-2">
              <label className="flex-1 flex items-center justify-center gap-2 p-2 bg-stone-100 rounded-lg cursor-pointer text-xs font-bold text-stone-600">
                <ImageIcon size={14} /> إضافة صور
                <input type="file" multiple className="hidden" onChange={handleCommentImageUpload} accept="image/*,video/*" />
              </label>
              <button disabled={isUploading || (!newComment.trim() && commentImages.length === 0)} className="btn-primary flex-1">إرسال</button>
            </div>
            {commentImages.length > 0 && <div className="text-[10px] text-emerald-600 mt-1">تم اختيار {commentImages.length} ملفات</div>}
          </form>
      </div>
    </motion.div>
  );
});

// --- Components ---


function SyncModal({ isOpen, onClose, onSyncFrom, onSyncTo }: any) {
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [range, setRange] = useState('Sheet1!A1:Z5000');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  useEffect(() => {
    if (isOpen) {
      supabase
        .from('settings')
        .select('id,spreadsheet_id')
        .in('id', ['sync', '1'])
        .then(({ data, error }) => {
          if (error) { console.error(error); return; }
          const row = (data || []).find((r: any) => r.id === 'sync') || (data || [])[0];
          setSpreadsheetId(row?.spreadsheet_id || '');
        });

      (async () => {
        setLoadingHistory(true);
        try {
          const session = (await supabase.auth.getSession()).data.session;
          const token = session?.access_token;
          if (!token) {
            setHistory([]);
            return;
          }
          // Use absolute URL if needed or handle 404 gracefully
          const response = await fetch(`${API_BASE}/api/sync/history?limit=12`, {
            headers: { Authorization: `Bearer ${token}` }
          }).catch(() => null); // Silent fail for network errors
          
          if (response && response.ok) {
            const body = await response.json();
            setHistory(body?.data || []);
          } else {
            setHistory([]);
          }
        } catch (err) {
          console.error("Sync history fetch failed (background task):", err);
          setHistory([]);
        } finally {
          setLoadingHistory(false);
        }
      })();
    }
  }, [isOpen]);

  const handleRollback = async (snapshotId: string) => {
    try {
      const session = (await supabase.auth.getSession()).data.session;
      const idToken = session?.access_token;
      if (!idToken) return;
      const response = await fetch(`${API_BASE}/api/sync/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, snapshotId })
      });
      if (!response.ok) {
        throw new Error(await response.text());
      }
      toast.success('تم التراجع بنجاح');
      setHistory(prev => prev);
    } catch (e: any) {
      console.error(e);
      toast.error(`فشل التراجع: ${e.message}`);
    }
  };

  const handleSyncFrom = async (id: string, rng: string) => {
    const extractedId = extractSpreadsheetId(id);
    try {
      await supabase.from('settings').upsert([
        { id: 'sync', spreadsheet_id: extractedId },
        { id: '1', spreadsheet_id: extractedId }
      ], { onConflict: 'id' });
    } catch (err) {
      console.error(err);
    }
    onSyncFrom(extractedId, rng);
  };

  const handleSyncTo = async (id: string, rng: string) => {
    const extractedId = extractSpreadsheetId(id);
    try {
      await supabase.from('settings').upsert([
        { id: 'sync', spreadsheet_id: extractedId },
        { id: '1', spreadsheet_id: extractedId }
      ], { onConflict: 'id' });
    } catch (err) {
      console.error(err);
    }
    onSyncTo(extractedId, rng);
  };
  
  const handleCreateSheet = async () => {
    const title = prompt('أدخل اسم الملف الجديد:');
    if (!title) return;
    
    const session = (await supabase.auth.getSession()).data.session;
    const idToken = session?.access_token;
    if (!idToken) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/create-sheet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, title })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to create sheet');
      }
      const { spreadsheetId } = await response.json();
      setSpreadsheetId(spreadsheetId);
      try {
        await supabase.from('settings').upsert([
          { id: 'sync', spreadsheet_id: spreadsheetId },
          { id: '1', spreadsheet_id: spreadsheetId }
        ], { onConflict: 'id' });
      } catch (err) {
        console.error(err);
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
          value={spreadsheetId}
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
            onClick={() => handleSyncFrom(spreadsheetId, range)}
            className="flex-1 bg-emerald-600 text-white py-3 rounded-full font-bold hover:bg-emerald-700 transition-all"
          >
            مزامنة من الشيت
          </button>
          <button 
            onClick={() => handleSyncTo(spreadsheetId, range)}
            className="flex-1 bg-stone-600 text-white py-3 rounded-full font-bold hover:bg-stone-700 transition-all"
          >
            مزامنة إلى الشيت
          </button>
        </div>
        <div className="mb-3 max-h-48 overflow-auto rounded-lg border border-stone-200 p-3 bg-stone-50">
          <p className="text-xs font-bold text-stone-700 mb-2">سجل المزامنة (مع التراجع)</p>
          {loadingHistory ? (
            <p className="text-xs text-stone-500">جاري تحميل السجل...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-stone-500">لا يوجد سجل مزامنة بعد</p>
          ) : (
            <div className="space-y-2">
              {history.map((item: any) => (
                <div key={item.id} className="flex items-center justify-between gap-2 bg-white border border-stone-200 rounded-lg p-2">
                  <div className="text-[11px] text-stone-700">
                    <div>{item.direction} | {item.row_count || 0} صف</div>
                    <div className="text-stone-500">{new Date(item.created_at).toLocaleString('ar-KW')}</div>
                  </div>
                  <button
                    onClick={() => handleRollback(item.id)}
                    className="px-2 py-1 text-[11px] rounded bg-stone-700 text-white hover:bg-stone-800"
                  >
                    تراجع
                  </button>
                </div>
              ))}
            </div>
          )}
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

function ImageViewer({ images, initialIndex, onClose, isSold }: any) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handleNext = () => {
    setCurrentIndex((prev: number) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handlePrev = () => {
    setCurrentIndex((prev: number) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center overscroll-none" 
        onClick={onClose}
      >
        <div className="absolute top-6 right-6 flex gap-4 z-[130]">
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="text-white/70 hover:text-white p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all"
          >
            <X size={32} />
          </button>
        </div>

        {images.length > 1 && (
          <>
            <button 
              onClick={(e) => { e.stopPropagation(); handlePrev(); }}
              className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all z-[130] hidden md:block"
            >
              <ChevronLeft size={32} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleNext(); }}
              className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all z-[130] hidden md:block"
            >
              <ChevronRight size={32} />
            </button>
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex gap-2 z-[130]">
              {images.map((_: any, i: number) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentIndex ? 'w-6 bg-emerald-500' : 'w-1.5 bg-white/30'}`} />
              ))}
            </div>
          </>
        )}

        <div className="w-full h-full flex items-center justify-center relative touch-none" onClick={(e) => e.stopPropagation()}>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={currentIndex}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.4}
              onDragEnd={(_, info) => {
                const swipeThreshold = 50;
                if (info.offset.x < -swipeThreshold) handleNext();
                else if (info.offset.x > swipeThreshold) handlePrev();
              }}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-full h-full flex items-center justify-center p-4 relative"
            >
              {(() => {
                const img = images[currentIndex];
                if (!img) return null;
                const imgUrl = typeof img === 'string' ? img : (img?.url || '');
                const isVideo = getMediaType(imgUrl) === 'video';
                
                return isVideo ? (
                  <video 
                    src={imgUrl} 
                    controls 
                    autoPlay
                    className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl ${isSold ? 'grayscale opacity-60' : ''}`}
                  />
                ) : (
                  <img 
                    src={imgUrl} 
                    alt="" 
                    className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl ${isSold ? 'grayscale opacity-60' : ''}`}
                    referrerPolicy="no-referrer"
                  />
                );
              })()}
              {isSold && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                  <span className="text-white font-black text-6xl tracking-wider transform -rotate-12 border-4 border-white px-8 py-3 rounded-2xl shadow-2xl bg-stone-700/80 backdrop-blur-sm">مباع</span>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-xs font-bold bg-white/5 px-3 py-1.5 rounded-full backdrop-blur-sm">
          {currentIndex + 1} / {images.length}
        </div>
      </motion.div>
    </AnimatePresence>
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

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 mb-2">عذراً، حدث خطأ غير متوقع</h2>
            <p className="text-stone-600 mb-6">
              واجه التطبيق مشكلة تقنية. يرجى محاولة تحديث الصفحة أو العودة لاحقاً.
            </p>
            {this.state.error && (
              <div className="bg-stone-50 rounded-lg p-4 mb-6 text-left overflow-auto max-h-40">
                <code className="text-xs text-red-600 font-mono">
                  {this.state.error.toString()}
                </code>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              تحديث الصفحة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  // Memoize derived role values to prevent unnecessary listener re-registration
  const isSuperAdmin = useMemo(() =>
    user?.role === 'super_admin' || (user?.email && SUPER_ADMIN_EMAILS.includes(user.email)),
    [user?.role, user?.email]
  );
  const isAdmin = useMemo(() => user?.role === 'admin' || isSuperAdmin, [user?.role, isSuperAdmin]);
  const isEmployee = useMemo(() => user?.role === 'employee' || isAdmin, [user?.role, isAdmin]);
  const isPending = useMemo(() => user?.role === 'pending', [user?.role]);
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
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [tempSpreadsheetId, setTempSpreadsheetId] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
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
  const [appliedFilters, setAppliedFilters] = useState({
    query: '',
    governorate: '',
    area: '',
    type: '',
    purpose: '',
    location: '',
    marketer: '',
    status: ''
  });


  const [users, setUsers] = useState<UserProfile[]>([]);
  
  useEffect(() => {
    if (isAdmin) {
      (async () => {
        try {
          let query = supabase.from('profiles').select('*');

          if (isSuperAdmin) {
            if (selectedCompanyId) {
              query = query.eq('company_id', selectedCompanyId);
            }
          } else {
            query = query.eq('company_id', user?.companyId);
          }

          const { data: usersData, error } = await query;

          if (error) throw error;

          const mappedUsers = (usersData || []).map(doc => ({
            uid: doc.id,
            ...doc
          })) as UserProfile[];
          setEmployees(mappedUsers.filter(u => u.uid !== user?.uid));

          // Subscribe to changes
          const channel = supabase.channel('users-changes');
          channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'profiles' },
            () => {
              // Re-fetch on any change
              query.then(({ data: updated }) => {
                const updated_users = (updated || []).map(doc => ({
                  uid: doc.id,
                  ...doc
                })) as UserProfile[];
                setEmployees(updated_users.filter(u => u.uid !== user?.uid));
              });
            }
          ).subscribe();

          return () => { channel.unsubscribe(); };
        } catch (error) {
          console.error('Users fetch error:', error);
        }
      })();
    }
  }, [isAdmin, isSuperAdmin, selectedCompanyId, user?.companyId, user?.uid]);

  const [visibleCount, setVisibleCount] = useState(50);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState<number>(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; propertyId: string | null }>({
    isOpen: false,
    propertyId: null
  });
  const [userActionConfirm, setUserActionConfirm] = useState<{ 
    isOpen: boolean; 
    userId: string | null; 
    action: 'delete' | 'bulk-delete' | 'approve' | 'reject' | 'change-role' | null;
    extraData?: any;
  }>({
    isOpen: false,
    userId: null,
    action: null
  });
  const [accountDeleteConfirm, setAccountDeleteConfirm] = useState(false);
  const [commentDeleteConfirm, setCommentDeleteConfirm] = useState<{ isOpen: boolean; commentId: string | null; propertyId: string | null }>({
    isOpen: false,
    commentId: null,
    propertyId: null
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
    
    const propertyId = params.get('propertyId');
    if (propertyId && properties.length > 0) {
      const property = properties.find(p => p.id === propertyId);
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

  // Reset visible count when applied filters or view change
  useEffect(() => {
    setVisibleCount(50);
  }, [appliedFilters, view]);

  // Auth Listener
  useEffect(() => {
    console.log("Setting up Auth Listener...");

    const setupAuth = async () => {
      // Force loading to end after 5 seconds regardless of what happens
      const timeoutId = setTimeout(() => {
        console.log("Auth setup timed out, forcing UI to load...");
        setLoading(false);
      }, 5000);

      try {
        // Get initial session
        const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (initialSession?.user) {
          const sbUser = initialSession.user;
          console.log("Auth State Changed:", `User: ${sbUser.email}`);

          // Fetch user profile
          const { data: userData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sbUser.id)
            .maybeSingle();

          if (profileError) throw profileError;

          if (userData) {
            console.log("User profile found:", userData.role);

            // Check force sign out
            if (userData.force_sign_out) {
              await supabase.from('profiles').update({ force_sign_out: false }).eq('id', sbUser.id);
              setAuthError('تم تسجيل خروجك من قبل المسؤول.');
              await supabase.auth.signOut();
              setUser(null);
              setLoading(false);
              clearTimeout(timeoutId);
              return;
            }

            // Check if rejected
            if (userData.role === 'rejected') {
              setAuthError('تم رفض حسابك من قبل الإدارة.');
              await supabase.auth.signOut();
              setUser(null);
              setLoading(false);
              clearTimeout(timeoutId);
              return;
            }

            // Check if deleted
            if (userData.is_deleted) {
              setAuthError('هذا الحساب تم حذفه من قبل الإدارة.');
              await supabase.auth.signOut();
              setUser(null);
              setLoading(false);
              clearTimeout(timeoutId);
              return;
            }

            // Check for super admin email
            let profileData = userData;
            if (SUPER_ADMIN_EMAILS.includes(sbUser.email || '') && userData.role !== 'super_admin') {
              console.log("Super Admin email detected, updating role to super_admin...");
              await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', sbUser.id);
              profileData = { ...userData, role: 'super_admin' };
            }

            // Map Supabase snake_case to app camelCase
            const mappedUser: UserProfile = {
              uid: profileData.id,
              email: sbUser.email || '',
              name: profileData.name || 'User',
              role: profileData.role,
              companyId: profileData.company_id,
              createdAt: profileData.created_at,
              forceSignOut: profileData.force_sign_out,
              phone: profileData.phone
            };

            setUser(mappedUser);
            if (mappedUser.companyId) {
              setSelectedCompanyId(mappedUser.companyId);
            }
          } else {
            console.log("User profile not found, creating new profile...");
            const isSuper = SUPER_ADMIN_EMAILS.includes(sbUser.email || '');
            const role = isSuper ? 'super_admin' : 'pending';

            const newProfile = {
              id: sbUser.id,
              email: sbUser.email || '',
              name: sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'User',
              role: role,
              created_at: new Date().toISOString()
            };

            const { error: insertError } = await supabase.from('profiles').insert(newProfile);
            if (insertError) throw insertError;

            const mappedUser: UserProfile = {
              uid: newProfile.id,
              email: newProfile.email,
              name: newProfile.name,
              role: newProfile.role as UserProfile['role'],
              createdAt: newProfile.created_at
            };

            console.log("New user profile created successfully");
            if (role === 'pending') {
              await supabase.from('notifications').insert({
                type: 'new-user',
                title: 'طلب انضمام جديد',
                message: `المستخدم ${newProfile.name} يطلب الانضمام للنظام`,
                user_id: sbUser.id,
                read: false,
                created_at: new Date().toISOString()
              });
            }

            setUser(mappedUser);
          }
        } else {
          console.log("Auth State Changed: No User");
          setUser(null);
          setSelectedCompanyId(null);
        }
      } catch (error: any) {
        console.error("Auth initialization error:", error);
        setAuthError(`خطأ في الوصول لقاعدة البيانات: ${error.message}`);
        setUser(null);
      } finally {
        setLoading(false);
        clearTimeout(timeoutId);
      }
    };

    setupAuth();

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      try {
        if (session?.user) {
          const sbUser = session.user;
          const { data: userData, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sbUser.id)
            .maybeSingle();

          if (profileError) throw profileError;

          if (userData) {
            if (userData.force_sign_out) {
              await supabase.from('profiles').update({ force_sign_out: false }).eq('id', sbUser.id);
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

            if (userData.is_deleted) {
              setAuthError('هذا الحساب تم حذفه من قبل الإدارة.');
              await supabase.auth.signOut();
              setUser(null);
              return;
            }

            let profileData = userData;
            if (SUPER_ADMIN_EMAILS.includes(sbUser.email || '') && userData.role !== 'super_admin') {
              await supabase.from('profiles').update({ role: 'super_admin' }).eq('id', sbUser.id);
              profileData = { ...userData, role: 'super_admin' };
            }

            const mappedUser: UserProfile = {
              uid: profileData.id,
              email: sbUser.email || '',
              name: profileData.name || 'User',
              role: profileData.role,
              companyId: profileData.company_id,
              createdAt: profileData.created_at,
              forceSignOut: profileData.force_sign_out,
              phone: profileData.phone
            };

            setUser(mappedUser);
            if (mappedUser.companyId) {
              setSelectedCompanyId(mappedUser.companyId);
            }
          }
        } else {
          setUser(null);
          setSelectedCompanyId(null);
        }
      } catch (error: any) {
        console.error("Auth state change error:", error);
        setAuthError(`خطأ في الوصول لقاعدة البيانات: ${error.message}`);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  // Companies Listener (for Super Admin)
  useEffect(() => {
    if (!isSuperAdmin) {
      setCompanies([]);
      return;
    }

    (async () => {
      try {
        const { data: companiesData, error } = await supabase
          .from('companies')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        const companies = (companiesData || []).map(doc => ({
          id: doc.id,
          ...doc
        })) as Company[];
        setCompanies(companies);

        // Subscribe to changes
        const channel = supabase.channel('companies-changes');
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'companies' },
          () => {
            // Re-fetch on any change
            supabase
              .from('companies')
              .select('*')
              .order('created_at', { ascending: false })
              .then(({ data: updated }) => {
                const updated_companies = (updated || []).map(doc => ({
                  id: doc.id,
                  ...doc
                })) as Company[];
                setCompanies(updated_companies);
              });
          }
        ).subscribe();

        return () => { channel.unsubscribe(); };
      } catch (err) {
        console.error('Companies fetch error:', err);
        handleSupabaseError(err, OperationType.GET, 'companies');
      }
    })();
  }, [isSuperAdmin]);

  // Properties Listener
  useEffect(() => {
    if (!user) return;

    const fetchAllProperties = async () => {
      try {
        let allPropsData: any[] = [];
        let from = 0;
        const step = 1000;
        let fetchMore = true;

        while (fetchMore) {
          let query = supabase.from('properties').select('*');

          if (isSuperAdmin) {
            if (selectedCompanyId) {
              query = query.eq('company_id', selectedCompanyId);
            }
          } else if (user.companyId) {
            query = query.eq('company_id', user.companyId);
          } else {
            setProperties([]);
            return;
          }

          const { data, error } = await query
            .order('created_at', { ascending: false })
            .range(from, from + step - 1);

          if (error) throw error;
          
          if (data && data.length > 0) {
            allPropsData = [...allPropsData, ...data];
            from += step;
            if (data.length < step) fetchMore = false;
          } else {
            fetchMore = false;
          }
        }

        const allProps = allPropsData.map(data => ({
          id: data.id,
          ...data,
          location: data.location === 'شارع واحد | سد' ? 'شارع واحد' : data.location
        } as Property));

        const now = Date.now();
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

        const deleted = allProps.filter(p => p.status === 'deleted');
        const active = allProps.filter(p => p.status !== 'deleted');

        setProperties(active);
        setDeletedProperties(deleted);

        if (isAdmin) {
          deleted.forEach(async (p) => {
            const deletedAtField = (p as any).deleted_at || p.deletedAt;
            if (deletedAtField) {
              const deletedTime = new Date(deletedAtField).getTime();
              if (now - deletedTime > thirtyDaysMs) {
                try {
                  await supabase.from('properties').delete().eq('id', p.id);
                } catch (e) {
                  console.error("Failed to auto-delete old property", e);
                }
              }
            }
          });
        }
      } catch (error) {
        console.error("Properties fetch error:", error);
      }
    };

    (async () => {
      await fetchAllProperties();

      // Subscribe to changes
      const channel = supabase.channel('properties-changes');
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        (payload: any) => {
          if (payload.eventType === 'INSERT') {
            const newProp = {
              id: payload.new.id,
              ...payload.new,
              location: payload.new.location === 'شارع واحد | سد' ? 'شارع واحد' : payload.new.location
            } as Property;

            // Check if it belongs to current filter (company)
            const matchesCompany = isSuperAdmin ? (!selectedCompanyId || newProp.company_id === selectedCompanyId) : (newProp.company_id === user.companyId);
            
            if (matchesCompany) {
              if (newProp.status === 'deleted') {
                setDeletedProperties(prev => [newProp, ...prev]);
              } else {
                setProperties(prev => [newProp, ...prev]);
              }
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedProp = {
              id: payload.new.id,
              ...payload.new,
              location: payload.new.location === 'شارع واحد | سد' ? 'شارع واحد' : payload.new.location
            } as Property;

            // Update in properties or deletedProperties
            if (updatedProp.status === 'deleted') {
              setProperties(prev => prev.filter(p => p.id !== updatedProp.id));
              setDeletedProperties(prev => {
                const exists = prev.find(p => p.id === updatedProp.id);
                if (exists) return prev.map(p => p.id === updatedProp.id ? updatedProp : p);
                return [updatedProp, ...prev];
              });
            } else {
              setDeletedProperties(prev => prev.filter(p => p.id !== updatedProp.id));
              setProperties(prev => {
                const exists = prev.find(p => p.id === updatedProp.id);
                if (exists) return prev.map(p => p.id === updatedProp.id ? updatedProp : p);
                return [updatedProp, ...prev];
              });
            }
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setProperties(prev => prev.filter(p => p.id !== deletedId));
            setDeletedProperties(prev => prev.filter(p => p.id !== deletedId));
          }
        }
      ).subscribe();

      return () => { channel.unsubscribe(); };
    })();
  }, [user, isSuperAdmin, selectedCompanyId]);

  // Notifications Listener
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        let query = supabase.from('notifications').select('*');

        if (isSuperAdmin) {
          // Super admin sees all
          query = query.order('created_at', { ascending: false }).limit(50);
        } else if (user.role === 'admin') {
          // Company admins see notifications for their company
          query = query.eq('company_id', user.companyId).order('created_at', { ascending: false }).limit(50);
        } else {
          // Regular users see notifications where they are the recipient
          query = query.eq('recipient_id', user.uid).order('created_at', { ascending: false }).limit(50);
        }

        const { data: notificationsData, error } = await query;

        if (error) throw error;

        const allNotifications = (notificationsData || []).map(doc => ({
          id: doc.id,
          ...doc
        })) as Notification[];
        setNotifications(allNotifications);

        // Subscribe to changes
        const channel = supabase.channel('notifications-changes');
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications' },
          () => {
            // Re-fetch on any change
            query.then(({ data: updated }) => {
              const updated_notifs = (updated || []).map(doc => ({
                id: doc.id,
                ...doc
              })) as Notification[];
              setNotifications(updated_notifs);
            });
          }
        ).subscribe();

        return () => { channel.unsubscribe(); };
      } catch (err) {
        console.error('Notifications fetch error:', err);
        handleSupabaseError(err, OperationType.GET, 'notifications');
      }
    })();
  }, [user]);

  // Favorites Listener
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        const { data: favoritesData, error } = await supabase
          .from('favorites')
          .select('property_id')
          .eq('user_id', user.uid);

        if (error) throw error;

        setFavorites((favoritesData || []).map(doc => doc.property_id));

        // Subscribe to changes
        const channel = supabase.channel('favorites-changes');
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'favorites' },
          () => {
            supabase
              .from('favorites')
              .select('property_id')
              .eq('user_id', user.uid)
              .then(({ data: updated }) => {
                setFavorites((updated || []).map(doc => doc.property_id));
              });
          }
        ).subscribe();

        return () => { channel.unsubscribe(); };
      } catch (error) {
        console.error("Favorites listener error:", error);
      }
    })();
  }, [user]);

  // All Users Listener (for Admin Management) - REMOVED, consolidated above

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setIsAuthenticating(true);
    try {
      const generatedEmail = usernameToEmail(username);
      if (authMode === 'register') {
        // Call server endpoint to create user with service role
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token || '';

        const response = await fetch(`${API_BASE}/api/admin/create-user`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: generatedEmail,
            password: password,
            username: username,
            idToken: token
          })
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'Failed to create user');
        }

        const result = await response.json();
        const userId = result.user?.id;

        if (userId) {
          // Create user profile in Supabase
          const role = SUPER_ADMIN_EMAILS.includes(generatedEmail) ? 'super_admin' : 'pending';
          const newProfile = {
            id: userId,
            email: generatedEmail,
            name: username,
            role: role,
            created_at: new Date().toISOString()
          };

          const { error: profileError } = await supabase.from('profiles').insert(newProfile);
          if (profileError) throw profileError;

          if (role === 'pending') {
            await supabase.from('notifications').insert({
              type: 'new-user',
              title: 'طلب انضمام جديد',
              message: `المستخدم ${username} يطلب الانضمام للنظام`,
              user_id: userId,
              read: false,
              created_at: new Date().toISOString()
            });
          }

          const userData: UserProfile = {
            uid: userId,
            email: generatedEmail,
            name: username,
            role: role,
            created_at: new Date().toISOString()
          };
          setUser(userData);
        }

        // Sign in the user
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: generatedEmail,
          password: password
        });
        if (signInError) throw signInError;
      } else {
        // Sign in
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: generatedEmail,
          password: password
        });
        if (signInError) throw signInError;
      }
    } catch (error: any) {
      console.error("Email auth failed", error);
      let message = `خطأ: ${error.message || "حدث خطأ أثناء تسجيل الدخول"}`;
      if (error.message?.includes('invalid') || error.message?.includes('wrong')) {
        message = "اسم المستخدم أو كلمة المرور غير صحيحة، أو الحساب غير موجود. تأكد من اختيار 'إنشاء حساب' إذا كنت تسجل لأول مرة.";
      } else if (error.message?.includes('already')) {
        message = "هذا المستخدم مسجل بالفعل. جرب تسجيل الدخول بدلاً من إنشاء حساب جديد.";
      } else if (error.message?.includes('weak')) {
        message = "كلمة المرور ضعيفة جداً. يجب أن تكون 6 أحرف على الأقل.";
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
    setAccountDeleteConfirm(true);
  };

  const confirmAccountDelete = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    setIsAuthenticating(true);
    try {
      const userUid = session.user.id;

      // Call server endpoint to delete user with service role
      const response = await fetch(`${API_BASE}/api/admin/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userUid,
          idToken: session.access_token
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete user');
      }

      // Delete profile from profiles table
      await supabase.from('profiles').delete().eq('id', userUid);

      toast.success("تم حذف الحساب بنجاح. يمكنك الآن إعادة التسجيل.");
      await supabase.auth.signOut();
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
    const governorates = new Set<string>();
    const areas = new Set<string>();
    const types = new Set<string>();
    const purposes = new Set<string>();
    const locations = new Set<string>();
    const marketers = new Set<string>();

    properties.forEach(p => {
      if (p.governorate) governorates.add(p.governorate);
      
      if (p.area) {
        if (!filters.governorate || p.governorate === filters.governorate) {
          areas.add(p.area);
        }
      }
      
      if (p.type) types.add(p.type);
      if (p.purpose) purposes.add(p.purpose);
      if (p.location) locations.add(p.location);
      if (p.assignedEmployeeName) marketers.add(p.assignedEmployeeName);
    });

    return {
      governorates: Array.from(governorates).sort(),
      areas: Array.from(areas).sort(),
      types: Array.from(types).sort(),
      purposes: Array.from(purposes).sort(),
      locations: Array.from(locations).sort(),
      marketers: Array.from(marketers).sort()
    };
  }, [properties, filters.governorate]);

  const filteredProperties = useMemo(() => {
    const sourceProperties = view === 'trash' ? deletedProperties : properties;
    return sourceProperties.filter(p => {
      // View specific filtering
      if (view === 'my-listings' && p.created_by !== user?.uid) return false;
      if (view === 'my-favorites' && !favorites.includes(p.id)) return false;
      if (view === 'user-listings' && selectedMarketerId && p.assigned_employee_id !== selectedMarketerId) return false;
      if (view === 'pending-properties' && p.status !== 'pending') return false;
      
      const { query, governorate, area, type, purpose, location, marketer, status } = appliedFilters;
      
      const matchesSearch = 
        searchMatch(p.name, query) || 
        searchMatch(p.phone, query) || 
        searchMatch(p.phone_2 || '', query) ||
        searchMatch(p.area, query) || 
        searchMatch(p.sector || '', query) ||
        searchMatch(p.block || '', query) ||
        searchMatch(p.plot_number || '', query) ||
        searchMatch(p.house_number || '', query) ||
        searchMatch(p.id, query) ||
        searchMatch(p.assigned_employee_name || '', query);
      
      const matchesGov = !governorate || p.governorate === governorate;
      const matchesArea = !area || p.area === area;
      const matchesType = !type || p.type === type;
      const matchesPurpose = !purpose || p.purpose === purpose;
      const matchesLocation = !location || p.location === location;
      const matchesMarketer = !marketer || p.assigned_employee_name === marketer;
      const matchesStatus = !status || 
                           (status === 'sold' && p.is_sold) || 
                           (status === 'available' && !p.is_sold);

      // Only show results if search has been performed, unless in specific management views
      const isManagementView = view === 'pending-properties' || view === 'trash' || view === 'my-favorites';
      if (!hasSearched && !isManagementView) return false;

      return matchesSearch && matchesGov && matchesArea && matchesType && matchesPurpose && matchesLocation && matchesMarketer && matchesStatus;
    }).sort((a, b) => {
      const dateA = a.createdAt?.seconds || 0;
      const dateB = b.createdAt?.seconds || 0;
      return dateB - dateA;
    });
  }, [properties, deletedProperties, appliedFilters, favorites, user, view, selectedMarketerId]);

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

  const handleSyncFrom = async (spreadsheetId: string, range: string) => {
    const session = (await supabase.auth.getSession()).data.session;
    const idToken = session?.access_token;
    if (!idToken) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/sync/auto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, spreadsheetId, range })
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Sync failed');
      }
      toast.success('تمت المزامنة من الشيت بنجاح');
      setIsSyncModalOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error(`حدث خطأ أثناء المزامنة من الشيت: ${e.message}`);
    }
  };

  const handleSyncTo = async (id: string, rng: string) => {
    const extractedId = extractSpreadsheetId(id);
    const targetSpreadsheetId = extractedId || spreadsheetId;
    if (extractedId && extractedId !== spreadsheetId) setSpreadsheetId(extractedId);
    if (!targetSpreadsheetId) {
      toast.error('يرجى حفظ رابط الشيت أولاً');
      return;
    }
    const session = (await supabase.auth.getSession()).data.session;
    const idToken = session?.access_token;
    if (!idToken) return;
    
    try {
      const response = await fetch(`${API_BASE}/api/sync/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, spreadsheetId: targetSpreadsheetId, range: rng })
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

  // --- Actions ---

  async function toggleFavorite(propertyId: string) {
    if (!user) return;
    const isFav = favorites.includes(propertyId);
    if (isFav) {
      try {
        const { data: favs } = await supabase
          .from('favorites')
          .select('id')
          .eq('user_id', user.uid)
          .eq('property_id', propertyId);

        const deletePromises = (favs || []).map(fav =>
          supabase.from('favorites').delete().eq('id', fav.id)
        );
        await Promise.all(deletePromises);
      } catch (error) {
        console.error("Error removing favorite:", error);
      }
    } else {
      try {
        await supabase.from('favorites').insert({
          user_id: user.uid,
          property_id: propertyId,
          created_at: new Date().toISOString()
        });
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

      const tablesToBackup = ['properties', 'profiles', 'comments', 'companies', 'notifications'];

      for (const tableName of tablesToBackup) {
        const { data: tableData } = await supabase.from(tableName).select('*');
        backupData[tableName] = tableData || [];
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
      await supabase.from('properties').update({
        status: 'approved',
        deleted_at: null
      }).eq('id', id);
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
        const { data: propertyData } = await supabase.from('properties').select('*').eq('id', id).single();
        
        if (propertyData?.images && propertyData.images.length > 0) {
          const filesToDelete = propertyData.images
            .map((img: any) => {
              const url = typeof img === 'string' ? img : img.url;
              if (url && url.includes('properties/')) {
                return `properties/${url.split('properties/')[1]}`;
              }
              return null;
            })
            .filter(Boolean);

          if (filesToDelete.length > 0) {
            await supabase.storage.from('properties_media').remove(filesToDelete);
          }
        }

        await supabase.from('properties').delete().eq('id', id);
        toast.success('تم حذف العقار نهائياً');
      } catch (error) {
        console.error("Error permanently deleting property:", error);
        toast.error("حدث خطأ أثناء محاولة حذف العقار نهائياً");
      }
    }
  }

  async function confirmDelete() {
    if (!deleteConfirm.propertyId) return;
    try {
      await supabase.from('properties').update({
        status: 'trash',
        deleted_at: new Date().toISOString()
      }).eq('id', deleteConfirm.propertyId);
      toast.success('تم نقل العقار إلى سلة المهملات');
      setDeleteConfirm({ isOpen: false, propertyId: null });
    } catch (error) {
      console.error("Error deleting property:", error);
      toast.error("حدث خطأ أثناء محاولة حذف العقار");
    }
  }

  async function confirmUserAction() {
    if (!userActionConfirm.userId || !userActionConfirm.action) return;
    try {
      if (userActionConfirm.action === 'approve') {
        const { error } = await supabase.from('profiles').update({ role: 'employee' }).eq('id', userActionConfirm.userId);
        if (error) throw error;
        toast.success('تمت الموافقة على المستخدم بنجاح');
      } else if (userActionConfirm.action === 'reject') {
        const { error } = await supabase.from('profiles').delete().eq('id', userActionConfirm.userId);
        if (error) throw error;
        toast.success('تم رفض وحذف طلب الانضمام');
      } else if (userActionConfirm.action === 'change-role') {
        const { error } = await supabase.from('profiles').update({ role: userActionConfirm.extraData.newRole }).eq('id', userActionConfirm.userId);
        if (error) throw error;
        toast.success('تم تغيير الصلاحية بنجاح');
      } else if (userActionConfirm.action === 'delete') {
        const { error } = await supabase.from('profiles').delete().eq('id', userActionConfirm.userId);
        if (error) throw error;
        toast.success('تم حذف المستخدم بنجاح');
      }
    } catch (error) {
      console.error("Error in user action:", error);
      toast.error("حدث خطأ أثناء تنفيذ الإجراء");
    } finally {
      setUserActionConfirm({ isOpen: false, userId: null, action: null });
    }
  }

  async function confirmCommentDelete() {
    if (!commentDeleteConfirm.commentId) return;
    try {
      await supabase.from('comments').delete().eq('id', commentDeleteConfirm.commentId);
      toast.success('تم حذف التعليق بنجاح');
    } catch (error) {
      console.error("Error deleting comment:", error);
      toast.error("حدث خطأ أثناء حذف التعليق");
    } finally {
      setCommentDeleteConfirm({ isOpen: false, commentId: null, propertyId: null });
    }
  }

  // Helper function for property titles
  function generatePropertyTitle(p: any) {
    if (!p) return 'عقار';
    return `${p.type || ''} - ${p.area || ''} ${p.block ? `ق${p.block}` : ''}`.trim();
  }

  // Helper for area names
  function cleanAreaName(name: string) {
    if (!name) return '';
    return name.replace('منطقة ', '').trim();
  }

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-stone-900 font-sans" dir="rtl">
      <SyncModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)} 
        onSyncFrom={handleSyncFrom}
        onSyncTo={handleSyncTo}
      />
      {/* Drawer Overlay */}
      {/* Image Preview Modal */}
      {previewImages.length > 0 && (
        <ImageViewer 
          images={previewImages} 
          initialIndex={previewIndex} 
          onClose={() => setPreviewImages([])} 
        />
      )}

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
                    <p className="font-bold text-stone-900">{user.name}</p>
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
                        if (!spreadsheetId) {
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
                              await supabase.from('settings').upsert([
                                { id: 'sync', spreadsheet_id: extractedId },
                                { id: '1', spreadsheet_id: extractedId }
                              ], { onConflict: 'id' });
                              setSpreadsheetId(extractedId);
                              toast.success('تم حفظ الرابط');
                            } catch (err) {
                              console.error(err);
                              toast.error('تعذر حفظ رابط الشيت');
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
              <p className="text-sm font-semibold">{user.name}</p>
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
              <div className="bg-white/40 backdrop-blur-xl border border-white/40 p-5 rounded-2xl shadow-xl shadow-stone-200/50 w-full space-y-4">
                {/* Search Bar Row: 2/3 Input, 1/3 Button */}
                <div className="flex flex-col md:flex-row gap-3">
                  <div className="flex-[2] relative bg-white/70 backdrop-blur-md border border-stone-200 rounded-xl focus-within:border-emerald-500 focus-within:ring-4 focus-within:ring-emerald-500/10 transition-all flex items-center p-2 px-4 min-h-[52px] shadow-sm hover:border-stone-300">
                    <div className="flex flex-1 items-center gap-2 cursor-text">
                      <Search className="text-stone-500 ml-1 shrink-0" size={18} />
                      
                      {Object.entries(filters).filter(([_, val]) => val !== '').slice(0, 2).map(([key, value]) => (
                        <span key={key} className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-bold whitespace-nowrap shadow-sm">
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

                      {Object.entries(filters).filter(([_, val]) => val !== '').length > 2 && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                          +{Object.entries(filters).filter(([_, val]) => val !== '').length - 2}
                        </span>
                      )}

                      <div className="flex-1 flex items-center relative min-w-[150px]">
                        <div className={`flex items-center w-full transition-all duration-300 ${searchQuery ? 'bg-emerald-50 rounded-lg border border-emerald-100 px-2' : ''}`}>
                          <input 
                            id="main-search-input"
                            type="text"
                            placeholder={!searchQuery ? "ابحث بالاسم، الرقم، أو المنطقة..." : ""}
                            className={`w-full bg-transparent border-none outline-none text-sm py-1.5 transition-all ${searchQuery ? 'font-bold text-emerald-700' : 'text-stone-600'}`}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(normalizeDigits(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                setAppliedFilters({ ...filters, query: searchQuery });
                                setHasSearched(true);
                              }
                            }}
                          />
                          {searchQuery && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery('');
                              }}
                              className="ml-1 text-emerald-400 hover:text-emerald-600 p-1 flex-shrink-0"
                              title="مسح البحث"
                            >
                              <X size={14} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* MASTER SEARCH BUTTON - 1/3 Width */}
                  <button
                    onClick={() => {
                      setAppliedFilters({ ...filters, query: searchQuery });
                      setHasSearched(true);
                    }}
                    className="flex-1 bg-emerald-500 text-white py-3 px-6 rounded-xl hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-200/50 flex items-center justify-center gap-2 min-h-[52px]"
                    title="بحث"
                  >
                    <Search size={20} />
                    <span className="font-bold">بحث</span>
                  </button>
                </div>

                {/* Secondary Actions Row */}
                <div className="flex items-center justify-between gap-3 border-t border-stone-100/50 pt-2">
                  <button
                    onClick={() => {
                      const emptyFilters = {
                        governorate: '',
                        area: '',
                        type: '',
                        purpose: '',
                        location: '',
                        marketer: '',
                        status: ''
                      };
                      setFilters(emptyFilters);
                      setSearchQuery('');
                      setAppliedFilters({ ...emptyFilters, query: '' });
                      setHasSearched(false);
                    }}
                    className="px-4 py-2 text-xs font-bold text-stone-400 hover:text-emerald-600 transition-colors uppercase tracking-widest flex items-center gap-2 whitespace-nowrap"
                  >
                    <RefreshCw size={14} className="animate-hover" />
                    مسح الكل
                  </button>

                  <button
                    onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                    className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-sm whitespace-nowrap ${showAdvancedSearch ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100'}`}
                  >
                    <Filter size={16} />
                    البحث الدقيق
                    {showAdvancedSearch ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                {/* Advanced Search Section (Dropdowns) */}
                <AnimatePresence>
                  {showAdvancedSearch && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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

                        {availableFilterOptions.locations.length > 0 && (
                          <SearchableFilter
                            placeholder="الموقع..."
                            options={availableFilterOptions.locations}
                            value={filters.location}
                            onChange={(val) => setFilters({...filters, location: val})}
                          />
                        )}

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
                      
                      <div className="mt-4 flex flex-col sm:flex-row gap-2">
                        <button 
                          onClick={() => {
                            setAppliedFilters({ ...filters, query: searchQuery });
                            setHasSearched(true);
                            setShowAdvancedSearch(false);
                          }}
                          className="flex-1 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-100"
                        >
                          <Search size={18} />
                          تطبيق البحث
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions & Results Header */}
              <div className="flex justify-center items-center">
                <h2 className="text-2xl font-bold serif text-center">
                  {view === 'pending-properties' ? `عقارات قيد المراجعة (${filteredProperties.length})` : 
                   view === 'trash' ? `سلة المحذوفات (${filteredProperties.length})` : 
                   !hasSearched ? 'ابحث عن عقار...' :
                   (appliedFilters.query || appliedFilters.governorate || appliedFilters.area || appliedFilters.type || appliedFilters.purpose || appliedFilters.location || appliedFilters.marketer || appliedFilters.status
                    ? `نتائج البحث (${filteredProperties.length})` 
                    : `${view === 'list' ? 'كل العقارات' : view === 'my-listings' ? 'إعلاناتي' : view === 'my-favorites' ? 'إعلاناتي المفضلة' : `عقارات ${employees.find(emp => emp.uid === selectedMarketerId)?.name || 'المستخدم'}`} (${filteredProperties.length})`)}
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
                          await supabase.from('properties').update({ status: 'approved' }).eq('id', id);
                          toast.success('تم قبول العقار');
                        }}
                        onReject={async (id: string) => {
                          await supabase.from('properties').update({ status: 'rejected' }).eq('id', id);
                          toast.success('تم رفض العقار');
                        }}
                        onEdit={(p: any) => {
                          setSelectedProperty(p);
                          setView('edit');
                        }}
                        onDelete={(id: string) => {
                          setDeleteConfirm({ isOpen: true, propertyId: id });
                        }}
                        onRestore={restoreProperty}
                        onPermanentDelete={permanentDeleteProperty}
                        view={view}
                        onFilter={(key: string, value: string) => {
                          setFilters(prev => ({ ...prev, [key]: value }));
                          setSearchQuery('');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        onUserClick={(userId: string) => {
                          setSelectedMarketerId(userId);
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
                <div className="bg-white/60 backdrop-blur-md p-16 rounded-2xl border border-white/40 text-center space-y-6 shadow-xl shadow-stone-200/50">
                  <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-inner">
                    <Search size={40} />
                  </div>
                  <div className="space-y-2 max-w-sm mx-auto">
                    {!hasSearched ? (
                      <>
                        <h3 className="font-bold text-stone-900 text-xl text-center">ابدأ البحث الآن</h3>
                        <p className="text-stone-500 leading-relaxed">أدخل الاسم، الرقم، أو استخدم البحث الدقيق للعثور على العقارات المطلوبة.</p>
                      </>
                    ) : (
                      <>
                        <h3 className="font-bold text-stone-900 text-xl text-center">لا توجد نتائج</h3>
                        <p className="text-stone-500 leading-relaxed">لم نجد أي عقارات تطابق معايير البحث الحالية. جرب تغيير كلمات البحث أو الفلاتر.</p>
                      </>
                    )}
                  </div>
                  {!hasSearched && (
                    <div className="pt-4">
                       <button 
                        onClick={() => {
                          setAppliedFilters({ ...filters, query: searchQuery });
                          setHasSearched(true);
                        }}
                        className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
                       >
                         عرض كل العقارات
                       </button>
                    </div>
                  )}
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
                onSave={(savedData: any) => {
                  if (savedData && savedData.id) {
                    setProperties((prev: Property[]) => {
                      const exists = prev.find(p => p.id === savedData.id);
                      if (exists) {
                        return prev.map(p => p.id === savedData.id ? { ...p, ...savedData } : p);
                      }
                      return [{ ...savedData, location: savedData.location === 'شارع واحد | سد' ? 'شارع واحد' : savedData.location } as Property, ...prev];
                    });
                  }
                  setView('list');
                }}
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
                          } else {
                            const propertyId = (n as any).property_id || n.propertyId;
                            if (propertyId) {
                              const prop = properties.find(p => p.id === propertyId);
                              if (prop) {
                                setSelectedProperty(prop);
                                setView('details');
                              }
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
                            <p className="text-xs text-stone-500 mt-2">{formatRelativeDate(n.createdAt)}</p>
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
                      const companyId = (form.elements.namedItem('companyId') as HTMLInputElement).value;
                      const address = (form.elements.namedItem('companyAddress') as HTMLInputElement).value;
                      const phone = (form.elements.namedItem('companyPhone') as HTMLInputElement).value;
                      
                      if (companyId.length !== 4) {
                        toast.error('يجب أن يكون كود الشركة مكوناً من 4 خانات');
                        return;
                      }

                      try {
                        await supabase.from('companies').insert({
                          name,
                          company_id: companyId,
                          address,
                          phone,
                          created_at: new Date().toISOString()
                        });
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
                      <input name="companyId" placeholder="مثال: A1B2" maxLength={4} className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm font-mono" required />
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
                                    await supabase.from('companies').delete().eq('id', company.id);
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
                            await supabase.from('companies').update({
                              name,
                              phone,
                              address
                            }).eq('id', editingCompany.id);
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
                            const generatedEmail = email || usernameToEmail(username);

                            // Check if user already exists
                            const { data: existingUsers } = await supabase
                              .from('profiles')
                              .select('*')
                              .eq('email', generatedEmail);

                            if (existingUsers && existingUsers.length > 0) {
                              toast.error('هذا المستخدم مسجل بالفعل.');
                              return;
                            }

                            // Get session for creating user via API
                            const { data: { session } } = await supabase.auth.getSession();
                            const token = session?.access_token || '';

                            // Create user via admin API endpoint
                            const response = await fetch(`${API_BASE}/api/admin/create-user`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                email: generatedEmail,
                                password: password,
                                username: username,
                                companyId: targetCompanyForUser.id,
                                role: role,
                                idToken: token
                              })
                            });

                            if (!response.ok) {
                              const error = await response.json();
                              throw new Error(error.message || 'Failed to create user');
                            }

                            const result = await response.json();
                            const userId = result.user?.id;

                            if (userId) {
                              // Create user profile in Supabase
                              await supabase.from('profiles').insert({
                                id: userId,
                                email: generatedEmail,
                                name: username,
                                role: role,
                                company_id: targetCompanyForUser.id,
                                phone: phone || '',
                                created_at: new Date().toISOString()
                              });
                            }

                            toast.success('تمت إضافة المستخدم بنجاح.');
                            setIsAddingUserToCompany(false);
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
                        const generatedEmail = email || usernameToEmail(username);

                        // Check if user already exists
                        const { data: existingUsers } = await supabase
                          .from('profiles')
                          .select('*')
                          .eq('email', generatedEmail);

                        if (existingUsers && existingUsers.length > 0) {
                          toast.error('هذا المستخدم مسجل بالفعل.');
                          return;
                        }

                        // Get session for creating user via API
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token || '';
                        const companyId = isSuperAdmin ? (form.elements.namedItem('companyId') as HTMLSelectElement).value : user?.companyId;

                        // Create user via admin API endpoint
                        const response = await fetch(`${API_BASE}/api/admin/create-user`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: generatedEmail,
                            password: password,
                            username: username,
                            companyId: companyId,
                            role: role,
                            idToken: token
                          })
                        });

                        if (!response.ok) {
                          const error = await response.json();
                          throw new Error(error.message || 'Failed to create user');
                        }

                        const result = await response.json();
                        const userId = result.user?.id;

                        if (userId) {
                          // Create user profile in Supabase
                          await supabase.from('profiles').insert({
                            id: userId,
                            email: generatedEmail,
                            name: username,
                            role: role,
                            company_id: companyId,
                            phone: phone || '',
                            created_at: new Date().toISOString()
                          });
                        }

                        toast.success('تمت إضافة المستخدم بنجاح.');
                        form.reset();
                      } catch (err: any) {
                        toast.error('حدث خطأ: ' + err.message);
                      }
                    }}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    {isSuperAdmin && (
                      <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-stone-400 uppercase tracking-wider px-1">الشركة</label>
                        <select name="companyId" className="w-full p-3 rounded-xl bg-stone-50/50 border border-stone-200 outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm appearance-none" required>
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
                        setUserActionConfirm({ isOpen: true, userId: null, action: 'bulk-delete' });
                      }}
                      className="text-xs text-red-500 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-bold"
                    >
                      حذف الكل
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3">
                    {employees.map(emp => (
                      <div key={emp.uid} className="ios-glass p-4 rounded-2xl border border-white/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm group hover:shadow-md transition-all">
                        <div className="flex items-center gap-4 flex-1">
                          <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center text-stone-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors shrink-0">
                            <UserIcon size={20} />
                          </div>
                          
                          {editingUser?.uid === emp.uid ? (
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
                                      // Update Supabase data
                                      await supabase.from('profiles').update({
                                        name: editUserName.trim(),
                                        phone: editUserPhone.trim(),
                                        email: editUserEmail.trim()
                                      }).eq('id', emp.uid);

                                      // Update Password if provided
                                      if (editUserPassword.trim()) {
                                        if (editUserPassword.trim().length < 6) {
                                          toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                                          return;
                                        }
                                        const { data: { session } } = await supabase.auth.getSession();
                                        const token = session?.access_token;
                                        const response = await fetch(`${API_BASE}/api/update-user-password`, {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json' },
                                          body: JSON.stringify({
                                            idToken: token,
                                            targetUid: emp.uid,
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
                                <h3 className="text-sm font-bold text-stone-800 truncate">{emp.name}</h3>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                  emp.role === 'admin' ? 'bg-purple-100 text-purple-600' :
                                  emp.role === 'employee' ? 'bg-blue-100 text-blue-600' :
                                  'bg-amber-100 text-amber-600'
                                }`}>
                                  {emp.role === 'admin' ? 'مدير' : emp.role === 'employee' ? 'موظف' : 'معلق'}
                                </span>
                                {isSuperAdmin && (
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-stone-100 text-stone-600">
                                    {companies.find(c => c.id === emp.companyId)?.name || 'بدون شركة'}
                                  </span>
                                )}
                              </div>
                              <p className={`text-stone-500 truncate mt-0.5 ${emp.email?.endsWith('@simsaraqari.com') ? 'text-[7px] leading-tight tracking-tighter' : 'text-[11px]'}`}>
                                {emp.phone || 'بدون هاتف'} • {emp.email} • {formatRelativeDate(emp.createdAt)}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 justify-end shrink-0">
                          {emp.role === 'pending' && (
                            <div className="flex items-center gap-1.5">
                              <button 
                                onClick={() => setUserActionConfirm({ isOpen: true, userId: emp.uid, action: 'approve', extraData: { name: emp.name } })}
                                className="px-3 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-sm"
                              >
                                موافقة
                              </button>
                              <button 
                                onClick={() => setUserActionConfirm({ isOpen: true, userId: emp.uid, action: 'reject', extraData: { name: emp.name } })}
                                className="px-3 py-1.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-lg hover:bg-red-100 transition-all"
                              >
                                رفض
                              </button>
                            </div>
                          )}
                          
                          {emp.role !== 'pending' && emp.uid !== user.uid && (
                            <div className="relative">
                              <select
                                value={emp.role}
                                onChange={(e) => setUserActionConfirm({ isOpen: true, userId: emp.uid, action: 'change-role', extraData: { newRole: e.target.value, name: emp.name } })}
                                className="text-[10px] p-1.5 pr-6 rounded-lg border border-stone-200 bg-stone-50/50 outline-none focus:ring-2 focus:ring-emerald-500 appearance-none font-bold text-stone-600"
                              >
                                <option value="employee">موظف (إضافة وعرض العقارات)</option>
                                <option value="admin">مدير نظام (إدارة العقارات والموظفين للشركة)</option>
                              </select>
                              <ChevronDown size={10} className="absolute left-1.5 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
                            </div>
                          )}
                        </div>
                      
                      {emp.uid !== user.uid && (
                        <div className="flex items-center justify-end gap-2 mt-2 pt-2 border-t border-stone-100">
                          <button 
                            onClick={() => {
                              setEditingUser(emp);
                              setEditUserName(emp.name);
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
                            onClick={() => setUserActionConfirm({ isOpen: true, userId: emp.uid, action: 'delete', extraData: { name: emp.name } })}
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
              <PropertyDetails 
                property={selectedProperty}
                user={user}
                onBack={() => window.history.back()}
                isAdmin={isAdmin}
                isFavorite={favorites.includes(selectedProperty.id)}
                onFavorite={() => toggleFavorite(selectedProperty.id)}
                onEdit={() => {
                  setSelectedProperty(selectedProperty);
                  setView('edit');
                }}
                onDelete={() => setDeleteConfirm({ isOpen: true, propertyId: selectedProperty.id })}
                onRestore={() => restoreProperty(selectedProperty.id)}
                onPermanentDelete={() => permanentDeleteProperty(selectedProperty.id)}
                onDeleteComment={(commentId: string) => setCommentDeleteConfirm({ isOpen: true, commentId, propertyId: selectedProperty.id })}
                onUserClick={(userId: string) => {
                  setSelectedMarketerId(userId);
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
            </div>
          )}
        </AnimatePresence>

        <ConfirmModal 
          isOpen={deleteConfirm.isOpen}
          title="تأكيد الحذف"
          message="هل أنت متأكد من رغبتك في حذف هذا العقار نهائياً؟ لا يمكن التراجع عن هذا الإجراء."
          onConfirm={confirmDelete}
          onCancel={() => setDeleteConfirm({ isOpen: false, propertyId: null })}
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
            userActionConfirm.action === 'approve' ? `هل أنت متأكد من الموافقة على المستخدم ${userActionConfirm.extraData?.name || ''}؟` :
            userActionConfirm.action === 'reject' ? `هل أنت متأكد من رفض المستخدم ${userActionConfirm.extraData?.name || ''}؟` :
            userActionConfirm.action === 'change-role' ? `هل أنت متأكد من تغيير صلاحية ${userActionConfirm.extraData?.name} إلى ${userActionConfirm.extraData?.newRole === 'admin' ? 'مدير نظام' : 'مستخدم'}؟` :
            `هل أنت متأكد من رغبتك في حذف ${userActionConfirm.extraData?.name || 'هذا المستخدم'} نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`
          }
          onConfirm={confirmUserAction}
          onCancel={() => setUserActionConfirm({ isOpen: false, userId: null, action: null })}
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
          onCancel={() => setCommentDeleteConfirm({ isOpen: false, commentId: null, propertyId: null })}
          confirmText="تأكيد الحذف"
          confirmColor="bg-red-600 hover:bg-red-700"
        />
      </main>
    </div>
  );
}

