import React from 'react';
import { MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl, STORE_WHATSAPP_NUMBER } from '../utils/formatters';

export const FloatingWhatsApp: React.FC = () => {
  const url = buildWhatsAppUrl(
    STORE_WHATSAPP_NUMBER,
    'Hello SG Collections! I would like help placing an order.'
  );

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with SG Collections on WhatsApp"
      className="fixed bottom-5 right-5 z-30 flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-700 hover:bg-emerald-800 text-white shadow-lg transition-transform hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
    >
      <MessageCircle className="w-5 h-5 shrink-0" />
      <span className="text-xs font-semibold whitespace-nowrap hidden sm:inline">
        Chat on WhatsApp
      </span>
    </a>
  );
};
