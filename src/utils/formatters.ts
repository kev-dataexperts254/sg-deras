import { CustomerDetails, DeliveryMethod, Product, ResolvedCartItem } from '../types';

export const STORE_WHATSAPP_NUMBER = '254723157639';
export const STORE_WHATSAPP_DISPLAY = '+254 723 157 639';
export const GOLINK_WHATSAPP_NUMBER = '254118457993';
export const GOLINK_WHATSAPP_DISPLAY = '+254 118 457 993';

export function formatKSh(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `KSh ${safe.toLocaleString('en-KE')}`;
}

export function getEffectivePrice(product: Pick<Product, 'price' | 'salePrice'>): number {
  if (product.salePrice > 0 && product.salePrice < product.price) {
    return product.salePrice;
  }
  return product.price;
}

export function getDiscountPercent(price: number, salePrice: number): number {
  if (salePrice <= 0 || salePrice >= price || price <= 0) return 0;
  return Math.round(((price - salePrice) / price) * 100);
}

export function sanitizeSlugId(input: string): string {
  const cleaned = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return cleaned || `item-${Date.now()}`;
}

export function isSafeImageUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/assets/') || trimmed.startsWith('/src/assets/')) {
    return true;
  }
  if (trimmed.startsWith('data:image/jpeg;base64,') || trimmed.startsWith('data:image/png;base64,') || trimmed.startsWith('data:image/webp;base64,')) {
    return trimmed.length <= 300000;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function buildWhatsAppUrl(phoneDigits: string, message: string): string {
  const digits = phoneDigits.replace(/[^0-9]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildOrderWhatsAppMessage(
  orderNumber: string,
  items: ResolvedCartItem[],
  totalAmount: number,
  customer: CustomerDetails,
  deliveryMethod: DeliveryMethod
): string {
  const header =
    deliveryMethod === 'golink_nairobi'
      ? `*GOLINK NAIROBI DOORSTEP DELIVERY REQUEST*\n*SG Collections Order:* ${orderNumber}\n_Doorstep delivery within Nairobi_`
      : `*NEW ORDER — SG COLLECTIONS*\n*Order Ref:* ${orderNumber}`;

  const itemLines = items
    .map(
      (item, index) =>
        `${index + 1}. *${item.product.name}* (${item.variant})\n   Qty: ${item.quantity} x ${formatKSh(item.unitPrice)} = ${formatKSh(item.lineTotal)}`
    )
    .join('\n');

  const customerLines = [
    `*Customer:* ${customer.name.trim() || 'Not provided'}`,
    `*Phone:* ${customer.phone.trim() || 'Not provided'}`,
    `*Delivery Location:* ${customer.location.trim() || (deliveryMethod === 'golink_nairobi' ? 'Nairobi (Please confirm estate/street)' : 'To be confirmed')}`,
    customer.notes.trim() ? `*Notes:* ${customer.notes.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return [
    header,
    '',
    '*Items Ordered:*',
    itemLines,
    '',
    `*Total Amount:* ${formatKSh(totalAmount)}`,
    '',
    customerLines,
    '',
    deliveryMethod === 'golink_nairobi'
      ? 'Please arrange fast Nairobi doorstep delivery via GoLink Delivery Service.'
      : 'Please confirm availability and payment/dispatch details. Asante!',
  ].join('\n');
}

export async function compressImageToDataUrl(file: File, maxDimension = 760, maxLength = 220000): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas image processing is unavailable.'));
          return;
        }
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > maxLength && quality > 0.35) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        if (dataUrl.length > 295000) {
          reject(new Error('Image is still too large after compression. Please choose a smaller photo.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
