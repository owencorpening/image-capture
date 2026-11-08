const {
  toCamelCase,
  toTitleCase,
  extractUnsplashId,
  extractPexelsId,
  buildAttributionString,
  detectLicense,
  isAuthorized,
} = require('../lib');

// --- toCamelCase ---
describe('toCamelCase', () => {
  test('lowercases first word', () => {
    expect(toCamelCase('Hello World')).toBe('helloWorld');
  });
  test('handles multiple words', () => {
    expect(toCamelCase('free water photo pexels')).toBe('freeWaterPhotoPexels');
  });
  test('strips special characters', () => {
    expect(toCamelCase('Photo by John | Unsplash')).toBe('photoByJohnUnsplash');
  });
  test('handles empty string', () => {
    expect(toCamelCase('')).toBe('');
  });
  test('handles null/undefined', () => {
    expect(toCamelCase(null)).toBe('');
    expect(toCamelCase(undefined)).toBe('');
  });
});

// --- toTitleCase ---
describe('toTitleCase', () => {
  test('expands camelCase to Title Case', () => {
    expect(toTitleCase('helloWorld')).toBe('Hello World');
  });
  test('handles single word', () => {
    expect(toTitleCase('water')).toBe('Water');
  });
  test('handles empty string', () => {
    expect(toTitleCase('')).toBe('');
  });
  test('handles null', () => {
    expect(toTitleCase(null)).toBe('');
  });
});

// --- extractUnsplashId ---
describe('extractUnsplashId', () => {
  test('extracts ID from standard URL', () => {
    expect(extractUnsplashId('https://unsplash.com/photos/abc123xyz')).toBe('abc123xyz');
  });
  test('strips query string', () => {
    expect(extractUnsplashId('https://unsplash.com/photos/abc123xyz?utm_source=foo')).toBe('abc123xyz');
  });
  test('strips hash fragment', () => {
    expect(extractUnsplashId('https://unsplash.com/photos/abc123xyz#section')).toBe('abc123xyz');
  });
  test('returns null for non-Unsplash URL', () => {
    expect(extractUnsplashId('https://pexels.com/photo/some-photo-123')).toBeNull();
  });
  test('returns null for empty string', () => {
    expect(extractUnsplashId('')).toBeNull();
  });
});

// --- extractPexelsId ---
describe('extractPexelsId', () => {
  test('extracts numeric ID from slug URL', () => {
    expect(extractPexelsId('https://www.pexels.com/photo/blue-ocean-wave-1234567')).toBe('1234567');
  });
  test('extracts ID with query string', () => {
    expect(extractPexelsId('https://www.pexels.com/photo/blue-ocean-1234567/?foo=bar')).toBe('1234567');
  });
  test('returns null for non-Pexels URL', () => {
    expect(extractPexelsId('https://unsplash.com/photos/abc123')).toBeNull();
  });
  test('returns null when no numeric ID in slug', () => {
    expect(extractPexelsId('https://www.pexels.com/photo/no-id-here')).toBeNull();
  });
});

// --- buildAttributionString ---
describe('buildAttributionString', () => {
  test('builds correct attribution string', () => {
    const result = buildAttributionString(
      'blueOceanWave',
      'Jane Smith',
      'https://www.pexels.com/photo/blue-ocean-wave-1234567',
      'CC0 Equivalent (No Attribution)'
    );
    expect(result).toBe(
      'Image: Blue Ocean Wave, by Jane Smith, Source: pexels.com. License: CC0 Equivalent (No Attribution).'
    );
  });
  test('handles UNKNOWN photographer', () => {
    const result = buildAttributionString(
      'someImage',
      'UNKNOWN',
      'https://example.com/photo',
      'MANUAL CHECK REQUIRED'
    );
    expect(result).toContain('by UNKNOWN');
    expect(result).toContain('License: MANUAL CHECK REQUIRED');
  });
});

// --- detectLicense ---
describe('detectLicense', () => {
  test('Unsplash returns CC0', () => {
    expect(detectLicense('https://unsplash.com/photos/abc')).toBe('CC0 Equivalent (No Attribution)');
  });
  test('Pexels returns CC0', () => {
    expect(detectLicense('https://www.pexels.com/photo/abc-123')).toBe('CC0 Equivalent (No Attribution)');
  });
  test('Pixabay returns CC0', () => {
    expect(detectLicense('https://pixabay.com/images/abc')).toBe('CC0 Equivalent (No Attribution)');
  });
  test('unknown site returns manual check', () => {
    expect(detectLicense('https://somerandomblog.com/image.jpg')).toBe('MANUAL CHECK REQUIRED');
  });
});

// --- bookmarklet build ---
describe('bookmarklet build', () => {
  const { execSync } = require('child_process');
  // Dummy value only. No real or former SECRET_TOKEN belongs in this public
  // repo (#2). deploy.sh injects the real token from the gitignored
  // .credentials file at build time.
  const TEST_TOKEN = 'test-token-not-a-secret';
  let bookmarklet;

  beforeAll(() => {
    // Mirrors deploy.sh's minify pipeline. Keep the two in sync.
    bookmarklet = execSync(
      "sed '1,3d' bookmarklet.js" +
      " | sed '1s/^javascript:void(//'" +
      " | sed '$s/);$//'" +
      ` | sed "s/YOUR_SECRET_TOKEN_HERE/${TEST_TOKEN}/"` +
      " | npx terser --compress --mangle --format quote_style=1 2>/dev/null | sed 's/;$//'"
    ).toString().trim();
    bookmarklet = `javascript:void(${bookmarklet})`;
  });

  test('starts with javascript:void(', () => {
    expect(bookmarklet.startsWith('javascript:void(')).toBe(true);
  });

  test('ends with ) and no trailing semicolon', () => {
    expect(bookmarklet.endsWith(';)')).toBe(false);
    expect(bookmarklet.endsWith(')')).toBe(true);
  });

  test('injects the token in place of the placeholder', () => {
    expect(bookmarklet).toContain(TEST_TOKEN);
    expect(bookmarklet).not.toContain('YOUR_SECRET_TOKEN_HERE');
  });

  test('contains localhost title server fetch', () => {
    expect(bookmarklet).toContain('localhost:9876');
  });

  test('contains postTitle parameter', () => {
    expect(bookmarklet).toContain('postTitle');
  });

  test('contains Apps Script URL', () => {
    expect(bookmarklet).toContain('script.google.com/macros/s/');
  });
});

// --- isAuthorized ---
describe('isAuthorized', () => {
  test('returns true when tokens match', () => {
    expect(isAuthorized('mytoken', 'mytoken')).toBe(true);
  });
  test('returns false when tokens differ', () => {
    expect(isAuthorized('wrongtoken', 'mytoken')).toBe(false);
  });
  test('returns false for empty token', () => {
    expect(isAuthorized('', 'mytoken')).toBe(false);
  });
  test('returns false for undefined token', () => {
    expect(isAuthorized(undefined, 'mytoken')).toBe(false);
  });
});
