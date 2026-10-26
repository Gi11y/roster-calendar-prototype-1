# Screenshot regression library

Keep real roster screenshots and their expected shifts in `tests/local-fixtures/` (ignored by Git). Do not commit screenshots, employee identifiers, recognised text, or real shift ground truth to the public repository.

## Private image manifest

Create a private JSON file with an `images` array. Each entry has a short anonymous `name`, a `path` relative to that JSON file, the manually counted `cards`, and optionally `columns` (default 7) and `headerless_top` (a pixel boundary above every green card).

Example: `{"images":[{"name":"sample-a","path":"sample.png","cards":8,"columns":7}]}`.

Record expected dates, A/P/N/N10 labels, role, printed start/end times and overnight flags alongside each image. Those are human ground truth, never copied from a reader result. Include genuine iPhone Safari, installed iPhone, Pixel Chrome, portrait and landscape captures; generated variants do not replace device testing.

## Prepare and run layout checks

The optional preparation script needs Python with Pillow. It reads local images and creates compressed RGBA fixtures for original, small, large, wide-margin, JPEG-compressed, sideways and upside-down variants. A configured headerless variant deliberately omits the date heading.

```
python scripts/prepare-screenshot-fixtures.py tests/local-fixtures/inputs.json tests/local-fixtures/prepared
npm run test:layout -- tests/local-fixtures/prepared/manifest.json tests/local-fixtures/layout-report.json
```

The runner uses the production card, grid and crop functions. It checks manually expected card counts, visible column counts, usable row boundaries and automatic-crop retention. Rotation cases are corrected by their declared user rotation before checking. It reports **layout results only**, not OCR accuracy.

## OCR and device acceptance

For each actual image, open the normal reader and compare every date, label, role, printed time and overnight ending against the private ground truth. Record incorrect accepted fields separately from fields safely flagged for review, plus runtime. Verify partial screenshots keep existing calendar shifts, clipped cards produce a warning, and upright landscape images stay upright. Re-test the original verified screenshots after changing geometry or text preparation.

CI includes generated fixtures for full grids, one-to-six-column crops, wide layouts, missing borders, cropped cards, rotation transforms and partial-coverage protection. No private screenshots or Google credentials are needed for CI.
