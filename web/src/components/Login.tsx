import { useState } from 'react';
import { api } from '../api';

export function Login({ onAuthed }: { onAuthed: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.login(password);
      onAuthed();
    } catch {
      setError('Incorrect password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm bg-brand-bg rounded-2xl shadow-sm border border-brand-line p-8">
        <div className="text-center mb-6">
          <div className="text-gradient font-display font-light text-3xl leading-none tracking-[0.28em] pl-[0.28em]">
            LUMIÈRE
          </div>
          <div className="text-[11px] tracking-[0.35em] text-brand-inkSoft font-display pl-[0.35em] mt-1">
            PÂTISSERIE
          </div>
          <p className="text-brand-inkSoft mt-3 text-sm tracking-wide">Inventory</p>
        </div>
        <label className="block text-sm font-medium text-brand-inkSoft mb-1">Staff password</label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-brand-line px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-brand-rose"
        />
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full bg-brand-ink text-white rounded-lg py-2.5 font-medium disabled:opacity-50 hover:bg-black transition"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
