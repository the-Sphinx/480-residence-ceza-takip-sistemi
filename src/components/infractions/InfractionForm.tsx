import { useState, useEffect } from 'react';
import { useInfractionsStore } from '@/stores/infractionsStore';
import type { InfractionType } from '@/types';
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
import { toast } from 'sonner';
import { parseFineAmountString, fineAmountToString } from '@/utils/formatters';

interface InfractionFormProps {
  open: boolean;
  onClose: () => void;
  infraction?: InfractionType;
}

export function InfractionForm({ open, onClose, infraction }: InfractionFormProps) {
  const addInfraction = useInfractionsStore((s) => s.addInfraction);
  const updateInfraction = useInfractionsStore((s) => s.updateInfraction);
  const allInfractions = useInfractionsStore((s) => s.infractions);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fineAmounts, setFineAmounts] = useState(['', '', '', '', '']);
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');

  const isEditing = !!infraction;

  const tierLabels = ['1. Tekrar', '2. Tekrar', '3. Tekrar', '4. Tekrar', '5.+ Tekrar'];

  useEffect(() => {
    if (infraction) {
      setName(infraction.name);
      setDescription(infraction.description);
      setFineAmounts(infraction.fineAmounts.map(fineAmountToString));
      setCategory(infraction.category ?? '');
    } else {
      setName('');
      setDescription('');
      setFineAmounts(['', '', '', '', '']);
      setCategory('');
    }
    setError('');
  }, [infraction, open]);

  function updateAmount(index: number, value: string) {
    setFineAmounts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Ad alanı zorunludur');
      return;
    }

    if (!fineAmounts[0].trim()) {
      setError('En az 1. tekrar tutarı girilmelidir');
      return;
    }

    // Fill empty tiers with previous tier's string value, then parse
    const filledStrings = [...fineAmounts];
    for (let i = 1; i < 5; i++) {
      if (!filledStrings[i].trim()) {
        filledStrings[i] = filledStrings[i - 1];
      }
    }
    const amounts = filledStrings.map(parseFineAmountString);

    if (isEditing && infraction) {
      updateInfraction(infraction.id, {
        name: name.trim(),
        description: description.trim(),
        fineAmounts: amounts,
        category: category.trim() || undefined,
      });
      toast.success('Ceza türü güncellendi');
    } else {
      const maxFineNo = allInfractions.reduce((max, i) => Math.max(max, i.fineNo ?? 0), 0);
      const newInfraction: InfractionType = {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description.trim(),
        fineAmounts: amounts,
        category: category.trim() || undefined,
        isActive: true,
        fineNo: maxFineNo + 1,
      };
      addInfraction(newInfraction);
      toast.success('Yeni ceza türü eklendi');
    }

    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Ceza Türü Düzenle' : 'Yeni Ceza Türü'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="infName">Ad</Label>
            <Input
              id="infName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gürültü Şikayeti"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="infDesc">Açıklama</Label>
            <Textarea
              id="infDesc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detaylı açıklama..."
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Kademeli Tutarlar</Label>
            <div className="grid grid-cols-5 gap-2">
              {tierLabels.map((label, i) => (
                <div key={i} className="space-y-1">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <Input
                    type="text"
                    value={fineAmounts[i]}
                    onChange={(e) => updateAmount(i, e.target.value)}
                    placeholder={i === 0 ? '500' : ''}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">Örn: "500", "Uyarı", "1000 + dava". Boş kademeler öncekinden otomatik doldurulur.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="infCategory">Kategori (opsiyonel)</Label>
            <Input
              id="infCategory"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Düzen"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button type="submit">{isEditing ? 'Güncelle' : 'Ekle'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
