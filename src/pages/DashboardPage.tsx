import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useTenantsStore } from '@/stores/tenantsStore';
import { useFinesStore } from '@/stores/finesStore';
import { useInfractionsStore } from '@/stores/infractionsStore';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { BLOCKS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, Users, Banknote } from 'lucide-react';

export function DashboardPage() {
  const tenants = useTenantsStore((s) => s.tenants);
  const fines = useFinesStore((s) => s.fines);
  const infractions = useInfractionsStore((s) => s.infractions);

  const activeFines = useMemo(
    () => fines.filter((f) => !f.isDeleted),
    [fines]
  );

  const unpaidFines = useMemo(
    () => activeFines.filter((f) => !f.isPaid),
    [activeFines]
  );

  const totalOwed = useMemo(
    () => unpaidFines.reduce((sum, f) => sum + f.amount, 0),
    [unpaidFines]
  );

  const tenantsWithDebt = useMemo(() => {
    const ids = new Set(unpaidFines.map((f) => f.tenantId));
    return ids.size;
  }, [unpaidFines]);

  const recentFines = useMemo(
    () =>
      [...activeFines]
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 10),
    [activeFines]
  );

  const blockChartData = useMemo(() => {
    const blockTotals = new Map<string, number>();
    for (const f of unpaidFines) {
      const tenant = tenants.find((t) => t.id === f.tenantId);
      if (tenant) {
        const blockId = tenant.blockId;
        blockTotals.set(blockId, (blockTotals.get(blockId) ?? 0) + f.amount);
      }
    }
    return BLOCKS.map((b) => ({
      name: b.name,
      toplam: blockTotals.get(b.id) ?? 0,
    }));
  }, [unpaidFines, tenants]);

  const blockFineCountData = useMemo(() => {
    const blockCounts = new Map<string, number>();
    for (const f of activeFines) {
      const tenant = tenants.find((t) => t.id === f.tenantId);
      if (tenant) {
        blockCounts.set(tenant.blockId, (blockCounts.get(tenant.blockId) ?? 0) + 1);
      }
    }
    return BLOCKS.map((b) => ({
      name: b.name,
      toplam: blockCounts.get(b.id) ?? 0,
    }));
  }, [activeFines, tenants]);

  function getTenantLabel(tenantId: string): string {
    const t = tenants.find((t) => t.id === tenantId);
    if (!t) return 'Bilinmiyor';
    return `${t.blockId}-${t.unitNo} ${t.isVacant ? 'BOŞ DAİRE' : t.fullName}`;
  }

  function getInfractionName(typeId: string): string {
    return infractions.find((i) => i.id === typeId)?.name ?? 'Bilinmiyor';
  }


  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Ana Sayfa</h2>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Aktif Ceza
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{unpaidFines.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Borç
            </CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {formatCurrency(totalOwed)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Borçlu Sakin
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{tenantsWithDebt}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Block fine count chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Blok Bazlı Cezalar</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={blockFineCountData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip
                  formatter={(value: number | undefined) => [value ?? 0, 'Ceza Sayısı']}
                />
                <Bar dataKey="toplam" fill="oklch(0.546 0.245 262.881)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Block debt chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Blok Bazlı Borçlar</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={blockChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v) => `₺${v}`} />
                <Tooltip
                  formatter={(value: number | undefined) => [formatCurrency(value ?? 0), 'Toplam Borç']}
                />
                <Bar dataKey="toplam" fill="oklch(0.577 0.245 27.325)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent fines */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Son Cezalar</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Sakin</TableHead>
                  <TableHead>Tür</TableHead>
                  <TableHead>Durum</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentFines.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Henüz ceza yok
                    </TableCell>
                  </TableRow>
                ) : (
                  recentFines.map((fine) => (
                    <TableRow key={fine.id}>
                      <TableCell className="text-xs">{formatDate(fine.date)}</TableCell>
                      <TableCell className="text-xs">
                        <Link
                          to={`/tenants/${fine.tenantId}`}
                          className="text-primary hover:underline"
                        >
                          {getTenantLabel(fine.tenantId)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">
                        {getInfractionName(fine.infractionTypeId)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={fine.isPaid ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {fine.isPaid ? 'Ödendi' : 'Ödenmedi'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
