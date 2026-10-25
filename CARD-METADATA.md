# Fixed metadata boundary (v0.7)

The user confirmed that the repeated numeric ACS / GWW CRC / GOS CNEs block is fixed metadata. It is not shift-time evidence. The time reader now uses only text before this block; a separate time crop is limited to the physical gap between the top-left label and the metadata row. An empty gap does not trigger time OCR over the metadata. Raw full-card OCR remains available in diagnostics, alongside the chosen time-boundary reason.

The supplied changed Educator example has a printed 07:00-15:30 range, which should override the 8-hour default. The standard Educator example has no printed time range and should use A 07:00-15:00. Same-line OCR merging of a real range and metadata retains the valid prefix only. Clock-like corruption inside or below metadata is excluded. Conflicting valid pre-metadata times still require review.

Cropped single-card images are supported; label crops scale with card width instead of assuming full-screenshot size. Colour still identifies role only. N/N10 exceptions and explicit overrides remain unchanged. No calendar writes or automatic date inference occur.
