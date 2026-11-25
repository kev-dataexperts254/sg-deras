import React, { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import { isSafeImageUrl } from '../utils/formatters';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export const SafeImage: React.FC<SafeImageProps> = ({
  src,
  alt,
  className = '',
  fallbackTitle,
}) => {
  const [failed, setFailed] = useState(false);
  const validSrc = src && isSafeImageUrl(src) ? src : '';

  if (!validSrc || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-stone-100 via-amber-50/40 to-stone-200 text-zinc-500 p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <ShoppingBag className="w-7 h-7 text-amber-700/60 mb-2" strokeWidth={1.5} />
        <span className="text-xs font-medium text-zinc-600 line-clamp-2 max-w-[16ch]">
          {fallbackTitle || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={validSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
