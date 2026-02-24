import { useState } from 'react';
import { useInfractionsStore } from '@/stores/infractionsStore';
import { formatFineAmount } from '@/utils/formatters';
import { InfractionForm } from '@/components/infractions/InfractionForm';
import type { InfractionType } from '@/types';
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
import { Plus, Search } from 'lucide-react';

export function InfractionsPage() {
  const infractions = useInfractionsStore((s) => s.infractions);
  const toggleActive = useInfractionsStore((s) => s.toggleActive);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingInfraction, setEditingInfraction] = useState<InfractionType | undefined>();

  const categories = [...new Set(infractions.map((i) => i.category).filter(Boolean))] as string[];

  const filtered = infractions.filter((inf) => {
    const matchesSearch = !search || inf.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || inf.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  function handleEdit(infraction: InfractionType) {
    setEditingInfraction(infraction);
    setFormOpen(true);
  }

  function handleFormClose() {
    setFormOpen(false);
    setEditingInfraction(undefined);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Ceza Türleri</h2>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Yeni Ceza Türü
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Ceza türü ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {categories.length > 0 && (
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Kategoriler</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead>Kategori</TableHead>
              <TableHead className="max-w-xs">Tutar</TableHead>
              <TableHead>Durum</TableHead>
              <TableHead className="w-40" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Ceza türü bulunamadı
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((inf) => (
                <TableRow key={inf.id} className={!inf.isActive ? 'opacity-50' : ''}>
                  <TableCell className="font-medium">{inf.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-muted-foreground">
                    {inf.description}
                  </TableCell>
                  <TableCell>
                    {inf.category && <Badge variant="secondary">{inf.category}</Badge>}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    <span>
                      {[...new Map(inf.fineAmounts.map(fa => [formatFineAmount(fa), fa])).keys()].join('; ')}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={inf.isActive ? 'default' : 'secondary'}>
                      {inf.isActive ? 'Aktif' : 'Pasif'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(inf)}
                      >
                        Düzenle
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(inf.id)}
                      >
                        {inf.isActive ? 'Deaktif Et' : 'Aktif Et'}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <InfractionForm
        open={formOpen}
        onClose={handleFormClose}
        infraction={editingInfraction}
      />
    </div>
  );
}
