/* ===== Checks, report model, exports, AI, persistence, events ===== */
function suggestedMode() { const s = S.cur.setup; if (s.financeMode !== 'Bank') return 1; return s.existing ? 3 : 2; }
function reconStatus() {
  const b = S.cur.benchmarks;
  return S.cur.historical.map(h => {
    const o = {};
    ['gst', 'itr', 'bank'].forEach(k => {
      if (!+h[k] || !+h.revenue) { o[k] = { s: 'na', label: 'no data' }; return; }
      const v = Math.abs(h[k] - h.revenue) / h.revenue * 100;
      o[k] = { s: v <= b.recGreen ? 'ok' : v <= b.recAmber ? 'warn' : 'bad', label: v.toFixed(1) + '%', v };
    });
    return o;
  });
}
function buildIssues() {
  const R = S.R, p = S.cur, b = p.benchmarks, m = mode(); const L = [];
  const add = (sev, area, msg, view, key) => L.push({ sev, area, msg, view, key: key || area });
  const gap = R.means.total - R.pc.total;
  add(Math.abs(gap) < 1 ? 'ok' : 'bad', 'Means of finance', Math.abs(gap) < 1 ? 'Project cost equals means of finance.' : `Means of finance ${gap > 0 ? 'exceed' : 'fall short of'} project cost by ${fmc(Math.abs(gap))}.`, 'finance', 'mof');
  const bsOk = R.bsDiff.every(d => Math.abs(d) < 1);
  add(bsOk ? 'ok' : 'bad', 'Balance sheet', bsOk ? 'Balances in every projected year.' : 'Does not balance — check inputs.', 'projections', 'bs');
  const negCash = R.T.filter(t => R.cash[t] < 0);
  add(negCash.length ? 'warn' : 'ok', 'Cash flow', negCash.length ? `Closing cash is negative in ${negCash.map(yl).join(', ')}.` : 'Closing cash stays positive in all years.', 'finance', 'cash');
  const overUtil = R.util.some(u => u > 1);
  add(overUtil ? 'bad' : 'ok', 'Capacity', overUtil ? 'Utilisation above 100% in at least one year.' : 'Sales volumes stay within installed capacity.', 'products', 'util');
  if (!String(p.company.name || '').trim()) add('bad', 'Company', 'Company name is missing.', 'company', 'coname');
  if (m >= 2) {
    const tenM = Math.round(+p.finance.tlTenure * 12);
    add(tenM > R.N * 12 ? 'warn' : 'ok', 'Loan schedule', tenM > R.N * 12 ? `Loan runs ${p.finance.tlTenure} years but projections cover ${R.N}. Extend the projection period.` : 'Term loan is fully repaid within the projection period.', 'setup', 'tenure');
    add(R.minDscr != null && R.minDscr >= b.minDscr ? 'ok' : 'warn', 'DSCR', `Minimum DSCR ${fx(R.minDscr)} vs benchmark ${fx(+b.minDscr)}; average ${fx(R.avgDscr)} vs ${fx(+b.avgDscr)}.`, 'appraisal', 'dscr');
    const cr = R.currentRatio[Math.min(1, R.N - 1)];
    add(cr != null && cr >= b.currentRatio ? 'ok' : 'warn', 'Current ratio', `${yl(1)} current ratio ${fx(cr)} vs benchmark ${fx(+b.currentRatio)}.`, 'wc', 'cr');
    add(R.debtEquity[0] != null && R.debtEquity[0] <= b.debtEquity ? 'ok' : 'warn', 'Debt / equity', `${yl(0)} debt / equity ${fx(R.debtEquity[0])} vs maximum ${fx(+b.debtEquity)}.`, 'finance', 'de');
    if (R.wcLoan > R.assessed[0] * 1.001) add('warn', 'Working capital', `Proposed limit ${fmc(R.wcLoan)} exceeds assessed ${fmc(R.assessed[0])}.`, 'wc', 'wclimit');
  }
  const lossYrs = R.T.filter(t => t >= 2 && R.pat[t] < 0);
  if (lossYrs.length) add('warn', 'Profitability', `Loss in ${lossYrs.map(yl).join(', ')}.`, 'opex', 'loss');
  const noQuote = p.assets.filter(a => !a.quote && a.cat !== 'Land');
  add(noQuote.length ? 'warn' : 'ok', 'Quotations', noQuote.length ? `${noQuote.length} asset${noQuote.length > 1 ? 's have' : ' has'} no quotation reference: ${noQuote.map(a => a.desc).slice(0, 3).join(', ')}.` : 'Every asset has a quotation reference.', 'cost', 'quotes');
  const contrib = p.promoters.reduce((s, x) => s + (+x.contribution || 0), 0);
  if (Math.abs(contrib - R.means.equity) > 1) add('warn', 'Promoter contribution', `Promoters' stated contribution ${fmc(contrib)} differs from equity in means of finance ${fmc(R.means.equity)}.`, 'company', 'contrib');
  if (p.promoters.some(x => !String(x.name || '').trim())) add('warn', 'Promoters', 'A promoter has no name.', 'company', 'pname');
  if (m >= 3) {
    add(p.historical.length >= 3 ? 'ok' : 'warn', 'Historical data', p.historical.length >= 3 ? `${p.historical.length} years of historical financials entered.` : `Only ${p.historical.length} of 3 historical years entered.`, 'history', 'hist');
    const rec = reconStatus(); const reds = [];
    rec.forEach((r, i) => ['gst', 'itr', 'bank'].forEach(k => { if (r[k].s === 'bad') reds.push(`${k.toUpperCase()} ${p.historical[i].fy} (${r[k].label})`); else if (r[k].s === 'warn') reds.push(`${k.toUpperCase()} ${p.historical[i].fy} ${r[k].label}`); }));
    add(reds.length ? 'warn' : 'ok', 'Reconciliation', reds.length ? `Variance vs books: ${reds.join('; ')}. Explain in the report.` : 'GST, ITR and bank credits reconcile with books.', 'history', 'recon');
    const last = p.historical[p.historical.length - 1];
    if (last && last.revenue && R.revenue[0] / last.revenue > b.growthFlag) add(String(p.growthReason || '').trim() ? 'ok' : 'bad', 'Growth assumption', String(p.growthReason || '').trim() ? `${(R.revenue[0] / last.revenue).toFixed(2)}× growth over last year — reason recorded.` : `${(R.revenue[0] / last.revenue).toFixed(2)}× growth over last year needs a reason.`, 'history', 'growth');
  }
  ['exec', 'market'].forEach(k => { if (!String(p.narrative[k] || '').trim()) add('warn', 'Report content', `${NARR.find(n => n.k === k).t} uses default text. Write or draft it with AI.`, 'report', 'narr-' + k); });
  const missing = Object.entries(p.compliance).filter(([, v]) => v === 'missing').length;
  if (missing) add('warn', 'Compliance', `${missing} applicable licence${missing > 1 ? 's' : ''} missing details.`, 'checks', 'compl');
  const order = { bad: 0, warn: 1, ok: 2 };
  return L.sort((a, b2) => order[a.sev] - order[b2.sev]);
}

/* ---- narrative ---- */
const NARR = [
  { k: 'exec', t: 'Executive summary' }, { k: 'promoters', t: 'Promoter profile' }, { k: 'market', t: 'Market & industry analysis' },
  { k: 'technical', t: 'Technical feasibility' }, { k: 'conclusion', t: 'Conclusion' }
];
function defaultNarr(k) {
  const p = S.cur, R = S.R, c = p.company; const last = R.N - 1; const y3 = Math.min(2, last);
  const where = [c.location, c.city, c.state].filter(Boolean).join(', ');
  switch (k) {
    case 'exec': return `${c.name || p.name} proposes a ${p.setup.sector.toLowerCase()} project${where ? ' at ' + where : ''} for ${c.activity || 'the activity described in this report'}. The purpose is ${p.setup.purposes.join(', ').toLowerCase()}.\n\nTotal project cost is ${fmc(R.pc.total)}, funded by promoter contribution of ${fmc(R.means.equity)} (${fp(R.pc.total ? R.means.equity / R.pc.total : 0, 0)})${R.means.termLoan ? ` and a term loan of ${fmc(R.means.termLoan)}${p.finance.bank ? ' from ' + p.finance.bank : ''}` : ''}${R.wcLoan ? `, with a working capital limit of ${fmc(R.wcLoan)}` : ''}.\n\nAt ${fn(R.util[0] * 100)}% capacity utilisation in ${yl(0)}, revenue is projected at ${fmc(R.revenue[0])}, rising to ${fmc(R.revenue[last])} by ${yl(last)}. Profit after tax grows from ${fmc(R.pat[0])} to ${fmc(R.pat[last])}. ${R.avgDscr ? `Average DSCR over the loan period is ${fx(R.avgDscr)} with a minimum of ${fx(R.minDscr)}. ` : ''}The project breaks even at ${fp(R.bepPct[y3], 0)} of sales in ${yl(y3)}.`;
    case 'promoters': return p.promoters.filter(x => x.name).map(x => `${x.name}${x.role ? ', ' + x.role : ''}${x.qualification ? ', holds ' + x.qualification : ''}${x.experience ? ' and has ' + x.experience + ' years of industry experience' : ''}. ${x.share ? `Shareholding ${x.share}%` : ''}${x.netWorth ? `, declared net worth ${fmc(+x.netWorth)}` : ''}.`).join('\n\n') || 'Promoter details to be added.';
    case 'market': return `The project serves demand for ${p.products.map(x => x.name.toLowerCase()).join(' and ')}. The ${p.setup.sector.toLowerCase()} sector in ${c.state || p.settings.country || 'the region'} is served by a mix of organised and small units. Industry size, demand drivers, target customers and competition are to be added.`;
    case 'technical': return `Installed capacity: ${p.products.map(x => `${fn(+x.capacity)} ${x.unit} of ${x.name.toLowerCase()} per year`).join('; ')}, operated in ${p.capacity.shifts} shift(s) of ${p.capacity.hoursPerShift} hours for ${p.capacity.days} days a year.\n\nProcess: ${p.process || 'to be described'}.\n\nKey equipment: ${p.assets.filter(a => a.cat === 'Plant & Machinery').map(a => `${a.desc} (${a.qty})`).join(', ') || 'to be listed'}. Connected load is ${p.utilities.kw} kW. The unit will employ ${p.manpower.reduce((s, x) => s + (+x.count || 0), 0)} people.`;
    case 'conclusion': return `The project is technically feasible with proven equipment and a defined process. Projected cash accruals ${R.avgDscr ? `give an average DSCR of ${fx(R.avgDscr)}, ` : ''}with break-even at ${fp(R.bepPct[y3], 0)} of sales by ${yl(y3)}. The promoters bring ${fp(R.pc.total ? R.means.equity / R.pc.total : 0, 0)} of project cost as their own contribution. The project is recommended for ${p.setup.financeMode === 'Bank' ? 'financial assistance' : 'implementation'}, subject to the assumptions and risks set out in this report.`;
  }
  return '';
}
const narr = k => String(S.cur.narrative[k] || '').trim() || defaultNarr(k);

/* ---- report model (shared by preview, PDF, Word) ---- */
function reportModel() {
  const p = S.cur, R = S.R, m = mode(); const B = []; let sec = 0;
  const H = t => B.push({ t: 'h', text: `${++sec}. ${t}` });
  const P = t => String(t || '').split(/\n\s*\n/).forEach(x => x.trim() && B.push({ t: 'p', text: x.trim() }));
  const TB = (head, rows, hl = []) => B.push({ t: 'table', head, rows, hl });
  const ST = (rows, cols) => {
    cols = cols || R.T.map(yl); const out = [], hl = [];
    rows.forEach(r => { if (typeof r === 'string') { hl.push(out.length); out.push([r, ...cols.map(() => '')]); return; } const [l, arr, cls, f] = r; if (cls) hl.push(out.length); out.push([l, ...arr.map(v => (f || fm)(v))]); });
    TB([unitLabel(), ...cols], out, hl);
  };
  const c = p.company;
  B.push({ t: 'cover', title: 'Detailed Project Report', name: c.name || p.name, lines: [c.activity, [c.location, c.city, c.state].filter(Boolean).join(', '), `Project cost ${fmc(R.pc.total)} · ${MODES[m - 1].name}`, p.setup.financeMode === 'Bank' && p.finance.bank ? `Submitted to ${p.finance.bank}` : '', `Prepared ${new Date().toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' })}`].filter(Boolean) });
  H('Executive summary'); P(narr('exec'));
  TB(['Particular', 'Value'], [['Project cost', fmc(R.pc.total)], ['Promoter contribution', fmc(R.means.equity)], ['Term loan', fmc(R.means.termLoan)], ['Working capital limit', fmc(R.wcLoan)], ['Average DSCR', fx(R.avgDscr)], ['Minimum DSCR', fx(R.minDscr)], [`Break-even (${yl(Math.min(2, R.N - 1))})`, fp(R.bepPct[Math.min(2, R.N - 1)], 0)], ['Project IRR', fp(R.irr)]]);
  H('Promoters'); P(narr('promoters'));
  TB(['Name', 'Role', 'Qualification', 'Experience', 'Share', 'Contribution'], p.promoters.map(x => [x.name, x.role, x.qualification, (x.experience || '–') + ' yrs', (x.share || 0) + '%', fmc(+x.contribution)]));
  H('Company profile');
  TB(['Particular', 'Details'], [['Name', c.name], ['Constitution', c.constitution], ['Registration no.', c.regNo], ['Tax ID', c.taxId], ['GST / VAT', c.gst], ['MSME / Udyam', c.msme], ['Incorporated', c.incorporated], ['Location', [c.location, c.city, c.state].filter(Boolean).join(', ')]].filter(r => r[1]));
  H('Products and capacity');
  TB(['Product', 'Unit', 'Installed capacity / yr', `Price (${curSymbol()})`], p.products.map(x => [x.name, x.unit, fn(+x.capacity), fn(+x.price, 2)]));
  ST([['Capacity utilisation', R.util, '', v => fn(v * 100) + '%'], ['Revenue', R.revenue, 'hl']]);
  H('Market and industry analysis'); P(narr('market'));
  H('Technical feasibility'); P(narr('technical'));
  H('Cost of project and means of finance');
  TB(['Cost of project', unitLabel()], Object.entries(R.pc.byCat).map(([k, v]) => [k, fm(v)]).concat([['Contingency', fm(R.pc.contingency)], ['Pre-operative expenses', fm(R.pc.preop)], ['Preliminary expenses', fm(R.pc.prelim)], R.pc.inCost ? ['Working capital requirement', fm(R.pc.wcReq)] : ['Margin money for working capital', fm(R.pc.marginWC)], ['Total', fm(R.pc.total)]]), [Object.keys(R.pc.byCat).length + 4]);
  TB(['Means of finance', unitLabel(), 'Share'], [['Promoter equity', R.means.equity], ['Term loan', R.means.termLoan], ['Working capital loan', R.means.wcLoan], ['Subsidy / grant', R.means.subsidy], ['Unsecured loans', R.means.unsecured]].filter(r => r[1]).map(r => [r[0], fm(r[1]), fp(r[1] / R.means.total, 0)]).concat([['Total', fm(R.means.total), '100%']]), [99]);
  TB(['Machinery and assets', 'Qty', `Amount (${unitLabel()})`, 'Quotation'], p.assets.map(a => [a.desc, fn(+a.qty), fm((+a.qty || 0) * (+a.rate || 0)), a.quote || '—']));
  H('Operating assumptions');
  TB(['Position', 'Number', `Monthly salary (${curSymbol()})`], p.manpower.map(x => [x.role, fn(+x.count), fn(+x.salary)]));
  P(`Raw material cost escalates at ${p.opex.rmEsc}% a year and salaries at ${p.opex.salaryEsc}%. Power: ${p.utilities.kw} kW connected load, ${p.utilities.hours} hours a day, ${p.utilities.loadFactor}% load factor at ${curSymbol()}${p.utilities.tariff}/kWh. Holding periods: raw material ${p.wc.rmDays} days, finished goods ${p.wc.fgDays} days, receivables ${p.wc.recDays} days, creditors ${p.wc.credDays} days. Tax at ${p.settings.taxRate}%.`);
  H('Projected profit and loss');
  ST([['Revenue', R.revenue, 'hl'], ['Raw material', R.rawMat], ['Manpower', R.manpower], ['Power & utilities', R.power], ['Other expenses', R.T.map(t => R.otherFixed[t] + R.otherVar[t])], ['EBITDA', R.ebitda, 'hl'], ['Depreciation', R.depn], ['Interest', R.interest], ['Profit before tax', R.pbt], ['Tax', R.tax], ['Profit after tax', R.pat, 'hl']]);
  H('Projected balance sheet');
  ST(['Liabilities', ['Promoter equity & subsidy', R.T.map(() => R.means.equity + R.means.subsidy)], ['Reserves & surplus', R.reserves], ['Term & other loans', R.T.map(t => R.tl.closing[t] + R.exClose[t] + R.means.unsecured)], ['Working capital loan', R.T.map(() => R.wcLoan)], ['Creditors', R.creditors], ['Total', R.totalLiab, 'hl'],
    'Assets', ['Net fixed assets', R.nfa], ['Other non-current assets', R.T.map(t => R.exOpen + R.prelimBal[t])], ['Current assets', R.ca], ['Cash & bank', R.cash], ['Total', R.totalAssets, 'hl']]);
  H('Projected cash flow');
  ST([['Cash from operations', R.cfo], ['Cash from financing', R.cff], ['Closing cash', R.cash, 'hl']]);
  H('Financial ratios and debt service coverage');
  ST([['DSCR', R.dscr, 'hl', fx], ['Interest coverage', R.icr, '', fx], ['Current ratio', R.currentRatio, '', fx], ['Debt / equity', R.debtEquity, '', fx], ['TOL / TNW', R.tolTnw, '', fx], ['EBITDA margin', R.ebitdaM, '', fp], ['Net profit margin', R.npm, '', fp], ['ROCE', R.roce, '', fp]]);
  P(`Average DSCR ${fx(R.avgDscr)}, minimum ${fx(R.minDscr)}, against lender benchmarks of ${fx(+p.benchmarks.avgDscr)} and ${fx(+p.benchmarks.minDscr)}.`);
  if (R.means.termLoan) { H('Loan repayment schedule'); ST([['Opening balance', R.tl.opening], ['Interest', R.tl.interest], ['Principal', R.tl.principal], ['Closing balance', R.tl.closing, 'hl']]); }
  if (m >= 2) { H('Working capital assessment'); ST([['Current assets', R.ca], ['Creditors', R.creditors], ['Working capital gap', R.nwc, 'hl'], ['MPBF Method II', R.mpbf2], ['Turnover method', R.turnover], ['Proposed limit', R.T.map(() => R.wcLoan), 'hl']]); }
  if (m >= 3 && p.historical.length) {
    H('Historical performance and reconciliation');
    TB(['Year', 'Revenue', 'EBITDA', 'PAT', 'Net worth', 'Debt'], p.historical.map(h => [h.fy, fm(+h.revenue), fm(+h.ebitda), fm(+h.pat), fm(+h.netWorth), fm(+h.debt)]));
    const rec = reconStatus();
    TB(['Year', 'GST vs books', 'ITR vs books', 'Bank credits vs books'], p.historical.map((h, i) => [h.fy, rec[i].gst.label, rec[i].itr.label, rec[i].bank.label]));
    if (String(p.growthReason || '').trim()) P('Basis for projected growth: ' + p.growthReason);
  }
  H('Sensitivity and break-even');
  const y3 = Math.min(2, R.N - 1);
  TB(['Scenario', 'Average DSCR', 'Minimum DSCR', `${yl(y3)} PAT`, `${yl(y3)} break-even`], sensitivity().map(s => [s.name, fx(s.r.avgDscr), fx(s.r.minDscr), fm(s.r.pat[y3]), fp(s.r.bepPct[y3], 0)]), [0]);
  H('Risk analysis');
  TB(['Risk', 'Impact', 'Mitigation'], p.risks.map(r => [r.risk, r.impact, r.mitigation]));
  H('Statutory approvals');
  const labels = { ok: 'Provided', missing: 'Details pending', maybe: 'Under review', na: 'Not applicable' };
  const comp = COMPLIANCE.base.concat(COMPLIANCE[p.setup.sector] || []).map(it => [it, labels[p.compliance[it.replace(/[^\w]/g, '_')]] || 'To be confirmed']);
  TB(['Licence / approval', 'Status'], comp);
  H('Implementation schedule');
  TB(['Activity', 'Start month', 'Duration'], p.implementation.map(r => [r.task, String(+r.start + 1), r.months + ' months']));
  H('Conclusion'); P(narr('conclusion'));
  return B;
}
function modelToHTML(B) {
  return B.map(b => {
    if (b.t === 'cover') return `<div class="cover"><div class="eyebrow">${esc(b.title)}</div><h1>${esc(b.name)}</h1>${b.lines.map(l => `<p style="margin:4px 0">${esc(l)}</p>`).join('')}</div>`;
    if (b.t === 'h') return `<h2>${esc(b.text)}</h2>`;
    if (b.t === 'p') return `<p>${esc(b.text)}</p>`;
    return `<div class="tw" style="margin:8px 0 14px"><table><thead><tr>${b.head.map((h, i) => `<th class="${i ? 'n' : ''}">${esc(h)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r, ri) => `<tr class="${b.hl.includes(ri) ? 'hl' : ''}">${r.map((c, i) => `<td class="${i ? 'n' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  }).join('');
}

/* ---- exports ---- */
const LIBS = {
  xlsx: '/vendor/xlsx.full.min.js',
  jspdf: '/vendor/jspdf.umd.min.js',
  autotable: '/vendor/jspdf.plugin.autotable.min.js',
  docx: '/vendor/docx.umd.js'
};
const loaded = {};
function loadScript(url) {
  if (!loaded[url]) loaded[url] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = url; s.onload = res; s.onerror = () => { delete loaded[url]; rej(new Error('Could not load the export library. Check your connection and try again.')); }; document.head.appendChild(s); });
  return loaded[url];
}
const slug = s => String(s || 'project').replace(/[\\/:*?"<>|]+/g, '').trim().slice(0, 60) || 'project';
async function saveFile(filename, data) {
  if (!S.dl) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000); toast('Downloaded ' + filename); return;
  }
  try { await S.dl.save({ filename, data }); toast('Saved ' + filename); }
  catch (e) { if (e && e.code === 'declined') return; toast(e && e.code === 'rate_limited' ? 'Another download is waiting for confirmation.' : 'Download failed: ' + (e && (e.message || e.code))); }
}
async function withBusy(key, fn) { S.busy[key] = true; render(); try { await fn(); } catch (e) { toast(e.message || String(e)); } finally { S.busy[key] = false; render(); } }
function blockingCount() { return S.issues.filter(i => i.sev === 'bad').length; }
async function exportXLSX() {
  await loadScript(LIBS.xlsx);
  const R = S.R, p = S.cur, m = mode(); const wb = XLSX.utils.book_new(); const d = unitDiv();
  const num = v => (v == null || !isFinite(v) ? null : Math.round(v / d * 100) / 100);
  const raw = v => (v == null || !isFinite(v) ? null : Math.round(v * 1000) / 1000);
  const sheet = (name, rows, cols) => {
    cols = cols || R.T.map(yl);
    const aoa = [[p.name], [`${name} — ${unitLabel()}`], [], ['Particulars', ...cols]];
    rows.forEach(r => { if (typeof r === 'string') aoa.push([r]); else aoa.push([r[0], ...r[1].map(r[2] === 'ratio' ? raw : num)]); });
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 42 }, ...cols.map(() => ({ wch: 14 }))];
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };
  const summary = [[p.name], ['Financial model summary'], [], ['Mode', MODES[m - 1].name], ['Currency', p.settings.currency], ['Amounts in', unitLabel()], ['Projection years', R.N], ['Project cost', num(R.pc.total)], ['Promoter equity', num(R.means.equity)], ['Term loan', num(R.means.termLoan)], ['Working capital loan', num(R.wcLoan)], ['Average DSCR', raw(R.avgDscr)], ['Minimum DSCR', raw(R.minDscr)], ['Project IRR', raw(R.irr)], ['Payback (years)', raw(R.payback)], [], ['Generated by Bizvora on ' + new Date().toISOString().slice(0, 10)]];
  const ws0 = XLSX.utils.aoa_to_sheet(summary); ws0['!cols'] = [{ wch: 30 }, { wch: 22 }]; XLSX.utils.book_append_sheet(wb, ws0, 'Summary');
  const asm = [['Assumptions'], [], ['Product', 'Unit', 'Capacity / yr', 'Price', 'RM / unit', 'Price growth %'], ...p.products.map(x => [x.name, x.unit, +x.capacity, +x.price, +x.rmCost, +x.growth]), [], ['Utilisation %', ...R.util.map(u => u * 100)], [],
    ['Asset', 'Category', 'Qty', 'Rate', 'Amount', 'Dep % SLM', 'Quotation'], ...p.assets.map(a => [a.desc, a.cat, +a.qty, +a.rate, (+a.qty || 0) * (+a.rate || 0), +a.dep, a.quote]), [],
    ['Position', 'Number', 'Monthly salary'], ...p.manpower.map(x => [x.role, +x.count, +x.salary]), [], ['Expense', 'Basis', 'Value', 'Escalation %'], ...p.opex.other.map(e => [e.name, e.basis === 'pct' ? '% of sales' : 'Fixed', +e.value, +e.esc]), [],
    ['Holding days', 'RM', 'WIP', 'FG', 'Receivables', 'Creditors'], ['', +p.wc.rmDays, +p.wc.wipDays, +p.wc.fgDays, +p.wc.recDays, +p.wc.credDays], [], ['Loan', 'Amount', 'Rate %', 'Tenure yrs', 'Moratorium mo'], ['Term loan', +p.finance.termLoan, +p.finance.tlRate, +p.finance.tlTenure, +p.finance.moratorium], ['Working capital', +p.finance.wcLoan, +p.finance.wcRate], ['Tax rate %', +p.settings.taxRate]];
  const wsA = XLSX.utils.aoa_to_sheet(asm); wsA['!cols'] = [{ wch: 36 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 28 }]; XLSX.utils.book_append_sheet(wb, wsA, 'Assumptions (full amounts)');
  sheet('Profit & Loss', [['Revenue', R.revenue], ['Raw material', R.rawMat], ['Manpower', R.manpower], ['Power', R.power], ['Other fixed', R.otherFixed], ['Other variable', R.otherVar], ['EBITDA', R.ebitda], ['Depreciation', R.depn], ['Interest', R.interest], ['Preliminary written off', R.prelimWO], ['PBT', R.pbt], ['Tax', R.tax], ['PAT', R.pat]]);
  sheet('Cash Flow', [['Opening cash', R.T.map(t => t ? R.cash[t - 1] : R.cash0)], ['Cash from operations', R.cfo], ['Cash from financing', R.cff], ['Closing cash', R.cash]]);
  sheet('Balance Sheet', ['Liabilities', ['Equity', R.T.map(() => R.means.equity)], ['Subsidy', R.T.map(() => R.means.subsidy)], ['Reserves', R.reserves], ['Unsecured loans', R.T.map(() => R.means.unsecured)], ['Term loan', R.tl.closing], ['Existing loans', R.exClose], ['WC loan', R.T.map(() => R.wcLoan)], ['Creditors', R.creditors], ['Total liabilities', R.totalLiab],
    'Assets', ['Net fixed assets', R.nfa], ['Existing assets', R.T.map(() => R.exOpen)], ['Preliminary unamortised', R.prelimBal], ['Inventory', R.T.map(t => R.rmStock[t] + R.wip[t] + R.fg[t])], ['Receivables', R.recv], ['Cash', R.cash], ['Total assets', R.totalAssets]]);
  sheet('Ratios', [['DSCR', R.dscr, 'ratio'], ['Interest coverage', R.icr, 'ratio'], ['Current ratio', R.currentRatio, 'ratio'], ['Debt / equity', R.debtEquity, 'ratio'], ['TOL / TNW', R.tolTnw, 'ratio'], ['EBITDA margin', R.ebitdaM, 'ratio'], ['Net margin', R.npm, 'ratio'], ['ROCE', R.roce, 'ratio'], ['ROE', R.roe, 'ratio'], ['Break-even % of sales', R.bepPct, 'ratio']]);
  sheet('Loan Schedule', [['Opening', R.tl.opening], ['Interest', R.tl.interest], ['Principal', R.tl.principal], ['Closing', R.tl.closing], ['Existing loans interest', R.exInt], ['Existing loans principal', R.exPrin]]);
  sheet('WC & MPBF', [['Current assets', R.ca], ['Creditors', R.creditors], ['WC gap', R.nwc], ['MPBF Method I', R.mpbf1], ['MPBF Method II', R.mpbf2], ['Turnover method', R.turnover], ['Proposed limit', R.T.map(() => R.wcLoan)]]);
  const y3 = Math.min(2, R.N - 1);
  const sens = [['Sensitivity'], [], ['Scenario', 'Avg DSCR', 'Min DSCR', `${yl(y3)} PAT (${unitLabel()})`, `${yl(y3)} BEP %`], ...sensitivity().map(s => [s.name, raw(s.r.avgDscr), raw(s.r.minDscr), num(s.r.pat[y3]), raw(s.r.bepPct[y3] * 100)])];
  const wsS = XLSX.utils.aoa_to_sheet(sens); wsS['!cols'] = [{ wch: 38 }, { wch: 12 }, { wch: 12 }, { wch: 18 }, { wch: 12 }]; XLSX.utils.book_append_sheet(wb, wsS, 'Sensitivity');
  if (m >= 3 && p.historical.length) {
    const H = p.historical; const cols = H.map(h => h.fy + ' (A)').concat(R.T.map(t => yl(t) + ' (P)'));
    sheet('CMA Form II', [['Net sales', H.map(h => +h.revenue).concat(R.revenue)], ['EBITDA', H.map(h => +h.ebitda).concat(R.ebitda)], ['Depreciation', H.map(h => +h.depn).concat(R.depn)], ['Interest', H.map(h => +h.interest).concat(R.interest)], ['PAT', H.map(h => +h.pat).concat(R.pat)]], cols);
    sheet('CMA Form III', [['Tangible net worth', H.map(h => +h.netWorth).concat(R.tnw)], ['Term liabilities', H.map(h => +h.debt).concat(R.T.map(t => R.tl.closing[t] + R.exClose[t]))], ['Current assets', H.map(h => +h.ca).concat(R.ca)], ['Current liabilities', H.map(h => +h.cl).concat(R.T.map(t => R.creditors[t] + R.wcLoan))]], cols);
    const rec = reconStatus();
    const wsR = XLSX.utils.aoa_to_sheet([['Turnover reconciliation (full amounts)'], [], ['Year', 'Books', 'GST', 'ITR', 'Bank credits', 'GST var', 'ITR var', 'Bank var'], ...H.map((h, i) => [h.fy, +h.revenue, +h.gst, +h.itr, +h.bank, rec[i].gst.label, rec[i].itr.label, rec[i].bank.label])]);
    XLSX.utils.book_append_sheet(wb, wsR, 'Reconciliation');
  }
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  await saveFile(`${slug(p.name)} - Financial Model.xlsx`, new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}

const pdfSafe = s => String(s ?? '').replace(/₹/g, 'Rs.').replace(/[×]/g, 'x').replace(/[−–—]/g, '-').replace(/→/g, '->').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/✓/g, 'OK').replace(/[^\x00-\xFF]/g, '');
async function exportPDF() {
  await loadScript(LIBS.jspdf); await loadScript(LIBS.autotable);
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), Hh = doc.internal.pageSize.getHeight(), M = 48; let y = M;
  const ink = [28, 42, 32]; const ensure = h => { if (y + h > Hh - M) { doc.addPage(); y = M; } };
  for (const b of reportModel()) {
    if (b.t === 'cover') {
      doc.setFillColor(241, 247, 214); doc.rect(0, 0, W, 300, 'F'); doc.setFillColor(252, 238, 242); doc.triangle(W - 220, 300, W, 120, W, 300, 'F');
      doc.setTextColor(47, 125, 79).setFont('helvetica', 'bold').setFontSize(11).text(pdfSafe(b.title).toUpperCase(), M, 110);
      doc.setTextColor(...ink).setFontSize(26); const tl = doc.splitTextToSize(pdfSafe(b.name), W - 2 * M); doc.text(tl, M, 145); y = 145 + tl.length * 30;
      doc.setFont('helvetica', 'normal').setFontSize(11); b.lines.forEach(l => { const ls = doc.splitTextToSize(pdfSafe(l), W - 2 * M); doc.text(ls, M, y); y += ls.length * 15 + 2; });
      doc.addPage(); y = M; continue;
    }
    if (b.t === 'h') { ensure(60); y += 8; doc.setFont('helvetica', 'bold').setFontSize(14).setTextColor(...ink).text(pdfSafe(b.text), M, y); y += 7; doc.setDrawColor(195, 220, 82).setLineWidth(1.6).line(M, y, W - M, y); y += 18; continue; }
    if (b.t === 'p') { doc.setFont('helvetica', 'normal').setFontSize(10.5).setTextColor(...ink); doc.splitTextToSize(pdfSafe(b.text), W - 2 * M).forEach(line => { ensure(15); doc.text(line, M, y); y += 15; }); y += 6; continue; }
    const wide = b.head.length > 9;
    doc.autoTable({ startY: y, head: [b.head.map(pdfSafe)], body: b.rows.map(r => r.map(pdfSafe)), margin: { left: M, right: M }, theme: 'grid',
      styles: { fontSize: wide ? 6.8 : 8.5, cellPadding: 3, textColor: ink, lineColor: [220, 231, 211], lineWidth: 0.5 },
      headStyles: { fillColor: [241, 247, 214], textColor: ink, fontStyle: 'bold' },
      didParseCell: d => { if (d.column.index > 0 && b.head.length > 2) d.cell.styles.halign = 'right'; if (d.section === 'body' && b.hl.includes(d.row.index)) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [238, 245, 228]; } } });
    y = doc.lastAutoTable.finalY + 16;
  }
  const pages = doc.getNumberOfPages();
  for (let i = 2; i <= pages; i++) { doc.setPage(i); doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(93, 110, 97); doc.text(pdfSafe(`${S.cur.company.name || S.cur.name} - Detailed Project Report`), M, Hh - 24); doc.text(`Page ${i - 1} of ${pages - 1}`, W - M, Hh - 24, { align: 'right' }); }
  await saveFile(`${slug(S.cur.name)} - DPR.pdf`, doc.output('blob'));
}
async function exportDOCX() {
  await loadScript(LIBS.docx);
  const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType, ShadingType, PageBreak, Footer, PageNumber } = window.docx;
  const kids = [];
  for (const b of reportModel()) {
    if (b.t === 'cover') {
      kids.push(new Paragraph({ spacing: { before: 2400, after: 200 }, children: [new TextRun({ text: b.title.toUpperCase(), bold: true, color: '2F7D4F', size: 22 })] }));
      kids.push(new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: b.name, bold: true, size: 56, color: '1C2A20' })] }));
      b.lines.forEach(l => kids.push(new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: l, size: 24 })] })));
      kids.push(new Paragraph({ children: [new PageBreak()] })); continue;
    }
    if (b.t === 'h') { kids.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160 }, children: [new TextRun({ text: b.text, color: '1C2A20' })] })); continue; }
    if (b.t === 'p') { kids.push(new Paragraph({ spacing: { after: 140, line: 300 }, children: [new TextRun({ text: b.text, size: 21 })] })); continue; }
    const sz = b.head.length > 9 ? 14 : 17;
    const mk = (cells, isHead, hl) => new TableRow({ tableHeader: isHead, children: cells.map((c, ci) => new TableCell({
      shading: isHead || hl ? { type: ShadingType.CLEAR, color: 'auto', fill: isHead ? 'F1F7D6' : 'EEF5E4' } : undefined,
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      children: [new Paragraph({ alignment: ci > 0 && b.head.length > 2 ? AlignmentType.RIGHT : AlignmentType.LEFT, children: [new TextRun({ text: String(c ?? ''), size: sz, bold: isHead || hl })] })] })) });
    kids.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [mk(b.head, true, false), ...b.rows.map((r, ri) => mk(r, false, b.hl.includes(ri)))] }));
    kids.push(new Paragraph({ spacing: { after: 160 }, children: [] }));
  }
  const doc = new Document({ creator: 'Bizvora', title: `${S.cur.name} — Detailed Project Report`,
    styles: { default: { document: { run: { font: 'Calibri', size: 21 } } } },
    sections: [{ footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Page ', PageNumber.CURRENT], size: 16, color: '5D6E61' })] })] }) }, children: kids }] });
  const blob = await Packer.toBlob(doc);
  await saveFile(`${slug(S.cur.name)} - DPR.docx`, blob);
}
async function exportJSON() { const p = clone(S.cur); delete p._summary; await saveFile(`${slug(p.name)} - project backup.json`, JSON.stringify(p, null, 2)); }

/* ---- AI ---- */
function factsForAI() {
  const p = S.cur, R = S.R;
  return JSON.stringify({ company: p.company, sector: p.setup.sector, purposes: p.setup.purposes, country: p.settings.country, currency: p.settings.currency, amountsIn: unitLabel(),
    products: p.products.map(x => ({ name: x.name, unit: x.unit, capacity: x.capacity, price: x.price })), process: p.process,
    promoters: p.promoters.map(x => ({ name: x.name, role: x.role, qualification: x.qualification, experienceYears: x.experience, sharePct: x.share })),
    keyFigures: { projectCost: fmc(R.pc.total), promoterEquity: fmc(R.means.equity), termLoan: fmc(R.means.termLoan), wcLimit: fmc(R.wcLoan), lender: p.finance.bank,
      revenueByYear: R.T.map(t => `${yl(t)}: ${fmc(R.revenue[t])}`), patByYear: R.T.map(t => `${yl(t)}: ${fmc(R.pat[t])}`), avgDscr: fx(R.avgDscr), minDscr: fx(R.minDscr), breakEvenY3: fp(R.bepPct[Math.min(2, R.N - 1)], 0), irr: fp(R.irr) },
    growthReason: p.growthReason, machinery: p.assets.map(a => a.desc) });
}
async function aiDraft(k) {
  if (!S.sample) return; const t = NARR.find(n => n.k === k).t;
  const prompt = `You are writing the "${t}" section of a Detailed Project Report that a lender or investor will read.\nFacts (JSON):\n${factsForAI()}\n\nWrite 2 to 4 short paragraphs of plain text separated by blank lines. No headings, no bullet points, no markdown. Use only the numbers given in the facts, exactly as formatted. Where a fact is missing, write in general terms without inventing figures, names or sources. Keep a factual, professional tone.`;
  S.busy['ai-' + k] = true; render();
  try {
    const r = await S.sample(prompt, { onText: ({ text }) => { const el = document.getElementById(fid('narrative.' + k)); if (el) el.value = text; } });
    S.cur.narrative[k] = r.text.trim();
  } catch (e) { if (e && e.text) S.cur.narrative[k] = e.text; toast(e && e.code === 'not_granted' ? 'AI drafting was not allowed.' : 'AI draft stopped: ' + ((e && (e.message || e.code)) || 'error')); }
  S.busy['ai-' + k] = false; changed(true);
}
async function aiRisks() {
  if (!S.sample) return; S.busy['ai-risks'] = true; render();
  try {
    const j = await S.sample.json(`List the 6 most relevant project-specific risks for this project, for a lender's appraisal.\nFacts (JSON):\n${factsForAI()}\n\nReturn JSON: {"risks":[{"risk": short name, "impact": "High"|"Medium"|"Low", "mitigation": one sentence}]}. Do not invent figures.`);
    if (Array.isArray(j.risks) && j.risks.length) S.cur.risks = j.risks.map(r => ({ risk: String(r.risk || ''), impact: String(r.impact || 'Medium'), mitigation: String(r.mitigation || '') }));
  } catch (e) { toast('Risk suggestions failed: ' + ((e && (e.message || e.code)) || 'error')); }
  S.busy['ai-risks'] = false; changed(true);
}
async function readQuote(file) {
  S.extract = { busy: true, name: file.name }; render();
  const instr = 'Extract the line items from this supplier quotation for a project report. Return JSON: {"vendor": string, "items":[{"description": string, "qty": number, "unitPrice": number, "freight": number, "installation": number, "taxPct": number}]}. Amounts are plain numbers in the quotation currency. Freight and installation are per line; split a single total across lines by value. Use 0 when absent.';
  try {
    let j;
    if (file.type.startsWith('image/')) {
      if (!S.sampleImages) throw new Error('Reading images is not available here. Save the quotation text as a .txt file and try again.');
      j = await S.sample.json(instr, { images: [file] });
    } else j = await S.sample.json(instr + '\n\nQuotation text:\n' + (await file.text()).slice(0, 20000));
    S.extract = { name: file.name, vendor: j.vendor, items: Array.isArray(j.items) ? j.items : [] };
    if (!S.extract.items.length) S.extract = { name: file.name, error: 'No line items were found in this file.' };
  } catch (e) { S.extract = { name: file.name, error: (e && e.message) || 'Could not read the quotation.' }; }
  render();
}

function vReport() {
  const p = S.cur; const pro = isUnlocked(p); const lockPill = pro ? '' : `<span class="pill mode">${inr(amountDueNow(p))}</span>`; const B = reportModel(); const nb = blockingCount();
  const aiBtn = k => S.sample ? `<button class="btn sm lime" data-act="ai" data-v="${k}" ${S.busy['ai-' + k] ? 'disabled' : ''}>${S.busy['ai-' + k] ? 'Writing…' : (String(p.narrative[k] || '').trim() ? 'Rewrite with AI' : 'Draft with AI')}</button>` : '';
  return `${head('Output', 'Report & export', `Edit the narrative, check the preview, then download. The Excel model is free; the PDF and Word report unlock for ${inr(priceOf(mode()))} per project.`)}
  <div class="card"><h3>Download</h3>
    <div class="row">
      <button class="btn" data-act="xlsx" ${S.busy.xlsx ? 'disabled' : ''}>${S.busy.xlsx ? 'Building…' : 'Financial model (.xlsx)'}</button>
      <button class="btn ${pro ? 'pri' : ''}" data-act="pdf" ${S.busy.pdf ? 'disabled' : ''}>${S.busy.pdf ? 'Building…' : 'DPR report (.pdf)'} ${lockPill}</button>
      <button class="btn ${pro ? 'pri' : ''}" data-act="docx" ${S.busy.docx ? 'disabled' : ''}>${S.busy.docx ? 'Building…' : 'Editable DPR (.docx)'} ${lockPill}</button>
      <button class="btn ghost" data-act="json">Project backup (.json)</button>
      <label class="btn ghost" for="importFile">Import backup</label><input id="importFile" type="file" accept=".json,application/json" hidden>
    </div>
    <p class="small muted" style="margin:10px 0 0">${pro ? pill('ok', 'Report unlocked') : `Locked · <button class="linkbtn" data-act="unlock">Unlock for ${inr(amountDueNow(p))}</button>`} ${nb ? `${pill('bad', nb + ' blocking')} Fix blocking checks before generating the final report.` : pill('ok', 'All blocking checks passed')} The Excel model holds values; formulas arrive in the production version.</p></div>
  <div class="card"><h3>Narrative</h3><div class="grid" style="gap:18px">
    ${NARR.map(n => `<div><div class="row" style="justify-content:space-between;margin-bottom:6px"><b>${esc(n.t)}</b><div class="row">${aiBtn(n.k)}${String(p.narrative[n.k] || '').trim() ? `<button class="btn sm ghost" data-act="narrdefault" data-v="${n.k}">Reset to default</button>` : ''}</div></div>
      <textarea class="f" style="width:100%;min-height:120px;padding:10px 12px;border:1px solid var(--line);border-radius:var(--r-sm);background:var(--bg);line-height:1.55" id="${fid('narrative.' + n.k)}" data-k="narrative.${n.k}" placeholder="${esc(defaultNarr(n.k))}" aria-label="${esc(n.t)}">${esc(p.narrative[n.k] || '')}</textarea></div>`).join('')}
    <p class="small muted" style="margin:0">Empty boxes use the default text shown in grey, built from your numbers.${S.sample ? ' AI drafts use only the figures in this project; review them before sending.' : ''}</p></div></div>
  <div class="card"><h3>Risks</h3>${etable('risks', [{ k: 'risk', label: 'Risk', w: 220 }, { k: 'impact', label: 'Impact', sel: ['High', 'Medium', 'Low'], w: 100 }, { k: 'mitigation', label: 'Mitigation', w: 360 }], { addLabel: 'Add risk', extra: S.sample ? `<button class="btn sm lime" data-act="airisks" ${S.busy['ai-risks'] ? 'disabled' : ''}>${S.busy['ai-risks'] ? 'Thinking…' : 'Suggest risks with AI'}</button>` : '' })}</div>
  <div><div class="eyebrow" style="margin:6px 0 10px">Preview</div><div class="paper">${modelToHTML(B)}</div></div>`;
}

function miniMoney(v, s) {
  if (!s) return String(v);
  const list = UNITS[s.numSystem] || UNITS.intl; const u = list.find(x => x[0] === +s.unit) || list[0];
  let sym = s.currency; try { sym = new Intl.NumberFormat('en', { style: 'currency', currency: s.currency, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find(x => x.type === 'currency').value; } catch (e) { }
  return sym + new Intl.NumberFormat(s.numSystem === 'indian' ? 'en-IN' : 'en-US', { maximumFractionDigits: 2 }).format(v / u[0]) + ({ 1e3: ' K', 1e5: ' L', 1e6: ' M', 1e7: ' Cr', 1e9: ' B' }[u[0]] || '');
}

