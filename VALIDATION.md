# Prototype 1 validation — 25 October 2026 (Australia/Sydney)

## Passed

- Inspected the original downloaded roster-calendar-prototype-1.zip and the uploaded architecture plan, included unchanged in this archive.
- Clean `npm ci`: 17 packages installed, npm reported zero vulnerabilities. Lockfile included. npm noted esbuild's optional postinstall approval; the production build succeeded with the installed platform binary.
- `npm test`: all 3 tests passed (GIS scope configuration, authenticated no-store Calendar requests, API error reporting). Google interfaces and fetch are mocked.
- `npm run build`: strict TypeScript no-emit check and Vite 7.3.7 production build passed after clean install, including GitHub Pages repository base.
- `npm run test:production`: generated service worker executed in a Node VM with mocked cache/event APIs. Confirmed HTML/JS/CSS/icons/manifest precache entries exist, cached navigation works with network unavailable, unrelated caches survive cleanup, Google URLs bypass the worker, repository-prefixed asset URLs and lazy GIS loading.
- Vite production preview started successfully. This is not a browser rendering check.

## Fixed

- Original Google script loader failed TypeScript compilation because Promise<void> was not explicit.
- Original worker did not precache compiled JS/CSS and could delete other apps' caches. Build-generated worker now includes the complete shell and scopes cleanup by application path.
- Added memory-token deadline handling, pagehide clearing and clearing before reconnect; no tokens are persisted.
- Disabled incremental scope inclusion, set Calendar fetch no-store/credentials omit, added restrictive meta CSP.
- Added lockfile, clean-install CI, tests and user-site GitHub Pages base handling.

## Still requires your Google account / iPhone

No real OAuth client ID or access token was supplied. No live Google requests, calendar creation, event insertion, consent screen, scope grant, API CORS or GIS/CSP compatibility were verified. No GitHub deployment was performed.

No Safari, iOS home-screen popup, IndexedDB persistence across iPhone launches, real service-worker lifecycle/offline relaunch, installed icon or browser rendering was verified. The offline VM test is a logic test, not a device test. Local HTTP probing encountered execution-environment socket restrictions; no HTTP preview pass is claimed.

Run README section 4 separately in Safari and home-screen mode. Record iOS version, mode, popup/token outcome, calendar/event result and error text. Calendar must be secondary Roster; synthetic event must be 3 November 2026 12:00–12:30 Australia/Sydney. Check Google Calendar display timezone when comparing. If standalone popup fails, record FAIL and use the plan's Safari-sync fallback; do not claim standalone support.

Prototype 3 still owns lost-calendar-ID recovery and deleted-event-ID reuse. Do not clear IndexedDB or create a second Roster calendar to work around these unknowns. Synthetic event insertions are intentionally not idempotent in this limited prototype. No roster format or real shift hours were assumed.

## v0.2 duplicate fix — 25 October 2026

The original three-test record above describes the initial archive. The v0.2 revision adds 11 regression tests for stable identity, repeat import, legacy copies, pagination, HTTP 409, cancelled IDs, read failure, exact matching, approved cleanup, changed preview and lost responses. The total is now 14 tests. Local TypeScript/Vite and production artifact checks pass. Tests mock Google responses; real account/device regression testing remains necessary.

The initial deployment to https://gi11y.github.io/roster-calendar-prototype-1/ succeeded in GitHub Actions, and the owner reported successful laptop OAuth and event insertion. That test exposed duplicates from automatically allocated event IDs. v0.2 prevents further identical insertions and offers cleanup after an explicit user click. No user calendar was modified by the local regression tests. Lost calendar recovery, full roster reconciliation and deleted-ID reuse remain out of scope.

## v0.3 connection indicator and existing calendar selection — 25 October 2026

21 unit tests pass: the prior 14 plus 7 tests for read-only existing-calendar validation, rejected primary IDs/URLs/tokens, wrong-account/read failures, unrelated calendars, renamed app calendars, connection expiry labels and guarded new-calendar creation. Strict TypeScript/Vite production build and production artifact tests also pass. API responses and connection time are mocked; real Google verification in Safari/standalone remains a user acceptance check.

Google documentation confirms CalendarList.list requires a scope beyond calendar.app.created. No scope was broadened. A manual ID-transfer path uses Calendars.get and Events.list under the existing scope; no live automatic discovery claim is made. The owner reported successful iPhone Safari usage and successful manual Google sign-in from the home-screen app. A duplicate calendar arose when Create Roster calendar was used in a separate storage context; v0.3 puts creation behind an explicit first-time acknowledgement and offers reuse of the intended existing ID.

This update does not delete or merge duplicate calendars. All existing event and calendar content is left in place until a user explicitly performs an available operation.
