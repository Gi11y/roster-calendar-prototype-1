# P-label diagnostic fix

A real isolated P was seven pixels wide and nine high. Its upper bowl extended into the old lower-40-percent measurement region, producing lower-right ink density 0.188. The conservative cutoff was 0.12, so the fallback incorrectly rejected this visibly clear P. Measuring the actual lower quarter gives density 0.0 and keeps A/N/closed-box rejection tests intact. A regression test uses this generic glyph shape; no screenshot is committed.

The per-card Recognition diagnostics now lists exact raw OCR output, normalised label, whether TSV confidence records exist, and P-contour rejection reasons and measurements. A question mark no longer hides whether the engine was blank, the text was not a supported label, or geometric evidence was rejected. These scores are not calibrated probabilities. The top-left crops and manual correction remain visible.

Timing rules remain: colour denotes staff role; both roles share 8-hour A/P defaults absent printed times. Printed ranges and confirmed N/N10 exceptions take precedence. No calendar writes occur.
