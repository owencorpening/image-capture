// Image Attribution Logger — Bookmarklet Source
// Readable version. To install: minify and paste into a Chrome bookmark URL field.
// Replace placeholders before minifying:
//   YOUR_WEB_APP_URL_HERE  → Apps Script /exec URL
//   YOUR_SECRET_TOKEN_HERE → value of SECRET_TOKEN in Script Properties

javascript:void((function () {

  function toCamelCase(str) {
    str = str.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    return str.split(/\s+/).map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join('');
  }

  var pageTitle     = document.title || 'newImage';
  var suggestedName = toCamelCase(pageTitle);
  var pageURL       = document.location.href;
  var photographer  = '';

  // Attempt to scrape photographer from page DOM
  var authorElement = document.querySelector(
    'a[rel="author"], a[itemprop="author"] span, [data-testid*="photographer"], a[href^="/@"]'
  );
  if (authorElement) {
    photographer = authorElement.innerText.trim();
  }
  if (!photographer) {
    var photoBy = document.querySelector('[class*="photographer"],[class*="author"]');
    if (photoBy && photoBy.innerText.includes('by')) {
      photographer = photoBy.innerText.replace(/.*by\s/i, '').trim();
    }
  }
  if (!photographer) {
    photographer = 'UNKNOWN';
  }

  // License detection
  var imageLicense = 'MANUAL CHECK REQUIRED';
  if (
    pageURL.includes('pexels.com') ||
    pageURL.includes('pixabay.com') ||
    pageURL.includes('unsplash.com')
  ) {
    imageLicense = 'CC0 Equivalent (No Attribution)';
  }

  var dataToSend = {
    name:        suggestedName,
    url:         pageURL,
    photographer: photographer,
    license:     imageLicense,
    token:       'YOUR_SECRET_TOKEN_HERE'
  };

  var webAppURL = 'YOUR_WEB_APP_URL_HERE';
  var params    = new URLSearchParams(dataToSend).toString();
  var finalURL  = webAppURL + '?' + params;

  fetch(finalURL, { method: 'GET', mode: 'no-cors' })
    .then(function () {
      alert(
        '✅ Data Sent to Compliance Ledger!\n\n' +
        'Name: '         + suggestedName + '\n' +
        'Photographer: ' + photographer  + '\n' +
        'Source: '       + pageURL
      );
    })
    .catch(function (error) {
      alert('❌ Error sending data to Google Sheet. Check console.');
      console.error('Fetch error:', error);
    });

})());
