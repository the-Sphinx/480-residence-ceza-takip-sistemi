import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { Cloud } from 'lucide-react';

export function LoginPage() {
  const { signIn, isGisLoaded } = useAuthStore();

  async function handleSignIn() {
    try {
      await signIn();
    } catch {
      // Error already handled in authStore
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
            <img src="/logo.jpg" alt="480 Residence Ceza Takip Sistemi" className="w-[300px] h-[300px]" />
          </div>
          <CardTitle className="text-3xl font-bold">480 Residence Ceza Takip Sistemi</CardTitle>
          <CardDescription>
            Site yönetimi ceza takip sistemi. Devam etmek için Google hesabınızla giriş yapın.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Button onClick={handleSignIn} disabled={!isGisLoaded} size="lg">
            <Cloud className="mr-2 h-5 w-5" />
            {isGisLoaded ? 'Google ile Giriş Yap' : 'Google Servisi Yükleniyor...'}
          </Button>
          {!isGisLoaded && (
            <p className="text-xs text-muted-foreground text-center">
              Google Identity Services yüklenemedi. İnternet bağlantınızı kontrol edin.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
