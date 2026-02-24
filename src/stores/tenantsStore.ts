import { create } from 'zustand';
import type { Tenant } from '@/types';
import { storage } from '@/services/localStorage';
import { useAuthStore } from '@/stores/authStore';
import {
  readSheet,
  appendRow,
  updateRow,
  deleteRow,
  findRowIndex,
  batchWriteAll,
  tenantToRow,
  rowToTenant,
  SHEET_NAMES,
  getSpreadsheetIdFromEnv,
} from '@/services/googleSheets';
import { toast } from 'sonner';

interface TenantsState {
  tenants: Tenant[];
  isLoading: boolean;
  loadTenants: () => Promise<void>;
  addTenant: (tenant: Tenant) => Promise<void>;
  bulkAddTenants: (newTenants: Tenant[]) => Promise<void>;
  updateTenant: (id: string, updates: Partial<Tenant>) => Promise<void>;
  removeTenant: (id: string) => Promise<void>;
  getTenantById: (id: string) => Tenant | undefined;
  searchTenants: (query: string, blockFilter?: string) => Tenant[];
}

function getAuth() {
  const { isSignedIn, accessToken, autoSync, setSyncStatus } = useAuthStore.getState();
  const spreadsheetId = getSpreadsheetIdFromEnv();
  const shouldSync = isSignedIn && autoSync;
  return { isSignedIn: shouldSync, accessToken, spreadsheetId, setSyncStatus };
}

export const useTenantsStore = create<TenantsState>((set, get) => ({
  tenants: [],
  isLoading: false,

  loadTenants: async () => {
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      set({ isLoading: true });
      setSyncStatus('syncing');
      try {
        const tenants = await readSheet(accessToken, spreadsheetId, SHEET_NAMES.tenants, rowToTenant);
        storage.setAll(storage.keys.tenants, tenants);
        set({ tenants, isLoading: false });
        setSyncStatus('idle');
        useAuthStore.getState().setLastSyncTime(new Date().toISOString());
        return;
      } catch {
        setSyncStatus('error');
        // Fall through to localStorage
      }
    }

    const tenants = storage.getAll<Tenant>(storage.keys.tenants);
    set({ tenants, isLoading: false });
  },

  addTenant: async (tenant) => {
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        await appendRow(accessToken, spreadsheetId, SHEET_NAMES.tenants, tenantToRow(tenant));
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Sakin eklenemedi: Bulut bağlantı hatası');
        return;
      }
    }

    storage.create(storage.keys.tenants, tenant);
    set((state) => ({ tenants: [...state.tenants, tenant] }));
  },

  bulkAddTenants: async (newTenants) => {
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();
    const existing = get().tenants;
    const merged = [...existing, ...newTenants];

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        await batchWriteAll(accessToken, spreadsheetId, SHEET_NAMES.tenants, merged.map(tenantToRow));
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Toplu sakin ekleme başarısız: Bulut bağlantı hatası');
        return;
      }
    }

    storage.setAll(storage.keys.tenants, merged);
    set({ tenants: merged });
  },

  updateTenant: async (id, updates) => {
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        const rowIndex = await findRowIndex(accessToken, spreadsheetId, SHEET_NAMES.tenants, id);
        const current = get().tenants.find((t) => t.id === id);
        if (!current) return;
        const updated = { ...current, ...updates };
        await updateRow(accessToken, spreadsheetId, SHEET_NAMES.tenants, rowIndex, tenantToRow(updated));
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Sakin güncellenemedi: Bulut bağlantı hatası');
        return;
      }
    }

    storage.update<Tenant>(storage.keys.tenants, id, updates);
    set((state) => ({
      tenants: state.tenants.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  removeTenant: async (id) => {
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        const rowIndex = await findRowIndex(accessToken, spreadsheetId, SHEET_NAMES.tenants, id);
        await deleteRow(accessToken, spreadsheetId, SHEET_NAMES.tenants, rowIndex);
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Sakin silinemedi: Bulut bağlantı hatası');
        return;
      }
    }

    storage.remove<Tenant>(storage.keys.tenants, id);
    set((state) => ({ tenants: state.tenants.filter((t) => t.id !== id) }));
  },

  getTenantById: (id) => {
    return get().tenants.find((t) => t.id === id);
  },

  searchTenants: (query, blockFilter) => {
    const q = query.toLowerCase();
    return get().tenants.filter((t) => {
      const matchesBlock = !blockFilter || t.blockId === blockFilter;
      const matchesQuery =
        !q ||
        t.fullName.toLowerCase().includes(q) ||
        `${t.blockId}-${t.unitNo}`.toLowerCase().includes(q) ||
        t.unitNo.toString().includes(q);
      return matchesBlock && matchesQuery;
    });
  },
}));
