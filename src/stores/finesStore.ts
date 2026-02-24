import { create } from 'zustand';
import type { Fine } from '@/types';
import { storage } from '@/services/localStorage';
import { useAuthStore } from '@/stores/authStore';
import {
  readSheet,
  appendRow,
  updateRow,
  findRowIndex,
  batchWriteAll,
  fineToRow,
  rowToFine,
  SHEET_NAMES,
  getSpreadsheetIdFromEnv,
} from '@/services/googleSheets';
import { toISODate } from '@/utils/formatters';
import { toast } from 'sonner';

interface FinesState {
  fines: Fine[];
  isLoading: boolean;
  loadFines: () => Promise<void>;
  addFine: (fine: Fine) => Promise<void>;
  markPaid: (id: string) => Promise<void>;
  markAllPaid: (tenantId: string) => Promise<void>;
  softDelete: (id: string) => Promise<void>;
  getByTenant: (tenantId: string) => Fine[];
  getActiveFines: () => Fine[];
}

function getAuth() {
  const { isSignedIn, accessToken, autoSync, setSyncStatus } = useAuthStore.getState();
  const spreadsheetId = getSpreadsheetIdFromEnv();
  const shouldSync = isSignedIn && autoSync;
  return { isSignedIn: shouldSync, accessToken, spreadsheetId, setSyncStatus };
}

export const useFinesStore = create<FinesState>((set, get) => ({
  fines: [],
  isLoading: false,

  loadFines: async () => {
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      set({ isLoading: true });
      setSyncStatus('syncing');
      try {
        const fines = await readSheet(accessToken, spreadsheetId, SHEET_NAMES.fines, rowToFine);
        storage.setAll(storage.keys.fines, fines);
        set({ fines, isLoading: false });
        setSyncStatus('idle');
        useAuthStore.getState().setLastSyncTime(new Date().toISOString());
        return;
      } catch {
        setSyncStatus('error');
      }
    }

    const fines = storage.getAll<Fine>(storage.keys.fines);
    set({ fines, isLoading: false });
  },

  addFine: async (fine) => {
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        await appendRow(accessToken, spreadsheetId, SHEET_NAMES.fines, fineToRow(fine));
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Ceza eklenemedi: Bulut bağlantı hatası');
        return;
      }
    }

    storage.create(storage.keys.fines, fine);
    set((state) => ({ fines: [...state.fines, fine] }));
  },

  markPaid: async (id) => {
    const updates = { isPaid: true, paidDate: toISODate() };
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        const rowIndex = await findRowIndex(accessToken, spreadsheetId, SHEET_NAMES.fines, id);
        const current = get().fines.find((f) => f.id === id);
        if (!current) return;
        const updated = { ...current, ...updates };
        await updateRow(accessToken, spreadsheetId, SHEET_NAMES.fines, rowIndex, fineToRow(updated));
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Ödeme işareti kaydedilemedi: Bulut bağlantı hatası');
        return;
      }
    }

    storage.update<Fine>(storage.keys.fines, id, updates);
    set((state) => ({
      fines: state.fines.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));
  },

  markAllPaid: async (tenantId) => {
    const today = toISODate();
    const updatedFines = get().fines.map((f) => {
      if (f.tenantId === tenantId && !f.isPaid && !f.isDeleted) {
        return { ...f, isPaid: true, paidDate: today };
      }
      return f;
    });

    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        await batchWriteAll(accessToken, spreadsheetId, SHEET_NAMES.fines, updatedFines.map(fineToRow));
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Toplu ödeme kaydedilemedi: Bulut bağlantı hatası');
        return;
      }
    }

    storage.setAll(storage.keys.fines, updatedFines);
    set({ fines: updatedFines });
  },

  softDelete: async (id) => {
    const updates = { isDeleted: true };
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        const rowIndex = await findRowIndex(accessToken, spreadsheetId, SHEET_NAMES.fines, id);
        const current = get().fines.find((f) => f.id === id);
        if (!current) return;
        const updated = { ...current, ...updates };
        await updateRow(accessToken, spreadsheetId, SHEET_NAMES.fines, rowIndex, fineToRow(updated));
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Ceza silinemedi: Bulut bağlantı hatası');
        return;
      }
    }

    storage.update<Fine>(storage.keys.fines, id, updates);
    set((state) => ({
      fines: state.fines.map((f) => (f.id === id ? { ...f, ...updates } : f)),
    }));
  },

  getByTenant: (tenantId) => {
    return get().fines.filter((f) => f.tenantId === tenantId && !f.isDeleted);
  },

  getActiveFines: () => {
    return get().fines.filter((f) => !f.isDeleted);
  },
}));
