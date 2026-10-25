# Colour + per-card recognition preview (v0.5)

Open cards.html?v=0.5. Original RGB pixels are used to find connected green rectangles and to sample their dominant background hue. Initial lighter/darker-green ranges are conservative and have an uncertainty band; check the original thumbnail and correct the category manually. These are provisional screenshot-specific heuristics, not a promise that all roster themes use identical colours. Grey leave bars are not recognised as shifts.

The preview tries to locate eight regular vertical date-grid lines plus horizontal borders, but a failed grid never blocks card inspection. Columns, raw header OCR and day-number OCR are evidence only. It never assigns month/year or builds full dates from the selected roster header, so cross-month screenshots cannot silently produce fabricated dates. Multiple stacked cards remain separate.

OCR runs one worker sequentially on enlarged top-left labels and individual cards. The original colour crop remains unchanged. Explicit visible ranges override inferred label/colour defaults. Confirmed rules: A 07:00; P 13:30; lighter green 12h / darker green 8h for A/P; N 19:00-07:00 next day; N10 21:45-07:45 next day. No extra break time. No N12 label is accepted. All inferred times are flagged for review; date/timezone/DST resolution is deliberately deferred.

Use: choose an image, check numbered outlines and blue grid lines, tap Read each detected card, compare every thumbnail/label/colour/time. Change uncertain labels/categories if needed. Clear/cancel or page exit discards image/crops/results. At most 40 cards are OCRed per run. No sign-in or calendar writes exist here; screenshots are not committed or transmitted.

Acceptance: run the supplied examples in iPhone Safari and home-screen mode, including offline after caching. Check missing/extra cards, colour categories, label A/P/N/N10, explicit times and stacked entries. Unknown/missing evidence must remain reviewable rather than guessed. Clock previews are not calendar events. Whole-grid OCR remains available for comparison.

Build: npm ci, npm test, npm run build, npm run test:production; existing Pages workflow deploys all pages with self-hosted OCR assets. No extra Google scopes or configuration required.
