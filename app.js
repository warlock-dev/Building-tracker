'use strict';
/* =====================================================================
   SITE LEDGER — construction accounts. Static site, no backend.
   Data lives in the browser (localStorage); export/import via JSON.
   ===================================================================== */
const LS_KEY = 'siteLedger.v1';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const STEEL_SIZES = ['8mm','10mm','12mm','16mm'];
const PAY_MODES = ['Cash','UPI','Bank transfer','Cheque'];

/* ---------------- helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const r2 = n => Math.round(num(n) * 100) / 100;
const fmtNum = n => r2(n).toLocaleString('en-IN');
const inr = n => (num(n) < 0 ? '-₹' : '₹') + fmtNum(Math.abs(num(n)));
const rs = n => (num(n) < 0 ? '-Rs. ' : 'Rs. ') + fmtNum(Math.abs(num(n)));
const pad = n => String(n).padStart(2, '0');
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtDate = s => { if (!s) return ''; const [y, m, d] = s.split('-').map(Number); return `${pad(d)} ${MONTHS[m - 1]} ${y}`; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sum = (rows, k) => rows.reduce((a, r) => a + num(r[k]), 0);
const slug = s => (String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')) || 'site';
const sortAsc = rows => [...rows].sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a._t || 0) - (b._t || 0));
const fmtKind = (v, kind) => kind === 'num' ? fmtNum(v) : kind === 'text' ? String(v) : inr(v);
const fmtKindPdf = (v, kind) => kind === 'num' ? fmtNum(v) : kind === 'text' ? String(v) : rs(v);

/* ---------------- table definitions ---------------- */
const fDate = { k: 'date', label: 'Date', t: 'date', req: 1 };
const cDate = { k: 'date', label: 'Date', t: 'date' };
const fNote = { k: 'note', label: 'Remarks', t: 'text', ph: 'optional' };
const cNote = { k: 'note', label: 'Remarks' };

const billDerive = rows => rows.map(r => {
  const bal = r2(num(r.total) - num(r.paid));
  return { ...r, bal, status: bal > 0 ? 'due' : bal < 0 ? 'adv' : (num(r.total) > 0 ? 'paid' : 'none') };
});

function billTable(o) {
  const extra = o.extra || [];
  const party = o.partyLabel || 'Supplier';
  return {
    key: o.key, title: o.title, bill: true, derive: billDerive,
    fields: [
      fDate,
      { k: 'party', label: party, t: 'text', ph: 'name (optional)' },
      ...extra,
      { k: 'qty', label: o.qty, t: 'number' },
      { k: 'rate', label: o.rate, t: 'number' },
      { k: 'total', label: 'Total amount (₹)', t: 'number', hint: 'Auto = qty × rate · edit if the bill differs',
        auto: { deps: ['qty', 'rate'], fn: v => (v.qty === '' || v.rate === '') ? '' : num(v.qty) * num(v.rate) / (o.div || 1) } },
      { k: 'paid', label: 'Paid (₹)', t: 'number', hint: 'Less than total → Due · more than total → Advance' },
      fNote
    ],
    cols: [
      cDate, { k: 'party', label: party }, ...extra.map(e => ({ k: e.k, label: e.label })),
      { k: 'qty', label: o.qty, t: 'num', sum: o.sumQty !== false },
      { k: 'rate', label: o.rate, t: 'money' },
      { k: 'total', label: 'Total', t: 'money', sum: 1 },
      { k: 'paid', label: 'Paid', t: 'money', sum: 1 },
      { k: 'status', label: 'Status', t: 'status' },
      cNote
    ],
    validate: v => (num(v.total) || num(v.paid) || num(v.qty)) ? null : 'Enter a quantity, a total or a paid amount.'
  };
}

const cumulate = (key, outKey) => rows => { let c = 0; return rows.map(r => ({ ...r, [outKey]: (c += num(r[key])) })); };

const TABLE_LIST = [
  billTable({ key: 'bricks', title: 'Brick Incoming & Payments', qty: 'Bricks (nos.)', rate: 'Rate (₹ per 1000)', div: 1000 }),
  billTable({ key: 'sand', title: 'Sand — Tractor Trips per Day', qty: 'Tractor trips', rate: 'Rate (₹ per trip)', partyLabel: 'Supplier / Driver' }),
  billTable({
    key: 'aggregate', title: 'Aggregate Procurement', qty: 'Quantity', rate: 'Rate (₹ per unit)', sumQty: false,
    extra: [
      { k: 'material', label: 'Material', t: 'select', opts: ['20mm', 'Dust', 'Other'], req: 1 },
      { k: 'unit', label: 'Unit', t: 'select', opts: ['Trip', 'Ton', 'Brass', 'CFT'], def: 'Trip' }
    ]
  }),
  billTable({ key: 'steelBuy', title: 'Steel Purchases', qty: 'Bundles', rate: 'Rate (₹ per bundle)', extra: [{ k: 'size', label: 'Size', t: 'select', opts: STEEL_SIZES, req: 1 }] }),
  {
    key: 'steelUse', title: 'Steel Usage — where it was used',
    fields: [fDate, { k: 'size', label: 'Size', t: 'select', opts: STEEL_SIZES, req: 1 }, { k: 'qty', label: 'Bundles used', t: 'number', req: 1 },
      { k: 'work', label: 'Used on (work / place)', t: 'text', req: 1, ph: 'e.g. Slab steel, column C3' }, fNote],
    cols: [cDate, { k: 'size', label: 'Size' }, { k: 'qty', label: 'Bundles used', t: 'num', sum: 1 }, { k: 'work', label: 'Work' }, cNote]
  },
  billTable({ key: 'soil', title: 'Soil Filling — Tractor Trips per Day', qty: 'Tractor trips', rate: 'Rate (₹ per trip)', partyLabel: 'Supplier / Driver',
    extra: [{ k: 'area', label: 'Filling area', t: 'text', ph: 'optional' }] }),
  {
    key: 'contractorPay', title: 'Payments Taken by Contractor', derive: cumulate('amount', 'cum'),
    fields: [fDate, { k: 'amount', label: 'Amount taken (₹)', t: 'number', req: 1 }, { k: 'mode', label: 'Mode', t: 'select', opts: PAY_MODES, def: 'Cash' }, { k: 'note', label: 'Purpose / remarks', t: 'text', ph: 'optional' }],
    cols: [cDate, { k: 'amount', label: 'Amount taken', t: 'money', sum: 1 }, { k: 'cum', label: 'Total taken so far', t: 'money' }, { k: 'mode', label: 'Mode' }, cNote]
  },
  {
    key: 'salary', title: 'Salary Paid — Munshi / Local Labour',
    derive: rows => rows.map(r => ({ ...r, perDay: num(r.days) > 0 ? r2(num(r.amount) / num(r.days)) : '' })),
    fields: [
      { k: 'date', label: 'Paid on', t: 'date', req: 1 }, { k: 'name', label: 'Name', t: 'text', req: 1 },
      { k: 'from', label: 'Work from', t: 'date' }, { k: 'to', label: 'Work to', t: 'date' },
      { k: 'days', label: 'Days attended', t: 'number', hint: 'Auto from dates · edit if absent on some days',
        auto: { deps: ['from', 'to'], fn: v => (v.from && v.to) ? Math.max(1, Math.round((new Date(v.to) - new Date(v.from)) / 864e5) + 1) : '' } },
      { k: 'amount', label: 'Amount paid (₹)', t: 'number', req: 1 }, fNote
    ],
    cols: [{ k: 'date', label: 'Paid on', t: 'date' }, { k: 'name', label: 'Name' }, { k: 'from', label: 'From', t: 'date' }, { k: 'to', label: 'To', t: 'date' },
      { k: 'days', label: 'Days', t: 'num', sum: 1 }, { k: 'amount', label: 'Amount paid', t: 'money', sum: 1 }, { k: 'perDay', label: 'Per day', t: 'money' }, cNote]
  },
  {
    key: 'shopBuy', title: 'Items Taken on Credit',
    fields: [fDate, { k: 'item', label: 'Item (plastic, wire, nails…)', t: 'text', req: 1 }, { k: 'qty', label: 'Quantity', t: 'text', ph: 'e.g. 5 kg' }, { k: 'amount', label: 'Amount (₹)', t: 'number' }, fNote],
    cols: [cDate, { k: 'item', label: 'Item' }, { k: 'qty', label: 'Qty' }, { k: 'amount', label: 'Amount', t: 'money', sum: 1 }, cNote]
  },
  {
    key: 'shopPay', title: 'Payments Made to Shop',
    fields: [fDate, { k: 'amount', label: 'Amount paid (₹)', t: 'number', req: 1 }, { k: 'mode', label: 'Mode', t: 'select', opts: PAY_MODES, def: 'Cash' }, fNote],
    cols: [cDate, { k: 'amount', label: 'Amount paid', t: 'money', sum: 1 }, { k: 'mode', label: 'Mode' }, cNote]
  },
  {
    key: 'cashGiven', title: 'Cash Given to Munshi',
    fields: [fDate, { k: 'amount', label: 'Cash given (₹)', t: 'number', req: 1 }, fNote],
    cols: [cDate, { k: 'amount', label: 'Amount', t: 'money', sum: 1 }, cNote]
  },
  {
    key: 'cashSpent', title: 'Expenses Made by Munshi',
    fields: [fDate, { k: 'particular', label: 'Spent on (particular)', t: 'text', req: 1, ph: 'e.g. diesel, tea, tools' }, { k: 'amount', label: 'Amount spent (₹)', t: 'number', req: 1 }, fNote],
    cols: [cDate, { k: 'particular', label: 'Particular' }, { k: 'amount', label: 'Amount', t: 'money', sum: 1 }, cNote]
  },
  {
    key: 'cashLedger', title: 'Munshi Cash Register (combined)', readonly: true,
    source: () => {
      const items = [
        ...R('cashGiven').map(r => ({ date: r.date, _t: r._t, part: 'Cash received' + (r.note ? ' — ' + r.note : ''), credit: num(r.amount), debit: 0 })),
        ...R('cashSpent').map(r => ({ date: r.date, _t: r._t, part: r.particular + (r.note ? ' (' + r.note + ')' : ''), credit: 0, debit: num(r.amount) }))
      ];
      let bal = 0;
      return sortAsc(items).map(x => ({ ...x, balance: (bal += x.credit - x.debit) }));
    },
    cols: [cDate, { k: 'part', label: 'Particulars' }, { k: 'credit', label: 'Cash in', t: 'money', sum: 1, blank0: 1 }, { k: 'debit', label: 'Spent', t: 'money', sum: 1, blank0: 1 }, { k: 'balance', label: 'Cash left', t: 'money', last: 1 }]
  },
  {
    key: 'creditIn', title: 'Contributions Received', derive: cumulate('amount', 'cum'),
    fields: [fDate, { k: 'amount', label: 'Amount (₹)', t: 'number', req: 1 }, { k: 'note', label: 'Purpose / remarks', t: 'text', ph: 'optional' }],
    cols: [cDate, { k: 'amount', label: 'Amount', t: 'money', sum: 1 }, { k: 'cum', label: 'Total so far', t: 'money' }, cNote]
  },
  {
    key: 'creditOut', title: 'Repayments Made',
    fields: [fDate, { k: 'amount', label: 'Amount repaid (₹)', t: 'number', req: 1 }, fNote],
    cols: [cDate, { k: 'amount', label: 'Amount', t: 'money', sum: 1 }, cNote]
  },
  {
    key: 'misc', title: 'Local Labour — Misc Work',
    fields: [fDate, { k: 'name', label: 'Mistri / Labour', t: 'text', req: 1 }, { k: 'work', label: 'Work type', t: 'text', req: 1 }, { k: 'amount', label: 'Amount (₹)', t: 'number', hint: 'optional' }, fNote],
    cols: [cDate, { k: 'name', label: 'Mistri / Labour' }, { k: 'work', label: 'Work type' }, { k: 'amount', label: 'Amount', t: 'money', sum: 1 }, cNote]
  },
  {
    key: 'lhead', title: 'Labour Supplied & Payment',
    fields: [fDate, { k: 'labour', label: 'Labour (nos.)', t: 'number' }, { k: 'mistri', label: 'Mistri (nos.)', t: 'number' }, { k: 'amount', label: 'Payment (₹)', t: 'number', req: 1 }, fNote],
    cols: [cDate, { k: 'labour', label: 'Labour', t: 'num', sum: 1 }, { k: 'mistri', label: 'Mistri', t: 'num', sum: 1 }, { k: 'amount', label: 'Payment', t: 'money', sum: 1 }, cNote]
  },
  {
    key: 'cement', title: 'Cement Register (bags)',
    derive: rows => { let left = 0; return rows.map(r => ({ ...r, left: (left += num(r.received) - num(r.used)) })); },
    fields: [fDate, { k: 'received', label: 'Received (bags)', t: 'number' }, { k: 'used', label: 'Used (bags)', t: 'number' }, { k: 'work', label: 'Work type', t: 'text', ph: 'where it was used' }, fNote],
    cols: [cDate, { k: 'received', label: 'Received', t: 'num', sum: 1, blank0: 1 }, { k: 'used', label: 'Used', t: 'num', sum: 1, blank0: 1 }, { k: 'left', label: 'Left stock', t: 'num', last: 1, neg: 1 }, { k: 'work', label: 'Work type' }, cNote],
    validate: v => (num(v.received) || num(v.used)) ? null : 'Enter bags received or bags used.'
  }
];
const TB = Object.fromEntries(TABLE_LIST.map(t => [t.key, t]));

/* ---------------- data ---------------- */
const DEFAULT_META = { project: 'My Construction Site', site: '', contractor: 'Contractor', contractValue: 0, munshi: 'Munshi', labourHead: 'Labour Head', creditor: 'Rocky Singhania', shop: 'Scientific' };
let db = null;
let lastDate = todayStr();
let cur = { tab: 'dashboard', sub: '' };
const state = { q: '' };
const tt = x => typeof x === 'function' ? x(db.meta) : x;

function blankDB() {
  const data = {};
  TABLE_LIST.forEach(t => { if (!t.readonly) data[t.key] = []; });
  return { v: 1, meta: { ...DEFAULT_META }, data };
}
function normalize(o) {
  const d = blankDB();
  if (o && o.meta) Object.assign(d.meta, o.meta);
  if (o && o.data) Object.keys(d.data).forEach(k => {
    if (Array.isArray(o.data[k])) d.data[k] = o.data[k].map(r => ({ ...r, id: r.id || uid(), _t: r._t || Date.now() }));
  });
  return d;
}
function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(db)); } catch (e) { toast('Could not save in this browser (private mode?). Download a backup.', 'err'); } }
function R(key) {
  const T = TB[key];
  if (T.source) return T.source();
  const rows = sortAsc(db.data[key] || []);
  return T.derive ? T.derive(rows) : rows;
}

/* ---------------- accounting ---------------- */
const CATS = [
  { id: 'bricks', sec: 'bricks', label: 'Bricks', icon: '🧱', color: '#ef4444', bill: 'bricks' },
  { id: 'sand', sec: 'sand', label: 'Sand', icon: '🚜', color: '#f59e0b', bill: 'sand' },
  { id: 'aggregate', sec: 'aggregate', label: 'Aggregate', icon: '⛰️', color: '#eab308', bill: 'aggregate' },
  { id: 'steel', sec: 'steel', label: 'Steel', icon: '🏗️', color: '#6366f1', bill: 'steelBuy' },
  { id: 'soil', sec: 'soil', label: 'Soil Filling', icon: '🌍', color: '#a16207', bill: 'soil' },
  { id: 'shop', sec: 'shop', label: 'Credit Shop', icon: '🛒', color: '#0ea5e9', credit: ['shopBuy', 'shopPay'] },
  { id: 'contractor', sec: 'contractor', label: 'Contractor', icon: '👷', color: '#14b8a6', paidOnly: 'contractorPay' },
  { id: 'salary', sec: 'salary', label: 'Salary', icon: '🧾', color: '#8b5cf6', paidOnly: 'salary' },
  { id: 'cash', sec: 'cash', label: 'Munshi Expenses', icon: '👛', color: '#ec4899', paidOnly: 'cashSpent' },
  { id: 'misc', sec: 'misc', label: 'Local Labour', icon: '🔨', color: '#84cc16', paidOnly: 'misc' },
  { id: 'lhead', sec: 'lhead', label: 'Labour Head', icon: '👥', color: '#f97316', paidOnly: 'lhead' }
];
function catStats(c) {
  if (c.bill) {
    const rows = R(c.bill);
    return { billed: sum(rows, 'total'), paid: sum(rows, 'paid'), due: rows.reduce((a, r) => a + Math.max(0, r.bal), 0), adv: rows.reduce((a, r) => a + Math.max(0, -r.bal), 0) };
  }
  if (c.credit) {
    const b = sum(R(c.credit[0]), 'amount'), p = sum(R(c.credit[1]), 'amount');
    return { billed: b, paid: p, due: Math.max(0, b - p), adv: Math.max(0, p - b) };
  }
  const t = sum(R(c.paidOnly), 'amount');
  return { billed: t, paid: t, due: 0, adv: 0 };
}
function steelStock(size) {
  const b = R('steelBuy').filter(r => r.size === size), u = R('steelUse').filter(r => r.size === size);
  const bought = sum(b, 'qty'), used = sum(u, 'qty');
  return { size, bought, used, left: r2(bought - used) };
}
function stats() {
  const cats = CATS.map(c => ({ ...c, ...catStats(c) }));
  const tot = cats.reduce((a, c) => ({ billed: a.billed + c.billed, paid: a.paid + c.paid, due: a.due + c.due, adv: a.adv + c.adv }), { billed: 0, paid: 0, due: 0, adv: 0 });
  const cem = R('cement');
  const given = sum(R('cashGiven'), 'amount'), spent = sum(R('cashSpent'), 'amount');
  const cin = sum(R('creditIn'), 'amount'), cout = sum(R('creditOut'), 'amount');
  const taken = sum(R('contractorPay'), 'amount'), value = num(db.meta.contractValue);
  return {
    cats, tot,
    cement: { rec: sum(cem, 'received'), used: sum(cem, 'used'), left: r2(sum(cem, 'received') - sum(cem, 'used')) },
    steel: STEEL_SIZES.map(steelStock),
    munshi: { given, spent, left: r2(given - spent) },
    credit: { in: cin, out: cout, bal: r2(cin - cout) },
    contractor: { taken, value, bal: r2(value - taken) }
  };
}

/* ---------------- sections ---------------- */
function billLines(key, qtyInfo) {
  const rows = R(key);
  const out = [];
  if (qtyInfo) out.push([qtyInfo.label, sum(rows, qtyInfo.key), '', 'num']);
  const due = rows.reduce((a, r) => a + Math.max(0, r.bal), 0), adv = rows.reduce((a, r) => a + Math.max(0, -r.bal), 0);
  out.push(['Billed', sum(rows, 'total')], ['Paid', sum(rows, 'paid'), 'good'], ['Due', due, due > 0 ? 'bad' : '']);
  if (adv > 0) out.push(['Advance (unadjusted)', adv, 'warn']);
  return out;
}
const SECTIONS = [
  { id: 'bricks', icon: '🧱', short: 'Bricks', title: 'Bricks', tables: ['bricks'], lines: () => billLines('bricks', { label: 'Bricks received', key: 'qty' }) },
  { id: 'sand', icon: '🚜', short: 'Sand', title: 'Sand — Tractor Trips', tables: ['sand'], lines: () => billLines('sand', { label: 'Trips', key: 'qty' }) },
  { id: 'aggregate', icon: '⛰️', short: 'Aggregate', title: 'Aggregate (20mm / Dust)', tables: ['aggregate'], lines: () => billLines('aggregate') },
  { id: 'steel', icon: '🏗️', short: 'Steel', title: 'Steel (8 / 10 / 12 / 16 mm)', tables: ['steelBuy', 'steelUse'], lines: () => billLines('steelBuy', { label: 'Bundles bought', key: 'qty' }) },
  { id: 'soil', icon: '🌍', short: 'Soil Filling', title: 'Soil Filling — Tractor Trips', tables: ['soil'], lines: () => billLines('soil', { label: 'Trips', key: 'qty' }) },
  { id: 'contractor', icon: '👷', short: 'Contractor', title: m => `Contractor — ${m.contractor}`, tables: ['contractorPay'],
    lines: () => { const s = stats().contractor; const o = [['Total taken', s.taken, 'good']]; if (s.value > 0) o.push(['Contract value', s.value], ['Balance to give', s.bal, s.bal < 0 ? 'bad' : 'warn']); return o; } },
  { id: 'salary', icon: '🧾', short: 'Salary', title: 'Munshi / Local Labour — Salary', tables: ['salary'],
    lines: () => [['Total paid', sum(R('salary'), 'amount'), 'good'], ['Days covered', sum(R('salary'), 'days'), '', 'num']] },
  { id: 'shop', icon: '🛒', short: 'Credit Shop', title: m => `${m.shop} — Small Materials on Credit`, tables: ['shopBuy', 'shopPay'],
    lines: () => { const b = sum(R('shopBuy'), 'amount'), p = sum(R('shopPay'), 'amount'); return [['Taken on credit', b], ['Paid', p, 'good'], ['Balance due', b - p, b - p > 0 ? 'bad' : 'good']]; } },
  { id: 'cash', icon: '👛', short: 'Munshi Cash', title: m => `${m.munshi} — Expense Register`, tables: ['cashGiven', 'cashSpent', 'cashLedger'],
    lines: () => { const s = stats().munshi; return [['Cash given', s.given], ['Spent', s.spent, 'warn'], ['Cash left', s.left, s.left < 0 ? 'bad' : 'good']]; } },
  { id: 'rocky', icon: '🤝', short: 'Creditor', title: m => `Creditor — ${m.creditor}`, tables: ['creditIn', 'creditOut'],
    lines: () => { const s = stats().credit; return [['Contributed', s.in], ['Repaid', s.out, 'good'], ['Outstanding', s.bal, s.bal > 0 ? 'bad' : 'good']]; } },
  { id: 'misc', icon: '🔨', short: 'Local Labour', title: 'Local Labour — Misc Work', tables: ['misc'], lines: () => [['Entries', R('misc').length, '', 'num'], ['Amount', sum(R('misc'), 'amount')]] },
  { id: 'lhead', icon: '👥', short: 'Labour Head', title: m => `Labour Head — ${m.labourHead}`, tables: ['lhead'],
    lines: () => [['Labour days', sum(R('lhead'), 'labour'), '', 'num'], ['Mistri days', sum(R('lhead'), 'mistri'), '', 'num'], ['Paid', sum(R('lhead'), 'amount'), 'good']] },
  { id: 'cement', icon: '📦', short: 'Cement', title: 'Cement Stock', tables: ['cement'],
    lines: () => { const s = stats().cement; return [['Received (bags)', s.rec, '', 'num'], ['Used (bags)', s.used, '', 'num'], ['In stock (bags)', s.left, s.left < 0 ? 'bad' : 'good', 'num']]; } }
];
const SEC = Object.fromEntries(SECTIONS.map(s => [s.id, s]));

/* ---------------- cell / table rendering ---------------- */
const balHTML = n => n > 0 ? `<span class="badge due">Due ${inr(n)}</span>` : n < 0 ? `<span class="badge adv">Advance ${inr(-n)}</span>` : '<span class="badge paid">Settled</span>';
const balText = n => n > 0 ? `Due ${rs(n)}` : n < 0 ? `Advance ${rs(-n)}` : 'Settled';
function statusHTML(r) {
  if (r.status === 'none') return '<span class="muted">—</span>';
  const tip = (r.log && r.log.length) ? ` title="Payments: ${esc(r.log.map(l => fmtDate(l.date) + ' ' + inr(l.amt)).join(' · '))}"` : '';
  if (r.status === 'due') return `<span class="badge due"${tip}>Due ${inr(r.bal)}</span>`;
  if (r.status === 'adv') return `<span class="badge adv"${tip}>Advance ${inr(-r.bal)}</span>`;
  return `<span class="badge paid"${tip}>Paid</span>`;
}
const statusText = r => r.status === 'due' ? `Due ${rs(r.bal)}` : r.status === 'adv' ? `Advance ${rs(-r.bal)}` : r.status === 'paid' ? 'Paid' : '';
const blank = v => v === '' || v === undefined || v === null;
function cellHTML(c, r) {
  const v = r[c.k];
  switch (c.t) {
    case 'date': return esc(fmtDate(v));
    case 'money': return blank(v) || (c.blank0 && !num(v)) ? '' : inr(v);
    case 'num': return blank(v) || (c.blank0 && !num(v)) ? '' : (c.neg && num(v) < 0 ? `<span class="neg">${fmtNum(v)}</span>` : fmtNum(v));
    case 'status': return statusHTML(r);
    default: return esc(v ?? '');
  }
}
function cellText(c, r) {
  const v = r[c.k];
  switch (c.t) {
    case 'date': return fmtDate(v);
    case 'money': return blank(v) || (c.blank0 && !num(v)) ? '' : rs(v);
    case 'num': return blank(v) || (c.blank0 && !num(v)) ? '' : fmtNum(v);
    case 'status': return statusText(r);
    default: return String(v ?? '');
  }
}
function footCells(T, rows) {
  return T.cols.map((c, i) => {
    if (c.sum) { const s = rows.reduce((a, r) => a + num(r[c.k]), 0); return c.t === 'money' ? { html: inr(s), text: rs(s) } : { html: fmtNum(s), text: fmtNum(s) }; }
    if (c.t === 'status' && T.bill) { const n = r2(rows.reduce((a, r) => a + num(r.bal), 0)); return { html: balHTML(n), text: balText(n) }; }
    if (c.last) { const v = rows[rows.length - 1][c.k]; return c.t === 'money' ? { html: inr(v), text: rs(v) } : { html: fmtNum(v), text: fmtNum(v) }; }
    return i === 0 ? { html: 'Total', text: 'TOTAL' } : { html: '', text: '' };
  });
}
function tableHTML(T, o = {}) {
  let rows = R(T.key);
  if (o.filter) rows = rows.filter(o.filter);
  if (o.q) rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(o.q));
  if (!rows.length) return `<div class="empty">${o.q ? 'No matching entries' : 'No entries yet'}</div>`;
  const rt = c => (c.t === 'num' || c.t === 'money') ? ' class="r"' : '';
  const head = T.cols.map(c => `<th${rt(c)}>${esc(c.label)}</th>`).join('') + (o.actions ? '<th></th>' : '');
  const body = [...rows].reverse().map(r => `<tr>${T.cols.map(c => `<td${rt(c)}>${cellHTML(c, r)}</td>`).join('')}${o.actions ? actionsHTML(T, r) : ''}</tr>`).join('');
  const foot = footCells(T, rows);
  const hasFoot = T.cols.some(c => c.sum || c.last || (c.t === 'status' && T.bill));
  const tf = hasFoot ? `<tfoot><tr>${foot.map((f, i) => `<td${rt(T.cols[i])}>${f.html}</td>`).join('')}${o.actions ? '<td></td>' : ''}</tr></tfoot>` : '';
  return `<div class="tscroll"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${tf}</table></div>`;
}
function actionsHTML(T, r) {
  const a = (act, icon, title, cls = '') => `<button class="ib ${cls}" title="${title}" data-act="${act}" data-t="${T.key}" data-id="${r.id}">${icon}</button>`;
  return `<td class="act">${T.bill && r.bal > 0 ? a('pay', '₹', 'Record a payment') : ''}${a('edit', '✎', 'Edit')}${a('del', '🗑', 'Delete', 'del')}</td>`;
}
function chipsHTML(lines) {
  return `<div class="chips">${lines.map(([l, v, tone, kind]) => `<div class="chip ${tone || ''}"><span>${esc(l)}</span><b>${esc(fmtKind(v, kind))}</b></div>`).join('')}</div>`;
}
function steelChips() {
  return `<div class="chips">${STEEL_SIZES.map(sz => { const s = steelStock(sz); return `<button class="chip steelchip" data-act="steel" data-size="${sz}"><span>${sz} steel</span><b>${fmtNum(s.left)} bundles left</b><u>Usage details →</u></button>`; }).join('')}</div>`;
}
const secTopHTML = S => chipsHTML(S.lines()) + (S.id === 'steel' ? steelChips() : '');

/* ---------------- forms ---------------- */
function fieldHTML(f, ctx) {
  if (ctx.fixed && ctx.fixed[f.k] !== undefined) return `<input type="hidden" name="${f.k}" value="${esc(ctx.fixed[f.k])}">`;
  const def = f.t === 'date' ? lastDate : (f.def ?? '');
  const req = f.req ? ' required' : '';
  let input;
  if (f.t === 'select') {
    input = `<select name="${f.k}"${req}>${(f.req && f.def === undefined) ? '<option value="">Select…</option>' : ''}${f.opts.map(o => `<option${o === def ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
  } else if (f.t === 'number') {
    input = `<input name="${f.k}" type="number" inputmode="decimal" step="any" min="0" value="${esc(def)}" placeholder="${esc(f.ph || '')}"${req}>`;
  } else if (f.t === 'date') {
    input = `<input name="${f.k}" type="date" value="${esc(def)}"${req}>`;
  } else {
    input = `<input name="${f.k}" type="text" value="${esc(def)}" placeholder="${esc(f.ph || '')}"${req}>`;
  }
  return `<label class="fld"><span>${esc(f.label)}${f.req ? ' <em>*</em>' : ''}</span>${input}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`;
}
function formHTML(T, ctx = {}) {
  return `<form class="entry" data-table="${T.key}" autocomplete="off"><div class="form-grid">${T.fields.map(f => fieldHTML(f, ctx)).join('')}</div>
  <div class="form-actions"><button class="btn primary" type="submit">＋ Add entry</button><button type="button" class="btn ghost" data-act="cancel" hidden>Cancel edit</button></div></form>`;
}
const getVals = (form, T) => { const v = {}; T.fields.forEach(f => { const el = form.elements[f.k]; v[f.k] = el ? el.value.trim() : ''; }); return v; };
function recompute(form, T) {
  T.fields.forEach(f => {
    if (!f.auto) return;
    const el = form.elements[f.k];
    if (!el || el.dataset.dirty === '1') return;
    const v = f.auto.fn(getVals(form, T));
    el.value = (v === '' || v == null) ? '' : r2(v);
  });
}
function resetForm(form, T) {
  form.reset();
  delete form.dataset.editing;
  form.classList.remove('editing');
  $('[type=submit]', form).textContent = '＋ Add entry';
  $('[data-act=cancel]', form).hidden = true;
  T.fields.forEach(f => { const el = form.elements[f.k]; if (!el) return; delete el.dataset.dirty; if (f.t === 'date') el.value = lastDate; });
}
function saveForm(form) {
  const T = TB[form.dataset.table];
  const raw = getVals(form, T), v = {};
  T.fields.forEach(f => { v[f.k] = f.t === 'number' ? (raw[f.k] === '' ? '' : num(raw[f.k])) : raw[f.k]; });
  const err = T.validate && T.validate(v);
  if (err) { toast(err, 'err'); return; }
  if (v.date) lastDate = v.date;
  const arr = db.data[T.key], eid = form.dataset.editing;
  if (eid) { const i = arr.findIndex(r => r.id === eid); if (i >= 0) arr[i] = { ...arr[i], ...v }; toast('Entry updated ✓'); }
  else { arr.push({ id: uid(), _t: Date.now(), ...v }); toast('Entry added ✓'); }
  save(); resetForm(form, T); afterChange();
}
function startEdit(tKey, id, scope) {
  const T = TB[tKey], row = db.data[tKey].find(r => r.id === id);
  const form = scope.querySelector(`form.entry[data-table="${tKey}"]`);
  if (!row || !form) return;
  T.fields.forEach(f => { const el = form.elements[f.k]; if (el) el.value = blank(row[f.k]) ? '' : row[f.k]; });
  T.fields.filter(f => f.auto).forEach(f => {
    const el = form.elements[f.k], calc = f.auto.fn(getVals(form, T));
    const same = (calc === '' && el.value === '') || (calc !== '' && el.value !== '' && Math.abs(num(calc) - num(el.value)) < 0.005);
    el.dataset.dirty = same ? '' : '1';
  });
  form.dataset.editing = id; form.classList.add('editing');
  $('[type=submit]', form).textContent = '✓ Save changes';
  $('[data-act=cancel]', form).hidden = false;
  form.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------------- views ---------------- */
const view = $('#view');

function kpi(label, value, sub, cls, icon) {
  return `<div class="kpi ${cls}"><div class="ic">${icon}</div><div class="l">${esc(label)}</div><div class="v">${value}</div><div class="s">${sub}</div></div>`;
}
function donutHTML(cats, total) {
  if (total <= 0) return '<div class="empty">Add entries to see the spread.</div>';
  let acc = 0;
  const segs = cats.filter(c => c.billed > 0).map(c => { const a = acc / total * 100; acc += c.billed; return `${c.color} ${a}% ${acc / total * 100}%`; });
  const legend = [...cats].filter(c => c.billed > 0).sort((a, b) => b.billed - a.billed)
    .map(c => `<li><i style="background:${c.color}"></i>${c.icon} ${esc(c.label)}<span>${Math.round(c.billed / total * 100)}%</span></li>`).join('');
  return `<div class="donut-wrap"><div class="donut" style="background:conic-gradient(${segs.join(',')})"><div class="donut-in"><b>${inr(total)}</b><span>total</span></div></div><ul class="legend">${legend}</ul></div>`;
}
function recentItems() {
  const items = [];
  TABLE_LIST.filter(t => !t.readonly).forEach(T => {
    const S = SECTIONS.find(s => s.tables.includes(T.key));
    R(T.key).forEach(r => {
      let amt;
      if (T.key === 'cement') amt = (num(r.received) ? '+' + fmtNum(r.received) + ' bags ' : '') + (num(r.used) ? '−' + fmtNum(r.used) + ' bags' : '');
      else if (T.key === 'steelUse') amt = fmtNum(r.qty) + ' bundles used';
      else { const a = T.bill ? (num(r.total) || num(r.paid)) : num(r.amount); amt = a ? inr(a) : ''; }
      items.push({ date: r.date, _t: r._t || 0, sec: S.id, title: tt(S.short) === S.short ? S.short : S.short, label: r.party || r.item || r.particular || r.name || r.work || r.size || r.material || '', amt });
    });
  });
  return items.sort((a, b) => b.date.localeCompare(a.date) || b._t - a._t).slice(0, 10);
}
function renderDashboard() {
  const s = stats(), m = db.meta;
  const pct = s.tot.billed > 0 ? Math.min(999, Math.round(s.tot.paid / s.tot.billed * 100)) : 0;
  const sorted = [...s.cats].sort((a, b) => b.billed - a.billed);
  const max = Math.max(1, ...sorted.map(c => c.billed));
  const bars = sorted.map(c => {
    const dueP = Math.min(c.due, c.billed), paidP = Math.max(0, c.billed - dueP);
    return `<div class="bar-row"><a class="bl" href="#/records/${c.sec}">${c.icon} ${esc(c.label)}</a><div class="bar"><i class="p" style="width:${paidP / max * 100}%"></i><i class="d" style="width:${dueP / max * 100}%"></i></div><div class="bv">${inr(c.billed)}${c.due > 0 ? `<small>Due ${inr(c.due)}</small>` : ''}</div></div>`;
  }).join('');
  const dues = sorted.filter(c => c.due > 0 || c.adv > 0).sort((a, b) => b.due - a.due)
    .map(c => `<a class="li" href="#/update/${c.sec}"><div class="t"><b>${c.icon} ${esc(c.label)}</b><small>Billed ${inr(c.billed)} · Paid ${inr(c.paid)}</small></div><div class="a ${c.due > 0 ? 'neg' : ''}">${c.due > 0 ? 'Due ' + inr(c.due) : 'Advance ' + inr(c.adv)}</div></a>`).join('');
  const recent = recentItems().map(i => `<a class="li" href="#/records/${i.sec}"><div class="d">${fmtDate(i.date).slice(0, 6)}</div><div class="t"><b>${esc(i.title)}</b><small>${esc(i.label)}</small></div><div class="a">${esc(i.amt)}</div></a>`).join('');
  const stockCard = (ic, l, v, sub, href, cls = '') => `<a class="stock" href="${href}"><div class="s-ic">${ic}</div><div><div class="s-l">${l}</div><div class="s-v ${cls}">${v}</div><div class="s-s">${sub}</div></div></a>`;
  const steel = s.steel.map(x => `<button class="stock" data-act="steel" data-size="${x.size}"><div class="s-ic">🏗️</div><div><div class="s-l">${x.size} steel</div><div class="s-v ${x.left < 0 ? 'neg' : ''}">${fmtNum(x.left)} <small style="font-size:12px;font-weight:600">bundles</small></div><div class="s-s">Bought ${fmtNum(x.bought)} · Used ${fmtNum(x.used)}</div><div class="s-link">View usage details →</div></div></button>`).join('');
  const contr = s.contractor;
  view.innerHTML = `<div class="page">
    <div class="kpis">
      ${kpi('Total expenditure', inr(s.tot.billed), `${s.cats.filter(c => c.billed > 0).length} heads · bills + direct payments`, 'k-orange', '💰')}
      ${kpi('Paid so far', inr(s.tot.paid), `${pct}% of expenditure`, 'k-green', '✅')}
      ${kpi('Outstanding dues', inr(s.tot.due), s.tot.adv > 0 ? `Advance given: ${inr(s.tot.adv)}` : 'To be paid to parties', 'k-red', '⏳')}
      ${kpi('Funding — ' + esc(m.creditor), inr(s.credit.bal), `Received ${inr(s.credit.in)} · Repaid ${inr(s.credit.out)}`, 'k-blue', '🤝')}
    </div>
    <div class="grid2">
      <div class="card"><h3>Spending by head</h3>${bars}<div class="bar-legend"><span><b style="background:#10b981"></b>Paid</span><span><b style="background:#f87171"></b>Due</span></div></div>
      <div class="card"><h3>Share of expenditure</h3>${donutHTML(s.cats, s.tot.billed)}</div>
    </div>
    <h3 class="sec-title">Stock &amp; balances</h3>
    <div class="stocks">
      ${stockCard('📦', 'Cement in stock', fmtNum(s.cement.left) + ' bags', `Received ${fmtNum(s.cement.rec)} · Used ${fmtNum(s.cement.used)}`, '#/records/cement', s.cement.left < 0 ? 'neg' : '')}
      ${stockCard('👛', esc(m.munshi) + ' — cash left', inr(s.munshi.left), `Given ${inr(s.munshi.given)} · Spent ${inr(s.munshi.spent)}`, '#/records/cash', s.munshi.left < 0 ? 'neg' : '')}
      <a class="stock" href="#/records/contractor"><div class="s-ic">👷</div><div style="flex:1"><div class="s-l">${esc(m.contractor)} — taken</div><div class="s-v">${inr(contr.taken)}</div>${contr.value > 0 ? `<div class="prog"><i style="width:${Math.min(100, contr.taken / contr.value * 100)}%"></i></div><div class="s-s">of ${inr(contr.value)} · balance ${inr(contr.bal)}</div>` : '<div class="s-s">Set contract value in Settings to track balance</div>'}</div></a>
      ${steel}
    </div>
    <div class="grid2">
      <div class="card"><h3>Dues &amp; advances by head</h3><div class="list">${dues || '<div class="empty">All clear — nothing pending 🎉</div>'}</div></div>
      <div class="card"><h3>Recent entries</h3><div class="list">${recent || '<div class="empty">No entries yet. Go to the Update tab to add.</div>'}</div></div>
    </div>
  </div>`;
}

function recSection(S) {
  return `<section class="card sec" id="sec-${S.id}"><div class="sec-h"><h3>${S.icon} ${esc(tt(S.title))}</h3><button class="btn sm" data-act="pdf" data-sec="${S.id}">⬇ PDF</button></div>
  <div class="secTop">${secTopHTML(S)}</div>
  ${S.tables.map(k => `<div class="sub"><h4>${esc(tt(TB[k].title))}</h4>${tableHTML(TB[k], { q: state.q })}</div>`).join('')}</section>`;
}
function renderRecordsBody() { const el = $('#recSecs'); if (el) el.innerHTML = SECTIONS.map(recSection).join(''); }
function renderRecords(sub) {
  view.innerHTML = `<div class="page">
    <div class="rec-top"><div><h2>All Records</h2><p class="muted" style="margin:3px 0 0">Everything in one place. Download any section — or the whole book — as PDF.</p></div>
    <div class="rec-tools"><input id="q" class="search" type="search" placeholder="Search all records…" value="${esc(state.q)}"><button class="btn primary" data-act="pdfAll">⬇ Full PDF</button></div></div>
    <div class="chips-nav">${SECTIONS.map(s => `<a href="#/records/${s.id}">${s.icon} ${esc(s.short)}</a>`).join('')}</div>
    <div id="recSecs"></div></div>`;
  renderRecordsBody();
  if (sub) { const el = $('#sec-' + sub); if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 30); }
}

function blockHTML(T) {
  return `<div class="card blk"><div class="blk-h"><h3>${esc(tt(T.title))}</h3></div>${formHTML(T)}<div class="tbl-wrap" id="tbl-${T.key}">${tableHTML(T, { actions: true })}</div></div>`;
}
function refreshUpdate() {
  const S = SEC[cur.sub] || SECTIONS[0];
  S.tables.forEach(k => { const el = $('#tbl-' + k); if (el) el.innerHTML = tableHTML(TB[k], { actions: true }); });
  const top = $('#secTop'); if (top) top.innerHTML = secTopHTML(S);
}
function renderUpdate(sub) {
  const S = SEC[sub] || SECTIONS[0];
  cur.sub = S.id;
  view.innerHTML = `<div class="page"><div class="upd">
    <aside class="side">${SECTIONS.map(s => `<a href="#/update/${s.id}" class="${s.id === S.id ? 'on' : ''}"><span>${s.icon}</span>${esc(s.short)}</a>`).join('')}</aside>
    <section>
      <div class="sec-head"><div><h2>${S.icon} ${esc(tt(S.title))}</h2><p>Add a new entry below. Use ✎ to correct, ₹ to record a later payment, 🗑 to delete.</p></div><button class="btn sm" data-act="pdf" data-sec="${S.id}">⬇ PDF</button></div>
      <div id="secTop">${secTopHTML(S)}</div>
      ${S.tables.filter(k => !TB[k].readonly).map(k => blockHTML(TB[k])).join('')}
    </section></div></div>`;
}

function renderSettings() {
  const m = db.meta, f = (k, l, t = 'text', hint = '') => `<label class="fld"><span>${l}</span><input name="${k}" type="${t}" ${t === 'number' ? 'min="0" step="any"' : ''} value="${esc(m[k])}">${hint ? `<small>${hint}</small>` : ''}</label>`;
  view.innerHTML = `<div class="page settings"><div class="card"><h3>Project details</h3>
    <form id="metaForm"><div class="form-grid">
      ${f('project', 'Project name')}${f('site', 'Site / location')}${f('contractor', 'Contractor name')}${f('contractValue', 'Contract value (₹)', 'number', 'Optional — shows balance on dashboard')}
      ${f('munshi', 'Munshi name')}${f('labourHead', 'Labour head name')}${f('creditor', 'Creditor / financier')}${f('shop', 'Credit shop name')}
    </div><div class="form-actions"><button class="btn primary" type="submit">Save details</button></div></form></div>
    <div class="card" style="margin-top:16px"><h3>Data &amp; backup</h3>
      <p class="note" style="margin-top:0">Your entries are stored in <b>this browser</b>. Download a backup regularly. To share the same data with others, publish <b>data.json</b> to your GitHub repo (see README).</p>
      <div class="tools">
        <button class="btn primary" data-act="backup">⬇ Download backup</button>
        <button class="btn" data-act="publish">⬇ Download data.json (to publish)</button>
        <button class="btn" data-act="restore">⬆ Restore from file</button>
        <button class="btn" data-act="loadPublished">⟳ Reload published data.json</button>
        <input type="file" id="restoreFile" accept=".json,application/json" hidden>
      </div>
      <div class="tools" style="margin-top:14px"><button class="btn" data-act="demo">Load demo data</button><button class="btn danger" data-act="reset">Erase everything</button></div>
      <p class="note">Restore / reload / demo replace the data currently in this browser.</p>
    </div></div>`;
}

/* ---------------- modal / toast ---------------- */
let modalFn = null, toastT;
function openModal(fn) { modalFn = fn; $('#modalRoot').innerHTML = `<div class="m-back"><div class="modal">${fn()}</div></div>`; document.body.classList.add('noscroll'); }
function refreshModal() { if (!modalFn) return; const m = $('#modalRoot .modal'); if (m) m.innerHTML = modalFn(); }
function closeModal() { modalFn = null; $('#modalRoot').innerHTML = ''; document.body.classList.remove('noscroll'); }
function toast(msg, type) { const t = $('#toast'); t.textContent = msg; t.className = 'show ' + (type || ''); clearTimeout(toastT); toastT = setTimeout(() => { t.className = ''; }, 2600); }

function steelModal(size) {
  openModal(() => {
    const s = steelStock(size);
    return `<div class="m-head"><h3>🏗️ ${size} steel — stock &amp; usage</h3><div><button class="btn sm" data-act="pdfSteel" data-size="${size}">⬇ PDF</button> <button class="x" data-act="closeModal">×</button></div></div>
    <div class="m-body">
      ${chipsHTML([['Bought (bundles)', s.bought, '', 'num'], ['Used (bundles)', s.used, 'warn', 'num'], ['In stock (bundles)', s.left, s.left < 0 ? 'bad' : 'good', 'num']])}
      <h4>Where it was used — day-wise</h4>${tableHTML(TB.steelUse, { filter: r => r.size === size, actions: true })}
      <h4>Record usage of ${size}</h4>${formHTML(TB.steelUse, { fixed: { size } })}
      <h4>Purchases of ${size}</h4>${tableHTML(TB.steelBuy, { filter: r => r.size === size })}
    </div>`;
  });
}
function payModal(tKey, id) {
  const T = TB[tKey], r = R(tKey).find(x => x.id === id); if (!r) return;
  openModal(() => `<div class="m-head"><h3>Record a payment</h3><button class="x" data-act="closeModal">×</button></div>
    <div class="m-body"><p class="muted" style="margin-top:0">${esc(tt(T.title))} · ${esc(fmtDate(r.date))} ${r.party ? '· ' + esc(r.party) : ''}</p>
    ${chipsHTML([['Total', r.total], ['Paid so far', r.paid, 'good'], ['Balance due', r.bal, r.bal > 0 ? 'bad' : 'good']])}
    <form id="payForm" data-t="${tKey}" data-id="${id}"><div class="form-grid">
      <label class="fld"><span>Amount paid now (₹)</span><input name="amt" type="number" step="any" min="0" value="${r.bal > 0 ? r.bal : ''}" required></label>
      <label class="fld"><span>Date</span><input name="date" type="date" value="${lastDate}" required></label>
    </div><div class="form-actions"><button class="btn primary" type="submit">Save payment</button></div></form></div>`);
}

/* ---------------- PDF ---------------- */
const PM = 36;
function newDoc() {
  const J = window.jspdf && window.jspdf.jsPDF;
  if (!J) { toast('PDF library could not load — check your internet connection.', 'err'); return null; }
  const doc = new J({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  if (typeof doc.autoTable !== 'function') { toast('PDF table plugin could not load — check your internet connection.', 'err'); return null; }
  return doc;
}
function pdfEnsure(doc, y, need) { if (y + need > doc.internal.pageSize.getHeight() - 44) { doc.addPage(); return 44; } return y; }
function pdfHead(doc, y, text, sub, size = 13) {
  y = pdfEnsure(doc, y, 64);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(size); doc.setTextColor(15, 23, 42); doc.text(text, PM, y);
  if (sub) { doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(100, 116, 139); doc.text(sub, PM, y + 13); return y + 22; }
  return y + 12;
}
function pdfTable(doc, y, head, body, foot, cs) {
  doc.autoTable({
    startY: y, head: [head], body, foot: foot ? [foot] : undefined, theme: 'grid', showFoot: 'lastPage',
    margin: { left: PM, right: PM, top: 44, bottom: 44 },
    styles: { fontSize: 8, cellPadding: 3.5, lineColor: [226, 232, 240], lineWidth: 0.5, textColor: [30, 41, 59] },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 251, 252] }, columnStyles: cs || {}
  });
  return doc.lastAutoTable.finalY + 16;
}
function pdfTableFor(doc, y, T, filter) {
  let rows = R(T.key); if (filter) rows = rows.filter(filter);
  const head = T.cols.map(c => c.label);
  const cs = {}; T.cols.forEach((c, i) => { if (c.t === 'num' || c.t === 'money') cs[i] = { halign: 'right' }; });
  if (!rows.length) return pdfTable(doc, y, head, [[{ content: 'No entries', colSpan: head.length, styles: { halign: 'center', textColor: [148, 163, 184] } }]], null, cs);
  const hasFoot = T.cols.some(c => c.sum || c.last || (c.t === 'status' && T.bill));
  return pdfTable(doc, y, head, rows.map(r => T.cols.map(c => cellText(c, r))), hasFoot ? footCells(T, rows).map(f => f.text) : null, cs);
}
const linesText = lines => lines.map(([l, v, , k]) => `${l}: ${fmtKindPdf(v, k)}`).join('     |     ');
function pdfSection(doc, y, S) {
  y = pdfHead(doc, y, tt(S.title), linesText(S.lines()));
  S.tables.forEach(k => {
    y = pdfEnsure(doc, y, 70);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.text(tt(TB[k].title).toUpperCase(), PM, y); y += 6;
    y = pdfTableFor(doc, y, TB[k]);
  });
  if (S.id === 'steel') {
    y = pdfEnsure(doc, y, 90);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(71, 85, 105); doc.text('STEEL STOCK BY SIZE', PM, y); y += 6;
    const st = STEEL_SIZES.map(steelStock);
    y = pdfTable(doc, y, ['Size', 'Bought (bundles)', 'Used (bundles)', 'In stock (bundles)'], st.map(s => [s.size, fmtNum(s.bought), fmtNum(s.used), fmtNum(s.left)]), null, { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } });
  }
  return y;
}
function pdfFinish(doc, name) {
  const n = doc.getNumberOfPages(), w = doc.internal.pageSize.getWidth(), h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(130, 140, 155);
    doc.text(`${db.meta.project}  •  Page ${i} of ${n}`, PM, h - 20);
    doc.text('Generated ' + fmtDate(todayStr()), w - PM, h - 20, { align: 'right' });
  }
  doc.save(name);
}
const pdfTitle = (doc, title) => {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(15, 23, 42); doc.text(title, PM, 52);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(100, 116, 139);
  doc.text([db.meta.site, 'Accounts report · ' + fmtDate(todayStr())].filter(Boolean).join('  ·  '), PM, 68);
  return 90;
};
function pdfSections(ids) {
  const doc = newDoc(); if (!doc) return;
  const secs = ids.map(i => SEC[i]);
  let y = pdfTitle(doc, secs.length === 1 ? `${db.meta.project} — ${tt(secs[0].title)}` : db.meta.project);
  if (secs.length === SECTIONS.length) {
    const s = stats();
    y = pdfHead(doc, y, 'Summary', null);
    y = pdfTable(doc, y, ['Total expenditure', 'Paid so far', 'Outstanding dues', 'Advance given (unadjusted)'], [[rs(s.tot.billed), rs(s.tot.paid), rs(s.tot.due), rs(s.tot.adv)]], null);
    y = pdfHead(doc, y, 'Spending by head', null);
    const cs = { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' } };
    y = pdfTable(doc, y, ['Head', 'Billed / spent', 'Paid', 'Due', 'Advance'], s.cats.map(c => [c.label, rs(c.billed), rs(c.paid), rs(c.due), rs(c.adv)]),
      ['TOTAL', rs(s.tot.billed), rs(s.tot.paid), rs(s.tot.due), rs(s.tot.adv)], cs);
    y = pdfHead(doc, y, 'Stock & balances', null);
    y = pdfTable(doc, y, ['Item', 'Value'], [
      ['Cement in stock', fmtNum(s.cement.left) + ' bags'],
      ...s.steel.map(x => [`Steel ${x.size} in stock`, fmtNum(x.left) + ' bundles']),
      [`${db.meta.munshi} — cash left`, rs(s.munshi.left)],
      [`${db.meta.contractor} — total taken`, rs(s.contractor.taken)],
      [`${db.meta.creditor} — outstanding`, rs(s.credit.bal)]
    ], null, { 1: { halign: 'right' } });
    secs.forEach(S => { doc.addPage(); pdfSection(doc, 44, S); });
  } else {
    secs.forEach((S, i) => { pdfSection(doc, y, S); if (i < secs.length - 1) { doc.addPage(); y = 44; } });
  }
  pdfFinish(doc, `${slug(db.meta.project)}_${secs.length === 1 ? secs[0].id : 'full-report'}_${todayStr()}.pdf`);
}
function pdfSteel(size) {
  const doc = newDoc(); if (!doc) return;
  let y = pdfTitle(doc, `${db.meta.project} — ${size} Steel`);
  const s = steelStock(size);
  y = pdfHead(doc, y, 'Stock', `Bought: ${fmtNum(s.bought)} bundles     |     Used: ${fmtNum(s.used)} bundles     |     In stock: ${fmtNum(s.left)} bundles`);
  y = pdfHead(doc, y, 'Where it was used', null, 11); y = pdfTableFor(doc, y, TB.steelUse, r => r.size === size);
  y = pdfHead(doc, y, 'Purchases', null, 11); pdfTableFor(doc, y, TB.steelBuy, r => r.size === size);
  pdfFinish(doc, `${slug(db.meta.project)}_steel-${size}_${todayStr()}.pdf`);
}

/* ---------------- data tools ---------------- */
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function demoData() {
  const D = (m, d) => `2026-${pad(m)}-${pad(d)}`; let c = 0;
  const mk = a => a.map(o => ({ id: uid(), _t: Date.now() + (c++), ...o }));
  const d = blankDB();
  d.meta = { ...DEFAULT_META, project: 'Sharma Residence (Demo)', site: 'Plot 14, Sector 5', contractValue: 900000 };
  d.data.bricks = mk([{ date: D(7, 5), party: 'Shree Brick Works', qty: 10000, rate: 7200, total: 72000, paid: 72000 }, { date: D(8, 12), party: 'Shree Brick Works', qty: 15000, rate: 7200, total: 108000, paid: 50000 }, { date: D(10, 2), party: 'Shree Brick Works', qty: '', rate: '', total: 0, paid: 30000, note: 'Advance for next lot' }]);
  d.data.sand = mk([{ date: D(7, 8), party: 'Ramesh', qty: 6, rate: 3200, total: 19200, paid: 19200 }, { date: D(8, 20), party: 'Ramesh', qty: 8, rate: 3200, total: 25600, paid: 10000 }]);
  d.data.aggregate = mk([{ date: D(7, 20), party: 'Stone Crusher', material: '20mm', unit: 'Trip', qty: 4, rate: 6500, total: 26000, paid: 26000 }, { date: D(8, 25), party: 'Stone Crusher', material: 'Dust', unit: 'Trip', qty: 3, rate: 4800, total: 14400, paid: 0 }]);
  d.data.steelBuy = mk([{ date: D(7, 25), party: 'Kumar Steel', size: '16mm', qty: 60, rate: 3800, total: 228000, paid: 150000 }, { date: D(7, 25), party: 'Kumar Steel', size: '10mm', qty: 30, rate: 3500, total: 105000, paid: 105000 }, { date: D(8, 30), party: 'Kumar Steel', size: '8mm', qty: 25, rate: 3400, total: 85000, paid: 40000 }, { date: D(9, 5), party: 'Kumar Steel', size: '12mm', qty: 20, rate: 3600, total: 72000, paid: 72000 }]);
  d.data.steelUse = mk([{ date: D(8, 2), size: '16mm', qty: 18, work: 'Footing & column starter' }, { date: D(9, 1), size: '16mm', qty: 22, work: 'Slab beams — ground floor' }, { date: D(8, 3), size: '10mm', qty: 9, work: 'Column stirrups' }, { date: D(9, 8), size: '12mm', qty: 6, work: 'Lintel band' }]);
  d.data.soil = mk([{ date: D(7, 10), party: 'Tractor — Sunil', area: 'Plinth', qty: 12, rate: 900, total: 10800, paid: 10800 }, { date: D(7, 11), party: 'Tractor — Sunil', area: 'Plinth', qty: 14, rate: 900, total: 12600, paid: 5000 }]);
  d.data.contractorPay = mk([{ date: D(7, 15), amount: 40000, mode: 'Cash', note: 'Advance' }, { date: D(7, 29), amount: 200000, mode: 'Bank transfer', note: 'Foundation stage' }]);
  d.data.salary = mk([{ date: D(8, 1), name: 'Ganesh (Munshi)', from: D(7, 1), to: D(7, 31), days: 31, amount: 18000 }, { date: D(9, 1), name: 'Ganesh (Munshi)', from: D(8, 1), to: D(8, 31), days: 29, amount: 17000, note: '2 days absent' }]);
  d.data.shopBuy = mk([{ date: D(7, 6), item: 'Plastic sheet', qty: '2 rolls', amount: 1800 }, { date: D(7, 18), item: 'Binding wire', qty: '25 kg', amount: 2300 }, { date: D(8, 9), item: 'Nails', qty: '10 kg', amount: 950 }]);
  d.data.shopPay = mk([{ date: D(8, 15), amount: 3000, mode: 'Cash' }]);
  d.data.cashGiven = mk([{ date: D(7, 3), amount: 50000, note: 'Site petty cash' }, { date: D(8, 10), amount: 30000 }]);
  d.data.cashSpent = mk([{ date: D(7, 4), particular: 'Diesel', amount: 4500 }, { date: D(7, 9), particular: 'Tea & snacks (labour)', amount: 1200 }, { date: D(7, 22), particular: 'Water tanker', amount: 3000 }, { date: D(8, 12), particular: 'Tools & ropes', amount: 5200 }]);
  d.data.creditIn = mk([{ date: D(7, 1), amount: 200000, note: 'Initial funding' }, { date: D(8, 5), amount: 150000, note: 'Steel payment' }]);
  d.data.creditOut = mk([{ date: D(9, 15), amount: 100000 }]);
  d.data.misc = mk([{ date: D(8, 7), name: 'Raju mistri', work: 'Plastering sample wall', amount: 1500 }, { date: D(8, 14), name: 'Local labour (3)', work: 'Site cleaning', amount: 1800 }]);
  d.data.lhead = mk([{ date: D(7, 12), labour: 12, mistri: 3, amount: 14500 }, { date: D(7, 13), labour: 14, mistri: 3, amount: 16000 }, { date: D(8, 18), labour: 10, mistri: 2, amount: 11000 }]);
  d.data.cement = mk([{ date: D(7, 6), received: 100, note: 'Bill #221' }, { date: D(7, 12), used: 35, work: 'Footing PCC' }, { date: D(8, 4), received: 150 }, { date: D(8, 20), used: 60, work: 'Brickwork' }, { date: D(9, 10), used: 40, work: 'Slab' }]);
  return d;
}
function setDB(next, msg) { db = normalize(next); save(); applyMeta(); route(); toast(msg); }
async function loadPublished(silent) {
  try {
    const res = await fetch('data.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('missing');
    setDB(await res.json(), 'Loaded published data.json ✓'); return true;
  } catch (e) { if (!silent) toast('No data.json found next to this site.', 'err'); return false; }
}
function applyMeta() { $('#projName').textContent = db.meta.project || 'Site Ledger'; $('#projSub').textContent = db.meta.site || 'Construction accounts'; document.title = (db.meta.project || 'Site Ledger') + ' · Ledger'; }

/* ---------------- events ---------------- */
function afterChange() {
  if (cur.tab === 'update') refreshUpdate(); else if (cur.tab === 'records') renderRecordsBody(); else if (cur.tab === 'dashboard') renderDashboard();
  refreshModal();
}
document.addEventListener('submit', e => {
  const f = e.target;
  if (f.matches('form.entry')) { e.preventDefault(); saveForm(f); }
  else if (f.id === 'payForm') {
    e.preventDefault();
    const amt = num(f.elements.amt.value); if (amt <= 0) return toast('Enter an amount.', 'err');
    const row = db.data[f.dataset.t].find(r => r.id === f.dataset.id); if (!row) return;
    row.paid = r2(num(row.paid) + amt); (row.log = row.log || []).push({ date: f.elements.date.value || lastDate, amt });
    lastDate = f.elements.date.value || lastDate; save(); closeModal(); afterChange(); toast('Payment recorded ✓');
  } else if (f.id === 'metaForm') {
    e.preventDefault(); const fd = new FormData(f);
    Object.keys(DEFAULT_META).forEach(k => { db.meta[k] = k === 'contractValue' ? num(fd.get(k)) : String(fd.get(k) ?? '').trim() || DEFAULT_META[k]; });
    save(); applyMeta(); toast('Details saved ✓');
  }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { state.q = e.target.value.trim().toLowerCase(); renderRecordsBody(); return; }
  const form = e.target.closest && e.target.closest('form.entry'); if (!form) return;
  const T = TB[form.dataset.table], f = T.fields.find(x => x.k === e.target.name);
  if (f && f.auto) e.target.dataset.dirty = e.target.value === '' ? '' : '1';
  recompute(form, T);
});
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act, scope = b.closest('.modal') || view;
  if (act === 'edit') startEdit(b.dataset.t, b.dataset.id, scope);
  else if (act === 'del') { if (confirm('Delete this entry? This cannot be undone.')) { db.data[b.dataset.t] = db.data[b.dataset.t].filter(r => r.id !== b.dataset.id); save(); afterChange(); toast('Entry deleted'); } }
  else if (act === 'pay') payModal(b.dataset.t, b.dataset.id);
  else if (act === 'cancel') { const f = b.closest('form'); resetForm(f, TB[f.dataset.table]); }
  else if (act === 'steel') steelModal(b.dataset.size);
  else if (act === 'closeModal') closeModal();
  else if (act === 'pdf') pdfSections([b.dataset.sec]);
  else if (act === 'pdfAll') pdfSections(SECTIONS.map(s => s.id));
  else if (act === 'pdfSteel') pdfSteel(b.dataset.size);
  else if (act === 'backup') download(`${slug(db.meta.project)}-backup-${todayStr()}.json`, JSON.stringify(db, null, 2));
  else if (act === 'publish') download('data.json', JSON.stringify(db, null, 2));
  else if (act === 'restore') $('#restoreFile').click();
  else if (act === 'loadPublished') { if (confirm('Replace the data in this browser with the published data.json?')) loadPublished(false); }
  else if (act === 'demo') { if (confirm('Replace current data with demo data?')) setDB(demoData(), 'Demo data loaded'); }
  else if (act === 'reset') { if (prompt('This erases ALL data in this browser. Type DELETE to confirm.') === 'DELETE') setDB(blankDB(), 'All data erased'); }
});
document.addEventListener('change', e => {
  if (e.target.id !== 'restoreFile' || !e.target.files[0]) return;
  const rd = new FileReader();
  rd.onload = () => { try { const o = JSON.parse(rd.result); if (!o || !o.data) throw 0; if (confirm('Replace current data with this file?')) setDB(o, 'Backup restored ✓'); } catch (x) { toast('That file is not a valid backup.', 'err'); } };
  rd.readAsText(e.target.files[0]); e.target.value = '';
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalFn) closeModal(); });
document.addEventListener('mousedown', e => { if (e.target.classList && e.target.classList.contains('m-back')) closeModal(); });

/* ---------------- router + init ---------------- */
function route() {
  const p = location.hash.replace(/^#\/?/, '').split('/');
  cur = { tab: ['dashboard', 'records', 'update', 'settings'].includes(p[0]) ? p[0] : 'dashboard', sub: p[1] || '' };
  $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.tab === cur.tab));
  closeModal();
  if (cur.tab === 'dashboard') renderDashboard();
  else if (cur.tab === 'records') renderRecords(cur.sub);
  else if (cur.tab === 'update') renderUpdate(cur.sub);
  else renderSettings();
  if (!(cur.tab === 'records' && cur.sub)) window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
(async function init() {
  let raw = null;
  try { raw = localStorage.getItem(LS_KEY); } catch (e) { /* storage blocked */ }
  if (raw) { try { db = normalize(JSON.parse(raw)); } catch (e) { db = blankDB(); } }
  else {
    db = blankDB();
    applyMeta();
    if (await loadPublished(true)) return;
  }
  applyMeta(); route();
})();
