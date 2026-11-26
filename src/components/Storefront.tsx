import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Globe,
  Heart,
  MessageCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tag,
  Truck,
} from 'lucide-react';
import { CategoryItem, Product, StoreFilter } from '../types';
import {
  buildWhatsAppUrl,
  formatKSh,
  getEffectivePrice,
  STORE_WHATSAPP_DISPLAY,
  STORE_WHATSAPP_NUMBER,
} from '../utils/formatters';
import { ProductCard } from './ProductCard';
import { SafeImage } from './SafeImage';

interface StorefrontProps {
  products: Product[];
  categories: CategoryItem[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  activeFilter: StoreFilter;
  onSelectFilter: (filter: StoreFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  wishlistIds: string[];
  onToggleWishlist: (productId: string) => void;
  onOpenProduct: (product: Product) => void;
  onQuickAdd: (product: Product) => void;
  onOpenAdmin: () => void;
}

type SortMode = 'featured' | 'price_asc' | 'price_desc';

export const Storefront: React.FC<StorefrontProps> = ({
  products,
  categories,
  activeCategory,
  onSelectCategory,
  activeFilter,
  onSelectFilter,
  searchQuery,
  onSearchChange,
  wishlistIds,
  onToggleWishlist,
  onOpenProduct,
  onQuickAdd,
  onOpenAdmin,
}) => {
  const [sortMode, setSortMode] = useState<SortMode>('featured');

  const visibleProducts = useMemo(() => {
    return products.filter((p) => p.active);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const list = visibleProducts.filter((p) => {
      if (activeCategory !== 'All' && p.category !== activeCategory) return false;
      if (activeFilter === 'new_arrivals' && !p.isNewArrival) return false;
      if (activeFilter === 'best_sellers' && !p.isBestSeller) return false;
      if (activeFilter === 'sale' && !(p.salePrice > 0 && p.salePrice < p.price)) return false;
      if (activeFilter === 'wishlist' && !wishlistIds.includes(p.id)) return false;

      if (query) {
        const hay = `${p.name} ${p.category} ${p.description} ${p.variants.join(' ')}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });

    if (sortMode === 'price_asc') {
      return [...list].sort((a, b) => getEffectivePrice(a) - getEffectivePrice(b));
    }
    if (sortMode === 'price_desc') {
      return [...list].sort((a, b) => getEffectivePrice(b) - getEffectivePrice(a));
    }
    return list;
  }, [visibleProducts, activeCategory, activeFilter, searchQuery, wishlistIds, sortMode]);

  const newArrivals = useMemo(
    () => visibleProducts.filter((p) => p.isNewArrival).slice(0, 4),
    [visibleProducts]
  );

  const bestSellers = useMemo(
    () => visibleProducts.filter((p) => p.isBestSeller).slice(0, 4),
    [visibleProducts]
  );

  const isFiltering =
    activeCategory !== 'All' ||
    activeFilter !== 'all' ||
    searchQuery.trim().length > 0 ||
    sortMode !== 'featured';

  const scrollToCatalog = () => {
    document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCategoryJump = (categoryName: string, filter: StoreFilter = 'all') => {
    onSelectCategory(categoryName);
    onSelectFilter(filter);
    scrollToCatalog();
  };

  return (
    <main className="bg-white">
      {/* 1. Editorial Hero Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8">
        <div className="relative rounded-2xl overflow-hidden bg-[#F3EFE8] border border-stone-200 min-h-[380px] sm:min-h-[440px] lg:min-h-[480px] flex items-center">
          <img
            src="/src/assets/images/hero_sg_collections_1795635219118.jpg"
            alt="SG Wholesalers Silk Dera Collection"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover object-center lg:object-right"
          />
          <div
            className="absolute inset-0 bg-gradient-to-r from-[#F7F3EC]/95 via-[#F7F3EC]/85 to-[#F7F3EC]/15 sm:via-[#F7F3EC]/75 sm:to-transparent"
            aria-hidden="true"
          />

          <div className="relative z-10 max-w-xl p-6 sm:p-10 lg:p-14 space-y-5">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide uppercase text-red-700">
              <span>SG Wholesalers Nairobi</span>
              <span aria-hidden="true">·</span>
              <span>We deliver countrywide and world wide</span>
            </div>

            <h1 className="font-display text-3xl sm:text-5xl font-bold text-zinc-950 leading-[1.08] text-balance">
              Elevated Styles for Every Wardrobe
            </h1>

            <p className="text-sm sm:text-base text-zinc-700 leading-relaxed max-w-md">
              Discover flowing SG Deras, durable SG Kids Coset outfits, and Grade-A Mutumba Bales priced transparently in Kenyan Shillings.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleCategoryJump('All', 'new_arrivals')}
                className="px-6 py-3 rounded-xl bg-red-700 hover:bg-red-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                Shop New Arrivals
              </button>
              <button
                type="button"
                onClick={() => handleCategoryJump('All', 'sale')}
                className="px-6 py-3 rounded-xl bg-white hover:bg-stone-100 text-zinc-950 border border-stone-300 text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
              >
                View Sale Items
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Quick Category & Collection Strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
        <div className="flex items-center justify-between gap-4 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategoryJump(cat.name, 'all')}
              className="group flex flex-col items-center gap-2.5 min-w-[104px] shrink-0 focus-visible:outline-2 focus-visible:outline-red-700 rounded-xl p-1"
            >
              <div
                className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-2 transition-all bg-stone-100 ${
                  activeCategory === cat.name
                    ? 'border-red-700 shadow-md scale-[1.03]'
                    : 'border-stone-200 group-hover:border-amber-600'
                }`}
              >
                <SafeImage
                  src={cat.image}
                  alt={cat.name}
                  fallbackTitle={cat.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <span className="text-xs sm:text-sm font-semibold text-zinc-900 group-hover:text-red-700 whitespace-nowrap">
                {cat.name}
              </span>
            </button>
          ))}

          <button
            type="button"
            onClick={() => handleCategoryJump('All', 'new_arrivals')}
            className="group flex flex-col items-center gap-2.5 min-w-[104px] shrink-0 p-1"
          >
            <div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 flex items-center justify-center transition-all bg-amber-50 ${
                activeFilter === 'new_arrivals'
                  ? 'border-red-700 shadow-md'
                  : 'border-amber-200 group-hover:border-amber-600'
              }`}
            >
              <Sparkles className="w-7 h-7 text-amber-700" strokeWidth={1.6} />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-zinc-900 group-hover:text-red-700 whitespace-nowrap">
              New Arrivals
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleCategoryJump('All', 'sale')}
            className="group flex flex-col items-center gap-2.5 min-w-[104px] shrink-0 p-1"
          >
            <div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 flex items-center justify-center transition-all bg-red-50 ${
                activeFilter === 'sale'
                  ? 'border-red-700 shadow-md'
                  : 'border-red-200 group-hover:border-red-700'
              }`}
            >
              <Tag className="w-7 h-7 text-red-700" strokeWidth={1.6} />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-zinc-900 group-hover:text-red-700 whitespace-nowrap">
              Sale Offers
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleCategoryJump('All', 'best_sellers')}
            className="group flex flex-col items-center gap-2.5 min-w-[104px] shrink-0 p-1"
          >
            <div
              className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full border-2 flex items-center justify-center transition-all bg-stone-100 ${
                activeFilter === 'best_sellers'
                  ? 'border-red-700 shadow-md'
                  : 'border-stone-200 group-hover:border-zinc-950'
              }`}
            >
              <ShieldCheck className="w-7 h-7 text-zinc-800" strokeWidth={1.6} />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-zinc-900 group-hover:text-red-700 whitespace-nowrap">
              Best Sellers
            </span>
          </button>
        </div>

        {/* 3-Column Feature Cards for the 3 Core Categories */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
          <button
            type="button"
            onClick={() => handleCategoryJump('SG Deras', 'all')}
            className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-rose-50 to-amber-50 border border-stone-200 p-6 text-left flex items-center justify-between gap-4 hover:shadow-md transition-all"
          >
            <div className="space-y-2 z-10">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                Coastal &amp; Silk Collection
              </p>
              <h2 className="font-display text-2xl font-bold text-zinc-950">SG Deras</h2>
              <p className="text-xs text-zinc-600 max-w-[20ch]">
                Vibrant Swahili silk &amp; chiffon deras from {formatKSh(1850)}
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 pt-1 group-hover:text-red-700">
                Shop Now <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="w-24 h-32 rounded-xl overflow-hidden shrink-0 border border-stone-200 bg-white">
              <SafeImage
                src="/src/assets/images/product_dera_emerald_1795635219395.jpg"
                alt="SG Deras"
                className="w-full h-full object-cover"
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleCategoryJump('SG Kids Coset', 'all')}
            className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-amber-50 to-stone-100 border border-stone-200 p-6 text-left flex items-center justify-between gap-4 hover:shadow-md transition-all"
          >
            <div className="space-y-2 z-10">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
                Boys &amp; Girls Sets
              </p>
              <h2 className="font-display text-2xl font-bold text-zinc-950">SG Kids Coset</h2>
              <p className="text-xs text-zinc-600 max-w-[20ch]">
                Breathable matching two-piece sets for ages 2–10
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 pt-1 group-hover:text-red-700">
                Shop Now <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="w-24 h-32 rounded-xl overflow-hidden shrink-0 border border-stone-200 bg-white">
              <SafeImage
                src="/src/assets/images/product_kids_coset_girls_1795635220786.jpg"
                alt="SG Kids Coset"
                className="w-full h-full object-cover"
              />
            </div>
          </button>

          <button
            type="button"
            onClick={() => handleCategoryJump('Mutumba Bales', 'all')}
            className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-stone-100 to-zinc-100 border border-stone-200 p-6 text-left flex items-center justify-between gap-4 hover:shadow-md transition-all"
          >
            <div className="space-y-2 z-10">
              <p className="text-xs font-semibold text-zinc-700 uppercase tracking-wide">
                Wholesale Grade-A
              </p>
              <h2 className="font-display text-2xl font-bold text-zinc-950">Mutumba Bales</h2>
              <p className="text-xs text-zinc-600 max-w-[20ch]">
                Sealed &amp; sorted 45kg–100kg bales for boutique resellers
              </p>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 pt-1 group-hover:text-red-700">
                Shop Now <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <div className="w-24 h-32 rounded-xl overflow-hidden shrink-0 border border-stone-200 bg-white">
              <SafeImage
                src="/src/assets/images/product_mutumba_sorted_open_1795635222020.jpg"
                alt="Mutumba Bales"
                className="w-full h-full object-cover"
              />
            </div>
          </button>
        </div>
      </section>

      {/* 3. Filterable Catalog Section */}
      <section id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-stone-100">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-zinc-950">
              {activeFilter === 'wishlist'
                ? 'Saved Wishlist'
                : activeCategory === 'All'
                  ? 'Shop All Collections'
                  : activeCategory}
            </h2>
            <p className="text-sm text-zinc-500 mt-1 tabular-nums">
              Showing {filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} in KSh
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Segmented Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 rounded-lg overflow-x-auto max-w-full">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'new_arrivals', label: 'New Arrivals' },
                  { id: 'sale', label: 'On Sale' },
                  { id: 'best_sellers', label: 'Best Sellers' },
                  { id: 'wishlist', label: `Wishlist (${wishlistIds.length})` },
                ] as { id: StoreFilter; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onSelectFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeFilter === tab.id
                      ? 'bg-white text-zinc-950 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-950'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              aria-label="Sort products"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="px-3 py-2 text-xs font-semibold bg-white border border-stone-300 rounded-lg text-zinc-800 focus:outline-none focus:border-red-700"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Category Filter Pills (Interactive Filter Controls) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-2">
          <button
            type="button"
            onClick={() => onSelectCategory('All')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
              activeCategory === 'All'
                ? 'bg-zinc-950 text-white border-zinc-950'
                : 'bg-white text-zinc-700 border-stone-300 hover:border-zinc-950'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.name)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 border transition-colors ${
                activeCategory === cat.name
                  ? 'bg-zinc-950 text-white border-zinc-950'
                  : 'bg-white text-zinc-700 border-stone-300 hover:border-zinc-950'
              }`}
            >
              {cat.name}
            </button>
          ))}
          {isFiltering && (
            <button
              type="button"
              onClick={() => {
                onSelectCategory('All');
                onSelectFilter('all');
                onSearchChange('');
                setSortMode('featured');
              }}
              className="px-3 py-2 text-xs font-semibold text-red-700 hover:text-red-800 whitespace-nowrap shrink-0"
            >
              Reset Filters
            </button>
          )}
        </div>

        {filteredProducts.length === 0 ? (
          <div className="py-16 px-6 text-center bg-stone-50 border border-stone-200 rounded-2xl space-y-3">
            <Heart className="w-8 h-8 text-zinc-400 mx-auto" />
            <h3 className="text-lg font-semibold text-zinc-900">
              {activeFilter === 'wishlist'
                ? 'No saved items in your wishlist yet'
                : 'No matching products found'}
            </h3>
            <p className="text-sm text-zinc-600 max-w-md mx-auto">
              {activeFilter === 'wishlist'
                ? 'Tap the heart icon on any SG Dera, Kids Coset, or Mutumba Bale to save it here.'
                : 'Try clearing your search or switching back to all categories.'}
            </p>
            <button
              type="button"
              onClick={() => {
                onSelectCategory('All');
                onSelectFilter('all');
                onSearchChange('');
              }}
              className="px-5 py-2.5 bg-zinc-950 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors"
            >
              Show All Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isWishlisted={wishlistIds.includes(product.id)}
                onToggleWishlist={onToggleWishlist}
                onOpenProduct={onOpenProduct}
                onQuickAdd={onQuickAdd}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Value & Trust Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <div className="rounded-2xl bg-gradient-to-r from-zinc-950 via-red-900 to-amber-800 text-white p-6 sm:p-8 grid grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Grade-A Verified</p>
              <p className="text-xs text-white/80 mt-0.5">Hand-checked deras, cosets &amp; bales</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Truck className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Nairobi Express Delivery</p>
              <p className="text-xs text-white/80 mt-0.5">Same-day doorstep option at checkout</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Countrywide &amp; Worldwide</p>
              <p className="text-xs text-white/80 mt-0.5">We deliver countrywide and world wide</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RotateCcw className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">7-Day Easy Exchanges</p>
              <p className="text-xs text-white/80 mt-0.5">Simple size &amp; item exchanges</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Curated Highlights when viewing default storefront */}
      {!isFiltering && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">
          {newArrivals.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-2xl font-bold text-zinc-950">New Arrivals</h2>
                <button
                  type="button"
                  onClick={() => handleCategoryJump('All', 'new_arrivals')}
                  className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1"
                >
                  View All <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {newArrivals.map((product) => (
                  <ProductCard
                    key={`new-${product.id}`}
                    product={product}
                    isWishlisted={wishlistIds.includes(product.id)}
                    onToggleWishlist={onToggleWishlist}
                    onOpenProduct={onOpenProduct}
                    onQuickAdd={onQuickAdd}
                  />
                ))}
              </div>
            </div>
          )}

          {bestSellers.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-display text-2xl font-bold text-zinc-950">Best Sellers</h2>
                <button
                  type="button"
                  onClick={() => handleCategoryJump('All', 'best_sellers')}
                  className="text-xs font-semibold text-red-700 hover:text-red-800 flex items-center gap-1"
                >
                  View All <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {bestSellers.map((product) => (
                  <ProductCard
                    key={`best-${product.id}`}
                    product={product}
                    isWishlisted={wishlistIds.includes(product.id)}
                    onToggleWishlist={onToggleWishlist}
                    onOpenProduct={onOpenProduct}
                    onQuickAdd={onQuickAdd}
                  />
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 6. Delivery, Returns & Contact Details */}
      <section id="delivery-returns" className="bg-stone-50 border-t border-stone-200 py-14 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-zinc-950 font-semibold">
              <Globe className="w-5 h-5 text-amber-700" />
              <h3>Countrywide &amp; Worldwide Delivery</h3>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">
              We deliver across Kenya via trusted parcel couriers and ship internationally via DHL &amp; air cargo.
            </p>
            <a
              href={buildWhatsAppUrl(
                STORE_WHATSAPP_NUMBER,
                'Hello SG Wholesalers, I would like shipping rates for my location.'
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Storefront WhatsApp: {STORE_WHATSAPP_DISPLAY}</span>
            </a>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-3">
            <div className="flex items-center gap-2.5 text-zinc-950 font-semibold">
              <RotateCcw className="w-5 h-5 text-zinc-800" />
              <h3>Returns &amp; Exchanges</h3>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed">
              Unworn SG Deras and SG Kids Coset items with original tags may be exchanged within 7 days of delivery. Mutumba Bales are inspected before sealing; contact us within 24 hours of opening for bale support.
            </p>
            <p className="text-xs font-medium text-zinc-500">
              Customer Care Hours: Mon–Sat, 8:00 AM – 7:00 PM EAT
            </p>
          </div>
        </div>
      </section>

      {/* 7. Store Footer */}
      <footer className="bg-zinc-950 text-stone-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-zinc-800">
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-3">
              <img
                src="/assets/aistudio/image_5584599e.png"
                alt="SG Wholesalers"
                className="w-11 h-11 rounded-lg object-cover bg-black border border-zinc-800"
              />
              <div>
                <p className="font-display text-lg font-bold text-white">SG Wholesalers</p>
                <p className="text-xs text-amber-400">We deliver countrywide and world wide</p>
              </div>
            </div>
            <p className="text-xs text-zinc-400 max-w-sm leading-relaxed">
              Your trusted Kenyan destination for SG Deras, SG Kids Coset, and Grade-A Mutumba Bales — priced fairly in Kenyan Shillings (KSh).
            </p>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Categories</h4>
            <ul className="space-y-2 text-xs">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => handleCategoryJump(cat.name, 'all')}
                    className="hover:text-white transition-colors"
                  >
                    {cat.name}
                  </button>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  onClick={() => handleCategoryJump('All', 'sale')}
                  className="hover:text-white transition-colors"
                >
                  Sale Offers
                </button>
              </li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-white">Contact &amp; Store</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href={buildWhatsAppUrl(STORE_WHATSAPP_NUMBER, 'Hello SG Wholesalers!')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors"
                >
                  Orders WhatsApp: {STORE_WHATSAPP_DISPLAY}
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
                >
                  Admin Portal Login
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <p>&copy; {new Date().getFullYear()} SG Wholesalers. All rights reserved.</p>
          <p>Prices shown in Kenyan Shillings (KSh)</p>
        </div>
      </footer>
    </main>
  );
};
