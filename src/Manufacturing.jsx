import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertTriangle, BarChart2, Bell, BookOpen, Briefcase, CheckCircle, CheckSquare, ChevronDown, ChevronRight, ClipboardList, Clock, Cloud, CloudOff, Download, Factory, FileMinus, FileSignature, FileText, LayoutDashboard, Layers, LogOut, MapPin, Package, Paperclip, Pencil, Plus, Printer, Search, Settings, Shield, ShoppingCart, Square, Trash2, Truck, Users, Wrench, X } from 'lucide-react';
import { uploadDrawing, deleteDrawing } from './firebase';
import { ROLE_MODULES, TEST_EMAILS, PLAN_MODULES, DOC_TYPES, CONVERT_TO, EMPTY_ITEM_ROW, blankDoc, COUNTRY_CONFIG, numToWords, currency, makeFmt, computeTotals, calcModuleTax, computeStock, downloadCSV, filterByRange, loadScript, parseOCRText, styles, TaxSummaryBox, DocPrintOverlay, Modal, LetterpadPrintStyle, sanitizeLHtml, LetterheadHeader, VoucherPrintHeader, VoucherSignatory, ApprovalActions, StatusBadge, DocRow, StatCard, BIZ_BADGE, DocumentsList, ConvertDropdown, PrintModal, DateRangePicker, SpecsFields, DrawingUploader, LockedModuleScreen, TemplateMiniPreview, sendNotificationEmail } from './utils.jsx';

export function QualityCheckList({ productionOrders, setProductionOrders, userRole, boms = [], parts = [] }) {
  const [activeQC, setActiveQC] = useState(null);
  const canDoQC = userRole === 'admin' || userRole === 'manager' || userRole === 'inventory';
  const pending = productionOrders.filter((o) => o.status === 'qc_pending');
  const done = productionOrders.filter((o) => o.status === 'completed' || o.status === 'failed');

  function submitQC(orderId, result, notes) {
    setProductionOrders((p) => p.map((o) => {
      if (o.id !== orderId) return o;
      return { ...o, status: result === 'pass' ? 'completed' : 'failed', qcResult: result, qcNotes: notes, qcDate: Date.now() };
    }));
    setActiveQC(null);
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h1 className="serif" style={styles.h1}>Quality Check</h1>
        <p style={styles.muted}>Review production orders ready for QC inspection.</p>
      </div>

      <div className="serif" style={{ ...styles.h2, marginBottom: 12 }}>Pending QC ({pending.length})</div>
      <div style={{ ...styles.list, marginBottom: 28 }}>
        {pending.length === 0 && <div style={styles.emptyBox}>No orders pending QC right now.</div>}
        {pending.map((o) => {
          const bom = boms.find(b => b.id === o.bomId);
          return (
            <div key={o.id} style={styles.recordRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.docRowTitle}>{o.number} — {bom ? bom.name : ''}</div>
                <div style={styles.docRowSub}>Qty: {o.quantity} · Started: {o.startDate}</div>
              </div>
              <span style={{ ...styles.badge, background: '#FFF3CD', color: '#856404' }}>QC Pending</span>
              {canDoQC && <button onClick={() => setActiveQC(o)} style={styles.primaryBtn}>Do QC</button>}
            </div>
          );
        })}
      </div>

      <div className="serif" style={{ ...styles.h2, marginBottom: 12 }}>QC History</div>
      <div style={styles.list}>
        {done.length === 0 && <div style={styles.emptyBox}>No QC history yet.</div>}
        {done.map((o) => {
          const passed = o.qcResult === 'pass';
          return (
            <div key={o.id} style={styles.recordRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.docRowTitle}>{o.number}</div>
                <div style={styles.docRowSub}>{o.qcNotes || '—'} · {o.qcDate ? new Date(o.qcDate).toLocaleDateString() : ''}</div>
              </div>
              <span style={{ ...styles.badge, background: passed ? '#D6F0E0' : '#FBEAE7', color: passed ? '#1A5C35' : '#B5453A' }}>
                {passed ? 'Pass ✓' : 'Failed ✗'}
              </span>
            </div>
          );
        })}
      </div>

      {activeQC && <QCModal order={activeQC} onSubmit={submitQC} onClose={() => setActiveQC(null)} />}
    </div>
  );
}


export function QCModal({ order, onSubmit, onClose }) {
  const [result, setResult] = useState('pass');
  const [notes, setNotes] = useState('');
  return (
    <div style={styles.modalOverlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <span style={{ fontWeight: 600 }}>QC — {order.number}</span>
          <button onClick={onClose} style={styles.iconBtn}><X size={18} /></button>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>QC Result</label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[['pass', 'Pass ✓', '#3D7A5C'], ['fail', 'Fail ✗', '#B5453A']].map(([v, l, c]) => (
              <button key={v} onClick={() => setResult(v)}
                style={{ flex: 1, padding: 10, borderRadius: 8, border: `2px solid ${result === v ? c : '#DDD8CC'}`, background: result === v ? c + '18' : '#fff', color: result === v ? c : '#888780', fontWeight: 600, cursor: 'pointer' }}>
                {l}
              </button>
            ))}
          </div>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Inspector notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            style={{ ...styles.input, resize: 'vertical' }} placeholder="Observations, defects, remarks" />
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={styles.ghostBtn}>Cancel</button>
          <button onClick={() => onSubmit(order.id, result, notes)}
            style={{ ...styles.primaryBtn, background: result === 'pass' ? '#3D7A5C' : '#B5453A' }}>
            Submit — {result === 'pass' ? 'Mark Completed' : 'Mark Failed'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Parts Master ─────────────────────────────────────────────────────────────


export function PartsMasterList({ parts, setParts, vendors = [], ownerUid, userRole }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const canEdit = userRole === 'admin' || userRole === 'manager';

  function handleSave(form) {
    if (editing) {
      setParts(prev => prev.map(p => p.id === form.id ? form : p));
    } else {
      setParts(prev => [{ ...form, id: crypto.randomUUID(), createdAt: Date.now() }, ...prev]);
    }
    setEditing(null);
    setCreating(false);
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this part?')) return;
    setParts(prev => prev.filter(p => p.id !== id));
  }

  const filtered = parts.filter(p => {
    const q = search.toLowerCase();
    return !q || (p.partNumber + ' ' + p.name + ' ' + p.description).toLowerCase().includes(q);
  });

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="serif" style={styles.h1}>Parts Master</h1>
          <p style={styles.muted}>{parts.length} parts registered</p>
        </div>
        {canEdit && <button onClick={() => { setEditing(null); setCreating(true); }} style={styles.primaryBtn}><Plus size={15} /> New Part</button>}
      </div>

      <div style={{ ...styles.searchWrap, marginBottom: 16, maxWidth: 380 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search parts…" style={styles.searchInput} />
      </div>

      {filtered.length === 0 ? (
        <div style={styles.emptyBox}>No parts found.</div>
      ) : (
        <div style={styles.list}>
          {filtered.map(p => (
            <div key={p.id} style={styles.recordRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.docRowTitle}>{p.partNumber} — {p.name}</div>
                <div style={styles.docRowSub}>{p.description || '—'} · Material: {p.material || '—'}</div>
                {p.avl && p.avl.length > 0 && (
                  <div style={{ fontSize: 11, color: '#888780', marginTop: 3 }}>
                    Approved vendors: {p.avl.map(v => v.vendorName || v).join(', ')}
                  </div>
                )}
              </div>
              {p.drawingUrl && (
                <a href={p.drawingUrl} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#1E7A9A', textDecoration: 'none' }}>📎 Drawing</a>
              )}
              {canEdit && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => { setEditing(p); setCreating(false); }} style={styles.ghostBtn}>Edit</button>
                  <button onClick={() => handleDelete(p.id)} style={{ ...styles.iconBtn, color: '#B5453A' }}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(creating || editing) && (
        <PartForm
          initial={editing}
          vendors={vendors}
          ownerUid={ownerUid}
          onSave={handleSave}
          onClose={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </div>
  );
}


export function PartForm({ initial, vendors, ownerUid, onSave, onClose }) {
  const blank = { partNumber: '', name: '', description: '', material: '', weight: '', finish: '', tolerance: '', qcCriteria: '', avl: [], drawingUrl: '', drawingPath: '', specs: '' };
  const [form, setForm] = useState(initial || blank);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleDrawingUpload(e) {
    const file = e.target.files[0];
    if (!file || !ownerUid) return;
    setUploading(true);
    try {
      const result = await uploadDrawing(ownerUid, 'parts', file);
      set('drawingUrl', result.url);
      set('drawingPath', result.path);
    } finally {
      setUploading(false);
    }
  }

  function addAvl() {
    setForm(f => ({ ...f, avl: [...(f.avl || []), { vendorName: '', partCode: '' }] }));
  }

  function updateAvl(idx, field, val) {
    setForm(f => ({ ...f, avl: f.avl.map((a, i) => i === idx ? { ...a, [field]: val } : a) }));
  }

  function removeAvl(idx) {
    setForm(f => ({ ...f, avl: f.avl.filter((_, i) => i !== idx) }));
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modal, width: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={styles.modalHeader}>
          <span style={{ fontWeight: 600 }}>{initial ? 'Edit Part' : 'New Part'}</span>
          <button onClick={onClose} style={styles.iconBtn}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Part Number *</label>
            <input value={form.partNumber} onChange={e => set('partNumber', e.target.value)} style={styles.input} placeholder="e.g. PN-001" />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} style={styles.input} placeholder="Part name" />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Description</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} style={styles.input} placeholder="Brief description" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Material</label>
            <input value={form.material} onChange={e => set('material', e.target.value)} style={styles.input} placeholder="e.g. SS304" />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Weight (kg)</label>
            <input value={form.weight} onChange={e => set('weight', e.target.value)} style={styles.input} placeholder="0.00" />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Finish</label>
            <input value={form.finish} onChange={e => set('finish', e.target.value)} style={styles.input} placeholder="e.g. Powder coated" />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Tolerance / Specs</label>
          <input value={form.tolerance} onChange={e => set('tolerance', e.target.value)} style={styles.input} placeholder="e.g. ±0.05mm" />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>QC Criteria</label>
          <textarea value={form.qcCriteria} onChange={e => set('qcCriteria', e.target.value)} rows={2}
            style={{ ...styles.input, resize: 'vertical' }} placeholder="Inspection criteria, test parameters..." />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Drawing / Document</label>
          <input type="file" accept=".pdf,.dwg,.dxf,.png,.jpg" onChange={handleDrawingUpload} style={{ fontSize: 13 }} />
          {uploading && <span style={{ fontSize: 12, color: '#888780' }}>Uploading…</span>}
          {form.drawingUrl && <a href={form.drawingUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1E7A9A' }}>📎 View drawing</a>}
        </div>

        <div style={styles.formGroup}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={styles.label}>Approved Vendor List (AVL)</label>
            <button onClick={addAvl} style={{ ...styles.ghostBtn, fontSize: 12, padding: '4px 10px' }}><Plus size={12} /> Add</button>
          </div>
          {(form.avl || []).map((a, idx) => (
            <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 6, alignItems: 'center' }}>
              <input value={a.vendorName} onChange={e => updateAvl(idx, 'vendorName', e.target.value)}
                style={{ ...styles.input, flex: 2 }} placeholder="Vendor name" />
              <input value={a.partCode} onChange={e => updateAvl(idx, 'partCode', e.target.value)}
                style={{ ...styles.input, flex: 1 }} placeholder="Vendor part #" />
              <button onClick={() => removeAvl(idx)} style={styles.iconBtn}><Trash2 size={14} color="#B5453A" /></button>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={styles.ghostBtn}>Cancel</button>
          <button onClick={() => onSave(form)} style={styles.primaryBtn}>Save Part</button>
        </div>
      </div>
    </div>
  );
}

// ─── Engineering Documents ────────────────────────────────────────────────────


export function EngineeringDocsList({ engDocs, setEngDocs, parts = [], ownerUid, userRole }) {
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const canEdit = userRole === 'admin' || userRole === 'manager';

  const DOC_CATS = ['Drawing', 'Specification', 'SOP', 'Test Report', 'Certificate', 'Other'];

  function handleSave(form) {
    if (editing) {
      setEngDocs(prev => prev.map(d => d.id === form.id ? form : d));
    } else {
      setEngDocs(prev => [{ ...form, id: crypto.randomUUID(), createdAt: Date.now() }, ...prev]);
    }
    setEditing(null);
    setCreating(false);
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this document?')) return;
    setEngDocs(prev => prev.filter(d => d.id !== id));
  }

  const filtered = engDocs.filter(d => {
    const q = search.toLowerCase();
    return !q || (d.docNumber + ' ' + d.title + ' ' + d.category).toLowerCase().includes(q);
  });

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="serif" style={styles.h1}>Engineering Documents</h1>
          <p style={styles.muted}>{engDocs.length} documents</p>
        </div>
        {canEdit && <button onClick={() => { setEditing(null); setCreating(true); }} style={styles.primaryBtn}><Plus size={15} /> New Document</button>}
      </div>

      <div style={{ ...styles.searchWrap, marginBottom: 16, maxWidth: 380 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search documents…" style={styles.searchInput} />
      </div>

      {filtered.length === 0 ? (
        <div style={styles.emptyBox}>No engineering documents yet.</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fb', borderBottom: '1px solid #e5e7eb' }}>
                {['Doc No.', 'Title', 'Category', 'Rev', 'Date', 'Linked Part', ''].map(h => (
                  <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#666' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((d, idx) => {
                const part = parts.find(p => p.id === d.partId);
                return (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f0f0f0', background: idx % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: 13 }}>{d.docNumber}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>
                      {d.fileUrl ? <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1E7A9A' }}>{d.title}</a> : d.title}
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13 }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, background: '#EDE8FA', color: '#5B2DA0', fontSize: 12 }}>{d.category}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#555' }}>{d.revision || 'R0'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 13, color: '#555' }}>{d.date || '—'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#888' }}>{part ? part.name : '—'}</td>
                    <td style={{ padding: '10px 14px' }}>
                      {canEdit && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => { setEditing(d); setCreating(false); }} style={{ ...styles.ghostBtn, fontSize: 12, padding: '4px 10px' }}>Edit</button>
                          <button onClick={() => handleDelete(d.id)} style={styles.iconBtn}><Trash2 size={14} color="#B5453A" /></button>
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

      {(creating || editing) && (
        <EngDocForm
          initial={editing}
          parts={parts}
          ownerUid={ownerUid}
          onSave={handleSave}
          onClose={() => { setEditing(null); setCreating(false); }}
          DOC_CATS={DOC_CATS}
        />
      )}
    </div>
  );
}


export function EngDocForm({ initial, parts, ownerUid, onSave, onClose, DOC_CATS }) {
  const blank = { docNumber: '', title: '', category: 'Drawing', revision: 'R0', date: new Date().toISOString().slice(0, 10), partId: '', description: '', fileUrl: '', filePath: '' };
  const [form, setForm] = useState(initial || blank);
  const [uploading, setUploading] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file || !ownerUid) return;
    setUploading(true);
    try {
      const result = await uploadDrawing(ownerUid, 'engdocs', file);
      set('fileUrl', result.url);
      set('filePath', result.path);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div style={styles.modalOverlay}>
      <div style={{ ...styles.modal, width: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={styles.modalHeader}>
          <span style={{ fontWeight: 600 }}>{initial ? 'Edit Document' : 'New Eng. Document'}</span>
          <button onClick={onClose} style={styles.iconBtn}><X size={18} /></button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Document Number *</label>
            <input value={form.docNumber} onChange={e => set('docNumber', e.target.value)} style={styles.input} placeholder="e.g. DRW-001" />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Revision</label>
            <input value={form.revision} onChange={e => set('revision', e.target.value)} style={styles.input} placeholder="R0" />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} style={styles.input} placeholder="Document title" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={styles.formGroup}>
            <label style={styles.label}>Category</label>
            <select value={form.category} onChange={e => set('category', e.target.value)} style={styles.input}>
              {DOC_CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Date</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={styles.input} />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Linked Part (optional)</label>
          <select value={form.partId} onChange={e => set('partId', e.target.value)} style={styles.input}>
            <option value="">— None —</option>
            {parts.map(p => <option key={p.id} value={p.id}>{p.partNumber} — {p.name}</option>)}
          </select>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
            style={{ ...styles.input, resize: 'vertical' }} placeholder="Notes, scope, applicability…" />
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Upload File</label>
          <input type="file" accept=".pdf,.dwg,.dxf,.png,.jpg,.xlsx,.docx" onChange={handleFileUpload} style={{ fontSize: 13 }} />
          {uploading && <span style={{ fontSize: 12, color: '#888780' }}>Uploading…</span>}
          {form.fileUrl && <a href={form.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#1E7A9A' }}>📎 View file</a>}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 }}>
          <button onClick={onClose} style={styles.ghostBtn}>Cancel</button>
          <button onClick={() => onSave(form)} style={styles.primaryBtn}>Save Document</button>
        </div>
      </div>
    </div>
  );
}

// ─── Production ────────────────────────────────────────────────

// ─── Shared: Specs fields ────────────────────────────────────────────────────


export function RawMaterialsList({ rawMaterials, setRawMaterials, userRole, ownerUid, businessInfo }) {
  const [editing, setEditing] = useState(null);
  const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'inventory';
  const fmt = makeFmt(businessInfo);

  function upsert(m) {
    if (m.id) {
      setRawMaterials((r) => r.map((x) => (x.id === m.id ? m : x)));
    } else {
      setRawMaterials((r) => [...r, { ...m, id: crypto.randomUUID() }]);
    }
    setEditing(null);
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h1 className="serif" style={styles.h1}>Raw Materials</h1>
        <p style={styles.muted}>Track your raw material inventory and stock levels.</p>
      </div>
      {canEdit && <button onClick={() => setEditing({ name: '', unit: '', stock: 0, minStock: 0, rate: 0 })} style={styles.primaryBtn}><Plus size={15} /> Add material</button>}
      <div style={{ ...styles.list, marginTop: 16 }}>
        {rawMaterials.length === 0 && <div style={styles.emptyBox}>No raw materials yet. Add materials to use in Bill of Materials.</div>}
        {rawMaterials.map((m) => (
          <div key={m.id} style={styles.recordRow}>
            <div style={{ flex: 1 }}>
              <div style={styles.docRowTitle}>{m.name}</div>
              <div style={styles.docRowSub}>Unit: {m.unit || '—'} · Rate: {fmt(m.rate || 0)} · Min stock: {m.minStock || 0}</div>
            </div>
            <div style={{ textAlign: 'right', minWidth: 80 }}>
              <div className="serif" style={{ fontSize: 18, fontWeight: 700, color: (m.stock <= m.minStock) ? '#B5453A' : '#1E2A4A' }}>{m.stock}</div>
              <div style={{ fontSize: 11, color: '#888780' }}>{m.unit}</div>
            </div>
            {(m.stock <= m.minStock) && <span style={{ ...styles.badge, background: '#FBEAE7', color: '#B5453A' }}>Low stock</span>}
            {canEdit && <button onClick={() => setEditing(m)} style={styles.ghostBtn}>Edit</button>}
            {canEdit && <button onClick={() => setRawMaterials((r) => r.filter((x) => x.id !== m.id))} style={styles.iconBtn}><Trash2 size={15} color="#B5453A" /></button>}
          </div>
        ))}
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? 'Edit material' : 'Add raw material'}>
          <RawMaterialForm initial={editing} onSave={upsert} ownerUid={ownerUid} />
        </Modal>
      )}
    </div>
  );
}


export function RawMaterialForm({ initial, onSave, ownerUid }) {
  const [form, setForm] = useState({ specs: {}, drawings: [], ...initial });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {[['name','Name'],['unit','Unit (kg/litre/pcs)']].map(([f,l]) => (
        <div key={f} style={styles.formGroup}>
          <label style={styles.label}>{l}</label>
          <input value={form[f] || ''} onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))} style={styles.input} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 12 }}>
        {[['stock','Current stock'],['minStock','Min stock'],['rate','Rate/unit (Rs.)']].map(([f,l]) => (
          <div key={f} style={{ ...styles.formGroup, flex: 1 }}>
            <label style={styles.label}>{l}</label>
            <input type="number" value={form[f] || 0} onChange={(e) => setForm((p) => ({ ...p, [f]: Number(e.target.value) }))} style={styles.input} />
          </div>
        ))}
      </div>
      <div style={styles.sectionDivider}>Material Specifications</div>
      <SpecsFields
        specs={form.specs}
        onChange={(s) => setForm((p) => ({ ...p, specs: s }))}
        fields={[
          ['grade', 'Grade / Standard', 'e.g. IS 2062, ASTM A36'],
          ['density', 'Density', 'e.g. 7850 kg/m³'],
          ['hardness', 'Hardness', 'e.g. 150 HRB'],
          ['tensile', 'Tensile Strength', 'e.g. 410 MPa'],
          ['certNo', 'Certificate No.', 'Mill cert / test cert no.'],
          ['supplier', 'Approved Supplier', ''],
        ]}
      />
      <div style={styles.sectionDivider}>Certificates & Drawings</div>
      <DrawingUploader
        files={form.drawings}
        onChange={(d) => setForm((p) => ({ ...p, drawings: d }))}
        ownerUid={ownerUid}
        folder="rawmaterials"
      />
      <button onClick={() => onSave(form)} style={{ ...styles.primaryBtn, marginTop: 18 }}>Save material</button>
    </div>
  );
}

// ─── Bill of Materials ────────────────────────────────────────────────────────


export function BOMList({ boms, setBoms, rawMaterials, userRole, ownerUid, parts }) {
  const [editing, setEditing] = useState(null);
  const canEdit = userRole === 'admin' || userRole === 'manager';

  function upsert(b) {
    if (b.id) {
      setBoms((list) => list.map((x) => (x.id === b.id ? b : x)));
    } else {
      setBoms((list) => [...list, { ...b, id: crypto.randomUUID(), createdAt: Date.now() }]);
    }
    setEditing(null);
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h1 className="serif" style={styles.h1}>Bill of Materials</h1>
        <p style={styles.muted}>Define what raw materials go into each finished product.</p>
      </div>
      {canEdit && <button onClick={() => setEditing({ name: '', outputQty: 1, unit: 'pcs', materials: [] })} style={styles.primaryBtn}><Plus size={15} /> Add BOM</button>}
      <div style={{ ...styles.list, marginTop: 16 }}>
        {boms.length === 0 && <div style={styles.emptyBox}>No BOMs yet. Create a Bill of Materials for each product you manufacture.</div>}
        {boms.map((b) => (
          <div key={b.id} style={{ ...styles.recordRow, flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={styles.docRowTitle}>{b.name}</div>
                <div style={styles.docRowSub}>Output: {b.outputQty} {b.unit} - {b.materials.length} materials</div>
              </div>
              {canEdit && <button onClick={() => setEditing(b)} style={styles.ghostBtn}>Edit</button>}
              {canEdit && <button onClick={() => setBoms((list) => list.filter((x) => x.id !== b.id))} style={styles.iconBtn}><Trash2 size={15} color="#B5453A" /></button>}
            </div>
            {b.materials.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {b.materials.map((m, i) => (
                  <span key={i} style={{ ...styles.badge, background: '#EDE6F9', color: '#5B2DA0' }}>{m.name} - {m.qty} {m.unit}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {editing && (
        <Modal onClose={() => setEditing(null)} title={editing.id ? 'Edit BOM' : 'New Bill of Materials'}>
          <BOMForm initial={editing} rawMaterials={rawMaterials} onSave={upsert} ownerUid={ownerUid} parts={parts} />
        </Modal>
      )}
    </div>
  );
}


export function BOMForm({ initial, rawMaterials, onSave, ownerUid, parts = [] }) {
  const [form, setForm] = useState({ specs: {}, drawings: [], partId: '', ...initial, materials: initial.materials || [] });

  function linkPart(partId) {
    const part = parts.find((p) => p.id === partId);
    if (part) {
      setForm((f) => ({ ...f, partId, specs: { ...part.specs }, drawings: [...(part.drawings || [])] }));
    } else {
      setForm((f) => ({ ...f, partId }));
    }
  }

  function addMaterial() {
    setForm((f) => ({ ...f, materials: [...f.materials, { materialId: '', name: '', unit: '', qty: 1 }] }));
  }
  function updateMaterial(i, field, value) {
    setForm((f) => {
      const mats = [...f.materials];
      mats[i] = { ...mats[i], [field]: value };
      if (field === 'materialId') {
        const rm = rawMaterials.find((r) => r.id === value);
        if (rm) { mats[i].name = rm.name; mats[i].unit = rm.unit; }
      }
      return { ...f, materials: mats };
    });
  }
  function removeMaterial(i) {
    setForm((f) => ({ ...f, materials: f.materials.filter((_, idx) => idx !== i) }));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {parts.length > 0 && (
        <div style={styles.formGroup}>
          <label style={styles.label}>Link from Parts Master (auto-fills specs & drawings)</label>
          <select value={form.partId || ''} onChange={(e) => linkPart(e.target.value)} style={styles.input}>
            <option value="">— Select part (optional) —</option>
            {parts.filter((p) => p.status !== 'obsolete').map((p) => <option key={p.id} value={p.id}>{p.partNo} — {p.name} (Rev {p.rev})</option>)}
          </select>
        </div>
      )}
      <div style={styles.formGroup}>
        <label style={styles.label}>Finished product name</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={styles.input} placeholder="e.g. Steel Rod 10mm" />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ ...styles.formGroup, flex: 1 }}>
          <label style={styles.label}>Output quantity</label>
          <input type="number" value={form.outputQty} onChange={(e) => setForm((f) => ({ ...f, outputQty: Number(e.target.value) }))} style={styles.input} />
        </div>
        <div style={{ ...styles.formGroup, flex: 1 }}>
          <label style={styles.label}>Unit</label>
          <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} style={styles.input} placeholder="pcs / kg / litre" />
        </div>
      </div>
      <div style={{ fontWeight: 600, fontSize: 13, color: '#1E2A4A', marginBottom: 8 }}>Raw materials needed</div>
      {form.materials.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
          <select value={m.materialId} onChange={(e) => updateMaterial(i, 'materialId', e.target.value)} style={{ ...styles.input, flex: 2 }}>
            <option value="">Select material</option>
            {rawMaterials.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <input type="number" value={m.qty} onChange={(e) => updateMaterial(i, 'qty', Number(e.target.value))} style={{ ...styles.input, width: 70 }} placeholder="Qty" />
          <span style={{ fontSize: 12, color: '#888780', minWidth: 30 }}>{m.unit}</span>
          <button onClick={() => removeMaterial(i)} style={styles.iconBtn}><Trash2 size={14} color="#B5453A" /></button>
        </div>
      ))}
      <button onClick={addMaterial} style={{ ...styles.ghostBtn, marginBottom: 16, fontSize: 13 }}><Plus size={14} /> Add material</button>
      <div style={styles.sectionDivider}>Engineering Specifications</div>
      <SpecsFields
        specs={form.specs}
        onChange={(s) => setForm((f) => ({ ...f, specs: s }))}
        fields={[
          ['drawingNo', 'Drawing No.', 'e.g. DRW-001'],
          ['revision', 'Revision', 'e.g. Rev A'],
          ['dimensions', 'Dimensions (L×W×H)', 'e.g. 100×50×25 mm'],
          ['weight', 'Weight', 'e.g. 1.2 kg'],
          ['tolerance', 'Tolerance', 'e.g. ±0.1 mm'],
          ['surfaceFinish', 'Surface Finish', 'e.g. Ra 1.6'],
          ['materialGrade', 'Material Grade', 'e.g. MS, SS304'],
          ['standard', 'Standard', 'e.g. IS 1367'],
        ]}
      />
      <div style={styles.sectionDivider}>Engineering Drawings</div>
      <DrawingUploader
        files={form.drawings}
        onChange={(d) => setForm((f) => ({ ...f, drawings: d }))}
        ownerUid={ownerUid}
        folder="bom"
      />
      <button onClick={() => onSave(form)} style={{ ...styles.primaryBtn, marginTop: 18 }}>Save BOM</button>
    </div>
  );
}

// ─── Production Orders ────────────────────────────────────────────────────────


export const PO_STATUS = {
  draft:       { label: 'Draft',       bg: '#EEEDE6', color: '#5F5E5A' },
  approved:    { label: 'Approved',    bg: '#EAF3DE', color: '#3B6D11' },
  in_progress: { label: 'In Progress', bg: '#E6EEF9', color: '#2255A0' },
  qc_pending:  { label: 'QC Pending',  bg: '#FFF3CD', color: '#856404' },
  completed:   { label: 'Completed',   bg: '#D6F0E0', color: '#1A5C35' },
  failed:      { label: 'QC Failed',   bg: '#FBEAE7', color: '#B5453A' },
};


export function ProductionOrderPrint({ order, bom, businessInfo, onClose }) {
  const useLH = !!(businessInfo?.letterhead||businessInfo?.letterheadHtml);
  const rmLines = bom?.materials || [];
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
        <div style={{textAlign:'center',fontSize:16,fontWeight:700,letterSpacing:1,borderTop:'2px solid #1E2A4A',borderBottom:'2px solid #1E2A4A',padding:'6px 0',marginBottom:16}}>PRODUCTION ORDER</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px 24px',marginBottom:16,padding:'12px 16px',background:'#F8F6F2',borderRadius:8}}>
          <div><strong>Order No:</strong> {order.number}</div>
          <div><strong>Date:</strong> {order.startDate || order.plannedDate || '—'}</div>
          <div><strong>BOM / Product:</strong> {bom?.name || order.bomId}</div>
          <div><strong>Quantity:</strong> {order.quantity} units</div>
          {order.batchNumber && <div><strong>Batch No:</strong> {order.batchNumber}</div>}
          <div><strong>Status:</strong> {(order.status || 'planned').replace(/_/g,' ')}</div>
          {order.dueDate && <div><strong>Due Date:</strong> {order.dueDate}</div>}
        </div>
        {rmLines.length > 0 && (
          <>
            <div style={{fontWeight:700,marginBottom:8,color:'#1E2A4A'}}>Raw Material Requirements</div>
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:16}}>
              <thead>
                <tr style={{background:'#1E2A4A',color:'#fff'}}>
                  {['#','Material','Required Qty','Unit','Remarks'].map(h => (
                    <th key={h} style={{padding:'6px 8px',textAlign:'left',fontSize:11}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rmLines.map((m, i) => (
                  <tr key={i} style={{borderBottom:'1px solid #EEE',background:i%2===0?'#fff':'#F9F8F5'}}>
                    <td style={{padding:'5px 8px'}}>{i+1}</td>
                    <td style={{padding:'5px 8px'}}>{m.name || m.materialId}</td>
                    <td style={{padding:'5px 8px',textAlign:'center'}}>{((m.qty||0)*(order.quantity||1)).toFixed(2)}</td>
                    <td style={{padding:'5px 8px'}}>{m.unit || 'pcs'}</td>
                    <td style={{padding:'5px 8px'}}>{m.remarks || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {order.notes && <div style={{marginBottom:12}}><strong>Notes:</strong> {order.notes}</div>}
        <div style={{display:'flex',justifyContent:'space-between',marginTop:40,paddingTop:16,borderTop:'1px solid #CCC'}}>
          <div style={{textAlign:'center',minWidth:130}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Prepared By</div></div>
          <div style={{textAlign:'center',minWidth:130}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Production Manager</div></div>
          <div style={{textAlign:'center',minWidth:130}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Authorised By</div></div>
        </div>
        {useLH && businessInfo?.letterheadFooter && <img src={businessInfo.letterheadFooter} alt="footer" style={{width:'100%',display:'block',marginTop:16}} />}
      </div>
    </div>
  );
}


export function ProductionOrdersList({ productionOrders, setProductionOrders, boms, rawMaterials, setRawMaterials, userRole, ownerUid, setStockLedger, items = [], businessInfo }) {
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(null);
  const [printOrder, setPrintOrder] = useState(null);
  const canCreate = userRole === 'admin' || userRole === 'manager' || userRole === 'sales' || userRole === 'purchase';
  const canApprove = userRole === 'admin';

  function createOrder(order) {
    setProductionOrders((p) => [{ ...order, id: crypto.randomUUID(), createdAt: Date.now(), approvalStatus: 'draft', approvalNote: '' }, ...p]);
    setCreating(false);
  }

  function saveOrder(order) {
    setProductionOrders(prev => {
      const idx = prev.findIndex(p => p.id === order.id);
      if (idx >= 0) { const a = [...prev]; a[idx] = order; return a; }
      return [{ ...order, id: crypto.randomUUID(), createdAt: Date.now(), approvalStatus: 'draft', approvalNote: '' }, ...prev];
    });
  }

  function deleteOrder(id) {
    if (!window.confirm('Delete this production order?')) return;
    setProductionOrders(prev => prev.filter(p => p.id !== id));
  }

  function updateApproval(id, patch) {
    setProductionOrders(prev => prev.map(p => p.id === id ? {
      ...p,
      approvalStatus: patch.status,
      approvalNote: patch.rejectionNote ?? p.approvalNote,
    } : p));
  }

  function updateStatus(id, status) {
    const now = Date.now();
    const o = productionOrders.find(p => p.id === id);
    if (!o) return;

    const updated = { ...o, status };
    if (status === 'approved')    updated.approvedAt  = now;
    if (status === 'in_progress') updated.startedAt   = now;
    if (status === 'qc_pending')  updated.qcPendingAt = now;
    if (status === 'completed')   updated.completedAt = now;

    if (status === 'in_progress') {
      const bom = boms.find(b => b.id === o.bomId);
      if (bom) {
        const factor = (o.quantity || 1) / (bom.outputQty || 1);
        setRawMaterials(rm => rm.map(r => {
          const needed = bom.materials.find(m => m.materialId === r.id);
          if (!needed) return r;
          return { ...r, stock: Math.max(0, (r.stock || 0) - needed.qty * factor) };
        }));
      }
    }

    if (status === 'completed' && setStockLedger) {
      const bom = boms.find(b => b.id === o.bomId);
      if (bom) {
        const factor = (o.quantity || 1) / (bom.outputQty || 1);
        const date = new Date().toISOString().slice(0, 10);
        const entries = [];
        (bom.materials || []).forEach(m => {
          const rm = rawMaterials.find(r => r.id === m.materialId);
          const itm = items.find(i => i.name === (rm ? rm.name : ''));
          if (!itm) return;
          entries.push({
            id: crypto.randomUUID(), date, itemId: itm.id, itemName: itm.name,
            type: 'out', qty: (parseFloat(m.qty) || 0) * factor, rate: parseFloat(itm.rate) || 0,
            sourceType: 'production', sourceId: o.id, sourceNumber: o.number, createdAt: now,
          });
        });
        const finItem = items.find(i => i.name === bom.outputItem || i.name === bom.name);
        if (finItem) {
          entries.push({
            id: crypto.randomUUID(), date, itemId: finItem.id, itemName: finItem.name,
            type: 'in', qty: o.quantity || 1, rate: parseFloat(finItem.rate) || 0,
            sourceType: 'production', sourceId: o.id, sourceNumber: o.number, createdAt: now,
          });
        }
        if (entries.length) {
          setStockLedger(prev => [...prev.filter(e => e.sourceId !== o.id), ...entries]);
        }
      }
    }

    setProductionOrders(prev => prev.map(p => p.id === id ? updated : p));
  }

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 className="serif" style={styles.h1}>Production Orders</h1>
          <p style={styles.muted}>{productionOrders.length} total orders</p>
        </div>
        {(userRole === 'admin' || userRole === 'manager' || userRole === 'inventory') && (
          <button onClick={() => setCreating(true)} style={styles.primaryBtn}><Plus size={15} /> New Order</button>
        )}
      </div>
      <div style={styles.list}>
        {productionOrders.length === 0 && <div style={styles.emptyBox}>No production orders yet.</div>}
        {productionOrders.map((o) => {
          const bom = boms.find(b => b.id === o.bomId);
          const statusColors = {
            pending: ['#FFF3CD', '#856404'],
            in_progress: ['#E6EEF9', '#2255A0'],
            qc_pending: ['#EDE6F9', '#5B2DA0'],
            completed: ['#D6F0E0', '#1A5C35'],
            failed: ['#FBEAE7', '#B5453A'],
            cancelled: ['#EEEDE6', '#5F5E5A'],
          };
          const [bg, col] = statusColors[o.status] || statusColors.pending;
          return (
            <div key={o.id} style={styles.recordRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{o.number} — {bom?.name || 'Unknown BOM'}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  {o.quantity} units · {o.startDate || ''}{o.batchNumber ? ` · Batch: ${o.batchNumber}` : ''}
                </div>
              </div>
              <span style={{ background: bg, color: col, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{o.status?.replace(/_/g,' ')}</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                <StatusBadge status={o.approvalStatus || 'draft'} />
                <ApprovalActions
                  item={{ status: o.approvalStatus || 'draft', rejectionNote: o.approvalNote || '' }}
                  onUpdate={(patch) => updateApproval(o.id, patch)}
                  userRole={userRole}
                  compact
                />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {(o.status === 'in_progress' || o.status === 'planned') && o.approvalStatus === 'approved' && (
                  <button onClick={() => updateStatus(o.id, 'pending_qa')}
                    style={{ ...styles.ghostBtn, fontSize: 11, background: '#EDE6F9', color: '#5B2DA0', border: 'none' }}>
                    → QA
                  </button>
                )}
                <button onClick={() => setPrintOrder(o)} style={styles.iconBtn} title="Print"><Printer size={14} /></button>
                {o.approvalStatus !== 'submitted' && <button onClick={() => setEditing(o)} style={styles.iconBtn}><Pencil size={14} /></button>}
                {o.approvalStatus !== 'submitted' && <button onClick={() => deleteOrder(o.id)} style={{ ...styles.iconBtn, color: '#B5453A' }}><Trash2 size={14} /></button>}
              </div>
            </div>
          );
        })}
      </div>
      {(creating || editing) && (
        <Modal title={editing ? 'Edit Production Order' : 'New Production Order'} onClose={() => { setCreating(false); setEditing(null); }} wide>
          <ProductionOrderForm order={editing} boms={boms} items={items} onSave={(o) => { saveOrder(o); setCreating(false); setEditing(null); }} onClose={() => { setCreating(false); setEditing(null); }} />
        </Modal>
      )}
      {printOrder && <ProductionOrderPrint order={printOrder} bom={boms.find(b => b.id === printOrder.bomId)} businessInfo={businessInfo} onClose={() => setPrintOrder(null)} />}
    </div>
  );
}


export function genBatchNumber() {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 9000) + 1000);
  return `BN-${mm}-${seq}`;
}


export function ProductionOrderForm({ order, boms, items, onSave, onClose }) {
  const [form, setForm] = useState({
    id: order?.id || '',
    number: order?.number || '',
    batchNumber: order?.batchNumber || genBatchNumber(),
    bomId: order?.bomId || '',
    quantity: order?.quantity || 1,
    startDate: order?.startDate || new Date().toISOString().split('T')[0],
    targetDate: order?.targetDate || '',
    status: order?.status || 'planned',
    notes: order?.notes || '',
  });

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }

  function handleSave() {
    if (!form.bomId) return alert('Please select a BOM');
    if (!form.number) return alert('Please enter an order number');
    onSave({ ...form, quantity: parseFloat(form.quantity) || 1, updatedAt: new Date().toISOString() });
  }

  const selectedBom = boms.find(b => b.id === form.bomId);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div style={styles.formGroup}>
        <label style={styles.label}>Order Number *</label>
        <input value={form.number} onChange={e => set('number', e.target.value)} style={styles.input} placeholder="PO-001" />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Batch Number</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input value={form.batchNumber} onChange={e => set('batchNumber', e.target.value)} style={{ ...styles.input, flex: 1 }} placeholder="BN-MM-XXXX" />
          <button type="button" onClick={() => set('batchNumber', genBatchNumber())} style={{ ...styles.ghostBtn, whiteSpace: 'nowrap', fontSize: 11 }}>New #</button>
        </div>
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>BOM / Product *</label>
        <select value={form.bomId} onChange={e => set('bomId', e.target.value)} style={styles.input}>
          <option value="">— Select BOM —</option>
          {boms.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Quantity</label>
        <input type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} style={styles.input} />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Status</label>
        <select value={form.status} onChange={e => set('status', e.target.value)} style={styles.input}>
          {['planned','in_progress','qc_pending','completed','failed'].map(s => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Start Date</label>
        <input type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} style={styles.input} />
      </div>
      <div style={styles.formGroup}>
        <label style={styles.label}>Target Date</label>
        <input type="date" value={form.targetDate} onChange={e => set('targetDate', e.target.value)} style={styles.input} />
      </div>
      <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}>
        <label style={styles.label}>Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} style={{ ...styles.input, minHeight: 70 }} placeholder="Optional notes..." />
      </div>
      {selectedBom && (
        <div style={{ gridColumn: '1 / -1', background: '#F8F5EE', borderRadius: 8, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#1E2A4A', marginBottom: 6 }}>BOM Components ({selectedBom.components?.length || 0} items)</div>
          {(selectedBom.components || []).map((c, i) => {
            const item = items.find(it => it.id === c.itemId);
            return (
              <div key={i} style={{ fontSize: 12, color: '#555', display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px solid #EAE6DB' }}>
                <span>{item?.name || c.itemId}</span>
                <span style={{ color: '#888' }}>{(c.qty * form.quantity).toFixed(2)} {c.unit || item?.unit || ''}</span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={handleSave}>Save Order</button>
      </div>
    </div>
  );
}

// ─── Enquiry ───────────────────────────────────────────────────


export function ISOPrinciplesView({ qualityDocs, setQualityDocs, userRole }) {
  const [editing, setEditing] = useState(null);
  const canEdit = userRole === 'admin' || userRole === 'manager';
  const items = qualityDocs.isoPrinciples || [];

  function save(form) {
    const { _isNew, ...rest } = form;
    setQualityDocs(prev => ({ ...prev, isoPrinciples: _isNew ? [...(prev.isoPrinciples || []), { ...rest, id: crypto.randomUUID(), createdAt: Date.now() }] : (prev.isoPrinciples || []).map(x => x.id === rest.id ? rest : x) }));
    setEditing(null);
  }

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div><h1 className="serif" style={styles.h1}>ISO Principles</h1><p style={styles.muted}>Document your ISO quality management framework and principles.</p></div>
        {canEdit && <button onClick={() => setEditing({ _isNew: true, title: '', clause: '', description: '', evidence: '' })} style={styles.primaryBtn}><Plus size={15} /> Add Principle</button>}
      </div>
      <div style={styles.list}>
        {items.length === 0 && <div style={styles.emptyBox}>No ISO principles documented yet.</div>}
        {items.map(item => (
          <div key={item.id} style={styles.recordRow}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{item.clause && <span style={{ color: '#C9A24B', marginRight: 8 }}>§{item.clause}</span>}{item.title}</div>
              {item.description && <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{item.description}</div>}
              {item.evidence && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Evidence: {item.evidence}</div>}
            </div>
            {canEdit && <div style={{ display: 'flex', gap: 6 }}><button onClick={() => setEditing(item)} style={styles.iconBtn}><Pencil size={14} /></button><button onClick={() => { if (window.confirm('Delete?')) setQualityDocs(prev => ({ ...prev, isoPrinciples: prev.isoPrinciples.filter(x => x.id !== item.id) })); }} style={{ ...styles.iconBtn, color: '#B5453A' }}><Trash2 size={14} /></button></div>}
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={editing._isNew ? 'Add ISO Principle' : 'Edit ISO Principle'} onClose={() => setEditing(null)}>
          <QualityDocForm item={editing} fields={[{ key: 'clause', label: 'ISO Clause', placeholder: 'e.g. 4.1' }, { key: 'title', label: 'Title *', placeholder: 'Principle name' }, { key: 'description', label: 'Description', multiline: true }, { key: 'evidence', label: 'Evidence / Records' }]} onSave={save} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}


export function DeptProceduresView({ qualityDocs, setQualityDocs, userRole }) {
  const [editing, setEditing] = useState(null);
  const canEdit = userRole === 'admin' || userRole === 'manager';
  const items = qualityDocs.deptProcedures || [];

  function save(form) {
    const { _isNew, ...rest } = form;
    const updated = { ...rest, approvalStatus: _isNew ? 'draft' : rest.approvalStatus };
    setQualityDocs(prev => ({ ...prev, deptProcedures: _isNew ? [...(prev.deptProcedures || []), { ...updated, id: crypto.randomUUID(), createdAt: Date.now() }] : (prev.deptProcedures || []).map(x => x.id === updated.id ? updated : x) }));
    setEditing(null);
  }

  function approve(id) {
    setQualityDocs(prev => ({ ...prev, deptProcedures: prev.deptProcedures.map(x => x.id === id ? { ...x, approvalStatus: 'approved', approvedAt: Date.now() } : x) }));
  }

  const statusBg = { draft: '#EEEDE6', approved: '#D6F0E0', review: '#FFF3CD' };
  const statusCol = { draft: '#5F5E5A', approved: '#1A5C35', review: '#856404' };

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div><h1 className="serif" style={styles.h1}>Dept Procedures</h1><p style={styles.muted}>Department-level procedures. Approved by Management before use.</p></div>
        {canEdit && <button onClick={() => setEditing({ _isNew: true, title: '', department: '', procNumber: '', version: '1.0', description: '', steps: '', approvalStatus: 'draft' })} style={styles.primaryBtn}><Plus size={15} /> New Procedure</button>}
      </div>
      <div style={styles.list}>
        {items.length === 0 && <div style={styles.emptyBox}>No procedures yet. Document your department-level SOPs here.</div>}
        {items.map(item => (
          <div key={item.id} style={styles.recordRow}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{item.procNumber && <span style={{ color: '#6B5BAE', marginRight: 8 }}>{item.procNumber}</span>}{item.title}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{item.department} · v{item.version || '1.0'}</div>
              {item.description && <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{item.description}</div>}
            </div>
            <span style={{ background: statusBg[item.approvalStatus] || '#EEEDE6', color: statusCol[item.approvalStatus] || '#5F5E5A', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>
              {item.approvalStatus || 'draft'}
            </span>
            {userRole === 'admin' && item.approvalStatus !== 'approved' && (
              <button onClick={() => approve(item.id)} style={{ ...styles.ghostBtn, fontSize: 11, background: '#D6F0E0', color: '#1A5C35', border: 'none' }}>Approve</button>
            )}
            {canEdit && <div style={{ display: 'flex', gap: 6 }}><button onClick={() => setEditing(item)} style={styles.iconBtn}><Pencil size={14} /></button><button onClick={() => { if (window.confirm('Delete?')) setQualityDocs(prev => ({ ...prev, deptProcedures: prev.deptProcedures.filter(x => x.id !== item.id) })); }} style={{ ...styles.iconBtn, color: '#B5453A' }}><Trash2 size={14} /></button></div>}
          </div>
        ))}
      </div>
      {editing && (
        <Modal title={editing._isNew ? 'New Procedure' : 'Edit Procedure'} onClose={() => setEditing(null)} wide>
          <QualityDocForm item={editing} fields={[{ key: 'procNumber', label: 'Proc. Number', placeholder: 'e.g. QP-001' }, { key: 'title', label: 'Title *', placeholder: 'Procedure name' }, { key: 'department', label: 'Department', placeholder: 'e.g. Production' }, { key: 'version', label: 'Version', placeholder: '1.0' }, { key: 'description', label: 'Objective', multiline: true }, { key: 'steps', label: 'Procedure Steps', multiline: true, placeholder: 'Step 1: ...\nStep 2: ...' }]} onSave={save} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}


export function InprocessQAView({ qualityDocs, setQualityDocs, productionOrders, userRole }) {
  const [editing, setEditing] = useState(null);
  const canEdit = userRole === 'admin' || userRole === 'manager' || userRole === 'inventory';
  const items = qualityDocs.inprocessQA || [];

  function save(form) {
    const { _isNew, ...rest } = form;
    setQualityDocs(prev => ({ ...prev, inprocessQA: _isNew ? [...(prev.inprocessQA || []), { ...rest, id: crypto.randomUUID(), createdAt: Date.now() }] : (prev.inprocessQA || []).map(x => x.id === rest.id ? rest : x) }));
    setEditing(null);
  }

  const resultColor = { pass: '#1A5C35', fail: '#B5453A', conditional: '#856404' };
  const resultBg = { pass: '#D6F0E0', fail: '#FBEAE7', conditional: '#FFF3CD' };

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div><h1 className="serif" style={styles.h1}>Inprocess QA</h1><p style={styles.muted}>Record quality checks done during production.</p></div>
        {canEdit && <button onClick={() => setEditing({ _isNew: true, date: new Date().toISOString().slice(0,10), productionOrderId: '', checkType: '', findings: '', result: 'pass', checkedBy: '' })} style={styles.primaryBtn}><Plus size={15} /> New QA Record</button>}
      </div>
      <div style={styles.list}>
        {items.length === 0 && <div style={styles.emptyBox}>No inprocess QA records yet.</div>}
        {items.map(item => {
          const po = productionOrders.find(p => p.id === item.productionOrderId);
          return (
            <div key={item.id} style={styles.recordRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{item.checkType || 'QA Check'} · {item.date}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{po ? `${po.number}${po.batchNumber ? ` · Batch: ${po.batchNumber}` : ''}` : 'No order linked'} · By: {item.checkedBy || '—'}</div>
                {item.findings && <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{item.findings}</div>}
              </div>
              <span style={{ background: resultBg[item.result] || '#EEEDE6', color: resultColor[item.result] || '#5F5E5A', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{item.result || 'pass'}</span>
              {canEdit && <div style={{ display: 'flex', gap: 6 }}><button onClick={() => setEditing(item)} style={styles.iconBtn}><Pencil size={14} /></button><button onClick={() => { if (window.confirm('Delete?')) setQualityDocs(prev => ({ ...prev, inprocessQA: prev.inprocessQA.filter(x => x.id !== item.id) })); }} style={{ ...styles.iconBtn, color: '#B5453A' }}><Trash2 size={14} /></button></div>}
            </div>
          );
        })}
      </div>
      {editing && (
        <Modal title={editing._isNew ? 'New Inprocess QA' : 'Edit QA Record'} onClose={() => setEditing(null)} wide>
          <InprocessQAForm item={editing} productionOrders={productionOrders} onSave={save} onClose={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}


export function InprocessQAForm({ item, productionOrders, onSave, onClose }) {
  const [form, setForm] = useState({ ...item });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div style={styles.formGroup}><label style={styles.label}>Date</label><input type="date" value={form.date} onChange={e => set('date', e.target.value)} style={styles.input} /></div>
      <div style={styles.formGroup}><label style={styles.label}>Production Order</label>
        <select value={form.productionOrderId} onChange={e => set('productionOrderId', e.target.value)} style={styles.input}>
          <option value="">— None —</option>
          {productionOrders.map(p => <option key={p.id} value={p.id}>{p.number}{p.batchNumber ? ` (${p.batchNumber})` : ''}</option>)}
        </select>
      </div>
      <div style={styles.formGroup}><label style={styles.label}>Check Type</label><input value={form.checkType} onChange={e => set('checkType', e.target.value)} style={styles.input} placeholder="e.g. Dimensional, Visual, Functional" /></div>
      <div style={styles.formGroup}><label style={styles.label}>Checked By</label><input value={form.checkedBy} onChange={e => set('checkedBy', e.target.value)} style={styles.input} placeholder="Inspector name" /></div>
      <div style={styles.formGroup}><label style={styles.label}>Result</label>
        <select value={form.result} onChange={e => set('result', e.target.value)} style={styles.input}>
          <option value="pass">Pass</option><option value="conditional">Conditional Pass</option><option value="fail">Fail</option>
        </select>
      </div>
      <div style={styles.formGroup}><label style={styles.label}>Reference Standard</label><input value={form.standard || ''} onChange={e => set('standard', e.target.value)} style={styles.input} placeholder="e.g. ISO 9001:2015" /></div>
      <div style={{ ...styles.formGroup, gridColumn: '1 / -1' }}><label style={styles.label}>Findings / Observations</label><textarea value={form.findings} onChange={e => set('findings', e.target.value)} style={{ ...styles.input, minHeight: 70 }} /></div>
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={() => { if (!form.checkType) return alert('Check type required'); onSave(form); }}>Save</button>
      </div>
    </div>
  );
}

// ─── QA Testing + PDV (Production Delivery Voucher) ───────────────────────────

export function QATestingView({ productionOrders, setProductionOrders, pdvs, setPdvs, setStockLedger, boms, items, userRole, businessInfo, capaRecords, setCapaRecords }) {
  const [viewingPdv, setViewingPdv] = useState(null);
  const pending = productionOrders.filter(o => o.status === 'pending_qa');
  const failed  = productionOrders.filter(o => o.status === 'failed');
  const approved = pdvs;
  const canApprove = userRole === 'admin' || userRole === 'manager' || userRole === 'inventory';

  function raiseCapaFromNCR(order) {
    const bom = boms.find(b => b.id === order.bomId);
    const num = `CAR-${String((capaRecords||[]).length + 1).padStart(3,'0')}`;
    const capa = {
      id: crypto.randomUUID(), number: num,
      date: new Date().toISOString().slice(0,10),
      source: 'NCR', sourceRef: order.number,
      description: `QA Rejection — ${bom?.name || order.number}${order.batchNumber ? ` (Batch: ${order.batchNumber})` : ''}. ${order.qaNote || ''}`.trim(),
      rootCause:'', actionPlan:'', responsibility:'', targetDate:'', effectivenessCheck:'', closedDate:'', status:'open',
    };
    if (setCapaRecords) setCapaRecords(prev => [...prev, capa]);
    setProductionOrders(prev => prev.map(o => o.id === order.id ? { ...o, capaRef: num } : o));
    alert(`CAPA raised: ${num}`);
  }

  function handleQADecision(orderId, decision, note = '') {
    const now = Date.now();
    const order = productionOrders.find(o => o.id === orderId);
    if (!order) return;

    if (decision === 'approve') {
      // Generate PDV
      const pdv = {
        id: crypto.randomUUID(),
        pdvNumber: `PDV-${new Date().toISOString().slice(0,7).replace('-','/')}-${String(pdvs.length + 1).padStart(3,'0')}`,
        productionOrderId: orderId,
        orderNumber: order.number,
        batchNumber: order.batchNumber || '',
        bomId: order.bomId,
        quantity: order.quantity,
        date: new Date().toISOString().slice(0,10),
        approvedAt: now,
        approvedBy: userRole,
        status: 'approved',
        note,
      };
      setPdvs(prev => [...prev, pdv]);

      // Auto-update stock ledger (same logic as completed)
      const bom = boms.find(b => b.id === order.bomId);
      if (bom && setStockLedger) {
        const factor = (order.quantity || 1) / (bom.outputQty || 1);
        const date = new Date().toISOString().slice(0,10);
        const entries = [];
        (bom.materials || []).forEach(m => {
          const rm = items.find(i => i.name === (m.name || ''));
          if (!rm) return;
          entries.push({ id: crypto.randomUUID(), date, itemId: rm.id, itemName: rm.name, type: 'out', qty: (parseFloat(m.qty)||0)*factor, sourceType: 'pdv', sourceId: pdv.id, sourceNumber: pdv.pdvNumber, createdAt: now });
        });
        const finItem = items.find(i => i.name === bom.outputItem || i.name === bom.name);
        if (finItem) {
          entries.push({ id: crypto.randomUUID(), date, itemId: finItem.id, itemName: finItem.name, type: 'in', qty: order.quantity || 1, sourceType: 'pdv', sourceId: pdv.id, sourceNumber: pdv.pdvNumber, createdAt: now });
        }
        if (entries.length) setStockLedger(prev => [...prev, ...entries]);
      }

      setProductionOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'completed', completedAt: now, qaApprovedAt: now } : o));
    } else if (decision === 'reject') {
      setProductionOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'failed', qaRejectedAt: now, qaNote: note } : o));
    } else if (decision === 'resend') {
      setProductionOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'in_progress', qaResendAt: now, qaNote: note } : o));
    }
  }

  return (
    <div style={styles.page}>
      <h1 className="serif" style={styles.h1}>QA Testing</h1>
      <p style={{ ...styles.muted, marginBottom: 24 }}>Review production orders forwarded for quality approval. Approved orders generate a PDV and auto-update stock.</p>

      {/* Pending QA */}
      <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2A4A', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
        Pending QA Approval ({pending.length})
      </div>
      <div style={styles.list}>
        {pending.length === 0 && <div style={styles.emptyBox}>No production orders pending QA. Orders forwarded from Production Orders will appear here.</div>}
        {pending.map(o => (
          <QAOrderCard key={o.id} order={o} boms={boms} canApprove={canApprove} onDecision={(d, note) => handleQADecision(o.id, d, note)} />
        ))}
      </div>

      {/* Failed / NCR orders */}
      {failed.length > 0 && (<>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#B5453A', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '32px 0 10px' }}>
          QA Rejected / NCR ({failed.length})
        </div>
        <div style={styles.list}>
          {failed.map(o => {
            const bom = boms.find(b => b.id === o.bomId);
            return (
              <div key={o.id} style={{ ...styles.recordRow, background: '#FFF8F7', border: '1px solid #FBEAE7' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{o.number} — {bom?.name || 'Unknown BOM'}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    {o.quantity} units{o.batchNumber ? ` · Batch: ${o.batchNumber}` : ''} · Rejected: {o.qaNote || '—'}
                  </div>
                  {o.capaRef && <div style={{ fontSize: 11, color: '#1a6b30', marginTop: 3, fontWeight: 600 }}>✓ CAPA: {o.capaRef}</div>}
                </div>
                <span style={{ background: '#FBEAE7', color: '#B5453A', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Failed</span>
                {canApprove && !o.capaRef && (
                  <button onClick={() => raiseCapaFromNCR(o)} style={{ ...styles.ghostBtn, fontSize: 12, color: '#E07A3A', borderColor: '#E07A3A' }}>
                    ⚡ Raise CAPA
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </>)}

      {/* PDVs issued */}
      <div style={{ fontWeight: 700, fontSize: 13, color: '#1E2A4A', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '32px 0 10px' }}>
        Production Delivery Vouchers — PDV ({approved.length})
      </div>
      <div style={styles.list}>
        {approved.length === 0 && <div style={styles.emptyBox}>No PDVs generated yet.</div>}
        {approved.map(pdv => (
          <div key={pdv.id} style={styles.recordRow}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{pdv.pdvNumber}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Order: {pdv.orderNumber}{pdv.batchNumber ? ` · Batch: ${pdv.batchNumber}` : ''} · {pdv.date} · Qty: {pdv.quantity}</div>
            </div>
            <span style={{ background: '#D6F0E0', color: '#1A5C35', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>QA Approved</span>
            <button onClick={() => setViewingPdv(pdv)} style={styles.iconBtn}><Printer size={14} /></button>
          </div>
        ))}
      </div>

      {viewingPdv && <PDVPrintModal pdv={viewingPdv} boms={boms} items={items} businessInfo={businessInfo} onClose={() => setViewingPdv(null)} />}
    </div>
  );
}


export function QAOrderCard({ order, boms, canApprove, onDecision }) {
  const [mode, setMode] = useState(null); // null | 'approve' | 'reject' | 'resend'
  const [note, setNote] = useState('');
  const bom = boms.find(b => b.id === order.bomId);

  function submit() {
    onDecision(mode, note);
    setMode(null); setNote('');
  }

  return (
    <div style={{ ...styles.recordRow, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14 }}>{order.number} — {bom?.name || 'Unknown BOM'}</div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
            {order.quantity} units{order.batchNumber ? ` · Batch: ${order.batchNumber}` : ''} · Start: {order.startDate || '—'}
          </div>
          {order.qaNote && <div style={{ fontSize: 12, color: '#B5453A', marginTop: 3 }}>Previous note: {order.qaNote}</div>}
        </div>
        <span style={{ background: '#EDE6F9', color: '#5B2DA0', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Pending QA</span>
        {canApprove && !mode && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setMode('approve')} style={{ ...styles.ghostBtn, fontSize: 12, background: '#D6F0E0', color: '#1A5C35', border: 'none' }}>Approve</button>
            <button onClick={() => setMode('resend')} style={{ ...styles.ghostBtn, fontSize: 12, background: '#FFF3CD', color: '#856404', border: 'none' }}>Resend</button>
            <button onClick={() => setMode('reject')} style={{ ...styles.ghostBtn, fontSize: 12, background: '#FBEAE7', color: '#B5453A', border: 'none' }}>Reject</button>
          </div>
        )}
      </div>
      {mode && (
        <div style={{ background: '#F8F5EE', borderRadius: 8, padding: 12, display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>
              {mode === 'approve' ? 'Approval note (optional)' : mode === 'resend' ? 'Reason to resend' : 'Rejection reason'}
            </label>
            <input value={note} onChange={e => setNote(e.target.value)} style={{ ...styles.input, margin: 0 }} placeholder={mode === 'approve' ? 'All checks passed...' : 'Describe the issue...'} />
          </div>
          <button onClick={submit} style={{ ...styles.primaryBtn, background: mode === 'approve' ? '#1A5C35' : mode === 'reject' ? '#B5453A' : '#856404' }}>
            {mode === 'approve' ? 'Confirm Approve' : mode === 'resend' ? 'Resend to Production' : 'Confirm Reject'}
          </button>
          <button onClick={() => setMode(null)} style={styles.ghostBtn}>Cancel</button>
        </div>
      )}
    </div>
  );
}


export function PDVPrintModal({ pdv, boms, items, businessInfo, onClose }) {
  const bom = boms.find(b => b.id === pdv.bomId);
  const bi = businessInfo || {};
  return (
    <PrintModal title="Production Delivery Voucher" onClose={onClose}>
      <div style={{ padding: '0 8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 20, color: '#1E2A4A' }}>{bi.name || 'Company Name'}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{bi.address}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1E2A4A' }}>PDV</div>
            <div style={{ fontSize: 13, color: '#666' }}>{pdv.pdvNumber}</div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20, fontSize: 13 }}>
          <tbody>
            {[['Production Order', pdv.orderNumber], ['Batch Number', pdv.batchNumber || '—'], ['Date', pdv.date], ['Quantity', pdv.quantity], ['Status', 'QA Approved']].map(([k,v]) => (
              <tr key={k} style={{ borderBottom: '1px solid #EAE6DB' }}>
                <td style={{ padding: '7px 0', fontWeight: 600, color: '#555', width: '40%' }}>{k}</td>
                <td style={{ padding: '7px 0' }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {bom && (
          <div>
            <div style={{ fontWeight: 700, marginBottom: 8 }}>Output: {bom.outputItem || bom.name}</div>
            <div style={{ fontWeight: 600, fontSize: 12, color: '#888', marginBottom: 6 }}>COMPONENTS CONSUMED</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: '#1E2A4A', color: '#fff' }}><th style={{ padding: '6px 10px', textAlign: 'left' }}>Material</th><th style={{ padding: '6px 10px', textAlign: 'right' }}>Qty</th></tr></thead>
              <tbody>{(bom.materials || []).map((m, i) => <tr key={i} style={{ borderBottom: '1px solid #EAE6DB' }}><td style={{ padding: '6px 10px' }}>{m.name || m.materialId}</td><td style={{ padding: '6px 10px', textAlign: 'right' }}>{(parseFloat(m.qty)||0) * (pdv.quantity||1)} {m.unit}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {pdv.note && <div style={{ marginTop: 16, background: '#F8F5EE', padding: 12, borderRadius: 8, fontSize: 13 }}><strong>QA Note:</strong> {pdv.note}</div>}
        <div style={{ marginTop: 48, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24 }}>
          {['Production', 'QA', 'Store'].map(label => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #333', paddingTop: 8, fontSize: 11, color: '#888' }}>{label} Signature</div>
            </div>
          ))}
        </div>
      </div>
    </PrintModal>
  );
}

// ─── Shared Quality Doc Form ──────────────────────────────────────────────────

export function QualityDocForm({ item, fields, onSave, onClose }) {
  const [form, setForm] = React.useState({ ...item });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  const titleField = fields.find(f => f.key === 'title');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {fields.map(f => (
        <div key={f.key} style={styles.formGroup}>
          <label style={styles.label}>{f.label}</label>
          {f.multiline
            ? <textarea value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} style={{ ...styles.input, minHeight: 90, resize: 'vertical' }} placeholder={f.placeholder || ''} />
            : <input value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} style={styles.input} placeholder={f.placeholder || ''} />
          }
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={() => { if (titleField && !form[titleField.key]) return alert(`${titleField.label} required`); onSave(form); }}>Save</button>
      </div>
    </div>
  );
}

// ─── MEP Suite (Primavera-style Project Control) ──────────────────────────────

// ── MEP Constants ──────────────────────────────────────────────────────────────

export function MISView({ productionOrders, pdvs, capaRecords, internalAudits, vendorEvals, vendors, documents, stockLedger, items, employees, businessInfo }) {
  const now = new Date();
  const thisMonth = now.toISOString().slice(0,7);
  const lastMonth = new Date(now.getFullYear(), now.getMonth()-1, 1).toISOString().slice(0,7);
  const [month, setMonth] = useState(thisMonth);

  // ── helpers ──
  function inMonth(dateStr, m) { return (dateStr||'').startsWith(m); }

  // Production
  const ordersThisMonth = productionOrders.filter(o => inMonth(o.startDate||o.createdAt?.toString()?.slice(0,10), month));
  const completed = ordersThisMonth.filter(o => o.status === 'completed' || o.status === 'failed');
  const failed    = ordersThisMonth.filter(o => o.status === 'failed');
  const pdvsMonth = pdvs.filter(p => inMonth(p.date, month));
  const passRate  = completed.length ? Math.round(((completed.length - failed.length) / completed.length) * 100) : null;

  // CAPA
  const capaOpen   = capaRecords.filter(c => c.status !== 'closed');
  const capaMonth  = capaRecords.filter(c => inMonth(c.date, month));
  const capaBySource = {};
  capaRecords.forEach(c => { capaBySource[c.source] = (capaBySource[c.source]||0)+1; });

  // Audits
  const auditsThisMonth  = internalAudits.filter(a => inMonth(a.scheduledDate, month));
  const allFindings      = internalAudits.flatMap(a => a.findings||[]);
  const openNCs          = allFindings.filter(f => f.type !== 'observation' && !f.capaRaised);

  // Vendor
  const approvedVendors    = vendorEvals.filter(v => v.status === 'approved').length;
  const conditionalVendors = vendorEvals.filter(v => v.status === 'conditional').length;
  const rejectedVendors    = vendorEvals.filter(v => v.status === 'rejected').length;
  const overdueVendors     = vendorEvals.filter(v => v.nextReviewDate && v.nextReviewDate < now.toISOString().slice(0,10)).length;

  // Sales docs
  const invoices = (documents||[]).filter(d => d.type === 'invoice' && inMonth(d.date, month));
  const invoiceTotal = invoices.reduce((s,d) => s + (parseFloat(d.total)||0), 0);

  // Low stock
  const lowStock = items.filter(i => i.minStock && (i.currentStock||0) < parseFloat(i.minStock||0));

  // Month options (last 12)
  const months = Array.from({length:12},(_,i)=>{
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    return d.toISOString().slice(0,7);
  });

  function StatBox({ label, value, sub, color='#1E2A4A', bg='#F8F7F4', warn }) {
    return (
      <div style={{ background: warn ? '#FFF8F7' : bg, border: `1px solid ${warn ? '#FBEAE7' : '#EAE6DB'}`, borderRadius:10, padding:'16px 20px', minWidth:140 }}>
        <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase', letterSpacing:'.05em', marginBottom:6 }}>{label}</div>
        <div style={{ fontSize:28, fontWeight:700, color: warn ? '#B5453A' : color, lineHeight:1 }}>{value}</div>
        {sub && <div style={{ fontSize:11, color:'#888', marginTop:4 }}>{sub}</div>}
      </div>
    );
  }

  function SectionHead({ children }) {
    return <div style={{ fontSize:12, fontWeight:800, color:'#1E2A4A', textTransform:'uppercase', letterSpacing:'.07em', borderBottom:'2px solid #EAE6DB', paddingBottom:6, marginTop:28, marginBottom:14 }}>{children}</div>;
  }

  return (
    <div style={{ padding:'24px 32px', maxWidth:900 }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>Management Review — MIS</h2>
          <div style={{ fontSize:12, color:'#888' }}>{businessInfo?.name || 'Company'} · ISO 9.3 Management Review Input</div>
        </div>
        <select value={month} onChange={e=>setMonth(e.target.value)} style={{ ...styles.input, width:'auto', fontSize:13, padding:'6px 12px' }}>
          {months.map(m=><option key={m} value={m}>{new Date(m+'-01').toLocaleString('default',{month:'long',year:'numeric'})}</option>)}
        </select>
      </div>

      {/* KPI Cards */}
      <SectionHead>Production KPIs</SectionHead>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
        <StatBox label="Orders (month)" value={ordersThisMonth.length} sub="production orders started"/>
        <StatBox label="PDVs Issued" value={pdvsMonth.length} sub="QA approved"/>
        <StatBox label="QA Pass Rate" value={passRate !== null ? `${passRate}%` : '—'} sub={`${failed.length} failed`} warn={passRate !== null && passRate < 90}/>
        <StatBox label="Low Stock Items" value={lowStock.length} warn={lowStock.length > 0} sub="below min stock"/>
      </div>

      {/* CAPA Summary */}
      <SectionHead>CAPA Summary (ISO 10.2)</SectionHead>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:16 }}>
        <StatBox label="Open CAPAs" value={capaOpen.length} warn={capaOpen.length > 0} sub="not yet closed"/>
        <StatBox label="Raised This Month" value={capaMonth.length} sub={month}/>
        <StatBox label="Total CAPAs" value={capaRecords.length}/>
      </div>
      {Object.keys(capaBySource).length > 0 && (
        <div style={{ background:'#F8F7F4', borderRadius:8, padding:14, border:'1px solid #EAE6DB' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#555', marginBottom:8 }}>CAPA by Source</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {Object.entries(capaBySource).map(([src,count])=>(
              <span key={src} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:6, padding:'3px 10px', fontSize:12 }}>
                {src}: <strong>{count}</strong>
              </span>
            ))}
          </div>
        </div>
      )}
      {capaOpen.length > 0 && (
        <div style={{ marginTop:12, background:'#fff', borderRadius:8, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead><tr style={{ background:'#F8F7F4' }}>
              {['CAR No.','Source','Description','Responsibility','Target','Status'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {capaOpen.map(c=>(
                <tr key={c.id} style={{ borderTop:'1px solid #F0ECE5' }}>
                  <td style={{ padding:'8px 12px', fontWeight:600 }}>{c.number}</td>
                  <td style={{ padding:'8px 12px', color:'#555' }}>{c.source}</td>
                  <td style={{ padding:'8px 12px', color:'#333', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.description||'—'}</td>
                  <td style={{ padding:'8px 12px', color:'#555' }}>{c.responsibility||'—'}</td>
                  <td style={{ padding:'8px 12px', color: c.targetDate && c.targetDate < now.toISOString().slice(0,10) ? '#B5453A' : '#555', fontWeight: c.targetDate && c.targetDate < now.toISOString().slice(0,10) ? 700 : 400 }}>{c.targetDate||'—'}</td>
                  <td style={{ padding:'8px 12px' }}>
                    <span style={{ background: c.status==='open'?'#f8d7da':c.status==='in_progress'?'#fff3cd':'#cfe2ff', color: c.status==='open'?'#842029':c.status==='in_progress'?'#856404':'#0a58ca', borderRadius:5, padding:'1px 7px', fontSize:11, fontWeight:700 }}>
                      {c.status.replace('_',' ').replace(/\b\w/g,x=>x.toUpperCase())}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Internal Audit */}
      <SectionHead>Internal Audit (ISO 9.2)</SectionHead>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:16 }}>
        <StatBox label="Total Audits" value={internalAudits.length}/>
        <StatBox label="This Month" value={auditsThisMonth.length} sub={month}/>
        <StatBox label="Open NCs" value={openNCs.length} warn={openNCs.length > 0} sub="no CAPA raised yet"/>
        <StatBox label="Completed" value={internalAudits.filter(a=>a.status==='completed'||a.status==='closed').length}/>
      </div>
      {openNCs.length > 0 && (
        <div style={{ background:'#FFF8F7', border:'1px solid #FBEAE7', borderRadius:8, padding:12 }}>
          <div style={{ fontSize:12, fontWeight:700, color:'#B5453A', marginBottom:6 }}>⚠ Open Non-Conformances without CAPA</div>
          {openNCs.slice(0,5).map(f=>(
            <div key={f.id} style={{ fontSize:12, color:'#555', padding:'4px 0', borderBottom:'1px solid #F0ECE5' }}>
              <strong>{f.type==='major_nc'?'Major NC':'Minor NC'}</strong> — {f.clause}: {f.description}
            </div>
          ))}
          {openNCs.length > 5 && <div style={{ fontSize:11, color:'#888', marginTop:4 }}>+{openNCs.length-5} more</div>}
        </div>
      )}

      {/* Vendor */}
      <SectionHead>Vendor Evaluation Status</SectionHead>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
        <StatBox label="Approved" value={approvedVendors} color='#1a6b30' bg='#d4edda'/>
        <StatBox label="Conditional" value={conditionalVendors} color='#856404' bg='#fff3cd'/>
        <StatBox label="Rejected" value={rejectedVendors} color='#842029' bg='#f8d7da'/>
        <StatBox label="Overdue Review" value={overdueVendors} warn={overdueVendors>0} sub="past next review date"/>
        <StatBox label="Not Evaluated" value={Math.max(0, vendors.length - vendorEvals.length)} sub={`of ${vendors.length} vendors`}/>
      </div>

      {/* Sales snapshot */}
      <SectionHead>Sales Snapshot — {new Date(month+'-01').toLocaleString('default',{month:'long',year:'numeric'})}</SectionHead>
      <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
        <StatBox label="Invoices" value={invoices.length} sub="issued this month"/>
        <StatBox label="Invoice Value" value={invoiceTotal.toLocaleString(undefined,{maximumFractionDigits:0})} sub={businessInfo?.currency||''}/>
      </div>

      {/* Footer note */}
      <div style={{ marginTop:32, padding:'12px 16px', background:'#F8F7F4', borderRadius:8, fontSize:12, color:'#888', border:'1px solid #EAE6DB' }}>
        📋 ISO 9.3 — This review covers: quality objectives, process performance, product conformity, NC/CAPA status, audit results, supplier performance, and resource adequacy.
      </div>
    </div>
  );
}

// ─── Vendor Evaluation ────────────────────────────────────────────────────────

export function VendorEvalView({ vendorEvals, setVendorEvals, vendors, userRole }) {
  const [editing, setEditing] = useState(null);
  const canEdit = ['admin','manager','accounts'].includes(userRole);
  const list = [...vendorEvals].sort((a,b) => (b.date||'') > (a.date||'') ? 1 : -1);

  const CRITERIA = [['quality','Quality of Supply'],['delivery','On-time Delivery'],['pricing','Pricing Competitiveness'],['response','Responsiveness'],['compliance','Documentation/Compliance']];
  const STATUS_COLOR = { approved:'#1a6b30', conditional:'#856404', rejected:'#842029' };
  const STATUS_BG    = { approved:'#d4edda', conditional:'#fff3cd', rejected:'#f8d7da' };

  function blankEval() {
    return { id:'', vendorId:'', date: new Date().toISOString().slice(0,10), ratings:{}, comments:'', evaluator:'', nextReviewDate:'', status:'approved', ncRef:'' };
  }
  function avgRating(ratings) {
    const vals = Object.values(ratings||{}).filter(Number);
    return vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '-';
  }
  function getStatus(avg) {
    if (!avg || avg==='-') return 'conditional';
    if (avg >= 4) return 'approved';
    if (avg >= 2.5) return 'conditional';
    return 'rejected';
  }
  function save(ev) {
    const status = getStatus(parseFloat(avgRating(ev.ratings)));
    const rec = { ...ev, status, approvalStatus:ev.approvalStatus||'draft', approvalNote:ev.approvalNote||'', updatedAt: Date.now(), id: ev.id || crypto.randomUUID() };
    setVendorEvals(prev => prev.find(x=>x.id===rec.id) ? prev.map(x=>x.id===rec.id?rec:x) : [...prev, rec]);
    setEditing(null);
  }
  function updateApproval(id, patch) {
    setVendorEvals(prev=>prev.map(x=>x.id===id?{...x,approvalStatus:patch.status,approvalNote:patch.rejectionNote||''}:x));
  }

  if (editing) {
    const ev = editing;
    const avg = avgRating(ev.ratings);
    const autoStatus = getStatus(parseFloat(avg));
    return (
      <div style={{ maxWidth:620, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{ev.id ? 'Edit' : 'New'} Vendor Evaluation</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Vendor</label>
              <select value={ev.vendorId} onChange={e=>setEditing(p=>({...p,vendorId:e.target.value}))} style={styles.input}>
                <option value=''>Select vendor</option>
                {vendors.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Evaluation Date</label><input type='date' value={ev.date} onChange={e=>setEditing(p=>({...p,date:e.target.value}))} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Evaluator Name</label><input value={ev.evaluator} onChange={e=>setEditing(p=>({...p,evaluator:e.target.value}))} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Next Review Date</label><input type='date' value={ev.nextReviewDate||''} onChange={e=>setEditing(p=>({...p,nextReviewDate:e.target.value}))} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Linked NCR / Complaint Ref.</label><input value={ev.ncRef||''} onChange={e=>setEditing(p=>({...p,ncRef:e.target.value}))} placeholder='e.g. NCR-001' style={styles.input}/></div>
          </div>
          <div style={{ background:'#F8F7F4', borderRadius:8, padding:16, marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:12, textTransform:'uppercase', letterSpacing:'.05em' }}>Rating Criteria (1 = Poor · 5 = Excellent)</div>
            {CRITERIA.map(([k,label])=>(
              <div key={k} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 60px', gap:12, alignItems:'center', marginBottom:10 }}>
                <label style={{ fontSize:13, color:'#444' }}>{label}</label>
                <input type='range' min={1} max={5} value={ev.ratings[k]||3} onChange={e=>setEditing(p=>({...p,ratings:{...p.ratings,[k]:+e.target.value}}))} style={{ accentColor:'#1E2A4A' }}/>
                <span style={{ fontSize:13, fontWeight:700, color:'#1E2A4A', textAlign:'right' }}>{ev.ratings[k]||3}/5</span>
              </div>
            ))}
            <div style={{ textAlign:'right', fontSize:13, fontWeight:700, color:'#1E2A4A', borderTop:'1px solid #EAE6DB', paddingTop:8, marginTop:4 }}>
              Overall Average: <span style={{ fontSize:16 }}>{avg}</span>/5 →{' '}
              <span style={{ background: STATUS_BG[autoStatus], color: STATUS_COLOR[autoStatus], borderRadius:6, padding:'2px 10px', fontSize:12, fontWeight:700 }}>{autoStatus.toUpperCase()}</span>
            </div>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Comments / Recommendations</label><textarea value={ev.comments||''} onChange={e=>setEditing(p=>({...p,comments:e.target.value}))} style={{ ...styles.input, height:72 }}/></div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>save(ev)} style={styles.primaryBtn}>Save Evaluation</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 className="serif" style={styles.pageTitle}>Vendor Evaluation</h2>
        {canEdit && <button onClick={()=>setEditing(blankEval())} style={styles.primaryBtn}><Plus size={15}/> New Evaluation</button>}
      </div>
      {list.length === 0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#888780' }}>No evaluations yet. Rate your vendors to track performance.</div>
      ) : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4', borderBottom:'1px solid #EAE6DB' }}>
              {['Vendor','Date','Avg Score','Status','Next Review','Evaluator',''].map(h=><th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888780', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(ev=>{
                const vendor = vendors.find(v=>v.id===ev.vendorId);
                const avg = avgRating(ev.ratings);
                return (
                  <tr key={ev.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:'#1E2A4A' }}>{vendor?.name || '—'}</td>
                    <td style={{ padding:'10px 14px', color:'#555' }}>{ev.date}</td>
                    <td style={{ padding:'10px 14px', fontWeight:700, color:'#1E2A4A', fontSize:15 }}>{avg}/5</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ background:STATUS_BG[ev.status], color:STATUS_COLOR[ev.status], borderRadius:6, padding:'2px 10px', fontSize:11, fontWeight:700 }}>{(ev.status||'').toUpperCase()}</span></td>
                    <td style={{ padding:'10px 14px', color:'#555' }}>{ev.nextReviewDate||'—'}</td>
                    <td style={{ padding:'10px 14px', color:'#555' }}>{ev.evaluator||'—'}</td>
                    <td style={{ padding:'10px 14px' }}>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', justifyContent:'flex-end' }}>
                        <StatusBadge status={ev.approvalStatus||'draft'} />
                        <ApprovalActions item={{ status:ev.approvalStatus||'draft', rejectionNote:ev.approvalNote||'' }} onUpdate={(patch)=>updateApproval(ev.id,patch)} userRole={userRole} compact />
                        {canEdit && ev.approvalStatus!=='submitted' && <><button onClick={()=>setEditing(ev)} style={styles.iconBtn}><Pencil size={14}/></button>
                        <button onClick={()=>{if(window.confirm('Delete?'))setVendorEvals(prev=>prev.filter(x=>x.id!==ev.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button></>}
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

// ─── CAPA (Corrective & Preventive Action) ────────────────────────────────────

export function CAPAView({ capaRecords, setCapaRecords, vendors, customers, userRole }) {
  const [editing, setEditing] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const canEdit = ['admin','manager'].includes(userRole);

  const SOURCES = ['NCR','Customer Complaint','Internal Audit','Supplier Issue','Process Deviation','Other'];
  const STATUSES = ['open','in_progress','pending_verification','closed'];
  const STATUS_LABEL = { open:'Open', in_progress:'In Progress', pending_verification:'Pending Verification', closed:'Closed' };
  const STATUS_COLOR = { open:'#842029', in_progress:'#856404', pending_verification:'#0a58ca', closed:'#1a6b30' };
  const STATUS_BG    = { open:'#f8d7da', in_progress:'#fff3cd', pending_verification:'#cfe2ff', closed:'#d4edda' };

  function blankCAPA() {
    const num = `CAR-${String(capaRecords.length+1).padStart(3,'0')}`;
    return { id:'', number:num, date: new Date().toISOString().slice(0,10), source:'NCR', sourceRef:'', description:'', rootCause:'', actionPlan:'', responsibility:'', targetDate:'', effectivenessCheck:'', closedDate:'', status:'open' };
  }
  function save(rec) {
    const data = { ...rec, id: rec.id||crypto.randomUUID(), approvalStatus:rec.approvalStatus||'draft', approvalNote:rec.approvalNote||'', updatedAt: Date.now() };
    setCapaRecords(prev => prev.find(x=>x.id===data.id) ? prev.map(x=>x.id===data.id?data:x) : [...prev, data]);
    setEditing(null);
  }
  function updateApproval(id, patch) {
    setCapaRecords(prev=>prev.map(x=>x.id===id?{...x,approvalStatus:patch.status,approvalNote:patch.rejectionNote||''}:x));
  }

  const list = capaRecords.filter(r => filterStatus==='all' || r.status===filterStatus).sort((a,b)=>b.date>a.date?1:-1);

  if (editing) {
    const r = editing;
    const set = (k,v) => setEditing(p=>({...p,[k]:v}));
    return (
      <div style={{ maxWidth:680, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{r.id ? 'Edit CAPA' : 'New CAPA'} — {r.number}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:14 }}>
          {/* Header row */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>CAR No.</label><input value={r.number} onChange={e=>set('number',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Date Raised</label><input type='date' value={r.date} onChange={e=>set('date',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Status</label>
              <select value={r.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
                {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Source</label>
              <select value={r.source} onChange={e=>set('source',e.target.value)} style={styles.input}>
                {SOURCES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Source Reference (NCR No. / Complaint No.)</label><input value={r.sourceRef||''} onChange={e=>set('sourceRef',e.target.value)} placeholder='e.g. NCR-007' style={styles.input}/></div>
          </div>
          {/* ISO 10.2 fields */}
          <div style={styles.formGroup}><label style={styles.label}>Problem Description / Non-Conformance</label><textarea value={r.description||''} onChange={e=>set('description',e.target.value)} style={{ ...styles.input, height:72 }} placeholder='Describe the issue clearly...'/></div>
          <div style={styles.formGroup}><label style={styles.label}>Root Cause Analysis (5-Why / Fishbone)</label><textarea value={r.rootCause||''} onChange={e=>set('rootCause',e.target.value)} style={{ ...styles.input, height:80 }} placeholder='Why did this happen?'/></div>
          <div style={styles.formGroup}><label style={styles.label}>Corrective / Preventive Action Plan</label><textarea value={r.actionPlan||''} onChange={e=>set('actionPlan',e.target.value)} style={{ ...styles.input, height:80 }} placeholder='What actions will be taken?'/></div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Responsibility</label><input value={r.responsibility||''} onChange={e=>set('responsibility',e.target.value)} placeholder='Name / Dept' style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Target Completion Date</label><input type='date' value={r.targetDate||''} onChange={e=>set('targetDate',e.target.value)} style={styles.input}/></div>
          </div>
          <div style={{ background:'#F0F8F0', borderRadius:8, padding:14, border:'1px solid #c3e6cb' }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#1a6b30', marginBottom:8 }}>✅ Effectiveness Verification (ISO 10.2.3)</div>
            <div style={styles.formGroup}><label style={styles.label}>Effectiveness Check Notes</label><textarea value={r.effectivenessCheck||''} onChange={e=>set('effectivenessCheck',e.target.value)} style={{ ...styles.input, height:60 }} placeholder='Did the action actually fix the problem?'/></div>
            <div style={styles.formGroup}><label style={styles.label}>Date Closed</label><input type='date' value={r.closedDate||''} onChange={e=>set('closedDate',e.target.value)} style={styles.input}/></div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>save(r)} style={styles.primaryBtn}>Save CAPA</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 className="serif" style={styles.pageTitle}>CAPA — Corrective & Preventive Actions <span style={{ fontSize:11, color:'#888', fontWeight:400 }}>ISO 10.2</span></h2>
        {canEdit && <button onClick={()=>setEditing(blankCAPA())} style={styles.primaryBtn}><Plus size={15}/> New CAPA</button>}
      </div>
      {/* Status filter */}
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {['all',...STATUSES].map(s=>(
          <button key={s} onClick={()=>setFilterStatus(s)} style={{ ...styles.ghostBtn, background: filterStatus===s ? '#1E2A4A' : 'transparent', color: filterStatus===s ? '#fff' : '#555', fontSize:12 }}>
            {s==='all' ? 'All' : STATUS_LABEL[s]}
          </button>
        ))}
      </div>
      {list.length===0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#888780' }}>No CAPA records. Raise one from QA Testing NCRs or create manually.</div>
      ) : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4', borderBottom:'1px solid #EAE6DB' }}>
              {['CAR No.','Date','Source','Ref.','Description','Responsibility','Target','Status',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888780', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(r=>(
                <tr key={r.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                  <td style={{ padding:'10px 12px', fontWeight:600, color:'#1E2A4A' }}>{r.number}</td>
                  <td style={{ padding:'10px 12px', color:'#555' }}>{r.date}</td>
                  <td style={{ padding:'10px 12px', color:'#555' }}>{r.source}</td>
                  <td style={{ padding:'10px 12px', color:'#888', fontSize:11 }}>{r.sourceRef||'—'}</td>
                  <td style={{ padding:'10px 12px', color:'#333', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.description||'—'}</td>
                  <td style={{ padding:'10px 12px', color:'#555' }}>{r.responsibility||'—'}</td>
                  <td style={{ padding:'10px 12px', color:'#555' }}>{r.targetDate||'—'}</td>
                  <td style={{ padding:'10px 12px' }}><span style={{ background:STATUS_BG[r.status], color:STATUS_COLOR[r.status], borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{STATUS_LABEL[r.status]}</span></td>
                  <td style={{ padding:'10px 12px' }}>
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', justifyContent:'flex-end' }}>
                      <StatusBadge status={r.approvalStatus||'draft'} />
                      <ApprovalActions item={{ status:r.approvalStatus||'draft', rejectionNote:r.approvalNote||'' }} onUpdate={(patch)=>updateApproval(r.id,patch)} userRole={userRole} compact />
                      {canEdit && r.approvalStatus!=='submitted' && <><button onClick={()=>setEditing(r)} style={styles.iconBtn}><Pencil size={14}/></button>
                      <button onClick={()=>{if(window.confirm('Delete?'))setCapaRecords(prev=>prev.filter(x=>x.id!==r.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button></>}
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

// ─── Internal Audit ───────────────────────────────────────────────────────────

export function InternalAuditView({ internalAudits, setInternalAudits, capaRecords, setCapaRecords, userRole }) {
  const [editing, setEditing] = useState(null);
  const [viewFindings, setViewFindings] = useState(null);
  const canEdit = ['admin','manager'].includes(userRole);

  const CLAUSES = ['4.1 Context','4.2 Interested Parties','5.1 Leadership','6.1 Risk & Opportunity','7.1 Resources','7.2 Competence','7.5 Documentation','8.1 Planning','8.4 External Providers','8.5 Production Control','8.6 Release','8.7 NC Output','9.1 Monitoring','9.2 Internal Audit','9.3 MRM','10.2 CAPA'];

  function blankAudit() {
    const num = `IA-${new Date().getFullYear()}-${String(internalAudits.length+1).padStart(2,'0')}`;
    return { id:'', number:num, scheduledDate:'', conductedDate:'', auditor:'', auditee:'', scope:'', clauses:[], findings:[], status:'scheduled', summary:'' };
  }
  function blankFinding() {
    return { id: crypto.randomUUID(), clause:'', type:'observation', description:'', requirement:'', evidence:'', capaRaised:false };
  }
  function save(audit) {
    const data = { ...audit, id: audit.id||crypto.randomUUID(), approvalStatus:audit.approvalStatus||'draft', approvalNote:audit.approvalNote||'', updatedAt: Date.now() };
    setInternalAudits(prev => prev.find(x=>x.id===data.id) ? prev.map(x=>x.id===data.id?data:x) : [...prev, data]);
    setEditing(null);
  }
  function updateApproval(id, patch) {
    setInternalAudits(prev=>prev.map(x=>x.id===id?{...x,approvalStatus:patch.status,approvalNote:patch.rejectionNote||''}:x));
  }
  function raiseCAPAFromFinding(audit, finding) {
    const num = `CAR-${String(capaRecords.length+1).padStart(3,'0')}`;
    const capa = { id: crypto.randomUUID(), number: num, date: new Date().toISOString().slice(0,10), source:'Internal Audit', sourceRef: audit.number, description: finding.description, rootCause:'', actionPlan:'', responsibility:'', targetDate:'', effectivenessCheck:'', closedDate:'', status:'open' };
    setCapaRecords(prev=>[...prev, capa]);
    setInternalAudits(prev=>prev.map(a=>a.id===audit.id ? { ...a, findings: a.findings.map(f=>f.id===finding.id ? { ...f, capaRaised:true, capaRef:num } : f) } : a));
  }

  if (viewFindings) {
    const audit = internalAudits.find(a=>a.id===viewFindings);
    if (!audit) { setViewFindings(null); return null; }
    return (
      <div style={{ maxWidth:720, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={()=>setViewFindings(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>Audit Findings — {audit.number}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:16, padding:12, background:'#F8F7F4', borderRadius:8 }}>
            <div><div style={{ fontSize:11, color:'#888' }}>Auditor</div><div style={{ fontWeight:600 }}>{audit.auditor||'—'}</div></div>
            <div><div style={{ fontSize:11, color:'#888' }}>Auditee / Dept</div><div style={{ fontWeight:600 }}>{audit.auditee||'—'}</div></div>
            <div><div style={{ fontSize:11, color:'#888' }}>Conducted</div><div style={{ fontWeight:600 }}>{audit.conductedDate||'—'}</div></div>
          </div>
          {(audit.findings||[]).length===0 ? <div style={{ color:'#888', textAlign:'center', padding:24 }}>No findings recorded.</div> : (
            audit.findings.map((f,i)=>(
              <div key={f.id} style={{ background: f.type==='major_nc'?'#fff5f5':f.type==='minor_nc'?'#fffbf0':'#f5fff8', border:`1px solid ${f.type==='major_nc'?'#fcc':f.type==='minor_nc'?'#fde68a':'#bbf7d0'}`, borderRadius:8, padding:14, marginBottom:10 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ fontSize:11, fontWeight:700, color: f.type==='major_nc'?'#842029':f.type==='minor_nc'?'#856404':'#1a6b30', textTransform:'uppercase' }}>{f.type==='major_nc'?'Major NC':f.type==='minor_nc'?'Minor NC':'Observation'} — {f.clause}</div>
                  {canEdit && !f.capaRaised && (f.type==='major_nc'||f.type==='minor_nc') && (
                    <button onClick={()=>raiseCAPAFromFinding(audit,f)} style={{ ...styles.ghostBtn, fontSize:11, color:'#E07A3A', borderColor:'#E07A3A' }}>⚡ Raise CAPA</button>
                  )}
                  {f.capaRaised && <span style={{ fontSize:11, color:'#1a6b30', fontWeight:600 }}>✓ CAPA: {f.capaRef}</span>}
                </div>
                <div style={{ fontSize:13, marginTop:6, color:'#333' }}>{f.description}</div>
                {f.requirement && <div style={{ fontSize:11, color:'#888', marginTop:4 }}>Requirement: {f.requirement}</div>}
              </div>
            ))
          )}
          {canEdit && (
            <button onClick={()=>{
              const f = blankFinding();
              setInternalAudits(prev=>prev.map(a=>a.id===audit.id?{...a,findings:[...(a.findings||[]),f]}:a));
            }} style={{ ...styles.ghostBtn, marginTop:8 }}><Plus size={13}/> Add Finding</button>
          )}
        </div>
      </div>
    );
  }

  if (editing) {
    const a = editing;
    const set = (k,v) => setEditing(p=>({...p,[k]:v}));
    return (
      <div style={{ maxWidth:660, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{a.id?'Edit':'New'} Internal Audit — {a.number}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Audit No.</label><input value={a.number} onChange={e=>set('number',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Scheduled Date</label><input type='date' value={a.scheduledDate||''} onChange={e=>set('scheduledDate',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Conducted Date</label><input type='date' value={a.conductedDate||''} onChange={e=>set('conductedDate',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Lead Auditor</label><input value={a.auditor||''} onChange={e=>set('auditor',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Auditee / Department</label><input value={a.auditee||''} onChange={e=>set('auditee',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Status</label>
              <select value={a.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
                {['scheduled','in_progress','completed','closed'].map(s=><option key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </div>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Audit Scope</label><textarea value={a.scope||''} onChange={e=>set('scope',e.target.value)} style={{ ...styles.input, height:60 }} placeholder='Describe what areas / processes are being audited'/></div>
          <div style={styles.formGroup}>
            <label style={styles.label}>ISO Clauses Covered</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:4 }}>
              {CLAUSES.map(c=>(
                <button key={c} onClick={()=>set('clauses', a.clauses.includes(c)?a.clauses.filter(x=>x!==c):[...a.clauses,c])}
                  style={{ fontSize:11, padding:'3px 8px', borderRadius:6, border:'1px solid', cursor:'pointer', background: a.clauses.includes(c)?'#1E2A4A':'transparent', color: a.clauses.includes(c)?'#fff':'#555', borderColor: a.clauses.includes(c)?'#1E2A4A':'#ccc' }}>{c}</button>
              ))}
            </div>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Summary / Conclusion</label><textarea value={a.summary||''} onChange={e=>set('summary',e.target.value)} style={{ ...styles.input, height:60 }}/></div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>save(a)} style={styles.primaryBtn}>Save Audit</button>
          </div>
        </div>
      </div>
    );
  }

  const list = [...internalAudits].sort((a,b)=>b.scheduledDate>a.scheduledDate?1:-1);
  const STATUS_COLOR = { scheduled:'#0a58ca', in_progress:'#856404', completed:'#1a6b30', closed:'#555' };
  const STATUS_BG    = { scheduled:'#cfe2ff', in_progress:'#fff3cd', completed:'#d4edda', closed:'#f0ece5' };
  return (
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 className="serif" style={styles.pageTitle}>Internal Audit <span style={{ fontSize:11, color:'#888', fontWeight:400 }}>ISO 9.2</span></h2>
        {canEdit && <button onClick={()=>setEditing(blankAudit())} style={styles.primaryBtn}><Plus size={15}/> Schedule Audit</button>}
      </div>
      {list.length===0 ? (
        <div style={{ textAlign:'center', padding:60, color:'#888780' }}>No audits scheduled yet.</div>
      ) : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4', borderBottom:'1px solid #EAE6DB' }}>
              {['Audit No.','Scheduled','Auditor','Auditee','Clauses','Findings','Status',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888780', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(a=>{
                const ncCount = (a.findings||[]).filter(f=>f.type!=='observation').length;
                return (
                  <tr key={a.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600, color:'#1E2A4A' }}>{a.number}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{a.scheduledDate||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{a.auditor||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{a.auditee||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#888', fontSize:11 }}>{(a.clauses||[]).length} clauses</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ fontSize:12 }}>{(a.findings||[]).length} findings</span>
                      {ncCount>0 && <span style={{ marginLeft:6, background:'#f8d7da', color:'#842029', borderRadius:5, padding:'1px 6px', fontSize:11, fontWeight:700 }}>{ncCount} NC</span>}
                    </td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:STATUS_BG[a.status], color:STATUS_COLOR[a.status], borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{(a.status||'').replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', justifyContent:'flex-end' }}>
                        <StatusBadge status={a.approvalStatus||'draft'} />
                        <ApprovalActions item={{ status:a.approvalStatus||'draft', rejectionNote:a.approvalNote||'' }} onUpdate={(patch)=>updateApproval(a.id,patch)} userRole={userRole} compact />
                        <button onClick={()=>setViewFindings(a.id)} style={{ ...styles.ghostBtn, fontSize:11 }}>Findings</button>
                        {canEdit && a.approvalStatus!=='submitted' && <button onClick={()=>setEditing(a)} style={styles.iconBtn}><Pencil size={14}/></button>}
                        {canEdit && a.approvalStatus!=='submitted' && <button onClick={()=>{if(window.confirm('Delete?'))setInternalAudits(prev=>prev.filter(x=>x.id!==a.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button>}
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

