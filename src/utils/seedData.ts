import type { Tenant, InfractionType, Fine } from '@/types';
import { storage } from '@/services/localStorage';

const SEED_KEY = 'ceza_seeded';

const sampleTenants: Tenant[] = [
  { id: 't1', blockId: 'A', unitNo: 1, fullName: 'AZİZ DEMİR', isVacant: false },
  { id: 't2', blockId: 'A', unitNo: 5, fullName: 'FATMA YILMAZ', isVacant: false },
  { id: 't3', blockId: 'A', unitNo: 12, fullName: 'MEHMET KAYA', isVacant: false },
  { id: 't4', blockId: 'B', unitNo: 3, fullName: 'AYŞE ÖZTÜRK', isVacant: false },
  { id: 't5', blockId: 'B', unitNo: 8, fullName: 'HALİL ŞAHİN', isVacant: false },
  { id: 't6', blockId: 'B', unitNo: 15, fullName: '', isVacant: true },
  { id: 't7', blockId: 'C', unitNo: 2, fullName: 'EMİNE ARSLAN', isVacant: false },
  { id: 't8', blockId: 'C', unitNo: 7, fullName: 'MUSTAFA ÇELİK', isVacant: false },
  { id: 't9', blockId: 'D', unitNo: 4, fullName: 'ZELİHA DOĞAN', isVacant: false },
  { id: 't10', blockId: 'D', unitNo: 11, fullName: 'ALİ YILDIZ', isVacant: false },
];

function fa(monetary: number, label = '') {
  return { monetary, label };
}

const sampleInfractions: InfractionType[] = [
  { id: 'inf1', name: 'Gürültü Şikayeti', description: 'Gece saatlerinde aşırı gürültü yapma', fineAmounts: [fa(500), fa(750), fa(1000), fa(1500), fa(2000)], category: 'Düzen', isActive: true },
  { id: 'inf2', name: 'Ortak Alan Kirliliği', description: 'Ortak alanları kirletme veya çöp bırakma', fineAmounts: [fa(300), fa(450), fa(600), fa(900), fa(1200)], category: 'Temizlik', isActive: true },
  { id: 'inf3', name: 'Otopark İhlali', description: 'Başkasının park yerine park etme', fineAmounts: [fa(400), fa(600), fa(800), fa(1200), fa(1600)], category: 'Otopark', isActive: true },
  { id: 'inf4', name: 'Aidat Gecikmesi', description: 'Aylık aidatı zamanında ödememe', fineAmounts: [fa(200), fa(300), fa(400), fa(600), fa(800)], category: 'Mali', isActive: true },
  { id: 'inf5', name: 'Evcil Hayvan İhlali', description: 'Evcil hayvan kurallarına uymama', fineAmounts: [fa(350), fa(525), fa(700), fa(1050), fa(1400)], category: 'Düzen', isActive: true },
];

const sampleFines: Fine[] = [
  { id: 'f1', tenantId: 't1', infractionTypeId: 'inf1', date: '2026-01-15', amount: 500, amountLabel: '', notes: '', isPaid: false, isDeleted: false },
  { id: 'f2', tenantId: 't1', infractionTypeId: 'inf4', date: '2026-01-20', amount: 200, amountLabel: '', notes: 'Ocak aidatı', isPaid: true, paidDate: '2026-02-01', isDeleted: false },
  { id: 'f3', tenantId: 't2', infractionTypeId: 'inf2', date: '2026-01-10', amount: 300, amountLabel: '', notes: '', isPaid: false, isDeleted: false },
  { id: 'f4', tenantId: 't3', infractionTypeId: 'inf3', date: '2026-02-01', amount: 400, amountLabel: '', notes: 'B blok park alanı', isPaid: false, isDeleted: false },
  { id: 'f5', tenantId: 't5', infractionTypeId: 'inf1', date: '2026-01-25', amount: 500, amountLabel: '', notes: 'Gece partisi', isPaid: false, isDeleted: false },
  { id: 'f6', tenantId: 't5', infractionTypeId: 'inf5', date: '2026-02-05', amount: 350, amountLabel: '', notes: '', isPaid: false, isDeleted: false },
  { id: 'f7', tenantId: 't7', infractionTypeId: 'inf4', date: '2026-01-15', amount: 200, amountLabel: '', notes: '', isPaid: true, paidDate: '2026-01-30', isDeleted: false },
  { id: 'f8', tenantId: 't8', infractionTypeId: 'inf2', date: '2026-02-10', amount: 300, amountLabel: '', notes: 'Merdiven boşluğu', isPaid: false, isDeleted: false },
  { id: 'f9', tenantId: 't9', infractionTypeId: 'inf1', date: '2026-02-12', amount: 500, amountLabel: '', notes: '', isPaid: false, isDeleted: false },
  { id: 'f10', tenantId: 't10', infractionTypeId: 'inf3', date: '2026-01-05', amount: 400, amountLabel: '', notes: '', isPaid: true, paidDate: '2026-01-10', isDeleted: false },
  { id: 'f11', tenantId: 't2', infractionTypeId: 'inf5', date: '2026-02-15', amount: 350, amountLabel: '', notes: 'Köpek gezdirme', isPaid: false, isDeleted: false },
  { id: 'f12', tenantId: 't3', infractionTypeId: 'inf4', date: '2026-02-01', amount: 200, amountLabel: '', notes: 'Şubat aidatı', isPaid: false, isDeleted: false },
  { id: 'f13', tenantId: 't1', infractionTypeId: 'inf2', date: '2026-02-18', amount: 300, amountLabel: '', notes: '', isPaid: false, isDeleted: false },
  { id: 'f14', tenantId: 't9', infractionTypeId: 'inf4', date: '2026-02-01', amount: 200, amountLabel: '', notes: '', isPaid: false, isDeleted: false },
  { id: 'f15', tenantId: 't10', infractionTypeId: 'inf1', date: '2026-02-20', amount: 500, amountLabel: '', notes: 'Tadilat gürültüsü', isPaid: false, isDeleted: false },
];

export function seedIfEmpty(): void {
  if (localStorage.getItem(SEED_KEY)) return;

  const existingTenants = storage.getAll(storage.keys.tenants);
  const existingInfractions = storage.getAll(storage.keys.infractions);
  const existingFines = storage.getAll(storage.keys.fines);

  if (existingTenants.length === 0 && existingInfractions.length === 0 && existingFines.length === 0) {
    storage.setAll(storage.keys.tenants, sampleTenants);
    storage.setAll(storage.keys.infractions, sampleInfractions);
    storage.setAll(storage.keys.fines, sampleFines);
    localStorage.setItem(SEED_KEY, 'true');
  }
}
