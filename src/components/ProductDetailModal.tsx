import React, { useEffect, useState } from 'react';
import { Check, Heart, Minus, Plus, ShoppingBag, Truck, X } from 'lucide-react';
import { Product } from '../types';
import { formatKSh, getDiscountPercent, getEffectivePrice } from '../utils/formatters';
import { SafeImage } from './SafeImage';

interface ProductDetailModalProps {
  product: Product | null;
  isWishlisted: boolean;
  onClose: () => void;
  onToggleWishlist: (productId: string) => void;
  onAddToCart: (product: Product, variant: string, quantity: number) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  isWishlisted,
  onClose,
  onToggleWishlist,
  onAddToCart,
}) => {
  const [selectedImageIdx, setSelectedImageIdx] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  useEffect(() => {
    if (product) {
      setSelectedImageIdx(0);
      setSelectedVariant(product.variants[0] || 'Standard');
      setQuantity(1);
      setAddedFeedback(false);
    }
  }, [product]);

  useEffect(() => {
    if (!product) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [product, onClose]);

  if (!product) return null;

  const effectivePrice = getEffectivePrice(product);
  const discount = getDiscountPercent(product.price, product.salePrice);
  const inStock = product.stock > 0;
  const maxQty = Math.max(1, product.stock);

  const handleAdd = () => {
    if (!inStock) return;
    onAddToCart(product, selectedVariant || product.variants[0] || 'Standard', quantity);
    setAddedFeedback(true);
    setTimeout(() => setAddedFeedback(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-xs p-0 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl bg-white sm:rounded-2xl shadow-xl overflow-hidden my-auto max-h-[100dvh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/95 border border-stone-200 flex items-center justify-center text-zinc-700 hover:text-zinc-950 shadow-xs"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 overflow-y-auto">
          {/* Left: Product Gallery */}
          <div className="bg-[#F6F5F2] p-5 sm:p-6 flex flex-col gap-3">
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-white border border-stone-200">
              <SafeImage
                src={product.images[selectedImageIdx] || product.images[0]}
                alt={`${product.name} photo ${selectedImageIdx + 1}`}
                fallbackTitle={product.name}
                className="w-full h-full object-cover"
              />
            </div>

            {product.images.length > 1 && (
              <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                {product.images.map((img, idx) => (
                  <button
                    key={`${img.slice(0, 32)}-${idx}`}
                    type="button"
                    onClick={() => setSelectedImageIdx(idx)}
                    aria-label={`View photo ${idx + 1}`}
                    className={`w-16 h-20 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${
                      selectedImageIdx === idx ? 'border-red-700' : 'border-transparent opacity-75 hover:opacity-100'
                    }`}
                  >
                    <SafeImage
                      src={img}
                      alt={`${product.name} thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="font-semibold text-zinc-700">{product.category}</span>
                <span aria-hidden="true">·</span>
                <span className={inStock ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                  {inStock ? `In Stock (${product.stock} available)` : 'Out of Stock'}
                </span>
                {product.isNewArrival && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-amber-700 font-medium">New Arrival</span>
                  </>
                )}
              </div>

              <h2 id="pdp-title" className="font-display text-2xl sm:text-3xl font-bold text-zinc-950 leading-tight pr-8">
                {product.name}
              </h2>

              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-2xl font-bold text-zinc-950 tabular-nums">
                  {formatKSh(effectivePrice)}
                </span>
                {discount > 0 && (
                  <>
                    <span className="text-base text-zinc-400 line-through tabular-nums">
                      {formatKSh(product.price)}
                    </span>
                    <span className="text-sm font-semibold text-red-700 tabular-nums">
                      {discount}% OFF
                    </span>
                  </>
                )}
              </div>

              <p className="text-sm text-zinc-600 leading-relaxed">
                {product.description}
              </p>

              {/* Size / Variant Selection */}
              <div className="pt-2">
                <span className="block text-xs font-semibold text-zinc-800 mb-2">
                  Select Size / Variant
                </span>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      onClick={() => setSelectedVariant(variant)}
                      className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
                        selectedVariant === variant
                          ? 'bg-zinc-950 text-white border-zinc-950'
                          : 'bg-white text-zinc-700 border-stone-300 hover:border-zinc-950'
                      }`}
                    >
                      {variant}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity Selection */}
              <div className="pt-1">
                <span className="block text-xs font-semibold text-zinc-800 mb-2">
                  Quantity
                </span>
                <div className="inline-flex items-center border border-stone-300 rounded-lg bg-white">
                  <button
                    type="button"
                    disabled={!inStock || quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Decrease quantity"
                    className="w-10 h-10 flex items-center justify-center text-zinc-700 hover:bg-stone-100 disabled:opacity-40 rounded-l-lg"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-12 text-center text-sm font-semibold tabular-nums text-zinc-950">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={!inStock || quantity >= maxQty}
                    onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                    aria-label="Increase quantity"
                    className="w-10 h-10 flex items-center justify-center text-zinc-700 hover:bg-stone-100 disabled:opacity-40 rounded-r-lg"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-4 border-t border-stone-200">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!inStock}
                  onClick={handleAdd}
                  className="flex-1 py-3.5 px-5 rounded-xl bg-red-700 hover:bg-red-800 disabled:bg-stone-200 disabled:text-zinc-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  {addedFeedback ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Added to Bag</span>
                    </>
                  ) : (
                    <>
                      <ShoppingBag className="w-4 h-4" />
                      <span>
                        {inStock
                          ? `Add to Bag · ${formatKSh(effectivePrice * quantity)}`
                          : 'Currently Out of Stock'}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleWishlist(product.id)}
                  aria-label={isWishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                  className={`w-12 h-12 rounded-xl border flex items-center justify-center transition-colors shrink-0 ${
                    isWishlisted
                      ? 'bg-red-50 border-red-200 text-red-700'
                      : 'bg-white border-stone-300 text-zinc-700 hover:border-zinc-950'
                  }`}
                >
                  <Heart className={`w-5 h-5 ${isWishlisted ? 'fill-red-600 text-red-600' : ''}`} />
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-zinc-600 bg-stone-50 border border-stone-200 rounded-lg px-3.5 py-2.5">
                <Truck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Same-day Nairobi doorstep delivery &amp; countrywide/worldwide dispatch available at checkout.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
