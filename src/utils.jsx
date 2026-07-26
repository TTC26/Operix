import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertTriangle, BarChart2, Bell, BookOpen, Briefcase, CheckCircle, CheckSquare, ChevronDown, ChevronRight, ClipboardList, Clock, Cloud, CloudOff, Download, Factory, FileMinus, FileSignature, FileText, LayoutDashboard, Layers, LogOut, MapPin, Package, Paperclip, Pencil, Plus, Printer, Search, Settings, Shield, ShoppingCart, Square, Trash2, Truck, Users, Wrench, X } from 'lucide-react';
import { uploadDrawing, deleteDrawing } from './firebase';

export const ROLE_MODULES = {
  admin: {
    nav: ['dashboard', 'documents', 'customers', 'vendors', 'items', 'staff', 'settings', 'engineering'],
    docTypes: ['invoice', 'delivery', 'quotation', 'purchase', 'purchasebill', 'creditnote'],
    canEdit: true,
  },
  manager: {
    nav: ['dashboard', 'documents', 'customers', 'vendors', 'items', 'engineering'],
    docTypes: ['invoice', 'delivery', 'quotation', 'purchase', 'purchasebill', 'creditnote'],
    canEdit: true,
  },
  sales: {
    nav: ['dashboard', 'documents', 'customers', 'items'],
    docTypes: ['invoice', 'delivery', 'quotation', 'creditnote'],
    canEdit: true,
  },
  purchase: {
    nav: ['dashboard', 'documents', 'vendors', 'items'],
    docTypes: ['purchase', 'purchasebill'],
    canEdit: true,
  },
  inventory: {
    nav: ['dashboard', 'documents', 'items'],
    docTypes: ['invoice', 'delivery', 'quotation', 'purchase', 'purchasebill', 'creditnote'],
    canEdit: false,
  },
  accounts: {
    nav: ['dashboard', 'documents', 'customers', 'vendors'],
    docTypes: ['invoice', 'delivery', 'quotation', 'purchase', 'purchasebill', 'creditnote'],
    canEdit: false,
  },
  hr: {
    nav: ['dashboard', 'hr', 'payroll'],
    docTypes: [],
    canEdit: true,
  },
  viewer: {
    nav: ['dashboard', 'documents', 'customers', 'vendors', 'items'],
    docTypes: ['invoice', 'delivery', 'quotation', 'purchase', 'purchasebill', 'creditnote'],
    canEdit: false,
  },
};

// ─── Subscription / plan config ──────────────────────────────────────────────
// Emails that bypass all plan gates (dev / owner accounts)


export const TEST_EMAILS = ['srm10988@gmail.com', 'info.thirumaltrading@gmail.com'];

// Sections each plan unlocks (in addition to 'common' which every plan gets)


export const PLAN_MODULES = {
  common: [
    'dashboard','documents','customers','vendors','items','staff','settings','notifications',
    'pettycash','vouchers','gstr1','gstr3b','vatreport','taxreport',
    'enquiries','channelpartners','contracts','termslibrary',
    'stock','bincard','grn','storeissue','stockledger','verticalrack',
  ],
  trading: [
    'hr','payroll','employees',
  ],
  manufacturing: [
    'hr','payroll',
    'rawmaterials','bom','production','qualitycheck','parts','engdocs',
    'scopeofwork','isoprocs','deptprocedures','inprocessqa','qatesting',
    'pdv','internalaudit','capa','vendoreval','mis',
  ],
  service: [
    'hr','payroll','serviceorders',
    'siteprojects','activities','dailyupdate','progressboard',
    'clientmaterials','siteattendance','quarterlyeval',
    'tenders','rabilling','subcontractors','hse','handover','tc',
  ],
  fmamc: [
    'hr','payroll','serviceorders',
    'siteprojects','activities','dailyupdate','progressboard',
    'clientmaterials','siteattendance','quarterlyeval',
    'tenders','rabilling','subcontractors','hse','handover','tc',
    'assets','pmschedules','fmworkorders','fmspareParts','amccontracts','fmkpi',
  ],
};

// ─── Document types config ────────────────────────────────────────────────────


export const DOC_TYPES = {
  invoice:      { label: 'Invoice',           prefix: 'INV', icon: FileText,      color: '#1E2A4A', party: 'customer' },
  delivery:     { label: 'Delivery note',     prefix: 'DC',  icon: Truck,         color: '#3D7A5C', party: 'customer' },
  packing_list: { label: 'Packing list',      prefix: 'PL',  icon: Package,       color: '#1E7A9A', party: 'customer' },
  quotation:    { label: 'Quotation',         prefix: 'QUO', icon: FileSignature,  color: '#C9A24B', party: 'customer' },
  purchase:     { label: 'Purchase order',    prefix: 'PO',  icon: ShoppingCart,  color: '#6B5BAE', party: 'vendor'   },
  purchasebill: { label: 'Purchase bill',     prefix: 'PB',  icon: ShoppingCart,  color: '#8A6FD6', party: 'vendor'   },
  creditnote:   { label: 'Credit/Debit note', prefix: 'CDN', icon: FileMinus,     color: '#B5453A', party: 'customer' },
};

// ─── Convert map ──────────────────────────────────────────────────────────────


export const CONVERT_TO = {
  quotation: ['invoice'],
  invoice:   ['delivery', 'packing_list', 'creditnote'],
  delivery:  ['packing_list'],
  purchase:  ['purchasebill'],
};

// ─── Default item row ─────────────────────────────────────────────────────────
// Pass businessInfo to pick up the user's configured tax rate; falls back to country default


export const EMPTY_ITEM_ROW = (businessInfo) => {
  const cc = COUNTRY_CONFIG[(businessInfo && businessInfo.country)] || COUNTRY_CONFIG.india;
  const defaultGst = (businessInfo && businessInfo.taxRate !== undefined) ? businessInfo.taxRate : cc.defaultTaxRate;
  return {
    id: crypto.randomUUID(),
    itemId: '', name: '', hsn: '',
    qty: 1, rate: 0, gst: defaultGst,
    packages: 1, netWeight: 0, grossWeight: 0, dimensions: '',
  };
};

// ─── Number to words (Indian system) ─────────────────────────────────────────


export function numToWords(n) {
  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
    'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  function seg(x) {
    if (x < 20) return ones[x];
    if (x < 100) return tens[Math.floor(x/10)] + (x%10 ? ' '+ones[x%10] : '');
    return ones[Math.floor(x/100)] + ' Hundred' + (x%100 ? ' '+seg(x%100) : '');
  }
  n = Math.round(n);
  if (!n) return 'Zero';
  let r = '';
  const cr = Math.floor(n/10000000); n %= 10000000;
  const lk = Math.floor(n/100000);   n %= 100000;
  const th = Math.floor(n/1000);     n %= 1000;
  if (cr) r += seg(cr) + ' Crore ';
  if (lk) r += seg(lk) + ' Lakh ';
  if (th) r += seg(th) + ' Thousand ';
  if (n)  r += seg(n);
  return r.trim();
}

// ─── Blank document factory ───────────────────────────────────────────────────


export const blankDoc = (type, businessInfo) => ({
  id: crypto.randomUUID(),
  type,
  number: '',
  date: new Date().toISOString().slice(0, 10),
  customerId: '',
  customerSnapshot: null,
  items: [EMPTY_ITEM_ROW(businessInfo)],
  notes: '',
  dueDate: '',
  placeOfSupply: '',
  refNumber: '',
  status: 'draft',
  createdAt: Date.now(),
  linkedFrom: null,
  // Packing list fields
  portOfLoading: '', portOfDischarge: '', vesselFlight: '', blNumber: '',
  countryOfOrigin: '', shippingMarks: '',
  shipmentType: 'domestic', shipToSameAsBilling: false,
  shipToName: '', shipToAddress: '',
  vehicleNo: '', vehicleMode: '', driverName: '', driverMobile: '',
  // Approval trail
  submittedAt: null, verifiedAt: null, approvedAt: null,
  rejectedAt: null, rejectionNote: '',
});

// ─── Country config ───────────────────────────────────────────────────────────
// hasTax: false → hides all tax columns, totals, GSTR/VAT reports, tax ID fields


export const COUNTRY_CONFIG = {
  india:       { label: 'India',          flag: '🇮🇳', currency: '₹',     taxLabel: 'GST',  taxIdLabel: 'GSTIN',       taxIdPlaceholder: '22AAAAA0000A1Z5',  locale: 'en-IN', hasTax: true,  splitTax: true,  defaultTaxRate: 18, stateLabel: 'State'   },
  uae:         { label: 'UAE',            flag: '🇦🇪', currency: 'AED ',  taxLabel: 'VAT',  taxIdLabel: 'TRN',         taxIdPlaceholder: '100123456700003',  locale: 'en-AE', hasTax: true,  splitTax: false, defaultTaxRate: 5,  stateLabel: 'Emirate' },
  saudi:       { label: 'Saudi Arabia',   flag: '🇸🇦', currency: 'SAR ',  taxLabel: 'VAT',  taxIdLabel: 'VAT No.',     taxIdPlaceholder: '300000000000003',  locale: 'ar-SA', hasTax: true,  splitTax: false, defaultTaxRate: 15, stateLabel: 'Region'  },
  bahrain:     { label: 'Bahrain',        flag: '🇧🇭', currency: 'BHD ',  taxLabel: 'VAT',  taxIdLabel: 'VAT No.',     taxIdPlaceholder: '',                 locale: 'ar-BH', hasTax: true,  splitTax: false, defaultTaxRate: 10, stateLabel: 'Governorate' },
  oman:        { label: 'Oman',           flag: '🇴🇲', currency: 'OMR ',  taxLabel: 'VAT',  taxIdLabel: 'VAT No.',     taxIdPlaceholder: '',                 locale: 'ar-OM', hasTax: true,  splitTax: false, defaultTaxRate: 5,  stateLabel: 'Governorate' },
  kuwait:      { label: 'Kuwait',         flag: '🇰🇼', currency: 'KWD ',  taxLabel: '',     taxIdLabel: 'CR No.',      taxIdPlaceholder: '',                 locale: 'ar-KW', hasTax: false, splitTax: false, defaultTaxRate: 0,  stateLabel: 'Governorate' },
  qatar:       { label: 'Qatar',          flag: '🇶🇦', currency: 'QAR ',  taxLabel: '',     taxIdLabel: 'CR No.',      taxIdPlaceholder: '',                 locale: 'ar-QA', hasTax: false, splitTax: false, defaultTaxRate: 0,  stateLabel: 'Municipality' },
  uk:          { label: 'United Kingdom', flag: '🇬🇧', currency: '£',     taxLabel: 'VAT',  taxIdLabel: 'VAT No.',     taxIdPlaceholder: 'GB000000000',      locale: 'en-GB', hasTax: true,  splitTax: false, defaultTaxRate: 20, stateLabel: 'County'  },
  usa:         { label: 'United States',  flag: '🇺🇸', currency: '$',     taxLabel: 'Tax',  taxIdLabel: 'EIN',         taxIdPlaceholder: '00-0000000',       locale: 'en-US', hasTax: false, splitTax: false, defaultTaxRate: 0,  stateLabel: 'State'   },
  singapore:   { label: 'Singapore',      flag: '🇸🇬', currency: 'S$',    taxLabel: 'GST',  taxIdLabel: 'GST Reg No.', taxIdPlaceholder: 'M90000001A',       locale: 'en-SG', hasTax: true,  splitTax: false, defaultTaxRate: 9,  stateLabel: 'Region'  },
  australia:   { label: 'Australia',      flag: '🇦🇺', currency: 'A$',    taxLabel: 'GST',  taxIdLabel: 'ABN',         taxIdPlaceholder: '51 824 753 556',   locale: 'en-AU', hasTax: true,  splitTax: false, defaultTaxRate: 10, stateLabel: 'State'   },
  malaysia:    { label: 'Malaysia',       flag: '🇲🇾', currency: 'RM ',   taxLabel: 'SST',  taxIdLabel: 'SST No.',     taxIdPlaceholder: '',                 locale: 'ms-MY', hasTax: true,  splitTax: false, defaultTaxRate: 6,  stateLabel: 'State'   },
  canada:      { label: 'Canada',         flag: '🇨🇦', currency: 'CA$',   taxLabel: 'GST',  taxIdLabel: 'Business No.',taxIdPlaceholder: '123456789RT0001',  locale: 'en-CA', hasTax: true,  splitTax: false, defaultTaxRate: 5,  stateLabel: 'Province'},
  other:       { label: 'Other',          flag: '🌍',  currency: '$',     taxLabel: 'Tax',  taxIdLabel: 'Tax ID',      taxIdPlaceholder: '',                 locale: 'en-US', hasTax: false, splitTax: false, defaultTaxRate: 0,  stateLabel: 'State'   },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────


export function currency(n, sym, locale) {
  if (isNaN(n) || n == null) n = 0;
  const s = sym !== undefined ? sym : '₹';
  const loc = locale || 'en-IN';
  return s + Number(n).toLocaleString(loc, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
// Returns a formatter bound to the business's country — use this everywhere


export function makeFmt(businessInfo) {
  const cc = COUNTRY_CONFIG[(businessInfo && businessInfo.country)] || COUNTRY_CONFIG.india;
  return (n) => currency(n, cc.currency, cc.locale);
}



export function computeTotals(doc, sellerState, country) {
  let subtotal = 0, cgst = 0, sgst = 0, igst = 0, vat = 0;
  const cc = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.other;
  const sameState = cc.splitTax && sellerState && doc.placeOfSupply &&
    sellerState.trim().toLowerCase() === doc.placeOfSupply.trim().toLowerCase();
  (doc.items || []).forEach((it) => {
    const amt = (Number(it.qty) || 0) * (Number(it.rate) || 0);
    subtotal += amt;
    if (cc.hasTax) {
      const taxAmt = amt * (Number(it.gst) || 0) / 100;
      if (cc.splitTax) {
        if (sameState) { cgst += taxAmt / 2; sgst += taxAmt / 2; }
        else { igst += taxAmt; }
      } else {
        vat += taxAmt;
      }
    }
  });
  const totalTax = cgst + sgst + igst + vat;
  const grandTotal = subtotal + totalTax;
  return { subtotal, cgst, sgst, igst, vat, totalTax, grandTotal, sameState };
}

// ─── Shared tax helper for non-DocEditor modules (Tender, RA Bill, AMC, etc.) ─


export function calcModuleTax(subtotal, taxRate, cc, placeOfSupply, sellerState) {
  if (!cc || !cc.hasTax || !(parseFloat(taxRate) > 0)) return { cgst:0, sgst:0, igst:0, vat:0, totalTax:0, grandTotal:subtotal, sameState:false };
  const taxAmt = subtotal * (parseFloat(taxRate)||0) / 100;
  if (cc.splitTax) {
    const sameState = !!(sellerState && placeOfSupply && sellerState.trim().toLowerCase() === placeOfSupply.trim().toLowerCase());
    return sameState
      ? { cgst:taxAmt/2, sgst:taxAmt/2, igst:0, vat:0, totalTax:taxAmt, grandTotal:subtotal+taxAmt, sameState:true }
      : { cgst:0, sgst:0, igst:taxAmt, vat:0, totalTax:taxAmt, grandTotal:subtotal+taxAmt, sameState:false };
  }
  return { cgst:0, sgst:0, igst:0, vat:taxAmt, totalTax:taxAmt, grandTotal:subtotal+taxAmt, sameState:false };
}



export function computeStock(stockLedger, items) {
  // Returns map: itemId → { qty, value, item }
  const map = {};
  (items || []).forEach(it => {
    map[it.id] = { qty: parseFloat(it.openingStock) || 0, value: 0, item: it };
  });
  (stockLedger || []).forEach(e => {
    if (!map[e.itemId]) map[e.itemId] = { qty: 0, value: 0, item: { name: e.itemName, unit: '' } };
    const qty = parseFloat(e.qty) || 0;
    const rate = parseFloat(e.rate) || 0;
    if (e.type === 'in') {
      map[e.itemId].qty += qty;
      map[e.itemId].value += qty * rate;
    } else {
      map[e.itemId].qty -= qty;
      map[e.itemId].value -= qty * rate;
    }
  });
  return map;
}



export function downloadCSV(filename, headers, rows) {
  const escape = (v) => {
    const s = String(v === null || v === undefined ? '' : v);
    return s.includes(',') || s.includes('"') || s.includes('\n') ? ('"' + s.replace(/"/g, '""') + '"') : s;
  };
  const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}



export function filterByRange(documents, types, from, to) {
  return (documents || []).filter(d => {
    if (!types.includes(d.type)) return false;
    if (d.status !== 'approved') return false;
    if (from && d.date < from) return false;
    if (to && d.date > to) return false;
    return true;
  });
}



export function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function downloadDocPDF(elOrSelector, filename) {
  try {
    if (!window.html2canvas) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    if (!window.jspdf) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    const el = typeof elOrSelector === 'string' ? document.querySelector(elOrSelector) : elOrSelector;
    if (!el) { alert('Nothing to download'); return; }
    const canvas = await window.html2canvas(el, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const imgData = canvas.toDataURL('image/jpeg', 0.92);
    const imgH = (canvas.height * pageW) / canvas.width;
    if (imgH <= pageH) {
      pdf.addImage(imgData, 'JPEG', 0, 0, pageW, imgH);
    } else {
      let yOffset = 0;
      while (yOffset < imgH) {
        pdf.addImage(imgData, 'JPEG', 0, -yOffset, pageW, imgH);
        yOffset += pageH;
        if (yOffset < imgH) pdf.addPage();
      }
    }
    pdf.save(filename || 'document.pdf');
  } catch (e) {
    console.error('PDF error:', e);
    alert('PDF generation failed. Use Print → Save as PDF instead.');
  }
}



export function parseOCRText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  // Date
  let date = '';
  const dm = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dm) {
    const y = dm[3].length === 2 ? '20' + dm[3] : dm[3];
    date = `${y}-${dm[2].padStart(2,'0')}-${dm[1].padStart(2,'0')}`;
  }
  // Grand total
  const totalM = text.match(/(?:grand\s*total|net\s*amount|total\s*amount|total)[:\s]*[₹Rs\.]*\s*([0-9,]+\.?\d*)/i);
  const taxM = text.match(/(?:total\s*(?:gst|tax)|igst|cgst[^+\n]*\+[^₹\n]*sgst|gst\s*amount)[:\s]*[₹Rs\.]*\s*([0-9,]+\.?\d*)/i);
  // Vendor — first non-trivial non-numeric line
  let vendorName = '';
  for (const l of lines) {
    if (l.length > 3 && !/^\d/.test(l) && !/^(invoice|bill|receipt|tax|date|no\.|gstin|pan|phone|tel|email|www|address)/i.test(l)) {
      vendorName = l; break;
    }
  }
  // Items — lines with at least 2 numeric tokens (qty + rate or rate + amount)
  const items = [];
  for (const l of lines) {
    const nums = l.match(/[0-9,]+\.?\d*/g);
    if (nums && nums.length >= 2) {
      const desc = l.replace(/[0-9,\.₹Rs%\s]+$/g, '').trim();
      if (desc.length > 1) {
        const vals = nums.map(n => parseFloat(n.replace(/,/g,''))).filter(n => n > 0);
        items.push({ name: desc, qty: vals[0] || 1, rate: vals[vals.length - 1] || 0, gst: 18 });
      }
    }
  }
  return {
    date,
    vendorName,
    total: totalM ? parseFloat(totalM[1].replace(/,/g,'')) : 0,
    tax: taxM ? parseFloat(taxM[1].replace(/,/g,'')) : 0,
    items: items.slice(0, 15),
    rawText: text,
  };
}

// ─── styles.js ─────────────────────────────────────────────────



export const styles = {
  app: { display: 'flex', minHeight: '100vh', background: '#FAF8F4', color: '#3A3F4B', fontSize: 14 },
  sidebar: { width: 220, background: '#1E2A4A', color: '#E8E6DE', display: 'flex', flexDirection: 'column', padding: '24px 14px', gap: 4, position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' },
  brand: { display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', marginBottom: 24 },
  brandMark: { width: 34, height: 34, borderRadius: 8, background: '#C9A24B', color: '#1E2A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'Lora, serif', fontSize: 18 },
  brandName: { fontSize: 17, fontWeight: 600, color: '#fff' },
  brandSub: { fontSize: 11, color: '#A9B0C9', letterSpacing: '0.04em' },
  navGroup: { display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 },
  navLabel: { fontSize: 11, color: '#7E89AD', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '14px 12px 4px' },
  navItem: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: '#C9CEDF', textAlign: 'left', fontSize: 13.5, transition: 'background 0.15s' },
  navItemActive: { background: 'rgba(255,255,255,0.08)', color: '#fff' },
  main: { flex: 1, minWidth: 0 },
  page: { padding: '32px 40px', maxWidth: 1100 },
  pageHeader: { marginBottom: 24 },
  h1: { fontSize: 28, fontWeight: 600, margin: 0, color: '#1E2A4A' },
  h2: { fontSize: 18, fontWeight: 600, margin: 0, color: '#1E2A4A' },
  muted: { color: '#888780', fontSize: 13.5, margin: '4px 0 0' },
  statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 },
  dashSection: { fontSize: 11, fontWeight: 700, color: '#C9A24B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, marginTop: 8 },
  statCard: { background: '#fff', border: '1px solid #EAE6DB', borderRadius: 12, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'center' },
  statBar: { width: 4, height: 32, borderRadius: 2 },
  statLabel: { fontSize: 12, color: '#888780', marginBottom: 4 },
  statValue: { fontSize: 20, fontWeight: 600, color: '#1E2A4A' },
  sectionRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '28px 0 14px' },
  quickGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 },
  quickCard: { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, background: '#fff', border: '1px solid #EAE6DB', borderRadius: 12, padding: '16px', textAlign: 'left' },
  quickLabel: { fontSize: 13.5, fontWeight: 500, color: '#1E2A4A' },
  quickCount: { fontSize: 11.5, color: '#888780' },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  docRow: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #EAE6DB', borderRadius: 10, padding: '12px 16px', cursor: 'pointer' },
  recordRow: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #EAE6DB', borderRadius: 10, padding: '12px 16px' },
  docIcon: { width: 34, height: 34, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  docRowTitle: { fontWeight: 500, fontSize: 14, color: '#1E2A4A' },
  docRowSub: { fontSize: 12.5, color: '#888780', marginTop: 2 },
  docRowDate: { fontSize: 12.5, color: '#888780', width: 90 },
  docRowAmount: { fontWeight: 600, fontSize: 14.5, color: '#1E2A4A', width: 110, textAlign: 'right' },
  badge: { fontSize: 11, fontWeight: 500, padding: '3px 10px', borderRadius: 20, flexShrink: 0, whiteSpace: 'nowrap' },
  emptyBox: { padding: '40px 20px', textAlign: 'center', color: '#888780', background: '#fff', border: '1px dashed #D3D1C7', borderRadius: 12, fontSize: 13.5 },
  toolbar: { marginBottom: 16 },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#fff', border: '1px solid #EAE6DB', borderRadius: 10, padding: '8px 14px', maxWidth: 340 },
  searchInput: { border: 'none', outline: 'none', flex: 1, fontSize: 13.5, background: 'transparent' },
  linkBtn: { border: 'none', background: 'none', color: '#C9A24B', fontWeight: 500, fontSize: 13 },
  editorTopBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' },
  editorTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 600, color: '#1E2A4A' },
  editorLayout: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 },
  editorForm: { display: 'flex', flexDirection: 'column', gap: 4 },
  formGroup: { marginBottom: 14 },
  label: { display: 'block', fontSize: 12, color: '#888780', marginBottom: 5, fontWeight: 500 },
  input: { width: '100%', padding: '8px 11px', border: '1px solid #DDD8CC', borderRadius: 8, fontSize: 13.5, outline: 'none', background: '#fff' },
  inputReadOnly: { background: '#F5F3EE', color: '#888780', cursor: 'default', borderColor: '#E8E4DB' },
  primaryBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' },
  secondaryBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#F5F3EE', color: '#1E2A4A', border: '1px solid #DDD8CC', borderRadius: 8, padding: '9px 16px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' },
  ghostBtn: { display: 'flex', alignItems: 'center', gap: 6, background: '#fff', color: '#1E2A4A', border: '1px solid #DDD8CC', borderRadius: 8, padding: '9px 14px', fontSize: 13.5, fontWeight: 500, cursor: 'pointer' },
  iconBtn: { background: 'none', border: 'none', padding: 6, borderRadius: 6, display: 'flex', alignItems: 'center', cursor: 'pointer' },
  preview: { background: '#fff', border: '1px solid #EAE6DB', borderRadius: 12, padding: '40px 48px', boxShadow: '0 2px 12px rgba(30,42,74,0.07)', minHeight: 680, fontSize: 13, position: 'relative', overflow: 'visible' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  previewBrand: { fontSize: 19, fontWeight: 600, color: '#1E2A4A' },
  previewSmall: { fontSize: 12, color: '#888780', marginTop: 2, lineHeight: 1.5 },
  previewDocType: { fontSize: 20, fontWeight: 700, letterSpacing: '0.02em' },
  previewDivider: { borderBottom: '1px solid #EAE6DB', margin: '20px 0' },
  billToLabel: { fontSize: 11, color: '#C9A24B', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 },
  billToName: { fontWeight: 600, fontSize: 14, color: '#1E2A4A' },
  table: { width: '100%', borderCollapse: 'collapse', marginTop: 8 },
  th: { textAlign: 'left', fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 6px', borderBottom: '2px solid #EAE6DB' },
  td: { padding: '6px', borderBottom: '1px solid #F2EFE6', fontSize: 13, verticalAlign: 'middle' },
  inlineInput: { border: '1px solid transparent', padding: '4px 6px', borderRadius: 6, fontSize: 13, width: '100%', outline: 'none', background: 'transparent' },
  inlineInputEditable: { border: '1px solid #DDD8CC', background: '#FDFCFA', cursor: 'text' },
  inlineSelect: { border: '1px solid #EAE6DB', padding: '3px 6px', borderRadius: 6, fontSize: 11.5, marginBottom: 3, width: '100%', background: '#FAF8F4' },
  addRowBtn: { background: 'none', border: 'none', color: '#C9A24B', fontWeight: 500, fontSize: 13, cursor: 'pointer', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 4 },
  totalsBlock: { marginTop: 16, display: 'flex', justifyContent: 'flex-end' },
  totalsRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '4px 0', gap: 48, color: '#555' },
  totalsGrand: { display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 700, padding: '8px 0', borderTop: '2px solid #EAE6DB', marginTop: 6, color: '#1E2A4A', gap: 48 },
  notesBlock: { marginTop: 20, fontSize: 13, color: '#555' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(18,28,58,0.52)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#F7F4EE', borderRadius: 16, padding: 0, width: 460, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 12px 48px rgba(18,28,58,0.28)', border: '1px solid #E2DDD5' },
  modalHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px 16px', borderBottom: '1px solid #E2DDD5', background: '#1E2A4A', borderRadius: '16px 16px 0 0' },
  syncBox: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#888780' },
  workspaceBox: { background: '#F5F3EE', borderRadius: 10, padding: '12px 14px', marginTop: 16 },
  workspaceLabel: { fontSize: 11, color: '#888780', fontWeight: 500, marginBottom: 4 },
  workspaceCode: { fontFamily: 'monospace', fontSize: 13, color: '#1E2A4A', wordBreak: 'break-all' },
  loginScreen: { minHeight: '100vh', background: 'linear-gradient(135deg,#F8F5EE 0%,#EAE6DB 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  loginCard: { background: '#fff', borderRadius: 20, padding: '40px 36px', width: 400, maxWidth: '95vw', boxShadow: '0 4px 32px rgba(30,42,74,0.10)' },
  loginTitle: { fontSize: 24, fontWeight: 700, color: '#1E2A4A', marginBottom: 4 },
  loginTabs: { display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #EAE6DB' },
  loginTab: { flex: 1, padding: '10px 0', textAlign: 'center', fontWeight: 500, fontSize: 14, cursor: 'pointer', color: '#888780', background: 'none', border: 'none', borderBottom: '2px solid transparent', marginBottom: -2 },
  loginTabActive: { color: '#1E2A4A', borderBottom: '2px solid #1E2A4A' },
  authError: { background: '#FEF2F2', color: '#B91C1C', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16 },
  logoPreviewWrap: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 },
  logoPreview: { width: 56, height: 56, objectFit: 'contain', borderRadius: 8, border: '1px solid #EAE6DB', background: '#F8F5EE' },
  templateGrid: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 4 },
  templateCard: { border: '2px solid #EAE6DB', borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center', fontSize: 12, color: '#555', background: '#FAF8F4' },
  templateCardActive: { border: '2px solid #1E2A4A', background: '#F0EFE9' },
  templateSwatch: (id) => ({ height: 28, borderRadius: 6, marginBottom: 6, background: id === 'classic' ? 'linear-gradient(90deg,#1E2A4A,#3B4F7A)' : id === 'modern' ? 'linear-gradient(90deg,#C9A24B,#E8C97A)' : '#EAE6DB' }),
  previewBrandRow: { display: 'flex', alignItems: 'flex-start', gap: 12 },
  previewLogo: { width: 64, height: 64, objectFit: 'contain', borderRadius: 8 },
  previewHeaderModern: { background: 'linear-gradient(90deg,#C9A24B,#E8C97A)', borderRadius: 10, padding: '16px 20px', marginBottom: 20, color: '#fff' },
  modernBand: { background: 'linear-gradient(90deg,#1E2A4A,#3B4F7A)', borderRadius: 10, padding: '16px 20px', marginBottom: 20, color: '#fff' },
  previewMinimal: { borderTop: '3px solid #1E2A4A', paddingTop: 16, marginBottom: 20 },
  sectionDivider: { fontSize: 12, fontWeight: 600, color: '#C9A24B', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid #EAE6DB', paddingBottom: 6, marginBottom: 14, marginTop: 8 },
};

// ─── Modal ─────────────────────────────────────────────────────



export function TaxSummaryBox({ subtotal, taxRate, cc, placeOfSupply, sellerState, onChangeTax, onChangePOS, readOnly }) {
  if (!cc || !cc.hasTax) return null;
  const t = calcModuleTax(subtotal, taxRate, cc, placeOfSupply, sellerState);
  return (
    <div style={{ background:'#F8F7F4', borderRadius:8, padding:'12px 16px', border:'1px solid #EAE6DB', marginTop:8 }}>
      {/* Tax rate + place of supply row */}
      {!readOnly && (
        <div style={{ display:'flex', gap:12, marginBottom:10, flexWrap:'wrap' }}>
          <div style={{ ...styles.formGroup, flex:1, minWidth:140 }}>
            <label style={styles.label}>{cc.taxLabel||'Tax'} Rate (%)</label>
            <input type='number' value={taxRate||0} onChange={e=>onChangeTax&&onChangeTax(e.target.value)} style={{ ...styles.input, margin:0 }}/>
          </div>
          {cc.splitTax && (
            <div style={{ ...styles.formGroup, flex:2, minWidth:180 }}>
              <label style={styles.label}>Place of Supply (State)</label>
              <input value={placeOfSupply||''} onChange={e=>onChangePOS&&onChangePOS(e.target.value)} placeholder={`e.g. ${sellerState||'Tamil Nadu'}`} style={{ ...styles.input, margin:0 }}/>
            </div>
          )}
        </div>
      )}
      {/* Tax breakdown */}
      <div style={{ borderTop:'1px solid #EAE6DB', paddingTop:10 }}>
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:3 }}>
          <span>Subtotal</span><span>{subtotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>
        {t.cgst > 0 && <>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>CGST ({(parseFloat(taxRate)||0)/2}%)</span><span>{t.cgst.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>SGST ({(parseFloat(taxRate)||0)/2}%)</span><span>{t.sgst.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>
        </>}
        {t.igst > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>IGST ({parseFloat(taxRate)||0}%)</span><span>{t.igst.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>}
        {t.vat > 0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>{cc.taxLabel||'Tax'} ({parseFloat(taxRate)||0}%)</span><span>{t.vat.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span></div>}
        <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, color:'#1E2A4A', borderTop:'1px solid #EAE6DB', paddingTop:6, marginTop:4 }}>
          <span>Grand Total</span><span>{t.grandTotal.toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Shared Print Overlay (used by Tender, RA Bill, AMC, Sub WO, PTW, Handover)


export function DocPrintOverlay({ onClose, filename, businessInfo, children }) {
  const [pdfLoading, setPdfLoading] = React.useState(false);
  const [useLH, setUseLH] = React.useState(!!(businessInfo?.letterhead||businessInfo?.letterheadHtml));
  const cur = (cc) => (COUNTRY_CONFIG[businessInfo?.country] || COUNTRY_CONFIG.other).currency || '';
  return (
    <>
      <div className="no-print" onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:998 }}/>
      <div className="no-print" style={{ position:'fixed', top:16, right:24, zIndex:1001, display:'flex', gap:8 }}>
        <button style={{ ...styles.ghostBtn, background:'#fff' }} onClick={onClose}><X size={15}/> Close</button>
        {businessInfo?.letterhead && (
          <button onClick={()=>setUseLH(v=>!v)} style={{ ...styles.ghostBtn, background:'#fff', ...(useLH?{background:'#EEF2FF',color:'#3D52A0',fontWeight:600}:{}) }}>
            📃 {useLH?'Letterhead ON':'Use Letterhead'}
          </button>
        )}
        <button style={{ ...styles.ghostBtn, background:'#fff' }} onClick={async()=>{ setPdfLoading(true); await downloadDocPDF('.doc-print-area', filename||'document.pdf'); setPdfLoading(false); }}>
          {pdfLoading?'⏳':'⬇'} {pdfLoading?'Generating...':'Download PDF'}
        </button>
        <button style={styles.primaryBtn} onClick={()=>window.print()}><Printer size={15}/> Print</button>
      </div>
      <div className="doc-print-area print-area" style={{ position:'fixed', inset:0, background:'#fff', zIndex:999, overflowY:'auto', fontFamily:'Georgia, serif' }}>
        {useLH && <LetterheadHeader bi={businessInfo} />}
        <div style={{ padding: useLH ? '24px 56px 48px' : '48px 56px' }}>
          {!useLH && businessInfo && (
            <div style={{ marginBottom:24, borderBottom:'2px solid #1E2A4A', paddingBottom:16 }}>
              <div style={{ fontSize:20, fontWeight:700, color:'#1E2A4A' }}>{businessInfo.name||'Company Name'}</div>
              {businessInfo.address && <div style={{ fontSize:12, color:'#555', marginTop:2 }}>{businessInfo.address}</div>}
              {businessInfo.phone && <div style={{ fontSize:12, color:'#555' }}>📞 {businessInfo.phone}{businessInfo.email?' | ✉ '+businessInfo.email:''}</div>}
              {businessInfo.gst && <div style={{ fontSize:12, color:'#555' }}>GSTIN: {businessInfo.gst}</div>}
            </div>
          )}
          {children}
          {useLH && businessInfo?.letterheadFooter && (
            <img src={businessInfo.letterheadFooter} alt="footer" style={{ width:'100%', display:'block', marginTop:32 }}/>
          )}
        </div>
      </div>
    </>
  );
}

// ─── PDF Download & OCR Utilities ────────────────────────────────────────────


export function Modal({ children, onClose, title, wide }) {
  return (
    <div style={styles.modalOverlay} className="no-print">
      <div style={{ ...styles.modal, width: wide ? 680 : 460 }}>
        <div style={styles.modalHeader}>
          <span className="serif" style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>{title}</span>
          <button onClick={onClose} style={{ ...styles.iconBtn, color: '#fff', opacity: 0.8 }}><X size={18} /></button>
        </div>
        <div style={{ padding: '20px 24px 24px' }}>{children}</div>
      </div>
    </div>
  );
}


// ─── Email Notification Utility ──────────────────────────────────────────────


export function LetterpadPrintStyle() {
  return (
    <style>{`
      /* ── Screen: force footer to fill full width edge-to-edge ── */
      @media screen {
        .lh-pad-footer {
          height: 130px !important;
          padding: 0 !important;
          overflow: hidden !important;
        }
        .lh-pad-footer img {
          width: 100% !important;
          height: 130px !important;
          object-fit: cover !important;
          object-position: center !important;
          display: block !important;
        }
        .lh-pad-header img {
          width: 100% !important;
          height: auto !important;
          display: block !important;
        }
      }
      /* ── Print: fixed position so header/footer repeat on every page ── */
      @media print {
        .lh-pad-header {
          position: fixed !important; top: 0 !important; left: 0 !important;
          right: 0 !important; width: 100% !important; background: white !important; z-index: 9999 !important;
        }
        .lh-pad-footer {
          position: fixed !important; bottom: 0 !important; left: 0 !important;
          right: 0 !important; width: 100% !important; background: white !important; z-index: 9999 !important;
        }
        .print-area { padding-top: 215px !important; padding-bottom: 135px !important; }
      }
    `}</style>
  );
}



export function sanitizeLHtml(html) {
  if (!html) return '';
  const b = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let h = b ? b[1] : html;
  h = h.replace(/<script[\s\S]*?<\/script>/gi, '');
  h = h.replace(/<\/?(html|head|body)[^>]*>/gi, '');
  return h.trim();
}



export function LetterheadHeader({ bi, style = {} }) {
  if (!bi) return null;
  try {
    if (bi.letterheadHtml) {
      const safeHtml = sanitizeLHtml(bi.letterheadHtml);
      return (
        <div style={{ width:'100%', background:'#fff', ...style }} dangerouslySetInnerHTML={{ __html: safeHtml }} />
      );
    }
    if (bi.letterhead) return (
      <div className="lh-pad-header" style={{ background:'#fff', ...style }}>
        <img src={bi.letterhead} alt="letterhead" style={{ width:'100%', display:'block' }} />
      </div>
    );
  } catch(e) { return null; }
  return null;
}



export function VoucherPrintHeader({ businessInfo, useLH }) {
  const cc = COUNTRY_CONFIG[businessInfo.country || 'india'];
  if (useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml)) {
    return (
      <>
        <LetterpadPrintStyle />
        <LetterheadHeader bi={businessInfo} />
        <div style={{ paddingTop: 0 }} />
      </>
    );
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 14, marginBottom: 16, borderBottom: '2px solid #1E2A4A' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {businessInfo.logo && <img src={businessInfo.logo} alt="logo" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 6, background: '#fff' }} />}
        <div>
          <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: '#1E2A4A' }}>{businessInfo.name}</div>
          <div style={{ fontSize: 11, color: '#666', marginTop: 2, maxWidth: 300 }}>{businessInfo.address}</div>
          {businessInfo.gstin && <div style={{ fontSize: 11, color: '#666' }}>{cc.taxIdLabel}: {businessInfo.gstin}</div>}
          {businessInfo.phone && <div style={{ fontSize: 11, color: '#666' }}>{businessInfo.phone}</div>}
        </div>
      </div>
    </div>
  );
}



export function VoucherSignatory({ businessInfo, leftLabel }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, borderTop: '1px solid #EAE6DB', paddingTop: 20, marginTop: 32 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ height: 44 }} />
        <div style={{ borderTop: '1px solid #555', paddingTop: 6, fontSize: 11, color: '#888780' }}>{leftLabel}</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ height: 44 }} />
        <div style={{ borderTop: '1px solid #555', paddingTop: 6, fontSize: 11, color: '#888780' }}>
          <div style={{ fontWeight: 600, color: '#1E2A4A', fontSize: 12 }}>{businessInfo.name}</div>
          {businessInfo.signatory && <div>{businessInfo.signatory}</div>}
          <div>Authorized Signatory</div>
        </div>
      </div>
    </div>
  );
}



export function ApprovalActions({ item, onUpdate, userRole, compact = false }) {
  const [rejectMode, setRejectMode] = React.useState(false);
  const [note, setNote] = React.useState('');
  const status = item?.status || 'draft';
  const isApprover = userRole === 'admin' || userRole === 'manager';

  if (rejectMode) return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input value={note} onChange={e => setNote(e.target.value)}
        placeholder="Reason for rejection…" autoFocus
        style={{ border: '1px solid #E08A7D', borderRadius: 6, padding: '4px 8px', fontSize: 12, width: 180 }} />
      <button style={{ ...styles.primaryBtn, background: '#B5453A', fontSize: 12, padding: '4px 10px' }}
        onClick={() => { onUpdate({ status: 'rejected', rejectionNote: note }); setRejectMode(false); setNote(''); }}>
        Confirm
      </button>
      <button style={styles.iconBtn} onClick={() => { setRejectMode(false); setNote(''); }}><X size={13}/></button>
    </div>
  );

  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Preparer: draft or rejected → can forward */}
      {(status === 'draft' || status === 'rejected') && (
        <button style={{ ...styles.secondaryBtn, fontSize: 12, padding: '3px 9px', color: '#2255A0', borderColor: '#2255A0', background: '#EEF1F8' }}
          onClick={() => onUpdate({ status: 'submitted', rejectionNote: '' })}>
          Forward →
        </button>
      )}
      {/* Approver: forwarded → approve or reject */}
      {status === 'submitted' && isApprover && (
        <>
          <button style={{ ...styles.secondaryBtn, fontSize: 12, padding: '3px 9px', color: '#B5453A', borderColor: '#B5453A', background: '#FBEAE7' }}
            onClick={() => setRejectMode(true)}>
            Reject
          </button>
          <button style={{ ...styles.secondaryBtn, fontSize: 12, padding: '3px 9px', color: '#3B6D11', borderColor: '#3B6D11', background: '#EAF3DE' }}
            onClick={() => onUpdate({ status: 'approved', rejectionNote: '' })}>
            ✓ Approve
          </button>
        </>
      )}
      {/* Rejected note */}
      {status === 'rejected' && item.rejectionNote && !compact && (
        <span style={{ fontSize: 11, color: '#B5453A', fontStyle: 'italic' }}>"{item.rejectionNote}"</span>
      )}
    </div>
  );
}



export function StatusBadge({ status }) {
  const map = {
    draft:     { bg: '#EEEDE6', color: '#5F5E5A', label: 'Preparing' },
    submitted: { bg: '#E6EEF9', color: '#2255A0', label: 'Forwarded' },
    verified:  { bg: '#E6EEF9', color: '#2255A0', label: 'Forwarded' },  // legacy alias
    approved:  { bg: '#EAF3DE', color: '#3B6D11', label: 'Approved' },
    rejected:  { bg: '#FBEAE7', color: '#B5453A', label: 'Rejected' },
    paid:      { bg: '#D6F0E0', color: '#1A5C35', label: 'Paid' },
  };
  const s = map[status] || map.draft;
  return <span style={{ ...styles.badge, background: s.bg, color: s.color }}>{s.label}</span>;
}

// ── Shared approval action buttons used across all modules ──────────────────
// item must have .status and .rejectionNote fields
// onUpdate(patch) updates just those fields on the item


export function DocRow({ doc, customers, vendors, onClick, businessInfo, showBizBadge = false }) {
  const t = DOC_TYPES[doc.type];
  if (!t) return null;
  const partyList = t.party === 'vendor' ? (vendors || []) : customers;
  const party = partyList.find((c) => c.id === doc.customerId);
  const totals = computeTotals(doc, businessInfo.state, businessInfo.country);
  return (
    <div onClick={onClick} style={styles.docRow}>
      <div style={{ ...styles.docIcon, background: t.color + '18', color: t.color }}>
        <t.icon size={17} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ ...styles.docRowTitle, display: 'flex', alignItems: 'center', gap: 6 }}>
          {doc.number}
          {doc.linkedFrom && (
            <span title={`Based on ${DOC_TYPES[doc.linkedFrom.docType]?.label} ${doc.linkedFrom.docNumber}`}
              style={{ fontSize: 10, background: '#EDE8FA', color: '#6B5BAE', borderRadius: 4, padding: '1px 5px', fontWeight: 500 }}>
              🔗 {doc.linkedFrom.docNumber}
            </span>
          )}
        </div>
        <div style={styles.docRowSub}>{party ? party.name : (t.party === 'vendor' ? 'No vendor' : 'No customer')} · {t.label}</div>
      </div>
      <div style={styles.docRowDate}>{doc.date}</div>
      <div className="serif" style={styles.docRowAmount}>{makeFmt(businessInfo)(totals.grandTotal)}</div>
      <StatusBadge status={doc.status} />
    </div>
  );
}



export function StatCard({ label, value, accent, sub }) {
  return (
    <div style={styles.statCard}>
      <div style={{ ...styles.statBar, background: accent }} />
      <div>
        <div style={styles.statLabel}>{label}</div>
        <div className="serif" style={styles.statValue}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: '#B0AC9F', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}



export const BIZ_BADGE = {
  trading:       { label: 'Trading',       bg: '#FDF7E6', color: '#C9A24B' },
  manufacturing: { label: 'Manufacturing', bg: '#EEF0F7', color: '#1E2A4A' },
  service:       { label: 'MEP / Service', bg: '#E0F2F9', color: '#1E7A9A' },
};


export function DocumentsList({ docs, customers, vendors, search, setSearch, openDoc, deleteDoc, startNewDoc, activeTypes = ['trading'] }) {
  const isMultiBiz = activeTypes.length > 1;
  const [filterBizType, setFilterBizType] = React.useState(
    activeTypes.length === 1 ? activeTypes[0] : 'all'
  );
  const BIZ_FILTER_TABS = [
    { key: 'all',           label: 'All' },
    { key: 'trading',       label: '🛒 Trading' },
    { key: 'manufacturing', label: '🏭 Manufacturing' },
    { key: 'service',       label: '🔧 Services' },
  ].filter(t => t.key === 'all' || activeTypes.includes(t.key));
  const visibleDocs = filterBizType === 'all'
    ? docs
    : docs.filter(d => (d.bizType || 'trading') === filterBizType);
  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h1 className="serif" style={styles.h1}>All documents</h1>
        <p style={styles.muted}>Every invoice, delivery note, quotation, purchase order, bill and credit note in one place.</p>
      </div>

      {isMultiBiz && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
          {BIZ_FILTER_TABS.map(t => (
            <button key={t.key} onClick={() => setFilterBizType(t.key)}
              style={{ padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: filterBizType === t.key ? '#1E2A4A' : '#EAE6DB',
                color: filterBizType === t.key ? '#fff' : '#555' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <Search size={15} color="#888780" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by number, customer or vendor" style={styles.searchInput} />
        </div>
        <button style={styles.ghostBtn} onClick={() => downloadCSV('documents.csv',
          ['Type', 'Number', 'Date', 'Party', 'Status', 'Amount', 'Activity'],
          visibleDocs.map(d => {
            const party = customers.find(c => c.id === d.customerId) || vendors.find(v => v.id === d.customerId);
            const t = computeTotals(d, '', '');
            return [d.type, d.number, d.date, party ? party.name : (d.customerSnapshot?.name || ''), d.status || '', t.grandTotal.toFixed(2), d.bizType || 'trading'];
          })
        )}><Download size={14} /> Export CSV</button>
      </div>

      {visibleDocs.length === 0 ? (
        <div style={styles.emptyBox}>No documents found. Try a different search or activity filter, or create a new document from the sidebar.</div>
      ) : (
        <div style={styles.list}>
          {visibleDocs.map((d) => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1 }}><DocRow doc={d} customers={customers} vendors={vendors} onClick={() => openDoc(d)} businessInfo={{ state: '' }} showBizBadge={isMultiBiz} /></div>
              <button onClick={() => deleteDoc(d.id)} style={styles.iconBtn} title="Delete"><Trash2 size={15} color="#B5453A" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}



export function ConvertDropdown({ doc, onConvert }) {
  const [open, setOpen] = useState(false);
  const targets = CONVERT_TO[doc.type] || [];
  if (!targets.length) return null;
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{ ...styles.ghostBtn, display: 'flex', alignItems: 'center', gap: 6 }}>
        Convert to <ChevronDown size={13} />
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1px solid #E2DDD5', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 200, minWidth: 160, overflow: 'hidden' }}>
          {targets.map((targetType) => {
            const t = DOC_TYPES[targetType];
            return (
              <button key={targetType} onClick={() => { setOpen(false); onConvert(doc, targetType); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#2C2B27', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = '#F5F3EF'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <t.icon size={14} color={t.color} />{t.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────

// Which views belong to each section (for auto-expand when child is active)


export function PrintModal({ title, children, onClose }) {
  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'print-modal-override';
    style.textContent = '@media print { body * { visibility: hidden !important; } .print-area, .print-area * { visibility: visible !important; } .print-area { position: absolute !important; top: 0 !important; left: 0 !important; width: 100% !important; } }';
    document.head.appendChild(style);
    return () => { const el = document.getElementById('print-modal-override'); if (el) el.remove(); };
  }, []);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }} className="no-print">
      <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 900, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #eee' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={styles.ghostBtn} onClick={() => downloadDocPDF('.print-area','bin-card.pdf')}><Download size={14}/> PDF</button>
            <button style={styles.primaryBtn} onClick={() => window.print()}><Printer size={14}/> Print / Save PDF</button>
            <button style={styles.secondaryBtn} onClick={onClose}><X size={14}/> Close</button>
          </div>
        </div>
        <div className="print-area" style={{ padding: 32, background: '#fff', fontFamily: 'Georgia, serif', fontSize: 13 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// SHARED: date range filter
// ─────────────────────────────────────────────


export function DateRangePicker({ from, setFrom, to, setTo, count, label }) {
  const now = new Date();
  const firstOfMonth = now.toISOString().slice(0, 7) + '-01';
  const today = now.toISOString().slice(0, 10);
  useEffect(() => { if (!from) setFrom(firstOfMonth); if (!to) setTo(today); }, []);
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }} className="no-print">
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ fontSize: 13, color: '#6B7494' }}>From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...styles.input, width: 150 }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ fontSize: 13, color: '#6B7494' }}>To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ ...styles.input, width: 150 }} />
      </div>
      <div style={{ fontSize: 13, color: '#888780' }}>{count} {label} found</div>
    </div>
  );
}

// ─────────────────────────────────────────────
// P&L AUDIT VIEW
// ─────────────────────────────────────────────


export function SpecsFields({ specs = {}, onChange, fields = [] }) {
  function set(key, val) { onChange({ ...specs, [key]: val }); }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
      {fields.map(([key, label, placeholder]) => (
        <div key={key} style={styles.formGroup}>
          <label style={styles.label}>{label}</label>
          <input
            value={specs[key] || ''}
            onChange={e => set(key, e.target.value)}
            style={styles.input}
            placeholder={placeholder || ''}
          />
        </div>
      ))}
    </div>
  );
}

// ─── Shared: Drawing / file uploader ────────────────────────────────────────



export function DrawingUploader({ files = [], onChange, ownerUid, folder }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file || !ownerUid) return;
    setUploading(true);
    try {
      const result = await uploadDrawing(ownerUid, folder, file);
      onChange([...files, { name: file.name, url: result.url, path: result.path }]);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
    setUploading(false);
    e.target.value = '';
  }

  async function removeFile(f) {
    if (!window.confirm('Remove ' + f.name + '?')) return;
    try { if (f.path) await deleteDrawing(f.path); } catch (_) {}
    onChange(files.filter(x => x !== f));
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {files.map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F0EEF9', borderRadius: 8, padding: '5px 10px', fontSize: 12 }}>
            <Paperclip size={12} color="#6B5EA8" />
            <a href={f.url} target="_blank" rel="noreferrer" style={{ color: '#1E2A4A', textDecoration: 'none' }}>{f.name}</a>
            <button onClick={() => removeFile(f)} style={{ ...styles.iconBtn, padding: 2 }}><X size={11} color="#B5453A" /></button>
          </div>
        ))}
        {files.length === 0 && <span style={{ fontSize: 12, color: '#888780' }}>No files attached.</span>}
      </div>
      <label style={{ ...styles.ghostBtn, display: 'inline-flex', cursor: 'pointer', fontSize: 12 }}>
        <Paperclip size={13} />{uploading ? 'Uploading…' : 'Attach file'}
        <input type="file" style={{ display: 'none' }} onChange={handleFile} disabled={uploading} />
      </label>
    </div>
  );
}



export function LockedModuleScreen() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:16, textAlign:'center', padding:32 }}>
      <div style={{ fontSize:48, lineHeight:1 }}>🔒</div>
      <h2 className="serif" style={{ fontSize:22, color:'#1E2A4A', margin:0 }}>Module Not in Your Plan</h2>
      <p style={{ color:'#888', maxWidth:360, lineHeight:1.6, margin:0 }}>
        This module isn't included in your current subscription plan.<br/>
        Contact us to upgrade and unlock it.
      </p>
      <a href="mailto:support@operix.app" style={{ display:'inline-block', padding:'10px 24px', background:'#1E2A4A', color:'#fff', borderRadius:8, textDecoration:'none', fontSize:14, fontWeight:600 }}>
        Contact Support
      </a>
    </div>
  );
}



export function TemplateMiniPreview({ template, name }) {
  const docColor = '#C9A24B';
  const lineStyle = { height: 4, borderRadius: 2, marginBottom: 3, background: '#EAE6DB' };
  const shortLine = { ...lineStyle, width: '40%' };
  const medLine = { ...lineStyle, width: '60%' };
  const fullLine = { ...lineStyle, width: '100%' };

  const companyBlock = (color) => (
    <div style={{ flex: 1 }}>
      <div style={{ ...lineStyle, width: '55%', background: color || '#1E2A4A', height: 5, marginBottom: 4 }} />
      <div style={{ ...shortLine, background: color ? 'rgba(255,255,255,0.5)' : '#DDD8CC' }} />
      <div style={{ ...shortLine, background: color ? 'rgba(255,255,255,0.4)' : '#DDD8CC' }} />
    </div>
  );
  const docBlock = (color) => (
    <div style={{ textAlign: 'right' }}>
      <div style={{ ...lineStyle, width: 50, marginLeft: 'auto', background: color || docColor, height: 6, marginBottom: 4 }} />
      <div style={{ ...shortLine, background: color ? 'rgba(255,255,255,0.5)' : '#DDD8CC', marginLeft: 'auto', width: 36 }} />
      <div style={{ ...shortLine, background: color ? 'rgba(255,255,255,0.4)' : '#DDD8CC', marginLeft: 'auto', width: 36 }} />
    </div>
  );
  const tableBlock = () => (
    <div style={{ marginTop: 8 }}>
      <div style={{ ...fullLine, background: '#EAE6DB', height: 2 }} />
      {[1,2,3].map(i => <div key={i} style={{ ...fullLine, height: 3, marginTop: 4, opacity: 0.5 }} />)}
    </div>
  );

  if (template === 'modern') return (
    <div>
      <div style={{ background: docColor, borderRadius: 6, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        {companyBlock('rgba(255,255,255,0.9)')}{docBlock('rgba(255,255,255,0.9)')}
      </div>
      {tableBlock()}
    </div>
  );

  if (template === 'minimal') return (
    <div>
      <div style={{ borderTop: '2px solid #1E2A4A', paddingTop: 8, display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        {companyBlock()}{docBlock('#1E2A4A')}
      </div>
      <div style={{ borderBottom: '1px solid #EAE6DB', marginBottom: 6 }} />
      {tableBlock()}
    </div>
  );

  if (template === 'executive') return (
    <div>
      <div style={{ background: '#1E2A4A', borderRadius: 6, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        {companyBlock('rgba(255,255,255,0.9)')}
        <div style={{ textAlign: 'right' }}>
          <div style={{ background: docColor, borderRadius: 3, padding: '2px 8px', display: 'inline-block', marginBottom: 4 }}>
            <div style={{ ...lineStyle, width: 40, background: '#fff', height: 4, marginBottom: 0 }} />
          </div>
          <div style={{ ...shortLine, background: 'rgba(255,255,255,0.4)', marginLeft: 'auto', width: 30 }} />
        </div>
      </div>
      {tableBlock()}
    </div>
  );

  if (template === 'elegant') return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 8 }}>
        <div style={{ width: 3, borderRadius: 2, background: docColor, marginRight: 10, flexShrink: 0 }} />
        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between' }}>
          {companyBlock()}{docBlock()}
        </div>
      </div>
      <div style={{ borderBottom: '2px solid ' + docColor, marginBottom: 6 }} />
      {tableBlock()}
    </div>
  );

  if (template === 'fresh') return (
    <div>
      <div style={{ background: 'linear-gradient(135deg,#E8F5EE,#DCF0E8)', borderRadius: 6, padding: '8px 10px', display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        {companyBlock('#1A4A33')}{docBlock('#1A7A3E')}
      </div>
      {tableBlock()}
    </div>
  );

  // Classic (default)
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        {companyBlock()}{docBlock()}
      </div>
      <div style={{ borderBottom: '1px solid #EAE6DB', marginBottom: 6 }} />
      {tableBlock()}
    </div>
  );
}


// ─── Delete Account Modal ─────────────────────────────────────────────────────


export function sendNotificationEmail(businessInfo, type, vars = {}) {
  const cfg = businessInfo?.emailConfig;
  if (!cfg?.serviceId || !cfg?.templateId || !cfg?.publicKey) return; // not configured yet
  if (!window.emailjs) {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
    s.onload = () => { window.emailjs.init(cfg.publicKey); doSend(); };
    document.head.appendChild(s);
  } else { doSend(); }
  function doSend() {
    const params = {
      company_name: businessInfo.name || 'Operix',
      doc_ref: vars.docRef || '',
      party: vars.party || '',
      submitter: vars.submitter || '',
      customer_email: vars.customerEmail || '',
      approver_email: cfg.approverEmail || businessInfo.email || '',
      type,
    };
    window.emailjs.send(cfg.serviceId, cfg.templateId, params).catch(e => console.warn('Email failed:', e));
  }
}

// ─── Notifications View ───────────────────────────────────────────────────────

