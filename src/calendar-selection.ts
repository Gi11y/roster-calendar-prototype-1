export interface RosterCalendar { id: string; summary: string; timeZone?: string; description?: string; }
export type CalendarReadApi = <T>(path: string, token: string, method?: string, body?: unknown, ifMatch?: string) => Promise<T>;
export function validateCalendarId(value: string): string {
 const id = value.trim();
 if (!/^[a-zA-Z0-9._-]+@group\.calendar\.google\.com$/.test(id)) throw new Error('Paste the secondary calendar ID ending @group.calendar.google.com from your working app. Do not paste a token or a calendar URL.');
 return id;
}
export async function verifyRosterCalendar(api: CalendarReadApi, value: string, token: string): Promise<RosterCalendar> {
 const id = validateCalendarId(value);
 const calendar = await api<RosterCalendar>(`/calendars/${encodeURIComponent(id)}`, token);
 if (calendar.id !== id || (calendar.summary !== 'Roster' && calendar.description !== 'Dedicated calendar for roster imports (prototype test)')) throw new Error('This is not a recognised Roster calendar. Your saved selection has not changed.');
 // Read only. Confirms that the signed-in account and the current app scope can use it.
 await api(`/calendars/${encodeURIComponent(id)}/events?maxResults=1`, token);
 return calendar;
}
export function connectionLabel(tokenPresent: boolean, deadline: number, now = Date.now()): string {
 return tokenPresent && now < deadline ? 'Google connected' : 'Google not connected - sign in to continue';
}
export function mayCreateCalendar(connected: boolean, busy: boolean, storageReady: boolean, savedId: string | undefined, confirmed: boolean): boolean {
 return connected && !busy && storageReady && !savedId && confirmed;
}
