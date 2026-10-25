# Sydney time and reviewed-event preview (v0.10)

The cards page remains local-only. No GIS script, Google sign-in, calendar reads or writes are added by this stage.

1. Open cards.html?v=0.10 on a laptop, Pixel Chrome, and iPhone Safari/home screen.
2. Read a screenshot. Check dates, labels, role and printed overrides against every card. Check each review box.
3. The event preview button remains disabled until all detected cards are reviewed and valid.
4. Prepare the preview. Check each Sydney start/end, UTC conversion, next-day end, role, and chosen reminder. No reminder is selected by default.
5. Change any time/date/label/role or reminder. The old preview must disappear; changed cards require review again.
6. Preparing the same list twice yields the same IDs. Changing hours or role keeps the ID; changing date/type changes it.
7. Check an overnight example across 3–4 October 2026: 19:00–07:00 has 12 clock hours but 11 elapsed hours. Across 4–5 April 2026 it has 13 elapsed hours.
8. 02:30 on 4 October 2026 is nonexistent in Sydney; 02:30 on 5 April 2026 occurs twice. Both must block review rather than silently resolve.
9. Test in airplane mode after the new version has cached. These checks and previews must still work.

Build verification covers pure timezone validation, stable identity, review gating and approved-field filtering. It does not validate Google OAuth, Calendar writes, real deleted-ID restoration or device behaviour.

The next integration must compare approved events with the selected Roster calendar, show new/changed/removed entries, and require confirmation before any write. A detected shift range does not establish complete roster coverage; removals need an explicitly confirmed coverage period. A real-account deleted-ID probe is still required before claiming repeat imports after deletion work. Screenshots and raw OCR must never be sent to Google.
