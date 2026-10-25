# Blush sheet interface — v0.12

The root page and cards.html now show the selected B interface. The original Google smoke-test page is retained at google-test.html. Existing stored calendar IDs and OAuth scope are unchanged.

Choose screenshot starts local detection and OCR automatically. Cancel discards the image, crops and results. Errors and images with no detected cards return to the upload screen with a message.

The chronological review is a simple list: date, role/type, clock range, next-day note and one confirmation control per shift. The chevron reveals the source card and date/type/role/time corrections. Invalid or ambiguous shifts cannot be confirmed. Changing values clears the previous approval and event/comparison preview. There is no bulk-confirm control.

After all shifts are confirmed, Review calendar changes prepares deterministic events and opens the Google comparison step. Source evidence, raw diagnostics, anchor correction, reminder settings and exact event payloads remain available in optional disclosures. Real roster imports remain disabled; the separate synthetic recovery test still needs explicit user approval and a real-account test.

## Verify

- Open the root URL or cards.html?v=0.12; confirm blush/ivory styling and v0.12.
- Choose a known screenshot. Detection and reading should start without two extra buttons.
- Cancel mid-read, then choose another image. Old asynchronous results must not replace the new image.
- Review the recognised list. Expand a row, compare the original card, fix date/label/role/hours if necessary, and confirm it.
- A/P defaults, printed overrides, N/N10, overnight and Sydney DST validation are unchanged.
- Editing a confirmed shift unchecks it and blocks continuing until checked again.
- Confirm every row, continue to comparison, then use Back to shifts. Corrections must invalidate the old comparison.
- Check mobile widths and keyboard access: labels, confirmation targets, date/time inputs and chevrons.
- After the update has cached, test reading/review offline. Google comparison requires internet.
- Old prototype tests remain accessible through About this prototype → Original Google test.

No external fonts, images, libraries or analytics were added for styling. Colours follow the selected palette with darker cocoa text for readability.
