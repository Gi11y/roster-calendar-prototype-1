# Roster

A static, installable web app that reads roster screenshots on the device and saves reviewed work shifts to a dedicated Google Roster calendar.

Share the bare URL: https://gi11y.github.io/roster-calendar-prototype-1/

## Coworker flow

Choose screenshot → check crop → review shifts → connect a personal Google account → choose/create Roster calendar → check changes → confirm Apply. Change a shift supports replacement, removal, and an extra shift without a screenshot. Dates/hours use Australia/Sydney. Manual end clocks earlier than start infer next day and show the finish date/time. Users can correct the next-day flag before review.

Only work shifts are included. Leave, RDO and study/non-shift codes are not converted to all-day events. No new defaults for these entries are inferred. Review the complete roster before enabling removals. An older screenshot can propose changes that undo a manual change, so review comparisons.

## Privacy

Screenshots, cropping and OCR remain on-device. Tesseract assets are self-hosted and cached. No backend, analytics, cloud OCR, external fonts or long-term sign-in credentials. The app stores the selected calendar ID, an interrupted calendar-setup identifier and the one-time install-hint preference. Google access tokens stay in memory. See [Privacy](https://gi11y.github.io/roster-calendar-prototype-1/privacy.html).

Event access uses exactly calendar.app.created. The separately approved calendar.calendarlist.readonly permission lists calendar metadata for selection/recovery; it does not grant other calendar event access. Calendar/event identities and version tags are checked before writes. Stable IDs protect against duplicate inserts. Changes require confirmation; replacements are verified before deleting originals; failures report partial outcomes.

## Developer setup

Use Node 22.18+ and npm. From the extracted project folder on Windows use npm.cmd ci if PowerShell blocks npm.ps1. Copy .env.example to .env.local and set VITE_GOOGLE_CLIENT_ID to your OAuth Web client ID. It is public configuration; never add a client secret. Run npm.cmd run dev, npm.cmd test, npm.cmd run build, and npm.cmd run test:production. The build vendors OCR assets before generating the offline shell.

The repository Pages workflow installs dependencies, runs tests, builds and checks offline assets, then deploys. Its existing VITE_GOOGLE_CLIENT_ID variable supplies the client ID. Vite asset hashes and network-first online navigation handle updates; offline navigation uses a complete cached build. Shared links carry no version query. Old ?v= or recovery-cache queries are removed from the address after load without discarding ?debug=1 or fragments.

## Google sharing and publication

In Google Cloud enable Calendar API and configure a Web application OAuth client with authorized JavaScript origins for localhost and the hosted origin (scheme/host/port only). Use the two scopes above. While External/Testing, add personal Google accounts under Audience → Test users; Google limits that mode to 100 listed testers.

Do not assume that every Calendar scope is sensitive or that every private group must complete public verification. Google's Calendar scope guide confirms the app-created/calendar-list capabilities, but its public table does not label the classification of individual scopes. Google's OAuth scope reference points to the sensitivity indicator in Cloud Console. The owner deferred the signed-in Console audit; scope classifications and publishing status have not been verified in this session.

For a public verification submission, Google's requirements describe a homepage on a domain you own and verify, linked privacy policy, support contact and accurate consent branding. This app now supplies homepage functionality and a static privacy page on the same host. Configuring a custom domain, proving ownership, adding Console policy/contact URLs and changing publishing status remain owner account steps; no domain was purchased or account setting changed here. Small personal-use/testing exceptions may apply; check the actual Console requirements before submission.

Official references:
- https://developers.google.com/workspace/calendar/api/auth
- https://developers.google.com/identity/protocols/oauth2/scopes
- https://support.google.com/cloud/answer/13464321
- https://support.google.com/cloud/answer/13464323
- https://support.google.com/cloud/answer/15549945

## Support and diagnostics

Developer metrics, original Google test, Recognition comparison, Baseline reader, OCR diagnostics, approved payload details, calendar-ID fallback and synthetic deleted-event recovery checks are hidden by default. Open the current page with ?debug=1 to use them. This is a visibility switch, not an authorization boundary. Recovery still requires its explicit consent and is tied to the current calendar connection. Ordinary users receive a simple help message for previously deleted shifts; hiding the test does not bypass the recovery safeguard.

Legacy developer pages remain separate HTML entry points. swap.html remains a compatibility alias for change.html. Recovery/debug tokens and results are not transferred between pages or stored.

## Installation

The web manifest, standalone display, 192/512 icons and offline assets are included. A one-time iPhone hint explains Safari → Share → Add to Home Screen; installed apps do not show it. install.html gives iPhone/Android instructions. Test real installation/standalone OAuth on the target device; build checks do not substitute for those tests.

## Verification

Tests cover OCR/parser baselines, crop geometry, date identity, timezone/DST, duplicate prevention, read-only comparisons, conditional mutations, partial retries, recovery gates, first-time calendar creation, progress feedback, debug visibility, clean navigation, extra shifts, and installation metadata. Night shifts ending on the first Sunday in April/October are checked across both transitions: N can be 13/11 elapsed hours and N10 11/9, while printed clocks remain unchanged. Ambiguous or nonexistent local clock times remain blocked.

Private screenshots/raw pixels must never be committed. Automated calendar tests use in-memory synthetic data. Real Google creation/saves, recovery and device installs still require account/device testing.


## Screenshot robustness (v0.26)

The verified full-week reader remains the default. Grid pitch uses the observed card size and the full seven-day span rather than the whole image width or a rounded adjacent-column distance. This supports wide margins and fractional pixel pitches after resizing.

Screenshot preparation offers explicit left/right rotation without assuming landscape images are sideways. Automatic crops keep the original image available for high-resolution text crops. Crops through a detected shift are blocked; omitted whole cards and missing grid boundaries are flagged as partial. Partial grids require the user to confirm the first visible weekday and one exact shift date. Partial imports cannot remove other calendar shifts, including through the comparison API.

Only uncertain labels, days, hours and heading crops receive an additional size-normalised OCR retry. Conflicting readings remain flagged for review; upscaling cannot recover missing source detail. No automatic date guesses are made from the current date.

See [the fixture guide](tests/fixtures/README.md) for local-only screenshot preparation, the optional layout benchmark, and real-device acceptance checks. The normal test suite includes generated layout variants, crop safety, rotation geometry and partial-date/removal safeguards. The private screenshot benchmark measures layout detection only, separately from date/time/label OCR and real iPhone/Pixel checks.
