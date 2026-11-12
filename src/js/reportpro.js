/* ===== Professional report payload (rendered to PDF on the server by api/report.py) ===== */
const SECTOR_TEXT = {
  Manufacturing: {
    market: 'Manufacturing demand in India is supported by infrastructure spending, the shift of supply chains toward domestic producers, and government programmes that favour locally made goods. Buyers increasingly prefer suppliers who can offer consistent quality, short lead times and dependable after-sales support, which gives well-run regional units an advantage over distant or imported supply.',
    marketing: 'The unit will sell through a mix of direct sales to industrial and institutional buyers, appointed dealers and distributors in the surrounding districts, and participation in government and corporate tenders. Pricing will be set competitively against established brands while protecting margins through efficient production. Product samples, test certificates and prompt delivery commitments will be used to win first orders, followed by rate contracts with repeat buyers.',
    location: 'The selected location offers access to road transport, availability of skilled and semi-skilled labour, and proximity to raw material suppliers and customers. Power, water and other utilities required for the operation are available at the site.'
  },
  Trading: {
    market: 'Trading businesses grow with local consumption, construction and retail activity. Customers value product availability, credit terms and quick delivery, which a well-stocked regional trader can provide better than distant suppliers.',
    marketing: 'Sales will be built through relationships with retailers, contractors and institutional buyers, supported by competitive pricing, reliable stock levels and timely delivery. Digital listings and WhatsApp catalogues will supplement field sales.',
    location: 'The premises are located close to the target customer base with good road access for receiving and dispatching goods.'
  },
  Service: {
    market: 'Demand for organised, quality-focused services is rising as businesses and households outsource specialised work. Customers choose providers on reliability, turnaround time and price, and a professionally run local provider can build a loyal client base quickly.',
    marketing: 'Clients will be acquired through direct outreach, referrals, partnerships with complementary businesses and an online presence. Service-level commitments and transparent pricing will be used to convert first-time customers into repeat clients.',
    location: 'The location is accessible to the target clients and has the infrastructure required to deliver the services.'
  }
};
const sectorText = (k) => (SECTOR_TEXT[S.cur.setup.sector] || SECTOR_TEXT.Manufacturing)[k];

function rpPayload() {
  const p = S.cur, R = S.R, m = mode(), c = p.company, b = p.benchmarks;
  const Y = R.T.map(yl), last = R.N - 1, y3 = Math.min(2, last);
  const sections = [], annex = [];
  const P = t => String(t || '').split(/\n\s*\n|\n/).map(x => x.trim()).filter(Boolean).map(x => ({ t: 'p', text: x }));
  const H = t => ({ t: 'h3', text: t });
  const BUL = items => ({ t: 'bullets', items: items.filter(Boolean) });
  const T = (head, rows, o = {}) => ({ t: 'table', head, rows: rows.map(r => r.map(x => x == null ? '' : String(x))), align: o.align || head.map((_, i) => (i ? 'r' : 'l')), hl: o.hl || [], widths: o.widths || null, note: o.note || '', small: !!o.small });
  const ST = (rows, o = {}) => {
    const out = [], hl = [], sec = [];
    rows.forEach(r => { if (typeof r === 'string') { sec.push(out.length); out.push([r, ...Y.map(() => '')]); return; } const [l, arr, cls, f] = r; if (cls) hl.push(out.length); out.push([l, ...arr.map(v => (f || fm)(v))]); });
    const t = T([unitLabel(), ...Y], out, { hl, small: true, ...o }); t.secRows = sec; return t;
  };
  const KV = rows => T(['Particular', 'Details'], rows.filter(r => r[1] !== '' && r[1] != null), { align: ['l', 'l'], widths: [0.34, 0.66] });
  const chart = (kind, title, labels, series, o = {}) => ({ t: 'chart', kind, title, labels, series: (o.pct || o.ratio || kind === 'donut') ? series : series.map(s => ({ ...s, values: s.values.map(v => v == null ? null : v / unitDiv()) })), bench: o.bench ?? null, unit: o.unit || unitLabel(), pct: !!o.pct, ratio: !!o.ratio });
  const add = (arr, title, blocks, o = {}) => arr.push({ title, blocks: blocks.flat().filter(Boolean), ...o });
  const where = [c.location, c.city, c.state].filter(Boolean).join(', ');
  const eqPct = R.pc.total ? R.means.equity / R.pc.total : 0;
  const totalStaff = p.manpower.reduce((s, x) => s + (+x.count || 0), 0);
  const growth = R.revenue[0] > 0 && R.revenue[last] > 0 ? Math.pow(R.revenue[last] / R.revenue[0], 1 / Math.max(1, last)) - 1 : null;
  const ebm = R.ebitdaM.filter(v => v != null);

  // 1. Executive summary
  add(sections, 'Executive Summary', [
    P(narr('exec')),
    { t: 'kpis', items: [
      { label: 'Project cost', value: fmc(R.pc.total) }, { label: 'Promoter contribution', value: fmc(R.means.equity), note: fp(eqPct, 0) + ' of cost' },
      { label: 'Term loan', value: fmc(R.means.termLoan), note: p.finance.bank || '' }, { label: 'Average DSCR', value: fx(R.avgDscr), note: 'Minimum ' + fx(R.minDscr) }] },
    H('Project at a glance'),
    KV([['Name of the enterprise', c.name || p.name], ['Constitution', c.constitution], ['Proposed activity', String(c.activity || '').split(/\n/)[0]], ['Location', where],
      ['Products', p.products.map(x => x.name).join(', ')], ['Purpose', p.setup.purposes.join(', ')], ['Total project cost', fmc(R.pc.total)],
      ['Means of finance', [['Promoter', R.means.equity], ['Term loan', R.means.termLoan], ['WC loan', R.means.wcLoan], ['Subsidy', R.means.subsidy], ['Unsecured loans', R.means.unsecured]].filter(x => x[1]).map(x => `${x[0]} ${fmc(x[1])}`).join(' · ')],
      ['Working capital limit', R.wcLoan ? fmc(R.wcLoan) : ''], ['Lender', p.finance.bank], ['Employment', totalStaff ? `${totalStaff} persons` : ''],
      [`Revenue ${Y[0]} to ${Y[last]}`, `${fmc(R.revenue[0])} to ${fmc(R.revenue[last])}`], ['Break-even (' + Y[y3] + ')', fp(R.bepPct[y3], 0) + ' of sales'], ['Project IRR / payback', `${fp(R.irr)} · ${R.payback ? R.payback.toFixed(1) + ' years' : '–'}`]])
  ]);

  // 2. Promoters
  add(sections, 'Promoters and Management', [
    P(narr('promoters')),
    T(['Name', 'Role', 'Qualification', 'Experience', 'Share', 'Contribution'], p.promoters.map(x => [x.name, x.role, x.qualification, x.experience ? x.experience + ' yrs' : '–', (x.share || 0) + '%', fmc(+x.contribution)]), { align: ['l', 'l', 'l', 'r', 'r', 'r'] }),
    P(`The promoters will be responsible for the overall management of the enterprise, including production, marketing, finance and compliance.${totalStaff ? ` They will be supported by a team of ${totalStaff} employees, detailed in the manpower section.` : ''}`)
  ]);

  // 3. Company profile
  add(sections, 'Company Profile', [
    KV([['Name', c.name], ['Constitution', c.constitution], ['Registration no.', c.regNo], ['PAN / Tax ID', c.taxId], ['GST / VAT', c.gst], ['MSME / Udyam', c.msme], ['Date of incorporation', c.incorporated], ['Project location', where], ['Proposed commencement', c.start], ['Implementation period', c.implMonths ? c.implMonths + ' months' : '']])
  ]);

  // 4. Products
  const photos = p.products.filter(x => x.photo).map(x => ({ src: x.photo, caption: x.name }));
  add(sections, 'Products and Capacity', [
    P(`The enterprise will ${p.products.length > 1 ? `manufacture and sell ${p.products.length} products` : 'focus on one main product'}: ${p.products.map(x => x.name).join(', ')}. The installed capacity, selling prices and planned capacity utilisation are given below.`),
    photos.length ? { t: 'images', items: photos } : null,
    p.products.some(x => String(x.desc || '').trim()) ? BUL(p.products.filter(x => String(x.desc || '').trim()).map(x => `<b>${esc(x.name)}:</b> ${esc(x.desc)}`)) : null,
    T(['Product', 'Unit', 'Installed capacity / year', `Selling price (${curSymbol()})`, 'Price growth'], p.products.map(x => [x.name, x.unit, fn(+x.capacity), fn(+x.price, 2), (+x.growth || 0) + '% / yr']), { align: ['l', 'l', 'r', 'r', 'r'] }),
    P(`The unit will operate ${p.capacity.shifts} shift(s) of ${p.capacity.hoursPerShift} hours for ${p.capacity.days} working days a year. Capacity utilisation is assumed to start at ${fn(R.util[0] * 100)}% in the first year and stabilise at ${fn(R.util[last] * 100)}%, allowing time for market development and stabilisation of operations.`),
    ST([['Capacity utilisation', R.util, '', v => fn(v * 100) + '%'], ...R.products.map(pr => [pr.name + ' (sales)', pr.qty.map((q, t) => q * pr.price[t])]), ['Total revenue', R.revenue, 'hl']])
  ]);

  // 5. Market
  const marketUser = String(p.narrative.market || '').trim();
  add(sections, 'Market Analysis', [
    P(marketUser || defaultNarr('market').replace(/ Industry size.*$/, '')),
    marketUser ? null : P(sectorText('market')),
    H('Target customers'),
    P(`The products will be marketed in ${c.state || p.settings.country || 'the region'} and neighbouring markets.${c.activity ? ' The enterprise will serve buyers who value quality, timely delivery and competitive pricing.' : ''}`),
    H('Marketing strategy'),
    P(sectorText('marketing'))
  ]);

  // 6. Technical
  const steps = String(p.process || '').split(/→|->|\n|;/).map(s => s.trim()).filter(Boolean);
  add(sections, 'Technical Feasibility and Process', [
    P(String(p.narrative.technical || '').trim() || 'The technology and equipment required for the project are well established and readily available in India. Machinery will be sourced from reputed suppliers against firm quotations, and suppliers will provide installation, commissioning and operator training.'),
    steps.length > 1 ? H('Process flow') : null,
    steps.length > 1 ? { t: 'flow', steps } : null,
    H('Plant, machinery and equipment'),
    T(['Description', 'Category', 'Qty', `Rate (${curSymbol()})`, `Amount (${unitLabel()})`, 'Quotation / supplier'], p.assets.map(a => [a.desc, a.cat, fn(+a.qty), fn(+a.rate), fm((+a.qty || 0) * (+a.rate || 0)), a.quote || 'To be obtained']), { align: ['l', 'l', 'r', 'r', 'r', 'l'], widths: [0.30, 0.15, 0.07, 0.14, 0.13, 0.21] })
  ]);

  // 7. Location, utilities, raw material, manpower
  const u = p.utilities; const kwh = (+u.kw || 0) * (+u.hours || 0) * (+u.days || 0) * (+u.loadFactor || 0) / 100;
  add(sections, 'Location, Utilities and Inputs', [
    H('Location and infrastructure'), P(`The project is located at ${where || 'the proposed site'}. ${sectorText('location')}`),
    H('Power and utilities'),
    T(['Parameter', 'Value'], [['Connected load', `${fn(+u.kw)} kW`], ['Operating hours per day', fn(+u.hours)], ['Working days per year', fn(+u.days)], ['Load factor', fn(+u.loadFactor) + '%'], ['Tariff', `${curSymbol()}${fn(+u.tariff, 2)} per kWh`], ['Annual consumption at full capacity', `${fn(kwh)} kWh`], [`Power cost in ${Y[0]}`, fmc(R.power[0])]], { align: ['l', 'r'] }),
    H('Raw materials'),
    P('Raw materials are available from established suppliers in the region. Prices are assumed to rise by ' + p.opex.rmEsc + '% a year. Raw material cost per unit of output:'),
    T(['Product', `Raw material cost / unit (${curSymbol()})`, `${Y[0]} raw material cost (${unitLabel()})`], R.products.map(pr => [pr.name, fn(pr.rmUnit[0], 2), fm(pr.qty[0] * pr.rmUnit[0])]).concat([['Total', '', fm(R.rawMat[0])]]), { hl: [R.products.length] }),
    H('Manpower'),
    P(`The project will employ ${totalStaff} persons. Salaries are assumed to rise by ${p.opex.salaryEsc}% a year, with statutory benefits (PF, ESI, bonus) at ${p.opex.benefitsPct}% of salary.`),
    T(['Position', 'Number', `Monthly salary (${curSymbol()})`, `Annual cost (${unitLabel()})`], p.manpower.map(x => [x.role, fn(+x.count), fn(+x.salary), fm((+x.count || 0) * (+x.salary || 0) * 12 * (1 + (+p.opex.benefitsPct || 0) / 100))]).concat([['Total', fn(totalStaff), '', fm(R.manpower[0])]]), { hl: [p.manpower.length] })
  ]);

  // 8. Cost & MoF
  const costRows = Object.entries(R.pc.byCat).map(([k, v]) => [k, v]).concat([['Contingency', R.pc.contingency], ['Pre-operative expenses', R.pc.preop], ['Preliminary expenses', R.pc.prelim], R.pc.inCost ? ['Working capital requirement', R.pc.wcReq] : ['Margin money for working capital', R.pc.marginWC]]).filter(r => r[1]);
  const mofRows = [['Promoter contribution', R.means.equity], ['Term loan', R.means.termLoan], ['Working capital loan', R.means.wcLoan], ['Subsidy / grant', R.means.subsidy], ['Unsecured loans', R.means.unsecured]].filter(r => r[1]);
  add(sections, 'Cost of Project and Means of Finance', [
    P(`The total cost of the project is estimated at ${fmc(R.pc.total)}. It will be financed by a promoter contribution of ${fmc(R.means.equity)} (${fp(eqPct, 0)})${R.means.termLoan ? ` and a term loan of ${fmc(R.means.termLoan)}` : ''}${R.means.wcLoan ? `, a working capital loan of ${fmc(R.means.wcLoan)}` : ''}${R.means.subsidy ? ` and a subsidy of ${fmc(R.means.subsidy)}` : ''}.${R.pc.inCost && R.pc.wcReq ? ` The cost includes a working capital requirement of ${fmc(R.pc.wcReq)}.` : (R.wcLoan ? ` A working capital limit of ${fmc(R.wcLoan)} is proposed separately.` : '')}`),
    { t: 'row', items: [
      T(['Cost of project', unitLabel(), 'Share'], costRows.map(r => [r[0], fm(r[1]), fp(r[1] / R.pc.total, 0)]).concat([['Total', fm(R.pc.total), '100%']]), { hl: [costRows.length] }),
      chart('donut', 'Cost of project', costRows.map(r => r[0]), [{ name: 'Cost', values: costRows.map(r => r[1]) }])] },
    { t: 'row', items: [
      T(['Means of finance', unitLabel(), 'Share'], mofRows.map(r => [r[0], fm(r[1]), fp(r[1] / R.means.total, 0)]).concat([['Total', fm(R.means.total), '100%']]), { hl: [mofRows.length] }),
      chart('donut', 'Means of finance', mofRows.map(r => r[0]), [{ name: 'Finance', values: mofRows.map(r => r[1]) }])] },
    P(`Debt to equity at the start of the project is ${R.means.equity ? ((R.means.termLoan + R.means.wcLoan) / R.means.equity).toFixed(2) : '–'} : 1 (term loan${R.means.wcLoan ? ' and working capital loan' : ''} to promoter contribution).`)
  ]);

  // 9. Profitability
  add(sections, 'Profitability Projections', [
    P(`Revenue is projected to grow from ${fmc(R.revenue[0])} in ${Y[0]} to ${fmc(R.revenue[last])} in ${Y[last]}${growth != null ? `, a compound growth of about ${fp(growth, 1)} a year,` : ''} driven by higher capacity utilisation and price escalation. EBITDA margin ranges between ${fp(Math.min(...ebm), 1)} and ${fp(Math.max(...ebm), 1)}. Profit after tax is ${fmc(R.pat[0])} in the first year and ${fmc(R.pat[last])} by ${Y[last]}.${R.pat[0] < 0 ? ' The first-year loss reflects the ramp-up period at lower capacity utilisation.' : ''}`),
    chart('bar', `Revenue, EBITDA and profit after tax (${unitLabel()})`, Y, [{ name: 'Revenue', values: R.revenue }, { name: 'EBITDA', values: R.ebitda }, { name: 'PAT', values: R.pat }]),
    ST([['Revenue', R.revenue, 'hl'], ['Raw material', R.rawMat], ['Manpower', R.manpower], ['Power & utilities', R.power], ['Other expenses', R.T.map(t => R.otherFixed[t] + R.otherVar[t])], ['EBITDA', R.ebitda, 'hl'], ['Depreciation', R.depn], ['Interest', R.interest], ['Profit before tax', R.pbt], ['Tax', R.tax], ['Profit after tax', R.pat, 'hl'], ['Cash accruals', R.T.map(t => R.pat[t] + R.depn[t]), 'hl']])
  ]);

  // 10. Financial analysis
  const dsOK = R.minDscr != null && R.minDscr >= b.minDscr;
  add(sections, 'Financial Analysis and Debt Service Coverage', [
    P(`The average Debt Service Coverage Ratio (DSCR) over the loan period is ${fx(R.avgDscr)}, against a lender benchmark of ${fx(+b.avgDscr)}. The minimum DSCR is ${fx(R.minDscr)}${dsOK ? `, above the minimum benchmark of ${fx(+b.minDscr)} in every year.` : `, below the minimum benchmark of ${fx(+b.minDscr)} in at least one year; the promoters should consider a longer moratorium, a higher contribution or a revised repayment schedule for that period.`}`),
    P(`The project's internal rate of return (pre-financing) is ${fp(R.irr)} and the payback period is ${R.payback ? R.payback.toFixed(1) + ' years' : 'beyond the projection period'}. Break-even is reached at ${fp(R.bepPct[y3], 0)} of sales in ${Y[y3]}.`),
    chart('bar', 'Debt service coverage ratio by year', Y, [{ name: 'DSCR', values: R.dscr }], { bench: +b.minDscr, ratio: true }),
    ST([['DSCR', R.dscr, 'hl', fx], ['Interest coverage', R.icr, '', fx], ['Current ratio', R.currentRatio, '', fx], ['Debt / equity', R.debtEquity, '', fx], ['TOL / TNW', R.tolTnw, '', fx], ['EBITDA margin', R.ebitdaM, '', fp], ['Net profit margin', R.npm, '', fp], ['Return on capital employed', R.roce, '', fp]], {})
  ]);
  if (R.means.termLoan) add(sections, 'Loan Repayment Schedule', [
    P(`The term loan of ${fmc(R.means.termLoan)} carries interest at ${p.finance.tlRate}% a year and is repayable over ${p.finance.tlTenure} years, including a moratorium of ${p.finance.moratorium} months, in ${R.tl.tenureM - R.tl.mor} monthly instalments of ${fmc(R.tl.emiPrincipal, 2)} principal plus interest.`),
    ST([['Opening balance', R.tl.opening], ['Interest', R.tl.interest], ['Principal repaid', R.tl.principal], ['Closing balance', R.tl.closing, 'hl']])
  ]);
  if (m >= 2) add(sections, 'Working Capital Assessment', [
    P(`Working capital is assessed on the holding-period method: raw material ${p.wc.rmDays} days, work in progress ${p.wc.wipDays} days, finished goods ${p.wc.fgDays} days, receivables ${p.wc.recDays} days, and creditors ${p.wc.credDays} days.`),
    ST([['Current assets', R.ca], ['Creditors', R.creditors], ['Working capital gap', R.nwc, 'hl'], ['MPBF Method I', R.mpbf1], ['MPBF Method II', R.mpbf2], ['Turnover method (20%)', R.turnover], ['Proposed limit', R.T.map(() => R.wcLoan), 'hl']])
  ]);
  if (m >= 3 && p.historical.length) {
    const rec = reconStatus();
    add(sections, 'Past Performance and Reconciliation', [
      T(['Year', 'Revenue', 'EBITDA', 'PAT', 'Net worth', 'Debt'], p.historical.map(h => [h.fy, fm(+h.revenue), fm(+h.ebitda), fm(+h.pat), fm(+h.netWorth), fm(+h.debt)])),
      T(['Year', 'GST vs books', 'ITR vs books', 'Bank credits vs books'], p.historical.map((h, i) => [h.fy, rec[i].gst.label, rec[i].itr.label, rec[i].bank.label])),
      String(p.growthReason || '').trim() ? P('Basis for projected growth: ' + p.growthReason) : null
    ]);
  }

  // 11. Sensitivity & BEP
  const sens = sensitivity();
  add(sections, 'Sensitivity and Break-even Analysis', [
    P('The project has been tested against adverse changes in revenue, raw material prices and interest rates to see how debt service coverage holds up.'),
    T(['Scenario', 'Average DSCR', 'Minimum DSCR', `${Y[y3]} PAT`, `${Y[y3]} break-even`], sens.map(s => [s.name, fx(s.r.avgDscr), fx(s.r.minDscr), fm(s.r.pat[y3]), fp(s.r.bepPct[y3], 0)]), { hl: [0] }),
    chart('bar', 'Break-even as % of sales', Y, [{ name: 'Break-even', values: R.bepPct.map(v => v == null ? null : v * 100) }], { pct: true }),
    ST([['Sales', R.revenue], ['Variable costs', R.variable], ['Contribution', R.contrib, 'hl'], ['Fixed costs', R.fixed], ['Break-even sales', R.bepSales, 'hl'], ['Break-even % of sales', R.bepPct, '', fp], ['Cash break-even % of sales', R.cashBepPct, '', fp]])
  ]);

  // 12. SWOT
  const exp = Math.max(0, ...p.promoters.map(x => +x.experience || 0));
  add(sections, 'SWOT Analysis', [{ t: 'swot',
    s: [exp ? `Promoter experience of ${exp} years in the field` : 'Committed promoters', 'Established technology and machinery available locally', R.avgDscr >= b.avgDscr ? `Healthy average DSCR of ${fx(R.avgDscr)}` : 'Clear repayment plan', 'Location close to customers and suppliers'],
    w: [p.setup.existing ? 'Expansion requires management bandwidth' : 'New unit without an operating track record', eqPct < 0.2 ? `Promoter contribution is ${fp(eqPct, 0)} of project cost` : 'Initial dependence on a few customers', 'Working capital needs during ramp-up'],
    o: ['Growing domestic demand for the products', 'Preference for local and MSME suppliers in procurement', 'Scope to add products and capacity in later years'],
    th: ['Price competition from established players', 'Raw material price volatility', 'Delays in receivables from customers'] }]);

  add(sections, 'Risk Analysis and Mitigation', [T(['Risk', 'Impact', 'Mitigation'], p.risks.map(r => [r.risk, r.impact, r.mitigation]), { align: ['l', 'l', 'l'], widths: [0.3, 0.12, 0.58] })]);
  const labels = { ok: 'Obtained / provided', missing: 'Details pending', maybe: 'Under review', na: 'Not applicable' };
  add(sections, 'Statutory Approvals', [P('The following registrations, licences and approvals apply to the project:'),
    T(['Licence / approval', 'Status'], COMPLIANCE.base.concat(COMPLIANCE[p.setup.sector] || []).map(it => [it, labels[p.compliance[it.replace(/[^\w]/g, '_')]] || 'To be applied']), { align: ['l', 'l'], widths: [0.65, 0.35] })]);
  add(sections, 'Implementation Schedule', [P(`The project is expected to be implemented in about ${Math.max(0, ...p.implementation.map(r => (+r.start || 0) + (+r.months || 0)))} months from loan sanction.`),
    { t: 'gantt', rows: p.implementation.map(r => ({ task: r.task, start: +r.start || 0, months: +r.months || 0 })) },
    T(['Activity', 'Start month', 'Duration'], p.implementation.map(r => [r.task, String((+r.start || 0) + 1), (+r.months || 0) + ' months']), { align: ['l', 'r', 'r'] })]);
  add(sections, 'Conclusion', [P(narr('conclusion'))]);

  // Annexures (landscape)
  add(annex, 'Annexure 1 — Projected Profit and Loss Statement', [ST([['Revenue', R.revenue, 'hl'], 'Operating costs', ['Raw material', R.rawMat], ['Manpower', R.manpower], ['Power & utilities', R.power], ['Other fixed expenses', R.otherFixed], ['Other variable expenses', R.otherVar], ['Total operating cost', R.opex, 'hl'], ['EBITDA', R.ebitda, 'hl'], ['Depreciation', R.depn], ['Interest on term loan', R.tl.interest], ['Interest on working capital', R.wcInt], ['Interest on existing loans', R.exInt], ['Preliminary expenses written off', R.prelimWO], ['Profit before tax', R.pbt, 'hl'], ['Tax', R.tax], ['Profit after tax', R.pat, 'hl']])]);
  add(annex, 'Annexure 2 — Projected Balance Sheet', [ST(['Liabilities', ['Promoter equity', R.T.map(() => R.means.equity)], ['Capital subsidy', R.T.map(() => R.means.subsidy)], ['Reserves & surplus', R.reserves], ['Tangible net worth', R.tnw, 'hl'], ['Unsecured loans', R.T.map(() => R.means.unsecured)], ['Term loan', R.tl.closing], ['Existing loans', R.exClose], ['Working capital loan', R.T.map(() => R.wcLoan)], ['Trade creditors', R.creditors], ['Total liabilities', R.totalLiab, 'hl'],
    'Assets', ['Net fixed assets', R.nfa], ['Existing assets', R.T.map(() => R.exOpen)], ['Preliminary expenses (unamortised)', R.prelimBal], ['Inventory', R.T.map(t => R.rmStock[t] + R.wip[t] + R.fg[t])], ['Receivables', R.recv], ['Cash & bank', R.cash], ['Total assets', R.totalAssets, 'hl']])]);
  add(annex, 'Annexure 3 — Projected Cash Flow Statement', [ST([['Opening cash', R.T.map(t => t ? R.cash[t - 1] : R.cash0)], ['Profit after tax', R.pat], ['Depreciation & write-offs', R.T.map(t => R.depn[t] + R.prelimWO[t])], ['Change in working capital', R.T.map(t => -(R.nwc[t] - (t ? R.nwc[t - 1] : 0)))], ['Cash from operations', R.cfo, 'hl'], ['Working capital loan drawn', R.T.map(t => t === 0 ? R.wcLoan : 0)], ['Loan repayments', R.T.map(t => -R.tl.principal[t] - R.exPrin[t])], ['Cash from financing', R.cff, 'hl'], ['Closing cash', R.cash, 'hl']])]);
  if (m >= 3 && p.historical.length) {
    const H2 = p.historical; const cols = H2.map(h => h.fy + ' (A)').concat(Y.map(y => y + ' (P)'));
    const hv = (k, f) => H2.map(h => f ? f(h) : +h[k] || 0);
    const CT = (rows) => { const out = [], hl = []; rows.forEach(([l, arr, cls, f]) => { if (cls) hl.push(out.length); out.push([l, ...arr.map(v => (f || fm)(v))]); }); return T([unitLabel(), ...cols], out, { hl, small: true }); };
    add(annex, 'Annexure 4 — CMA Data', [
      H('Form II — Operating statement'), CT([['Net sales', hv('revenue').concat(R.revenue), 'hl'], ['EBITDA', hv('ebitda').concat(R.ebitda)], ['Depreciation', hv('depn').concat(R.depn)], ['Interest', hv('interest').concat(R.interest)], ['Profit after tax', hv('pat').concat(R.pat), 'hl']]),
      H('Form III — Balance sheet analysis'), CT([['Tangible net worth', hv('netWorth').concat(R.tnw), 'hl'], ['Term liabilities', hv('debt').concat(R.T.map(t => R.tl.closing[t] + R.exClose[t] + R.means.unsecured))], ['Current assets', hv('ca').concat(R.ca)], ['Current liabilities', hv('cl').concat(R.T.map(t => R.creditors[t] + R.wcLoan))], ['Current ratio', hv(0, h => h.cl ? h.ca / h.cl : null).concat(R.currentRatio), '', fx]]),
      H('Form V — Maximum permissible bank finance'), ST([['Total current assets', R.ca], ['Other current liabilities', R.creditors], ['Working capital gap', R.wcg, 'hl'], ['MPBF Method I', R.mpbf1], ['MPBF Method II', R.mpbf2, 'hl']])]);
  }

  return {
    meta: {
      company: c.name || p.name, project: p.name, title: 'Detailed Project Report', activity: String(c.activity || '').split(/\n/)[0].slice(0, 240),
      location: where, cost: fmc(R.pc.total), modeName: MODES[m - 1].name, mode: m, bank: p.setup.financeMode === 'Bank' ? (p.finance.bank || '') : '',
      prepared: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), sector: p.setup.sector,
      cover: photos.length ? photos[0].src : null, unit: unitLabel(), currency: curSymbol(), projectId: p.id
    },
    sections, annex,
    disclaimer: 'This report has been prepared on the basis of information, estimates and assumptions provided by the promoters. Projections are estimates and actual results may differ. The report does not guarantee sanction of any loan; lenders will make their own assessment.'
  };
}

async function exportPDFPro() {
  const payload = rpPayload();
  const headers = { 'content-type': 'application/json' };
  const tok = await Store.idToken(); if (tok) headers.authorization = 'Bearer ' + tok;
  const r = await fetch('/api/report', { method: 'POST', headers, body: JSON.stringify(payload) });
  if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || ('Could not build the PDF (' + r.status + ').')); }
  const blob = await r.blob();
  await saveFile(`${slug(S.cur.name)} - Detailed Project Report.pdf`, blob);
}

/* Product photos: resize in the browser so project data stays small */
function addProductPhoto(i, file) {
  if (!file || !file.type.startsWith('image/')) { toast('Choose an image file (JPG or PNG).'); return; }
  const img = new Image(); const url = URL.createObjectURL(file);
  img.onload = () => {
    const max = 720, s = Math.min(1, max / Math.max(img.width, img.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
    const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
    S.cur.products[i].photo = cv.toDataURL('image/jpeg', 0.72); URL.revokeObjectURL(url); changed(true); toast('Photo added.');
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Could not read that image.'); };
  img.src = url;
}

/* PDF download: server-rendered report; in local development without the server, fall back to the basic browser PDF */
async function downloadPDF() {
  try { await exportPDFPro(); }
  catch (e) { if (Store.mode !== 'cloud' && /404|405|501|Failed to fetch/.test(e.message)) await exportPDF(); else throw e; }
}
