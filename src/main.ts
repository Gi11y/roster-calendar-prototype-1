import './style.css';
import { ensureTest, removeExtras } from './test-event';
import { readCalendarId, saveCalendarId } from './idb';
import { calendarApi, loadGoogleScript, scopeGranted, tokenClient, type TokenResponse } from './google';

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

let token: string | undefined;
let tokenDeadline = 0;
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
function clearToken() { token = undefined; tokenDeadline = 0; clearTimeout(expiryTimer); updateButtons(); }
function usableToken() {
 if (token && Date.now() >= tokenDeadline) clearToken();
 return token;
}
window.addEventListener("pagehide", clearToken);
let calendarId: string | undefined;
let prepared = false;
let busy = false;
const say = (message: string) => { status.textContent = message; };
const errorMessage = (e: unknown) => e instanceof Error ? e.message : String(e);
const setBusy = (value: boolean) => { busy = value; updateButtons(); };
function updateButtons() {
 cleanupButton.disabled = busy || !token || !cleanup;
 authButton.disabled = busy || !clientId;
 createButton.disabled = busy || !token || !!calendarId;
 eventButton.disabled = busy || !token || !calendarId;
 authButton.textContent = !prepared ? 'Prepare Google sign-in' : (token ? 'Reconnect Google account' : 'Connect Google account');
}
function showCalendar() {
 calendarText.textContent = calendarId ? `Stored Roster calendar ID: ${calendarId}` :
  'No Roster calendar ID saved on this device. Create only if you have not already created one with this account.';
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
 // No await before requestAccessToken: this is essential for iOS popup testing.
 say('Opening Google popupâ€¦');
 setBusy(true);
 try {
  const client = tokenClient(clientId, (response: TokenResponse) => {
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
   say('PASS: Google token received and required scope granted. Continue to step 2 or 3.');
   updateButtons();
  }, (message) => {
   setBusy(false);
   say(`POPUP FAILURE: ${message}. Test in a normal Safari tab and record the display mode above.`);
  });
  client.requestAccessToken({ prompt: 'select_account' });
 } catch (e) { setBusy(false); say(`ERROR opening popup: ${errorMessage(e)}`); }
});

createButton.addEventListener('click', async () => {
 if (!usableToken() || calendarId || busy) return;
 setBusy(true);
 say('Creating Roster calendarâ€¦');
 try {
  const result = await calendarApi<{ id: string }>('/calendars', token!, 'POST', {
   summary: 'Roster', timeZone: 'Australia/Sydney',
   description: 'Dedicated calendar for roster imports (prototype test)'
  });
  // Save immediately before allowing another operation.
  calendarId = result.id;
  await saveCalendarId(result.id);
  say('PASS: Roster calendar created and ID persisted to IndexedDB.');
  showCalendar();
 } catch (e) {
  showCalendar();
  say(`ERROR creating calendar: ${errorMessage(e)}. If the API succeeded but IndexedDB failed, check Google Calendar before retrying.`);
 }
 finally { setBusy(false); }
});

eventButton.addEventListener('click', async () => {
 if (!usableToken() || !calendarId || busy) return;
 setBusy(true);
 say('Inserting synthetic test eventâ€¦');
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

if (!clientId) say('SETUP REQUIRED: VITE_GOOGLE_CLIENT_ID is missing from the build. See README.');
readCalendarId().then(id => { calendarId = id; showCalendar(); })
 .catch(e => say(`IndexedDB unavailable: ${errorMessage(e)}`));
updateButtons();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
 navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {scope: import.meta.env.BASE_URL})
  .then(() => { swStatus.textContent = 'Service worker: registered'; })
  .catch(e => { swStatus.textContent = `Service worker error: ${errorMessage(e)}`; });
} else swStatus.textContent = 'Service worker: enabled in production build only';
