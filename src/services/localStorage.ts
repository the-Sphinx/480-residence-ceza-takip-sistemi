const STORAGE_KEYS = {
  tenants: 'ceza_tenants',
  infractions: 'ceza_infractions',
  fines: 'ceza_fines',
} as const;

type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

function getAll<T>(key: StorageKey): T[] {
  const data = localStorage.getItem(key);
  if (!data) return [];
  return JSON.parse(data) as T[];
}

function getById<T extends { id: string }>(key: StorageKey, id: string): T | undefined {
  const items = getAll<T>(key);
  return items.find(item => item.id === id);
}

function create<T extends { id: string }>(key: StorageKey, item: T): T {
  const items = getAll<T>(key);
  items.push(item);
  localStorage.setItem(key, JSON.stringify(items));
  return item;
}

function update<T extends { id: string }>(key: StorageKey, id: string, updates: Partial<T>): T | undefined {
  const items = getAll<T>(key);
  const index = items.findIndex(item => item.id === id);
  if (index === -1) return undefined;
  items[index] = { ...items[index], ...updates };
  localStorage.setItem(key, JSON.stringify(items));
  return items[index];
}

function remove<T extends { id: string }>(key: StorageKey, id: string): boolean {
  const items = getAll<T>(key);
  const filtered = items.filter(item => item.id !== id);
  if (filtered.length === items.length) return false;
  localStorage.setItem(key, JSON.stringify(filtered));
  return true;
}

function setAll<T>(key: StorageKey, items: T[]): void {
  localStorage.setItem(key, JSON.stringify(items));
}

export const storage = {
  keys: STORAGE_KEYS,
  getAll,
  getById,
  create,
  update,
  remove,
  setAll,
};
