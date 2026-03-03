export interface Block {
  id: string;           // "A", "B", ... "J"
  name: string;         // "A Blok"
  unitCount: number;
}

export interface Tenant {
  id: string;           // UUID
  blockId: string;      // "A"
  unitNo: number;       // 1-40
  fullName: string;     // "AZİZ DEMİR"
  isVacant: boolean;    // true for "BOŞDAİRE"
}

export interface FineAmount {
  monetary: number;  // TL amount (0 for warnings)
  label: string;     // non-monetary part ("" for pure monetary, "Uyarı" for warnings, "dava" for composite)
}

export interface InfractionType {
  id: string;           // UUID
  name: string;         // e.g. "Gürültü Şikayeti"
  description: string;
  fineAmounts: FineAmount[];  // [1st, 2nd, 3rd, 4th, 5th+] escalating amounts
  category?: string;    // optional grouping
  isActive: boolean;
  fineNo?: number;      // Madde numarası (article number)
}

export interface Fine {
  id: string;           // UUID
  tenantId: string;
  infractionTypeId: string;
  date: string;         // ISO date
  amount: number;       // snapshot of monetary amount at time of issue
  amountLabel: string;  // non-monetary label ("" for pure monetary, "Uyarı" for warnings, "dava" for composite)
  notes: string;
  isPaid: boolean;
  paidDate?: string;
  isDeleted: boolean;   // soft delete
  time?: string;        // HH:mm format
  location?: string;    // İhlal yeri
  tierIndex?: number;   // which tier was applied (0-4)
}

export interface AuthState {
  isSignedIn: boolean;
  accessToken: string | null;
  userEmail: string | null;
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export const BLOCKS: Block[] = [
  { id: 'A', name: 'A Blok', unitCount: 36 },
  { id: 'B', name: 'B Blok', unitCount: 36 },
  { id: 'C', name: 'C Blok', unitCount: 40 },
  { id: 'D', name: 'D Blok', unitCount: 40 },
  { id: 'E', name: 'E Blok', unitCount: 40 },
  { id: 'F', name: 'F Blok', unitCount: 48 },
  { id: 'G', name: 'G Blok', unitCount: 40 },
  { id: 'H', name: 'H Blok', unitCount: 48 },
  { id: 'I', name: 'I Blok', unitCount: 40 },
  { id: 'J', name: 'J Blok', unitCount: 36 },
  { id: 'K', name: 'K Blok', unitCount: 40 },
];
