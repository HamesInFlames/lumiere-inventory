export type ItemType = 'count' | 'toggle';

export interface Item {
  id: string;
  category: string;
  subcategory: string;
  itemName: string;
  unit: string;
  quantity: number;
  lowThreshold: number;
  type: ItemType;
  lastUpdated: string;
  updatedBy: string;
  low: boolean;
}

export interface ItemsResponse {
  items: Item[];
  units: string[];
  lastSync: string | null;
  mode: 'local' | 'sheets';
}

export type SortKey = 'name' | 'quantity' | 'category' | 'updated';
