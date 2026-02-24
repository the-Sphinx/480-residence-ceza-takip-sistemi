import { useState, useEffect, useMemo } from 'react';
import { useTenantsStore } from '@/stores/tenantsStore';
import { useInfractionsStore } from '@/stores/infractionsStore';
import { useFinesStore } from '@/stores/finesStore';
import { toISODate, formatFineAmount } from '@/utils/formatters';
import { calculateFineAmount } from '@/utils/fineCalculation';
import type { Fine } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronsUpDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FineFormProps {
  open: boolean;
  onClose: () => void;
  preselectedTenantId?: string;
}

export function FineForm({ open, onClose, preselectedTenantId }: FineFormProps) {
  const tenants = useTenantsStore((s) => s.tenants);
  const allInfractions = useInfractionsStore((s) => s.infractions);
  const activeInfractions = allInfractions.filter((i) => i.isActive);
  const addFine = useFinesStore((s) => s.addFine);
  const allFines = useFinesStore((s) => s.fines);

  const [tenantId, setTenantId] = useState('');
  const [infractionTypeId, setInfractionTypeId] = useState('');
  const [date, setDate] = useState(toISODate());
  const [notes, setNotes] = useState('');
  const [tenantPopoverOpen, setTenantPopoverOpen] = useState(false);
  const [error, setError] = useState('');

  const selectedInfraction = activeInfractions.find((i) => i.id === infractionTypeId);
  const selectedTenant = tenants.find((t) => t.id === tenantId);

  const tierInfo = useMemo(() => {
    if (!tenantId || !selectedInfraction) return null;
    return calculateFineAmount(tenantId, selectedInfraction.id, allFines, selectedInfraction);
  }, [tenantId, selectedInfraction, allFines]);

  useEffect(() => {
    if (open) {
      setTenantId(preselectedTenantId ?? '');
      setInfractionTypeId('');
      setDate(toISODate());
      setNotes('');
      setError('');
    }
  }, [open, preselectedTenantId]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!tenantId) {
      setError('Sakin seçiniz');
      return;
    }
    if (!infractionTypeId || !selectedInfraction || !tierInfo) {
      setError('Ceza türü seçiniz');
      return;
    }

    const fine: Fine = {
      id: crypto.randomUUID(),
      tenantId,
      infractionTypeId,
      date,
      amount: tierInfo.amount.monetary,
      amountLabel: tierInfo.amount.label,
      notes: notes.trim(),
      isPaid: false,
      isDeleted: false,
    };

    addFine(fine);
    toast.success('Ceza eklendi');
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ceza Ekle</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tenant select (searchable combobox) */}
          <div className="space-y-2">
            <Label>Sakin</Label>
            {preselectedTenantId ? (
              <Input
                value={
                  selectedTenant
                    ? `${selectedTenant.blockId}-${selectedTenant.unitNo} ${selectedTenant.fullName}`
                    : ''
                }
                disabled
              />
            ) : (
              <Popover open={tenantPopoverOpen} onOpenChange={setTenantPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between font-normal"
                  >
                    {selectedTenant
                      ? `${selectedTenant.blockId}-${selectedTenant.unitNo} ${selectedTenant.isVacant ? 'BOŞ DAİRE' : selectedTenant.fullName}`
                      : 'Sakin seçiniz...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="İsim veya daire ara..." />
                    <CommandList>
                      <CommandEmpty>Sakin bulunamadı</CommandEmpty>
                      <CommandGroup>
                        {tenants.map((t) => (
                          <CommandItem
                            key={t.id}
                            value={`${t.blockId}-${t.unitNo} ${t.fullName}`}
                            onSelect={() => {
                              setTenantId(t.id);
                              setTenantPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                tenantId === t.id ? 'opacity-100' : 'opacity-0'
                              )}
                            />
                            <span className="font-medium">{t.blockId}-{t.unitNo}</span>
                            <span className="ml-2 text-muted-foreground">
                              {t.isVacant ? 'BOŞ DAİRE' : t.fullName}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Infraction type select */}
          <div className="space-y-2">
            <Label>Ceza Türü</Label>
            <Select value={infractionTypeId} onValueChange={setInfractionTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="Ceza türü seçiniz..." />
              </SelectTrigger>
              <SelectContent>
                {activeInfractions.map((inf) => (
                  <SelectItem key={inf.id} value={inf.id}>
                    {inf.name} — {formatFineAmount(inf.fineAmounts[0])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount (readonly, calculated from tier) */}
          {selectedInfraction && tierInfo && (
            <div className="space-y-2">
              <Label>Tutar</Label>
              <Input
                value={formatFineAmount(tierInfo.amount)}
                disabled
              />
              <p className="text-xs text-muted-foreground">
                ({tierInfo.tierIndex + 1}. tekrar)
              </p>
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="fineDate">Tarih</Label>
            <Input
              id="fineDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notlar (opsiyonel)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ek açıklama..."
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit">Ceza Ekle</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
