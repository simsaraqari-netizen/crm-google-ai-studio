import React, { memo } from 'react';
import { motion } from 'framer-motion';
import {
  Heart,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  Share2,
  Tag,
  MessageSquare,
  UserPlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cleanAreaName, formatRelativeDate, getPropertyCode, formatDateTime, exportToVCard } from '../utils';

export const PropertyCard = memo(function PropertyCard({
  property,
  isFavorite,
  onFavorite,
  onClick,
  onImageClick,
  isAdmin,
  onFilter,
  onApprove,
  onReject,
  onRestore,
  onPermanentDelete,
  view
}: any) {
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
      whileHover={{ y: -2 }}
      className={`group relative flex flex-col bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer border border-stone-100 ${view === 'pending-properties' ? 'ring-2 ring-amber-500/20' : ''}`}
      onClick={() => onClick && onClick(property)}
    >
      {/* ── Top Media Section ── */}
      {firstImageUrl ? (
        <div
          className="relative aspect-[16/9] bg-stone-100 overflow-hidden group/img shrink-0"
          onClick={(e) => { e.stopPropagation(); onImageClick?.(images, 0); }}
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

          {/* Photos Count Badge */}
          <div className="absolute bottom-2 right-2 z-10">
            <span className="text-white text-[9px] bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full flex items-center gap-1 font-bold">
              <ImageIcon size={10} />
              {images.length}
            </span>
          </div>

          {/* Sold Overlay */}
          {property.is_sold && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-900/40 backdrop-blur-[2px] z-20 pointer-events-none">
              <span className="text-white font-black text-xl tracking-wider transform -rotate-12 border-4 border-white px-4 py-1.5 rounded-xl shadow-2xl">مباع</span>
            </div>
          )}

          {/* Status Label */}
          {property.status_label && (
            <div className="absolute top-2 right-2 z-30">
              <span className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-[9px] font-black shadow flex items-center gap-1">
                <Tag size={10} />
                {property.status_label}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="h-1 bg-stone-50" />
      )}

      {/* ── Content Body ── */}
      <div className="px-3 pt-3 pb-2 flex-1 flex flex-col gap-2" dir="rtl">
        {/* Title & Price Row */}
        <div className="space-y-0.5">
          <h3 className="text-sm font-black text-stone-900 leading-tight group-hover:text-emerald-700 transition-colors line-clamp-4">
            {property.name || 'عقار بدون اسم'}
          </h3>
          {property.price && (
            <span className="text-emerald-600 font-black text-xs block">{property.price}</span>
          )}
        </div>

        {/* Latest Comment */}
        {property.last_comment && (
          <div className="border-r-2 border-emerald-400 pr-2">
            <div className="flex items-center justify-between mb-0.5 flex-wrap gap-1">
              <div className="flex items-center gap-1 text-emerald-600 text-[9px] font-black uppercase tracking-wider">
                <MessageSquare size={10} />
                آخر تعليق
              </div>
              {property.last_comment_at && (
                <span className="text-[9px] text-stone-400 font-medium" dir="ltr">
                  {formatDateTime(property.last_comment_at)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-stone-600 line-clamp-1 leading-relaxed">
              {property.last_comment}
            </p>
          </div>
        )}

        {/* Attributes Chips */}
        <div className="flex flex-wrap gap-1 mt-auto">
          {property.area && (
            <button
              onClick={(e) => { e.stopPropagation(); onFilter?.('area', property.area); }}
              className="text-stone-500 text-[9px] font-bold px-2 py-0.5 rounded transition-all border border-stone-200 hover:border-stone-300"
            >
              {cleanAreaName(property.area)}
            </button>
          )}
          {property.type && (
            <button
              onClick={(e) => { e.stopPropagation(); onFilter?.('type', property.type); }}
              className="text-sky-600 text-[9px] font-bold px-2 py-0.5 rounded transition-all border border-sky-200 hover:border-sky-300"
            >
              {property.type}
            </button>
          )}
        </div>
      </div>

      {/* ── Action Footer ── */}
      <div className="px-3 py-2 border-t border-stone-100 flex items-center justify-between" dir="rtl">
        <div className="flex flex-col gap-0">
          <span className="text-[10px] font-black text-stone-400/80 tracking-widest uppercase">
            #{getPropertyCode(property)}
          </span>
          <span className="text-[9px] font-bold text-stone-400">
            {formatRelativeDate(property.created_at || '')}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {view === 'pending-properties' && isAdmin ? (
            <div className="flex gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onApprove?.(property.id); }}
                className="bg-emerald-600 text-white px-3 py-1 rounded-lg text-[10px] font-black active:scale-95 transition-all"
              >قبول</button>
              <button
                onClick={(e) => { e.stopPropagation(); onReject?.(property.id); }}
                className="bg-white text-red-500 border border-red-100 px-3 py-1 rounded-lg text-[10px] font-black active:scale-95 transition-all"
              >رفض</button>
            </div>
          ) : view === 'trash' && isAdmin ? (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onRestore?.(property.id); }}
                className="p-1.5 text-emerald-600 hover:text-emerald-700 rounded-lg transition-all"
                title="استعادة"
              >
                <RefreshCw size={17} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onPermanentDelete?.(property.id); }}
                className="p-1.5 text-red-500 hover:text-red-600 rounded-lg transition-all"
                title="حذف نهائي"
              >
                <Trash2 size={17} />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  const code = getPropertyCode(property);
                  const base = window.location.origin + window.location.pathname;
                  const shareUrl = `${base}?p=${code}`;
                  const title = property.name || 'عقار';
                  const text = `${title}\n🔑 كود العقار: #${code}\n${shareUrl}`;

                  if (navigator.share) {
                    try {
                      await navigator.share({ title, text, url: shareUrl });
                    } catch (err: any) {
                      if (err?.name !== 'AbortError') {
                        navigator.clipboard.writeText(text).catch(() => {});
                        toast.success('تم نسخ الرابط');
                      }
                    }
                  } else {
                    navigator.clipboard.writeText(text).catch(() => {});
                    toast.success('تم نسخ الرابط');
                  }
                }}
                className="p-1.5 text-stone-400 hover:text-emerald-600 rounded-lg transition-all"
                title="مشاركة"
              >
                <Share2 size={17} />
              </button>
              <button
                onClick={(e) => { 
                  e.stopPropagation();
                  exportToVCard(
                    `عقار ${property.name || 'جديد'} - ${getPropertyCode(property)}`,
                    [property.phone, property.phone_2].filter(Boolean) as string[],
                    property.details
                  );
                }}
                className="p-1.5 text-stone-400 hover:text-blue-600 rounded-lg transition-all"
                title="حفظ جهة الاتصال"
              >
                <UserPlus size={17} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onFavorite?.(property.id); }}
                className={`p-1.5 rounded-lg transition-all ${isFavorite ? 'text-red-500' : 'text-stone-400 hover:text-red-500'}`}
              >
                <Heart size={17} fill={isFavorite ? 'currentColor' : 'none'} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});
