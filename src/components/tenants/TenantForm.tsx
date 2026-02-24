import { useState, useEffect } from 'react';
import { useTenantsStore } from '@/stores/tenantsStore';
import { BLOCKS } from '@/types';
import type { Tenant } from '@/types';
import { isTenantUnique } from '@/utils/validators';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface TenantFormProps {
  open: boolean;
  onClose: () => void;
  tenant?: Tenant;
}

export function TenantForm({ open, onClose, tenant }: TenantFormProps) {
  const tenants = useTenantsStore((s) => s.tenants);
  const addTenant = useTenantsStore((s) => s.addTenant);
  const updateTenant = useTenantsStore((s) => s.updateTenant);

  const [blockId, setBlockId] = useState('A');
  const [unitNo, setUnitNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [isVacant, setIsVacant] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!tenant;

  useEffect(() => {
    if (tenant) {
      setBlockId(tenant.blockId);
      setUnitNo(tenant.unitNo.toString());
      setFullName(tenant.fullName);
      setIsVacant(tenant.isVacant);
    } else {
      setBlockId('A');
      setUnitNo('');
      setFullName('');
      setIsVacant(false);
    }
    setError('');
  }, [tenant, open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const unit = parseInt(unitNo, 10);
    if (!unitNo || isNaN(unit) || unit < 1) {
      setError('Geçerli bir daire numarası girin');
      return;
    }

    if (!isVacant && !fullName.trim()) {
      setError('Ad soyad giriniz veya boş daire olarak işaretleyin');
      return;
    }

    if (!isTenantUnique(tenants, blockId, unit, tenant?.id)) {
      setError(`${blockId} Blok, Daire ${unit} zaten kayıtlı`);
      return;
    }

    if (isEditing && tenant) {
      updateTenant(tenant.id, {
        blockId,
        unitNo: unit,
        fullName: isVacant ? '' : fullName.trim().toUpperCase(),
        isVacant,
      });
      toast.success('Sakin bilgileri güncellendi');
    } else {
      const newTenant: Tenant = {
        id: crypto.randomUUID(),
        blockId,
        unitNo: unit,
        fullName: isVacant ? '' : fullName.trim().toUpperCase(),
        isVacant,
      };
      addTenant(newTenant);
      toast.success('Yeni sakin eklendi');
    }

    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Sakin Düzenle' : 'Yeni Sakin Ekle'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="block">Blok</Label>
              <Select value={blockId} onValueChange={setBlockId}>
                <SelectTrigger id="block">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOCKS.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unitNo">Daire No</Label>
              <Input
                id="unitNo"
                type="number"
                min={1}
                value={unitNo}
                onChange={(e) => setUnitNo(e.target.value)}
                placeholder="1"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fullName">Ad Soyad</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="AD SOYAD"
              disabled={isVacant}
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isVacant"
              checked={isVacant}
              onCheckedChange={(v) => setIsVacant(v === true)}
            />
            <Label htmlFor="isVacant" className="cursor-pointer">
              Boş Daire
            </Label>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit">
              {isEditing ? 'Güncelle' : 'Ekle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
