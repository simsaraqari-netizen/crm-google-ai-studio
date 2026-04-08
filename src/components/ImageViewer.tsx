import { useState } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

export function ImageViewer({ images, initialIndex, onClose, isSold }: any) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  return (
    <div className="fixed inset-0 z-[110] bg-black/95 flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-6 right-6 text-white/70 hover:text-white p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all z-[120]"
      >
        <X size={32} />
      </button>

      {images.length > 1 && (
        <>
          <button 
            onClick={() => setCurrentIndex((prev: number) => (prev === 0 ? images.length - 1 : prev - 1))}
            className="absolute left-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-3 bg-white/10 rounded-full transition-all"
          >
            <ChevronLeft size={32} />
          </button>
          <button 
            onClick={() => setCurrentIndex((prev: number) => (prev === images.length - 1 ? 0 : prev + 1))}
            className="absolute right-6 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 bg-white/10 rounded-full transition-all"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}

        <div className="max-w-5xl w-full h-full flex items-center justify-center relative">
        {(() => {
          const img = images[currentIndex];
          const isVideo = typeof img === 'string' && (img.startsWith('data:video/') || img.toLowerCase().endsWith('.mp4') || img.includes('/video/'));
          
          return isVideo ? (
            <video 
              src={img} 
              controls 
              autoPlay
              className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl ${isSold ? 'grayscale opacity-60' : ''}`}
            />
          ) : (
            <img 
              loading="lazy"
              src={img} 
              className={`max-w-full max-h-full object-contain rounded-lg shadow-2xl ${isSold ? 'grayscale opacity-60' : ''}`} 
              referrerPolicy="no-referrer"
              alt=""
            />
          );
        })()}
        {isSold && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <span className="text-white font-black text-6xl tracking-wider transform -rotate-12 border-4 border-white px-8 py-3 rounded-2xl shadow-2xl bg-stone-700/80 backdrop-blur-sm">مباع</span>
          </div>
        )}
      </div>

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm font-bold">
        {currentIndex + 1} / {images.length}
      </div>
    </div>
  );
}
