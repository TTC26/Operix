/* ===== DPR financial engine (deterministic, annual) ===== */
const Engine = (() => {
  const sum = a => a.reduce((s, x) => s + (+x || 0), 0);
  const n = v => (isFinite(+v) ? +v : 0);

  function projectCost(p, wcNeedY1) {
    const assets = p.assets.map(a => ({ ...a, cost: n(a.qty) * n(a.rate) }));
    const assetTotal = sum(assets.map(a => a.cost));
    const nonLand = sum(assets.filter(a => a.cat !== 'Land').map(a => a.cost));
    const contingency = nonLand * n(p.cost.contingencyPct) / 100;
    const preop = n(p.cost.preop);
    const prelim = n(p.cost.prelim);
    const fixedCapital = assetTotal + contingency + preop;
    const marginWC = Math.max(0, Math.round((n(wcNeedY1) - n(p.finance.wcLoan)) / 1000) * 1000);
    const totalExWC = fixedCapital + prelim + marginWC;
    // Bank format (default): show the full working capital requirement in project cost,
    // with the working capital loan in means of finance.
    const inCost = !(p.cost && p.cost.wcInCost === false);
    const wcLoanInCost = inCost ? n(p.finance.wcLoan) : 0;
    const wcReq = marginWC + wcLoanInCost;
    const total = totalExWC + wcLoanInCost;
    const byCat = {};
    assets.forEach(a => { byCat[a.cat] = (byCat[a.cat] || 0) + a.cost; });
    return { assets, assetTotal, nonLand, contingency, preop, prelim, fixedCapital, marginWC, total, totalExWC, wcLoanInCost, wcReq, inCost, byCat };
  }

  function loanSchedule(amount, ratePct, tenureYears, moratMonths, years) {
    const tenureM = Math.round(n(tenureYears) * 12);
    const mor = Math.min(Math.round(n(moratMonths)), Math.max(0, tenureM - 1));
    const inst = Math.max(1, tenureM - mor);
    const pm = n(amount) / inst;
    const r = n(ratePct) / 100 / 12;
    const Y = Math.max(years, Math.ceil(tenureM / 12));
    const interest = Array(Y).fill(0), principal = Array(Y).fill(0), closing = Array(Y).fill(0), opening = Array(Y).fill(0);
    let bal = n(amount);
    for (let y = 0; y < Y; y++) opening[y] = NaN;
    for (let m = 1; m <= tenureM; m++) {
      const y = Math.floor((m - 1) / 12);
      if (isNaN(opening[y])) opening[y] = bal;
      interest[y] += bal * r;
      const pr = m > mor ? Math.min(pm, bal) : 0;
      principal[y] += pr;
      bal -= pr;
      closing[y] = bal;
    }
    for (let y = 0; y < Y; y++) { if (isNaN(opening[y])) { opening[y] = 0; closing[y] = 0; } }
    const cut = a => a.slice(0, years);
    return { opening: cut(opening), interest: cut(interest), principal: cut(principal), closing: cut(closing), tenureM, mor, emiPrincipal: pm };
  }

  function compute(p, ov = {}) {
    const N = Math.max(3, Math.min(10, Math.round(n(p.settings.years)) || 7));
    const revF = 1 + n(ov.rev), rmF = 1 + n(ov.rm), intAdd = n(ov.int);
    const utilArr = p.capacity.util;
    const util = t => n(utilArr[Math.min(t, utilArr.length - 1)]) / 100;
    const T = [...Array(N).keys()];
    const esc = (pct, t) => Math.pow(1 + n(pct) / 100, t);

    const products = p.products.map(pr => ({
      name: pr.name,
      qty: T.map(t => n(pr.capacity) * util(t)),
      price: T.map(t => n(pr.price) * esc(pr.growth, t) * revF),
      rmUnit: T.map(t => n(pr.rmCost) * esc(p.opex.rmEsc, t) * rmF)
    }));
    const revenue = T.map(t => sum(products.map(pr => pr.qty[t] * pr.price[t])));
    const rawMat = T.map(t => sum(products.map(pr => pr.qty[t] * pr.rmUnit[t])));
    const mpBase = sum(p.manpower.map(m => n(m.count) * n(m.salary) * 12)) * (1 + n(p.opex.benefitsPct) / 100);
    const manpower = T.map(t => mpBase * esc(p.opex.salaryEsc, t));
    const u = p.utilities;
    const powerFull = n(u.kw) * n(u.hours) * n(u.days) * n(u.loadFactor) / 100 * n(u.tariff);
    const power = T.map(t => powerFull * util(t) * esc(u.esc, t));
    const otherFixed = T.map(t => sum(p.opex.other.filter(e => e.basis === 'fixed').map(e => n(e.value) * esc(e.esc, t))));
    const otherVar = T.map(t => sum(p.opex.other.filter(e => e.basis === 'pct').map(e => revenue[t] * n(e.value) / 100)));
    const otherLines = p.opex.other.map(e => ({ name: e.name, vals: T.map(t => e.basis === 'pct' ? revenue[t] * n(e.value) / 100 : n(e.value) * esc(e.esc, t)) }));
    const opex = T.map(t => rawMat[t] + manpower[t] + power[t] + otherFixed[t] + otherVar[t]);
    const ebitda = T.map(t => revenue[t] - opex[t]);

    // Working capital (holding-period method)
    const w = p.wc;
    const cop = T.map(t => rawMat[t] + manpower[t] + power[t]);
    const rmStock = T.map(t => rawMat[t] * n(w.rmDays) / 365);
    const wip = T.map(t => cop[t] * n(w.wipDays) / 365);
    const fg = T.map(t => cop[t] * n(w.fgDays) / 365);
    const recv = T.map(t => revenue[t] * n(w.recDays) / 365);
    const creditors = T.map(t => rawMat[t] * n(w.credDays) / 365);
    const ca = T.map(t => rmStock[t] + wip[t] + fg[t] + recv[t]);
    const nwc = T.map(t => ca[t] - creditors[t]);

    const pc = projectCost(p, nwc[0]);
    const f = p.finance;
    const means = { equity: n(f.equity), termLoan: n(f.termLoan), subsidy: n(f.subsidy), unsecured: n(f.unsecured) };
    means.totalExWC = means.equity + means.termLoan + means.subsidy + means.unsecured;
    means.wcLoan = pc.wcLoanInCost;
    means.total = means.totalExWC + means.wcLoan;

    // Depreciation (SLM on cost; contingency + pre-op at weighted non-land rate)
    const nonLandAssets = pc.assets.filter(a => a.cat !== 'Land');
    const wRate = pc.nonLand > 0 ? sum(nonLandAssets.map(a => a.cost * n(a.dep))) / pc.nonLand : 0;
    const depItems = pc.assets.map(a => ({ cost: a.cost, rate: a.cat === 'Land' ? 0 : n(a.dep) }))
      .concat([{ cost: pc.contingency + pc.preop, rate: wRate }]);
    const depn = T.map(() => 0);
    depItems.forEach(it => { let rem = it.cost; T.forEach(t => { const d = Math.min(rem, it.cost * it.rate / 100); depn[t] += d; rem -= d; }); });
    const prelimWO = T.map(t => (t < 5 ? pc.prelim / 5 : 0));

    const tl = loanSchedule(means.termLoan, n(f.tlRate) + intAdd, f.tlTenure, f.moratorium, N);
    const exLoans = (p.existingLoans || []).map(l => loanSchedule(l.outstanding, n(l.rate) + intAdd, l.years, 0, N));
    const exInt = T.map(t => sum(exLoans.map(l => l.interest[t])));
    const exPrin = T.map(t => sum(exLoans.map(l => l.principal[t])));
    const exOpen = sum((p.existingLoans || []).map(l => n(l.outstanding)));
    const exClose = T.map(t => sum(exLoans.map(l => l.closing[t])));
    const wcLoan = n(f.wcLoan);
    const wcInt = T.map(() => wcLoan * (n(f.wcRate) + intAdd) / 100);
    const interest = T.map(t => tl.interest[t] + wcInt[t] + exInt[t]);

    const pbt = T.map(t => ebitda[t] - depn[t] - interest[t] - prelimWO[t]);
    let lossCF = 0;
    const tax = T.map(t => {
      let taxable = pbt[t] - lossCF;
      if (taxable < 0) { lossCF = -taxable; return 0; }
      lossCF = 0; return taxable * n(p.settings.taxRate) / 100;
    });
    const pat = T.map(t => pbt[t] - tax[t]);

    // Cash flow and balance sheet
    const cash0 = means.totalExWC - pc.fixedCapital - pc.prelim;
    const cfo = [], cff = [], cash = [], reserves = [];
    let prevNwc = 0, prevCash = cash0, res = 0;
    T.forEach(t => {
      const o = pat[t] + depn[t] + prelimWO[t] - (nwc[t] - prevNwc);
      const fin = -tl.principal[t] - exPrin[t] + (t === 0 ? wcLoan : 0);
      cfo.push(o); cff.push(fin);
      prevCash = prevCash + o + fin; cash.push(prevCash);
      prevNwc = nwc[t]; res += pat[t]; reserves.push(res);
    });
    let accDep = 0;
    const nfa = T.map(t => { accDep += depn[t]; return pc.fixedCapital - accDep; });
    let prelimLeft = pc.prelim;
    const prelimBal = T.map(t => (prelimLeft -= prelimWO[t]));
    const totalAssets = T.map(t => nfa[t] + prelimBal[t] + exOpen + ca[t] + cash[t]);
    const tnw = T.map(t => means.equity + means.subsidy + reserves[t]);
    const totalLiab = T.map(t => tnw[t] + means.unsecured + tl.closing[t] + exClose[t] + wcLoan + creditors[t]);
    const bsDiff = T.map(t => totalAssets[t] - totalLiab[t]);

    // Ratios
    const dsNum = T.map(t => pat[t] + depn[t] + prelimWO[t] + tl.interest[t] + exInt[t]);
    const dsDen = T.map(t => tl.principal[t] + exPrin[t] + tl.interest[t] + exInt[t]);
    const dscr = T.map(t => (dsDen[t] > 0 ? dsNum[t] / dsDen[t] : null));
    const dsYears = T.filter(t => dsDen[t] > 0);
    const avgDscr = dsYears.length ? sum(dsYears.map(t => dsNum[t])) / sum(dsYears.map(t => dsDen[t])) : null;
    const minDscr = dsYears.length ? Math.min(...dsYears.map(t => dscr[t])) : null;
    const curLiab = T.map(t => creditors[t] + wcLoan);
    const currentRatio = T.map(t => (curLiab[t] > 0 ? (ca[t] + Math.max(0, cash[t])) / curLiab[t] : null));
    const debtEquity = T.map(t => (tnw[t] > 0 ? (tl.closing[t] + exClose[t]) / tnw[t] : null));
    const tolTnw = T.map(t => (tnw[t] > 0 ? (totalLiab[t] - tnw[t]) / tnw[t] : null));
    const icr = T.map(t => (interest[t] > 0 ? ebitda[t] / interest[t] : null));
    const ebitdaM = T.map(t => (revenue[t] ? ebitda[t] / revenue[t] : null));
    const npm = T.map(t => (revenue[t] ? pat[t] / revenue[t] : null));
    const capEmp = T.map(t => tnw[t] + tl.closing[t] + exClose[t] + means.unsecured);
    const roce = T.map(t => (capEmp[t] > 0 ? (pbt[t] + interest[t]) / capEmp[t] : null));
    const roe = T.map(t => (tnw[t] > 0 ? pat[t] / tnw[t] : null));

    // Break-even
    const variable = T.map(t => rawMat[t] + power[t] + otherVar[t]);
    const fixed = T.map(t => manpower[t] + otherFixed[t] + depn[t] + interest[t] + prelimWO[t]);
    const contrib = T.map(t => revenue[t] - variable[t]);
    const bepPct = T.map(t => (contrib[t] > 0 ? fixed[t] / contrib[t] : null));
    const cashBepPct = T.map(t => (contrib[t] > 0 ? (fixed[t] - depn[t] - prelimWO[t]) / contrib[t] : null));
    const bepSales = T.map(t => (bepPct[t] != null ? revenue[t] * bepPct[t] : null));
    const bepCapacity = T.map(t => (bepPct[t] != null ? bepPct[t] * util(t) : null));

    // Payback and project IRR (pre-financing, no terminal value)
    const fcf = [-(pc.totalExWC)].concat(T.map(t => ebitda[t] - tax[t] - (nwc[t] - (t ? nwc[t - 1] : 0)) + (t === 0 ? pc.marginWC : 0)));
    const irr = (() => {
      const npv = r => fcf.reduce((s, c, i) => s + c / Math.pow(1 + r, i), 0);
      let lo = -0.9, hi = 1.5;
      if (npv(lo) * npv(hi) > 0) return null;
      for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
      return (lo + hi) / 2;
    })();
    let cum = -pc.totalExWC, payback = null;
    T.forEach(t => { const c = pat[t] + depn[t] + tl.interest[t]; if (payback == null && cum + c >= 0) payback = t + (-cum) / c; cum += c; });

    // Working capital assessment
    const ocl = creditors;
    const wcg = T.map(t => ca[t] - ocl[t]);
    const mpbf1 = T.map(t => 0.75 * wcg[t]);
    const mpbf2 = T.map(t => 0.75 * ca[t] - ocl[t]);
    const turnover = T.map(t => 0.20 * revenue[t]);
    const assessed = { holding: nwc, tandon1: mpbf1, tandon2: mpbf2, turnover }[p.wc.method || 'tandon2'] || mpbf2;

    return {
      N, T, products, revenue, rawMat, manpower, power, otherFixed, otherVar, otherLines, opex, ebitda,
      rmStock, wip, fg, recv, creditors, ca, nwc, pc, means, depn, prelimWO, tl, exLoans, exInt, exPrin, exOpen, exClose,
      wcLoan, wcInt, interest, pbt, tax, pat, cash0, cfo, cff, cash, reserves, nfa, prelimBal, totalAssets, tnw, totalLiab, bsDiff,
      dscr, avgDscr, minDscr, currentRatio, debtEquity, tolTnw, icr, ebitdaM, npm, roce, roe,
      variable, fixed, contrib, bepPct, cashBepPct, bepSales, bepCapacity, fcf, irr, payback,
      wcg, mpbf1, mpbf2, turnover, assessed, util: T.map(util)
    };
  }
  return { compute, loanSchedule, projectCost };
})();

