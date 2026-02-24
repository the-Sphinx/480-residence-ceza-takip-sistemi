import { storage } from '@/services/localStorage';
import {
  batchWriteAll,
  tenantToRow,
  infractionToRow,
  fineToRow,
  SHEET_NAMES,
} from '@/services/googleSheets';
import type { Tenant, InfractionType, Fine } from '@/types';
import { toast } from 'sonner';

export async function migrateToSheets(
  token: string,
  spreadsheetId: string,
): Promise<boolean> {
  const tenants = storage.getAll<Tenant>(storage.keys.tenants);
  const infractions = storage.getAll<InfractionType>(storage.keys.infractions);
  const fines = storage.getAll<Fine>(storage.keys.fines);

  const totalRecords = tenants.length + infractions.length + fines.length;
  if (totalRecords === 0) {
    toast.info('Aktarılacak veri bulunamadı.');
    return false;
  }

  const toastId = toast.loading(`Veriler aktarılıyor... (${totalRecords} kayıt)`);

  try {
    await batchWriteAll(token, spreadsheetId, SHEET_NAMES.tenants, tenants.map(tenantToRow));
    toast.loading(`Sakinler aktarıldı. Ceza türleri aktarılıyor...`, { id: toastId });

    await batchWriteAll(token, spreadsheetId, SHEET_NAMES.infractions, infractions.map(infractionToRow));
    toast.loading(`Ceza türleri aktarıldı. Cezalar aktarılıyor...`, { id: toastId });

    await batchWriteAll(token, spreadsheetId, SHEET_NAMES.fines, fines.map(fineToRow));

    toast.success(`${totalRecords} kayıt başarıyla aktarıldı!`, { id: toastId });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Bilinmeyen hata';
    toast.error(`Veri aktarımı başarısız: ${message}`, { id: toastId });
    return false;
  }
}

export function hasLocalData(): boolean {
  const tenants = storage.getAll(storage.keys.tenants);
  const infractions = storage.getAll(storage.keys.infractions);
  const fines = storage.getAll(storage.keys.fines);
  return tenants.length > 0 || infractions.length > 0 || fines.length > 0;
}
