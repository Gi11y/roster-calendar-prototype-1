# Phase 1 (v2) — Roster-to-Google-Calendar Web App

**Status:** Revised architecture — supersedes the original Flutter proposal. No implementation code yet.

**Context for the reader:** The v1 plan proposed a custom Flutter app (Google ML Kit OCR + `google_sign_in` + Google Calendar REST). After review, the architecture has changed to a **static, installable web app (PWA)** with on-device OCR and **browser-based Google sign-in** that writes to a dedicated calendar. The parsing design from v1 is retained almost unchanged. Section 10 records why the alternatives were rejected.

## 1. Goal and audience

Turn screenshots of NSW Health-style rosters into Google Calendar events, with all image processing on the device.

- **Users:** one family member initially, then her co-workers (NSW Health staff), on a mix of iPhone and Android.
- **Distribution:** a web link. Users open it and tap "Add to Home Screen". No app store, no sideloading.
- **Cost constraint:** must be free to run and distribute. No Apple Developer Program fee, no backend hosting.
- **Interaction goal:** after reviewing shifts, the user taps **one button** and all shifts appear in Google Calendar.

## 2. Data flow

```text
ON DEVICE — works offline after first visit
Screenshot selection (file input)
       ↓
Tesseract.js OCR in a Web Worker (self-hosted model files)
       ↓
Layout-aware shift and date parsing (pure TypeScript)
       ↓
Interactive review and editing
       ↓
Explicit user approval ("Add all to Google Calendar")
       ↓
INTERNET REQUIRED ONLY FROM HERE
Google Identity Services popup → short-lived access token
       ↓
Browser calls Google Calendar API directly (no app server)
       ↓
Events written to the user's dedicated "Roster" calendar
```

## 3. Privacy requirements

- Screenshots, OCR text and parsing never leave the device. There is **no backend**; the site is static files only.
- OCR model files (Tesseract core WASM, worker, `eng.traineddata`) are **self-hosted and cached by the service worker**. Tesseract.js fetches language data from a CDN by default; this must be overridden.
- No analytics, no error-reporting SDK, no third-party fonts or scripts except Google Identity Services, which is loaded only when the user taps the sync button.
- A Content-Security-Policy restricts `connect-src` to the site's own origin and the Google OAuth and Calendar endpoints.
- Only approved event fields (title, start, end, description, reminder) are sent to Google.
- Images and OCR intermediates are held in memory only and discarded after import.
- No calendar write happens before explicit confirmation, and deletions or changes are shown before they are applied.
- The front page states plainly: unofficial tool, not endorsed by NSW Health; screenshots never leave the phone; sign in with a **personal Google account** (NSW Health work accounts are Microsoft, not Google).

## 4. Technology stack

| Concern | Choice | Notes |
|---|---|---|
| Language / build | TypeScript + Vite | Small, static output |
| UI | Lightweight (vanilla TS, Preact or Svelte) | Keep bundle small; no heavy framework required |
| Offline / install | Service worker + web app manifest (e.g. `vite-plugin-pwa`) | Precache app shell and OCR assets |
| OCR | Tesseract.js in a Web Worker | Returns words, lines and **bounding boxes**, so the v1 layout parsing still works |
| Image pre-processing | Canvas: greyscale, upscale ~2×, optional threshold | Screenshots are clean digital text, which suits Tesseract |
| Date / timezone | Luxon (IANA zones) | Correct AEST/AEDT handling; never hardcode offsets |
| Local storage | IndexedDB (via `idb`) | Settings, shift defaults, calendar ID, import ledger |
| Google auth | Google Identity Services **token client** (`google.accounts.oauth2.initTokenClient`) | Popup flow, ~1-hour access token, **no refresh token stored** |
| Calendar API | Direct `fetch` to `https://www.googleapis.com/calendar/v3` | No `googleapis` client library needed |
| Hosting | GitHub Pages or Cloudflare Pages (HTTPS) | Free; site origin becomes the OAuth authorised JavaScript origin |
| Fallback export | `.ics` file generation | For users who don't want Google sign-in |

## 5. Google sign-in design

### Why the browser token model

- No long-lived credentials are kept, so the 7-day refresh-token expiry that applies to OAuth apps in **Testing** status is irrelevant. The user signs in at the moment of sync (roughly fortnightly), the token is used and discarded.
- After the first consent, later sign-ins are typically just an account pick.

### Scope

Request **`https://www.googleapis.com/auth/calendar.app.created`** only: lets the app create secondary calendars and fully manage events in those calendars, with no access to the user's other calendars.

- Easier for co-workers to trust and approve.
- Makes automatic update/delete safe, because the app can only touch its own calendar.
- Calendar scopes are in Google's **sensitive** tier (not restricted): production verification needs paperwork, not a paid security assessment.

**To verify during prototyping:** whether `calendar.app.created` alone can find a previously created calendar if the locally stored calendar ID is lost. If not, consider adding `calendar.calendarlist.readonly` (see §11).

### Google Cloud configuration (one-off, free)

1. Create a Google Cloud project; enable the Google Calendar API.
2. Configure the OAuth consent screen (External), add the `calendar.app.created` scope.
3. Create an OAuth client of type **Web application**; add the hosted site's HTTPS origin (and `http://localhost:<port>` for development) as authorised JavaScript origins.
4. Keep publishing status at **Testing** and add each user's Gmail address as a test user (limit 100).
5. Users will see a "Google hasn't verified this app" screen on first sign-in; document this in the app so it isn't mistaken for a scam.
6. If usage grows past ~100 users: submit for verification (privacy policy page, verified custom domain ~A$15/yr, demo video, scope justification).

No client secret, service account or server is used.

## 6. Calendar sync design

### Dedicated "Roster" calendar

- On first sync, `POST /calendars` with `summary: "Roster"` and `timeZone: "Australia/Sydney"`.
- Store the returned calendar ID in IndexedDB.
- Users can recolour, hide or delete this calendar in Google Calendar without affecting anything else.
- It appears in the Google Calendar app, and in iPhone Calendar if the Google account is added on the phone.

### Deterministic event IDs (duplicate protection)

- Google allows client-supplied event IDs: lowercase base32hex characters (`a–v`, `0–9`), length 5–1024. A lowercase hex hash satisfies this.
- ID = hash of `date + shift type + ordinal` (ordinal handles the rare case of two shifts of the same type on one date).
- Start/end times are **not** in the ID, so a time change on the same date is an update, not delete + insert.
- Inserting an ID that already exists returns HTTP 409 → treated as "already present", then compared and patched if times differ.

### Reconciliation (automatic updates and removals)

For the date range covered by the parsed roster:

1. `GET /calendars/{rosterCalendarId}/events?timeMin=…&timeMax=…&singleEvents=true`
2. Compare against the approved shift list by event ID:
   - In roster, not in calendar → **insert**
   - In both, times/type differ → **patch**
   - In calendar, not in roster → **delete** (only within the roster's date range)
3. Show a summary before applying: e.g. "4 new, 1 changed, 1 removed". User confirms.
4. Apply sequentially with modest concurrency; report created / updated / deleted / failed.
5. Failed operations can be retried safely because IDs are deterministic.

Roster date range must be determined from the parsed dates (or a user-confirmed period), never guessed, so deletions can't reach outside it.

### Event content

```json
{
  "id": "<deterministic hex id>",
  "summary": "Night Shift",
  "description": "Imported from roster (ND 2130-0730)",
  "start": { "dateTime": "2026-11-03T21:30:00", "timeZone": "Australia/Sydney" },
  "end":   { "dateTime": "2026-11-04T07:30:00", "timeZone": "Australia/Sydney" },
  "reminders": { "useDefault": false, "overrides": [{ "method": "popup", "minutes": 120 }] }
}
```

Reminder lead time is a user setting.

### `.ics` fallback

A secondary "Download for other calendars" button generates one `.ics` file for all approved shifts:

- Times written in UTC (`Z`) to avoid VTIMEZONE blocks; UTC computed with Luxon from Sydney local time.
- Stable `UID` per shift; CRLF line endings; lines folded at 75 octets; optional `VALARM`.
- On iPhone, Safari offers **Add All**. The Google Calendar Android app does not import `.ics`; Samsung Calendar does.
- No automatic update/delete on this path.

## 7. OCR and parsing strategy (retained from v1)

### A. Recognition and layout grouping

1. User selects a screenshot.
2. Pre-process on a canvas (greyscale, upscale).
3. Run Tesseract.js locally; keep words, lines and bounding boxes.
4. Group into dates, table columns/rows, calendar cells and shift labels.
5. Keep source coordinates and original tokens for the review screen.

### B. Text normalisation

- Uppercase; normalise Unicode whitespace and dash variants.
- Join line breaks within the same likely cell.
- Recognise `9.30`, `9:30`, `0930`, etc.
- Apply OCR substitutions (e.g. `O730` → `0730`) **only inside validated time contexts**.
- Preserve original OCR text for comparison.

### C. Shift types

| Type | Recognised tokens | Illustrative default hours |
|---|---|---|
| AM | `AM`, `EARLY`, `MORNING` | 07:00–15:30 |
| PM | `PM`, `LATE`, `AFTERNOON` | 13:00–21:30 |
| NIGHT | `ND`, `N/D`, `NIGHT`, `NIGHTS` | 21:30–07:30 next day |
| Off | `OFF`, `RDO`, `ADO` | No event |
| Leave | `AL`, `ANNUAL LEAVE`, `SL`, `SICK LEAVE` | No event |
| Unknown | Other labels | Manual review |

Defaults are examples only; hours vary by ward and facility, so **default hours are editable in settings from day one**. Explicit roster times override defaults; inferred values are flagged. Don't confuse clock `AM`/`PM` (e.g. `7 PM`) with shift labels.

### D. Recognition patterns

```regex
\b(?:AM|EARLY|MORNING)\b
\b(?:PM|LATE|AFTERNOON)\b
\b(?:ND|N/D|NIGHT|NIGHTS)\b
\b(?:[01]?\d|2[0-3])[:.]?[0-5]\d\b
\b(0?[1-9]|[12]\d|3[01])[/.-](0?[1-9]|1[0-2])(?:[/.-](\d{2}|\d{4}))?\b
```

Dates require real calendar validation (incl. leap years). Time ranges need delimiter/context pairing (hyphen, en dash, `to`, adjacency). Four-digit strings are checked against layout so IDs/dates aren't misread as times.

### E. Time range examples

| OCR text | Parsed outcome |
|---|---|
| `0700-1530` | 07:00–15:30 |
| `07:00 - 15:30` | 07:00–15:30 |
| `7.00 to 15.30` | 07:00–15:30 |
| `AM 0700 1530` | Morning, 07:00–15:30 |
| `ND 2130-0730` | Night, overnight |
| `PM` | Inferred default, needs review |

### F. Date association

1. **List:** date and shift on one line.
2. **Weekly table:** map shift elements to date columns via bounding boxes.
3. **Monthly grid:** map labels to cells using the month/year heading.

Infer a missing year only from a reliable header or user-confirmed period. If multiple staff appear, require the user to select a row/region; never import everyone's shifts.

### G. Confidence (rule-based)

- **High:** date and times explicit and associated.
- **Medium:** shift type found, some values from defaults.
- **Low:** ambiguous date, row, time or label; not auto-selected.

Never fabricate missing shifts.

## 8. Overnight and timezone rules (retained from v1)

1. Build start and candidate end local datetimes from the roster date.
2. If end clock time < start clock time, end is the next day.
3. Identical start and end → flag ambiguous, don't assume 24 h.
4. Resolve in `Australia/Sydney` (configurable) using Luxon.
5. Validate duration; handle nonexistent/ambiguous local times at DST transitions.

Example: `ND 2130-0730` on 3 Nov 2026 → start Tue 3 Nov 21:30, end Wed 4 Nov 07:30 (10 h).

## 9. User workflow

1. **Import:** "Choose screenshot" → OCR runs locally with a progress indicator. No sign-in.
2. **Review:** chronological list with checkboxes; edit date, type, start, end; add/delete shifts; defaults and low-confidence items clearly marked; overnight shown as `07:30 (+1 day)`.
3. **Sync:** "Add all to Google Calendar" → Google popup → app shows the reconcile summary (new / changed / removed) → user confirms.
4. **Result:** created, updated, deleted, skipped and failed shown separately; "Retry failed" is safe.
5. **Fallback:** "Download for other calendars" (`.ics`).
6. **Settings:** default shift hours, reminder lead time, timezone, forget Roster calendar ID.

## 10. Decisions and alternatives considered

| Option | Outcome | Reason |
|---|---|---|
| Flutter app + ML Kit + `google_sign_in` (v1) | Rejected | iOS distribution needs Apple Developer Program (~A$150/yr) or 7-day free signing; native OAuth adds refresh-token handling and Testing-mode 7-day expiry; plugin churn; heavier setup |
| Native Swift (iOS only) | Rejected | Same Apple fee; doesn't cover Android co-workers |
| React Native / Expo | Rejected | No advantage over Flutter for this case; same distribution problem |
| iOS Shortcuts + Scriptable | Rejected for sharing | Free and on-device, but no bounding boxes (weak for grids) and iPhone only |
| Web app + `.ics` only | Kept as fallback | No sign-in, but Android Google Calendar can't import `.ics`; no automatic updates |
| Web app + Capacitor APK writing to device calendar | Deferred | Works and is free, but needs sideloading on Android and loses automatic updates |
| **Web app + Google sign-in (GIS token) + dedicated calendar** | **Chosen** | Free, one button on both platforms, no stored credentials, automatic dedupe/update/delete, no server |

Also noted: check whether the roster system (e.g. Employee Online) offers a calendar export/subscription in the user's local health district. If it does, OCR may be unnecessary.

## 11. Prototype first (highest risk items)

1. **iOS home-screen popup:** confirm the GIS sign-in popup works when launched from the iPhone home screen (standalone mode). Fallback: instruct iPhone users to run the sync from Safari.
2. **OCR accuracy:** run Tesseract.js against a redacted real roster screenshot; confirm reading order and bounding boxes support the grid layout.
3. **Calendar ID recovery:** confirm behaviour if IndexedDB is cleared — can the existing "Roster" calendar be found with `calendar.app.created`, or is `calendar.calendarlist.readonly` needed?
4. **Deleted-ID reuse:** confirm what happens when inserting an event ID that was previously deleted (may return 409; may need to patch the cancelled event back to `confirmed`).
5. **`.ics` in standalone mode:** confirm iOS shows Add All when the file is opened from the home-screen app.

## 12. Verification matrix

| Scenario | Expected result |
|---|---|
| AM/PM shifts with explicit hours | Accurate start and end |
| Night 21:30–07:30 | Correct next-day end |
| Cross-month roster | Correct month/year |
| OCR reads `O730` | Contextual correction or review flag |
| Only shift label present | Default applied, flagged inferred |
| Multiple staff rows | Only selected row imported |
| `OFF` / `RDO` / leave | No event |
| Airplane mode after first visit | OCR, parsing and review all work |
| No internet at sync | Clear failure, selections retained |
| Same roster imported twice | No duplicates (409 → skipped/patched) |
| Roster changed after import | Changed shifts patched, removed shifts deleted after confirmation |
| Token expires mid-sync | Re-prompt sign-in, resume safely |
| DST transition | Correct local times |
| Ambiguous date/time | Flagged, not auto-selected |
| Network audit | Only own origin + Google auth/Calendar endpoints contacted; none before sync |

## 13. Implementation sequence (Phase 2)

1. Vite + TypeScript scaffold, PWA manifest, service worker, CSP, hosting on GitHub/Cloudflare Pages.
2. Prototype the §11 risk items.
3. Screenshot input, canvas pre-processing, Tesseract.js worker with self-hosted assets and bounding boxes.
4. Layout-aware parser, date/time extraction, overnight and DST handling, with unit tests and synthetic fixtures.
5. Review/edit screen and settings (default hours, reminders).
6. Google Identity Services token flow, Roster calendar creation, deterministic IDs, reconciliation and results screen.
7. `.ics` fallback export.
8. Offline and network-audit tests; user guide (Add to Home Screen, first-sign-in warning, personal Gmail).

## 14. Defaults requiring approval

| Decision | Proposal |
|---|---|
| Platform | Installable web app (iPhone Safari, Android Chrome) |
| Hosting | GitHub Pages or Cloudflare Pages |
| OCR | Tesseract.js, self-hosted, offline after first visit |
| Supported layouts | Lists, weekly tables, monthly grids |
| Default AM / PM / Night | 07:00–15:30 / 13:00–21:30 / 21:30–07:30 (editable) |
| Off days / leave | Excluded |
| Timezone | `Australia/Sydney` |
| Destination | Dedicated "Roster" Google calendar |
| OAuth scope | `calendar.app.created` |
| OAuth status | Testing, users added by Gmail (≤100) |
| Duplicate protection | Deterministic event IDs + reconciliation |
| Image retention | None |
| Fallback | `.ics` download |

**Before Phase 2:** confirm actual shift hours, and provide a redacted roster screenshot (no names, employee numbers or other identifying details).

## Reference documentation

- [Google Identity Services — token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model)
- [Google Calendar API scopes](https://developers.google.com/workspace/calendar/api/auth)
- [Calendar API: Events insert](https://developers.google.com/workspace/calendar/api/v3/reference/events/insert)
- [Calendar API: Calendars insert](https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert)
- [Tesseract.js](https://github.com/naptha/tesseract.js)
- [Luxon](https://moment.github.io/luxon/)
