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
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <h1 className="text-2xl font-bold text-lumiere-gold text-center">Lumière</h1>
        <p className="text-center text-stone-500 mb-6 text-sm">Bar Inventory</p>
        <label className="block text-sm font-medium text-stone-600 mb-1">Staff password</label>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-stone-300 px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-lumiere-gold"
        />
        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
        <button
          type="submit"
          disabled={busy || !password}
          className="w-full bg-lumiere-gold text-white rounded-lg py-2.5 font-medium disabled:opacity-50 hover:bg-lumiere-dark transition"
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
