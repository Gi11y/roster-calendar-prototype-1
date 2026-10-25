import './style.css';
import { verifyRosterCalendar, connectionLabel, mayCreateCalendar } from './calendar-selection';
import { ensureTest, removeExtras } from './test-event';
import { readCalendarId, saveCalendarId } from './idb';
import { calendarApi as rawCalendarApi, loadGoogleScript, scopeGranted, tokenClient, type TokenResponse } from './google';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const authButton = document.querySelector<HTMLButtonElement>('#auth')!;
const createButton = document.querySelector<HTMLButtonElement>('#create')!;
const eventButton = document.querySelector<HTMLButtonElement>('#event')!;
const cleanupButton = document.querySelector<HTMLButtonElement>('#cleanup')!;
let cleanup: {keepId: string; ids: string[]} | undefined;
const status = document.querySelector<HTMLElement>('#status')!;
const calendarText = document.querySelector<HTMLElement>('#calendar')!;
const eventLink = document.querySelector<HTMLElement>('#eventlink')!;
const mode = document.querySelector<HTMLElement>('#mode')!;
const swStatus = document.querySelector<HTMLElement>('#sw')!;

const connection = document.querySelector<HTMLElement>('#connection')!;
const destination = document.querySelector<HTMLElement>('#destination')!;
const existingInput = document.querySelector<HTMLInputElement>('#existing-calendar')!;
const useButton = document.querySelector<HTMLButtonElement>('#use-calendar')!;
const copyButton = document.querySelector<HTMLButtonElement>('#copy-calendar')!;
const confirmNew = document.querySelector<HTMLInputElement>('#confirm-new')!;
let storageReady = false;
let calendarVerified = false;
let token: string | undefined;
let tokenDeadline = 0;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
function clearToken() { calendarVerified = false; cleanup = undefined; cleanupButton.hidden = true; token = undefined; tokenDeadline = 0; clearTimeout(expiryTimer); updateButtons(); }
function usableToken() {
 if (token && Date.now() >= tokenDeadline) clearToken();
 return token;
}
window.addEventListener("pagehide", clearToken);
window.addEventListener("pageshow", () => { usableToken(); updateButtons(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) { usableToken(); updateButtons(); } });
let calendarId: string | undefined;
let prepared = false;
let busy = false;
const say = (message: string) => { status.textContent = message; };
const errorMessage = (e: unknown) => e instanceof Error ? e.message : String(e);
const setBusy = (value: boolean) => { busy = value; updateButtons(); };
async function calendarApi<T>(path: string, accessToken: string, method = 'GET', body?: unknown, ifMatch?: string): Promise<T> {
 try { return await rawCalendarApi<T>(path, accessToken, method, body, ifMatch); }
 catch (error) {
  if (typeof error === 'object' && error !== null && 'status' in error && error.status === 401) clearToken();
  throw error;
 }
}
function updateButtons() {
 const connected = !!token && Date.now() < tokenDeadline;
 connection.textContent = connectionLabel(connected, tokenDeadline);
 connection.dataset.connected = String(connected);
 destination.textContent = calendarId ? (calendarVerified ? 'Using your verified Roster calendar.' : 'Saved calendar needs verification after sign-in.') : 'No calendar selected. Use an existing calendar, or open first-time setup below.';
 useButton.disabled = busy || !connected || !storageReady || !existingInput.value.trim();
 existingInput.disabled = busy;
 copyButton.disabled = busy || !calendarId;
 confirmNew.disabled = busy || !!calendarId;
 cleanupButton.disabled = busy || !token || !cleanup;
 authButton.disabled = busy || !clientId;
 createButton.disabled = !mayCreateCalendar(connected, busy, storageReady, calendarId, confirmNew.checked);
 eventButton.disabled = busy || !connected || !calendarId || !calendarVerified;
 authButton.textContent = !prepared ? 'Prepare Google sign-in' : (token ? 'Reconnect Google account' : 'Connect Google account');
}
function showCalendar() {
 calendarText.textContent = calendarId ? `Stored Roster calendar ID: ${calendarId}` :
  'No Roster calendar ID saved here. Copy the ID from your working app rather than creating another calendar.';
 updateButtons();
}
mode.textContent = `Display mode: ${window.matchMedia('(display-mode: standalone)').matches ||
 (navigator as Navigator & { standalone?: boolean }).standalone ? 'Home-screen standalone' : 'Browser tab'}`;

// The Google sign-in library is first downloaded from a deliberate user tap.
// The popup MUST open from a separate user tap to preserve browser user activation.
authButton.addEventListener('click', async () => {
 if (busy) return;
 if (!prepared) {
  setBusy(true);
  try { await loadGoogleScript(); prepared = true; say('Google sign-in ready. Tap Connect Google account to open the popup.'); }
  catch (e) { say(`ERROR preparing sign-in: ${errorMessage(e)}`); }
  finally { setBusy(false); }
  return;
 }
 if (!clientId) return;
 clearToken();
 // No await before requestAccessToken: this is essential for iOS popup testing.
 say('Opening Google popup…');
 setBusy(true);
 try {
  const client = tokenClient(clientId, async (response: TokenResponse) => {
   setBusy(false);
   if (response.error || !response.access_token || !scopeGranted(response)) {
    token = undefined;
    say(`ERROR: permission not granted (${response.error || response.error_description || 'missing scope'}).`);
    updateButtons();
    return;
   }
   token = response.access_token; // Memory only.
   const lifetime = Math.max(0, (Number(response.expires_in) || 3600) * 1000 - 60000);
   tokenDeadline = Date.now() + lifetime;
   expiryTimer = setTimeout(() => { clearToken(); say('Token expired. Tap Connect Google account again.'); }, lifetime);
   say('Google connected. Choose an existing Roster calendar below.');
   updateButtons();
   if (calendarId) {
    setBusy(true);
    try {
     await verifyRosterCalendar(calendarApi, calendarId, token);
     calendarVerified = !!usableToken();
     say(calendarVerified ? 'Google connected. Saved Roster calendar verified and ready.' : 'Please reconnect Google.');
    } catch (e) { say(`Google sign-in completed, but the saved calendar could not be verified: ${errorMessage(e)}. Connect the account used to create it, or enter the correct existing calendar ID.`); }
    finally { setBusy(false); }
   }
  }, (message) => {
   setBusy(false);
   say(`POPUP FAILURE: ${message}. Test in a normal Safari tab and record the display mode above.`);
  });
  client.requestAccessToken({ prompt: 'select_account' });
 } catch (e) { setBusy(false); say(`ERROR opening popup: ${errorMessage(e)}`); }
});

createButton.addEventListener('click', async () => {
 if (!mayCreateCalendar(!!usableToken(), busy, storageReady, calendarId, confirmNew.checked)) return;
 setBusy(true);
 say('Creating Roster calendar…');
 try {
  const result = await calendarApi<{ id: string }>('/calendars', token!, 'POST', {
   summary: 'Roster', timeZone: 'Australia/Sydney',
   description: 'Dedicated calendar for roster imports (prototype test)'
  });
  // Save immediately before allowing another operation.
  calendarId = result.id;
  await saveCalendarId(result.id);
  calendarVerified = !!usableToken();
  confirmNew.checked = false;
  say('PASS: Roster calendar created and ID persisted to IndexedDB.');
  showCalendar();
 } catch (e) {
  showCalendar();
  say(`ERROR creating calendar: ${errorMessage(e)}. If the API succeeded but IndexedDB failed, check Google Calendar before retrying.`);
 }
 finally { setBusy(false); }
});

eventButton.addEventListener('click', async () => {
 if (!usableToken() || !calendarId || !calendarVerified || busy) return;
 setBusy(true);
 say('Checking for the synthetic test event...');
 try {
  cleanup = undefined; cleanupButton.hidden = true;
  const outcome = await ensureTest(calendarApi, calendarId, token!);
  const result = outcome.event;
  say(outcome.created ? 'PASS: One test event created.' : `PASS: Test event already exists; no new copy created.${outcome.duplicates.length ? ` Found ${outcome.duplicates.length} extra identical test event(s). Use the cleanup button below to remove those copies and keep one.` : ''}`);
  if (outcome.duplicates.length) {
   cleanup = {keepId: result.id, ids: outcome.duplicates.map(e => e.id)};
   cleanupButton.textContent = `Remove ${cleanup.ids.length} extra identical test event(s), keep one`;
   cleanupButton.hidden = false;
  }
  eventLink.replaceChildren();
  if (result.htmlLink) {
   const link = document.createElement('a');
   link.href = result.htmlLink; link.target = '_blank'; link.rel = 'noopener noreferrer';
   link.textContent = 'Open test event in Google Calendar'; eventLink.append(link);
  }
 } catch (e) { say(`ERROR inserting event: ${errorMessage(e)}`); }
 finally { setBusy(false); }
});

cleanupButton.addEventListener('click', async () => {
 if (!usableToken() || !calendarId || busy || !cleanup) return;
 const approved = cleanup;
 cleanup = undefined;
 setBusy(true);
 try {
  const count = await removeExtras(calendarApi, calendarId, token!, approved.keepId, approved.ids);
  say(`PASS: Removed ${count} extra identical test event(s); kept one.`);
 } catch (e) { say(`Cleanup stopped: ${errorMessage(e)}. Tap Check / add test event again to rescan before retrying.`); }
 finally { cleanupButton.hidden = true; setBusy(false); }
});

confirmNew.addEventListener('change', updateButtons);
existingInput.addEventListener('input', updateButtons);
copyButton.addEventListener('click', async () => {
 if (!calendarId) return;
 try { await navigator.clipboard.writeText(calendarId); say('Calendar ID copied. Paste it into the existing-calendar field in the other app.'); }
 catch { say('Copy was unavailable. Select and copy the calendar ID shown in Diagnostics.'); }
});
useButton.addEventListener('click', async () => {
 if (!usableToken() || busy || !storageReady) return;
 setBusy(true);
 try {
  const result = await verifyRosterCalendar(calendarApi, existingInput.value, token!);
  if (!usableToken()) throw new Error('Google connection expired. Reconnect and verify again.');
  await saveCalendarId(result.id);
  calendarId = result.id;
  calendarVerified = true;
  cleanup = undefined; cleanupButton.hidden = true; eventLink.replaceChildren();
  confirmNew.checked = false;
  say('Existing Roster calendar verified and saved. No new calendar or event was created.');
  showCalendar();
 } catch (e) { say(`Could not select that calendar: ${errorMessage(e)}. Your previous selection has not changed.`); }
 finally { setBusy(false); }
});

if (!clientId) say('SETUP REQUIRED: VITE_GOOGLE_CLIENT_ID is missing from the build. See README.');
readCalendarId().then(id => { calendarId = id; storageReady = true; showCalendar(); })
 .catch(e => say(`IndexedDB unavailable: ${errorMessage(e)}. Calendar selection and creation are disabled to avoid losing its ID.`));
updateButtons();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
 navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {scope: import.meta.env.BASE_URL})
  .then(() => { swStatus.textContent = 'Service worker: registered'; })
  .catch(e => { swStatus.textContent = `Service worker error: ${errorMessage(e)}`; });
} else swStatus.textContent = 'Service worker: enabled in production build only';
