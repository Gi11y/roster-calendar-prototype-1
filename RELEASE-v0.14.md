# v0.14 — deploy the measured newer reader

The user approved deployment after the paired six-image comparison. The normal index.html and cards.html now use src/new-reader.ts, a copy of the measured experimental v0.12.11 module with only the local reader-status wording changed. No recognition algorithm or shift rules were changed during promotion.

The v0.9.1 baseline remains at baseline-cards.html, and the comparison report remains available at recognition-comparison.html. Both normal entry points and the baseline are included in the offline cache.

The measured limitations remain: two wrong automatic end times and six ranges requiring review in the 42-shift set; approximately 55% higher OCR-stage time across the four full rosters. These are laptop results, with phone comparison still pending. Every shift must be reviewed. Real roster calendar writes remain disabled.

After deployment, close all old app windows if an earlier service worker keeps serving a previous version. Reopen cards.html?v=0.14 and confirm v0.14 and the Newer reader label.
