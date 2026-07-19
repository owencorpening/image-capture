const SHEET_NAME = 'Sheet1';

// --- LOAD FROM SCRIPT PROPERTIES (never hardcode these) ---
const UNSPLASH_ACCESS_KEY = PropertiesService.getScriptProperties().getProperty('UNSPLASH_ACCESS_KEY');
const PEXELS_ACCESS_KEY   = PropertiesService.getScriptProperties().getProperty('PEXELS_ACCESS_KEY');
const SHEET_ID            = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
const SECRET_TOKEN        = PropertiesService.getScriptProperties().getProperty('SECRET_TOKEN');
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

  return ContentService.createTextOutput("Success");
}
