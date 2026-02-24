import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BLOCKS } from '@/types';
import type { Tenant, InfractionType, FineAmount } from '@/types';
import { useTenantsStore } from '@/stores/tenantsStore';
import { useInfractionsStore } from '@/stores/infractionsStore';
import { parseFineAmountString, formatFineAmount } from '@/utils/formatters';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedTenant {
  blockId: string;
  unitNo: number;
  fullName: string;
  isVacant: boolean;
  error?: string;
  isDuplicate?: boolean;
}

interface ParsedInfraction {
  name: string;
  description: string;
  fineAmounts: FineAmount[];
  category?: string;
  error?: string;
}

const TENANT_HEADERS = ['blok', 'daireno', 'adsoyad', 'boş'];
const INFRACTION_HEADERS = ['ad', 'açıklama', 'tutar1', 'tutar2', 'tutar3', 'tutar4', 'tutar5', 'kategori'];
const VALID_BLOCK_IDS = new Set(BLOCKS.map((b) => b.id));

function isHeaderRow(cols: string[], expectedHeaders: string[]): boolean {
  if (cols.length === 0) return false;
  const first = cols[0].toLowerCase().trim();
  return expectedHeaders.some((h) => first === h || first.includes(h));
}

function parseTenantRows(text: string, existingTenants: Tenant[]): ParsedTenant[] {
  const result = Papa.parse<string[]>(text, { delimiter: '\t', skipEmptyLines: true });
  let rows = result.data;

  if (rows.length > 0 && isHeaderRow(rows[0], TENANT_HEADERS)) {
    rows = rows.slice(1);
  }

  const existingKeySet = new Set(existingTenants.map((t) => `${t.blockId}-${t.unitNo}`));
  const seenKeys = new Set<string>();

  return rows.map((cols) => {
    const blockId = (cols[0] || '').trim().toUpperCase();
    const unitNoRaw = (cols[1] || '').trim();
    const fullName = (cols[2] || '').trim();
    const vacantCol = (cols[3] || '').trim().toLowerCase();

    const unitNo = parseInt(unitNoRaw, 10);
    const isVacant =
      vacantCol === 'true' ||
      vacantCol === 'evet' ||
      fullName.toUpperCase() === 'BOŞ DAİRE' ||
      fullName === '';

    const errors: string[] = [];
    if (!VALID_BLOCK_IDS.has(blockId)) errors.push(`Geçersiz blok: ${blockId}`);
    if (isNaN(unitNo) || unitNo <= 0) errors.push(`Geçersiz daire no: ${unitNoRaw}`);
    if (!fullName && !isVacant) errors.push('Ad soyad boş');

    const key = `${blockId}-${unitNo}`;
    const isDuplicateInPaste = seenKeys.has(key);
    seenKeys.add(key);

    if (isDuplicateInPaste) errors.push(`Yapıştırılan veride tekrar: ${key}`);

    const isDuplicate = existingKeySet.has(key);

    return {
      blockId,
      unitNo,
      fullName: fullName || 'BOŞ DAİRE',
      isVacant,
      error: errors.length > 0 ? errors.join(', ') : undefined,
      isDuplicate,
    };
  });
}

function parseInfractionRows(text: string): ParsedInfraction[] {
  const result = Papa.parse<string[]>(text, { delimiter: '\t', skipEmptyLines: true });
  let rows = result.data;

  if (rows.length > 0 && isHeaderRow(rows[0], INFRACTION_HEADERS)) {
    rows = rows.slice(1);
  }

  return rows.map((cols) => {
    const name = (cols[0] || '').trim();
    const description = (cols[1] || '').trim();
    const category = (cols[2] || '').trim() || undefined;

    // Keep raw strings, fill empty tiers from previous
    const rawTiers = [
      (cols[3] || '').trim(),
      (cols[4] || '').trim(),
      (cols[5] || '').trim(),
      (cols[6] || '').trim(),
      (cols[7] || '').trim(),
    ];
    for (let i = 1; i < 5; i++) {
      if (!rawTiers[i]) rawTiers[i] = rawTiers[i - 1];
    }
    const fineAmounts = rawTiers.map(parseFineAmountString);

    const errors: string[] = [];
    if (!name) errors.push('Ad boş');
    if (!rawTiers[0]) errors.push('Tutar1 boş olamaz');

    return {
      name,
      description,
      fineAmounts,
      category,
      error: errors.length > 0 ? errors.join(', ') : undefined,
    };
  });
}

export function BulkImportDialog({ open, onOpenChange }: BulkImportDialogProps) {
  const [activeTab, setActiveTab] = useState('tenants');
  const [tenantText, setTenantText] = useState('');
  const [infractionText, setInfractionText] = useState('');
  const [parsedTenants, setParsedTenants] = useState<ParsedTenant[]>([]);
  const [parsedInfractions, setParsedInfractions] = useState<ParsedInfraction[]>([]);
  const [showTenantPreview, setShowTenantPreview] = useState(false);
  const [showInfractionPreview, setShowInfractionPreview] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [isImporting, setIsImporting] = useState(false);

  const existingTenants = useTenantsStore((s) => s.tenants);
  const bulkAddTenants = useTenantsStore((s) => s.bulkAddTenants);
  const bulkAddInfractions = useInfractionsStore((s) => s.bulkAddInfractions);

  const handlePreviewTenants = useCallback(() => {
    const parsed = parseTenantRows(tenantText, existingTenants);
    setParsedTenants(parsed);
    setShowTenantPreview(true);
  }, [tenantText, existingTenants]);

  const handlePreviewInfractions = useCallback(() => {
    const parsed = parseInfractionRows(infractionText);
    setParsedInfractions(parsed);
    setShowInfractionPreview(true);
  }, [infractionText]);

  const handleImportTenants = useCallback(async () => {
    const toImport = parsedTenants.filter((t) => {
      if (t.error) return false;
      if (skipDuplicates && t.isDuplicate) return false;
      return true;
    });

    if (toImport.length === 0) {
      toast.error('İçe aktarılacak geçerli kayıt yok');
      return;
    }

    setIsImporting(true);
    try {
      const newTenants: Tenant[] = toImport.map((t) => ({
        id: crypto.randomUUID(),
        blockId: t.blockId,
        unitNo: t.unitNo,
        fullName: t.fullName,
        isVacant: t.isVacant,
      }));

      await bulkAddTenants(newTenants);
      toast.success(`${newTenants.length} sakin başarıyla içe aktarıldı`);
      setTenantText('');
      setParsedTenants([]);
      setShowTenantPreview(false);
      onOpenChange(false);
    } catch {
      toast.error('İçe aktarma sırasında hata oluştu');
    } finally {
      setIsImporting(false);
    }
  }, [parsedTenants, skipDuplicates, bulkAddTenants, onOpenChange]);

  const handleImportInfractions = useCallback(async () => {
    const toImport = parsedInfractions.filter((i) => !i.error);

    if (toImport.length === 0) {
      toast.error('İçe aktarılacak geçerli kayıt yok');
      return;
    }

    setIsImporting(true);
    try {
      const newInfractions: InfractionType[] = toImport.map((i) => ({
        id: crypto.randomUUID(),
        name: i.name,
        description: i.description,
        fineAmounts: i.fineAmounts,
        category: i.category,
        isActive: true,
      }));

      await bulkAddInfractions(newInfractions);
      toast.success(`${newInfractions.length} ceza türü başarıyla içe aktarıldı`);
      setInfractionText('');
      setParsedInfractions([]);
      setShowInfractionPreview(false);
      onOpenChange(false);
    } catch {
      toast.error('İçe aktarma sırasında hata oluştu');
    } finally {
      setIsImporting(false);
    }
  }, [parsedInfractions, bulkAddInfractions, onOpenChange]);

  const tenantValidCount = parsedTenants.filter((t) => !t.error && (!skipDuplicates || !t.isDuplicate)).length;
  const tenantErrorCount = parsedTenants.filter((t) => t.error).length;
  const tenantDuplicateCount = parsedTenants.filter((t) => t.isDuplicate && !t.error).length;

  const infractionValidCount = parsedInfractions.filter((i) => !i.error).length;
  const infractionErrorCount = parsedInfractions.filter((i) => i.error).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Toplu Veri İçe Aktar</DialogTitle>
          <DialogDescription>
            Google Sheets veya Excel'den kopyaladığınız verileri yapıştırarak toplu veri ekleyebilirsiniz.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="tenants">Sakinler</TabsTrigger>
            <TabsTrigger value="infractions">Ceza Türleri</TabsTrigger>
          </TabsList>

          <TabsContent value="tenants" className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium">Beklenen sütunlar (sekme ile ayrılmış):</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block">
                Blok &nbsp; DaireNo &nbsp; AdSoyad &nbsp; [Boş]
              </code>
              <p className="text-xs">
                Blok: A-K | DaireNo: Sayı | AdSoyad: İsim ("BOŞ DAİRE" veya boş = boş daire) | Boş: Opsiyonel ("true"/"evet")
              </p>
            </div>

            <Textarea
              placeholder={'A\t1\tAZİZ DEMİR\nA\t5\tBOŞ DAİRE\ttrue\nB\t3\tFATMA YILMAZ'}
              value={tenantText}
              onChange={(e) => {
                setTenantText(e.target.value);
                setShowTenantPreview(false);
              }}
              rows={6}
              className="font-mono text-sm"
            />

            <div className="flex items-center gap-4">
              <Button onClick={handlePreviewTenants} disabled={!tenantText.trim()}>
                Önizle
              </Button>
              {showTenantPreview && (
                <div className="flex gap-2 text-sm">
                  <Badge variant="default">{tenantValidCount} geçerli</Badge>
                  {tenantErrorCount > 0 && <Badge variant="destructive">{tenantErrorCount} hatalı</Badge>}
                  {tenantDuplicateCount > 0 && <Badge variant="secondary">{tenantDuplicateCount} tekrar</Badge>}
                </div>
              )}
            </div>

            {showTenantPreview && parsedTenants.length > 0 && (
              <>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="skipDuplicates"
                    checked={skipDuplicates}
                    onCheckedChange={(checked) => setSkipDuplicates(checked === true)}
                  />
                  <label htmlFor="skipDuplicates" className="text-sm cursor-pointer">
                    Mevcut sakinlerle aynı blok+daire olanları atla
                  </label>
                </div>

                <div className="border rounded-md overflow-auto max-h-64">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Blok</TableHead>
                        <TableHead className="w-20">Daire</TableHead>
                        <TableHead>Ad Soyad</TableHead>
                        <TableHead className="w-16">Boş</TableHead>
                        <TableHead>Durum</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedTenants.map((t, i) => (
                        <TableRow
                          key={i}
                          className={
                            t.error
                              ? 'bg-red-50 dark:bg-red-950/20'
                              : t.isDuplicate
                                ? 'bg-yellow-50 dark:bg-yellow-950/20'
                                : ''
                          }
                        >
                          <TableCell className="font-mono">{t.blockId}</TableCell>
                          <TableCell>{t.unitNo}</TableCell>
                          <TableCell>{t.fullName}</TableCell>
                          <TableCell>{t.isVacant ? 'Evet' : ''}</TableCell>
                          <TableCell>
                            {t.error ? (
                              <span className="text-xs text-red-600">{t.error}</span>
                            ) : t.isDuplicate ? (
                              <span className="text-xs text-yellow-600">Mevcut kayıt ({t.blockId}-{t.unitNo})</span>
                            ) : (
                              <span className="text-xs text-green-600">Hazır</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}

            {showTenantPreview && (
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  İptal
                </Button>
                <Button onClick={handleImportTenants} disabled={isImporting || tenantValidCount === 0}>
                  {isImporting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />İçe Aktarılıyor...</>
                  ) : (
                    `${tenantValidCount} Sakin İçe Aktar`
                  )}
                </Button>
              </DialogFooter>
            )}
          </TabsContent>

          <TabsContent value="infractions" className="space-y-4">
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium">Beklenen sütunlar (sekme ile ayrılmış):</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block">
                Ad &nbsp; Açıklama &nbsp; Kategori &nbsp; Tutar1 &nbsp; [Tutar2] &nbsp; [Tutar3] &nbsp; [Tutar4] &nbsp; [Tutar5]
              </code>
              <p className="text-xs">
                Tutar1: Zorunlu (örn: "500", "Uyarı", "1000 + dava"). Boş kademeler öncekinden otomatik doldurulur.
              </p>
            </div>

            <Textarea
              placeholder={'Gürültü Şikayeti\tGece saatlerinde aşırı gürültü\tDüzen\t500\t750\t1000\t1500\t2000\nOtopark İhlali\tBaşkasının yerine park etme\tOtopark\t400\t\t\t\t'}
              value={infractionText}
              onChange={(e) => {
                setInfractionText(e.target.value);
                setShowInfractionPreview(false);
              }}
              rows={6}
              className="font-mono text-sm"
            />

            <div className="flex items-center gap-4">
              <Button onClick={handlePreviewInfractions} disabled={!infractionText.trim()}>
                Önizle
              </Button>
              {showInfractionPreview && (
                <div className="flex gap-2 text-sm">
                  <Badge variant="default">{infractionValidCount} geçerli</Badge>
                  {infractionErrorCount > 0 && <Badge variant="destructive">{infractionErrorCount} hatalı</Badge>}
                </div>
              )}
            </div>

            {showInfractionPreview && parsedInfractions.length > 0 && (
              <div className="border rounded-md overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ad</TableHead>
                      <TableHead>Açıklama</TableHead>
                      <TableHead className="w-16 text-right">T1</TableHead>
                      <TableHead className="w-16 text-right">T2</TableHead>
                      <TableHead className="w-16 text-right">T3</TableHead>
                      <TableHead className="w-16 text-right">T4</TableHead>
                      <TableHead className="w-16 text-right">T5</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Durum</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedInfractions.map((inf, i) => (
                      <TableRow
                        key={i}
                        className={inf.error ? 'bg-red-50 dark:bg-red-950/20' : ''}
                      >
                        <TableCell>{inf.name}</TableCell>
                        <TableCell className="max-w-40 truncate">{inf.description}</TableCell>
                        <TableCell className="text-right font-mono">{formatFineAmount(inf.fineAmounts[0])}</TableCell>
                        <TableCell className="text-right font-mono">{formatFineAmount(inf.fineAmounts[1])}</TableCell>
                        <TableCell className="text-right font-mono">{formatFineAmount(inf.fineAmounts[2])}</TableCell>
                        <TableCell className="text-right font-mono">{formatFineAmount(inf.fineAmounts[3])}</TableCell>
                        <TableCell className="text-right font-mono">{formatFineAmount(inf.fineAmounts[4])}</TableCell>
                        <TableCell>{inf.category || '-'}</TableCell>
                        <TableCell>
                          {inf.error ? (
                            <span className="text-xs text-red-600">{inf.error}</span>
                          ) : (
                            <span className="text-xs text-green-600">Hazır</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {showInfractionPreview && (
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  İptal
                </Button>
                <Button onClick={handleImportInfractions} disabled={isImporting || infractionValidCount === 0}>
                  {isImporting ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />İçe Aktarılıyor...</>
                  ) : (
                    `${infractionValidCount} Ceza Türü İçe Aktar`
                  )}
                </Button>
              </DialogFooter>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
