# Recognition comparison — 25 October 2026

The normal app uses the restored v0.9.1 reader with interface B. The v0.12.11 reader is isolated at experimental-cards.html. No recognition changes were promoted automatically during this comparison.

## Result

The newer reader improved accuracy on the supplied test set, with no observed regression of a previously correct field. It was slower and still produced two wrong automatic end times. It is an improvement on this set, not a fully reliable replacement.

| Measure | Baseline v0.9.1 | Experimental v0.12.11 |
|---|---:|---:|
| Cards detected | 42/42 | 42/42 |
| Dates correct, full rosters | 40/40 | 40/40 |
| Shift letters correct | 40/42 | 42/42 |
| Staff roles correct | 42/42 | 42/42 |
| Complete clock ranges correct | 28/42 | 34/42 |
| Printed overrides correct | 7/21 | 13/21 |
| Wrong clock ranges suggested | 10 | 2 |
| Clock ranges left blank for review | 4 | 6 |
| Total OCR-stage time, four full rosters | 49.7 s | 76.9 s |

The experimental full-roster time was approximately 55% higher. The six extra correct clock ranges and two extra correct letters came without losing any baseline-correct label, role, date or range in these cases. More review flags are counted separately from wrong suggestions.

## Per-image results

Dates and roles were correct in every applicable case for both readers.

| Case | Cards | Letters B/E | Correct ranges B/E | Printed overrides B/E | Wrong ranges B/E | Flagged ranges B/E | OCR seconds B/E |
|---|---:|---:|---:|---:|---:|---:|---:|
| E2 — standard Educator crop, warm-up | 1 | 1/1 | 1/1 | 0/0 | 0/0 | 0/0 | 2.6/3.2 |
| E1 — printed Educator override crop | 1 | 1/1 | 1/1 | 1/1 | 0/0 | 0/0 | 3.6/3.5 |
| S1 — full roster 1 | 14 | 12/14 | 8/12 | 0/4 | 4/0 | 2/2 | 13.4/21.8 |
| S2 — full roster 2 | 10 | 10/10 | 2/4 | 1/3 | 6/2 | 2/4 | 11.3/20.2 |
| S3 — mixed roles and stacked shifts | 8 | 8/8 | 8/8 | 1/1 | 0/0 | 0/0 | 12.8/17.5 |
| S4 — full roster 4 | 8 | 8/8 | 8/8 | 4/4 | 0/0 | 0/0 | 12.2/17.4 |

B/E means baseline/experimental; paired counts are reader results, not fractions of the number of cards. The two isolated crops do not contain dates and were not included in the date denominator.

## Method

- Six exact user-supplied images: four full rosters and two Educator crops, containing 42 shifts and 21 printed overrides.
- Expected letters, dates, roles and hours were read from the supplied screenshots and confirmed user rules. Card order was checked against source coordinates so the two shifts on one date were not mismatched.
- Same laptop, in-app browser, source files, model files and interface. One reader ran at a time. Order alternated for the full-roster pairs. The standard Educator card was read first in both readers to warm assets.
- One measured run per reader/image. Timings cover OCR worker setup, recognition, review rendering and cleanup; they exclude screenshot selection/detection. These are practical single-run observations, not statistical performance estimates.
- Tesseract.js 6.0.1, core 6.1.2 and English model package 1.0.0 match the v0.9.1 lockfile.
- The baseline label-crop function and OCR procedure were checked against commit 9fc745cc2c2771f0258b4cbc0e8e4347ef295f26. Only interface hooks and a local elapsed-time display were added. Layout and time-parsing helpers are unchanged.
- The experimental source is the v0.12.11 snapshot from a9dd705ce39a958bb74e6e6323036f3f31142880, isolated from the normal page.
- No Google sign-in or Calendar writes were part of this test. Images and raw OCR were not uploaded or committed.

## Remaining errors and decision

Both readers still misread two end times as 18:30 instead of the printed 19:30 in one full-roster case. The experimental reader also leaves six ranges for manual review. Automated tests do not demonstrate universal OCR accuracy.

Keep the restored baseline as the normal app for now. Keep the newer reader available for controlled comparison, rather than mixing the whole rewrite into an interface change. The letter retries and printed-time checks have measurable benefits on this set; any later promotion should preserve this paired evidence, address the remaining wrong automatic times and be checked on Pixel/iPhone. No real N10 screenshot was present in this sample set.

The restoration and isolation build passed 130 automated tests, TypeScript/Vite production build and offline checks. Phone timing, real Google OAuth, deleted-ID recovery and real roster synchronization were not verified by this comparison.
