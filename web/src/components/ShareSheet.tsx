import { useEffect, useMemo, useState } from 'react';
import type { Item } from '../types';
import { formatShareMessage } from '../lib/formatShareMessage';

interface Props {
  allItems: Item[];
  viewItems: Item[];
  staffName: string;
  onClose: () => void;
}

const WHATSAPP_PHONE = (import.meta.env.VITE_WHATSAPP_PHONE || '').replace(/\D/g, '');

export function ShareSheet({ allItems, viewItems, staffName, onClose }: Props) {
  const [scope, setScope] = useState<'low' | 'view'>('low');
  const [text, setText] = useState('');
  const [edited, setEdited] = useState(false);
  const [copied, setCopied] = useState(false);

  // Regenerate the message when the scope changes (discards manual edits).
  const generated = useMemo(
    () => formatShareMessage(scope === 'low' ? allItems : viewItems, {
      scope,
      staffName,
      now: new Date(),
    }),
    [scope, allItems, viewItems, staffName],
  );

  useEffect(() => {
    setText(generated);
    setEdited(false);
  }, [generated]);

  const canWebShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const whatsappHref = `https://wa.me/${WHATSAPP_PHONE}?text=${encodeURIComponent(text)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers without the async clipboard API.
      const el = document.getElementById('share-textarea') as HTMLTextAreaElement | null;
      if (el) { el.select(); document.execCommand('copy'); }
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function webShare() {
    try {
      await navigator.share({ text });
    } catch {
      /* user cancelled — no-op */
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl p-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-lumiere-gold">Share inventory</h2>
          <button onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-full text-stone-500 hover:bg-stone-100 text-xl leading-none">
            ×
          </button>
        </div>

        {/* Scope toggle */}
        <div className="flex rounded-lg border border-stone-200 p-0.5 mb-3 text-sm">
          <button
            onClick={() => setScope('low')}
            className={`flex-1 rounded-md py-1.5 font-medium transition ${
              scope === 'low' ? 'bg-lumiere-gold text-white' : 'text-stone-600'
            }`}
          >
            Low stock only
          </button>
          <button
            onClick={() => setScope('view')}
            className={`flex-1 rounded-md py-1.5 font-medium transition ${
              scope === 'view' ? 'bg-lumiere-gold text-white' : 'text-stone-600'
            }`}
          >
            Current view
          </button>
        </div>

        <textarea
          id="share-textarea"
          value={text}
          onChange={(e) => { setText(e.target.value); setEdited(true); }}
          rows={12}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-lumiere-gold"
        />
        <p className="text-xs text-stone-400 mt-1 mb-3">
          {edited ? 'Edited — switching scope will regenerate this.' : 'You can edit before sending.'}
        </p>

        <div className="flex gap-2">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener"
            className="flex-1 text-center bg-[#25D366] text-white rounded-lg py-2.5 font-medium hover:brightness-95 transition"
          >
            WhatsApp
          </a>
          {canWebShare && (
            <button
              onClick={webShare}
              className="flex-1 bg-stone-100 text-stone-700 rounded-lg py-2.5 font-medium hover:bg-stone-200 transition"
            >
              Share…
            </button>
          )}
          <button
            onClick={copy}
            className="flex-1 bg-stone-100 text-stone-700 rounded-lg py-2.5 font-medium hover:bg-stone-200 transition"
          >
            {copied ? 'Copied ✓' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}
