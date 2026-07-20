const SHEET_NAME = 'Sheet1';

// --- LOAD FROM SCRIPT PROPERTIES (never hardcode these) ---
const UNSPLASH_ACCESS_KEY = PropertiesService.getScriptProperties().getProperty('UNSPLASH_ACCESS_KEY');
const PEXELS_ACCESS_KEY   = PropertiesService.getScriptProperties().getProperty('PEXELS_ACCESS_KEY');
const SHEET_ID            = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
const SECRET_TOKEN        = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
const LEDGER_API_URL      = PropertiesService.getScriptProperties().getProperty('LEDGER_API_URL');
const LEDGER_API_TOKEN    = PropertiesService.getScriptProperties().getProperty('LEDGER_API_TOKEN');
// ----------------------------------------------------------

function toTitleCase(camel) {
  if (!camel || typeof camel !== 'string') {
    camel = '';
  }
  return camel
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, str => str.toUpperCase());
}

function doGet(e) {
  Logger.log('params: ' + JSON.stringify(e.parameter));

  // Security: reject requests without the correct token
  if (e.parameter.token !== SECRET_TOKEN) {
    Logger.log('token mismatch — received: ' + e.parameter.token);
    return ContentService.createTextOutput("Unauthorized");
  }

  const data = e.parameter;
  const ss   = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);

  const name      = data.name;
  const license   = data.license;
  const url       = data.url;
  const postTitle = data.postTitle || '';
  const imageSrc  = data.imageSrc  || '';
  let photographer = "UNKNOWN";

  // --- LOCAL API FETCH FUNCTIONS ---

  const fetchPexelsAuthor = (imageID) => {
    const apiUrl = `https://api.pexels.com/v1/photos/${imageID}`;
    const options = {
      method: 'get',
      headers: { 'Authorization': PEXELS_ACCESS_KEY }
    };
    try {
      const response = UrlFetchApp.fetch(apiUrl, options);
      const data = JSON.parse(response.getContentText());
      return data.photographer || "UNKNOWN";
    } catch (e) {
      return `PEXELS_ERROR: ${e.toString().substring(0, 50)}...`;
    }
  };

  const fetchUnsplashAuthor = (imageID) => {
    const apiUrl = `https://api.unsplash.com/photos/${imageID}?client_id=${UNSPLASH_ACCESS_KEY}`;
    try {
      const response = UrlFetchApp.fetch(apiUrl);
      const data = JSON.parse(response.getContentText());
      return (data.user && data.user.name) ? data.user.name : "UNKNOWN";
    } catch (e) {
      return `UNSPLASH_ERROR: ${e.toString().substring(0, 50)}...`;
    }
  };

  // --- API LOOKUP ---

  if (url.includes('unsplash.com/photos/')) {
    const urlParts = url.split('/');
    const imageID = urlParts[urlParts.length - 1].split('?')[0].split('#')[0];
    photographer = fetchUnsplashAuthor(imageID);

  } else if (url.includes('pexels.com/photo/')) {
    const pathOnly = url.split('?')[0].split('#')[0];
    const pathAndQuery = pathOnly.split('.com')[1] || pathOnly.split('.co')[1];
    const pathSegments = pathAndQuery.split('/').filter(s => s.length > 0);
    const lastSegment  = pathSegments[pathSegments.length - 1];

    if (lastSegment) {
      const idMatch = lastSegment.match(/(\d+)$/);
      if (idMatch && idMatch[1]) {
        photographer = fetchPexelsAuthor(idMatch[1]);
      } else {
        photographer = "PEXELS_ID_SLUG_FAIL";
      }
    } else {
      photographer = "PEXELS_ID_PATH_FAIL";
    }
  }

  // --- BUILD AND APPEND ROW ---

  const cleanName = toTitleCase(name);
  const urlDomainMatch = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im);
  const sourceDomain   = urlDomainMatch ? urlDomainMatch[1] : url;
  const attributionString = `Image: ${cleanName}, by ${photographer}, Source: ${sourceDomain}. License: ${license}.`;

  const rowData = [
    new Date(),          // A: Timestamp
    name,                // B: camelCase name
    url,                 // C: Source URL
    photographer,        // D: Photographer
    license,             // E: License
    postTitle,           // F: Substack post title (from ~/.image-watch-title)
    attributionString,   // G: Attribution string
    'staged',            // H: status — immediately visible in OAT image panel
    '',                  // I: placed_in
    '',                  // J: placed_date
    '',                  // K: target
    imageSrc             // L: image_src — direct CDN URL for thumbnail preview
  ];

  sheet.appendRow(rowData);

  // Forward the capture to the D1 ledger (source of truth for the OAT image
  // panel). Best-effort: a ledger outage must never break sheet logging.
  forwardToLedger({
    name: name,
    displayName: cleanName,
    sourceUrl: url,
    photographer: photographer,
    license: license,
    imageSrc: imageSrc,
    intakeSection: postTitle
  });

  return ContentService.createTextOutput("Success");
}

function forwardToLedger(capture) {
  if (!LEDGER_API_URL) return;
  try {
    UrlFetchApp.fetch(LEDGER_API_URL.replace(/\/$/, '') + '/captures/image', {
      method: 'post',
      contentType: 'application/json',
      headers: LEDGER_API_TOKEN ? { 'Authorization': 'Bearer ' + LEDGER_API_TOKEN } : {},
      payload: JSON.stringify(capture),
      muteHttpExceptions: true
    });
  } catch (e) {
    Logger.log('ledger forward failed: ' + e.toString());
  }
}

/**
 * Mirror the D1 ledger into the sheet. Run on a time-driven trigger (hourly).
 *
 * Upserts by Source URL (column C):
 *  - existing rows get their status columns (H–K) refreshed from the ledger,
 *    and F (post title) / L (image_src) filled in when empty
 *  - ledger assets with no matching row are appended
 *  - rows unknown to the ledger (pre-ledger history) are left untouched
 */
function syncFromLedger() {
  if (!LEDGER_API_URL) throw new Error('LEDGER_API_URL script property not set');

  const response = UrlFetchApp.fetch(LEDGER_API_URL.replace(/\/$/, '') + '/assets', {
    method: 'get',
    headers: LEDGER_API_TOKEN ? { 'Authorization': 'Bearer ' + LEDGER_API_TOKEN } : {},
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) {
    throw new Error('ledger fetch failed: HTTP ' + response.getResponseCode());
  }
  const assets = JSON.parse(response.getContentText()).assets || [];

  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const rowByUrl = {};
  for (let i = 1; i < values.length; i++) {
    const rowUrl = String(values[i][2] || '').trim();
    if (rowUrl && !(rowUrl in rowByUrl)) rowByUrl[rowUrl] = i + 1; // 1-indexed sheet row
  }

  let updated = 0, appended = 0;
  assets.forEach(asset => {
    const sourceUrl = String(asset.source_url || '').trim();
    if (!sourceUrl) return;
    if (asset.status === 'discarded' && !rowByUrl[sourceUrl]) return;

    const status     = asset.placement_status === 'placed' ? 'placed' : asset.status;
    const placedIn   = asset.draft_title || asset.draft_path || '';
    const placedDate = asset.placement_status === 'placed' && asset.placement_updated_at
      ? String(asset.placement_updated_at).slice(0, 10) : '';
    const target     = asset.placement_target || '';
    const postTitle  = asset.draft_title || asset.intake_section || '';

    const rowIndex = rowByUrl[sourceUrl];
    if (rowIndex) {
      sheet.getRange(rowIndex, 8, 1, 4).setValues([[status, placedIn, placedDate, target]]);
      if (!values[rowIndex - 1][5] && postTitle) sheet.getRange(rowIndex, 6).setValue(postTitle);
      if (!values[rowIndex - 1][11] && asset.image_src) sheet.getRange(rowIndex, 12).setValue(asset.image_src);
      updated++;
    } else {
      sheet.appendRow([
        asset.created_at ? new Date(asset.created_at) : new Date(),
        asset.source_name || asset.slug || asset.display_name || '',
        sourceUrl,
        asset.photographer || 'UNKNOWN',
        asset.license || '',
        postTitle,
        asset.attribution || '',
        status,
        placedIn,
        placedDate,
        target,
        asset.image_src || ''
      ]);
      appended++;
    }
  });

  Logger.log('syncFromLedger: ' + updated + ' updated, ' + appended + ' appended, ' + assets.length + ' ledger assets');
}
