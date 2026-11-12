import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertTriangle, BarChart2, Bell, BookOpen, Briefcase, CheckCircle, CheckSquare, ChevronDown, ChevronRight, ClipboardList, Clock, Cloud, CloudOff, Download, Factory, FileMinus, FileSignature, FileText, LayoutDashboard, Layers, LogOut, MapPin, Package, Paperclip, Pencil, Plus, Printer, Search, Settings, Shield, ShoppingCart, Square, Trash2, Truck, Users, Wrench, X } from 'lucide-react';
import { ROLE_MODULES, TEST_EMAILS, PLAN_MODULES, DOC_TYPES, CONVERT_TO, EMPTY_ITEM_ROW, blankDoc, COUNTRY_CONFIG, numToWords, currency, makeFmt, computeTotals, calcModuleTax, computeStock, downloadCSV, filterByRange, loadScript, parseOCRText, styles, TaxSummaryBox, DocPrintOverlay, Modal, LetterpadPrintStyle, sanitizeLHtml, LetterheadHeader, VoucherPrintHeader, VoucherSignatory, ApprovalActions, StatusBadge, DocRow, StatCard, BIZ_BADGE, DocumentsList, ConvertDropdown, PrintModal, DateRangePicker, SpecsFields, DrawingUploader, LockedModuleScreen, TemplateMiniPreview, sendNotificationEmail } from './utils.jsx';

export const MONTHS = [
  ['01','January'],['02','February'],['03','March'],['04','April'],
  ['05','May'],['06','June'],['07','July'],['08','August'],
  ['09','September'],['10','October'],['11','November'],['12','December'],
];

// ─── Employees ────────────────────────────────────────────────────────────────
/* ── HR Letters — Warning & Termination ─────────────────────────────────── */

export function printHRLetter(letter, emp, businessInfo) {
  const biz   = businessInfo || {};
  const date  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const isWarn = letter.type === 'warning';
  const isDraft = letter.status === 'draft';

  const warnTypeLabel = { verbal: 'Verbal Warning', written: 'Written Warning', final: 'Final Warning' };
  const termReasonLabel = {
    misconduct: 'Misconduct', performance: 'Poor Performance',
    redundancy: 'Redundancy / Restructuring', resignation: 'Voluntary Resignation',
    'contract-end': 'End of Contract', other: 'Other',
  };

  const title  = isWarn ? `${warnTypeLabel[letter.warnType] || 'Warning'} Letter` : 'Termination Letter';
  const refNo  = letter.refNo || `HR/${isWarn ? 'WL' : 'TL'}/-`;

  const bodyHtml = isWarn ? `
    <p>Dear <strong>${emp?.name || '___________'}</strong> (${emp?.designation || ''}),</p>
    <p>This letter serves as a formal <strong>${warnTypeLabel[letter.warnType] || 'Warning'}</strong> regarding the following matter:</p>
    <div style="background:#FFF8DC;border-left:4px solid #D97706;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0">
      <strong>Incident Date:</strong> ${letter.incidentDate || '___________'}<br/>
      <strong>Description:</strong><br/>${(letter.reason || '').replace(/\n/g, '<br/>')}
    </div>
    ${letter.previousWarnings && parseInt(letter.previousWarnings) > 0 ? `<p><strong>Previous Warnings on Record:</strong> ${letter.previousWarnings}</p>` : ''}
    <p><strong>Corrective Action Required:</strong><br/>${(letter.correctiveAction || '').replace(/\n/g, '<br/>')||'Please review and correct the behaviour mentioned above.'}</p>
    <p><strong>Consequence of Non-Compliance:</strong><br/>${(letter.consequence || 'Failure to improve may result in further disciplinary action including termination of employment.').replace(/\n/g, '<br/>')}</p>
    <p>You are advised to acknowledge receipt of this letter by signing below. This letter will be placed in your personnel file.</p>
  ` : `
    <p>Dear <strong>${emp?.name || '___________'}</strong> (${emp?.designation || ''}),</p>
    <p>We regret to inform you that your employment with <strong>${biz.name || 'the company'}</strong> is hereby terminated effective <strong>${letter.terminationDate || '___________'}</strong>.</p>
    <div style="background:#FEF2F2;border-left:4px solid #EF4444;padding:12px 16px;margin:16px 0;border-radius:0 6px 6px 0">
      <strong>Reason:</strong> ${termReasonLabel[letter.termReason] || letter.termReason || '___________'}<br/>
      ${letter.termDetails ? `<strong>Details:</strong><br/>${letter.termDetails.replace(/\n/g,'<br/>')}` : ''}
    </div>
    <p><strong>Last Working Day:</strong> ${letter.lastWorkingDay || letter.terminationDate || '___________'}</p>
    ${letter.noticePeriodServed === 'yes' ? '<p>Notice period has been duly served as per your contract.</p>' :
      letter.noticePeriodServed === 'payment' ? '<p>Notice period will be compensated via payment in lieu of notice.</p>' :
      '<p>Notice period waiver has been granted by mutual agreement.</p>'}
    ${letter.settlementDetails ? `<p><strong>Settlement / Final Pay:</strong><br/>${letter.settlementDetails.replace(/\n/g,'<br/>')}</p>` : ''}
    ${letter.returnItems ? `<p><strong>Company Property to be Returned:</strong><br/>${letter.returnItems.replace(/\n/g,'<br/>')}</p>` : ''}
    <p>Please ensure a smooth handover of all responsibilities, documentation, and company property before your last working day.</p>
    <p>We wish you well in your future endeavours.</p>
  `;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>${title} — ${emp?.name || ''}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; margin: 0; padding: 0; }
  .page { max-width: 780px; margin: 0 auto; padding: 48px 60px; position: relative; }
  .letterhead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1E2A4A; padding-bottom: 16px; margin-bottom: 28px; }
  .biz-name { font-size: 20px; font-weight: 700; color: #1E2A4A; }
  .biz-info { font-size: 11px; color: #555; line-height: 1.6; text-align: right; }
  h2 { text-align: center; color: #1E2A4A; font-size: 15px; letter-spacing: 0.05em; text-transform: uppercase; margin: 0 0 24px; }
  .ref { display: flex; justify-content: space-between; font-size: 12px; color: #555; margin-bottom: 20px; }
  p { line-height: 1.75; margin: 0 0 12px; }
  .sig { margin-top: 56px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
  .sig-box { text-align: center; }
  .sig-line { border-top: 1px solid #333; padding-top: 6px; font-size: 12px; color: #444; }
  .draft-watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 90px; color: rgba(200,0,0,0.08); font-weight: 900; pointer-events: none; z-index: 0; letter-spacing: 10px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style></head><body>
${isDraft ? '<div class="draft-watermark">DRAFT</div>' : ''}
<div class="page">
  <div class="letterhead">
    <div><div class="biz-name">${biz.name || 'Company Name'}</div>
      <div style="font-size:11px;color:#555;margin-top:4px">${biz.address || ''}</div></div>
    <div class="biz-info">${biz.phone ? 'Tel: ' + biz.phone + '<br/>' : ''}${biz.email ? biz.email + '<br/>' : ''}${biz.website || ''}</div>
  </div>
  <div class="ref"><span>Ref: ${refNo}</span><span>Date: ${letter.issueDate || date}</span></div>
  <h2>${title}</h2>
  ${bodyHtml}
  <div class="sig">
    <div class="sig-box"><div style="height:50px"></div><div class="sig-line">Authorised Signatory<br/>${biz.name || ''}</div></div>
    <div class="sig-box"><div style="height:50px"></div><div class="sig-line">Employee Acknowledgement<br/>${emp?.name || ''}</div></div>
  </div>
  ${isDraft ? '<p style="text-align:center;color:#999;font-size:11px;margin-top:24px">— DRAFT — Not for official use —</p>' : ''}
</div></body></html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}


// ─── Offer Letter Module ──────────────────────────────────────────────────────


export function printOfferLetterDoc(ol, businessInfo) {
  const biz  = businessInfo || {};
  const fmt  = makeFmt(businessInfo);
  const basic = parseFloat(ol.basicSalary) || 0;
  const hra   = parseFloat(ol.hra) || 0;
  const da    = parseFloat(ol.da) || 0;
  const other = parseFloat(ol.otherAllowances) || 0;
  const gross = basic + hra + da + other;
  const date  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Offer Letter — ${ol.candidateName}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; margin: 0; padding: 0; }
  .page { max-width: 780px; margin: 0 auto; padding: 48px 60px; }
  .lh { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #1E2A4A; padding-bottom:16px; margin-bottom:28px; }
  .bname { font-size:20px; font-weight:700; color:#1E2A4A; }
  .binfo { font-size:11px; color:#555; line-height:1.6; text-align:right; }
  h2 { text-align:center; color:#1E2A4A; margin:0 0 24px; font-size:16px; letter-spacing:.05em; text-transform:uppercase; }
  .ref { text-align:right; font-size:12px; color:#555; margin-bottom:20px; }
  p { line-height:1.7; margin:0 0 12px; }
  h3 { color:#1E2A4A; font-size:13px; margin:16px 0 8px; }
  table { width:100%; border-collapse:collapse; margin:12px 0; font-size:12px; }
  th { background:#1E2A4A; color:#fff; padding:7px 10px; text-align:left; }
  td { border:1px solid #ddd; padding:6px 10px; }
  tr:nth-child(even) td { background:#F8F8F8; }
  .total td { font-weight:700; background:#EEF2FF !important; }
  .sig { margin-top:60px; display:flex; justify-content:space-between; }
  .sig-box { text-align:center; width:180px; }
  .sig-line { border-top:1px solid #333; padding-top:6px; font-size:12px; }
  .draft-wm { position:fixed; top:50%; left:50%; transform:translate(-50%,-50%) rotate(-35deg); font-size:90px; color:rgba(200,0,0,0.08); font-weight:900; pointer-events:none; z-index:0; }
  @media print { body { -webkit-print-color-adjust:exact; } }
</style></head><body>
${ol.status === 'draft' ? '<div class="draft-wm">DRAFT</div>' : ''}
<div class="page">
<div class="lh">
  <div><div class="bname">${biz.name || 'Company Name'}</div>
    <div style="font-size:11px;color:#555;margin-top:4px">${biz.address || ''}</div></div>
  <div class="binfo">${biz.phone ? 'Tel: '+biz.phone+'<br/>' : ''}${biz.email ? biz.email+'<br/>' : ''}${biz.website || ''}</div>
</div>
<div class="ref">Date: ${ol.issueDate || date} &nbsp;|&nbsp; Ref: ${ol.refNo || 'HR/OL/-'}</div>
<h2>Letter of Offer</h2>
<p>Dear <strong>${ol.candidateName}</strong>,</p>
<p>We are pleased to offer you the position of <strong>${ol.designation || '___'}</strong> in the <strong>${ol.department || '___'}</strong> department at <strong>${biz.name || 'our company'}</strong>, subject to the terms and conditions set forth below.</p>
<table>
  <tr><td style="width:40%;color:#666">Date of Joining</td><td><strong>${ol.joiningDate || '___'}</strong></td></tr>
  ${ol.reportingTo ? `<tr><td style="color:#666">Reporting To</td><td>${ol.reportingTo}</td></tr>` : ''}
  ${ol.probation ? `<tr><td style="color:#666">Probation Period</td><td>${ol.probation} month(s)</td></tr>` : ''}
  ${ol.workLocation ? `<tr><td style="color:#666">Work Location</td><td>${ol.workLocation}</td></tr>` : ''}
  ${ol.workHours ? `<tr><td style="color:#666">Working Hours</td><td>${ol.workHours}</td></tr>` : ''}
</table>
<h3>Compensation Structure</h3>
<table>
  <tr><th>Component</th><th style="text-align:right">Amount (Per Month)</th></tr>
  <tr><td>Basic Salary</td><td style="text-align:right">${fmt(basic)}</td></tr>
  ${hra ? `<tr><td>HRA</td><td style="text-align:right">${fmt(hra)}</td></tr>` : ''}
  ${da ? `<tr><td>DA</td><td style="text-align:right">${fmt(da)}</td></tr>` : ''}
  ${other ? `<tr><td>Other Allowances</td><td style="text-align:right">${fmt(other)}</td></tr>` : ''}
  <tr class="total"><td>Gross Monthly CTC</td><td style="text-align:right">${fmt(gross)}</td></tr>
</table>
${ol.additionalTerms ? `<h3>Additional Terms</h3><p style="white-space:pre-line">${ol.additionalTerms}</p>` : ''}
<p>This offer is contingent upon successful completion of background verification and submission of required documents. Please sign and return a copy by <strong>${ol.acceptanceDeadline || ol.joiningDate || '___'}</strong>.</p>
<p>We look forward to welcoming you to our team.</p>
<p>Warm regards,</p>
<div class="sig">
  <div class="sig-box"><div style="height:48px"></div><div class="sig-line">Authorised Signatory<br/>${biz.name || ''}</div></div>
  <div class="sig-box"><div style="height:48px"></div><div class="sig-line">Acceptance<br/>${ol.candidateName}</div></div>
</div>
</div></body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}


export function OfferLetterView({ offerLetters, setHrLetters, employees, userRole, businessInfo }) {
  const [subView, setSubView] = useState('list');
  const [active,  setActive]  = useState(null);
  const canEdit = userRole === 'admin' || userRole === 'manager';

  const STATUS_STYLE = {
    draft:    { background: '#F3F2EF', color: '#6B7494' },
    sent:     { background: '#DBEAFE', color: '#1D4ED8' },
    accepted: { background: '#D1FAE5', color: '#065F46' },
    declined: { background: '#FEE2E2', color: '#B91C1C' },
    expired:  { background: '#FEF3C7', color: '#92400E' },
  };

  function saveOffer(ol) {
    setHrLetters(prev => {
      const idx = prev.findIndex(l => l.id === ol.id);
      if (idx >= 0) { const a = [...prev]; a[idx] = ol; return a; }
      return [...prev, ol];
    });
    setSubView('list');
    setActive(null);
  }

  function updateStatus(id, status) {
    setHrLetters(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  }

  function deleteOffer(id) {
    if (!window.confirm('Delete this offer letter?')) return;
    setHrLetters(prev => prev.filter(l => l.id !== id));
  }

  if (subView === 'form') {
    return (
      <OfferLetterForm
        ol={active}
        employees={employees}
        businessInfo={businessInfo}
        onSave={saveOffer}
        onClose={() => { setSubView('list'); setActive(null); }}
      />
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="serif" style={styles.h1}>Offer Letters</h2>
          <div style={styles.muted}>{offerLetters.length} offer letter{offerLetters.length !== 1 ? 's' : ''}</div>
        </div>
        {canEdit && (
          <button style={styles.primaryBtn} onClick={() => { setActive(null); setSubView('form'); }}>
            <Plus size={15} /> New Offer Letter
          </button>
        )}
      </div>

      {offerLetters.length === 0 ? (
        <div style={styles.emptyBox}>No offer letters yet. Create one to get started.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Ref No.', 'Candidate', 'Designation', 'Issue Date', 'Joining Date', 'Status', ''].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...offerLetters].sort((a, b) => (b.issueDate || '') > (a.issueDate || '') ? 1 : -1).map(ol => (
                <tr key={ol.id}>
                  <td style={{ ...styles.td, fontFamily: 'monospace', fontWeight: 600, color: '#C9A24B' }}>{ol.refNo}</td>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{ol.candidateName || '—'}</td>
                  <td style={styles.td}>{ol.designation || '—'}</td>
                  <td style={styles.td}>{ol.issueDate || '—'}</td>
                  <td style={styles.td}>{ol.joiningDate || '—'}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...(STATUS_STYLE[ol.status] || STATUS_STYLE.draft) }}>
                      {ol.status || 'draft'}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {canEdit && (!ol.status || ol.status === 'draft') && (
                        <button style={{ ...styles.secondaryBtn, fontSize: 11, padding: '3px 9px', color: '#2255A0', borderColor: '#2255A0', background: '#EEF1F8' }}
                          onClick={() => updateStatus(ol.id, 'sent')}>Send →</button>
                      )}
                      {canEdit && ol.status === 'sent' && (
                        <>
                          <button style={{ ...styles.secondaryBtn, fontSize: 11, padding: '3px 9px', color: '#065F46', borderColor: '#059669', background: '#D1FAE5' }}
                            onClick={() => updateStatus(ol.id, 'accepted')}>✓ Accepted</button>
                          <button style={{ ...styles.secondaryBtn, fontSize: 11, padding: '3px 9px', color: '#B91C1C', borderColor: '#B91C1C', background: '#FEE2E2' }}
                            onClick={() => updateStatus(ol.id, 'declined')}>Declined</button>
                          <button style={{ ...styles.secondaryBtn, fontSize: 11, padding: '3px 9px', color: '#92400E', borderColor: '#D97706', background: '#FEF3C7' }}
                            onClick={() => updateStatus(ol.id, 'expired')}>Expired</button>
                        </>
                      )}
                      {canEdit && (ol.status === 'declined' || ol.status === 'expired') && (
                        <button style={{ ...styles.secondaryBtn, fontSize: 11, padding: '3px 9px', color: '#6B7494', borderColor: '#6B7494', background: '#F3F2EF' }}
                          onClick={() => updateStatus(ol.id, 'draft')}>↩ Revert</button>
                      )}
                      <button style={styles.iconBtn} title="Print" onClick={() => printOfferLetterDoc(ol, businessInfo)}><Printer size={14} /></button>
                      {canEdit && <button style={styles.iconBtn} onClick={() => { setActive(ol); setSubView('form'); }}><Pencil size={14} /></button>}
                      {canEdit && <button style={{ ...styles.iconBtn, color: '#B5453A' }} onClick={() => deleteOffer(ol.id)}><Trash2 size={14} /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


export function OfferLetterForm({ ol, employees, businessInfo, onSave, onClose }) {
  const country = businessInfo?.country || 'india';

  function nextRef() {
    return 'OL-' + new Date().getFullYear() + '-' + String(Date.now()).slice(-4);
  }

  const blank = {
    id: crypto.randomUUID(),
    type: 'offer',
    refNo: nextRef(),
    issueDate: new Date().toISOString().slice(0, 10),
    candidateName: '',
    employeeId: '',
    designation: '',
    department: '',
    joiningDate: '',
    reportingTo: '',
    probation: '3',
    workLocation: businessInfo?.address || '',
    workHours: '9 AM – 6 PM, Mon – Sat',
    basicSalary: '',
    hra: '',
    da: '',
    otherAllowances: '',
    acceptanceDeadline: '',
    additionalTerms: '',
    status: 'draft',
  };

  const [form, setForm] = useState(ol ? { ...blank, ...ol } : blank);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Auto-fill from employee
  function handleEmpChange(empId) {
    set('employeeId', empId);
    if (!empId) return;
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    setForm(p => ({
      ...p,
      employeeId: empId,
      candidateName: p.candidateName || emp.name,
      designation: p.designation || emp.designation || '',
      department: p.department || emp.department || '',
      joiningDate: p.joiningDate || emp.joiningDate || '',
      basicSalary: p.basicSalary || emp.basicSalary || '',
      hra: p.hra || emp.hra || '',
      da: p.da || emp.da || '',
      otherAllowances: p.otherAllowances || emp.otherAllowances || '',
    }));
  }

  const basic = parseFloat(form.basicSalary) || 0;
  const hra   = parseFloat(form.hra) || 0;
  const da    = parseFloat(form.da) || 0;
  const other = parseFloat(form.otherAllowances) || 0;
  const gross = basic + hra + da + other;
  const fmt   = makeFmt(businessInfo);

  const S = styles;

  return (
    <div style={S.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="serif" style={S.h1}>{ol ? 'Edit Offer Letter' : 'New Offer Letter'}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.ghostBtn} onClick={onClose}>Cancel</button>
          <button style={S.ghostBtn} onClick={() => printOfferLetterDoc({ ...form }, businessInfo)}><Printer size={14} /> Preview</button>
          <button style={S.primaryBtn} onClick={() => onSave(form)}>Save</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Left col */}
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#C9A24B', borderBottom: '1px solid #EAE6DB', paddingBottom: 4, marginBottom: 12 }}>Letter Details</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={S.formGroup}><label style={S.label}>Ref No.</label>
              <input style={S.input} value={form.refNo} onChange={e => set('refNo', e.target.value)} /></div>
            <div style={S.formGroup}><label style={S.label}>Issue Date</label>
              <input style={S.input} type="date" value={form.issueDate} onChange={e => set('issueDate', e.target.value)} /></div>
            <div style={S.formGroup}><label style={S.label}>Acceptance Deadline</label>
              <input style={S.input} type="date" value={form.acceptanceDeadline} onChange={e => set('acceptanceDeadline', e.target.value)} /></div>
            <div style={S.formGroup}>
              <label style={S.label}>Status</label>
              <select style={S.input} value={form.status} onChange={e => set('status', e.target.value)}>
                {['draft','sent','accepted','declined','expired'].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#C9A24B', borderBottom: '1px solid #EAE6DB', paddingBottom: 4, marginBottom: 12, marginTop: 16 }}>Candidate</div>
          <div style={S.formGroup}><label style={S.label}>Link to Employee (optional — auto-fills salary)</label>
            <select style={S.input} value={form.employeeId || ''} onChange={e => handleEmpChange(e.target.value)}>
              <option value="">— New Candidate / Not Linked —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.empId})</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={S.formGroup}><label style={S.label}>Candidate Name *</label>
              <input style={S.input} value={form.candidateName} onChange={e => set('candidateName', e.target.value)} placeholder="Full name" /></div>
            <div style={S.formGroup}><label style={S.label}>Designation</label>
              <input style={S.input} value={form.designation} onChange={e => set('designation', e.target.value)} /></div>
            <div style={S.formGroup}><label style={S.label}>Department</label>
              <input style={S.input} value={form.department} onChange={e => set('department', e.target.value)} /></div>
            <div style={S.formGroup}><label style={S.label}>Joining Date</label>
              <input style={S.input} type="date" value={form.joiningDate} onChange={e => set('joiningDate', e.target.value)} /></div>
            <div style={S.formGroup}><label style={S.label}>Reporting To</label>
              <input style={S.input} value={form.reportingTo} onChange={e => set('reportingTo', e.target.value)} /></div>
            <div style={S.formGroup}><label style={S.label}>Probation (months)</label>
              <input style={S.input} type="number" value={form.probation} onChange={e => set('probation', e.target.value)} /></div>
            <div style={{ ...S.formGroup, gridColumn: '1/-1' }}><label style={S.label}>Work Location</label>
              <input style={S.input} value={form.workLocation} onChange={e => set('workLocation', e.target.value)} /></div>
            <div style={{ ...S.formGroup, gridColumn: '1/-1' }}><label style={S.label}>Working Hours</label>
              <input style={S.input} value={form.workHours} onChange={e => set('workHours', e.target.value)} /></div>
          </div>
        </div>

        {/* Right col */}
        <div>
          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#C9A24B', borderBottom: '1px solid #EAE6DB', paddingBottom: 4, marginBottom: 12 }}>Compensation</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={S.formGroup}><label style={S.label}>Basic Salary</label>
              <input style={S.input} type="number" value={form.basicSalary} onChange={e => set('basicSalary', e.target.value)} /></div>
            {country === 'india' && <>
              <div style={S.formGroup}><label style={S.label}>HRA</label>
                <input style={S.input} type="number" value={form.hra} onChange={e => set('hra', e.target.value)} /></div>
              <div style={S.formGroup}><label style={S.label}>DA</label>
                <input style={S.input} type="number" value={form.da} onChange={e => set('da', e.target.value)} /></div>
            </>}
            <div style={S.formGroup}><label style={S.label}>{country === 'india' ? 'Other Allowances' : 'Allowances'}</label>
              <input style={S.input} type="number" value={form.otherAllowances} onChange={e => set('otherAllowances', e.target.value)} /></div>
          </div>
          {gross > 0 && (
            <div style={{ background: '#1E2A4A', color: '#fff', borderRadius: 8, padding: '10px 16px', marginTop: 8, fontSize: 13 }}>
              Gross Monthly CTC: <strong style={{ color: '#C9A24B', fontSize: 15 }}>{fmt(gross)}</strong>
            </div>
          )}

          <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: '#C9A24B', borderBottom: '1px solid #EAE6DB', paddingBottom: 4, marginBottom: 12, marginTop: 20 }}>Additional Terms</div>
          <div style={S.formGroup}>
            <label style={S.label}>Additional Terms / Conditions</label>
            <textarea style={{ ...S.input, height: 120, resize: 'vertical' }}
              value={form.additionalTerms}
              onChange={e => set('additionalTerms', e.target.value)}
              placeholder="Enter any additional terms, benefits, clauses, etc." />
          </div>
        </div>

      </div>
    </div>
  );
}


export function HRLettersView({ letterType, hrLetters, setHrLetters, employees, userRole, businessInfo }) {
  const [subView,    setSubView]    = useState('list');
  const [activeLetter, setActiveLetter] = useState(null);
  const canEdit = userRole === 'admin' || userRole === 'manager';

  const isWarn = letterType === 'warning';
  const filtered = hrLetters.filter(l => l.type === letterType);
  const title = isWarn ? 'Warning Letters' : 'Termination Letters';

  function saveLetter(letter) {
    setHrLetters(prev => {
      const idx = prev.findIndex(l => l.id === letter.id);
      if (idx >= 0) { const a = [...prev]; a[idx] = letter; return a; }
      return [...prev, letter];
    });
    setSubView('list');
    setActiveLetter(null);
  }

  function updateLetterStatus(id, status) {
    setHrLetters(prev => prev.map(l => l.id === id ? { ...l, status } : l));
  }

  function deleteLetter(id) {
    if (!window.confirm('Delete this letter?')) return;
    setHrLetters(prev => prev.filter(l => l.id !== id));
    setSubView('list');
  }

  if (subView === 'form') {
    return (
      <HRLetterForm
        letterType={letterType}
        letter={activeLetter}
        employees={employees}
        businessInfo={businessInfo}
        onSave={saveLetter}
        onClose={() => setSubView('list')}
      />
    );
  }

  const STATUS_STYLE = {
    draft:        { background: '#F3F2EF', color: '#6B7494' },
    issued:       { background: '#DBEAFE', color: '#1D4ED8' },
    acknowledged: { background: '#D1FAE5', color: '#065F46' },
    withdrawn:    { background: '#FEE2E2', color: '#B91C1C' },
  };

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="serif" style={styles.h1}>{title}</h2>
          <div style={styles.muted}>{filtered.length} letter{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        {canEdit && (
          <button style={styles.primaryBtn} onClick={() => { setActiveLetter(null); setSubView('form'); }}>
            <Plus size={15} /> New Letter
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div style={styles.emptyBox}>No {title.toLowerCase()} yet.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Ref No.', 'Employee', isWarn ? 'Warning Type' : 'Reason', 'Issue Date', isWarn ? 'Incident Date' : 'Last Working Day', 'Status', ''].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...filtered].sort((a, b) => (b.issueDate || '') > (a.issueDate || '') ? 1 : -1).map(letter => {
                const emp = employees.find(e => e.id === letter.employeeId);
                const WARN_TYPE = { verbal: 'Verbal', written: 'Written', final: 'Final Warning' };
                const TERM_REASON = { misconduct: 'Misconduct', performance: 'Performance', redundancy: 'Redundancy', resignation: 'Resignation', 'contract-end': 'Contract End', other: 'Other' };
                return (
                  <tr key={letter.id}>
                    <td style={{ ...styles.td, fontFamily: 'monospace', fontWeight: 600 }}>{letter.refNo}</td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{emp?.name || '—'}</td>
                    <td style={styles.td}>{isWarn ? (WARN_TYPE[letter.warnType] || '—') : (TERM_REASON[letter.termReason] || letter.termReason || '—')}</td>
                    <td style={styles.td}>{letter.issueDate || '—'}</td>
                    <td style={styles.td}>{isWarn ? (letter.incidentDate || '—') : (letter.lastWorkingDay || '—')}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...(STATUS_STYLE[letter.status] || STATUS_STYLE.draft) }}>
                        {letter.status || 'draft'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        {/* Status progression buttons */}
                        {canEdit && (!letter.status || letter.status === 'draft') && (
                          <button
                            title="Forward for issue"
                            style={{ ...styles.secondaryBtn, fontSize: 11, padding: '3px 9px', color: '#2255A0', borderColor: '#2255A0', background: '#EEF1F8' }}
                            onClick={() => updateLetterStatus(letter.id, 'issued')}>
                            Issue →
                          </button>
                        )}
                        {canEdit && letter.status === 'issued' && (
                          <button
                            title="Mark as acknowledged by employee"
                            style={{ ...styles.secondaryBtn, fontSize: 11, padding: '3px 9px', color: '#065F46', borderColor: '#059669', background: '#D1FAE5' }}
                            onClick={() => updateLetterStatus(letter.id, 'acknowledged')}>
                            ✓ Acknowledged
                          </button>
                        )}
                        {canEdit && (letter.status === 'issued' || letter.status === 'acknowledged') && (
                          <button
                            title="Withdraw this letter"
                            style={{ ...styles.secondaryBtn, fontSize: 11, padding: '3px 9px', color: '#B91C1C', borderColor: '#B91C1C', background: '#FEE2E2' }}
                            onClick={() => { if (window.confirm('Withdraw this letter?')) updateLetterStatus(letter.id, 'withdrawn'); }}>
                            Withdraw
                          </button>
                        )}
                        {canEdit && letter.status === 'withdrawn' && (
                          <button
                            title="Revert to draft"
                            style={{ ...styles.secondaryBtn, fontSize: 11, padding: '3px 9px', color: '#6B7494', borderColor: '#6B7494', background: '#F3F2EF' }}
                            onClick={() => updateLetterStatus(letter.id, 'draft')}>
                            ↩ Revert
                          </button>
                        )}
                        {/* Actions */}
                        <button style={styles.iconBtn} onClick={() => printHRLetter(letter, emp, businessInfo)} title="Print"><Printer size={14} /></button>
                        {canEdit && <button style={styles.iconBtn} onClick={() => { setActiveLetter(letter); setSubView('form'); }}><Pencil size={14} /></button>}
                        {canEdit && <button style={{ ...styles.iconBtn, color: '#B5453A' }} onClick={() => deleteLetter(letter.id)}><Trash2 size={14} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


export function HRLetterForm({ letterType, letter, employees, businessInfo, onSave, onClose }) {
  const isWarn = letterType === 'warning';
  const count  = Date.now();
  const prefix = isWarn ? 'HR/WL/' : 'HR/TL/';

  const blank = isWarn ? {
    id: crypto.randomUUID(),
    type: 'warning',
    refNo: prefix + String(count).slice(-4),
    employeeId: '',
    issueDate: new Date().toISOString().slice(0, 10),
    warnType: 'written',
    incidentDate: '',
    reason: '',
    previousWarnings: '0',
    correctiveAction: '',
    consequence: 'Failure to improve may result in further disciplinary action including termination of employment.',
    status: 'draft',
  } : {
    id: crypto.randomUUID(),
    type: 'termination',
    refNo: prefix + String(count).slice(-4),
    employeeId: '',
    issueDate: new Date().toISOString().slice(0, 10),
    terminationDate: '',
    lastWorkingDay: '',
    termReason: 'misconduct',
    termDetails: '',
    noticePeriodServed: 'yes',
    settlementDetails: '',
    returnItems: '',
    status: 'draft',
  };

  const [form, setForm] = useState(letter ? { ...blank, ...letter } : blank);
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const selEmp = employees.find(e => e.id === form.employeeId);

  function Field({ label, name, type = 'text', textarea = false, options }) {
    if (options) {
      return (
        <div style={styles.formGroup}>
          <label style={styles.label}>{label}</label>
          <select style={styles.input} value={form[name] || ''} onChange={e => set(name, e.target.value)}>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      );
    }
    if (textarea) {
      return (
        <div style={styles.formGroup}>
          <label style={styles.label}>{label}</label>
          <textarea style={{ ...styles.input, height: 76, resize: 'vertical' }} value={form[name] || ''} onChange={e => set(name, e.target.value)} />
        </div>
      );
    }
    return (
      <div style={styles.formGroup}>
        <label style={styles.label}>{label}</label>
        <input style={styles.input} type={type} value={form[name] || ''} onChange={e => set(name, e.target.value)} />
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 className="serif" style={styles.h1}>{letter ? 'Edit' : 'New'} {isWarn ? 'Warning Letter' : 'Termination Letter'}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.ghostBtn} onClick={() => printHRLetter(form, selEmp, businessInfo)}><Printer size={14} /> Preview</button>
          <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
          <button style={styles.primaryBtn} onClick={() => onSave(form)}>Save Letter</button>
        </div>
      </div>

      <div style={{ background: '#F8F9FC', borderRadius: 8, padding: '14px 18px', marginBottom: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <EmpField {...fp} label="Reference No." name="refNo" />
          <EmpField {...fp} label="Issue Date" name="issueDate" type="date" />
          <EmpField {...fp} label="Status" name="status" options={[
            { value: 'draft',        label: 'Draft' },
            { value: 'issued',       label: 'Issued' },
            { value: 'acknowledged', label: 'Acknowledged' },
            { value: 'withdrawn',    label: 'Withdrawn' },
          ]} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Employee *</label>
          <select style={styles.input} value={form.employeeId || ''} onChange={e => set('employeeId', e.target.value)}>
            <option value="">— Select Employee —</option>
            {[...employees].sort((a,b) => (a.name||'') > (b.name||'') ? 1 : -1).map(e => (
              <option key={e.id} value={e.id}>{e.name} ({e.empId}) — {e.designation}</option>
            ))}
          </select>
        </div>
      </div>

      {isWarn ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <EmpField {...fp} label="Warning Type" name="warnType" options={[
              { value: 'verbal',  label: 'Verbal Warning' },
              { value: 'written', label: 'Written Warning' },
              { value: 'final',   label: 'Final Warning' },
            ]} />
            <EmpField {...fp} label="Incident Date" name="incidentDate" type="date" />
            <EmpField {...fp} label="Previous Warnings on Record" name="previousWarnings" type="number" />
          </div>
          <EmpField {...fp} label="Reason / Incident Description *" name="reason" textarea />
          <EmpField {...fp} label="Corrective Action Required" name="correctiveAction" textarea />
          <EmpField {...fp} label="Consequence if Not Corrected" name="consequence" textarea />
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <EmpField {...fp} label="Termination Date" name="terminationDate" type="date" />
            <EmpField {...fp} label="Last Working Day" name="lastWorkingDay" type="date" />
            <EmpField {...fp} label="Reason for Termination" name="termReason" options={[
              { value: 'misconduct',    label: 'Misconduct' },
              { value: 'performance',   label: 'Poor Performance' },
              { value: 'redundancy',    label: 'Redundancy / Restructuring' },
              { value: 'resignation',   label: 'Voluntary Resignation' },
              { value: 'contract-end',  label: 'End of Contract' },
              { value: 'other',         label: 'Other' },
            ]} />
            <EmpField {...fp} label="Notice Period" name="noticePeriodServed" options={[
              { value: 'yes',     label: 'Served in full' },
              { value: 'payment', label: 'Payment in lieu of notice' },
              { value: 'waived',  label: 'Waived by mutual agreement' },
            ]} />
          </div>
          <EmpField {...fp} label="Additional Details" name="termDetails" textarea />
          <EmpField {...fp} label="Settlement / Final Pay Details (gratuity, leave encashment, etc.)" name="settlementDetails" textarea />
          <EmpField {...fp} label="Company Property to be Returned" name="returnItems" textarea />
        </>
      )}
    </div>
  );
}


/* ── HR Employee Module Helpers ─────────────────────────────────────────── */

export const GULF_COUNTRIES_HR = ['uae','saudi','kuwait','qatar','bahrain','oman'];


export function hrExpiryDays(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

export function hrExpiryStatus(dateStr) {
  const d = hrExpiryDays(dateStr);
  if (d === null) return null;
  if (d <= 0)  return 'expired';
  if (d <= 30) return 'critical';
  if (d <= 90) return 'warning';
  return 'ok';
}

export function getEmpDocAlerts(emp, isGulf, country) {
  const docs = [];
  if (isGulf) {
    docs.push({ field: 'passportExpiry',       label: 'Passport' });
    docs.push({ field: 'visaExpiry',           label: 'Visa' });
    docs.push({ field: 'emiratesIdExpiry',     label: country === 'uae' ? 'Emirates ID' : 'Civil ID' });
    docs.push({ field: 'labourCardExpiry',     label: 'Labour Card' });
    docs.push({ field: 'stampingExpiry',       label: 'Visa Stamping' });
  }
  docs.push({ field: 'medicalInsuranceExpiry', label: 'Medical Ins.' });
  (emp.customDocs || []).forEach(d => docs.push({ field: '__c', label: d.name, customExpiry: d.expiry }));

  return docs.map(doc => {
    const dateStr = doc.customExpiry !== undefined ? doc.customExpiry : emp[doc.field];
    const status  = hrExpiryStatus(dateStr);
    return (status && status !== 'ok') ? { ...doc, dateStr, status, days: hrExpiryDays(dateStr) } : null;
  }).filter(Boolean);
}


export function printOfferLetter(emp, businessInfo) {
  const biz   = businessInfo || {};
  const fmt   = makeFmt(businessInfo);
  const basic = parseFloat(emp.basicSalary) || 0;
  const hra   = parseFloat(emp.hra) || 0;
  const da    = parseFloat(emp.da) || 0;
  const other = parseFloat(emp.otherAllowances) || 0;
  const gross = basic + hra + da + other;
  const date  = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>Offer Letter — ${emp.name}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 13px; color: #222; margin: 0; padding: 0; }
  .page { max-width: 780px; margin: 0 auto; padding: 48px 60px; }
  .letterhead { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1E2A4A; padding-bottom: 16px; margin-bottom: 28px; }
  .biz-name { font-size: 20px; font-weight: 700; color: #1E2A4A; }
  .biz-info { font-size: 11px; color: #555; line-height: 1.6; text-align: right; }
  h2 { text-align: center; color: #1E2A4A; margin: 0 0 24px; font-size: 16px; letter-spacing: 0.05em; text-transform: uppercase; }
  .ref { text-align: right; font-size: 12px; color: #555; margin-bottom: 20px; }
  p { line-height: 1.7; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 12px; }
  th { background: #1E2A4A; color: #fff; padding: 7px 10px; text-align: left; }
  td { border: 1px solid #ddd; padding: 6px 10px; }
  tr:nth-child(even) td { background: #F8F8F8; }
  .total td { font-weight: 700; background: #EEF2FF !important; }
  .sig { margin-top: 60px; display: flex; justify-content: space-between; }
  .sig-box { text-align: center; width: 180px; }
  .sig-line { border-top: 1px solid #333; padding-top: 6px; font-size: 12px; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style></head><body><div class="page">
<div class="letterhead">
  <div><div class="biz-name">${biz.name || 'Company Name'}</div>
    <div style="font-size:11px;color:#555;margin-top:4px">${biz.address || ''}</div></div>
  <div class="biz-info">${biz.phone ? 'Tel: ' + biz.phone + '<br/>' : ''}${biz.email ? biz.email + '<br/>' : ''}${biz.website || ''}</div>
</div>
<div class="ref">Date: ${date} &nbsp;|&nbsp; Ref: ${emp.empId || 'HR/OL/-'}</div>
<h2>Offer Letter</h2>
<p>Dear <strong>${emp.name}</strong>,</p>
<p>We are pleased to offer you the position of <strong>${emp.designation || '___________'}</strong> in the <strong>${emp.department || '___________'}</strong> department at <strong>${biz.name || 'our company'}</strong>, subject to the terms and conditions set forth below.</p>
<p><strong>Date of Joining:</strong> ${emp.joiningDate || '___________'}</p>
<h3 style="color:#1E2A4A;font-size:13px;margin:16px 0 8px">Compensation Structure</h3>
<table>
  <tr><th>Component</th><th style="text-align:right">Amount (Per Month)</th></tr>
  <tr><td>Basic Salary</td><td style="text-align:right">${fmt(basic)}</td></tr>
  ${hra ? `<tr><td>HRA</td><td style="text-align:right">${fmt(hra)}</td></tr>` : ''}
  ${da ? `<tr><td>DA</td><td style="text-align:right">${fmt(da)}</td></tr>` : ''}
  ${other ? `<tr><td>Other Allowances</td><td style="text-align:right">${fmt(other)}</td></tr>` : ''}
  <tr class="total"><td>Gross Monthly Salary</td><td style="text-align:right">${fmt(gross)}</td></tr>
</table>
<p>This offer is contingent upon the successful completion of background verification and submission of all required documents. By accepting this offer, you agree to abide by the company's policies and code of conduct.</p>
<p>Please sign and return a copy of this letter by <strong>${emp.joiningDate || '___________'}</strong> to confirm your acceptance.</p>
<p>We look forward to welcoming you to the team.</p>
<p>Warm regards,</p>
<div class="sig">
  <div class="sig-box"><div style="height:48px"></div><div class="sig-line">Authorised Signatory<br/>${biz.name || ''}</div></div>
  <div class="sig-box"><div style="height:48px"></div><div class="sig-line">Employee Acceptance<br/>${emp.name}</div></div>
</div>
</div></body></html>`;
  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 400);
}


export function EmployeesView({ employees, setEmployees, userRole, businessInfo }) {
  const [subView,   setSubView]   = useState('list');
  const [activeEmp, setActiveEmp] = useState(null);
  const canEdit = userRole === 'admin' || userRole === 'manager';

  const country = businessInfo?.country || 'india';
  const isGulf  = GULF_COUNTRIES_HR.includes(country);

  const allAlerts = employees.flatMap(emp =>
    getEmpDocAlerts(emp, isGulf, country).map(a => ({ ...a, emp }))
  );

  function saveEmployee(emp) {
    setEmployees(prev => {
      const idx = prev.findIndex(e => e.id === emp.id);
      if (idx >= 0) { const a = [...prev]; a[idx] = emp; return a; }
      return [...prev, emp];
    });
    setActiveEmp(emp);
    setSubView('detail');
  }

  function deleteEmployee(id) {
    if (!window.confirm('Delete this employee?')) return;
    setEmployees(prev => prev.filter(e => e.id !== id));
    setSubView('list');
    setActiveEmp(null);
  }

  if (subView === 'edit') {
    return (
      <EmployeeHRForm
        employee={activeEmp}
        count={employees.length}
        businessInfo={businessInfo}
        isGulf={isGulf}
        country={country}
        onSave={saveEmployee}
        onClose={() => setSubView(activeEmp ? 'detail' : 'list')}
      />
    );
  }

  if (subView === 'detail' && activeEmp) {
    const fresh = employees.find(e => e.id === activeEmp.id) || activeEmp;
    return (
      <EmployeeDetailView
        emp={fresh}
        businessInfo={businessInfo}
        isGulf={isGulf}
        country={country}
        canEdit={canEdit}
        onEdit={() => { setActiveEmp(fresh); setSubView('edit'); }}
        onDelete={() => deleteEmployee(fresh.id)}
        onBack={() => setSubView('list')}
      />
    );
  }

  return (
    <div style={styles.page}>
      {allAlerts.length > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <Bell size={16} style={{ color: '#D97706', marginTop: 1, flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, color: '#92400E', fontSize: 13, marginBottom: 5 }}>
              Document Expiry Alerts ({allAlerts.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {allAlerts.slice(0, 10).map((a, i) => (
                <span key={i}
                  style={{ fontSize: 11.5, background: a.status === 'expired' ? '#FEE2E2' : '#FEF9C3', color: a.status === 'expired' ? '#B91C1C' : '#92400E', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}
                  onClick={() => { setActiveEmp(a.emp); setSubView('detail'); }}>
                  <AlertTriangle size={10} />{a.emp.name} — {a.label} {a.days <= 0 ? 'EXPIRED' : `in ${a.days}d`}
                </span>
              ))}
              {allAlerts.length > 10 && <span style={{ fontSize: 11.5, color: '#92400E' }}>+{allAlerts.length - 10} more</span>}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="serif" style={styles.h1}>Employees</h2>
          <div style={styles.muted}>{employees.length} employee{employees.length !== 1 ? 's' : ''}</div>
        </div>
        {canEdit && (
          <button style={styles.primaryBtn} onClick={() => { setActiveEmp(null); setSubView('edit'); }}>
            <Plus size={15} /> Add Employee
          </button>
        )}
      </div>

      {employees.length === 0 ? (
        <div style={styles.emptyBox}>No employees yet. Add your first employee.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Emp ID', 'Name', 'Designation', 'Department', 'Phone', 'Status', 'Alerts', ''].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...employees].sort((a, b) => (a.name || '') > (b.name || '') ? 1 : -1).map(emp => {
                const alerts = getEmpDocAlerts(emp, isGulf, country);
                return (
                  <tr key={emp.id} style={{ cursor: 'pointer', background: alerts.length > 0 ? '#FFFBEB' : undefined }}
                    onClick={() => { setActiveEmp(emp); setSubView('detail'); }}>
                    <td style={{ ...styles.td, fontFamily: 'monospace', fontWeight: 600 }}>{emp.empId}</td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{emp.name}</td>
                    <td style={styles.td}>{emp.designation}</td>
                    <td style={styles.td}>{emp.department || '—'}</td>
                    <td style={styles.td}>{emp.phone}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, ...(emp.status === 'active' ? { background: '#D1FAE5', color: '#065F46' } : { background: '#F3F2EF', color: '#6B7494' }) }}>
                        {emp.status || 'active'}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {alerts.length === 0 ? (
                        <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>
                      ) : (
                        alerts.slice(0, 2).map((a, i) => (
                          <span key={i} style={{ ...styles.badge, background: a.status === 'expired' ? '#FEE2E2' : '#FEF3C7', color: a.status === 'expired' ? '#B91C1C' : '#92400E', marginRight: 3, fontSize: 10.5 }}>
                            <AlertTriangle size={9} style={{ marginRight: 2 }} />{a.label} {a.days <= 0 ? 'exp.' : `${a.days}d`}
                          </span>
                        ))
                      )}
                      {alerts.length > 2 && <span style={{ fontSize: 11, color: '#92400E' }}>+{alerts.length - 2}</span>}
                    </td>
                    <td style={styles.td} onClick={e => e.stopPropagation()}>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button style={styles.iconBtn} onClick={() => { setActiveEmp(emp); setSubView('edit'); }}><Pencil size={14} /></button>
                          <button style={{ ...styles.iconBtn, color: '#B5453A' }} onClick={() => deleteEmployee(emp.id)}><Trash2 size={14} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


export function EmployeeDetailView({ emp, businessInfo, isGulf, country, canEdit, onEdit, onDelete, onBack }) {
  const fmtEmp = makeFmt(businessInfo);
  const basic  = parseFloat(emp.basicSalary) || 0;
  const hra    = parseFloat(emp.hra) || 0;
  const da     = parseFloat(emp.da) || 0;
  const other  = parseFloat(emp.otherAllowances) || 0;
  const gross  = basic + hra + da + other;
  const pf     = basic * (parseFloat(emp.pf) || 0) / 100;
  const esi    = gross * (parseFloat(emp.esi) || 0) / 100;
  const tds    = parseFloat(emp.tds) || 0;
  const deductions = pf + esi + tds;
  const net    = gross - deductions;
  const alerts = getEmpDocAlerts(emp, isGulf, country);
  const idLabel = country === 'uae' ? 'Emirates ID' : 'Civil ID';

  function SecLabel({ t }) {
    return (
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#C9A24B', borderBottom: '1px solid #EAE6DB', paddingBottom: 5, marginBottom: 10, marginTop: 18 }}>{t}</div>
    );
  }
  function Row({ label, value, dateAlert }) {
    const alertSt  = dateAlert ? hrExpiryStatus(dateAlert) : null;
    const alertDays = dateAlert ? hrExpiryDays(dateAlert) : null;
    const alertColors = { expired: { bg: '#FEE2E2', color: '#B91C1C' }, critical: { bg: '#FEF3C7', color: '#92400E' }, warning: { bg: '#FFF9E6', color: '#B45309' } };
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, marginBottom: 7, alignItems: 'start' }}>
        <div style={{ color: '#6B7494', fontSize: 12.5 }}>{label}</div>
        <div style={{ fontWeight: 500, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span>{value || <span style={{ color: '#C9C9C9' }}>—</span>}</span>
          {alertSt && alertSt !== 'ok' && (
            <span style={{ fontSize: 10.5, background: alertColors[alertSt].bg, color: alertColors[alertSt].color, borderRadius: 4, padding: '1px 6px', display: 'flex', alignItems: 'center', gap: 2 }}>
              <AlertTriangle size={9} />{alertDays <= 0 ? `Expired ${Math.abs(alertDays)}d ago` : `${alertDays}d left`}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button style={{ ...styles.ghostBtn, padding: '4px 10px', fontSize: 13 }} onClick={onBack}>← Back</button>
          <div>
            <h2 className="serif" style={{ ...styles.h1, marginBottom: 2 }}>{emp.name}</h2>
            <div style={{ color: '#6B7494', fontSize: 13 }}>{emp.empId}{emp.designation ? ' · ' + emp.designation : ''}{emp.department ? ' · ' + emp.department : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.ghostBtn} onClick={() => printOfferLetter(emp, businessInfo)}><Printer size={14} /> Offer Letter</button>
          {canEdit && <button style={styles.ghostBtn} onClick={onEdit}><Pencil size={14} /> Edit</button>}
          {canEdit && <button style={{ ...styles.ghostBtn, color: '#B5453A' }} onClick={onDelete}><Trash2 size={14} /> Delete</button>}
        </div>
      </div>

      {alerts.length > 0 && (
        <div style={{ background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 8, padding: '10px 14px', marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: '#92400E', fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
            <AlertTriangle size={14} /> Document Alerts
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {alerts.map((a, i) => (
              <span key={i} style={{ fontSize: 12, background: a.status === 'expired' ? '#FEE2E2' : '#FEF9C3', color: a.status === 'expired' ? '#B91C1C' : '#92400E', borderRadius: 4, padding: '2px 9px' }}>
                {a.label}: {a.days <= 0 ? `Expired ${Math.abs(a.days)} days ago` : `Expires in ${a.days} days (${a.dateStr})`}
              </span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <div>
          <SecLabel t="Personal Information" />
          <Row label="Full Name"        value={emp.name} />
          <Row label="Date of Birth"    value={emp.dob} />
          <Row label="Nationality"      value={emp.nationality} />
          <Row label="Phone"            value={emp.phone} />
          <Row label="Email"            value={emp.email} />
          <Row label="Address"          value={emp.address} />
          <Row label="Emergency Contact" value={emp.emergencyContact} />
          <Row label="Emergency Phone"  value={emp.emergencyPhone} />

          {!isGulf && (
            <>
              <SecLabel t="Identity Documents" />
              <Row label="Aadhar Number" value={emp.aadharNo} />
              <Row label="PAN Number"    value={emp.panNo} />
            </>
          )}

          {isGulf && (
            <>
              <SecLabel t="Passport" />
              <Row label="Passport No."    value={emp.passportNo} />
              <Row label="Passport Expiry" value={emp.passportExpiry} dateAlert={emp.passportExpiry} />

              <SecLabel t="Visa" />
              <Row label="Visa No."        value={emp.visaNo} />
              <Row label="Visa Expiry"     value={emp.visaExpiry}     dateAlert={emp.visaExpiry} />
              <Row label="Stamping Date"   value={emp.stampingDate} />
              <Row label="Stamping Expiry" value={emp.stampingExpiry} dateAlert={emp.stampingExpiry} />

              <SecLabel t={idLabel} />
              <Row label={`${idLabel} No.`}    value={emp.emiratesId} />
              <Row label={`${idLabel} Expiry`} value={emp.emiratesIdExpiry} dateAlert={emp.emiratesIdExpiry} />

              <SecLabel t="Labour Card" />
              <Row label="Labour Card No."    value={emp.labourCardNo} />
              <Row label="Labour Card Expiry" value={emp.labourCardExpiry} dateAlert={emp.labourCardExpiry} />
            </>
          )}

          <SecLabel t="Insurance" />
          <Row label="Medical Insurance Exp." value={emp.medicalInsuranceExpiry} dateAlert={emp.medicalInsuranceExpiry} />

          {(emp.customDocs || []).length > 0 && (
            <>
              <SecLabel t="Other Documents" />
              {emp.customDocs.map((doc, i) => (
                <Row key={i} label={doc.name} value={doc.expiry || doc.note || '—'} dateAlert={doc.expiry} />
              ))}
            </>
          )}
        </div>

        <div>
          <SecLabel t="Employment" />
          <Row label="Employee ID"  value={emp.empId} />
          <Row label="Designation"  value={emp.designation} />
          <Row label="Department"   value={emp.department} />
          <Row label="Joining Date" value={emp.joiningDate} />
          <Row label="Status" value={
            <span style={{ ...styles.badge, ...(emp.status === 'active' ? { background: '#D1FAE5', color: '#065F46' } : { background: '#F3F2EF', color: '#6B7494' }) }}>
              {emp.status || 'active'}
            </span>
          } />

          <SecLabel t="Salary Structure" />
          <Row label="Basic Salary"      value={fmtEmp(basic)} />
          {hra   > 0 && <Row label="HRA"              value={fmtEmp(hra)} />}
          {da    > 0 && <Row label="DA"               value={fmtEmp(da)} />}
          {other > 0 && <Row label="Other Allowances" value={fmtEmp(other)} />}
          <div style={{ background: '#1E2A4A', color: '#fff', borderRadius: 8, padding: '10px 14px', margin: '8px 0 4px', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontSize: 12.5 }}>
            <div>Gross<br /><strong>{fmtEmp(gross)}</strong></div>
            <div>Deductions<br /><strong>{fmtEmp(deductions)}</strong></div>
            <div>Net Pay<br /><strong style={{ color: '#7FBF96' }}>{fmtEmp(net)}</strong></div>
          </div>

          <SecLabel t="Bank Details" />
          <Row label="Account No."    value={emp.bankAccount} />
          <Row label="IFSC / SWIFT"   value={emp.ifsc} />
          <Row label="Bank Name"      value={emp.bankName} />

          {emp.notes && (
            <>
              <SecLabel t="Notes" />
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.65 }}>{emp.notes}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}


export function EmpSecTitle({ t }) {
  return <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#C9A24B', borderBottom: '1px solid #EAE6DB', paddingBottom: 5, marginBottom: 12, marginTop: 18 }}>{t}</div>;
}

export function EmpField({ label, name, type='text', required=false, form, onSet, errors, onClearErr }) {
  return (
    <div style={styles.formGroup}>
      <label style={styles.label}>{label}{required ? ' *' : ''}</label>
      <input style={{ ...styles.input, ...(errors[name] ? { borderColor: '#EF4444' } : {}) }}
        type={type} value={form[name] != null ? form[name] : ''}
        onChange={e => { onSet(name, e.target.value); if (errors[name]) onClearErr(name); }} />
      {errors[name] && <div style={{ color: '#EF4444', fontSize: 11, marginTop: 2 }}>{errors[name]}</div>}
    </div>
  );
}


export function EmployeeHRForm({ employee, count, businessInfo, isGulf, country, onSave, onClose }) {
  const blank = {
    id: crypto.randomUUID(),
    empId: 'EMP-' + String(count + 1).padStart(4, '0'),
    name: '', designation: '', department: '', phone: '', email: '',
    dob: '', address: '', emergencyContact: '', emergencyPhone: '', nationality: '',
    joiningDate: new Date().toISOString().slice(0, 10),
    aadharNo: '', panNo: '',
    passportNo: '', passportExpiry: '',
    visaNo: '', visaExpiry: '',
    emiratesId: '', emiratesIdExpiry: '',
    labourCardNo: '', labourCardExpiry: '',
    stampingDate: '', stampingExpiry: '',
    medicalInsuranceExpiry: '',
    customDocs: [],
    basicSalary: '', hra: '', da: '', otherAllowances: '',
    pf: country === 'india' ? 12 : 0, esi: country === 'india' ? 0.75 : 0, tds: '',
    bankAccount: '', ifsc: '', bankName: '',
    status: 'active', notes: '',
  };

  const [form, setForm]   = useState(employee ? { ...blank, ...employee } : blank);
  const [errors, setErrors] = useState({});
  const [tab, setTab]     = useState('personal');
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const fmtEmp = makeFmt(businessInfo);
  const basic  = parseFloat(form.basicSalary) || 0;
  const hra    = parseFloat(form.hra) || 0;
  const da     = parseFloat(form.da) || 0;
  const other  = parseFloat(form.otherAllowances) || 0;
  const gross  = basic + hra + da + other;
  const pfAmt  = basic * (parseFloat(form.pf) || 0) / 100;
  const esiAmt = gross * (parseFloat(form.esi) || 0) / 100;
  const tdsAmt = parseFloat(form.tds) || 0;
  const deductions = pfAmt + esiAmt + tdsAmt;
  const net    = gross - deductions;
  const idLabel = country === 'uae' ? 'Emirates ID' : 'Civil ID';

  function addCustomDoc() { set('customDocs', [...(form.customDocs || []), { id: crypto.randomUUID(), name: '', expiry: '', note: '' }]); }
  function updCustomDoc(idx, k, v) { const d = [...(form.customDocs || [])]; d[idx] = { ...d[idx], [k]: v }; set('customDocs', d); }
  function delCustomDoc(idx) { set('customDocs', (form.customDocs || []).filter((_, i) => i !== idx)); }

  function validate() {
    const e = {};
    if (!form.name.trim())  e.name  = 'Required';
    if (!form.empId.trim()) e.empId = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const clearErr = n => setErrors(p => ({ ...p, [n]: undefined }));
  const fp = { form, onSet: set, errors, onClearErr: clearErr };

  const TABS = [
    { id: 'personal',   label: 'Personal Info' },
    { id: 'documents',  label: 'Documents' },
    { id: 'salary',     label: 'Salary' },
    { id: 'bank',       label: 'Bank & Other' },
  ];

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="serif" style={styles.h1}>{employee ? 'Edit Employee' : 'New Employee'}</h2>
          {employee && <div style={styles.muted}>{employee.empId}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
          <button style={styles.primaryBtn} onClick={() => { if (validate()) onSave(form); }}>Save Employee</button>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid #EAE6DB', marginBottom: 20, gap: 2 }}>
        {TABS.map(t => (
          <button key={t.id} type="button"
            style={{ padding: '7px 16px', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, color: tab === t.id ? '#1E2A4A' : '#6B7494', background: 'none', border: 'none', borderBottom: tab === t.id ? '2px solid #1E2A4A' : '2px solid transparent', cursor: 'pointer' }}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'personal' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <EmpField {...fp} label="Employee ID" name="empId" required />
            <EmpField {...fp} label="Full Name"   name="name"  required />
            <EmpField {...fp} label="Date of Birth" name="dob" type="date" />
            <EmpField {...fp} label="Nationality" name="nationality" />
            <EmpField {...fp} label="Phone"       name="phone" />
            <EmpField {...fp} label="Email"       name="email" />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Address</label>
            <textarea style={{ ...styles.input, height: 58, resize: 'vertical' }} value={form.address || ''} onChange={e => set('address', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <EmpField {...fp} label="Emergency Contact Name" name="emergencyContact" />
            <EmpField {...fp} label="Emergency Phone"        name="emergencyPhone" />
            <EmpField {...fp} label="Designation"            name="designation" />
            <EmpField {...fp} label="Department"             name="department" />
            <EmpField {...fp} label="Joining Date"           name="joiningDate" type="date" />
            <div style={styles.formGroup}>
              <label style={styles.label}>Status</label>
              <select style={styles.input} value={form.status || 'active'} onChange={e => set('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on-leave">On Leave</option>
                <option value="terminated">Terminated</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {tab === 'documents' && (
        <div>
          {!isGulf && (
            <>
              <EmpSecTitle t="Identity Documents (India)" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <EmpField {...fp} label="Aadhar Number" name="aadharNo" />
                <EmpField {...fp} label="PAN Number"    name="panNo" />
              </div>
            </>
          )}
          {isGulf && (
            <>
              <EmpSecTitle t="Passport" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <EmpField {...fp} label="Passport Number" name="passportNo" />
                <EmpField {...fp} label="Passport Expiry" name="passportExpiry" type="date" />
              </div>
              <EmpSecTitle t="Visa" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <EmpField {...fp} label="Visa Number"     name="visaNo" />
                <EmpField {...fp} label="Visa Expiry"     name="visaExpiry"    type="date" />
                <EmpField {...fp} label="Stamping Date"   name="stampingDate"  type="date" />
                <EmpField {...fp} label="Stamping Expiry" name="stampingExpiry" type="date" />
              </div>
              <EmpSecTitle t={idLabel} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <EmpField {...fp} label={`${idLabel} Number`} name="emiratesId" />
                <EmpField {...fp} label={`${idLabel} Expiry`} name="emiratesIdExpiry" type="date" />
              </div>
              <EmpSecTitle t="Labour Card" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <EmpField {...fp} label="Labour Card Number" name="labourCardNo" />
                <EmpField {...fp} label="Labour Card Expiry" name="labourCardExpiry" type="date" />
              </div>
            </>
          )}
          <EmpSecTitle t="Medical Insurance" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <EmpField {...fp} label="Medical Insurance Expiry" name="medicalInsuranceExpiry" type="date" />
          </div>
          <EmpSecTitle t="Other Documents" />
          {(form.customDocs || []).map((doc, idx) => (
            <div key={doc.id || idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 2fr auto', gap: 10, marginBottom: 8, alignItems: 'end' }}>
              <div style={styles.formGroup}>
                {idx === 0 && <label style={styles.label}>Document Name</label>}
                <input style={styles.input} value={doc.name} onChange={e => updCustomDoc(idx, 'name', e.target.value)} placeholder="e.g. Insurance Card" />
              </div>
              <div style={styles.formGroup}>
                {idx === 0 && <label style={styles.label}>Expiry Date</label>}
                <input style={styles.input} type="date" value={doc.expiry || ''} onChange={e => updCustomDoc(idx, 'expiry', e.target.value)} />
              </div>
              <div style={styles.formGroup}>
                {idx === 0 && <label style={styles.label}>Note</label>}
                <input style={styles.input} value={doc.note || ''} onChange={e => updCustomDoc(idx, 'note', e.target.value)} placeholder="Optional" />
              </div>
              <button style={{ ...styles.iconBtn, color: '#B5453A', marginBottom: 1 }} onClick={() => delCustomDoc(idx)}><X size={14} /></button>
            </div>
          ))}
          <button style={styles.ghostBtn} onClick={addCustomDoc}><Plus size={14} /> Add Document</button>
        </div>
      )}

      {tab === 'salary' && (
        <div>
          <EmpSecTitle t="Salary Components" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <EmpField {...fp} label="Basic Salary"      name="basicSalary"      type="number" />
            <EmpField {...fp} label="HRA"               name="hra"              type="number" />
            <EmpField {...fp} label="DA"                name="da"               type="number" />
            <EmpField {...fp} label="Other Allowances"  name="otherAllowances"  type="number" />
          </div>
          <EmpSecTitle t="Deductions" />
          {country === 'india' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
              <EmpField {...fp} label="PF % (of Basic)"  name="pf"  type="number" />
              <EmpField {...fp} label="ESI % (of Gross)" name="esi" type="number" />
              <EmpField {...fp} label="TDS Fixed Amount" name="tds" type="number" />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
              <EmpField {...fp} label="Income Tax / Fixed Deduction" name="tds" type="number" />
              <EmpField {...fp} label="Other Deductions (Fixed)"     name="esi" type="number" />
            </div>
          )}
          <div style={{ background: '#1E2A4A', color: '#fff', borderRadius: 8, padding: '10px 16px', marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, fontSize: 13 }}>
            <div>Gross Monthly<br /><strong>{fmtEmp(gross)}</strong></div>
            <div>Total Deductions<br /><strong>{fmtEmp(deductions)}</strong></div>
            <div>Net Pay<br /><strong style={{ color: '#7FBF96' }}>{fmtEmp(net)}</strong></div>
          </div>
        </div>
      )}

      {tab === 'bank' && (
        <div>
          <EmpSecTitle t="Bank Details" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
            <EmpField {...fp} label="Account Number"    name="bankAccount" />
            <EmpField {...fp} label="IFSC / SWIFT Code" name="ifsc" />
            <EmpField {...fp} label="Bank Name"         name="bankName" />
          </div>
          <EmpSecTitle t="Notes" />
          <div style={styles.formGroup}>
            <textarea style={{ ...styles.input, height: 80, resize: 'vertical' }} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Any additional notes about this employee" />
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Payroll ──────────────────────────────────────────────────────────────────

export function PayrollView({ employees, payrollRuns, setPayrollRuns, businessInfo, userRole }) {
  const [showModal, setShowModal] = useState(false);
  const [printRun, setPrintRun] = useState(null);
  const [printMode, setPrintMode] = useState(null); // 'summary' | 'individual'
  const canEdit = userRole === 'admin' || userRole === 'manager';
  const fmt = makeFmt(businessInfo);

  function deleteRun(id) {
    if (!window.confirm('Delete this payroll run?')) return;
    setPayrollRuns(prev => prev.filter(r => r.id !== id));
  }
  function updateStatus(id, status) {
    setPayrollRuns(prev => prev.map(x => x.id === id ? { ...x, status } : x));
  }

  const STATUS_BADGE = {
    draft:    { bg: '#EEEDE6', color: '#5F5E5A', label: 'Preparing' },
    submitted:{ bg: '#E6EEF9', color: '#2255A0', label: 'Forwarded' },
    approved: { bg: '#EAF3DE', color: '#3B6D11', label: 'Approved' },
    rejected: { bg: '#FBEAE7', color: '#B5453A', label: 'Rejected' },
    paid:     { bg: '#D1FAE5', color: '#065F46', label: 'Paid' },
  };

  // Print views
  if (printRun && printMode === 'summary') {
    return <PaySlipPrint run={printRun} businessInfo={businessInfo} onClose={() => { setPrintRun(null); setPrintMode(null); }} />;
  }
  if (printRun && printMode === 'individual') {
    return <IndividualPaySlips run={printRun} businessInfo={businessInfo} onClose={() => { setPrintRun(null); setPrintMode(null); }} />;
  }

  const activeEmp = employees.filter(e => e.status === 'active' || !e.status);

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 className="serif" style={styles.h1}>Payroll</h2>
          <div style={styles.muted}>{payrollRuns.length} payroll run{payrollRuns.length !== 1 ? 's' : ''}</div>
        </div>
        {(userRole === 'admin' || userRole === 'accounts') && (
          <button style={styles.primaryBtn} onClick={() => setShowModal(true)}><Plus size={15}/> Process Payroll</button>
        )}
      </div>

      {payrollRuns.length === 0 ? (
        <div style={styles.emptyBox}>No payroll processed yet. Click "Process Payroll" to run monthly payroll.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>{['Period','Employees','Gross','Deductions','Net Payable','Status',''].map(h=><th key={h} style={styles.th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {[...payrollRuns].sort((a,b)=>a.period<b.period?1:-1).map(r => {
                const sb = STATUS_BADGE[r.status] || STATUS_BADGE.draft;
                return (
                  <tr key={r.id}>
                    <td style={{ ...styles.td, fontWeight: 600 }}>{MONTHS.find(m=>m[0]===r.month)?.[1]} {r.year}</td>
                    <td style={styles.td}>{(r.lines||[]).length}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>{fmt((r.lines||[]).reduce((s,l)=>s+(l.gross||0),0))}</td>
                    <td style={{ ...styles.td, textAlign: 'right', color: '#B5453A' }}>{fmt((r.lines||[]).reduce((s,l)=>s+(l.totalDeductions||0),0))}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#065F46' }}>{fmt((r.lines||[]).reduce((s,l)=>s+(l.net||0),0))}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: sb.bg, color: sb.color }}>{sb.label}</span>
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Print buttons */}
                        <button style={styles.iconBtn} title="Payroll Summary Sheet" onClick={() => { setPrintRun(r); setPrintMode('summary'); }}><Printer size={14}/></button>
                        <button style={styles.iconBtn} title="Individual Pay Slips" onClick={() => { setPrintRun(r); setPrintMode('individual'); }}><Users size={14}/></button>
                        {/* Approval flow: Preparing → Forward → Approve → Paid */}
                        {r.status === 'draft' && (
                          <button style={{ ...styles.secondaryBtn, fontSize: 12, padding: '4px 10px', color: '#2255A0', borderColor: '#2255A0', background: '#EEF1F8' }}
                            onClick={() => updateStatus(r.id, 'submitted')}>
                            Forward →
                          </button>
                        )}
                        {r.status === 'submitted' && canEdit && (
                          <>
                            <button style={{ ...styles.secondaryBtn, fontSize: 12, padding: '4px 10px', color: '#B5453A', borderColor: '#B5453A', background: '#FBEAE7' }}
                              onClick={() => updateStatus(r.id, 'draft')}>
                              Reject
                            </button>
                            <button style={{ ...styles.secondaryBtn, fontSize: 12, padding: '4px 10px', color: '#3B6D11', borderColor: '#3B6D11', background: '#EAF3DE' }}
                              onClick={() => updateStatus(r.id, 'approved')}>
                              ✓ Approve
                            </button>
                          </>
                        )}
                        {r.status === 'approved' && canEdit && (
                          <button style={{ ...styles.secondaryBtn, fontSize: 12, padding: '4px 10px', color: '#065F46', borderColor: '#065F46', background: '#D1FAE5' }}
                            onClick={() => updateStatus(r.id, 'paid')}>
                            ✓ Mark Paid
                          </button>
                        )}
                        {r.status !== 'paid' && r.status !== 'submitted' && (
                          <button style={{ ...styles.iconBtn, color: '#B5453A' }} onClick={() => deleteRun(r.id)}><Trash2 size={14}/></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <PayrollModal
          employees={activeEmp}
          payrollRuns={payrollRuns}
          businessInfo={businessInfo}
          onSave={(run) => { setPayrollRuns(prev => [...prev, run]); setShowModal(false); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}


export function PayrollModal({ employees, payrollRuns, businessInfo, onSave, onClose }) {
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1).padStart(2, '0'));
  const [year, setYear]   = useState(String(now.getFullYear()));
  const [error, setError] = useState('');
  const fmt = makeFmt(businessInfo);

  const initLines = () => employees.map(e => {
    const basic = parseFloat(e.basicSalary) || 0;
    const hra   = parseFloat(e.hra) || 0;
    const da    = parseFloat(e.da) || 0;
    const other = parseFloat(e.otherAllowances) || 0;
    const gross = basic + hra + da + other;
    const pf    = basic * (parseFloat(e.pf) || 0) / 100;
    const esi   = gross * (parseFloat(e.esi) || 0) / 100;
    const tds   = parseFloat(e.tds) || 0;
    const totalDeductions = pf + esi + tds;
    return {
      empId: e.empId, name: e.name, designation: e.designation, department: e.department || '',
      bankAccount: e.bankAccount || '', bankName: e.bankName || '', ifsc: e.ifsc || '',
      basic, hra, da, other, gross,
      workingDays: 26, paidDays: 26,
      pf: parseFloat(pf.toFixed(2)), esi: parseFloat(esi.toFixed(2)), tds,
      lopDays: 0, lopAmt: 0,
      advance: 0,
      otherDeductAmt: 0, otherDeductNote: '',
      totalDeductions: parseFloat(totalDeductions.toFixed(2)),
      net: parseFloat((gross - totalDeductions).toFixed(2)),
    };
  });

  const [lines, setLines] = useState(initLines);

  function recalcLine(line) {
    const dailyRate = line.gross / (line.workingDays || 26);
    const lopAmt    = parseFloat((dailyRate * (line.lopDays || 0)).toFixed(2));
    const totalDeductions = parseFloat((line.pf + line.esi + line.tds + lopAmt + (line.advance || 0) + (line.otherDeductAmt || 0)).toFixed(2));
    const net = Math.max(0, parseFloat((line.gross - totalDeductions).toFixed(2)));
    return { ...line, lopAmt, totalDeductions, net };
  }

  function updateLine(i, updates) {
    setLines(prev => {
      const a = [...prev];
      a[i] = recalcLine({ ...a[i], ...updates });
      return a;
    });
  }

  const existingRun = payrollRuns.find(r => r.month === month && r.year === year);
  const totalNet    = lines.reduce((s,l)=>s+(l.net||0), 0);
  const totalGross  = lines.reduce((s,l)=>s+(l.gross||0), 0);
  const totalDed    = lines.reduce((s,l)=>s+(l.totalDeductions||0), 0);

  function handleSave() {
    if (employees.length === 0) { setError('No active employees to process payroll for.'); return; }
    if (existingRun) { setError(`A payroll run for ${MONTHS.find(m=>m[0]===month)?.[1]} ${year} already exists. Delete it first to re-process.`); return; }
    setError('');
    onSave({
      id: crypto.randomUUID(), month, year,
      period: year + '-' + month,
      lines, status: 'draft', createdAt: Date.now(),
    });
  }

  return (
    <div style={{ ...styles.modalOverlay, alignItems: 'flex-start', paddingTop: 32 }}>
      <div style={{ ...styles.modal, width: 1000, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <span className="serif" style={{ fontSize: 17, fontWeight: 600, color: '#fff' }}>Process Payroll</span>
          <button onClick={onClose} style={{ ...styles.iconBtn, color: '#fff' }}>✕</button>
        </div>

        <div style={{ padding: 20 }}>
          {/* Period selector */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
            <select value={month} onChange={e => setMonth(e.target.value)} style={{ ...styles.input, width: 140 }}>
              {MONTHS.map(([v,l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select value={year} onChange={e => setYear(e.target.value)} style={{ ...styles.input, width: 100 }}>
              {[0,1,2].map(i => <option key={i} value={String(now.getFullYear()-i)}>{now.getFullYear()-i}</option>)}
            </select>
            {existingRun && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B5453A', fontSize: 13, fontWeight: 500 }}>
                <AlertTriangle size={14}/> Run already exists for this month
              </div>
            )}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 20, fontSize: 13 }}>
              <span>Gross: <strong>{fmt(totalGross)}</strong></span>
              <span style={{ color: '#B5453A' }}>Deductions: <strong>{fmt(totalDed)}</strong></span>
              <span style={{ color: '#065F46', fontWeight: 700 }}>Net: <strong>{fmt(totalNet)}</strong></span>
            </div>
          </div>

          {error && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', marginBottom: 12, color: '#B91C1C', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={14}/> {error}
            </div>
          )}

          {employees.length === 0 ? (
            <div style={styles.emptyBox}>No active employees found. Add employees first.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ ...styles.table, fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#F7F4EE' }}>
                    {['Employee','Gross','Working Days','Paid Days','PF','ESI','TDS','LOP Days','LOP','Advance','Other Deduct','Note','Net Pay'].map(h=>(
                      <th key={h} style={{ ...styles.th, whiteSpace: 'nowrap', padding: '8px 8px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.empId} style={{ background: i%2===0 ? '#fff' : '#FAFAF8' }}>
                      <td style={{ ...styles.td, minWidth: 130 }}>
                        <div style={{ fontWeight: 600 }}>{l.name}</div>
                        <div style={{ color: '#888', fontSize: 11 }}>{l.empId} · {l.designation}</div>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{fmt(l.gross)}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>{l.workingDays}</td>
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <input type="number" min={0} max={l.workingDays}
                          style={{ ...styles.input, width: 52, margin: 0, textAlign: 'center', padding: '4px 6px' }}
                          value={l.paidDays}
                          onChange={e => updateLine(i, { paidDays: parseFloat(e.target.value)||0 })} />
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#666' }}>{fmt(l.pf)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#666' }}>{fmt(l.esi)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', color: '#666' }}>{fmt(l.tds)}</td>
                      {/* LOP Days */}
                      <td style={{ ...styles.td, textAlign: 'center' }}>
                        <input type="number" min={0} max={l.workingDays}
                          style={{ ...styles.input, width: 52, margin: 0, textAlign: 'center', padding: '4px 6px', borderColor: l.lopDays > 0 ? '#C9A24B' : undefined }}
                          value={l.lopDays}
                          onChange={e => updateLine(i, { lopDays: parseFloat(e.target.value)||0 })} />
                      </td>
                      {/* LOP amount — auto-calculated */}
                      <td style={{ ...styles.td, textAlign: 'right', color: l.lopAmt > 0 ? '#B5453A' : '#ccc' }}>
                        {l.lopAmt > 0 ? `-${fmt(l.lopAmt)}` : '—'}
                      </td>
                      {/* Advance deduction */}
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <input type="number" min={0}
                          style={{ ...styles.input, width: 70, margin: 0, textAlign: 'right', padding: '4px 6px', borderColor: l.advance > 0 ? '#C9A24B' : undefined }}
                          value={l.advance || ''}
                          placeholder="0"
                          onChange={e => updateLine(i, { advance: parseFloat(e.target.value)||0 })} />
                      </td>
                      {/* Other deduction amount */}
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <input type="number" min={0}
                          style={{ ...styles.input, width: 70, margin: 0, textAlign: 'right', padding: '4px 6px', borderColor: l.otherDeductAmt > 0 ? '#C9A24B' : undefined }}
                          value={l.otherDeductAmt || ''}
                          placeholder="0"
                          onChange={e => updateLine(i, { otherDeductAmt: parseFloat(e.target.value)||0 })} />
                      </td>
                      {/* Other deduction description */}
                      <td style={{ ...styles.td }}>
                        <input
                          style={{ ...styles.input, width: 100, margin: 0, padding: '4px 6px', fontSize: 11 }}
                          value={l.otherDeductNote || ''}
                          placeholder="e.g. Advance"
                          onChange={e => updateLine(i, { otherDeductNote: e.target.value })} />
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: '#065F46', whiteSpace: 'nowrap' }}>
                        {fmt(l.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
            <button style={styles.primaryBtn} onClick={handleSave} disabled={!!existingRun}>
              {existingRun ? '⚠ Run Exists' : 'Save Payroll Run'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pay Slip Print ───────────────────────────────────────────────────────────
// Summary payroll sheet — all employees in one table

export function PaySlipPrint({ run, businessInfo, onClose }) {
  const [useLH, setUseLH] = React.useState(!!(businessInfo?.letterhead||businessInfo?.letterheadHtml));
  const cc = COUNTRY_CONFIG[businessInfo.country || 'india'];
  const fmt = (n) => currency(n, cc.currency);
  const lines = run?.lines || [];
  const period = `${MONTHS.find(m=>m[0]===run?.month)?.[1] || run?.month} ${run?.year}`;
  return (
    <div>
      <div className="no-print" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 998 }} />
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 24, zIndex: 1001, display: 'flex', gap: 8 }}>
        <button style={styles.ghostBtn} onClick={onClose}><X size={15}/> Close</button>
        {(businessInfo?.letterhead||businessInfo?.letterheadHtml) && <button onClick={() => setUseLH(v=>!v)} style={{ ...styles.ghostBtn, ...(useLH?{background:'#EEF2FF',color:'#3D52A0',fontWeight:600}:{}) }}>📃 {useLH?'Letterhead ON':'Use Letterhead'}</button>}
        <button style={styles.ghostBtn} onClick={() => downloadDocPDF('.print-area','payroll-summary.pdf')}><Download size={15}/> PDF</button>
        <button style={styles.primaryBtn} onClick={() => window.print()}><Printer size={15}/> Print</button>
      </div>
      <div className="print-area" style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 999, overflowY: 'auto', padding: '40px 48px' }}>
        {useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml || businessInfo?.letterheadFooter) && <LetterpadPrintStyle />}
        {useLH && <LetterheadHeader bi={businessInfo} />}
        <div style={{ display: 'flex', justifyContent: useLH ? 'center' : 'space-between', marginBottom: 20, borderBottom: '2px solid #1E2A4A', paddingBottom: 12 }}>
          {!useLH && <div>
            <div className="serif" style={{ fontWeight: 700, fontSize: 20, color: '#1E2A4A' }}>{businessInfo.name}</div>
            <div style={{ fontSize: 11, color: '#888' }}>{businessInfo.address}</div>
          </div>}
          <div style={{ textAlign: useLH ? 'center' : 'right' }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#C9A24B' }}>PAYROLL SUMMARY</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 3 }}>{period}</div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#1E2A4A', color: '#fff' }}>
              {['Emp ID','Name','Designation','Basic','HRA','DA','Other Allow.','Gross','PF','ESI','TDS','LOP','Advance','Other Ded.','Total Ded.','Net Pay'].map(h => (
                <th key={h} style={{ padding: '7px 8px', textAlign: h==='Name'||h==='Designation'||h==='Emp ID' ? 'left' : 'right', fontWeight: 600, fontSize: 11 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #EAE6DB', background: i%2===0?'#fff':'#FAFAF7' }}>
                <td style={{ padding: '6px 8px' }}>{l.empId}</td>
                <td style={{ padding: '6px 8px', fontWeight: 500 }}>{l.name}</td>
                <td style={{ padding: '6px 8px', color: '#555' }}>{l.designation}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(l.basic)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(l.hra||0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(l.da||0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right' }}>{fmt(l.other||0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600 }}>{fmt(l.gross)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#B5453A' }}>{fmt(l.pf||0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#B5453A' }}>{fmt(l.esi||0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#B5453A' }}>{fmt(l.tds||0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#B5453A' }}>{fmt(l.lopAmt||0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#B5453A' }}>{fmt(l.advance||0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#B5453A' }}>{fmt(l.otherDeductAmt||0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', color: '#B5453A', fontWeight: 600 }}>{fmt(l.totalDeductions||0)}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#065F46' }}>{fmt(l.net||0)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ fontWeight: 700, borderTop: '2px solid #1E2A4A', background: '#F8F5EE' }}>
              <td colSpan={3} style={{ padding: '7px 8px' }}>TOTAL ({lines.length} employees)</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.basic||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.hra||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.da||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.other||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.gross||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.pf||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.esi||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.tds||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.lopAmt||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.advance||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.otherDeductAmt||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmt(lines.reduce((s,l)=>s+(l.totalDeductions||0),0))}</td>
              <td style={{ padding: '7px 8px', textAlign: 'right', color: '#065F46' }}>{fmt(lines.reduce((s,l)=>s+(l.net||0),0))}</td>
            </tr>
          </tfoot>
        </table>
        {useLH && businessInfo?.letterheadFooter && (
          <div className="lh-pad-footer" style={{ background: '#fff' }}>
            <img src={businessInfo.letterheadFooter} alt="letterhead footer" style={{ width:'100%', display:'block' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// Individual payslips — one per employee, page-break between each

export function IndividualPaySlips({ run, businessInfo, onClose }) {
  const [useLH, setUseLH] = React.useState(!!(businessInfo?.letterhead||businessInfo?.letterheadHtml));
  const cc = COUNTRY_CONFIG[businessInfo.country || 'india'];
  const fmt = (n) => currency(n, cc.currency);
  const lines = run?.lines || [];
  const period = `${MONTHS.find(m=>m[0]===run?.month)?.[1] || run?.month} ${run?.year}`;

  return (
    <div>
      <div className="no-print" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 998 }} />
      <div className="no-print" style={{ position: 'fixed', top: 16, right: 24, zIndex: 1001, display: 'flex', gap: 8 }}>
        <button style={styles.ghostBtn} onClick={onClose}><X size={15}/> Close</button>
        {(businessInfo?.letterhead||businessInfo?.letterheadHtml) && <button onClick={() => setUseLH(v=>!v)} style={{ ...styles.ghostBtn, ...(useLH?{background:'#EEF2FF',color:'#3D52A0',fontWeight:600}:{}) }}>📃 {useLH?'Letterhead ON':'Use Letterhead'}</button>}
        <button style={styles.ghostBtn} onClick={() => downloadDocPDF('.print-area','payslips.pdf')}><Download size={15}/> PDF</button>
        <button style={styles.primaryBtn} onClick={() => window.print()}><Printer size={15}/> Print All ({lines.length})</button>
      </div>
      <div className="print-area" style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 999, overflowY: 'auto' }}>
        {lines.map((l, i) => (
          <div key={i} style={{ padding: '36px 48px', pageBreakAfter: i < lines.length - 1 ? 'always' : 'auto', borderBottom: i < lines.length - 1 ? '3px dashed #EAE6DB' : 'none' }}>
            {useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml || businessInfo?.letterheadFooter) && <LetterpadPrintStyle />}
            {useLH && <LetterheadHeader bi={businessInfo} />}
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: useLH ? 'center' : 'space-between', marginBottom: 16, paddingBottom: 10 }}>
              {!useLH && <div>
                <div className="serif" style={{ fontWeight: 700, fontSize: 18, color: '#1E2A4A' }}>{businessInfo.name}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{businessInfo.address}</div>
              </div>}
              <div style={{ textAlign: useLH ? 'center' : 'right' }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: '#1E2A4A', letterSpacing: 2, textTransform: 'uppercase' }}>PAY SLIP</div>
                <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>{period}</div>
              </div>
            </div>
            {/* Employee info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px', marginBottom: 16, fontSize: 12 }}>
              {[['Employee Name', l.name], ['Employee ID', l.empId], ['Designation', l.designation], ['Department', l.department||'—'],
                ['Working Days', l.workingDays||26], ['Paid Days', (l.workingDays||26)-(l.lopDays||0)], ['LOP Days', l.lopDays||0], ['Bank', l.bankName ? `${l.bankName} · ${l.bankAccount||''}` : '—']
              ].map(([k,v]) => (
                <div key={k} style={{ display: 'flex', gap: 8 }}>
                  <span style={{ color: '#888', minWidth: 110 }}>{k}:</span>
                  <span style={{ fontWeight: 500, color: '#1E2A4A' }}>{v}</span>
                </div>
              ))}
            </div>
            {/* Earnings vs Deductions */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#1E2A4A', borderBottom: '1px solid #EAE6DB', paddingBottom: 4, marginBottom: 6 }}>EARNINGS</div>
                {[['Basic Salary', l.basic], ['HRA', l.hra||0], ['DA', l.da||0], ['Other Allowances', l.other||0]].map(([k,v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid #F5F3EE' }}>
                    <span style={{ color: '#555' }}>{k}</span><span>{fmt(v)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 6, color: '#1E2A4A' }}>
                  <span>Gross</span><span>{fmt(l.gross||0)}</span>
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, color: '#B5453A', borderBottom: '1px solid #EAE6DB', paddingBottom: 4, marginBottom: 6 }}>DEDUCTIONS</div>
                {[['PF (Employee)', l.pf||0], ['ESI', l.esi||0], ['TDS', l.tds||0], ['LOP', l.lopAmt||0], ['Advance', l.advance||0], [l.otherDeductNote||'Other Deductions', l.otherDeductAmt||0]].map(([k,v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: '1px solid #F5F3EE' }}>
                    <span style={{ color: '#555' }}>{k}</span><span style={{ color: v > 0 ? '#B5453A' : '#aaa' }}>{fmt(v)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 700, marginTop: 6, color: '#B5453A' }}>
                  <span>Total Deductions</span><span>{fmt(l.totalDeductions||0)}</span>
                </div>
              </div>
            </div>
            {/* Net pay */}
            <div style={{ background: '#1E2A4A', color: '#fff', borderRadius: 8, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
              <span style={{ fontWeight: 600 }}>NET PAY</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: '#C9A24B' }}>{fmt(l.net||0)}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32, fontSize: 11, color: '#888' }}>
              <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #555', paddingTop: 4, marginTop: 24 }}>Employee Signature</div></div>
              <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #555', paddingTop: 4, marginTop: 24 }}>Authorised Signatory</div></div>
            </div>
          </div>
        ))}
        {useLH && businessInfo?.letterheadFooter && (
          <div className="lh-pad-footer" style={{ background: '#fff' }}>
            <img src={businessInfo.letterheadFooter} alt="letterhead footer" style={{ width:'100%', display:'block' }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ServiceOrders ─────────────────────────────────────────────

