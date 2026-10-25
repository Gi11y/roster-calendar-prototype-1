## v0.23 — manual shift swaps

Landing page now links to swap.html. Connect Google, choose your existing app-created Roster calendar, select a visible date range (up to 93 days), Find shifts and choose the original shift. Enter replacement date, role, shift label, start/end, next-day flag and reminder, then Review swap and Confirm. Uncheck Add a replacement shift for removal only. Hours are entered explicitly and use the existing Sydney/DST checks. No screenshot/OCR is needed.

Only simple, versioned events with this importer's ownership marker and correct deterministic ID are selectable. Reviews are read-only. Different-date/type replacements are saved and verified before the original is deleted with its reviewed If-Match version. Same-date/type edits update that same event instead, preserving its ordinal and avoiding deleted-ID reuse. Destination collisions are never overwritten or randomly re-IDed. Browser locks serialize the same original across tabs; server version checks protect intervening edits. Google does not provide an atomic transaction across the two events, so a partial swap can leave the replacement saved and original still present. The app reports this and offers Retry this change. Swap metadata lets a re-reviewed partial swap recognise its own saved replacement rather than duplicate it.

Previously deleted replacement IDs require the separate consented synthetic recovery test for the current calendar connection. Scope, access tokens, calendar selection and progress behaviour match the main flow: app-created event access plus read-only calendar list, tokens in memory only. Changing calendar/account or editing fields invalidates review. No shift swap is sent to the workplace or another person.

Manual swaps change Google Calendar only. A later import of an older screenshot can propose the original shift again; review that comparison rather than applying outdated roster data. No OCR or roster-recognition rules changed. Real swap/retry/removal/recovery and iPhone/Pixel tests require the user's account/device. Automated tests use synthetic calendars and cover ownership, DST, read-only reviews, conditional updates/removal, target collisions, interrupted writes, idempotent retry and recovery gating.

## v0.22 — calendar-name loading after Google sign-in

Immediately after a valid Google token returns, Calendar preview shows Google connected, Getting calendar names and an indeterminate progress bar. The existing elapsed-time/long-wait feedback remains active while the saved-calendar check, list fetch and candidate access checks finish. Calendar choices and setup actions stay hidden/disabled until this phase finishes. The same feedback is used by Refresh calendar list.

Success or failure clears the indicator; connection expiry/disconnect clears it as well. No fake percentage is shown because the number of calendars and requests is not known yet. OAuth popup timing, scopes, calendar operations, OCR and crop behaviour are unchanged. Tests verify the label, immediate start, pending-request lifetime and failure cleanup. Real Google-return timing on phones still requires a device check.

## v0.21 — visible checking and saving progress

Calendar preview now shows a progress bar during Check calendar and Apply. It reports actual completed shift checks, preflight checks, and saved/verified operations. Paginated calendar reads use an indeterminate bar because the page total is unknown. Elapsed time updates every second; after 15 seconds a longer-wait message asks the user to keep the page open and avoid tapping again. No simulated percentage or time estimate.

The bar appears before network work and is stopped on completion, failure, disconnect/expiry and page exit. Saving has two phases: checking all targets before writing, then completing the sequential changes. Counts advance only after an operation is verified or safely skipped. Errors preserve the existing partial-result and recheck workflow; no retries, new mutations or cancellation logic were added. Existing controls stay disabled while busy. Reduced-motion preferences disable the waiting animation.

Progress tests cover paginated/known counts, failures without false completion, preflight/save ordering, verified completions, elapsed feedback, cleanup and legacy pages. OCR, crop, shift defaults, Google scopes and reconciliation safeguards are unchanged. Live Google timing and phone presentation still require account/device checks; visual progress examples use synthetic states and make no Google calls.

## v0.20 — automatic roster cropping

Choose screenshot now proposes a crop around the full seven-column calendar and its date heading. A short preview lets users Read roster, adjust four crop edges, reset the suggestion, or use the full image. Review your shifts includes Adjust screenshot crop, which clears approvals and rereads the new selection. No new account/setup step, external image service, dependency, or Google scope.

Detection uses the existing on-device green-card/grid/weekday-band geometry at bounded resolution. It keeps all seven columns, blank days, leading leave rows, trailing row boundaries and generous header space. Unclear geometry, missing headings, isolated cards or outlying detected cards retain the full original image. Manual crops warn when detected cards fall outside. Cropping does not establish complete coverage for removals; that still requires the existing explicit confirmation.

The cropped processing canvas is drawn from the decoded original image before the existing three-megapixel processing cap, preserving available detail. Images, previews and crop coordinates remain in memory and are released on clear/page exit. The OCR recognition loop, label/time rules, date inference and Google reconciliation logic are unchanged.

Local geometry checks on the four supplied full screenshots retained all 40 detected cards: September 14/14 (24% area retained), August 10/10 (26%), October/November 2025 8/8 (27%), October/November 2026 8/8 (35%). This confirms card preservation and area reduction, not improved word/date accuracy. Unit tests cover full-grid/header margins, leave/blank rows, unsafe fallback, original-pixel mapping, manual bounds and blank images. Private screenshots/pixel files are never committed.

Phone test: choose a full roster screenshot, inspect the proposed crop, check the date/month heading and all seven columns/shift cards, Read roster, then review dates/hours as usual. Check Adjust crop and Use full image before repeating. A single-card screenshot should retain its full image and need its date confirmed as before. Real Pixel/iPhone checks remain user device tests.

## v0.19 — create your Roster calendar in the main flow

A new user reviews shifts and connects Google. If a successful calendar-list/access check finds no usable Roster calendar, the page offers Create my Roster calendar and Use an existing calendar. Creation makes one empty secondary Roster calendar in Australia/Sydney, verifies access, saves its ID, then shows Roster calendar ready and Check calendar. It never adds shifts automatically. Existing users retain their calendar selection and ordinary comparison flow. No new OAuth scopes, backend, tokens stored, OCR or hour defaults.

The explicit Create button is the only trigger. A browser lock serializes creation across tabs; the helper rereads settings and makes a fresh list/access check while holding the lock. An existing usable calendar is reused; multiple matches require a dropdown choice. Calendar-list/network errors stop creation. Browsers without Web Locks can still use an existing calendar, but creation asks for a current Safari/Chrome browser.

A non-secret setup identifier is stored before the creation request and included in calendar description metadata. If the response or local save is interrupted, a later attempt searches for that calendar rather than posting again. Unknown/unresolved attempts block another creation; definite Google request rejection clears the pending marker. The pending marker and selected calendar ID are the only new settings; no access token or screenshot is persisted. The new description marker also allows recovery after a calendar is renamed. This prevents blind retries but cannot make Google calendar creation atomic with local storage or protect across independently cleared browser storage.

Live test with a Google account that has no app-created Roster calendar: confirm shifts, connect and consent, Create my Roster calendar, confirm it appears once, Check calendar, review then Apply. Reload/reconnect and verify reuse. A returning account should select/reuse its existing calendar without creation. Real first-time Google creation and iPhone/home-screen checks require your account/device; automated tests use synthetic APIs and settings.

## v0.18 — reviewed removals and deleted-shift recovery

No OCR, shift defaults, auth scopes or token storage changes. The normal app can now apply removals within an explicitly confirmed complete roster period. Enable Include removals in Options, set both dates and confirm complete coverage, then Check calendar. Inspect every Remove row, confirm removal of those listed shifts, then Apply. The button states how many removals/restorations it includes. Only importer-owned deterministic IDs are eligible. Unrelated, moved-outside-period, recurring, guest-bearing, locked and special event types are protected.

All targets are preflighted before any write, and re-read before their operation. Removals use the reviewed etag with If-Match, run after additions/updates/restorations, and are verified as absent/cancelled. A failure stops later operations. A new comparison resolves interrupted/uncertain operations without duplicating earlier saves.

Deleted approved IDs appear as Restore. Open recovery check from the Apply area, read the synthetic event details, tick consent and Run recovery check. This separate test creates/deletes/restores/cleans up one synthetic event. Only a successful test with completed cleanup authorizes that insert-or-patch strategy for the current calendar connection. Reconnect, calendar change or token expiry clears this memory-only proof. Check calendar again after the test, review the Restore rows, then Apply. Patch recovery requires the same reviewed cancelled-event etag; missing tags, conflicts or unsupported recovery stop safely. IDs are never randomized to bypass tombstones. HTTP 410 on direct lookup is surfaced as recovery rather than a new event.

Live account/device testing is still required for deletion and recovery. Automated tests use synthetic calendars and cover the coverage/removal-confirmation gates, stable identities, stale versions, boundary moves, unrelated/protected events, operation ordering, interrupted deletes, both recovery strategies, missing/foreign proof, missing version tags, and retries. Previously confirmed phone add/update behaviour should be regression-checked.

## v0.17 — apply reviewed new and updated shifts

The normal app now has an Apply button after checking your Roster calendar. The button names the number of new/updated changes. No real event write occurs on connection, calendar selection, checking or screenshot review. Removal candidates remain preview-only; deleted-ID recovery and conflicts block Apply until resolved. Baseline/experimental reader pages remain read-only.

Apply revalidates the destination and all target events before its first write, then checks each target again immediately before saving. New events use deterministic IDs. HTTP 409 is accepted only after reading and matching the same managed shift. Updates require the exact reviewed etag and send If-Match. An intervening change stops the batch and requires a fresh comparison. It never overwrites foreign events or switches to a random ID. It preserves unrelated private metadata.

Saves run sequentially. Results distinguish added, updated, already matching, failed/uncertain and unattempted operations. An expired token or lost response stops further writes. Check again after reconnecting to see what remains; already saved stable IDs will not be duplicated. Calendar and event fields are rechecked before writes. Tokens stay memory-only. No OCR or shift-review code changed, no additional Google scopes.

Account/device test: use one confirmed shift, Check calendar, review the New entry, then Apply 1 change. Check again: it must be Unchanged with no Apply button. Repeat the screenshot: no duplicate. Edit only its hours, confirm and check: it must be Update, then Apply should edit that same event. Try changing that event in Google after preview but before Apply: saving must stop and request a new comparison. Check disconnect/reconnect and both Safari/home-screen modes. Live writes require your deliberate Apply tap and account; automated tests use synthetic in-memory calendars.

## v0.16 — one-tap connection and calendar dropdown

After confirming shifts, Calendar preview prepares Google Identity Services. Once ready, one tap on Connect Google opens the popup directly within the tap. Screenshots/OCR remain on-device; the Google library now loads when continuing to Calendar preview.

Normal app requests exactly calendar.app.created and calendar.calendarlist.readonly. In Google Cloud Console → Google Auth Platform → Data Access, add https://www.googleapis.com/auth/calendar.calendarlist.readonly alongside the existing app-created scope. Keep your existing OAuth Web client, authorized origins and testing users. Reconnect and approve the additional list permission. No client secret is used. Original google-test.html retains its original app-created scope.

The dropdown reads calendar-list metadata, filters owned secondary Roster candidates and verifies metadata plus app-created event access before saving a selection. Matching names alone do not grant access. Other calendars' events cannot be accessed. Tokens and list choices remain in memory; only the selected calendar ID is saved. Options retains manual ID entry if list consent is declined or the list is unavailable. Real roster writes remain disabled.

Device check: confirm shifts, wait for Connect Google to become enabled, tap once, grant consent, select a Roster calendar and Check calendar. Repeat in Safari and installed iPhone mode; test reconnect/disconnect. These live checks require your account/device. Automated tests use synthetic metadata and mocked tokens.

# Roster Calendar — Prototype 1

Standalone static TypeScript/Vite PWA. Tests the Google Identity Services **token client** (popup flow), creation of a secondary **Roster** calendar, and insertion of one synthetic event. Follows `roster_calendar_phase1_plan_v2.md` §11 item 1. **Not the complete roster app.**

## Prerequisites

- Node.js 22.18+ (or Node 24) and npm, Git, a GitHub account, and a personal Google account.
- No backend, OAuth secret, service account, purchased Apple developer account, or server required.
- The web OAuth **Client ID is public**. Never commit a client secret or access token.

## 1. Set up Google Cloud

1. Open https://console.cloud.google.com/ and make a new project, such as **Roster Calendar Test**.
2. In **APIs & Services > Library** search for **Google Calendar API** and click **Enable**.
3. Open **Google Auth platform > Branding** (or **Get Started**). Set app name (e.g., **Roster Calendar Test**), support email and developer contact email.
4. In **Google Auth platform > Audience**, choose **External**, set publishing status **Testing**, add your personal Gmail address to **Test users**. Do not publish to Production for this test.
5. In **Google Auth platform > Data Access**, add exactly `https://www.googleapis.com/auth/calendar.app.created`. Do not add `calendar` or `calendar.events` or `calendar.calendarlist.readonly` for prototype 1.
6. Open **Google Auth platform > Clients > Create client**. Choose **Web application**, name **Roster PWA Web Client**.
7. Under **Authorized JavaScript origins**, add `http://localhost:5173` for development and `https://YOUR_GITHUB_USERNAME.github.io` for GitHub Pages (NO repository path, NO trailing slash). These are two separate entries.
8. For **Authorized redirect URIs**, leave empty. GIS token popup flow does not use a redirect URL in this app.
9. Save and copy the **Client ID** ending `.apps.googleusercontent.com`. No client secret is needed.

**Important:** An External Testing consent screen shows a Google unverified/test warning on first authorisation. Only explicitly listed test users can authorise; limit is 100. If a scope approval screen offers a permission checkbox, approve the requested calendar scope. Do not proceed if the requested scope seems broader.

## 2. Local development

```sh
npm ci
# PowerShell: Copy-Item .env.example .env.local
cp .env.example .env.local
# Edit .env.local and replace the sample with your real OAuth Web Client ID.
npm run dev
```

Open `http://localhost:5173` **on your development computer**. iPhone cannot reach your computer's localhost; for iPhone tests, use the deployed HTTPS GitHub Pages URL.

You will see three steps. **First tap** Prepare Google sign-in, which fetches the Google GIS script. **Second tap** Connect Google account, which must directly invoke the popup from the user gesture. Then click **Create Roster calendar**, followed by **Check / add test event**. The test is Tuesday **3 November 2026 12:00–12:30 Australia/Sydney**. It is not a genuine roster shift. Open the event link or verify it via Google Calendar's calendar list.

## 3. GitHub Pages deployment (free)

1. Create a **public** GitHub repository named `roster-calendar-prototype-1` (or another name), without automatically adding a README.
2. In this project directory:

```sh
git init
git add .
git commit -m "Prototype 1: GIS and Calendar smoke test"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/roster-calendar-prototype-1.git
git push -u origin main
```

3. In GitHub repository **Settings > Secrets and variables > Actions > Variables**, add a *repository variable* called `VITE_GOOGLE_CLIENT_ID` with your OAuth Web Client ID (public; no secret). The workflow embeds this ID into the static JavaScript at build time. Do not add any client secret.
4. In **Settings > Pages > Build and deployment**, choose **GitHub Actions** as the source.
5. Open **Actions > Deploy prototype to GitHub Pages**, trigger **Run workflow** if needed (or push another commit). Verify the build and deployment succeed.
6. Open `https://YOUR_GITHUB_USERNAME.github.io/roster-calendar-prototype-1/`. The GitHub Actions build sets Vite `base` to the repository path automatically; do not append the repo name to the Google authorised **origin**.
7. The site's repository name must match the deployed repository; if renamed, push a new build. **Site origin** is `https://YOUR_GITHUB_USERNAME.github.io` even though the web app is served at `/roster-calendar-prototype-1/`.

The archive includes `package-lock.json`. CI uses `npm ci`, unit tests, the production build and production artifact checks. For local production checks:

```powershell
npm test
$env:GITHUB_REPOSITORY = "YOUR_GITHUB_USERNAME/roster-calendar-prototype-1"
npm run build
npm run test:production
npm run preview
```

Open `http://localhost:4173/roster-calendar-prototype-1/`. Add `http://localhost:4173` as an OAuth authorised JavaScript origin if testing OAuth in preview. The production artifact check reads the configured base from the generated HTML. Remove the environment variable for ordinary local development: `Remove-Item Env:GITHUB_REPOSITORY`.

## 4. iPhone Safari and home-screen acceptance test (v0.3)

1. Close app tabs and reopen the deployed link. Confirm **Prototype 1 v0.3**. Do not clear site data.
2. Prepare Google sign-in, then connect your personal Google account. PASS: the persistent indicator turns green and says **Google connected**, including after calendar/event operations. On expiry, reload, page exit or HTTP 401 it must show not connected until you reconnect; tokens remain memory-only.
3. If a calendar is already saved, the app verifies it with the current Google account. PASS: destination says **Using your verified Roster calendar** and the event button enables. Wrong account, deleted calendar or inaccessible calendar must leave event writes disabled and explain the failure.
4. On the working laptop or Safari version, tap **Copy selected calendar ID**. In the other mode/device, paste that ID in **Existing Roster calendar ID**, connect the same Google account and tap **Verify and use existing calendar**. PASS: both apps show exactly the same saved ID; no new Roster calendar or event is created by selection. Existing selection is preserved if verification or storage fails.
5. Only if you have never created a calendar: open **First time only: create a new Roster calendar**, read the warning, check the acknowledgement, then create once. The create button must otherwise stay disabled, including when a calendar ID is saved.
6. Tap **Check / add test event** twice. PASS: the second check reports already exists. Verify **Roster Prototype 1 Test**, 3 November 2026, 12:00-12:30 Sydney time. If extras exist within this selected calendar, review the displayed count and choose the cleanup button to keep one.
7. Safari: Share > Add to Home Screen. Launch the new icon and confirm **Home-screen standalone** in diagnostics. Repeat sign-in and existing-calendar selection using the SAME ID. Manual Google sign-in may be necessary. Record failure if the popup cannot return a token; use Safari sync as the architecture fallback.
8. Close/reopen and reconnect: PASS if the same saved calendar is verified again and no new calendar is created. Also check offline shell relaunch; Google sign-in and calendar operations require internet.

Record iOS version, mode, popup/token result, persistent indicator, both saved IDs (compare locally), event count and errors. Never record access tokens.

### Existing duplicate calendars

Earlier versions could create separate Roster calendars in Safari and standalone storage. v0.3 does not merge or delete calendars or move their events. Pick the intended original ID on the working device and use it everywhere. Clean up a redundant calendar separately in Google Calendar only after checking its contents. Event duplicate detection is limited to the selected calendar.

### Recovery scope finding

Google's CalendarList.list documentation does not list `calendar.app.created` as an accepted scope. Calendars.get and Events.list support it. This version therefore uses explicit calendar-ID transfer and verifies access, with no extra scope. It does not claim automatic lost-ID discovery. If every saved ID is lost, the owner can obtain the intended calendar's ID from Google Calendar settings (Integrate calendar > Calendar ID), or separately approve broader scope in future work.

Sources: https://developers.google.com/workspace/calendar/api/v3/reference/calendarList/list and https://developers.google.com/workspace/calendar/api/v3/reference/calendars/get

## Security and data handling

- Token exists only in a module-scoped JS variable, cleared before reconnection, on pagehide, and one minute before reported expiry; never IndexedDB/localStorage/sessionStorage.
- IndexedDB stores only the Google secondary calendar ID. The PWA service worker caches only this app's own static files; it does not cache Google responses, OAuth tokens or APIs.
- Google GIS script is requested only after a user action. Browsing the shell before that does not call Google.
- No screenshots, roster information, analytics or external OCR.
- Network access to Google is necessary for token and calendar operations. A meta Content-Security-Policy restricts scripts and connections to this origin and the necessary Google endpoints. Its compatibility with live GIS still requires the acceptance tests; GitHub Pages does not provide custom per-repository response headers.
- The same Calendar ID cannot necessarily be used by a different account. If you switch Google accounts, the event step may return 403/404. This prototype does not yet identify or automatically discover calendars. Existing secondary IDs can now be selected and verified.
- Prototype 1 uses a stable SHA-256 ID for the synthetic event, reuses matching legacy events and handles HTTP 409 without choosing a new ID. Full roster reconciliation and deleted-ID recovery remain later work.
- If the calendar creation call succeeds but saving to IndexedDB fails, the app warns you to check Google Calendar before retrying. Recovering IDs is a separate test.

## Troubleshooting

| Symptom | Likely cause / action |
|---|---|
| `origin_mismatch` | Check OAuth Web Client authorised origin. Exact scheme/domain/port, no path. |
| `access_denied` / app unavailable | Add the signing-in Gmail to the External Testing test-users list and verify consent. |
| Button disabled; setup required | Set local `.env.local` or GitHub Actions variable, redeploy. |
| Popup failed to open | Confirm two distinct taps; try ordinary Safari, turn off popup blockers and record the result. |
| `403` Calendar API | Check API enabled, grant included required scope and signed-in account. |
| `404` on insert | Saved calendar ID may belong to a different account or calendar was deleted. Do not blindly recreate. |
| Blank GitHub page / 404 for assets | Check repo-path Vite base and workflow deploy status. |
| Duplicate Roster calendars | Safari and standalone may have separate IndexedDB stores. Stop, note the IDs, and test recovery in prototype 3. |

## Docs

- GIS token model: https://developers.google.com/identity/oauth2/web/guides/use-token-model
- Calendar scope: https://developers.google.com/workspace/calendar/api/auth
- Calendars insert: https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert
- Events insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- GitHub Pages with Vite: https://vite.dev/guide/static-deploy

## Verification delivered with this archive

See VALIDATION.md for executed checks and remaining device/account tests. The original architecture plan is included unchanged. Prototype 1 does not implement OCR, parsing, real shifts, deterministic event reconciliation, automatic calendar discovery or deleted-ID reuse; these remain later prototypes. No shift hours or roster layout were assumed.

Wait until the service worker is activated, reload online once, then test offline shell launch. A service-worker registration message alone is not proof of offline readiness. Updates take effect after old app windows close; this avoids mixing old HTML with new assets.

If a create request loses its response, its outcome is uncertain: check Google Calendar before retrying. Do not retry calendar creation blindly. Use the same account on reconnect: account identification/recovery is deliberately deferred. Repeated event clicks should report already exists and leave the event count unchanged. If identical legacy copies exist, a cleanup button shows the extra count; clicking it removes only those copies from the saved Roster calendar and keeps one. Cleanup rechecks the preview and uses Google event versions to avoid deleting an event edited since the check.

## v0.2 duplicate regression check

Close all open tabs/windows of the hosted app, then reopen it so the new service worker activates. Confirm the header says **Prototype 1 v0.2** and the button says **Check / add test event**. Do not clear site data: that loses the saved calendar ID.

Connect the same Google account, click Check / add test event twice, reload/reconnect, and repeat. PASS: one synthetic event remains (or existing legacy duplicates are reported without a further insertion). If extras are reported, click the button that says how many it will remove. PASS: exactly one identical test event remains; a second check offers no cleanup. FAIL: count increases, unrelated events change, or the API reports an error.

Tests cover retries after a lost response, concurrent HTTP 409, legacy pagination, UTC/local offset equivalence, changed/cancelled events and cleanup validation. No broad calendar scan or cross-calendar cleanup occurs. If copies are in different Roster calendars, stop: calendar-ID recovery is still a separate prototype.

## v0.3 connection and calendar selection

A dedicated connected indicator is independent of operation messages. Saved IDs are reverified after every new Google connection before events can be written. Existing-calendar verification uses read-only metadata and a minimal events-list request; only the ID is stored in IndexedDB after verification succeeds. No calendar-list scope, profile/email scope or refresh-token storage was added.

Creation is hidden in a first-time setup disclosure and requires explicit acknowledgement. Shared browser/device contexts should transfer the same ID using the copy/paste path. The legacy synthetic-event deduplication and explicit cleanup from v0.2 are retained.
