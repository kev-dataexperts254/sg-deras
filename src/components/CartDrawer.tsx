import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  MapPin,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  Truck,
  X,
} from 'lucide-react';
import { CustomerDetails, DeliveryMethod, ResolvedCartItem } from '../types';
import {
  buildOrderWhatsAppMessage,
  buildWhatsAppUrl,
  formatKSh,
  GOLINK_WHATSAPP_DISPLAY,
  GOLINK_WHATSAPP_NUMBER,
  STORE_WHATSAPP_DISPLAY,
  STORE_WHATSAPP_NUMBER,
} from '../utils/formatters';
import { SafeImage } from './SafeImage';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: ResolvedCartItem[];
  totalAmount: number;
  customer: CustomerDetails;
  onCustomerChange: (next: CustomerDetails) => void;
  onUpdateQuantity: (productId: string, variant: string, delta: number) => void;
  onRemoveItem: (productId: string, variant: string) => void;
  onClearCart: () => void;
  onRecordOrder: (
    orderNumber: string,
    items: ResolvedCartItem[],
    totalAmount: number,
    customer: CustomerDetails,
    deliveryMethod: DeliveryMethod
  ) => Promise<void>;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  items,
  totalAmount,
  customer,
  onCustomerChange,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onRecordOrder,
}) => {
  const [orderSeed, setOrderSeed] = useState<string>(() => {
    const stamp = Date.now().toString().slice(-5);
    const rand = Math.floor(10 + Math.random() * 89);
    return `SG-${stamp}${rand}`;
  });
  const [copied, setCopied] = useState(false);
  const drawerBodyRef = useRef<HTMLDivElement>(null);
  const [lastSubmitted, setLastSubmitted] = useState<{
    orderNumber: string;
    deliveryMethod: DeliveryMethod;
    whatsappUrl: string;
    messageText: string;
    total: number;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const standardMessage = buildOrderWhatsAppMessage(
    orderSeed,
    items,
    totalAmount,
    customer,
    'whatsapp_standard'
  );
  const standardUrl = buildWhatsAppUrl(STORE_WHATSAPP_NUMBER, standardMessage);

  const goLinkMessage = buildOrderWhatsAppMessage(
    orderSeed,
    items,
    totalAmount,
    customer,
    'golink_nairobi'
  );
  const goLinkUrl = buildWhatsAppUrl(GOLINK_WHATSAPP_NUMBER, goLinkMessage);

  const handleCheckoutClick = (deliveryMethod: DeliveryMethod) => {
    if (items.length === 0) return;

    const currentOrderNumber = orderSeed;
    const messageText =
      deliveryMethod === 'golink_nairobi' ? goLinkMessage : standardMessage;
    const whatsappUrl =
      deliveryMethod === 'golink_nairobi' ? goLinkUrl : standardUrl;

    // Persist order asynchronously to Firestore for Admin order tracking
    void onRecordOrder(
      currentOrderNumber,
      items,
      totalAmount,
      customer,
      deliveryMethod
    ).catch((err) => {
      console.error('Order record notice:', err);
    });

    setLastSubmitted({
      orderNumber: currentOrderNumber,
      deliveryMethod,
      whatsappUrl,
      messageText,
      total: totalAmount,
    });
    setCopied(false);

    // Rotate order number for next checkout click
    const stamp = Date.now().toString().slice(-5);
    const rand = Math.floor(10 + Math.random() * 89);
    setOrderSeed(`SG-${stamp}${rand}`);
    drawerBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCopyOrderMessage = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in restricted contexts
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="Shopping Bag"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-red-700" />
            <h2 className="font-display text-xl font-bold text-zinc-950">Your Bag</h2>
            <span className="text-xs font-medium text-zinc-500 tabular-nums">
              ({items.reduce((acc, i) => acc + i.quantity, 0)} items)
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shopping bag"
            className="p-2 rounded-lg text-zinc-600 hover:text-zinc-950 hover:bg-stone-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div ref={drawerBodyRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
          {lastSubmitted && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-emerald-950">
                    Order {lastSubmitted.orderNumber} ready for WhatsApp
                  </p>
                  <p className="text-emerald-800 mt-1">
                    {lastSubmitted.deliveryMethod === 'golink_nairobi'
                      ? `Prepared for GoLink Delivery Service (${GOLINK_WHATSAPP_DISPLAY}) — Nairobi doorstep delivery.`
                      : `Prepared for SG Wholesalers (${STORE_WHATSAPP_DISPLAY}).`}{' '}
                    Total: <strong className="tabular-nums">{formatKSh(lastSubmitted.total)}</strong>.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href={lastSubmitted.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors"
                >
                  <span>Open WhatsApp Chat</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <button
                  type="button"
                  onClick={() => handleCopyOrderMessage(lastSubmitted.messageText)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-900 text-xs font-semibold hover:bg-emerald-100 transition-colors"
                >
                  {copied ? 'Copied Order Message!' : 'Copy Order Message'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClearCart();
                    setLastSubmitted(null);
                  }}
                  className="text-xs font-medium text-zinc-600 hover:text-zinc-950"
                >
                  Clear bag
                </button>
              </div>
            </div>
          )}

          {items.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-stone-100 mx-auto flex items-center justify-center text-zinc-400">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <div>
                <p className="text-base font-semibold text-zinc-900">Your shopping bag is empty</p>
                <p className="text-sm text-zinc-500 mt-1">
                  Explore SG Deras, SG Kids Coset, and Mutumba Bales to add items.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-zinc-950 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors"
              >
                Browse Collections
              </button>
            </div>
          ) : (
            <>
              {/* Cart Items */}
              <div className="divide-y divide-stone-200 border-b border-stone-200 pb-4">
                {items.map((item) => (
                  <div
                    key={`${item.product.id}-${item.variant}`}
                    className="py-4 first:pt-0 flex gap-3.5"
                  >
                    <div className="w-20 h-24 rounded-lg overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                      <SafeImage
                        src={item.product.images[0]}
                        alt={item.product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-zinc-900 leading-snug line-clamp-2">
                            {item.product.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.product.id, item.variant)}
                            aria-label={`Remove ${item.product.name}`}
                            className="p-1 text-zinc-400 hover:text-red-700 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {item.product.category} · {item.variant}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-3 mt-3">
                        <div className="inline-flex items-center border border-stone-300 rounded-md">
                          <button
                            type="button"
                            onClick={() => onUpdateQuantity(item.product.id, item.variant, -1)}
                            aria-label="Decrease quantity"
                            className="w-7 h-7 flex items-center justify-center text-zinc-700 hover:bg-stone-100"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center text-xs font-semibold tabular-nums">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            disabled={item.quantity >= item.product.stock}
                            onClick={() => onUpdateQuantity(item.product.id, item.variant, 1)}
                            aria-label="Increase quantity"
                            className="w-7 h-7 flex items-center justify-center text-zinc-700 hover:bg-stone-100 disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-zinc-950 tabular-nums">
                            {formatKSh(item.lineTotal)}
                          </p>
                          <p className="text-[11px] text-zinc-500 tabular-nums">
                            {formatKSh(item.unitPrice)} each
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Customer Delivery Details */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-zinc-950">
                  Customer &amp; Delivery Details (Optional — included in WhatsApp message)
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="checkout-name" className="block text-xs font-medium text-zinc-700 mb-1">
                      Full Name
                    </label>
                    <input
                      id="checkout-name"
                      type="text"
                      value={customer.name}
                      onChange={(e) => onCustomerChange({ ...customer, name: e.target.value })}
                      placeholder="e.g. Amina Hassan"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700"
                    />
                  </div>
                  <div>
                    <label htmlFor="checkout-phone" className="block text-xs font-medium text-zinc-700 mb-1">
                      Phone / WhatsApp
                    </label>
                    <input
                      id="checkout-phone"
                      type="tel"
                      value={customer.phone}
                      onChange={(e) => onCustomerChange({ ...customer, phone: e.target.value })}
                      placeholder="e.g. 0712 345 678"
                      className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="checkout-location" className="block text-xs font-medium text-zinc-700 mb-1">
                    Delivery Location / Nairobi Estate / Town
                  </label>
                  <input
                    id="checkout-location"
                    type="text"
                    value={customer.location}
                    onChange={(e) => onCustomerChange({ ...customer, location: e.target.value })}
                    placeholder="e.g. Kilimani, Nairobi / Mombasa / Diaspora"
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700"
                  />
                </div>

                <div>
                  <label htmlFor="checkout-notes" className="block text-xs font-medium text-zinc-700 mb-1">
                    Order Notes (Optional)
                  </label>
                  <input
                    id="checkout-notes"
                    type="text"
                    value={customer.notes}
                    onChange={(e) => onCustomerChange({ ...customer, notes: e.target.value })}
                    placeholder="Preferred color, landmark, or delivery time"
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:border-red-700"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Drawer Footer: Dual WhatsApp Checkout */}
        {items.length > 0 && (
          <div className="border-t border-stone-200 bg-stone-50 px-5 py-4 space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-zinc-600">Current Bag Total</span>
              <span className="text-xl font-bold text-zinc-950 tabular-nums">
                {formatKSh(totalAmount)}
              </span>
            </div>

            {/* Primary Storefront WhatsApp Checkout */}
            <a
              href={standardUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => handleCheckoutClick('whatsapp_standard')}
              className="w-full py-3.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors shadow-xs"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>Checkout via WhatsApp ({STORE_WHATSAPP_DISPLAY})</span>
            </a>

            {/* Separate Nairobi Doorstep Delivery Option */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <div className="flex items-start gap-2 text-xs text-amber-950">
                <MapPin className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <p>
                  <strong>Nairobi Doorstep Delivery Only:</strong> Need same-day rider dispatch straight to your home or office within Nairobi?
                </p>
              </div>
              <a
                href={goLinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => handleCheckoutClick('golink_nairobi')}
                className="w-full py-3 px-4 rounded-lg bg-zinc-950 hover:bg-red-700 text-white font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors text-center"
              >
                <Truck className="w-4 h-4 shrink-0" />
                <span>Get your delivery faster via GoLink Delivery Service</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
