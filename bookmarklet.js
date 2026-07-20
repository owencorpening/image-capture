// Image Attribution Logger — Bookmarklet Source
// Readable version. To install: minify and paste into a Chrome bookmark URL field.

javascript:void((function () {

  function toCamelCase(str) {
    str = str.replace(/[^a-zA-Z0-9 ]/g, '').trim();
    return str.split(/\s+/).map((w, i) =>
      i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
    ).join('');
  }

  // Returns the best direct CDN image URL from the page.
  // Priority: Unsplash/Pexels CDN src on <img> → og:image → largest direct-URL <img>
  function getImageSrc() {
    var DIRECT_RE = /\.(jpe?g|png|webp|gif)(\?|$)/i;
    var imgs = Array.from(document.querySelectorAll('img'));

    var cdnSrc = '';
    var bestArea = 0;
    imgs.forEach(function(img) {
      var candidates = [
        img.getAttribute('data-src'),
        img.src,
        (img.getAttribute('srcset') || '').split(',')[0].trim().split(' ')[0]
      ];
      candidates.forEach(function(s) {
        if (!s) return;
        if (s.includes('images.unsplash.com') || s.includes('images.pexels.com')) {
          var area = (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0);
          if (area > bestArea) { bestArea = area; cdnSrc = s; }
        }
      });
    });
    if (cdnSrc) return cdnSrc;

    var og = document.querySelector('meta[property="og:image"]');
    if (og) { var ogUrl = og.getAttribute('content') || ''; if (ogUrl) return ogUrl; }

    var bestImg = null; bestArea = 0;
    imgs.forEach(function(img) {
      if (!DIRECT_RE.test(img.src)) return;
      var area = (img.naturalWidth || img.width || 0) * (img.naturalHeight || img.height || 0);
      if (area > bestArea) { bestArea = area; bestImg = img; }
    });
    return bestImg ? bestImg.src : '';
  }

  var pageTitle     = document.title || 'newImage';
  var suggestedName = toCamelCase(pageTitle);
  var pageURL       = document.location.href;
  var photographer  = '';

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

  var imageLicense = 'MANUAL CHECK REQUIRED';
  if (
    pageURL.includes('pexels.com') ||
    pageURL.includes('pixabay.com') ||
    pageURL.includes('unsplash.com')
  ) {
    imageLicense = 'CC0 Equivalent (No Attribution)';
  }

  var imageSrc = getImageSrc();
  console.log('[OAT bookmarklet] image_src found:', imageSrc || '(none)');

  var webAppURL = 'https://script.google.com/macros/s/AKfycbzb7Mcw-H61ywmuA8WFnibkmK1jP2p-whQgGFtyiWuQtxaS0cDCIQV3Ruu7VbYhBm0/exec';

  fetch('http://localhost:9876/')
    .then(function (r) { return r.text(); })
    .catch(function ()  { return '';      })
    .then(function (postTitle) {
      var finalURL = webAppURL + '?' + new URLSearchParams({
        name:         suggestedName,
        url:          pageURL,
        photographer: photographer,
        license:      imageLicense,
        postTitle:    postTitle.trim(),
        imageSrc:     imageSrc || '',
        token:        'YOUR_SECRET_TOKEN_HERE'
      }).toString();
      return fetch(finalURL, { method: 'GET', mode: 'no-cors' });
    })
    .then(function () {
      alert(
        '✅ Logged!\n\n' +
        'Name: '         + suggestedName + '\n' +
        'Photographer: ' + (photographer === 'UNKNOWN' ? 'UNKNOWN (check sheet)' : photographer) + '\n' +
        'Source: '       + pageURL
      );
    })
    .catch(function (error) {
      alert('❌ Error sending data to Google Sheet. Check console.');
      console.error('Fetch error:', error);
    });

})());
