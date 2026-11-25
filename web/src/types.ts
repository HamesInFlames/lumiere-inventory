export type ItemStatus = 'have' | 'low' | 'urgent';

export interface Item {
  id: string;
  category: string;
  subcategory: string;
  itemName: string;
  unit: string;
  quantity: number;
  status: ItemStatus;
  lastUpdated: string;
  updatedBy: string;
  low: boolean; // derived: status !== 'have'
}

export interface Note {
  id: string;
  text: string;
  by: string;
  created: string;
}

export interface ItemsResponse {
  items: Item[];
  units: string[];
  notes: Note[];
  lastSync: string | null;
  mode: 'local' | 'sheets';
}

export type SortKey = 'name' | 'quantity' | 'category' | 'updated';
