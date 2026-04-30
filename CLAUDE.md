# CLAUDE.md — image-capture

## Status
- **State:** Shipped
- **Next action:** Replicate title-server and setimage patterns in citation-capture as the next sister project.
- **Last updated:** 2026-04-28

## What this repo is

Two-part image pipeline for Owen's Substack content workflow:

1. **Bookmarklet** (`bookmarklet.js`) — runs in browser, scrapes og:image + metadata, logs to Google Sheet via Apps Script, downloads image to `~/Downloads/` with camelCase filename
2. **Watch script** (`watch-images.py`) — background daemon, monitors `~/Downloads/`, routes camelCase images to the correct series folder under `~/dev/wraith/substack-ideas/`

## Key file locations

| File | Purpose |
| ---- | ------- |
| `bookmarklet.js` | Readable source — minify via `npm run deploy` before installing |
| `Code.gs` | Google Apps Script — must be manually deployed at script.google.com after changes |
| `watch-images.py` | Watchdog daemon — installed to `~/.local/bin/watch-images` |
| `image-title-server.py` | Serves `~/.image-watch-title` on port 9876 — installed to `~/.local/bin/image-title-server` |
| `setimage.sh` | Updates `~/.image-watch-config` and `~/.image-watch-title` — aliased as `setimage` in shell |
| `deploy.sh` | Minifies bookmarklet to clipboard, installs scripts, restarts services |
| `image-watch.service` | systemd unit for watch-images |
| `image-title-server.service` | systemd unit for title server |

## Series folder structure

Series live at `~/dev/wraith/substack-ideas/{series}-series/` — e.g. `water-series/`, not `series-water/`.

Images route to `{series}-series/images/` with subdirectory routing:
- `-crop-` in filename → `images/covers/` (or `images/tables/` if `-crop-table`)
- `-anim-` in filename → `images/animations/`
- Otherwise → `images/` root
- If PART is set and a matching `part-NN-*` folder exists → routes into it

## Config files (not committed)

- `~/.image-watch-config` — `SERIES=water` / `PART=09`
- `~/.image-watch-title` — plain text title string, e.g. `Part IX — The Global Water–Energy–Transport Corridors`

## Title server

The bookmarklet can't read local files, so `image-title-server.py` runs on port 9876 and serves `~/.image-watch-title`. The bookmarklet fetches it before logging to Apps Script and passes it as `postTitle` — populates column F of the sheet. Gracefully falls back to empty string if server is down.

## Deploy workflow

```bash
# After any code change:
npm run deploy
# → bookmarklet minified and on clipboard (paste into Chrome bookmark)
# → watch-images.py and image-title-server.py copied to ~/.local/bin/
# → both systemd services restarted

# After Code.gs changes:
# Go to script.google.com → Deploy → Manage deployments → New version
# Same URL — no bookmarklet update needed
```

## setimage usage

```bash
setimage water 09     # routes images + sets title to Part IX
setimage cng 06       # CNG Part VI
setimage water        # series-level, no part routing
```

Title mappings for water (01–11) and CNG (01–06) are hardcoded in `setimage.sh`.

## Google Sheet columns

| Col | Content |
| --- | ------- |
| A | Timestamp |
| B | camelCase image name |
| C | Source URL |
| D | Photographer (from Pexels/Unsplash API — may differ from bookmarklet alert) |
| E | License |
| F | Substack post title (from `~/.image-watch-title` via title server) |
| G | Attribution string |

## Credentials (in Apps Script Properties — never in code)

- `SECRET_TOKEN` — bookmarklet auth token
- `UNSPLASH_ACCESS_KEY`
- `PEXELS_ACCESS_KEY`
- `SHEET_ID`
