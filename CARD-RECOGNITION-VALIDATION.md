# Card recognition validation — 25 October 2026

The first v0.5 build passed all 36 tests, strict TypeScript/Vite build, production cache checks and Pages deployment. A final regression test was then added for agreement/conflict between time-reading passes.

Measured desktop browser results on the supplied private images: the fourth screenshot yielded 8 cards and a seven-column grid; all 8 visible day numbers were recognised correctly. Visible 11:00-19:30, 07:00-15:30 and 13:30-22:00 ranges were recovered by per-card OCR and took priority over colour defaults. Remaining A cards proposed the colour-based hours with review warnings.

The third screenshot yielded 8 cards, including separate cards in the same cell. Their day-number evidence both read 13 for the stacked pair; the lower card's 15:30-19:30 range was recovered. Some other labels remained uncertain rather than being invented.

The second screenshot yielded 10 cards and recognised N. Several labels/times on darker cards were missed or misread; in particular a time digit could be read as 18 instead of 19. A dedicated time-line pass was added so valid disagreements remain ambiguous and are not silently chosen. Accuracy is not sufficient for unattended import. The supplied images are not committed or uploaded; the browser reads local files and runs OCR locally.

No full dates or calendar events are generated. Grid/header/day-number output remains unverified evidence and no selected-header date is used as a guessed period. N10 is unit-tested; no supplied screenshot contains a clearly labelled N10 example to verify visually. All calendar prototypes remain unchanged except a link/version header.

Real iPhone Safari/home-screen performance, manual correction and airplane-mode relaunch remain acceptance tests. Only app and OCR assets are cached; image/crop/text results live in memory and clear on cancellation/page exit.
