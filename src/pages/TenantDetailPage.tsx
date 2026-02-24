import { useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTenantsStore } from '@/stores/tenantsStore';
import { useFinesStore } from '@/stores/finesStore';
import { useInfractionsStore } from '@/stores/infractionsStore';
import { formatCurrency, formatDate, formatFineAmount } from '@/utils/formatters';
import { FineForm } from '@/components/fines/FineForm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ArrowLeft, Plus, Check, CheckCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tenant = useTenantsStore((s) => s.tenants.find((t) => t.id === id));
  const fines = useFinesStore((s) => s.fines);
  const markPaid = useFinesStore((s) => s.markPaid);
  const markAllPaid = useFinesStore((s) => s.markAllPaid);
  const softDelete = useFinesStore((s) => s.softDelete);
  const infractions = useInfractionsStore((s) => s.infractions);

  const [fineFormOpen, setFineFormOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [markAllConfirm, setMarkAllConfirm] = useState(false);

  const tenantFines = useMemo(() => {
    if (!id) return [];
    return fines
      .filter((f) => f.tenantId === id && !f.isDeleted)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [fines, id]);

  const totalOwed = useMemo(
    () => tenantFines.filter((f) => !f.isPaid && f.amount > 0).reduce((sum, f) => sum + f.amount, 0),
    [tenantFines]
  );

  const totalPaid = useMemo(
    () => tenantFines.filter((f) => f.isPaid || f.amount === 0).reduce((sum, f) => sum + f.amount, 0),
    [tenantFines]
  );

  const unpaidCount = useMemo(
    () => tenantFines.filter((f) => !f.isPaid && f.amount > 0).length,
    [tenantFines]
  );

  function getInfractionName(typeId: string): string {
    return infractions.find((i) => i.id === typeId)?.name ?? 'Bilinmiyor';
  }

  function handleMarkPaid(fineId: string) {
    markPaid(fineId);
    toast.success('Ceza ödendi olarak işaretlendi');
  }

  function handleMarkAllPaid() {
    if (!id) return;
    markAllPaid(id);
    setMarkAllConfirm(false);
    toast.success('Tüm cezalar ödendi olarak işaretlendi');
  }

  function handleDelete() {
    if (!deleteConfirmId) return;
    softDelete(deleteConfirmId);
    setDeleteConfirmId(null);
    toast.success('Ceza silindi');
  }

  if (!tenant) {
    return (
      <div className="space-y-4">
        <Link to="/tenants" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Sakinlere Dön
        </Link>
        <p className="text-muted-foreground">Sakin bulunamadı</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/tenants" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h2 className="text-2xl font-bold">
            {tenant.isVacant ? 'BOŞ DAİRE' : tenant.fullName}
          </h2>
          <p className="text-muted-foreground">
            {tenant.blockId} Blok, Daire {tenant.unitNo}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Borç
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {formatCurrency(totalOwed)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Ödenen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalPaid)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ödenmemiş Ceza
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{unpaidCount}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setFineFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Ceza Ekle
        </Button>
        {unpaidCount > 0 && (
          <Button variant="outline" onClick={() => setMarkAllConfirm(true)}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Tümünü Ödendi İşaretle
          </Button>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tarih</TableHead>
              <TableHead>Ceza Türü</TableHead>
              <TableHead>Tutar</TableHead>
              <TableHead>Notlar</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="w-32">İşlemler</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenantFines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Kayıtlı ceza yok
                </TableCell>
              </TableRow>
            ) : (
              tenantFines.map((fine) => (
                <TableRow key={fine.id}>
                  <TableCell>{formatDate(fine.date)}</TableCell>
                  <TableCell>{getInfractionName(fine.infractionTypeId)}</TableCell>
                  <TableCell>{formatFineAmount({ monetary: fine.amount, label: fine.amountLabel })}</TableCell>
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

      <FineForm
        open={fineFormOpen}
        onClose={() => setFineFormOpen(false)}
        preselectedTenantId={tenant.id}
      />

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

      {/* Mark all paid confirmation */}
      <Dialog open={markAllConfirm} onOpenChange={setMarkAllConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tümünü Ödendi İşaretle</DialogTitle>
            <DialogDescription>
              Bu sakine ait {unpaidCount} ödenmemiş cezanın tümünü ödendi olarak
              işaretlemek istediğinizden emin misiniz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkAllConfirm(false)}>
              İptal
            </Button>
            <Button onClick={handleMarkAllPaid}>Evet, Tümünü İşaretle</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
