/* ===== Example project (template, never presented as the user's data) ===== */
function exampleProject() {
  return {
    id: 'example',
    example: true,
    name: 'Arun Precision Components',
    updated: Date.now(),
    settings: { mode: 3, currency: 'INR', locale: 'en-IN', unit: 100000, years: 7, taxRate: 25.17, fyStart: 'April', firstYear: 2027, country: 'India' },
    setup: {
      purposes: ['Business Expansion', 'Machinery Purchase', 'Bank Loan'],
      sector: 'Manufacturing',
      financeMode: 'Bank',
      loanTypes: ['Term Loan', 'CC / OD'],
      existing: true
    },
    company: {
      name: 'Arun Precision Components Pvt Ltd', constitution: 'Private Limited Company', regNo: 'U28999TZ2019PTC031245',
      taxId: 'AAHCA1234K', gst: '33AAHCA1234K1Z5', msme: 'UDYAM-TN-03-0045123', incorporated: '2019-06-14',
      activity: 'CNC-machined shafts and flanges for pump and valve OEMs',
      location: 'SIDCO Industrial Estate, Kurichi', city: 'Coimbatore', state: 'Tamil Nadu', start: '2027-04-01', implMonths: 8
    },
    promoters: [
      { name: 'R. Arun Kumar', role: 'Managing Director', age: 42, qualification: 'B.E. Mechanical', experience: 18, netWorth: 8500000, share: 60, contribution: 4200000 },
      { name: 'S. Meena', role: 'Director (Finance)', age: 39, qualification: 'M.Com, ICWA (Inter)', experience: 14, netWorth: 4200000, share: 40, contribution: 2980000 }
    ],
    products: [
      { name: 'Machined pump shafts', unit: 'nos', capacity: 60000, price: 450, rmCost: 210, growth: 3 },
      { name: 'Valve flanges (DN50–DN150)', unit: 'nos', capacity: 30000, price: 780, rmCost: 360, growth: 3 }
    ],
    capacity: { shifts: 2, hoursPerShift: 8, days: 300, util: [60, 70, 80, 85, 90, 90, 90, 90, 90, 90] },
    process: 'Raw material inspection → Bar cutting → CNC turning → VMC milling & drilling → Heat treatment (outsourced) → Cylindrical grinding → CMM inspection → Rust-proofing & packing → Dispatch',
    assets: [
      { cat: 'Building', desc: 'Shed modification, flooring and foundations', qty: 1, rate: 2000000, dep: 3.17, quote: 'Civil estimate — V. Raj Associates' },
      { cat: 'Plant & Machinery', desc: 'CNC turning centre, 8" chuck', qty: 2, rate: 2800000, dep: 6.33, quote: 'Quote LMW/2026/118' },
      { cat: 'Plant & Machinery', desc: 'Vertical machining centre 850 mm', qty: 1, rate: 3200000, dep: 6.33, quote: 'Quote BFW/VMC/5521' },
      { cat: 'Plant & Machinery', desc: 'CNC cylindrical grinder', qty: 1, rate: 1800000, dep: 6.33, quote: '' },
      { cat: 'Plant & Machinery', desc: 'CMM and QC instruments', qty: 1, rate: 1200000, dep: 6.33, quote: 'Quote ZS/2026/044' },
      { cat: 'Plant & Machinery', desc: 'Air compressor and utilities', qty: 1, rate: 600000, dep: 6.33, quote: 'Quote ELGI/CBE/903' },
      { cat: 'Electrical', desc: 'LT panel, cabling, 160 kVA connection', qty: 1, rate: 1200000, dep: 10, quote: 'Quote SE/2026/77' },
      { cat: 'Furniture & Office', desc: 'Office furniture, computers, CAD licence', qty: 1, rate: 500000, dep: 9.5, quote: '' }
    ],
    cost: { contingencyPct: 5, preop: 600000, prelim: 300000 },
    manpower: [
      { role: 'Plant manager', count: 1, salary: 60000 },
      { role: 'Production engineers', count: 2, salary: 45000 },
      { role: 'QC inspector', count: 1, salary: 25000 },
      { role: 'CNC operators (skilled)', count: 4, salary: 22000 },
      { role: 'Helpers (semi-skilled)', count: 6, salary: 14000 },
      { role: 'Accounts & admin', count: 2, salary: 18000 }
    ],
    utilities: { kw: 150, hours: 16, days: 300, loadFactor: 60, tariff: 8, esc: 3 },
    opex: {
      rmEsc: 3, salaryEsc: 6, benefitsPct: 20,
      other: [
        { name: 'Factory rent', basis: 'fixed', value: 900000, esc: 5 },
        { name: 'Tooling and inserts', basis: 'pct', value: 3, esc: 0 },
        { name: 'Repairs and maintenance', basis: 'pct', value: 1.5, esc: 0 },
        { name: 'Freight outward', basis: 'pct', value: 2, esc: 0 },
        { name: 'Selling and marketing', basis: 'pct', value: 1, esc: 0 },
        { name: 'Insurance', basis: 'fixed', value: 150000, esc: 5 },
        { name: 'Administrative expenses', basis: 'fixed', value: 600000, esc: 5 }
      ]
    },
    wc: { rmDays: 30, wipDays: 7, fgDays: 15, recDays: 60, credDays: 30, method: 'tandon2' },
    finance: { equity: 7180000, termLoan: 12500000, subsidy: 0, unsecured: 0, bank: 'Indian Bank, Kurichi branch', tlRate: 9.5, tlTenure: 7, moratorium: 12, wcLoan: 4400000, wcRate: 10 },
    existingLoans: [{ name: 'Vehicle loan — HDFC Bank', outstanding: 600000, rate: 9, years: 3 }],
    historical: [
      { fy: 'FY 2023-24', revenue: 18200000, ebitda: 2550000, depn: 420000, interest: 310000, pat: 1350000, netWorth: 6800000, debt: 1900000, ca: 5400000, cl: 3100000, gst: 18050000, itr: 18200000, bank: 17600000 },
      { fy: 'FY 2024-25', revenue: 21500000, ebitda: 3120000, depn: 460000, interest: 280000, pat: 1750000, netWorth: 8550000, debt: 1400000, ca: 6300000, cl: 3500000, gst: 21400000, itr: 21500000, bank: 20900000 },
      { fy: 'FY 2025-26', revenue: 24800000, ebitda: 3700000, depn: 500000, interest: 240000, pat: 2180000, netWorth: 10730000, debt: 900000, ca: 7200000, cl: 3900000, gst: 24300000, itr: 24800000, bank: 22100000 }
    ],
    growthReason: 'New CNC capacity (2 turning centres + VMC) and a supply agreement with an existing pump OEM for 2,000 shafts per month.',
    benchmarks: { minDscr: 1.25, avgDscr: 1.5, currentRatio: 1.33, debtEquity: 3, tolTnw: 4, recGreen: 5, recAmber: 15, growthFlag: 1.5 },
    compliance: {},
    narrative: {},
    issuesIgnored: {}
  };
}
function blankProject() {
  const p = exampleProject();
  return Object.assign(p, {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    example: false, name: 'Untitled project',
    setup: { purposes: ['New Business / Startup'], sector: 'Manufacturing', financeMode: 'Bank', loanTypes: ['Term Loan'], existing: false },
    company: { name: '', constitution: 'Private Limited Company', regNo: '', taxId: '', gst: '', msme: '', incorporated: '', activity: '', location: '', city: '', state: '', start: '', implMonths: 6 },
    promoters: [{ name: '', role: 'Promoter', age: '', qualification: '', experience: '', netWorth: 0, share: 100, contribution: 0 }],
    products: [{ name: 'Product 1', unit: 'nos', capacity: 10000, price: 100, rmCost: 50, growth: 3 }],
    assets: [{ cat: 'Plant & Machinery', desc: 'Main machine', qty: 1, rate: 1000000, dep: 6.33, quote: '' }],
    cost: { contingencyPct: 5, preop: 0, prelim: 0 },
    manpower: [{ role: 'Staff', count: 2, salary: 20000 }],
    utilities: { kw: 20, hours: 8, days: 300, loadFactor: 60, tariff: 8, esc: 3 },
    opex: { rmEsc: 3, salaryEsc: 6, benefitsPct: 15, other: [{ name: 'Administrative expenses', basis: 'fixed', value: 120000, esc: 5 }] },
    finance: { equity: 0, termLoan: 0, subsidy: 0, unsecured: 0, bank: '', tlRate: 10, tlTenure: 5, moratorium: 6, wcLoan: 0, wcRate: 10.5 },
    existingLoans: [], historical: [], growthReason: '', narrative: {}, compliance: {}, issuesIgnored: {},
    settings: { ...p.settings, mode: 2 }
  });
}

