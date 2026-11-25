import React from 'react';
import { Heart, ShoppingBag } from 'lucide-react';
import { Product } from '../types';
import { formatKSh, getDiscountPercent, getEffectivePrice } from '../utils/formatters';
import { SafeImage } from './SafeImage';

interface ProductCardProps {
  product: Product;
  isWishlisted: boolean;
  onToggleWishlist: (productId: string) => void;
  onOpenProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  isWishlisted,
  onToggleWishlist,
  onOpenProduct,
  onQuickAdd,
}) => {
  const effectivePrice = getEffectivePrice(product);
  const discount = getDiscountPercent(product.price, product.salePrice);
  const inStock = product.stock > 0;
  const stockLabel =
    product.stock <= 0
      ? 'Out of stock'
      : product.stock <= 5
        ? `Only ${product.stock} left`
        : 'In stock';

  return (
    <article className="group flex flex-col bg-white border border-stone-200 rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="relative aspect-[3/4] bg-[#F6F5F2] overflow-hidden">
        <button
          type="button"
          onClick={() => onOpenProduct(product)}
          className="w-full h-full block text-left focus-visible:outline-2 focus-visible:outline-red-700"
          aria-label={`View details for ${product.name}`}
        >
          <SafeImage
            src={product.images[0]}
            alt={product.name}
            fallbackTitle={product.name}
            className="w-full h-full object-cover object-center transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleWishlist(product.id);
          }}
          aria-label={isWishlisted ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/95 border border-stone-200 flex items-center justify-center text-zinc-700 hover:text-red-700 transition-colors shadow-xs"
        >
          <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-red-600 text-red-600' : ''}`} />
        </button>
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-1">
            <span className="font-medium text-zinc-600">{product.category}</span>
            <span aria-hidden="true">·</span>
            <span className={inStock ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
              {stockLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpenProduct(product)}
            className="text-left w-full focus-visible:outline-2 focus-visible:outline-red-700 rounded"
          >
            <h3 className="text-[15px] font-semibold text-zinc-900 leading-snug line-clamp-2 group-hover:text-red-700 transition-colors">
              {product.name}
            </h3>
          </button>

          <p className="text-xs text-zinc-500 mt-1 truncate">
            {product.variants.join(' · ')}
          </p>
        </div>

        <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-[15px] font-bold text-zinc-950 tabular-nums">
                {formatKSh(effectivePrice)}
              </span>
              {discount > 0 && (
                <span className="text-xs text-zinc-400 line-through tabular-nums">
                  {formatKSh(product.price)}
                </span>
              )}
            </div>
            {discount > 0 && (
              <span className="text-xs font-semibold text-red-700 tabular-nums">
                Save {discount}%
              </span>
            )}
          </div>

          <button
            type="button"
            disabled={!inStock}
            onClick={() => onQuickAdd(product)}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 flex items-center gap-1.5 transition-colors bg-zinc-950 text-white hover:bg-red-700 disabled:bg-stone-200 disabled:text-zinc-500 disabled:cursor-not-allowed"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{inStock ? 'Add' : 'Sold Out'}</span>
          </button>
        </div>
      </div>
    </article>
  );
};
