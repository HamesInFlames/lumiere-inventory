import type { Item, ItemsResponse, Note } from './types';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || res.statusText);
  return res.json();
}

export const api = {
  async session(): Promise<boolean> {
    const res = await fetch('/api/session');
    return (await json<{ authed: boolean }>(res)).authed;
  },

  async login(password: string): Promise<void> {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    await json(res);
  },

  async getItems(): Promise<ItemsResponse> {
    return json<ItemsResponse>(await fetch('/api/items'));
  },

  async patchItem(
    id: string,
    patch: { quantity?: number; unit?: string; lowThreshold?: number },
    updatedBy: string,
  ): Promise<Item> {
    const res = await fetch(`/api/items/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...patch, updatedBy }),
    });
    return (await json<{ item: Item }>(res)).item;
  },

  async addNote(text: string, by: string): Promise<Note> {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, by }),
    });
    return (await json<{ note: Note }>(res)).note;
  },

  async deleteNote(id: string): Promise<void> {
    const res = await fetch(`/api/notes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error(res.statusText);
  },
};
