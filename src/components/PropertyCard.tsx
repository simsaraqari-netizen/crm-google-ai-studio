import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { 
  Heart, 
  Edit, 
  Trash2, 
  Image as ImageIcon,
  RefreshCw,
  Share2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cleanAreaName, generatePropertyTitle, formatRelativeDate } from '../utils';

export const PropertyCard = memo(function PropertyCard({ property, isFavorite, onFavorite, onClick, onImageClick, isAdmin, onFilter, onUserClick, onApprove, onReject, onEdit, onDelete, onRestore, onPermanentDelete, view }: any) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`ios-card overflow-hidden hover:shadow-lg transition-all group relative flex flex-col p-4 pb-2 min-h-[140px] cursor-pointer ${view === 'pending-properties' ? 'border-amber-300' : ''}`}
      onClick={() => onClick && onClick(property)}
    >
      {/* Title - Full Width */}
      <h3 className="text-xs font-bold text-stone-900 mb-2 line-clamp-2 leading-tight w-full text-right">
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
            (() => {
              const img = property.images[0];
              const url = typeof img === 'string' ? img : img.url;
              const isVideo = typeof img === 'string' ? img.startsWith('data:video/') : img.type === 'video';
              
              return (
                <>
                  {isVideo ? (
                    <video 
                      src={url} 
                      className={`w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-110 ${property.is_sold ? 'grayscale opacity-60' : ''}`}
                    />
                  ) : (
                    <img 
                      loading="lazy"
                      src={url} 
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
              );
            })()
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
                  const shareUrl = `${window.location.origin}?property_id=${property.id}`;
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
