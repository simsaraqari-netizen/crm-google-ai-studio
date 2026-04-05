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
  inferGovernorate
} from '../utils';
import { PROPERTY_TYPES } from '../constants';
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
  const [showViewer, setShowViewer] = useState(false);
  const [viewerImages, setViewerImages] = useState<string[]>([]);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentText, setEditCommentText] = useState('');

  useEffect(() => {
    if (!property.id) return;
    async function fetchComments() {
      const { data, error } = await supabase.from('comments').select('*').eq('property_id', property.id).order('created_at', { ascending: false });
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
      await supabase.from('comments').insert({
        property_id: property.id,
        user_id: user.id,
        user_name: user.full_name,
        user_phone: user.phone || '',
        text: newComment,
        images: commentImages,
        created_at: new Date().toISOString()
      });
      
      // Update last comment on property
      const now = new Date().toISOString();
      await supabase.from('properties').update({
        last_comment: newComment || (commentImages.length > 0 ? 'تم إضافة صور' : ''),
        last_comment_at: now
      }).eq('id', property.id);

      // Notify interested users (who favorited the property)
      const { data: favorites, error: favError } = await supabase.from('favorites').select('user_id').eq('property_id', property.id);
      const interestedUserIds = (favorites || []).map(d => d.user_id);
      
      for (const recipient_id of interestedUserIds) {
        if (recipient_id === user.id) continue; // Don't notify the commenter
        
        await supabase.from('notifications').insert({
          type: 'new-comment',
          title: 'تعليق جديد على عقار يهمك',
          message: `أضاف ${user.full_name} تعليقاً جديداً على العقار: ${generatePropertyTitle(property)}`,
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

  const whatsappUrl = `https://wa.me/${(property.assigned_employee?.phone || property.assigned_employee_phone || property.phone || '').replace(/[^0-9]/g, '')}`;

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
        if (file.type && typeof file.type === 'string' && file.type.startsWith('image/')) {
          fileToUpload = await compressImage(file);
          fileType = 'image/jpeg';
        } else {
          fileToUpload = file;
        }
        
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '') || 'file';
        const filePath = `comments/${Date.now()}_${safeName}`;
        const { data, error } = await supabase.storage.from('properties_media').upload(filePath, fileToUpload, { contentType: fileType });
        if (error) {
          console.error("Supabase Storage Error:", error);
          throw new Error(error.message || "فشل الرفع للخادم");
        }
        
        const { data: { publicUrl } } = supabase.storage.from('properties_media').getPublicUrl(filePath);
        const isVideo = file.type && typeof file.type === 'string' && file.type.startsWith('video/');
        newImages.push({ url: publicUrl, type: isVideo ? 'video' : 'image' });
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
                 {(() => {
                   const img = property.images[activeImageIndex];
                   const url = typeof img === 'string' ? img : img.url;
                   const isVideo = typeof img === 'string' ? img.startsWith('data:video/') : img.type === 'video';
                   const comment = typeof img === 'string' ? null : img.comment;
                   
                   return (
                     <>
                       {isVideo ? (
                         <video 
                           src={url} 
                           controls 
                           className={`w-full h-full object-cover ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                         />
                       ) : (
                         <div className="relative w-full h-full">
                           <img 
                             loading="lazy"
                             src={url} 
                             alt={generatePropertyTitle(property)} 
                             className={`w-full h-full object-cover cursor-zoom-in ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                             referrerPolicy="no-referrer"
                             onClick={() => {
                               setViewerImages(property.images.map(i => typeof i === 'string' ? i : i.url));
                               setViewerIndex(activeImageIndex);
                               setShowViewer(true);
                             }}
                           />
                           {comment && (
                             <div className="absolute bottom-4 right-4 left-4 p-3 bg-black/60 backdrop-blur-md rounded-xl border border-white/20">
                               <p className="text-white text-xs font-bold text-center leading-relaxed">
                                 {comment}
                               </p>
                             </div>
                           )}
                         </div>
                       )}
                     </>
                   );
                 })()}
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
            
            {property.images.length > 1 && (
              <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => setActiveImageIndex(prev => (prev === 0 ? property.images.length - 1 : prev - 1))}
                  className="p-2 bg-white rounded-full text-stone-800 hover:bg-stone-50 transition-all shadow-md"
                >
                  <ChevronRight size={20} />
                </button>
                <button 
                  onClick={() => setActiveImageIndex(prev => (prev === property.images.length - 1 ? 0 : prev + 1))}
                  className="p-2 bg-white rounded-full text-stone-800 hover:bg-stone-50 transition-all shadow-md"
                >
                  <ChevronLeft size={20} />
                </button>
              </div>
            )}

            <div className="absolute bottom-4 right-4 flex gap-1.5">
              {property.images.map((_: any, i: number) => (
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
                  <h1 className="text-lg font-bold serif text-stone-900 text-right">{generatePropertyTitle(property)}</h1>
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
                  href={`tel:${(property.assigned_employee?.phone || property.assigned_employee_phone || property.phone || '').replace(/[^0-9]/g, '')}`}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl hover:bg-emerald-700 transition-all font-bold text-sm shadow-sm"
                >
                  <span>{property.assigned_employee?.phone || property.assigned_employee_phone || property.phone || ''}</span>
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

            {property.images.length > 1 && (
              <div className="mt-8 pt-6 border-t border-stone-100">
                <h3 className="text-sm font-bold text-stone-900 mb-4 flex items-center gap-2 justify-center">
                  <ImageIcon size={16} className="text-emerald-600" />
                  معرض الصور ({property.images.length})
                </h3>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                  {property.images.map((img: any, i: number) => (
                    <button 
                      key={i} 
                      onClick={() => {
                        setViewerImages(property.images.map((item: any) => typeof item === 'string' ? item : item.url));
                        setViewerIndex(i);
                        setShowViewer(true);
                      }}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${i === activeImageIndex ? 'border-emerald-500 scale-95' : 'border-transparent hover:border-stone-300'}`}
                    >
                      {(() => {
                        const url = typeof img === 'string' ? img : img.url;
                        const isVideo = typeof img === 'string' ? img.startsWith('data:video/') : img.type === 'video';
                        return isVideo ? (
                          <div className="w-full h-full bg-stone-100 flex items-center justify-center">
                            <video src={url} className="w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <span className="text-[10px] font-black text-white bg-black/40 px-1.5 py-0.5 rounded-md backdrop-blur-sm">VIDEO</span>
                            </div>
                          </div>
                        ) : (
                          <img loading="lazy" src={url} alt="" className="w-full h-full object-cover" />
                        );
                      })()}
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
                        <p className="text-xs text-stone-500 text-center w-full">
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
                                  const timeA = a.created_at?.toMillis ? a.created_at.toMillis() : 0;
                                  const timeB = b.created_at?.toMillis ? b.created_at.toMillis() : 0;
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
                            {c.images.map((img, idx) => (
                              <motion.div
                                key={idx}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setViewerImages(c.images!.map(i => typeof i === 'string' ? i : i.url));
                                  setViewerIndex(idx);
                                  setShowViewer(true);
                                }}
                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-stone-200 cursor-pointer shadow-sm"
                              >
                                {(() => {
                                  const url = img.url;
                                  const isVideo = img.type === 'video';
                                  return isVideo ? (
                                    <video src={url} className="w-full h-full object-cover" />
                                  ) : (
                                    <img loading="lazy" src={url} alt="" className="w-full h-full object-cover" />
                                  );
                                })()}
                              </motion.div>
                            ))}
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
                      <LoadingSpinner size={24} className="border-emerald-500" />
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
                        <img loading="lazy" src={img.url} alt="" className="w-full h-full object-cover" />
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
              <p className="text-[10px] text-stone-500">التعليقات متاحة للموظفين فقط</p>
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
                {property.assigned_employee?.full_name || property.assigned_employee_name || 'غير محدد'}
              </button>
              <p className="text-[10px] text-stone-500">موظف معتمد</p>
              <span className="text-xs font-bold text-stone-600 mt-1">
                {property.assigned_employee?.phone || property.assigned_employee_phone || property.phone}
              </span>
            </div>
            
            {/* Left Side: Icons, Date */}
            <div className="flex flex-col items-start gap-2">
              <div className="flex items-center gap-2" dir="ltr">
                <a
                  href={`https://wa.me/${(property.assigned_employee_phone || property.phone).replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`السلام عليكم، بخصوص هذا العقار: ${window.location.href}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 flex items-center justify-center text-green-600 bg-stone-50 border border-stone-100 hover:bg-green-50 rounded-full transition-colors shadow-sm"
                  title="واتساب"
                >
                  <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                </a>
                <a 
                  href={`tel:${property.assigned_employee_phone || property.phone}`}
                  className="w-8 h-8 flex items-center justify-center text-emerald-600 bg-stone-50 border border-stone-100 hover:bg-emerald-50 rounded-full transition-colors shadow-sm"
                  title="اتصال"
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
            {PROPERTY_TYPES.includes(property.type) && (
              <button onClick={() => onFilter('type', property.type)} className="flex items-center justify-center p-2 bg-stone-50/50 rounded-lg border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98]">
                <span className="text-xs font-bold text-stone-800">{property.type}</span>
              </button>
            )}

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
            {property.houseNumber && (
              <button onClick={() => onFilter('houseNumber', property.houseNumber)} className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 hover:border-emerald-300 hover:bg-emerald-50 transition-all active:scale-[0.98] text-right">
                <span className="text-[10px] text-stone-500 mb-1">المنزل</span>
                <span className="text-xs font-bold text-stone-800">{property.houseNumber}</span>
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
            {property.locationLink && (
              <div className="flex flex-col items-start p-3 bg-stone-50/50 rounded-xl border border-stone-100 text-right col-span-2">
                <span className="text-[10px] text-stone-500 mb-1">رابط العنوان</span>
                <a href={property.locationLink} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-blue-600 hover:underline truncate w-full" dir="ltr">
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
