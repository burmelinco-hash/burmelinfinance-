/* Burmelin Finance mobile app */

// ---- money field definitions per category (kept in sync with api/transaction.js) ----
const RULES = {
  'Retail Sale':               { fields: ['cashIn', 'bankIn'],  hint: 'Cash sales in Cash In, card/QR sales in Bank In. One row per shop per day.' },
  'Bank Received':             { fields: ['bankIn'],            hint: 'Money that arrived directly in the bank account.' },
  'Scan / QR Payment':         { fields: ['bankIn'],            hint: 'QR payment received at the shop (goes to the shared bank).' },
  'Credit Sale':               { fields: ['creditAmount'],      hint: 'Customer takes goods on credit. No cash moves — their debt goes up. Shop is always Palladium.' },
  'Customer Payment':          { fields: ['cashIn', 'bankIn'],  hint: 'Credit customer pays back. Cash In if cash, Bank In if transfer. Shop is always Palladium.' },
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
const NEEDS_CUSTOMER = ['Credit Sale', 'Customer Payment'];
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
    <li><div class="row">
      <span class="name">${esc(s.name)}</span>
      <span class="amount ${s.cash < 0 ? 'neg' : 'pos'}">${fmt(s.cash)}</span>
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
    <li><div class="row">
      <span class="name">${esc(c.name)}<span class="sub ${overdue ? 'overdue' : ''}">${sub}</span></span>
      <span class="amount ${c.balance < 0 ? 'neg' : 'pos'}">${fmt(c.balance)}</span>
    </div></li>`;
  }).join('');

  $('totalCredit').textContent = fmt(d.totalCredit);
  $('updatedAt').textContent = 'Updated ' + new Date(d.updatedAt).toLocaleTimeString();
}

function esc(s) { const el = document.createElement('span'); el.textContent = s; return el.innerHTML; }

$('refreshBtn').addEventListener('click', loadDashboard);

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

  // customer row + shop lock for credit categories
  const needsCust = NEEDS_CUSTOMER.includes($('fCategory').value);
  $('rowCustomer').hidden = !needsCust;
  if (needsCust) { $('fShop').value = 'Palladium'; }
  $('fShop').disabled = needsCust;

  $('ruleHint').textContent = rule.hint;
});

$('txForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const category = $('fCategory').value;
  const rule = RULES[category];
  if (!rule) return showToast('Pick a category first', 'error');

  const body = {
    category,
    shop: $('fShop').value,
    customer: NEEDS_CUSTOMER.includes(category) ? $('fCustomer').value : '',
    date: $('fDate').value,
    notes: $('fNotes').value.trim(),
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
function loadDashboardSoon() { clearTimeout(dashTimer); dashTimer = setTimeout(loadDashboard, 400); }

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
