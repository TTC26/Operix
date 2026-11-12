import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertTriangle, BarChart2, Bell, BookOpen, Briefcase, CheckCircle, CheckSquare, ChevronDown, ChevronRight, ClipboardList, Clock, Cloud, CloudOff, Download, Factory, FileMinus, FileSignature, FileText, LayoutDashboard, Layers, LogOut, MapPin, Package, Paperclip, Pencil, Plus, Printer, Search, Settings, Shield, ShoppingCart, Square, Trash2, Truck, Users, Wrench, X } from 'lucide-react';
import { ROLE_MODULES, TEST_EMAILS, PLAN_MODULES, DOC_TYPES, CONVERT_TO, EMPTY_ITEM_ROW, blankDoc, COUNTRY_CONFIG, numToWords, currency, makeFmt, computeTotals, calcModuleTax, computeStock, downloadCSV, filterByRange, loadScript, parseOCRText, styles, TaxSummaryBox, DocPrintOverlay, Modal, LetterpadPrintStyle, sanitizeLHtml, LetterheadHeader, VoucherPrintHeader, VoucherSignatory, ApprovalActions, StatusBadge, DocRow, StatCard, BIZ_BADGE, DocumentsList, ConvertDropdown, PrintModal, DateRangePicker, SpecsFields, DrawingUploader, LockedModuleScreen, TemplateMiniPreview, sendNotificationEmail } from './utils.jsx';

export function ServiceOrdersView({ serviceOrders, setServiceOrders, customers, businessInfo, userRole }) {
  const [view, setView] = useState('list'); // 'list' | 'form' | 'print'
  const [active, setActive] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const cc = COUNTRY_CONFIG[businessInfo.country || 'india'];
  const fmt = (n) => currency(n, cc.currency);
  const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'sales';

  const STATUS_COLORS = {
    draft: { bg: '#F3F2EF', color: '#6B7494' },
    confirmed: { bg: '#E8F4FD', color: '#2563EB' },
    'in-progress': { bg: '#FFF3CD', color: '#8B6914' },
    completed: { bg: '#D1FAE5', color: '#065F46' },
    invoiced: { bg: '#EDE9FE', color: '#5B21B6' },
    cancelled: { bg: '#FEE2E2', color: '#991B1B' },
  };

  function blankOrder() {
    return {
      id: crypto.randomUUID(),
      number: 'SO-' + String((serviceOrders.length || 0) + 1).padStart(4, '0'),
      date: new Date().toISOString().slice(0, 10),
      customerId: '',
      customerSnapshot: null,
      description: '',
      services: [{ id: crypto.randomUUID(), name: '', qty: 1, rate: 0, tax: 0 }],
      technicianName: '',
      scheduledDate: '',
      completedDate: '',
      status: 'draft',
      approvalStatus: 'draft',
      approvalNote: '',
      notes: '',
    };
  }

  function saveOrder(order) {
    setServiceOrders(prev => {
      const idx = prev.findIndex(o => o.id === order.id);
      if (idx >= 0) { const a = [...prev]; a[idx] = order; return a; }
      return [...prev, order];
    });
    setView('list');
  }

  function updateOrderApproval(id, patch) {
    // patch: { status, rejectionNote } → maps to approvalStatus, approvalNote
    setServiceOrders(prev => prev.map(o => o.id === id ? {
      ...o,
      approvalStatus: patch.status,
      approvalNote: patch.rejectionNote ?? o.approvalNote,
    } : o));
  }

  function deleteOrder(id) {
    if (!window.confirm('Delete this service order?')) return;
    setServiceOrders(prev => prev.filter(o => o.id !== id));
  }

  if (printOrder) return <ServiceOrderPrint order={printOrder} businessInfo={businessInfo} onClose={() => setPrintOrder(null)} />;
  if (view === 'form') return <ServiceOrderForm order={active} customers={customers} businessInfo={businessInfo} onSave={saveOrder} onCancel={() => setView('list')} />;

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>Service Orders</h2>
          <div style={{ fontSize: 13, color: '#888780' }}>{serviceOrders.length} order{serviceOrders.length !== 1 ? 's' : ''}</div>
        </div>
        {canEdit && <button style={styles.primaryBtn} onClick={() => { setActive(blankOrder()); setView('form'); }}><Plus size={15} /> New Service Order</button>}
      </div>

      {serviceOrders.length === 0 ? (
        <div style={styles.emptyBox}>No service orders yet. Create your first service order.</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Order No','Date','Customer','Technician','Scheduled','Status','Amount','Approval','Actions'].map(h => <th key={h} style={styles.th}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...serviceOrders].sort((a,b)=>a.date<b.date?1:-1).map(o => {
                const total = (o.services||[]).reduce((s,l) => s + (parseFloat(l.qty)||0)*(parseFloat(l.rate)||0), 0);
                const sc = STATUS_COLORS[o.status] || STATUS_COLORS.draft;
                return (
                  <tr key={o.id}>
                    <td style={{ ...styles.td, fontFamily: 'monospace', fontWeight: 600 }}>{o.number}</td>
                    <td style={styles.td}>{o.date}</td>
                    <td style={{ ...styles.td, fontWeight: 500 }}>{o.customerSnapshot ? o.customerSnapshot.name : '—'}</td>
                    <td style={styles.td}>{o.technicianName || '—'}</td>
                    <td style={styles.td}>{o.scheduledDate || '—'}</td>
                    <td style={styles.td}>
                      <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>{o.status}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{fmt(total)}</td>
                    <td style={styles.td}>
                      <StatusBadge status={o.approvalStatus || 'draft'} />
                      <ApprovalActions
                        item={{ status: o.approvalStatus || 'draft', rejectionNote: o.approvalNote || '' }}
                        onUpdate={(patch) => updateOrderApproval(o.id, patch)}
                        userRole={userRole}
                        compact
                      />
                    </td>
                    <td style={styles.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={styles.iconBtn} title="Print" onClick={() => setPrintOrder(o)}><Printer size={14} /></button>
                        {canEdit && o.approvalStatus !== 'submitted' && <button style={styles.iconBtn} title="Edit" onClick={() => { setActive(o); setView('form'); }}><Pencil size={14} /></button>}
                        {canEdit && o.approvalStatus !== 'submitted' && <button style={{ ...styles.iconBtn, color: '#B5453A' }} title="Delete" onClick={() => deleteOrder(o.id)}><Trash2 size={14} /></button>}
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


export function ServiceOrderForm({ order, customers, businessInfo, onSave, onCancel }) {
  const [form, setForm] = useState(order || {});
  const cc = COUNTRY_CONFIG[businessInfo.country || 'india'];
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function setService(idx, k, v) {
    const svs = [...(form.services||[])];
    svs[idx] = { ...svs[idx], [k]: v };
    set('services', svs);
  }
  function addService() {
    set('services', [...(form.services||[]), { id: crypto.randomUUID(), name: '', qty: 1, rate: 0, tax: 0 }]);
  }
  function removeService(idx) {
    set('services', (form.services||[]).filter((_,i)=>i!==idx));
  }

  const subtotal = (form.services||[]).reduce((s,l)=>s+(parseFloat(l.qty)||0)*(parseFloat(l.rate)||0),0);
  const tax = (form.services||[]).reduce((s,l)=>s+(parseFloat(l.qty)||0)*(parseFloat(l.rate)||0)*(parseFloat(l.tax)||0)/100,0);
  const total = subtotal + tax;
  const fmt = (n) => currency(n, cc.currency);

  function handleCustomer(id) {
    const c = customers.find(x=>x.id===id);
    set('customerId', id);
    set('customerSnapshot', c ? { name: c.name, address: c.address, gstin: c.gstin } : null);
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>{form.id ? 'Edit' : 'New'} Service Order</h2>
          <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#888780' }}>{form.number}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={styles.secondaryBtn} onClick={onCancel}>Cancel</button>
          <button style={styles.primaryBtn} onClick={() => onSave(form)}>Save Order</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Order Info</div>
          <div style={styles.formGroup}><label style={styles.label}>Order Number</label>
            <input style={styles.input} value={form.number||''} onChange={e=>set('number',e.target.value)} />
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Date</label>
            <input type="date" style={styles.input} value={form.date||''} onChange={e=>set('date',e.target.value)} />
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Status</label>
            <select style={styles.input} value={form.status||'draft'} onChange={e=>set('status',e.target.value)}>
              {['draft','confirmed','in-progress','completed','invoiced','cancelled'].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardTitle}>Customer & Assignment</div>
          <div style={styles.formGroup}><label style={styles.label}>Customer</label>
            <select style={styles.input} value={form.customerId||''} onChange={e=>handleCustomer(e.target.value)}>
              <option value="">— Select customer —</option>
              {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Technician / Assigned To</label>
            <input style={styles.input} value={form.technicianName||''} onChange={e=>set('technicianName',e.target.value)} placeholder="Technician name" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={styles.formGroup}><label style={styles.label}>Scheduled Date</label>
              <input type="date" style={styles.input} value={form.scheduledDate||''} onChange={e=>set('scheduledDate',e.target.value)} />
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Completed Date</label>
              <input type="date" style={styles.input} value={form.completedDate||''} onChange={e=>set('completedDate',e.target.value)} />
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...styles.card, marginBottom: 16 }}>
        <div style={styles.cardTitle}>Description of Work</div>
        <textarea style={{ ...styles.input, height: 60 }} value={form.description||''} onChange={e=>set('description',e.target.value)} placeholder="Brief description of service / problem statement" />
      </div>

      <div style={{ ...styles.card, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={styles.cardTitle}>Service Lines</div>
          <button style={styles.outlineBtn} onClick={addService}><Plus size={13}/> Add Line</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>{['Service / Item','Qty','Rate','Tax %','Amount',''].map(h=><th key={h} style={{ ...styles.th, padding: '6px 8px' }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {(form.services||[]).map((l, i) => {
              const amt = (parseFloat(l.qty)||0)*(parseFloat(l.rate)||0);
              return (
                <tr key={l.id}>
                  <td style={{ padding: '4px 6px' }}><input style={{ ...styles.input, margin: 0 }} value={l.name||''} onChange={e=>setService(i,'name',e.target.value)} placeholder="Service description" /></td>
                  <td style={{ padding: '4px 6px', width: 70 }}><input type="number" style={{ ...styles.input, margin: 0, textAlign: 'right' }} value={l.qty||''} onChange={e=>setService(i,'qty',e.target.value)} /></td>
                  <td style={{ padding: '4px 6px', width: 110 }}><input type="number" style={{ ...styles.input, margin: 0, textAlign: 'right' }} value={l.rate||''} onChange={e=>setService(i,'rate',e.target.value)} /></td>
                  <td style={{ padding: '4px 6px', width: 80 }}><input type="number" style={{ ...styles.input, margin: 0, textAlign: 'right' }} value={l.tax||''} onChange={e=>setService(i,'tax',e.target.value)} /></td>
                  <td style={{ padding: '4px 6px', textAlign: 'right', width: 100, fontWeight: 600 }}>{fmt(amt)}</td>
                  <td style={{ padding: '4px 6px', width: 36 }}><button style={{ ...styles.iconBtn, color: '#B5453A' }} onClick={()=>removeService(i)}><Trash2 size={13}/></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 20, fontSize: 13 }}>
          <div>Subtotal: <strong>{fmt(subtotal)}</strong></div>
          <div>Tax: <strong>{fmt(tax)}</strong></div>
          <div style={{ fontSize: 15 }}>Total: <strong>{fmt(total)}</strong></div>
        </div>
      </div>

      <div style={styles.card}>
        <div style={styles.cardTitle}>Notes</div>
        <textarea style={{ ...styles.input, height: 60 }} value={form.notes||''} onChange={e=>set('notes',e.target.value)} placeholder="Internal notes or customer instructions" />
      </div>
    </div>
  );
}


export function ServiceOrderPrint({ order, businessInfo, onClose }) {
  const [useLH, setUseLH] = React.useState(!!(businessInfo?.letterhead||businessInfo?.letterheadHtml));
  const cc = COUNTRY_CONFIG[businessInfo.country || 'india'];
  const fmt = (n) => currency(n, cc.currency);
  const subtotal = (order.services||[]).reduce((s,l)=>s+(parseFloat(l.qty)||0)*(parseFloat(l.rate)||0),0);
  const tax = (order.services||[]).reduce((s,l)=>s+(parseFloat(l.qty)||0)*(parseFloat(l.rate)||0)*(parseFloat(l.tax)||0)/100,0);
  const total = subtotal + tax;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 24, overflowY: 'auto' }} className="no-print">
      <div style={{ background: '#fff', borderRadius: 8, padding: 16, maxWidth: 860, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Service Order — {order.number}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(businessInfo?.letterhead||businessInfo?.letterheadHtml) && <button onClick={() => setUseLH(v=>!v)} style={{ ...styles.ghostBtn, ...(useLH?{background:'#EEF2FF',color:'#3D52A0',fontWeight:600}:{}) }}>📃 {useLH?'Letterhead ON':'Use Letterhead'}</button>}
            <button style={styles.ghostBtn} onClick={() => downloadDocPDF('.print-area',`service-order-${order.number||'so'}.pdf`)}><Download size={14}/> PDF</button>
            <button style={styles.primaryBtn} onClick={() => window.print()}><Printer size={14}/> Print</button>
            <button style={styles.secondaryBtn} onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="print-area" style={{ background: '#fff', padding: 32, fontFamily: 'Georgia, serif' }}>
          {useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml || businessInfo?.letterheadFooter) && <LetterpadPrintStyle />}
        {useLH && <LetterheadHeader bi={businessInfo} />}
          <div style={{ display: 'flex', justifyContent: useLH ? 'center' : 'space-between', marginBottom: 28 }}>
            {!useLH && <div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{businessInfo.name || 'Company Name'}</div>
              <div style={{ fontSize: 12, color: '#555', maxWidth: 240 }}>{businessInfo.address}</div>
              {businessInfo.gstin && <div style={{ fontSize: 11 }}>GSTIN: {businessInfo.gstin}</div>}
            </div>}
            <div style={{ textAlign: useLH ? 'center' : 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1 }}>SERVICE ORDER</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>#{order.number}</div>
              <div style={{ fontSize: 12, color: '#555' }}>Date: {order.date}</div>
              <div style={{ fontSize: 12, color: '#555' }}>Status: <strong style={{ textTransform: 'capitalize' }}>{order.status}</strong></div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <div style={{ border: '1px solid #e0e0e0', borderRadius: 4, padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Customer</div>
              <div style={{ fontWeight: 600 }}>{order.customerSnapshot ? order.customerSnapshot.name : '—'}</div>
              {order.customerSnapshot && <div style={{ fontSize: 12, color: '#555' }}>{order.customerSnapshot.address}</div>}
            </div>
            <div style={{ border: '1px solid #e0e0e0', borderRadius: 4, padding: 12 }}>
              <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Assignment</div>
              <div style={{ fontSize: 12 }}>Technician: <strong>{order.technicianName || '—'}</strong></div>
              {order.scheduledDate && <div style={{ fontSize: 12 }}>Scheduled: {order.scheduledDate}</div>}
              {order.completedDate && <div style={{ fontSize: 12 }}>Completed: {order.completedDate}</div>}
            </div>
          </div>

          {order.description && <div style={{ background: '#f8f8f8', borderRadius: 4, padding: 10, marginBottom: 16, fontSize: 13 }}>
            <strong>Description: </strong>{order.description}
          </div>}

          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16, fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#1E2A4A', color: '#fff' }}>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>#</th>
                <th style={{ padding: '8px 10px', textAlign: 'left' }}>Service / Description</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Qty</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tax%</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {(order.services||[]).map((l,i) => {
                const amt = (parseFloat(l.qty)||0)*(parseFloat(l.rate)||0);
                return <tr key={l.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '7px 10px' }}>{i+1}</td>
                  <td style={{ padding: '7px 10px' }}>{l.name}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{l.qty}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{fmt(l.rate)}</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right' }}>{l.tax||0}%</td>
                  <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>{fmt(amt)}</td>
                </tr>;
              })}
            </tbody>
          </table>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <table style={{ fontSize: 13, borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={{ padding: '4px 16px', color: '#555' }}>Subtotal</td><td style={{ padding: '4px 16px', textAlign: 'right' }}>{fmt(subtotal)}</td></tr>
                <tr><td style={{ padding: '4px 16px', color: '#555' }}>Tax</td><td style={{ padding: '4px 16px', textAlign: 'right' }}>{fmt(tax)}</td></tr>
                <tr style={{ fontWeight: 700, fontSize: 15, borderTop: '2px solid #1E2A4A' }}>
                  <td style={{ padding: '8px 16px' }}>TOTAL</td><td style={{ padding: '8px 16px', textAlign: 'right' }}>{fmt(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          {order.notes && <div style={{ marginTop: 16, fontSize: 12, color: '#555' }}><strong>Notes: </strong>{order.notes}</div>}
          <div style={{ marginTop: 36, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#555' }}>
            <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #333', paddingTop: 4, width: 140 }}>Customer Signature</div></div>
            <div style={{ textAlign: 'center' }}><div style={{ borderTop: '1px solid #333', paddingTop: 4, width: 140 }}>Authorised Signatory</div></div>
          </div>
          {useLH && businessInfo?.letterheadFooter && (
            <div className="lh-pad-footer" style={{ background: '#fff' }}>
              <img src={businessInfo.letterheadFooter} alt="letterhead footer" style={{ width:'100%', display:'block' }} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// EXPORT UTILITIES
// ─────────────────────────────────────────────

// ─── Reports ───────────────────────────────────────────────────


export function ScopeOfWorkView({ scopeOfWork, setScopeOfWork, userRole }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'sales';

  function saveScope(form) {
    const { _isNew, ...rest } = form;
    setScopeOfWork(prev => _isNew ? [...prev, { ...rest, id: crypto.randomUUID(), createdAt: Date.now() }] : prev.map(s => s.id === rest.id ? rest : s));
    setEditing(null); setCreating(false);
  }

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="serif" style={styles.h1}>Scope of Work</h1>
          <p style={styles.muted}>Service catalogue — link items to quotations and invoices.</p>
        </div>
        {canEdit && <button onClick={() => { setCreating(true); setEditing({ _isNew: true, name: '', category: '', description: '', unit: 'hrs', rate: '' }); }} style={styles.primaryBtn}><Plus size={15} /> New Scope Item</button>}
      </div>
      <div style={styles.list}>
        {scopeOfWork.length === 0 && <div style={styles.emptyBox}>No scope items yet. Add your services and packages here.</div>}
        {scopeOfWork.map(s => (
          <div key={s.id} style={styles.recordRow}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.category || 'General'} · {s.unit || 'hrs'} · Rate: {s.rate || '—'}</div>
              {s.description && <div style={{ fontSize: 12, color: '#555', marginTop: 4, maxWidth: 500 }}>{s.description}</div>}
            </div>
            {canEdit && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => { setEditing(s); setCreating(false); }} style={styles.iconBtn}><Pencil size={14} /></button>
                <button onClick={() => { if (window.confirm('Delete this scope item?')) setScopeOfWork(prev => prev.filter(x => x.id !== s.id)); }} style={{ ...styles.iconBtn, color: '#B5453A' }}><Trash2 size={14} /></button>
              </div>
            )}
          </div>
        ))}
      </div>
      {(creating || editing) && (
        <Modal title={creating ? 'New Scope Item' : 'Edit Scope Item'} onClose={() => { setEditing(null); setCreating(false); }}>
          <ScopeItemForm item={editing} onSave={saveScope} onClose={() => { setEditing(null); setCreating(false); }} />
        </Modal>
      )}
    </div>
  );
}


export function ScopeItemForm({ item, onSave, onClose }) {
  const [form, setForm] = useState({ _isNew: !!item?._isNew, id: item?.id || crypto.randomUUID(), name: item?.name || '', category: item?.category || '', description: item?.description || '', unit: item?.unit || 'hrs', rate: item?.rate || '' });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={styles.formGroup}><label style={styles.label}>Item Name *</label><input value={form.name} onChange={e => set('name', e.target.value)} style={styles.input} placeholder="e.g. Software Development" /></div>
      <div style={styles.formGroup}><label style={styles.label}>Category</label><input value={form.category} onChange={e => set('category', e.target.value)} style={styles.input} placeholder="e.g. Consulting" /></div>
      <div style={styles.formGroup}><label style={styles.label}>Unit</label>
        <select value={form.unit} onChange={e => set('unit', e.target.value)} style={styles.input}>
          {['hrs','days','project','lump sum','visit','month','year'].map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div style={styles.formGroup}><label style={styles.label}>Rate</label><input type="number" value={form.rate} onChange={e => set('rate', e.target.value)} style={styles.input} placeholder="0.00" /></div>
      <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}><label style={styles.label}>Description</label><textarea value={form.description} onChange={e => set('description', e.target.value)} style={{ ...styles.input, minHeight: 70 }} placeholder="Detailed description of the scope..." /></div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={() => { if (!form.name) return alert('Name required'); onSave(form); }}>Save</button>
      </div>
    </div>
  );
}

// ─── Quality Modules (Manufacturing) ──────────────────────────────────────────


export function AssetRegisterView({ assets, setAssets, userRole, businessInfo, currentBizType }) {
  const [subView, setSubView]           = useState('list');
  const [selectedId, setSelectedId]     = useState(null);
  const [editing, setEditing]           = useState(null);
  const [activeTab, setActiveTab]       = useState('details');
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingFuel, setEditingFuel]   = useState(null);
  const [filterCat, setFilterCat]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const canEdit = ['admin','manager'].includes(userRole);

  const ASSET_CATS = [
    { label:'Transport',         abbr:'TRN', sub:['Bus','Lorry','Car','Van','Bike','Truck','Forklift'] },
    { label:'Office Equipment',  abbr:'OFC', sub:['PC','Laptop','Printer','Photocopier','Table','Chair','AC','UPS','Projector'] },
    { label:'Plant & Machinery', abbr:'PLT', sub:['Compressor','Generator','Pump','Lathe','Drill Press','Welding Machine','Crane','Conveyor'] },
    { label:'Electrical',        abbr:'ELC', sub:['Transformer','Switchgear','Panel Board','Cable Drum','Motor','Inverter'] },
    { label:'Furniture',         abbr:'FRN', sub:['Workstation','Cabinet','Shelf','Sofa','Conference Table','Reception Desk','Locker'] },
    { label:'Other',             abbr:'OTH', sub:[] },
  ];
  const MAINT_TYPES = ['Maintenance','Calibration','Inspection','Service','Repair','AMC Service'];
  const CONDITIONS  = ['good','fair','poor','critical','decommissioned'];
  const COND_COLOR  = { good:'#1a6b30', fair:'#856404', poor:'#E07A3A', critical:'#842029', decommissioned:'#888' };
  const COND_BG     = { good:'#d4edda', fair:'#fff3cd', poor:'#fde8d4', critical:'#f8d7da', decommissioned:'#f0ece5' };
  const ST_STYLE    = { draft:{bg:'#F5F5F5',color:'#888',label:'Draft'}, pending:{bg:'#FFF3CD',color:'#856404',label:'Pending Approval'}, approved:{bg:'#D4EDDA',color:'#1a6b30',label:'Approved'} };

  // ── helpers ──────────────────────────────────────────────────────────────
  function genId(category) {
    const cat = ASSET_CATS.find(c=>c.label===category)||ASSET_CATS[ASSET_CATS.length-1];
    const yr  = new Date().getFullYear();
    const pfx = `AV-${cat.abbr}-${yr}-`;
    const n   = assets.filter(a=>a.assetId&&a.assetId.startsWith(pfx)).length+1;
    return `${pfx}${String(n).padStart(3,'0')}`;
  }
  function blankAsset() {
    const def = ASSET_CATS[0].label;
    return { id:'', assetId:genId(def), name:'', category:def, subtype:'', status:'draft', condition:'good', notes:'',
      location:'', floor:'', building:'', make:'', model:'', serialNo:'', purchaseDate:'', warrantyExpiry:'', installDate:'',
      numberPlate:'', chassisNo:'', engineNo:'', maintenanceRecords:[], fuelLogs:[] };
  }
  function blankRecord() {
    return { id:'', type:'Maintenance', date:new Date().toISOString().slice(0,10), performedBy:'', vendor:'', description:'', cost:'', nextDue:'', remarks:'' };
  }
  function blankFuel() {
    return { id:'', date:new Date().toISOString().slice(0,10), odometer:'', liters:'', costPerLiter:'', totalCost:'', driver:'', station:'', notes:'' };
  }
  function updateAsset(id, patch) {
    setAssets(prev=>prev.map(a=>a.id===id?{...a,...patch,updatedAt:Date.now()}:a));
  }
  function saveAsset(a) {
    const rec = {...a, id:a.id||crypto.randomUUID(), bizType:a.bizType||(currentBizType||'fmamc'), updatedAt:Date.now()};
    setAssets(prev=>prev.find(x=>x.id===rec.id)?prev.map(x=>x.id===rec.id?rec:x):[...prev,rec]);
    setEditing(null); setSelectedId(rec.id); setSubView('detail');
  }
  function saveRecord(assetId, rec) {
    const r = {...rec, id:rec.id||crypto.randomUUID()};
    const a = assets.find(x=>x.id===assetId);
    const recs = a?.maintenanceRecords||[];
    updateAsset(assetId, {maintenanceRecords: recs.find(x=>x.id===r.id)?recs.map(x=>x.id===r.id?r:x):[...recs,r]});
    setEditingRecord(null);
  }
  function saveFuel(assetId, fuel) {
    const f = {...fuel, id:fuel.id||crypto.randomUUID()};
    const a = assets.find(x=>x.id===assetId);
    const logs = a?.fuelLogs||[];
    updateAsset(assetId, {fuelLogs: logs.find(x=>x.id===f.id)?logs.map(x=>x.id===f.id?f:x):[...logs,f]});
    setEditingFuel(null);
  }

  // ── due-date alerts ───────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0,10);
  const soon  = new Date(Date.now()+30*86400000).toISOString().slice(0,10);
  function alerts(asset) {
    const recs = asset.maintenanceRecords||[];
    return { overdue: recs.filter(r=>r.nextDue&&r.nextDue<today), dueSoon: recs.filter(r=>r.nextDue&&r.nextDue>=today&&r.nextDue<=soon) };
  }
  const globalOverdue  = assets.filter(a=>(a.maintenanceRecords||[]).some(r=>r.nextDue&&r.nextDue<today));
  const globalDueSoon  = assets.filter(a=>(a.maintenanceRecords||[]).some(r=>r.nextDue&&r.nextDue>=today&&r.nextDue<=soon));

  // ── print ─────────────────────────────────────────────────────────────────
  function printAsset(a) {
    const co    = businessInfo||{};
    const isDraft = a.status!=='approved';
    const st    = ST_STYLE[a.status||'draft'];
    const isTransport = a.category==='Transport';
    const currency = co.currency||'';
    const fmt = v => v?`${currency}${v}`:'—';
    const html = `<!DOCTYPE html><html><head><title>Asset ${a.assetId}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:12px;color:#222;padding:28px 32px}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1E2A4A;padding-bottom:12px;margin-bottom:18px}
.co{font-size:17px;font-weight:700;color:#1E2A4A}.sub{font-size:11px;color:#666;margin-top:2px}
.badge{display:inline-block;padding:2px 10px;border-radius:4px;font-size:11px;font-weight:700}
.sec{font-size:11px;font-weight:700;color:#1E2A4A;text-transform:uppercase;letter-spacing:.5px;border-bottom:1px solid #ddd;padding-bottom:4px;margin:16px 0 10px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px 20px;margin-bottom:10px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px 20px;margin-bottom:10px}
.fld label{font-size:9px;color:#888;text-transform:uppercase;font-weight:700;display:block;margin-bottom:2px}
.fld span{font-size:12px;font-weight:500}
table{width:100%;border-collapse:collapse;font-size:11px;margin-top:6px}
th{background:#F8F7F4;padding:6px 8px;text-align:left;font-size:10px;font-weight:700;color:#555;text-transform:uppercase;border-bottom:1px solid #ddd}
td{padding:6px 8px;border-bottom:1px solid #F0ECE5}
.sign{display:grid;grid-template-columns:1fr 1fr 1fr;gap:32px;margin-top:48px}
.sbox{border-top:1px solid #999;padding-top:4px;font-size:10px;color:#888;text-align:center}
.foot{border-top:1px solid #ddd;margin-top:24px;padding-top:6px;font-size:10px;color:#888;display:flex;justify-content:space-between}
.wm{position:fixed;top:38%;left:50%;transform:translate(-50%,-50%) rotate(-40deg);font-size:90px;font-weight:900;color:rgba(200,0,0,0.07);white-space:nowrap;pointer-events:none;z-index:0}
@media print{body{padding:16px 20px}.wm{position:fixed}}
</style></head><body>
${isDraft?'<div class="wm">DRAFT</div>':''}
<div class="hdr">
  <div><div class="co">${co.companyName||'Company'}</div><div class="sub">${co.address||''}</div></div>
  <div style="text-align:right">
    <div style="font-size:15px;font-weight:700;color:#1E2A4A">Asset Register</div>
    <div style="font-size:13px;font-weight:600;margin-top:2px">${a.assetId}</div>
    <div style="margin-top:5px"><span class="badge" style="background:${st.bg};color:${st.color}">${st.label}</span></div>
  </div>
</div>

<div class="sec">Asset Details</div>
<div class="g3">
  <div class="fld"><label>Asset ID</label><span>${a.assetId}</span></div>
  <div class="fld"><label>Category</label><span>${a.category||'—'}</span></div>
  <div class="fld"><label>Sub-type</label><span>${a.subtype||'—'}</span></div>
  <div class="fld"><label>Asset Name</label><span>${a.name||'—'}</span></div>
  <div class="fld"><label>Condition</label><span>${(a.condition||'').toUpperCase()}</span></div>
  <div class="fld"><label>Location</label><span>${[a.building,a.floor,a.location].filter(Boolean).join(', ')||'—'}</span></div>
  <div class="fld"><label>Make / Brand</label><span>${a.make||'—'}</span></div>
  <div class="fld"><label>Model</label><span>${a.model||'—'}</span></div>
  <div class="fld"><label>Serial No.</label><span>${a.serialNo||'—'}</span></div>
  <div class="fld"><label>Install Date</label><span>${a.installDate||'—'}</span></div>
  <div class="fld"><label>Purchase Date</label><span>${a.purchaseDate||'—'}</span></div>
  <div class="fld"><label>Warranty Expiry</label><span>${a.warrantyExpiry||'—'}</span></div>
</div>

${isTransport?`<div class="sec">Vehicle Details</div>
<div class="g3">
  <div class="fld"><label>Number Plate</label><span style="font-weight:700">${a.numberPlate||'—'}</span></div>
  <div class="fld"><label>Chassis No.</label><span>${a.chassisNo||'—'}</span></div>
  <div class="fld"><label>Engine No.</label><span>${a.engineNo||'—'}</span></div>
</div>`:''}

${a.notes?`<div class="sec">Notes</div><p style="font-size:12px;color:#444">${a.notes}</p>`:''}

${(a.maintenanceRecords||[]).length>0?`<div class="sec">Maintenance / Calibration History</div>
<table><thead><tr><th>#</th><th>Type</th><th>Date</th><th>Performed By</th><th>Vendor</th><th>Description</th><th>Cost</th><th>Next Due</th></tr></thead>
<tbody>${(a.maintenanceRecords||[]).map((r,i)=>`<tr>
  <td>${i+1}</td><td>${r.type}</td><td>${r.date}</td><td>${r.performedBy||'—'}</td>
  <td>${r.vendor||'—'}</td><td>${r.description||'—'}</td><td>${fmt(r.cost)}</td>
  <td style="color:${r.nextDue&&r.nextDue<today?'#B5453A':'inherit'}">${r.nextDue||'—'}${r.nextDue&&r.nextDue<today?' ⚠':''}</td>
</tr>`).join('')}</tbody></table>`:''}

${isTransport&&(a.fuelLogs||[]).length>0?`<div class="sec">Fuel Consumption Log</div>
<table><thead><tr><th>#</th><th>Date</th><th>Driver</th><th>Odometer</th><th>Liters</th><th>Cost/L</th><th>Total</th><th>Station</th></tr></thead>
<tbody>${(a.fuelLogs||[]).map((f,i)=>`<tr>
  <td>${i+1}</td><td>${f.date}</td><td>${f.driver||'—'}</td><td>${f.odometer?f.odometer+' km':'—'}</td>
  <td>${f.liters?f.liters+' L':'—'}</td><td>${fmt(f.costPerLiter)}</td><td>${fmt(f.totalCost)}</td><td>${f.station||'—'}</td>
</tr>`).join('')}</tbody></table>
<p style="font-size:11px;color:#555;margin-top:8px">
  Total fuel: <strong>${(a.fuelLogs||[]).reduce((s,f)=>s+(parseFloat(f.liters)||0),0).toFixed(1)} L</strong> &nbsp;|&nbsp;
  Total cost: <strong>${fmt((a.fuelLogs||[]).reduce((s,f)=>s+(parseFloat(f.totalCost)||0),0).toFixed(2))}</strong>
</p>`:''}

<div class="sign">
  <div class="sbox">Prepared By</div>
  <div class="sbox">Reviewed By</div>
  <div class="sbox">Approved By</div>
</div>
<div class="foot">
  <span>Printed: ${new Date().toLocaleDateString()}</span>
  <span>${co.companyName||''} — Asset Register</span>
</div>
</body></html>`;
    const w = window.open('','_blank'); w.document.write(html); w.document.close(); setTimeout(()=>w.print(),300);
  }

  const selected = assets.find(a=>a.id===selectedId);

  // ══════════════════════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (subView==='list') {
    const filtered = assets.filter(a=>(!filterCat||a.category===filterCat)&&(!filterStatus||a.status===filterStatus));
    return (
      <div style={{ padding:'24px 32px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <h2 className="serif" style={styles.pageTitle}>Asset Register</h2>
          {canEdit && <button onClick={()=>{setEditing(blankAsset());setSubView('edit');}} style={styles.primaryBtn}><Plus size={15}/> Add Asset</button>}
        </div>

        {(globalOverdue.length>0||globalDueSoon.length>0) && (
          <div style={{ background:'#FFF8E1', border:'1px solid #FDEAA7', borderRadius:8, padding:'10px 16px', marginBottom:12, display:'flex', gap:20, flexWrap:'wrap' }}>
            {globalOverdue.length>0 && <span style={{ color:'#B5453A', fontWeight:600, fontSize:13 }}>⚠ {globalOverdue.length} asset{globalOverdue.length>1?'s':''} overdue for maintenance</span>}
            {globalDueSoon.length>0 && <span style={{ color:'#856404', fontWeight:600, fontSize:13 }}>🔔 {globalDueSoon.length} due within 30 days</span>}
          </div>
        )}

        <div style={{ display:'flex', gap:12, marginBottom:14, flexWrap:'wrap' }}>
          {[['Total',assets.length,''],['Good',assets.filter(a=>a.condition==='good').length,'#1a6b30'],
            ['Poor/Critical',assets.filter(a=>['critical','poor'].includes(a.condition)).length,'#B5453A'],
            ['Approved',assets.filter(a=>a.status==='approved').length,'#1E2A4A']].map(([l,v,c])=>(
            <div key={l} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:8, padding:'10px 16px' }}>
              <div style={{ fontSize:10, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{l}</div>
              <div style={{ fontSize:20, fontWeight:700, color:c||'#1E2A4A' }}>{v}</div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:10, marginBottom:14 }}>
          <select value={filterCat} onChange={e=>setFilterCat(e.target.value)} style={{ ...styles.input, width:'auto', padding:'6px 10px' }}>
            <option value="">All Categories</option>
            {ASSET_CATS.map(c=><option key={c.label} value={c.label}>{c.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} style={{ ...styles.input, width:'auto', padding:'6px 10px' }}>
            <option value="">All Status</option>
            <option value="draft">Draft</option>
            <option value="pending">Pending Approval</option>
            <option value="approved">Approved</option>
          </select>
        </div>

        {filtered.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No assets found.</div> : (
          <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#F8F7F4' }}>
                {['Asset ID','Name','Category','Sub-type','Condition','Status','Alerts',''].map(h=>(
                  <th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filtered.map(a=>{
                  const {overdue,dueSoon}=alerts(a); const st=ST_STYLE[a.status||'draft'];
                  return (
                    <tr key={a.id} onClick={()=>{setSelectedId(a.id);setSubView('detail');setActiveTab('details');}} style={{ borderBottom:'1px solid #F0ECE5', cursor:'pointer' }} onMouseEnter={e=>e.currentTarget.style.background='#FAFAF8'} onMouseLeave={e=>e.currentTarget.style.background=''}>
                      <td style={{ padding:'10px 12px', fontWeight:600, color:'#1E2A4A' }}>{a.assetId}</td>
                      <td style={{ padding:'10px 12px', fontWeight:500 }}>{a.name||'—'}</td>
                      <td style={{ padding:'10px 12px', color:'#555' }}>{a.category||'—'}</td>
                      <td style={{ padding:'10px 12px', color:'#888', fontSize:12 }}>{a.subtype||'—'}</td>
                      <td style={{ padding:'10px 12px' }}><span style={{ background:COND_BG[a.condition]||'#f0f0f0', color:COND_COLOR[a.condition]||'#888', borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{(a.condition||'').toUpperCase()}</span></td>
                      <td style={{ padding:'10px 12px' }}><span style={{ background:st.bg, color:st.color, borderRadius:5, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{st.label}</span></td>
                      <td style={{ padding:'10px 12px' }}>
                        {overdue.length>0&&<span style={{ color:'#B5453A', fontSize:12, fontWeight:600 }}>⚠ {overdue.length} overdue</span>}
                        {dueSoon.length>0&&<span style={{ color:'#856404', fontSize:12, fontWeight:600 }}>{overdue.length?' · ':''}🔔 {dueSoon.length} due soon</span>}
                      </td>
                      <td style={{ padding:'10px 12px' }} onClick={e=>e.stopPropagation()}>
                        {canEdit&&<div style={{ display:'flex', gap:6 }}>
                          <button onClick={()=>{setEditing({...a});setSubView('edit');}} style={styles.iconBtn}><Pencil size={14}/></button>
                          <button onClick={()=>{if(window.confirm('Delete asset?'))setAssets(prev=>prev.filter(x=>x.id!==a.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button>
                        </div>}
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

  // ══════════════════════════════════════════════════════════════════════════
  // EDIT FORM
  // ══════════════════════════════════════════════════════════════════════════
  if (subView==='edit'&&editing) {
    const a=editing; const set=(k,v)=>setEditing(p=>({...p,[k]:v}));
    const catObj=ASSET_CATS.find(c=>c.label===a.category)||ASSET_CATS[0];
    const isTransport=a.category==='Transport';
    const row=(label,key,type='text',ph='')=>(
      <div style={styles.formGroup}><label style={styles.label}>{label}</label>
        <input type={type} value={a[key]||''} onChange={e=>set(key,e.target.value)} style={styles.input} placeholder={ph}/>
      </div>
    );
    return (
      <div style={{ maxWidth:720, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>{setEditing(null);setSubView(selectedId?'detail':'list');}} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{a.id?'Edit':'New'} Asset — {a.assetId}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:14 }}>

          <div style={{ fontSize:11, fontWeight:700, color:'#1E2A4A', textTransform:'uppercase', letterSpacing:.5, borderBottom:'1px solid #F0ECE5', paddingBottom:4 }}>Identification</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            {row('Asset ID','assetId')}
            <div style={styles.formGroup}><label style={styles.label}>Category</label>
              <select value={a.category||''} onChange={e=>{const nc=e.target.value;setEditing(p=>({...p,category:nc,subtype:'',assetId:p.id?p.assetId:genId(nc)}));}} style={styles.input}>
                {ASSET_CATS.map(c=><option key={c.label} value={c.label}>{c.label}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Sub-type</label>
              {catObj.sub.length>0
                ?<select value={a.subtype||''} onChange={e=>set('subtype',e.target.value)} style={styles.input}><option value="">— Select —</option>{catObj.sub.map(s=><option key={s} value={s}>{s}</option>)}</select>
                :<input value={a.subtype||''} onChange={e=>set('subtype',e.target.value)} style={styles.input} placeholder="Specify"/>}
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:12 }}>
            {row('Asset Name / Description','name','text','e.g. Main Office AC Unit')}
            <div style={styles.formGroup}><label style={styles.label}>Condition</label>
              <select value={a.condition} onChange={e=>set('condition',e.target.value)} style={styles.input}>
                {CONDITIONS.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
              </select>
            </div>
          </div>

          {isTransport&&<>
            <div style={{ fontSize:11, fontWeight:700, color:'#1E2A4A', textTransform:'uppercase', letterSpacing:.5, borderBottom:'1px solid #F0ECE5', paddingBottom:4 }}>Vehicle Details</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              {row('Number Plate','numberPlate','text','e.g. TN 01 AB 1234')}
              {row('Chassis No.','chassisNo')}
              {row('Engine No.','engineNo')}
            </div>
          </>}

          <div style={{ fontSize:11, fontWeight:700, color:'#1E2A4A', textTransform:'uppercase', letterSpacing:.5, borderBottom:'1px solid #F0ECE5', paddingBottom:4 }}>Location</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            {row('Building','building')} {row('Floor','floor')} {row('Location / Room','location')}
          </div>

          <div style={{ fontSize:11, fontWeight:700, color:'#1E2A4A', textTransform:'uppercase', letterSpacing:.5, borderBottom:'1px solid #F0ECE5', paddingBottom:4 }}>Specifications & Dates</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            {row('Make / Brand','make')} {row('Model','model')} {row('Serial No.','serialNo')}
            {row('Install Date','installDate','date')} {row('Purchase Date','purchaseDate','date')} {row('Warranty Expiry','warrantyExpiry','date')}
          </div>

          <div style={styles.formGroup}><label style={styles.label}>Notes</label>
            <textarea value={a.notes||''} onChange={e=>set('notes',e.target.value)} style={{ ...styles.input, height:60 }}/>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>{setEditing(null);setSubView(selectedId?'detail':'list');}} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>saveAsset(a)} style={styles.primaryBtn}>Save Asset</button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (subView==='detail'&&selected) {
    const a=selected; const {overdue,dueSoon}=alerts(a); const st=ST_STYLE[a.status||'draft'];
    const isTransport=a.category==='Transport';

    // Maintenance record form
    if (editingRecord) {
      const r=editingRecord; const setR=(k,v)=>setEditingRecord(p=>({...p,[k]:v}));
      return (
        <div style={{ maxWidth:620, margin:'0 auto', padding:'24px 0' }}>
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
            <button onClick={()=>setEditingRecord(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
            <h2 className="serif" style={styles.pageTitle}>{r.id?'Edit':'New'} Record</h2>
          </div>
          <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={styles.formGroup}><label style={styles.label}>Record Type</label>
                <select value={r.type} onChange={e=>setR('type',e.target.value)} style={styles.input}>
                  {MAINT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={styles.formGroup}><label style={styles.label}>Date</label><input type='date' value={r.date||''} onChange={e=>setR('date',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Performed By</label><input value={r.performedBy||''} onChange={e=>setR('performedBy',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Vendor / Service Provider</label><input value={r.vendor||''} onChange={e=>setR('vendor',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Cost</label><input type='number' value={r.cost||''} onChange={e=>setR('cost',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Next Due Date</label><input type='date' value={r.nextDue||''} onChange={e=>setR('nextDue',e.target.value)} style={styles.input}/></div>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Work Done / Description</label>
              <textarea value={r.description||''} onChange={e=>setR('description',e.target.value)} style={{ ...styles.input, height:70 }}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Remarks</label><input value={r.remarks||''} onChange={e=>setR('remarks',e.target.value)} style={styles.input}/></div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setEditingRecord(null)} style={styles.ghostBtn}>Cancel</button>
              <button onClick={()=>saveRecord(a.id,r)} style={styles.primaryBtn}>Save Record</button>
            </div>
          </div>
        </div>
      );
    }

    // Fuel log form
    if (editingFuel) {
      const f=editingFuel; const setF=(k,v)=>setEditingFuel(p=>({...p,[k]:v}));
      return (
        <div style={{ maxWidth:580, margin:'0 auto', padding:'24px 0' }}>
          <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
            <button onClick={()=>setEditingFuel(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
            <h2 className="serif" style={styles.pageTitle}>{f.id?'Edit':'New'} Fuel Entry</h2>
          </div>
          <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={styles.formGroup}><label style={styles.label}>Date</label><input type='date' value={f.date||''} onChange={e=>setF('date',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Driver</label><input value={f.driver||''} onChange={e=>setF('driver',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Odometer (km)</label><input type='number' value={f.odometer||''} onChange={e=>setF('odometer',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Fuel Station</label><input value={f.station||''} onChange={e=>setF('station',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Liters</label>
                <input type='number' value={f.liters||''} onChange={e=>{
                  const l=parseFloat(e.target.value)||0,cpl=parseFloat(f.costPerLiter)||0;
                  setEditingFuel(p=>({...p,liters:e.target.value,totalCost:l&&cpl?(l*cpl).toFixed(2):p.totalCost}));
                }} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Cost per Liter</label>
                <input type='number' value={f.costPerLiter||''} onChange={e=>{
                  const cpl=parseFloat(e.target.value)||0,l=parseFloat(f.liters)||0;
                  setEditingFuel(p=>({...p,costPerLiter:e.target.value,totalCost:l&&cpl?(l*cpl).toFixed(2):p.totalCost}));
                }} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Total Cost</label><input type='number' value={f.totalCost||''} onChange={e=>setF('totalCost',e.target.value)} style={styles.input}/></div>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Notes</label><input value={f.notes||''} onChange={e=>setF('notes',e.target.value)} style={styles.input}/></div>
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
              <button onClick={()=>setEditingFuel(null)} style={styles.ghostBtn}>Cancel</button>
              <button onClick={()=>saveFuel(a.id,f)} style={styles.primaryBtn}>Save Entry</button>
            </div>
          </div>
        </div>
      );
    }

    // Main detail
    const tabs = [['details','Details'],['maintenance',`Maintenance${(a.maintenanceRecords||[]).length?` (${(a.maintenanceRecords||[]).length})`:''}`],...(isTransport?[['fuel',`Fuel Log${(a.fuelLogs||[]).length?` (${(a.fuelLogs||[]).length})`:''}` ]]:[])];
    return (
      <div style={{ padding:'24px 32px' }}>
        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', gap:12, alignItems:'center' }}>
            <button onClick={()=>{setSubView('list');setSelectedId(null);setEditingRecord(null);setEditingFuel(null);}} style={styles.ghostBtn}><X size={14}/> Back</button>
            <div>
              <h2 className="serif" style={{ ...styles.pageTitle, marginBottom:2 }}>{a.assetId}{a.name?` — ${a.name}`:''}</h2>
              <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginTop:4 }}>
                <span style={{ background:st.bg, color:st.color, borderRadius:5, padding:'2px 9px', fontSize:11, fontWeight:700 }}>{st.label}</span>
                <span style={{ background:COND_BG[a.condition]||'#f0f0f0', color:COND_COLOR[a.condition]||'#888', borderRadius:5, padding:'2px 9px', fontSize:11, fontWeight:700 }}>{(a.condition||'').toUpperCase()}</span>
                {overdue.length>0&&<span style={{ color:'#B5453A', fontSize:12, fontWeight:600 }}>⚠ {overdue.length} overdue</span>}
                {dueSoon.length>0&&<span style={{ color:'#856404', fontSize:12, fontWeight:600 }}>🔔 {dueSoon.length} due soon</span>}
              </div>
            </div>
          </div>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {canEdit&&a.status==='draft'&&<button onClick={()=>updateAsset(a.id,{status:'pending'})} style={{ ...styles.ghostBtn, borderColor:'#856404', color:'#856404' }}>Submit for Approval</button>}
            {userRole==='admin'&&a.status==='pending'&&<>
              <button onClick={()=>updateAsset(a.id,{status:'draft'})} style={{ ...styles.ghostBtn, color:'#B5453A' }}>Return to Draft</button>
              <button onClick={()=>updateAsset(a.id,{status:'approved'})} style={{ ...styles.primaryBtn, background:'#1a6b30' }}><CheckCircle size={14}/> Approve</button>
            </>}
            {canEdit&&<button onClick={()=>{setEditing({...a});setSubView('edit');}} style={styles.ghostBtn}><Pencil size={14}/> Edit</button>}
            <button onClick={()=>printAsset(a)} style={styles.ghostBtn}><Printer size={14}/> Print</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'2px solid #EAE6DB', marginBottom:20 }}>
          {tabs.map(([k,label])=>(
            <button key={k} onClick={()=>setActiveTab(k)} style={{ padding:'8px 20px', border:'none', borderBottom:activeTab===k?'2px solid #1E2A4A':'2px solid transparent', background:'none', cursor:'pointer', fontWeight:activeTab===k?700:400, color:activeTab===k?'#1E2A4A':'#888', fontSize:13, marginBottom:'-2px' }}>{label}</button>
          ))}
        </div>

        {/* DETAILS TAB */}
        {activeTab==='details'&&(
          <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:16 }}>
              {[['Asset ID',a.assetId],['Category',a.category||'—'],['Sub-type',a.subtype||'—'],
                ['Make / Brand',a.make||'—'],['Model',a.model||'—'],['Serial No.',a.serialNo||'—'],
                ['Install Date',a.installDate||'—'],['Purchase Date',a.purchaseDate||'—'],
                ['Warranty Expiry',a.warrantyExpiry||(a.warrantyExpiry&&a.warrantyExpiry<today?'⚠ '+a.warrantyExpiry:a.warrantyExpiry)||'—'],
                ['Building',a.building||'—'],['Floor',a.floor||'—'],['Location',a.location||'—']].map(([l,v])=>(
                <div key={l}>
                  <div style={{ fontSize:10, color:'#888', fontWeight:600, textTransform:'uppercase', marginBottom:2 }}>{l}</div>
                  <div style={{ fontWeight:l==='Asset ID'?600:400 }}>{v}</div>
                </div>
              ))}
            </div>
            {isTransport&&<>
              <div style={{ fontSize:11, fontWeight:700, color:'#1E2A4A', textTransform:'uppercase', borderBottom:'1px solid #F0ECE5', paddingBottom:4, marginBottom:12 }}>Vehicle Details</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                {[['Number Plate',a.numberPlate||'—'],['Chassis No.',a.chassisNo||'—'],['Engine No.',a.engineNo||'—']].map(([l,v])=>(
                  <div key={l}>
                    <div style={{ fontSize:10, color:'#888', fontWeight:600, textTransform:'uppercase', marginBottom:2 }}>{l}</div>
                    <div style={{ fontWeight:l==='Number Plate'?700:400 }}>{v}</div>
                  </div>
                ))}
              </div>
            </>}
            {a.notes&&<div style={{ marginTop:16 }}><div style={{ fontSize:10, color:'#888', fontWeight:600, textTransform:'uppercase', marginBottom:4 }}>Notes</div><div style={{ color:'#555' }}>{a.notes}</div></div>}
          </div>
        )}

        {/* MAINTENANCE TAB */}
        {activeTab==='maintenance'&&(
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={{ fontSize:14, fontWeight:600 }}>Maintenance / Calibration Records</div>
              {canEdit&&<button onClick={()=>setEditingRecord(blankRecord())} style={styles.primaryBtn}><Plus size={14}/> Add Record</button>}
            </div>
            {(a.maintenanceRecords||[]).length===0
              ?<div style={{ textAlign:'center', padding:48, color:'#888' }}>No records yet. Add the first maintenance or calibration entry.</div>
              :<div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:'#F8F7F4' }}>
                    {['Type','Date','Performed By','Vendor','Work Done','Cost','Next Due','Status',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {[...(a.maintenanceRecords||[])].sort((x,y)=>y.date.localeCompare(x.date)).map(r=>{
                      const od=r.nextDue&&r.nextDue<today, ds=r.nextDue&&r.nextDue>=today&&r.nextDue<=soon;
                      return (
                        <tr key={r.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                          <td style={{ padding:'10px 12px', fontWeight:600 }}>{r.type}</td>
                          <td style={{ padding:'10px 12px' }}>{r.date}</td>
                          <td style={{ padding:'10px 12px', color:'#555' }}>{r.performedBy||'—'}</td>
                          <td style={{ padding:'10px 12px', color:'#555', fontSize:12 }}>{r.vendor||'—'}</td>
                          <td style={{ padding:'10px 12px', color:'#555', fontSize:12, maxWidth:180 }}>{r.description||'—'}</td>
                          <td style={{ padding:'10px 12px' }}>{r.cost||'—'}</td>
                          <td style={{ padding:'10px 12px', color:od?'#B5453A':ds?'#856404':'#555', fontWeight:od||ds?600:400 }}>{r.nextDue||'—'}</td>
                          <td style={{ padding:'10px 12px' }}>
                            {od&&<span style={{ background:'#f8d7da', color:'#842029', borderRadius:4, padding:'2px 7px', fontSize:11, fontWeight:700 }}>OVERDUE</span>}
                            {ds&&<span style={{ background:'#fff3cd', color:'#856404', borderRadius:4, padding:'2px 7px', fontSize:11, fontWeight:700 }}>DUE SOON</span>}
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            {canEdit&&<div style={{ display:'flex', gap:6 }}>
                              <button onClick={()=>setEditingRecord(r)} style={styles.iconBtn}><Pencil size={14}/></button>
                              <button onClick={()=>{if(window.confirm('Delete record?'))updateAsset(a.id,{maintenanceRecords:(a.maintenanceRecords||[]).filter(x=>x.id!==r.id)})}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button>
                            </div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            }
          </div>
        )}

        {/* FUEL LOG TAB */}
        {activeTab==='fuel'&&isTransport&&(
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div>
                <div style={{ fontSize:14, fontWeight:600 }}>Fuel Consumption Log</div>
                {(a.fuelLogs||[]).length>0&&<div style={{ fontSize:12, color:'#888', marginTop:2 }}>
                  Total: <strong>{(a.fuelLogs||[]).reduce((s,f)=>s+(parseFloat(f.liters)||0),0).toFixed(1)} L</strong> &nbsp;|&nbsp; Cost: <strong>{(a.fuelLogs||[]).reduce((s,f)=>s+(parseFloat(f.totalCost)||0),0).toFixed(2)}</strong>
                </div>}
              </div>
              {canEdit&&<button onClick={()=>setEditingFuel(blankFuel())} style={styles.primaryBtn}><Plus size={14}/> Add Entry</button>}
            </div>
            {(a.fuelLogs||[]).length===0
              ?<div style={{ textAlign:'center', padding:48, color:'#888' }}>No fuel entries yet.</div>
              :<div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                  <thead><tr style={{ background:'#F8F7F4' }}>
                    {['Date','Driver','Odometer','Liters','Cost/L','Total','Station','Notes',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {[...(a.fuelLogs||[])].sort((x,y)=>y.date.localeCompare(x.date)).map(f=>(
                      <tr key={f.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                        <td style={{ padding:'10px 12px' }}>{f.date}</td>
                        <td style={{ padding:'10px 12px' }}>{f.driver||'—'}</td>
                        <td style={{ padding:'10px 12px', color:'#555' }}>{f.odometer?f.odometer+' km':'—'}</td>
                        <td style={{ padding:'10px 12px', fontWeight:500 }}>{f.liters?f.liters+' L':'—'}</td>
                        <td style={{ padding:'10px 12px', color:'#555' }}>{f.costPerLiter||'—'}</td>
                        <td style={{ padding:'10px 12px', fontWeight:500 }}>{f.totalCost||'—'}</td>
                        <td style={{ padding:'10px 12px', color:'#555', fontSize:12 }}>{f.station||'—'}</td>
                        <td style={{ padding:'10px 12px', color:'#555', fontSize:12 }}>{f.notes||'—'}</td>
                        <td style={{ padding:'10px 12px' }}>
                          {canEdit&&<div style={{ display:'flex', gap:6 }}>
                            <button onClick={()=>setEditingFuel(f)} style={styles.iconBtn}><Pencil size={14}/></button>
                            <button onClick={()=>{if(window.confirm('Delete entry?'))updateAsset(a.id,{fuelLogs:(a.fuelLogs||[]).filter(x=>x.id!==f.id)})}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button>
                          </div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            }
          </div>
        )}
      </div>
    );
  }

  return <div style={{ padding:40, color:'#888' }}>Loading…</div>;
}

// ─── FM: Preventive Maintenance Schedules ─────────────────────────────────────

export function PMScheduleView({ pmSchedules, setPmSchedules, assets, fmWorkOrders, setFmWorkOrders, userRole }) {
  const [editing, setEditing] = useState(null);
  const canEdit = ['admin','manager'].includes(userRole);
  const today = new Date().toISOString().slice(0,10);
  const FREQ = ['Daily','Weekly','Monthly','Quarterly','Half-Yearly','Annual'];

  function blank() {
    return { id:'', assetId:'', title:'', frequency:'Monthly', lastDoneDate:'', nextDueDate:'', assignedTo:'', instructions:'', status:'active' };
  }
  function calcNext(lastDate, freq) {
    if(!lastDate) return '';
    const d = new Date(lastDate);
    const map = { Daily:1, Weekly:7, Monthly:30, Quarterly:90, 'Half-Yearly':180, Annual:365 };
    d.setDate(d.getDate() + (map[freq]||30));
    return d.toISOString().slice(0,10);
  }
  function save(pm) {
    const rec = { ...pm, id:pm.id||crypto.randomUUID(), updatedAt:Date.now() };
    setPmSchedules(prev=>prev.find(x=>x.id===rec.id)?prev.map(x=>x.id===rec.id?rec:x):[...prev,rec]);
    setEditing(null);
  }
  function raisePMWorkOrder(pm) {
    const asset = assets.find(a=>a.id===pm.assetId);
    const wo = { id:crypto.randomUUID(), woNumber:`WO-${String(fmWorkOrders.length+1).padStart(4,'0')}`, type:'preventive', assetId:pm.assetId, assetName:asset?.name||'', title:pm.title, priority:'medium', raisedDate:today, dueDate:pm.nextDueDate||'', assignedTo:pm.assignedTo||'', instructions:pm.instructions||'', status:'open', pmRef:pm.id, cost:0 };
    setFmWorkOrders(prev=>[...prev, wo]);
    setPmSchedules(prev=>prev.map(s=>s.id===pm.id?{ ...s, lastDoneDate:today, nextDueDate:calcNext(today,s.frequency) }:s));
    alert(`Work Order ${wo.woNumber} created.`);
  }

  if (editing) {
    const pm = editing;
    const set = (k,v)=>setEditing(p=>({...p,[k]:v}));
    return (
      <div style={{ maxWidth:580, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{pm.id?'Edit':'New'} PM Schedule</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={styles.formGroup}><label style={styles.label}>Asset</label>
            <select value={pm.assetId||''} onChange={e=>set('assetId',e.target.value)} style={styles.input}>
              <option value=''>Select asset</option>
              {assets.map(a=><option key={a.id} value={a.id}>{a.assetId} — {a.name}</option>)}
            </select>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>PM Task Title</label><input value={pm.title||''} onChange={e=>set('title',e.target.value)} style={styles.input} placeholder='e.g. AHU Filter Cleaning'/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Frequency</label>
              <select value={pm.frequency} onChange={e=>set('frequency',e.target.value)} style={styles.input}>
                {FREQ.map(f=><option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Assigned To</label><input value={pm.assignedTo||''} onChange={e=>set('assignedTo',e.target.value)} style={styles.input} placeholder='Technician name'/></div>
            <div style={styles.formGroup}><label style={styles.label}>Last Done Date</label><input type='date' value={pm.lastDoneDate||''} onChange={e=>{ set('lastDoneDate',e.target.value); set('nextDueDate',calcNext(e.target.value,pm.frequency)); }} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Next Due Date</label><input type='date' value={pm.nextDueDate||''} onChange={e=>set('nextDueDate',e.target.value)} style={styles.input}/></div>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Instructions / Checklist</label><textarea value={pm.instructions||''} onChange={e=>set('instructions',e.target.value)} style={{ ...styles.input, height:80 }} placeholder='Steps to follow during PM...'/></div>
          <div style={styles.formGroup}><label style={styles.label}>Status</label>
            <select value={pm.status||'active'} onChange={e=>set('status',e.target.value)} style={styles.input}>
              {['active','paused','decommissioned'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>save(pm)} style={styles.primaryBtn}>Save Schedule</button>
          </div>
        </div>
      </div>
    );
  }

  const overdue = pmSchedules.filter(pm=>pm.status==='active' && pm.nextDueDate && pm.nextDueDate < today);
  const dueThisWeek = pmSchedules.filter(pm=>pm.status==='active' && pm.nextDueDate && pm.nextDueDate >= today && pm.nextDueDate <= new Date(Date.now()+7*86400000).toISOString().slice(0,10));
  return (
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 className="serif" style={styles.pageTitle}>Preventive Maintenance Schedules</h2>
        {canEdit && <button onClick={()=>setEditing(blank())} style={styles.primaryBtn}><Plus size={15}/> Add PM Schedule</button>}
      </div>
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        {[['Total Schedules',pmSchedules.length,''],['Overdue',overdue.length,'#B5453A'],['Due This Week',dueThisWeek.length,'#856404'],['Active',pmSchedules.filter(p=>p.status==='active').length,'#1a6b30']].map(([l,v,c])=>(
          <div key={l} style={{ background:c&&v>0?'#FFF8F7':'#fff', border:`1px solid ${c&&v>0?'#FBEAE7':'#EAE6DB'}`, borderRadius:8, padding:'12px 18px' }}>
            <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:700, color:c||'#1E2A4A' }}>{v}</div>
          </div>
        ))}
      </div>
      {pmSchedules.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No PM schedules set up yet.</div> : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4' }}>
              {['Asset','Task','Frequency','Last Done','Next Due','Assigned To',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {[...pmSchedules].sort((a,b)=>(a.nextDueDate||'')>(b.nextDueDate||'')?1:-1).map(pm=>{
                const asset = assets.find(a=>a.id===pm.assetId);
                const isOverdue = pm.status==='active' && pm.nextDueDate && pm.nextDueDate < today;
                return (
                  <tr key={pm.id} style={{ borderBottom:'1px solid #F0ECE5', background:isOverdue?'#FFF8F7':'#fff' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600, color:'#1E2A4A' }}>{asset?.assetId||'—'} <span style={{ fontWeight:400, color:'#555' }}>{asset?.name||''}</span></td>
                    <td style={{ padding:'10px 12px' }}>{pm.title||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{pm.frequency}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{pm.lastDoneDate||'Never'}</td>
                    <td style={{ padding:'10px 12px', color:isOverdue?'#B5453A':'#555', fontWeight:isOverdue?700:400 }}>{pm.nextDueDate||'—'}{isOverdue?' ⚠':''}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{pm.assignedTo||'—'}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        {canEdit && <button onClick={()=>raisePMWorkOrder(pm)} style={{ ...styles.ghostBtn, fontSize:11, color:'#1E2A4A' }}>▶ Raise WO</button>}
                        {canEdit && <button onClick={()=>setEditing(pm)} style={styles.iconBtn}><Pencil size={14}/></button>}
                        {canEdit && <button onClick={()=>{if(window.confirm('Delete?'))setPmSchedules(prev=>prev.filter(x=>x.id!==pm.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button>}
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

// ─── FM: Work Orders ──────────────────────────────────────────────────────────

export function FMWorkOrderView({ fmWorkOrders, setFmWorkOrders, assets, fmSpareParts, setFmSpareParts, userRole }) {
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const canEdit = ['admin','manager'].includes(userRole);
  const today = new Date().toISOString().slice(0,10);

  const TYPES     = ['corrective','preventive','emergency','inspection'];
  const PRIORITIES= ['low','medium','high','emergency'];
  const STATUSES  = ['open','in_progress','on_hold','completed','cancelled'];
  const PRIO_COLOR= { low:'#555', medium:'#0a58ca', high:'#856404', emergency:'#842029' };
  const PRIO_BG   = { low:'#f0ece5', medium:'#cfe2ff', high:'#fff3cd', emergency:'#f8d7da' };
  const ST_COLOR  = { open:'#0a58ca', in_progress:'#856404', on_hold:'#888', completed:'#1a6b30', cancelled:'#555' };
  const ST_BG     = { open:'#cfe2ff', in_progress:'#fff3cd', on_hold:'#f0ece5', completed:'#d4edda', cancelled:'#f0ece5' };

  function blank() {
    return { id:'', woNumber:`WO-${String(fmWorkOrders.length+1).padStart(4,'0')}`, type:'corrective', assetId:'', title:'', description:'', priority:'medium', raisedDate:today, dueDate:'', assignedTo:'', status:'open', completedDate:'', cost:0, sparesUsed:[], notes:'' };
  }
  function save(wo) {
    const rec = { ...wo, id:wo.id||crypto.randomUUID(), approvalStatus:wo.approvalStatus||'draft', approvalNote:wo.approvalNote||'', updatedAt:Date.now() };
    setFmWorkOrders(prev=>prev.find(x=>x.id===rec.id)?prev.map(x=>x.id===rec.id?rec:x):[...prev,rec]);
    setEditing(null);
  }
  function updateApproval(id, patch) {
    setFmWorkOrders(prev=>prev.map(x=>x.id===id?{...x,approvalStatus:patch.status,approvalNote:patch.rejectionNote||''}:x));
  }

  if (editing) {
    const wo = editing;
    const set = (k,v)=>setEditing(p=>({...p,[k]:v}));
    return (
      <div style={{ maxWidth:660, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{wo.id?'Edit':'New'} Work Order — {wo.woNumber}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>WO No.</label><input value={wo.woNumber} onChange={e=>set('woNumber',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Type</label>
              <select value={wo.type} onChange={e=>set('type',e.target.value)} style={styles.input}>
                {TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Priority</label>
              <select value={wo.priority} onChange={e=>set('priority',e.target.value)} style={{ ...styles.input, background:PRIO_BG[wo.priority], color:PRIO_COLOR[wo.priority], fontWeight:700 }}>
                {PRIORITIES.map(p=><option key={p} value={p}>{p.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Asset</label>
              <select value={wo.assetId||''} onChange={e=>{ const a=assets.find(x=>x.id===e.target.value); set('assetId',e.target.value); if(a)set('assetName',a.name); }} style={styles.input}>
                <option value=''>Select asset</option>
                {assets.map(a=><option key={a.id} value={a.id}>{a.assetId} — {a.name}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Status</label>
              <select value={wo.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
                {STATUSES.map(s=><option key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Raised Date</label><input type='date' value={wo.raisedDate||''} onChange={e=>set('raisedDate',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Due Date</label><input type='date' value={wo.dueDate||''} onChange={e=>set('dueDate',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Assigned To</label><input value={wo.assignedTo||''} onChange={e=>set('assignedTo',e.target.value)} style={styles.input} placeholder='Technician'/></div>
            <div style={styles.formGroup}><label style={styles.label}>Completion Date</label><input type='date' value={wo.completedDate||''} onChange={e=>set('completedDate',e.target.value)} style={styles.input}/></div>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Title</label><input value={wo.title||''} onChange={e=>set('title',e.target.value)} style={styles.input}/></div>
          <div style={styles.formGroup}><label style={styles.label}>Description / Fault Report</label><textarea value={wo.description||''} onChange={e=>set('description',e.target.value)} style={{ ...styles.input, height:72 }}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Total Cost</label><input type='number' value={wo.cost||0} onChange={e=>set('cost',e.target.value)} style={styles.input}/></div>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Notes / Resolution</label><textarea value={wo.notes||''} onChange={e=>set('notes',e.target.value)} style={{ ...styles.input, height:60 }}/></div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>save(wo)} style={styles.primaryBtn}>Save WO</button>
          </div>
        </div>
      </div>
    );
  }

  const list = fmWorkOrders.filter(wo=>filterStatus==='all'||wo.status===filterStatus).sort((a,b)=>{
    const pOrder = { emergency:0, high:1, medium:2, low:3 };
    return (pOrder[a.priority]||2) - (pOrder[b.priority]||2);
  });
  const open = fmWorkOrders.filter(wo=>wo.status==='open'||wo.status==='in_progress');
  const overdue = fmWorkOrders.filter(wo=>wo.dueDate && wo.dueDate < today && wo.status!=='completed' && wo.status!=='cancelled');
  return (
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 className="serif" style={styles.pageTitle}>FM Work Orders</h2>
        {canEdit && <button onClick={()=>setEditing(blank())} style={styles.primaryBtn}><Plus size={15}/> New Work Order</button>}
      </div>
      <div style={{ display:'flex', gap:12, marginBottom:20, flexWrap:'wrap' }}>
        {[['Open',open.length,'#0a58ca'],['Overdue',overdue.length,'#B5453A'],['Emergency',fmWorkOrders.filter(w=>w.priority==='emergency'&&w.status!=='completed').length,'#842029'],['Completed',fmWorkOrders.filter(w=>w.status==='completed').length,'#1a6b30']].map(([l,v,c])=>(
          <div key={l} style={{ background:v>0&&l!=='Completed'?'#FFF8F7':'#fff', border:`1px solid ${v>0&&l!=='Completed'?'#FBEAE7':'#EAE6DB'}`, borderRadius:8, padding:'12px 18px' }}>
            <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:700, color:c }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {['all',...STATUSES].map(s=><button key={s} onClick={()=>setFilterStatus(s)} style={{ ...styles.ghostBtn, background:filterStatus===s?'#1E2A4A':'transparent', color:filterStatus===s?'#fff':'#555', fontSize:12 }}>{s==='all'?'All':s.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</button>)}
      </div>
      {list.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No work orders.</div> : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4' }}>
              {['WO No.','Asset','Title','Priority','Type','Due','Assigned','Status',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(wo=>{
                const asset = assets.find(a=>a.id===wo.assetId);
                const od = wo.dueDate && wo.dueDate < today && wo.status!=='completed';
                return (
                  <tr key={wo.id} style={{ borderBottom:'1px solid #F0ECE5', background:od?'#FFF8F7':wo.priority==='emergency'&&wo.status!=='completed'?'#FFF5F5':'#fff' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{wo.woNumber}</td>
                    <td style={{ padding:'10px 12px', color:'#555', fontSize:12 }}>{asset?.assetId||'—'}</td>
                    <td style={{ padding:'10px 12px', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{wo.title||'—'}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:PRIO_BG[wo.priority], color:PRIO_COLOR[wo.priority], borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{wo.priority.toUpperCase()}</span></td>
                    <td style={{ padding:'10px 12px', color:'#555', fontSize:12 }}>{wo.type}</td>
                    <td style={{ padding:'10px 12px', color:od?'#B5453A':'#555', fontWeight:od?700:400 }}>{wo.dueDate||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{wo.assignedTo||'—'}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:ST_BG[wo.status], color:ST_COLOR[wo.status], borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{wo.status.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
                    <td style={{ padding:'10px 12px' }}>
                      {canEdit && <div style={{ display:'flex', gap:6 }}>
                        <StatusBadge status={wo.approvalStatus||'draft'} />
                        <ApprovalActions item={{ status:wo.approvalStatus||'draft', rejectionNote:wo.approvalNote||'' }} onUpdate={(patch)=>updateApproval(wo.id,patch)} userRole={userRole} compact />
                        {wo.approvalStatus!=='submitted' && <button onClick={()=>setEditing(wo)} style={styles.iconBtn}><Pencil size={14}/></button>}
                        {wo.approvalStatus!=='submitted' && <button onClick={()=>{if(window.confirm('Delete?'))setFmWorkOrders(prev=>prev.filter(x=>x.id!==wo.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button>}
                      </div>}
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

// ─── FM: AMC Contracts / SLA ──────────────────────────────────────────────────

export function AMCContractView({ amcContracts, setAmcContracts, customers, assets, userRole, businessInfo }) {
  const [editing, setEditing] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);
  const canEdit = ['admin','manager','accounts'].includes(userRole);
  const today = new Date().toISOString().slice(0,10);
  const ST_COLOR = { active:'#1a6b30', expired:'#842029', draft:'#555', terminated:'#888' };
  const ST_BG    = { active:'#d4edda', expired:'#f8d7da', draft:'#f0ece5', terminated:'#f0ece5' };
  const country = businessInfo?.country || 'other';
  const cc = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.other;
  const sellerState = businessInfo?.state || '';

  function blank() {
    const n = `AMC-${String(amcContracts.length+1).padStart(3,'0')}`;
    return { id:'', contractNo:n, customerId:'', title:'', startDate:'', endDate:'', value:0, taxRate:cc.defaultTaxRate||0, placeOfSupply:'', slaResponse:'4', slaPriority:'P2', coveredAssets:[], scope:'', billingCycle:'Annual', status:'active', notes:'' };
  }
  function save(c) {
    const rec = { ...c, id:c.id||crypto.randomUUID(), approvalStatus:c.approvalStatus||'draft', approvalNote:c.approvalNote||'', updatedAt:Date.now() };
    setAmcContracts(prev=>prev.find(x=>x.id===rec.id)?prev.map(x=>x.id===rec.id?rec:x):[...prev,rec]);
    setEditing(null);
  }
  function updateApproval(id, patch) {
    setAmcContracts(prev=>prev.map(x=>x.id===id?{...x,approvalStatus:patch.status,approvalNote:patch.rejectionNote||''}:x));
  }
  function daysLeft(endDate) {
    if(!endDate) return null;
    return Math.ceil((new Date(endDate)-new Date(today))/(1000*86400));
  }

  if (editing) {
    const c = editing;
    const set = (k,v)=>setEditing(p=>({...p,[k]:v}));
    return (
      <div style={{ maxWidth:680, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{c.id?'Edit':'New'} AMC Contract — {c.contractNo}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Contract No.</label><input value={c.contractNo} onChange={e=>set('contractNo',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Status</label>
              <select value={c.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
                {['draft','active','expired','terminated'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Billing Cycle</label>
              <select value={c.billingCycle||'Annual'} onChange={e=>set('billingCycle',e.target.value)} style={styles.input}>
                {['Monthly','Quarterly','Half-Yearly','Annual'].map(b=><option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Title / Scope Summary</label><input value={c.title||''} onChange={e=>set('title',e.target.value)} style={styles.input} placeholder='e.g. Full HVAC AMC — Building A'/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Client</label>
              <select value={c.customerId||''} onChange={e=>set('customerId',e.target.value)} style={styles.input}>
                <option value=''>Select client</option>
                {customers.map(cu=><option key={cu.id} value={cu.id}>{cu.name}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Annual / Contract Value (excl. tax)</label><input type='number' value={c.value||0} onChange={e=>set('value',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Start Date</label><input type='date' value={c.startDate||''} onChange={e=>set('startDate',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>End Date</label><input type='date' value={c.endDate||''} onChange={e=>set('endDate',e.target.value)} style={styles.input}/></div>
          </div>
          {cc.hasTax && (
            <TaxSummaryBox
              subtotal={parseFloat(c.value)||0} taxRate={c.taxRate} cc={cc}
              placeOfSupply={c.placeOfSupply} sellerState={sellerState}
              onChangeTax={v=>set('taxRate',v)} onChangePOS={v=>set('placeOfSupply',v)}
            />
          )}
          {/* SLA */}
          <div style={{ background:'#F0F8FF', borderRadius:8, padding:14, border:'1px solid #b8d9f8' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#0a58ca', marginBottom:10 }}>SLA Terms</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={styles.formGroup}><label style={styles.label}>Response Time (hours)</label><input type='number' value={c.slaResponse||4} onChange={e=>set('slaResponse',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Resolution Target</label>
                <select value={c.slaPriority||'P2'} onChange={e=>set('slaPriority',e.target.value)} style={styles.input}>
                  {['P1 — 4hr Fix','P2 — 8hr Fix','P3 — 24hr Fix','P4 — 48hr Fix'].map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
          </div>
          {/* Covered Assets */}
          <div style={styles.formGroup}>
            <label style={styles.label}>Assets Covered</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
              {assets.map(a=>(
                <button key={a.id} onClick={()=>set('coveredAssets', c.coveredAssets.includes(a.id)?c.coveredAssets.filter(x=>x!==a.id):[...c.coveredAssets,a.id])}
                  style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid', cursor:'pointer', background:c.coveredAssets.includes(a.id)?'#1E2A4A':'transparent', color:c.coveredAssets.includes(a.id)?'#fff':'#555', borderColor:c.coveredAssets.includes(a.id)?'#1E2A4A':'#ccc' }}>
                  {a.assetId}
                </button>
              ))}
              {assets.length===0 && <span style={{ fontSize:12, color:'#888' }}>Add assets first in the Asset Register.</span>}
            </div>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Scope / Inclusions</label><textarea value={c.scope||''} onChange={e=>set('scope',e.target.value)} style={{ ...styles.input, height:72 }}/></div>
          <div style={styles.formGroup}><label style={styles.label}>Notes</label><textarea value={c.notes||''} onChange={e=>set('notes',e.target.value)} style={{ ...styles.input, height:56 }}/></div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>save(c)} style={styles.primaryBtn}>Save Contract</button>
          </div>
        </div>
      </div>
    );
  }

  const list = [...amcContracts].sort((a,b)=>a.endDate>b.endDate?1:-1);
  const active = list.filter(c=>c.status==='active');
  const expiringSoon = active.filter(c=>{ const d=daysLeft(c.endDate); return d!==null && d<=30 && d>=0; });
  return (
    <>
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 className="serif" style={styles.pageTitle}>AMC Contracts & SLA</h2>
        {canEdit && <button onClick={()=>setEditing(blank())} style={styles.primaryBtn}><Plus size={15}/> New Contract</button>}
      </div>
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        {[['Active',active.length,'#1a6b30'],['Expiring ≤30d',expiringSoon.length,'#856404'],['Total Value (incl. tax)',(cc.currency||'')+active.reduce((s,c)=>s+calcModuleTax(parseFloat(c.value)||0,c.taxRate||0,cc,c.placeOfSupply,sellerState).grandTotal,0).toLocaleString(undefined,{maximumFractionDigits:0}),'#C9A24B'],['Expired',list.filter(c=>c.status==='expired').length,'#842029']].map(([l,v,c])=>(
          <div key={l} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:8, padding:'12px 18px' }}>
            <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:700, color:c }}>{v}</div>
          </div>
        ))}
      </div>
      {list.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No AMC contracts yet.</div> : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4' }}>
              {['Contract No.','Title','Client','Value',cc.hasTax?'Grand Total':'','Start','End','Days Left','Status',''].filter(h=>h!=='').map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(c=>{
                const client = customers.find(cu=>cu.id===c.customerId);
                const dl = daysLeft(c.endDate);
                const warn = dl !== null && dl <= 30 && dl >= 0;
                return (
                  <tr key={c.id} style={{ borderBottom:'1px solid #F0ECE5', background:warn?'#FFFBF0':'#fff' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{c.contractNo}</td>
                    <td style={{ padding:'10px 12px', color:'#333' }}>{c.title||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{client?.name||'—'}</td>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{(cc.currency||'')+parseFloat(c.value||0).toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                    {cc.hasTax && <td style={{ padding:'10px 12px', fontWeight:700, color:'#1E2A4A' }}>{(cc.currency||'')+calcModuleTax(parseFloat(c.value)||0,c.taxRate||0,cc,c.placeOfSupply,sellerState).grandTotal.toLocaleString(undefined,{maximumFractionDigits:0})}</td>}
                    <td style={{ padding:'10px 12px', color:'#555' }}>{c.startDate||'—'}</td>
                    <td style={{ padding:'10px 12px', color:dl!==null&&dl<0?'#B5453A':'#555' }}>{c.endDate||'—'}</td>
                    <td style={{ padding:'10px 12px', fontWeight:warn?700:400, color:warn?'#856404':dl!==null&&dl<0?'#B5453A':'#555' }}>{dl!==null?(dl<0?'Expired':`${dl}d`):('—')}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:ST_BG[c.status], color:ST_COLOR[c.status], borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{c.status.toUpperCase()}</span></td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <StatusBadge status={c.approvalStatus||'draft'} />
                        <ApprovalActions item={{ status:c.approvalStatus||'draft', rejectionNote:c.approvalNote||'' }} onUpdate={(patch)=>updateApproval(c.id,patch)} userRole={userRole} compact />
                        <button onClick={()=>setPrintDoc(c)} style={styles.iconBtn} title="Print"><Printer size={14}/></button>
                        {canEdit && c.approvalStatus!=='submitted' && <><button onClick={()=>setEditing(c)} style={styles.iconBtn}><Pencil size={14}/></button>
                        <button onClick={()=>{if(window.confirm('Delete?'))setAmcContracts(prev=>prev.filter(x=>x.id!==c.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button></>}
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
    {/* ── AMC Contract Print Overlay ── */}
    {printDoc && (()=>{
      const c = printDoc;
      const client = customers.find(cu=>cu.id===c.customerId);
      const covAssets = assets.filter(a=>c.coveredAssets?.includes(a.id));
      const cVal = parseFloat(c.value||0);
      const tax = cc.hasTax ? calcModuleTax(cVal, c.taxRate||0, cc, c.placeOfSupply, sellerState) : null;
      const dl = c.endDate ? Math.ceil((new Date(c.endDate)-new Date(today))/(1000*86400)) : null;
      return (
        <DocPrintOverlay onClose={()=>setPrintDoc(null)} filename={`AMC-Contract-${c.contractNo}.pdf`} businessInfo={businessInfo}>
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#1E2A4A', letterSpacing:1 }}>AMC CONTRACT / SERVICE AGREEMENT</div>
            <div style={{ fontSize:13, color:'#888', marginTop:4 }}>{c.contractNo} &nbsp;|&nbsp; {c.status?.toUpperCase()}</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 32px', fontSize:13, marginBottom:16 }}>
            {[['Client', client?.name||'—'], ['Title', c.title||'—'], ['Start Date', c.startDate||'—'], ['End Date', c.endDate||'—'], ['Billing Cycle', c.billingCycle||'—'], ['Days Remaining', dl!==null?(dl<0?'Expired':`${dl} days`):('—')]].map(([l,v])=>(
              <div key={l} style={{ display:'flex', gap:8, borderBottom:'1px solid #f0ece5', padding:'5px 0' }}>
                <span style={{ color:'#888', minWidth:120 }}>{l}</span><span style={{ fontWeight:600, color:'#1E2A4A' }}>{v}</span>
              </div>
            ))}
          </div>
          {/* Contract Value */}
          <div style={{ background:'#F8F7F4', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
              <span>Contract Value (excl. tax)</span><span style={{ fontWeight:600 }}>{(cc.currency||'')+cVal.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
            </div>
            {tax && tax.cgst>0 && <>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>CGST ({(c.taxRate||0)/2}%)</span><span>{(cc.currency||'')+tax.cgst.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>SGST ({(c.taxRate||0)/2}%)</span><span>{(cc.currency||'')+tax.sgst.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
            </>}
            {tax && tax.igst>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>IGST ({c.taxRate||0}%)</span><span>{(cc.currency||'')+tax.igst.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
            {tax && tax.vat>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>{cc.taxLabel||'Tax'} ({c.taxRate||0}%)</span><span>{(cc.currency||'')+tax.vat.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, color:'#1E2A4A', borderTop:'1px solid #ddd', paddingTop:6, marginTop:4 }}>
              <span>Total Value</span><span>{(cc.currency||'')+(tax?tax.grandTotal:cVal).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
            </div>
          </div>
          {/* SLA */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:8, textTransform:'uppercase' }}>SLA Terms</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, fontSize:13 }}>
              <div style={{ background:'#F0F8FF', borderRadius:6, padding:'8px 12px' }}><b>Response Time:</b> {c.slaResponse||'4'} hours</div>
              <div style={{ background:'#F0F8FF', borderRadius:6, padding:'8px 12px' }}><b>Resolution:</b> {c.slaPriority||'P2'}</div>
            </div>
          </div>
          {/* Scope */}
          {c.scope && <div style={{ marginBottom:16, fontSize:13 }}><b>Scope / Inclusions:</b><div style={{ color:'#555', marginTop:4, lineHeight:1.6 }}>{c.scope}</div></div>}
          {/* Covered Assets */}
          {covAssets.length>0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:6, textTransform:'uppercase' }}>Assets Covered</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {covAssets.map(a=><span key={a.id} style={{ background:'#f0ece5', borderRadius:4, padding:'3px 8px', fontSize:12 }}>{a.assetId} — {a.name}</span>)}
              </div>
            </div>
          )}
          {c.notes && <div style={{ fontSize:12, color:'#555', borderTop:'1px solid #eee', paddingTop:10, marginBottom:16 }}><b>Notes:</b> {c.notes}</div>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32, marginTop:40 }}>
            {['Client Signature & Stamp','Service Provider Signature & Stamp'].map(s=>(
              <div key={s}>
                <div style={{ borderTop:'1px solid #555', paddingTop:8, fontSize:12, color:'#555', textAlign:'center' }}>{s}</div>
                <div style={{ marginTop:24, fontSize:11, color:'#aaa', textAlign:'center' }}>Date: _______________</div>
              </div>
            ))}
          </div>
        </DocPrintOverlay>
      );
    })()}
    </>
  );
}

// ─── FM: Spare Parts ──────────────────────────────────────────────────────────

export function FMSparePartsView({ fmSpareParts, setFmSpareParts, assets, userRole }) {
  const [editing, setEditing] = useState(null);
  const canEdit = ['admin','manager','inventory'].includes(userRole);

  function blank() {
    return { id:'', partNo:`SPN-${String(fmSpareParts.length+1).padStart(4,'0')}`, name:'', description:'', compatibleAssets:[], supplier:'', unitCost:0, currentStock:0, minStock:0, location:'' };
  }
  function save(p) {
    const rec = { ...p, id:p.id||crypto.randomUUID(), updatedAt:Date.now() };
    setFmSpareParts(prev=>prev.find(x=>x.id===rec.id)?prev.map(x=>x.id===rec.id?rec:x):[...prev,rec]);
    setEditing(null);
  }

  if (editing) {
    const p = editing;
    const set = (k,v)=>setEditing(x=>({...x,[k]:v}));
    return (
      <div style={{ maxWidth:580, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{p.id?'Edit':'New'} Spare Part — {p.partNo}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Part No.</label><input value={p.partNo} onChange={e=>set('partNo',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Part Name</label><input value={p.name||''} onChange={e=>set('name',e.target.value)} style={styles.input}/></div>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Description</label><input value={p.description||''} onChange={e=>set('description',e.target.value)} style={styles.input}/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Current Stock</label><input type='number' value={p.currentStock||0} onChange={e=>set('currentStock',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Min Stock</label><input type='number' value={p.minStock||0} onChange={e=>set('minStock',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Unit Cost</label><input type='number' value={p.unitCost||0} onChange={e=>set('unitCost',e.target.value)} style={styles.input}/></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Supplier</label><input value={p.supplier||''} onChange={e=>set('supplier',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Storage Location</label><input value={p.location||''} onChange={e=>set('location',e.target.value)} style={styles.input}/></div>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Compatible Assets</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
              {assets.map(a=>(
                <button key={a.id} onClick={()=>set('compatibleAssets',(p.compatibleAssets||[]).includes(a.id)?(p.compatibleAssets||[]).filter(x=>x!==a.id):[...(p.compatibleAssets||[]),a.id])}
                  style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid', cursor:'pointer', background:(p.compatibleAssets||[]).includes(a.id)?'#1E2A4A':'transparent', color:(p.compatibleAssets||[]).includes(a.id)?'#fff':'#555', borderColor:(p.compatibleAssets||[]).includes(a.id)?'#1E2A4A':'#ccc' }}>
                  {a.assetId}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>save(p)} style={styles.primaryBtn}>Save Part</button>
          </div>
        </div>
      </div>
    );
  }

  const lowStock = fmSpareParts.filter(p=>(parseFloat(p.currentStock)||0)<(parseFloat(p.minStock)||0));
  return (
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 className="serif" style={styles.pageTitle}>FM Spare Parts</h2>
        {canEdit && <button onClick={()=>setEditing(blank())} style={styles.primaryBtn}><Plus size={15}/> Add Part</button>}
      </div>
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        {[['Total Parts',fmSpareParts.length,''],['Low Stock',lowStock.length,'#B5453A'],['Total Value',fmSpareParts.reduce((s,p)=>s+(parseFloat(p.currentStock)||0)*(parseFloat(p.unitCost)||0),0).toLocaleString(undefined,{maximumFractionDigits:0}),'#C9A24B']].map(([l,v,c])=>(
          <div key={l} style={{ background:c==='#B5453A'&&v>0?'#FFF8F7':'#fff', border:'1px solid #EAE6DB', borderRadius:8, padding:'12px 18px' }}>
            <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:700, color:c||'#1E2A4A' }}>{v}</div>
          </div>
        ))}
      </div>
      {fmSpareParts.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No spare parts recorded.</div> : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4' }}>
              {['Part No.','Name','Stock','Min','Unit Cost','Supplier','Location',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {fmSpareParts.map(p=>{
                const low = (parseFloat(p.currentStock)||0)<(parseFloat(p.minStock)||0);
                return (
                  <tr key={p.id} style={{ borderBottom:'1px solid #F0ECE5', background:low?'#FFF8F7':'#fff' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{p.partNo}</td>
                    <td style={{ padding:'10px 12px' }}>{p.name||'—'}</td>
                    <td style={{ padding:'10px 12px', fontWeight:700, color:low?'#B5453A':'#1a6b30' }}>{p.currentStock||0}{low?' ⚠':''}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{p.minStock||0}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{parseFloat(p.unitCost||0).toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{p.supplier||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{p.location||'—'}</td>
                    <td style={{ padding:'10px 12px' }}>
                      {canEdit && <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>setEditing(p)} style={styles.iconBtn}><Pencil size={14}/></button>
                        <button onClick={()=>{if(window.confirm('Delete?'))setFmSpareParts(prev=>prev.filter(x=>x.id!==p.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button>
                      </div>}
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

// ─── FM: KPI Dashboard ────────────────────────────────────────────────────────

export function FMKPIView({ assets, pmSchedules, fmWorkOrders, amcContracts, fmSpareParts, businessInfo }) {
  const today = new Date().toISOString().slice(0,10);
  const thisMonth = today.slice(0,7);

  // WO stats
  const openWOs    = fmWorkOrders.filter(w=>w.status==='open'||w.status==='in_progress');
  const closedThisMonth = fmWorkOrders.filter(w=>w.status==='completed' && (w.completedDate||'').startsWith(thisMonth));
  const emergencyOpen = openWOs.filter(w=>w.priority==='emergency');
  const overdueWOs = fmWorkOrders.filter(w=>w.dueDate&&w.dueDate<today&&w.status!=='completed'&&w.status!=='cancelled');
  const woCostMonth = closedThisMonth.reduce((s,w)=>s+(parseFloat(w.cost)||0),0);

  // PM stats
  const overduepm = pmSchedules.filter(p=>p.status==='active'&&p.nextDueDate&&p.nextDueDate<today);
  const dueThisWeek = pmSchedules.filter(p=>p.status==='active'&&p.nextDueDate&&p.nextDueDate>=today&&p.nextDueDate<=new Date(Date.now()+7*86400000).toISOString().slice(0,10));

  // AMC expiring
  const amcExpiring = amcContracts.filter(c=>{ if(c.status!=='active'||!c.endDate) return false; const d=Math.ceil((new Date(c.endDate)-new Date(today))/86400000); return d>=0&&d<=30; });

  // Asset condition
  const condCount = {};
  assets.forEach(a=>{ condCount[a.condition]=(condCount[a.condition]||0)+1; });

  // Low spare parts
  const lowSpares = fmSpareParts.filter(p=>(parseFloat(p.currentStock)||0)<(parseFloat(p.minStock)||0));

  function KPI({ label, value, sub, color='#1E2A4A', bg='#fff', warn }) {
    return (
      <div style={{ background:warn?'#FFF8F7':bg, border:`1px solid ${warn?'#FBEAE7':'#EAE6DB'}`, borderRadius:10, padding:'16px 20px', minWidth:140 }}>
        <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>{label}</div>
        <div style={{ fontSize:28, fontWeight:700, color:warn?'#B5453A':color, lineHeight:1 }}>{value}</div>
        {sub && <div style={{ fontSize:11, color:'#888', marginTop:4 }}>{sub}</div>}
      </div>
    );
  }
  function SH({ children }) {
    return <div style={{ fontSize:12, fontWeight:800, color:'#1E2A4A', textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'2px solid #EAE6DB', paddingBottom:6, marginTop:28, marginBottom:14 }}>{children}</div>;
  }

  return (
    <div style={{ padding:'24px 32px', maxWidth:900 }}>
      <div style={{ marginBottom:24 }}>
        <h2 className="serif" style={styles.pageTitle}>FM KPI Dashboard</h2>
        <div style={{ fontSize:12, color:'#888' }}>{businessInfo?.name} · {today}</div>
      </div>

      <SH>Work Order KPIs</SH>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
        <KPI label="Open WOs" value={openWOs.length} warn={openWOs.length>5} sub="in queue"/>
        <KPI label="Emergency Open" value={emergencyOpen.length} warn={emergencyOpen.length>0} sub="needs immediate action"/>
        <KPI label="Overdue" value={overdueWOs.length} warn={overdueWOs.length>0} sub="past due date"/>
        <KPI label="Closed This Month" value={closedThisMonth.length} color='#1a6b30'/>
        <KPI label="WO Cost (Month)" value={woCostMonth.toLocaleString(undefined,{maximumFractionDigits:0})} sub={businessInfo?.currency||''}/>
      </div>
      {emergencyOpen.length>0 && (
        <div style={{ marginTop:12, background:'#FFF5F5', border:'1px solid #f8d7da', borderRadius:8, padding:12 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#842029', marginBottom:6 }}>🚨 Emergency Work Orders</div>
          {emergencyOpen.map(w=><div key={w.id} style={{ fontSize:12, color:'#555', padding:'3px 0' }}>{w.woNumber} — {w.title||assets.find(a=>a.id===w.assetId)?.name||'—'} · Due: {w.dueDate||'—'}</div>)}
        </div>
      )}

      <SH>Preventive Maintenance</SH>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
        <KPI label="Active Schedules" value={pmSchedules.filter(p=>p.status==='active').length} color='#1a6b30'/>
        <KPI label="Overdue PM" value={overduepm.length} warn={overduepm.length>0} sub="need attention"/>
        <KPI label="Due This Week" value={dueThisWeek.length} color='#856404'/>
      </div>

      <SH>AMC Contracts</SH>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
        <KPI label="Active Contracts" value={amcContracts.filter(c=>c.status==='active').length} color='#1a6b30'/>
        <KPI label="Expiring ≤30d" value={amcExpiring.length} warn={amcExpiring.length>0} sub="renew soon"/>
        <KPI label="Annual Value" value={amcContracts.filter(c=>c.status==='active').reduce((s,c)=>s+(parseFloat(c.value)||0),0).toLocaleString(undefined,{maximumFractionDigits:0})} color='#C9A24B' sub={businessInfo?.currency||''}/>
      </div>

      <SH>Assets & Spares</SH>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
        <KPI label="Total Assets" value={assets.length}/>
        {Object.entries(condCount).map(([cond,cnt])=>(
          <KPI key={cond} label={cond.charAt(0).toUpperCase()+cond.slice(1)} value={cnt} warn={cond==='critical'&&cnt>0} color={cond==='good'?'#1a6b30':cond==='critical'?'#842029':cond==='poor'?'#E07A3A':'#555'}/>
        ))}
        <KPI label="Low Spare Parts" value={lowSpares.length} warn={lowSpares.length>0} sub="reorder needed"/>
      </div>
    </div>
  );
}

// ─── Tender & Estimation ─────────────────────────────────────────────────────
