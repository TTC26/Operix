/* ===== DPR Studio app: state, formatting, helpers ===== */
const S = { cur: null, view: 'overview', projects: [], store: 'memory', db: null, sample: null, sampleImages: false, dl: null,
  plan: 'free', modal: null, confirmDel: null, busy: {}, extract: null, R: null, issues: [], saveState: 'Example — not saved' };

const CURRENCIES = [
  ['INR', 'Indian rupee', 'en-IN'], ['USD', 'US dollar', 'en-US'], ['EUR', 'Euro', 'en-IE'], ['GBP', 'British pound', 'en-GB'],
  ['AED', 'UAE dirham', 'en-AE'], ['SAR', 'Saudi riyal', 'en-US'], ['QAR', 'Qatari riyal', 'en-US'], ['SGD', 'Singapore dollar', 'en-SG'],
  ['MYR', 'Malaysian ringgit', 'en-MY'], ['LKR', 'Sri Lankan rupee', 'en-US'], ['BDT', 'Bangladeshi taka', 'en-US'], ['NPR', 'Nepalese rupee', 'en-US'],
  ['PKR', 'Pakistani rupee', 'en-US'], ['AUD', 'Australian dollar', 'en-AU'], ['CAD', 'Canadian dollar', 'en-CA'], ['NZD', 'NZ dollar', 'en-NZ'],
  ['JPY', 'Japanese yen', 'en-US'], ['CNY', 'Chinese yuan', 'en-US'], ['IDR', 'Indonesian rupiah', 'en-US'], ['PHP', 'Philippine peso', 'en-US'],
  ['THB', 'Thai baht', 'en-US'], ['VND', 'Vietnamese dong', 'en-US'], ['ZAR', 'South African rand', 'en-ZA'], ['NGN', 'Nigerian naira', 'en-US'],
  ['KES', 'Kenyan shilling', 'en-US'], ['EGP', 'Egyptian pound', 'en-US'], ['CHF', 'Swiss franc', 'en-US'], ['BRL', 'Brazilian real', 'en-US'], ['MXN', 'Mexican peso', 'en-US']
];
const UNITS = { indian: [[1, 'Full'], [1e3, 'Thousands'], [1e5, 'Lakhs'], [1e7, 'Crores']], intl: [[1, 'Full'], [1e3, 'Thousands'], [1e6, 'Millions'], [1e9, 'Billions']] };
const SECTORS = ['Manufacturing', 'Trading', 'Service', 'IT / Software', 'Restaurant', 'Retail', 'Logistics', 'Construction', 'Healthcare', 'Education', 'Agriculture', 'Solar / Renewable Energy', 'Hotel / Hospitality', 'Other'];
const PURPOSES = ['New Business / Startup', 'Business Expansion', 'Diversification', 'Modernisation', 'Machinery Purchase', 'Working Capital', 'Bank Loan', 'Investor / Funding', 'Government / Subsidy', 'General Project Report'];
const LOAN_TYPES = ['Term Loan', 'Working Capital', 'CC / OD', 'Composite Loan', 'Machinery Loan', 'Project Finance'];
const ASSET_CATS = ['Land', 'Building', 'Plant & Machinery', 'Electrical', 'Furniture & Office', 'Vehicles', 'Computers & IT', 'Other assets'];
const DEP_DEFAULT = { 'Land': 0, 'Building': 3.17, 'Plant & Machinery': 6.33, 'Electrical': 10, 'Furniture & Office': 9.5, 'Vehicles': 11.88, 'Computers & IT': 31.67, 'Other assets': 10 };
const MODES = [
  { n: 1, name: 'General DPR', desc: 'Project report for startups, investors, subsidy files.' },
  { n: 2, name: 'Bank / MSME DPR', desc: 'DPR + loan proposal + financial appraisal, DSCR, ratios.' },
  { n: 3, name: 'Bank / MSME + CMA', desc: 'Adds historical analysis, reconciliation, CMA forms, MPBF.' }
];
const VIEWS = [
  { id: 'overview', label: 'Overview', g: 'Project' },
  { id: 'setup', label: 'Setup & mode', g: 'Project' },
  { id: 'company', label: 'Company & promoters', g: 'Project' },
  { id: 'products', label: 'Products & capacity', g: 'Inputs' },
  { id: 'cost', label: 'Project cost', g: 'Inputs' },
  { id: 'opex', label: 'Operating costs', g: 'Inputs' },
  { id: 'wc', label: 'Working capital', g: 'Inputs' },
  { id: 'finance', label: 'Finance & loans', g: 'Inputs' },
  { id: 'history', label: 'Historical & reconciliation', g: 'Inputs', min: 3 },
  { id: 'projections', label: 'Projected financials', g: 'Analysis' },
  { id: 'appraisal', label: 'Bank appraisal', g: 'Analysis', min: 2 },
  { id: 'cma', label: 'CMA data', g: 'Analysis', min: 3 },
  { id: 'checks', label: 'Checks & compliance', g: 'Analysis' },
  { id: 'report', label: 'Report & export', g: 'Output' },
  { id: 'dashboard', label: 'My projects', g: 'Workspace' }
];
const COMPLIANCE = {
  base: ['Tax registration (GST / VAT)', 'Business / company registration', 'MSME / small business registration (Udyam)', 'Trade or shop licence', 'Labour & social security (PF / ESI)', 'Fire safety certificate', 'Power connection sanction'],
  Manufacturing: ['Factory licence', 'Pollution control consent (CTE / CTO)', 'Building plan approval', 'Product standards (BIS / ISO)'],
  Restaurant: ['Food safety licence (FSSAI)', 'Health trade licence', 'Liquor licence (if applicable)'],
  Agriculture: ['Food safety licence (FSSAI)', 'Land-use conversion', 'Pollution control consent (CTE / CTO)'],
  Healthcare: ['Clinical establishment registration', 'Bio-medical waste authorisation', 'Drug licence (if pharmacy)'],
  'Hotel / Hospitality': ['Food safety licence (FSSAI)', 'Tourism department registration', 'Police / lodging licence'],
  Trading: ['Import-export code (IEC)'], Logistics: ['Transport permits', 'Import-export code (IEC)'],
  Construction: ['Contractor registration', 'Building & other construction workers registration'],
  'Solar / Renewable Energy': ['Grid connectivity approval', 'Renewable energy agency registration'],
  'IT / Software': ['Software Technology Park registration (optional)'], Education: ['Affiliation / recognition'], Retail: [], Service: [], Other: []
};
const DEFAULT_IMPL = [
  { task: 'Loan sanction & financial closure', start: 0, months: 2 },
  { task: 'Premises & approvals', start: 0, months: 3 },
  { task: 'Machinery order & delivery', start: 2, months: 4 },
  { task: 'Civil & electrical work', start: 2, months: 3 },
  { task: 'Installation & commissioning', start: 5, months: 2 },
  { task: 'Trial production', start: 7, months: 1 },
  { task: 'Commercial production', start: 8, months: 1 }
];
const DEFAULT_RISKS = [
  { risk: 'Raw material price volatility', impact: 'Medium', mitigation: 'Quarterly price contracts with two approved suppliers' },
  { risk: 'Customer concentration', impact: 'High', mitigation: 'Add two new OEM customers by Year 2; cap single customer at 40% of sales' },
  { risk: 'Working capital stress from delayed receivables', impact: 'Medium', mitigation: 'Credit limits per customer, invoice discounting on TReDS' },
  { risk: 'Machinery downtime', impact: 'Medium', mitigation: 'Annual maintenance contracts and critical spares stock' },
  { risk: 'Skilled operator attrition', impact: 'Low', mitigation: 'In-house training cell and retention bonus' }
];

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const getP = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
function setP(o, path, v) { const ks = path.split('.'); let a = o; ks.slice(0, -1).forEach(k => { if (a[k] == null) a[k] = /^\d+$/.test(k) ? [] : {}; a = a[k]; }); a[ks[ks.length - 1]] = v; }
const clone = o => JSON.parse(JSON.stringify(o));

function normalize(p) {
  p.implementation = p.implementation || clone(DEFAULT_IMPL);
  p.risks = p.risks || clone(DEFAULT_RISKS);
  p.narrative = p.narrative || {}; p.compliance = p.compliance || {}; p.issuesIgnored = p.issuesIgnored || {};
  p.existingLoans = p.existingLoans || []; p.historical = p.historical || [];
  p.benchmarks = Object.assign({ minDscr: 1.25, avgDscr: 1.5, currentRatio: 1.33, debtEquity: 3, tolTnw: 4, recGreen: 5, recAmber: 15, growthFlag: 1.5 }, p.benchmarks || {});
  p.settings.numSystem = p.settings.numSystem || (p.settings.currency === 'INR' ? 'indian' : 'intl');
  while (p.capacity.util.length < 10) p.capacity.util.push(p.capacity.util[p.capacity.util.length - 1] || 90);
  return p;
}

/* ---- formatting ---- */
function locale() { if (!S.cur) return 'en-IN'; const s = S.cur.settings; return s.numSystem === 'indian' ? 'en-IN' : ((CURRENCIES.find(c => c[0] === s.currency) || [])[2] || 'en-US'); }
function curSymbol() {
  try { return new Intl.NumberFormat('en', { style: 'currency', currency: S.cur.settings.currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(x => x.type === 'currency').value; }
  catch (e) { return S.cur.settings.currency; }
}
function unitLabel() {
  const s = S.cur.settings; const list = UNITS[s.numSystem] || UNITS.intl;
  const u = list.find(x => x[0] === +s.unit) || list[0];
  return u[0] === 1 ? curSymbol() : `${curSymbol()} ${u[1].toLowerCase()}`;
}
function unitDiv() { const s = S.cur.settings; const list = UNITS[s.numSystem] || UNITS.intl; return (list.find(x => x[0] === +s.unit) || list[0])[0]; }
function fm(v, dp) {
  if (v == null || !isFinite(v)) return '–';
  const d = unitDiv(); const x = v / d; const dd = dp ?? (d === 1 ? 0 : 2);
  return new Intl.NumberFormat(locale(), { minimumFractionDigits: dd, maximumFractionDigits: dd }).format(x);
}
function fmc(v, dp) { return v == null || !isFinite(v) ? '–' : `${curSymbol()}${fm(v, dp)}${unitDiv() === 1 ? '' : ' ' + unitShort()}`; }
function unitShort() { return { 1e3: 'K', 1e5: 'L', 1e6: 'M', 1e7: 'Cr', 1e9: 'B' }[unitDiv()] || ''; }
function fn(v, dp = 0) { return v == null || !isFinite(v) ? '–' : new Intl.NumberFormat(locale(), { minimumFractionDigits: dp, maximumFractionDigits: dp }).format(v); }
function fx(v) { return v == null || !isFinite(v) ? '–' : v.toFixed(2) + '×'; }
function fp(v, dp = 1) { return v == null || !isFinite(v) ? '–' : (v * 100).toFixed(dp) + '%'; }
function yl(t) {
  const s = S.cur.settings; const y = (+s.firstYear || new Date().getFullYear()) + t;
  return s.fyStart === 'January' ? String(y) : `FY${String(y).slice(2)}-${String(y + 1).slice(2)}`;
}

/* ---- field builders ---- */
function fid(path) { return 'f_' + path.replace(/[^\w]/g, '_'); }
function inp(path, o = {}) {
  const v = getP(S.cur, path); const type = o.num ? 'number' : (o.type || 'text');
  const el = `<input id="${fid(path)}" data-k="${path}" ${o.num ? 'data-t="n" step="any" inputmode="decimal"' : ''} type="${type}" value="${esc(v ?? '')}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ''} aria-label="${esc(o.label || path)}">`;
  return o.suffix ? `<div class="suffix">${el}<i>${esc(o.suffix)}</i></div>` : el;
}
function field(label, path, o = {}) { return `<label class="f"><span>${esc(label)}</span>${inp(path, { ...o, label })}</label>`; }
function sel(path, options, o = {}) {
  const v = getP(S.cur, path);
  return `<select id="${fid(path)}" data-k="${path}" ${o.num ? 'data-t="n"' : ''} aria-label="${esc(o.label || path)}">${options.map(x => { const [val, lab] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(lab)}</option>`; }).join('')}</select>`;
}
function fsel(label, path, options, o = {}) { return `<label class="f"><span>${esc(label)}</span>${sel(path, options, { ...o, label })}</label>`; }
function area(label, path, o = {}) { return `<label class="f"><span>${esc(label)}</span><textarea id="${fid(path)}" data-k="${path}" aria-label="${esc(label)}" ${o.rows ? `rows="${o.rows}"` : ''}>${esc(getP(S.cur, path) ?? '')}</textarea></label>`; }
function chips(path, options) {
  const cur = getP(S.cur, path) || [];
  return `<div class="chips">${options.map(x => `<button class="chip ${cur.includes(x) ? 'on' : ''}" data-act="chip" data-path="${path}" data-v="${esc(x)}" aria-pressed="${cur.includes(x)}">${esc(x)}</button>`).join('')}</div>`;
}
function radioChips(path, options) {
  const cur = getP(S.cur, path);
  return `<div class="chips">${options.map(([v, l]) => `<button class="chip ${cur === v ? 'on' : ''}" data-act="set" data-path="${path}" data-v="${esc(v)}" aria-pressed="${cur === v}">${esc(l)}</button>`).join('')}</div>`;
}
/* editable table: cols = [{k,label,num,w,sel,suffix,calc}] */
function etable(list, cols, o = {}) {
  const rows = getP(S.cur, list) || [];
  return `<div class="tw"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.num || c.calc ? 'n' : ''}" ${c.w ? `style="min-width:${c.w}px"` : ''}>${esc(c.label)}</th>`).join('')}<th class="x"></th></tr></thead><tbody>
  ${rows.map((r, i) => `<tr>${cols.map(c => {
    const path = `${list}.${i}.${c.k}`;
    if (c.calc) return `<td class="n">${c.calc(r, i)}</td>`;
    if (c.sel) return `<td>${sel(path, c.sel, { label: c.label })}</td>`;
    return `<td>${inp(path, { num: c.num, label: c.label })}</td>`;
  }).join('')}<td class="x"><button class="btn ghost sm danger" data-act="del" data-list="${list}" data-i="${i}" aria-label="Remove row">✕</button></td></tr>`).join('')}
  ${o.foot || ''}</tbody></table></div>
  <div class="row" style="margin-top:8px"><button class="btn sm" data-act="add" data-list="${list}">+ ${esc(o.addLabel || 'Add row')}</button>${o.extra || ''}</div>`;
}
/* read-only statement: rows = [label, arr, cls, fmt] */
function stmt(rows, o = {}) {
  const T = S.R.T; const cols = o.cols || T.map(t => yl(t));
  return `<div class="tw"><table><thead><tr><th style="min-width:220px">${esc(o.unit || unitLabel())}</th>${cols.map(c => `<th class="n">${esc(c)}</th>`).join('')}</tr></thead><tbody>
  ${rows.map(r => {
    if (typeof r === 'string') return `<tr class="sec"><td colspan="${cols.length + 1}">${esc(r)}</td></tr>`;
    const [label, arr, cls, f] = r; const F = f || fm;
    return `<tr class="${cls || ''}"><td>${esc(label)}</td>${arr.map(v => `<td class="n ${v < 0 && F === fm ? 'neg' : ''}">${F(v)}</td>`).join('')}</tr>`;
  }).join('')}</tbody></table></div>`;
}
function kpi(label, value, note, cls = '') { return `<div class="kpi ${cls}"><small>${esc(label)}</small><b>${value}</b>${note ? `<em>${note}</em>` : ''}</div>`; }
function pill(status, text) { return `<span class="pill ${status}">${esc(text)}</span>`; }
function head(eyebrow, title, desc, right = '') {
  return `<div class="head"><div style="flex:1;min-width:240px"><div class="eyebrow">${esc(eyebrow)}</div><h1>${esc(title)}</h1>${desc ? `<p>${desc}</p>` : ''}</div>${right}</div>`;
}

/* ---- SVG charts ---- */
function barChart({ labels, series, line, bench, h = 240, fmtY = v => fm(v, 0) }) {
  const W = 600, H = h, L = 52, Rr = 10, Tp = 14, B = 30;
  const all = series.flatMap(s => s.vals).concat(line ? line.vals : []).concat(bench != null ? [bench] : []).filter(v => v != null && isFinite(v));
  let max = Math.max(0, ...all), min = Math.min(0, ...all);
  if (max === min) max = min + 1;
  const step = niceStep((max - min) / 4); max = Math.ceil(max / step) * step; min = Math.floor(min / step) * step;
  const y = v => Tp + (H - Tp - B) * (1 - (v - min) / (max - min));
  const pw = (W - L - Rr) / labels.length; const bw = Math.min(28, (pw * 0.7) / series.length);
  let g = '';
  for (let v = min; v <= max + step / 2; v += step) g += `<line x1="${L}" x2="${W - Rr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${fmtY(v)}</text>`;
  labels.forEach((lab, i) => {
    const cx = L + pw * i + pw / 2;
    series.forEach((s, j) => {
      const v = s.vals[i]; if (v == null) return;
      const x = cx - (bw * series.length) / 2 + j * bw; const y0 = y(0), y1 = y(v);
      g += `<rect x="${x + 1}" y="${Math.min(y0, y1)}" width="${bw - 2}" height="${Math.max(1, Math.abs(y1 - y0))}" rx="3" fill="${s.color}"><title>${esc(s.name)} ${esc(lab)}: ${fmtY(v)}</title></rect>`;
    });
    g += `<text x="${cx}" y="${H - 10}" text-anchor="middle">${esc(lab)}</text>`;
  });
  if (line) {
    const pts = line.vals.map((v, i) => v == null ? null : [L + pw * i + pw / 2, y(v)]).filter(Boolean);
    g += `<polyline points="${pts.map(p => p.join(',')).join(' ')}" fill="none" stroke="${line.color}" stroke-width="2.5"/>` + pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 4.5 : 3}" fill="${line.color}"/>`).join('');
  }
  if (bench != null) g += `<line x1="${L}" x2="${W - Rr}" y1="${y(bench)}" y2="${y(bench)}" stroke="var(--bad)" stroke-dasharray="5 4" stroke-width="1.5"/><text x="${W - Rr}" y="${y(bench) - 6}" text-anchor="end" style="fill:var(--bad)">Benchmark ${fmtY(bench)}</text>`;
  g += `<line x1="${L}" x2="${W - Rr}" y1="${y(0)}" y2="${y(0)}" stroke="var(--muted)" stroke-width="1"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
function niceStep(raw) { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))); const f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
function legend(items) { return `<div class="legend">${items.map(([c, l]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join('')}</div>`; }
