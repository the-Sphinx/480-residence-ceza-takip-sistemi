import { create } from 'zustand';
import type { SyncStatus } from '@/types';
import {
  initGoogleAuth,
  requestAccessToken,
  fetchUserEmail,
  revokeToken,
  saveAuthToStorage,
  clearAuthFromStorage,
  getStoredToken,
  getStoredEmail,
  saveTokenExpiry,
  getStoredTokenExpiry,
  silentRefresh,
} from '@/services/googleAuth';
import { toast } from 'sonner';

const AUTO_SYNC_KEY = 'ceza_auto_sync';
const REFRESH_BUFFER_SECONDS = 300; // Refresh 5 minutes before expiry

let refreshTimer: ReturnType<typeof setTimeout> | null = null;

interface AuthStoreState {
  isSignedIn: boolean;
  accessToken: string | null;
  userEmail: string | null;
  syncStatus: SyncStatus;
  lastSyncTime: string | null;
  isGisLoaded: boolean;
  autoSync: boolean;
  tokenExpiry: number | null;

  initAuth: () => void;
  signIn: () => Promise<void>;
  signOut: () => void;
  setSyncStatus: (status: SyncStatus) => void;
  setLastSyncTime: (time: string) => void;
  setAutoSync: (value: boolean) => void;
  validateToken: () => Promise<boolean>;
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = null;
  }
}

export const useAuthStore = create<AuthStoreState>((set, get) => {
  function scheduleTokenRefresh(expiresIn: number) {
    clearRefreshTimer();
    const delayMs = Math.max((expiresIn - REFRESH_BUFFER_SECONDS) * 1000, 0);
    console.log(`[Auth] Token refresh scheduled in ${Math.round(delayMs / 1000 / 60)} minutes`);

    refreshTimer = setTimeout(async () => {
      console.log('[Auth] Attempting silent token refresh...');
      try {
        const response = await silentRefresh();
        const email = get().userEmail;
        saveAuthToStorage(response.access_token, email || '');
        saveTokenExpiry(response.expires_in);

        set({
          accessToken: response.access_token,
          tokenExpiry: Date.now() + response.expires_in * 1000,
        });

        scheduleTokenRefresh(response.expires_in);
        console.log('[Auth] Token refreshed silently');
      } catch (error) {
        console.warn('[Auth] Silent refresh failed, user will need to re-authenticate', error);
        clearAuthFromStorage();
        set({
          isSignedIn: false,
          accessToken: null,
          userEmail: null,
          tokenExpiry: null,
          syncStatus: 'idle',
        });
        toast.error('Oturum süresi doldu, lütfen tekrar giriş yapın');
      }
    }, delayMs);
  }

  async function attemptSilentRefresh(): Promise<boolean> {
    try {
      console.log('[Auth] Attempting silent refresh on load...');
      const response = await silentRefresh();
      const email = await fetchUserEmail(response.access_token);
      saveAuthToStorage(response.access_token, email);
      saveTokenExpiry(response.expires_in);

      set({
        isSignedIn: true,
        accessToken: response.access_token,
        userEmail: email,
        tokenExpiry: Date.now() + response.expires_in * 1000,
      });

      scheduleTokenRefresh(response.expires_in);
      console.log('[Auth] Silent refresh succeeded');
      return true;
    } catch {
      console.warn('[Auth] Silent refresh failed');
      clearAuthFromStorage();
      set({
        isSignedIn: false,
        accessToken: null,
        userEmail: null,
        tokenExpiry: null,
        syncStatus: 'idle',
      });
      return false;
    }
  }

  return {
    isSignedIn: false,
    accessToken: null,
    userEmail: null,
    syncStatus: 'idle',
    lastSyncTime: null,
    isGisLoaded: false,
    autoSync: localStorage.getItem(AUTO_SYNC_KEY) !== 'false',
    tokenExpiry: null,

    initAuth: () => {
      const isGisLoaded = initGoogleAuth();
      const token = getStoredToken();
      const email = getStoredEmail();
      const expiry = getStoredTokenExpiry();

      set({
        isGisLoaded,
        accessToken: token,
        userEmail: email,
        isSignedIn: !!token,
        tokenExpiry: expiry,
      });

      if (token && isGisLoaded) {
        if (expiry && Date.now() < expiry) {
          // Token still valid — schedule refresh for remaining time
          const remainingSeconds = Math.floor((expiry - Date.now()) / 1000);
          console.log(`[Auth] Stored token valid for ${Math.round(remainingSeconds / 60)} more minutes`);
          scheduleTokenRefresh(remainingSeconds);
          // Still validate to confirm it works
          get().validateToken();
        } else {
          // Token expired — try silent refresh
          console.log('[Auth] Stored token expired, attempting silent refresh');
          attemptSilentRefresh();
        }
      } else if (token) {
        // GIS not loaded yet, just validate
        get().validateToken();
      }
    },

    signIn: async () => {
      try {
        const response = await requestAccessToken();
        const email = await fetchUserEmail(response.access_token);
        saveAuthToStorage(response.access_token, email);
        saveTokenExpiry(response.expires_in);

        const expiry = Date.now() + response.expires_in * 1000;
        set({
          isSignedIn: true,
          accessToken: response.access_token,
          userEmail: email,
          tokenExpiry: expiry,
          syncStatus: 'idle',
        });

        scheduleTokenRefresh(response.expires_in);
        toast.success(`Giriş yapıldı: ${email}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Giriş başarısız';
        toast.error(message);
        throw error;
      }
    },

    signOut: () => {
      clearRefreshTimer();
      const token = get().accessToken;
      if (token) {
        revokeToken(token);
      }
      clearAuthFromStorage();

      set({
        isSignedIn: false,
        accessToken: null,
        userEmail: null,
        tokenExpiry: null,
        syncStatus: 'idle',
        lastSyncTime: null,
      });

      toast.success('Çıkış yapıldı');
    },

    setSyncStatus: (status: SyncStatus) => {
      set({ syncStatus: status });
    },

    setLastSyncTime: (time: string) => {
      set({ lastSyncTime: time });
    },

    setAutoSync: (value: boolean) => {
      localStorage.setItem(AUTO_SYNC_KEY, String(value));
      set({ autoSync: value });
    },

    validateToken: async () => {
      const token = get().accessToken;
      if (!token) return false;

      try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          // Token expired or invalid — try silent refresh if GIS is loaded
          if (get().isGisLoaded) {
            console.log('[Auth] Token invalid, attempting silent refresh');
            return await attemptSilentRefresh();
          }
          clearAuthFromStorage();
          set({
            isSignedIn: false,
            accessToken: null,
            userEmail: null,
            tokenExpiry: null,
            syncStatus: 'idle',
          });
          return false;
        }
        return true;
      } catch {
        set({ syncStatus: 'offline' });
        return false;
      }
    },
  };
});
