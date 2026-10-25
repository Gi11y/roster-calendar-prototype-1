# Date association and chronological review (v0.8)

No header date, current month or year is silently inferred. Choose one numbered card and enter the exact full date from its day cell, then confirm that the visible grid runs Monday through Sunday. The date selected in the roster toolbar may differ from the date of the first card: do not use it unless it is actually that card's date.

Dates are associated by detected row/column offsets relative to that confirmed card, using calendar-day arithmetic across months, years and leap days. Multiple cards in one cell remain separate. An OCR day disagreement, weekday mismatch or uncertain row boundary is shown as a conflict rather than assigned silently. A cropped single card can be dated from an explicit anchor without a grid; individual dates can also be entered manually. Manual overrides are retained when reapplying an anchor, and review checks reset.

The chronological list shows role, label, date, editable start/end clock times, overnight setting and resulting end date. Invalid dates, missing label/role, missing/invalid times, identical start/end or durations over 16 clock hours prevent a review check. Editing dates/times or changing a label/colour clears its review check. Changing the image clears all dates, overrides and results from memory.

This is a review-only prototype. No Google sign-in, writes, export or reconciliation is added. Sydney clock times are shown, but UTC/DST conversion and validating real instants remain later work. A checked review box is not a calendar import.

## Test

Use the fourth supplied screenshot: choose card 1 (26 October 2026) as anchor, enter 2026-10-26 and confirm Monday-first. Expected dates proceed through October 27/29 and November 2/3/4/5/9, with the visible printed times still overriding defaults. Wrong-weekday anchors must fail. The stacked-card screenshot should keep both 13 November 2025 cards. If a day OCR conflicts, check the original and correct it manually; do not accept the proposal blindly.

Run npm ci, npm test, npm run build and npm run test:production. Existing Pages deployment and self-hosted offline OCR are retained. No additional Google Cloud configuration or scope is needed. Test on iPhone Safari and home-screen mode and repeat offline after the new app files have cached.
