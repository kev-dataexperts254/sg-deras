import React, { useCallback, useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Edit3,
  Eye,
  EyeOff,
  FolderKanban,
  ImagePlus,
  KeyRound,
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
import { signInAdminWithGoogle, signOutAdmin } from '../lib/firebase';
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
  adminToken: string | null;
  onAdminTokenChange: (token: string | null) => void;
  products: Product[];
  categories: CategoryItem[];
  usingStarterFallback: boolean;
  onRefreshCatalog: () => Promise<void>;
  onExitAdmin: () => void;
}

type AdminTab = 'products' | 'categories' | 'orders' | 'security' | 'hosting';

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
  adminToken,
  onAdminTokenChange,
  products,
  categories,
  usingStarterFallback,
  onRefreshCatalog,
  onExitAdmin,
}) => {
  // Server-verified custom username/password state
  const [statusLoading, setStatusLoading] = useState(true);
  const [adminConfigured, setAdminConfigured] = useState(false);
  const [envOverride, setEnvOverride] = useState(false);
  const [adminUsername, setAdminUsername] = useState<string | null>(null);

  // Login / First-run setup form state
  const [usernameInput, setUsernameInput] = useState('admin');
  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Change password form state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChangeError, setPasswordChangeError] = useState('');
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Optional Google Auth sync state
  const [googleConnecting, setGoogleConnecting] = useState(false);
  const [actionError, setActionError] = useState('');

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

  const isPortalAuthenticated = Boolean(adminToken && adminUsername);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3400);
  };

  // Check server admin auth configuration & current Bearer token
  const refreshAdminStatus = useCallback(
    async (tokenOverride?: string | null) => {
      setStatusLoading(true);
      try {
        const tokenToUse = tokenOverride !== undefined ? tokenOverride : adminToken;
        const headers: Record<string, string> = {};
        if (tokenToUse) {
          headers.Authorization = `Bearer ${tokenToUse}`;
        }
        const res = await fetch('/api/admin/status', { headers });
        if (!res.ok) throw new Error('Unable to reach admin auth service.');
        const data = (await res.json()) as {
          configured: boolean;
          envOverride: boolean;
          authenticated: boolean;
          username: string | null;
        };
        setAdminConfigured(data.configured);
        setEnvOverride(data.envOverride);
        if (data.authenticated && data.username) {
          setAdminUsername(data.username);
        } else {
          setAdminUsername(null);
          if (tokenToUse) onAdminTokenChange(null);
        }
      } catch (err) {
        setAuthError(err instanceof Error ? err.message : 'Admin authentication unavailable.');
      } finally {
        setStatusLoading(false);
      }
    },
    [adminToken, onAdminTokenChange]
  );

  useEffect(() => {
    void refreshAdminStatus();
  }, [refreshAdminStatus]);

  const fetchOrders = useCallback(async () => {
    if (!adminToken) {
      setOrders([]);
      return;
    }
    setOrdersLoading(true);
    try {
      const res = await fetch('/api/admin/orders', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = (await res.json()) as { orders?: Order[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to load orders.');
      }
      setOrders(Array.isArray(data.orders) ? data.orders : []);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load customer orders.');
    } finally {
      setOrdersLoading(false);
    }
  }, [adminToken]);

  useEffect(() => {
    if (isPortalAuthenticated) {
      void fetchOrders();
      void onRefreshCatalog();
    } else {
      setOrders([]);
    }
  }, [isPortalAuthenticated, fetchOrders, onRefreshCatalog]);

  const handleFirstRunSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    if (passwordInput !== confirmPasswordInput) {
      setAuthError('Passwords do not match.');
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        token?: string;
        username?: string;
        envOverride?: boolean;
      };
      if (!res.ok || !data.token || !data.username) {
        setAuthError(data.error || 'Could not configure admin credentials.');
        return;
      }
      onAdminTokenChange(data.token);
      setAdminConfigured(true);
      setAdminUsername(data.username);
      setEnvOverride(Boolean(data.envOverride));
      setPasswordInput('');
      setConfirmPasswordInput('');
    } catch {
      setAuthError('Network error while creating admin credentials.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: usernameInput.trim(),
          password: passwordInput,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        token?: string;
        username?: string;
        envOverride?: boolean;
      };
      if (!res.ok || !data.token || !data.username) {
        setAuthError(data.error || 'Invalid username or password.');
        return;
      }
      onAdminTokenChange(data.token);
      setAdminUsername(data.username);
      setEnvOverride(Boolean(data.envOverride));
      setPasswordInput('');
    } catch {
      setAuthError('Network error while signing in.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handlePortalLogout = async () => {
    if (adminToken) {
      try {
        await fetch('/api/admin/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${adminToken}` },
        });
      } catch {
        // Best-effort logout
      }
    }
    onAdminTokenChange(null);
    setAdminUsername(null);
    setPasswordInput('');
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordChangeError('');
    setPasswordChangeSuccess('');

    if (newPassword.length < 4) {
      setPasswordChangeError('New password must be at least 4 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError('New passwords do not match.');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken || ''}`,
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as {
        error?: string;
        token?: string;
        success?: boolean;
      };
      if (!res.ok || !data.success) {
        setPasswordChangeError(data.error || 'Unable to update password.');
        return;
      }
      if (data.token) {
        onAdminTokenChange(data.token);
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordChangeSuccess('Admin password updated securely.');
      showNotice('Admin password changed.');
    } catch {
      setPasswordChangeError('Network error while updating password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleGoogleAccountSync = async () => {
    setActionError('');
    setGoogleConnecting(true);
    try {
      const signedUser = await signInAdminWithGoogle();
      const idToken = await signedUser.getIdToken();
      await fetch('/api/auth/sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      showNotice(`Google account ${signedUser.email} synced.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Google verification cancelled or failed.');
    } finally {
      setGoogleConnecting(false);
    }
  };

  const handleSeedCatalog = async () => {
    if (!adminToken) return;
    setSeeding(true);
    setActionError('');
    try {
      const res = await fetch('/api/admin/seed', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to sync starter catalog.');
      }
      await onRefreshCatalog();
      showNotice('Starter catalog & 3 core categories saved.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to sync starter catalog.');
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
    if (!adminToken) return;

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
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
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
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to save product.');
      }

      await onRefreshCatalog();
      setShowProductForm(false);
      resetProductForm();
      showNotice(editingProductId ? 'Product updated in store.' : 'New product published to store.');
    } catch (err) {
      setProdError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to delete product.');
      }
      await onRefreshCatalog();
      showNotice('Product removed.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete product.');
    }
  };

  const handleQuickStockAdjust = async (product: Product, nextStock: number) => {
    if (!adminToken) return;
    const clamped = Math.max(0, nextStock);
    try {
      const res = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ stock: clamped }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to update stock.');
      }
      await onRefreshCatalog();
      showNotice(`Stock updated for ${product.name}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update stock.');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminToken || catName.trim().length < 2) return;
    setSavingCat(true);
    try {
      const id = editingCatId || sanitizeSlugId(catName);
      const imageSafe =
        catImage.trim() && isSafeImageUrl(catImage.trim())
          ? catImage.trim()
          : '/src/assets/images/product_dera_crimson_1795635218722.jpg';

      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          id,
          name: catName.trim().slice(0, 60),
          description: catDesc.trim().slice(0, 400),
          image: imageSafe,
          sortOrder: editingCatId
            ? categories.find((c) => c.id === editingCatId)?.sortOrder ?? categories.length + 1
            : categories.length + 1,
          active: true,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to save category.');
      }

      await onRefreshCatalog();
      setCatName('');
      setCatDesc('');
      setCatImage('');
      setEditingCatId(null);
      showNotice('Category saved.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to save category.');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/categories/${encodeURIComponent(catId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to delete category.');
      }
      await onRefreshCatalog();
      showNotice('Category deleted.');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete category.');
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus) => {
    if (!adminToken) return;
    try {
      const res = await fetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = (await res.json()) as { error?: string; order?: Order };
      if (!res.ok) {
        throw new Error(data.error || 'Unable to update order status.');
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      showNotice(`Order updated to ${status}.`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to update order status.');
    }
  };

  // Loading state while verifying server session
  if (statusLoading) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center p-6">
        <p className="text-sm font-medium text-zinc-600">Loading SG Wholesalers Admin...</p>
      </div>
    );
  }

  // Gate: Username & Password Login (or First-Run Claim Setup)
  if (!isPortalAuthenticated) {
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

          <div className="text-center space-y-3 pt-1">
            <img
              src="/assets/aistudio/image_5584599e.png"
              alt="SG Wholesalers"
              className="w-16 h-16 rounded-xl mx-auto object-cover bg-black border border-stone-200"
            />
            <h1 className="font-display text-2xl font-bold text-zinc-950">
              {adminConfigured ? 'SG Wholesalers Admin Login' : 'Set Up SG Wholesalers Admin'}
            </h1>
            <p className="text-sm text-zinc-600">
              {adminConfigured
                ? 'Sign in with your administrator username and password to manage products, photos, prices, and orders.'
                : 'Set your initial administrator username (e.g. admin) and password. You can change your password anytime after signing in.'}
            </p>
          </div>

          {authError && (
            <p
              role="alert"
              className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg p-3"
            >
              {authError}
            </p>
          )}

          {!adminConfigured ? (
            <form onSubmit={handleFirstRunSetup} className="space-y-4">
              <div>
                <label htmlFor="setup-username" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Admin Username
                </label>
                <input
                  id="setup-username"
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:border-red-700"
                />
              </div>

              <div>
                <label htmlFor="setup-password" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Initial Password
                </label>
                <div className="relative">
                  <input
                    id="setup-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Choose your initial password"
                    autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 pr-10 text-sm border border-stone-300 rounded-xl focus:outline-none focus:border-red-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="setup-confirm" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Confirm Password
                </label>
                <input
                  id="setup-confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  value={confirmPasswordInput}
                  onChange={(e) => setConfirmPasswordInput(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:border-red-700"
                />
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                <span>{authSubmitting ? 'Creating Admin...' : 'Create Admin Account & Sign In'}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-username" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Username
                </label>
                <input
                  id="login-username"
                  type="text"
                  required
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  placeholder="admin"
                  autoComplete="username"
                  className="w-full px-3.5 py-2.5 text-sm border border-stone-300 rounded-xl focus:outline-none focus:border-red-700"
                />
              </div>

              <div>
                <label htmlFor="login-password" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter password"
                    autoComplete="current-password"
                    className="w-full px-3.5 py-2.5 pr-10 text-sm border border-stone-300 rounded-xl focus:outline-none focus:border-red-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-zinc-950 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                <span>{authSubmitting ? 'Signing in...' : 'Sign In to Admin Portal'}</span>
              </button>
            </form>
          )}

          <p className="text-[11px] text-center text-zinc-500 leading-relaxed">
            Credentials are verified on the server using salted cryptographic hashing.
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
              alt="SG Wholesalers"
              className="w-9 h-9 rounded-lg object-cover bg-black border border-zinc-700"
            />
            <div>
              <p className="font-display text-base font-bold leading-none">SG Wholesalers Admin</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Signed in as <strong className="text-white">{adminUsername}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className="hidden sm:flex px-3 py-2 rounded-lg text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 items-center gap-1.5 whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Change Password</span>
            </button>
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
              onClick={handlePortalLogout}
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

        {actionError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs text-red-800">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{actionError}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionError('')}
              className="font-semibold underline shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        {usingStarterFallback && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="text-sm text-amber-950">
              <p className="font-semibold">Starter Catalog Ready</p>
              <p className="text-xs text-amber-800 mt-0.5">
                Sync the starter SG Deras, SG Kids Coset, and Mutumba Bales items into your database so every edit saves live.
              </p>
            </div>
            <button
              type="button"
              disabled={seeding}
              onClick={handleSeedCatalog}
              className="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold rounded-lg flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
              <span>{seeding ? 'Syncing...' : 'Sync Starter Catalog'}</span>
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
              { id: 'security', label: 'Password & Security', icon: KeyRound },
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

            {/* Products Table */}
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
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void fetchOrders()}
                  className="px-3 py-2 text-xs font-semibold bg-white border border-stone-300 rounded-lg hover:bg-stone-50 flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ordersLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
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
                            `Hello ${order.customerName}, update on your SG Wholesalers order ${order.orderNumber} (${formatKSh(order.totalAmount)}): Status is now ${order.status}.`
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

        {/* TAB 4: PASSWORD & SECURITY */}
        {activeTab === 'security' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <form
              onSubmit={handleChangePassword}
              className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4"
            >
              <div>
                <h2 className="font-display text-xl font-bold text-zinc-950">
                  Change Admin Password
                </h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Account username: <strong className="text-zinc-900">{adminUsername}</strong>
                </p>
              </div>

              {envOverride && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-950">
                  Your admin password is currently set via the <code>ADMIN_PASSWORD</code> environment secret. Update or remove that secret in your hosting environment to manage passwords from here.
                </div>
              )}

              {passwordChangeError && (
                <p className="text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {passwordChangeError}
                </p>
              )}

              {passwordChangeSuccess && (
                <p className="text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  {passwordChangeSuccess}
                </p>
              )}

              <div>
                <label htmlFor="cur-pass" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Current Password *
                </label>
                <input
                  id="cur-pass"
                  type="password"
                  required
                  disabled={envOverride}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700 disabled:bg-stone-100"
                />
              </div>

              <div>
                <label htmlFor="new-pass" className="block text-xs font-semibold text-zinc-700 mb-1">
                  New Password (min 4 characters) *
                </label>
                <input
                  id="new-pass"
                  type="password"
                  required
                  minLength={4}
                  disabled={envOverride}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700 disabled:bg-stone-100"
                />
              </div>

              <div>
                <label htmlFor="conf-new-pass" className="block text-xs font-semibold text-zinc-700 mb-1">
                  Confirm New Password *
                </label>
                <input
                  id="conf-new-pass"
                  type="password"
                  required
                  minLength={4}
                  disabled={envOverride}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700 disabled:bg-stone-100"
                />
              </div>

              <button
                type="submit"
                disabled={changingPassword || envOverride}
                className="px-5 py-2.5 bg-red-700 hover:bg-red-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg"
              >
                {changingPassword ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4 self-start">
              <h3 className="font-display text-lg font-bold text-zinc-950">
                Optional Google Account Sync
              </h3>
              <p className="text-sm text-zinc-600 leading-relaxed">
                {user
                  ? `Signed in with Google as ${user.email}. Your account profile is synchronized with Firebase Authentication.`
                  : 'Link a Google account via Firebase Authentication if you want an additional verified identity record.'}
              </p>
              {!authLoading &&
                (user ? (
                  <button
                    type="button"
                    onClick={signOutAdmin}
                    className="px-4 py-2 rounded-lg border border-stone-300 text-xs font-semibold text-zinc-700 hover:bg-stone-50"
                  >
                    Sign Out Google Account
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={googleConnecting}
                    onClick={handleGoogleAccountSync}
                    className="px-4 py-2.5 rounded-lg bg-zinc-950 hover:bg-red-700 text-white text-xs font-semibold"
                  >
                    {googleConnecting ? 'Connecting...' : 'Sign In with Google'}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* TAB 5: HOSTING & DATABASE */}
        {activeTab === 'hosting' && (
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5 max-w-3xl">
            <h2 className="font-display text-xl font-bold text-zinc-950">
              Hosting, Database &amp; Security Architecture
            </h2>
            <div className="space-y-4 text-sm text-zinc-600 leading-relaxed">
              <div>
                <h3 className="font-semibold text-zinc-950">1. Server-Verified Admin Login</h3>
                <p>
                  Admin portal sign-in is handled by the Express backend using salted cryptographic password hashing (`scrypt`) stored in PostgreSQL and HMAC-signed session tokens held in memory. Passwords can be updated anytime from the <strong>Password &amp; Security</strong> tab.
                </p>
              </div>
              <div>
                <h3 className="font-semibold text-zinc-950">2. PostgreSQL &amp; Drizzle ORM Persistence</h3>
                <p>
                  All products, KSh regular and sale prices, stock counts, categories, uploaded product photos, and customer orders persist in PostgreSQL managed through Drizzle ORM. If deploying outside Google Cloud Run/AI Studio (for example on Vercel with Neon), provide your target PostgreSQL host credentials (`SQL_HOST`, `SQL_USER`, `SQL_PASSWORD`, `SQL_DB_NAME`) and `SESSION_SECRET` in your project environment variables.
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
