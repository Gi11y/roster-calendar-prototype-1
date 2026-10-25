# Printed-time recovery — v0.12.11

All recognition stays on the device. An original-colour OCR pass is followed, when necessary, by a high-contrast card pass, a spatially bounded time-line crop, and focused original/ink readings. If these fail to agree, one raw-line retry is allowed. At least two valid focused readings must agree, with no conflicting valid focused range.

Time-line grouping uses vertical overlap so short mid-height hyphens are not separated from the clock digits. Compact and mixed clock tokens such as 1100–19:30 are normalized only inside paired time contexts. Staff metadata is excluded before time parsing.

When printed time evidence exists but cannot be read consistently, a warning blocks confirmation and default substitution. The user can inspect the original card and enter both times. Default A/P/N/N10 hours are retained only when no printed override is detected. Manual corrections clear previous review/preview approval.

Verification uses synthetic unit tests and the user's local screenshots without committing them. The small September JPEG still has ambiguous digit shapes; higher resolution screenshots should be taken after zooming the actual roster webpage, rather than enlarging an already captured image. This change does not claim perfect OCR.
