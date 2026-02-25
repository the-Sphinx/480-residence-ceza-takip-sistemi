import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFinesStore } from '@/stores/finesStore';
import { useTenantsStore } from '@/stores/tenantsStore';
import { useInfractionsStore } from '@/stores/infractionsStore';
import { formatCurrency, formatDate, formatFineAmount } from '@/utils/formatters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Check, Trash2, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { BLOCKS } from '@/types';

type SortField = 'date' | 'tenant' | 'amount' | 'status';
type SortDir = 'asc' | 'desc';

export function FinesPage() {
  const fines = useFinesStore((s) => s.fines);
  const markPaid = useFinesStore((s) => s.markPaid);
  const softDelete = useFinesStore((s) => s.softDelete);
  const tenants = useTenantsStore((s) => s.tenants);
  const infractions = useInfractionsStore((s) => s.infractions);

  const [blockFilter, setBlockFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [infractionFilter, setInfractionFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const tenantMap = useMemo(() => {
    const map = new Map<string, { blockId: string; unitNo: number; fullName: string }>();
    for (const t of tenants) {
      map.set(t.id, { blockId: t.blockId, unitNo: t.unitNo, fullName: t.fullName });
    }
    return map;
  }, [tenants]);

  const infractionMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of infractions) {
      map.set(i.id, i.name);
    }
    return map;
  }, [infractions]);

  function getTenantLabel(tenantId: string): string {
    const t = tenantMap.get(tenantId);
    if (!t) return 'Bilinmiyor';
    return `${t.blockId}-${t.unitNo} ${t.fullName}`;
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'date' ? 'desc' : 'asc');
    }
  }

  const filteredFines = useMemo(() => {
    const q = search.toLowerCase();
    return fines
      .filter((f) => {
        if (f.isDeleted) return false;

        // Block filter
        if (blockFilter !== 'all') {
          const t = tenantMap.get(f.tenantId);
          if (!t || t.blockId !== blockFilter) return false;
        }

        // Status filter
        if (statusFilter === 'paid' && !f.isPaid) return false;
        if (statusFilter === 'unpaid' && (f.isPaid || f.amount === 0)) return false;

        // Infraction filter
        if (infractionFilter !== 'all' && f.infractionTypeId !== infractionFilter) return false;

        // Text search
        if (q) {
          const tenantLabel = getTenantLabel(f.tenantId).toLowerCase();
          const infractionName = (infractionMap.get(f.infractionTypeId) ?? '').toLowerCase();
          if (!tenantLabel.includes(q) && !infractionName.includes(q) && !(f.notes ?? '').toLowerCase().includes(q)) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        switch (sortField) {
          case 'date':
            return dir * a.date.localeCompare(b.date);
          case 'tenant':
            return dir * getTenantLabel(a.tenantId).localeCompare(getTenantLabel(b.tenantId), 'tr');
          case 'amount':
            return dir * (a.amount - b.amount);
          case 'status': {
            const aVal = a.isPaid || a.amount === 0 ? 1 : 0;
            const bVal = b.isPaid || b.amount === 0 ? 1 : 0;
            return dir * (aVal - bVal);
          }
          default:
            return 0;
        }
      });
  }, [fines, blockFilter, statusFilter, infractionFilter, search, sortField, sortDir, tenantMap, infractionMap]);

  const totalUnpaid = useMemo(
    () => filteredFines.filter((f) => !f.isPaid && f.amount > 0).reduce((sum, f) => sum + f.amount, 0),
    [filteredFines]
  );

  function handleMarkPaid(fineId: string) {
    markPaid(fineId);
    toast.success('Ceza ödendi olarak işaretlendi');
  }

  function handleDelete() {
    if (!deleteConfirmId) return;
    softDelete(deleteConfirmId);
    setDeleteConfirmId(null);
    toast.success('Ceza silindi');
  }

  // Unique infraction types that appear in active fines
  const usedInfractionTypes = useMemo(() => {
    const ids = new Set(fines.filter((f) => !f.isDeleted).map((f) => f.infractionTypeId));
    return infractions.filter((i) => ids.has(i.id));
  }, [fines, infractions]);

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-foreground' : 'text-muted-foreground/50'}`} />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Cezalar</h2>
        <div className="text-sm text-muted-foreground">
          {filteredFines.length} ceza &middot; Toplam borç: <span className="font-semibold text-destructive">{formatCurrency(totalUnpaid)}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Sakin veya ceza türü ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
        <Select value={blockFilter} onValueChange={setBlockFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Blok" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Bloklar</SelectItem>
            {BLOCKS.map((b) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tümü</SelectItem>
            <SelectItem value="unpaid">Ödenmedi</SelectItem>
            <SelectItem value="paid">Ödendi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={infractionFilter} onValueChange={setInfractionFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Ceza Türü" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Türler</SelectItem>
            {usedInfractionTypes.map((i) => (
              <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortButton field="date">Tarih</SortButton></TableHead>
              <TableHead><SortButton field="tenant">Sakin</SortButton></TableHead>
              <TableHead>Ceza Türü</TableHead>
              <TableHead><SortButton field="amount">Tutar</SortButton></TableHead>
              <TableHead>Notlar</TableHead>
              <TableHead><SortButton field="status">Durum</SortButton></TableHead>
              <TableHead className="w-24">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredFines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Kayıtlı ceza yok
                </TableCell>
              </TableRow>
            ) : (
              filteredFines.map((fine) => (
                <TableRow key={fine.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(fine.date)}</TableCell>
                  <TableCell>
                    <Link
                      to={`/tenants/${fine.tenantId}`}
                      className="text-primary hover:underline whitespace-nowrap"
                    >
                      {getTenantLabel(fine.tenantId)}
                    </Link>
                  </TableCell>
                  <TableCell>{infractionMap.get(fine.infractionTypeId) ?? 'Bilinmiyor'}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatFineAmount({ monetary: fine.amount, label: fine.amountLabel })}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">{fine.notes}</TableCell>
                  <TableCell>
                    <Badge variant={fine.isPaid || fine.amount === 0 ? 'default' : 'destructive'}>
                      {fine.isPaid || fine.amount === 0 ? 'Ödendi' : 'Ödenmedi'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {!fine.isPaid && fine.amount > 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Ödendi İşaretle"
                          onClick={() => handleMarkPaid(fine.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Sil"
                        onClick={() => setDeleteConfirmId(fine.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirmId} onOpenChange={(v) => !v && setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ceza Sil</DialogTitle>
            <DialogDescription>
              Bu cezayı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
