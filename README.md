# Image Attribution Logger

**Stop leaving images out of your articles because you forgot where you found them.**

The Image Attribution Logger is a two-part pipeline that captures image metadata and routes files to the right place — at the exact moment you find the image.

- **Takes 2 seconds** to log an image (one click)
- **Runs on Google's free serverless infrastructure** (zero cost, zero maintenance)
- **Your data stays private** in your own Google Sheet
- **Works with Unsplash, Pexels, Pixabay** and falls back gracefully for other sources

Built for Substack writers, bloggers, and content creators who care about proper attribution but hate manual tracking.

## Why This Works (And Why It's Free Forever)

This tool uses **Google Apps Script as a free serverless endpoint** - something most web developers don't even know exists.

- **Zero infrastructure costs** - Google hosts your endpoint for free
- **No backend to maintain** - Apps Script handles everything
- **Scales automatically** - Google's infrastructure, your personal use
- **Each user gets their own instance** - Your data stays in your Google Sheet, completely private

As a longtime web developer, I had no idea you could create free HTTP endpoints like this. Now you know too.

## Full Pipeline

```text
[Browser Bookmarklet]
       ↓ (click on image page)
[Captures og:image URL + page metadata]
       ↓ (GET request)
[Google Apps Script endpoint — free, hosted by Google]
       ↓ (API lookup for photographer)
[Google Sheet — attribution row logged]
       ↓ (forwarded to D1 ledger — POST /captures/image)
[Cloudflare D1 ledger — source of truth for the OAT image panel]
       ↓ (meanwhile: blob download)
[~/Downloads/camelCaseName.ext]
       ↓ (watch-images.py detects new file)
[~/dev/oat-assets/[section]/[imageStem]/]
```

**Part 1 — Bookmarklet (capture):** logs metadata to Google Sheet, forwards the capture to the D1 ledger, and downloads the image to `~/Downloads/` with a camelCase filename.

**Part 2 — Watch script (route):** background daemon picks up the download and moves it to the correct section folder automatically.

**Part 3 — Ledger mirror (sync):** the D1 ledger (a Cloudflare Worker, see `oat-tools/tools/d1/`) is the source of truth for staging and placement state; an hourly Apps Script trigger (`syncFromLedger`) mirrors it back into the Sheet, so the Sheet stays a human-readable view.

## System Components

| Component | Function | Notes |
|-----------|----------|-------|
| Google Sheet | Central database for logging attribution and tracking post titles. | Sheet Name: Sheet1 (Must match the tab name exactly) |
| Apps Script | Web App endpoint that receives the request and writes data to the Sheet. | Logic runs in the doGet(e) function. |
| Bookmarklet | Client-side JS to scrape data, format it, and initiate the request. | Optimized for major image sources (Unsplash, Pexels, Pixabay). |
| watch-images.py | Background daemon that routes camelCase downloads to the correct series folder. | Reads ~/.image-watch-config for active series. |
| setimage.sh | Shell script to update the active series/part config. | Alias as `setimage` in your shell. |
| setpublished.sh | Appends a published-article row to `oat-content/content-inventory.md`. | `setpublished "<title>" "<url-or-slug>" [series] [part] [date]` |
| image-title-server.py | Serves the active post title (`~/.image-watch-title`) on port 9876. | Written by `setimage`. |
| D1 ledger Worker | Source of truth for staging/placement state; mirrored back to the Sheet hourly. | Lives in `oat-tools/tools/d1/`. |

## Deploying Changes

After editing the bookmarklet or watch scripts, run:

```bash
npm run deploy
```

This will:

1. Inject your `SECRET_TOKEN` from the gitignored `.credentials` file, minify `bookmarklet.js`, and copy the result to your clipboard — paste into your bookmark URL field
2. Copy `watch-images.py`, `image-title-server.py`, and `setpublished.sh` to `~/.local/bin/`
3. Restart both systemd services

It fails loudly if `.credentials` is missing — paste your `SECRET_TOKEN` there first.

## Watch Script Setup

### 1. Install the script

```bash
cp ~/dev/image-capture/watch-images.py ~/.local/bin/watch-images
chmod +x ~/.local/bin/watch-images
```

### 2. Set your active series

```bash
# Copy the template config
cp ~/dev/image-capture/.image-watch-config.template ~/.image-watch-config

# Then update it any time with:
setimage baja-water-spine 03
```

Add the alias to your shell (`~/.zshrc` or `~/.bashrc`):

```bash
alias setimage="$HOME/dev/image-capture/setimage.sh"
```

### 3. Enable the systemd service

```bash
mkdir -p ~/.config/systemd/user
cp ~/dev/image-capture/image-watch.service ~/.config/systemd/user/image-watch.service
systemctl --user daemon-reload
systemctl --user enable --now image-watch
```

Verify it's running:

```bash
systemctl --user status image-watch
```

Common commands:

```bash
systemctl --user start image-watch      # start
systemctl --user stop image-watch       # stop
systemctl --user restart image-watch    # restart after code changes
systemctl --user disable image-watch    # stop and don't start on login
systemctl --user enable --now image-watch  # re-enable and start
```

### File routing

Routing is controlled by `~/.image-watch-config`:

```text
SECTION=water-series/part-09
```

| Config | Destination |
| ------ | ----------- |
| `SECTION=water-series/part-09` | `~/dev/oat-assets/water-series/part-09/[imageStem]/` |
| `SECTION=water-series` | `~/dev/oat-assets/water-series/[imageStem]/` |
| `SECTION=cng-series/part-06` | `~/dev/oat-assets/cng-series/part-06/[imageStem]/` |

Each image gets its own folder named after the file stem, alongside provenance sidecar files (`url.txt`, `license.txt`, `photographer.txt`) when capture metadata is available.

Files that do **not** match camelCase (e.g. `Screenshot 2026-04-17.png`, `unsplash-abc123.jpg`) are silently ignored.

Update the active section at any time — no restart needed:

```bash
setimage water 9      # → SECTION=water-series/part-09
setimage water        # → SECTION=water-series
```

`setimage` also writes the matching post title to `~/.image-watch-title`, which `image-title-server` serves on port 9876. Moves are logged to `~/.image-watch.log`.

## 🔒 Security Setup (5 minutes, protects your data)

**Why you need this:** Your Web App URL is like a front door. Without a password (the secret token), anyone who finds it could spam your Google Sheet. This step adds that password.

**Don't worry if this sounds technical** - it's just copy-paste. Takes 5 minutes.

### Setting Up Security

#### 1. Generate a Secret Token

- Create a random string (e.g., `xK9mP2nQ8rT5vL3w`)
- You can use a password generator or just type random characters

#### 2. Add Security Credentials to Apps Script Properties

- In the Apps Script Editor, click the **gear icon** (Project Settings)
- Scroll to **Script Properties** → Click **"Add script property"**
- Add these three properties:

| Property Name | Value | Where to Get It |
|--------------|-------|-----------------|
| `SECRET_TOKEN` | `[your random string]` | Generate a random 16+ character string (`openssl rand -hex 20`) |
| `SHEET_ID` | `[your Google Sheet ID]` | From the sheet URL: `docs.google.com/spreadsheets/d/[THIS_PART]/edit` |
| `UNSPLASH_ACCESS_KEY` | `[your Unsplash API key]` | https://unsplash.com/developers |
| `PEXELS_ACCESS_KEY` | `[your Pexels API key]` | https://www.pexels.com/api/ |
| `LEDGER_API_URL` | `[your ledger Worker URL]` | Optional — D1 ledger base URL (see `oat-tools/tools/d1/`) |
| `LEDGER_API_TOKEN` | `[the Worker's bearer token]` | Optional — the Worker's `LEDGER_API_TOKEN` secret |

- Click **"Save script properties"**

If `LEDGER_API_URL` is unset, ledger forwarding and `syncFromLedger()` are simply skipped — sheet logging works standalone.

After generating `SECRET_TOKEN`, also paste it into `.credentials` in this repo (gitignored) — `deploy.sh` injects it into the bookmarklet at build time so the real token never appears in committed code.

## Sheet Structure

This is the required column order in your Google Sheet (starting from Column A).

| Col | Header Name | Data Source | Notes |
|-----|-------------|-------------|-------|
| A | Timestamp | `new Date()` | Automatically generated by the script. |
| B | Name | Page Title (CamelCase) | Generated using `toCamelCase()` from the page title. |
| C | Source URL | `document.location.href` | Direct URL of the image source page. Upsert key for the ledger mirror. |
| D | Photographer | Scraped / Fallback | Attempts to find photographer (e.g., Unsplash /@[user]), defaults to 'UNKNOWN'. |
| E | License | Logic-based | 'CC0 Equivalent (No Attribution)' for known free sites; otherwise 'MANUAL CHECK REQUIRED'. |
| F | Substack Post Title | Title server | The active post title captured at log time (see `image-title-server`). |
| G | Attribution String | Constructed | The final formatted string ready for publication. |
| H | status | Ledger mirror | `staged` at capture; refreshed hourly from the D1 ledger. |
| I | placed_in | Ledger mirror | Draft the image was placed into. |
| J | placed_date | Ledger mirror | Date the placement happened. |
| K | target | Ledger mirror | `substack`, `carousel`, `linkedin-post`, … |
| L | image_src | Bookmarklet | Direct CDN URL for thumbnail previews. |

Columns H–K are owned by `syncFromLedger()` (an hourly time-driven Apps Script trigger): it refreshes them from the D1 ledger for every row it recognizes by Source URL, appends rows for ledger assets the sheet lacks, and leaves unrecognized (pre-ledger) rows untouched.

## Apps Script Code (Code.gs)

The deployed Web App code lives in [Code.gs](Code.gs) — paste the whole file into the Apps Script editor whenever it changes, then deploy a new version (next section). It provides:

- `doGet(e)` — verifies the token, looks up photographer metadata from the provider APIs, appends the sheet row, and forwards the capture to the D1 ledger (best-effort: a ledger outage never breaks sheet logging)
- `syncFromLedger()` — the hourly ledger→sheet mirror; wire it to a time-driven trigger (clock icon → Add Trigger → `syncFromLedger` → Time-driven → Hour timer)

## Deploying the Web App

#### 1. Save your Code.gs file

#### 2. Deploy as Web App

- Click **Deploy → New deployment**
- Click the gear icon → Select **Web app**
- Configure:
  - **Description:** Image Attribution Logger
  - **Execute as:** Me
  - **Who has access:** Anyone
- Click **Deploy**
- **Copy the Web App URL** - you'll need this for the bookmarklet

#### 3. If you update the code later

- Go to **Deploy → Manage deployments**
- Click the pencil icon to edit
- Change version to **"New version"**
- Click **Deploy**

### 📌 Important: This Is Your Personal Instance

When you deploy this, you're creating **your own private endpoint** that writes to **your own Google Sheet**. 

**For individual use:**
- Each person deploys their own instance
- Your data stays completely private in your sheet

**For team use (experimental):**
- Theoretically, one person could deploy and share the Web App URL + token with teammates
- Everyone would write to the same shared Google Sheet
- This *should* work, but I haven't tested it extensively
- If you try this with your team, let me know if it works!

Think of it like everyone building their own personal API, for free - or optionally sharing one API across a team.

## Bookmarklet Code

The readable source is [bookmarklet.js](bookmarklet.js). The committed file carries a `YOUR_SECRET_TOKEN_HERE` placeholder — the real token lives in the gitignored `.credentials` file and is injected at build time:

```bash
npm run deploy
```

This minifies the bookmarklet with your token baked in and copies the result to your clipboard — paste it into your bookmark's URL field. Never paste the real token into the committed source.

### Installing the Bookmarklet

**Browser compatibility:** Built and tested in Chrome. Should work in other browsers, but not tested. Let me know if you try it elsewhere!

### 💡 For Non-Developers

If you've never edited a bookmark's URL before, here's what "paste the bookmarklet code" means:

1. Right-click your bookmarks bar → "Add page" or "Add bookmark"
2. In the "Name" field: `📸 Log Image`
3. In the "URL" field: Delete everything and paste the bookmarklet code (after replacing YOUR_WEB_APP_URL_HERE and YOUR_SECRET_TOKEN_HERE)
4. Click Save

That's it. The bookmark is now a tiny program that runs when you click it.

### Using the Bookmarklet

1. Navigate to an image page (Unsplash, Pexels, or Pixabay)
2. Click your "📸 Log Image" bookmark
3. The bookmarklet logs the row to your Google Sheet **and** downloads the image automatically
4. You'll see a success alert confirming both actions
5. The file lands in your default Downloads folder as `camelCaseName.ext`

## ⚠️ Security Reminders

- **Never commit real API keys or tokens to GitHub** - always use placeholders like `YOUR_SECRET_TOKEN_HERE`
- **Keep your Script Properties private** - they're stored securely in Google Apps Script
- **Regenerate tokens if exposed** - if you accidentally share your token, generate a new one and update both Script Properties and your bookmarklet
- **Your Sheet ID can be public** if your Google Sheet permissions are set to private (which they should be)

## How It Works

1. **Bookmarklet** scrapes the page title, URL, photographer, and `og:image` URL from the page DOM
2. **GET request** sends the metadata (with your secret token) to your Web App URL
3. **Apps Script** verifies the token, fetches additional photographer data from APIs if available, formats the attribution string, and appends a row to your Google Sheet
4. **Ledger forward** — Apps Script also POSTs the capture to the D1 ledger Worker (best-effort; a ledger outage never blocks sheet logging)
5. **Image download** — after the sheet request fires, the bookmarklet fetches the `og:image` as a blob and triggers a browser download named `camelCaseName.ext` (extension detected from the image URL; defaults to `.jpg`)
6. **Success alert** confirms both: sheet row logged ✓ and image downloaded ✓
7. **Hourly**, the `syncFromLedger` trigger mirrors ledger state (status, placements) back into the Sheet's H–K columns

---

Built with ❤️ for content creators who care about proper attribution