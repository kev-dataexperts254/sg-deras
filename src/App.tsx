import { useCallback, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { AdminPortal } from './components/AdminPortal';
import { CartDrawer } from './components/CartDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { ProductDetailModal } from './components/ProductDetailModal';
import { Storefront } from './components/Storefront';
import { StoreHeader } from './components/StoreHeader';
import { CORE_CATEGORIES, STARTER_PRODUCTS } from './data/seedCatalog';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  testFirestoreConnection,
} from './lib/firebase';
import {
  CartEntry,
  CategoryItem,
  CustomerDetails,
  DeliveryMethod,
  Product,
  ResolvedCartItem,
  StoreFilter,
} from './types';
import { getEffectivePrice, sanitizeSlugId } from './utils/formatters';

const CART_STORAGE_KEY = 'sg_collections_cart_v1';
const WISHLIST_STORAGE_KEY = 'sg_collections_wishlist_v1';
const CUSTOMER_STORAGE_KEY = 'sg_collections_customer_v1';

function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [route, setRoute] = useState<'store' | 'admin'>(() =>
    window.location.hash === '#admin' ? 'admin' : 'store'
  );

  // Firebase Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Live Catalog state
  const [firestoreProducts, setFirestoreProducts] = useState<Product[] | null>(null);
  const [firestoreCategories, setFirestoreCategories] = useState<CategoryItem[] | null>(null);

  // Storefront browsing state
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [activeFilter, setActiveFilter] = useState<StoreFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState<boolean>(false);

  // Persistent Shopper State
  const [cartEntries, setCartEntries] = useState<CartEntry[]>(() =>
    readStoredJson<CartEntry[]>(CART_STORAGE_KEY, [])
  );
  const [wishlistIds, setWishlistIds] = useState<string[]>(() =>
    readStoredJson<string[]>(WISHLIST_STORAGE_KEY, [])
  );
  const [customerDetails, setCustomerDetails] = useState<CustomerDetails>(() =>
    readStoredJson<CustomerDetails>(CUSTOMER_STORAGE_KEY, {
      name: '',
      phone: '',
      location: '',
      notes: '',
    })
  );

  // Sync URL hash with route
  useEffect(() => {
    const onHashChange = () => {
      setRoute(window.location.hash === '#admin' ? 'admin' : 'store');
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigateTo = useCallback((nextRoute: 'store' | 'admin') => {
    window.location.hash = nextRoute === 'admin' ? '#admin' : '';
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Boot Firestore connection check & Auth listener
  useEffect(() => {
    void testFirestoreConnection();
    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthLoading(false);
    });
    return () => unsubAuth();
  }, []);

  // Live Firestore subscriptions for products & categories
  useEffect(() => {
    const productsQuery = query(collection(db, 'products'));
    const unsubProducts = onSnapshot(
      productsQuery,
      (snapshot) => {
        const items: Product[] = snapshot.docs.map((d) => d.data() as Product);
        setFirestoreProducts(items);
      },
      (err) => {
        console.error('Products listener error:', err);
        setFirestoreProducts([]);
      }
    );

    const categoriesQuery = query(collection(db, 'categories'), orderBy('sortOrder', 'asc'));
    const unsubCategories = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        const cats: CategoryItem[] = snapshot.docs.map((d) => d.data() as CategoryItem);
        setFirestoreCategories(cats);
      },
      (err) => {
        console.error('Categories listener error:', err);
        setFirestoreCategories([]);
      }
    );

    return () => {
      unsubProducts();
      unsubCategories();
    };
  }, []);

  // Persist cart, wishlist, and customer info locally
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartEntries));
    } catch {
      // Ignore storage quota issues
    }
  }, [cartEntries]);

  useEffect(() => {
    try {
      localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(wishlistIds));
    } catch {
      // Ignore storage quota issues
    }
  }, [wishlistIds]);

  useEffect(() => {
    try {
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(customerDetails));
    } catch {
      // Ignore storage quota issues
    }
  }, [customerDetails]);

  const usingStarterFallback =
    firestoreProducts === null || firestoreProducts.length === 0;

  const products: Product[] = useMemo(() => {
    if (firestoreProducts && firestoreProducts.length > 0) {
      return firestoreProducts;
    }
    return STARTER_PRODUCTS;
  }, [firestoreProducts]);

  const categories: CategoryItem[] = useMemo(() => {
    if (firestoreCategories && firestoreCategories.length > 0) {
      return firestoreCategories;
    }
    return CORE_CATEGORIES;
  }, [firestoreCategories]);

  const categoryNames = useMemo(
    () => categories.filter((c) => c.active !== false).map((c) => c.name),
    [categories]
  );

  // Dynamically resolve cart items against CURRENT live product prices and stock
  const resolvedCartItems: ResolvedCartItem[] = useMemo(() => {
    const resolved: ResolvedCartItem[] = [];
    for (const entry of cartEntries) {
      const product = products.find((p) => p.id === entry.productId && p.active);
      if (!product || product.stock <= 0) continue;
      const safeQty = Math.min(Math.max(1, entry.quantity), product.stock);
      const unitPrice = getEffectivePrice(product);
      resolved.push({
        product,
        variant: product.variants.includes(entry.variant)
          ? entry.variant
          : product.variants[0] || 'Standard',
        quantity: safeQty,
        unitPrice,
        lineTotal: unitPrice * safeQty,
      });
    }
    return resolved;
  }, [cartEntries, products]);

  const cartTotalAmount = useMemo(
    () => resolvedCartItems.reduce((sum, item) => sum + item.lineTotal, 0),
    [resolvedCartItems]
  );

  const cartTotalCount = useMemo(
    () => resolvedCartItems.reduce((sum, item) => sum + item.quantity, 0),
    [resolvedCartItems]
  );

  const handleToggleWishlist = (productId: string) => {
    setWishlistIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const handleAddToCart = (product: Product, variant: string, quantity: number) => {
    if (product.stock <= 0) return;
    const chosenVariant = variant || product.variants[0] || 'Standard';
    setCartEntries((prev) => {
      const idx = prev.findIndex(
        (item) => item.productId === product.id && item.variant === chosenVariant
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = {
          ...next[idx],
          quantity: Math.min(product.stock, next[idx].quantity + quantity),
        };
        return next;
      }
      return [
        ...prev,
        {
          productId: product.id,
          variant: chosenVariant,
          quantity: Math.min(product.stock, Math.max(1, quantity)),
        },
      ];
    });
  };

  const handleQuickAdd = (product: Product) => {
    handleAddToCart(product, product.variants[0] || 'Standard', 1);
    setCartOpen(true);
  };

  const handleUpdateCartQuantity = (productId: string, variant: string, delta: number) => {
    const product = products.find((p) => p.id === productId);
    const maxStock = product ? product.stock : 99;
    setCartEntries((prev) =>
      prev
        .map((item) => {
          if (item.productId === productId && item.variant === variant) {
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return null;
            return { ...item, quantity: Math.min(maxStock, nextQty) };
          }
          return item;
        })
        .filter((x): x is CartEntry => x !== null)
    );
  };

  const handleRemoveCartItem = (productId: string, variant: string) => {
    setCartEntries((prev) =>
      prev.filter((item) => !(item.productId === productId && item.variant === variant))
    );
  };

  const handleRecordOrder = async (
    orderNumber: string,
    items: ResolvedCartItem[],
    totalAmount: number,
    customer: CustomerDetails,
    deliveryMethod: DeliveryMethod
  ): Promise<void> => {
    const orderId = sanitizeSlugId(`${orderNumber}-${Date.now()}`);
    const orderPath = `orders/${orderId}`;
    try {
      const safeName = customer.name.trim() || 'WhatsApp Shopper';
      const safePhone = customer.phone.trim().length >= 7 ? customer.phone.trim() : 'Via WhatsApp';
      await setDoc(doc(db, 'orders', orderId), {
        id: orderId,
        orderNumber: orderNumber.slice(0, 32),
        customerName: safeName.slice(0, 100),
        customerPhone: safePhone.slice(0, 30),
        deliveryLocation:
          (customer.location.trim() ||
            (deliveryMethod === 'golink_nairobi'
              ? 'Nairobi Doorstep (Confirm estate)'
              : 'To be confirmed')
          ).slice(0, 200),
        notes: customer.notes.trim().slice(0, 400),
        deliveryMethod,
        status: 'Pending',
        items: items.slice(0, 50).map((item) => ({
          productId: item.product.id,
          name: item.product.name.slice(0, 120),
          category: item.product.category.slice(0, 60),
          variant: item.variant.slice(0, 60),
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
        totalAmount,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, orderPath);
    }
  };

  return (
    <ErrorBoundary>
      {route === 'admin' ? (
        <AdminPortal
          user={user}
          authLoading={authLoading}
          products={products}
          categories={categories}
          usingStarterFallback={usingStarterFallback}
          onExitAdmin={() => navigateTo('store')}
        />
      ) : (
        <div className="min-h-screen flex flex-col bg-white">
          <StoreHeader
            categories={categoryNames}
            activeCategory={activeCategory}
            onSelectCategory={(cat) => {
              setActiveCategory(cat);
              if (activeFilter === 'wishlist') setActiveFilter('all');
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              if (q.trim()) {
                document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            cartCount={cartTotalCount}
            wishlistCount={wishlistIds.length}
            onOpenCart={() => setCartOpen(true)}
            onToggleWishlistView={() => {
              setActiveFilter((prev) => (prev === 'wishlist' ? 'all' : 'wishlist'));
              document.getElementById('catalog-section')?.scrollIntoView({ behavior: 'smooth' });
            }}
            isWishlistView={activeFilter === 'wishlist'}
            onOpenAdmin={() => navigateTo('admin')}
            onNavigateDelivery={() =>
              document.getElementById('delivery-returns')?.scrollIntoView({ behavior: 'smooth' })
            }
          />

          <Storefront
            products={products}
            categories={categories}
            activeCategory={activeCategory}
            onSelectCategory={setActiveCategory}
            activeFilter={activeFilter}
            onSelectFilter={setActiveFilter}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            wishlistIds={wishlistIds}
            onToggleWishlist={handleToggleWishlist}
            onOpenProduct={(product) => setSelectedProduct(product)}
            onQuickAdd={handleQuickAdd}
            onOpenAdmin={() => navigateTo('admin')}
          />

          <ProductDetailModal
            product={selectedProduct}
            isWishlisted={selectedProduct ? wishlistIds.includes(selectedProduct.id) : false}
            onClose={() => setSelectedProduct(null)}
            onToggleWishlist={handleToggleWishlist}
            onAddToCart={handleAddToCart}
          />

          <CartDrawer
            isOpen={cartOpen}
            onClose={() => setCartOpen(false)}
            items={resolvedCartItems}
            totalAmount={cartTotalAmount}
            customer={customerDetails}
            onCustomerChange={setCustomerDetails}
            onUpdateQuantity={handleUpdateCartQuantity}
            onRemoveItem={handleRemoveCartItem}
            onClearCart={() => setCartEntries([])}
            onRecordOrder={handleRecordOrder}
          />

          <FloatingWhatsApp />
        </div>
      )}
    </ErrorBoundary>
  );
}
