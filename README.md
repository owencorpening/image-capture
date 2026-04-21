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
       ↓ (blob download)
[~/Downloads/camelCaseName.ext]
       ↓ (watch-images.py detects new file)
[~/dev/wraith/substack-ideas/series-[name]/images/]
```

**Part 1 — Bookmarklet (capture):** logs metadata to Google Sheet and downloads the image to `~/Downloads/` with a camelCase filename.

**Part 2 — Watch script (route):** background daemon picks up the download and moves it to the correct series folder automatically.

## System Components

| Component | Function | Notes |
|-----------|----------|-------|
| Google Sheet | Central database for logging attribution and tracking post titles. | Sheet Name: Sheet1 (Must match the tab name exactly) |
| Apps Script | Web App endpoint that receives the request and writes data to the Sheet. | Logic runs in the doGet(e) function. |
| Bookmarklet | Client-side JS to scrape data, format it, and initiate the request. | Optimized for major image sources (Unsplash, Pexels, Pixabay). |
| watch-images.py | Background daemon that routes camelCase downloads to the correct series folder. | Reads ~/.image-watch-config for active series. |
| setimage.sh | Shell script to update the active series/part config. | Alias as `setimage` in your shell. |

## Deploying Changes

After editing the bookmarklet or watch scripts, run:

```bash
npm run deploy
```

This will:

1. Minify `bookmarklet.js` and copy the result to your clipboard — paste into your bookmark URL field
2. Copy `watch-images.py` and `image-title-server.py` to `~/.local/bin/`
3. Restart both systemd services

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

```
SERIES=water
PART=09
```

| Config | Destination |
| ------ | ----------- |
| `SERIES=water`, `PART=09` | `water-series/part-09/images/` |
| `SERIES=water` (no PART) | `water-series/images/` |
| `SERIES=cng`, `PART=06` | `cng-series/part-06/images/` |

All matching files land flat in the images directory — no subdirectories. File type is signaled by the filename itself (e.g. `bajaMap-crop-1080x1080.jpg`).

Files that do **not** match camelCase (e.g. `Screenshot 2026-04-17.png`, `unsplash-abc123.jpg`) are silently ignored.

Update the active series/part at any time — no restart needed:

```bash
setimage water 09
```

Moves are logged to `~/dev/wraith/substack-ideas/image-watch.log`.

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
| `SECRET_TOKEN` | `[your random string]` | Generate a random 16+ character string |
| `UNSPLASH_ACCESS_KEY` | `[your Unsplash API key]` | https://unsplash.com/developers |
| `PEXELS_ACCESS_KEY` | `[your Pexels API key]` | https://www.pexels.com/api/ |

- Click **"Save script properties"**

#### 3. Get Your Google Sheet ID

- Open your Google Sheet
- Copy the ID from the URL: `https://docs.google.com/spreadsheets/d/[THIS_IS_YOUR_SHEET_ID]/edit`

## Sheet Structure

This is the required column order in your Google Sheet (starting from Column A).

| Col | Header Name | Data Source | Notes |
|-----|-------------|-------------|-------|
| A | Timestamp | `new Date()` | Automatically generated by the script. |
| B | Name | Page Title (CamelCase) | Generated using `toCamelCase()` from the page title. |
| C | Source URL | `document.location.href` | Direct URL of the image source page. |
| D | Photographer | Scraped / Fallback | Attempts to find photographer (e.g., Unsplash /@[user]), defaults to 'UNKNOWN'. |
| E | License | Logic-based | 'CC0 Equivalent (No Attribution)' for known free sites; otherwise 'MANUAL CHECK REQUIRED'. |
| F | Substack Post Title | `''` | Left blank for manual entry later. |
| G | Attribution String | Constructed | The final formatted string ready for publication. |

## Apps Script Code (Code.gs)

This code runs as the deployed Web App, listening for `GET` requests and appending rows to the sheet. This block should be saved as your `Code.gs` file in the Apps Script Editor.

```javascript
const SHEET_ID = 'YOUR_SHEET_ID_HERE'; // Replace with your actual Sheet ID
const SHEET_NAME = 'Sheet1'; // ***CRITICAL: MUST MATCH THE TAB NAME***

// --- LOAD API KEYS FROM SCRIPT PROPERTIES (SECURE) ---
const UNSPLASH_ACCESS_KEY = PropertiesService.getScriptProperties().getProperty('UNSPLASH_ACCESS_KEY');
const PEXELS_ACCESS_KEY = PropertiesService.getScriptProperties().getProperty('PEXELS_ACCESS_KEY');
const SECRET_TOKEN = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
// ------------------------------------------------------

/**
 * Helper to convert camelCase to Human Readable Title Case.
 */
function toTitleCase(camel) {
  return camel
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, str => str.toUpperCase());
}

/**
 * Fetches the author name from the Pexels API.
 */
function fetchPexelsAuthor(imageID) {
  const apiUrl = `https://api.pexels.com/v1/photos/${imageID}`;
  const options = {
    headers: {
      'Authorization': PEXELS_ACCESS_KEY
    }
  };
  
  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const data = JSON.parse(response.getContentText());
    if (data.photographer) {
      return data.photographer;
    }
  } catch (e) {
    Logger.log("Pexels API fetch failed: " + e.toString());
  }
  return "UNKNOWN";
}

/**
 * Fetches the author name from the Unsplash API.
 */
function fetchUnsplashAuthor(imageID) {
  const apiUrl = `https://api.unsplash.com/photos/${imageID}?client_id=${UNSPLASH_ACCESS_KEY}`;
  
  try {
    const response = UrlFetchApp.fetch(apiUrl);
    const data = JSON.parse(response.getContentText());
    if (data.user && data.user.name) {
      return data.user.name;
    }
  } catch (e) {
    Logger.log("Unsplash API fetch failed: " + e.toString());
  }
  return "UNKNOWN";
}

/**
 * Handles incoming GET requests from the custom bookmarklet.
 */
function doGet(e) {
  // 🔒 Security: Verify the request has the correct token
  if (e.parameter.token !== SECRET_TOKEN) {
    return ContentService.createTextOutput("Unauthorized");
  }
  
  const data = e.parameter;
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  
  // 1. Define the variables and attempt server-side author lookup
  const name = data.name;
  let photographer = "UNKNOWN"; // Start with UNKNOWN, then try APIs
  const license = data.license;
  const url = data.url;
  
  // 1a. SERVER-SIDE ENHANCEMENT: API Lookup
  if (url.includes('unsplash.com/photos/')) {
    const urlParts = url.split('/');
    const imageID = urlParts[urlParts.length - 1].split('?')[0];
    photographer = fetchUnsplashAuthor(imageID);
  } else if (url.includes('pexels.com/photo/')) {
    // ROBUST PEXELS ID EXTRACTION: Use the last path segment (which is the ID)
    const urlParts = url.split('/');
    // Get the last segment (e.g., 1234567) and remove any query strings
    const imageID = urlParts[urlParts.length - 1].split('?')[0];
    // Check if the ID is found and call the API
    if (imageID) {
      photographer = fetchPexelsAuthor(imageID);
    }
  }
  
  // 2. CONSTRUCT THE ATTRIBUTION STRING
  const cleanName = toTitleCase(name);
  const urlDomainMatch = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im);
  const sourceDomain = urlDomainMatch ? urlDomainMatch[1] : url;
  const attributionString = `Image: ${cleanName}, by ${photographer}, Source: ${sourceDomain}. License: ${license}.`;
  
  // 3. Define the final row data for columns A through G
  const rowData = [
    new Date(),        // A: Timestamp
    name,              // B: Name (camelCase)
    url,               // C: Source URL
    photographer,      // D: Photographer (from API or UNKNOWN)
    license,           // E: License Status
    '',                // F: Substack Post Title (left blank)
    attributionString  // G: Attribution String
  ];
  
  sheet.appendRow(rowData);
  
  return ContentService.createTextOutput("Success");
}
```

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

This is the single line of code you paste directly into your browser's bookmark manager. **Replace the placeholders before using:**

- `YOUR_WEB_APP_URL_HERE` → Your actual Web App URL from the deployment step
- `YOUR_SECRET_TOKEN_HERE` → Your secret token (same one from Script Properties)

```javascript
javascript:void((function(){function toCamelCase(str){str=str.replace(/[^a-zA-Z0-9 ]/g,'').trim();return str.split(/\s+/).map((w,i)=>i==0?w.toLowerCase():w.charAt(0).toUpperCase()+w.slice(1).toLowerCase()).join('');}function getImageUrl(){var og=document.querySelector('meta[property="og:image"]');return og?og.getAttribute('content')||'':'';}function getExt(url){if(!url)return'.jpg';var path=url.split('?')[0].split('#')[0];var m=path.match(/\.(jpe?g|png|webp|gif)$/i);if(m)return'.'+m[1].toLowerCase();var fm=url.match(/[?&]fm=(jpe?g|png|webp|gif)/i);if(fm)return'.'+fm[1].toLowerCase();return'.jpg';}var pageTitle=document.title||'newImage';var suggestedName=toCamelCase(pageTitle);var pageURL=document.location.href;var photographer='';var authorElement=document.querySelector('a[rel="author"],a[itemprop="author"] span,[data-testid*="photographer"],a[href^="/@"]');if(authorElement){photographer=authorElement.innerText.trim();}if(!photographer){var photoBy=document.querySelector('[class*="photographer"],[class*="author"]');if(photoBy&&photoBy.innerText.includes('by')){photographer=photoBy.innerText.replace(/.*by\s/i,'').trim();}}if(!photographer){photographer='UNKNOWN';}var imageLicense='MANUAL CHECK REQUIRED';if(pageURL.includes('pexels.com')||pageURL.includes('pixabay.com')||pageURL.includes('unsplash.com')){imageLicense='CC0 Equivalent (No Attribution)';}var dataToSend={name:suggestedName,url:pageURL,photographer:photographer,license:imageLicense,token:'YOUR_SECRET_TOKEN_HERE'};var webAppURL='YOUR_WEB_APP_URL_HERE';var params=new URLSearchParams(dataToSend).toString();var finalURL=webAppURL+'?'+params;fetch(finalURL,{method:'GET',mode:'no-cors'}).then(function(){var imgUrl=getImageUrl();var ext=getExt(imgUrl);var filename=suggestedName+ext;if(!imgUrl){alert('✅ Sheet row logged ✓\n⚠️ No image found on page — save manually.\n\nName: '+suggestedName+'\nPhotographer: '+photographer+'\nSource: '+pageURL);return;}fetch(imgUrl).then(function(r){return r.blob();}).then(function(blob){var blobUrl=URL.createObjectURL(blob);var a=document.createElement('a');a.href=blobUrl;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(blobUrl);},1000);alert('✅ Logged + Downloaded!\n\nSheet row logged ✓\nImage downloaded as: '+filename+' ✓\n\nPhotographer: '+photographer);}).catch(function(){alert('✅ Sheet row logged ✓\n⚠️ Download failed (CORS) — save the image manually.\n\nName: '+suggestedName+'\nPhotographer: '+photographer);});}).catch(function(error){alert('❌ Error sending data to Google Sheet. Check console.');console.error('Fetch error:',error);});})());
```

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
4. **Image download** — after the sheet request fires, the bookmarklet fetches the `og:image` as a blob and triggers a browser download named `camelCaseName.ext` (extension detected from the image URL; defaults to `.jpg`)
5. **Success alert** confirms both: sheet row logged ✓ and image downloaded ✓

---

Built with ❤️ for content creators who care about proper attribution