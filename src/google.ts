export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.app.created';
export interface TokenResponse {
 access_token?: string;
 scope?: string;
 expires_in?: number;
 error?: string;
 error_description?: string;
}
interface TokenClient { requestAccessToken(config?: { prompt?: string }): void; }
interface GoogleIdentity {
 accounts: { oauth2: {
  initTokenClient(config: {
   client_id: string; scope: string; include_granted_scopes: boolean;
   callback: (response: TokenResponse) => void;
   error_callback: (error: { type: string; message?: string }) => void;
  }): TokenClient;
  hasGrantedAllScopes(response: TokenResponse, ...scopes: string[]): boolean;
 } };
}
declare global { interface Window { google?: GoogleIdentity; } }
let scriptPromise: Promise<void> | undefined;
export function loadGoogleScript(): Promise<void> {
 if (window.google) return Promise.resolve();
 if (scriptPromise) return scriptPromise!;
 scriptPromise = new Promise<void>((resolve, reject) => {
  const script = document.createElement('script');
  script.src = 'https://accounts.google.com/gsi/client';
  script.async = true;
  script.onload = () => window.google ? resolve() : reject(new Error('Google script loaded without API'));
  script.onerror = () => reject(new Error('Cannot load Google sign-in. Check internet and content blockers.'));
  document.head.append(script);
 }).catch(error => { scriptPromise = undefined; throw error; });
 return scriptPromise!;
}
export function tokenClient(clientId: string, onToken: (response: TokenResponse) => void,
 onPopupError: (error: string) => void): TokenClient {
 const oauth = window.google?.accounts.oauth2;
 if (!oauth) throw new Error('Google sign-in not loaded');
 return oauth.initTokenClient({ client_id: clientId, scope: CALENDAR_SCOPE, include_granted_scopes: false,
  callback: onToken,
  error_callback: error => onPopupError(`${error.type}${error.message ? ': ' + error.message : ''}`)
 });
}
export function scopeGranted(response: TokenResponse): boolean {
 return !!window.google?.accounts.oauth2.hasGrantedAllScopes(response, CALENDAR_SCOPE);
}
export async function calendarApi<T>(path: string, token: string, method = 'GET', body?: unknown): Promise<T> {
 const response = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
  method, cache: 'no-store', credentials: 'omit',
  headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
 });
 const text = await response.text();
 let data: any;
 try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
 if (!response.ok) {
  const detail = data?.error?.message || data?.message || response.statusText;
  throw new Error(`Google Calendar HTTP ${response.status}: ${detail}`);
 }
 return data as T;
}

