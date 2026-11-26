import React, { useState } from 'react';
import { Heart, Menu, Search, ShieldCheck, ShoppingBag, X } from 'lucide-react';

interface StoreHeaderProps {
  categories: string[];
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  cartCount: number;
  wishlistCount: number;
  onOpenCart: () => void;
  onToggleWishlistView: () => void;
  isWishlistView: boolean;
  onOpenAdmin: () => void;
  onNavigateDelivery: () => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  categories,
  activeCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  cartCount,
  wishlistCount,
  onOpenCart,
  onToggleWishlistView,
  isWishlistView,
  onOpenAdmin,
  onNavigateDelivery,
}) => {
  const [promoVisible, setPromoVisible] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

  const handleCategoryClick = (cat: string) => {
    onSelectCategory(cat);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200">
      {promoVisible && (
        <div className="bg-gradient-to-r from-red-700 via-red-600 to-amber-600 text-white px-4 py-1.5 text-xs flex items-center justify-between gap-4">
          <div className="w-4 shrink-0 hidden sm:block" aria-hidden="true" />
          <p className="text-center font-medium truncate">
            We deliver countrywide and world wide · Fast Nairobi doorstep delivery at checkout · Prices in KSh
          </p>
          <button
            type="button"
            onClick={() => setPromoVisible(false)}
            aria-label="Dismiss announcement"
            className="text-white/85 hover:text-white p-0.5 shrink-0 focus-visible:outline-2 focus-visible:outline-white rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: Brand Logo & Wordmark */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            className="lg:hidden p-2 -ml-2 text-zinc-700 hover:text-zinc-950 rounded-lg focus-visible:outline-2 focus-visible:outline-red-700"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => handleCategoryClick('All')}
            className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-red-700 rounded-lg"
          >
            <img
              src="/assets/aistudio/image_5584599e.png"
              alt="SG Wholesalers Logo"
              className="w-9 h-9 rounded-lg object-cover bg-black shrink-0 border border-stone-200"
            />
            <span className="font-display text-lg sm:text-xl font-bold tracking-tight text-zinc-950">
              SG Wholesalers
            </span>
          </button>
        </div>

        {/* Zone 2: Single-line Category Navigation */}
        <nav aria-label="Store categories" className="hidden lg:flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => handleCategoryClick('All')}
            className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
              activeCategory === 'All' && !isWishlistView
                ? 'border-red-700 text-zinc-950 font-semibold'
                : 'border-transparent text-zinc-600 hover:text-zinc-950'
            }`}
          >
            Shop All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryClick(cat)}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                activeCategory === cat && !isWishlistView
                  ? 'border-red-700 text-zinc-950 font-semibold'
                  : 'border-transparent text-zinc-600 hover:text-zinc-950'
              }`}
            >
              {cat}
            </button>
          ))}
          <button
            type="button"
            onClick={onNavigateDelivery}
            className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent text-zinc-600 hover:text-zinc-950 transition-colors"
          >
            Delivery &amp; Returns
          </button>
        </nav>

        {/* Zone 3: Search + Wishlist + Bag + Admin */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden md:flex items-center relative w-52 xl:w-64">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search deras, cosets, bales..."
              aria-label="Search products"
              className="w-full pl-9 pr-3 py-2 text-sm bg-stone-100 border border-transparent focus:border-stone-300 focus:bg-white rounded-lg text-zinc-900 placeholder:text-zinc-500 outline-none transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={() => setMobileSearchOpen((prev) => !prev)}
            aria-label="Toggle product search"
            className="md:hidden p-2.5 text-zinc-700 hover:text-zinc-950 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <Search className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={onToggleWishlistView}
            aria-label={`Wishlist (${wishlistCount} items)`}
            className={`relative p-2.5 rounded-lg transition-colors flex items-center gap-1.5 text-sm font-medium ${
              isWishlistView
                ? 'bg-red-50 text-red-700'
                : 'text-zinc-700 hover:text-zinc-950 hover:bg-stone-100'
            }`}
          >
            <Heart className={`w-5 h-5 ${isWishlistView ? 'fill-red-700 text-red-700' : ''}`} />
            <span className="hidden sm:inline whitespace-nowrap">Wishlist</span>
            {wishlistCount > 0 && (
              <span className="tabular-nums text-xs font-semibold text-red-700">
                ({wishlistCount})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`Open shopping bag (${cartCount} items)`}
            className="relative px-3.5 py-2 bg-zinc-950 text-white hover:bg-zinc-800 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Bag</span>
            <span className="tabular-nums text-xs bg-red-600 text-white px-1.5 py-0.5 rounded font-semibold min-w-[20px] text-center">
              {cartCount}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenAdmin}
            aria-label="Open Admin Portal"
            title="Admin Portal"
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 hover:bg-stone-100 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Admin</span>
          </button>
        </div>
      </div>

      {/* Mobile Search Bar */}
      {mobileSearchOpen && (
        <div className="md:hidden px-4 pb-3 pt-1 border-t border-stone-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search SG Deras, Kids Coset, Bales..."
              aria-label="Search products on mobile"
              autoFocus
              className="w-full pl-9 pr-3 py-2.5 text-sm bg-stone-100 border border-stone-200 rounded-lg text-zinc-900 placeholder:text-zinc-500 outline-none focus:bg-white focus:border-red-700"
            />
          </div>
        </div>
      )}

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-stone-200 bg-white px-4 py-4 space-y-2">
          <button
            type="button"
            onClick={() => handleCategoryClick('All')}
            className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
              activeCategory === 'All' && !isWishlistView
                ? 'bg-red-50 text-red-800 font-semibold'
                : 'text-zinc-700 hover:bg-stone-50'
            }`}
          >
            Shop All Products
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => handleCategoryClick(cat)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                activeCategory === cat && !isWishlistView
                  ? 'bg-red-50 text-red-800 font-semibold'
                  : 'text-zinc-700 hover:bg-stone-50'
              }`}
            >
              {cat}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              onNavigateDelivery();
            }}
            className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-700 hover:bg-stone-50"
          >
            Delivery &amp; Returns
          </button>
          <div className="pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenAdmin();
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-zinc-700 hover:bg-stone-50"
            >
              <ShieldCheck className="w-4 h-4 text-zinc-500" />
              Admin Portal
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
