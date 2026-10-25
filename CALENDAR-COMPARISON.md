# Calendar comparison and synthetic recovery test (v0.11)

This stage adds optional Google connection to the cards page. It does not import or reconcile real roster events yet.

## Test on laptop, Pixel, iPhone Safari and iPhone home screen

1. Open cards.html?v=0.11. Confirm v0.11 is visible; close old app windows after an update.
2. Read a screenshot, check every detected card and prepare reviewed events.
3. In section 6 tap Prepare Google sign-in, then Connect Google account. Use the same personal Google account used for the existing Roster calendar. Only calendar.app.created is requested; tokens stay in memory.
4. The saved calendar ID is read from IndexedDB and verified after each sign-in. If missing, paste the secondary Roster calendar ID from the original prototype and tap Verify and use this calendar. Do not create a second calendar. This page has no calendar-creation control.
5. Tap Compare reviewed events — no changes. New, changed, unchanged, deleted-ID restoration, conflicts and optional removal candidates are listed. This action uses GET requests only. No screenshot/raw OCR or approved event bodies are uploaded.
6. Without confirmed complete roster coverage, removal candidates are excluded. If testing them, enter the full covered period, including days off, and explicitly check the completeness confirmation. Only importer-managed events whose stored date AND actual Sydney start are inside coverage are eligible. Unrelated, legacy smoke-test, moved-outside and recurring/guest events are protected.
7. Edit any reviewed card, re-read, change reminder or coverage, disconnect or let the token expire. The old comparison must clear. Re-prepare/reconnect and compare again.
8. The separate recovery test requires its own approval checkbox and button. It creates a uniquely identified synthetic event named “Roster recovery test — safe to delete”, 3 November 2026 12:40–12:45 Sydney, no reminder. It verifies creation/deletion/restoration and cleans up. Do not close the page while running.
9. Record PASS or NOT PASSED and whether the strategy was insert or patch. A failed cleanup is explicit and offers Retry synthetic cleanup after reconnecting to the same calendar/account. If necessary remove only the named synthetic event manually. A failed test never enables real roster writes.
10. Reconnect as a different account: previous connection and comparison must clear; the calendar must verify again. No broader scope is added if the account cannot access it.

## Verification boundary

Automated tests mock Calendar responses to cover comparison categories, complete-coverage boundaries across DST, pagination, stable-ID lookup outside the date window, read-only comparison, 404/401/403/410 failures, cancelled-event reinsertion and version-checked restoration, cleanup failures and protection of edited/foreign events. Production checks cover static build, offline precaching and Google request bypass.

Real Google OAuth, Calendar cancelled-ID behaviour and iPhone/Pixel popup behaviour still require the user's account/device. No agent-run real calendar writes are included. The probe result is in memory and applies to the selected account/calendar session only.

References: [Calendar list](https://developers.google.com/workspace/calendar/api/v3/reference/events/list), [Calendar patch](https://developers.google.com/workspace/calendar/api/v3/reference/events/patch), [GIS token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model).
