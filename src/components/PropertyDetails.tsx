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
  Link as LinkIcon, 
  MapPin,
  X
} from 'lucide-react';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'react-hot-toast';
import {
  generatePropertyTitle,
  formatRelativeDate,
  cleanAreaName,
  compressImage,
  formatDateTime,
  formatPropertyDate,
  getPropertyCode
} from '../utils';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Comment } from '../types';
import { ImageViewer } from './ImageViewer';
import { LoadingSpinner } from './LoadingSpinner';
import { SUPER_ADMIN_EMAILS, SUPER_ADMIN_PHONES } from '../constants';

export const PropertyDetails = memo(function PropertyDetails({ property, user, onBack, isAdmin, isFavorite, onFavorite, onEdit, onDelete, onRestore, onPermanentDelete, onDeleteComment, onUserClick, onFilter }: any) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [commentImages, setCommentImages] = useState<Array<{ url: string, type: 'image' | 'video' }>>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  const images = React.useMemo(() => {
    const raw = property.images && Array.isArray(property.images) ? property.images : [];
    const fallback = property.image_url || property.imageUrl || property.image || property.photo || '';
    const unified = raw.map((img: any) => {
      const url = typeof img === 'string' ? img : (img?.url || '');
      const type = typeof img === 'string' ? (img.includes('.mp4') || img.includes('.mov') ? 'video' : 'image') : (img?.type || 'image');
      return { url, type };
    }).filter(img => img.url);
    if (fallback && !unified.some(img => img.url === fallback)) unified.push({ url: fallback, type: 'image' });
    return unified;
  }, [property]);

  const [showViewer, setShowViewer] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  useEffect(() => {
    if (!property.id) return;
    async function fetchComments() {
      const { data } = await supabase.from('comments').select('*').eq('property_id', property.id).order('created_at', { ascending: false });
      if (data) setComments((data as Comment[]).filter(c => !c.is_deleted));
    }
    fetchComments();
    
    const channel = supabase.channel(`comments-${property.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `property_id=eq.${property.id}` }, payload => {
        fetchComments();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [property.id]);

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
      const commentData = {
        property_id: property.id,
        user_id: user.uid,
        user_name: user.name || user.full_name || user.email || 'مستخدم',
        user_phone: user.phone || '',
        text: newComment,
        images: commentImages,
        created_at: new Date().toISOString()
      };

      const { data: inserted, error } = await supabase.from('comments').insert(commentData).select().single();
      if (error) throw error;

      // Optimistic update — show immediately without waiting for realtime
      if (inserted) {
        setComments(prev => [inserted as Comment, ...prev]);
      }

      // Update last comment on property card
      await supabase.from('properties').update({
        last_comment: newComment || (commentImages.length > 0 ? 'تم إضافة صور' : '')
      }).eq('id', property.id);

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

  // WhatsApp for property/client owner — no pre-filled message, just open chat
  const employeeWhatsappUrl = property.assigned_employee_phone
    ? `https://wa.me/${property.assigned_employee_phone.replace(/[^0-9]/g, '')}`
    : null;
  const propertyWhatsappUrl = property.phone
    ? `https://wa.me/${property.phone.replace(/[^0-9]/g, '')}`
    : null;

  // Build rich share text (for share button & employee WhatsApp)
  const buildShareText = () => {
    const code = getPropertyCode(property);
    const base = window.location.origin + window.location.pathname;
    const shareUrl = `${base}?p=${code}`;
    const title = property.name || 'عقار';
    const details = property.details ? property.details.slice(0, 200) : '';
    const phone = property.phone ? `📞 ${property.phone.replace(/\s/g, '')}` : '';
    const phone2 = property.phone_2 ? ` | ${property.phone_2.replace(/\s/g, '')}` : '';
    const codeStr = `🔑 كود العقار: #${code}`;
    return { title, shareUrl, text: [title, details, phone + phone2, codeStr, shareUrl].filter(Boolean).join('\n') };
  };

  const handleCommentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;

    if (commentImages.length + files.length > 10) {
      toast.error('لا يمكن اختيار أكثر من 10 ملفات');
      if (e.target) e.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const newImages = [...commentImages];
      for (const file of files) {
        let fileToUpload: Blob;
        let contentType: string;

        if (file.type.startsWith('image/')) {
          fileToUpload = await compressImage(file);
          contentType = 'image/jpeg';
        } else {
          fileToUpload = file;
          contentType = file.type || 'video/mp4';
        }

        // استخدام اسم عشوائي آمن بدلاً من اسم الملف الأصلي
        const ext = file.type.startsWith('image/') ? 'jpg' : (file.name.split('.').pop() || 'mp4');
        const safeFileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${ext}`;
        const filePath = `comments/${safeFileName}`;

        const { error } = await supabase.storage
          .from('comments')
          .upload(filePath, fileToUpload, { contentType });
        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from('comments').getPublicUrl(filePath);
        newImages.push({ url: publicUrl, type: file.type.startsWith('video/') ? 'video' : 'image' });
      }
      setCommentImages(newImages);
    } catch (error) {
      console.error("Comment media upload error:", error);
      toast.error("حدث خطأ أثناء رفع الملفات");
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const removeCommentImage = (index: number) => {
    setCommentImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleShare = async () => {
    const { title, shareUrl, text } = buildShareText();
    try {
      if (navigator.share) {
        // Try with image attachment first
        if (images.length > 0 && (navigator as any).canShare) {
          try {
            const resp = await fetch(images[0].url).catch(() => null);
            if (resp?.ok) {
              const blob = await resp.blob();
              const file = new File([blob], 'property.jpg', { type: blob.type });
              if ((navigator as any).canShare({ files: [file] })) {
                await navigator.share({ title, text, files: [file] });
                return;
              }
            }
          } catch {}
        }
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
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      {showViewer && (
        <ImageViewer 
          images={viewerImages} 
          initialIndex={viewerIndex} 
          onClose={() => setShowViewer(false)} 
          isSold={property.is_sold}
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
            {/* Property code badge */}
            <span className="text-[11px] font-black text-stone-400 tracking-widest px-1">
              #{getPropertyCode(property)}
            </span>
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
          {/* Main image viewer — only shown when images exist */}
          {images.length > 0 && (
            <div className="relative aspect-[16/10] sm:aspect-video bg-black group shadow-2xl">
              {images[activeImageIndex].type === 'video' ? (
                <video
                  src={images[activeImageIndex].url}
                  controls
                  autoPlay
                  className={`w-full h-full object-contain ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                />
              ) : (
                <img
                  loading="lazy"
                  src={images[activeImageIndex].url}
                  alt={property.name}
                  className={`w-full h-full object-contain cursor-zoom-in transition-all duration-500 ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                  referrerPolicy="no-referrer"
                  onClick={() => {
                    setViewerImages(images.map(img => img.url));
                    setViewerIndex(activeImageIndex);
                    setShowViewer(true);
                  }}
                />
              )}

              {property.is_sold && (
                <div className="absolute inset-0 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm pointer-events-none z-10">
                  <span className="text-white font-black text-4xl sm:text-6xl tracking-wider transform -rotate-12 border-4 border-white px-8 py-3 rounded-2xl shadow-2xl">مباع</span>
                </div>
              )}

              {images.length > 1 && (
                <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => (prev === 0 ? images.length - 1 : prev - 1)); }}
                    className="p-3 bg-white/20 backdrop-blur-xl rounded-full text-white hover:bg-white/40 transition-all shadow-xl pointer-events-auto border border-white/20"
                  >
                    <ChevronRight size={24} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setActiveImageIndex(prev => (prev === images.length - 1 ? 0 : prev + 1)); }}
                    className="p-3 bg-white/20 backdrop-blur-xl rounded-full text-white hover:bg-white/40 transition-all shadow-xl pointer-events-auto border border-white/20"
                  >
                    <ChevronLeft size={24} />
                  </button>
                </div>
              )}

              {images.length > 1 && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 px-3 py-1.5 bg-black/30 backdrop-blur-md rounded-full shadow-lg">
                  {images.map((_: any, i: number) => (
                    <button
                      key={i}
                      onClick={() => setActiveImageIndex(i)}
                      className={`h-1.5 rounded-full transition-all duration-300 ${i === activeImageIndex ? 'bg-emerald-500 w-6' : 'bg-white/40 w-1.5'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
          
          <div className="p-6">
            <div className="flex flex-col gap-6">
              <div className="space-y-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 justify-end flex-wrap">
                    <h1 className="text-xl font-bold serif text-stone-900 text-right">{property.name || 'عقار بدون اسم'}</h1>
                    {/* Show "مباع" badge inline when there's no image to overlay it on */}
                    {property.is_sold && images.length === 0 && (
                      <span className="text-red-600 font-black text-sm border-2 border-red-400 bg-red-50 px-3 py-0.5 rounded-xl tracking-wide shrink-0">مباع</span>
                    )}
                  </div>
                  {property.created_at && (
                    <p className="text-[10px] text-stone-400 text-right">
                      تم الإضافة {formatRelativeDate(property.created_at)}
                    </p>
                  )}
                </div>
                {property.details && (
                  <div className="text-base text-stone-700 leading-relaxed whitespace-pre-wrap text-right bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <p className="font-bold text-xs text-stone-400 mb-1">التفاصيل:</p>
                    {property.details}
                  </div>
                )}
                {property.comments_2 && (
                  <div className="text-base text-stone-700 leading-relaxed whitespace-pre-wrap text-right bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <p className="font-bold text-xs text-stone-400 mb-1">تعليقات إضافية:</p>
                    {property.comments_2}
                  </div>
                )}
                {property.comments_3 && (
                  <div className="text-base text-stone-700 leading-relaxed whitespace-pre-wrap text-right bg-stone-50 p-4 rounded-xl border border-stone-100">
                    <p className="font-bold text-xs text-stone-400 mb-1">تعليقات إضافية:</p>
                    {property.comments_3}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col gap-3 w-full">
                {/* Employee Contact - Priority */}
                {property.assigned_employee_phone && (
                  <div className="space-y-2">
                    <p className="text-[10px] text-stone-400 text-right pr-2">تواصل مع المسؤول: {property.assigned_employee_name}</p>
                    <div className="flex flex-col md:flex-row gap-2">
                      <a 
                        href={`tel:${property.assigned_employee_phone}`}
                        className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm shadow-sm"
                      >
                        <span>{String(property.assigned_employee_phone).replace(/\s/g, '')}</span>
                        <Phone size={16} />
                      </a>
                      <a
                        href={property.assigned_employee_phone
                          ? `https://wa.me/${property.assigned_employee_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(buildShareText().text)}`
                          : '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white px-6 py-3 rounded-xl hover:bg-green-600 transition-all font-bold text-sm shadow-sm"
                      >
                        <MessageCircle size={16} />
                        واتساب المسؤول
                      </a>
                    </div>
                  </div>
                )}

                {/* Property Contact */}
                {property.phone && (
                  <div className="space-y-2 mt-2">
                    <p className="text-[10px] text-stone-400 text-right pr-2">هاتف العقار المسجل</p>
                    <div className="flex flex-col md:flex-row gap-2">
                      <a 
                        href={`tel:${property.phone}`}
                        className="flex-1 flex items-center justify-center gap-2 bg-stone-100 text-stone-800 px-6 py-3 rounded-xl hover:bg-stone-200 transition-all font-bold text-sm shadow-sm"
                      >
                        <span>{String(property.phone).replace(/\s/g, '')}</span>
                        <Phone size={16} />
                      </a>
                      {property.phone_2 && (
                        <a
                          href={`tel:${property.phone_2}`}
                          className="flex-1 flex items-center justify-center gap-2 bg-stone-50 text-stone-600 px-6 py-3 rounded-xl hover:bg-stone-100 transition-all font-bold text-sm shadow-sm border border-stone-100"
                        >
                          <span>{String(property.phone_2).replace(/\s/g, '')}</span>
                          <Phone size={16} />
                        </a>
                      )}
                      <a 
                        href={propertyWhatsappUrl || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 bg-white text-green-600 border border-green-200 px-6 py-3 rounded-xl hover:bg-green-50 transition-all font-bold text-sm shadow-sm"
                      >
                        <MessageCircle size={16} />
                        واتساب العقار
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {images.length > 1 && (
              <div className="mt-8 pt-6 border-t border-stone-100">
                <h3 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2 justify-center">
                  <ImageIcon size={16} className="text-emerald-600" />
                  معرض الصور ({images.length})
                </h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
                  {images.map((img: any, i: number) => {
                    return (
                      <button 
                        key={i} 
                        onClick={() => {
                          setActiveImageIndex(i);
                        }}
                        className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all shadow-sm active:scale-95 ${i === activeImageIndex ? 'border-emerald-500 ring-4 ring-emerald-500/10' : 'border-transparent hover:border-emerald-300'}`}
                      >
                        {img.type === 'video' ? (
                          <video src={img.url} className="w-full h-full object-cover" />
                        ) : (
                          <img loading="lazy" src={img.url} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                        )}
                        {img.type === 'video' && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                            <Plus size={16} className="text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
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
                  <div className={`w-full p-4 rounded-xl shadow-sm ${c.user_id === user.uid ? 'bg-emerald-50 border border-emerald-100' : 'bg-stone-50 border border-stone-100'}`}>
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
                        <p className="text-xs text-stone-500 text-center w-full">
                          {formatDateTime(c.created_at) || 'جاري التحميل...'}
                        </p>
                        <div className="flex items-center gap-2">
                          {(c.user_id === user.uid || isAdmin) && (
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
                                  text: editCommentText
                                }).eq('id', c.id);
                                
                                // Update last comment on property card if this was the latest
                                const sorted = [...comments].sort((a, b) => {
                                  const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
                                  const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
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
                        
                        {(c.images && c.images.length > 0) ? (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {c.images.map((img: any, idx) => {
                              const url = typeof img === 'string' ? img : (img?.url || '');
                              const isVideo = typeof img === 'string' 
                                ? (img.startsWith('data:video/') || img.toLowerCase().endsWith('.mp4')) 
                                : (img?.type === 'video' || (img?.url && img.url.toLowerCase().endsWith('.mp4')));

                              return (
                                <motion.div
                                  key={idx}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  onClick={() => {
                                    const imageList = c.images!.map((i: any) => typeof i === 'string' ? i : (i?.url || ''));
                                    setViewerImages(imageList);
                                    setViewerIndex(idx);
                                    setShowViewer(true);
                                  }}
                                  className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 cursor-pointer shadow-sm"
                                >
                                  {isVideo ? (
                                    <div className="w-full h-full bg-black flex items-center justify-center">
                                      <video src={url} className="w-full h-full object-cover" />
                                    </div>
                                  ) : (
                                    <img loading="lazy" src={url} alt="" className="w-full h-full object-cover" />
                                  )}
                                </motion.div>
                              );
                            })}
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
                              className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 cursor-pointer shadow-sm"
                            >
                              {c.image_url.startsWith('data:video/') ? (
                                <video src={c.image_url} className="w-full h-full object-cover" />
                              ) : (
                                <img loading="lazy" src={c.image_url} alt="" className="w-full h-full object-cover" />
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
          {(user.role === 'employee' || user.role === 'admin' || user.role === 'super_admin' || 
            (user.email && SUPER_ADMIN_EMAILS.includes(user.email)) ||
            (user.phone && SUPER_ADMIN_PHONES.includes(user.phone))) ? (
            <form onSubmit={handleAddComment} className="space-y-2">
              <div className="space-y-2">
                <textarea
                  id="comment-textarea"
                  placeholder="أضف ملاحظة أو تعليق... (يمكنك استخدام Markdown)"
                  rows={4}
                  className="w-full p-4 bg-stone-50/50 border border-stone-100 rounded-xl text-base focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                {/* Media row */}
                <div className="flex items-center gap-2 bg-stone-50 border border-stone-100 rounded-xl px-3 py-2">
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
                    className={`p-2 bg-white border border-stone-200 rounded-lg text-emerald-600 hover:bg-emerald-50 hover:border-emerald-500 transition-all shadow-sm flex items-center justify-center cursor-pointer shrink-0 ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                    title="إضافة صور أو فيديو (حتى 10)"
                  >
                    {isUploading ? (
                      <LoadingSpinner size={20} className="border-emerald-500" />
                    ) : (
                      <ImageIcon size={20} />
                    )}
                  </label>
                  <div className="flex items-center gap-2 flex-1">
                    <LinkIcon size={16} className="text-stone-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="رابط صورة أو فيديو..."
                      className="flex-1 bg-transparent border-none outline-none text-sm text-right placeholder:text-stone-300"
                      onBlur={(e) => {
                        if (e.target.value) {
                          insertAtCursor(`[رابط](${e.target.value})`);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              </div>

              {commentImages.length > 0 && (
                <div className="flex flex-wrap gap-2 p-2 bg-stone-50 rounded-xl border border-stone-100">
                  {commentImages.map((img, idx) => (
                    <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200">
                      {img.type === 'video' ? (
                        <video src={img.url} className="w-full h-full object-cover" />
                      ) : (
                        <img loading="lazy" src={img.url} alt="" className="w-full h-full object-cover" />
                      )}
                      {/* Always visible X on mobile */}
                      <button
                        type="button"
                        onClick={() => removeCommentImage(idx)}
                        className="absolute top-0.5 right-0.5 bg-red-500 text-white p-1 rounded-full shadow"
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
                className="w-full bg-emerald-500 text-white px-4 py-3 rounded-xl hover:bg-emerald-600 active:scale-[0.98] transition-all text-sm font-bold mt-2 shadow-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isUploading ? (
                  <>
                    <LoadingSpinner size={16} className="border-white" />
                    جاري الإرسال...
                  </>
                ) : 'إرسال التعليق'}
              </button>
            </form>
          ) : (
            <div className="p-3 bg-stone-50 rounded-lg border border-stone-100 text-center">
              <p className="text-[10px] text-stone-500">التعليقات متاحة للمستخدمين فقط</p>
            </div>
          )}
        </div>

        {/* Marketer Info Box */}
        <div className="flex justify-between p-3 bg-white rounded-xl border border-stone-100 w-full">
            {/* Right Side: Name, Description, Phone */}
            <div className="flex flex-col items-end text-right gap-0.5">
              <button 
                onClick={() => {
                  if (onUserClick && property.assigned_employee_id) {
                    onUserClick(property.assigned_employee_id);
                  }
                }}
                className="text-sm font-bold text-stone-900 hover:text-emerald-700 transition-colors truncate block"
              >
                {property.assigned_employee_name || 'غير محدد'}
              </button>
              <p className="text-[10px] text-stone-500">مستخدم معتمد</p>
              <span className="text-xs font-bold text-stone-600 mt-1">
                {property.assigned_employee_phone || 'بدون هاتف'}
              </span>
            </div>
            
            {/* Left Side: Icons, Date */}
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-2" dir="ltr">
                <a
                  href={property.assigned_employee_phone
                    ? `https://wa.me/${property.assigned_employee_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(buildShareText().text)}`
                    : '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-8 h-8 flex items-center justify-center text-green-600 bg-stone-50 border border-stone-100 hover:bg-green-50 rounded-full transition-colors shadow-sm ${!property.assigned_employee_phone ? 'opacity-30 pointer-events-none' : ''}`}
                  title="واتساب المسؤول"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </a>
                <a 
                  href={property.assigned_employee_phone ? `tel:${property.assigned_employee_phone}` : '#'}
                  className={`w-8 h-8 flex items-center justify-center text-emerald-600 bg-stone-50 border border-stone-100 hover:bg-emerald-50 rounded-full transition-colors shadow-sm ${!property.assigned_employee_phone ? 'opacity-30 pointer-events-none' : ''}`}
                  title="اتصال بالمسؤول"
                >
                  <Phone size={20} />
                </a>
              </div>
              {property.created_at && (
                <p className="text-[10px] text-stone-400 mt-1">
                  {formatPropertyDate(property.created_at) || 'جاري التحميل...'}
                </p>
              )}
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
            <button onClick={() => onFilter('governorate', property.governorate)} className="flex items-center justify-center p-2 bg-stone-50/50 rounded-lg border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98]">
              <span className="text-xs font-bold text-stone-800">{property.governorate}</span>
            </button>
            {/* Area */}
            <button onClick={() => onFilter('area', property.area)} className="flex items-center justify-center p-2 bg-stone-50/50 rounded-lg border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98]">
              <span className="text-xs font-bold text-stone-800">{cleanAreaName(property.area)}</span>
            </button>
            {/* Type */}
            <button onClick={() => onFilter('type', property.type)} className="flex items-center justify-center p-2 bg-stone-50/50 rounded-lg border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98]">
              <span className="text-xs font-bold text-stone-800">{property.type}</span>
            </button>
            {/* Purpose */}
            {property.purpose !== 'بيع' && (
              <button onClick={() => onFilter('purpose', property.purpose)} className="flex items-center justify-center p-2 bg-stone-50/50 rounded-lg border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98]">
                <span className="text-xs font-bold text-stone-800">{property.purpose}</span>
              </button>
            )}
            {/* Sector */}
            {property.sector && (
              <div className="flex items-center justify-center p-2 bg-stone-50/50 rounded-lg border border-stone-100">
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
              <button onClick={() => onFilter('plotNumber', property.plot_number)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
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
              <button onClick={() => onFilter('houseNumber', property.house_number)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
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
            {/* Distribution */}
            {property.distribution && (
              <div className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 text-right col-span-2">
                <span className="text-[10px] text-stone-500 mb-1">التوزيعة</span>
                <span className="text-xs font-bold text-stone-800">{property.distribution}</span>
              </div>
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
