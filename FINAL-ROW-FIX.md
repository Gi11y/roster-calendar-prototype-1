# Tall final-row grid fix (v0.9.1)

The September screenshot reported 14 cards and 11 dated. The three unassigned cards had readable day OCR 22, 23 and 25, with correct columns, but lacked a lower row boundary. The original horizontal-line search stopped 60 pixels below the last green card. A secondary leave entry made the final row taller, putting its visible bottom border outside that search.

The detector now follows the visible vertical date-grid borders below the last green card, tolerates bounded interruptions from leave bars, and scans horizontal separators through the observed table extent. It does not fabricate a border when evidence is absent or use a distant footer line. Date review stays unresolved when the real bottom boundary cannot be established. No date-conflict safeguards, time rules or Google permissions changed.

Regression tests cover a tall final row, an interrupting leave bar, and an absent border/distant footer. Source images remain local and are not committed. This is the same image/grid issue on desktop and Pixel; no device-specific workaround is needed.
