# Prototype 2: offline screenshot OCR

Open `ocr.html?v=0.4` on this Pages site. Prototype 1 remains available. No Google Cloud changes are needed.

Run `npm.cmd ci`, `npm.cmd test`, `npm.cmd run build`, `npm.cmd run test:production`. The build copies the pinned Tesseract engine, core JS/WASM variants, English model and licenses to static assets; none load from a CDN in the browser.

## iPhone test

Open online and wait for **Offline OCR files are ready**. If an older service worker is active, close all app windows and reopen; do not clear site data. Choose one screenshot, preview it, optionally crop using percentages, and run OCR. Start with greyscale and Scattered text. Inspect each word, confidence and bounding box; table coordinates refer to the original image. Tap a word row to highlight its box. Try original colours or black-and-white when text is missed.

After readiness, close/relaunch in airplane mode and choose an image again. Pass: OCR completes without internet. Repeat in Safari and home-screen mode separately. Clear/cancel removes images/results from memory; reload must show none. Device speed, Safari memory limits and storage eviction require iPhone testing.

## Privacy and limits

The four supplied screenshots are private local inputs: they are not committed, bundled, sent to Google or uploaded to the site. This OCR page loads only same-origin static assets, requests no Google sign-in and writes no calendar events. Its separate CSP restricts connections to the site. Screenshots and text stay in memory; only engine/model/app files are cached.

One worker runs at a time and is terminated after each job. Files are capped at 20 MB, source images at 25 megapixels, processed crops at about 8 megapixels. TSV word output is explicitly requested. Red boxes mean confidence below 60. Crop/scale mappings and TSV parsing have automated tests.

No roster parser, shift hours, leave interpretation, missing-date inference or real event import is implemented. The examples have small text, overlapping headers, multiple entries in one day and cross-month dates. These require later review; enlargement cannot restore missing detail.

Reference: https://github.com/naptha/tesseract.js/blob/v6.0.1/docs/api.md
