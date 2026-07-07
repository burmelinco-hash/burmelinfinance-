// Shared helpers for the Sheets API. Files starting with "_" are not exposed as routes on Vercel.
const { google } = require('googleapis');

const SHEET_ID = process.env.SHEET_ID || '1UG4WQG3vOiytArJT1U03CdQPwjPlMb9-3wy1OGzoLmw';
const MOCK = !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY;

function getSheetsClient() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
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
