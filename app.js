/* Burmelin Finance mobile app */

// ---- money field definitions per category (kept in sync with api/transaction.js) ----
const RULES = {
  'Retail Sale':               { fields: ['cashIn', 'bankIn'],  hint: 'Cash sales in Cash In, card/QR sales in Bank In. One row per shop per day.' },
  'Bank Received':             { fields: ['bankIn'],            hint: 'Money that arrived directly in the bank account.' },
  'Scan / QR Payment':         { fields: ['bankIn'],            hint: 'QR payment received at the shop (goes to the shared bank).' },
  'Credit Sale':               { fields: ['creditAmount'],      hint: 'Palladium → customer: goods given on credit, their debt goes UP. No cash moves now.' },
  'Customer Payment':          { fields: ['cashIn', 'bankIn'],  hint: 'Customer → Palladium: they pay their debt DOWN. Cash In if cash, Bank In if transfer.' },
  'Credit Opening Balance':    { fields: ['creditAmount'],      hint: 'The debt a customer ALREADY owes when you start tracking. Sets their starting balance (recorded as a credit sale, noted “Opening balance”).' },
  'Supplier Pay':              { fields: ['cashOut', 'bankOut'], hint: 'Paying for stock/production. Use whichever account it left from.' },
  'Salary':                    { fields: ['cashOut', 'bankOut'], hint: 'Monthly staff salary. If paid from collected cash, use Shop = Palladium.' },
  'Wages':                     { fields: ['cashOut', 'bankOut'], hint: 'Daily helpers or casual staff.' },
  'Commission':                { fields: ['cashOut', 'bankOut'], hint: 'Staff performance bonuses.' },
  'Rent':                      { fields: ['cashOut', 'bankOut'], hint: 'Shop, warehouse or office rent.' },
  'Gov Tax':                   { fields: ['cashOut', 'bankOut'], hint: 'Government taxes and fees.' },
  'Home Expenses':             { fields: ['cashOut', 'bankOut'], hint: 'Personal / home spending taken from the business.' },
  'Other Expense':             { fields: ['cashOut', 'bankOut'], hint: 'Small daily costs — tea, water, electricity…' },
  'Collection (to Palladium)': { fields: ['cashOut'],           hint: 'You physically take cash FROM this shop’s drawer to Palladium. Shop = the shop you collected from. The dashboard adds it to Palladium automatically.' },
  'Cash to Bank Deposit':      { fields: ['cashOut', 'bankIn'], hint: 'Depositing drawer cash into the bank: fill BOTH Cash Out and Bank In with the same amount.' },
  'Bank to Cash (ATM)':        { fields: ['cashIn', 'bankOut'], hint: 'ATM withdrawal into a shop’s till: fill BOTH Cash In and Bank Out.' },
  'Collection to Bank':        { fields: ['cashOut', 'bankIn'], hint: 'Collected cash at Palladium deposited to the bank: fill BOTH Cash Out and Bank In.' },
  'Opening Balance':           { fields: ['cashIn', 'bankIn'],  hint: 'Only when setting up a shop for the first time.' },
};
const NEEDS_CUSTOMER = ['Credit Sale', 'Customer Payment', 'Credit Opening Balance'];
const FIELD_LABELS = {
  cashIn: 'Cash In', bankIn: 'Bank In', cashOut: 'Cash Out', bankOut: 'Bank Out', creditAmount: 'Credit Sale Amount',
};

const $ = (id) => document.getElementById(id);
let LISTS = null;

// ---- PIN handling (only used if the server has APP_PIN set) ----
function getPin() { return localStorage.getItem('appPin') || ''; }
async function api(path, opts = {}) {
  opts.headers = Object.assign({ 'Content-Type': 'application/json', 'x-app-pin': getPin() }, opts.headers);
  let resp = await fetch(path, opts);
  if (resp.status === 401) {
    const pin = prompt('Enter your PIN');
    if (pin === null) throw new Error('PIN required');
    localStorage.setItem('appPin', pin);
    opts.headers['x-app-pin'] = pin;
    resp = await fetch(path, opts);
    if (resp.status === 401) { localStorage.removeItem('appPin'); throw new Error('Wrong PIN'); }
  }
  return resp;
}

// ---- formatting ----
const fmt = (n) => '฿' + Math.round(n).toLocaleString('en-US');

// ---- tabs ----
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    $('page-dashboard').hidden = btn.dataset.page !== 'dashboard';
    $('page-record').hidden = btn.dataset.page !== 'record';
    $('page-detail').hidden = true;
  });
});

// ---- dashboard ----
async function loadDashboard() {
  const load = $('loadState');
  load.hidden = false; load.classList.remove('error'); load.textContent = 'Loading…';
  $('dashContent').hidden = true;
  try {
    const resp = await api('/api/dashboard');
    if (!resp.ok) throw new Error((await resp.json()).error || 'Server error');
    const d = await resp.json();
    LISTS = d.lists;
    renderDashboard(d);
    populateForm();
    load.hidden = true;
    $('dashContent').hidden = false;
  } catch (err) {
    load.classList.add('error');
    load.textContent = 'Could not load: ' + err.message;
  }
}

function renderDashboard(d) {
  $('mockBanner').hidden = !d.mock;
  $('totalCash').textContent = fmt(d.totals.cash);
  $('totalBank').textContent = fmt(d.totals.bank);
  $('totalGrand').textContent = fmt(d.totals.grand);

  $('shopList').innerHTML = d.shops.map((s) => `
    <li><div class="row tappable" data-shop="${esc(s.name)}">
      <span class="name">${esc(s.name)}</span>
      <span class="amount ${s.cash < 0 ? 'neg' : 'pos'}">${fmt(s.cash)}<span class="chevron">›</span></span>
    </div></li>`).join('');

  $('creditList').innerHTML = d.credit.map((c) => {
    let sub = 'no payment recorded';
    let overdue = true;
    if (c.daysSince !== null && c.daysSince !== undefined) {
      sub = c.daysSince === 0 ? 'paid today' : `last paid ${c.daysSince} day${c.daysSince === 1 ? '' : 's'} ago`;
      overdue = c.daysSince > 30;
    }
    if (c.balance === 0) { sub = 'settled'; overdue = false; }
    return `
    <li><div class="row tappable" data-customer="${esc(c.name)}">
      <span class="name">${esc(c.name)}<span class="sub ${overdue ? 'overdue' : ''}">${sub}</span></span>
      <span class="amount ${c.balance < 0 ? 'neg' : 'pos'}">${fmt(c.balance)}<span class="chevron">›</span></span>
    </div></li>`;
  }).join('');

  $('totalCredit').textContent = fmt(d.totalCredit);
  $('updatedAt').textContent = 'Updated ' + new Date(d.updatedAt).toLocaleTimeString();
}

function esc(s) { const el = document.createElement('span'); el.textContent = s; return el.innerHTML; }

$('refreshBtn').addEventListener('click', () => { TX = null; loadDashboard(); });

// ================= per-shop / per-customer detail =================
let TX = null;
async function loadTx(force) {
  if (TX && !force) return TX;
  const resp = await api('/api/transactions');
  if (!resp.ok) throw new Error((await resp.json()).error || 'Server error');
  TX = (await resp.json()).transactions;
  return TX;
}

function fmtDate(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split('-');
  return `${+d}/${+m}/${y}`;
}
const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.row - b.row);
const byDateAsc = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.row - b.row);

function pad(n) { return String(n).padStart(2, '0'); }
function isoOf(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function periodRange(preset) {
  const now = new Date();
  if (preset === 'month') return { from: isoOf(new Date(now.getFullYear(), now.getMonth(), 1)), to: isoOf(new Date(now.getFullYear(), now.getMonth() + 1, 0)), label: 'This month' };
  if (preset === 'lastmonth') return { from: isoOf(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: isoOf(new Date(now.getFullYear(), now.getMonth(), 0)), label: 'Last month' };
  if (preset === 'year') return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31`, label: 'This year' };
  if (preset === 'custom') return { from: $('fromDate').value || null, to: $('toDate').value || null, label: 'Custom', custom: true };
  return { from: null, to: null, label: 'All time' };
}
function inRange(dateStr, r) {
  if (r.from && dateStr < r.from) return false;
  if (r.to && dateStr > r.to) return false;
  return true;
}

let currentDetail = null;

async function openDetail(kind, name) {
  $('page-dashboard').hidden = true;
  $('page-record').hidden = true;
  $('page-detail').hidden = false;
  window.scrollTo(0, 0);
  $('detailTitle').textContent = name;
  $('detailSub').textContent = 'Loading…';
  $('detailSummary').innerHTML = '';
  $('detailList').innerHTML = '';
  $('detailEmpty').hidden = true;
  $('detailFilter').hidden = true;
  $('detailPeriod').value = 'all';
  $('customRange').hidden = true;
  $('shareBtn').hidden = kind !== 'customer';
  currentDetail = { kind, name, allRows: [], headline: 0 };
  try {
    const tx = await loadTx();
    const rows = tx.filter((t) => (kind === 'shop' ? t.shop === name : t.customer === name)).sort(byDateAsc);
    // running total computed cumulatively over ALL of this shop's/customer's rows
    let run = 0;
    rows.forEach((t) => {
      if (kind === 'shop') run += t.cashIn - t.cashOut;
      else if (t.category === 'Credit Sale') run += t.creditAmount;
      else if (t.category === 'Customer Payment') run -= (t.cashIn + t.bankIn);
      t._run = run;
    });
    currentDetail.allRows = rows;
    currentDetail.headline = rows.length ? rows[rows.length - 1]._run : 0;
    $('detailFilter').hidden = false;
    renderDetail();
  } catch (e) {
    $('detailSub').textContent = 'Could not load: ' + e.message;
  }
}

function renderDetail() {
  const { kind, headline, allRows } = currentDetail;
  const r = periodRange($('detailPeriod').value);
  const filtered = allRows.filter((t) => inRange(t.date, r));
  $('detailSub').textContent = `${r.label} · ${filtered.length} transaction${filtered.length === 1 ? '' : 's'}`;

  if (kind === 'shop') {
    let cashIn = 0, cashOut = 0, bankIn = 0, bankOut = 0;
    filtered.forEach((t) => { cashIn += t.cashIn; cashOut += t.cashOut; bankIn += t.bankIn; bankOut += t.bankOut; });
    $('detailListLabel').textContent = 'In & Out';
    $('detailSummary').innerHTML = `
      <div class="total-card in"><span class="label">Cash In</span><span class="value">${fmt(cashIn)}</span></div>
      <div class="total-card out"><span class="label">Cash Out</span><span class="value">${fmt(cashOut)}</span></div>
      <div class="total-card in"><span class="label">Bank In</span><span class="value">${fmt(bankIn)}</span></div>
      <div class="total-card out"><span class="label">Bank Out</span><span class="value">${fmt(bankOut)}</span></div>
      <div class="total-card grand wide"><span class="label">Net Cash in Drawer (all-time)</span><span class="value">${fmt(headline)}</span></div>`;
  } else {
    let charged = 0, paid = 0;
    filtered.forEach((t) => { if (t.category === 'Credit Sale') charged += t.creditAmount; if (t.category === 'Customer Payment') paid += t.cashIn + t.bankIn; });
    $('detailListLabel').textContent = 'Statement';
    $('detailSummary').innerHTML = `
      <div class="total-card"><span class="label">Charged</span><span class="value" style="color:var(--amber)">${fmt(charged)}</span></div>
      <div class="total-card in"><span class="label">Paid</span><span class="value">${fmt(paid)}</span></div>
      <div class="total-card grand wide"><span class="label">Balance Owed (all-time)</span><span class="value">${fmt(headline)}</span></div>`;
  }

  if (!filtered.length) { $('detailList').innerHTML = ''; $('detailEmpty').hidden = false; return; }
  $('detailEmpty').hidden = true;
  const runLabel = kind === 'shop' ? 'drawer' : 'balance';
  $('detailList').innerHTML = filtered.slice().sort(byDateDesc).map((t) => {
    const amts = [];
    if (kind === 'shop') {
      if (t.cashIn) amts.push(`<span class="amt in">+${fmt(t.cashIn)} cash</span>`);
      if (t.bankIn) amts.push(`<span class="amt in">+${fmt(t.bankIn)} bank</span>`);
      if (t.cashOut) amts.push(`<span class="amt out">−${fmt(t.cashOut)} cash</span>`);
      if (t.bankOut) amts.push(`<span class="amt out">−${fmt(t.bankOut)} bank</span>`);
    } else if (t.category === 'Credit Sale') amts.push(`<span class="amt credit">+${fmt(t.creditAmount)}</span>`);
    else if (t.category === 'Customer Payment') amts.push(`<span class="amt pay">−${fmt(t.cashIn + t.bankIn)}</span>`);
    const opening = /opening/i.test(t.notes);
    const label = (kind === 'customer' && opening) ? 'Opening balance' : t.category;
    const meta = fmtDate(t.date) + (t.notes && !(kind === 'customer' && opening) ? ' · ' + esc(t.notes) : '');
    return `<li><div class="tx">
      <div class="tx-left"><div class="tx-cat">${esc(label)}</div><div class="tx-meta">${meta}</div></div>
      <div class="tx-amounts">${amts.join('') || '<span class="amt">—</span>'}<span class="amt-run">${runLabel} ${fmt(t._run)}</span></div>
    </div></li>`;
  }).join('');
}

function buildStatement() {
  const { name, allRows, headline } = currentDetail;
  const r = periodRange($('detailPeriod').value);
  const filtered = allRows.filter((t) => inRange(t.date, r)).sort(byDateAsc);
  const body = filtered.map((t) => {
    const opening = /opening/i.test(t.notes);
    let charge = '', payment = '', desc = '';
    if (t.category === 'Credit Sale') { charge = fmt(t.creditAmount); desc = opening ? 'Opening balance' : 'Credit sale' + (t.notes ? ' — ' + esc(t.notes) : ''); }
    else if (t.category === 'Customer Payment') { payment = fmt(t.cashIn + t.bankIn); desc = 'Payment received' + (t.notes ? ' — ' + esc(t.notes) : ''); }
    else return '';
    return `<tr><td>${fmtDate(t.date)}</td><td>${desc}</td><td class="num">${charge}</td><td class="num">${payment}</td><td class="num">${fmt(t._run)}</td></tr>`;
  }).join('');
  const periodLine = r.from || r.to ? `<br>Period: ${r.label}${r.from ? ' (' + fmtDate(r.from) + ' – ' + fmtDate(r.to || isoOf(new Date())) + ')' : ''}` : '';
  $('printArea').innerHTML = `
    <h1>Burmelin Finance</h1>
    <div class="ph-sub">Customer Statement — <strong>${esc(name)}</strong><br>Generated ${new Date().toLocaleDateString()}${periodLine}</div>
    <table>
      <thead><tr><th>Date</th><th>Description</th><th class="num">Charge</th><th class="num">Payment</th><th class="num">Balance</th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr class="total-line"><td colspan="4">Balance Owed (total)</td><td class="num">${fmt(headline)}</td></tr></tfoot>
    </table>
    <div class="ph-foot">Generated from Burmelin Finance records.</div>`;
}

$('detailPeriod').addEventListener('change', () => {
  const custom = $('detailPeriod').value === 'custom';
  $('customRange').hidden = !custom;
  if (!custom || $('fromDate').value || $('toDate').value) renderDetail();
});
$('fromDate').addEventListener('change', renderDetail);
$('toDate').addEventListener('change', renderDetail);

$('backBtn').addEventListener('click', () => {
  $('page-detail').hidden = true;
  $('page-dashboard').hidden = false;
});
$('shareBtn').addEventListener('click', () => {
  if (!currentDetail || currentDetail.kind !== 'customer') return;
  buildStatement();
  window.print();
});
$('shopList').addEventListener('click', (e) => { const el = e.target.closest('[data-shop]'); if (el) openDetail('shop', el.dataset.shop); });
$('creditList').addEventListener('click', (e) => { const el = e.target.closest('[data-customer]'); if (el) openDetail('customer', el.dataset.customer); });

// ---- record form ----
function populateForm() {
  if (!LISTS) return;
  const cat = $('fCategory');
  if (cat.options.length <= 1) {
    const groups = { Income: [], Expense: [], Transfer: [] };
    LISTS.categories.forEach((c) => (groups[c.type] || (groups[c.type] = [])).push(c.name));
    for (const [type, names] of Object.entries(groups)) {
      if (!names.length) continue;
      const og = document.createElement('optgroup');
      og.label = type;
      names.forEach((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n; og.appendChild(o); });
      cat.appendChild(og);
    }
    // App-only shortcut for setting a credit customer's starting debt.
    const ogSetup = document.createElement('optgroup');
    ogSetup.label = 'Setup';
    const oOpen = document.createElement('option');
    oOpen.value = 'Credit Opening Balance';
    oOpen.textContent = 'Credit Opening Balance';
    ogSetup.appendChild(oOpen);
    cat.appendChild(ogSetup);
  }
  const shop = $('fShop');
  if (!shop.options.length) {
    LISTS.shops.forEach((s) => { const o = document.createElement('option'); o.value = s; o.textContent = s; shop.appendChild(o); });
  }
  const cust = $('fCustomer');
  if (!cust.options.length) {
    LISTS.customers.forEach((c) => { const o = document.createElement('option'); o.value = c; o.textContent = c; cust.appendChild(o); });
  }
}

function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
$('fDate').value = todayLocalISO();

$('fCategory').addEventListener('change', () => {
  const rule = RULES[$('fCategory').value];
  if (!rule) return;

  // amount inputs
  $('amountFields').innerHTML = rule.fields.map((f) => `
    <label class="amount-field">
      <span>${FIELD_LABELS[f]}</span>
      <span class="currency-wrap"><input type="number" inputmode="decimal" min="0" step="any" id="amt_${f}" placeholder="0"></span>
    </label>`).join('');

  // Credit rows are always Palladium <-> customer: show the customer, hide the redundant Shop.
  const needsCust = NEEDS_CUSTOMER.includes($('fCategory').value);
  $('rowCustomer').hidden = !needsCust;
  $('rowShop').hidden = needsCust;
  if (needsCust) $('fShop').value = 'Palladium';
  $('fShop').disabled = false;

  $('ruleHint').textContent = rule.hint;
});

$('txForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const category = $('fCategory').value;
  const rule = RULES[category];
  if (!rule) return showToast('Pick a category first', 'error');

  // "Credit Opening Balance" is an app-only shortcut. It's written to the sheet as a
  // Credit Sale (what the Credit Aging tab counts), tagged in Notes so it stays distinguishable.
  let apiCategory = category;
  let notes = $('fNotes').value.trim();
  if (category === 'Credit Opening Balance') {
    apiCategory = 'Credit Sale';
    if (!notes) notes = 'Opening balance';
  }

  const body = {
    category: apiCategory,
    shop: $('fShop').value,
    customer: NEEDS_CUSTOMER.includes(category) ? $('fCustomer').value : '',
    date: $('fDate').value,
    notes,
  };
  let any = false;
  for (const f of rule.fields) {
    const v = parseFloat(($(`amt_${f}`) || {}).value || '0') || 0;
    body[f] = v;
    if (v > 0) any = true;
  }
  if (!any) return showToast('Enter an amount', 'error');

  const btn = $('saveBtn');
  btn.disabled = true; btn.textContent = 'Saving…';
  try {
    const resp = await api('/api/transaction', { method: 'POST', body: JSON.stringify(body) });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Server error');
    showToast(`Saved ✓ ${category} — ${body.shop}${data.mock ? ' (sample mode)' : ''}`, 'success');
    // reset amounts + notes, keep category & shop for fast repeat entry
    rule.fields.forEach((f) => { const el = $(`amt_${f}`); if (el) el.value = ''; });
    $('fNotes').value = '';
    loadDashboardSoon();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Save Transaction';
  }
});

let dashTimer = null;
function loadDashboardSoon() { TX = null; clearTimeout(dashTimer); dashTimer = setTimeout(loadDashboard, 400); }

let toastTimer = null;
function showToast(msg, kind) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast ' + (kind || '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// go
loadDashboard();
