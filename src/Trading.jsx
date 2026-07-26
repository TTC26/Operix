import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertTriangle, BarChart2, Bell, BookOpen, Briefcase, CheckCircle, CheckSquare, ChevronDown, ChevronRight, ClipboardList, Clock, Cloud, CloudOff, Download, Factory, FileMinus, FileSignature, FileText, LayoutDashboard, Layers, LogOut, MapPin, Package, Paperclip, Pencil, Plus, Printer, Search, Settings, Shield, ShoppingCart, Square, Trash2, Truck, Users, Wrench, X } from 'lucide-react';
import { ROLE_MODULES, TEST_EMAILS, PLAN_MODULES, DOC_TYPES, CONVERT_TO, EMPTY_ITEM_ROW, blankDoc, COUNTRY_CONFIG, numToWords, currency, makeFmt, computeTotals, calcModuleTax, computeStock, downloadCSV, filterByRange, loadScript, parseOCRText, styles, TaxSummaryBox, DocPrintOverlay, Modal, LetterpadPrintStyle, sanitizeLHtml, LetterheadHeader, VoucherPrintHeader, VoucherSignatory, ApprovalActions, StatusBadge, DocRow, StatCard, BIZ_BADGE, DocumentsList, ConvertDropdown, PrintModal, DateRangePicker, SpecsFields, DrawingUploader, LockedModuleScreen, TemplateMiniPreview, sendNotificationEmail } from './utils.jsx';

export function printCustomerDetail(c, docs, businessInfo) {
  const biz  = businessInfo || {};
  const cc   = COUNTRY_CONFIG[biz.country || 'india'] || COUNTRY_CONFIG.india;
  const date = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });
  const cDocs = docs.filter(d => d.customerId === c.id);
  const docsHtml = cDocs.length === 0
    ? '<tr><td colspan="4" style="text-align:center;color:#999;padding:10px">No documents on record.</td></tr>'
    : cDocs.map((d, i) => `
        <tr>
          <td>${i+1}</td>
          <td>${d.number || '—'}</td>
          <td>${(d.type || '').replace(/([A-Z])/g,' $1').trim()}</td>
          <td>${d.date || '—'}</td>
          <td style="text-align:right;font-weight:600">${d.status || 'draft'}</td>
        </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Customer Profile — ${c.name}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #1A1A2E; margin: 0; padding: 0; }
  .page { max-width: 740px; margin: 0 auto; padding: 40px 48px; }
  .lh { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1E2A4A; padding-bottom:14px; margin-bottom:24px; }
  .bname { font-size:20px; font-weight:700; color:#1E2A4A; }
  .binfo { font-size:11px; color:#555; line-height:1.6; text-align:right; }
  h2 { font-size:18px; color:#1E2A4A; margin:0 0 16px; }
  .grid { display:grid; grid-template-columns:140px 1fr; gap:8px 12px; margin-bottom:20px; }
  .lbl { color:#6B7494; font-size:12px; }
  .val { font-weight:500; font-size:13px; }
  table { width:100%; border-collapse:collapse; margin-top:8px; font-size:12px; }
  th { background:#1E2A4A; color:#fff; padding:7px 10px; text-align:left; }
  td { border:1px solid #ddd; padding:6px 10px; }
  tr:nth-child(even) td { background:#F8F8F8; }
  .section-title { font-size:12px; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:#C9A24B; border-bottom:1px solid #EAE6DB; padding-bottom:5px; margin:20px 0 10px; }
  @media print { body { -webkit-print-color-adjust:exact; } }
</style></head><body><div class="page">
<div class="lh">
  <div><div class="bname">${biz.name || 'Company'}</div><div style="font-size:11px;color:#555;margin-top:3px">${biz.address || ''}</div></div>
  <div class="binfo">${biz.phone ? 'Tel: '+biz.phone+'<br/>' : ''}${biz.email || ''}</div>
</div>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px">
  <h2>Customer Profile</h2>
  <span style="font-size:11px;color:#6B7494">Printed: ${date}</span>
</div>
<div class="grid">
  <div class="lbl">Customer Name</div><div class="val">${c.name || '—'}</div>
  ${cc.hasTax && c.gstin ? `<div class="lbl">${cc.taxIdLabel}</div><div class="val">${c.gstin}</div>` : ''}
  <div class="lbl">Phone</div><div class="val">${c.phone || '—'}</div>
  <div class="lbl">Email</div><div class="val">${c.email || '—'}</div>
  <div class="lbl">Address</div><div class="val">${c.address || '—'}</div>
  <div class="lbl">${cc.stateLabel || 'State'}</div><div class="val">${c.state || '—'}</div>
</div>
<div class="section-title">Document History (${cDocs.length})</div>
<table>
  <thead><tr><th>#</th><th>Doc No.</th><th>Type</th><th>Date</th><th>Status</th></tr></thead>
  <tbody>${docsHtml}</tbody>
</table>
</div></body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 350);
}


export function printAllCustomers(customers, businessInfo) {
  const biz  = businessInfo || {};
  const cc   = COUNTRY_CONFIG[biz.country || 'india'] || COUNTRY_CONFIG.india;
  const date = new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'long', year:'numeric' });

  const rows = [...customers].sort((a,b) => (a.name||'') > (b.name||'') ? 1 : -1)
    .map((c, i) => `
      <tr>
        <td style="text-align:center">${i+1}</td>
        <td style="font-weight:600">${c.name || '—'}</td>
        ${cc.hasTax ? `<td>${c.gstin || '—'}</td>` : ''}
        <td>${c.phone || '—'}</td>
        <td>${c.email || '—'}</td>
        <td>${c.address || '—'}</td>
        <td>${c.state || '—'}</td>
      </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Customer Directory — ${biz.name || 'Company'}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1A1A2E; margin: 0; padding: 0; }
  .page { padding: 30px 36px; }
  .lh { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1E2A4A; padding-bottom:12px; margin-bottom:20px; }
  .bname { font-size:18px; font-weight:700; color:#1E2A4A; }
  h2 { font-size:15px; color:#1E2A4A; margin:0 0 14px; }
  table { width:100%; border-collapse:collapse; font-size:11.5px; }
  th { background:#1E2A4A; color:#fff; padding:7px 9px; text-align:left; white-space:nowrap; }
  td { border:1px solid #ddd; padding:6px 9px; vertical-align:top; }
  tr:nth-child(even) td { background:#F8F8F8; }
  .footer { margin-top:16px; font-size:10px; color:#999; text-align:right; }
  @media print { body { -webkit-print-color-adjust:exact; } @page { size: A4 landscape; margin: 12mm; } }
</style></head><body><div class="page">
<div class="lh">
  <div><div class="bname">${biz.name || 'Company'}</div><div style="font-size:10px;color:#555;margin-top:2px">${biz.address || ''}</div></div>
  <div style="font-size:11px;color:#555;text-align:right">${biz.phone ? 'Tel: '+biz.phone+'<br/>' : ''}${biz.email || ''}</div>
</div>
<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px">
  <h2>Customer Directory</h2>
  <span style="font-size:10px;color:#6B7494">Total: ${customers.length} · Printed: ${date}</span>
</div>
<table>
  <thead>
    <tr>
      <th style="width:32px">#</th>
      <th>Customer Name</th>
      ${cc.hasTax ? `<th>${cc.taxIdLabel}</th>` : ''}
      <th>Phone</th>
      <th>Email</th>
      <th>Address</th>
      <th>${cc.stateLabel || 'State'}</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">Operix · ${date}</div>
</div></body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 350);
}


export function CustomersList({ customers, setEditing, setCustomers, documents, businessInfo }) {
  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <h1 className="serif" style={styles.h1}>Customers</h1>
          <p style={styles.muted}>Saved customer details auto-fill into new documents.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {customers.length > 0 && (
            <button style={styles.ghostBtn} onClick={() => printAllCustomers(customers, businessInfo)}>
              <Printer size={14} /> Print All
            </button>
          )}
          <button onClick={() => setEditing({ name: '', gstin: '', address: '', state: '', phone: '', email: '' })} style={styles.primaryBtn}>
            <Plus size={15} /> Add Customer
          </button>
        </div>
      </div>
      <div style={{ ...styles.list, marginTop: 0 }}>
        {customers.length === 0 && <div style={styles.emptyBox}>No customers yet. Add one to speed up document creation.</div>}
        {customers.map((c) => {
          const count = documents.filter((d) => d.customerId === c.id).length;
          return (
            <div key={c.id} style={styles.recordRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.docRowTitle}>{c.name}</div>
                <div style={styles.docRowSub}>{c.address}{c.gstin ? ` · ${c.gstin}` : ''}{c.state ? ` · ${c.state}` : ''}{c.phone ? ` · ${c.phone}` : ''}</div>
              </div>
              <div style={styles.muted}>{count} doc{count !== 1 ? 's' : ''}</div>
              <button style={styles.iconBtn} title="Print profile" onClick={() => printCustomerDetail(c, documents, businessInfo)}><Printer size={14} /></button>
              <button onClick={() => setEditing(c)} style={styles.ghostBtn}>Edit</button>
              <button onClick={() => setCustomers((cs) => cs.filter((x) => x.id !== c.id))} style={styles.iconBtn}><Trash2 size={15} color="#B5453A" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export function TaxIdVerifyButton({ taxId, country }) {
  const [status, setStatus] = useState(null); // null | 'valid' | 'invalid' | 'checking'
  function verifyFormat() {
    if (!taxId) { setStatus('invalid'); return; }
    let ok = false;
    if (country === 'india') {
      // GSTIN: 15 chars, format: 2 digits + 5 letters + 4 digits + 1 letter + 1 alphanumeric + Z + 1 alphanumeric
      ok = /^[0-3][0-9][A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(taxId.toUpperCase());
    } else if (country === 'uae') {
      // TRN: exactly 15 digits
      ok = /^[0-9]{15}$/.test(taxId.replace(/\s/g, ''));
    } else {
      ok = taxId.length > 3;
    }
    setStatus(ok ? 'valid' : 'invalid');
  }
  function openPortal() {
    if (country === 'india') window.open('https://services.gst.gov.in/services/searchtp', '_blank');
    else if (country === 'uae') window.open('https://www.tax.gov.ae/en/services/vat.verification.aspx', '_blank');
  }
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
      <button type="button" onClick={verifyFormat} style={{ ...styles.ghostBtn, padding: '4px 10px', fontSize: 12 }}>
        ✓ Validate format
      </button>
      {(country === 'india' || country === 'uae') && (
        <button type="button" onClick={openPortal} style={{ ...styles.ghostBtn, padding: '4px 10px', fontSize: 12, color: '#1A56DB' }}>
          🔗 Verify on portal
        </button>
      )}
      {status === 'valid' && <span style={{ color: '#1A7A3E', fontSize: 12, fontWeight: 600 }}>✓ Format valid</span>}
      {status === 'invalid' && <span style={{ color: '#B5453A', fontSize: 12, fontWeight: 600 }}>✗ Invalid format</span>}
    </div>
  );
}


export function CustomerModal({ customer, onSave, onClose, businessInfo = {} }) {
  const [form, setForm] = useState(customer);
  const country = businessInfo.country || 'india';
  const cc = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.india;
  const stateLabel = cc.stateLabel || 'State';
  const fields = [
    { key: 'name',    label: 'Name' },
    ...(cc.hasTax ? [{ key: 'gstin', label: cc.taxIdLabel, isTax: true }] : []),
    { key: 'address', label: 'Address' },
    { key: 'state',   label: stateLabel },
    { key: 'phone',   label: 'Phone' },
    { key: 'email',   label: 'Email' },
  ];
  return (
    <Modal onClose={onClose} title={customer.id ? 'Edit customer' : 'Add customer'}>
      {fields.map(({ key, label, isTax }) => (
        <div key={key} style={styles.formGroup}>
          <label style={styles.label}>{label}</label>
          <input
            value={form[key] || ''}
            onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
            style={styles.input}
            placeholder={isTax ? cc.taxIdPlaceholder : ''}
          />
          {isTax && <TaxIdVerifyButton taxId={form[key]} country={country} />}
        </div>
      ))}
      <button onClick={() => onSave(form)} style={styles.primaryBtn}>Save customer</button>
    </Modal>
  );
}

// ─── Vendors ───────────────────────────────────────────────────


export function VendorsList({ vendors, setEditing, setVendors, documents }) {
  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h1 className="serif" style={styles.h1}>Vendors</h1>
        <p style={styles.muted}>Saved vendor details auto-fill into purchase orders and bills.</p>
      </div>
      <button onClick={() => setEditing({ name: '', gstin: '', address: '', state: '', phone: '', email: '' })} style={styles.primaryBtn}><Plus size={15} /> Add vendor</button>
      <div style={{ ...styles.list, marginTop: 16 }}>
        {vendors.length === 0 && <div style={styles.emptyBox}>No vendors yet. Add suppliers to speed up purchase orders and bills.</div>}
        {vendors.map((v) => {
          const count = documents.filter((d) => d.customerId === v.id && DOC_TYPES[d.type]?.party === 'vendor').length;
          return (
            <div key={v.id} style={styles.recordRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.docRowTitle}>{v.name}</div>
                <div style={styles.docRowSub}>{v.address}{v.gstin ? ` · ${v.gstin}` : ''} · {v.state}</div>
              </div>
              <div style={styles.muted}>{count} docs</div>
              <button onClick={() => setEditing(v)} style={styles.ghostBtn}>Edit</button>
              <button onClick={() => setVendors((vs) => vs.filter((x) => x.id !== v.id))} style={styles.iconBtn}><Trash2 size={15} color="#B5453A" /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// STOCK TRACKING COMPONENTS
// ─────────────────────────────────────────────


export function VendorModal({ vendor, onSave, onClose, businessInfo = {} }) {
  const [form, setForm] = useState(vendor);
  const country = businessInfo.country || 'india';
  const cc = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.india;
  const stateLabel = cc.stateLabel || 'State';
  const fields = [
    { key: 'name',    label: 'Name' },
    ...(cc.hasTax ? [{ key: 'gstin', label: cc.taxIdLabel, isTax: true }] : []),
    { key: 'address', label: 'Address' },
    { key: 'state',   label: stateLabel },
    { key: 'phone',   label: 'Phone' },
    { key: 'email',   label: 'Email' },
  ];
  return (
    <Modal onClose={onClose} title={vendor.id ? 'Edit vendor' : 'Add vendor'}>
      {fields.map(({ key, label, isTax }) => (
        <div key={key} style={styles.formGroup}>
          <label style={styles.label}>{label}</label>
          <input value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))} style={styles.input} placeholder={isTax ? cc.taxIdPlaceholder : ''} />
          {isTax && <TaxIdVerifyButton taxId={form[key]} country={country} />}
        </div>
      ))}
      <button onClick={() => onSave(form)} style={styles.primaryBtn}>Save vendor</button>
    </Modal>
  );
}

// ─── Items ─────────────────────────────────────────────────────


export const ITEM_CATEGORIES = ['Raw Material','Alloy / Metal','Steel / Iron','Packing Material','Consumable','Spare Part','Finished Good','Semi-Finished','Trading Item','Service','Other'];


export function ItemsList({ items, setEditing, setItems, businessInfo }) {
  const fmt = makeFmt(businessInfo);
  const cc = COUNTRY_CONFIG[businessInfo?.country || 'india'] || COUNTRY_CONFIG.india;
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');
  const filtered = items.filter(it => {
    const matchCat = !catFilter || it.category === catFilter;
    const matchSearch = !search || it.name?.toLowerCase().includes(search.toLowerCase()) || (it.itemCode||'').toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  const cats = [...new Set(items.map(it=>it.category).filter(Boolean))];
  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h1 className="serif" style={styles.h1}>Items & services</h1>
        <p style={styles.muted}>Saved items auto-fill price, HSN/SAC code and tax rate on documents.</p>
      </div>
      <div style={{ display:'flex', gap:10, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
        <button onClick={() => { const cc = COUNTRY_CONFIG[(businessInfo && businessInfo.country)] || COUNTRY_CONFIG.india; setEditing({ name: '', hsn: '', itemCode:'', category:'', purchaseRate: 0, saleRate: 0, gst: businessInfo.taxRate ?? cc.defaultTaxRate }); }} style={styles.primaryBtn}><Plus size={15} /> Add item</button>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name or code…" style={{ ...styles.input, margin:0, width:200, fontSize:13 }} />
        <select value={catFilter} onChange={e=>setCatFilter(e.target.value)} style={{ ...styles.input, margin:0, width:180, fontSize:13 }}>
          <option value=''>All categories</option>
          {ITEM_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize:12, color:'#888' }}>{filtered.length} item{filtered.length!==1?'s':''}</span>
      </div>
      <div style={{ ...styles.list, marginTop: 0 }}>
        {items.length === 0 && <div style={styles.emptyBox}>No items yet. Add products or services to reuse across documents.</div>}
        {items.length > 0 && filtered.length === 0 && <div style={styles.emptyBox}>No items match your filter.</div>}
        {filtered.map((it) => (
          <div key={it.id} style={styles.recordRow}>
            <div style={{ flex: 1 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                {it.itemCode && <span style={{ fontSize:11, fontWeight:700, color:'#fff', background:'#1E2A4A', borderRadius:4, padding:'1px 6px', letterSpacing:0.5 }}>{it.itemCode}</span>}
                <span style={styles.docRowTitle}>{it.name}</span>
                {it.category && <span style={{ fontSize:11, color:'#888', background:'#F0ECE5', borderRadius:4, padding:'1px 6px' }}>{it.category}</span>}
              </div>
              <div style={styles.docRowSub}>{it.unit && <>{it.unit} · </>}{cc.splitTax && <>HSN {it.hsn || '—'} · </>}Tax {it.gst}%</div>
            </div>
            <div style={{ textAlign: 'right', marginRight: 8 }}>
              <div style={{ fontSize: 11, color: '#888780' }}>Buy: <span style={{ color: '#B5453A', fontWeight: 600 }}>{fmt(it.purchaseRate ?? it.rate ?? 0)}</span></div>
              <div style={{ fontSize: 11, color: '#888780' }}>Sell: <span style={{ color: '#1A7A3E', fontWeight: 600 }}>{fmt(it.saleRate ?? it.rate ?? 0)}</span></div>
            </div>
            <button onClick={() => setEditing(it)} style={styles.ghostBtn}>Edit</button>
            <button onClick={() => setItems((is) => is.filter((x) => x.id !== it.id))} style={styles.iconBtn}><Trash2 size={15} color="#B5453A" /></button>
          </div>
        ))}
      </div>
    </div>
  );
}


export function ItemModal({ item, onSave, onClose, businessInfo = {} }) {
  const cc = COUNTRY_CONFIG[businessInfo?.country || 'india'] || COUNTRY_CONFIG.india;
  const [form, setForm] = useState({ openingStock: 0, minStock: 0, unit: '', itemCode: '', category: '', ...item });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <Modal onClose={onClose} title={item.id ? 'Edit item' : 'Add item'}>
      {/* Item code + category */}
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ ...styles.formGroup, flex: 1 }}>
          <label style={styles.label}>Item Code</label>
          <input value={form.itemCode||''} onChange={e => set('itemCode', e.target.value)} style={styles.input} placeholder="e.g. RM-001, ST-002" />
        </div>
        <div style={{ ...styles.formGroup, flex: 1 }}>
          <label style={styles.label}>Category</label>
          <select value={form.category||''} onChange={e=>set('category',e.target.value)} style={styles.input}>
            <option value=''>— Select —</option>
            {ITEM_CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Item / service name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} style={styles.input} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {cc.splitTax && <div style={{ ...styles.formGroup, flex: 1 }}>
          <label style={styles.label}>HSN/SAC code</label>
          <input value={form.hsn} onChange={e => set('hsn', e.target.value)} style={styles.input} />
        </div>}
        <div style={{ ...styles.formGroup, flex: 1 }}>
          <label style={styles.label}>Unit (pcs/kg/m…)</label>
          <input value={form.unit || ''} onChange={e => set('unit', e.target.value)} style={styles.input} placeholder="pcs" />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ ...styles.formGroup, flex: 1 }}>
          <label style={styles.label}>Purchase rate (cost price)</label>
          <input type="number" value={form.purchaseRate ?? form.rate ?? 0} onChange={e => set('purchaseRate', Number(e.target.value))} style={styles.input} placeholder="0.00" />
        </div>
        <div style={{ ...styles.formGroup, flex: 1 }}>
          <label style={styles.label}>Sale rate (selling price)</label>
          <input type="number" value={form.saleRate ?? form.rate ?? 0} onChange={e => set('saleRate', Number(e.target.value))} style={styles.input} placeholder="0.00" />
        </div>
      </div>
      {cc.hasTax && (
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...styles.formGroup, flex: 1 }}>
            <label style={styles.label}>{cc.taxLabel} %</label>
            <input type="number" value={form.gst ?? (businessInfo.taxRate ?? cc.defaultTaxRate)} onChange={e => set('gst', Number(e.target.value))} style={styles.input} />
          </div>
          <div style={{ ...styles.formGroup, flex: 1 }} />
        </div>
      )}
      <div style={{ borderTop: '1px solid #EAE6DB', paddingTop: 14, marginTop: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#C9A24B', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>Stock Settings</div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ ...styles.formGroup, flex: 1 }}>
            <label style={styles.label}>Opening stock (qty)</label>
            <input type="number" value={form.openingStock ?? 0} onChange={e => set('openingStock', Number(e.target.value))} style={styles.input} min="0" />
          </div>
          <div style={{ ...styles.formGroup, flex: 1 }}>
            <label style={styles.label}>Min stock alert (qty)</label>
            <input type="number" value={form.minStock ?? 0} onChange={e => set('minStock', Number(e.target.value))} style={styles.input} min="0" placeholder="0 = no alert" />
          </div>
        </div>
      </div>
      <button onClick={() => onSave(form)} style={styles.primaryBtn}>Save item</button>
    </Modal>
  );
}

// ─── Settings ──────────────────────────────────────────────────


export const PETTY_CATEGORIES = [
  'Office Supplies', 'Travel & Transport', 'Food & Refreshments',
  'Utilities', 'Repairs & Maintenance', 'Postage & Courier',
  'Printing & Stationery', 'Miscellaneous',
];


export function PettyCashList({ pettyCash, setPettyCash, businessInfo, userRole, currentBizType = 'trading', isMultiBiz = false, currentUserName = '' }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [printVoucher, setPrintVoucher] = useState(null);
  const [showStatement, setShowStatement] = useState(false);
  const [editingOB, setEditingOB] = useState(false);
  const [obInput, setObInput] = useState('');
  const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'accounts';
  const cc = COUNTRY_CONFIG[(businessInfo && businessInfo.country)] || COUNTRY_CONFIG.india;
  const fmt = makeFmt(businessInfo);
  const sym = cc.currency;

  // Full entries array — used for save/delete operations
  const allEntries = Array.isArray(pettyCash.entries) ? pettyCash.entries : [];
  // Display: filter by current division in multi-biz mode
  const entries = isMultiBiz ? allEntries.filter(e => (e.bizType || 'trading') === currentBizType) : allEntries;
  // Opening balance: per-division in multi-biz, shared in single-biz
  const openingBalance = isMultiBiz
    ? (pettyCash?.openingBalances?.[currentBizType] ?? 0)
    : (pettyCash?.openingBalance ?? 0);

  const rows = entries.slice().sort((a, b) => (a.date > b.date ? 1 : -1)).map((entry, i, arr) => {
    const prevBal = i === 0 ? openingBalance : arr[i - 1].__balance;
    entry.__balance = prevBal + (entry.credit || 0) - (entry.debit || 0);
    return entry;
  });

  function genVoucherNo() {
    const nums = entries.map(e => parseInt((e.voucherNo || '').replace(/\D/g, '')) || 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return 'PCH-' + String(next).padStart(3, '0');
  }

  function saveEntry(entry) {
    const existing = allEntries.find(e => e.id === entry.id);
    let updated;
    if (existing) {
      updated = allEntries.map(e => e.id === entry.id ? { ...entry, bizType: e.bizType || currentBizType } : e);
    } else {
      updated = [...allEntries, { ...entry, bizType: currentBizType, id: Date.now().toString(), status: 'draft', rejectionNote: '' }];
    }
    setPettyCash({ ...pettyCash, entries: updated });
    setShowForm(false); setEditing(null);
  }

  function updateEntryStatus(id, patch) {
    const fullPatch = patch.status === 'approved'
      ? { ...patch, approvedBy: currentUserName, approvedAt: new Date().toISOString() }
      : patch;
    const updated = allEntries.map(e => e.id === id ? { ...e, ...fullPatch } : e);
    setPettyCash({ ...pettyCash, entries: updated });
  }

  function deleteEntry(id) {
    if (!window.confirm('Delete this entry?')) return;
    setPettyCash({ ...pettyCash, entries: allEntries.filter(e => e.id !== id) });
  }

  function saveOB() {
    const val = parseFloat(obInput) || 0;
    if (isMultiBiz) {
      setPettyCash({ ...pettyCash, openingBalances: { ...(pettyCash.openingBalances || {}), [currentBizType]: val } });
    } else {
      setPettyCash({ ...pettyCash, openingBalance: val });
    }
    setEditingOB(false);
  }

  const balance = rows.length > 0 ? rows[rows.length - 1].__balance : openingBalance;

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>Petty Cash</h2>
          <div style={{ fontSize: 13, color: '#888780' }}>Cash book for small expenses</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ background: balance >= 0 ? '#EEF7F1' : '#FEF2F2', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, color: balance >= 0 ? '#1A7A3E' : '#B91C1C' }}>
            Balance: {fmt(balance)}
          </div>
          <button style={styles.secondaryBtn} onClick={() => setShowStatement(true)}>
            <Printer size={15} />Print / Export
          </button>
          {canEdit && (
            <button style={styles.primaryBtn} onClick={() => { setEditing({ voucherNo: genVoucherNo(), date: new Date().toISOString().split('T')[0], type: 'debit' }); setShowForm(true); }}>
              <Plus size={16} />Add Entry
            </button>
          )}
        </div>
      </div>

      <div style={{ background: '#F5F3EE', borderRadius: 10, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13 }}>
        <span style={{ color: '#888780' }}>Opening Balance:</span>
        {editingOB ? (
          <>
            <input value={obInput} onChange={e => setObInput(e.target.value)} type="number" style={{ ...styles.input, width: 120, padding: '4px 8px' }} />
            <button style={styles.primaryBtn} onClick={saveOB}>Save</button>
            <button style={styles.ghostBtn} onClick={() => setEditingOB(false)}>Cancel</button>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 600, color: '#1E2A4A' }}>{fmt(openingBalance)}</span>
            {canEdit && <button style={{ ...styles.ghostBtn, padding: '3px 10px', fontSize: 12 }} onClick={() => { setObInput(openingBalance); setEditingOB(true); }}>Edit</button>}
          </>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Date', 'Voucher No', 'Category', 'Description', 'Paid To', `Debit (${sym.trim()})`, `Credit (${sym.trim()})`, `Balance (${sym.trim()})`, 'Status', ''].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ ...styles.td, textAlign: 'center', color: '#888780', padding: 28 }}>No entries yet. Add your first petty cash entry.</td></tr>
            )}
            {rows.map(entry => (
              <tr key={entry.id}>
                <td style={styles.td}>{entry.date}</td>
                <td style={styles.td}><span style={{ fontFamily: 'monospace', fontSize: 12, color: '#C9A24B' }}>{entry.voucherNo}</span></td>
                <td style={styles.td}>{entry.category}</td>
                <td style={styles.td}>{entry.description}</td>
                <td style={styles.td}>{entry.paidTo}</td>
                <td style={{ ...styles.td, color: '#B91C1C', fontWeight: 500 }}>{entry.debit ? fmt(entry.debit) : '—'}</td>
                <td style={{ ...styles.td, color: '#1A7A3E', fontWeight: 500 }}>{entry.credit ? fmt(entry.credit) : '—'}</td>
                <td style={{ ...styles.td, fontWeight: 600, color: entry.__balance >= 0 ? '#1E2A4A' : '#B91C1C' }}>{fmt(entry.__balance)}</td>
                <td style={styles.td}>
                  <StatusBadge status={entry.status || 'draft'} />
                  <ApprovalActions item={entry} onUpdate={(patch) => updateEntryStatus(entry.id, patch)} userRole={userRole} compact />
                </td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={styles.iconBtn} onClick={() => setPrintVoucher(entry)} title="Print"><Printer size={14} /></button>
                    {canEdit && entry.status !== 'submitted' && <button style={styles.iconBtn} onClick={() => { setEditing(entry); setShowForm(true); }}>✏️</button>}
                    {canEdit && entry.status !== 'submitted' && <button style={{ ...styles.iconBtn, color: '#E08A7D' }} onClick={() => deleteEntry(entry.id)}><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <PettyCashForm entry={editing} onSave={saveEntry} onClose={() => { setShowForm(false); setEditing(null); }} currentUserName={currentUserName} />
      )}
      {printVoucher && (
        <PettyCashVoucherPrint entry={printVoucher} businessInfo={businessInfo} onClose={() => setPrintVoucher(null)} />
      )}
      {showStatement && (
        <StatementPanel rows={rows} openingBalance={openingBalance} businessInfo={businessInfo} onClose={() => setShowStatement(false)} />
      )}
    </div>
  );
}


export function PettyCashForm({ entry, onSave, onClose, currentUserName = '' }) {
  const [form, setForm] = useState({
    id: entry && entry.id ? entry.id : '',
    voucherNo: entry && entry.voucherNo ? entry.voucherNo : '',
    date: entry && entry.date ? entry.date : new Date().toISOString().split('T')[0],
    category: entry && entry.category ? entry.category : PETTY_CATEGORIES[0],
    description: entry && entry.description ? entry.description : '',
    paidTo: entry && entry.paidTo ? entry.paidTo : '',
    type: entry && entry.type ? entry.type : 'debit',
    debit: entry && entry.debit ? entry.debit : '',
    credit: entry && entry.credit ? entry.credit : '',
    mode: entry && entry.mode ? entry.mode : 'Cash',
    remarks: entry && entry.remarks ? entry.remarks : '',
    receivedBy: entry && entry.receivedBy ? entry.receivedBy : (!entry ? currentUserName : ''),
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleSave() {
    if (!form.date || !form.description) { alert('Date and description are required.'); return; }
    const amt = parseFloat(form.type === 'debit' ? form.debit : form.credit) || 0;
    if (!amt) { alert('Enter an amount.'); return; }
    const saved = { ...form, debit: form.type === 'debit' ? amt : 0, credit: form.type === 'credit' ? amt : 0 };
    onSave(saved);
  }

  return (
    <Modal title={form.id ? 'Edit Entry' : 'New Petty Cash Entry'} onClose={onClose} wide>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Voucher No</label>
          <input value={form.voucherNo} onChange={e => set('voucherNo', e.target.value)} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)} style={styles.input}>
            <option value="debit">Expense (Debit)</option>
            <option value="credit">Cash Received (Credit)</option>
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Category</label>
          <select value={form.category} onChange={e => set('category', e.target.value)} style={styles.input}>
            {PETTY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
          <label style={styles.label}>Description</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} style={styles.input} placeholder="What was this for?" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Paid To / Received From</label>
          <input value={form.paidTo} onChange={e => set('paidTo', e.target.value)} style={styles.input} placeholder="Name" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Amount</label>
          <input type="number" value={form.type === 'debit' ? form.debit : form.credit}
            onChange={e => form.type === 'debit' ? set('debit', e.target.value) : set('credit', e.target.value)}
            style={styles.input} placeholder="0.00" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Payment Mode</label>
          <select value={form.mode} onChange={e => set('mode', e.target.value)} style={styles.input}>
            {['Cash', 'Cheque', 'NEFT', 'UPI', 'Other'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Remarks</label>
          <input value={form.remarks} onChange={e => set('remarks', e.target.value)} style={styles.input} placeholder="Optional" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Received By</label>
          <input value={form.receivedBy} onChange={e => set('receivedBy', e.target.value)} style={styles.input} placeholder="Name of person receiving cash" />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={handleSave}>Save Entry</button>
      </div>
    </Modal>
  );
}


export function StatementPanel({ rows, openingBalance, businessInfo, onClose }) {
  const [useLH, setUseLH] = React.useState(!!(businessInfo?.letterhead||businessInfo?.letterheadHtml));
  // Build running balance
  let balance = parseFloat(openingBalance) || 0;
  const ledger = (rows || []).map(e => {
    const debit  = parseFloat(e.debit)  || 0;
    const credit = parseFloat(e.credit) || 0;
    balance = balance - debit + credit;
    return { ...e, debit, credit, runningBalance: balance };
  });
  const fmtStmt = (n) => makeFmt(businessInfo)(Math.abs(n));

  return (
    <div>
      <div className="no-print" onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 998 }} />
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 24, zIndex: 1001, display: 'flex', gap: 8 }}>
        <button style={styles.ghostBtn} onClick={onClose}><X size={15} /> Close</button>
        {(businessInfo?.letterhead||businessInfo?.letterheadHtml) && <button onClick={() => setUseLH(v=>!v)} style={{ ...styles.ghostBtn, ...(useLH?{background:'#EEF2FF',color:'#3D52A0',fontWeight:600}:{}) }}>📃 {useLH?'Letterhead ON':'Use Letterhead'}</button>}
        <button style={styles.ghostBtn} onClick={() => downloadDocPDF('.print-area','petty-cash-statement.pdf')}><Download size={15}/> PDF</button>
        <button style={styles.primaryBtn} onClick={() => window.print()}><Printer size={15} /> Print</button>
      </div>
      <div className="print-area" style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 999, overflowY: 'auto', padding: '40px 56px' }}>
        {useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml || businessInfo?.letterheadFooter) && <LetterpadPrintStyle />}
        {useLH && <LetterheadHeader bi={businessInfo} />}
        {/* Header */}
        <div style={{ borderBottom: '2px solid #1E2A4A', paddingBottom: 12, marginBottom: 20, display: 'flex', justifyContent: useLH ? 'center' : 'space-between', alignItems: 'flex-start' }}>
          {!useLH && <div>
            <div className="serif" style={{ fontSize: 20, fontWeight: 700, color: '#1E2A4A' }}>{businessInfo.name}</div>
            <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>{businessInfo.address}</div>
          </div>}
          <div style={{ textAlign: useLH ? 'center' : 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#C9A24B', letterSpacing: '0.05em' }}>PETTY CASH STATEMENT</div>
            <div style={{ fontSize: 11, color: '#888780', marginTop: 3 }}>Printed: {new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </div>
        {/* Opening balance */}
        <div style={{ fontSize: 13, marginBottom: 14, color: '#555' }}>
          Opening Balance: <strong style={{ color: '#1E2A4A' }}>{fmtStmt(openingBalance)}</strong>
        </div>
        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#F8F5EE' }}>
              {['Date','Voucher No','Description','Category','Paid To','Debit','Credit','Balance'].map(h => (
                <th key={h} style={{ padding: '7px 10px', textAlign: h === 'Date' || h === 'Voucher No' || h === 'Description' || h === 'Category' || h === 'Paid To' ? 'left' : 'right', fontWeight: 600, color: '#1E2A4A', borderBottom: '1px solid #EAE6DB', fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ledger.map((e, i) => (
              <tr key={e.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF7' }}>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0EDE5', color: '#555' }}>{e.date}</td>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0EDE5', color: '#555' }}>{e.voucherNo}</td>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0EDE5', color: '#1E2A4A' }}>{e.description}</td>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0EDE5', color: '#555' }}>{e.category}</td>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0EDE5', color: '#555' }}>{e.paidTo}</td>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0EDE5', textAlign: 'right', color: e.debit ? '#B91C1C' : '#ccc' }}>{e.debit ? fmtStmt(e.debit) : '—'}</td>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0EDE5', textAlign: 'right', color: e.credit ? '#1A7A3E' : '#ccc' }}>{e.credit ? fmtStmt(e.credit) : '—'}</td>
                <td style={{ padding: '6px 10px', borderBottom: '1px solid #F0EDE5', textAlign: 'right', fontWeight: 600, color: e.runningBalance >= 0 ? '#1E2A4A' : '#B91C1C' }}>{fmtStmt(e.runningBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Closing balance */}
        <div style={{ marginTop: 20, textAlign: 'right', fontSize: 14, fontWeight: 700, color: '#1E2A4A', borderTop: '2px solid #1E2A4A', paddingTop: 10 }}>
          Closing Balance: {fmtStmt(ledger.length ? ledger[ledger.length - 1].runningBalance : openingBalance)}
        </div>
        {useLH && businessInfo?.letterheadFooter && (
          <div className="lh-pad-footer" style={{ background: '#fff' }}>
            <img src={businessInfo.letterheadFooter} alt="letterhead footer" style={{ width:'100%', display:'block' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Single Voucher Print ────────────────────────────────────────────────────


export function PettyCashVoucherPrint({ entry, businessInfo, onClose }) {
  const voucherRef = React.useRef(null);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,20,40,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Header toolbar — hidden during print */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '10px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#1E2A4A' }} className="no-print">
        <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>Petty Cash Voucher</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => window.print()} style={{ ...styles.ghostBtn, background: 'none', color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: 13 }}><Printer size={14}/> Print</button>
          <button onClick={() => downloadDocPDF('.petty-voucher-print', `petty-voucher-${entry.voucherNo || ''}.pdf`)} style={{ ...styles.ghostBtn, background: 'none', color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: 13 }}><Download size={14}/> PDF</button>
          <button onClick={onClose} style={{ ...styles.ghostBtn, background: 'none', color: '#fff', borderColor: 'rgba(255,255,255,0.3)', fontSize: 13 }}><X size={14}/></button>
        </div>
      </div>
      {/* Voucher content — shown in print mode */}
      <div className="print-area petty-voucher-print" ref={voucherRef} style={{ background: '#fff', borderRadius: 8, width: 480, padding: 28, marginTop: 52, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ borderBottom: '2px solid #1E2A4A', paddingBottom: 12, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: '#1E2A4A' }}>{businessInfo.name}</div>
            <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>{businessInfo.address}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#C9A24B', letterSpacing: '0.05em' }}>PETTY CASH VOUCHER</div>
            <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>No: <strong>{entry.voucherNo}</strong></div>
          </div>
        </div>
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 16 }}>
          <tbody>
            {[
              ['Date', entry.date],
              ['Category', entry.category],
              ['Description', entry.description],
              [entry.debit > 0 ? 'Paid To' : 'Received From', entry.paidTo],
              ['Payment Mode', entry.mode],
              ['Amount', makeFmt(businessInfo)(entry.debit || entry.credit || 0)],
              ['Type', entry.debit > 0 ? 'Expense (Debit)' : 'Cash Received (Credit)'],
              ...(entry.remarks ? [['Remarks', entry.remarks]] : []),
            ].map(([label, val]) => (
              <tr key={label}>
                <td style={{ padding: '6px 0', color: '#888780', width: '35%', fontWeight: 500 }}>{label}</td>
                <td style={{ padding: '6px 0', color: '#1E2A4A', fontWeight: label === 'Amount' ? 700 : 400, fontSize: label === 'Amount' ? 15 : 13 }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32, borderTop: '1px solid #EAE6DB', paddingTop: 20 }}>
          <div style={{ textAlign: 'center' }}>
            {entry.receivedBy && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1E2A4A', marginBottom: 4 }}>{entry.receivedBy}</div>
            )}
            <div style={{ borderTop: '1px solid #555', paddingTop: 6, fontSize: 11, color: '#888780', marginTop: entry.receivedBy ? 4 : 32 }}>Received By</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            {entry.approvedBy && (
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1E2A4A', marginBottom: 4 }}>{entry.approvedBy}</div>
            )}
            <div style={{ borderTop: '1px solid #555', paddingTop: 6, fontSize: 11, color: '#888780', marginTop: entry.approvedBy ? 4 : 32 }}>Approved By</div>
            {entry.approvedAt && (
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>{new Date(entry.approvedAt).toLocaleDateString()}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Vouchers ──────────────────────────────────────────────────


export const VOUCHER_ACCOUNT_HEADS = [
  'Cash', 'Bank', 'Petty Cash',
  'Accounts Payable', 'Accounts Receivable',
  'Sales', 'Purchase', 'Expenses',
  'Salaries & Wages', 'Rent', 'Utilities',
  'Office Supplies', 'Travel & Transport',
  'Professional Fees', 'Loan', 'Capital', 'Other',
];


export function VoucherList({ vouchers, setVouchers, businessInfo, customers, vendors, documents = [], userRole, currentBizType = 'trading', isMultiBiz = false }) {
  const [tab, setTab] = useState('payment');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [printVoucher, setPrintVoucher] = useState(null);
  const [partyFilter, setPartyFilter] = useState('');
  const [statementParty, setStatementParty] = useState(null);
  const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'accounts';

  // Full list — used for save/delete so all division data is preserved
  const list = Array.isArray(vouchers) ? vouchers : [];
  // Display list — filtered by current division in multi-biz mode
  const displayList = isMultiBiz ? list.filter(v => (v.bizType || 'trading') === currentBizType) : list;
  const allParties = [...new Set(displayList.map(v => v.party).filter(Boolean))].sort();
  const filtered = displayList
    .filter(v => v.type === tab)
    .filter(v => !partyFilter || v.party === partyFilter)
    .sort((a, b) => (a.date > b.date ? -1 : 1));

  function genVoucherNo(type) {
    const prefix = type === 'payment' ? 'PV' : 'RV';
    const nums = displayList.filter(v => v.type === type).map(v => parseInt((v.voucherNo || '').replace(/\D/g, '')) || 0);
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return prefix + '-' + String(next).padStart(3, '0');
  }

  function saveVoucher(v) {
    const existing = list.find(x => x.id === v.id);
    let updated;
    if (existing) { updated = list.map(x => x.id === v.id ? v : x); }
    else { updated = [...list, { ...v, bizType: currentBizType, id: Date.now().toString(), status: 'draft', rejectionNote: '' }]; }
    setVouchers(updated);
    setShowForm(false); setEditing(null);
  }

  function updateVoucherStatus(id, patch) {
    setVouchers(list.map(x => x.id === id ? { ...x, ...patch } : x));
  }

  function deleteVoucher(id) {
    if (!window.confirm('Delete this voucher?')) return;
    setVouchers(list.filter(v => v.id !== id));
  }

  const totalAmount = filtered.reduce((sum, v) => sum + (parseFloat(v.amount) || 0), 0);
  const fmt = makeFmt(businessInfo);

  const tabStyle = (t) => ({
    padding: '8px 20px', border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 13.5,
    borderBottom: tab === t ? '2px solid #1E2A4A' : '2px solid transparent',
    color: tab === t ? '#1E2A4A' : '#888780', background: 'none',
  });

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>Payment & Receipt Vouchers</h2>
          <div style={{ fontSize: 13, color: '#888780' }}>Track all payments and receipts</div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={styles.ghostBtn} onClick={() => { setEditing({ type: 'receipt', voucherNo: genVoucherNo('receipt'), date: new Date().toISOString().split('T')[0] }); setTab('receipt'); setShowForm(true); }}>
              <Plus size={15} />Receipt Voucher
            </button>
            <button style={styles.primaryBtn} onClick={() => { setEditing({ type: 'payment', voucherNo: genVoucherNo('payment'), date: new Date().toISOString().split('T')[0] }); setTab('payment'); setShowForm(true); }}>
              <Plus size={15} />Payment Voucher
            </button>
          </div>
        )}
      </div>

      {/* Tabs + party filter row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #EAE6DB', marginBottom: 16 }}>
        <div style={{ display: 'flex' }}>
          <button style={tabStyle('payment')} onClick={() => setTab('payment')}>Payment Vouchers</button>
          <button style={tabStyle('receipt')} onClick={() => setTab('receipt')}>Receipt Vouchers</button>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 4 }}>
          <select
            value={partyFilter}
            onChange={e => setPartyFilter(e.target.value)}
            style={{ ...styles.input, fontSize: 12.5, padding: '5px 10px', minWidth: 160 }}>
            <option value="">All parties</option>
            {allParties.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          {partyFilter && (
            <button
              style={{ ...styles.ghostBtn, fontSize: 12.5, padding: '5px 12px' }}
              onClick={() => setStatementParty(partyFilter)}
              title="Print party statement">
              <Printer size={13} /> Statement
            </button>
          )}
          {partyFilter && (
            <button style={styles.iconBtn} onClick={() => setPartyFilter('')} title="Clear filter"><X size={13} /></button>
          )}
        </div>
      </div>

      {filtered.length > 0 && (
        <div style={{ background: tab === 'payment' ? '#FEF2F2' : '#EEF7F1', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: 13, fontWeight: 600, color: tab === 'payment' ? '#B91C1C' : '#1A7A3E', display: 'inline-block' }}>
          Total {tab === 'payment' ? 'Payments' : 'Receipts'}{partyFilter ? ` · ${partyFilter}` : ''}: {fmt(totalAmount)}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead>
            <tr>
              {['Date', 'Voucher No', 'Party', 'Account Head', 'Mode', 'Amount', 'Narration', 'Status', ''].map(h => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} style={{ ...styles.td, textAlign: 'center', color: '#888780', padding: 28 }}>No {tab} vouchers yet.</td></tr>
            )}
            {filtered.map(v => (
              <tr key={v.id}>
                <td style={styles.td}>{v.date}</td>
                <td style={styles.td}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#C9A24B' }}>{v.voucherNo}</span>
                  {v.voucherSubtype === 'nonorder' && (
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 600, color: '#888', background: '#F0F0F0', borderRadius: 3, padding: '1px 5px' }}>NON-ORDER</span>
                  )}
                  {v.linkedDocNo && (
                    <div style={{ fontSize: 10.5, color: '#666', marginTop: 2 }}>→ {v.linkedDocNo}</div>
                  )}
                </td>
                <td style={styles.td}>{v.party}</td>
                <td style={styles.td}>{v.accountHead}</td>
                <td style={styles.td}><span style={{ background: '#F5F3EE', borderRadius: 4, padding: '2px 7px', fontSize: 11.5 }}>{v.mode}</span></td>
                <td style={{ ...styles.td, fontWeight: 600, color: tab === 'payment' ? '#B91C1C' : '#1A7A3E' }}>{fmt(parseFloat(v.amount || 0))}</td>
                <td style={{ ...styles.td, color: '#888780', maxWidth: 180 }}>{v.narration}</td>
                <td style={styles.td}>
                  <StatusBadge status={v.status || 'draft'} />
                  <ApprovalActions item={v} onUpdate={(patch) => updateVoucherStatus(v.id, patch)} userRole={userRole} compact />
                </td>
                <td style={styles.td}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button style={styles.iconBtn} onClick={() => setPrintVoucher(v)} title="Print"><Printer size={14} /></button>
                    {canEdit && v.status !== 'submitted' && <button style={styles.iconBtn} onClick={() => { setEditing(v); setShowForm(true); }}>✏️</button>}
                    {canEdit && v.status !== 'submitted' && <button style={{ ...styles.iconBtn, color: '#E08A7D' }} onClick={() => deleteVoucher(v.id)}><Trash2 size={14} /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <VoucherForm voucher={editing} customers={customers} vendors={vendors} documents={documents} onSave={saveVoucher} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
      {printVoucher && (
        <VoucherPrintModal voucher={printVoucher} businessInfo={businessInfo} onClose={() => setPrintVoucher(null)} />
      )}
      {statementParty && (
        <PartyStatementModal party={statementParty} vouchers={list} businessInfo={businessInfo} onClose={() => setStatementParty(null)} />
      )}
    </div>
  );
}


export function VoucherForm({ voucher, customers, vendors, documents = [], onSave, onClose }) {
  const [form, setForm] = useState({
    id:           voucher?.id || '',
    type:         voucher?.type || 'payment',
    voucherSubtype: voucher?.voucherSubtype || 'order', // 'order' | 'nonorder'
    linkedDocNo:  voucher?.linkedDocNo || '',
    voucherNo:    voucher?.voucherNo || '',
    date:         voucher?.date || new Date().toISOString().split('T')[0],
    party:        voucher?.party || '',
    accountHead:  voucher?.accountHead || 'Cash',
    amount:       voucher?.amount || '',
    mode:         voucher?.mode || 'Cash',
    refNo:        voucher?.refNo || '',
    narration:    voucher?.narration || '',
  });
  const [linkError, setLinkError] = useState('');

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); if (k === 'linkedDocNo') setLinkError(''); }

  const parties = [...customers.map(c => c.name), ...vendors.map(v => v.name)];

  // Invoices / POs available for linking (receipt → invoices; payment → purchase bills)
  const linkableDocs = documents.filter(d =>
    form.type === 'receipt'
      ? d.type === 'invoice'
      : d.type === 'purchasebill' || d.type === 'purchaseorder'
  );
  const linkableNos = [...new Set(linkableDocs.map(d => d.number || d.docNumber || d.id).filter(Boolean))];

  function validateLink() {
    if (form.voucherSubtype !== 'order' || !form.linkedDocNo.trim()) {
      setLinkError('');
      return true;
    }
    const linked = linkableDocs.find(d =>
      (d.number || d.docNumber || d.id) === form.linkedDocNo.trim()
    );
    if (!linked) {
      setLinkError('Document not found. Check the invoice/PO number.');
      return false;
    }
    if (linked.status !== 'approved') {
      const label = form.type === 'receipt' ? 'Invoice' : 'Purchase bill / PO';
      setLinkError(`${label} "${form.linkedDocNo}" is not approved yet. Only approved documents can be linked to a voucher.`);
      return false;
    }
    setLinkError('');
    return true;
  }

  function handleSave() {
    if (!form.date || !form.amount || !form.party) { alert('Date, party and amount are required.'); return; }
    if (form.voucherSubtype === 'order' && form.linkedDocNo.trim() && !validateLink()) return;
    onSave({ ...form, amount: parseFloat(form.amount) || 0 });
  }

  const isReceipt = form.type === 'receipt';

  return (
    <Modal title={(isReceipt ? 'Receipt' : 'Payment') + ' Voucher'} onClose={onClose} wide>
      {/* Order vs Non-order toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, background: '#F5F3EE', borderRadius: 8, padding: 4 }}>
        <button
          type="button"
          onClick={() => set('voucherSubtype', 'order')}
          style={{ flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            background: form.voucherSubtype === 'order' ? '#1E2A4A' : 'transparent',
            color: form.voucherSubtype === 'order' ? '#fff' : '#888' }}>
          {isReceipt ? '📄 Against Invoice / PO' : '📄 Against Purchase Bill / PO'}
        </button>
        <button
          type="button"
          onClick={() => { set('voucherSubtype', 'nonorder'); set('linkedDocNo', ''); setLinkError(''); }}
          style={{ flex: 1, padding: '7px 0', border: 'none', borderRadius: 6, fontWeight: 600, fontSize: 13, cursor: 'pointer',
            background: form.voucherSubtype === 'nonorder' ? '#1E2A4A' : 'transparent',
            color: form.voucherSubtype === 'nonorder' ? '#fff' : '#888' }}>
          {isReceipt ? '💵 Non-order Receipt' : '💵 Non-order Payment'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Type</label>
          <select value={form.type} onChange={e => set('type', e.target.value)} style={styles.input}>
            <option value="payment">Payment</option>
            <option value="receipt">Receipt</option>
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Voucher No</label>
          <input value={form.voucherNo} onChange={e => set('voucherNo', e.target.value)} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Party Name</label>
          <input list="voucher-party-list" value={form.party} onChange={e => set('party', e.target.value)} style={styles.input} placeholder="Customer / Vendor / Name" />
          <datalist id="voucher-party-list">{parties.map(p => <option key={p} value={p} />)}</datalist>
        </div>

        {/* Order-linked doc number field — only shown for 'order' subtype */}
        {form.voucherSubtype === 'order' && (
          <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
            <label style={styles.label}>{isReceipt ? 'Invoice No / PO No' : 'Purchase Bill No / PO No'} <span style={{ color: '#B91C1C' }}>*</span></label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input
                  list="voucher-doc-list"
                  value={form.linkedDocNo}
                  onChange={e => set('linkedDocNo', e.target.value)}
                  onBlur={validateLink}
                  style={{ ...styles.input, borderColor: linkError ? '#B91C1C' : undefined }}
                  placeholder={isReceipt ? 'e.g. INV-001' : 'e.g. PB-001 / PO-001'}
                />
                <datalist id="voucher-doc-list">{linkableNos.map(n => <option key={n} value={n} />)}</datalist>
                {linkError && (
                  <div style={{ marginTop: 6, fontSize: 12, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={13} /> {linkError}
                  </div>
                )}
                {!linkError && form.linkedDocNo.trim() && (() => {
                  const linked = linkableDocs.find(d => (d.number || d.docNumber || d.id) === form.linkedDocNo.trim());
                  if (linked?.status === 'approved') return (
                    <div style={{ marginTop: 6, fontSize: 12, color: '#1A7A3E', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle size={13} /> Approved — voucher can proceed
                    </div>
                  );
                  return null;
                })()}
              </div>
            </div>
          </div>
        )}

        <div style={styles.formGroup}>
          <label style={styles.label}>Account Head</label>
          <select value={form.accountHead} onChange={e => set('accountHead', e.target.value)} style={styles.input}>
            {VOUCHER_ACCOUNT_HEADS.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Amount</label>
          <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} style={styles.input} placeholder="0.00" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Payment Mode</label>
          <select value={form.mode} onChange={e => set('mode', e.target.value)} style={styles.input}>
            {['Cash', 'Cheque', 'NEFT', 'RTGS', 'UPI', 'Other'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Reference / Cheque No</label>
          <input value={form.refNo} onChange={e => set('refNo', e.target.value)} style={styles.input} placeholder="Optional" />
        </div>
        <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
          <label style={styles.label}>Narration</label>
          <textarea value={form.narration} onChange={e => set('narration', e.target.value)} style={{ ...styles.input, minHeight: 60, resize: 'vertical' }} placeholder="Being payment / receipt for..." />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={handleSave}>Save Voucher</button>
      </div>
    </Modal>
  );
}

// Injects CSS so letterpad header/footer are fixed on every printed page

export function VoucherPrintModal({ voucher, businessInfo, onClose }) {
  const [useLH, setUseLH] = React.useState(!!(businessInfo?.letterhead||businessInfo?.letterheadHtml));
  const isPayment = voucher.type === 'payment';
  const cc = COUNTRY_CONFIG[businessInfo.country || 'india'];
  const fmt = (n) => currency(n, cc.currency);
  const details = [
    ['Account Head', voucher.accountHead],
    ['Payment Mode', voucher.mode],
    ...(voucher.refNo ? [['Reference / Cheque No', voucher.refNo]] : []),
    ...(voucher.narration ? [['Narration', voucher.narration]] : []),
  ];

  return (
    <div>
      {/* Backdrop */}
      <div className="no-print" onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 998 }} />
      {/* Controls */}
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 24, zIndex: 1001, display: 'flex', gap: 8 }}>
        <button style={styles.ghostBtn} onClick={onClose}><X size={15} /> Close</button>
        {(businessInfo?.letterhead||businessInfo?.letterheadHtml) && <button onClick={() => setUseLH(v=>!v)} style={{ ...styles.ghostBtn, ...(useLH?{background:'#EEF2FF',color:'#3D52A0',fontWeight:600}:{}) }}>📃 {useLH?'Letterhead ON':'Use Letterhead'}</button>}
        <button style={styles.ghostBtn} onClick={() => downloadDocPDF('.print-area','voucher.pdf')}><Download size={15}/> PDF</button>
        <button style={styles.primaryBtn} onClick={() => window.print()}><Printer size={15}/> Print / PDF</button>
      </div>
      {/* Print area — only this shows on print */}
      <div className="print-area" style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 999, overflowY: 'auto', padding: '40px 56px' }}>
        <VoucherPrintHeader businessInfo={businessInfo} useLH={useLH} />
        {/* Title */}
        <div style={{ textAlign: 'right', marginBottom: 20 }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: isPayment ? '#B91C1C' : '#1A7A3E', letterSpacing: '0.07em' }}>
            {isPayment ? 'PAYMENT VOUCHER' : 'RECEIPT VOUCHER'}
          </div>
          <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>No: <strong>{voucher.voucherNo}</strong> &nbsp;·&nbsp; Date: <strong>{voucher.date}</strong></div>
        </div>
        {/* Party */}
        <div style={{ background: '#F8F5EE', borderRadius: 8, padding: '12px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: '#888780', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>{isPayment ? 'Paid To' : 'Received From'}</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1E2A4A' }}>{voucher.party}</div>
        </div>
        {/* Detail rows */}
        <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse', marginBottom: 20 }}>
          <tbody>
            {details.map(([label, val]) => (
              <tr key={label}>
                <td style={{ padding: '8px 0', color: '#888780', width: '36%', fontWeight: 500, borderBottom: '1px solid #F0EDE5' }}>{label}</td>
                <td style={{ padding: '8px 0', color: '#1E2A4A', borderBottom: '1px solid #F0EDE5' }}>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* Amount */}
        <div style={{ background: isPayment ? '#FEF2F2' : '#EEF7F1', borderRadius: 8, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 14, color: isPayment ? '#B91C1C' : '#1A7A3E', fontWeight: 600 }}>Amount {isPayment ? 'Paid' : 'Received'}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: isPayment ? '#B91C1C' : '#1A7A3E' }}>{fmt(voucher.amount || 0)}</div>
        </div>
        <VoucherSignatory businessInfo={businessInfo} leftLabel={isPayment ? 'Paid By' : 'Received By'} />
        {/* Bank details */}
        {(businessInfo.bankName || businessInfo.bankAccount) && (
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px dashed #EAE6DB', fontSize: 11, color: '#888780' }}>
            <strong style={{ color: '#555' }}>Bank: </strong>
            {businessInfo.bankName && <span>{businessInfo.bankName} </span>}
            {businessInfo.bankAccount && <span>· A/C: {businessInfo.bankAccount} </span>}
            {businessInfo.ifsc && <span>· IFSC: {businessInfo.ifsc}</span>}
          </div>
        )}
      </div>
    </div>
  );
}


export function PartyStatementModal({ party, vouchers, businessInfo, onClose }) {
  const [useLH, setUseLH] = React.useState(!!(businessInfo?.letterhead||businessInfo?.letterheadHtml));
  const cc = COUNTRY_CONFIG[businessInfo.country || 'india'];
  const fmt = (n) => currency(n, cc.currency);
  const partyVouchers = vouchers.filter(v => v.party === party).sort((a, b) => a.date > b.date ? 1 : -1);
  const totalPaid = partyVouchers.filter(v => v.type === 'payment').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
  const totalReceived = partyVouchers.filter(v => v.type === 'receipt').reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);

  return (
    <div>
      <div className="no-print" onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 998 }} />
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 24, zIndex: 1001, display: 'flex', gap: 8 }}>
        <button style={styles.ghostBtn} onClick={onClose}><X size={15} /> Close</button>
        {(businessInfo?.letterhead||businessInfo?.letterheadHtml) && <button onClick={() => setUseLH(v=>!v)} style={{ ...styles.ghostBtn, ...(useLH?{background:'#EEF2FF',color:'#3D52A0',fontWeight:600}:{}) }}>📃 {useLH?'Letterhead ON':'Use Letterhead'}</button>}
        <button style={styles.ghostBtn} onClick={() => downloadDocPDF('.print-area','statement.pdf')}><Download size={15}/> PDF</button>
        <button style={styles.primaryBtn} onClick={() => window.print()}><Printer size={15} /> Print</button>
      </div>
      <div className="print-area" style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 999, overflowY: 'auto', padding: '40px 56px' }}>
        <VoucherPrintHeader businessInfo={businessInfo} useLH={useLH} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 10, color: '#888780', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>Party Statement</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1E2A4A' }}>{party}</div>
          </div>
          <div style={{ fontSize: 11, color: '#888780' }}>Printed: {new Date().toLocaleDateString('en-IN')}</div>
        </div>
        <table style={{ width: '100%', fontSize: 12.5, borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr style={{ background: '#F5F3EE' }}>
              {['Date', 'Voucher No', 'Type', 'Account Head', 'Mode', 'Narration', 'Amount'].map(h => (
                <th key={h} style={{ ...styles.th, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {partyVouchers.map(v => {
              const isP = v.type === 'payment';
              return (
                <tr key={v.id}>
                  <td style={styles.td}>{v.date}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11, color: '#C9A24B' }}>{v.voucherNo}</td>
                  <td style={styles.td}><span style={{ fontSize: 10, fontWeight: 600, color: isP ? '#B91C1C' : '#1A7A3E', background: isP ? '#FEF2F2' : '#EEF7F1', borderRadius: 3, padding: '1px 6px' }}>{isP ? 'PAYMENT' : 'RECEIPT'}</span></td>
                  <td style={styles.td}>{v.accountHead}</td>
                  <td style={styles.td}>{v.mode}</td>
                  <td style={{ ...styles.td, color: '#888780', maxWidth: 140 }}>{v.narration}</td>
                  <td style={{ ...styles.td, fontWeight: 600, textAlign: 'right', color: isP ? '#B91C1C' : '#1A7A3E' }}>{fmt(v.amount || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, marginBottom: 32 }}>
          {totalPaid > 0 && <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#888780' }}>Total Paid</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#B91C1C' }}>{fmt(totalPaid)}</div>
          </div>}
          {totalReceived > 0 && <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: '#888780' }}>Total Received</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#1A7A3E' }}>{fmt(totalReceived)}</div>
          </div>}
          <div style={{ textAlign: 'right', borderLeft: '2px solid #EAE6DB', paddingLeft: 24 }}>
            <div style={{ fontSize: 11, color: '#888780' }}>Net Balance</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#1E2A4A' }}>{fmt(Math.abs(totalReceived - totalPaid))}</div>
            <div style={{ fontSize: 10, color: '#888780' }}>{totalReceived >= totalPaid ? '(receivable)' : '(payable)'}</div>
          </div>
        </div>
        <VoucherSignatory businessInfo={businessInfo} leftLabel="Prepared By" />
        {useLH && businessInfo?.letterheadFooter && (
          <div className="lh-pad-footer" style={{ background: '#fff' }}>
            <img src={businessInfo.letterheadFooter} alt="letterhead footer" style={{ width:'100%', display:'block' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Stock ─────────────────────────────────────────────────────


export function StockView({ items, stockLedger: allSL, setStockLedger, userRole, businessInfo, currentBizType = 'trading', isMultiBiz = false }) {
  const [search, setSearch] = useState('');
  const [showAdj, setShowAdj] = useState(false);
  const [adjItem, setAdjItem] = useState('');
  const [adjQty, setAdjQty] = useState('');
  const [adjType, setAdjType] = useState('in');
  const [adjNote, setAdjNote] = useState('');
  const cc = COUNTRY_CONFIG[businessInfo.country || 'india'];
  const fmt = (n) => currency(n, cc.currency);

  // Filter stock ledger by current division in multi-biz mode
  const stockLedger = isMultiBiz ? (allSL || []).filter(e => (e.bizType || 'trading') === currentBizType) : (allSL || []);
  const stockMap = computeStock(stockLedger, items);

  const rows = Object.values(stockMap)
    .filter(r => r.item && r.item.name && r.item.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => (a.item.name || '').localeCompare(b.item.name || ''));

  const totalValue = rows.reduce((s, r) => s + Math.max(0, r.value), 0);
  const lowStock = rows.filter(r => r.item.minStock && r.qty <= parseFloat(r.item.minStock));

  function saveAdj() {
    if (!adjItem || !adjQty) return;
    const it = items.find(i => i.id === adjItem);
    const entry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      itemId: adjItem,
      itemName: it ? it.name : '',
      type: adjType,
      qty: parseFloat(adjQty) || 0,
      rate: it ? (parseFloat(it.purchaseRate ?? it.rate) || 0) : 0,
      sourceType: 'manual',
      sourceId: '',
      sourceNumber: 'Manual Adj.',
      notes: adjNote,
      createdAt: Date.now(),
      bizType: currentBizType,
    };
    setStockLedger(prev => [...prev, entry]);
    setShowAdj(false); setAdjItem(''); setAdjQty(''); setAdjNote('');
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>Stock Position</h2>
          <div style={{ fontSize: 13, color: '#888780' }}>Current inventory levels across all items</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {lowStock.length > 0 && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '6px 14px', fontSize: 12.5, color: '#B91C1C', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚠️ {lowStock.length} item{lowStock.length > 1 ? 's' : ''} low on stock
            </div>
          )}
          {(userRole === 'admin' || userRole === 'manager' || userRole === 'inventory') && (
            <button style={styles.primaryBtn} onClick={() => setShowAdj(true)}><Plus size={15} /> Manual Adjustment</button>
          )}
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        <div style={styles.statCard}><div style={{ ...styles.statBar, background: '#3D7A5C' }} /><div><div style={styles.statLabel}>Total items</div><div className="serif" style={styles.statValue}>{rows.length}</div></div></div>
        <div style={styles.statCard}><div style={{ ...styles.statBar, background: '#B91C1C' }} /><div><div style={styles.statLabel}>Low / out of stock</div><div className="serif" style={styles.statValue}>{lowStock.length}</div></div></div>
        <div style={styles.statCard}><div style={{ ...styles.statBar, background: '#1E2A4A' }} /><div><div style={styles.statLabel}>Stock value</div><div className="serif" style={styles.statValue}>{fmt(totalValue)}</div></div></div>
      </div>

      <div style={styles.toolbar}>
        <div style={styles.searchWrap}><Search size={15} color="#888780" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…" style={styles.searchInput} /></div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead><tr>
            {['Item', 'Unit', 'Opening Stock', 'In', 'Out', 'Current Stock', 'Min Stock', 'Stock Value', 'Status'].map(h => <th key={h} style={styles.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} style={{ ...styles.td, textAlign: 'center', color: '#888780', padding: 28 }}>No items found.</td></tr>}
            {rows.map(({ qty, value, item }) => {
              const ledgerRows = (stockLedger || []).filter(e => e.itemId === item.id);
              const totalIn  = ledgerRows.filter(e => e.type === 'in').reduce((s, e) => s + (parseFloat(e.qty) || 0), 0);
              const totalOut = ledgerRows.filter(e => e.type === 'out').reduce((s, e) => s + (parseFloat(e.qty) || 0), 0);
              const openingStock = parseFloat(item.openingStock) || 0;
              const minStock = parseFloat(item.minStock) || 0;
              const isLow = minStock > 0 && qty <= minStock;
              const isOut = qty <= 0;
              return (
                <tr key={item.id} style={{ background: isOut ? '#FFF5F5' : isLow ? '#FFFBEB' : 'transparent' }}>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{item.name}</td>
                  <td style={styles.td}>{item.unit || '—'}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{openingStock}</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: '#1A7A3E', fontWeight: 500 }}>{totalIn}</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: '#B91C1C', fontWeight: 500 }}>{totalOut}</td>
                  <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{qty.toFixed(2)}</td>
                  <td style={{ ...styles.td, textAlign: 'right', color: '#888780' }}>{minStock || '—'}</td>
                  <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(Math.max(0, value))}</td>
                  <td style={styles.td}>
                    {isOut ? <span style={{ ...styles.badge, background: '#FEE2E2', color: '#B91C1C' }}>Out of stock</span>
                    : isLow ? <span style={{ ...styles.badge, background: '#FEF3C7', color: '#92400E' }}>Low stock</span>
                    : <span style={{ ...styles.badge, background: '#D1FAE5', color: '#065F46' }}>In stock</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showAdj && (
        <Modal title="Manual Stock Adjustment" onClose={() => setShowAdj(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Item</label>
              <select value={adjItem} onChange={e => setAdjItem(e.target.value)} style={styles.input}>
                <option value="">Select item</option>
                {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Type</label>
                <select value={adjType} onChange={e => setAdjType(e.target.value)} style={styles.input}>
                  <option value="in">Stock In (+)</option>
                  <option value="out">Stock Out (−)</option>
                </select>
              </div>
              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Quantity</label>
                <input type="number" value={adjQty} onChange={e => setAdjQty(e.target.value)} style={styles.input} min="0" />
              </div>
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Reason / Notes</label>
              <input value={adjNote} onChange={e => setAdjNote(e.target.value)} style={styles.input} placeholder="e.g. Opening stock, Damage, Return…" />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={styles.ghostBtn} onClick={() => setShowAdj(false)}>Cancel</button>
              <button style={styles.primaryBtn} onClick={saveAdj}>Save Adjustment</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}


export function StockLedgerView({ items, stockLedger, setStockLedger, businessInfo }) {
  const [itemFilter, setItemFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const cc = COUNTRY_CONFIG[businessInfo.country || 'india'];
  const fmt = (n) => currency(n, cc.currency);

  const SOURCE_LABEL = { invoice: 'Invoice', purchasebill: 'Purchase Bill', delivery: 'Delivery Note', manual: 'Manual Adj.', production: 'Production', 'rack-in': 'Rack IN', 'rack-mdr': 'Rack MDR', 'rack-return': 'Rack Return' };

  const rows = (stockLedger || [])
    .filter(e => !itemFilter || e.itemId === itemFilter)
    .filter(e => !typeFilter || e.type === typeFilter)
    .sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>Stock Ledger</h2>
          <div style={{ fontSize: 13, color: '#888780' }}>Complete history of all stock movements</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <select value={itemFilter} onChange={e => setItemFilter(e.target.value)} style={{ ...styles.input, maxWidth: 220 }}>
          <option value="">All items</option>
          {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ ...styles.input, maxWidth: 160 }}>
          <option value="">All movements</option>
          <option value="in">Stock In</option>
          <option value="out">Stock Out</option>
        </select>
        {(itemFilter || typeFilter) && (
          <button style={styles.ghostBtn} onClick={() => { setItemFilter(''); setTypeFilter(''); }}>Clear</button>
        )}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead><tr>
            {['Date', 'Item', 'Movement', 'Qty', 'Rate', 'Value', 'Source', 'Reference'].map(h => <th key={h} style={styles.th}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} style={{ ...styles.td, textAlign: 'center', color: '#888780', padding: 28 }}>No stock movements yet. Approve a purchase bill or invoice to see entries here.</td></tr>}
            {rows.map(e => (
              <tr key={e.id}>
                <td style={styles.td}>{e.date}</td>
                <td style={{ ...styles.td, fontWeight: 500 }}>{e.itemName}</td>
                <td style={styles.td}>
                  <span style={{ fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '2px 8px',
                    background: e.type === 'in' ? '#D1FAE5' : '#FEE2E2',
                    color: e.type === 'in' ? '#065F46' : '#B91C1C' }}>
                    {e.type === 'in' ? '▲ IN' : '▼ OUT'}
                  </span>
                </td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{e.qty}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>{fmt(e.rate)}</td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 500 }}>{fmt(e.qty * e.rate)}</td>
                <td style={styles.td}><span style={{ fontSize: 11, background: '#F5F3EE', borderRadius: 4, padding: '2px 7px' }}>{SOURCE_LABEL[e.sourceType] || e.sourceType}</span></td>
                <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 11, color: '#C9A24B' }}>{e.sourceNumber}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// GRN — Goods Receipt Note
// ─────────────────────────────────────────────



// ─────────────────────────────────────────────
// HR / PAYROLL MODULE
// ─────────────────────────────────────────────

// ─── Vertical Rack ──────────────────────────────────────────────────────────


export function VerticalRackModule({ rackStore, setRackStore, items, grns = [], storeIssues = [], setStockLedger, businessInfo, userRole, currentBizType = 'trading', isMultiBiz = false, currentUserName = '' }) {
  const [showRackForm, setShowRackForm]   = React.useState(false);
  const [editRack,     setEditRack]       = React.useState(null);
  const [activeRack,   setActiveRack]     = React.useState(null); // rack being managed
  const [showHistory,  setShowHistory]    = React.useState(false);

  const rs       = rackStore || { racks: [], inward: [], outward: [], returns: [] };
  const racks    = rs.racks   || [];
  const allInward  = rs.inward  || [];
  const allOutward = rs.outward || [];
  const allReturns = rs.returns || [];
  const inward  = isMultiBiz ? allInward.filter(r  => (r.bizType||'trading') === currentBizType) : allInward;
  const outward = isMultiBiz ? allOutward.filter(r => (r.bizType||'trading') === currentBizType) : allOutward;
  const returns = isMultiBiz ? allReturns.filter(r => (r.bizType||'trading') === currentBizType) : allReturns;

  function nextNo(prefix, arr, field) {
    const nums = arr.map(r => parseInt((r[field]||'').replace(/\D/g,''))||0);
    return prefix + String((nums.length ? Math.max(...nums) : 0)+1).padStart(3,'0');
  }

  function addStockEntries(docId, docNo, date, itemsList, type, sourceType) {
    const now = Date.now();
    const entries = itemsList.filter(i => i.itemId && parseFloat(i.qty)>0).map(i => ({
      id: crypto.randomUUID(), date, itemId: i.itemId, itemName: i.itemName,
      type, qty: parseFloat(i.qty)||0, sourceType, sourceId: docId,
      sourceNumber: docNo, rackId: i.rackId, slot: i.slot, createdAt: now, bizType: currentBizType,
    }));
    if (entries.length) setStockLedger(prev => [...(prev||[]).filter(e=>e.sourceId!==docId), ...entries]);
  }

  function saveInward(doc) {
    const rec = { ...doc, id: doc.id||Date.now().toString(), bizType: currentBizType, createdBy: currentUserName, createdAt: new Date().toISOString() };
    setRackStore(prev => { const p=prev||{racks:[],inward:[],outward:[],returns:[]}; const ex=(p.inward||[]).find(r=>r.id===rec.id); return {...p, inward: ex?(p.inward||[]).map(r=>r.id===rec.id?rec:r):[...(p.inward||[]),rec]}; });
    addStockEntries(rec.id, rec.receiptNo, rec.date, rec.items||[], 'in', 'rack-in');
  }

  function saveOutward(doc) {
    const rec = { ...doc, id: doc.id||Date.now().toString(), bizType: currentBizType, createdBy: currentUserName, createdAt: new Date().toISOString() };
    setRackStore(prev => { const p=prev||{racks:[],inward:[],outward:[],returns:[]}; const ex=(p.outward||[]).find(r=>r.id===rec.id); return {...p, outward: ex?(p.outward||[]).map(r=>r.id===rec.id?rec:r):[...(p.outward||[]),rec]}; });
    if (rec.status==='delivered') addStockEntries(rec.id, rec.mdrNo, rec.date, rec.items||[], 'out', 'rack-mdr');
  }

  function markDelivered(id) {
    const doc = allOutward.find(r=>r.id===id); if (!doc) return;
    const updated = {...doc, status:'delivered', deliveredAt: new Date().toISOString()};
    setRackStore(prev => { const p=prev||{racks:[],inward:[],outward:[],returns:[]}; return {...p, outward:(p.outward||[]).map(r=>r.id===id?updated:r)}; });
    addStockEntries(id, doc.mdrNo, doc.date, doc.items||[], 'out', 'rack-mdr');
  }

  function saveReturn(doc) {
    const rec = { ...doc, id: doc.id||Date.now().toString(), bizType: currentBizType, createdBy: currentUserName, createdAt: new Date().toISOString() };
    setRackStore(prev => { const p=prev||{racks:[],inward:[],outward:[],returns:[]}; const ex=(p.returns||[]).find(r=>r.id===rec.id); return {...p, returns: ex?(p.returns||[]).map(r=>r.id===rec.id?rec:r):[...(p.returns||[]),rec]}; });
    addStockEntries(rec.id, rec.returnNo, rec.date, rec.items||[], 'in', 'rack-return');
  }

  function deleteRecord(section, id) {
    if (!window.confirm('Delete this record?')) return;
    setRackStore(prev => { const p=prev||{}; return {...p, [section]:(p[section]||[]).filter(r=>r.id!==id)}; });
    setStockLedger(prev => (prev||[]).filter(e=>e.sourceId!==id));
  }

  function saveRack(rack) {
    const rec = {...rack, id: rack.id||Date.now().toString()};
    setRackStore(prev => { const p=prev||{racks:[],inward:[],outward:[],returns:[]}; const ex=(p.racks||[]).find(r=>r.id===rec.id); return {...p, racks: ex?(p.racks||[]).map(r=>r.id===rec.id?rec:r):[...(p.racks||[]),rec]}; });
    setShowRackForm(false); setEditRack(null);
  }

  function deleteRack(id) {
    if (!window.confirm('Delete this rack?')) return;
    setRackStore(prev => ({...(prev||{}), racks:((prev||{}).racks||[]).filter(r=>r.id!==id)}));
    if (activeRack?.id === id) setActiveRack(null);
  }

  // History across all racks
  const allMovements = [
    ...inward.map(r=>({...r,_type:'IN',_no:r.receiptNo,_party:r.sourceRef})),
    ...outward.map(r=>({...r,_type:'MDR',_no:r.mdrNo,_party:r.issuedTo})),
    ...returns.map(r=>({...r,_type:'RTN',_no:r.returnNo,_party:r.returnFrom})),
  ].sort((a,b)=>b.date>a.date?1:-1);

  return (
    <div style={{ padding:'24px 32px', maxWidth:1200, margin:'0 auto' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 className="serif" style={styles.h1}>Vertical Rack</h1>
          <p style={styles.muted}>Click any rack to manage slots — receive, issue, or return items directly.</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={styles.ghostBtn} onClick={()=>setShowHistory(h=>!h)}>{showHistory?'← Racks':'📋 History'}</button>
          <button style={styles.primaryBtn} onClick={()=>{setEditRack(null);setShowRackForm(true);}}>+ Add Rack</button>
        </div>
      </div>

      {showHistory ? (
        <RackHistoryView movements={allMovements} onMarkDelivered={markDelivered} onDelete={deleteRecord} />
      ) : racks.length === 0 ? (
        <div style={{ textAlign:'center', padding:64, color:'#aaa' }}>
          <Layers size={48} style={{ marginBottom:12, opacity:0.3 }}/>
          <div style={{ fontSize:15 }}>No racks yet.</div>
          <div style={{ fontSize:13, marginTop:6 }}>Click <strong>+ Add Rack</strong> to define your first rack.</div>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:16 }}>
          {racks.map(rack => (
            <RackCard key={rack.id} rack={rack} inward={inward} outward={outward} returns={returns}
              onClick={() => setActiveRack(rack)}
              onEdit={e=>{e.stopPropagation();setEditRack(rack);setShowRackForm(true);}}
              onDelete={e=>{e.stopPropagation();deleteRack(rack.id);}} />
          ))}
        </div>
      )}

      {activeRack && (
        <RackDetailModal
          rack={activeRack}
          inward={inward} outward={outward} returns={returns}
          items={items} grns={grns} storeIssues={storeIssues}
          nextInNo={nextNo('RIN-',inward,'receiptNo')}
          nextMdrNo={nextNo('MDR-',outward,'mdrNo')}
          nextRtnNo={nextNo('RTN-',returns,'returnNo')}
          currentUserName={currentUserName}
          onSaveInward={saveInward} onSaveOutward={saveOutward} onSaveReturn={saveReturn}
          onMarkDelivered={markDelivered} onDeleteRecord={deleteRecord}
          onClose={()=>setActiveRack(null)}
          businessInfo={businessInfo}
        />
      )}

      {showRackForm && <RackFormModal rack={editRack} onSave={saveRack} onClose={()=>{setShowRackForm(false);setEditRack(null);}} />}
    </div>
  );
}

// ── Rack card (clickable) ────────────────────────────────────────────────────

export function RackCard({ rack, inward=[], outward=[], returns=[], onClick, onEdit, onDelete }) {
  const rows = parseInt(rack.rows)||4, cols = parseInt(rack.cols)||5;
  const capacity = parseInt(rack.slotCapacity)||0;
  const slots = [];
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) slots.push(String.fromCharCode(65+r)+(c+1));

  const slotQty = React.useMemo(()=>{
    const d={};
    slots.forEach(s=>{d[s]=0;});
    inward.forEach(doc=>(doc.items||[]).filter(i=>i.rackId===rack.id).forEach(i=>{const s=i.slot||'';if(d[s]!==undefined)d[s]+=(parseFloat(i.qty)||0);}));
    returns.forEach(doc=>(doc.items||[]).filter(i=>i.rackId===rack.id).forEach(i=>{const s=i.slot||'';if(d[s]!==undefined)d[s]+=(parseFloat(i.qty)||0);}));
    outward.filter(doc=>doc.status==='delivered').forEach(doc=>(doc.items||[]).filter(i=>i.rackId===rack.id).forEach(i=>{const s=i.slot||'';if(d[s]!==undefined)d[s]-=(parseFloat(i.qty)||0);}));
    return d;
  },[inward,outward,returns,rack.id]);

  function slotColor(slot){
    const q=Math.max(0,slotQty[slot]||0);
    if(q<=0) return {bg:'#F0EDE6',br:'#E0DDD5',color:'#ccc'};
    if(!capacity) return {bg:'#D4EDDA',br:'#A8D5B5',color:'#1E5C2E'};
    if(q>=capacity) return {bg:'#FBEAE7',br:'#E08A7D',color:'#B5453A'};
    return {bg:'#FFF3CC',br:'#F5D76E',color:'#7A5900'};
  }

  const occupied = slots.filter(s=>(slotQty[s]||0)>0).length;
  const pct = slots.length>0 ? Math.round((occupied/slots.length)*100) : 0;
  const badge = pct===0?['Empty','#aaa']:pct>=80?['Full','#B5453A']:pct>=40?['Half','#C07B1A']:['Partial','#2C6B3A'];

  return (
    <div onClick={onClick} style={{ background:'#fff', border:'2px solid #E8E4DC', borderRadius:12, padding:16, cursor:'pointer', transition:'border-color 0.15s, box-shadow 0.15s' }}
      onMouseEnter={e=>{e.currentTarget.style.borderColor='#2C3E6B';e.currentTarget.style.boxShadow='0 4px 16px rgba(44,62,107,0.12)';}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor='#E8E4DC';e.currentTarget.style.boxShadow='none';}}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:15, color:'#1E2A4A' }}>{rack.name}</div>
          <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{rows}R × {cols}C · {slots.length} slots{capacity?` · cap ${capacity}`:''}  <span style={{ color:badge[1], fontWeight:700, marginLeft:4 }}>{badge[0]}</span></div>
          {rack.description && <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{rack.description}</div>}
        </div>
        <div style={{ display:'flex', gap:3 }} onClick={e=>e.stopPropagation()}>
          <button style={styles.iconBtn} onClick={onEdit}><Pencil size={13}/></button>
          <button style={{...styles.iconBtn,color:'#E08A7D'}} onClick={onDelete}><Trash2 size={13}/></button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:3 }}>
        {slots.map(slot=>{const sc=slotColor(slot);const q=Math.max(0,slotQty[slot]||0); return(
          <div key={slot} style={{ background:sc.bg, border:`1px solid ${sc.br}`, borderRadius:4, padding:'5px 2px', textAlign:'center', fontSize:10, color:sc.color }}>
            <div style={{ fontWeight:q>0?700:400 }}>{slot}</div>
            {q>0&&<div style={{ fontSize:8, marginTop:1 }}>{q}</div>}
          </div>
        );})}
      </div>
      <div style={{ marginTop:10, fontSize:11, color:'#888', textAlign:'center' }}>Click to manage slots</div>
    </div>
  );
}

// ── Rack Detail Modal (main management screen) ───────────────────────────────

export function RackDetailModal({ rack, inward, outward, returns, items, grns, storeIssues, nextInNo, nextMdrNo, nextRtnNo, currentUserName, onSaveInward, onSaveOutward, onSaveReturn, onMarkDelivered, onDeleteRecord, onClose, businessInfo }) {
  const [action, setAction]     = React.useState(null); // {type:'receive'|'issue'|'return', slot}
  const [printDoc, setPrintDoc] = React.useState(null);
  const [activeTab, setActiveTab] = React.useState('slots'); // 'slots' | 'history'

  const rows = parseInt(rack.rows)||4, cols = parseInt(rack.cols)||5;
  const capacity = parseInt(rack.slotCapacity)||0;
  const slots = [];
  for (let r=0;r<rows;r++) for (let c=0;c<cols;c++) slots.push(String.fromCharCode(65+r)+(c+1));

  const slotData = React.useMemo(()=>{
    const d={};
    slots.forEach(s=>{d[s]={qty:0,items:[]};});
    inward.forEach(doc=>(doc.items||[]).filter(i=>i.rackId===rack.id).forEach(i=>{const s=i.slot||'';if(!d[s])d[s]={qty:0,items:[]};d[s].qty+=(parseFloat(i.qty)||0);if(i.itemName&&!d[s].items.includes(i.itemName))d[s].items.push(i.itemName);}));
    returns.forEach(doc=>(doc.items||[]).filter(i=>i.rackId===rack.id).forEach(i=>{const s=i.slot||'';if(!d[s])d[s]={qty:0,items:[]};d[s].qty+=(parseFloat(i.qty)||0);if(i.itemName&&!d[s].items.includes(i.itemName))d[s].items.push(i.itemName);}));
    outward.filter(doc=>doc.status==='delivered').forEach(doc=>(doc.items||[]).filter(i=>i.rackId===rack.id).forEach(i=>{const s=i.slot||'';if(!d[s])d[s]={qty:0,items:[]};d[s].qty-=(parseFloat(i.qty)||0);}));
    return d;
  },[inward,outward,returns,rack.id]);

  function slotColor(slot){
    const q=Math.max(0,slotData[slot]?.qty||0);
    if(q<=0) return {bg:'#F5F3EE',br:'#E8E4DC',color:'#bbb',status:'empty'};
    if(!capacity) return {bg:'#D4EDDA',br:'#A8D5B5',color:'#1E5C2E',status:'occupied'};
    if(q>=capacity) return {bg:'#FBEAE7',br:'#E08A7D',color:'#B5453A',status:'full'};
    return {bg:'#FFF3CC',br:'#F5D76E',color:'#7A5900',status:'partial'};
  }

  // Rack-level history
  const rackMovements = [
    ...inward.filter(r=>(r.items||[]).some(i=>i.rackId===rack.id)).map(r=>({...r,_type:'IN',_no:r.receiptNo,_party:r.sourceRef})),
    ...outward.filter(r=>(r.items||[]).some(i=>i.rackId===rack.id)).map(r=>({...r,_type:'MDR',_no:r.mdrNo,_party:r.issuedTo})),
    ...returns.filter(r=>(r.items||[]).some(i=>i.rackId===rack.id)).map(r=>({...r,_type:'RTN',_no:r.returnNo,_party:r.returnFrom})),
  ].sort((a,b)=>b.date>a.date?1:-1);

  const tabSt = t => ({ padding:'6px 16px', fontSize:12, fontWeight:activeTab===t?600:400, borderBottom:activeTab===t?'2px solid #2C3E6B':'2px solid transparent', color:activeTab===t?'#2C3E6B':'#888', cursor:'pointer', background:'none', border:'none' });

  return (
    <div style={{ position:'fixed', inset:0, zIndex:500, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'stretch', justifyContent:'flex-end' }}>
      <div style={{ width:'min(780px,96vw)', background:'#fff', display:'flex', flexDirection:'column', height:'100vh', boxShadow:'-4px 0 24px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ padding:'16px 24px', borderBottom:'1px solid #E8E4DC', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#2C3E6B' }}>
          <div>
            <div style={{ fontWeight:700, fontSize:17, color:'#fff' }}>{rack.name}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.7)', marginTop:2 }}>{rows}R × {cols}C · {slots.length} slots{capacity?` · cap ${capacity}/slot`:''}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#fff', cursor:'pointer', padding:4 }}><X size={20}/></button>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid #E8E4DC', paddingLeft:24 }}>
          <button style={tabSt('slots')} onClick={()=>setActiveTab('slots')}>Slots</button>
          <button style={tabSt('history')} onClick={()=>setActiveTab('history')}>History ({rackMovements.length})</button>
        </div>

        <div style={{ flex:1, padding:24, overflowY:'auto' }}>
          {activeTab === 'slots' && (
            <>
              {/* Legend */}
              <div style={{ display:'flex', gap:14, marginBottom:16, fontSize:11, color:'#888', flexWrap:'wrap' }}>
                {[['#F5F3EE','#E8E4DC','Empty'],['#D4EDDA','#A8D5B5','Occupied'],['#FFF3CC','#F5D76E','Partial'],['#FBEAE7','#E08A7D','Full']].map(([bg,br,lb])=>(
                  <span key={lb}><span style={{display:'inline-block',width:12,height:12,background:bg,border:`1px solid ${br}`,borderRadius:3,marginRight:4,verticalAlign:'middle'}}/>{lb}</span>
                ))}
                <span style={{ marginLeft:'auto', fontSize:11, color:'#2C3E6B', fontWeight:600 }}>Click a slot to receive / issue / return</span>
              </div>

              {/* Slot grid */}
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`, gap:6, marginBottom:24 }}>
                {slots.map(slot=>{
                  const sc=slotColor(slot); const d=slotData[slot]; const qty=Math.max(0,d?.qty||0);
                  const isActive = action?.slot===slot;
                  return(
                    <div key={slot} onClick={()=>setAction(a=>a?.slot===slot?null:{slot,type:null})}
                      style={{ background:isActive?'#EEF1F8':sc.bg, border:`2px solid ${isActive?'#2C3E6B':sc.br}`, borderRadius:8, padding:'10px 6px', textAlign:'center', cursor:'pointer', transition:'all 0.15s' }}>
                      <div style={{ fontWeight:700, fontSize:12, color:isActive?'#2C3E6B':sc.color }}>{slot}</div>
                      {qty>0 && <div style={{ fontSize:10, color:'#555', marginTop:3, lineHeight:1.2 }}>{d.items.slice(0,1).join('')}{d.items.length>1?'…':''}</div>}
                      <div style={{ fontSize:11, fontWeight:700, color:isActive?'#2C3E6B':sc.color, marginTop:2 }}>{qty>0?qty:''}</div>
                    </div>
                  );
                })}
              </div>

              {/* Slot action panel */}
              {action && !action.type && (
                <div style={{ border:'2px solid #2C3E6B', borderRadius:12, padding:20, marginBottom:24, background:'#F7F9FF' }}>
                  <div style={{ fontWeight:700, fontSize:14, color:'#2C3E6B', marginBottom:4 }}>Slot {action.slot}</div>
                  {(() => { const d=slotData[action.slot]; const qty=Math.max(0,d?.qty||0); return qty>0 ? <div style={{fontSize:12,color:'#555',marginBottom:12}}>{d.items.join(', ')} · <strong>{qty}</strong> units</div> : <div style={{fontSize:12,color:'#aaa',marginBottom:12}}>Empty slot</div>; })()}
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                    <button style={{...styles.primaryBtn,background:'#2C6B3A'}} onClick={()=>setAction({slot:action.slot,type:'receive'})}>↓ Receive (IN)</button>
                    <button style={{...styles.primaryBtn,background:'#6B2C2C'}} onClick={()=>setAction({slot:action.slot,type:'issue'})}>↑ Issue / MDR (OUT)</button>
                    {Math.max(0,slotData[action.slot]?.qty||0)===0 && outward.some(m=>m.status==='delivered'&&(m.items||[]).some(i=>i.rackId===rack.id&&i.slot===action.slot)) &&
                      <button style={{...styles.primaryBtn,background:'#2255A0'}} onClick={()=>setAction({slot:action.slot,type:'return'})}>↩ Return</button>}
                    {Math.max(0,slotData[action.slot]?.qty||0)>0 &&
                      <button style={{...styles.primaryBtn,background:'#2255A0'}} onClick={()=>setAction({slot:action.slot,type:'return'})}>↩ Return</button>}
                    <button style={styles.ghostBtn} onClick={()=>setAction(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Inline Receive form */}
              {action?.type==='receive' && (
                <SlotReceiveForm
                  slot={action.slot} rack={rack} nextNo={nextInNo}
                  items={items} grns={grns}
                  onSave={doc=>{ onSaveInward(doc); setAction(null); }}
                  onCancel={()=>setAction(null)}
                />
              )}

              {/* Inline Issue form */}
              {action?.type==='issue' && (
                <SlotIssueForm
                  slot={action.slot} rack={rack} nextNo={nextMdrNo}
                  items={items} storeIssues={storeIssues}
                  slotItems={slotData[action.slot]?.items||[]}
                  onSave={doc=>{ onSaveOutward(doc); setAction(null); }}
                  onCancel={()=>setAction(null)}
                />
              )}

              {/* Inline Return form */}
              {action?.type==='return' && (
                <SlotReturnForm
                  slot={action.slot} rack={rack} nextNo={nextRtnNo}
                  items={items} outward={outward}
                  onSave={doc=>{ onSaveReturn(doc); setAction(null); }}
                  onCancel={()=>setAction(null)}
                />
              )}
            </>
          )}

          {activeTab === 'history' && (
            <RackHistoryView movements={rackMovements} onMarkDelivered={onMarkDelivered} onDelete={onDeleteRecord} compact />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Slot inline forms ────────────────────────────────────────────────────────

export function SlotReceiveForm({ slot, rack, nextNo, items, grns, onSave, onCancel }) {
  const [receiptNo, setReceiptNo] = React.useState(nextNo);
  const [date, setDate]           = React.useState(new Date().toISOString().slice(0,10));
  const [sourceType, setSrcType]  = React.useState('grn');
  const [sourceRef, setSrcRef]    = React.useState('');
  const [rows, setRows]           = React.useState([{ itemId:'', itemName:'', qty:'', unit:'' }]);
  const [search, setSearch]       = React.useState(['']);
  const [showDrop, setShowDrop]   = React.useState([false]);

  const approvedGrns = (grns||[]).filter(g=>g.approvalStatus==='approved'||g.status==='approved');

  function pickItem(idx, it) {
    const r=[...rows]; r[idx]={...r[idx], itemId:it.id, itemName:it.name, unit:it.unit||'nos'};
    setRows(r); const s=[...search]; s[idx]=it.name; setSearch(s); const d=[...showDrop]; d[idx]=false; setShowDrop(d);
  }
  function setRow(idx,k,v){ const r=[...rows]; r[idx]={...r[idx],[k]:v}; setRows(r); }
  function addRow(){ setRows(r=>[...r,{itemId:'',itemName:'',qty:'',unit:''}]); setSearch(s=>[...s,'']); setShowDrop(d=>[...d,false]); }
  function removeRow(idx){ setRows(r=>r.filter((_,i)=>i!==idx)); setSearch(s=>s.filter((_,i)=>i!==idx)); setShowDrop(d=>d.filter((_,i)=>i!==idx)); }

  function handleSave(){
    const validRows = rows.filter(r=>r.itemId&&parseFloat(r.qty)>0);
    if(!validRows.length){alert('Add at least one item with qty');return;}
    onSave({ receiptNo, date, sourceType, sourceRef, items: validRows.map(r=>({...r, rackId:rack.id, rackName:rack.name, slot, qty:parseFloat(r.qty)})) });
  }

  return (
    <div style={{ border:'2px solid #2C6B3A', borderRadius:12, padding:20, marginBottom:24, background:'#F6FBF7' }}>
      <div style={{ fontWeight:700, fontSize:14, color:'#2C6B3A', marginBottom:12 }}>↓ Receive INTO Slot {slot} — {rack.name}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
        <div style={styles.formGroup}><label style={styles.label}>Receipt No</label><input value={receiptNo} onChange={e=>setReceiptNo(e.target.value)} style={styles.input}/></div>
        <div style={styles.formGroup}><label style={styles.label}>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={styles.input}/></div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Source</label>
          <select value={sourceType} onChange={e=>setSrcType(e.target.value)} style={styles.input}>
            <option value="grn">GRN</option>
            <option value="production">Production Delivery</option>
            <option value="manual">Manual / Other</option>
          </select>
        </div>
        <div style={{...styles.formGroup,gridColumn:'1/-1'}}>
          <label style={styles.label}>{sourceType==='grn'?'GRN Reference':sourceType==='production'?'Production Order Ref':'Reference'}</label>
          {sourceType==='grn'&&approvedGrns.length>0
            ? <select value={sourceRef} onChange={e=>setSrcRef(e.target.value)} style={styles.input}><option value="">— select GRN —</option>{approvedGrns.map(g=><option key={g.id} value={g.number||g.id}>{g.number} · {g.date} · {g.vendorName||''}</option>)}</select>
            : <input value={sourceRef} onChange={e=>setSrcRef(e.target.value)} style={styles.input} placeholder="Reference number"/>}
        </div>
      </div>
      {/* Item rows */}
      <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>Items</div>
      {rows.map((row,idx)=>(
        <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, marginBottom:8, alignItems:'flex-start' }}>
          <div style={{ position:'relative' }}>
            <input value={search[idx]||''} onChange={e=>{ const s=[...search]; s[idx]=e.target.value; setSearch(s); const d=[...showDrop]; d[idx]=true; setShowDrop(d); setRow(idx,'itemId',''); setRow(idx,'itemName',''); }} style={{...styles.input,margin:0}} placeholder="Search item…"/>
            {showDrop[idx]&&search[idx]&&(
              <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #E8E4DC',borderRadius:6,zIndex:100,maxHeight:140,overflowY:'auto'}}>
                {(items||[]).filter(it=>it.name?.toLowerCase().includes((search[idx]||'').toLowerCase())).slice(0,15).map(it=>(
                  <div key={it.id} onClick={()=>pickItem(idx,it)} style={{padding:'6px 10px',fontSize:12,cursor:'pointer',borderBottom:'1px solid #F5F3EE'}} onMouseEnter={e=>e.currentTarget.style.background='#F5F3EE'} onMouseLeave={e=>e.currentTarget.style.background=''}>{it.name}</div>
                ))}
              </div>
            )}
          </div>
          <input type="number" value={row.qty} onChange={e=>setRow(idx,'qty',e.target.value)} style={{...styles.input,margin:0}} placeholder="Qty" min={0}/>
          <input value={row.unit} onChange={e=>setRow(idx,'unit',e.target.value)} style={{...styles.input,margin:0}} placeholder="Unit"/>
          <button style={{...styles.iconBtn,color:'#E08A7D',marginTop:2}} onClick={()=>removeRow(idx)}><X size={13}/></button>
        </div>
      ))}
      <button style={{...styles.ghostBtn,fontSize:12,marginBottom:16}} onClick={addRow}>+ Add Row</button>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button style={{...styles.primaryBtn,background:'#2C6B3A'}} onClick={handleSave}>✓ Save Receipt</button>
      </div>
    </div>
  );
}


export function SlotIssueForm({ slot, rack, nextNo, items, storeIssues, slotItems, onSave, onCancel }) {
  const [mdrNo,    setMdrNo]    = React.useState(nextNo);
  const [date,     setDate]     = React.useState(new Date().toISOString().slice(0,10));
  const [sivRef,   setSivRef]   = React.useState('');
  const [issuedTo, setIssuedTo] = React.useState('');
  const [purpose,  setPurpose]  = React.useState('');
  const [rows, setRows]         = React.useState([{ itemId:'', itemName:'', qty:'', unit:'' }]);
  const [search, setSearch]     = React.useState(['']);
  const [showDrop, setShowDrop] = React.useState([false]);

  const approvedSivs = (storeIssues||[]).filter(s=>s.approvalStatus==='approved'||s.status==='approved');

  function pickItem(idx,it){ const r=[...rows]; r[idx]={...r[idx],itemId:it.id,itemName:it.name,unit:it.unit||'nos'}; setRows(r); const s=[...search]; s[idx]=it.name; setSearch(s); const d=[...showDrop]; d[idx]=false; setShowDrop(d); }
  function setRow(idx,k,v){ const r=[...rows]; r[idx]={...r[idx],[k]:v}; setRows(r); }
  function addRow(){ setRows(r=>[...r,{itemId:'',itemName:'',qty:'',unit:''}]); setSearch(s=>[...s,'']); setShowDrop(d=>[...d,false]); }
  function removeRow(idx){ setRows(r=>r.filter((_,i)=>i!==idx)); setSearch(s=>s.filter((_,i)=>i!==idx)); setShowDrop(d=>d.filter((_,i)=>i!==idx)); }

  function doSave(status){
    const validRows=rows.filter(r=>r.itemId&&parseFloat(r.qty)>0);
    if(!validRows.length){alert('Add at least one item');return;}
    onSave({mdrNo,date,sivRef,issuedTo,purpose,status,items:validRows.map(r=>({...r,rackId:rack.id,rackName:rack.name,slot,qty:parseFloat(r.qty)}))});
  }

  return (
    <div style={{ border:'2px solid #6B2C2C', borderRadius:12, padding:20, marginBottom:24, background:'#FDF7F6' }}>
      <div style={{ fontWeight:700, fontSize:14, color:'#6B2C2C', marginBottom:12 }}>↑ Issue / MDR from Slot {slot} — {rack.name}</div>
      {slotItems.length>0 && <div style={{fontSize:12,color:'#555',marginBottom:10,padding:'6px 10px',background:'#FBEAE7',borderRadius:6}}>In this slot: <strong>{slotItems.join(', ')}</strong></div>}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
        <div style={styles.formGroup}><label style={styles.label}>MDR No</label><input value={mdrNo} onChange={e=>setMdrNo(e.target.value)} style={styles.input}/></div>
        <div style={styles.formGroup}><label style={styles.label}>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={styles.input}/></div>
        <div style={styles.formGroup}>
          <label style={styles.label}>SIV Reference</label>
          {approvedSivs.length>0
            ?<select value={sivRef} onChange={e=>setSivRef(e.target.value)} style={styles.input}><option value="">— select SIV —</option>{approvedSivs.map(s=><option key={s.id} value={s.sivNumber||s.id}>{s.sivNumber}</option>)}</select>
            :<input value={sivRef} onChange={e=>setSivRef(e.target.value)} style={styles.input} placeholder="SIV number"/>}
        </div>
        <div style={styles.formGroup}><label style={styles.label}>Issued To</label><input value={issuedTo} onChange={e=>setIssuedTo(e.target.value)} style={styles.input} placeholder="Dept / Person"/></div>
        <div style={{...styles.formGroup,gridColumn:'2/-1'}}><label style={styles.label}>Purpose</label><input value={purpose} onChange={e=>setPurpose(e.target.value)} style={styles.input} placeholder="Purpose / project ref"/></div>
      </div>
      <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>Items to Issue</div>
      {rows.map((row,idx)=>(
        <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, marginBottom:8, alignItems:'flex-start' }}>
          <div style={{ position:'relative' }}>
            <input value={search[idx]||''} onChange={e=>{ const s=[...search]; s[idx]=e.target.value; setSearch(s); const d=[...showDrop]; d[idx]=true; setShowDrop(d); setRow(idx,'itemId',''); }} style={{...styles.input,margin:0}} placeholder="Search item…"/>
            {showDrop[idx]&&search[idx]&&(
              <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #E8E4DC',borderRadius:6,zIndex:100,maxHeight:140,overflowY:'auto'}}>
                {(items||[]).filter(it=>it.name?.toLowerCase().includes((search[idx]||'').toLowerCase())).slice(0,15).map(it=>(
                  <div key={it.id} onClick={()=>pickItem(idx,it)} style={{padding:'6px 10px',fontSize:12,cursor:'pointer',borderBottom:'1px solid #F5F3EE'}} onMouseEnter={e=>e.currentTarget.style.background='#F5F3EE'} onMouseLeave={e=>e.currentTarget.style.background=''}>{it.name}</div>
                ))}
              </div>
            )}
          </div>
          <input type="number" value={row.qty} onChange={e=>setRow(idx,'qty',e.target.value)} style={{...styles.input,margin:0}} placeholder="Qty" min={0}/>
          <input value={row.unit} onChange={e=>setRow(idx,'unit',e.target.value)} style={{...styles.input,margin:0}} placeholder="Unit"/>
          <button style={{...styles.iconBtn,color:'#E08A7D',marginTop:2}} onClick={()=>removeRow(idx)}><X size={13}/></button>
        </div>
      ))}
      <button style={{...styles.ghostBtn,fontSize:12,marginBottom:16}} onClick={addRow}>+ Add Row</button>
      <div style={{ fontSize:11, color:'#888', marginBottom:12, padding:'6px 10px', background:'#F5F3EE', borderRadius:6 }}>Bin card updates only when MDR is marked <strong>Delivered</strong>.</div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button style={styles.ghostBtn} onClick={()=>doSave('draft')}>Save Draft</button>
        <button style={{...styles.primaryBtn,background:'#6B2C2C'}} onClick={()=>doSave('delivered')}>✓ Save & Deliver</button>
      </div>
    </div>
  );
}


export function SlotReturnForm({ slot, rack, nextNo, items, outward, onSave, onCancel }) {
  const [returnNo,   setReturnNo]   = React.useState(nextNo);
  const [date,       setDate]       = React.useState(new Date().toISOString().slice(0,10));
  const [returnFrom, setReturnFrom] = React.useState('');
  const [mdrRef,     setMdrRef]     = React.useState('');
  const [rows, setRows]   = React.useState([{ itemId:'', itemName:'', qty:'', unit:'' }]);
  const [search, setSearch]     = React.useState(['']);
  const [showDrop, setShowDrop] = React.useState([false]);

  const deliveredMdrs = (outward||[]).filter(m=>m.status==='delivered'&&(m.items||[]).some(i=>i.rackId===rack.id&&i.slot===slot));

  function pickItem(idx,it){ const r=[...rows]; r[idx]={...r[idx],itemId:it.id,itemName:it.name,unit:it.unit||'nos'}; setRows(r); const s=[...search]; s[idx]=it.name; setSearch(s); const d=[...showDrop]; d[idx]=false; setShowDrop(d); }
  function setRow(idx,k,v){ const r=[...rows]; r[idx]={...r[idx],[k]:v}; setRows(r); }
  function addRow(){ setRows(r=>[...r,{itemId:'',itemName:'',qty:'',unit:''}]); setSearch(s=>[...s,'']); setShowDrop(d=>[...d,false]); }
  function removeRow(idx){ setRows(r=>r.filter((_,i)=>i!==idx)); setSearch(s=>s.filter((_,i)=>i!==idx)); setShowDrop(d=>d.filter((_,i)=>i!==idx)); }

  function handleSave(){
    const validRows=rows.filter(r=>r.itemId&&parseFloat(r.qty)>0);
    if(!validRows.length){alert('Add at least one item');return;}
    onSave({returnNo,date,returnFrom,mdrRef,items:validRows.map(r=>({...r,rackId:rack.id,rackName:rack.name,slot,qty:parseFloat(r.qty)}))});
  }

  return (
    <div style={{ border:'2px solid #2255A0', borderRadius:12, padding:20, marginBottom:24, background:'#F6F8FD' }}>
      <div style={{ fontWeight:700, fontSize:14, color:'#2255A0', marginBottom:12 }}>↩ Return to Slot {slot} — {rack.name}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
        <div style={styles.formGroup}><label style={styles.label}>Return No</label><input value={returnNo} onChange={e=>setReturnNo(e.target.value)} style={styles.input}/></div>
        <div style={styles.formGroup}><label style={styles.label}>Date</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} style={styles.input}/></div>
        <div style={styles.formGroup}>
          <label style={styles.label}>MDR Reference</label>
          {deliveredMdrs.length>0
            ?<select value={mdrRef} onChange={e=>setMdrRef(e.target.value)} style={styles.input}><option value="">— select MDR —</option>{deliveredMdrs.map(m=><option key={m.id} value={m.mdrNo}>{m.mdrNo} · {m.date}</option>)}</select>
            :<input value={mdrRef} onChange={e=>setMdrRef(e.target.value)} style={styles.input} placeholder="MDR number"/>}
        </div>
        <div style={{...styles.formGroup,gridColumn:'1/-1'}}><label style={styles.label}>Returned From</label><input value={returnFrom} onChange={e=>setReturnFrom(e.target.value)} style={styles.input} placeholder="Department / Person returning"/></div>
      </div>
      <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:6 }}>Items Being Returned</div>
      {rows.map((row,idx)=>(
        <div key={idx} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr auto', gap:8, marginBottom:8, alignItems:'flex-start' }}>
          <div style={{ position:'relative' }}>
            <input value={search[idx]||''} onChange={e=>{ const s=[...search]; s[idx]=e.target.value; setSearch(s); const d=[...showDrop]; d[idx]=true; setShowDrop(d); setRow(idx,'itemId',''); }} style={{...styles.input,margin:0}} placeholder="Search item…"/>
            {showDrop[idx]&&search[idx]&&(
              <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #E8E4DC',borderRadius:6,zIndex:100,maxHeight:140,overflowY:'auto'}}>
                {(items||[]).filter(it=>it.name?.toLowerCase().includes((search[idx]||'').toLowerCase())).slice(0,15).map(it=>(
                  <div key={it.id} onClick={()=>pickItem(idx,it)} style={{padding:'6px 10px',fontSize:12,cursor:'pointer',borderBottom:'1px solid #F5F3EE'}} onMouseEnter={e=>e.currentTarget.style.background='#F5F3EE'} onMouseLeave={e=>e.currentTarget.style.background=''}>{it.name}</div>
                ))}
              </div>
            )}
          </div>
          <input type="number" value={row.qty} onChange={e=>setRow(idx,'qty',e.target.value)} style={{...styles.input,margin:0}} placeholder="Qty" min={0}/>
          <input value={row.unit} onChange={e=>setRow(idx,'unit',e.target.value)} style={{...styles.input,margin:0}} placeholder="Unit"/>
          <button style={{...styles.iconBtn,color:'#E08A7D',marginTop:2}} onClick={()=>removeRow(idx)}><X size={13}/></button>
        </div>
      ))}
      <button style={{...styles.ghostBtn,fontSize:12,marginBottom:16}} onClick={addRow}>+ Add Row</button>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button style={styles.ghostBtn} onClick={onCancel}>Cancel</button>
        <button style={{...styles.primaryBtn,background:'#2255A0'}} onClick={handleSave}>✓ Save Return</button>
      </div>
    </div>
  );
}

// ── History view (shared) ────────────────────────────────────────────────────

export function RackHistoryView({ movements, onMarkDelivered, onDelete, compact=false }) {
  if (!movements.length) return <div style={{ textAlign:'center', padding:40, color:'#aaa', fontSize:13 }}>No movements yet.</div>;
  const colMap = { IN:['#2C6B3A','#EAF3DE'], MDR:['#B5453A','#FBEAE7'], RTN:['#2255A0','#EEF1F8'] };
  return (
    <table style={styles.table}>
      <thead><tr style={styles.thead}>{['Doc No','Type','Date','Items','Party','Status',''].map(h=><th key={h} style={styles.th}>{h}</th>)}</tr></thead>
      <tbody>{movements.map(d=>{ const[c,bg]=colMap[d._type]||['#888','#F5F3EE']; return(
        <tr key={d.id+d._type} style={styles.tr}>
          <td style={styles.td}><strong style={{color:c}}>{d._no}</strong></td>
          <td style={styles.td}><span style={{fontSize:11,padding:'2px 7px',borderRadius:4,background:bg,color:c,fontWeight:600}}>{d._type}</span></td>
          <td style={styles.td}>{d.date}</td>
          <td style={styles.td}>{(d.items||[]).length} items</td>
          <td style={styles.td}>{d._party||'—'}</td>
          <td style={styles.td}>{d._type==='MDR'?<span style={{fontSize:11,padding:'2px 7px',borderRadius:4,background:d.status==='delivered'?'#EAF3DE':'#F5F3EE',color:d.status==='delivered'?'#2C6B3A':'#888',fontWeight:600}}>{d.status||'draft'}</span>:'—'}</td>
          <td style={styles.td}><div style={{display:'flex',gap:4}}>
            {d._type==='MDR'&&d.status!=='delivered'&&<button style={{...styles.secondaryBtn,fontSize:11,padding:'3px 8px',color:'#2C6B3A',borderColor:'#2C6B3A',background:'#EAF3DE'}} onClick={()=>onMarkDelivered(d.id)}>✓ Deliver</button>}
            <button style={{...styles.iconBtn,color:'#E08A7D'}} onClick={()=>onDelete(d._type==='IN'?'inward':d._type==='MDR'?'outward':'returns',d.id)}><Trash2 size={13}/></button>
          </div></td>
        </tr>
      );})}
      </tbody>
    </table>
  );
}


export function RackFormModal({ rack, onSave, onClose }) {
  const [form, setForm] = React.useState({ id:rack?.id||'', name:rack?.name||'', rows:rack?.rows||4, cols:rack?.cols||5, slotCapacity:rack?.slotCapacity||'', description:rack?.description||'' });
  function set(k,v){ setForm(f=>({...f,[k]:v})); }
  const r=parseInt(form.rows)||0, c=parseInt(form.cols)||0;
  return(
    <Modal title={rack?'Edit Rack':'New Rack'} onClose={onClose}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div style={{...styles.formGroup,gridColumn:'1/-1'}}><label style={styles.label}>Rack Name / ID</label><input value={form.name} onChange={e=>set('name',e.target.value)} style={styles.input} placeholder="e.g. Rack-A, Zone-1"/></div>
        <div style={styles.formGroup}><label style={styles.label}>Rows</label><input type="number" min={1} max={26} value={form.rows} onChange={e=>set('rows',e.target.value)} style={styles.input}/></div>
        <div style={styles.formGroup}><label style={styles.label}>Columns</label><input type="number" min={1} max={20} value={form.cols} onChange={e=>set('cols',e.target.value)} style={styles.input}/></div>
        <div style={styles.formGroup}><label style={styles.label}>Slot Capacity (max qty)</label><input type="number" min={0} value={form.slotCapacity} onChange={e=>set('slotCapacity',e.target.value)} style={styles.input} placeholder="Leave blank = unlimited"/></div>
        <div style={styles.formGroup}><label style={styles.label}>Description</label><input value={form.description} onChange={e=>set('description',e.target.value)} style={styles.input} placeholder="Optional"/></div>
      </div>
      <div style={{marginTop:12,padding:10,background:'#F5F3EE',borderRadius:8,fontSize:12,color:'#666'}}>{r}×{c} = <strong>{r*c} slots</strong>{r>0&&c>0&&<span style={{marginLeft:6}}>(A1…{String.fromCharCode(64+r)}{c})</span>}</div>
      <div style={{display:'flex',justifyContent:'flex-end',gap:10,marginTop:20}}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={()=>{if(!form.name.trim()){alert('Name required');return;}onSave(form);}}>Save Rack</button>
      </div>
    </Modal>
  );
}


export function BinCard({ items, stockLedger: allSL, businessInfo, storeIssues: allSIV = [], currentBizType = 'trading', isMultiBiz = false }) {
  const [useLHBin, setUseLHBin] = React.useState(!!(businessInfo?.letterhead||businessInfo?.letterheadHtml));
  const [selectedItemId, setSelectedItemId] = useState(items[0]?.id || '');
  // Filter by current division in multi-biz mode
  const stockLedger = isMultiBiz ? (allSL || []).filter(e => (e.bizType || 'trading') === currentBizType) : (allSL || []);
  const storeIssues = isMultiBiz ? (allSIV || []).filter(s => (s.bizType || 'trading') === currentBizType) : (allSIV || []);
  const item = items.find(i => i.id === selectedItemId);

  const SOURCE_LABEL = { invoice: 'Invoice', purchasebill: 'Purchase Bill', delivery: 'Delivery Note',
    packing_list: 'Packing List', manual: 'Manual Adj.', production: 'Production', grn: 'GRN', siv: 'Issue Voucher', 'rack-in': 'Rack IN', 'rack-mdr': 'Rack MDR', 'rack-return': 'Rack Return' };

  const entries = (stockLedger || [])
    .filter(e => e.itemId === selectedItemId)
    .sort((a, b) => a.date > b.date ? 1 : a.date < b.date ? -1 : 0);

  const openingStock = parseFloat(item?.openingStock) || 0;

  let running = openingStock;
  const rows = entries.map(e => {
    const qty = parseFloat(e.qty) || 0;
    const isIn = e.type === 'in';
    running = isIn ? running + qty : running - qty;
    const siv = e.sourceType === 'siv' ? storeIssues.find(s => s.id === e.sourceId) : null;
    return { ...e, inQty: isIn ? qty : 0, outQty: isIn ? 0 : qty, balance: running, siv };
  });

  // SIV rows that appear in this item's card (for print signature blocks)
  const sivRows = rows.filter(r => r.siv);

  const fmt = (n) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader} className="no-print">
        <div>
          <h1 className="serif" style={styles.h1}>Bin Card</h1>
          <div style={{ fontSize: 13, color: '#888780' }}>Stock movement card per item</div>
        </div>
        {(businessInfo?.letterhead||businessInfo?.letterheadHtml) && <button onClick={() => setUseLHBin(v => !v)} style={{ ...styles.ghostBtn, ...(useLHBin ? { background: '#EEF2FF', color: '#3D52A0', fontWeight: 600 } : {}) }}>📃 {useLHBin ? 'Letterhead ON' : 'Use Letterhead'}</button>}
        <button onClick={() => downloadDocPDF('.print-area','bin-card.pdf')} style={styles.ghostBtn}><Download size={15}/> PDF</button>
        <button onClick={() => window.print()} style={styles.primaryBtn}>🖨 Print</button>
      </div>

      {/* Item selector */}
      <div className="no-print" style={{ ...styles.formGroup, maxWidth: 340, marginBottom: 20 }}>
        <label style={styles.label}>Select item</label>
        <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} style={styles.input}>
          {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
        </select>
      </div>

      {/* Print header */}
      <div className="print-only" style={{ marginBottom: 16 }}>
        {useLHBin && (businessInfo?.letterhead || businessInfo?.letterheadHtml || businessInfo?.letterheadFooter) && <LetterpadPrintStyle />}
        {useLHBin && <LetterheadHeader bi={businessInfo} />}
        <div style={{ display: 'flex', justifyContent: useLHBin ? 'center' : 'space-between', alignItems: 'flex-start' }}>
          {!useLHBin && <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{businessInfo.name}</div>
            <div style={{ fontSize: 12, color: '#555' }}>{businessInfo.address}</div>
          </div>}
          <div style={{ textAlign: useLHBin ? 'center' : 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 16 }}>BIN CARD</div>
            <div style={{ fontSize: 12 }}>Printed: {new Date().toLocaleDateString('en-IN')}</div>
          </div>
        </div>
        <div style={{ borderTop: '2px solid #1E2A4A', marginTop: 10, paddingTop: 8 }}>
          <strong>Item:</strong> {item?.name} &nbsp;|&nbsp; <strong>HSN:</strong> {item?.hsn || '—'} &nbsp;|&nbsp; <strong>Unit:</strong> {item?.unit || 'pcs'} &nbsp;|&nbsp; <strong>Opening Stock:</strong> {openingStock}
        </div>
      </div>

      {/* Card header (screen) */}
      {item && (
        <div style={{ background: '#F5F3EE', borderRadius: 10, padding: '12px 18px', marginBottom: 16, display: 'flex', gap: 32 }}>
          <div><div style={{ fontSize: 11, color: '#888' }}>ITEM</div><div style={{ fontWeight: 700, fontSize: 15 }}>{item.name}</div></div>
          <div><div style={{ fontSize: 11, color: '#888' }}>HSN</div><div style={{ fontWeight: 600 }}>{item.hsn || '—'}</div></div>
          <div><div style={{ fontSize: 11, color: '#888' }}>UNIT</div><div style={{ fontWeight: 600 }}>{item.unit || 'pcs'}</div></div>
          <div><div style={{ fontSize: 11, color: '#888' }}>OPENING STOCK</div><div style={{ fontWeight: 600 }}>{openingStock}</div></div>
          <div><div style={{ fontSize: 11, color: '#888' }}>CURRENT BALANCE</div><div style={{ fontWeight: 700, fontSize: 16, color: rows.length ? (rows[rows.length-1].balance <= 0 ? '#B91C1C' : '#1A7A3E') : '#1E2A4A' }}>{rows.length ? rows[rows.length-1].balance : openingStock}</div></div>
        </div>
      )}

      <table style={styles.table}>
        <thead>
          <tr>
            {['Date', 'Doc Ref', 'Type', 'IN (Qty)', 'OUT (Qty)', 'Balance', 'Rate', 'Value'].map(h => (
              <th key={h} style={{ ...styles.th, textAlign: h === 'Date' || h === 'Doc Ref' || h === 'Type' ? 'left' : 'right' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Opening balance row */}
          <tr style={{ background: '#F5F3EE' }}>
            <td style={styles.td}>—</td>
            <td style={styles.td}><span style={{ fontSize: 11, color: '#888' }}>Opening Balance</span></td>
            <td style={styles.td}>—</td>
            <td style={{ ...styles.td, textAlign: 'right' }}>—</td>
            <td style={{ ...styles.td, textAlign: 'right' }}>—</td>
            <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>{openingStock}</td>
            <td style={{ ...styles.td, textAlign: 'right' }}>—</td>
            <td style={{ ...styles.td, textAlign: 'right' }}>—</td>
          </tr>
          {rows.length === 0 && (
            <tr><td colSpan={8} style={{ ...styles.td, textAlign: 'center', color: '#888780', padding: 28 }}>No stock movements for this item yet.</td></tr>
          )}
          {rows.map((e, i) => (
            <React.Fragment key={e.id || i}>
              <tr style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8' }}>
                <td style={styles.td}>{e.date}</td>
                <td style={{ ...styles.td, fontFamily: 'monospace', fontSize: 12, color: '#C9A24B' }}>{e.sourceNumber || '—'}</td>
                <td style={styles.td}><span style={{ fontSize: 11, background: '#F0EDE6', borderRadius: 4, padding: '2px 7px' }}>{SOURCE_LABEL[e.sourceType] || e.sourceType}</span></td>
                <td style={{ ...styles.td, textAlign: 'right', color: '#1A7A3E', fontWeight: e.inQty > 0 ? 700 : 400 }}>{e.inQty > 0 ? e.inQty : '—'}</td>
                <td style={{ ...styles.td, textAlign: 'right', color: '#B91C1C', fontWeight: e.outQty > 0 ? 700 : 400 }}>{e.outQty > 0 ? e.outQty : '—'}</td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: e.balance <= 0 ? '#B91C1C' : '#1E2A4A' }}>{e.balance}</td>
                <td style={{ ...styles.td, textAlign: 'right', color: '#555' }}>{e.rate ? fmt(e.rate) : '—'}</td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 500 }}>{e.rate ? fmt(e.balance * e.rate) : '—'}</td>
              </tr>
              {/* Screen only: show Issued By / Received By for SIV entries */}
              {e.siv && (e.siv.issuedBy || e.siv.receivedBy) && (
                <tr className="no-print" style={{ background: i % 2 === 0 ? '#F9FFF9' : '#F4FBF4' }}>
                  <td colSpan={8} style={{ ...styles.td, paddingTop: 3, paddingBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 24, fontSize: 11.5, color: '#444' }}>
                      {e.siv.issuedBy && (
                        <span>
                          <span style={{ color: '#888', marginRight: 4 }}>Issued By:</span>
                          <strong>{e.siv.issuedBy}</strong>
                          <span style={{ color: '#888', marginLeft: 6 }}>{e.siv.date}</span>
                        </span>
                      )}
                      {e.siv.receivedBy && (
                        <span>
                          <span style={{ color: '#888', marginRight: 4 }}>Received By:</span>
                          <strong>{e.siv.receivedBy}</strong>
                          <span style={{ color: '#888', marginLeft: 6 }}>{e.siv.date}</span>
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {/* Print: signature blocks — one row per SIV, or generic if no SIVs */}
      <div className="print-only" style={{ marginTop: 40, borderTop: '1px solid #CCC', paddingTop: 20 }}>
        {sivRows.length > 0 ? sivRows.map((r, idx) => (
          <div key={r.id || idx} style={{ marginBottom: 24 }}>
            {sivRows.length > 1 && (
              <div style={{ fontSize: 11, fontWeight: 700, color: '#555', marginBottom: 10 }}>
                {r.sourceNumber} — {r.date}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              {[
                { label: 'Prepared By',  name: '',                     date: r.date },
                { label: 'Issued By',    name: r.siv?.issuedBy || '',  date: r.siv?.date || r.date },
                { label: 'Approved By',  name: '',                     date: r.date },
                { label: 'Received By',  name: r.siv?.receivedBy || '', date: r.siv?.date || r.date },
              ].map(({ label, name, date }) => (
                <div key={label} style={{ textAlign: 'center', minWidth: 130 }}>
                  {name && <div style={{ fontSize: 12, fontWeight: 700, color: '#1E2A4A', marginBottom: 2 }}>{name}</div>}
                  {name && <div style={{ fontSize: 10, color: '#666', marginBottom: 6 }}>{date}</div>}
                  <div style={{ borderTop: '1px solid #333', paddingTop: 4, fontSize: 11 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        )) : (
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            {['Prepared By', 'Issued By', 'Approved By', 'Received By'].map(label => (
              <div key={label} style={{ textAlign: 'center', minWidth: 130 }}>
                <div style={{ borderTop: '1px solid #333', paddingTop: 4, fontSize: 11 }}>{label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {useLHBin && businessInfo?.letterheadFooter && (
        <div className="lh-pad-footer print-only" style={{ background: '#fff' }}>
          <img src={businessInfo.letterheadFooter} alt="letterhead footer" style={{ width:'100%', display:'block' }} />
        </div>
      )}
      <style>{`.print-only { display: none; } @media print { .print-only { display: block !important; } }`}</style>
    </div>
  );
}

// ─── GRN Print ─────────────────────────────────────────────────

export function GRNPrint({ grn, businessInfo, onClose }) {
  const isTrading = businessInfo?.companyType === 'trading';
  const useLH = !!(businessInfo?.letterhead||businessInfo?.letterheadHtml);
  return (
    <div className="print-area" style={{ position:'fixed',inset:0,background:'#fff',zIndex:9999,overflowY:'auto' }}>
      <div className="no-print" style={{ display:'flex',gap:8,padding:'12px 20px',borderBottom:'1px solid #EEE',background:'#F8F6F2' }}>
        <button onClick={onClose} style={styles.ghostBtn}>← Back</button>
        <button onClick={() => window.print()} style={styles.primaryBtn}><Printer size={14}/> Print / PDF</button>
      </div>
      <div style={{ maxWidth:800,margin:'0 auto',padding:'32px 40px',fontFamily:'Arial,sans-serif',fontSize:12 }}>
        {useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml || businessInfo?.letterheadFooter) && <LetterpadPrintStyle />}
        {useLH && <LetterheadHeader bi={businessInfo} style={{marginBottom:8}} />}
        {!useLH && (
          <div style={{textAlign:'center',marginBottom:16}}>
            <div style={{fontSize:16,fontWeight:700}}>{businessInfo?.name}</div>
            <div style={{fontSize:11,color:'#555'}}>{businessInfo?.address}</div>
          </div>
        )}
        <div style={{textAlign:'center',fontSize:16,fontWeight:700,letterSpacing:1,borderTop:'2px solid #1E2A4A',borderBottom:'2px solid #1E2A4A',padding:'6px 0',marginBottom:16}}>GOODS RECEIPT NOTE</div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
          <div><strong>GRN No:</strong> {grn.number}</div>
          <div><strong>Date:</strong> {grn.date}</div>
          <div><strong>Vendor:</strong> {grn.vendorName || '—'}</div>
          <div><strong>PO Ref:</strong> {grn.poNumber || grn.poRef || '—'}</div>
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',marginBottom:16}}>
          <thead>
            <tr style={{background:'#1E2A4A',color:'#fff'}}>
              {(isTrading ? ['#','Item','Ordered Qty','Received Qty','Visual Inspection','Remarks'] : ['#','Item','Ordered Qty','Received Qty','QA Status','Remarks']).map(h => (
                <th key={h} style={{padding:'6px 8px',textAlign:'left',fontSize:11}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(grn.lines || []).map((l, i) => (
              <tr key={i} style={{borderBottom:'1px solid #EEE',background: i%2===0?'#fff':'#F9F8F5'}}>
                <td style={{padding:'5px 8px'}}>{i+1}</td>
                <td style={{padding:'5px 8px'}}>{l.itemName || l.itemId}</td>
                <td style={{padding:'5px 8px',textAlign:'center'}}>{l.orderedQty || 0}</td>
                <td style={{padding:'5px 8px',textAlign:'center'}}>{l.receivedQty || 0}</td>
                <td style={{padding:'5px 8px'}}>
                  {l.qaStatus === 'ok' ? '✅ OK' : l.qaStatus === 'notok' ? '❌ Not OK' : l.qaStatus || '—'}
                </td>
                <td style={{padding:'5px 8px'}}>{l.remarks || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {grn.notes && <div style={{marginBottom:12}}><strong>Notes:</strong> {grn.notes}</div>}
        <div style={{display:'flex',justifyContent:'space-between',marginTop:40,paddingTop:16,borderTop:'1px solid #CCC'}}>
          <div style={{textAlign:'center',minWidth:120}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Received By</div></div>
          <div style={{textAlign:'center',minWidth:120}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Checked By</div></div>
          <div style={{textAlign:'center',minWidth:120}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Authorised By</div></div>
        </div>
        {useLH && businessInfo?.letterheadFooter && <img src={businessInfo.letterheadFooter} alt="footer" style={{width:'100%',display:'block',marginTop:16}} />}
      </div>
    </div>
  );
}

// ─── Stores Issue Voucher ──────────────────────────────────────

export function StoreIssuePrint({ siv, businessInfo, onClose }) {
  const useLH = !!(businessInfo?.letterhead||businessInfo?.letterheadHtml);
  return (
    <div className="print-area" style={{ position:'fixed',inset:0,background:'#fff',zIndex:9999,overflowY:'auto' }}>
      <div className="no-print" style={{ display:'flex',gap:8,padding:'12px 20px',borderBottom:'1px solid #EEE',background:'#F8F6F2' }}>
        <button onClick={onClose} style={styles.ghostBtn}>← Back</button>
        <button onClick={() => window.print()} style={styles.primaryBtn}><Printer size={14}/> Print / PDF</button>
      </div>
      <div style={{ maxWidth:800,margin:'0 auto',padding:'32px 40px',fontFamily:'Arial,sans-serif',fontSize:12 }}>
        {useLH && <LetterheadHeader bi={businessInfo} style={{marginBottom:8}} />}
        {!useLH && (
          <div style={{textAlign:'center',marginBottom:12}}>
            <div style={{fontSize:16,fontWeight:700}}>{businessInfo?.name}</div>
            <div style={{fontSize:11,color:'#555'}}>{businessInfo?.address}</div>
          </div>
        )}
        <div style={{textAlign:'center',fontSize:15,fontWeight:700,letterSpacing:1,borderTop:'2px solid #1E2A4A',borderBottom:'2px solid #1E2A4A',padding:'6px 0',marginBottom:16}}>STORES ISSUE VOUCHER</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 24px',marginBottom:16,padding:'12px 16px',background:'#F8F6F2',borderRadius:8}}>
          <div><strong>SIV No:</strong> {siv.sivNumber}</div>
          <div><strong>Date:</strong> {siv.date}</div>
          <div><strong>Issued To / Dept:</strong> {siv.issuedTo || '—'}</div>
          <div><strong>Purpose / Ref:</strong> {siv.purpose || '—'}</div>
          {siv.projectRef && <div><strong>Project Ref:</strong> {siv.projectRef}</div>}
          {siv.productionRef && <div><strong>Production Order:</strong> {siv.productionRef}</div>}
        </div>
        <table style={{width:'100%',borderCollapse:'collapse',marginBottom:20,fontSize:11}}>
          <thead>
            <tr style={{background:'#1E2A4A',color:'#fff'}}>
              {['#','Item / Material','Unit','Qty Requested','Qty Issued','Rate','Value','Remarks'].map(h=>(
                <th key={h} style={{padding:'6px 8px',textAlign:h==='Qty Requested'||h==='Qty Issued'||h==='Rate'||h==='Value'?'right':'left'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(siv.lines||[]).map((l,i)=>(
              <tr key={i} style={{borderBottom:'1px solid #EEE',background:i%2===0?'#fff':'#F9F8F5'}}>
                <td style={{padding:'5px 8px'}}>{i+1}</td>
                <td style={{padding:'5px 8px'}}>{l.itemName}</td>
                <td style={{padding:'5px 8px'}}>{l.unit||'pcs'}</td>
                <td style={{padding:'5px 8px',textAlign:'right'}}>{l.qtyRequested||l.qty}</td>
                <td style={{padding:'5px 8px',textAlign:'right',fontWeight:600}}>{l.qty}</td>
                <td style={{padding:'5px 8px',textAlign:'right'}}>{l.rate?Number(l.rate).toFixed(2):'—'}</td>
                <td style={{padding:'5px 8px',textAlign:'right'}}>{l.rate?((parseFloat(l.qty)||0)*(parseFloat(l.rate)||0)).toFixed(2):'—'}</td>
                <td style={{padding:'5px 8px'}}>{l.remarks||''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {siv.notes && <div style={{marginBottom:16,padding:'8px 12px',background:'#F8F6F2',borderRadius:6}}><strong>Notes:</strong> {siv.notes}</div>}
        <div style={{display:'flex',justifyContent:'space-between',marginTop:40,paddingTop:16,borderTop:'1px solid #CCC'}}>
          <div style={{textAlign:'center',minWidth:130}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Requested By</div></div>
          <div style={{textAlign:'center',minWidth:130}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Issued By<br/><strong>{siv.issuedBy||''}</strong></div></div>
          <div style={{textAlign:'center',minWidth:130}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Received By<br/><strong>{siv.receivedBy||''}</strong></div></div>
          <div style={{textAlign:'center',minWidth:130}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Authorised By</div></div>
        </div>
        {useLH && businessInfo?.letterheadFooter && <img src={businessInfo.letterheadFooter} alt="footer" style={{width:'100%',display:'block',marginTop:16}} />}
      </div>
    </div>
  );
}


export function StoreIssueList({ storeIssues: allIssues, setStoreIssues, items, setStockLedger, userRole, businessInfo, productionOrders = [], setNotifications, user, currentBizType = 'trading', isMultiBiz = false }) {
  const [editing, setEditing] = useState(null);
  const [printSiv, setPrintSiv] = useState(null);
  const canEdit = ['admin','manager','inventory','purchase'].includes(userRole);

  // Display: filter by current division; save operations use functional updater on full array
  const storeIssues = isMultiBiz ? (allIssues || []).filter(s => (s.bizType || 'trading') === currentBizType) : (allIssues || []);

  function nextNumber() {
    const nums = storeIssues.map(s=>parseInt((s.sivNumber||'').replace(/\D/g,''))||0);
    return `SIV-${String(Math.max(0,...nums)+1).padStart(4,'0')}`;
  }
  function blank() {
    return { id:'', sivNumber:nextNumber(), date:new Date().toISOString().slice(0,10), issuedTo:'', purpose:'', projectRef:'', productionRef:'', lines:[], issuedBy:'', receivedBy:'', notes:'', approvalStatus:'draft', approvalNote:'' };
  }
  function blankLine() { return { id:crypto.randomUUID(), itemId:'', itemName:'', unit:'pcs', qtyRequested:1, qty:1, rate:0, remarks:'' }; }

  function saveSIV(siv) {
    const isNew = !storeIssues.find(s=>s.id===siv.id);
    const rec = { ...siv, bizType: currentBizType, id:siv.id||crypto.randomUUID(), approvalStatus:siv.approvalStatus||'draft', approvalNote:siv.approvalNote||'', updatedAt:Date.now() };
    // Create OUT stock ledger entries
    const now = new Date().toISOString();
    const newEntries = (rec.lines||[]).filter(l=>l.itemId&&l.qty>0).map(l=>({
      id: crypto.randomUUID(), date: rec.date, itemId: l.itemId, itemName: l.itemName,
      type: 'out', qty: parseFloat(l.qty)||0, rate: parseFloat(l.rate)||0,
      sourceType: 'siv', sourceId: rec.id, sourceNumber: rec.sivNumber, createdAt: now,
      bizType: currentBizType,
    }));
    setStockLedger(prev => [...prev.filter(e=>e.sourceId!==rec.id), ...newEntries]);
    setStoreIssues(prev => isNew ? [rec,...prev] : prev.map(s=>s.id===rec.id?rec:s));
    setEditing(null);
  }

  function deleteSIV(id) {
    if (!window.confirm('Delete this SIV? Stock ledger entries will be removed.')) return;
    setStockLedger(prev => prev.filter(e=>e.sourceId!==id));
    setStoreIssues(prev => prev.filter(s=>s.id!==id));
  }

  function updateApproval(id, patch) {
    setStoreIssues(prev => prev.map(s => {
      if (s.id !== id) return s;
      // Push notification when status changes
      if (setNotifications && patch.status !== s.approvalStatus) {
        const label = `SIV ${s.sivNumber}`;
        if (patch.status === 'submitted') {
          setNotifications(p => [{
            id: crypto.randomUUID(), createdAt: Date.now(), read: false,
            type: 'approval_request', forRole: 'admin',
            title: `Approval needed: ${label}`,
            message: `Stores Issue Voucher forwarded by ${user?.email || 'staff'} — awaiting approval.`,
          }, ...p]);
        } else if (patch.status === 'approved') {
          setNotifications(p => [{
            id: crypto.randomUUID(), createdAt: Date.now(), read: false,
            type: 'approved', forRole: 'all',
            title: `Approved: ${label}`,
            message: `${label} — Issued to ${s.issuedTo || '—'} has been approved.`,
          }, ...p]);
        } else if (patch.status === 'rejected') {
          setNotifications(p => [{
            id: crypto.randomUUID(), createdAt: Date.now(), read: false,
            type: 'rejected', forRole: 'all',
            title: `Rejected: ${label}`,
            message: patch.rejectionNote || 'SIV was rejected.',
          }, ...p]);
        }
      }
      return { ...s, approvalStatus: patch.status, approvalNote: patch.rejectionNote || '' };
    }));
  }

  // ── FORM ────────────────────────────────────────────────────────
  if (editing) {
    const s = editing;
    const set = (k,v)=>setEditing(p=>({...p,[k]:v}));
    const setLine = (idx,k,v)=>set('lines',s.lines.map((l,i)=>i===idx?{...l,[k]:v}:l));
    return (
      <div style={{ maxWidth:820, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{s.id?'Edit':'New'} Stores Issue Voucher — {s.sivNumber}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:14 }}>
          {/* Header grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>SIV Number</label><input value={s.sivNumber} onChange={e=>set('sivNumber',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Date</label><input type="date" value={s.date} onChange={e=>set('date',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Issued To / Dept</label><input value={s.issuedTo||''} onChange={e=>set('issuedTo',e.target.value)} style={styles.input} placeholder="Dept or person name"/></div>
            <div style={styles.formGroup}><label style={styles.label}>Purpose</label><input value={s.purpose||''} onChange={e=>set('purpose',e.target.value)} style={styles.input} placeholder="e.g. Site consumption, production"/></div>
            <div style={styles.formGroup}><label style={styles.label}>Project Ref</label><input value={s.projectRef||''} onChange={e=>set('projectRef',e.target.value)} style={styles.input} placeholder="Project name or number"/></div>
            <div style={styles.formGroup}><label style={styles.label}>Production Order Ref</label>
              <select value={s.productionRef||''} onChange={e=>set('productionRef',e.target.value)} style={styles.input}>
                <option value=''>None</option>
                {productionOrders.map(o=><option key={o.id} value={o.number}>{o.number}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Issued By</label><input value={s.issuedBy||''} onChange={e=>set('issuedBy',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Received By</label><input value={s.receivedBy||''} onChange={e=>set('receivedBy',e.target.value)} style={styles.input}/></div>
          </div>
          {/* Lines */}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:8, textTransform:'uppercase' }}>Items to Issue</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:'#F8F7F4' }}>
                {['Item','Unit','Qty Requested','Qty Issued','Rate (opt.)','Remarks',''].map(h=>(
                  <th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {(s.lines||[]).map((l,i)=>(
                  <tr key={l.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                    <td style={{ padding:'4px 4px' }}>
                      <select value={l.itemId||''} onChange={e=>{
                        const it = items.find(x=>x.id===e.target.value);
                        set('lines', s.lines.map((ln,j)=>j!==i?ln:{
                          ...ln,
                          itemId: e.target.value,
                          itemName: it ? it.name : '',
                          unit: it ? (it.unit||'pcs') : ln.unit,
                          rate: it ? (parseFloat(it.purchaseRate)||parseFloat(it.saleRate)||0) : ln.rate,
                        }));
                      }} style={{ ...styles.input, margin:0, minWidth:160, fontSize:12 }}>
                        <option value=''>Select item</option>
                        {items.map(it=><option key={it.id} value={it.id}>{it.itemCode ? `[${it.itemCode}] ` : ''}{it.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding:'4px 4px', width:70 }}><input value={l.unit||'pcs'} onChange={e=>setLine(i,'unit',e.target.value)} style={{ ...styles.input, margin:0, fontSize:12 }}/></td>
                    <td style={{ padding:'4px 4px', width:90 }}><input type="number" value={l.qtyRequested||1} onChange={e=>setLine(i,'qtyRequested',e.target.value)} style={{ ...styles.input, margin:0, fontSize:12, textAlign:'right' }}/></td>
                    <td style={{ padding:'4px 4px', width:90 }}><input type="number" value={l.qty||1} onChange={e=>setLine(i,'qty',e.target.value)} style={{ ...styles.input, margin:0, fontSize:12, textAlign:'right', background:'#FFFBE6' }}/></td>
                    <td style={{ padding:'4px 4px', width:90 }}><input type="number" value={l.rate||0} onChange={e=>setLine(i,'rate',e.target.value)} style={{ ...styles.input, margin:0, fontSize:12, textAlign:'right' }}/></td>
                    <td style={{ padding:'4px 4px' }}><input value={l.remarks||''} onChange={e=>setLine(i,'remarks',e.target.value)} style={{ ...styles.input, margin:0, fontSize:12 }} placeholder="Remarks"/></td>
                    <td style={{ padding:'4px 4px', width:28 }}><button onClick={()=>set('lines',s.lines.filter((_,j)=>j!==i))} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={13}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={()=>set('lines',[...(s.lines||[]),blankLine()])} style={{ ...styles.ghostBtn, marginTop:8, fontSize:12 }}><Plus size={13}/> Add Item</button>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Notes</label><textarea value={s.notes||''} onChange={e=>set('notes',e.target.value)} style={{ ...styles.input, height:56 }}/></div>
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end', borderTop:'1px solid #EAE6DB', paddingTop:14 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>saveSIV(s)} style={styles.primaryBtn} disabled={!s.lines?.some(l=>l.itemId&&l.qty>0)}>Save SIV</button>
          </div>
        </div>
      </div>
    );
  }

  // ── LIST ────────────────────────────────────────────────────────
  return (
    <div style={styles.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 }}>
        <div>
          <h1 className="serif" style={styles.h1}>Stores Issue Vouchers</h1>
          <p style={styles.muted}>Track material outflows from stores. Each SIV auto-creates OUT entries in the stock ledger and bin card.</p>
        </div>
        {canEdit && <button onClick={()=>setEditing(blank())} style={styles.primaryBtn}><Plus size={15}/> New SIV</button>}
      </div>
      {storeIssues.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#888', background:'#fff', borderRadius:10, border:'1px solid #EAE6DB' }}>
          <FileMinus size={36} style={{ color:'#DDD', marginBottom:12 }}/><br/>No issue vouchers yet.<br/>
          <span style={{ fontSize:12 }}>Create one to issue materials from stores — it will automatically update the bin card with OUT entries.</span>
        </div>
      ) : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4' }}>
              {['SIV No.','Date','Issued To','Purpose','Items','Approval',''].map(h=>(
                <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {[...storeIssues].sort((a,b)=>b.date>a.date?1:-1).map(s=>(
                <tr key={s.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                  <td style={{ padding:'10px 12px', fontWeight:700, color:'#1E2A4A' }}>{s.sivNumber}</td>
                  <td style={{ padding:'10px 12px', color:'#555' }}>{s.date}</td>
                  <td style={{ padding:'10px 12px', color:'#333' }}>{s.issuedTo||'—'}</td>
                  <td style={{ padding:'10px 12px', color:'#555', fontSize:12 }}>{s.purpose||s.projectRef||s.productionRef||'—'}</td>
                  <td style={{ padding:'10px 12px', color:'#555' }}>
                    {(s.lines||[]).length} item{(s.lines||[]).length!==1?'s':''}
                    {(s.lines||[]).length>0 && <div style={{ fontSize:11, color:'#888' }}>{(s.lines||[]).slice(0,2).map(l=>l.itemName).filter(Boolean).join(', ')}{(s.lines||[]).length>2?' …':''}</div>}
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:5, flexWrap:'wrap', alignItems:'center' }}>
                      <StatusBadge status={s.approvalStatus||'draft'} />
                      <ApprovalActions item={{ status:s.approvalStatus||'draft', rejectionNote:s.approvalNote||'' }} onUpdate={(patch)=>updateApproval(s.id,patch)} userRole={userRole} compact />
                    </div>
                    {s.approvalStatus==='rejected' && s.approvalNote && <div style={{ fontSize:11, color:'#B5453A', marginTop:3, fontStyle:'italic' }}>"{s.approvalNote}"</div>}
                  </td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:6 }}>
                      <button onClick={()=>setPrintSiv(s)} style={styles.iconBtn} title="Print"><Printer size={14}/></button>
                      {canEdit && s.approvalStatus!=='submitted' && <><button onClick={()=>setEditing(s)} style={styles.iconBtn}><Pencil size={14}/></button>
                      <button onClick={()=>deleteSIV(s.id)} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button></>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {printSiv && <StoreIssuePrint siv={printSiv} businessInfo={businessInfo} onClose={()=>setPrintSiv(null)} />}
    </div>
  );
}

// ─── GRN ───────────────────────────────────────────────────────


export function GRNList({ grns: allGrns, setGrns, documents, vendors, items, setStockLedger, userRole, businessInfo, currentBizType = 'trading', isMultiBiz = false }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [printGrn, setPrintGrn] = useState(null);
  const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'inventory' || userRole === 'purchase';

  // Display: filter by current division in multi-biz mode; save operations use allGrns
  const grns = isMultiBiz ? (allGrns || []).filter(g => (g.bizType || 'trading') === currentBizType) : (allGrns || []);
  const poList = (documents || []).filter(d => d.type === 'purchase');

  function nextGRN() {
    const nums = grns.map(g => parseInt((g.number || '').replace(/\D/g,'')) || 0);
    return 'GRN-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(4, '0');
  }

  function updateGRNStatus(id, patch) {
    setGrns((allGrns || []).map(g => g.id === id ? { ...g, ...patch } : g));
  }

  function saveGRN(grn) {
    const isNew = !(allGrns || []).find(g => g.id === grn.id);
    let updated;
    if (isNew) {
      const newGrn = { ...grn, bizType: currentBizType, id: crypto.randomUUID(), createdAt: Date.now(), status: 'draft', rejectionNote: '' };
      updated = [newGrn, ...(allGrns || [])];
      // Only create stock IN entries for QA-accepted / visually OK lines
      if (setStockLedger) {
        const entries = (grn.lines || [])
          .filter(l => l.itemId && parseFloat(l.acceptedQty || l.receivedQty) > 0 && l.qaStatus !== 'rejected' && l.qaStatus !== 'notok')
          .map(l => {
            const it = items.find(i => i.id === l.itemId);
            const acceptedQty = (l.qaStatus === 'inprocess' || l.qaStatus === 'ok')
              ? parseFloat(l.receivedQty) || 0   // ok/inprocess → take full receivedQty
              : parseFloat(l.acceptedQty) || 0;   // accepted → take acceptedQty
            return {
              id: crypto.randomUUID(), date: grn.date, itemId: l.itemId,
              itemName: it ? it.name : l.itemName,
              type: 'in', qty: acceptedQty,
              rate: parseFloat(l.rate) || 0,
              sourceType: 'grn', sourceId: newGrn.id, sourceNumber: newGrn.number, createdAt: Date.now(),
              bizType: currentBizType,
            };
          });
        if (entries.length) setStockLedger(prev => [...prev, ...entries]);
      }
    } else {
      updated = (allGrns || []).map(g => g.id === grn.id ? grn : g);
    }
    setGrns(updated);
    setShowForm(false); setEditing(null);
  }

  function deleteGRN(id) {
    if (!window.confirm('Delete this GRN? Stock entries will be removed.')) return;
    setGrns((allGrns || []).filter(g => g.id !== id));
    if (setStockLedger) setStockLedger(prev => prev.filter(e => e.sourceId !== id));
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>Goods Receipt Notes</h2>
          <div style={{ fontSize: 13, color: '#888780' }}>Record goods received against purchase orders</div>
        </div>
        {canEdit && <button style={styles.primaryBtn} onClick={() => { setEditing({ number: nextGRN(), date: new Date().toISOString().slice(0,10), poId: '', vendorName: '', lines: [] }); setShowForm(true); }}><Plus size={15} /> New GRN</button>}
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={styles.table}>
          <thead><tr>{['GRN No', 'Date', 'PO Ref', 'Vendor', 'Items Received', 'Status', ''].map(h => <th key={h} style={styles.th}>{h}</th>)}</tr></thead>
          <tbody>
            {(!grns || grns.length === 0) && <tr><td colSpan={7} style={{ ...styles.td, textAlign: 'center', color: '#888780', padding: 28 }}>No GRNs yet. Create one when goods arrive against a PO.</td></tr>}
            {(grns || []).map(g => {
              const po = poList.find(p => p.id === g.poId);
              const vendor = vendors.find(v => v.id === (po ? po.customerId : ''));
              const lines = g.lines || [];
              const isTrading = businessInfo?.companyType === 'trading';
              // Trading: ok/notok; Manufacturing: accepted/rejected/inprocess
              const okCount       = lines.filter(l => l.qaStatus === 'ok' || l.qaStatus === 'accepted').length;
              const notOkCount    = lines.filter(l => l.qaStatus === 'notok' || l.qaStatus === 'rejected').length;
              const inprocess     = lines.filter(l => !l.qaStatus || l.qaStatus === 'inprocess').length;
              const qaChip = (label, count, color) => count > 0 ? (
                <span key={label} style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10, background: color + '22', color }}>{count} {label}</span>
              ) : null;
              return (
                <tr key={g.id}>
                  <td style={{ ...styles.td, fontFamily: 'monospace', color: '#C9A24B', fontWeight: 600 }}>{g.number}</td>
                  <td style={styles.td}>{g.date}</td>
                  <td style={styles.td}>{po ? <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{po.number}</span> : '—'}</td>
                  <td style={{ ...styles.td, fontWeight: 500 }}>{g.vendorName || (vendor ? vendor.name : '—')}</td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {qaChip(isTrading ? 'OK' : 'Accepted', okCount, '#1A7A3E')}
                      {qaChip(isTrading ? 'Not OK' : 'Rejected', notOkCount, '#B91C1C')}
                      {!isTrading && qaChip('In-process', inprocess, '#C9A24B')}
                      {isTrading && inprocess > 0 && qaChip('Pending', inprocess, '#C9A24B')}
                      {lines.length === 0 && <span style={{ color: '#888', fontSize: 12 }}>0 lines</span>}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <StatusBadge status={g.status || 'draft'} />
                    <ApprovalActions item={g} onUpdate={(patch) => updateGRNStatus(g.id, patch)} userRole={userRole} compact />
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button style={styles.iconBtn} onClick={() => setPrintGrn(g)} title="Print GRN"><Printer size={14} /></button>
                      {canEdit && g.status !== 'submitted' && <button style={styles.iconBtn} onClick={() => { setEditing(g); setShowForm(true); }}>✏️</button>}
                      {canEdit && g.status !== 'submitted' && <button style={{ ...styles.iconBtn, color: '#E08A7D' }} onClick={() => deleteGRN(g.id)}><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {showForm && (
        <GRNForm grn={editing} poList={poList} vendors={vendors} items={items} businessInfo={businessInfo} onSave={saveGRN} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
      {printGrn && <GRNPrint grn={printGrn} businessInfo={businessInfo} onClose={() => setPrintGrn(null)} />}
    </div>
  );
}


export function GRNForm({ grn, poList, vendors, items, businessInfo, onSave, onClose }) {
  const [form, setForm] = useState({ lines: [], ...grn });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const isTrading = businessInfo?.companyType === 'trading';

  function selectPO(poId) {
    const po = poList.find(p => p.id === poId);
    if (!po) { set('poId', poId); return; }
    const vendor = vendors.find(v => v.id === po.customerId);
    const lines = (po.items || []).map(it => ({
      itemId: it.itemId || '',
      itemName: it.name,
      orderedQty: parseFloat(it.qty) || 0,
      receivedQty: parseFloat(it.qty) || 0,
      rate: parseFloat(it.rate) || 0,
    }));
    setForm(p => ({ ...p, poId, poNumber: po.number, vendorName: vendor ? vendor.name : '', lines }));
  }

  function updateLine(idx, key, val) {
    setForm(p => ({ ...p, lines: p.lines.map((l, i) => i === idx ? { ...l, [key]: val } : l) }));
  }

  function addLine() {
    const defaultQa = isTrading ? 'ok' : 'inprocess';
    setForm(p => ({ ...p, lines: [...p.lines, { itemId: '', itemName: '', orderedQty: 0, receivedQty: 0, acceptedQty: 0, rejectedQty: 0, rate: 0, qaStatus: defaultQa, qaComments: '' }] }));
  }

  // Manufacturing QA
  const qaColor = { accepted: '#1A7A3E', rejected: '#B91C1C', inprocess: '#C9A24B' };
  const qaLabel = { accepted: 'Accepted', rejected: 'Rejected', inprocess: 'In-process' };
  // Trading inspection
  const inspColor = { ok: '#1A7A3E', notok: '#B91C1C' };

  return (
    <Modal title={grn && grn.id ? 'Edit GRN' : 'New Goods Receipt Note'} onClose={onClose} wide>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
        <div style={{ ...styles.formGroup, flex: 1 }}>
          <label style={styles.label}>GRN Number</label>
          <input value={form.number} onChange={e => set('number', e.target.value)} style={styles.input} />
        </div>
        <div style={{ ...styles.formGroup, flex: 1 }}>
          <label style={styles.label}>Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={styles.input} />
        </div>
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Link to Purchase Order (optional)</label>
        <select value={form.poId} onChange={e => selectPO(e.target.value)} style={styles.input}>
          <option value="">— No PO link —</option>
          {poList.map(po => { const v = vendors.find(x => x.id === po.customerId); return <option key={po.id} value={po.id}>{po.number} {v ? '· ' + v.name : ''}</option>; })}
        </select>
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Vendor name</label>
        <input value={form.vendorName} onChange={e => set('vendorName', e.target.value)} style={styles.input} />
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: '#C9A24B', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8, marginTop: 4 }}>
        {isTrading ? 'Items Received — Visual Inspection' : 'Items Received — QA Inspection'}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 10 }}>
          <thead><tr style={{ background: '#F5F3EE' }}>
            {(isTrading
              ? ['Item', 'Ord.Qty', 'Rcvd.Qty', 'Rate', 'Visual Inspection', 'Remarks', '']
              : ['Item', 'Ord.Qty', 'Rcvd.Qty', 'Rate', 'QA Status', 'Accepted Qty', 'Rejected Qty', 'QA Comments', '']
            ).map(h => (
              <th key={h} style={{ ...styles.th, fontSize: 10, whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {form.lines.map((l, i) => {
              const qa = l.qaStatus || (isTrading ? 'ok' : 'inprocess');
              const rowBg = isTrading
                ? (qa === 'ok' ? '#F0FFF4' : '#FFF5F5')
                : (qa === 'accepted' ? '#F0FFF4' : qa === 'rejected' ? '#FFF5F5' : '#FFFDF0');
              return (
                <tr key={i} style={{ background: rowBg }}>
                  <td style={styles.td}>
                    <select value={l.itemId} onChange={e => { const it = items.find(x => x.id === e.target.value); updateLine(i, 'itemId', e.target.value); if(it) { updateLine(i, 'itemName', it.name); updateLine(i, 'rate', it.purchaseRate ?? it.rate ?? 0); } }} style={{ ...styles.input, fontSize: 11, minWidth: 120 }}>
                      <option value="">Select item</option>
                      {items.map(it => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </select>
                  </td>
                  <td style={styles.td}><input type="number" value={l.orderedQty} onChange={e => updateLine(i, 'orderedQty', e.target.value)} style={{ ...styles.input, width: 65, textAlign: 'right', fontSize: 12 }} /></td>
                  <td style={styles.td}><input type="number" value={l.receivedQty} onChange={e => { updateLine(i, 'receivedQty', e.target.value); if (!isTrading && qa === 'inprocess') updateLine(i, 'acceptedQty', e.target.value); }} style={{ ...styles.input, width: 65, textAlign: 'right', fontSize: 12, background: '#EAF3DE' }} /></td>
                  <td style={styles.td}><input type="number" value={l.rate} onChange={e => updateLine(i, 'rate', e.target.value)} style={{ ...styles.input, width: 75, textAlign: 'right', fontSize: 12 }} /></td>
                  <td style={styles.td}>
                    {isTrading ? (
                      <select value={qa} onChange={e => updateLine(i, 'qaStatus', e.target.value)}
                        style={{ ...styles.input, fontSize: 11, color: inspColor[qa] || '#555', fontWeight: 600, minWidth: 100 }}>
                        <option value="ok">✅ OK</option>
                        <option value="notok">❌ Not OK</option>
                      </select>
                    ) : (
                      <select value={qa} onChange={e => {
                        const s = e.target.value;
                        updateLine(i, 'qaStatus', s);
                        if (s === 'accepted') { updateLine(i, 'acceptedQty', l.receivedQty); updateLine(i, 'rejectedQty', 0); }
                        if (s === 'rejected') { updateLine(i, 'acceptedQty', 0); updateLine(i, 'rejectedQty', l.receivedQty); }
                      }} style={{ ...styles.input, fontSize: 11, color: qaColor[qa], fontWeight: 600, minWidth: 100 }}>
                        <option value="inprocess">⏳ In-process</option>
                        <option value="accepted">✅ Accepted</option>
                        <option value="rejected">❌ Rejected</option>
                      </select>
                    )}
                  </td>
                  {isTrading ? (
                    <td style={styles.td}><input value={l.qaComments || ''} onChange={e => updateLine(i, 'qaComments', e.target.value)} placeholder="Remarks…" style={{ ...styles.input, fontSize: 11, minWidth: 130 }} /></td>
                  ) : (
                    <>
                      <td style={styles.td}><input type="number" value={l.acceptedQty ?? 0} onChange={e => updateLine(i, 'acceptedQty', e.target.value)} style={{ ...styles.input, width: 65, textAlign: 'right', fontSize: 12, background: '#EAF3DE', color: '#1A7A3E', fontWeight: 600 }} /></td>
                      <td style={styles.td}><input type="number" value={l.rejectedQty ?? 0} onChange={e => updateLine(i, 'rejectedQty', e.target.value)} style={{ ...styles.input, width: 65, textAlign: 'right', fontSize: 12, background: '#FFEAEA', color: '#B91C1C', fontWeight: 600 }} /></td>
                      <td style={styles.td}><input value={l.qaComments || ''} onChange={e => updateLine(i, 'qaComments', e.target.value)} placeholder="Notes…" style={{ ...styles.input, fontSize: 11, minWidth: 130 }} /></td>
                    </>
                  )}
                  <td style={styles.td}><button onClick={() => setForm(p => ({ ...p, lines: p.lines.filter((_, j) => j !== i) }))} style={styles.iconBtn}><Trash2 size={13} color="#B5453A" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button onClick={addLine} style={{ ...styles.ghostBtn, fontSize: 12.5, marginBottom: 16 }}><Plus size={13} /> Add line</button>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={() => onSave(form)}>Save GRN</button>
      </div>
    </Modal>
  );
}

// ─── HR ────────────────────────────────────────────────────────


export const ENQ_STATUSES = ['Open', 'Contacted', 'Quoted', 'Won', 'Lost'];

export const ENQ_STATUS_COLOR = {
  Open:      '#2255A0',
  Contacted: '#C9A24B',
  Quoted:    '#6B5BAE',
  Won:       '#1A7A3E',
  Lost:      '#B5453A',
};


export function EnquiryForm({ enq, customers, onSave, onClose }) {
  const blank = {
    id: crypto.randomUUID(),
    number: '',
    date: new Date().toISOString().slice(0, 10),
    customerId: '',
    customerName: '',
    interest: '',
    followUpDate: '',
    assignedTo: '',
    status: 'Open',
    notes: '',
  };
  const [form, setForm] = useState(enq || blank);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{enq ? 'Edit Enquiry' : 'New Enquiry'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#666' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Enquiry No.</label>
            <input value={form.number} onChange={e => set('number', e.target.value)} placeholder="ENQ-001 (auto)"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Date</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Customer</label>
            <select value={form.customerId} onChange={e => {
              const c = customers.find(x => x.id === e.target.value);
              set('customerId', e.target.value);
              if (c) set('customerName', c.name);
            }} style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}>
              <option value="">-- Select or type below --</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!form.customerId && (
              <input value={form.customerName} onChange={e => set('customerName', e.target.value)} placeholder="Or enter customer name manually"
                style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, marginTop: 6, boxSizing: 'border-box' }} />
            )}
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Product / Service Interest</label>
            <input value={form.interest} onChange={e => set('interest', e.target.value)} placeholder="e.g. Hydraulic cylinder, Annual maintenance..."
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Follow-up Date</label>
            <input type="date" value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Assigned To</label>
            <input value={form.assignedTo} onChange={e => set('assignedTo', e.target.value)} placeholder="Name or team"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }} />
          </div>

          <div>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, boxSizing: 'border-box' }}>
              {ENQ_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3} placeholder="Additional details, requirements..."
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', border: '1px solid #ddd', background: '#fff', borderRadius: 7, cursor: 'pointer', fontSize: 14 }}>Cancel</button>
          <button onClick={() => onSave(form)} style={{ padding: '9px 22px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>Save</button>
        </div>
      </div>
    </div>
  );
}


export function EnquiryList({ enquiries, setEnquiries, customers, userRole, currentBizType = 'trading', isMultiBiz = false, onConvertToQuotation }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  // In multi-biz mode, show only this division's enquiries
  const bizEnquiries = isMultiBiz
    ? enquiries.filter(e => (e.bizType || 'trading') === currentBizType)
    : enquiries;

  // Auto-generate ENQ number (per-division counter in multi-biz)
  function nextEnqNumber() {
    if (!bizEnquiries.length) return 'ENQ-001';
    const nums = bizEnquiries.map(e => parseInt((e.number || '').replace(/\D/g, '')) || 0);
    return 'ENQ-' + String(Math.max(...nums) + 1).padStart(3, '0');
  }

  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(enq) {
    setEditing(enq);
    setModalOpen(true);
  }

  function handleSave(form) {
    if (!form.number) form.number = nextEnqNumber();
    // Always stamp the current division's bizType on save
    const saved = { ...form, bizType: currentBizType };
    if (editing) {
      setEnquiries(prev => prev.map(e => e.id === saved.id ? saved : e));
    } else {
      setEnquiries(prev => [...prev, saved]);
    }
    setModalOpen(false);
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this enquiry?')) return;
    setEnquiries(prev => prev.filter(e => e.id !== id));
  }

  const filtered = bizEnquiries.filter(e => {
    const cust = customers.find(c => c.id === e.customerId);
    const name = cust ? cust.name : (e.customerName || '');
    const text = `${e.number} ${name} ${e.interest} ${e.assignedTo}`.toLowerCase();
    const matchSearch = text.includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Summary counts
  const counts = {};
  ENQ_STATUSES.forEach(s => { counts[s] = bizEnquiries.filter(e => e.status === s).length; });

  return (
    <div style={{ padding: 28 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Enquiry List</h2>
          <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>{bizEnquiries.length} total enquiries</p>
        </div>
        {(userRole === 'admin' || userRole === 'manager' || userRole === 'sales') && (
          <button onClick={openNew} style={{ padding: '9px 20px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
            + New Enquiry
          </button>
        )}
      </div>

      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {['All', ...ENQ_STATUSES].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: '6px 16px', borderRadius: 20, border: `2px solid ${s === 'All' ? '#1E2A4A' : ENQ_STATUS_COLOR[s] || '#1E2A4A'}`,
              background: filterStatus === s ? (s === 'All' ? '#1E2A4A' : ENQ_STATUS_COLOR[s]) : '#fff',
              color: filterStatus === s ? '#fff' : '#333', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
            {s} {s !== 'All' ? `(${counts[s] || 0})` : `(${bizEnquiries.length})`}
          </button>
        ))}
      </div>

      {/* Search */}
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by number, customer, product, assigned to..."
        style={{ width: '100%', padding: '9px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, marginBottom: 16, boxSizing: 'border-box' }} />

      {/* Table */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#aaa' }}>
          <p style={{ fontSize: 16 }}>No enquiries found</p>
          <button onClick={openNew} style={{ marginTop: 12, padding: '9px 22px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14 }}>Create First Enquiry</button>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fb', borderBottom: '1px solid #e5e7eb' }}>
                {['Enq No.', 'Date', 'Customer', 'Interest', 'Follow-up', 'Assigned To', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#666', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((enq, idx) => {
                const cust = customers.find(c => c.id === enq.customerId);
                const custName = cust ? cust.name : (enq.customerName || '—');
                const isOverdue = enq.followUpDate && enq.followUpDate < new Date().toISOString().slice(0, 10) && enq.status === 'Open';
                return (
                  <tr key={enq.id} style={{ borderBottom: '1px solid #f0f0f0', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#1E2A4A', fontSize: 13 }}>{enq.number}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#555' }}>{enq.date}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13 }}>{custName}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{enq.interest}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: isOverdue ? '#B5453A' : '#555', fontWeight: isOverdue ? 600 : 400 }}>
                      {enq.followUpDate || '—'}{isOverdue && ' ⚠'}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: '#555' }}>{enq.assignedTo || '—'}</td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                        background: (ENQ_STATUS_COLOR[enq.status] || '#888') + '22',
                        color: ENQ_STATUS_COLOR[enq.status] || '#888' }}>
                        {enq.status}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                      <button onClick={() => openEdit(enq)} style={{ padding: '4px 10px', border: '1px solid #ddd', background: '#fff', borderRadius: 5, cursor: 'pointer', fontSize: 12, marginRight: 6 }}>Edit</button>
                      {enq.status !== 'Lost' && onConvertToQuotation && (
                        <button onClick={() => onConvertToQuotation(enq)}
                          style={{ padding: '4px 10px', border: '1px solid #C9A24B', background: '#fffbf0', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: '#9a7a2a', marginRight: 6, fontWeight: 600 }}>
                          → Quotation
                        </button>
                      )}
                      {userRole === 'admin' && (
                        <button onClick={() => handleDelete(enq.id)} style={{ padding: '4px 10px', border: '1px solid #fca5a5', background: '#fff', borderRadius: 5, cursor: 'pointer', fontSize: 12, color: '#B5453A' }}>Del</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <EnquiryForm
          enq={editing}
          customers={customers}
          onSave={handleSave}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Terms Library ────────────────────────────────────────────────────────────

export const CLAUSE_CATEGORIES = ['Payment', 'Delivery', 'Warranty', 'Liability', 'Force Majeure', 'Confidentiality', 'Termination', 'Dispute Resolution', 'Other'];


export const DEFAULT_PO_CLAUSES = [
  { id:'dc1',  category:'Other',            title:'Clause 1: Scope of Supply',                        text:'1.1 The Supplier shall design, manufacture, supply, inspect, test, pack, and deliver the equipment/materials as detailed in the Purchase Order (PO) and its annexures, which form an integral part of this PO.\n1.2 The scope includes all necessary accessories, fittings, hardware, documentation, drawings, operation & maintenance manuals, and test certificates as applicable.\n1.3 Any item not explicitly mentioned but necessary to complete the intended function of the supplied equipment shall be deemed included in the scope at no extra cost.\n1.4 Deviations from the scope, if any, shall only be accepted in writing from the authorised representative of the Buyer prior to execution.' },
  { id:'dc2',  category:'Payment',          title:'Clause 2: Payment Terms',                          text:'2.1 Payment shall be made as per the schedule defined in the PO. Typical structure: 30% advance against Bank Guarantee, 60% against dispatch documents, 10% after successful commissioning and acceptance.\n2.2 All invoices shall be submitted with supporting documents including dispatch advice, inspection report, test certificates, and packing list.\n2.3 Payment shall be released within 30 days of receipt of invoice subject to verification and acceptance of documents.\n2.4 The Supplier shall submit a Bank Guarantee (BG) for advance payment, valid until delivery and acceptance.\n2.5 Taxes and duties shall be paid as applicable and indicated separately on the invoice as per prevailing statutory requirements.' },
  { id:'dc3',  category:'Delivery',         title:'Clause 3: Delivery',                               text:'3.1 The Supplier shall deliver the goods to the destination specified in the PO within the agreed delivery schedule.\n3.2 Time is of the essence. Any delay beyond the agreed delivery date shall attract Liquidated Damages as per Clause 6.\n3.3 Partial deliveries are permitted only with prior written approval from the Buyer.\n3.4 The Supplier shall submit a delivery schedule within 7 days of PO placement and provide weekly updates on progress.\n3.5 Risk and title shall transfer to the Buyer upon delivery at the designated destination and acceptance by the Buyer\'s representative.' },
  { id:'dc4',  category:'Other',            title:'Clause 4: Packing & Freight',                      text:'4.1 All equipment and materials shall be packed suitably to prevent damage during transport, storage, and handling. Packing shall be sea/air-worthy as applicable.\n4.2 Each package shall be clearly marked with PO number, item description, gross/net weight, dimensions, and handling instructions (e.g., "Fragile", "This Side Up").\n4.3 Freight shall be on FOR/CIF/DDP basis as specified in the PO. Unless otherwise stated, all freight, insurance, and handling charges are included in the PO price.\n4.4 A detailed packing list and material dispatch advice (MDA) shall be submitted to the Buyer prior to or at the time of dispatch.\n4.5 Any loss or damage due to inadequate packing shall be borne entirely by the Supplier.' },
  { id:'dc5',  category:'Other',            title:'Clause 5: Technical Terms',                        text:'5.1 All equipment shall strictly conform to the technical specifications, standards, and drawings referenced in the PO or its annexures.\n5.2 The Supplier shall comply with applicable national and international standards (IS, IEC, ISO, ASME, etc.) as specified.\n5.3 Any change in design, material, or specifications shall require prior written approval from the Buyer\'s engineering team.\n5.4 The Supplier shall provide detailed engineering drawings, GA drawings, wiring diagrams, and documentation for Buyer\'s review and approval before commencing manufacturing.\n5.5 The equipment shall be designed for the site conditions (temperature, humidity, power supply, etc.) as specified in the technical specification document.' },
  { id:'dc6',  category:'Liability',        title:'Clause 6: Liquidated Damages (Delay Penalty)',     text:'6.1 In the event of delay in delivery beyond the agreed schedule, the Supplier shall be liable to pay Liquidated Damages (LD) at the rate of 0.5% of the total PO value per week of delay, subject to a maximum of 5% of the total PO value.\n6.2 LD shall be deducted from the Supplier\'s pending invoices or the retention amount.\n6.3 LD shall apply unless the delay is caused by Force Majeure as defined in Clause 14 or by delays attributable to the Buyer.\n6.4 The Buyer reserves the right to cancel the PO if delay exceeds 8 weeks beyond the agreed delivery date, without prejudice to any other remedy available.' },
  { id:'dc7',  category:'Warranty',         title:'Clause 7: Performance Guarantee',                  text:'7.1 The Supplier guarantees that the equipment shall achieve the performance parameters specified in the technical specification and PO annexures.\n7.2 The Supplier shall furnish a Performance Bank Guarantee (PBG) of 10% of the PO value, valid for the warranty period plus 3 months.\n7.3 If the equipment fails to meet the specified performance parameters during commissioning or the warranty period, the Supplier shall rectify or replace at no cost to the Buyer.\n7.4 The PBG shall be returned to the Supplier upon successful completion of the warranty period, provided all obligations under the PO are fulfilled.' },
  { id:'dc8',  category:'Other',            title:'Clause 8: Spare Parts & Service Support',          text:'8.1 The Supplier shall provide a recommended list of spare parts (consumable and critical) along with unit prices, valid for at least 2 years from the date of supply.\n8.2 The Supplier shall guarantee availability of spare parts for a minimum period of 10 years from the date of commissioning.\n8.3 The Supplier shall provide trained service engineers for installation, commissioning, and any warranty-related repairs at site.\n8.4 Emergency service support shall be made available within 48 hours of intimation.\n8.5 Operation & Maintenance (O&M) manuals, spare parts catalogue, and as-built drawings shall be provided in both hard copy and soft copy formats.' },
  { id:'dc9',  category:'Other',            title:'Clause 9: Trial & Final Acceptance',                text:'9.1 Upon completion of installation, the Supplier shall conduct trial runs of the equipment in the presence of the Buyer\'s representatives.\n9.2 The trial run period shall be as specified in the PO. During this period, the equipment shall demonstrate stable operation meeting all performance parameters.\n9.3 Final Acceptance shall be issued by the Buyer only after successful completion of the trial run and verification of all performance parameters.\n9.4 The warranty period shall commence from the date of Final Acceptance.\n9.5 Any defects or deficiencies identified during trial shall be rectified by the Supplier at no cost before Final Acceptance is granted.' },
  { id:'dc10', category:'Other',            title:'Clause 10: Factory Acceptance Test (FAT)',          text:'10.1 The equipment shall be subjected to a Factory Acceptance Test (FAT) at the Supplier\'s works prior to dispatch.\n10.2 The Buyer reserves the right to depute inspection personnel to witness the FAT. The Supplier shall provide a minimum of 14 days\' advance notice for FAT.\n10.3 FAT shall be conducted as per the agreed test procedure and shall include functional testing, performance testing, safety checks, and documentation review.\n10.4 Any non-conformances identified during FAT shall be rectified before the equipment is cleared for dispatch.\n10.5 An FAT report duly signed by both parties shall be submitted along with dispatch documents.' },
  { id:'dc11', category:'Other',            title:'Clause 11: Material Consumption & Process Efficiency', text:'11.1 The equipment shall achieve the material consumption and process efficiency figures specified in the technical specifications.\n11.2 The Supplier shall provide guaranteed figures for raw material consumption per unit output, energy consumption, water consumption, and waste generation.\n11.3 Performance tests at site shall verify these figures. Any shortfall shall be subject to price adjustment as per Clause 12.\n11.4 The Supplier shall provide process flow diagrams and material balance sheets as part of the documentation package.' },
  { id:'dc12', category:'Liability',        title:'Clause 12: Performance Shortfall & Price Adjustment', text:'12.1 If the equipment fails to achieve the guaranteed performance parameters (capacity, efficiency, consumption) during the acceptance test, a price adjustment shall be applied.\n12.2 For shortfall up to 5% of guaranteed parameters: proportionate price reduction shall be applied.\n12.3 For shortfall exceeding 5%: the Buyer reserves the right to reject the equipment or demand replacement/modification at the Supplier\'s cost.\n12.4 The price adjustment formula and tolerance bands shall be as mutually agreed and documented in the PO annexure.\n12.5 Acceptance of price adjustment by the Buyer does not relieve the Supplier of its warranty obligations.' },
  { id:'dc13', category:'Dispute Resolution',title:'Clause 13: Governing Law & Jurisdiction',         text:'13.1 This Purchase Order shall be governed by and construed in accordance with the laws of India.\n13.2 Any disputes arising out of or in connection with this PO shall first be resolved through mutual negotiation within 30 days of written notice.\n13.3 If not resolved through negotiation, disputes shall be referred to arbitration under the Arbitration and Conciliation Act, 1996.\n13.4 The seat of arbitration shall be [City], and proceedings shall be conducted in English.\n13.5 The courts of [City] shall have exclusive jurisdiction over any matters not subject to arbitration.' },
  { id:'dc14', category:'Force Majeure',    title:'Clause 14: Force Majeure',                         text:'14.1 Neither party shall be liable for delay or failure to perform obligations under this PO if such delay or failure is caused by events beyond the reasonable control of the affected party, including but not limited to acts of God, war, natural disasters, government actions, pandemics, or strikes.\n14.2 The affected party shall notify the other party in writing within 7 days of the occurrence of the Force Majeure event, providing details and estimated duration.\n14.3 The delivery schedule shall be extended by the period of Force Majeure, provided timely notice is given.\n14.4 If the Force Majeure event continues for more than 90 days, either party may terminate this PO by giving 14 days written notice.' },
  { id:'dc15', category:'Termination',      title:'Clause 15: Termination',                           text:'15.1 The Buyer may terminate this PO in whole or in part by giving 30 days written notice to the Supplier.\n15.2 In the event of termination for convenience, the Buyer shall pay for work completed up to the date of termination and reasonable documented costs incurred.\n15.3 The Buyer may terminate this PO immediately for cause if the Supplier: (a) becomes insolvent or files for bankruptcy; (b) commits a material breach that remains unrectified for 14 days after notice; (c) fails to deliver within the LD cap period.\n15.4 Upon termination, the Supplier shall promptly return any advance paid (less work completed) and hand over all work in progress, drawings, and documents related to the PO.' },
];


export function TermsLibraryView({ termsLibrary, setTermsLibrary, userRole }) {
  const [tab, setTab] = useState('clauses'); // 'clauses' | 'templates'
  const [clauseModal, setClauseModal] = useState(null); // null | clause obj
  const [tmplModal, setTmplModal] = useState(null);     // null | template obj
  const [filterCat, setFilterCat] = useState('All');
  const [search, setSearch] = useState('');

  const clauses   = termsLibrary.clauses   || [];
  const templates = termsLibrary.templates || [];

  function saveClauses(updater) {
    setTermsLibrary(prev => {
      const prevClauses = prev.clauses || [];
      const next = typeof updater === 'function' ? updater(prevClauses) : updater;
      return { ...prev, clauses: next };
    });
  }
  function saveTemplates(updater) {
    setTermsLibrary(prev => {
      const prevTemplates = prev.templates || [];
      const next = typeof updater === 'function' ? updater(prevTemplates) : updater;
      return { ...prev, templates: next };
    });
  }

  // ── Load standard clauses ──
  function loadDefaultClauses() {
    const existing = (termsLibrary.clauses || []).map(c => c.title);
    const toAdd = DEFAULT_PO_CLAUSES.filter(c => !existing.includes(c.title))
      .map(c => ({ ...c, id: Date.now().toString(36) + Math.random().toString(36).slice(2) + c.id }));
    if (toAdd.length === 0) { alert('All standard clauses already loaded.'); return; }
    saveClauses(prev => [...(prev||[]), ...toAdd]);
    alert(`✅ ${toAdd.length} standard clause(s) added.`);
  }

  // ── Clause CRUD ──
  function handleSaveClause(form) {
    const saved = { ...form, id: form.id || crypto.randomUUID() };
    saveClauses(prev => form.id ? prev.map(c => c.id === form.id ? saved : c) : [...prev, saved]);
    setClauseModal(null);
  }
  function deleteClause(id) {
    if (!window.confirm('Delete this clause?')) return;
    saveClauses(prev => prev.filter(c => c.id !== id));
  }

  // ── Template CRUD ──
  function handleSaveTemplate(form) {
    const saved = { ...form, id: form.id || crypto.randomUUID() };
    saveTemplates(prev => form.id ? prev.map(t => t.id === form.id ? saved : t) : [...prev, saved]);
    setTmplModal(null);
  }
  function deleteTemplate(id) {
    if (!window.confirm('Delete this template?')) return;
    saveTemplates(prev => prev.filter(t => t.id !== id));
  }

  const filteredClauses = clauses.filter(c => {
    const matchCat = filterCat === 'All' || c.category === filterCat;
    const matchSearch = `${c.title} ${c.text}`.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const canEdit = userRole === 'admin';

  const cardStyle = { background: '#fff', borderRadius: 10, border: '1px solid #EAE6DB', padding: '14px 18px', marginBottom: 10 };

  return (
    <div style={{ padding: 28, maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Terms Library</h2>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>Reusable clauses and full terms templates for contracts & documents</p>
        </div>
        {canEdit && (
          <div style={{ display:'flex', gap:8 }}>
            {tab === 'clauses' && (
              <button onClick={loadDefaultClauses}
                style={{ padding:'9px 16px', background:'#fff', color:'#1E2A4A', border:'1px solid #1E2A4A', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                📋 Load Standard Clauses
              </button>
            )}
            <button
              onClick={() => tab === 'clauses' ? setClauseModal({ title: '', category: 'Payment', text: '' }) : setTmplModal({ name: '', description: '', clauseIds: [], customText: '' })}
              style={{ padding: '9px 20px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>
              + {tab === 'clauses' ? 'New Clause' : 'New Template'}
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #EAE6DB', marginBottom: 20 }}>
        {[['clauses', `Clauses (${clauses.length})`], ['templates', `Templates (${templates.length})`]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '10px 22px', border: 'none', background: 'none', fontWeight: 700, fontSize: 14, color: tab === key ? '#1E2A4A' : '#888', borderBottom: tab === key ? '2px solid #1E2A4A' : '2px solid transparent', marginBottom: -2, cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'clauses' && (
        <>
          {/* Filters */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clauses…" style={{ border: '1px solid #DDD8CE', borderRadius: 6, padding: '7px 12px', fontSize: 13, width: 220 }} />
            {['All', ...CLAUSE_CATEGORIES].map(cat => (
              <button key={cat} onClick={() => setFilterCat(cat)} style={{ padding: '5px 13px', borderRadius: 16, border: `1.5px solid ${filterCat === cat ? '#1E2A4A' : '#DDD8CE'}`, background: filterCat === cat ? '#1E2A4A' : '#fff', color: filterCat === cat ? '#fff' : '#555', fontSize: 12, fontWeight: 600 }}>
                {cat}
              </button>
            ))}
          </div>
          {filteredClauses.length === 0 && <div style={{ color: '#999', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>No clauses yet. Add your first reusable clause above.</div>}
          {filteredClauses.map(c => (
            <div key={c.id} style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1E2A4A' }}>{c.title}</span>
                    <span style={{ background: '#EAE6DB', borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 600, color: '#666' }}>{c.category}</span>
                  </div>
                  <div style={{ fontSize: 13, color: '#555', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{c.text}</div>
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 6, marginLeft: 16 }}>
                    <button onClick={() => setClauseModal(c)} style={{ border: '1px solid #DDD8CE', borderRadius: 6, padding: '5px 12px', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => deleteClause(c.id)} style={{ border: '1px solid #F3C5C5', borderRadius: 6, padding: '5px 10px', background: '#fff', fontSize: 12, color: '#B5453A', cursor: 'pointer' }}>Delete</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {tab === 'templates' && (
        <>
          {templates.length === 0 && <div style={{ color: '#999', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>No templates yet. Create a full-terms template from your clause library.</div>}
          {templates.map(t => {
            const linked = (t.clauseIds || []).map(id => clauses.find(c => c.id === id)).filter(Boolean);
            return (
              <div key={t.id} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#1E2A4A', marginBottom: 4 }}>{t.name}</div>
                    {t.description && <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>{t.description}</div>}
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {linked.map(c => (
                        <span key={c.id} style={{ background: '#F0EDE6', borderRadius: 10, padding: '3px 10px', fontSize: 11, color: '#555' }}>{c.category}: {c.title}</span>
                      ))}
                      {t.customText && <span style={{ background: '#F0EDE6', borderRadius: 10, padding: '3px 10px', fontSize: 11, color: '#555' }}>+ Custom text</span>}
                    </div>
                  </div>
                  {canEdit && (
                    <div style={{ display: 'flex', gap: 6, marginLeft: 16 }}>
                      <button onClick={() => setTmplModal(t)} style={{ border: '1px solid #DDD8CE', borderRadius: 6, padding: '5px 12px', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => deleteTemplate(t.id)} style={{ border: '1px solid #F3C5C5', borderRadius: 6, padding: '5px 10px', background: '#fff', fontSize: 12, color: '#B5453A', cursor: 'pointer' }}>Delete</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Clause Modal */}
      {clauseModal && (
        <ClauseModal clause={clauseModal} onSave={handleSaveClause} onClose={() => setClauseModal(null)} />
      )}
      {/* Template Modal */}
      {tmplModal && (
        <TemplateModal template={tmplModal} clauses={clauses} onSave={handleSaveTemplate} onClose={() => setTmplModal(null)} />
      )}
    </div>
  );
}


export function ClauseModal({ clause, onSave, onClose }) {
  const [form, setForm] = useState({ title: '', category: 'Payment', text: '', ...clause });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 540, maxHeight: '80vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>{clause.id ? 'Edit Clause' : 'New Clause'}</h3>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Clause Title</label>
        <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Payment within 30 days" style={{ width: '100%', border: '1px solid #DDD8CE', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginTop: 4, marginBottom: 14, boxSizing: 'border-box' }} />
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Category</label>
        <select value={form.category} onChange={e => set('category', e.target.value)} style={{ width: '100%', border: '1px solid #DDD8CE', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginTop: 4, marginBottom: 14, boxSizing: 'border-box' }}>
          {CLAUSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Clause Text</label>
        <textarea value={form.text} onChange={e => set('text', e.target.value)} placeholder="Write the full clause text here…" rows={6} style={{ width: '100%', border: '1px solid #DDD8CE', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginTop: 4, marginBottom: 20, boxSizing: 'border-box', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', border: '1px solid #DDD8CE', borderRadius: 8, background: '#fff', fontSize: 13 }}>Cancel</button>
          <button onClick={() => { if (!form.title || !form.text) return alert('Title and text are required'); onSave(form); }} style={{ padding: '9px 20px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Save Clause</button>
        </div>
      </div>
    </div>
  );
}


export function TemplateModal({ template, clauses, onSave, onClose }) {
  const [form, setForm] = useState({ name: '', description: '', clauseIds: [], customText: '', ...template });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  function toggleClause(id) {
    set('clauseIds', form.clauseIds.includes(id) ? form.clauseIds.filter(x => x !== id) : [...form.clauseIds, id]);
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 580, maxHeight: '85vh', overflowY: 'auto' }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700 }}>{template.id ? 'Edit Template' : 'New Template'}</h3>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Template Name</label>
        <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Standard Supply Contract Terms" style={{ width: '100%', border: '1px solid #DDD8CE', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginTop: 4, marginBottom: 14, boxSizing: 'border-box' }} />
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Description (optional)</label>
        <input value={form.description} onChange={e => set('description', e.target.value)} placeholder="Short description" style={{ width: '100%', border: '1px solid #DDD8CE', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginTop: 4, marginBottom: 14, boxSizing: 'border-box' }} />
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666', display: 'block', marginBottom: 8 }}>Select Clauses to include</label>
        {clauses.length === 0 && <div style={{ color: '#999', fontSize: 12, marginBottom: 14 }}>No clauses yet — add clauses in the Clauses tab first.</div>}
        <div style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #EAE6DB', borderRadius: 8, padding: 10, marginBottom: 14 }}>
          {CLAUSE_CATEGORIES.map(cat => {
            const catClauses = clauses.filter(c => c.category === cat);
            if (!catClauses.length) return null;
            return (
              <div key={cat} style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 4 }}>{cat.toUpperCase()}</div>
                {catClauses.map(c => (
                  <label key={c.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 6, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={form.clauseIds.includes(c.id)} onChange={() => toggleClause(c.id)} style={{ marginTop: 2 }} />
                    <span><strong>{c.title}</strong> — <span style={{ color: '#888' }}>{c.text.slice(0, 80)}{c.text.length > 80 ? '…' : ''}</span></span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#666' }}>Additional Custom Text (appended after clauses)</label>
        <textarea value={form.customText} onChange={e => set('customText', e.target.value)} placeholder="Any additional terms not covered by individual clauses…" rows={4} style={{ width: '100%', border: '1px solid #DDD8CE', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginTop: 4, marginBottom: 20, boxSizing: 'border-box', resize: 'vertical' }} />
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 20px', border: '1px solid #DDD8CE', borderRadius: 8, background: '#fff', fontSize: 13 }}>Cancel</button>
          <button onClick={() => { if (!form.name) return alert('Template name required'); onSave(form); }} style={{ padding: '9px 20px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600 }}>Save Template</button>
        </div>
      </div>
    </div>
  );
}

// ─── Contracts ────────────────────────────────────────────────────────────────

export const CONTRACT_STATUSES = ['draft', 'submitted', 'approved', 'rejected', 'Signed', 'Active', 'Completed', 'Terminated'];

export const CONTRACT_STATUS_COLOR = { draft: '#888', submitted: '#2563EB', approved: '#059669', rejected: '#B5453A', Signed: '#7C3AED', Active: '#059669', Completed: '#1E2A4A', Terminated: '#B5453A' };

export const CONTRACT_STATUS_LABEL = { draft: 'Draft', submitted: 'Forwarded', approved: 'Approved', rejected: 'Rejected' };

export const SCOPE_SECTIONS = [
  { key: 'supply',          label: 'Supply' },
  { key: 'installation',    label: 'Installation' },
  { key: 'testing',         label: 'Testing' },
  { key: 'commissioning',   label: 'Commissioning' },
];


export function blankContract() {
  return {
    id: crypto.randomUUID(),
    number: '',
    date: new Date().toISOString().slice(0, 10),
    title: '',
    customerId: '',
    customerSnapshot: null,
    contractValue: 0,
    scope: { supply: { enabled: true, description: '', value: 0, gstRate: 18, timeline: '' }, installation: { enabled: false, description: '', value: 0, gstRate: 18, timeline: '' }, testing: { enabled: false, description: '', value: 0, gstRate: 18, timeline: '' }, commissioning: { enabled: false, description: '', value: 0, gstRate: 18, timeline: '' } },
    paymentMilestones: [],
    termsTemplateId: '',
    customTerms: '',
    status: 'draft',
    rejectionNote: '',
    signatoryOurName: '', signatoryOurDesignation: '',
    signatoryClientName: '', signatoryClientDesignation: '',
    buyerContactPerson: '', buyerGst: '',
    vendorContactPerson: '', vendorGst: '', vendorAuthorized: '', vendorAuthorizedDesig: '',
    poRef: '', poRefNumber: '',
    buyerRole: 'Buyer', supplierRole: 'Supplier',
    deliveryAddress: '',
    selectedClauseIds: [],
    notes: '',
  };
}


export function ContractList({ contracts, setContracts, customers, vendors, documents, termsLibrary, businessInfo, userRole }) {
  const [editing, setEditing] = useState(null); // null | contract obj | 'new'
  const [printing, setPrinting] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');

  function nextConNum() {
    if (!contracts.length) return 'CON-001';
    const nums = contracts.map(c => parseInt((c.number || '').replace(/\D/g, '')) || 0);
    return 'CON-' + String(Math.max(...nums) + 1).padStart(3, '0');
  }

  function handleSave(form) {
    if (!form.number) form.number = nextConNum();
    const { _isNew, ...rest } = form; // strip _isNew so Firestore doesn't reject undefined field
    setContracts(prev => _isNew ? [...prev, rest] : prev.map(c => c.id === rest.id ? rest : c));
    setEditing(null);
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this contract?')) return;
    setContracts(prev => prev.filter(c => c.id !== id));
  }

  function updateContractStatus(id, patch) {
    setContracts(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }

  const filtered = contracts.filter(c => {
    const cust = customers.find(x => x.id === c.customerId);
    const text = `${c.number} ${c.title} ${cust?.name || ''}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (filterStatus === 'All' || c.status === filterStatus);
  });

  const counts = {};
  CONTRACT_STATUSES.forEach(s => { counts[s] = contracts.filter(c => c.status === s).length; });

  const fmt = makeFmt(businessInfo);
  const canEdit = userRole === 'admin' || userRole === 'manager';

  if (editing) return (
    <ContractEditor
      contract={editing === 'new' ? { ...blankContract(), number: nextConNum(), _isNew: true } : editing}
      customers={customers}
      vendors={vendors || []}
      documents={documents || []}
      termsLibrary={termsLibrary}
      businessInfo={businessInfo}
      userRole={userRole}
      onSave={handleSave}
      onBack={() => setEditing(null)}
    />
  );

  if (printing) return (
    <ContractPrint contract={printing} businessInfo={businessInfo} termsLibrary={termsLibrary} onBack={() => setPrinting(null)} />
  );

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Contracts</h2>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>{contracts.length} contract{contracts.length !== 1 ? 's' : ''} — supply, installation, testing & commissioning</p>
        </div>
        {canEdit && (
          <button onClick={() => setEditing('new')} style={{ padding: '9px 20px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>+ New Contract</button>
        )}
      </div>

      {/* Status filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {['All', ...CONTRACT_STATUSES].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            style={{ padding: '5px 14px', borderRadius: 16, border: `1.5px solid ${s === 'All' ? '#1E2A4A' : (CONTRACT_STATUS_COLOR[s] || '#1E2A4A')}`, background: filterStatus === s ? (s === 'All' ? '#1E2A4A' : CONTRACT_STATUS_COLOR[s]) : '#fff', color: filterStatus === s ? '#fff' : '#555', fontWeight: 600, fontSize: 12 }}>
            {s} ({s === 'All' ? contracts.length : counts[s] || 0})
          </button>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by number, title, customer…" style={{ border: '1px solid #DDD8CE', borderRadius: 6, padding: '8px 14px', fontSize: 13, width: 300, marginBottom: 18 }} />

      {filtered.length === 0 && <div style={{ color: '#999', textAlign: 'center', padding: '60px 0', fontSize: 14 }}>No contracts found.</div>}

      {filtered.map(c => {
        const cust = customers.find(x => x.id === c.customerId);
        const scopeLabels = SCOPE_SECTIONS.filter(s => c.scope?.[s.key]?.enabled).map(s => s.label).join(' · ');
        return (
          <div key={c.id} style={{ background: '#fff', border: '1px solid #EAE6DB', borderRadius: 10, padding: '16px 20px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1E2A4A' }}>{c.number}</span>
                <span style={{ background: CONTRACT_STATUS_COLOR[c.status] || '#888', color: '#fff', borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{CONTRACT_STATUS_LABEL[c.status] || c.status}</span>
                {scopeLabels && <span style={{ fontSize: 11, color: '#888', background: '#F0EDE6', borderRadius: 8, padding: '2px 8px' }}>{scopeLabels}</span>}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#333', marginBottom: 2 }}>{c.title}</div>
              <div style={{ fontSize: 12, color: '#888' }}>{cust?.name || '—'} &nbsp;·&nbsp; {c.date} &nbsp;·&nbsp; {fmt(c.contractValue || 0)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <ApprovalActions item={c} onUpdate={(patch) => updateContractStatus(c.id, patch)} userRole={userRole} compact />
              <button onClick={() => setPrinting(c)} style={{ border: '1px solid #DDD8CE', borderRadius: 6, padding: '6px 12px', background: '#fff', fontSize: 12, cursor: 'pointer' }}><Printer size={13} style={{ marginRight: 4 }} />Print</button>
              {canEdit && <button onClick={() => setEditing(c)} style={{ border: '1px solid #DDD8CE', borderRadius: 6, padding: '6px 12px', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Edit</button>}
              {canEdit && <button onClick={() => handleDelete(c.id)} style={{ border: '1px solid #F3C5C5', borderRadius: 6, padding: '6px 10px', background: '#fff', fontSize: 12, color: '#B5453A', cursor: 'pointer' }}><Trash2 size={13} /></button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}


export function ContractEditor({ contract, customers, vendors, documents, termsLibrary, businessInfo, userRole, onSave, onBack }) {
  const [form, setForm] = useState(contract);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const setScope = (section, field, val) => setForm(p => ({ ...p, scope: { ...p.scope, [section]: { ...p.scope[section], [field]: val } } }));

  const [milestoneInput, setMilestoneInput] = useState({ milestone: '', percentage: '', dueDate: '' });

  const clauses   = termsLibrary.clauses   || [];
  const templates = termsLibrary.templates || [];
  const fmt = makeFmt(businessInfo);

  // Build resolved terms text from template + clauses
  function buildTermsPreview() {
    if (form.termsTemplateId) {
      const tmpl = templates.find(t => t.id === form.termsTemplateId);
      if (tmpl) {
        const clauseTexts = (tmpl.clauseIds || []).map(id => {
          const c = clauses.find(x => x.id === id);
          return c ? `${c.title}\n${c.text}` : '';
        }).filter(Boolean);
        return [...clauseTexts, tmpl.customText].filter(Boolean).join('\n\n');
      }
    }
    if ((form.selectedClauseIds||[]).length > 0) {
      return form.selectedClauseIds.map(id => {
        const c = clauses.find(x => x.id === id);
        return c ? `${c.title}\n${c.text}` : '';
      }).filter(Boolean).join('\n\n');
    }
    return form.customTerms || '';
  }

  function addMilestone() {
    if (!milestoneInput.milestone) return;
    set('paymentMilestones', [...(form.paymentMilestones || []), { ...milestoneInput, id: crypto.randomUUID() }]);
    setMilestoneInput({ milestone: '', percentage: '', dueDate: '' });
  }
  function removeMilestone(id) { set('paymentMilestones', form.paymentMilestones.filter(m => m.id !== id)); }

  const totalScopeValue = SCOPE_SECTIONS.filter(s => form.scope[s.key]?.enabled).reduce((sum, s) => sum + (parseFloat(form.scope[s.key]?.value) || 0), 0);

  const inputStyle = { width: '100%', border: '1px solid #DDD8CE', borderRadius: 6, padding: '8px 12px', fontSize: 13, boxSizing: 'border-box', marginTop: 4 };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#555' };
  const sectionHead = { fontSize: 13, fontWeight: 700, color: '#1E2A4A', borderBottom: '1px solid #EAE6DB', paddingBottom: 8, marginBottom: 14, marginTop: 24 };

  return (
    <div style={{ padding: 28, maxWidth: 780 }}>
      <button onClick={onBack} style={{ border: 'none', background: 'none', color: '#888', fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>← Back to Contracts</button>
      <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700 }}>{contract._isNew ? 'New Contract' : `Edit Contract — ${form.number}`}</h2>

      <div style={sectionHead}>Contract Details</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><label style={labelStyle}>Contract No.</label><input value={form.number} onChange={e => set('number', e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={inputStyle} /></div>
      </div>
      <div style={{ marginTop: 14 }}><label style={labelStyle}>Contract Title</label><input value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Supply & Installation of Solar Panels" style={inputStyle} /></div>
      <div style={{ marginTop: 14 }}>
        <label style={labelStyle}>Customer / Client (Vendor)</label>
        <select value={form.customerId} onChange={e => {
          const allParties = [...(customers||[]), ...(vendors||[])];
          const c = allParties.find(x => x.id === e.target.value);
          set('customerId', e.target.value);
          set('customerSnapshot', c || null);
          if (c?.taxId && !form.vendorGst) set('vendorGst', c.taxId);
        }} style={inputStyle}>
          <option value="">— Select customer / vendor —</option>
          {(customers||[]).length > 0 && <optgroup label="Customers">{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup>}
          {(vendors||[]).length > 0 && <optgroup label="Vendors">{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>}
        </select>
      </div>

      <div style={{ marginTop: 14 }}>
        <label style={labelStyle}>Linked Purchase Order (PO Reference)</label>
        <select value={form.poRef || ''} onChange={e => {
          const po = (documents||[]).find(d => d.id === e.target.value);
          set('poRef', e.target.value);
          set('poRefNumber', po?.number || '');
        }} style={inputStyle}>
          <option value="">— None / not linked to a PO —</option>
          {(documents||[]).filter(d => d.type === 'purchase' || d.type === 'purchase_order' || d.type === 'po').map(po => (
            <option key={po.id} value={po.id}>{po.number}{po.customerSnapshot?.name ? ` — ${po.customerSnapshot.name}` : ''}{po.date ? ` (${po.date})` : ''}</option>
          ))}
        </select>
        {form.poRefNumber && <div style={{ fontSize:11, color:'#1A7A3E', marginTop:4 }}>✓ Linked: <b>{form.poRefNumber}</b></div>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginTop:14 }}>
        <div>
          <label style={labelStyle}>Our Company Role Label</label>
          <select value={form.buyerRole||'Buyer'} onChange={e=>set('buyerRole',e.target.value)} style={inputStyle}>
            <option value="Buyer">Buyer</option>
            <option value="Contractor">Contractor</option>
            <option value="the Company">the Company</option>
            <option value="Purchaser">Purchaser</option>
          </select>
        </div>
        <div>
          <label style={labelStyle}>Other Party Role Label</label>
          <select value={form.supplierRole||'Supplier'} onChange={e=>set('supplierRole',e.target.value)} style={inputStyle}>
            <option value="Supplier">Supplier</option>
            <option value="Seller">Seller</option>
            <option value="Vendor">Vendor</option>
            <option value="Client">Client</option>
          </select>
        </div>
      </div>

      <div style={sectionHead}>Preamble — Buyer &amp; Vendor Details</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        <div style={{ background:'#F5F3EE', borderRadius:8, padding:'14px 16px' }}>
          <div style={{ fontWeight:700, fontSize:12, color:'#1E2A4A', marginBottom:10 }}>BUYER (Your Company)</div>
          <div style={{ fontSize:12, color:'#555', marginBottom:6 }}><b>{businessInfo?.name || businessInfo?.companyName || '—'}</b></div>
          <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>{businessInfo?.address || ''}</div>
          {(businessInfo?.country === 'india' || businessInfo?.country === 'India') && (
            <div style={styles.formGroup}>
              <label style={labelStyle}>Buyer GST No.</label>
              <input value={form.buyerGst} onChange={e=>set('buyerGst',e.target.value)}
                placeholder={businessInfo?.gstin || 'e.g. 29ABCDE1234F1Z5'} style={inputStyle} />
            </div>
          )}
          <div style={styles.formGroup}>
            <label style={labelStyle}>Contact Person</label>
            <input value={form.buyerContactPerson} onChange={e=>set('buyerContactPerson',e.target.value)} style={inputStyle} placeholder="Name / Designation" />
          </div>
          <div style={styles.formGroup}>
            <label style={labelStyle}>Authorized Signatory</label>
            <input value={form.signatoryOurName} onChange={e=>set('signatoryOurName',e.target.value)} style={inputStyle} placeholder="Full name" />
          </div>
          <div style={styles.formGroup}>
            <label style={labelStyle}>Designation</label>
            <input value={form.signatoryOurDesignation} onChange={e=>set('signatoryOurDesignation',e.target.value)} style={inputStyle} placeholder="e.g. Director / Manager" />
          </div>
        </div>
        <div style={{ background:'#F5F3EE', borderRadius:8, padding:'14px 16px' }}>
          <div style={{ fontWeight:700, fontSize:12, color:'#1E2A4A', marginBottom:10 }}>SUPPLIER</div>
          <div style={{ fontSize:12, color:'#555', marginBottom:6 }}><b>{form.customerSnapshot?.name || '—'}</b></div>
          <div style={{ fontSize:11, color:'#888', marginBottom:8 }}>{form.customerSnapshot?.address || ''}</div>
          {(businessInfo?.country === 'india' || businessInfo?.country === 'India') && (
            <div style={styles.formGroup}>
              <label style={labelStyle}>Vendor GST No.</label>
              <input value={form.vendorGst} onChange={e=>set('vendorGst',e.target.value)}
                placeholder={form.customerSnapshot?.taxId || 'e.g. 33ABCDE1234F1Z5'} style={inputStyle} />
            </div>
          )}
          <div style={styles.formGroup}>
            <label style={labelStyle}>Contact Person</label>
            <input value={form.vendorContactPerson} onChange={e=>set('vendorContactPerson',e.target.value)} style={inputStyle} placeholder="Name / Phone" />
          </div>
          <div style={styles.formGroup}>
            <label style={labelStyle}>Authorized Signatory</label>
            <input value={form.signatoryClientName} onChange={e=>set('signatoryClientName',e.target.value)} style={inputStyle} placeholder="Full name" />
          </div>
          <div style={styles.formGroup}>
            <label style={labelStyle}>Designation</label>
            <input value={form.signatoryClientDesignation} onChange={e=>set('signatoryClientDesignation',e.target.value)} style={inputStyle} placeholder="e.g. Proprietor / MD" />
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <div><label style={labelStyle}>Status</label>
          <select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>
            {CONTRACT_STATUSES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Total Contract Value</label>
          <input type="number" value={form.contractValue} onChange={e => set('contractValue', parseFloat(e.target.value) || 0)} style={inputStyle} />
        </div>
      </div>

      <div style={styles.formGroup}>
        <label style={labelStyle}>Delivery / Site Address</label>
        <input value={form.deliveryAddress || ''} onChange={e => set('deliveryAddress', e.target.value)}
          placeholder="e.g. Plot 12, Industrial Estate, Chennai - 600002" style={inputStyle} />
      </div>

      <div style={sectionHead}>Scope of Work</div>
      {SCOPE_SECTIONS.map(({ key, label }) => (
        <div key={key} style={{ background: form.scope[key]?.enabled ? '#FAFAF8' : '#F7F6F3', border: '1px solid #EAE6DB', borderRadius: 8, padding: '12px 16px', marginBottom: 10 }}>
          <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', marginBottom: form.scope[key]?.enabled ? 12 : 0 }}>
            <input type="checkbox" checked={!!form.scope[key]?.enabled} onChange={e => setScope(key, 'enabled', e.target.checked)} />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#1E2A4A' }}>{label}</span>
          </label>
          {form.scope[key]?.enabled && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 70px 150px', gap: 10 }}>
              <div><label style={labelStyle}>Description</label><input value={form.scope[key]?.description || ''} onChange={e => setScope(key, 'description', e.target.value)} placeholder={`Describe ${label.toLowerCase()} scope`} style={inputStyle} /></div>
              <div><label style={labelStyle}>Value</label><input type="number" value={form.scope[key]?.value || 0} onChange={e => setScope(key, 'value', parseFloat(e.target.value) || 0)} style={inputStyle} /></div>
              <div><label style={labelStyle}>GST %</label><input type="number" value={form.scope[key]?.gstRate ?? 18} onChange={e => setScope(key, 'gstRate', parseFloat(e.target.value) || 0)} style={inputStyle} /></div>
              <div><label style={labelStyle}>Timeline</label><input value={form.scope[key]?.timeline || ''} onChange={e => setScope(key, 'timeline', e.target.value)} placeholder="e.g. 45 days" style={inputStyle} /></div>
            </div>
          )}
        </div>
      ))}
{(() => {
        const isInd = (businessInfo?.country||'').toLowerCase() === 'india';
        const totalGst = SCOPE_SECTIONS.filter(s => form.scope[s.key]?.enabled).reduce((sum, s) => {
          const val = parseFloat(form.scope[s.key]?.value)||0;
          const rate = parseFloat(form.scope[s.key]?.gstRate)||0;
          return sum + (val*rate/100);
        }, 0);
        const grandTotal = totalScopeValue + totalGst;
        return totalScopeValue > 0 ? (
          <div style={{ background:'#F5F3EE', border:'1px solid #EAE6DB', borderRadius:8, padding:'10px 16px', marginTop:4, marginBottom:4, fontSize:13 }}>
            <div style={{ display:'flex', justifyContent:'space-between', color:'#555' }}><span>Total</span><strong>{makeFmt(businessInfo)(totalScopeValue)}</strong></div>
            {isInd && <div style={{ display:'flex', justifyContent:'space-between', color:'#888' }}><span>GST</span><span>{makeFmt(businessInfo)(totalGst)}</span></div>}
            <div style={{ display:'flex', justifyContent:'space-between', color:'#1E2A4A', fontWeight:700, fontSize:14, borderTop:'1px solid #DDD8CE', marginTop:6, paddingTop:6 }}><span>Grand Total (incl. GST)</span><span>{makeFmt(businessInfo)(grandTotal)}</span></div>
          </div>
        ) : null;
      })()}

      <div style={sectionHead}>Payment Milestones</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 140px 36px', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
        <div><label style={labelStyle}>Milestone</label><input value={milestoneInput.milestone} onChange={e => setMilestoneInput(p => ({ ...p, milestone: e.target.value }))} placeholder="e.g. On delivery" style={inputStyle} /></div>
        <div><label style={labelStyle}>%</label><input type="number" value={milestoneInput.percentage} onChange={e => setMilestoneInput(p => ({ ...p, percentage: e.target.value }))} placeholder="30" style={inputStyle} /></div>
        <div><label style={labelStyle}>Due Date</label><input type="date" value={milestoneInput.dueDate} onChange={e => setMilestoneInput(p => ({ ...p, dueDate: e.target.value }))} style={inputStyle} /></div>
        <button onClick={addMilestone} style={{ border: 'none', background: '#1E2A4A', color: '#fff', borderRadius: 6, padding: '9px 10px', cursor: 'pointer', fontSize: 16 }}>+</button>
      </div>
      {(form.paymentMilestones || []).map(m => (
        <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#FAFAF8', border: '1px solid #EAE6DB', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
          <span style={{ flex: 2 }}>{m.milestone}</span>
          <span style={{ width: 60, color: '#888' }}>{m.percentage}%</span>
          <span style={{ width: 120, color: '#888' }}>{m.dueDate || '—'}</span>
          <button onClick={() => removeMilestone(m.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#B5453A' }}><Trash2 size={13} /></button>
        </div>
      ))}

      <div style={sectionHead}>Terms &amp; Conditions</div>
      {templates.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Apply a Template from Terms Library</label>
          <select value={form.termsTemplateId || ''} onChange={e => { set('termsTemplateId', e.target.value); if (e.target.value) { set('customTerms', ''); set('selectedClauseIds', []); } }} style={inputStyle}>
            <option value="">— None —</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      {!form.termsTemplateId && clauses.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Select Clauses from Terms Library ({clauses.length} available)</label>
          <div style={{ border:'1px solid #DDD8CE', borderRadius:8, maxHeight:220, overflowY:'auto', padding:'4px 0', background:'#fff' }}>
            {clauses.map(cl => {
              const sel = (form.selectedClauseIds||[]).includes(cl.id);
              return (
                <label key={cl.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'7px 12px', cursor:'pointer', background:sel?'#EFF6FF':'transparent', borderBottom:'1px solid #f0ede6' }}>
                  <input type="checkbox" checked={sel} onChange={e => {
                    const cur = form.selectedClauseIds||[];
                    set('selectedClauseIds', e.target.checked ? [...cur,cl.id] : cur.filter(x=>x!==cl.id));
                  }} style={{ marginTop:2, accentColor:'#1E2A4A' }} />
                  <div>
                    <div style={{ fontWeight:600, fontSize:12, color:'#1E2A4A' }}>{cl.title}</div>
                    <div style={{ fontSize:11, color:'#888' }}>{cl.category}</div>
                  </div>
                </label>
              );
            })}
          </div>
          {(form.selectedClauseIds||[]).length > 0 && (
            <div style={{ fontSize:11, color:'#1A7A3E', marginTop:4 }}>✓ {(form.selectedClauseIds||[]).length} clause(s) selected — will appear in print</div>
          )}
        </div>
      )}
      {!form.termsTemplateId && (
        <div style={{ marginBottom:14 }}>
          <label style={labelStyle}>Additional / Custom Terms</label>
          <textarea value={form.customTerms || ''} onChange={e => set('customTerms', e.target.value)} rows={4}
            placeholder="Type any additional terms here..." style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      )}
      {form.termsTemplateId && (
        <div style={{ background: '#F7F6F3', border: '1px solid #EAE6DB', borderRadius: 8, padding: 14, fontSize: 12, color: '#666', whiteSpace: 'pre-wrap', lineHeight: 1.8, maxHeight: 200, overflowY: 'auto' }}>{buildTermsPreview()}</div>
      )}
      <div style={sectionHead}>Signatories</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 8 }}>Our Signatory</div>
          <label style={labelStyle}>Name</label><input value={form.signatoryOurName || ''} onChange={e => set('signatoryOurName', e.target.value)} style={inputStyle} />
          <label style={{ ...labelStyle, marginTop: 10, display: 'block' }}>Designation</label><input value={form.signatoryOurDesignation || ''} onChange={e => set('signatoryOurDesignation', e.target.value)} style={inputStyle} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 13, color: '#555', marginBottom: 8 }}>Client Signatory</div>
          <label style={labelStyle}>Name</label><input value={form.signatoryClientName || ''} onChange={e => set('signatoryClientName', e.target.value)} style={inputStyle} />
          <label style={{ ...labelStyle, marginTop: 10, display: 'block' }}>Designation</label><input value={form.signatoryClientDesignation || ''} onChange={e => set('signatoryClientDesignation', e.target.value)} style={inputStyle} />
        </div>
      </div>
      <div style={{ marginTop: 20 }}><label style={labelStyle}>Internal Notes</label><textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>

      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
        <button onClick={onBack} style={{ padding: '10px 24px', border: '1px solid #DDD8CE', borderRadius: 8, background: '#fff', fontSize: 14 }}>Cancel</button>
        <button onClick={() => { if (!form.title) return alert('Contract title required'); onSave(form); }} style={{ padding: '10px 24px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>Save Contract</button>
      </div>
    </div>
  );
}


export function ContractPrint({ contract: c, businessInfo: bi, termsLibrary, onBack }) {
  const clauses   = termsLibrary?.clauses   || [];
  const templates = termsLibrary?.templates || [];
  const fmt = makeFmt(bi);
  const [useLH, setUseLH] = React.useState(!!(bi?.letterhead || bi?.letterheadFooter));
  const [orient, setOrient] = React.useState('portrait');
  const effLHH = useLH ? bi?.letterhead : null;
  const effLHF = useLH ? bi?.letterheadFooter : null;
  const isIndia = (bi?.country||'').toLowerCase() === 'india';
  const isDraft = c.status !== 'Approved';

  function getTermsText() {
    if (c.termsTemplateId) {
      const tmpl = templates.find(t => t.id === c.termsTemplateId);
      if (tmpl) {
        const items = (tmpl.clauseIds || []).map(id => { const cl = clauses.find(x => x.id === id); return cl ? { title: cl.title, text: cl.text } : null; }).filter(Boolean);
        return { items, extra: tmpl.customText };
      }
    }
    if ((c.selectedClauseIds||[]).length > 0) {
      const items = c.selectedClauseIds.map(id => { const cl = clauses.find(x => x.id === id); return cl ? { title: cl.title, text: cl.text } : null; }).filter(Boolean);
      return { items, extra: c.customTerms || '' };
    }
    if (c.customTerms) return { items: c.customTerms.split('\n').filter(Boolean).map(t => ({ title: null, text: t })), extra: '' };
    return { items: [], extra: '' };
  }

  const terms = getTermsText();
  const enabledScopes = SCOPE_SECTIONS.filter(s => c.scope?.[s.key]?.enabled);
  const totalVal = c.contractValue || enabledScopes.reduce((s,sc)=>s+(parseFloat(c.scope?.[sc.key]?.value)||0),0);

  function handlePrint() {
    const lhImg = effLHH ? `<div style="position:fixed;top:0;left:0;right:0;background:#fff;z-index:9999;padding-bottom:8px;border-bottom:2px solid #1E2A4A;"><img src="${effLHH}" style="width:100%;max-height:200px;object-fit:contain;object-position:top;display:block;" /></div>` : '';
    const lhFooterImg = effLHF ? `<div style="position:fixed;bottom:0;left:0;right:0;background:#fff;z-index:9999;padding-top:8px;border-top:2px solid #1E2A4A;"><img src="${effLHF}" style="width:100%;max-height:120px;object-fit:contain;object-position:bottom;display:block;" /></div>` : '';
    const companyHeader = !lhImg ? `
      <div style="text-align:center;border-bottom:2px solid #1E2A4A;padding-bottom:16px;margin-bottom:24px;">
        ${bi?.logo ? `<img src="${bi.logo}" style="height:60px;object-fit:contain;display:block;margin:0 auto 8px;" />` : ''}
        <div style="font-size:20px;font-weight:700;color:#1E2A4A;">${bi?.name||bi?.companyName||''}</div>
        <div style="font-size:11px;color:#666;margin-top:4px;">${bi?.address||''}</div>
        ${isIndia && bi?.gstin ? `<div style="font-size:11px;color:#666;">GSTIN: ${bi.gstin}</div>` : ''}
      </div>` : '';

    const draftWm = isDraft ? `
      <style>
        body::before { content:'DRAFT'; position:fixed; top:38%;left:12%;font-size:130px;font-weight:900;
          color:rgba(200,0,0,0.10);transform:rotate(-35deg);z-index:9999;pointer-events:none;letter-spacing:10px; }
      </style>` : '';

    const preamble = `
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:12px;">
        <tr style="background:#1E2A4A;color:#fff;">
          <th style="padding:8px 12px;text-align:left;width:50%">${(c.buyerRole||'BUYER').toUpperCase()}</th>
          <th style="padding:8px 12px;text-align:left;width:50%">${(c.supplierRole||'SUPPLIER').toUpperCase()}</th>
        </tr>
        <tr>
          <td style="padding:10px 12px;border:1px solid #ddd;vertical-align:top;">
            <b>${bi?.name||bi?.companyName||''}</b><br/>
            <span style="color:#555;font-size:11px;">${bi?.address||''}</span><br/>
            ${isIndia ? `<span style="font-size:11px;">GSTIN: <b>${c.buyerGst||bi?.gstin||'—'}</b></span><br/>` : ''}
            <span style="font-size:11px;">Contact: ${c.buyerContactPerson||'—'}</span>
          </td>
          <td style="padding:10px 12px;border:1px solid #ddd;vertical-align:top;">
            <b>${c.customerSnapshot?.name||'—'}</b><br/>
            <span style="color:#555;font-size:11px;">${c.customerSnapshot?.address||''}</span><br/>
            ${isIndia ? `<span style="font-size:11px;">GSTIN: <b>${c.vendorGst||c.customerSnapshot?.taxId||'—'}</b></span><br/>` : ''}
            <span style="font-size:11px;">Contact: ${c.vendorContactPerson||'—'}</span>
          </td>
        </tr>
      </table>`;

    const scopeSubtotal = enabledScopes.reduce((s,sc)=>s+(parseFloat(c.scope?.[sc.key]?.value)||0),0);
    const scopeGst = enabledScopes.reduce((s,sc)=>{
      const v=parseFloat(c.scope?.[sc.key]?.value)||0, r=parseFloat(c.scope?.[sc.key]?.gstRate)||0;
      return s+(v*r/100);
    },0);
    const scopeGrandTotal = scopeSubtotal + scopeGst;
    const deliveryRow = c.deliveryAddress ? `<p style="font-size:12px;margin-bottom:16px;"><strong>Delivery / Site Address:</strong> ${c.deliveryAddress}</p>` : '';
    const scopeTable = enabledScopes.length > 0 ? `
      <h3>Scope of Work</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
        <thead><tr style="background:#1E2A4A;color:#fff;">
          <th style="padding:7px 10px;text-align:left">Section</th>
          <th style="padding:7px 10px;text-align:left">Description</th>
          <th style="padding:7px 10px;text-align:right">Value</th>
          ${isIndia ? '<th style="padding:7px 10px;text-align:center">GST%</th><th style="padding:7px 10px;text-align:right">GST Amt</th>' : ''}
          <th style="padding:7px 10px;text-align:center">Timeline</th>
        </tr></thead>
        <tbody>
          ${enabledScopes.map((sc,i)=>{
            const val=parseFloat(c.scope[sc.key]?.value)||0;
            const rate=parseFloat(c.scope[sc.key]?.gstRate)||0;
            const gstAmt=val*rate/100;
            return `<tr style="background:${i%2===0?'#fff':'#fafaf8'};border-bottom:1px solid #eee;">
              <td style="padding:7px 10px;font-weight:600">${sc.label}</td>
              <td style="padding:7px 10px">${c.scope[sc.key]?.description||'—'}</td>
              <td style="padding:7px 10px;text-align:right">${fmt(val)}</td>
              ${isIndia ? `<td style="padding:7px 10px;text-align:center">${rate}%</td><td style="padding:7px 10px;text-align:right">${fmt(gstAmt)}</td>` : ''}
              <td style="padding:7px 10px;text-align:center">${c.scope[sc.key]?.timeline||'—'}</td>
            </tr>`;
          }).join('')}
          <tr style="background:#f0ede6;">
            <td colspan="${isIndia?'5':'3'}" style="padding:7px 10px;text-align:right;font-weight:600">Total</td>
            <td style="padding:7px 10px;text-align:right;font-weight:600">${fmt(scopeSubtotal)}</td>
          </tr>
          ${isIndia ? `<tr style="background:#f5f3ee;">
            <td colspan="5" style="padding:7px 10px;text-align:right;color:#555">GST</td>
            <td style="padding:7px 10px;text-align:right;color:#555">${fmt(scopeGst)}</td>
          </tr>` : ''}
          <tr style="background:#1E2A4A;color:#fff;font-weight:700;">
            <td colspan="${isIndia?'5':'3'}" style="padding:8px 10px;text-align:right">Grand Total (incl. GST)</td>
            <td style="padding:8px 10px;text-align:right;font-size:13px">${fmt(scopeGrandTotal)}</td>
          </tr>
        </tbody>
      </table>` : '';

    const milestoneTable = (c.paymentMilestones||[]).length > 0 ? `
      <h3>Payment Schedule</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:20px;">
        <thead><tr style="background:#1E2A4A;color:#fff;">
          <th style="padding:7px 10px;text-align:left">Milestone</th>
          <th style="padding:7px 10px;text-align:right">%</th>
          <th style="padding:7px 10px;text-align:right">Amount</th>
          <th style="padding:7px 10px;text-align:center">Due Date</th>
        </tr></thead>
        <tbody>
          ${c.paymentMilestones.map((m,i)=>`<tr style="background:${i%2===0?'#fff':'#fafaf8'};border-bottom:1px solid #eee;">
            <td style="padding:7px 10px">${m.milestone}</td>
            <td style="padding:7px 10px;text-align:right">${m.percentage}%</td>
            <td style="padding:7px 10px;text-align:right">${fmt((parseFloat(m.percentage)/100)*totalVal)}</td>
            <td style="padding:7px 10px;text-align:center">${m.dueDate||'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>` : '';

    // Split sub-clause text (e.g. "1.1 text 1.2 text") into separate numbered lines
    const fmtClause = (text) => (text||'').replace(/ (?=\d+\.\d+\s)/g, '\n');
    const termsHTML = terms.items.length > 0 ? `
      <h3>Terms &amp; Conditions</h3>
      ${terms.items.map((item,i)=>`
        <div style="margin-bottom:16px;font-size:12px;line-height:1.8;">
          ${item.title ? `<div style="font-weight:700;color:#1E2A4A;margin-bottom:6px;">${item.title}</div>` : ''}
          <div style="margin-left:${item.title?14:0}px;">
            ${fmtClause(item.text).split('\n').filter(l=>l.trim()).map(line=>`
              <div style="margin-bottom:4px;">${line.trim()}</div>`).join('')}
          </div>
        </div>`).join('')}
      ${terms.extra ? `<div style="font-size:12px;margin-top:10px">${terms.extra}</div>` : ''}` : '';

    const sigBlock = `
      <div style="margin-top:48px;border-top:1px solid #ccc;padding-top:28px;display:grid;grid-template-columns:1fr 1fr;gap:60px;font-size:12px;">
        <div>
          <div style="font-weight:700;color:#1E2A4A;margin-bottom:4px;font-size:13px;">For the ${c.buyerRole||'Buyer'}</div>
          <div style="font-size:11px;color:#555;margin-bottom:36px;">${bi?.name||bi?.companyName||''}</div>
          <div style="border-top:1px solid #333;padding-top:6px;">
            <b>${c.signatoryOurName||'Authorised Signatory'}</b>
            ${c.signatoryOurDesignation ? `<div style="color:#888;font-size:11px">${c.signatoryOurDesignation}</div>` : ''}
            ${c.buyerContactPerson ? `<div style="color:#888;font-size:11px">${c.buyerContactPerson}</div>` : ''}
          </div>
        </div>
        <div>
          <div style="font-weight:700;color:#1E2A4A;margin-bottom:4px;font-size:13px;">For the ${c.supplierRole||'Supplier'}</div>
          <div style="font-size:11px;color:#555;margin-bottom:36px;">${c.customerSnapshot?.name||''}</div>
          <div style="border-top:1px solid #333;padding-top:6px;">
            <b>${c.signatoryClientName||'Authorised Signatory'}</b>
            ${c.signatoryClientDesignation ? `<div style="color:#888;font-size:11px">${c.signatoryClientDesignation}</div>` : ''}
            ${c.vendorContactPerson ? `<div style="color:#888;font-size:11px">${c.vendorContactPerson}</div>` : ''}
          </div>
        </div>
      </div>`;

    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>Contract — ${c.number}</title>
      <style>
        @page { size: A4 ${orient}; margin: ${lhImg ? '220px' : '15mm'} 15mm ${lhFooterImg ? '140px' : '20mm'} 15mm; ${!lhFooterImg ? `@bottom-center { content: "Page " counter(page) " of " counter(pages); font-family: Arial, sans-serif; font-size: 9px; color: #888; }` : ''} }
        body { font-family: Georgia, serif; font-size: 13px; color: #222; line-height: 1.7; }
        h3 { font-size: 14px; font-weight: 700; color: #1E2A4A; border-bottom: 1px solid #ccc;
             padding-bottom: 6px; margin: 20px 0 12px; text-transform: uppercase; letter-spacing: 0.5px; }
      </style>
      ${draftWm}
    </head><body>
      ${lhImg}
      ${companyHeader}
      <div style="text-align:center;margin-bottom:20px;">
        <div style="font-size:17px;font-weight:700;letter-spacing:2px;color:#1E2A4A;text-transform:uppercase;">CONTRACT AGREEMENT</div>
        <div style="font-size:12px;color:#888;margin-top:4px;">Contract No: ${c.number} &nbsp;|&nbsp; Date: ${c.date}${c.poRefNumber ? ` &nbsp;|&nbsp; PO Ref: <b>${c.poRefNumber}</b>` : ''}${isDraft?' &nbsp;|&nbsp; <span style="color:red;font-weight:700">DRAFT</span>':''}</div>
      </div>
      <div style="background:#f7f6f3;border:1px solid #ddd;border-radius:4px;padding:10px 16px;margin-bottom:20px;font-size:14px;font-weight:700;color:#1E2A4A;">
        Subject: ${c.title}
      </div>
      <p style="font-size:12px;margin-bottom:16px;">This Contract Agreement is entered into between <b>${bi?.name||bi?.companyName||'the Buyer'}</b> (hereinafter referred to as the "${c.buyerRole||'Buyer'}") and <b>${c.customerSnapshot?.name||'the Supplier'}</b> (hereinafter referred to as the "${c.supplierRole||'Supplier'}"), both parties agreeing to the terms set forth below.</p>
      ${preamble}
      ${deliveryRow}
      ${scopeTable}
      ${milestoneTable}
      ${termsHTML}
      ${sigBlock}
      ${lhFooterImg}
    </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=750');
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
  }

  return (
    <div>
      <div className="no-print" style={{ padding: '14px 28px', borderBottom: '1px solid #EAE6DB', display: 'flex', gap: 12, alignItems:'center', flexWrap:'wrap' }}>
        <button onClick={onBack} style={{ border: 'none', background: 'none', color: '#888', fontSize: 13, cursor: 'pointer' }}>← Back</button>
        <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:13, cursor:'pointer' }}>
          <input type="checkbox" checked={useLH} onChange={e=>setUseLH(e.target.checked)} />
          Use letterpad
        </label>
        {useLH && effLHH && <span style={{ fontSize:11, color:'#1A7A3E', background:'#EEF9F0', border:'1px solid #B7E5C6', borderRadius:6, padding:'4px 10px' }}>✓ Header from Settings</span>}
        {useLH && effLHF && <span style={{ fontSize:11, color:'#1A7A3E', background:'#EEF9F0', border:'1px solid #B7E5C6', borderRadius:6, padding:'4px 10px' }}>✓ Footer from Settings</span>}
        {useLH && !effLHH && !effLHF && <span style={{ fontSize:11, color:'#B45309', background:'#FEF3C7', border:'1px solid #FCD34D', borderRadius:6, padding:'4px 10px' }}>No header/footer saved — add in Settings</span>}
        <div style={{ display:'flex', border:'1px solid #DDD8CC', borderRadius:7, overflow:'hidden', fontSize:12 }}>
          {[['portrait','📄 Portrait'],['landscape','⬜ Landscape']].map(([v,l])=>(
            <button key={v} onClick={()=>setOrient(v)}
              style={{ padding:'6px 12px', background:orient===v?'#1E2A4A':'#fff', color:orient===v?'#fff':'#555', border:'none', cursor:'pointer', fontWeight:orient===v?600:400 }}>
              {l}
            </button>
          ))}
        </div>
        <button onClick={handlePrint} style={{ padding: '8px 20px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, display:'flex', alignItems:'center', gap:6 }}>🖨 Print / PDF</button>
        {c.status === 'Draft' && <span style={{ background:'#FEE2E2', color:'#B91C1C', padding:'4px 12px', borderRadius:20, fontSize:12, fontWeight:700 }}>DRAFT status — change to Approved to remove watermark</span>}
      </div>
      <div className="print-area contract-print-area" style={{ maxWidth: 780, margin: '28px auto', background: '#fff', fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.8, color: '#222', boxShadow: '0 2px 20px rgba(0,0,0,0.08)', overflow:'hidden' }}>
        {effLHH && <div style={{ background:'#fff', lineHeight:0 }}><img src={effLHH} alt="letterpad header" style={{ width:'100%', display:'block' }} /></div>}
        <div style={{ padding: '32px 56px' }}>
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1E2A4A', paddingBottom: 24, marginBottom: 32 }}>
          {!effLHH && bi.name && <div style={{ fontSize: 22, fontWeight: 700, color: '#1E2A4A' }}>{bi.name || bi.companyName}</div>}
          {!effLHH && bi.address && <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{bi.address}</div>}
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, marginTop: 20, color: '#1E2A4A', textTransform: 'uppercase' }}>CONTRACT AGREEMENT</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>Contract No: {c.number} | Date: {c.date}{c.poRefNumber ? ` | PO Ref: ${c.poRefNumber}` : ''}</div>
        </div>
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: '#1E2A4A', textTransform: 'uppercase' }}>Parties</div>
          <p>This Contract Agreement is entered into between <strong>{bi.name || bi.companyName || 'the Company'}</strong> (the "{c.buyerRole || 'Buyer'}") and <strong>{c.customerSnapshot?.name || '___________________'}</strong> (the "{c.supplierRole || 'Supplier'}").</p>
        </div>
        <div style={{ background: '#F7F6F3', border: '1px solid #DDD8CE', borderRadius: 6, padding: '14px 20px', marginBottom: 28, fontWeight: 700, fontSize: 15, color: '#1E2A4A' }}>Subject: {c.title}</div>
        {c.deliveryAddress && (
          <div style={{ marginBottom: 20, fontSize: 13 }}>
            <span style={{ fontWeight: 700, color: '#1E2A4A' }}>Delivery / Site Address: </span>
            <span style={{ color: '#555' }}>{c.deliveryAddress}</span>
          </div>
        )}
        {enabledScopes.length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#1E2A4A', textTransform: 'uppercase' }}>Scope of Work</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#1E2A4A', color: '#fff' }}><th style={{ padding: '8px 12px', textAlign: 'left' }}>Section</th><th style={{ padding: '8px 12px', textAlign: 'left' }}>Description</th><th style={{ padding: '8px 12px', textAlign: 'right' }}>Value</th>{isIndia && <><th style={{ padding: '8px 12px', textAlign: 'center' }}>GST%</th><th style={{ padding: '8px 12px', textAlign: 'right' }}>GST Amt</th></>}<th style={{ padding: '8px 12px', textAlign: 'center' }}>Timeline</th></tr></thead>
              <tbody>
                {enabledScopes.map(({ key, label }, i) => {
                    const val = parseFloat(c.scope[key]?.value)||0;
                    const rate = parseFloat(c.scope[key]?.gstRate)||0;
                    const gstAmt = val*rate/100;
                    return <tr key={key} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', borderBottom: '1px solid #EAE6DB' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{label}</td>
                      <td style={{ padding: '8px 12px' }}>{c.scope[key]?.description || '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(val)}</td>
                      {isIndia && <><td style={{ padding: '8px 12px', textAlign: 'center' }}>{rate}%</td><td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt(gstAmt)}</td></>}
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{c.scope[key]?.timeline || '—'}</td>
                    </tr>;
                })}
                {(() => {
                  const subtotal = enabledScopes.reduce((s,sc)=>s+(parseFloat(c.scope?.[sc.key]?.value)||0),0);
                  const gstTotal = enabledScopes.reduce((s,sc)=>{
                    const v=parseFloat(c.scope?.[sc.key]?.value)||0, r=parseFloat(c.scope?.[sc.key]?.gstRate)||0;
                    return s+(v*r/100);
                  },0);
                  const numCols = isIndia ? 6 : 4;
                  return <>
                    <tr style={{ background: '#F0EDE6' }}>
                      <td colSpan={numCols - 1} style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>Total</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600 }}>{fmt(subtotal)}</td>
                    </tr>
                    {isIndia && <tr style={{ background: '#F5F3EE' }}>
                      <td colSpan={numCols - 1} style={{ padding: '8px 12px', textAlign: 'right', color: '#555' }}>GST</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', color: '#555' }}>{fmt(gstTotal)}</td>
                    </tr>}
                    <tr style={{ background: '#1E2A4A', color: '#fff', fontWeight: 700 }}>
                      <td colSpan={numCols - 1} style={{ padding: '8px 12px', textAlign: 'right' }}>Grand Total (incl. GST)</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontSize: 14 }}>{fmt(subtotal+gstTotal)}</td>
                    </tr>
                  </>;
                })()}
              </tbody>
            </table>
          </div>
        )}
        {(c.paymentMilestones || []).length > 0 && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#1E2A4A', textTransform: 'uppercase' }}>Payment Schedule</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#1E2A4A', color: '#fff' }}><th style={{ padding: '8px 12px', textAlign: 'left' }}>Milestone</th><th style={{ padding: '8px 12px', textAlign: 'right' }}>%</th><th style={{ padding: '8px 12px', textAlign: 'right' }}>Amount</th><th style={{ padding: '8px 12px', textAlign: 'center' }}>Due Date</th></tr></thead>
              <tbody>
                {c.paymentMilestones.map((m, i) => (
                  <tr key={m.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', borderBottom: '1px solid #EAE6DB' }}>
                    <td style={{ padding: '8px 12px' }}>{m.milestone}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{m.percentage}%</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>{fmt((parseFloat(m.percentage) / 100) * (c.contractValue || 0))}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>{m.dueDate || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {terms.items.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14, color: '#1E2A4A', textTransform: 'uppercase' }}>Terms & Conditions</div>
            {terms.items.map((item, i) => {
              const clauseLines = (item.text||'').replace(/ (?=\d+\.\d+\s)/g, '\n').split('\n').filter(l=>l.trim());
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  {item.title && <div style={{ fontWeight: 700, color:'#1E2A4A', marginBottom:4 }}>{i + 1}. {item.title}</div>}
                  <div style={{ marginLeft: item.title ? 16 : 0, lineHeight: 1.9 }}>
                    {clauseLines.map((line, j) => <div key={j} style={{ marginBottom: 2 }}>{j===0&&!item.title?`${i+1}. `:''}{line.trim()}</div>)}
                  </div>
                </div>
              );
            })}
            {terms.extra && <div style={{ marginTop: 12 }}>{terms.extra}</div>}
          </div>
        )}
        <div style={{ marginTop: 48, borderTop: '1px solid #DDD8CE', paddingTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          {[{ label: 'For the ' + (c.buyerRole || 'Buyer') + ' (' + (bi.name || bi.companyName || '') + ')', name: c.signatoryOurName, desig: c.signatoryOurDesignation }, { label: 'For the ' + (c.supplierRole || 'Supplier') + ' (' + (c.customerSnapshot?.name || '') + ')', name: c.signatoryClientName, desig: c.signatoryClientDesignation }].map((sig, i) => (
            <div key={i}>
              <div style={{ fontWeight: 700, marginBottom: 40, fontSize: 13, color: '#555' }}>{sig.label}</div>
              <div style={{ borderTop: '1px solid #333', paddingTop: 8 }}>
                <div style={{ fontWeight: 700 }}>{sig.name || 'Authorised Signatory'}</div>
                {sig.desig && <div style={{ fontSize: 12, color: '#888' }}>{sig.desig}</div>}
              </div>
            </div>
          ))}
        </div>
        </div>{/* end inner content */}
        {effLHF && <div style={{ background:'#fff', width:'100%', height:130, overflow:'hidden' }}><img src={effLHF} alt="letterpad footer" style={{ width:'100%', height:130, objectFit:'cover', objectPosition:'center', display:'block' }} /></div>}
      </div>
    </div>
  );
}

// ─── Channel Partners ──────────────────────────────────────────────────────────

export const PARTNER_TYPES = ['Dealer', 'Distributor', 'Agent', 'Reseller', 'System Integrator'];

export const PARTNER_STATUSES = ['Onboarding', 'Active', 'Inactive', 'Terminated'];

export const PARTNER_STATUS_COLOR = { Onboarding: '#D97706', Active: '#059669', Inactive: '#888', Terminated: '#B5453A' };


export function blankPartner() {
  return {
    id: crypto.randomUUID(), number: '', name: '', type: 'Dealer', territory: '',
    contactPerson: '', contactPhone: '', contactEmail: '',
    address: '', taxId: '', commissions: [],
    agreementDate: new Date().toISOString().slice(0, 10), agreementExpiry: '',
    status: 'Active', termsTemplateId: '', agreementTerms: '', notes: '',
  };
}


export function ChannelPartnerList({ channelPartners, setChannelPartners, documents, termsLibrary, businessInfo, userRole }) {
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const canEdit = userRole === 'admin' || userRole === 'manager';

  function nextCPNum() {
    if (!channelPartners.length) return 'CP-001';
    const nums = channelPartners.map(p => parseInt((p.number || '').replace(/\D/g, '')) || 0);
    return 'CP-' + String(Math.max(...nums) + 1).padStart(3, '0');
  }

  function handleSave(form) {
    if (!form.number) form.number = nextCPNum();
    const { _isNew, ...rest } = form; // strip _isNew so Firestore doesn't reject undefined field
    setChannelPartners(prev => _isNew ? [...prev, rest] : prev.map(p => p.id === rest.id ? rest : p));
    setEditing(null);
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this channel partner?')) return;
    setChannelPartners(prev => prev.filter(p => p.id !== id));
  }

  const filtered = channelPartners.filter(p => {
    const text = `${p.number} ${p.name} ${p.territory} ${p.contactPerson}`.toLowerCase();
    return text.includes(search.toLowerCase()) && (filterStatus === 'All' || p.status === filterStatus);
  });

  if (editing) return <ChannelPartnerForm partner={editing === 'new' ? { ...blankPartner(), number: nextCPNum(), _isNew: true } : editing} termsLibrary={termsLibrary} businessInfo={businessInfo} documents={documents} onSave={handleSave} onBack={() => setEditing(null)} />;
  if (viewing) return <PartnerAgreement partner={viewing} termsLibrary={termsLibrary} businessInfo={businessInfo} documents={documents} onBack={() => setViewing(null)} />;

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Channel Partners</h2>
          <p style={{ margin: '4px 0 0', color: '#888', fontSize: 13 }}>{channelPartners.length} partner{channelPartners.length !== 1 ? 's' : ''} — dealers, distributors, agents</p>
        </div>
        {canEdit && <button onClick={() => setEditing('new')} style={{ padding: '9px 20px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>+ Add Partner</button>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        {['All', ...PARTNER_STATUSES].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '5px 14px', borderRadius: 16, border: `1.5px solid ${s === 'All' ? '#1E2A4A' : (PARTNER_STATUS_COLOR[s] || '#1E2A4A')}`, background: filterStatus === s ? (s === 'All' ? '#1E2A4A' : PARTNER_STATUS_COLOR[s]) : '#fff', color: filterStatus === s ? '#fff' : '#555', fontWeight: 600, fontSize: 12 }}>
            {s} ({s === 'All' ? channelPartners.length : channelPartners.filter(p => p.status === s).length})
          </button>
        ))}
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, number, territory…" style={{ border: '1px solid #DDD8CE', borderRadius: 6, padding: '8px 14px', fontSize: 13, width: 300, marginBottom: 18 }} />
      {filtered.length === 0 && <div style={{ color: '#999', textAlign: 'center', padding: '60px 0', fontSize: 14 }}>No channel partners found.</div>}
      {filtered.map(p => {
        const linkedDocs = documents.filter(d => d.channelPartnerId === p.id);
        return (
          <div key={p.id} style={{ background: '#fff', border: '1px solid #EAE6DB', borderRadius: 10, padding: '16px 20px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#1E2A4A' }}>{p.name}</span>
                <span style={{ fontSize: 11, background: '#F0EDE6', color: '#555', borderRadius: 8, padding: '2px 8px', fontWeight: 600 }}>{p.type}</span>
                <span style={{ background: PARTNER_STATUS_COLOR[p.status] || '#888', color: '#fff', borderRadius: 10, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{p.status}</span>
              </div>
              <div style={{ fontSize: 12, color: '#888' }}>
                {p.number} · {p.territory || '—'} · {p.contactPerson || '—'}
                {linkedDocs.length > 0 && <span style={{ marginLeft: 10, color: '#2563EB' }}>{linkedDocs.length} linked doc{linkedDocs.length !== 1 ? 's' : ''}</span>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setViewing(p)} style={{ border: '1px solid #DDD8CE', borderRadius: 6, padding: '6px 12px', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Agreement</button>
              {canEdit && <button onClick={() => setEditing(p)} style={{ border: '1px solid #DDD8CE', borderRadius: 6, padding: '6px 12px', background: '#fff', fontSize: 12, cursor: 'pointer' }}>Edit</button>}
              {canEdit && <button onClick={() => handleDelete(p.id)} style={{ border: '1px solid #F3C5C5', borderRadius: 6, padding: '6px 10px', background: '#fff', fontSize: 12, color: '#B5453A', cursor: 'pointer' }}><Trash2 size={13} /></button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}


export function ChannelPartnerForm({ partner, termsLibrary, businessInfo, documents, onSave, onBack }) {
  const [form, setForm] = useState(partner);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const [commInput, setCommInput] = useState({ category: '', percentage: '' });
  const templates = termsLibrary?.templates || [];

  function addComm() {
    if (!commInput.category) return;
    set('commissions', [...(form.commissions || []), { ...commInput, id: crypto.randomUUID() }]);
    setCommInput({ category: '', percentage: '' });
  }

  const inputStyle = { width: '100%', border: '1px solid #DDD8CE', borderRadius: 6, padding: '8px 12px', fontSize: 13, boxSizing: 'border-box', marginTop: 4 };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: '#555' };
  const sectionHead = { fontSize: 13, fontWeight: 700, color: '#1E2A4A', borderBottom: '1px solid #EAE6DB', paddingBottom: 8, marginBottom: 14, marginTop: 24 };

  return (
    <div style={{ padding: 28, maxWidth: 760 }}>
      <button onClick={onBack} style={{ border: 'none', background: 'none', color: '#888', fontSize: 13, cursor: 'pointer', marginBottom: 16 }}>← Back to Partners</button>
      <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700 }}>{partner._isNew ? 'Add Channel Partner' : `Edit — ${form.name}`}</h2>

      <div style={sectionHead}>Partner Details</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><label style={labelStyle}>Partner No.</label><input value={form.number} onChange={e => set('number', e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Type</label><select value={form.type} onChange={e => set('type', e.target.value)} style={inputStyle}>{PARTNER_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
      </div>
      <div style={{ marginTop: 14 }}><label style={labelStyle}>Company / Partner Name</label><input value={form.name} onChange={e => set('name', e.target.value)} style={inputStyle} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <div><label style={labelStyle}>Territory / Region</label><input value={form.territory} onChange={e => set('territory', e.target.value)} placeholder="e.g. South India" style={inputStyle} /></div>
        <div><label style={labelStyle}>Status</label><select value={form.status} onChange={e => set('status', e.target.value)} style={inputStyle}>{PARTNER_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
        <div><label style={labelStyle}>GST / Tax ID</label><input value={form.taxId || ''} onChange={e => set('taxId', e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Address</label><input value={form.address || ''} onChange={e => set('address', e.target.value)} style={inputStyle} /></div>
      </div>

      <div style={sectionHead}>Contact</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <div><label style={labelStyle}>Contact Person</label><input value={form.contactPerson || ''} onChange={e => set('contactPerson', e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Phone</label><input value={form.contactPhone || ''} onChange={e => set('contactPhone', e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Email</label><input type="email" value={form.contactEmail || ''} onChange={e => set('contactEmail', e.target.value)} style={inputStyle} /></div>
      </div>

      <div style={sectionHead}>Commission Structure</div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 36px', gap: 8, marginBottom: 8, alignItems: 'flex-end' }}>
        <div><label style={labelStyle}>Product / Category</label><input value={commInput.category} onChange={e => setCommInput(p => ({ ...p, category: e.target.value }))} placeholder="e.g. All Products" style={inputStyle} /></div>
        <div><label style={labelStyle}>Commission %</label><input type="number" value={commInput.percentage} onChange={e => setCommInput(p => ({ ...p, percentage: e.target.value }))} placeholder="10" style={inputStyle} /></div>
        <button onClick={addComm} style={{ border: 'none', background: '#1E2A4A', color: '#fff', borderRadius: 6, padding: '9px 10px', cursor: 'pointer', fontSize: 16 }}>+</button>
      </div>
      {(form.commissions || []).map(cm => (
        <div key={cm.id} style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#FAFAF8', border: '1px solid #EAE6DB', borderRadius: 6, padding: '8px 12px', marginBottom: 6, fontSize: 13 }}>
          <span style={{ flex: 2 }}>{cm.category}</span>
          <span style={{ width: 80 }}>{cm.percentage}%</span>
          <button onClick={() => set('commissions', form.commissions.filter(c => c.id !== cm.id))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#B5453A' }}><Trash2 size={13} /></button>
        </div>
      ))}

      <div style={sectionHead}>Agreement</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div><label style={labelStyle}>Agreement Date</label><input type="date" value={form.agreementDate || ''} onChange={e => set('agreementDate', e.target.value)} style={inputStyle} /></div>
        <div><label style={labelStyle}>Expiry Date</label><input type="date" value={form.agreementExpiry || ''} onChange={e => set('agreementExpiry', e.target.value)} style={inputStyle} /></div>
      </div>
      {templates.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <label style={labelStyle}>Terms Template</label>
          <select value={form.termsTemplateId || ''} onChange={e => { set('termsTemplateId', e.target.value); if (e.target.value) set('agreementTerms', ''); }} style={inputStyle}>
            <option value="">— None / use custom text —</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
      )}
      {!form.termsTemplateId && <div style={{ marginTop: 14 }}><label style={labelStyle}>Custom Agreement Terms</label><textarea value={form.agreementTerms || ''} onChange={e => set('agreementTerms', e.target.value)} rows={5} placeholder="One term per line…" style={{ ...inputStyle, resize: 'vertical' }} /></div>}
      <div style={{ marginTop: 14 }}><label style={labelStyle}>Internal Notes</label><textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical' }} /></div>

      <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
        <button onClick={onBack} style={{ padding: '10px 24px', border: '1px solid #DDD8CE', borderRadius: 8, background: '#fff', fontSize: 14 }}>Cancel</button>
        <button onClick={() => { if (!form.name) return alert('Partner name required'); onSave(form); }} style={{ padding: '10px 24px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700 }}>Save Partner</button>
      </div>
    </div>
  );
}


export function PartnerAgreement({ partner: p, termsLibrary, businessInfo: bi, documents, onBack }) {
  const [useLHPartner, setUseLHPartner] = React.useState(!!(bi?.letterhead||bi?.letterheadHtml));
  const clauses   = termsLibrary?.clauses   || [];
  const templates = termsLibrary?.templates || [];
  const linkedDocs = documents.filter(d => d.channelPartnerId === p.id);

  function getTermsItems() {
    if (p.termsTemplateId) {
      const tmpl = templates.find(t => t.id === p.termsTemplateId);
      if (tmpl) {
        const items = (tmpl.clauseIds || []).map(id => { const c = clauses.find(x => x.id === id); return c ? { title: c.title, text: c.text } : null; }).filter(Boolean);
        return { items, extra: tmpl.customText };
      }
    }
    if (p.agreementTerms) return { items: p.agreementTerms.split('\n').filter(Boolean).map(t => ({ title: null, text: t })), extra: '' };
    return { items: [], extra: '' };
  }
  const terms = getTermsItems();

  return (
    <div>
      <div className="no-print" style={{ padding: '14px 28px', borderBottom: '1px solid #EAE6DB', display: 'flex', gap: 12, alignItems: 'center' }}>
        <button onClick={onBack} style={{ border: 'none', background: 'none', color: '#888', fontSize: 13, cursor: 'pointer' }}>← Back</button>
        {(bi?.letterhead||bi?.letterheadHtml) && <button onClick={() => setUseLHPartner(v=>!v)} style={{ ...styles.ghostBtn, ...(useLHPartner?{background:'#EEF2FF',color:'#3D52A0',fontWeight:600}:{}) }}>📃 {useLHPartner?'Letterhead ON':'Use Letterhead'}</button>}
        <button onClick={() => downloadDocPDF('.print-area','partner-agreement.pdf')} style={styles.ghostBtn}><Download size={13} style={{ marginRight: 4 }}/> PDF</button>
        <button onClick={() => window.print()} style={{ padding: '8px 20px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600 }}><Printer size={13} style={{ marginRight: 6 }} />Print Agreement</button>
        {linkedDocs.length > 0 && <span style={{ fontSize: 13, color: '#888' }}>{linkedDocs.length} linked document{linkedDocs.length !== 1 ? 's' : ''}</span>}
      </div>
      <div className="print-area" style={{ maxWidth: 780, margin: '28px auto', background: '#fff', padding: '48px 56px', fontFamily: 'Georgia, serif', fontSize: 13, lineHeight: 1.8, color: '#222', boxShadow: '0 2px 20px rgba(0,0,0,0.08)' }}>
        {useLHPartner && (bi?.letterhead || bi?.letterheadHtml || bi?.letterheadFooter) && <LetterpadPrintStyle />}
        {useLHPartner && <LetterheadHeader bi={bi} />}
        <div style={{ textAlign: 'center', borderBottom: '2px solid #1E2A4A', paddingBottom: 24, marginBottom: 32 }}>
          {!useLHPartner && (bi.name || bi.companyName) && <div style={{ fontSize: 22, fontWeight: 700, color: '#1E2A4A' }}>{bi.name || bi.companyName}</div>}
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2, marginTop: 20, color: '#1E2A4A', textTransform: 'uppercase' }}>Dealership / Channel Partner Agreement</div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>{p.number} | {p.agreementDate}</div>
        </div>
        <p style={{ marginBottom: 24 }}>This Agreement is made between <strong>{bi.name || bi.companyName || 'the Company'}</strong> and <strong>{p.name}</strong> ({p.type}), referred to as "the Partner".</p>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2A4A', marginBottom: 8, textTransform: 'uppercase' }}>Partner Details</div>
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            {[['Type', p.type], ['Territory', p.territory || '—'], ['Contact', p.contactPerson || '—'], ['Phone', p.contactPhone || '—'], ['Email', p.contactEmail || '—'], ['GST / Tax ID', p.taxId || '—'], ['Agreement Date', p.agreementDate], ['Expiry', p.agreementExpiry || 'Open-ended']].map(([k, v]) => (
              <tr key={k} style={{ borderBottom: '1px solid #EAE6DB' }}>
                <td style={{ padding: '6px 12px', fontWeight: 600, width: '35%', color: '#555' }}>{k}</td>
                <td style={{ padding: '6px 12px' }}>{v}</td>
              </tr>
            ))}
          </table>
        </div>
        {(p.commissions || []).length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2A4A', marginBottom: 8, textTransform: 'uppercase' }}>Commission Structure</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#1E2A4A', color: '#fff' }}><th style={{ padding: '7px 12px', textAlign: 'left' }}>Product / Category</th><th style={{ padding: '7px 12px', textAlign: 'right' }}>Commission %</th></tr></thead>
              <tbody>{p.commissions.map((cm, i) => <tr key={cm.id} style={{ background: i % 2 === 0 ? '#fff' : '#FAFAF8', borderBottom: '1px solid #EAE6DB' }}><td style={{ padding: '7px 12px' }}>{cm.category}</td><td style={{ padding: '7px 12px', textAlign: 'right' }}>{cm.percentage}%</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {terms.items.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2A4A', marginBottom: 12, textTransform: 'uppercase' }}>Terms & Conditions</div>
            {terms.items.map((item, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                {item.title && <div style={{ fontWeight: 700 }}>{i + 1}. {item.title}</div>}
                <div style={{ marginLeft: item.title ? 16 : 0 }}>{!item.title && `${i + 1}. `}{item.text}</div>
              </div>
            ))}
            {terms.extra && <div style={{ marginTop: 12 }}>{terms.extra}</div>}
          </div>
        )}
        <div style={{ marginTop: 48, borderTop: '1px solid #DDD8CE', paddingTop: 32, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48 }}>
          {['For ' + (bi.name || bi.companyName || 'the Company'), 'For ' + p.name].map((label, i) => (
            <div key={i}>
              <div style={{ fontWeight: 700, marginBottom: 40, fontSize: 13, color: '#555' }}>{label}</div>
              <div style={{ borderTop: '1px solid #333', paddingTop: 8, color: '#888', fontSize: 12 }}>Authorised Signatory | Date: ___________</div>
            </div>
          ))}
        </div>
        {useLHPartner && bi?.letterheadFooter && (
          <div className="lh-pad-footer" style={{ background: '#fff' }}>
            <img src={bi.letterheadFooter} alt="letterhead footer" style={{ width:'100%', display:'block' }} />
          </div>
        )}
      </div>
    </div>
  );
}


// ─── Scope of Work (Service companies) ───────────────────────────────────────
