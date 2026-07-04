import type { Item, ItemsResponse } from './types';

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
};
