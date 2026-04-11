import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  Share2,
  Tag,
  MessageSquare
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cleanAreaName, formatRelativeDate, getPropertyCode, formatDateTime } from '../utils';

export const PropertyCard = memo(function PropertyCard({ property, isFavorite, onFavorite, onClick, onImageClick, isAdmin, onFilter, onUserClick, onApprove, onReject, onEdit, onDelete, onRestore, onPermanentDelete, view }: any) {
  const images = React.useMemo(() => {
    const raw = property.images && Array.isArray(property.images) ? property.images : [];
    const fallback = property.image_url || property.imageUrl || property.image || property.photo || '';
    const unified = raw.map((img: any) => typeof img === 'string' ? img : img.url).filter(Boolean);
    if (fallback && !unified.includes(fallback)) unified.push(fallback);
    return unified;
  }, [property]);

  const firstImageUrl = images[0] || '';
  const isVideo = firstImageUrl.toLowerCase().includes('.mp4') || firstImageUrl.toLowerCase().includes('.mov') || firstImageUrl.startsWith('data:video/');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`ios-card overflow-hidden hover:shadow-lg transition-all group relative flex flex-col cursor-pointer bg-white border border-stone-100 ${view === 'pending-properties' ? 'ring-2 ring-amber-500/20' : ''}`}
      onClick={() => onClick && onClick(property)}
    >
      {/* ── Image — hidden when no photo ── */}
      {firstImageUrl ? (
        <div
          className="relative aspect-[16/9] bg-stone-100 overflow-hidden group/img shrink-0"
          onClick={(e) => { e.stopPropagation(); onImageClick(images, 0); }}
        >
          {isVideo ? (
            <video src={firstImageUrl} className={`w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105 ${property.is_sold ? 'grayscale opacity-60' : ''}`} />
          ) : (
            <img
              loading="lazy"
              src={firstImageUrl}
              alt={property.name}
              className={`w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-105 ${property.is_sold ? 'grayscale opacity-60' : ''}`}
              referrerPolicy="no-referrer"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end p-2">
            <span className="text-white text-[11px] bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 font-bold">
              <ImageIcon size={13} />
              {images.length} {images.length === 1 ? 'صورة' : 'صور'}
            </span>
          </div>

          {property.is_sold && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm z-20 pointer-events-none">
              <span className="text-white font-black text-2xl tracking-wider transform -rotate-12 border-4 border-white px-4 py-1.5 rounded-xl shadow-2xl">مباع</span>
            </div>
          )}
          {property.status_label && (
            <div className="absolute top-2 left-2 z-30">
              <span className="bg-amber-500 text-white px-2.5 py-1 rounded-md text-[11px] font-black shadow flex items-center gap-1.5">
                <Tag size={11} />
                {property.status_label}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* No image — tiny badges row if sold/labeled */
        (property.is_sold || property.status_label) ? (
          <div className="flex items-center gap-1.5 px-3 pt-2.5">
            {property.is_sold && (
              <span className="text-red-600 font-black text-[10px] border border-red-200 bg-red-50 px-2 py-0.5 rounded-md">مباع</span>
            )}
            {property.status_label && (
              <span className="bg-amber-500 text-white px-2.5 py-1 rounded-md text-[11px] font-black flex items-center gap-1.5">
                <Tag size={11} />
                {property.status_label}
              </span>
            )}
          </div>
        ) : null
      )}

      {/* ── Body ── */}
      <div className="px-3 pt-2.5 pb-1 flex-1 flex flex-col gap-1">
        {/* Title */}
        <h3 className="text-[17px] font-bold text-stone-900 leading-snug text-right w-full">
          {property.name || 'عقار بدون اسم'}
        </h3>

        {/* Price — only if set */}
        {property.price && (
          <span className="text-emerald-600 font-black text-sm text-right">{property.price}</span>
        )}

        {/* Latest Comment Box */}
        {property.last_comment && (
          <div className="mt-2 p-2.5 bg-emerald-50/50 rounded-xl border border-emerald-100/50 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1.5 border-b border-emerald-100/30 pb-1">
              <div className="flex items-center gap-1.5 text-emerald-700 font-black text-[10px] uppercase tracking-wider">
                <MessageSquare size={12} className="shrink-0" />
                آخر تعليق
              </div>
              {property.last_comment_at && (
                <span className="text-[10px] text-emerald-600/70 font-bold" dir="ltr">
                  {formatDateTime(property.last_comment_at)}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-600 line-clamp-2 text-right leading-relaxed font-medium">
              {property.last_comment}
            </p>
          </div>
        )}

        {/* ── Tags: Area · Purpose · Type ── */}
        <div className="flex flex-wrap gap-1 justify-end mt-1">
          {property.area && (
            <button
              onClick={(e) => { e.stopPropagation(); if (onFilter) onFilter('area', property.area); }}
              className="bg-stone-100 hover:bg-stone-200 text-stone-600 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors"
            >
              {cleanAreaName(property.area)}
            </button>
          )}
          {property.purpose && (
            <button
              onClick={(e) => { e.stopPropagation(); if (onFilter) onFilter('purpose', property.purpose); }}
              className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors"
            >
              {property.purpose}
            </button>
          )}
          {property.type && (
            <button
              onClick={(e) => { e.stopPropagation(); if (onFilter) onFilter('type', property.type); }}
              className="bg-sky-50 hover:bg-sky-100 text-sky-700 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors"
            >
              {property.type}
            </button>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-stone-50">
        {/* Left: timestamp */}
        <span className="text-[10px] text-stone-400">
          {property.created_at ? formatRelativeDate(property.created_at) : ''}
        </span>

        {/* Right: code + actions */}
        <div className="flex items-center gap-1">
          {/* Property code — always visible on the right */}
          <span className="text-[11px] font-black text-stone-400 tracking-widest ml-1">
            #{getPropertyCode(property)}
          </span>

          {/* Context-aware action buttons */}
          {view === 'pending-properties' && isAdmin ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onApprove(property.id); }}
                className="bg-emerald-600 text-white px-2.5 py-1 rounded-md text-[10px] font-bold"
              >قبول</button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject(property.id); }}
                className="bg-red-600 text-white px-2.5 py-1 rounded-md text-[10px] font-bold mr-0.5"
              >رفض</button>
            </>
          ) : view === 'trash' && isAdmin ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); if (onRestore) onRestore(property.id); }}
                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                title="استعادة"
              >
                <RefreshCw size={21} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); if (onPermanentDelete) onPermanentDelete(property.id); }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"
                title="حذف نهائي"
              >
                <Trash2 size={21} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const code = getPropertyCode(property);
                  const base = window.location.origin + window.location.pathname;
                  const shareUrl = `${base}#p${code}`;
                  const title = property.name || 'عقار';
                  const text = `${title}\n${shareUrl}`;

                  if (navigator.share) {
                    try {
                      if (images.length > 0 && (navigator as any).canShare) {
                        const resp = await fetch(images[0]).catch(() => null);
                        if (resp?.ok) {
                          const blob = await resp.blob();
                          const file = new File([blob], 'property.jpg', { type: blob.type });
                          if ((navigator as any).canShare({ files: [file] })) {
                            await navigator.share({ title, text: title, files: [file], url: shareUrl });
                            return;
                          }
                        }
                      }
                      await navigator.share({ title, text: title, url: shareUrl });
                    } catch (err: any) {
                      if (err?.name !== 'AbortError') {
                        navigator.clipboard.writeText(text).catch(() => {});
                        toast.success('تم نسخ رابط العقار');
                      }
                    }
                  } else {
                    navigator.clipboard.writeText(text).catch(() => {});
                    toast.success('تم نسخ رابط العقار');
                  }
                }}
                className="p-2 text-stone-400 hover:bg-stone-100 rounded-lg transition-all"
                title="مشاركة"
              >
                <Share2 size={21} />
              </button>
              {/* Favorite */}
              <button
                onClick={(e) => { e.stopPropagation(); if (onFavorite) onFavorite(property.id); }}
                className={`p-2 rounded-lg transition-all ${isFavorite ? 'text-red-500' : 'text-stone-400 hover:bg-stone-100'}`}
              >
                <Heart size={21} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});
