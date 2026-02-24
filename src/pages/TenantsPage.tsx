import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenantsStore } from '@/stores/tenantsStore';
import { useFinesStore } from '@/stores/finesStore';
import { BLOCKS } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { TenantForm } from '@/components/tenants/TenantForm';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Plus, Search, ArrowUpDown } from 'lucide-react';
import type { Tenant } from '@/types';

type SortKey = 'blockId' | 'unitNo' | 'fullName' | 'totalFines';
type SortDir = 'asc' | 'desc';

export function TenantsPage() {
  const navigate = useNavigate();
  const tenants = useTenantsStore((s) => s.tenants);
  const fines = useFinesStore((s) => s.fines);

  const [search, setSearch] = useState('');
  const [blockFilter, setBlockFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('blockId');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [formOpen, setFormOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | undefined>();

  const tenantFineMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const f of fines) {
      if (!f.isDeleted && !f.isPaid) {
        map.set(f.tenantId, (map.get(f.tenantId) ?? 0) + f.amount);
      }
    }
    return map;
  }, [fines]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = tenants.filter((t) => {
      const matchesBlock = blockFilter === 'all' || t.blockId === blockFilter;
      const matchesSearch =
        !q ||
        t.fullName.toLowerCase().includes(q) ||
        `${t.blockId}-${t.unitNo}`.toLowerCase().includes(q) ||
        t.unitNo.toString().includes(q);
      return matchesBlock && matchesSearch;
    });

    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'blockId':
          cmp = a.blockId.localeCompare(b.blockId) || a.unitNo - b.unitNo;
          break;
        case 'unitNo':
          cmp = a.unitNo - b.unitNo;
          break;
        case 'fullName':
          cmp = a.fullName.localeCompare(b.fullName, 'tr');
          break;
        case 'totalFines':
          cmp = (tenantFineMap.get(a.id) ?? 0) - (tenantFineMap.get(b.id) ?? 0);
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [tenants, search, blockFilter, sortKey, sortDir, tenantFineMap]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  function handleEdit(tenant: Tenant) {
    setEditingTenant(tenant);
    setFormOpen(true);
  }

  function handleFormClose() {
    setFormOpen(false);
    setEditingTenant(undefined);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Sakinler</h2>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Yeni Sakin Ekle
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="İsim veya daire no ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={blockFilter} onValueChange={setBlockFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Blok Filtresi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Bloklar</SelectItem>
            {BLOCKS.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleSort('blockId')}>
                  Blok
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleSort('unitNo')}>
                  Daire No
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleSort('fullName')}>
                  Ad Soyad
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead>Durum</TableHead>
              <TableHead>
                <Button variant="ghost" size="sm" onClick={() => toggleSort('totalFines')}>
                  Toplam Borç
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Sakin bulunamadı
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((tenant) => (
                <TableRow
                  key={tenant.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/tenants/${tenant.id}`)}
                >
                  <TableCell className="font-medium">{tenant.blockId}</TableCell>
                  <TableCell>{tenant.unitNo}</TableCell>
                  <TableCell>
                    {tenant.isVacant ? 'BOŞ DAİRE' : tenant.fullName}
                  </TableCell>
                  <TableCell>
                    <Badge variant={tenant.isVacant ? 'secondary' : 'default'}>
                      {tenant.isVacant ? 'Boş' : 'Dolu'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {formatCurrency(tenantFineMap.get(tenant.id) ?? 0)}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(tenant);
                      }}
                    >
                      Düzenle
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TenantForm
        open={formOpen}
        onClose={handleFormClose}
        tenant={editingTenant}
      />
    </div>
  );
}
