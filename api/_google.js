// Shared helpers for the Sheets API. Files starting with "_" are not exposed as routes on Vercel.
const { google } = require('googleapis');

const SHEET_ID = process.env.SHEET_ID || '1UG4WQG3vOiytArJT1U03CdQPwjPlMb9-3wy1OGzoLmw';
const MOCK = !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY;

// Tolerate the common ways a private key gets mangled when pasted into a host's
// env-var UI: wrapping quotes, escaped "\n" instead of real newlines, stray CRs.
function normalizePrivateKey(raw) {
  let k = (raw || '').trim();
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1).trim();
  }
  k = k.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\r\n/g, '\n');
  return k;
}

function getSheetsClient() {
  const key = normalizePrivateKey(process.env.GOOGLE_PRIVATE_KEY);
  if (!key.includes('BEGIN PRIVATE KEY')) {
    throw new Error('GOOGLE_PRIVATE_KEY looks malformed — paste the full key from the JSON, including the BEGIN/END lines.');
  }
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    key,
    ['https://www.googleapis.com/auth/spreadsheets']
  );
  return google.sheets({ version: 'v4', auth });
}

// Optional PIN gate: set APP_PIN in env to require the x-app-pin header on every request.
function checkPin(req, res) {
  const pin = process.env.APP_PIN;
  if (!pin) return true;
  if ((req.headers['x-app-pin'] || '') === String(pin)) return true;
  res.status(401).json({ error: 'PIN required' });
  return false;
}

// Google Sheets serial date -> JS Date (sheet epoch is 1899-12-30)
function serialToDate(serial) {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
}

function num(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/[^0-9.-]/g, ''));
  return isFinite(n) ? n : 0;
}

module.exports = { SHEET_ID, MOCK, getSheetsClient, checkPin, serialToDate, num };
