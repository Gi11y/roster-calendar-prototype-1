# Label and Educator correction (v0.6)

Light green now means Educator role. It no longer assigns a 12-hour shift. The user confirmed that both roles use the same hours: absent printed times, A/P are 8-hour shifts (A starts 07:00; P starts 13:30). Colour affects the role only. Printed times override default hours. N and N10 floor-staff defaults remain 19:00-07:00 and 21:45-07:45. Printed time ranges take precedence. No calendar writes occur.

Label recognition now isolates connected dark glyphs from the top-left corner, excluding the lower time line, keeps neighbouring glyphs for N10, adds white padding and enlarges the label about 8x. Contrast-normalised and binary crops are read separately with line/single-character modes. Strong disagreements remain uncertain; an enlarged crop and reading explanation are shown for manual correction. Full-card text is a third source of evidence.

Regression tests cover excluding time-line pixels, keeping N10 glyphs, rejecting blank patches, consensus/conflict handling and the revised Educator rule. The OCR engine and models remain self-hosted and offline-capable; images/results stay in memory. Device-specific OCR accuracy still needs iPhone testing.
