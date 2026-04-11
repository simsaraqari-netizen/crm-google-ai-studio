import React, { useState, useEffect, memo } from 'react';
import {
  ChevronRight,
  RefreshCw,
  Trash2,
  Edit,
  Share2,
  Heart,
  Image as ImageIcon,
  ChevronLeft,
  Phone,
  MessageCircle,
  MessageSquare,
  Plus,
  MapPin,
  X,
  ExternalLink
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import {
  generatePropertyTitle,
  formatRelativeDate,
  cleanAreaName,
  formatDateTime,
  formatPropertyDate,
  getPropertyCode
} from '../utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Comment, Property } from '../types';
import { ImageViewer } from './ImageViewer';
import { LoadingSpinner } from './LoadingSpinner';
import { SUPER_ADMIN_EMAILS, SUPER_ADMIN_PHONES } from '../constants';

interface PropertyDetailsProps {
  property: Property;
  user: any;
  onBack: () => void;
  isAdmin: boolean;
  isFavorite: boolean;
  onFavorite: (id: string) => void;
  onEdit: (p: Property) => void;
  onDelete: (id: string) => void;
  onRestore?: (id: string) => void;
  onPermanentDelete?: (id: string) => void;
  onUserClick?: (uid: string) => void;
  onFilter?: (key: string, value: string) => void;
  onDeleteComment?: (commentId: string) => void;
}

export const PropertyDetails = memo(function PropertyDetails({ 
  property, 
  user, 
  onBack, 
  isAdmin, 
  isFavorite, 
  onFavorite, 
  onEdit, 
  onDelete, 
  onRestore, 
  onPermanentDelete, 
  onUserClick, 
  onFilter,
  onDeleteComment
}: PropertyDetailsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const images = React.useMemo(() => {
    const raw = property.images && Array.isArray(property.images) ? property.images : [];
    const fallback = property.image_url || property.imageUrl || property.image || property.photo || '';
    const unified = raw.map((img: any) => {
      const url = typeof img === 'string' ? img : (img?.url || '');
      const type = typeof img === 'string' ? (img.includes('.mp4') || img.includes('.mov') ? 'video' : 'image') : (img?.type || 'image');
      return { url, type };
    }).filter(img => img.url);
    
    if (fallback && !unified.some(img => img.url === fallback)) {
      unified.push({ url: fallback, type: 'image' });
    }
    return unified;
  }, [property]);

  const [showViewer, setShowViewer] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!property.id) return;
    async function fetchComments() {
      const { data } = await supabase
        .from('comments')
        .select('*')
        .eq('property_id', property.id)
        .order('created_at', { ascending: false });
      
      if (data) setComments((data as Comment[]).filter(c => !c.is_deleted));
    }
    fetchComments();
    
    const channel = supabase.channel(`comments-${property.id}`)
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
  }, [property.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    const isEmployee = user?.role === 'employee' || isAdmin;
    if (!isEmployee) {
      toast.error('عذراً، التعليقات متاحة للموظفين فقط.');
      return;
    }

    setIsUploading(true);
    try {
      const now = new Date().toISOString();
      const commentData = {
        property_id: property.id,
        user_id: user.uid,
        user_name: user.name || user.full_name || user.email || 'مستخدم',
        user_phone: user.phone || '',
        text: newComment,
        images: [],
        created_at: now
      };

      const { data: inserted, error } = await supabase.from('comments').insert(commentData).select().single();
      if (error) throw error;

      if (inserted) setComments(prev => [inserted as Comment, ...prev]);

      await supabase.from('properties').update({ 
        last_comment: newComment,
        last_comment_at: now
      }).eq('id', property.id);

      setNewComment('');
      toast.success('تم إضافة التعليق');
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("حدث خطأ أثناء إضافة التعليق");
    } finally {
      setIsUploading(false);
    }
  };

  const propertyWhatsappUrl = property.phone
    ? `https://wa.me/${property.phone.replace(/[^0-9]/g, '')}`
    : null;

  const handleShare = async () => {
    const code = getPropertyCode(property);
    const base = window.location.origin + window.location.pathname;
    const shareUrl = `${base}?p=${code}`;
    const title = property.name || 'عقار';
    const text = `${title}\n🔑 كود العقار: #${code}\n${shareUrl}`;

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success('تم نسخ تفاصيل العقار');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        navigator.clipboard.writeText(text).catch(() => {});
        toast.success('تم نسخ تفاصيل العقار');
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8"
      dir="rtl"
    >
      {showViewer && (
        <ImageViewer 
          images={viewerImages} 
          initialIndex={viewerIndex} 
          onClose={() => setShowViewer(false)} 
          isSold={property.is_sold}
        />
      )}

      {/* Top Navigation & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
        <button 
          onClick={onBack} 
          className="flex items-center gap-2 text-stone-500 hover:text-emerald-700 transition-all text-sm font-bold bg-white px-4 py-2 rounded-xl shadow-sm border border-stone-100 group"
        >
          <ChevronRight size={18} className="group-hover:-translate-x-1 transition-transform" />
          العودة للقائمة
        </button>
        
        <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl shadow-sm border border-stone-100">
          <div className="px-3 py-1.5 bg-stone-50 rounded-xl mr-2">
            <span className="text-[11px] font-black text-stone-400 tracking-widest uppercase">
              كود العقار: #{getPropertyCode(property)}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {isAdmin && property.status === 'deleted' ? (
              <>
                <button 
                  onClick={() => onRestore?.(property.id)}
                  className="p-2.5 text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title="استعادة"
                >
                  <RefreshCw size={20} />
                </button>
                <button 
                  onClick={() => onPermanentDelete?.(property.id)}
                  className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="حذف نهائي"
                >
                  <Trash2 size={20} />
                </button>
              </>
            ) : (
              <>
                {isAdmin && (
                  <button 
                    onClick={() => onEdit(property)}
                    className="p-2.5 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                    title="تعديل"
                  >
                    <Edit size={20} />
                  </button>
                )}
                {isAdmin && (
                  <button 
                    onClick={() => onDelete(property.id)}
                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="حذف"
                  >
                    <Trash2 size={20} />
                  </button>
                )}
              </>
            )}
            <button 
              onClick={handleShare}
              className="p-2.5 text-stone-600 hover:bg-emerald-50 hover:text-emerald-600 rounded-xl transition-all"
              title="مشاركة"
            >
              <Share2 size={20} />
            </button>
            <button 
              onClick={() => onFavorite(property.id)}
              className={`p-2.5 rounded-xl transition-all ${isFavorite ? 'text-red-500 bg-red-50' : 'text-stone-600 hover:bg-red-50 hover:text-red-500'}`}
              title="المفضلة"
            >
              <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Media & Main Info */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Media Section */}
          <div className="bg-white rounded-3xl overflow-hidden shadow-xl shadow-stone-200/50 border border-stone-100">
            {images.length > 0 ? (
              <div className="relative aspect-[16/10] bg-stone-900 group">
                {images[activeImageIndex].type === 'video' ? (
                  <video
                    src={images[activeImageIndex].url}
                    controls
                    className={`w-full h-full object-contain ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                  />
                ) : (
                  <img
                    src={images[activeImageIndex].url}
                    alt={property.name}
                    className={`w-full h-full object-contain cursor-zoom-in transition-all duration-700 ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                    onClick={() => {
                      setViewerImages(images.map(img => img.url));
                      setViewerIndex(activeImageIndex);
                      setShowViewer(true);
                    }}
                  />
                )}

                {property.is_sold && (
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-900/40 backdrop-blur-[2px] pointer-events-none z-10">
                    <span className="text-white font-black text-4xl sm:text-6xl tracking-wider transform -rotate-12 border-4 border-white px-8 py-3 rounded-2xl shadow-2xl">مباع</span>
                  </div>
                )}

                {images.length > 1 && (
                  <>
                    <div className="absolute inset-y-0 right-0 p-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setActiveImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1))}
                        className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/30 border border-white/20 shadow-lg"
                      >
                        <ChevronRight size={24} />
                      </button>
                    </div>
                    <div className="absolute inset-y-0 left-0 p-4 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setActiveImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1))}
                        className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/30 border border-white/20 shadow-lg"
                      >
                        <ChevronLeft size={24} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="aspect-[16/10] bg-stone-50 flex flex-col items-center justify-center text-stone-300 gap-4">
                <ImageIcon size={64} strokeWidth={1} />
                <p className="font-bold text-sm">لا توجد صور لهذا العقار</p>
              </div>
            )}

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="p-4 bg-white border-t border-stone-50 overflow-x-auto scrollbar-hide">
                <div className="flex gap-3">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveImageIndex(i)}
                      className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${i === activeImageIndex ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-stone-100 hover:border-emerald-200'}`}
                    >
                      {img.type === 'video' ? (
                        <div className="w-full h-full bg-stone-900 flex items-center justify-center">
                          <Plus size={16} className="text-white" />
                        </div>
                      ) : (
                        <img src={img.url} className="w-full h-full object-cover" alt="" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Title & Details Section */}
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-stone-200/50 border border-stone-100 space-y-6">
            <div className="flex flex-col gap-2 border-b border-stone-50 pb-6">
              <div className="flex items-center justify-between gap-4">
                 <h1 className="text-2xl sm:text-3xl font-black text-stone-900 leading-tight">
                  {property.name || 'عقار بدون اسم'}
                </h1>
                {property.price && (
                  <span className="text-2xl font-black text-emerald-600 whitespace-nowrap">{property.price}</span>
                )}
              </div>
              <div className="flex items-center gap-3 text-stone-400 text-sm font-bold mt-2">
                <div className="flex items-center gap-1.5 px-3 py-1 bg-stone-50 rounded-lg">
                  <MapPin size={14} className="text-emerald-500" />
                  <span>{property.governorate}</span>
                  <span className="text-stone-300">|</span>
                  <span>{cleanAreaName(property.area)}</span>
                </div>
                {property.created_at && (
                  <span className="mr-auto">{formatRelativeDate(property.created_at)}</span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest">التفاصيل والمواصفات</h3>
              <div className="text-lg text-stone-700 leading-relaxed whitespace-pre-wrap font-medium">
                {property.details || 'لا توجد تفاصيل إضافية مسجلة.'}
              </div>
              
              {(property.comments_2 || property.comments_3) && (
                <div className="pt-4 space-y-4 border-t border-stone-50">
                   {property.comments_2 && (
                    <div className="p-4 bg-stone-50 rounded-2xl text-stone-600 text-sm italic font-medium">
                      {property.comments_2}
                    </div>
                  )}
                  {property.comments_3 && (
                    <div className="p-4 bg-stone-50 rounded-2xl text-stone-600 text-sm italic font-medium">
                      {property.comments_3}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-6 border-t border-stone-50">
              <div className="p-4 rounded-2xl border border-stone-100 bg-stone-50/30">
                <p className="text-[10px] font-black text-stone-400 mb-1 uppercase tracking-tight">الغرض</p>
                <p className="text-sm font-black text-stone-800">{property.purpose || 'غير محدد'}</p>
              </div>
              <div className="p-4 rounded-2xl border border-stone-100 bg-stone-50/30">
                <p className="text-[10px] font-black text-stone-400 mb-1 uppercase tracking-tight">النوع</p>
                <p className="text-sm font-black text-stone-800">{property.type || 'غير محدد'}</p>
              </div>
              <div className="p-4 rounded-2xl border border-stone-100 bg-stone-50/30 col-span-2 sm:col-span-1">
                <p className="text-[10px] font-black text-stone-400 mb-1 uppercase tracking-tight">الموقع</p>
                <p className="text-sm font-black text-stone-800">{property.location || 'غير محدد'}</p>
              </div>
            </div>
          </div>

          {/* Location Details (Additional Specs) */}
          <div className="bg-white rounded-3xl p-8 shadow-xl shadow-stone-200/50 border border-stone-100">
             <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-6">معلومات الموقع الدقيقة</h3>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                {[
                  { label: 'القطعة', value: property.block },
                  { label: 'القسيمة', value: property.plot_number },
                  { label: 'الشارع', value: property.street },
                  { label: 'الجادة', value: property.avenue },
                  { label: 'المنزل', value: property.house_number },
                  { label: 'التوزيعة', value: property.distribution }
                ].map((spec, idx) => spec.value && (
                  <div key={idx} className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-stone-400">{spec.label}</span>
                    <span className="text-sm font-black text-stone-800">{spec.value}</span>
                  </div>
                ))}
             </div>
             {property.location_link && (
               <div className="mt-8 pt-8 border-t border-stone-50">
                  <a 
                    href={property.location_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 bg-emerald-50 text-emerald-700 py-4 rounded-2xl font-black text-sm hover:bg-emerald-100 transition-all border border-emerald-100/50"
                  >
                    <ExternalLink size={18} />
                    عرض الموقع على الخرائط (Google Maps)
                  </a>
               </div>
             )}
          </div>
        </div>

        {/* Right Column: Contact & Comments */}
        <div className="space-y-8">
          
          {/* Owner/Property Contact */}
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-stone-200/50 border border-emerald-100 ring-2 ring-emerald-50 flex flex-col gap-6">
             <div className="flex items-center gap-4 text-right">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                  <Phone size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-stone-900">بيانات التواصل مع العقار</h3>
                  <p className="text-[11px] font-bold text-stone-400">يرجى التواصل المباشر للمعاينة</p>
                </div>
             </div>
             
             {property.phone ? (
               <div className="space-y-3">
                 <a
                    href={`tel:${property.phone}`}
                    className="w-full flex items-center justify-between bg-stone-50 p-4 rounded-2xl hover:bg-stone-100 transition-colors border border-stone-100"
                  >
                    <span className="text-lg font-black text-stone-800 font-mono tracking-wider" dir="ltr">{property.phone}</span>
                    <Phone size={18} className="text-emerald-600" />
                  </a>
                  {property.phone_2 && (
                    <a
                      href={`tel:${property.phone_2}`}
                      className="w-full flex items-center justify-between bg-stone-50 p-4 rounded-2xl hover:bg-stone-100 transition-colors border border-stone-100"
                    >
                      <span className="text-lg font-black text-stone-800 font-mono tracking-wider" dir="ltr">{property.phone_2}</span>
                      <Phone size={18} className="text-stone-400" />
                    </a>
                  )}
                  <a
                    href={propertyWhatsappUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-3 bg-emerald-600 text-white p-4 rounded-2xl font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all"
                  >
                    <MessageCircle size={20} />
                    مراسلة واتساب
                  </a>
               </div>
             ) : (
               <p className="text-center py-4 bg-stone-50 rounded-2xl text-xs font-bold text-stone-400">لا توجد أرقام هواتف مسجلة</p>
             )}
          </div>

          {/* Assigned Employee (Marketer) */}
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-stone-200/50 border border-stone-100 flex flex-col gap-4">
             <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest text-right">موظف العقار</h3>
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400">
                     <ImageIcon size={20} />
                   </div>
                   <div className="text-right">
                      <button 
                        onClick={() => onUserClick?.(property.assigned_employee_id || '')}
                        className="text-sm font-black text-stone-900 hover:text-emerald-600 transition-colors block"
                      >
                        {property.assigned_employee_name || 'غير محدد'}
                      </button>
                      <p className="text-[10px] font-bold text-stone-400">مستخدم معتمد بالنظام</p>
                   </div>
                </div>
                {property.assigned_employee_phone && (
                   <div className="flex gap-2">
                      <a href={`tel:${property.assigned_employee_phone}`} className="p-2 bg-stone-50 rounded-lg text-emerald-600 border border-stone-100">
                        <Phone size={16} />
                      </a>
                   </div>
                )}
             </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white rounded-3xl p-6 shadow-xl shadow-stone-200/50 border border-stone-100 flex flex-col h-[600px]">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-sm font-black text-stone-900 flex items-center gap-2">
                  <MessageSquare size={18} className="text-emerald-600" />
                  الملاحظات والتعليقات
               </h3>
               <span className="px-2.5 py-1 bg-stone-100 rounded-lg text-[10px] font-black text-stone-500 uppercase">{comments.length} تعليق</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 px-1 scrollbar-hide mb-6">
               {comments.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center text-stone-300 gap-3 opacity-60">
                    <MessageSquare size={48} strokeWidth={1} />
                    <p className="text-xs font-bold">لا توجد ملاحظات حالياً</p>
                 </div>
               ) : (
                 comments.map((c) => (
                   <div key={c.id} className="group flex flex-col gap-2">
                     <div className={`p-4 rounded-2xl border ${c.user_id === user?.uid ? 'bg-emerald-50/30 border-emerald-100' : 'bg-stone-50/50 border-stone-100'}`}>
                        <div className="flex items-center justify-between mb-2">
                           <div className="flex flex-col">
                             <span className="text-xs font-black text-stone-800">{c.user_name}</span>
                             <span className="text-[9px] font-bold text-stone-400" dir="ltr">{formatDateTime(c.created_at)}</span>
                           </div>
                           {(isAdmin || (user && c.user_id === user.uid)) && (
                             <button 
                               onClick={() => onDeleteComment?.(c.id)}
                               className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                               title="حذف التعليق"
                             >
                               <X size={14} />
                             </button>
                           )}
                        </div>
                        <p className="text-sm text-stone-700 leading-relaxed font-medium whitespace-pre-wrap">{c.text}</p>
                     </div>
                   </div>
                 ))
               )}
            </div>

            {/* Add Comment Input */}
            <div className="mt-auto pt-6 border-t border-stone-50">
               <form onSubmit={handleAddComment} className="relative">
                  <textarea
                    placeholder="أضف ملاحظة جديدة..."
                    rows={2}
                    className="w-full p-4 bg-stone-50 border border-stone-100 rounded-2xl text-sm focus:ring-4 focus:ring-emerald-500/5 focus:border-emerald-500 transition-all resize-none shadow-inner"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={isUploading || !newComment.trim()}
                    className="absolute bottom-3 left-3 bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-30 shadow-lg shadow-emerald-200"
                  >
                    {isUploading ? <LoadingSpinner size={16} className="border-white" /> : <ChevronLeft size={20} />}
                  </button>
               </form>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
