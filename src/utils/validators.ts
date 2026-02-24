import type { Tenant } from '@/types';

export function isTenantUnique(
  tenants: Tenant[],
  blockId: string,
  unitNo: number,
  excludeId?: string
): boolean {
  return !tenants.some(
    (t) => t.blockId === blockId && t.unitNo === unitNo && t.id !== excludeId
  );
}
