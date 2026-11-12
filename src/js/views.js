/* ===== Views ===== */
const mode = () => +S.cur.settings.mode || 1;
const Y = () => S.R.T;

function vOverview() {
  const R = S.R, p = S.cur, b = p.benchmarks;
  const eqPct = R.pc.total ? R.means.equity / R.pc.total : 0;
  const counts = { bad: 0, warn: 0, ok: 0 }; S.issues.forEach(i => { if (!p.issuesIgnored[i.key]) counts[i.sev]++; });
  const top = S.issues.filter(i => i.sev !== 'ok' && !p.issuesIgnored[i.key]).slice(0, 5);
  const rec = reconStatus();
  const y3 = Math.min(2, R.N - 1);
  return `${head('Project overview', p.name, `${esc(p.setup.sector)} · ${esc(p.company.city || p.settings.country || '')} · ${esc(p.setup.purposes.join(', '))}`,
    `<span class="pill mode">Mode ${mode()} — ${esc(MODES[mode() - 1].name)}</span>`)}
  <div class="kpis">
    ${kpi('Project cost', fmc(R.pc.total), `${esc(unitLabel())}`, 'feature')}
    ${kpi('Promoter contribution', fmc(R.means.equity), `${fp(eqPct, 0)} of project cost`)}
    ${kpi('Term loan', fmc(R.means.termLoan), `${fn(p.finance.tlRate, 2)}% · ${fn(p.finance.tlTenure)} yrs incl. ${fn(p.finance.moratorium)} mo moratorium`)}
    ${kpi('Working capital finance', fmc(R.wcLoan), `Assessed ${fmc(R.assessed[0])} in ${yl(0)}`)}
  </div>
  <div class="kpis">
    ${kpi('Average DSCR', fx(R.avgDscr), `Min ${fx(R.minDscr)} · benchmark ${fx(+b.avgDscr)}`)}
    ${kpi(`Current ratio ${yl(1)}`, fx(R.currentRatio[1]), `Benchmark ${fx(+b.currentRatio)}`)}
    ${kpi(`Debt / equity ${yl(0)}`, fx(R.debtEquity[0]), `Benchmark ≤ ${fx(+b.debtEquity)}`)}
    ${kpi(`Break-even ${yl(y3)}`, fp(R.bepPct[y3], 0), `Project IRR ${fp(R.irr)} · payback ${R.payback ? R.payback.toFixed(1) + ' yrs' : '–'}`)}
  </div>
  <div class="grid g2">
    <div class="card"><h3>Revenue and profit after tax</h3>${legend([['var(--chart-1)', 'Revenue'], ['var(--chart-2)', 'PAT'], ['var(--chart-3)', 'EBITDA']])}
      ${barChart({ labels: Y().map(yl), series: [{ name: 'Revenue', vals: R.revenue, color: 'var(--chart-1)' }, { name: 'PAT', vals: R.pat, color: 'var(--chart-2)' }], line: { vals: R.ebitda, color: 'var(--chart-3)' } })}
      <p class="small muted" style="margin:6px 0 0">${esc(unitLabel())}</p></div>
    <div class="card"><h3>Debt service coverage by year</h3>${legend([['var(--chart-1)', 'DSCR'], ['var(--bad)', 'Minimum benchmark']])}
      ${barChart({ labels: Y().map(yl), series: [{ name: 'DSCR', vals: R.dscr, color: 'var(--chart-1)' }], bench: +b.minDscr, fmtY: v => v.toFixed(1) + '×' })}</div>
  </div>
  <div class="grid g2">
    <div class="card"><h3>Report readiness</h3>
      <div class="row" style="margin-bottom:12px">${pill('bad', counts.bad + ' blocking')}${pill('warn', counts.warn + ' to review')}${pill('ok', counts.ok + ' passed')}</div>
      <div class="issues">${top.length ? top.map(issueRow).join('') : `<p class="muted">No open issues. The report is ready to generate.</p>`}</div>
      <div class="row" style="margin-top:12px"><button class="btn sm" data-act="nav" data-v="checks">Open all checks</button><button class="btn sm pri" data-act="nav" data-v="report">Go to report</button></div></div>
    <div class="card"><h3>Data quality</h3>
      ${mode() >= 3 && p.historical.length ? `<div class="tw"><table><thead><tr><th>Source vs books</th>${p.historical.map(h => `<th>${esc(h.fy)}</th>`).join('')}</tr></thead><tbody>
        ${['gst', 'itr', 'bank'].map(k => `<tr><td>${{ gst: 'GST turnover', itr: 'ITR turnover', bank: 'Bank credits' }[k]}</td>${rec.map(r => `<td>${pill(r[k].s, r[k].label)}</td>`).join('')}</tr>`).join('')}
      </tbody></table></div>` : `<p class="muted small">Historical reconciliation runs in Mode 3 once past financials are entered.</p>`}
      <div class="row" style="margin-top:12px">${pill(R.bsDiff.every(d => Math.abs(d) < 1) ? 'ok' : 'bad', 'Balance sheet ' + (R.bsDiff.every(d => Math.abs(d) < 1) ? 'balances' : 'does not balance'))}
      ${pill(Math.abs(R.pc.total - R.means.total) < 1 ? 'ok' : 'bad', 'Cost = means ' + (Math.abs(R.pc.total - R.means.total) < 1 ? 'matched' : 'gap ' + fmc(R.means.total - R.pc.total)))}
      ${pill(p.assets.every(a => a.quote) ? 'ok' : 'warn', p.assets.filter(a => !a.quote).length ? p.assets.filter(a => !a.quote).length + ' assets without quotation' : 'All quotations linked')}</div></div>
  </div>`;
}

function vSetup() {
  const p = S.cur, s = p.settings; const sug = suggestedMode();
  const units = UNITS[s.numSystem] || UNITS.intl;
  return `${head('Step 1', 'Setup & mode', 'Pick what the report is for. The mode decides which modules and output files appear.')}
  <div class="card"><h3>Report mode</h3><div class="modes">${MODES.map(m => `<button class="mode ${mode() === m.n ? 'on' : ''}" data-act="mode" data-v="${m.n}" aria-pressed="${mode() === m.n}"><b>Mode ${m.n} · ${esc(m.name)}</b><span>${esc(m.desc)}</span></button>`).join('')}</div>
    ${sug !== mode() ? `<p class="small" style="margin:10px 0 0">Your purpose and finance choices suggest <b>Mode ${sug}</b>. <button class="btn sm" data-act="mode" data-v="${sug}">Switch to Mode ${sug}</button></p>` : ''}</div>
  <div class="card"><h3>Purpose</h3><p class="small muted" style="margin:-6px 0 10px">Select all that apply.</p>${chips('setup.purposes', PURPOSES)}</div>
  <div class="grid g2">
    <div class="card"><h3>Business type</h3>${fsel('Sector template', 'setup.sector', SECTORS)}
      <label class="row small" style="margin-top:12px"><input type="checkbox" id="f_existing" data-k="setup.existing" data-t="b" ${p.setup.existing ? 'checked' : ''}> Existing business (expansion, modernisation or takeover)</label></div>
    <div class="card"><h3>Finance</h3>${radioChips('setup.financeMode', [['Self', 'No finance / self-funded'], ['Bank', 'Bank / financial institution'], ['Investor', 'Investor funding']])}
      ${p.setup.financeMode === 'Bank' ? `<p class="small muted" style="margin:12px 0 8px">Facilities required</p>${chips('setup.loanTypes', LOAN_TYPES)}` : ''}</div>
  </div>
  <div class="card"><h3>Country, currency and format</h3>
    <div class="grid g4">
      ${field('Country', 'settings.country')}
      ${fsel('Currency', 'settings.currency', CURRENCIES.map(c => [c[0], `${c[0]} — ${c[1]}`]))}
      ${fsel('Number system', 'settings.numSystem', [['indian', 'Lakh / crore'], ['intl', 'Thousand / million']])}
      ${fsel('Show amounts in', 'settings.unit', units.map(u => [u[0], u[1]]), { num: true })}
      ${field('First projection year', 'settings.firstYear', { num: true })}
      ${fsel('Financial year starts', 'settings.fyStart', ['April', 'January', 'July', 'October'])}
      ${fsel('Projection period', 'settings.years', [5, 6, 7, 8, 9, 10].map(n => [n, n + ' years']), { num: true })}
      ${field('Income tax rate', 'settings.taxRate', { num: true, suffix: '%' })}
    </div></div>
  <div class="card"><h3>Implementation schedule</h3>
    ${etable('implementation', [{ k: 'task', label: 'Activity', w: 240 }, { k: 'start', label: 'Start month', num: true }, { k: 'months', label: 'Duration (months)', num: true }], { addLabel: 'Add activity' })}
    <div style="margin-top:14px">${gantt(p.implementation)}</div></div>`;
}
function gantt(rows) {
  const end = Math.max(1, ...rows.map(r => (+r.start || 0) + (+r.months || 0)));
  return `<div class="gantt">${rows.map(r => `<div class="gr"><span>${esc(r.task)}</span><div class="track"><div class="bar" style="left:${(+r.start || 0) / end * 100}%;width:${Math.max(2, (+r.months || 0) / end * 100)}%" title="Month ${+r.start + 1} to ${+r.start + +r.months}"></div></div></div>`).join('')}
  <div class="gr small muted"><span></span><div class="row" style="justify-content:space-between"><span>Month 0</span><span>Month ${end}</span></div></div></div>`;
}

function vCompany() {
  const p = S.cur;
  const totalContrib = p.promoters.reduce((s, x) => s + (+x.contribution || 0), 0);
  return `${head('Step 2', 'Company & promoters', 'Legal identity, location and the people behind the project.')}
  <div class="card"><h3>Company</h3><div class="grid g3">
    ${field('Company name', 'company.name')}${fsel('Constitution', 'company.constitution', ['Proprietorship', 'Partnership', 'LLP', 'Private Limited Company', 'Public Limited Company', 'One Person Company', 'Cooperative', 'Trust / Society'])}
    ${field('Incorporation date', 'company.incorporated', { type: 'date' })}
    ${field('Registration no. (CIN / LLPIN)', 'company.regNo')}${field('Tax ID (PAN)', 'company.taxId')}${field('GST / VAT no.', 'company.gst')}
    ${field('MSME / Udyam no.', 'company.msme')}${field('Project location', 'company.location')}${field('City / district', 'company.city')}
    ${field('State / region', 'company.state')}${field('Proposed start date', 'company.start', { type: 'date' })}${field('Implementation period', 'company.implMonths', { num: true, suffix: 'mo' })}
  </div><div style="margin-top:14px">${area('Business activity', 'company.activity', { rows: 2 })}</div></div>
  <div class="card"><h3>Promoters</h3>
    ${etable('promoters', [{ k: 'name', label: 'Name', w: 160 }, { k: 'role', label: 'Role', w: 140 }, { k: 'age', label: 'Age', num: true }, { k: 'qualification', label: 'Qualification', w: 150 },
      { k: 'experience', label: 'Experience (yrs)', num: true }, { k: 'netWorth', label: `Net worth (${curSymbol()})`, num: true, w: 120 }, { k: 'share', label: 'Share %', num: true }, { k: 'contribution', label: `Contribution (${curSymbol()})`, num: true, w: 120 }], { addLabel: 'Add promoter' })}
    <p class="small ${Math.abs(totalContrib - S.R.means.equity) > 1 ? '' : 'muted'}" style="margin:10px 0 0">Promoters' stated contribution ${fmc(totalContrib)} vs promoter equity in means of finance ${fmc(S.R.means.equity)}. ${Math.abs(totalContrib - S.R.means.equity) > 1 ? pill('warn', 'Mismatch') : pill('ok', 'Matched')}</p></div>
  <div class="card"><h3>Manufacturing / operating process</h3>${area('Process flow (use → between steps)', 'process', { rows: 3 })}
    <div class="row small" style="margin-top:10px;gap:6px">${String(p.process || '').split('→').map((s, i, a) => `<span class="pill na">${esc(s.trim())}</span>${i < a.length - 1 ? '<span class="muted">→</span>' : ''}`).join('')}</div></div>`;
}

function vProducts() {
  const R = S.R, p = S.cur;
  return `${head('Step 3', 'Products & capacity', 'Revenue = installed capacity × utilisation × selling price, escalated each year.')}
  <div class="card"><h3>Products</h3>
    ${etable('products', [{ k: 'name', label: 'Product', w: 200 }, { k: 'unit', label: 'Unit', w: 70 }, { k: 'capacity', label: 'Installed capacity / yr', num: true, w: 120 },
      { k: 'price', label: `Price / unit (${curSymbol()})`, num: true }, { k: 'rmCost', label: `Raw material / unit (${curSymbol()})`, num: true }, { k: 'growth', label: 'Price growth %/yr', num: true },
      { k: '_', label: 'Contribution / unit', calc: r => fn((+r.price || 0) - (+r.rmCost || 0), 2) }], { addLabel: 'Add product' })}</div>
  <div class="card"><h3>Product photos and descriptions</h3><p class="small muted" style="margin:-6px 0 12px">Shown in the PDF report. The first photo also goes on the cover. Use clear photos of your own products or samples.</p>
    <div class="grid g2">${p.products.map((pr, i) => `<div class="row" style="align-items:flex-start;gap:12px;flex-wrap:nowrap">
      <div style="width:120px;height:90px;border:1px solid var(--line);border-radius:8px;background:var(--surface);display:grid;place-items:center;overflow:hidden;flex:none">${pr.photo ? `<img src="${pr.photo}" alt="${esc(pr.name)}" style="width:100%;height:100%;object-fit:cover">` : '<span class="small muted">No photo</span>'}</div>
      <div style="flex:1;min-width:0;display:grid;gap:6px"><b class="small">${esc(pr.name || 'Product ' + (i + 1))}</b>
        <textarea id="${fid('products.' + i + '.desc')}" data-k="products.${i}.desc" rows="2" placeholder="Short description and uses of this product" style="width:100%;padding:6px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg)">${esc(pr.desc || '')}</textarea>
        <div class="row"><label class="btn sm" for="photo_${i}">${pr.photo ? 'Change photo' : 'Add photo'}</label><input id="photo_${i}" type="file" accept="image/*" hidden>${pr.photo ? `<button class="btn sm ghost danger" data-act="photodel" data-v="${i}">Remove</button>` : ''}</div></div></div>`).join('')}</div></div>
  <div class="card"><h3>Operating capacity</h3><div class="grid g3">${field('Shifts per day', 'capacity.shifts', { num: true })}${field('Hours per shift', 'capacity.hoursPerShift', { num: true })}${field('Working days per year', 'capacity.days', { num: true })}</div>
    <p class="small muted" style="margin:14px 0 8px">Capacity utilisation by year</p>
    <div class="grid g4">${Y().map(t => field(yl(t), 'capacity.util.' + t, { num: true, suffix: '%' })).join('')}</div></div>
  <div class="card"><h3>Sales projection</h3>${stmt([
    ...R.products.map(pr => [pr.name + ' — quantity', pr.qty, '', v => fn(v)]),
    ...R.products.map(pr => [pr.name + ' — revenue', pr.qty.map((q, t) => q * pr.price[t])]),
    ['Total revenue', R.revenue, 'hl']])}</div>`;
}

function vCost() {
  const R = S.R, pc = R.pc, p = S.cur;
  const ex = S.extract;
  return `${head('Step 4', 'Project cost', 'Fixed assets, pre-operative costs and margin money for working capital. Linked to depreciation and the balance sheet.')}
  <div class="card"><h3>Fixed assets</h3>
    ${etable('assets', [{ k: 'cat', label: 'Category', sel: ASSET_CATS, w: 150 }, { k: 'desc', label: 'Description', w: 240 }, { k: 'qty', label: 'Qty', num: true, w: 60 }, { k: 'rate', label: `Rate (${curSymbol()})`, num: true, w: 110 },
      { k: '_', label: `Amount (${unitLabel()})`, calc: r => fm((+r.qty || 0) * (+r.rate || 0)) }, { k: 'dep', label: 'Dep. % SLM', num: true, w: 70 }, { k: 'quote', label: 'Quotation ref.', w: 170 }],
      { addLabel: 'Add asset', extra: S.sample ? `<label class="btn sm lime" for="quoteFile">Read a quotation with AI</label><input id="quoteFile" type="file" accept="image/*,.txt" hidden>` : '' })}
    ${ex ? extractPanel(ex) : ''}</div>
  <div class="grid g2">
    <div class="card"><h3>Other project costs</h3><div class="grid g3">${field('Contingency on non-land assets', 'cost.contingencyPct', { num: true, suffix: '%' })}${field(`Pre-operative (${curSymbol()})`, 'cost.preop', { num: true })}${field(`Preliminary (${curSymbol()})`, 'cost.prelim', { num: true })}</div>
      <label class="row small" style="margin-top:12px"><input type="checkbox" id="f_wcInCost" data-k="cost.wcInCost" data-t="b" ${p.cost.wcInCost !== false ? 'checked' : ''}> Include full working capital in project cost (bank format)</label>
      <p class="small muted" style="margin:8px 0 0">Preliminary expenses are written off over 5 years. Contingency and pre-operative costs are capitalised. When working capital is included, the working capital loan appears in means of finance.</p></div>
    <div class="card tint"><h3>Cost of project</h3>
      <div class="tw"><table><tbody>
        ${Object.entries(pc.byCat).map(([k, v]) => `<tr><td>${esc(k)}</td><td class="n">${fm(v)}</td></tr>`).join('')}
        <tr><td>Contingency</td><td class="n">${fm(pc.contingency)}</td></tr><tr><td>Pre-operative expenses</td><td class="n">${fm(pc.preop)}</td></tr>
        <tr><td>Preliminary expenses</td><td class="n">${fm(pc.prelim)}</td></tr>${pc.inCost ? `<tr><td>Working capital requirement<div class="small muted">Bank loan ${fm(pc.wcLoanInCost)} + promoter margin ${fm(pc.marginWC)}</div></td><td class="n">${fm(pc.wcReq)}</td></tr>` : `<tr><td>Margin money for working capital</td><td class="n">${fm(pc.marginWC)}</td></tr>`}
        <tr class="hl"><td>Total project cost (${esc(unitLabel())})</td><td class="n">${fm(pc.total)}</td></tr></tbody></table></div></div>
  </div>`;
}
function extractPanel(ex) {
  if (ex.busy) return `<p class="small muted" style="margin-top:12px">Reading ${esc(ex.name)}…</p>`;
  if (ex.error) return `<p class="small" style="margin-top:12px;color:var(--bad)">${esc(ex.error)}</p>`;
  return `<div class="card tint" style="margin-top:14px"><h3>Extracted from ${esc(ex.name)}</h3><div class="tw"><table><thead><tr><th>Item</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Freight + install</th><th class="n">Tax %</th><th></th></tr></thead><tbody>
    ${ex.items.map((it, i) => `<tr><td>${esc(it.description)}</td><td class="n">${fn(it.qty)}</td><td class="n">${fn(it.unitPrice, 2)}</td><td class="n">${fn((+it.freight || 0) + (+it.installation || 0), 2)}</td><td class="n">${fn(it.taxPct, 1)}</td>
    <td>${it.done ? pill(it.done === 'added' ? 'ok' : 'na', it.done) : `<div class="row"><button class="btn sm pri" data-act="exadd" data-i="${i}">Add</button><button class="btn sm ghost" data-act="exskip" data-i="${i}">Ignore</button></div>`}</td></tr>`).join('')}
    </tbody></table></div><p class="small muted" style="margin:8px 0 0">Vendor: ${esc(ex.vendor || '—')}. Added rows are editable in the table above. Freight and installation are included in the rate; tax is excluded when input credit is available.</p></div>`;
}

function vOpex() {
  const R = S.R, p = S.cur, u = p.utilities;
  const kwh = (+u.kw || 0) * (+u.hours || 0) * (+u.days || 0) * (+u.loadFactor || 0) / 100;
  return `${head('Step 5', 'Operating costs', 'Raw material, manpower, utilities and other expenses. Each expense is fixed or a % of sales.')}
  <div class="grid g2">
    <div class="card"><h3>Escalation</h3><div class="grid g3">${field('Raw material cost', 'opex.rmEsc', { num: true, suffix: '%/yr' })}${field('Salaries', 'opex.salaryEsc', { num: true, suffix: '%/yr' })}${field('Benefits (PF, ESI, bonus)', 'opex.benefitsPct', { num: true, suffix: '%' })}</div></div>
    <div class="card"><h3>Electricity</h3><div class="grid g3">${field('Connected load', 'utilities.kw', { num: true, suffix: 'kW' })}${field('Hours per day', 'utilities.hours', { num: true })}${field('Days per year', 'utilities.days', { num: true })}
      ${field('Load factor', 'utilities.loadFactor', { num: true, suffix: '%' })}${field(`Tariff (${curSymbol()}/kWh)`, 'utilities.tariff', { num: true })}${field('Tariff escalation', 'utilities.esc', { num: true, suffix: '%/yr' })}</div>
      <p class="small muted" style="margin:10px 0 0">${fn(kwh)} kWh/yr at full capacity · ${yl(0)} cost ${fmc(R.power[0])} at ${fn(R.util[0] * 100)}% utilisation</p></div>
  </div>
  <div class="card"><h3>Manpower</h3>
    ${etable('manpower', [{ k: 'role', label: 'Position', w: 220 }, { k: 'count', label: 'Number', num: true }, { k: 'salary', label: `Monthly salary (${curSymbol()})`, num: true },
      { k: '_', label: `Annual incl. benefits (${unitLabel()})`, calc: r => fm((+r.count || 0) * (+r.salary || 0) * 12 * (1 + (+p.opex.benefitsPct || 0) / 100)) }], { addLabel: 'Add position' })}</div>
  <div class="card"><h3>Other expenses</h3>
    ${etable('opex.other', [{ k: 'name', label: 'Expense', w: 220 }, { k: 'basis', label: 'Basis', sel: [['fixed', `Fixed (${curSymbol()}/yr)`], ['pct', '% of sales']], w: 150 }, { k: 'value', label: 'Value', num: true }, { k: 'esc', label: 'Escalation %/yr', num: true },
      { k: '_', label: `${yl(0)} (${unitLabel()})`, calc: (r, i) => fm(R.otherLines[i] ? R.otherLines[i].vals[0] : 0) }], { addLabel: 'Add expense' })}</div>
  <div class="card"><h3>Cost of operations</h3>${stmt([['Raw material', R.rawMat], ['Manpower', R.manpower], ['Power', R.power], ['Other — fixed', R.otherFixed], ['Other — % of sales', R.otherVar], ['Total operating cost', R.opex, 'hl']])}</div>`;
}

function vWC() {
  const R = S.R, p = S.cur;
  const methods = [['tandon2', 'MPBF Method II (Tandon)'], ['tandon1', 'MPBF Method I (Tandon)'], ['turnover', 'Turnover method (20% of sales)'], ['holding', 'Holding-period gap (100%)']];
  return `${head('Step 6', 'Working capital', 'Holding periods drive current assets. Choose the assessment method your lender uses.')}
  <div class="card"><h3>Holding periods (days)</h3><div class="grid g4">${field('Raw material stock', 'wc.rmDays', { num: true, suffix: 'days' })}${field('Work in progress', 'wc.wipDays', { num: true, suffix: 'days' })}${field('Finished goods', 'wc.fgDays', { num: true, suffix: 'days' })}${field('Receivables', 'wc.recDays', { num: true, suffix: 'days' })}${field('Creditors', 'wc.credDays', { num: true, suffix: 'days' })}
    ${fsel('Assessment method', 'wc.method', methods)}</div></div>
  <div class="card"><h3>Working capital requirement</h3>${stmt([['Raw material stock', R.rmStock], ['Work in progress', R.wip], ['Finished goods', R.fg], ['Receivables', R.recv], ['Total current assets', R.ca, 'sub'], ['Less: creditors', R.creditors], ['Working capital gap', R.nwc, 'hl']])}</div>
  <div class="card"><h3>Bank finance assessment</h3>${stmt([['Tandon Method I — 75% of gap', R.mpbf1], ['Tandon Method II — 75% of CA less creditors', R.mpbf2], ['Turnover method — 20% of sales', R.turnover], ['Holding-period gap', R.nwc],
    ['Assessed limit (selected method)', R.assessed, 'hl'], ['Proposed working capital loan', Y().map(() => R.wcLoan)], ['Promoter margin (gap − loan)', R.nwc.map(v => v - R.wcLoan)]])}
    <div class="row" style="margin-top:12px"><button class="btn sm" data-act="applywc">Set loan to ${yl(0)} assessed limit (${fmc(R.assessed[0])})</button></div></div>`;
}

function vFinance() {
  const R = S.R, p = S.cur; const gap = R.means.total - R.pc.total;
  const tl = R.tl;
  return `${head('Step 7', 'Finance & loans', 'Means of finance must equal project cost. Loan terms drive the repayment schedule and DSCR.')}
  <div class="grid g2">
    <div class="card"><h3>Means of finance</h3><div class="grid g2">${field(`Promoter equity (${curSymbol()})`, 'finance.equity', { num: true })}${field(`Term loan (${curSymbol()})`, 'finance.termLoan', { num: true })}${field(`Subsidy / grant (${curSymbol()})`, 'finance.subsidy', { num: true })}${field(`Unsecured loans (${curSymbol()})`, 'finance.unsecured', { num: true })}</div>
      <div class="tw" style="margin-top:14px"><table><tbody>${R.means.wcLoan ? `<tr><td>Working capital loan (from loan terms)</td><td class="n">${fm(R.means.wcLoan)}</td></tr>` : ''}<tr><td>Total means of finance</td><td class="n">${fm(R.means.total)}</td></tr><tr><td>Total project cost</td><td class="n">${fm(R.pc.total)}</td></tr>
      <tr class="${Math.abs(gap) < 1 ? 'hl' : ''}"><td>Difference</td><td class="n ${Math.abs(gap) >= 1 ? 'neg' : ''}">${fm(gap)}</td></tr>
      <tr><td>Promoter share of project cost</td><td class="n">${fp(R.pc.total ? (R.means.equity + R.means.subsidy) / R.pc.total : 0)}</td></tr>
      <tr><td>Debt : equity (opening)</td><td class="n">${R.means.equity ? (R.means.termLoan / R.means.equity).toFixed(2) : '–'} : 1</td></tr></tbody></table></div>
      ${Math.abs(gap) >= 1 ? `<div class="row" style="margin-top:12px"><button class="btn sm pri" data-act="balance">Balance with promoter equity</button></div>` : ''}</div>
    <div class="card"><h3>Loan terms</h3><div class="grid g2">${field('Lender', 'finance.bank')}${field('Term loan interest', 'finance.tlRate', { num: true, suffix: '%' })}
      ${field('Tenure incl. moratorium', 'finance.tlTenure', { num: true, suffix: 'yrs' })}${field('Moratorium', 'finance.moratorium', { num: true, suffix: 'mo' })}
      ${field(`Working capital loan (${curSymbol()})`, 'finance.wcLoan', { num: true })}${field('Working capital interest', 'finance.wcRate', { num: true, suffix: '%' })}</div>
      <p class="small muted" style="margin:10px 0 0">${tl.tenureM - tl.mor} monthly instalments of ${fmc(tl.emiPrincipal, 2)} principal after a ${tl.mor}-month moratorium.</p></div>
  </div>
  <div class="card"><h3>Existing loans</h3>${etable('existingLoans', [{ k: 'name', label: 'Lender / facility', w: 240 }, { k: 'outstanding', label: `Outstanding (${curSymbol()})`, num: true }, { k: 'rate', label: 'Interest %', num: true }, { k: 'years', label: 'Remaining years', num: true }], { addLabel: 'Add existing loan' })}</div>
  <div class="card"><h3>Term loan repayment schedule</h3>${stmt([['Opening balance', tl.opening], ['Interest', tl.interest], ['Principal repaid', tl.principal], ['Closing balance', tl.closing, 'sub'], ['Existing loans — interest', R.exInt], ['Existing loans — principal', R.exPrin], ['Total debt service', Y().map(t => tl.interest[t] + tl.principal[t] + R.exInt[t] + R.exPrin[t]), 'hl']])}</div>`;
}

function vHistory() {
  const p = S.cur; const rec = reconStatus(); const R = S.R;
  const last = p.historical[p.historical.length - 1]; const ratio = last && last.revenue ? R.revenue[0] / last.revenue : null;
  const flag = ratio && ratio > +p.benchmarks.growthFlag;
  return `${head('Step 8', 'Historical & reconciliation', 'Past three years from audited statements, cross-checked against GST, ITR and bank credits.')}
  <div class="card"><h3>Historical financials (${esc(curSymbol())}, full amounts)</h3>
    ${etable('historical', [{ k: 'fy', label: 'Year', w: 110 }, { k: 'revenue', label: 'Revenue', num: true, w: 110 }, { k: 'ebitda', label: 'EBITDA', num: true, w: 100 }, { k: 'depn', label: 'Depreciation', num: true, w: 100 }, { k: 'interest', label: 'Interest', num: true, w: 100 },
      { k: 'pat', label: 'PAT', num: true, w: 100 }, { k: 'netWorth', label: 'Net worth', num: true, w: 110 }, { k: 'debt', label: 'Total debt', num: true, w: 100 }, { k: 'ca', label: 'Current assets', num: true, w: 110 }, { k: 'cl', label: 'Current liabilities', num: true, w: 110 }], { addLabel: 'Add year' })}</div>
  <div class="card"><h3>Turnover reconciliation</h3><p class="small muted" style="margin:-6px 0 10px">Green ≤ ${p.benchmarks.recGreen}% variance, amber ≤ ${p.benchmarks.recAmber}%, red above.</p>
    ${etable('historical', [{ k: '_fy', label: 'Year', calc: r => esc(r.fy) }, { k: '_b', label: 'Books revenue', calc: r => fn(r.revenue) }, { k: 'gst', label: 'GST returns', num: true, w: 120 }, { k: 'itr', label: 'ITR', num: true, w: 120 }, { k: 'bank', label: 'Bank credits', num: true, w: 120 },
      { k: '_s', label: 'Status', calc: (r, i) => ['gst', 'itr', 'bank'].map(k => pill(rec[i][k].s, k.toUpperCase() + ' ' + rec[i][k].label)).join(' ') }], { addLabel: 'Add year' })}</div>
  <div class="card"><h3>Historical vs projected</h3>
    ${last ? `<p>Latest revenue ${fmc(last.revenue)} (${esc(last.fy)}) → ${yl(0)} projected ${fmc(R.revenue[0])}: <b>${ratio ? ratio.toFixed(2) + '×' : '–'}</b> ${flag ? pill('warn', 'Significant growth assumption') : pill('ok', 'Within ' + p.benchmarks.growthFlag + '× threshold')}</p>` : '<p class="muted">Add at least one historical year.</p>'}
    <p class="small muted" style="margin:0 0 8px">Reason for growth (goes into the report)</p>
    <div class="chips" style="margin-bottom:10px">${['New machinery', 'Capacity expansion', 'New customer', 'New market', 'New product', 'Existing capacity utilisation'].map(x => `<button class="chip" data-act="reason" data-v="${esc(x)}">+ ${esc(x)}</button>`).join('')}</div>
    ${area('Explanation', 'growthReason', { rows: 3 })}</div>`;
}

function vProjections() {
  const R = S.R;
  return `${head('Analysis', 'Projected financial statements', `All figures in ${esc(unitLabel())}. The balance sheet is checked every year.`)}
  <div class="card"><h3>Profit & loss</h3>${stmt([['Revenue', R.revenue, 'sub'], 'Operating costs', ['Raw material', R.rawMat], ['Manpower', R.manpower], ['Power & utilities', R.power], ['Other expenses', R.T.map(t => R.otherFixed[t] + R.otherVar[t])],
    ['EBITDA', R.ebitda, 'sub'], ['EBITDA margin', R.ebitdaM, '', fp], ['Depreciation', R.depn], ['Interest — term loan', R.tl.interest], ['Interest — working capital', R.wcInt], ['Interest — existing loans', R.exInt], ['Preliminary expenses written off', R.prelimWO],
    ['Profit before tax', R.pbt, 'sub'], ['Tax', R.tax], ['Profit after tax', R.pat, 'hl'], ['Cash accruals (PAT + depreciation)', R.T.map(t => R.pat[t] + R.depn[t])]])}</div>
  <div class="card"><h3>Cash flow</h3>${stmt([['Opening cash', R.T.map(t => t ? R.cash[t - 1] : R.cash0)], ['Profit after tax', R.pat], ['Add: depreciation & write-offs', R.T.map(t => R.depn[t] + R.prelimWO[t])], ['Less: increase in working capital', R.T.map(t => -(R.nwc[t] - (t ? R.nwc[t - 1] : 0)))],
    ['Cash from operations', R.cfo, 'sub'], ['Working capital loan drawn', R.T.map(t => t === 0 ? R.wcLoan : 0)], ['Loan repayments', R.T.map(t => -R.tl.principal[t] - R.exPrin[t])], ['Cash from financing', R.cff, 'sub'], ['Closing cash', R.cash, 'hl']])}</div>
  <div class="card"><h3>Balance sheet</h3>${stmt(['Liabilities', ['Share capital / promoter equity', R.T.map(() => R.means.equity)], ['Capital subsidy', R.T.map(() => R.means.subsidy)], ['Reserves & surplus', R.reserves], ['Tangible net worth', R.tnw, 'sub'],
    ['Unsecured loans', R.T.map(() => R.means.unsecured)], ['Term loan', R.tl.closing], ['Existing loans', R.exClose], ['Working capital loan', R.T.map(() => R.wcLoan)], ['Trade creditors', R.creditors], ['Total liabilities', R.totalLiab, 'hl'],
    'Assets', ['Net fixed assets', R.nfa], ['Existing assets', R.T.map(() => R.exOpen)], ['Preliminary expenses (unamortised)', R.prelimBal], ['Inventory', R.T.map(t => R.rmStock[t] + R.wip[t] + R.fg[t])], ['Receivables', R.recv], ['Cash & bank', R.cash], ['Total assets', R.totalAssets, 'hl'],
    ['Check: assets − liabilities', R.bsDiff, '', v => Math.abs(v) < 1 ? '✓ 0' : fm(v)]])}</div>`;
}

function vAppraisal() {
  const R = S.R, b = S.cur.benchmarks;
  const scen = sensitivity();
  const y3 = Math.min(2, R.N - 1);
  return `${head('Analysis', 'Bank appraisal', 'Serviceability, ratios and stress tests compared with the benchmarks you set for this lender. This is not an approval prediction.')}
  <div class="kpis">${kpi('Average DSCR', fx(R.avgDscr), `Benchmark ${fx(+b.avgDscr)}`, R.avgDscr >= b.avgDscr ? 'feature' : '')}${kpi('Minimum DSCR', fx(R.minDscr), `Benchmark ${fx(+b.minDscr)}`)}${kpi('Project IRR', fp(R.irr), 'Pre-financing, no terminal value')}${kpi('Payback', R.payback ? R.payback.toFixed(1) + ' yrs' : '–', 'On PAT + depreciation + interest')}</div>
  <div class="card"><h3>Lender benchmarks</h3><div class="grid g4">${field('Minimum DSCR', 'benchmarks.minDscr', { num: true, suffix: '×' })}${field('Average DSCR', 'benchmarks.avgDscr', { num: true, suffix: '×' })}${field('Current ratio (min)', 'benchmarks.currentRatio', { num: true, suffix: '×' })}${field('Debt / equity (max)', 'benchmarks.debtEquity', { num: true, suffix: '×' })}</div></div>
  <div class="card"><h3>Ratio analysis</h3>${stmt([['DSCR', R.dscr, 'hl', fx], ['Interest coverage (EBITDA / interest)', R.icr, '', fx], ['Current ratio', R.currentRatio, '', fx], ['Debt / equity', R.debtEquity, '', fx], ['TOL / TNW', R.tolTnw, '', fx],
    ['EBITDA margin', R.ebitdaM, '', fp], ['Net profit margin', R.npm, '', fp], ['Return on capital employed', R.roce, '', fp], ['Return on equity', R.roe, '', fp],
    'Working capital cycle (days)', ['Inventory days', R.T.map(t => R.rawMat[t] ? (R.rmStock[t] + R.wip[t] + R.fg[t]) / R.rawMat[t] * 365 : null), '', v => fn(v)], ['Receivable days', R.T.map(() => +S.cur.wc.recDays), '', v => fn(v)], ['Payable days', R.T.map(() => +S.cur.wc.credDays), '', v => fn(v)]], { unit: 'Ratio' })}</div>
  <div class="card"><h3>Sensitivity analysis</h3><div class="tw"><table><thead><tr><th>Scenario</th><th class="n">${yl(y3)} EBITDA</th><th class="n">${yl(y3)} PAT</th><th class="n">Average DSCR</th><th class="n">Minimum DSCR</th><th class="n">${yl(y3)} break-even</th><th>Against benchmark</th></tr></thead><tbody>
    ${scen.map(s => `<tr${s.base ? ' class="hl"' : ''}><td>${esc(s.name)}</td><td class="n">${fm(s.r.ebitda[y3])}</td><td class="n ${s.r.pat[y3] < 0 ? 'neg' : ''}">${fm(s.r.pat[y3])}</td><td class="n">${fx(s.r.avgDscr)}</td><td class="n">${fx(s.r.minDscr)}</td><td class="n">${fp(s.r.bepPct[y3], 0)}</td>
      <td>${s.r.minDscr >= b.minDscr ? pill('ok', 'Meets') : s.r.minDscr >= 1 ? pill('warn', 'Below benchmark') : pill('bad', 'Below 1.0×')}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h3>Break-even analysis</h3>${stmt([['Sales', R.revenue], ['Variable costs', R.variable], ['Contribution', R.contrib, 'sub'], ['Fixed costs incl. depreciation & interest', R.fixed], ['Break-even sales', R.bepSales, 'sub'], ['Break-even — % of sales', R.bepPct, 'hl', fp], ['Break-even — % of installed capacity', R.bepCapacity, '', fp], ['Cash break-even — % of sales', R.cashBepPct, '', fp]])}</div>`;
}
function sensitivity() {
  const p = S.cur;
  return [['Base case', {}], ['Revenue −10%', { rev: -0.1 }], ['Revenue −20%', { rev: -0.2 }], ['Raw material +10%', { rm: 0.1 }], ['Raw material +20%', { rm: 0.2 }], ['Interest +2%', { int: 2 }], ['Revenue −10% and raw material +10%', { rev: -0.1, rm: 0.1 }]]
    .map(([name, ov], i) => ({ name, base: i === 0, r: i === 0 ? S.R : Engine.compute(p, ov) }));
}

function vCMA() {
  const R = S.R, p = S.cur; const H = p.historical;
  const cols = H.map(h => h.fy + ' (A)').concat(R.T.map(t => yl(t) + ' (P)'));
  const hv = (k, f) => H.map(h => f ? f(h) : +h[k] || 0);
  return `${head('Analysis', 'CMA data', `Credit Monitoring Arrangement forms — historical (A) and projected (P). ${esc(unitLabel())}.`)}
  <div class="card"><h3>Form II — Operating statement</h3>${stmt([['Net sales', hv('revenue').concat(R.revenue), 'sub'], ['EBITDA', hv('ebitda').concat(R.ebitda)], ['Depreciation', hv('depn').concat(R.depn)], ['Interest', hv('interest').concat(R.interest)],
    ['Profit before tax', hv(0, h => (+h.ebitda || 0) - (+h.depn || 0) - (+h.interest || 0)).concat(R.pbt)], ['Profit after tax', hv('pat').concat(R.pat), 'hl'], ['PAT / net sales', hv(0, h => h.revenue ? h.pat / h.revenue : null).concat(R.npm), '', fp]], { cols })}</div>
  <div class="card"><h3>Form III — Balance sheet analysis</h3>${stmt([['Tangible net worth', hv('netWorth').concat(R.tnw), 'sub'], ['Term liabilities', hv('debt').concat(R.T.map(t => R.tl.closing[t] + R.exClose[t] + R.means.unsecured))], ['Current liabilities incl. bank borrowing', hv('cl').concat(R.T.map(t => R.creditors[t] + R.wcLoan))],
    ['Current assets incl. cash', hv('ca').concat(R.T.map(t => R.ca[t] + Math.max(0, R.cash[t])))], ['Current ratio', hv(0, h => h.cl ? h.ca / h.cl : null).concat(R.currentRatio), 'hl', fx], ['TOL / TNW', hv(0, h => h.netWorth ? ((+h.debt || 0) + (+h.cl || 0)) / h.netWorth : null).concat(R.tolTnw), '', fx]], { cols })}</div>
  <div class="card"><h3>Form IV — Current assets and current liabilities</h3>${stmt([['Raw material stock', R.rmStock], ['Work in progress', R.wip], ['Finished goods', R.fg], ['Receivables', R.recv], ['Total current assets', R.ca, 'sub'], ['Trade creditors', R.creditors], ['Other current liabilities (excl. bank)', R.T.map(() => 0)], ['Total current liabilities (excl. bank)', R.creditors, 'sub']])}</div>
  <div class="card"><h3>Form V — Maximum permissible bank finance</h3>${stmt(['Method I', ['Total current assets', R.ca], ['Less: other current liabilities', R.creditors], ['Working capital gap', R.wcg, 'sub'], ['Minimum margin — 25% of gap', R.wcg.map(v => v * 0.25)], ['MPBF Method I', R.mpbf1, 'hl'],
    'Method II', ['Minimum margin — 25% of current assets', R.ca.map(v => v * 0.25)], ['MPBF Method II', R.mpbf2, 'hl'], ['Proposed working capital limit', R.T.map(() => R.wcLoan)], ['Excess / (shortfall) vs Method II', R.mpbf2.map(v => v - R.wcLoan)]])}</div>
  <div class="card"><h3>Form VI — Fund flow</h3>${stmt(['Sources', ['Cash accruals', R.T.map(t => R.pat[t] + R.depn[t] + R.prelimWO[t])], ['Increase in bank borrowing', R.T.map(t => t === 0 ? R.wcLoan : 0)], ['Increase in creditors', R.T.map(t => R.creditors[t] - (t ? R.creditors[t - 1] : 0))],
    'Uses', ['Loan repayments', R.T.map(t => R.tl.principal[t] + R.exPrin[t])], ['Increase in current assets', R.T.map(t => R.ca[t] - (t ? R.ca[t - 1] : 0))], ['Net surplus to cash', R.T.map(t => R.cash[t] - (t ? R.cash[t - 1] : R.cash0)), 'hl']])}</div>`;
}

function vChecks() {
  const p = S.cur;
  const items = COMPLIANCE.base.concat(COMPLIANCE[p.setup.sector] || []);
  const opts = [['', '— Not reviewed'], ['ok', 'Applicable, details provided'], ['missing', 'Applicable, details missing'], ['maybe', 'Potentially applicable'], ['na', 'Not applicable']];
  return `${head('Validation', 'Checks & compliance', 'Blocking issues stop the final package. Review items can be fixed, edited or ignored — ignored items stay logged.')}
  <div class="card"><h3>Financial, data and content checks</h3><div class="issues">${S.issues.map(issueRow).join('')}</div></div>
  <div class="card"><h3>Compliance — ${esc(p.setup.sector)}</h3><div class="tw"><table class="tbl"><thead><tr><th>Licence / approval</th><th style="min-width:230px">Status</th></tr></thead><tbody>
    ${items.map(it => { const k = 'compliance.' + it.replace(/[^\w]/g, '_'); return `<tr><td>${esc(it)}</td><td>${sel(k, opts, { label: it })}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="small muted" style="margin:10px 0 0">Names follow Indian practice where relevant; rename them to your country's equivalent in the report text.</p></div>`;
}
function issueRow(i) {
  const ign = S.cur.issuesIgnored[i.key];
  return `<div class="issue ${i.sev} ${ign ? 'ignored' : ''}">${pill(i.sev, { bad: 'Blocking', warn: 'Review', ok: 'Passed' }[i.sev])}<div><b>${esc(i.area)}</b> — ${esc(i.msg)}</div>
    <div class="row">${i.sev !== 'ok' && i.view ? `<button class="btn sm" data-act="nav" data-v="${i.view}">Fix</button>` : ''}${i.sev === 'warn' ? `<button class="btn sm ghost" data-act="ignore" data-v="${esc(i.key)}">${ign ? 'Restore' : 'Ignore'}</button>` : ''}</div></div>`;
}
