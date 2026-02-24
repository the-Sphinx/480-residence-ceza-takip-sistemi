import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { storage } from '@/services/localStorage';
import { toast } from 'sonner';
import type { Tenant, InfractionType, Fine } from '@/types';
import { Download, Database, Trash2, Cloud, CloudOff, Loader2, ArrowUpFromLine, RefreshCw, Upload } from 'lucide-react';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { useAuthStore } from '@/stores/authStore';
import { getSpreadsheetIdFromEnv, batchWriteAll, SHEET_NAMES } from '@/services/googleSheets';
import { migrateToSheets, hasLocalData } from '@/services/migration';
import { useTenantsStore } from '@/stores/tenantsStore';
import { useFinesStore } from '@/stores/finesStore';
import { useInfractionsStore } from '@/stores/infractionsStore';
import { formatDate } from '@/utils/formatters';
import { getRepeatPeriod, setRepeatPeriod } from '@/utils/fineCalculation';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BulkImportDialog } from '@/components/import/BulkImportDialog';

export function SettingsPage() {
  const [repeatPeriod, setRepeatPeriodState] = useState(getRepeatPeriod());
  const [clearConfirm, setClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const {
    accessToken,
    userEmail,
    syncStatus,
    lastSyncTime,
    autoSync,
    setAutoSync,
    signOut,
  } = useAuthStore();
  const [isSyncing, setIsSyncing] = useState(false);

  const spreadsheetId = getSpreadsheetIdFromEnv();

  const loadTenants = useTenantsStore((s) => s.loadTenants);
  const loadFines = useFinesStore((s) => s.loadFines);
  const loadInfractions = useInfractionsStore((s) => s.loadInfractions);

  function exportAllData() {
    const tenants = storage.getAll<Tenant>(storage.keys.tenants);
    const infractions = storage.getAll<InfractionType>(storage.keys.infractions);
    const fines = storage.getAll<Fine>(storage.keys.fines);

    const data = { tenants, infractions, fines };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `480-ceza-yedek-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Yedek dosyası indirildi');
  }

  async function clearAllData() {
    setIsClearing(true);
    try {
      // Clear Sheets if signed in
      if (accessToken && spreadsheetId) {
        try {
          await Promise.all([
            batchWriteAll(accessToken, spreadsheetId, SHEET_NAMES.tenants, []),
            batchWriteAll(accessToken, spreadsheetId, SHEET_NAMES.infractions, []),
            batchWriteAll(accessToken, spreadsheetId, SHEET_NAMES.fines, []),
          ]);
        } catch (error) {
          toast.error('Google Sheets verileri silinemedi: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
        }
      }

      localStorage.removeItem(storage.keys.tenants);
      localStorage.removeItem(storage.keys.infractions);
      localStorage.removeItem(storage.keys.fines);
      localStorage.removeItem('ceza_seeded');
      setClearConfirm(false);
      toast.success('Tüm veriler silindi. Sayfayı yenileyiniz.');
    } finally {
      setIsClearing(false);
    }
  }

  async function handleSyncNow() {
    setIsSyncing(true);
    try {
      await Promise.all([loadTenants(), loadFines(), loadInfractions()]);
      toast.success('Veriler Google Sheets\'ten senkronize edildi');
    } catch {
      toast.error('Senkronizasyon başarısız');
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleMigrate() {
    if (!accessToken || !spreadsheetId) return;
    setIsMigrating(true);
    try {
      const success = await migrateToSheets(accessToken, spreadsheetId);
      if (success) {
        await Promise.all([loadTenants(), loadFines(), loadInfractions()]);
      }
    } finally {
      setIsMigrating(false);
    }
  }

  function getSyncBadge() {
    if (!spreadsheetId) return <Badge variant="secondary">Tablo Yapılandırılmamış</Badge>;
    switch (syncStatus) {
      case 'syncing':
        return <Badge variant="default" className="bg-blue-500"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Senkronize Ediliyor</Badge>;
      case 'error':
        return <Badge variant="destructive">Hata</Badge>;
      case 'offline':
        return <Badge variant="secondary">Çevrimdışı</Badge>;
      default:
        return <Badge variant="default" className="bg-green-600">Bağlı</Badge>;
    }
  }

  const tenantCount = storage.getAll(storage.keys.tenants).length;
  const infractionCount = storage.getAll(storage.keys.infractions).length;
  const fineCount = storage.getAll(storage.keys.fines).length;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Ayarlar</h2>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Veri Durumu
          </CardTitle>
          <CardDescription>Yerel depolamadaki veri özeti</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Sakinler</Badge>
            <span>{tenantCount} kayıt</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Ceza Türleri</Badge>
            <span>{infractionCount} kayıt</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Cezalar</Badge>
            <span>{fineCount} kayıt</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {spreadsheetId ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
            Google Sheets Bağlantısı
          </CardTitle>
          <CardDescription>
            {spreadsheetId
              ? 'Veriler Google Sheets ile senkronize ediliyor.'
              : 'Spreadsheet URL yapılandırılmamış. .env dosyasında VITE_GOOGLE_SPREADSHEET_URL ayarlayın.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            {getSyncBadge()}
          </div>

          <div className="space-y-3">
            <div className="text-sm space-y-1">
              <p><span className="text-muted-foreground">Hesap:</span> <strong>{userEmail}</strong></p>
              {spreadsheetId && (
                <p><span className="text-muted-foreground">Tablo ID:</span> <code className="text-xs bg-muted px-1 py-0.5 rounded">{spreadsheetId}</code></p>
              )}
              {lastSyncTime && (
                <p><span className="text-muted-foreground">Son Senkronizasyon:</span> {formatDate(lastSyncTime)}</p>
              )}
            </div>

            {spreadsheetId && (
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoSync"
                  checked={autoSync}
                  onCheckedChange={(checked) => setAutoSync(checked === true)}
                />
                <label htmlFor="autoSync" className="text-sm font-medium leading-none cursor-pointer">
                  Değişiklikleri otomatik senkronize et
                </label>
              </div>
            )}

            {spreadsheetId && (
              <p className="text-xs text-muted-foreground">
                Veriler her giriş yapıldığında Google Sheets'ten yüklenir.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {spreadsheetId && (
                <Button variant="outline" size="sm" onClick={handleSyncNow} disabled={isSyncing}>
                  {isSyncing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Senkronize Ediliyor...</>
                  ) : (
                    <><RefreshCw className="mr-2 h-4 w-4" />Şimdi Senkronize Et</>
                  )}
                </Button>
              )}

              {spreadsheetId && hasLocalData() && (
                <Button variant="outline" size="sm" onClick={handleMigrate} disabled={isMigrating}>
                  {isMigrating ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Aktarılıyor...</>
                  ) : (
                    <><ArrowUpFromLine className="mr-2 h-4 w-4" />Verileri Aktar</>
                  )}
                </Button>
              )}
            </div>

            <div>
              <Button variant="destructive" size="sm" onClick={signOut}>
                <CloudOff className="mr-2 h-4 w-4" />
                Bağlantıyı Kes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kademeli Ceza Ayarları</CardTitle>
          <CardDescription>Tekrarlayan ihlaller için ceza artış süresi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <Label htmlFor="repeatPeriod" className="whitespace-nowrap">Tekrar Süresi (ay)</Label>
            <Input
              id="repeatPeriod"
              type="number"
              min={1}
              max={60}
              value={repeatPeriod}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val > 0) {
                  setRepeatPeriodState(val);
                  setRepeatPeriod(val);
                }
              }}
              className="w-24"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Son {repeatPeriod} ay içindeki aynı türdeki ihlaller sayılarak kademe belirlenir.
            Bu ayar yalnızca yeni cezaları etkiler.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Veri Yönetimi</CardTitle>
          <CardDescription>Yedekleme ve veri temizleme işlemleri</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Toplu İçe Aktar
          </Button>
          <Button variant="outline" onClick={exportAllData}>
            <Download className="mr-2 h-4 w-4" />
            JSON Yedek İndir
          </Button>
          <Button variant="destructive" onClick={() => setClearConfirm(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Tüm Verileri Sil
          </Button>
        </CardContent>
      </Card>

      <BulkImportDialog open={importOpen} onOpenChange={setImportOpen} />

      <Dialog open={clearConfirm} onOpenChange={setClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tüm Verileri Sil</DialogTitle>
            <DialogDescription>
              Bu işlem tüm sakin, ceza türü ve ceza verilerini silecektir.
              Bu işlem geri alınamaz. Devam etmek istiyor musunuz?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearConfirm(false)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={clearAllData} disabled={isClearing}>
              {isClearing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Siliniyor...</> : 'Evet, Tümünü Sil'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
