import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, 
  Edit, 
  Trash2, 
  Image as ImageIcon,
  RefreshCw,
  Share2,
  Tag
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cleanAreaName, generatePropertyTitle, formatRelativeDate } from '../utils';

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
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`ios-card overflow-hidden hover:shadow-xl transition-all group relative flex flex-col cursor-pointer bg-white border border-stone-100 ${view === 'pending-properties' ? 'ring-2 ring-amber-500/20' : ''}`}
      onClick={() => onClick && onClick(property)}
    >
      {/* Image Header — only rendered when image exists */}
      {firstImageUrl ? (
        <div
          className="relative aspect-[16/10] bg-stone-100 overflow-hidden group/img shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onImageClick(images, 0);
          }}
        >
          <div className="w-full h-full">
            {isVideo ? (
              <video src={firstImageUrl} className={`w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110 ${property.is_sold ? 'grayscale opacity-60' : ''}`} />
            ) : (
              <img
                loading="lazy"
                src={firstImageUrl}
                alt={property.name}
                className={`w-full h-full object-cover transition-transform duration-700 group-hover/img:scale-110 ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                referrerPolicy="no-referrer"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/img:opacity-100 transition-opacity flex items-end p-3">
              <span className="text-white text-[10px] bg-black/40 backdrop-blur-md px-2 py-1 rounded-full flex items-center gap-1.5 font-bold">
                <ImageIcon size={12} />
                عرض {images.length} {images.length === 1 ? 'صورة' : 'صور'}
              </span>
            </div>
          </div>

          {/* Status badges */}
          {property.is_sold && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm z-20 pointer-events-none">
              <span className="text-white font-black text-2xl tracking-wider transform -rotate-12 border-4 border-white px-4 py-1.5 rounded-xl shadow-2xl">مباع</span>
            </div>
          )}
          {property.status_label && (
            <div className="absolute top-3 left-3 z-30">
              <span className="bg-amber-500 text-white px-2 py-1 rounded-lg text-[10px] font-black shadow-lg flex items-center gap-1">
                <Tag size={10} />
                {property.status_label}
              </span>
            </div>
          )}
        </div>
      ) : (
        /* No image — show compact top bar with sold/label badges if needed */
        (property.is_sold || property.status_label) ? (
          <div className="relative flex items-center gap-2 px-3 pt-3">
            {property.is_sold && (
              <span className="text-red-600 font-black text-[10px] border border-red-200 bg-red-50 px-2 py-0.5 rounded-lg">مباع</span>
            )}
            {property.status_label && (
              <span className="bg-amber-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1">
                <Tag size={10} />
                {property.status_label}
              </span>
            )}
          </div>
        ) : null
      )}

      <div className="p-4 flex-1 flex flex-col">
        <div className="flex justify-between items-start gap-2 mb-2">
           <h3 className="text-sm font-bold text-stone-900 leading-tight flex-1 text-right">
            {property.name || 'عقار بدون اسم'}
          </h3>
          <span className="text-emerald-600 font-black text-xs shrink-0">{property.price}</span>
        </div>

        <p className="text-[11px] text-stone-500 line-clamp-2 text-right mb-3 leading-relaxed flex-1 italic">
          {property.details || property.last_comment || 'لا توجد تفاصيل إضافية'}
        </p>
      </div>

      {/* Footer: Area + Purpose + Type */}
      <div className="flex items-center gap-1.5 mt-auto pt-1 pb-1 text-[10px] font-bold text-stone-700">
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
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (onFilter && property.purpose) onFilter('purpose', property.purpose);
          }}
          className="text-emerald-600 hover:underline truncate max-w-[30%]"
        >
          {property.purpose || '-'}
        </button>
        <span>|</span>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            if (onFilter && property.type) {
              onFilter('type', property.type);
            }
          }}
          className="hover:text-emerald-600 hover:underline truncate max-w-[30%]"
        >
          {property.type || 'غير محدد'}
        </button>
      </div>

      {/* Footer: Icons + Time */}
      <div className="flex items-center justify-between pt-0.5">
        {property.created_at && (
          <span className="text-[9px] text-stone-400 font-normal">
            {formatRelativeDate(property.created_at)}
          </span>
        )}
        <div className="flex items-center gap-1">
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
            <>
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
                  const shareUrl = `${window.location.origin}?propertyId=${property.id}`;
                  if (navigator.share) {
                    navigator.share({
                      title: property.name || 'عقار',
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
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onFavorite) onFavorite(property.id);
                }}
                className={`p-1.5 rounded-lg transition-all ${isFavorite ? 'text-red-500' : 'text-stone-500 hover:bg-stone-100'}`}
              >
                <Heart size={16} fill={isFavorite ? "currentColor" : "none"} />
              </button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
});
