// #1: doGet must never write the token to the execution log, and must
// reject everything when SECRET_TOKEN isn't configured.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(secret) {
  const logs = [];
  const appended = [];
  const sandbox = {
    Logger: { log: m => logs.push(String(m)) },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: k => (k === 'SECRET_TOKEN' ? secret : null) }),
    },
    ContentService: { createTextOutput: t => ({ text: t }) },
    SpreadsheetApp: {
      openById: () => ({ getSheetByName: () => ({ appendRow: r => appended.push(r), getLastRow: () => 1 }) }),
      getActiveSpreadsheet: () => ({ getSheetByName: () => ({ appendRow: r => appended.push(r), getLastRow: () => 1 }) }),
    },
    UrlFetchApp: { fetch: () => ({ getContentText: () => '{}', getResponseCode: () => 200 }) },
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8'), sandbox);
  return { sandbox, logs, appended };
}

test('a wrong token is rejected and never logged', () => {
  const { sandbox, logs, appended } = load('real-secret');
  const out = sandbox.doGet({ parameter: { token: 'guess-123', name: 'x' } });
  expect(out.text).toBe('Unauthorized');
  expect(appended).toHaveLength(0);
  expect(logs.join('\n')).not.toContain('guess-123');
});

test('the valid token is never logged either', () => {
  const { sandbox, logs } = load('real-secret');
  try { sandbox.doGet({ parameter: { token: 'real-secret', name: 'x', url: 'https://example.com' } }); } catch (_) {}
  expect(logs.join('\n')).not.toContain('real-secret');
  expect(logs.join('\n')).toContain('[redacted]');
});

test('fails closed when SECRET_TOKEN is unset', () => {
  for (const secret of [null, '']) {
    const { sandbox, appended } = load(secret);
    for (const token of [undefined, null, '']) {
      const out = sandbox.doGet({ parameter: token === undefined ? {} : { token } });
      expect(out.text).toBe('Unauthorized');
    }
    expect(appended).toHaveLength(0);
  }
});
