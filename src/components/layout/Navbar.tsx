import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { getSpreadsheetIdFromEnv } from '@/services/googleSheets';

interface NavbarProps {
  onMenuToggle: () => void;
}

export function Navbar({ onMenuToggle }: NavbarProps) {
  const isSignedIn = useAuthStore((s) => s.isSignedIn);
  const spreadsheetId = getSpreadsheetIdFromEnv();
  const syncStatus = useAuthStore((s) => s.syncStatus);

  function getStatusDot() {
    if (!isSignedIn || !spreadsheetId) {
      return <span className="h-2 w-2 rounded-full bg-gray-400" title="Bağlı Değil" />;
    }
    switch (syncStatus) {
      case 'syncing':
        return <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" title="Senkronize Ediliyor" />;
      case 'error':
        return <span className="h-2 w-2 rounded-full bg-red-500" title="Bağlantı Hatası" />;
      case 'offline':
        return <span className="h-2 w-2 rounded-full bg-yellow-500" title="Çevrimdışı" />;
      default:
        return <span className="h-2 w-2 rounded-full bg-green-500" title="Bağlı" />;
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-card px-4">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <h1 className="text-lg font-semibold">Ceza Takip Sistemi</h1>

      <div className="ml-auto flex items-center gap-2">
        {getStatusDot()}
      </div>
    </header>
  );
}
