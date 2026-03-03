const STORAGE_KEYS = {
  token: 'ceza_auth_token',
  email: 'ceza_auth_email',
  tokenExpiry: 'ceza_auth_token_expiry',
} as const;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface TokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
            error_callback?: (error: { type: string; message?: string }) => void;
          }) => TokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

let tokenClient: TokenClient | null = null;
let onTokenCallback: ((response: TokenResponse) => void) | null = null;
let onErrorCallback: ((error: { type: string; message?: string }) => void) | null = null;

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/drive';

export function waitForGIS(timeoutMs = 10000): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) {
      resolve(true);
      return;
    }
    const interval = 100;
    let elapsed = 0;
    const timer = setInterval(() => {
      elapsed += interval;
      if (window.google?.accounts?.oauth2) {
        clearInterval(timer);
        resolve(true);
      } else if (elapsed >= timeoutMs) {
        clearInterval(timer);
        console.warn('Google Identity Services not loaded (timeout)');
        resolve(false);
      }
    }, interval);
  });
}

export function initGoogleAuth(): boolean {
  if (!window.google?.accounts?.oauth2) {
    console.warn('Google Identity Services not loaded');
    return false;
  }

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId || clientId === 'YOUR_GOOGLE_CLIENT_ID_HERE') {
    console.warn('Google Client ID not configured');
    return false;
  }

  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response: TokenResponse) => {
      onTokenCallback?.(response);
    },
    error_callback: (error) => {
      onErrorCallback?.(error);
    },
  });

  return true;
}

export function requestAccessToken(): Promise<TokenResponse> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized'));
      return;
    }

    onTokenCallback = (response) => {
      resolve(response);
    };
    onErrorCallback = (error) => {
      reject(new Error(error.message || 'Auth failed'));
    };

    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export async function fetchUserEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error('Failed to fetch user info');
  const data = await response.json();
  return data.email;
}

export function revokeToken(accessToken: string): void {
  window.google?.accounts?.oauth2?.revoke(accessToken);
}

export function saveAuthToStorage(token: string, email: string): void {
  localStorage.setItem(STORAGE_KEYS.token, token);
  localStorage.setItem(STORAGE_KEYS.email, email);
}

export function clearAuthFromStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.token);
  localStorage.removeItem(STORAGE_KEYS.email);
  localStorage.removeItem(STORAGE_KEYS.tokenExpiry);
}

export function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.token);
}

export function getStoredEmail(): string | null {
  return localStorage.getItem(STORAGE_KEYS.email);
}

export function saveTokenExpiry(expiresIn: number): void {
  const expiryTime = Date.now() + expiresIn * 1000;
  localStorage.setItem(STORAGE_KEYS.tokenExpiry, String(expiryTime));
}

export function getStoredTokenExpiry(): number | null {
  const expiry = localStorage.getItem(STORAGE_KEYS.tokenExpiry);
  return expiry ? Number(expiry) : null;
}

export function silentRefresh(): Promise<TokenResponse> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google Auth not initialized'));
      return;
    }

    onTokenCallback = (response) => {
      resolve(response);
    };
    onErrorCallback = (error) => {
      reject(new Error(error.message || 'Silent refresh failed'));
    };

    tokenClient.requestAccessToken({ prompt: '' });
  });
}

