import { useMemo, useState } from 'react';
import { useTenantsStore } from '@/stores/tenantsStore';
import { useFinesStore } from '@/stores/finesStore';
import { useInfractionsStore } from '@/stores/infractionsStore';
import { formatCurrency } from '@/utils/formatters';
import { BLOCKS } from '@/types';
import Papa from 'papaparse';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Download, Printer, ArrowUpDown } from 'lucide-react';

export function ReportsPage() {
  const tenants = useTenantsStore((s) => s.tenants);
  const fines = useFinesStore((s) => s.fines);
  const infractions = useInfractionsStore((s) => s.infractions);

  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Sort state per tab
  type SortDir = 'asc' | 'desc';
  const [tenantSort, setTenantSort] = useState<{ key: string; dir: SortDir }>({ key: 'unpaid', dir: 'desc' });
  const [blockSort, setBlockSort] = useState<{ key: string; dir: SortDir }>({ key: 'unpaid', dir: 'desc' });
  const [infractionSort, setInfractionSort] = useState<{ key: string; dir: SortDir }>({ key: 'count', dir: 'desc' });

  function toggleSort(
    current: { key: string; dir: SortDir },
    setter: (v: { key: string; dir: SortDir }) => void,
    key: string,
  ) {
    if (current.key === key) {
      setter({ key, dir: current.dir === 'asc' ? 'desc' : 'asc' });
    } else {
      setter({ key, dir: 'asc' });
    }
  }

  const activeFines = useMemo(() => {
    let result = fines.filter((f) => !f.isDeleted);
    if (dateFrom) result = result.filter((f) => f.date >= dateFrom);
    if (dateTo) result = result.filter((f) => f.date <= dateTo);
    return result;
  }, [fines, dateFrom, dateTo]);

  // Tenant report data
  const tenantReport = useMemo(() => {
    const result = tenants.map((t) => {
      const tFines = activeFines.filter((f) => f.tenantId === t.id);
      const unpaid = tFines.filter((f) => !f.isPaid).reduce((s, f) => s + f.amount, 0);
      const paid = tFines.filter((f) => f.isPaid).reduce((s, f) => s + f.amount, 0);
      return {
        ...t,
        label: `${t.blockId}-${t.unitNo}`,
        name: t.isVacant ? 'BOŞ DAİRE' : t.fullName,
        totalFines: tFines.length,
        unpaid,
        paid,
      };
    }).filter((t) => t.totalFines > 0);

    const { key, dir } = tenantSort;
    result.sort((a, b) => {
      let cmp = 0;
      switch (key) {
        case 'label': cmp = a.label.localeCompare(b.label); break;
        case 'name': cmp = a.name.localeCompare(b.name, 'tr'); break;
        case 'totalFines': cmp = a.totalFines - b.totalFines; break;
        case 'unpaid': cmp = a.unpaid - b.unpaid; break;
        case 'paid': cmp = a.paid - b.paid; break;
      }
      return dir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [tenants, activeFines, tenantSort]);

  // Block report data
  const blockReport = useMemo(() => {
    const result = BLOCKS.map((b) => {
      const blockTenantIds = tenants
        .filter((t) => t.blockId === b.id)
        .map((t) => t.id);
      const blockFines = activeFines.filter((f) => blockTenantIds.includes(f.tenantId));
      const unpaid = blockFines.filter((f) => !f.isPaid).reduce((s, f) => s + f.amount, 0);
      const paid = blockFines.filter((f) => f.isPaid).reduce((s, f) => s + f.amount, 0);
      return {
        block: b.name,
        totalFines: blockFines.length,
        unpaid,
        paid,
      };
    }).filter((b) => b.totalFines > 0);

    const { key, dir } = blockSort;
    result.sort((a, b) => {
      let cmp = 0;
      switch (key) {
        case 'block': cmp = a.block.localeCompare(b.block, 'tr'); break;
        case 'totalFines': cmp = a.totalFines - b.totalFines; break;
        case 'unpaid': cmp = a.unpaid - b.unpaid; break;
        case 'paid': cmp = a.paid - b.paid; break;
      }
      return dir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [tenants, activeFines, blockSort]);

  // Infraction report data
  const infractionReport = useMemo(() => {
    const result = infractions.map((inf) => {
      const infFines = activeFines.filter((f) => f.infractionTypeId === inf.id);
      return {
        name: inf.name,
        category: inf.category ?? '-',
        count: infFines.length,
        totalAmount: infFines.reduce((s, f) => s + f.amount, 0),
      };
    }).filter((i) => i.count > 0);

    const { key, dir } = infractionSort;
    result.sort((a, b) => {
      let cmp = 0;
      switch (key) {
        case 'name': cmp = a.name.localeCompare(b.name, 'tr'); break;
        case 'category': cmp = a.category.localeCompare(b.category, 'tr'); break;
        case 'count': cmp = a.count - b.count; break;
        case 'totalAmount': cmp = a.totalAmount - b.totalAmount; break;
      }
      return dir === 'asc' ? cmp : -cmp;
    });
    return result;
  }, [infractions, activeFines, infractionSort]);

  function exportCSV(data: Record<string, unknown>[], filename: string) {
    const csv = Papa.unparse(data);
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Raporlar</h2>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="mr-2 h-4 w-4" />
          Yazdır
        </Button>
      </div>

      {/* Date filters */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-end">
          <div className="space-y-1">
            <Label htmlFor="dateFrom">Başlangıç</Label>
            <Input
              id="dateFrom"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dateTo">Bitiş</Label>
            <Input
              id="dateTo"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          {(dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setDateFrom(''); setDateTo(''); }}
            >
              Temizle
            </Button>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="tenant">
        <TabsList>
          <TabsTrigger value="tenant">Sakin Raporu</TabsTrigger>
          <TabsTrigger value="block">Blok Raporu</TabsTrigger>
          <TabsTrigger value="infraction">Ceza Türü Raporu</TabsTrigger>
        </TabsList>

        {/* Tenant Report */}
        <TabsContent value="tenant" className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportCSV(
                  tenantReport.map((t) => ({
                    'Daire': t.label,
                    'Ad Soyad': t.name,
                    'Ceza Sayısı': t.totalFines,
                    'Ödenmemiş': t.unpaid,
                    'Ödenen': t.paid,
                  })),
                  'sakin-raporu'
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              CSV İndir
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(tenantSort, setTenantSort, 'label')}>
                      Daire <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(tenantSort, setTenantSort, 'name')}>
                      Ad Soyad <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(tenantSort, setTenantSort, 'totalFines')}>
                      Ceza Sayısı <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(tenantSort, setTenantSort, 'unpaid')}>
                      Ödenmemiş <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(tenantSort, setTenantSort, 'paid')}>
                      Ödenen <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenantReport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Veri yok
                    </TableCell>
                  </TableRow>
                ) : (
                  tenantReport.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.label}</TableCell>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.totalFines}</TableCell>
                      <TableCell className="text-destructive font-medium">
                        {formatCurrency(t.unpaid)}
                      </TableCell>
                      <TableCell className="text-green-600">
                        {formatCurrency(t.paid)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Block Report */}
        <TabsContent value="block" className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportCSV(
                  blockReport.map((b) => ({
                    'Blok': b.block,
                    'Ceza Sayısı': b.totalFines,
                    'Ödenmemiş': b.unpaid,
                    'Ödenen': b.paid,
                  })),
                  'blok-raporu'
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              CSV İndir
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(blockSort, setBlockSort, 'block')}>
                      Blok <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(blockSort, setBlockSort, 'totalFines')}>
                      Ceza Sayısı <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(blockSort, setBlockSort, 'unpaid')}>
                      Ödenmemiş <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(blockSort, setBlockSort, 'paid')}>
                      Ödenen <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {blockReport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Veri yok
                    </TableCell>
                  </TableRow>
                ) : (
                  blockReport.map((b) => (
                    <TableRow key={b.block}>
                      <TableCell className="font-medium">{b.block}</TableCell>
                      <TableCell>{b.totalFines}</TableCell>
                      <TableCell className="text-destructive font-medium">
                        {formatCurrency(b.unpaid)}
                      </TableCell>
                      <TableCell className="text-green-600">
                        {formatCurrency(b.paid)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Infraction Report */}
        <TabsContent value="infraction" className="space-y-3">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                exportCSV(
                  infractionReport.map((i) => ({
                    'Ceza Türü': i.name,
                    'Kategori': i.category,
                    'Sayı': i.count,
                    'Toplam Tutar': i.totalAmount,
                  })),
                  'ceza-turu-raporu'
                )
              }
            >
              <Download className="mr-2 h-4 w-4" />
              CSV İndir
            </Button>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(infractionSort, setInfractionSort, 'name')}>
                      Ceza Türü <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(infractionSort, setInfractionSort, 'category')}>
                      Kategori <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(infractionSort, setInfractionSort, 'count')}>
                      Sayı <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" onClick={() => toggleSort(infractionSort, setInfractionSort, 'totalAmount')}>
                      Toplam Tutar <ArrowUpDown className="ml-1 h-3 w-3" />
                    </Button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {infractionReport.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Veri yok
                    </TableCell>
                  </TableRow>
                ) : (
                  infractionReport.map((i) => (
                    <TableRow key={i.name}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{i.category}</Badge>
                      </TableCell>
                      <TableCell>{i.count}</TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(i.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
