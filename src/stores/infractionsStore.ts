import { create } from 'zustand';
import type { InfractionType } from '@/types';
import { storage } from '@/services/localStorage';
import { useAuthStore } from '@/stores/authStore';
import {
  readSheet,
  appendRow,
  updateRow,
  findRowIndex,
  batchWriteAll,
  infractionToRow,
  rowToInfraction,
  SHEET_NAMES,
  getSpreadsheetIdFromEnv,
} from '@/services/googleSheets';
import { toast } from 'sonner';

interface InfractionsState {
  infractions: InfractionType[];
  isLoading: boolean;
  loadInfractions: () => Promise<void>;
  addInfraction: (infraction: InfractionType) => Promise<void>;
  bulkAddInfractions: (newInfractions: InfractionType[]) => Promise<void>;
  updateInfraction: (id: string, updates: Partial<InfractionType>) => Promise<void>;
  toggleActive: (id: string) => Promise<void>;
  getActiveInfractions: () => InfractionType[];
}

function getAuth() {
  const { isSignedIn, accessToken, autoSync, setSyncStatus } = useAuthStore.getState();
  const spreadsheetId = getSpreadsheetIdFromEnv();
  const shouldSync = isSignedIn && autoSync;
  return { isSignedIn: shouldSync, accessToken, spreadsheetId, setSyncStatus };
}

export const useInfractionsStore = create<InfractionsState>((set, get) => ({
  infractions: [],
  isLoading: false,

  loadInfractions: async () => {
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      set({ isLoading: true });
      setSyncStatus('syncing');
      try {
        const infractions = await readSheet(accessToken, spreadsheetId, SHEET_NAMES.infractions, rowToInfraction);
        storage.setAll(storage.keys.infractions, infractions);
        set({ infractions, isLoading: false });
        setSyncStatus('idle');
        useAuthStore.getState().setLastSyncTime(new Date().toISOString());
        return;
      } catch {
        setSyncStatus('error');
      }
    }

    const infractions = storage.getAll<InfractionType>(storage.keys.infractions);
    set({ infractions, isLoading: false });
  },

  addInfraction: async (infraction) => {
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        await appendRow(accessToken, spreadsheetId, SHEET_NAMES.infractions, infractionToRow(infraction));
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Ceza türü eklenemedi: Bulut bağlantı hatası');
        return;
      }
    }

    storage.create(storage.keys.infractions, infraction);
    set((state) => ({ infractions: [...state.infractions, infraction] }));
  },

  bulkAddInfractions: async (newInfractions) => {
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();
    const existing = get().infractions;
    const merged = [...existing, ...newInfractions];

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        await batchWriteAll(accessToken, spreadsheetId, SHEET_NAMES.infractions, merged.map(infractionToRow));
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Toplu ceza türü ekleme başarısız: Bulut bağlantı hatası');
        return;
      }
    }

    storage.setAll(storage.keys.infractions, merged);
    set({ infractions: merged });
  },

  updateInfraction: async (id, updates) => {
    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        const rowIndex = await findRowIndex(accessToken, spreadsheetId, SHEET_NAMES.infractions, id);
        const current = get().infractions.find((i) => i.id === id);
        if (!current) return;
        const updated = { ...current, ...updates };
        await updateRow(accessToken, spreadsheetId, SHEET_NAMES.infractions, rowIndex, infractionToRow(updated));
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Ceza türü güncellenemedi: Bulut bağlantı hatası');
        return;
      }
    }

    storage.update<InfractionType>(storage.keys.infractions, id, updates);
    set((state) => ({
      infractions: state.infractions.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }));
  },

  toggleActive: async (id) => {
    const infraction = get().infractions.find((i) => i.id === id);
    if (!infraction) return;
    const updates = { isActive: !infraction.isActive };

    const { isSignedIn, accessToken, spreadsheetId, setSyncStatus } = getAuth();

    if (isSignedIn && accessToken && spreadsheetId) {
      setSyncStatus('syncing');
      try {
        const rowIndex = await findRowIndex(accessToken, spreadsheetId, SHEET_NAMES.infractions, id);
        const updated = { ...infraction, ...updates };
        await updateRow(accessToken, spreadsheetId, SHEET_NAMES.infractions, rowIndex, infractionToRow(updated));
        setSyncStatus('idle');
      } catch (error) {
        setSyncStatus('error');
        toast.error(error instanceof Error ? error.message : 'Ceza türü güncellenemedi: Bulut bağlantı hatası');
        return;
      }
    }

    storage.update<InfractionType>(storage.keys.infractions, id, updates);
    set((state) => ({
      infractions: state.infractions.map((i) => (i.id === id ? { ...i, ...updates } : i)),
    }));
  },

  getActiveInfractions: () => {
    return get().infractions.filter((i) => i.isActive);
  },
}));
