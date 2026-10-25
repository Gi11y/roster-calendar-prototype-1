# v0.6 label-reader validation

The shared-hours build passed 45 tests, strict TypeScript/Vite production build, cache checks and Pages deployment. On the second supplied screenshot, the enlarged/isolated label reader recognised all 10 labels correctly: N and nine A labels, including previously unread A labels. The original whole-card/time reading still misreads some digits, so no unattended import is claimed.

Label crops are contrast-normalised, padded and enlarged separately from the lower time line; multiple readings are reconciled conservatively. A white-glyph fallback and regression tests were then added for white night labels and rounded-corner noise. N10 geometry/consensus/rule handling is tested, but no clear N10 screenshot was supplied for a real-image check.

User correction: light green is Educator; darker green is floor staff. Both roles use A=07:00-15:00 and P=13:30-21:30 when no time is printed. Previously confirmed N/N10 exceptions remain. Printed times override defaults. Colour does not imply 12 hours. The review interface shows the enlarged crop and allows manual correction. No private screenshot was committed or uploaded and no calendar event was written.
