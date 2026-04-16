// lib.js — Pure functions extracted from Code.gs for testability.
// No Apps Script globals here. Safe to require() in tests or Node.

function toCamelCase(str) {
  str = (str || '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  return str.split(/\s+/).map((w, i) =>
    i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  ).join('');
}

function toTitleCase(camel) {
  if (!camel || typeof camel !== 'string') camel = '';
  return camel
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .replace(/^./, str => str.toUpperCase());
}

function extractUnsplashId(url) {
  if (!url.includes('unsplash.com/photos/')) return null;
  const parts = url.split('/');
  return parts[parts.length - 1].split('?')[0].split('#')[0] || null;
}

function extractPexelsId(url) {
  if (!url.includes('pexels.com/photo/')) return null;
  const pathOnly = url.split('?')[0].split('#')[0]; // strip query + hash first
  const pathAndQuery = pathOnly.split('.com')[1] || pathOnly.split('.co')[1];
  if (!pathAndQuery) return null;
  const segments = pathAndQuery.split('/').filter(s => s.length > 0);
  const last = segments[segments.length - 1];
  if (!last) return null;
  const match = last.match(/(\d+)$/);
  return match ? match[1] : null;
}

function buildAttributionString(name, photographer, url, license) {
  const clean = toTitleCase(name);
  const domainMatch = url.match(/^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n]+)/im);
  const domain = domainMatch ? domainMatch[1] : url;
  return `Image: ${clean}, by ${photographer}, Source: ${domain}. License: ${license}.`;
}

function detectLicense(url) {
  if (
    url.includes('pexels.com') ||
    url.includes('pixabay.com') ||
    url.includes('unsplash.com')
  ) {
    return 'CC0 Equivalent (No Attribution)';
  }
  return 'MANUAL CHECK REQUIRED';
}

function isAuthorized(token, secret) {
  return token === secret;
}

module.exports = {
  toCamelCase,
  toTitleCase,
  extractUnsplashId,
  extractPexelsId,
  buildAttributionString,
  detectLicense,
  isAuthorized,
};
