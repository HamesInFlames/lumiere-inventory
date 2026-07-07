import { useState } from 'react';
import type { Note } from '../types';

interface Props {
  notes: Note[];
  onAdd: (text: string) => void;
  onDelete: (id: string) => void;
}

function formatWhen(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export function NotesPanel({ notes, onAdd, onDelete }: Props) {
  const [text, setText] = useState('');

  function submit() {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
  }

  // Newest first.
  const ordered = [...notes].sort((a, b) => (b.created || '').localeCompare(a.created || ''));

  return (
    <div className="flex flex-col">
      <h2 className="text-base font-semibold text-brand-ink mb-2">Notes</h2>

      <div className="mb-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
          }}
          rows={2}
          placeholder="Add a note…"
          className="w-full rounded-lg border border-brand-line px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-brand-rose"
        />
        <button
          onClick={submit}
          disabled={!text.trim()}
          className="mt-1 w-full bg-brand-ink text-white rounded-lg py-2 text-sm font-medium disabled:opacity-40 hover:bg-black transition"
        >
          Add
        </button>
      </div>

      {ordered.length === 0 ? (
        <p className="text-sm text-brand-inkSoft py-4 text-center">No notes yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ordered.map((n) => (
            <li key={n.id} className="rounded-lg border border-brand-line bg-brand-bg p-3">
              <div className="text-sm text-brand-ink whitespace-pre-wrap break-words">{n.text}</div>
              <div className="mt-1.5 flex items-center justify-between text-xs text-brand-inkSoft">
                <span>{[n.by, formatWhen(n.created)].filter(Boolean).join(' · ')}</span>
                <button
                  onClick={() => onDelete(n.id)}
                  aria-label="Delete note"
                  className="shrink-0 w-6 h-6 rounded-full text-brand-inkSoft hover:bg-brand-surface leading-none"
                >
                  ×
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
