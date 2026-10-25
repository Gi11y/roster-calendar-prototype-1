# v0.15 calendar page redesign

Only the Google connection/comparison presentation changed. The recognition module (src/new-reader.ts), parsing helpers, shift confirmation list, OAuth scope, token lifetime/storage rules, Calendar API calls and reconciliation decisions are unchanged.

The calendar page now shows one stage-specific action: connect Google, choose an existing calendar if necessary, then check the calendar. Results use compact human-readable Sydney dates/times, small new/updated/unchanged counts and collapsed unchanged rows. Before/after details remain expandable. Calendar IDs, account controls, removal coverage, approved event payloads and recovery tests are under Options. Pending synthetic cleanup is surfaced and opens its controls automatically.

The separate second tap needed for the iPhone Google popup remains. No automatic sign-in, calendar creation, import or synthetic test was introduced. Real roster writes remain disabled.

calendar-design-preview.html is a clearly labelled synthetic visual fixture. It does not mount Google connection/API code, run OCR or make calendar requests. It exists to inspect the results layout without using credentials.

Validate: read a screenshot, confirm shifts, continue to Calendar preview; check count, one connect action, Options disclosures, then first-tap library preparation. Real account/device connection and live result checks require the user. Pure presentation tests cover stages, every change category, Sydney conversion, overnight/DST endings, all-day and invalid dates.
