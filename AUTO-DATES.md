# Automatic date anchor (v0.9)

After per-card OCR, the app reads the screenshot header and a separate weekday-heading strip. A header's selected day is never copied directly as the card date. Only its explicit month/year is used as a reference, with adjacent months considered for cross-month grids. No current date/year is assumed.

Automatic selection requires an eight-border/seven-column grid, evidence of Monday-through-Sunday heading order, at least three independent grid cells with day OCR, at least 70 percent agreement, and a clear lead over alternative calendar periods. Stacked cards count as one day of independent evidence. A trustworthy matching card becomes the automatic anchor; day conflicts remain unassigned for review. If month patterns, headings or year evidence are ambiguous, the manual anchor panel opens instead.

The review list is populated without a mandatory anchor step when evidence is clear. The automatic anchor and inferred date range remain visible. Change date anchor is always available; choosing one manually protects it from subsequent automatic overwrite. Try automatic dates again explicitly re-enables auto selection. Individual manual date/time corrections are retained, and review checks reset when the anchor changes. New images clear all date state.

Tests cover October-November rollover, first shifts after leave weeks in a later month, contextual 0ct OCR, absence of header/year, cropped cards, ambiguous February/March patterns, bad OCR days, duplicate/stacked cells, weekday order, conflicting header years and grey weekday-strip detection. Date inference is still a preview; users review each date/time before any future import. No Google/calendar writes or UTC/DST conversion are added.
