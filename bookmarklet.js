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

  function getImageUrl() {
    var og = document.querySelector('meta[property="og:image"]');
    return og ? og.getAttribute('content') || '' : '';
  }

  // Unsplash serves images without an extension in the path but exposes fm= in query params.
  function getExt(url) {
    if (!url) return '.jpg';
    var path = url.split('?')[0].split('#')[0];
    var m = path.match(/\.(jpe?g|png|webp|gif)$/i);
    if (m) return '.' + m[1].toLowerCase();
    var fm = url.match(/[?&]fm=(jpe?g|png|webp|gif)/i);
    if (fm) return '.' + fm[1].toLowerCase();
    return '.jpg';
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
    name:         suggestedName,
    url:          pageURL,
    photographer: photographer,
    license:      imageLicense,
    token:        'S7wnn0zBQf5pZoZJmRQw'
  };

  var webAppURL = 'https://script.google.com/macros/s/AKfycbxGX-cH4Lqat1e0ygnF0SWeFBf5qeQe1t0z_MsD_WlDswqVzjX4ckPwPCV6636JqeJvyQ/exec';
  var params    = new URLSearchParams(dataToSend).toString();
  var finalURL  = webAppURL + '?' + params;

  fetch(finalURL, { method: 'GET', mode: 'no-cors' })
    .then(function () {
      var imgUrl   = getImageUrl();
      var ext      = getExt(imgUrl);
      var filename = suggestedName + ext;

      if (!imgUrl) {
        alert(
          '✅ Sheet row logged ✓\n' +
          '⚠️ No image found on page — save manually.\n\n' +
          'Name: '         + suggestedName + '\n' +
          'Photographer: ' + photographer  + '\n' +
          'Source: '       + pageURL
        );
        return;
      }

      fetch(imgUrl)
        .then(function (r) { return r.blob(); })
        .then(function (blob) {
          var blobUrl = URL.createObjectURL(blob);
          var a       = document.createElement('a');
          a.href      = blobUrl;
          a.download  = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(blobUrl); }, 1000);
          alert(
            '✅ Logged + Downloaded!\n\n' +
            'Sheet row logged ✓\n' +
            'Image downloaded as: ' + filename + ' ✓\n\n' +
            'Photographer: ' + photographer
          );
        })
        .catch(function () {
          alert(
            '✅ Sheet row logged ✓\n' +
            '⚠️ Download failed (CORS) — save the image manually.\n\n' +
            'Name: '         + suggestedName + '\n' +
            'Photographer: ' + photographer
          );
        });
    })
    .catch(function (error) {
      alert('❌ Error sending data to Google Sheet. Check console.');
      console.error('Fetch error:', error);
    });

})());
