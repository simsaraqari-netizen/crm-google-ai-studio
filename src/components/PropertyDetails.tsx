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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `property_id=eq.${property.id}` }, () => {
        fetchComments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [property.id]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const isEmployee = user?.role === 'employee' || isAdmin;
    if (!isEmployee) { toast.error('عذراً، التعليقات متاحة للموظفين فقط.'); return; }
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
      await supabase.from('properties').update({ last_comment: newComment, last_comment_at: now }).eq('id', property.id);
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
      if (navigator.share) { await navigator.share({ title, text, url: shareUrl }); }
      else { await navigator.clipboard.writeText(text); toast.success('تم نسخ تفاصيل العقار'); }
    } catch (err: any) {
      if (err?.name !== 'AbortError') { navigator.clipboard.writeText(text).catch(() => {}); toast.success('تم نسخ تفاصيل العقار'); }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto px-3 sm:px-6 py-4"
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

      {/* ── Top Bar ── */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-stone-500 hover:text-emerald-700 transition-colors text-sm font-bold"
        >
          <ChevronRight size={18} />
          العودة
        </button>

        <div className="flex items-center gap-1">
          <span className="text-[11px] font-black text-stone-400 tracking-widest ml-2">
            #{getPropertyCode(property)}
          </span>
          {isAdmin && property.status === 'deleted' ? (
            <>
              <button onClick={() => onRestore?.(property.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="استعادة"><RefreshCw size={18} /></button>
              <button onClick={() => onPermanentDelete?.(property.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="حذف نهائي"><Trash2 size={18} /></button>
            </>
          ) : (
            <>
              {isAdmin && <button onClick={() => onEdit(property)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all" title="تعديل"><Edit size={18} /></button>}
              {isAdmin && <button onClick={() => onDelete(property.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="حذف"><Trash2 size={18} /></button>}
            </>
          )}
          <button onClick={handleShare} className="p-2 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all" title="مشاركة"><Share2 size={18} /></button>
          <button onClick={() => onFavorite(property.id)} className={`p-2 rounded-lg transition-all ${isFavorite ? 'text-red-500 bg-red-50' : 'text-stone-400 hover:bg-red-50 hover:text-red-500'}`} title="المفضلة">
            <Heart size={18} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Left: Media + Info ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Media */}
          <div className="bg-white rounded-xl overflow-hidden border border-stone-100">
            {images.length > 0 ? (
              <div className="relative aspect-[16/10] bg-stone-900 group">
                {images[activeImageIndex].type === 'video' ? (
                  <video src={images[activeImageIndex].url} controls className={`w-full h-full object-contain ${property.is_sold ? 'grayscale opacity-60' : ''}`} />
                ) : (
                  <img
                    src={images[activeImageIndex].url}
                    alt={property.name}
                    className={`w-full h-full object-contain cursor-zoom-in ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                    onClick={() => { setViewerImages(images.map(img => img.url)); setViewerIndex(activeImageIndex); setShowViewer(true); }}
                  />
                )}
                {property.is_sold && (
                  <div className="absolute inset-0 flex items-center justify-center bg-stone-900/40 pointer-events-none z-10">
                    <span className="text-white font-black text-4xl sm:text-6xl tracking-wider transform -rotate-12 border-4 border-white px-8 py-3 rounded-xl">مباع</span>
                  </div>
                )}
                {images.length > 1 && (
                  <>
                    <div className="absolute inset-y-0 right-0 p-3 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setActiveImageIndex(prev => prev === 0 ? images.length - 1 : prev - 1)} className="p-2.5 bg-black/30 rounded-full text-white hover:bg-black/50">
                        <ChevronRight size={20} />
                      </button>
                    </div>
                    <div className="absolute inset-y-0 left-0 p-3 flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setActiveImageIndex(prev => prev === images.length - 1 ? 0 : prev + 1)} className="p-2.5 bg-black/30 rounded-full text-white hover:bg-black/50">
                        <ChevronLeft size={20} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="aspect-[16/10] bg-stone-50 flex flex-col items-center justify-center text-stone-300 gap-3">
                <ImageIcon size={48} strokeWidth={1} />
                <p className="text-xs font-bold">لا توجد صور</p>
              </div>
            )}
            {images.length > 1 && (
              <div className="p-3 border-t border-stone-100 overflow-x-auto">
                <div className="flex gap-2">
                  {images.map((img, i) => (
                    <button key={i} onClick={() => setActiveImageIndex(i)} className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${i === activeImageIndex ? 'border-emerald-500' : 'border-stone-100'}`}>
                      {img.type === 'video' ? (
                        <div className="w-full h-full bg-stone-800 flex items-center justify-center"><Plus size={14} className="text-white" /></div>
                      ) : (
                        <img src={img.url} className="w-full h-full object-cover" alt="" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Title & Details */}
          <div className="bg-white rounded-xl border border-stone-100 p-5 space-y-5">
            {/* Title row */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <h1 className="text-xl sm:text-2xl font-black text-stone-900 leading-snug flex-1">
                  {property.name || 'عقار بدون اسم'}
                </h1>
                {property.price && (
                  <span className="text-xl font-black text-emerald-600 whitespace-nowrap">{property.price}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {(property.governorate || property.area) && (
                  <span className="flex items-center gap-1 text-xs text-stone-500 font-bold">
                    <MapPin size={12} className="text-emerald-500" />
                    {property.governorate}{property.area ? ` — ${cleanAreaName(property.area)}` : ''}
                  </span>
                )}
                {property.created_at && (
                  <span className="text-xs text-stone-400">تم الإضافة {formatRelativeDate(property.created_at)}</span>
                )}
              </div>
            </div>

            {/* Specs row */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-stone-100 pt-4">
              {property.purpose && (
                <div><span className="text-[10px] text-stone-400 block">الغرض</span><span className="text-sm font-black text-stone-800">{property.purpose}</span></div>
              )}
              {property.type && (
                <div><span className="text-[10px] text-stone-400 block">النوع</span><span className="text-sm font-black text-stone-800">{property.type}</span></div>
              )}
              {property.location && (
                <div><span className="text-[10px] text-stone-400 block">الموقع</span><span className="text-sm font-black text-stone-800">{property.location}</span></div>
              )}
            </div>

            {/* Details text */}
            {property.details && (
              <div className="border-t border-stone-100 pt-4">
                <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap">{property.details}</p>
              </div>
            )}

            {(property.comments_2 || property.comments_3) && (
              <div className="space-y-2 border-t border-stone-100 pt-4">
                {property.comments_2 && <p className="text-sm text-stone-600 italic">{property.comments_2}</p>}
                {property.comments_3 && <p className="text-sm text-stone-600 italic">{property.comments_3}</p>}
              </div>
            )}
          </div>

          {/* Location specs */}
          {(property.block || property.plot_number || property.street || property.avenue || property.house_number || property.distribution || property.location_link) && (
            <div className="bg-white rounded-xl border border-stone-100 p-5">
              <h3 className="text-xs font-black text-stone-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <MapPin size={13} className="text-emerald-500" />
                تفاصيل الموقع والمواصفات
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {[
                  { label: 'القطعة', value: property.block },
                  { label: 'القسيمة', value: property.plot_number },
                  { label: 'الشارع', value: property.street },
                  { label: 'الجادة', value: property.avenue },
                  { label: 'المنزل', value: property.house_number },
                  { label: 'التوزيعة', value: property.distribution }
                ].filter(s => s.value).map((spec, idx) => (
                  <div key={idx}>
                    <span className="text-[10px] text-stone-400 block">{spec.label}</span>
                    <span className="text-sm font-black text-stone-800">{spec.value}</span>
                  </div>
                ))}
              </div>
              {property.location_link && (
                <a
                  href={property.location_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center justify-center gap-2 border border-emerald-200 text-emerald-700 py-3 rounded-lg font-bold text-sm hover:bg-emerald-50 transition-colors"
                >
                  <ExternalLink size={16} />
                  عرض على الخرائط
                </a>
              )}
            </div>
          )}
        </div>

        {/* ── Right: Contact + Employee + Comments ── */}
        <div className="space-y-4">

          {/* Contact */}
          <div className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
            <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">هاتف العقار المسجل</p>
            {property.phone ? (
              <>
                <a href={`tel:${property.phone}`} className="w-full flex items-center justify-between border border-stone-200 p-3.5 rounded-lg hover:border-stone-300 transition-colors">
                  <span className="text-base font-black text-stone-800 font-mono" dir="ltr">{property.phone}</span>
                  <Phone size={16} className="text-emerald-600" />
                </a>
                {property.phone_2 && (
                  <a href={`tel:${property.phone_2}`} className="w-full flex items-center justify-between border border-stone-200 p-3.5 rounded-lg hover:border-stone-300 transition-colors">
                    <span className="text-base font-black text-stone-800 font-mono" dir="ltr">{property.phone_2}</span>
                    <Phone size={16} className="text-stone-400" />
                  </a>
                )}
                <a
                  href={propertyWhatsappUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 border border-emerald-200 text-emerald-700 p-3.5 rounded-lg font-bold hover:bg-emerald-50 transition-colors"
                >
                  <MessageCircle size={18} />
                  واتساب العقار
                </a>
              </>
            ) : (
              <p className="text-center py-3 text-xs text-stone-400">لا توجد أرقام هواتف مسجلة</p>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white rounded-xl border border-stone-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-black text-stone-800 flex items-center gap-2">
                <MessageSquare size={16} className="text-emerald-600" />
                الملاحظات والتعليقات
              </h3>
              {comments.length > 0 && (
                <span className="text-[10px] font-black text-stone-400">{comments.length}</span>
              )}
            </div>

            {/* Existing comments */}
            {comments.length === 0 ? (
              <p className="text-center py-4 text-xs text-stone-300">لا توجد ملاحظات حالياً</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {comments.map((c) => (
                  <div key={c.id} className="group">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[11px] font-black text-stone-700">{c.user_name}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[9px] text-stone-400" dir="ltr">{formatDateTime(c.created_at)}</span>
                        {(isAdmin || (user && c.user_id === user.uid)) && (
                          <button onClick={() => onDeleteComment?.(c.id)} className="p-1 text-stone-300 hover:text-red-500 rounded transition-all opacity-0 group-hover:opacity-100" title="حذف">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-stone-700 leading-relaxed whitespace-pre-wrap border-r-2 border-stone-200 pr-2.5">{c.text}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Add comment form */}
            <form onSubmit={handleAddComment} className="space-y-2 border-t border-stone-100 pt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-black text-stone-700 flex items-center gap-1.5">
                  <Plus size={14} className="text-emerald-600" />
                  إضافة ملاحظة
                </span>
              </div>
              <textarea
                placeholder="أضف ملاحظة أو تعليق... (يمكنك استخدام Markdown)"
                rows={3}
                className="w-full p-3 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 transition-all resize-none"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button
                type="submit"
                disabled={isUploading || !newComment.trim()}
                className="w-full bg-emerald-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-40"
              >
                {isUploading ? <LoadingSpinner size={16} className="border-white mx-auto" /> : 'إرسال التعليق'}
              </button>
            </form>
          </div>

          {/* Assigned Employee */}
          <div className="bg-white rounded-xl border border-stone-100 p-4">
            <div className="flex items-center justify-between">
              <div className="text-right">
                <button
                  onClick={() => onUserClick?.(property.assigned_employee_id || '')}
                  className="text-sm font-black text-stone-900 hover:text-emerald-600 transition-colors"
                >
                  {property.assigned_employee_name || 'غير محدد'}
                </button>
                <p className="text-[10px] text-stone-400">مستخدم معتمد</p>
                <p className="text-[10px] text-stone-400">{property.assigned_employee_phone || 'بدون هاتف'}</p>
              </div>
              {property.assigned_employee_phone && (
                <div className="flex gap-2">
                  <a href={`https://wa.me/${property.assigned_employee_phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="p-2 text-emerald-600 border border-stone-100 rounded-lg hover:bg-emerald-50 transition-colors">
                    <MessageCircle size={16} />
                  </a>
                  <a href={`tel:${property.assigned_employee_phone}`} className="p-2 text-stone-500 border border-stone-100 rounded-lg hover:bg-stone-50 transition-colors">
                    <Phone size={16} />
                  </a>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
});
