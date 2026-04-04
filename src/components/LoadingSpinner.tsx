import React from 'react';

export const LoadingSpinner = ({ size = 20, className = "" }: { size?: number, className?: string }) => {
  return (
    <div 
      className={`animate-spin rounded-full border-t-2 border-b-2 border-emerald-600 ${className}`}
      style={{ width: size, height: size }}
    />
  );
};
