import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Edit3,
  FolderKanban,
  ImagePlus,
  Lock,
  LogOut,
  MessageCircle,
  Package,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  Trash2,
  Upload,
} from 'lucide-react';
import { CORE_CATEGORIES, STARTER_PRODUCTS } from '../data/seedCatalog';
import {
  db,
  handleFirestoreError,
  isAuthorizedAdminUser,
  OperationType,
  PRIMARY_ADMIN_EMAIL,
  signInAdminWithGoogle,
  signOutAdmin,
} from '../lib/firebase';
import { CategoryItem, Order, OrderStatus, Product } from '../types';
import {
  buildWhatsAppUrl,
  compressImageToDataUrl,
  formatKSh,
  isSafeImageUrl,
  sanitizeSlugId,
} from '../utils/formatters';
import { SafeImage } from './SafeImage';

interface AdminPortalProps {
  user: User | null;
  authLoading: boolean;
  products: Product[];
  categories: CategoryItem[];
  usingStarterFallback: boolean;
  onExitAdmin: () => void;
}

type AdminTab = 'products' | 'categories' | 'orders' | 'hosting';

const ORDER_STATUSES: OrderStatus[] = [
  'Pending',
  'Confirmed',
  'Dispatched',
  'Delivered',
  'Cancelled',
];

export const AdminPortal: React.FC<AdminPortalProps> = ({
  user,
  authLoading,
  products,
  categories,
  usingStarterFallback,
  onExitAdmin,
}) => {
  const [hasAdminDoc, setHasAdminDoc] = useState(false);
  const [authError, setAuthError] = useState('');
  const [signingIn, setSigningIn] = useState(false);

  const [activeTab, setActiveTab] = useState<AdminTab>('products');
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('All');
  const [seeding, setSeeding] = useState(false);
  const [toast, setToast] = useState('');

  // Product Form State
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [showProductForm, setShowProductForm] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState('SG Deras');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodSalePrice, setProdSalePrice] = useState('');
  const [prodStock, setProdStock] = useState('10');
  const [prodVariants, setProdVariants] = useState('Free Size, L, XL');
  const [prodImages, setProdImages] = useState<string[]>([]);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [prodNewArrival, setProdNewArrival] = useState(true);
  const [prodBestSeller, setProdBestSeller] = useState(false);
  const [prodActive, setProdActive] = useState(true);
  const [prodError, setProdError] = useState('');
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Category Form State
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImage, setCatImage] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [savingCat, setSavingCat] = useState(false);

  const isAdmin = isAuthorizedAdminUser(user, hasAdminDoc);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3200);
  };

  // Check optional /admins/{uid} record when signed in
  useEffect(() => {
    if (!user) {
      setHasAdminDoc(false);
      return;
    }
    const adminRef = doc(db, 'admins', user.uid);
    const unsub = onSnapshot(
      adminRef,
      (snap) => {
        setHasAdminDoc(snap.exists());
      },
      () => {
        setHasAdminDoc(false);
      }
    );
    return () => unsub();
  }, [user]);

  // Listen to orders ONLY when authenticated as verified Admin
  useEffect(() => {
    if (!isAdmin) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const loaded: Order[] = snap.docs.map((d) => d.data() as Order);
        setOrders(loaded);
        setOrdersLoading(false);
      },
      (err) => {
        setOrdersLoading(false);
        handleFirestoreError(err, OperationType.LIST, 'orders');
      }
    );
    return () => unsub();
  }, [isAdmin]);

  const handleLogin = async () => {
    setAuthError('');
    setSigningIn(true);
    try {
      await signInAdminWithGoogle();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Sign-in failed. Please try again.');
    } finally {
      setSigningIn(false);
    }
  };

  const handleSeedCatalog = async () => {
    if (!isAdmin) return;
    setSeeding(true);
    try {
      for (const cat of CORE_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), {
          ...cat,
          updatedAt: serverTimestamp(),
        });
      }
      for (const prod of STARTER_PRODUCTS) {
        await setDoc(doc(db, 'products', prod.id), {
          ...prod,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      showNotice('Starter catalog & 3 core categories saved to Firestore.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    } finally {
      setSeeding(false);
    }
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProdName('');
    setProdCategory(categories[0]?.name || 'SG Deras');
    setProdDesc('');
    setProdPrice('');
    setProdSalePrice('');
    setProdStock('10');
    setProdVariants('Free Size');
    setProdImages([]);
    setImageUrlInput('');
    setProdNewArrival(true);
    setProdBestSeller(false);
    setProdActive(true);
    setProdError('');
  };

  const openNewProduct = () => {
    resetProductForm();
    setShowProductForm(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setProdName(product.name);
    setProdCategory(product.category);
    setProdDesc(product.description);
    setProdPrice(String(product.price));
    setProdSalePrice(product.salePrice > 0 ? String(product.salePrice) : '');
    setProdStock(String(product.stock));
    setProdVariants(product.variants.join(', '));
    setProdImages(product.images);
    setImageUrlInput('');
    setProdNewArrival(product.isNewArrival);
    setProdBestSeller(product.isBestSeller);
    setProdActive(product.active);
    setProdError('');
    setShowProductForm(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setProdError('');
    setUploadingImage(true);
    try {
      const nextImages = [...prodImages];
      for (const file of Array.from(files)) {
        if (nextImages.length >= 4) break;
        const dataUrl = await compressImageToDataUrl(file);
        nextImages.push(dataUrl);
      }
      setProdImages(nextImages);
    } catch (err) {
      setProdError(err instanceof Error ? err.message : 'Failed to process uploaded photo.');
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleAddImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (!isSafeImageUrl(trimmed)) {
      setProdError('Please enter a valid http/https image URL or upload a photo file.');
      return;
    }
    if (prodImages.length >= 4) {
      setProdError('Maximum 4 photos per product.');
      return;
    }
    setProdError('');
    setProdImages([...prodImages, trimmed]);
    setImageUrlInput('');
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    const priceNum = Number(prodPrice);
    const saleNum = prodSalePrice.trim() ? Number(prodSalePrice) : 0;
    const stockNum = parseInt(prodStock, 10);
    const variantsList = prodVariants
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean)
      .slice(0, 12);

    if (prodName.trim().length < 2) {
      setProdError('Product name must be at least 2 characters.');
      return;
    }
    if (prodDesc.trim().length < 4) {
      setProdError('Please add a short product description.');
      return;
    }
    if (!Number.isFinite(priceNum) || priceNum <= 0) {
      setProdError('Regular price must be greater than KSh 0.');
      return;
    }
    if (!Number.isFinite(saleNum) || saleNum < 0 || (saleNum > 0 && saleNum >= priceNum)) {
      setProdError('Sale price must be lower than the regular price (or leave blank for no sale).');
      return;
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      setProdError('Stock must be 0 or a positive whole number.');
      return;
    }
    if (prodImages.length === 0) {
      setProdError('Please upload or add at least 1 product photo.');
      return;
    }
    if (variantsList.length === 0) {
      setProdError('Please include at least 1 size or variant (e.g. Free Size).');
      return;
    }

    setProdError('');
    setSavingProduct(true);
    try {
      const id = editingProductId || sanitizeSlugId(`${prodName}-${Date.now().toString().slice(-4)}`);
      const existing = products.find((p) => p.id === id);

      if (editingProductId && !usingStarterFallback && existing?.createdAt) {
        await updateDoc(doc(db, 'products', id), {
          name: prodName.trim().slice(0, 120),
          category: prodCategory.trim().slice(0, 60),
          description: prodDesc.trim().slice(0, 2000),
          price: Math.round(priceNum),
          salePrice: Math.round(saleNum),
          stock: stockNum,
          images: prodImages.slice(0, 4),
          variants: variantsList,
          isNewArrival: prodNewArrival,
          isBestSeller: prodBestSeller,
          active: prodActive,
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(doc(db, 'products', id), {
          id,
          name: prodName.trim().slice(0, 120),
          category: prodCategory.trim().slice(0, 60),
          description: prodDesc.trim().slice(0, 2000),
          price: Math.round(priceNum),
          salePrice: Math.round(saleNum),
          stock: stockNum,
          images: prodImages.slice(0, 4),
          variants: variantsList,
          isNewArrival: prodNewArrival,
          isBestSeller: prodBestSeller,
          active: prodActive,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      setShowProductForm(false);
      resetProductForm();
      showNotice(editingProductId ? 'Product updated in store.' : 'New product published to store.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'products');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'products', productId));
      showNotice('Product removed.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `products/${productId}`);
    }
  };

  const handleQuickStockAdjust = async (product: Product, nextStock: number) => {
    if (!isAdmin) return;
    const clamped = Math.max(0, nextStock);
    try {
      if (usingStarterFallback) {
        await setDoc(doc(db, 'products', product.id), {
          ...product,
          stock: clamped,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        await updateDoc(doc(db, 'products', product.id), {
          stock: clamped,
          updatedAt: serverTimestamp(),
        });
      }
      showNotice(`Stock updated for ${product.name}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `products/${product.id}`);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || catName.trim().length < 2) return;
    setSavingCat(true);
    try {
      const id = editingCatId || sanitizeSlugId(catName);
      const imageSafe =
        catImage.trim() && isSafeImageUrl(catImage.trim())
          ? catImage.trim()
          : '/src/assets/images/product_dera_crimson_1795635218722.jpg';

      await setDoc(doc(db, 'categories', id), {
        id,
        name: catName.trim().slice(0, 60),
        description: catDesc.trim().slice(0, 400),
        image: imageSafe,
        sortOrder: categories.length + 1,
        active: true,
        updatedAt: serverTimestamp(),
      });
      setCatName('');
      setCatDesc('');
      setCatImage('');
      setEditingCatId(null);
      showNotice('Category saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'categories');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, 'categories', catId));
      showNotice('Category deleted.');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `categories/${catId}`);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status,
        updatedAt: serverTimestamp(),
      });
      showNotice(`Order updated to ${status}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  // Auth Gate Screen (Separate from Customer Store)
  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <p className="text-sm font-medium text-zinc-600">Verifying admin session...</p>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col justify-center items-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white border border-stone-200 rounded-2xl shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={onExitAdmin}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-950"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Storefront
            </button>
            <span className="text-xs font-semibold text-red-700 flex items-center gap-1">
              <Lock className="w-3.5 h-3.5" />
              Protected Area
            </span>
          </div>

          <div className="text-center space-y-3 pt-2">
            <img
              src="/assets/aistudio/image_5584599e.png"
              alt="SG Collections"
              className="w-16 h-16 rounded-xl mx-auto object-cover bg-black border border-stone-200"
            />
            <h1 className="font-display text-2xl font-bold text-zinc-950">
              SG Collections Admin
            </h1>
            <p className="text-sm text-zinc-600">
              Sign in with your authorized store administrator account to manage products, photos, KSh pricing, stock, and customer orders.
            </p>
          </div>

          {user && !isAdmin && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Access Denied</span>
              </div>
              <p>
                Signed in as <strong>{user.email}</strong>, which is not authorized as an SG Collections administrator ({PRIMARY_ADMIN_EMAIL}).
              </p>
              <button
                type="button"
                onClick={signOutAdmin}
                className="underline font-semibold text-red-900"
              >
                Sign out and switch account
              </button>
            </div>
          )}

          {authError && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {authError}
            </p>
          )}

          <button
            type="button"
            disabled={signingIn}
            onClick={handleLogin}
            className="w-full py-3.5 px-4 rounded-xl bg-zinc-950 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" />
            <span>{signingIn ? 'Signing in...' : 'Sign in with Google Admin'}</span>
          </button>

          <p className="text-[11px] text-center text-zinc-500 leading-relaxed">
            Secured via Firebase Authentication &amp; Cloud Firestore security rules. Storefront shoppers never see this portal.
          </p>
        </div>
      </div>
    );
  }

  const filteredOrders = orders.filter((o) =>
    orderStatusFilter === 'All' ? true : o.status === orderStatusFilter
  );

  const pendingOrdersCount = orders.filter((o) => o.status === 'Pending').length;
  const outOfStockCount = products.filter((p) => p.stock <= 0).length;

  return (
    <div className="min-h-screen bg-stone-50 text-zinc-900">
      {/* Admin Top Header */}
      <header className="bg-zinc-950 text-white border-b border-zinc-800 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/image_5584599e.png"
              alt="SG Collections"
              className="w-9 h-9 rounded-lg object-cover bg-black border border-zinc-700"
            />
            <div>
              <p className="font-display text-base font-bold leading-none">SG Collections Admin</p>
              <p className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-[180px] sm:max-w-none">
                {user.email}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onExitAdmin}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-white flex items-center gap-1.5 whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>View Storefront</span>
            </button>
            <button
              type="button"
              onClick={signOutAdmin}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 flex items-center gap-1.5 whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {toast && (
          <div
            role="status"
            className="bg-emerald-900 text-white px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
            <span>{toast}</span>
          </div>
        )}

        {usingStarterFallback && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-sm text-amber-950">
              <p className="font-semibold">Cloud Catalog Not Seeded Yet</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Sync the starter SG Deras, SG Kids Coset, and Mutumba Bales catalog to your Firestore database so all edits persist live.
              </p>
            </div>
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedCatalog}
              className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              <span>{seeding ? 'Syncing...' : 'Sync Starter Catalog to Cloud'}</span>
            </button>
          </div>
        )}

        {/* Overview KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-xs font-medium text-zinc-500">Total Products</p>
            <p className="text-2xl font-bold text-zinc-950 tabular-nums mt-1">{products.length}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-xs font-medium text-zinc-500">Out of Stock</p>
            <p className="text-2xl font-bold text-red-700 tabular-nums mt-1">{outOfStockCount}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-xs font-medium text-zinc-500">Pending Orders</p>
            <p className="text-2xl font-bold text-amber-700 tabular-nums mt-1">{pendingOrdersCount}</p>
          </div>
          <div className="bg-white border border-stone-200 rounded-xl p-4">
            <p className="text-xs font-medium text-zinc-500">Total Logged Orders</p>
            <p className="text-2xl font-bold text-zinc-950 tabular-nums mt-1">{orders.length}</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-stone-200">
          {(
            [
              { id: 'products', label: 'Products & Photos', icon: Package },
              { id: 'categories', label: 'Categories', icon: FolderKanban },
              { id: 'orders', label: `Orders (${orders.length})`, icon: ShoppingCart },
              { id: 'hosting', label: 'Hosting & Database', icon: Database },
            ] as { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-xs sm:text-sm font-semibold rounded-t-lg border-b-2 flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === tab.id
                    ? 'border-red-700 text-red-700 bg-white'
                    : 'border-transparent text-zinc-600 hover:text-zinc-950'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: PRODUCTS */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-zinc-950">Product Catalog</h2>
                <p className="text-xs text-zinc-500">
                  Add, edit, remove products, upload photos, and update KSh prices or stock counts.
                </p>
              </div>
              <button
                type="button"
                onClick={openNewProduct}
                className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Product</span>
              </button>
            </div>

            {showProductForm && (
              <form
                onSubmit={handleSaveProduct}
                className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5 shadow-xs"
              >
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <h3 className="text-base font-bold text-zinc-950">
                    {editingProductId ? 'Edit Product' : 'Create New Product'}
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductForm(false);
                      resetProductForm();
                    }}
                    className="text-xs font-semibold text-zinc-500 hover:text-zinc-950"
                  >
                    Cancel
                  </button>
                </div>

                {prodError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {prodError}
                  </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={prodName}
                      onChange={(e) => setProdName(e.target.value)}
                      placeholder="e.g. Mombasa Silk Royal Dera"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Category *
                    </label>
                    <select
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg bg-white focus:outline-none focus:border-red-700"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Regular Price (KSh) *
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={prodPrice}
                      onChange={(e) => setProdPrice(e.target.value)}
                      placeholder="2400"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg tabular-nums focus:outline-none focus:border-red-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Sale Price (KSh — Optional)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={prodSalePrice}
                      onChange={(e) => setProdSalePrice(e.target.value)}
                      placeholder="Leave empty for no discount"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg tabular-nums focus:outline-none focus:border-red-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Stock Quantity *
                    </label>
                    <input
                      type="number"
                      min={0}
                      required
                      value={prodStock}
                      onChange={(e) => setProdStock(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg tabular-nums focus:outline-none focus:border-red-700"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">
                      Sizes / Variants (comma separated) *
                    </label>
                    <input
                      type="text"
                      required
                      value={prodVariants}
                      onChange={(e) => setProdVariants(e.target.value)}
                      placeholder="Free Size, Tall Length, Petite"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 mb-1">
                    Product Description *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={prodDesc}
                    onChange={(e) => setProdDesc(e.target.value)}
                    placeholder="Fabric details, fit notes, bale weight or piece count..."
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700"
                  />
                </div>

                {/* Photo Upload & URL Manager */}
                <div className="space-y-3 pt-1">
                  <label className="block text-xs font-semibold text-zinc-700">
                    Product Photos (1 to 4 photos — upload from device or paste URL) *
                  </label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <label className="px-4 py-2.5 rounded-lg border border-stone-300 bg-stone-50 hover:bg-stone-100 text-xs font-semibold text-zinc-800 flex items-center justify-center gap-2 cursor-pointer shrink-0">
                      <Upload className="w-4 h-4 text-red-700" />
                      <span>{uploadingImage ? 'Compressing...' : 'Upload Photo(s)'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={uploadingImage || prodImages.length >= 4}
                        onChange={handleFileUpload}
                        className="sr-only"
                      />
                    </label>

                    <div className="flex-1 flex gap-2">
                      <input
                        type="url"
                        value={imageUrlInput}
                        onChange={(e) => setImageUrlInput(e.target.value)}
                        placeholder="Or paste image URL (https://...)"
                        className="flex-1 px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700"
                      />
                      <button
                        type="button"
                        onClick={handleAddImageUrl}
                        className="px-3.5 py-2 rounded-lg bg-zinc-950 text-white text-xs font-semibold flex items-center gap-1 shrink-0"
                      >
                        <ImagePlus className="w-4 h-4" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  {prodImages.length > 0 && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      {prodImages.map((img, idx) => (
                        <div
                          key={`${img.slice(0, 24)}-${idx}`}
                          className="relative w-20 h-24 rounded-lg overflow-hidden border border-stone-300 bg-stone-100"
                        >
                          <SafeImage
                            src={img}
                            alt={`Preview ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setProdImages(prodImages.filter((_, i) => i !== idx))}
                            aria-label="Remove photo"
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/75 text-white flex items-center justify-center text-xs hover:bg-red-700"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Flags */}
                <div className="flex flex-wrap items-center gap-5 pt-2">
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodNewArrival}
                      onChange={(e) => setProdNewArrival(e.target.checked)}
                      className="rounded border-stone-300 text-red-700"
                    />
                    New Arrival
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodBestSeller}
                      onChange={(e) => setProdBestSeller(e.target.checked)}
                      className="rounded border-stone-300 text-red-700"
                    />
                    Best Seller
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold text-zinc-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodActive}
                      onChange={(e) => setProdActive(e.target.checked)}
                      className="rounded border-stone-300 text-red-700"
                    />
                    Visible in Storefront
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductForm(false);
                      resetProductForm();
                    }}
                    className="px-4 py-2.5 rounded-lg border border-stone-300 text-xs font-semibold text-zinc-700 hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProduct}
                    className="px-5 py-2.5 rounded-lg bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white text-xs font-semibold"
                  >
                    {savingProduct ? 'Saving...' : editingProductId ? 'Save Changes' : 'Publish Product'}
                  </button>
                </div>
              </form>
            )}

            {/* Products Table / Cards */}
            <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Price (KSh)</th>
                      <th className="py-3 px-4">Stock</th>
                      <th className="py-3 px-4">Flags</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {products.map((p) => (
                      <tr key={p.id} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-14 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                              <SafeImage
                                src={p.images[0]}
                                alt={p.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-zinc-950 truncate max-w-[220px]">
                                {p.name}
                              </p>
                              <p className="text-xs text-zinc-500 truncate max-w-[220px]">
                                {p.variants.join(', ')}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-zinc-700 whitespace-nowrap">
                          {p.category}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap tabular-nums">
                          {p.salePrice > 0 && p.salePrice < p.price ? (
                            <div>
                              <span className="font-bold text-red-700">
                                {formatKSh(p.salePrice)}
                              </span>
                              <span className="block text-xs text-zinc-400 line-through">
                                {formatKSh(p.price)}
                              </span>
                            </div>
                          ) : (
                            <span className="font-semibold text-zinc-950">
                              {formatKSh(p.price)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleQuickStockAdjust(p, p.stock - 1)}
                              className="w-6 h-6 rounded border border-stone-300 text-xs font-bold hover:bg-stone-100"
                              aria-label="Decrease stock"
                            >
                              -
                            </button>
                            <span
                              className={`w-9 text-center text-xs font-bold tabular-nums ${
                                p.stock <= 0 ? 'text-red-700' : 'text-zinc-900'
                              }`}
                            >
                              {p.stock}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleQuickStockAdjust(p, p.stock + 1)}
                              className="w-6 h-6 rounded border border-stone-300 text-xs font-bold hover:bg-stone-100"
                              aria-label="Increase stock"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs text-zinc-600 whitespace-nowrap">
                          {[
                            p.isNewArrival ? 'New' : '',
                            p.isBestSeller ? 'Best Seller' : '',
                            p.active ? 'Visible' : 'Hidden',
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => openEditProduct(p)}
                              className="p-2 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-stone-100"
                              aria-label={`Edit ${p.name}`}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteProduct(p.id)}
                              className="p-2 rounded-lg text-zinc-500 hover:text-red-700 hover:bg-red-50"
                              aria-label={`Delete ${p.name}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CATEGORIES */}
        {activeTab === 'categories' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form
              onSubmit={handleSaveCategory}
              className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4 self-start"
            >
              <h2 className="font-display text-lg font-bold text-zinc-950">
                {editingCatId ? 'Edit Category' : 'Add Store Category'}
              </h2>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Category Name *
                </label>
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="e.g. SG Deras"
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="Short description shown in Admin & SEO"
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-700 mb-1">
                  Category Image URL (Optional)
                </label>
                <input
                  type="text"
                  value={catImage}
                  onChange={(e) => setCatImage(e.target.value)}
                  placeholder="/src/assets/images/... or https://..."
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700"
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingCat}
                  className="px-4 py-2.5 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-lg"
                >
                  {savingCat ? 'Saving...' : editingCatId ? 'Update Category' : 'Save Category'}
                </button>
                {editingCatId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCatId(null);
                      setCatName('');
                      setCatDesc('');
                      setCatImage('');
                    }}
                    className="px-3 py-2.5 text-xs font-semibold text-zinc-600"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div className="lg:col-span-2 bg-white border border-stone-200 rounded-2xl divide-y divide-stone-100">
              {categories.map((c) => (
                <div key={c.id} className="p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-full overflow-hidden border border-stone-200 bg-stone-100 shrink-0">
                      <SafeImage src={c.image} alt={c.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-950 text-sm">{c.name}</p>
                      <p className="text-xs text-zinc-500 line-clamp-1">{c.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatId(c.id);
                        setCatName(c.name);
                        setCatDesc(c.description);
                        setCatImage(c.image);
                      }}
                      className="p-2 text-zinc-600 hover:text-zinc-950 rounded-lg hover:bg-stone-100"
                      aria-label={`Edit ${c.name}`}
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {!['sg-deras', 'sg-kids-coset', 'mutumba-bales'].includes(c.id) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(c.id)}
                        className="p-2 text-zinc-500 hover:text-red-700 rounded-lg hover:bg-red-50"
                        aria-label={`Delete ${c.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 3: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-bold text-zinc-950">Customer Orders</h2>
                <p className="text-xs text-zinc-500">
                  Orders logged when customers click WhatsApp Checkout or GoLink Delivery Service.
                </p>
              </div>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs font-semibold bg-white border border-stone-300 rounded-lg"
              >
                <option value="All">All Statuses</option>
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            {ordersLoading ? (
              <p className="text-sm text-zinc-500 py-10 text-center">Loading customer orders...</p>
            ) : filteredOrders.length === 0 ? (
              <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center text-sm text-zinc-500">
                No orders found for this filter yet.
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white border border-stone-200 rounded-2xl p-5 space-y-4"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-bold text-zinc-950">
                            {order.orderNumber}
                          </span>
                          <span aria-hidden="true" className="text-zinc-300">
                            ·
                          </span>
                          <span className="text-xs font-semibold text-zinc-700">
                            {order.deliveryMethod === 'golink_nairobi'
                              ? 'GoLink Nairobi Doorstep'
                              : 'Standard / Worldwide WhatsApp'}
                          </span>
                          <span aria-hidden="true" className="text-zinc-300">
                            ·
                          </span>
                          <span className="text-xs font-bold text-red-700 tabular-nums">
                            {formatKSh(order.totalAmount)}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-600 mt-1">
                          <strong>{order.customerName}</strong> · {order.customerPhone} ·{' '}
                          {order.deliveryLocation}
                        </p>
                        {order.notes && (
                          <p className="text-xs text-zinc-500 mt-1">Note: {order.notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <select
                          aria-label={`Update status for ${order.orderNumber}`}
                          value={order.status}
                          onChange={(e) =>
                            handleUpdateOrderStatus(order.id, e.target.value as OrderStatus)
                          }
                          className="px-3 py-2 text-xs font-semibold border border-stone-300 rounded-lg bg-white"
                        >
                          {ORDER_STATUSES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                        <a
                          href={buildWhatsAppUrl(
                            order.customerPhone,
                            `Hello ${order.customerName}, update on your SG Collections order ${order.orderNumber} (${formatKSh(order.totalAmount)}): Status is now ${order.status}.`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>Message</span>
                        </a>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
                      {order.items.map((item, idx) => (
                        <div
                          key={`${item.productId}-${idx}`}
                          className="bg-stone-50 border border-stone-200 rounded-lg px-3 py-2 flex justify-between gap-2"
                        >
                          <span className="text-zinc-800 truncate">
                            {item.quantity}× {item.name} ({item.variant})
                          </span>
                          <span className="font-semibold text-zinc-950 tabular-nums shrink-0">
                            {formatKSh(item.lineTotal)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: HOSTING & DATABASE */}
        {activeTab === 'hosting' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5 max-w-3xl">
            <h2 className="font-display text-xl font-bold text-zinc-950">
              Hosting, Database &amp; Security Architecture
            </h2>
            <div className="space-y-4 text-sm text-zinc-600 leading-relaxed">
              <div>
                <h3 className="font-semibold text-zinc-950">1. Cloud Database (Firebase Firestore)</h3>
                <p>
                  All products, KSh regular &amp; sale prices, stock levels, categories, uploaded product photos, and customer orders are persisted in Google Cloud Firestore. Changes you make in this Admin Portal reflect live on the customer storefront.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-950">2. Secure Admin Authentication</h3>
                <p>
                  Admin access is protected by Firebase Authentication (Google Sign-In) and enforced at the database layer via hardened Firestore Security Rules (`firestore.rules`). Only verified admin accounts ({PRIMARY_ADMIN_EMAIL}) can create/edit/delete catalog items or read customer order details.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-950">3. WhatsApp &amp; GoLink Delivery Integration</h3>
                <p>
                  Standard storefront orders route to <strong>+254 723 157 639</strong>, while express Nairobi doorstep delivery requests route directly to GoLink Delivery Service at <strong>+254 118 457 993</strong> with full itemized KSh calculations.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
