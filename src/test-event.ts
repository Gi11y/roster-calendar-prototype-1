// SHA-256("2026-11-03|prototype1-test|0"). Times are excluded from identity.
export const TEST_EVENT_ID = '7a9b4652623ec7c142df5862c93ed0bbfd1b08fe04c8f96bc8551aa3ff859165';
export const TEST_EVENT = {
 summary: 'Roster Prototype 1 Test', description: 'Synthetic test only. Not a real shift.',
 start: { dateTime: '2026-11-03T12:00:00', timeZone: 'Australia/Sydney' },
 end: { dateTime: '2026-11-03T12:30:00', timeZone: 'Australia/Sydney' },
 reminders: { useDefault: false }
};
export interface CalendarEvent {
 id: string; etag?: string; location?: string; attendees?: unknown[]; attachments?: unknown[]; conferenceData?: unknown; htmlLink?: string; status?: string; summary?: string; description?: string;
 start?: { dateTime?: string }; end?: { dateTime?: string };
 reminders?: { useDefault?: boolean; overrides?: unknown[] }; recurringEventId?: string; recurrence?: string[];
}
export type Api = <T>(path: string, token: string, method?: string, body?: unknown, ifMatch?: string) => Promise<T>;
const statusIs = (e: unknown, status: number) => typeof e === 'object' && e !== null && 'status' in e && e.status === status;
export function identicalTest(event: CalendarEvent): boolean {
 return event.status !== 'cancelled' && !event.location && !event.attendees?.length && !event.attachments?.length && !event.conferenceData && !event.recurringEventId && !event.recurrence &&
 event.summary === TEST_EVENT.summary && event.description === TEST_EVENT.description &&
 Date.parse(event.start?.dateTime || '') === Date.parse('2026-11-03T01:00:00Z') &&
 Date.parse(event.end?.dateTime || '') === Date.parse('2026-11-03T01:30:00Z') &&
 event.reminders?.useDefault === false && !event.reminders.overrides?.length;
}
export async function findTests(api: Api, calendarId: string, token: string): Promise<CalendarEvent[]> {
 const matches: CalendarEvent[] = [];
 let page: string | undefined;
 do {
  const query = new URLSearchParams({ timeMin: '2026-11-03T01:00:00Z', timeMax: '2026-11-03T01:30:00Z', singleEvents: 'true', showDeleted: 'false', maxResults: '2500' });
  if (page) query.set('pageToken', page);
  const result = await api<{ items?: CalendarEvent[]; nextPageToken?: string }>(`/calendars/${encodeURIComponent(calendarId)}/events?${query}`, token);
  matches.push(...(result.items || []).filter(identicalTest));
  page = result.nextPageToken;
 } while (page);
 return matches;
}
export async function ensureTest(api: Api, calendarId: string, token: string) {
 const path = `/calendars/${encodeURIComponent(calendarId)}/events`;
 const existing = await findTests(api, calendarId, token);
 // Reuse old auto-ID events too, so upgrading never creates a third copy.
 if (existing.length) {
  const keep = existing.find(e => e.id === TEST_EVENT_ID) || existing.slice().sort((a,b) => a.id.localeCompare(b.id))[0];
  return { event: keep, created: false, duplicates: existing.filter(e => e.id !== keep.id) };
 }
 try {
  const event = await api<CalendarEvent>(path, token, 'POST', { id: TEST_EVENT_ID, ...TEST_EVENT });
  return { event, created: true, duplicates: [] as CalendarEvent[] };
 } catch (error) {
  if (!statusIs(error, 409)) throw error;
  const event = await api<CalendarEvent>(`${path}/${TEST_EVENT_ID}`, token);
  if (!identicalTest(event)) throw new Error('The stable test ID is deleted or changed. No new event was created. Deleted-ID recovery remains a separate test.');
  return { event, created: false, duplicates: [] as CalendarEvent[] };
 }
}
export async function removeExtras(api: Api, calendarId: string, token: string, keepId: string, approvedIds: string[]) {
 const current = await findTests(api, calendarId, token);
 if (!current.some(e => e.id === keepId)) throw new Error('The event to keep has changed or disappeared. Check again before cleanup.');
 const extras = current.filter(e => e.id !== keepId);
 if (extras.length !== approvedIds.length || extras.some(e => !approvedIds.includes(e.id))) throw new Error('The duplicate list changed. Check again before cleanup.');
 if (extras.some(event => !event.etag)) throw new Error('Google did not return an event version. Check again before cleanup.');
 for (const event of extras) await api(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(event.id)}`, token, 'DELETE', undefined, event.etag);
 return extras.length;
}
