# v0.8 date-review verification

The initial release passed 74 unit tests, strict TypeScript/Vite production build, production cache checks and GitHub Pages deployment. Browser acceptance on the fourth supplied screenshot detected all eight cards and, after card 1 was explicitly anchored to 2026-10-26 with Monday-first confirmed, associated October 26/27/29 and November 2/3/4/5/9 correctly.

A wrong anchor date 2026-10-27 yielded zero assigned dates and an OCR-day conflict. Marking card 6 reviewed increased the count to one; editing its end time cleared that review check. A temporary manual overnight edit of card 7 showed November 5 13:30 ending November 6 01:30; the original 22:00 end was then restored. No browser errors or Google writes occurred. Test image and results are cleared after testing.

Three additional regression guards cover clearing a manual date and date-range overflow without crashing. Manual time provenance is explicitly labelled. Leap dates, cross-year/month arithmetic, weekday conflicts, OCR-day conflicts, missing grids, cropped manual anchors, stacked cards and chronological sorting are covered by unit tests.

No current date, selected toolbar date, missing month/year or full roster period is guessed. No calendar events are created. This is a local-clock review preview: Sydney UTC/DST conversion, reconciliation and real calendar import remain later work. iPhone Safari/home-screen performance, date input and review interaction still require user-device acceptance.
