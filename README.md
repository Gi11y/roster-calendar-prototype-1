# Roster Calendar — Prototype 1

Standalone static TypeScript/Vite PWA. Tests the Google Identity Services **token client** (popup flow), creation of a secondary **Roster** calendar, and insertion of one synthetic event. Follows `roster_calendar_phase1_plan_v2.md` §11 item 1. **Not the complete roster app.**

## Prerequisites

- Node.js 22.18+ (or Node 24) and npm, Git, a GitHub account, and a personal Google account.
- No backend, OAuth secret, service account, purchased Apple developer account, or server required.
- The web OAuth **Client ID is public**. Never commit a client secret or access token.

## 1. Set up Google Cloud

1. Open https://console.cloud.google.com/ and make a new project, such as **Roster Calendar Test**.
2. In **APIs & Services > Library** search for **Google Calendar API** and click **Enable**.
3. Open **Google Auth platform > Branding** (or **Get Started**). Set app name (e.g., **Roster Calendar Test**), support email and developer contact email.
4. In **Google Auth platform > Audience**, choose **External**, set publishing status **Testing**, add your personal Gmail address to **Test users**. Do not publish to Production for this test.
5. In **Google Auth platform > Data Access**, add exactly `https://www.googleapis.com/auth/calendar.app.created`. Do not add `calendar` or `calendar.events` or `calendar.calendarlist.readonly` for prototype 1.
6. Open **Google Auth platform > Clients > Create client**. Choose **Web application**, name **Roster PWA Web Client**.
7. Under **Authorized JavaScript origins**, add `http://localhost:5173` for development and `https://YOUR_GITHUB_USERNAME.github.io` for GitHub Pages (NO repository path, NO trailing slash). These are two separate entries.
8. For **Authorized redirect URIs**, leave empty. GIS token popup flow does not use a redirect URL in this app.
9. Save and copy the **Client ID** ending `.apps.googleusercontent.com`. No client secret is needed.

**Important:** An External Testing consent screen shows a Google unverified/test warning on first authorisation. Only explicitly listed test users can authorise; limit is 100. If a scope approval screen offers a permission checkbox, approve the requested calendar scope. Do not proceed if the requested scope seems broader.

## 2. Local development

```sh
npm ci
# PowerShell: Copy-Item .env.example .env.local
cp .env.example .env.local
# Edit .env.local and replace the sample with your real OAuth Web Client ID.
npm run dev
```

Open `http://localhost:5173` **on your development computer**. iPhone cannot reach your computer's localhost; for iPhone tests, use the deployed HTTPS GitHub Pages URL.

You will see three steps. **First tap** Prepare Google sign-in, which fetches the Google GIS script. **Second tap** Connect Google account, which must directly invoke the popup from the user gesture. Then click **Create Roster calendar**, followed by **Insert test event**. The test is Tuesday **3 November 2026 12:00–12:30 Australia/Sydney**. It is not a genuine roster shift. Open the event link or verify it via Google Calendar's calendar list.

## 3. GitHub Pages deployment (free)

1. Create a **public** GitHub repository named `roster-calendar-prototype-1` (or another name), without automatically adding a README.
2. In this project directory:

```sh
git init
git add .
git commit -m "Prototype 1: GIS and Calendar smoke test"
git branch -M main
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/roster-calendar-prototype-1.git
git push -u origin main
```

3. In GitHub repository **Settings > Secrets and variables > Actions > Variables**, add a *repository variable* called `VITE_GOOGLE_CLIENT_ID` with your OAuth Web Client ID (public; no secret). The workflow embeds this ID into the static JavaScript at build time. Do not add any client secret.
4. In **Settings > Pages > Build and deployment**, choose **GitHub Actions** as the source.
5. Open **Actions > Deploy prototype to GitHub Pages**, trigger **Run workflow** if needed (or push another commit). Verify the build and deployment succeed.
6. Open `https://YOUR_GITHUB_USERNAME.github.io/roster-calendar-prototype-1/`. The GitHub Actions build sets Vite `base` to the repository path automatically; do not append the repo name to the Google authorised **origin**.
7. The site's repository name must match the deployed repository; if renamed, push a new build. **Site origin** is `https://YOUR_GITHUB_USERNAME.github.io` even though the web app is served at `/roster-calendar-prototype-1/`.

The archive includes `package-lock.json`. CI uses `npm ci`, unit tests, the production build and production artifact checks. For local production checks:

```powershell
npm test
$env:GITHUB_REPOSITORY = "YOUR_GITHUB_USERNAME/roster-calendar-prototype-1"
npm run build
npm run test:production
npm run preview
```

Open `http://localhost:4173/roster-calendar-prototype-1/`. Add `http://localhost:4173` as an OAuth authorised JavaScript origin if testing OAuth in preview. The production artifact check reads the configured base from the generated HTML. Remove the environment variable for ordinary local development: `Remove-Item Env:GITHUB_REPOSITORY`.

## 4. iPhone Safari and home-screen acceptance test

On the iPhone, use the **same personal Google account listed as a Test user**.

1. In Safari, visit the GitHub Pages URL. The diagnostics should display **Browser tab**.
2. Click Prepare Google sign-in and then Connect Google account. Allow browser popups if prompted. Grant the sole requested calendar scope. **PASS** if the page reports `Google token received ... scope granted`. **FAIL** if popup is blocked, closes without returning a token, returns `origin_mismatch`, `access_denied`, etc.; capture the exact message.
3. Click Create Roster calendar **once**; confirm a new **Roster** secondary calendar exists in Google Calendar and the app shows an IndexedDB calendar ID. **PASS** if both checks match. Reload and confirm the same calendar ID appears, and the Create button is disabled (rather than creating duplicates). **FAIL** if creation failed or ID was lost.
4. Click Insert test event **once**; verify **Roster Prototype 1 Test** at **12:00–12:30 on 3 Nov 2026** in the dedicated Roster calendar. **PASS** if it's in that secondary calendar, not the primary. **FAIL** if an API error appears or the event is missing/has wrong times.
5. In Safari: Share > **Add to Home Screen** > Add. Launch via the new icon (not by returning to Safari). Diagnostics must say **Home-screen standalone**. It may have a separate IndexedDB store from Safari.
6. Repeat Prepare > Connect. **PASS** if the standalone flow returns the Google token. **FAIL** if popup fails (e.g. `popup_failed_to_open`, `popup_closed`). This failure is a significant result: use Safari for sync unless further testing proves a safe standalone approach.
7. If standalone has **no stored calendar ID**, do **not** click Create again just to test sign-in: it could create a duplicate Roster calendar. The recovery problem is explicitly reserved for prototype 3. If standalone does have the ID, test inserting one event there (note: the button creates a new test event each time).
8. Also verify an offline relaunch displays the app shell, but **authentication and Calendar API writes are not expected to work offline**. This prototype does not include OCR assets.

**Record results:** iOS version, browser/home-screen mode, date, whether popup opened, whether token returned, whether calendar was created, whether event was inserted, and exact error text if a step fails. Screen capture the failure where possible, but never capture the access token.

## Security and data handling

- Token exists only in a module-scoped JS variable, cleared before reconnection, on pagehide, and one minute before reported expiry; never IndexedDB/localStorage/sessionStorage.
- IndexedDB stores only the Google secondary calendar ID. The PWA service worker caches only this app's own static files; it does not cache Google responses, OAuth tokens or APIs.
- Google GIS script is requested only after a user action. Browsing the shell before that does not call Google.
- No screenshots, roster information, analytics or external OCR.
- Network access to Google is necessary for token and calendar operations. A meta Content-Security-Policy restricts scripts and connections to this origin and the necessary Google endpoints. Its compatibility with live GIS still requires the acceptance tests; GitHub Pages does not provide custom per-repository response headers.
- The same Calendar ID cannot necessarily be used by a different account. If you switch Google accounts, the event step may return 403/404. This prototype does not yet identify or recover accounts/calendars.
- Prototype 1 deliberately uses an automatically allocated Google event ID; deterministic IDs and reconciliation are implemented and tested later, according to architecture §6 and prototype §11 items 3–4.
- If the calendar creation call succeeds but saving to IndexedDB fails, the app warns you to check Google Calendar before retrying. Recovering IDs is a separate test.

## Troubleshooting

| Symptom | Likely cause / action |
|---|---|
| `origin_mismatch` | Check OAuth Web Client authorised origin. Exact scheme/domain/port, no path. |
| `access_denied` / app unavailable | Add the signing-in Gmail to the External Testing test-users list and verify consent. |
| Button disabled; setup required | Set local `.env.local` or GitHub Actions variable, redeploy. |
| Popup failed to open | Confirm two distinct taps; try ordinary Safari, turn off popup blockers and record the result. |
| `403` Calendar API | Check API enabled, grant included required scope and signed-in account. |
| `404` on insert | Saved calendar ID may belong to a different account or calendar was deleted. Do not blindly recreate. |
| Blank GitHub page / 404 for assets | Check repo-path Vite base and workflow deploy status. |
| Duplicate Roster calendars | Safari and standalone may have separate IndexedDB stores. Stop, note the IDs, and test recovery in prototype 3. |

## Docs

- GIS token model: https://developers.google.com/identity/oauth2/web/guides/use-token-model
- Calendar scope: https://developers.google.com/workspace/calendar/api/auth
- Calendars insert: https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert
- Events insert: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- GitHub Pages with Vite: https://vite.dev/guide/static-deploy

## Verification delivered with this archive

See VALIDATION.md for executed checks and remaining device/account tests. The original architecture plan is included unchanged. Prototype 1 does not implement OCR, parsing, real shifts, deterministic event reconciliation, calendar recovery or deleted-ID reuse; these remain later prototypes. No shift hours or roster layout were assumed.

Wait until the service worker is activated, reload online once, then test offline shell launch. A service-worker registration message alone is not proof of offline readiness. Updates take effect after old app windows close; this avoids mixing old HTML with new assets.

If a create request loses its response, its outcome is uncertain: check Google Calendar before retrying. Do not retry calendar creation blindly. Use the same account on reconnect: account identification/recovery is deliberately deferred. Repeated event clicks create multiple synthetic events; remove them manually in Google Calendar after testing.
