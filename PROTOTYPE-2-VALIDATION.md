# Prototype 2 verification — 25 October 2026

Local: 24 unit tests and the TypeScript no-emit check passed. Local npm network access failed, so installing the new OCR packages and the full production build ran in GitHub Actions. The initial OCR deployment passed installation, all 24 tests, TypeScript/Vite build and production artifact checks. Source screenshots were not uploaded or committed.

Desktop browser: Tesseract ran locally on the supplied images with its engine/model files fetched only from the hosted site. Cropped first/second/third/fourth images produced 37/44/53/46 word boxes in scattered-text mode; a second-image single-block comparison produced 57 words. Many headings/date numbers were recognised, but most small text inside coloured shift cards was missed. These counts are diagnostic, not accuracy scores. No shift-import readiness is claimed. A configurable black-and-white threshold and manual crop controls support further experiments.

The example screenshots span months and include leave bars and multiple entries on one date. No defaults or meaning of labels were inferred. Higher zoom/source resolution or improved preprocessing may be required before parser work.

Tests verify crop constraints, memory cap, coordinate mapping and TSV word extraction alongside the 21 existing calendar tests. Offline service-worker behavior is checked using a mock cache VM; real airplane-mode relaunch and iPhone memory/performance remain device acceptance tests. No Google token is needed on the OCR page, and it cannot write calendar events.
