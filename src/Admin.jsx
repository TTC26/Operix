import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertTriangle, BarChart2, Bell, BookOpen, Briefcase, CheckCircle, CheckSquare, ChevronDown, ChevronRight, ClipboardList, Clock, Cloud, CloudOff, Download, Factory, FileMinus, FileSignature, FileText, LayoutDashboard, Layers, LogOut, MapPin, Package, Paperclip, Pencil, Plus, Printer, Search, Settings, Shield, ShoppingCart, Square, Trash2, Truck, Users, Wrench, X } from 'lucide-react';
import { auth, watchAuth, signUp, signIn, logOut, loadCompanyData, saveCompanyData, subscribeCompanyData, resendVerificationEmail, refreshUser, getMembership, createStaffAccount, getStaffList, removeStaff, updateStaffRole, uploadDrawing, deleteDrawing, resetPassword, reauthenticateUser, deleteAllCompanyFirestore, deleteCompanyStorage, deleteFirebaseUser, lookupStaffEmail } from './firebase';
import { ROLE_MODULES, TEST_EMAILS, PLAN_MODULES, DOC_TYPES, CONVERT_TO, EMPTY_ITEM_ROW, blankDoc, COUNTRY_CONFIG, numToWords, currency, makeFmt, computeTotals, calcModuleTax, computeStock, downloadCSV, filterByRange, loadScript, parseOCRText, styles, TaxSummaryBox, DocPrintOverlay, Modal, LetterpadPrintStyle, sanitizeLHtml, LetterheadHeader, VoucherPrintHeader, VoucherSignatory, ApprovalActions, StatusBadge, DocRow, StatCard, BIZ_BADGE, DocumentsList, ConvertDropdown, PrintModal, DateRangePicker, SpecsFields, DrawingUploader, LockedModuleScreen, TemplateMiniPreview, sendNotificationEmail } from './utils.jsx';

export function NotificationsView({ notifications = [], setNotifications, documents, openDoc, userRole }) {
  const visible = notifications.filter(n => n.forRole === 'all' || n.forRole === userRole);

  function markRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  }
  function markAllRead() {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }
  function deleteNotif(id) {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }

  const typeIcon = { approval_request: '⏳', approved: '✅', rejected: '❌' };
  const typeBg   = { approval_request: '#EEF2FF', approved: '#F0FDF4', rejected: '#FEF2F2' };
  const typeColor= { approval_request: '#3D52A0', approved: '#059669', rejected: '#B5453A' };

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>🔔 Notifications</h2>
          <div style={{ fontSize: 13, color: '#888780' }}>{visible.filter(n=>!n.read).length} unread</div>
        </div>
        {visible.some(n=>!n.read) && (
          <button onClick={markAllRead} style={styles.ghostBtn}>✓ Mark all read</button>
        )}
      </div>

      {visible.length === 0 ? (
        <div style={{ ...styles.emptyBox, marginTop: 48 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🔔</div>
          <div style={{ fontWeight: 600, color: '#1E2A4A', marginBottom: 4 }}>No notifications yet</div>
          <div style={{ fontSize: 13, color: '#888' }}>Approval requests and document updates will appear here.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 700 }}>
          {visible.map(n => {
            const doc = documents.find(d => d.id === n.docId);
            return (
              <div key={n.id} style={{
                background: n.read ? '#fff' : (typeBg[n.type] || '#F8F5EE'),
                border: `1px solid ${n.read ? '#EAE6DB' : (typeColor[n.type] || '#C9A24B')}`,
                borderLeft: `4px solid ${typeColor[n.type] || '#C9A24B'}`,
                borderRadius: 10, padding: '14px 16px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
                opacity: n.read ? 0.75 : 1,
              }}>
                <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{typeIcon[n.type] || '🔔'}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#1E2A4A', marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 6 }}>{n.message}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{new Date(n.createdAt).toLocaleString('en-IN')}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {doc && openDoc && (
                    <button onClick={() => { markRead(n.id); openDoc(doc); }}
                      style={{ ...styles.ghostBtn, fontSize: 12, padding: '4px 10px' }}>Open</button>
                  )}
                  {!n.read && (
                    <button onClick={() => markRead(n.id)}
                      style={{ ...styles.ghostBtn, fontSize: 12, padding: '4px 10px' }}>Read</button>
                  )}
                  <button onClick={() => deleteNotif(n.id)}
                    style={{ ...styles.iconBtn, color: '#B5453A' }}><X size={14}/></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Scan Bill Modal ───────────────────────────────────────────────────────────


export function ScanBillModal({ onApply, onClose }) {
  const [imgFile, setImgFile] = React.useState(null);
  const [imgUrl, setImgUrl] = React.useState(null);
  const [scanning, setScanning] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [extracted, setExtracted] = React.useState(null);
  const [showRaw, setShowRaw] = React.useState(false);

  function handleFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setImgFile(f);
    setImgUrl(URL.createObjectURL(f));
    setExtracted(null);
  }

  async function handleScan() {
    if (!imgFile) return;
    setScanning(true); setProgress(0);
    try {
      await loadScript('https://unpkg.com/tesseract.js@5/dist/tesseract.min.js');
      const worker = await window.Tesseract.createWorker('eng', 1, {
        logger: m => { if (m.status === 'recognizing text') setProgress(Math.round((m.progress || 0) * 100)); }
      });
      const { data: { text } } = await worker.recognize(imgFile);
      await worker.terminate();
      setExtracted(parseOCRText(text));
    } catch(e) { alert('Scan failed: ' + (e.message || e)); }
    setScanning(false);
  }

  return (
    <Modal title="📷 Scan Bill / Invoice" onClose={onClose} wide>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Left: upload */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <label style={{ display: 'block', border: '2px dashed #C9A24B', borderRadius: 10, padding: imgUrl ? 4 : 28, textAlign: 'center', cursor: 'pointer', background: '#FDFAF4', marginBottom: 10 }}>
            <input type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />
            {imgUrl
              ? <img src={imgUrl} alt="bill" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, display: 'block', margin: '0 auto' }} />
              : <div style={{ color: '#888780', fontSize: 13, lineHeight: 1.7 }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                  Click to take photo or upload bill<br />
                  <span style={{ fontSize: 11 }}>Camera / Gallery — JPG, PNG</span>
                </div>
            }
          </label>
          {imgUrl && !scanning && (
            <button onClick={handleScan} style={{ ...styles.primaryBtn, width: '100%' }}>
              🔍 {extracted ? 'Scan Again' : 'Extract Data from Bill'}
            </button>
          )}
          {scanning && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Reading bill... {progress}%</div>
              <div style={{ background: '#EAE6DB', borderRadius: 4, height: 6 }}>
                <div style={{ background: '#C9A24B', height: 6, borderRadius: 4, width: `${progress}%`, transition: 'width 0.2s' }} />
              </div>
            </div>
          )}
        </div>

        {/* Right: extracted fields */}
        {extracted && (
          <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
            <div style={{ fontWeight: 700, color: '#1E2A4A', marginBottom: 10 }}>Extracted Data — Edit if needed</div>
            {[
              ['Vendor / Party Name', 'vendorName', 'text'],
              ['Date (YYYY-MM-DD)', 'date', 'date'],
              ['Total Amount', 'total', 'number'],
              ['Tax Amount', 'tax', 'number'],
            ].map(([label, key, type]) => (
              <div key={key} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 2 }}>{label}</div>
                <input type={type} value={extracted[key] || ''} onChange={e => setExtracted(p => ({...p, [key]: e.target.value}))}
                  style={{ width: '100%', border: '1px solid #DDD', borderRadius: 6, padding: '5px 8px', fontSize: 13, boxSizing: 'border-box' }} />
              </div>
            ))}
            {extracted.items?.length > 0 && (
              <div style={{ marginTop: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Detected Lines ({extracted.items.length})</div>
                <div style={{ maxHeight: 120, overflowY: 'auto', fontSize: 11, background: '#F8F5EE', borderRadius: 6, padding: '4px 8px' }}>
                  {extracted.items.map((it, i) => (
                    <div key={i} style={{ padding: '2px 0', borderBottom: '1px solid #EAE6DB' }}>{it.name} · qty {it.qty} · ₹{it.rate}</div>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => onApply(extracted)} style={styles.primaryBtn}>Apply to Document ✓</button>
              <button onClick={() => setShowRaw(v=>!v)} style={styles.ghostBtn}>Raw</button>
            </div>
            {showRaw && <pre style={{ marginTop: 8, fontSize: 10, background: '#F5F3EE', padding: 8, borderRadius: 6, maxHeight: 140, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{extracted.rawText}</pre>}
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Activity Select Screen (shown after sign-in if no business type chosen) ───


export function ActivitySelectScreen({ setBusinessInfo, isSubscribed, isTestAccount, user, onLogout }) {
  const canMulti = isSubscribed || isTestAccount;
  const [selected, setSelected] = React.useState([]);
  const [companyName, setCompanyName] = React.useState('');
  const [country, setCountry] = React.useState('india');
  const [error, setError] = React.useState('');

  const BIZ_TYPES = [
    {
      id: 'trading',
      icon: '🛒',
      label: 'Trading',
      sub: 'Distribution & Sales',
      desc: 'Quotations · Invoices · Purchase Orders · Stock Management · Delivery Notes',
      color: '#1A7A3E',
    },
    {
      id: 'manufacturing',
      icon: '🏭',
      label: 'Manufacturing',
      sub: 'Production & Quality',
      desc: 'BOM · Raw Materials · Production Orders · QA Testing · Internal Audit',
      color: '#C9752A',
    },
    {
      id: 'service',
      icon: '🔧',
      label: 'MEP / Service',
      sub: 'Projects & Site Works',
      desc: 'Site Projects · Tendering · RA Billing · Subcontractors · HSE · Handover',
      color: '#1E7A9A',
    },
    {
      id: 'fmamc',
      icon: '🏢',
      label: 'FM / AMC',
      sub: 'Facility & Maintenance',
      desc: 'Asset Register · PM Schedules · Work Orders · AMC Contracts · Spare Parts',
      color: '#0E9DB5',
    },
  ];

  function toggle(id) {
    if (canMulti) {
      setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setSelected([id]);
    }
    setError('');
  }

  function handleStart() {
    if (!selected.length) { setError('Please select at least one activity to continue.'); return; }
    if (!companyName.trim()) { setError('Please enter your company name.'); return; }
    const cc = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.other;
    setBusinessInfo(p => ({
      ...p,
      name: companyName.trim(),
      country,
      taxRate: (p && p.taxRate != null) ? p.taxRate : cc.defaultTaxRate,
      activeTypes: selected,
      companyType: selected[0],
      trialStartDate: (p && p.trialStartDate) ? p.trialStartDate : new Date().toISOString(),
    }));
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1E2A4A 0%, #2D3E6A 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px', fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 880 }}>
        {/* Signed-in indicator */}
        {user && (
          <div style={{ textAlign:'right', marginBottom:16 }}>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.45)' }}>Signed in as {user.email}</span>
            <button onClick={onLogout} style={{ marginLeft:10, fontSize:12, color:'rgba(255,255,255,0.55)', background:'none', border:'1px solid rgba(255,255,255,0.2)', borderRadius:5, padding:'2px 10px', cursor:'pointer' }}>Sign out</button>
          </div>
        )}

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 13, background: '#C9A24B',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 24, color: '#1E2A4A',
            }}>O</div>
            <div style={{ fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 24, color: '#fff', letterSpacing: '-0.3px' }}>Operix</div>
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 28, fontWeight: 700, color: '#fff', marginBottom: 10, lineHeight: 1.2 }}>
            What does your business do?
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 480, margin: '0 auto' }}>
            {canMulti
              ? 'Select all activities that apply — each gets its own dedicated workspace and modules.'
              : 'Choose your primary business activity. This sets up your modules and workflow.'}
          </div>
        </div>

        {/* 2×2 Activity Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 24 }}>
          {BIZ_TYPES.map(t => {
            const on = selected.includes(t.id);
            return (
              <div
                key={t.id}
                onClick={() => toggle(t.id)}
                style={{
                  background: on ? '#fff' : 'rgba(255,255,255,0.07)',
                  border: on ? `2.5px solid ${t.color}` : '2px solid rgba(255,255,255,0.13)',
                  borderRadius: 18, padding: '24px 26px',
                  cursor: 'pointer', position: 'relative',
                  transition: 'background 0.15s, border 0.15s',
                  boxShadow: on ? `0 4px 24px ${t.color}33` : 'none',
                }}
              >
                {on && (
                  <div style={{
                    position: 'absolute', top: 14, right: 14,
                    width: 24, height: 24, borderRadius: '50%',
                    background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 900, color: '#fff',
                  }}>✓</div>
                )}
                <div style={{ fontSize: 34, marginBottom: 12, lineHeight: 1 }}>{t.icon}</div>
                <div style={{
                  fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 700,
                  color: on ? '#1E2A4A' : '#fff', marginBottom: 3,
                }}>{t.label}</div>
                <div style={{
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.03em',
                  color: on ? t.color : 'rgba(255,255,255,0.45)', marginBottom: 10,
                  textTransform: 'uppercase',
                }}>{t.sub}</div>
                <div style={{
                  fontSize: 12.5, lineHeight: 1.65,
                  color: on ? '#555' : 'rgba(255,255,255,0.4)',
                }}>{t.desc}</div>
              </div>
            );
          })}
        </div>

        {/* Company name + country row */}
        <div style={{
          background: 'rgba(255,255,255,0.07)', borderRadius: 14,
          padding: '20px 24px', marginBottom: 18,
          display: 'flex', gap: 16, flexWrap: 'wrap',
        }}>
          <div style={{ flex: '2 1 200px' }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 7,
            }}>Company Name</label>
            <input
              value={companyName}
              onChange={e => { setCompanyName(e.target.value); setError(''); }}
              placeholder="Your company name"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 9,
                border: '1.5px solid rgba(255,255,255,0.18)',
                background: 'rgba(255,255,255,0.1)', color: '#fff',
                fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ flex: '1 1 150px' }}>
            <label style={{
              display: 'block', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: 7,
            }}>Country</label>
            <select
              value={country}
              onChange={e => setCountry(e.target.value)}
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 9,
                border: '1.5px solid rgba(255,255,255,0.18)',
                background: '#1E2A4A', color: '#fff', fontSize: 14, outline: 'none',
              }}
            >
              {Object.entries(COUNTRY_CONFIG).map(([id, cfg]) => (
                <option key={id} value={id}>{cfg.flag} {cfg.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div style={{ color: '#FCA5A5', fontSize: 13, textAlign: 'center', marginBottom: 10 }}>
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleStart}
          style={{
            width: '100%', padding: '15px', borderRadius: 12,
            background: selected.length && companyName.trim() ? '#C9A24B' : 'rgba(255,255,255,0.12)',
            color: selected.length && companyName.trim() ? '#1E2A4A' : 'rgba(255,255,255,0.35)',
            border: 'none', fontSize: 16, fontWeight: 700,
            cursor: selected.length && companyName.trim() ? 'pointer' : 'default',
            fontFamily: "'Inter', sans-serif", letterSpacing: '0.01em',
          }}
        >
          {selected.length && companyName.trim()
            ? `Enter Operix →`
            : selected.length ? 'Enter your company name to continue' : 'Select an activity to continue'}
        </button>

        {canMulti && selected.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
            You can run multiple business activities in parallel — each with its own data and modules.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Activity Home Screen (shown every login to pick active workspace) ─────────


export function ActivityHomeScreen({ activeTypes, businessInfo, onEnter, user, onLogout }) {
  const BIZ_META = {
    trading:       { icon: '🛒', label: 'Trading',       sub: 'Distribution & Sales',    color: '#1A7A3E', desc: 'Invoices · Stock · Customers · Channel Partners' },
    manufacturing: { icon: '🏭', label: 'Manufacturing', sub: 'Production & Quality',     color: '#C9752A', desc: 'BOM · Production Orders · QA · MIS' },
    service:       { icon: '🔧', label: 'MEP / Service', sub: 'Projects & Site Works',    color: '#1E7A9A', desc: 'Site Projects · RA Billing · HSE · Handover' },
    fmamc:         { icon: '🏢', label: 'FM / AMC',      sub: 'Facility & Maintenance',   color: '#0E9DB5', desc: 'Asset Register · Work Orders · AMC Contracts' },
  };

  const types = (activeTypes || []).filter(t => BIZ_META[t]);
  const single = types.length === 1;

  // Firestore data not loaded yet (mobile timing) — show a loading/retry state
  if (!types.length) {
    return (
      <div style={{ minHeight:'100vh', background:'linear-gradient(140deg,#1E2A4A 0%,#243358 60%,#1a2540 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, fontFamily:"'Inter',-apple-system,sans-serif", padding:'0 24px', textAlign:'center' }}>
        <div style={{ fontFamily:'Georgia,serif', fontWeight:700, fontSize:22, color:'#fff', marginBottom:8 }}>Operix</div>
        <div style={{ fontSize:14, color:'rgba(255,255,255,0.55)' }}>Loading your workspace…</div>
        <div style={{ width:32, height:32, border:'3px solid rgba(255,255,255,0.15)', borderTop:'3px solid #C9A24B', borderRadius:'50%', animation:'spin 0.9s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        {user && (
          <button onClick={onLogout} style={{ marginTop:24, fontSize:12, color:'rgba(255,255,255,0.4)', background:'none', border:'1px solid rgba(255,255,255,0.15)', borderRadius:6, padding:'4px 14px', cursor:'pointer' }}>Sign out</button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(140deg, #1E2A4A 0%, #243358 60%, #1a2540 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', fontFamily: "'Inter', -apple-system, sans-serif",
      position: 'relative',
    }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: '#C9A24B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia,serif', fontWeight: 700, fontSize: 22, color: '#1E2A4A' }}>O</div>
          <div style={{ fontFamily: 'Georgia,serif', fontWeight: 700, fontSize: 22, color: '#fff' }}>Operix</div>
        </div>
        {businessInfo?.name && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 10 }}>{businessInfo.name}</div>
        )}
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
          {single ? 'Welcome back' : 'Which workspace today?'}
        </div>
        {!single && (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
            Choose a business activity to enter its workspace.
          </div>
        )}
      </div>

      {/* Signed-in indicator */}
      {user && (
        <div style={{ position:'absolute', top:20, right:24 }}>
          <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>{user.email}</span>
          <button onClick={onLogout} style={{ marginLeft:8, fontSize:11, color:'rgba(255,255,255,0.5)', background:'none', border:'1px solid rgba(255,255,255,0.2)', borderRadius:5, padding:'2px 8px', cursor:'pointer' }}>Sign out</button>
        </div>
      )}

      {/* Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: single ? '1fr' : types.length === 2 ? 'repeat(2,1fr)' : 'repeat(2,1fr)',
        gap: 16,
        width: '100%',
        maxWidth: single ? 420 : 760,
      }}>
        {types.map(t => {
          const m = BIZ_META[t];
          return (
            <div
              key={t}
              onClick={() => onEnter(t)}
              style={{
                background: 'rgba(255,255,255,0.07)',
                border: '2px solid rgba(255,255,255,0.13)',
                borderRadius: 20,
                padding: single ? '32px 36px' : '24px 26px',
                cursor: 'pointer',
                transition: 'background 0.15s, border 0.15s, transform 0.12s',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.13)';
                e.currentTarget.style.border = `2px solid ${m.color}`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                e.currentTarget.style.border = '2px solid rgba(255,255,255,0.13)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {/* Glow accent */}
              <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: m.color, opacity: 0.08, pointerEvents: 'none' }} />

              <div style={{ fontSize: single ? 44 : 34, marginBottom: 14, lineHeight: 1 }}>{m.icon}</div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: single ? 22 : 18, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{m.label}</div>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: m.color, marginBottom: 10 }}>{m.sub}</div>
              <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.42)', lineHeight: 1.6 }}>{m.desc}</div>

              <div style={{ marginTop: 20, display: 'inline-flex', alignItems: 'center', gap: 6, background: m.color + '22', border: `1px solid ${m.color}55`, borderRadius: 8, padding: '7px 16px' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: m.color }}>Enter workspace →</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


// ─── Trial Banner ─────────────────────────────────────────────────────────────


export function TrialBanner({ daysLeft, onUpgrade }) {
  const urgent = daysLeft <= 3;
  const bg    = urgent ? '#FEF3C7' : '#EFF6FF';
  const color = urgent ? '#92400E' : '#1E40AF';
  const border= urgent ? '#FCD34D' : '#BFDBFE';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 20px', background: bg, borderBottom: `1px solid ${border}`,
      fontSize: 13, color, flexShrink: 0,
    }}>
      <span>
        {urgent ? '⚠️' : '⏳'}{' '}
        <strong>{daysLeft === 0 ? 'Last day' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`}</strong>
        {' '}in your free trial
      </span>
      <button onClick={onUpgrade} style={{
        background: urgent ? '#D97706' : '#2563EB', color: '#fff',
        border: 'none', borderRadius: 6, padding: '4px 14px',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
      }}>
        Upgrade now
      </button>
    </div>
  );
}

// ─── Paywall Screen ───────────────────────────────────────────────────────────


export function PaywallScreen({ businessInfo, onLogout, isStaff }) {
  const [showContact, setShowContact] = React.useState(false);

  const panelStyle = {
    width: '100%', maxWidth: 480, background: '#FAF8F4', borderRadius: 20,
    padding: '44px 48px', boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
    fontFamily: "'Inter', sans-serif", textAlign: 'center',
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #1E2A4A 0%, #2D3E6A 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={panelStyle}>
        {/* Logo */}
        <div style={{ width: 52, height: 52, borderRadius: 14, background: '#C9A24B', color: '#1E2A4A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontFamily: 'Georgia, serif', fontSize: 26, margin: '0 auto 20px' }}>O</div>

        {isStaff ? (
          <>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#1E2A4A', marginBottom: 10 }}>Subscription required</div>
            <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 28 }}>
              Your company's free trial has ended.<br />Please ask <strong>{businessInfo?.name || 'your admin'}</strong>'s owner to subscribe to continue.
            </div>
          </>
        ) : (
          <>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 700, color: '#1E2A4A', marginBottom: 10 }}>Your free trial has ended</div>
            <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 28 }}>
              Subscribe to keep your data and continue using Operix.
            </div>

            {/* Plan card */}
            <div style={{ background: '#1E2A4A', borderRadius: 14, padding: '24px 28px', marginBottom: 24, textAlign: 'left' }}>
              <div style={{ color: '#C9A24B', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10 }}>Operix Pro</div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 16 }}>
                <span style={{ color: '#fff', fontSize: 38, fontWeight: 700, fontFamily: 'Georgia, serif' }}>₹999</span>
                <span style={{ color: '#9BABB8', fontSize: 13, marginBottom: 8 }}>/month</span>
              </div>
              {[
                'All modules — Trading, Manufacturing, Services',
                'Unlimited documents & storage',
                'Staff accounts & role management',
                'Letterpad printing & contracts',
                'Priority support',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#E2E8F0', fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: '#C9A24B', fontWeight: 700 }}>✓</span> {f}
                </div>
              ))}
            </div>

            {/* Subscribe button — wire Razorpay here later */}
            <button
              onClick={() => setShowContact(true)}
              style={{ width: '100%', padding: '14px', background: '#C9A24B', color: '#1E2A4A', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}
            >
              Subscribe — ₹999/month
            </button>

            {showContact && (
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px 16px', marginBottom: 12, fontSize: 13, color: '#1E40AF', textAlign: 'left' }}>
                📩 Payment gateway coming soon! To activate your subscription now, contact us at{' '}
                <strong>support@operix.in</strong> with your business name and we'll activate manually.
              </div>
            )}
          </>
        )}

        <button onClick={onLogout} style={{ fontSize: 13, color: '#999', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Auth ──────────────────────────────────────────────────────



export function AuthScreen() {
  const [mode, setMode] = useState('signup'); // signup | login | forgot
  // login has two steps: 'email' (enter email + check company) → 'password'
  const [loginStep, setLoginStep]     = useState('email');
  const [staffCompany, setStaffCompany] = useState(null); // { companyName } if staff email
  const [companyName, setCompanyName] = useState('');
  const [email, setEmail]             = useState('');
  const [password, setPassword]       = useState('');
  const [error, setError]             = useState('');
  const [busy, setBusy]               = useState(false);
  const [resetSent, setResetSent]     = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);

  // Step 1 of login: look up email, then advance to password step.
  // The Firestore lookup is best-effort with a 2s cap — if it hangs or fails
  // (e.g. unauthenticated Firestore rules), we still advance immediately.
  async function handleEmailContinue(e) {
    e.preventDefault();
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    setBusy(true);
    setError('');
    try {
      const lookup = await Promise.race([
        lookupStaffEmail(email.trim()),
        new Promise(resolve => setTimeout(() => resolve(null), 2000)),
      ]);
      setStaffCompany(lookup);
    } catch (_) {
      setStaffCompany(null);
    } finally {
      setBusy(false);
      setLoginStep('password');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (mode === 'forgot') {
      if (!email.trim()) { setError('Please enter your email address.'); return; }
      setBusy(true);
      try {
        await resetPassword(email.trim());
        setResetSent(true);
      } catch (err) {
        const msg = (err && err.code) || '';
        if (msg.includes('user-not-found') || msg.includes('invalid-email')) setError('No account found with that email.');
        else setError('Could not send reset email. Please try again.');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (!email.trim() || !password.trim() || (mode === 'signup' && !companyName.trim())) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'signup') {
        await signUp(email.trim(), password, companyName.trim());
      } else {
        await signIn(email.trim(), password, keepLoggedIn);
      }
    } catch (err) {
      const msg = (err && err.code) || '';
      if (msg.includes('email-already-in-use')) setError('An account with this email already exists. Try logging in.');
      else if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential')) setError('Incorrect email or password.');
      else if (msg.includes('invalid-email')) setError('Please enter a valid email address.');
      else setError('Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function switchMode(m) { setMode(m); setError(''); setResetSent(false); setLoginStep('email'); setStaffCompany(null); }

  return (
    <div style={styles.loginScreen}>
      <style>{`
        * { box-sizing: border-box; font-family: 'Inter', -apple-system, sans-serif; }
        .serif { font-family: 'Lora', Georgia, serif; }
        button { cursor: pointer; font-family: inherit; }
        input { font-family: inherit; }
      `}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" />
      <div style={styles.loginCard}>
        <div style={styles.brandMark}>O</div>
        <div className="serif" style={styles.loginTitle}>Operix</div>
        <div style={styles.muted}>A complete business management platform.</div>

        {mode !== 'forgot' && (
          <div style={styles.loginTabs}>
            <button onClick={() => switchMode('signup')} style={{ ...styles.loginTab, ...(mode === 'signup' ? styles.loginTabActive : {}) }}>Create company account</button>
            <button onClick={() => switchMode('login')} style={{ ...styles.loginTab, ...(mode === 'login' ? styles.loginTabActive : {}) }}>Log in</button>
          </div>
        )}

        {mode === 'forgot' ? (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Reset your password</div>
            <div style={{ ...styles.muted, marginBottom: 14 }}>Enter your email and we'll send a reset link.</div>
            {resetSent ? (
              <div style={{ background: '#e6f4ea', border: '1px solid #b7dfbf', borderRadius: 8, padding: '12px 14px', color: '#2d6a3f', fontSize: 14, marginBottom: 12 }}>
                ✅ Reset link sent! Check your email inbox (and spam folder).
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ textAlign: 'left' }}>
                  <label style={styles.label}>Email</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" style={styles.input} />
                </div>
                {error && <div style={styles.authError}>{error}</div>}
                <button type="submit" disabled={busy} style={{ ...styles.primaryBtn, width: '100%', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
                  {busy ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            )}
            <button onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', color: '#1E2A4A', fontSize: 13, marginTop: 12, padding: 0, textDecoration: 'underline' }}>
              ← Back to log in
            </button>
          </div>
        ) : mode === 'login' && loginStep === 'email' ? (
          /* ── Login step 1: enter email ── */
          <form onSubmit={handleEmailContinue} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ textAlign: 'left' }}>
              <label style={styles.label}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" style={styles.input} autoFocus />
            </div>
            {error && <div style={styles.authError}>{error}</div>}
            <button type="submit" disabled={busy} style={{ ...styles.primaryBtn, width: '100%', justifyContent: 'center', marginTop: 6, opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Checking…' : 'Continue →'}
            </button>
          </form>
        ) : mode === 'login' && loginStep === 'password' ? (
          /* ── Login step 2: show company name (if staff) + enter password ── */
          <form onSubmit={handleSubmit} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {staffCompany?.companyName && (
              <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: '#1E2A4A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {staffCompany.companyName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 11, color: '#6366F1', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Signing in to</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1E2A4A' }}>{staffCompany.companyName}</div>
                </div>
              </div>
            )}
            <div style={{ textAlign: 'left' }}>
              <label style={styles.label}>Email</label>
              <div style={{ ...styles.input, background: '#F5F5F5', color: '#666', display: 'flex', alignItems: 'center' }}>{email}</div>
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={styles.label}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" style={styles.input} autoFocus />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: -4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, color: '#555', cursor: 'pointer', userSelect: 'none' }}>
                <input type="checkbox" checked={keepLoggedIn} onChange={(e) => setKeepLoggedIn(e.target.checked)} style={{ accentColor: '#1E2A4A', width: 15, height: 15 }} />
                Keep me logged in
              </label>
              <button type="button" onClick={() => switchMode('forgot')} style={{ background: 'none', border: 'none', color: '#1E2A4A', fontSize: 12, padding: 0, textDecoration: 'underline', cursor: 'pointer' }}>
                Forgot password?
              </button>
            </div>
            {error && <div style={styles.authError}>{error}</div>}
            <button type="submit" disabled={busy} style={{ ...styles.primaryBtn, width: '100%', justifyContent: 'center', marginTop: 6, opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Signing in…' : 'Log in'}
            </button>
            <button type="button" onClick={() => { setLoginStep('email'); setStaffCompany(null); setError(''); }} style={{ background: 'none', border: 'none', color: '#888', fontSize: 13, padding: 0, cursor: 'pointer' }}>
              ← Use a different email
            </button>
          </form>
        ) : (
          /* ── Sign up ── */
          <form onSubmit={handleSubmit} style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ textAlign: 'left' }}>
              <label style={styles.label}>Company name</label>
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Enter your company name" style={styles.input} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={styles.label}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" style={styles.input} />
            </div>
            <div style={{ textAlign: 'left' }}>
              <label style={styles.label}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" style={styles.input} />
            </div>
            {error && <div style={styles.authError}>{error}</div>}
            <button type="submit" disabled={busy} style={{ ...styles.primaryBtn, width: '100%', justifyContent: 'center', marginTop: 6, opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Please wait…' : 'Create account'}
            </button>
          </form>
        )}
        <div style={{ ...styles.muted, fontSize: 12, marginTop: 14 }}>
          Each company gets its own private, isolated workspace. Log in with the same email on any device to sync.
        </div>
      </div>
    </div>
  );
}



export function VerifyEmailScreen({ user, onLogout }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dots, setDots] = useState('');

  // Auto-check every 4 seconds — page reloads automatically once verified
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await refreshUser(user);
        if (user.emailVerified) window.location.reload();
      } catch (_) {}
    }, 4000);
    return () => clearInterval(interval);
  }, [user]);

  // Animated dots to show it's checking
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 600);
    return () => clearInterval(t);
  }, []);

  async function handleResend() {
    setBusy(true);
    setError('');
    try {
      await resendVerificationEmail(user);
      setSent(true);
    } catch (e) {
      setError('Could not send email. Please wait a minute and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.loginScreen}>
      <style>{`
        * { box-sizing: border-box; font-family: 'Inter', -apple-system, sans-serif; }
        .serif { font-family: 'Lora', Georgia, serif; }
        button { cursor: pointer; font-family: inherit; }
      `}</style>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Lora:wght@500;600;700&family=Inter:wght@400;500;600&display=swap" />
      <div style={styles.loginCard}>
        <div style={styles.brandMark}>O</div>
        <div className="serif" style={styles.loginTitle}>Verify your email</div>
        <div style={styles.muted}>
          We've sent a verification link to <strong>{user.email}</strong>. Open your inbox, click the link — this page will open automatically.
        </div>
        <div style={{ marginTop: 20, fontSize: 13, color: '#888780', textAlign: 'center' }}>
          Waiting for verification{dots}
        </div>
        {sent && <div style={{ ...styles.muted, fontSize: 12.5, marginTop: 10, color: '#3D7A5C' }}>Email sent! Check your inbox and spam folder.</div>}
        {error && <div style={{ ...styles.authError, marginTop: 10 }}>{error}</div>}
        <button onClick={handleResend} disabled={busy} style={{ ...styles.ghostBtn, width: '100%', justifyContent: 'center', marginTop: 20, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Sending…' : 'Resend verification email'}
        </button>
        <button onClick={onLogout} style={{ ...styles.ghostBtn, width: '100%', justifyContent: 'center', marginTop: 10 }}>
          Log out
        </button>
      </div>
    </div>
  );
}

// ─── Customers ─────────────────────────────────────────────────




export function DeleteAccountModal({ user, ownerUid, isSubscribed, onExportData, onClose, onDeleted }) {
  const [step, setStep] = useState(1); // 1=warning 2=confirm-email 3=password 4=done
  const [emailInput, setEmailInput]     = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [error, setError]   = useState('');
  const [busy, setBusy]     = useState('');
  const [exported, setExported] = useState(false);

  // Paid customers get 30-day grace period; trial gets immediate hard delete
  const gracePeriod  = !!isSubscribed;
  const deletionDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const deletionDateStr = deletionDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  // Auto-redirect after step 4 shown for non-grace-period (immediate delete)
  useEffect(() => {
    if (step === 4 && !gracePeriod) {
      const t = setTimeout(() => onDeleted('deleted'), 2500);
      return () => clearTimeout(t);
    }
  }, [step, gracePeriod]); // eslint-disable-line

  // Wrap a promise with a timeout — if it hangs, resolve silently after ms
  function withTimeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise(resolve => setTimeout(resolve, ms)),
    ]);
  }

  async function execute() {
    // Block test accounts from self-deleting
    if (TEST_EMAILS.includes(user?.email)) {
      setError('Test accounts cannot be deleted through this flow.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await reauthenticateUser(user, passwordInput);
      if (gracePeriod) {
        // Option B — schedule (no real deletion, just flag)
        await saveCompanyData(ownerUid, {
          deletionScheduled: true,
          deletionDate: deletionDate.toISOString(),
          deletionRequestedAt: new Date().toISOString(),
        });
        setStep(4);
        onDeleted('scheduled');
      } else {
        // Option A — best-effort data cleanup, then delete Auth user
        // Firestore + Storage are non-critical; 10s timeout each to prevent hang
        await withTimeout(deleteAllCompanyFirestore(ownerUid).catch(e => console.warn('Firestore delete:', e)), 10000);
        await withTimeout(deleteCompanyStorage(ownerUid).catch(e => console.warn('Storage delete:', e)), 10000);
        // Auth user deletion is the critical step — if this fails, throw
        await deleteFirebaseUser(user);
        setStep(4);
      }
    } catch (e) {
      const msg = e.message || '';
      if (msg.includes('wrong-password') || msg.includes('invalid-credential') || msg.includes('INVALID_LOGIN')) {
        setError('Incorrect password. Please try again.');
      } else if (msg.includes('requires-recent-login')) {
        setError('Session expired. Please close and try again.');
      } else {
        setError('Error: ' + (msg || 'Deletion failed. Please try again.'));
      }
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  const dangerBtn = (label, onClick, disabled) => (
    <button onClick={onClick} disabled={disabled}
      style={{ flex:2, padding:'10px 16px', background: disabled ? '#ccc' : '#B91C1C', color:'#fff', border:'none', borderRadius:8, fontWeight:600, fontSize:14, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {label}
    </button>
  );
  const backBtn = (toStep) => (
    <button onClick={() => { setStep(toStep); setError(''); }}
      style={{ ...styles.ghostBtn, flex:1 }}>← Back</button>
  );

  return (
    <Modal onClose={step < 4 ? onClose : undefined} title={step < 4 ? 'Delete Account' : ''}>
      {step === 1 && (
        <>
          <div style={{ background:'#FEF2F2', border:'1px solid #FECACA', borderRadius:10, padding:16, marginBottom:16 }}>
            <div style={{ fontWeight:700, color:'#B91C1C', marginBottom:6 }}>⚠ {gracePeriod ? 'This will schedule your account for deletion' : 'This will permanently delete your account'}</div>
            <div style={{ fontSize:13, color:'#7F1D1D', lineHeight:1.6 }}>
              {gracePeriod
                ? `Your account and all data will be permanently deleted on ${deletionDateStr} (30-day grace period). You can cancel anytime before that date from Settings.`
                : 'Your trial account and all data will be permanently and immediately deleted. This cannot be undone.'}
            </div>
          </div>
          <div style={{ fontSize:13, color:'#555', marginBottom:16 }}>
            <strong>What will be deleted:</strong>
            <div style={{ marginTop:6, lineHeight:2, paddingLeft:4 }}>
              {'All documents · Customers & vendors · Employees & payroll · Stock & production · Quality records · Uploaded files (logos, drawings) · All staff accounts'.split(' · ').map(item => (
                <div key={item} style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ color:'#B91C1C', fontWeight:700 }}>×</span> {item}
                </div>
              ))}
            </div>
          </div>
          <button onClick={() => { onExportData(); setExported(true); }}
            style={{ ...styles.ghostBtn, width:'100%', marginBottom:10, borderColor:'#1E2A4A', color:'#1E2A4A' }}>
            ↓ Export all my data first {exported ? '✓' : '(recommended)'}
          </button>
          <div style={{ display:'flex', gap:10, marginTop:4 }}>
            <button onClick={onClose} style={{ ...styles.ghostBtn, flex:1 }}>Cancel</button>
            {dangerBtn('Continue →', () => setStep(2))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ fontSize:14, color:'#333', marginBottom:8 }}>Type your account email address to confirm:</div>
          <div style={{ fontSize:12, color:'#888', background:'#F8F7F4', borderRadius:6, padding:'6px 10px', marginBottom:12 }}>
            {user.email}
          </div>
          <input value={emailInput} onChange={e => setEmailInput(e.target.value)}
            placeholder="Enter your email"
            style={{ ...styles.input, marginBottom:4 }}
            autoFocus
          />
          {error && <div style={{ color:'#B91C1C', fontSize:12, marginBottom:8 }}>{error}</div>}
          <div style={{ display:'flex', gap:10, marginTop:12 }}>
            {backBtn(1)}
            {dangerBtn('Confirm →', () => {
              if (emailInput.trim() !== user.email) { setError('Email does not match.'); return; }
              setError(''); setStep(3);
            })}
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div style={{ fontSize:14, color:'#333', marginBottom:12 }}>Enter your password to verify it's you:</div>
          <input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)}
            placeholder="Your password"
            style={{ ...styles.input, marginBottom:4 }}
            onKeyDown={e => e.key === 'Enter' && !busy && passwordInput && execute()}
            autoFocus
          />
          {error && <div style={{ color:'#B91C1C', fontSize:12, marginBottom:8 }}>{error}</div>}
          <div style={{ display:'flex', gap:10, marginTop:12 }}>
            {backBtn(2)}
            {dangerBtn(
              busy ? 'Verifying…' : gracePeriod ? 'Schedule Deletion' : 'Delete Permanently',
              execute,
              busy || !passwordInput,
            )}
          </div>
        </>
      )}

      {step === 4 && (
        <div style={{ textAlign:'center', padding:'32px 16px' }}>
          <div style={{ fontSize:48, marginBottom:16 }}>{gracePeriod ? '🗓' : '🗑'}</div>
          {gracePeriod ? (
            <>
              <div style={{ fontSize:18, fontWeight:700, color:'#1E2A4A', marginBottom:8 }}>Deletion Scheduled</div>
              <div style={{ fontSize:13, color:'#666', lineHeight:1.7 }}>
                Your account is scheduled for permanent deletion on<br/>
                <strong>{deletionDateStr}</strong>.<br/><br/>
                You can cancel this from <strong>Settings → Danger Zone</strong> before that date.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize:18, fontWeight:700, color:'#B91C1C', marginBottom:8 }}>Account Deleted</div>
              <div style={{ fontSize:13, color:'#666', marginBottom:8 }}>All your data has been permanently removed.</div>
              <div style={{ fontSize:12, color:'#aaa' }}>Redirecting to sign-in…</div>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}



export function SettingsView({ businessInfo, setBusinessInfo, onExportData, onRestoreBackup, onSaved, userRole = 'admin', isOwner = false, userEmail = '', onRequestDelete }) {
  const [form, setForm] = useState(businessInfo);
  const [saved, setSaved] = useState(false);
  useEffect(() => setForm(businessInfo), [businessInfo]);

  function handleSave() {
    // Ensure companyType is always set (guards against data-loss recovery
    // where businessInfo was wiped — without companyType the ActivitySelectScreen
    // guard fires for existing accounts on next load)
    const types = form.activeTypes?.length ? form.activeTypes : [form.companyType || 'trading'];
    const saved = {
      ...form,
      activeTypes: types,
      companyType: form.companyType || types[0] || 'trading',
    };
    setBusinessInfo(saved);
    setSaved(true);
    setTimeout(() => { setSaved(false); if (onSaved) onSaved(); }, 1200);
  }

  function handleLetterheadUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1500 * 1024) { alert('Please choose an image under 1.5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(p => ({ ...p, letterhead: reader.result }));
    reader.readAsDataURL(file);
  }

  function handleLetterheadHtmlUpload(e) {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 300 * 1024) { alert('HTML file too large — max 300 KB. Embed images as URLs, not base64.'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      let html = reader.result;
      // Extract only body content if full HTML doc
      const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
      if (bodyMatch) html = bodyMatch[1];
      // Strip script tags for safety
      html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
      // Strip html/head/body wrapper tags if still present
      html = html.replace(/<\/?(html|head|body)[^>]*>/gi, '');
      setForm(p => ({ ...p, letterheadHtml: html.trim() }));
    };
    reader.readAsText(file);
  }
  function handleLetterheadFooterUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 1500 * 1024) { alert('Please choose an image under 1.5 MB.'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm(p => ({ ...p, letterheadFooter: reader.result }));
    reader.readAsDataURL(file);
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert('Please choose an image under 500KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((p) => ({ ...p, logo: reader.result }));
    reader.readAsDataURL(file);
  }

  const templates = [
    { id: 'classic',   label: 'Classic',   desc: 'Traditional ledger, gold accents', swatch: 'linear-gradient(135deg,#1E2A4A 60%,#C9A24B 100%)' },
    { id: 'modern',    label: 'Modern',    desc: 'Bold full-width color band',       swatch: 'linear-gradient(135deg,#C9A24B,#E8C97A)' },
    { id: 'minimal',   label: 'Minimal',   desc: 'Clean black & white, ink-saving',  swatch: 'linear-gradient(135deg,#F5F3EE,#EAE6DB)' },
    { id: 'executive', label: 'Executive', desc: 'Dark navy header, gold badge',     swatch: 'linear-gradient(135deg,#1E2A4A,#3B4F7A)' },
    { id: 'elegant',   label: 'Elegant',   desc: 'Side accent bar, serif type',      swatch: 'linear-gradient(135deg,#C9A24B 8px,#FAF8F4 8px)' },
    { id: 'fresh',     label: 'Fresh',     desc: 'Soft teal header, airy feel',      swatch: 'linear-gradient(135deg,#E8F5EE,#1A7A3E 200%)' },
    { id: 'formal',    label: 'Formal',    desc: 'Bordered Indian invoice, T&C',     swatch: 'linear-gradient(135deg,#fff 50%,#eee 50%)' },
    { id: 'prestige',  label: 'Prestige',  desc: 'Formal with navy band & gold',     swatch: 'linear-gradient(135deg,#1E2A4A 60%,#C9A24B 100%)' },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h1 className="serif" style={styles.h1}>Business profile</h1>
        <p style={styles.muted}>This appears on every document you create.</p>
      </div>
      <div style={{ maxWidth: 480 }}>
        {(() => {
          const cc2 = COUNTRY_CONFIG[form.country || 'india'] || COUNTRY_CONFIG.other;
          const fields = [
            { key: 'name',    label: 'Business Name' },
            { key: 'address', label: 'Address' },
            ...(cc2.hasTax ? [{ key: 'gstin', label: cc2.taxIdLabel, placeholder: cc2.taxIdPlaceholder }] : []),
            { key: 'state',   label: cc2.stateLabel || 'State' },
            { key: 'phone',   label: 'Phone' },
            { key: 'email',   label: 'Email' },
            { key: 'website', label: 'Website', placeholder: 'https://www.yourcompany.com' },
          ];
          return fields.map(({ key, label, placeholder }) => (
            <div key={key} style={styles.formGroup}>
              <label style={styles.label}>{label}</label>
              <input value={form[key] || ''} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                placeholder={placeholder || ''} style={styles.input} />
            </div>
          ));
        })()}

        <div style={styles.formGroup}>
          <label style={styles.label}>Company logo</label>
          {form.logo && (
            <div style={styles.logoPreviewWrap}>
              <img src={form.logo} alt="Logo preview" style={styles.logoPreview} />
              <button onClick={() => setForm((p) => ({ ...p, logo: '' }))} style={styles.ghostBtn}>Remove</button>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleLogoUpload} style={styles.input} />
          <div style={{ ...styles.muted, fontSize: 11.5, marginTop: 4 }}>PNG or JPG · Max 500 KB · Recommended size: 400 × 400 px (square) or 800 × 300 px (horizontal). Appears on every document.</div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Header Image <span style={{ fontWeight:400, color:'#888', fontSize:11 }}>(used automatically on all printed documents)</span></label>
          {form.letterhead && (
            <div style={{ marginBottom: 8, border:'1px solid #EAE6DB', borderRadius:8, overflow:'hidden', maxWidth:400 }}>
              <img src={form.letterhead} alt="Letterhead preview" style={{ width:'100%', maxHeight:160, objectFit:'contain', background:'#fff' }} />
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleLetterheadUpload} style={styles.input} />
          {form.letterhead && <button onClick={()=>setForm(p=>({...p,letterhead:''}))} style={{ ...styles.ghostBtn, marginTop:6, fontSize:12 }}>Remove Header</button>}
          <div style={{ ...styles.muted, fontSize:11.5, marginTop:4 }}>PNG or JPG · Max 1.5 MB · Recommended 2480 × 350 px. Auto-applied to all document prints (invoices, PO, contracts, etc).</div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>HTML Letterhead <span style={{ fontWeight:400, color:'#888', fontSize:11 }}>(upload .html file — overrides image header on all prints)</span></label>
          {form.letterheadHtml ? (
            <div style={{ padding:'8px 12px', background:'#EAF3DE', border:'1px solid #A8D5B5', borderRadius:8, marginBottom:8, fontSize:12, color:'#2C6B3A' }}>
              ✓ HTML letterhead loaded ({Math.round(form.letterheadHtml.length/1024)} KB)
              <button onClick={()=>setForm(p=>({...p,letterheadHtml:''}))} style={{ ...styles.ghostBtn, fontSize:11, marginLeft:10, padding:'2px 8px', color:'#E08A7D' }}>Remove</button>
            </div>
          ) : null}
          <input type="file" accept=".html,text/html" onChange={handleLetterheadHtmlUpload} style={styles.input} />
          <div style={{ ...styles.muted, fontSize:11.5, marginTop:4 }}>Upload a .html file. It will render as-is at the top of every printed document (takes priority over image header). Use inline CSS for styling.</div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Footer Image <span style={{ fontWeight:400, color:'#888', fontSize:11 }}>(used automatically on all printed documents)</span></label>
          {form.letterheadFooter && (
            <div style={{ marginBottom: 8, border:'1px solid #EAE6DB', borderRadius:8, overflow:'hidden', maxWidth:400 }}>
              <img src={form.letterheadFooter} alt="Letterhead footer preview" style={{ width:'100%', maxHeight:100, objectFit:'contain', background:'#fff' }} />
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleLetterheadFooterUpload} style={styles.input} />
          {form.letterheadFooter && <button onClick={()=>setForm(p=>({...p,letterheadFooter:''}))} style={{ ...styles.ghostBtn, marginTop:6, fontSize:12 }}>Remove Footer</button>}
          <div style={{ ...styles.muted, fontSize:11.5, marginTop:4 }}>PNG or JPG · Max 1.5 MB · Recommended 2480 × 200 px. Auto-applied to the bottom of all document prints.</div>
        </div>

        {userRole === 'admin' && (<>
        <div style={{ ...styles.sectionDivider, marginTop: 8 }}>Region &amp; Tax</div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Country / Region</label>
          <select
            value={form.country || 'india'}
            onChange={(e) => {
              const newCountry = e.target.value;
              const newCc = COUNTRY_CONFIG[newCountry] || COUNTRY_CONFIG.other;
              setForm((p) => ({ ...p, country: newCountry, taxRate: newCc.defaultTaxRate }));
            }}
            style={{ ...styles.input, cursor: 'pointer' }}
          >
            {Object.entries(COUNTRY_CONFIG).map(([id, cfg]) => (
              <option key={id} value={id}>
                {cfg.flag} {cfg.label} — {cfg.currency.trim()}{cfg.hasTax ? ` · ${cfg.taxLabel}` : ' · No tax'}
              </option>
            ))}
          </select>
          {/* Country info pills */}
          {(() => {
            const sel = COUNTRY_CONFIG[form.country || 'india'] || COUNTRY_CONFIG.other;
            const rate = form.taxRate !== undefined ? form.taxRate : sel.defaultTaxRate;
            return (
              <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                <span style={{ background: '#EEF5F0', color: '#1A7A3E', borderRadius: 12, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                  {sel.flag} {sel.label}
                </span>
                <span style={{ background: '#F0EEF9', color: '#4A3F8A', borderRadius: 12, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                  {sel.currency.trim()}
                </span>
                {sel.hasTax ? (
                  <span style={{ background: '#FEF3CD', color: '#92400E', borderRadius: 12, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                    {sel.taxLabel} {rate}%
                  </span>
                ) : (
                  <span style={{ background: '#E5F4ED', color: '#1A7A3E', borderRadius: 12, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                    ✓ No tax
                  </span>
                )}
              </div>
            );
          })()}
        </div>

        {/* Tax rate field — only shown for tax-enabled countries */}
        {(() => {
          const sel = COUNTRY_CONFIG[form.country || 'india'] || COUNTRY_CONFIG.other;
          if (!sel.hasTax) return null;
          const rate = form.taxRate !== undefined ? form.taxRate : sel.defaultTaxRate;
          return (
            <div style={styles.formGroup}>
              <label style={styles.label}>
                {sel.taxLabel} Rate (%)
                <span style={{ marginLeft: 8, fontSize: 11, color: '#888780', fontWeight: 400 }}>
                  — applies to new documents only; past documents keep their saved rates
                </span>
              </label>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, maxWidth: 160 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={rate}
                    onChange={(e) => setForm((p) => ({ ...p, taxRate: parseFloat(e.target.value) || 0 }))}
                    style={{ ...styles.input, paddingRight: 36 }}
                  />
                  <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#888780', fontSize: 14, fontWeight: 600 }}>%</span>
                </div>
                <button
                  type="button"
                  onClick={() => setForm((p) => ({ ...p, taxRate: sel.defaultTaxRate }))}
                  style={{ ...styles.ghostBtn, fontSize: 12, padding: '6px 12px', color: '#888780' }}
                  title={`Reset to ${sel.taxLabel} standard rate (${sel.defaultTaxRate}%)`}
                >
                  Reset to {sel.defaultTaxRate}%
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#888780', marginTop: 4 }}>
                Standard {sel.taxLabel} rate for {sel.label}: <strong>{sel.defaultTaxRate}%</strong>. Edit only if your business uses a different rate (e.g. zero-rated, reduced rate).
              </div>
            </div>
          );
        })()}

        {(()=>{
          const ALL_TYPES = [
            { id:'trading',       label:'🛒 Trading',             desc:'Buy & sell goods — invoices, POs, delivery, stock' },
            { id:'manufacturing', label:'🏭 Manufacturing',        desc:'Produce goods — BOM, production orders, QA' },
            { id:'service',       label:'🔧 Services / MEP Suite', desc:'Manpower & site work — projects, activity planner, attendance' },
            { id:'fmamc',         label:'🏢 FM / AMC',             desc:'Facility management — assets, PM schedules, work orders, SLA contracts' },
          ];
          const cur = form.activeTypes || [form.companyType || 'trading'];
          const typeLocked = !TEST_EMAILS.includes(userEmail) && cur.length > 0;
          if (typeLocked) {
            return (
              <div style={styles.formGroup}>
                <label style={styles.label}>Company type <span style={{ fontSize:10, background:'#FFF3CD', color:'#856404', borderRadius:4, padding:'1px 6px', marginLeft:6, fontWeight:700 }}>LOCKED</span></label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:6 }}>
                  {cur.map(id => {
                    const t = ALL_TYPES.find(x=>x.id===id);
                    return <span key={id} style={{ background:'#F0EFE9', border:'2px solid #1E2A4A', borderRadius:8, padding:'8px 16px', fontSize:13, fontWeight:600, color:'#1E2A4A' }}>{t?.label || id}</span>;
                  })}
                </div>
                <p style={{ fontSize:11.5, color:'#888', marginTop:6, marginBottom:0 }}>Company type is locked after initial setup. Contact support to change your plan.</p>
              </div>
            );
          }
          return (
            <div style={styles.formGroup}>
              <label style={styles.label}>Company type</label>
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:4 }}>
                {ALL_TYPES.map((t) => {
                  const active = cur.includes(t.id);
                  return (
                    <div key={t.id} onClick={() => {
                      const next = active ? cur.filter(x=>x!==t.id) : [...cur, t.id];
                      setForm(p => ({ ...p, activeTypes: next.length ? next : [t.id] }));
                    }} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:10, border: active ? '2px solid #1E2A4A' : '2px solid #EAE6DB', background: active ? '#F0EFE9' : '#FAFAF8', cursor:'pointer', userSelect:'none' }}>
                      <div style={{ width:20, height:20, borderRadius:5, border: active ? '2px solid #1E2A4A' : '2px solid #BDB9B0', background: active ? '#1E2A4A' : '#fff', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        {active && <span style={{ color:'#fff', fontSize:13, fontWeight:700 }}>✓</span>}
                      </div>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13, color:'#1E2A4A' }}>{t.label}</div>
                        <div style={{ fontSize:11.5, color:'#888780' }}>{t.desc}</div>
                      </div>
                    </div>
                  );
                })}
                <button onClick={() => setForm(p => {
                  const c = p.activeTypes || [p.companyType || 'trading'];
                  const all = ['trading','manufacturing','service','fmamc'];
                  return { ...p, activeTypes: c.length === all.length ? ['trading'] : all };
                })} style={{ ...styles.ghostBtn, alignSelf:'flex-start', marginTop:2 }}>
                  {cur.length === 4 ? 'Deselect all' : 'Select all activities'}
                </button>
              </div>
            </div>
          );
        })()}
        </>)}

        <div style={styles.formGroup}>
          <label style={styles.label}>Print template</label>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
            {templates.map((t) => (
              <button key={t.id} onClick={() => setForm((p) => ({ ...p, template: t.id }))}
                style={{ flexShrink: 0, width: 130, border: form.template === t.id ? '2px solid #1E2A4A' : '2px solid #EAE6DB', borderRadius: 10, padding: '10px 8px', cursor: 'pointer', textAlign: 'center', background: form.template === t.id ? '#F0EFE9' : '#FAF8F4' }}>
                <div style={{ height: 36, borderRadius: 6, marginBottom: 7, background: t.swatch, border: '1px solid rgba(0,0,0,0.06)' }} />
                <div style={{ fontWeight: 600, fontSize: 12.5, color: '#1E2A4A' }}>{t.label}</div>
                <div style={{ fontSize: 11, color: '#888780', marginTop: 2 }}>{t.desc}</div>
              </button>
            ))}
          </div>
          {/* Live mini preview */}
          <div style={{ marginTop: 14, background: '#fff', border: '1px solid #EAE6DB', borderRadius: 10, padding: '16px 18px', fontSize: 11 }}>
            <TemplateMiniPreview template={form.template || 'classic'} name={form.name || 'Your Company'} />
          </div>
        </div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Default terms &amp; conditions</label>
          <textarea value={form.terms || ''} onChange={(e) => setForm((p) => ({ ...p, terms: e.target.value }))} style={{ ...styles.input, minHeight: 60, resize: 'vertical' }} placeholder="Payment due within 30 days. Thank you for your business." />
        </div>

        <div style={{ ...styles.sectionDivider, marginTop: 20 }}>Bank Details (shown on invoices)</div>

        <div style={styles.formGroup}>
          <label style={styles.label}>Bank name</label>
          <input value={form.bankName || ''} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} style={styles.input} placeholder="e.g. HDFC Bank" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Account number</label>
          <input value={form.bankAccount || ''} onChange={(e) => setForm((p) => ({ ...p, bankAccount: e.target.value }))} style={styles.input} placeholder="Bank account number" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>IFSC code</label>
          <input value={form.ifsc || ''} onChange={(e) => setForm((p) => ({ ...p, ifsc: e.target.value }))} style={styles.input} placeholder="e.g. HDFC0001234" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>UPI ID</label>
          <input value={form.upi || ''} onChange={(e) => setForm((p) => ({ ...p, upi: e.target.value }))} style={styles.input} placeholder="e.g. business@upi" />
        </div>

        <div style={{ ...styles.sectionDivider, marginTop: 20 }}>Signatory</div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Authorized signatory name</label>
          <input value={form.signatory || ''} onChange={(e) => setForm((p) => ({ ...p, signatory: e.target.value }))} style={styles.input} placeholder="e.g. Director / Manager" />
        </div>

        <button onClick={handleSave} style={{ ...styles.primaryBtn, ...(saved ? { background: '#1A7A3E' } : {}), transition: 'background 0.3s' }}>
          {saved ? '✓ Settings saved!' : 'Save profile'}
        </button>

        {/* ── Data & Privacy ── */}
        <div style={{ ...styles.sectionDivider, marginTop: 32 }}>Data &amp; Privacy</div>
        <div style={{ background: '#F8F5EE', border: '1px solid #EAE6DB', borderRadius: 12, padding: '20px 22px', marginTop: 8 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{ fontSize: 26 }}>🔒</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1E2A4A', marginBottom: 4 }}>Your data belongs to you</div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6, marginBottom: 14 }}>
                All your business data is stored securely on Google Cloud (256-bit encryption, TLS in transit).
                We never sell, share, or use your data for advertising. You can export or delete everything at any time.
              </div>
              {(() => {
                const _bk = (() => { try { const s = localStorage.getItem('operix_backup_' + (businessInfo?.ownerUid || '')); return s ? JSON.parse(s) : null; } catch { return null; } })();
                const _bkAny = (() => { try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('operix_backup_')) { const s = localStorage.getItem(k); if (s) return JSON.parse(s); } } return null; } catch { return null; } })();
                const _backup = _bk || _bkAny;
                if (_backup?._savedAt) {
                  const _ago = Math.round((Date.now() - new Date(_backup._savedAt).getTime()) / 60000);
                  const _agoTxt = _ago < 60 ? `${_ago}m ago` : _ago < 1440 ? `${Math.round(_ago/60)}h ago` : `${Math.round(_ago/1440)}d ago`;
                  return (
                    <div style={{ background:'#EEF8F3', border:'1px solid #A7D9BC', borderRadius:10, padding:'12px 16px', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                      <div>
                        <div style={{ fontWeight:600, fontSize:13, color:'#1A7A3E' }}>✅ Local backup available</div>
                        <div style={{ fontSize:12, color:'#555', marginTop:2 }}>
                          Saved {_agoTxt} · {_backup.documents?.length || 0} docs · {_backup.customers?.length || 0} customers · {_backup.vendors?.length || 0} vendors{_backup._partial ? ' (partial)' : ''}
                        </div>
                      </div>
                      <button onClick={() => { if (window.confirm('Restore all data from your local backup? This will overwrite current Firestore data.')) onRestoreBackup(_backup); }}
                        style={{ padding:'7px 16px', background:'#1A7A3E', color:'#fff', border:'none', borderRadius:7, fontSize:13, fontWeight:600, cursor:'pointer' }}>
                        ↺ Restore from backup
                      </button>
                    </div>
                  );
                }
                return null;
              })()}
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={onExportData} style={{ ...styles.secondaryBtn, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Download size={14} /> Export all my data (JSON)
                </button>
                <a href="/privacy" target="_blank" rel="noopener noreferrer"
                  style={{ ...styles.ghostBtn, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                  Privacy Policy ↗
                </a>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
                {['256-bit encrypted', 'Google Cloud India', 'No ads, ever', 'DPDP Act 2023 compliant'].map(tag => (
                  <span key={tag} style={{ background: '#EEF5F0', color: '#1A7A3E', borderRadius: 10, padding: '3px 10px', fontSize: 11.5, fontWeight: 600 }}>✓ {tag}</span>
                ))}
              </div>
            </div>

            {/* ── Email Notification Config ── */}
            <div style={{ background: '#F8F5EE', border: '1px solid #EAE6DB', borderRadius: 12, padding: '20px 24px', marginTop: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1E2A4A', marginBottom: 4 }}>📧 Email Notifications (Optional)</div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 1.6 }}>
                Connect EmailJS (free, 200 emails/month) to send approval requests and document alerts by email.{' '}
                <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" style={{ color: '#3D52A0' }}>Setup guide →</a>
              </div>
              {[
                ['Service ID', 'emailConfig.serviceId', 'service_xxxxxxx'],
                ['Template ID', 'emailConfig.templateId', 'template_xxxxxxx'],
                ['Public Key', 'emailConfig.publicKey', 'your_public_key'],
                ['Approver Email', 'emailConfig.approverEmail', 'manager@company.com'],
              ].map(([label, path, ph]) => {
                const keys = path.split('.');
                const val = keys.reduce((o, k) => (o || {})[k], businessInfo) || '';
                return (
                  <div key={path} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                    <label style={{ width: 130, fontSize: 12, color: '#555', flexShrink: 0 }}>{label}</label>
                    <input value={val} placeholder={ph}
                      onChange={e => {
                        const v = e.target.value;
                        setBusinessInfo(prev => {
                          const next = { ...prev };
                          if (!next.emailConfig) next.emailConfig = {};
                          next.emailConfig[keys[1]] = v;
                          return next;
                        });
                      }}
                      style={{ flex: 1, border: '1px solid #DDD', borderRadius: 6, padding: '6px 10px', fontSize: 12 }} />
                  </div>
                );
              })}
              {businessInfo?.emailConfig?.serviceId && (
                <div style={{ fontSize: 11, color: '#3D7A5C', fontWeight: 600, marginTop: 6 }}>✓ Email notifications active</div>
              )}
            </div>

            {/* ── Danger Zone — owner only ── */}
            {userRole === 'admin' && isOwner && (
              <div style={{ marginTop: 32, paddingTop: 24, borderTop: '2px solid #FECACA' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#B91C1C', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>⚠ Danger Zone</div>
                <div style={{ background: '#FFF8EC', border: '1px solid #F5D48A', borderRadius: 10, padding: '16px 20px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#92600A', marginBottom: 4 }}>Change Business Activity</div>
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
                    Reset to the activity selection screen to change your business type or add new activities. Your existing data will not be lost.
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('This will take you back to the activity selection screen. Your data stays intact. Continue?')) {
                        setBusinessInfo(p => ({ ...p, companyType: null, activeTypes: null }));
                      }
                    }}
                    style={{ padding: '8px 20px', background: '#FFF8EC', color: '#92600A', border: '1px solid #F5D48A', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Change business activity
                  </button>
                </div>
                <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '16px 20px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#B91C1C', marginBottom: 4 }}>Delete Account</div>
                  <div style={{ fontSize: 13, color: '#555', marginBottom: 12 }}>
                    Permanently delete your Operix account and all associated data. This cannot be undone.
                  </div>
                  <button
                    onClick={() => onRequestDelete && onRequestDelete()}
                    style={{ padding: '8px 20px', background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    Delete my account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Staff ─────────────────────────────────────────────────────



export function StaffPage({ ownerUid, employees = [], companyName = '' }) {
  const ROLES = ['manager', 'sales', 'purchase', 'inventory', 'accounts'];
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingStaff, setAddingStaff] = useState(false);
  const [error, setError] = useState('');

  async function loadStaff() {
    setLoading(true);
    try {
      const list = await getStaffList(ownerUid);
      setStaffList(list);
    } catch {
      setError('Could not load staff list.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStaff(); }, [ownerUid]);

  async function handleRemove(staffUid) {
    if (!window.confirm('Remove this staff member? They will lose access immediately.')) return;
    try {
      const member = staffList.find(x => x.uid === staffUid);
      await removeStaff(ownerUid, staffUid, member?.email || '');
      setStaffList((s) => s.filter((x) => x.uid !== staffUid));
    } catch {
      setError('Could not remove staff member.');
    }
  }

  async function handleRoleChange(staffUid, newRole) {
    try {
      await updateStaffRole(ownerUid, staffUid, newRole);
      setStaffList((s) => s.map((x) => x.uid === staffUid ? { ...x, role: newRole } : x));
    } catch {
      setError('Could not update role.');
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h1 className="serif" style={styles.h1}>Staff management</h1>
        <p style={styles.muted}>Create logins for your team. Each role controls which modules they can access.</p>
      </div>

      {error && <div style={{ ...styles.authError, marginBottom: 16 }}>{error}</div>}

      <button onClick={() => setAddingStaff(true)} style={styles.primaryBtn}><Plus size={15} /> Add staff member</button>

      <div style={{ marginTop: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 160px 80px', gap: 8, padding: '6px 0', borderBottom: '2px solid #EAE6DB', marginBottom: 8 }}>
          {['#', 'Name', 'Email', 'Role', ''].map((h) => (
            <div key={h} style={{ fontSize: 11, color: '#888780', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{h}</div>
          ))}
        </div>

        {loading && <div style={styles.muted}>Loading…</div>}
        {!loading && staffList.length === 0 && (
          <div style={styles.emptyBox}>No staff added yet. Add team members to give them role-based access.</div>
        )}

        {staffList.map((s, i) => (
          <div key={s.uid} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr 160px 80px', gap: 8, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #F2EFE6' }}>
            <div style={{ fontSize: 12.5, color: '#888780' }}>{i + 1}</div>
            <div style={{ fontWeight: 500, color: '#1E2A4A', fontSize: 14 }}>{s.name}</div>
            <div style={{ fontSize: 13, color: '#5F5E5A' }}>{s.email}</div>
            <select
              value={s.role}
              onChange={(e) => handleRoleChange(s.uid, e.target.value)}
              style={{ ...styles.input, padding: '5px 8px', fontSize: 12.5 }}
            >
              {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
            <button onClick={() => handleRemove(s.uid)} style={styles.iconBtn} title="Remove staff">
              <Trash2 size={15} color="#B5453A" />
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 28, padding: 16, background: '#F2EFE6', borderRadius: 10, maxWidth: 520 }}>
        <div style={{ fontWeight: 600, fontSize: 13, color: '#1E2A4A', marginBottom: 8 }}>Role permissions</div>
        {[
          { role: 'Admin', access: 'Full access — approve/reject documents, edit approved docs, staff management' },
          { role: 'Manager', access: 'Verify or reject submitted documents before they reach Admin' },
          { role: 'Sales', access: 'Create Invoice, Delivery, Quotation, Credit/Debit note — submit for review' },
          { role: 'Purchase', access: 'Create Purchase order, Purchase bill — submit for review' },
          { role: 'Inventory', access: 'Items (full), all documents (view only)' },
          { role: 'Accounts', access: 'All documents (view only), Customers, Vendors' },
        ].map((r) => (
          <div key={r.role} style={{ display: 'flex', gap: 8, marginBottom: 4, fontSize: 12.5 }}>
            <span style={{ fontWeight: 600, color: '#1E2A4A', width: 80, flexShrink: 0 }}>{r.role}</span>
            <span style={{ color: '#5F5E5A' }}>{r.access}</span>
          </div>
        ))}
      </div>

      {addingStaff && (
        <StaffModal
          ownerUid={ownerUid}
          companyName={companyName}
          employees={employees}
          onSaved={() => { setAddingStaff(false); loadStaff(); }}
          onClose={() => setAddingStaff(false)}
        />
      )}
    </div>
  );
}



export function StaffModal({ ownerUid, companyName = '', onSaved, onClose, employees = [] }) {
  const [form, setForm] = useState({ empId: '', name: '', email: '', password: '', role: 'sales' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ROLES = [
    { value: 'manager',   label: 'Manager',          desc: 'Full access except staff & settings. Can approve documents.' },
    { value: 'sales',     label: 'Sales',             desc: 'Quotations, invoices, delivery notes, customers.' },
    { value: 'purchase',  label: 'Purchase',          desc: 'Purchase orders, purchase bills, vendors.' },
    { value: 'inventory', label: 'Inventory / Stores',desc: 'Items, stock, GRN, store issue, bin card.' },
    { value: 'accounts',  label: 'Accounts',          desc: 'Petty cash, vouchers, tax reports.' },
    { value: 'hr',        label: 'HR / Payroll',       desc: 'Employees, payroll, attendance.' },
    { value: 'viewer',    label: 'Viewer (read-only)', desc: 'Can view all documents but cannot create or edit.' },
  ];

  function handleEmpSelect(empId) {
    if (!empId) {
      setForm((f) => ({ ...f, empId: '', name: '' }));
      return;
    }
    const emp = employees.find((e) => e.id === empId);
    if (emp) {
      setForm((f) => ({ ...f, empId: emp.id, name: emp.name || '' }));
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const { name, email, password, role, empId } = form;
    if (!name.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const emp = employees.find((e) => e.id === empId);
      const empNo = emp ? (emp.employeeId || emp.empNo || '') : '';
      await createStaffAccount(ownerUid, email.trim(), password, name.trim(), role, companyName, empId, empNo);
      onSaved();
    } catch (err) {
      const code = (err && err.code) || '';
      const msg = (err && err.message) || '';
      if (code.includes('email-already-in-use')) setError('An account with this email already exists.');
      else if (code.includes('invalid-email')) setError('Invalid email address.');
      else if (code.includes('weak-password')) setError('Password is too weak. Use at least 6 characters.');
      else if (msg === 'timeout') setError('Request timed out. Check your internet connection and try again.');
      else setError('Could not create account (' + (code || msg || 'unknown') + '). Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Add staff member">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {employees.length > 0 && (
          <div style={styles.formGroup}>
            <label style={styles.label}>Link to employee (optional)</label>
            <select value={form.empId} onChange={(e) => handleEmpSelect(e.target.value)} style={styles.input}>
              <option value="">— Select employee —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.employeeId || emp.empNo ? `[${emp.employeeId || emp.empNo}] ` : ''}{emp.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div style={styles.formGroup}>
          <label style={styles.label}>Full name</label>
          <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={styles.input} placeholder="e.g. Ravi Kumar" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Email</label>
          <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} style={styles.input} placeholder="staff@yourbusiness.com" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Temporary password</label>
          <input type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} style={styles.input} placeholder="Min 6 characters" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Role & Access</label>
          <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} style={styles.input}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
          {(() => { const r = ROLES.find(x => x.value === form.role); return r ? (
            <div style={{ marginTop: 6, fontSize: 12, color: '#555', background: '#F5F3EE', borderRadius: 6, padding: '6px 10px' }}>
              <strong>Access:</strong> {r.desc}
            </div>
          ) : null; })()}
        </div>
        {error && <div style={{ ...styles.authError, marginBottom: 12 }}>{error}</div>}
        <button type="submit" disabled={busy} style={{ ...styles.primaryBtn, justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Creating account…' : 'Create staff account'}
        </button>
      </form>
    </Modal>
  );
}


// ─── Raw Materials ───────────────────────────────────────────────────────────

// ─── Dashboard ─────────────────────────────────────────────────

// Doc types visible per company type


export const DASHBOARD_DOC_TYPES = {
  trading:       ['quotation', 'invoice', 'delivery', 'packing_list', 'creditnote', 'purchase', 'purchasebill'],
  service:       ['quotation', 'invoice', 'creditnote'],
  manufacturing: ['quotation', 'invoice', 'delivery', 'packing_list', 'creditnote', 'purchase', 'purchasebill'],
  both:          ['quotation', 'invoice', 'delivery', 'packing_list', 'creditnote', 'purchase', 'purchasebill'],
};

// ── Per-activity stats column ──────────────────────────────────────────────────


export function ActivityColumn({ bizType, label, color, icon, docs, stats, customers, vendors, productionOrders, siteProjects, siteAttendance, startNewDoc, openDoc, setView, cur, items }) {
  const BIZ_DOC_TYPES = {
    trading:       ['quotation','invoice','delivery','packing_list','creditnote','purchase','purchasebill'],
    manufacturing: ['quotation','invoice','creditnote','purchase','purchasebill'],
    service:       ['quotation','invoice','creditnote','purchase','purchasebill'],
    fmamc:         ['quotation','invoice','creditnote','purchase','purchasebill'],
  };
  const allowed = BIZ_DOC_TYPES[bizType] || [];
  const bizDocs  = docs.filter(d => (d.bizType || 'trading') === bizType);
  const invoiced  = bizDocs.filter(d=>d.type==='invoice').reduce((s,d)=>s+(d.total||0),0);
  const outstanding = bizDocs.filter(d=>d.type==='invoice'&&d.status!=='paid').reduce((s,d)=>s+(d.total||0),0);
  const purchases = bizDocs.filter(d=>d.type==='purchase').reduce((s,d)=>s+(d.total||0),0);
  const payable   = bizDocs.filter(d=>d.type==='purchasebill'&&d.status!=='paid').reduce((s,d)=>s+(d.total||0),0);
  const recent    = [...bizDocs].sort((a,b)=>b.createdAt-a.createdAt).slice(0,4);

  const isService = bizType === 'service' || bizType === 'fmamc';

  function MiniStat({ val, label: lbl, bg, textColor }) {
    return (
      <div style={{ background: bg, borderRadius: 8, padding: '8px 10px' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{val}</div>
        <div style={{ fontSize: 10, color: '#888', marginTop: 1 }}>{lbl}</div>
      </div>
    );
  }

  return (
    <div style={{ background: '#fff', border: `1.5px solid ${color}30`, borderTop: `3px solid ${color}`, borderRadius: 12, padding: '16px 15px', flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 7, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{icon}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: '#1E2A4A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
          <div style={{ fontSize: 10.5, color: '#aaa' }}>{bizDocs.length} docs total</div>
        </div>
        <button onClick={()=>setView('documents')} style={{ padding:'3px 9px', borderRadius:6, border:'1px solid #EAE6DB', background:'none', cursor:'pointer', fontSize:10.5, color:'#888' }}>All →</button>
      </div>

      {/* Sales KPIs */}
      <div style={{ fontSize: 10, fontWeight: 700, color: color, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Sales</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
        <MiniStat val={cur(invoiced)}    label="Total invoiced"   bg="#FAF8F4" textColor="#1E2A4A" />
        <MiniStat val={cur(outstanding)} label="Receivable"       bg="#FEF0E0" textColor="#B5453A" />
        {bizType === 'manufacturing' && (
          <MiniStat val={productionOrders?.filter(o=>o.status==='in_progress').length || 0} label="Production (WIP)" bg="#FFF7E0" textColor="#C9A24B" />
        )}
        {isService && (
          <MiniStat val={siteProjects?.filter(p=>p.status==='active').length || 0} label="Active projects" bg="#E0F2F9" textColor="#1E7A9A" />
        )}
        {isService && (
          <MiniStat val={bizDocs.filter(d=>d.type==='invoice'&&d.status==='approved').length} label="RA bills raised" bg="#FAF8F4" textColor="#1E2A4A" />
        )}
      </div>

      {/* Purchase KPIs */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#6B5BAE', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Purchase</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 14 }}>
        <MiniStat val={cur(purchases)} label="Total purchased" bg="#F0EAF9" textColor="#6B5BAE" />
        <MiniStat val={cur(payable)}   label="Payable"         bg="#FFF0F0" textColor="#B91C1C" />
        <MiniStat val={bizDocs.filter(d=>d.type==='purchase').length} label="POs raised" bg="#FAF8F4" textColor="#1E2A4A" />
        {!isService && <MiniStat val={items?.length || 0} label="Items in master" bg="#E6F5EC" textColor="#1A7A3E" />}
        {isService && <MiniStat val={siteAttendance?.filter(r=>r.date===new Date().toISOString().slice(0,10)).reduce((s,r)=>(s+(r.records||[]).filter(x=>x.status==='present').length),0)||0} label="Present today" bg="#E6F5EC" textColor="#1A7A3E" />}
      </div>

      {/* Quick create */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Quick create</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 14 }}>
        {Object.entries(DOC_TYPES).filter(([k])=>allowed.includes(k)).map(([k, t]) => (
          <button key={k} onClick={()=>startNewDoc(k, bizType)}
            style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 9px', borderRadius:7, border:`1px solid ${color}30`, background:`${color}08`, cursor:'pointer', fontSize:11, color:'#1E2A4A' }}>
            <t.icon size={12} color={color} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Recent docs */}
      <div style={{ fontSize: 10, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>Recent</div>
      <div style={{ flex: 1 }}>
        {recent.length === 0
          ? <div style={{ fontSize: 12, color: '#ccc', padding: '6px 0' }}>No documents yet</div>
          : recent.map(d => (
              <div key={d.id} onClick={()=>openDoc(d)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 0', borderTop:'1px solid #F4F2EE', cursor:'pointer' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#1E2A4A' }}>{d.number}</div>
                  <div style={{ fontSize: 10.5, color: '#bbb' }}>{DOC_TYPES[d.type]?.label || d.type}</div>
                </div>
                <div style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>{cur(d.total || 0)}</div>
              </div>
            ))
        }
      </div>
    </div>
  );
}



export function Dashboard({ stats, documents, customers, vendors, businessInfo, startNewDoc, openDoc, setView, vouchers = [], pettyCash = {}, productionOrders = [], rawMaterials = [], items = [], companyType = 'trading', activeTypes = ['trading'], isMultiBiz = false, siteProjects = [], siteAttendance = [], serviceOrders = [] }) {
  const allowedTypes = DASHBOARD_DOC_TYPES[companyType] || Object.keys(DOC_TYPES);
  const recent = [...documents].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const showProduction = activeTypes.includes('manufacturing');
  const showService    = activeTypes.includes('service');
  const showTrade      = activeTypes.includes('trading') || activeTypes.includes('manufacturing');
  const cc = COUNTRY_CONFIG[businessInfo?.country || 'india'];
  const cur = (n) => currency(n, cc.currency);

  const BIZ_META = {
    trading:       { label: 'Trading',       icon: '🛒', color: '#1A7A3E' },
    manufacturing: { label: 'Manufacturing', icon: '🏭', color: '#C9752A' },
    service:       { label: 'MEP / Service', icon: '🔧', color: '#1E7A9A' },
    fmamc:         { label: 'FM / AMC',      icon: '🏢', color: '#0E9DB5' },
  };

  // ── Payment due date alerts ──────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekStr  = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const dueDocs  = documents.filter(d =>
    ['invoice', 'purchasebill'].includes(d.type) && d.status === 'approved' && d.dueDate
  );
  const overdueDocs  = dueDocs.filter(d => d.dueDate < todayStr);
  const dueSoonDocs  = dueDocs.filter(d => d.dueDate >= todayStr && d.dueDate <= weekStr);
  const allAlerts    = [...overdueDocs, ...dueSoonDocs];

  return (
    <div style={styles.page}>
      <div style={styles.pageHeader}>
        <h1 className="serif" style={styles.h1}>Good day, {(businessInfo.name || 'there').split(' ')[0]}</h1>
        <p style={styles.muted}>{isMultiBiz ? `${activeTypes.length} business activities running` : `Here's what's happening across your business.`}</p>
      </div>

      {/* ── Payment Due Alerts ───────────────────────────────────────────────── */}
      {allAlerts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <Bell size={15} color="#B5453A" />
            <span style={{ fontWeight: 700, fontSize: 13.5, color: '#1E2A4A' }}>Payment Alerts</span>
            <span style={{ fontSize: 12, color: '#888' }}>— due this week or overdue</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {overdueDocs.map(d => {
              const daysOver = Math.floor((new Date(todayStr) - new Date(d.dueDate)) / 86400000);
              const party = d.type === 'invoice'
                ? customers.find(c => c.id === d.customerId)?.name
                : vendors.find(v => v.id === d.customerId)?.name;
              return (
                <div key={d.id} onClick={() => openDoc(d)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#FFF5F5', border: '1px solid #FCA5A5', borderRadius: 8, cursor: 'pointer', flexWrap: 'wrap' }}>
                  <AlertTriangle size={13} color="#B91C1C" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', minWidth: 80 }}>OVERDUE {daysOver}d</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#C9A24B' }}>{d.number}</span>
                  <span style={{ fontSize: 12, color: '#555' }}>Due: {d.dueDate}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: d.type === 'invoice' ? '#1A7A3E' : '#B91C1C' }}>{d.type === 'invoice' ? '↑ Receivable' : '↓ Payable'}</span>
                  <span style={{ fontSize: 12, color: '#444' }}>{party || d.partyName || '—'}</span>
                  <span style={{ fontSize: 12, color: '#888' }}>{cur(d.items ? d.items.reduce((s, it) => s + (parseFloat(it.qty)||0)*(parseFloat(it.rate)||0), 0) : 0)}</span>
                </div>
              );
            })}
            {dueSoonDocs.map(d => {
              const daysLeft = Math.ceil((new Date(d.dueDate) - new Date(todayStr)) / 86400000);
              const party = d.type === 'invoice'
                ? customers.find(c => c.id === d.customerId)?.name
                : vendors.find(v => v.id === d.customerId)?.name;
              return (
                <div key={d.id} onClick={() => openDoc(d)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8, cursor: 'pointer', flexWrap: 'wrap' }}>
                  <Clock size={13} color="#C9A24B" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#C9A24B', minWidth: 80 }}>{daysLeft === 0 ? 'DUE TODAY' : `${daysLeft}d left`}</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: '#C9A24B' }}>{d.number}</span>
                  <span style={{ fontSize: 12, color: '#555' }}>Due: {d.dueDate}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: d.type === 'invoice' ? '#1A7A3E' : '#B91C1C' }}>{d.type === 'invoice' ? '↑ Receivable' : '↓ Payable'}</span>
                  <span style={{ fontSize: 12, color: '#444' }}>{party || d.partyName || '—'}</span>
                  <span style={{ fontSize: 12, color: '#888' }}>{cur(d.items ? d.items.reduce((s, it) => s + (parseFloat(it.qty)||0)*(parseFloat(it.rate)||0), 0) : 0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── MULTI-BUSINESS: column view ─────────────────────────────────────── */}
      {isMultiBiz ? (
        <>
          {/* ── Top: one column per business type ── */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activeTypes.length}, minmax(220px, 1fr))`, gap: 14, marginBottom: 24, overflowX: 'auto' }}>
            {activeTypes.map(bt => (
              <ActivityColumn
                key={bt}
                bizType={bt}
                label={BIZ_META[bt]?.label || bt}
                color={BIZ_META[bt]?.color || '#888'}
                icon={BIZ_META[bt]?.icon || '📁'}
                docs={documents}
                stats={stats}
                customers={customers}
                vendors={vendors}
                productionOrders={productionOrders}
                siteProjects={siteProjects}
                siteAttendance={siteAttendance}
                startNewDoc={startNewDoc}
                openDoc={openDoc}
                setView={setView}
                cur={cur}
                items={items}
              />
            ))}
          </div>

          {/* ── Sales dept data by division ── */}
          <div style={styles.dashSection}>Sales — by Division</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activeTypes.length}, 1fr)`, gap: 12, marginBottom: 20 }}>
            {activeTypes.map(bt => {
              const bm = BIZ_META[bt] || { label: bt, color: '#888', icon: '📁' };
              const bd = documents.filter(d => (d.bizType || 'trading') === bt);
              const invoiced    = bd.filter(d => d.type === 'invoice').reduce((s, d) => s + (d.total || 0), 0);
              const outstanding = bd.filter(d => d.type === 'invoice' && d.status !== 'paid').reduce((s, d) => s + (d.total || 0), 0);
              const quotes      = bd.filter(d => d.type === 'quotation').length;
              return (
                <div key={bt} style={{ background: '#fff', border: '1px solid #EAE6DB', borderLeft: `3px solid ${bm.color}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: bm.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{bm.icon} {bm.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#888' }}>Invoiced</span>
                      <span style={{ fontWeight: 700, color: '#1E2A4A' }}>{cur(invoiced)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#888' }}>Receivable</span>
                      <span style={{ fontWeight: 700, color: '#B5453A' }}>{cur(outstanding)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#888' }}>Quotations</span>
                      <span style={{ fontWeight: 600, color: '#555' }}>{quotes}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Purchase dept data by division ── */}
          <div style={styles.dashSection}>Purchase — by Division</div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${activeTypes.length}, 1fr)`, gap: 12, marginBottom: 20 }}>
            {activeTypes.map(bt => {
              const bm = BIZ_META[bt] || { label: bt, color: '#888', icon: '📁' };
              const bd = documents.filter(d => (d.bizType || 'trading') === bt);
              const purchased = bd.filter(d => d.type === 'purchase').reduce((s, d) => s + (d.total || 0), 0);
              const payable   = bd.filter(d => d.type === 'purchasebill' && d.status !== 'paid').reduce((s, d) => s + (d.total || 0), 0);
              const pos       = bd.filter(d => d.type === 'purchase').length;
              return (
                <div key={bt} style={{ background: '#fff', border: '1px solid #EAE6DB', borderLeft: `3px solid ${bm.color}`, borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: bm.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{bm.icon} {bm.label}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#888' }}>Purchased</span>
                      <span style={{ fontWeight: 700, color: '#1E2A4A' }}>{cur(purchased)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#888' }}>Payable</span>
                      <span style={{ fontWeight: 700, color: '#B91C1C' }}>{cur(payable)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5 }}>
                      <span style={{ color: '#888' }}>POs raised</span>
                      <span style={{ fontWeight: 600, color: '#555' }}>{pos}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Accounts summary (combined) ── */}
          <div style={styles.dashSection}>Accounts</div>
          <div style={styles.statGrid}>
            <StatCard label="Cash received"      value={cur(stats.totalReceived)} accent="#1A7A3E" sub="receipt vouchers" />
            <StatCard label="Cash paid"          value={cur(stats.totalPaid)}     accent="#B91C1C" sub="payment vouchers" />
            <StatCard label="Petty cash balance" value={cur(stats.pcBalance)}     accent="#C9A24B" />
            <StatCard label="Customers"          value={customers.length}         accent="#1E2A4A" sub="registered" />
            <StatCard label="Vendors"            value={vendors.length}           accent="#6B5BAE" sub="registered" />
          </div>

          {/* ── Department trend chart (reuse same chart, multi-type aware) ── */}
          <DeptChart
            documents={documents}
            productionOrders={productionOrders}
            serviceOrders={serviceOrders}
            activeTypes={activeTypes}
            cur={cur}
          />

          {/* ── Recent documents (cross-type) ── */}
          <div style={styles.sectionRow}>
            <div className="serif" style={styles.h2}>Recent documents</div>
            <button onClick={() => setView('documents')} style={styles.linkBtn}>View all</button>
          </div>
          {(() => {
            const recentAll = [...documents].sort((a, b) => b.createdAt - a.createdAt).slice(0, 6);
            return recentAll.length === 0
              ? <div style={styles.emptyBox}>No documents yet.</div>
              : <div style={styles.list}>
                  {recentAll.map(d => <DocRow key={d.id} doc={d} customers={customers} vendors={vendors} onClick={() => openDoc(d)} businessInfo={businessInfo} showBizBadge={true} />)}
                </div>;
          })()}
        </>
      ) : (
        /* ── SINGLE BUSINESS: original layout ──────────────────────────────── */
        <>
          <div style={styles.dashSection}>Sales</div>
          <div style={styles.statGrid}>
            <StatCard label="Total invoiced" value={cur(stats.totalRevenue)} accent="#1E2A4A" />
            <StatCard label="Outstanding (receivable)" value={cur(stats.outstanding)} accent="#B5453A" />
            <StatCard label="Quotations" value={stats.counts.quotation || 0} accent="#C9A24B" sub="created" />
            {showTrade && <StatCard label="Delivery notes" value={stats.counts.delivery || 0} accent="#3D7A5C" sub="created" />}
          </div>

          {showTrade && <>
            <div style={styles.dashSection}>Purchase</div>
            <div style={styles.statGrid}>
              <StatCard label="Total purchases" value={cur(stats.totalPurchases)} accent="#6B5BAE" />
              <StatCard label="Payable to vendors" value={cur(stats.payable)} accent="#8A6FD6" />
              <StatCard label="Purchase orders" value={stats.counts.purchase || 0} accent="#6B5BAE" sub="raised" />
              <StatCard label="Vendors" value={vendors.length} accent="#555" sub="registered" />
            </div>
          </>}

          <div style={styles.dashSection}>Accounts</div>
          <div style={styles.statGrid}>
            <StatCard label="Cash received" value={cur(stats.totalReceived)} accent="#1A7A3E" sub="receipt vouchers" />
            <StatCard label="Cash paid" value={cur(stats.totalPaid)} accent="#B91C1C" sub="payment vouchers" />
            <StatCard label="Petty cash balance" value={cur(stats.pcBalance)} accent="#C9A24B" />
            <StatCard label="Customers" value={customers.length} accent="#1E2A4A" sub="registered" />
          </div>

          {/* ── Department Overview Chart ── */}
          <DeptChart
            documents={documents}
            productionOrders={productionOrders}
            serviceOrders={serviceOrders}
            activeTypes={activeTypes}
            cur={cur}
          />

          {showTrade && <>
            <div style={styles.dashSection}>Inventory</div>
            <div style={styles.statGrid}>
              <StatCard label="Items master" value={stats.itemCount} accent="#3D7A5C" sub="products / services" />
              <StatCard label="Low / out of stock" value={stats.lowStockCount || 0} accent={stats.lowStockCount > 0 ? '#B91C1C' : '#3D7A5C'} sub={stats.lowStockCount > 0 ? 'needs attention' : 'all items ok'} />
              {showProduction && <StatCard label="Raw materials" value={stats.rmCount} accent="#C9A24B" sub="in master" />}
              {showProduction && <StatCard label="Production orders" value={stats.poCount} accent="#1E2A4A" sub={`${stats.poOpen} open`} />}
            </div>
          </>}

          <div style={styles.sectionRow}>
            <div className="serif" style={styles.h2}>Quick create</div>
          </div>
          <div style={styles.quickGrid}>
            {Object.entries(DOC_TYPES).filter(([key]) => allowedTypes.includes(key)).map(([key, t]) => (
              <button key={key} onClick={() => startNewDoc(key, companyType)} style={styles.quickCard}>
                <t.icon size={22} strokeWidth={1.6} color={t.color} />
                <span style={styles.quickLabel}>{t.label}</span>
                <span style={styles.quickCount}>{stats.counts[key] || 0} created</span>
              </button>
            ))}
          </div>

          <div style={styles.sectionRow}>
            <div className="serif" style={styles.h2}>Recent documents</div>
            <button onClick={() => setView('documents')} style={styles.linkBtn}>View all</button>
          </div>
          {recent.length === 0 ? (
            <div style={styles.emptyBox}>No documents yet. Pick a type above to create your first one.</div>
          ) : (
            <div style={styles.list}>
              {recent.map((d) => <DocRow key={d.id} doc={d} customers={customers} vendors={vendors} onClick={() => openDoc(d)} businessInfo={businessInfo} showBizBadge={true} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Department Overview Chart ───────────────────────────────────────────────


export function DeptChart({ documents = [], productionOrders = [], serviceOrders = [], activeTypes = ['trading'], cur = v => v }) {
  const [tab, setTab] = React.useState('sales');
  const [chartType, setChartType] = React.useState('bar');

  const months = React.useMemo(() => {
    const arr = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      arr.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        label: d.toLocaleString('default', { month: 'short' }),
      });
    }
    return arr;
  }, []);

  const tabs = [
    { id: 'sales',      label: 'Sales',      emoji: '💰', color: '#1E2A4A', show: true },
    { id: 'purchase',   label: 'Purchase',   emoji: '🛒', color: '#6B5BAE', show: activeTypes.some(t => ['trading', 'manufacturing'].includes(t)) },
    { id: 'production', label: 'Production', emoji: '🏭', color: '#C9A24B', show: activeTypes.includes('manufacturing') },
    { id: 'service',    label: 'Service',    emoji: '🔧', color: '#1E7A9A', show: activeTypes.some(t => ['service', 'fmamc'].includes(t)) },
  ].filter(t => t.show);

  const activeTab = tabs.find(t => t.id === tab) || tabs[0];
  const safeTab = activeTab.id;

  function mKey(s) { return (s || '').slice(0, 7); }
  function docAmt(d) { return (d.items || []).reduce((s, it) => s + (parseFloat(it.qty) || 0) * (parseFloat(it.rate) || 0), 0); }

  const data = React.useMemo(() => {
    switch (safeTab) {
      case 'sales':
        return months.map(m => ({ label: m.label, value: documents.filter(d => d.type === 'invoice' && mKey(d.date) === m.key).reduce((s, d) => s + docAmt(d), 0) }));
      case 'purchase':
        return months.map(m => ({ label: m.label, value: documents.filter(d => d.type === 'purchase' && mKey(d.date) === m.key).reduce((s, d) => s + docAmt(d), 0) }));
      case 'production':
        return months.map(m => ({ label: m.label, value: productionOrders.filter(p => mKey(p.plannedDate || p.date || '') === m.key).length }));
      case 'service':
        return months.map(m => ({ label: m.label, value: serviceOrders.filter(s => mKey(s.date || s.createdAt || '') === m.key).length }));
      default:
        return months.map(m => ({ label: m.label, value: 0 }));
    }
  }, [safeTab, documents, productionOrders, serviceOrders, months]);

  const isAmount = safeTab === 'sales' || safeTab === 'purchase';
  const maxVal = Math.max(...data.map(d => d.value), 1);
  const total6m = data.reduce((s, d) => s + d.value, 0);
  const peak = data.reduce((a, b) => b.value > a.value ? b : a, data[0]);

  // SVG layout
  const W = 560, H = 160, PL = 4, PR = 4, PT = 12, PB = 24;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;
  const n = data.length;
  const slotW = chartW / n;
  const barW = slotW * 0.45;

  const pts = data.map((d, i) => ({
    x: PL + i * slotW + slotW / 2,
    y: PT + chartH - (maxVal > 0 ? (d.value / maxVal) * chartH : 0),
    value: d.value,
    label: d.label,
  }));

  const color = activeTab.color;

  return (
    <div style={{ background: '#fff', border: '1px solid #EDEAE0', borderRadius: 14, padding: '20px 24px', marginBottom: 24 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <div className="serif" style={{ fontSize: 15, fontWeight: 700, color: '#1E2A4A' }}>Department Overview</div>
        <div style={{ display: 'flex', gap: 5 }}>
          {[['bar', '▮▮ Bar'], ['line', '〜 Line']].map(([ct, lbl]) => (
            <button key={ct} onClick={() => setChartType(ct)}
              style={{ padding: '4px 11px', borderRadius: 6, border: '1px solid #DDD', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                background: chartType === ct ? '#1E2A4A' : '#F8F6F2', color: chartType === ct ? '#fff' : '#666' }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Tab pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '5px 13px', borderRadius: 20, border: `1.5px solid ${tab === t.id ? t.color : '#DDD'}`,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: tab === t.id ? t.color : '#fff', color: tab === t.id ? '#fff' : '#666' }}>
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
          const y = PT + chartH * (1 - f);
          return <line key={i} x1={PL} y1={y} x2={W - PR} y2={y}
            stroke={f === 0 ? '#D8D4CC' : '#EDEAE0'} strokeWidth={f === 0 ? 1.5 : 0.8}
            strokeDasharray={f === 0 ? 'none' : '5 4'} />;
        })}

        {chartType === 'bar' ? (
          pts.map((pt, i) => (
            <g key={i}>
              <rect x={pt.x - barW / 2} y={pt.y} width={barW} height={PT + chartH - pt.y}
                rx={3} fill={color} opacity={0.82} />
              {pt.value > 0 && (
                <text x={pt.x} y={pt.y - 4} textAnchor="middle" fontSize={8.5} fill={color} fontFamily="sans-serif" fontWeight="600">
                  {isAmount ? (pt.value >= 100000 ? `${(pt.value/100000).toFixed(1)}L` : pt.value >= 1000 ? `${(pt.value/1000).toFixed(0)}K` : Math.round(pt.value)) : pt.value}
                </text>
              )}
            </g>
          ))
        ) : (
          <g>
            {/* Area */}
            <path d={`M ${pts[0].x},${PT + chartH} ${pts.map(p => `L ${p.x},${p.y}`).join(' ')} L ${pts[pts.length - 1].x},${PT + chartH} Z`}
              fill={color} opacity={0.07} />
            {/* Line */}
            <polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')}
              fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
            {/* Dots + value labels */}
            {pts.map((pt, i) => (
              <g key={i}>
                <circle cx={pt.x} cy={pt.y} r={4} fill={color} stroke="#fff" strokeWidth={2} />
                {pt.value > 0 && (
                  <text x={pt.x} y={pt.y - 8} textAnchor="middle" fontSize={8.5} fill={color} fontFamily="sans-serif" fontWeight="600">
                    {isAmount ? (pt.value >= 100000 ? `${(pt.value/100000).toFixed(1)}L` : pt.value >= 1000 ? `${(pt.value/1000).toFixed(0)}K` : Math.round(pt.value)) : pt.value}
                  </text>
                )}
              </g>
            ))}
          </g>
        )}

        {/* X-axis month labels */}
        {pts.map((pt, i) => (
          <text key={i} x={pt.x} y={H - 5} textAnchor="middle" fontSize={10} fill="#999" fontFamily="sans-serif">
            {pt.label}
          </text>
        ))}
      </svg>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 24, marginTop: 8, paddingTop: 10, borderTop: '1px solid #F0EDE4', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: '#888' }}>
          6-month total:{' '}
          <strong style={{ color: '#1E2A4A' }}>
            {isAmount ? cur(total6m) : `${total6m} orders`}
          </strong>
        </div>
        {peak && peak.value > 0 && (
          <div style={{ fontSize: 12, color: '#888' }}>
            Peak month:{' '}
            <strong style={{ color: '#1E2A4A' }}>
              {peak.label} ({isAmount ? cur(peak.value) : peak.value})
            </strong>
          </div>
        )}
        {total6m === 0 && (
          <div style={{ fontSize: 12, color: '#BBB', fontStyle: 'italic' }}>No data yet for this period.</div>
        )}
      </div>
    </div>
  );
}



export const SECTION_VIEWS = {
  sales:       ['customers', 'enquiries', 'documents', 'channelpartners', 'serviceorders'],
  accounts:    ['pettycash', 'vouchers', 'gstr1', 'gstr3b', 'vatreport', 'taxreport'],
  purchase:    ['vendors', 'grn'],
  stores:      ['stock', 'stockledger', 'bincard', 'items', 'storeissue', 'verticalrack'],
  engineering: ['partsmaster', 'engdocs'],
  production:  ['rawmaterials', 'bom', 'productionorders'],
  quality:     ['isoprinciples', 'deptprocedures', 'inprocessqa', 'qatesting'],
  hr:          ['employees', 'siteattendance', 'payroll', 'offerletter', 'warnletter', 'termletter'],
  scope:       ['scopeofwork','mepbom'],
  site:        ['siteprojects', 'tender', 'activityplanner', 'rabilling', 'subcontractors', 'hse', 'tcommissioning', 'handover', 'progressboard', 'clientmaterials', 'evaluation', 'mepreports'],
  admin:       ['staff', 'contracts', 'termslibrary'],
  fmamc:       ['fmkpi','assetregister','pmschedules','fmworkorders','amccontracts','fmspareparts'],
  shared:      ['customers', 'vendors', 'items', 'documents', 'enquiries', 'channelpartners'],
};

// Which views each biz-type accordion "owns" (for auto-open on navigation)


export const BIZ_SECTION_VIEWS = {
  trading:       ['customers','enquiries','channelpartners','pettycash','vouchers','gstr1','gstr3b','vatreport','taxreport','vendors','grn','stock','stockledger','bincard','items','storeissue','verticalrack','audit','assetregister','employees','siteattendance','payroll','offerletter','warnletter','termletter','staff','contracts','termslibrary'],
  manufacturing: ['customers','enquiries','vendors','serviceorders','vendoreval','grn','rawmaterials','stock','stockledger','bincard','items','storeissue','verticalrack','partsmaster','engdocs','bom','productionorders','isoprinciples','deptprocedures','inprocessqa','qatesting','capa','internalaudit','mis','pettycash','vouchers','gstr1','gstr3b','vatreport','audit','employees','siteattendance','payroll','offerletter','warnletter','termletter','staff','contracts','termslibrary'],
  service:       ['customers','enquiries','vendors','grn','stock','stockledger','bincard','items','storeissue','verticalrack','siteprojects','tender','activityplanner','rabilling','subcontractors','hse','tcommissioning','handover','progressboard','clientmaterials','evaluation','mepreports','scopeofwork','mepbom','pettycash','vouchers','gstr1','gstr3b','vatreport','audit','employees','siteattendance','payroll','offerletter','warnletter','termletter','staff','contracts','termslibrary'],
  fmamc:         ['customers','enquiries','vendors','grn','stock','stockledger','bincard','items','storeissue','verticalrack','fmkpi','assetregister','pmschedules','fmworkorders','amccontracts','fmspareparts','siteprojects','tender','activityplanner','rabilling','subcontractors','hse','tcommissioning','handover','progressboard','clientmaterials','evaluation','mepreports','mepbom','scopeofwork','pettycash','vouchers','audit','employees','siteattendance','payroll','offerletter','warnletter','termletter','staff','contracts','termslibrary'],
  hr:            ['employees','payroll','offerletter','warnletter','termletter'],
  admin:         ['staff','contracts','termslibrary'],
};



export const BizTypeCtx = React.createContext(null);


export const SidebarCtx = React.createContext(null);



export function NavBtn({ id, label, icon: Icon, small }) {
  const { view, setView, setActiveDoc, onBizContextChange } = React.useContext(SidebarCtx);
  const ctxBizType = React.useContext(BizTypeCtx);
  const active = view === id;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); if (ctxBizType) onBizContextChange?.(ctxBizType); setActiveDoc(null); setView(id); }}
      style={{
        ...styles.navItem,
        ...(active ? styles.navItemActive : {}),
        ...(small ? { fontSize: 12.5, paddingLeft: 28, color: active ? undefined : '#A9B0C9' } : {}),
      }}>
      <Icon size={small ? 13 : 17} strokeWidth={1.8} />{label}
    </button>
  );
}



export function CreateBtn({ docKey, bizType: btnBizType }) {
  const { startNewDoc, activeTypes } = React.useContext(SidebarCtx);
  const t = DOC_TYPES[docKey];
  if (!t) return null;
  const Icon = t.icon;
  return (
    <button
      onClick={() => startNewDoc(docKey, btnBizType || activeTypes[0])}
      style={{ ...styles.navItem }}>
      <Icon size={17} strokeWidth={1.8} />{t.label}
    </button>
  );
}



export function Section({ sectionKey, label, children }) {
  const { view } = React.useContext(SidebarCtx);
  const hasActive = SECTION_VIEWS[sectionKey]?.includes(view);
  const [open, setOpen] = React.useState(true);
  React.useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);
  const isOpen = hasActive || open;
  return (
    <div style={{ marginBottom: 2 }}>
      <button
        onClick={() => { if (!hasActive) setOpen(o => !o); }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '5px 10px 4px 10px',
          color: hasActive ? '#C9A24B' : '#6B7494',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
        }}>
        <span>{label}</span>
        <span style={{ opacity: 0.6 }}>
          {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
        </span>
      </button>
      {isOpen && (
        <div style={{
          borderLeft: '1px solid rgba(255,255,255,0.08)',
          marginLeft: 14,
          paddingLeft: 0,
        }}>
          {children}
        </div>
      )}
    </div>
  );
}



export function BizSection({ bizType, defaultOpen, children }) {
  const { view, activeDocBizType, activeTypes, activeBizContext, onBizContextChange, isMultiBiz } = React.useContext(SidebarCtx);
  const BIZ_CFG = {
    trading:       { label: 'Trading',       color: '#1A7A3E', bg: 'rgba(26,122,62,0.10)' },
    manufacturing: { label: 'Manufacturing', color: '#C9752A', bg: 'rgba(201,117,42,0.10)' },
    service:       { label: 'MEP / Service', color: '#1E7A9A', bg: 'rgba(30,122,154,0.10)' },
    fmamc:         { label: 'FM / AMC',      color: '#0E9DB5', bg: 'rgba(14,157,181,0.10)' },
    hr:            { label: 'HR & Payroll',  color: '#7C3AED', bg: 'rgba(124,58,237,0.10)' },
    admin:         { label: 'Admin',         color: '#374151', bg: 'rgba(55,65,81,0.10)'   },
  };
  const cfg = BIZ_CFG[bizType] || { label: bizType, color: '#6B7494', bg: 'rgba(107,116,148,0.10)' };
  const sectionsWithView = Object.keys(BIZ_SECTION_VIEWS).filter(bt =>
    (BIZ_SECTION_VIEWS[bt] || []).includes(view)
  );
  const isSharedView = sectionsWithView.length > 1;
  const viewInThisSection = sectionsWithView.includes(bizType);
  const docBizType = typeof activeDocBizType === 'string' ? activeDocBizType : null;
  const hasActive =
    (viewInThisSection && (!isMultiBiz || !isSharedView || activeBizContext === bizType)) ||
    (view === 'doceditor' && (docBizType || activeTypes[0]) === bizType);
  const [open, setOpen] = React.useState(defaultOpen ?? true);
  React.useEffect(() => { if (hasActive) setOpen(true); }, [hasActive]);
  const isOpen = hasActive || open;
  return (
    <BizTypeCtx.Provider value={bizType}>
      <div style={{ marginBottom: 2 }}>
        <button
          type="button"
          onClick={() => { onBizContextChange?.(bizType); if (!hasActive) setOpen(o => !o); }}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            width: '100%', background: isOpen ? cfg.bg : 'none', border: 'none',
            cursor: 'pointer', padding: '8px 12px 8px 10px',
            borderLeft: `3px solid ${isOpen ? cfg.color : 'transparent'}`,
            color: isOpen ? cfg.color : '#6B7494',
            fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase',
            transition: 'all 0.15s',
          }}>
          <span>{cfg.label}</span>
          {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {isOpen && (
          <div style={{ paddingLeft: 4, paddingBottom: 4 }}>
            {children}
          </div>
        )}
      </div>
    </BizTypeCtx.Provider>
  );
}



export function SubLabel({ label }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
      color: '#6B7494', padding: '7px 12px 2px 14px', marginTop: 3,
      borderTop: '1px solid rgba(255,255,255,0.05)',
    }}>
      {label}
    </div>
  );
}




export function Sidebar({ view, setView, setActiveDoc, startNewDoc, syncStatus, user, onLogout, userRole, companyType, activeTypes, country, unreadCount = 0, onShowNotifications, activeDocBizType = null, activeBizContext = null, onBizContextChange = null, onSwitchActivity = null }) {
  const showTrade      = activeTypes.includes('trading') || activeTypes.includes('manufacturing');
  const showProduction = activeTypes.includes('manufacturing');
  const showService    = activeTypes.includes('service');
  const showFMAMC      = activeTypes.includes('fmamc');
  const isMultiBiz     = activeTypes.length > 1;

  const sbCtx = { view, setView, setActiveDoc, startNewDoc, activeTypes, activeBizContext, onBizContextChange, activeDocBizType, isMultiBiz };

  const Brand = () => (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 10, marginBottom: 6 }}>
      {/* Top row: logo + settings + logout */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 12px 8px 14px' }}>
        <div style={styles.brandMark}>O</div>
        <div style={{ flex: 1 }}>
          <div className="serif" style={styles.brandName}>Operix</div>
          <div style={styles.brandSub}>Business Suite</div>
        </div>
        {/* Settings icon — admin only */}
        {userRole === 'admin' && (
          <button
            title="Business Settings"
            onClick={() => setView('settings')}
            style={{ background: view === 'settings' ? 'rgba(201,162,75,0.18)' : 'none', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '5px 6px', color: view === 'settings' ? '#C9A24B' : '#6B7494', display: 'flex', alignItems: 'center' }}>
            <Settings size={16} strokeWidth={1.8} />
          </button>
        )}
        {/* Logout icon */}
        <button
          title="Log out"
          onClick={onLogout}
          style={{ background: 'none', border: 'none', cursor: 'pointer', borderRadius: 6, padding: '5px 6px', color: '#6B7494', display: 'flex', alignItems: 'center', marginLeft: 2 }}>
          <LogOut size={16} strokeWidth={1.8} />
        </button>
      </div>
      {/* Signed in as */}
      <div style={{ padding: '0 14px', fontSize: 11, color: '#6B7494', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {user?.email}
      </div>
    </div>
  );

  function renderSidebarContent() {
  // ── Admin / Manager sidebar ───────────────────────────────────────────────
  if (userRole === 'admin' || userRole === 'manager') return (
    <div style={{ ...styles.sidebar, overflowY: 'auto' }} className="no-print">
      {Brand()}

      {/* Switch Activity button — shown when user entered from home screen */}
      {onSwitchActivity && (
        <button
          onClick={onSwitchActivity}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: 'calc(100% - 16px)',
            margin: '0 8px 8px', padding: '7px 12px',
            background: 'rgba(201,162,75,0.13)', border: '1px solid rgba(201,162,75,0.3)',
            borderRadius: 8, color: '#C9A24B', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
          <span style={{ fontSize: 15 }}>⇄</span> Switch Activity
        </button>
      )}

      {/* Dashboard — always at top */}
      <div style={{ ...styles.navGroup, marginBottom: 4 }}>
        <NavBtn id="dashboard" label="Dashboard" icon={LayoutDashboard} />
      </div>

      {isMultiBiz ? (
        /* ── MULTI-BIZ: accordion per business type ──────────────────────── */
        <>
          {/* All Documents — cross-type shortcut */}
          <div style={{ padding: '2px 6px 6px' }}>
            <NavBtn id="documents" label="All Documents" icon={FileText} />
          </div>

          {/* One BizSection per active type */}
          {activeTypes.map((bt, idx) => (
            <BizSection key={bt} bizType={bt} defaultOpen={idx === 0}>

              {/* ── TRADING ─────────────────────────────────────────── */}
              {bt === 'trading' && <>
                <SubLabel label="Sales" />
                <NavBtn id="customers"       label="Customers"         icon={Users} />
                <NavBtn id="enquiries"       label="Enquiries"         icon={FileSignature} />
                <NavBtn id="channelpartners" label="Channel Partners"  icon={Briefcase} />
                <CreateBtn docKey="quotation"    bizType="trading" />
                <CreateBtn docKey="invoice"      bizType="trading" />
                <CreateBtn docKey="creditnote"   bizType="trading" />
                <CreateBtn docKey="delivery"     bizType="trading" />
                <CreateBtn docKey="packing_list" bizType="trading" />

                <SubLabel label="Purchase" />
                <NavBtn id="vendors" label="Vendors" icon={Truck} />
                <CreateBtn docKey="purchase"     bizType="trading" />
                <CreateBtn docKey="purchasebill" bizType="trading" />
                <NavBtn id="grn" label="Goods Receipt (GRN)" icon={Truck} />

                <SubLabel label="Stores" />
                <NavBtn id="items"       label="Items"                icon={Package} />
                <NavBtn id="stock"       label="Stock Position"       icon={ClipboardList} />
                <NavBtn id="stockledger" label="Stock Ledger"         icon={FileText} />
                <NavBtn id="storeissue"  label="Stores Issue Voucher" icon={FileMinus} />
                <NavBtn id="verticalrack" label="Vertical Rack"        icon={Layers} />
                <NavBtn id="bincard"     label="Bin Card"             icon={ClipboardList} />

                <SubLabel label="Assets" />
                <NavBtn id="assetregister" label="Asset Register" icon={Package} />

                <SubLabel label="Accounts" />
                <NavBtn id="pettycash" label="Petty Cash" icon={FileMinus} />
                <NavBtn id="vouchers"  label="Vouchers"   icon={FileSignature} />
                {country === 'india' && <NavBtn id="gstr1"  label="GSTR-1 Report" icon={FileText} />}
                {country === 'india' && <NavBtn id="gstr3b" label="GSTR-3B Return" icon={FileText} />}
                {['uae','saudi','bahrain','oman'].includes(country) && <NavBtn id="vatreport" label="VAT Return" icon={FileText} />}
                {COUNTRY_CONFIG[country]?.hasTax && !['india','uae','saudi','bahrain','oman'].includes(country) && <NavBtn id="taxreport" label="Tax Report" icon={FileText} />}
                <NavBtn id="audit" label="P&L Audit" icon={BarChart2} />

                <SubLabel label="HR & Payroll" />
                <NavBtn id="employees"      label="Employees"           icon={Users} />
                <NavBtn id="siteattendance" label="Site Attendance"     icon={Users} />
                <NavBtn id="payroll"        label="Payroll"             icon={FileText} />
                <NavBtn id="offerletter"    label="Offer Letters"       icon={FileText} />
                <NavBtn id="warnletter"     label="Warning Letters"     icon={AlertTriangle} />
                <NavBtn id="termletter"     label="Termination Letters" icon={FileSignature} />
                <SubLabel label="Admin" />
                <NavBtn id="staff"        label="Staff"         icon={Shield} />
                <NavBtn id="contracts"    label="Contracts"     icon={FileSignature} />
                <NavBtn id="termslibrary" label="Terms Library" icon={BookOpen} />
              </>}

              {/* ── MANUFACTURING ───────────────────────────────────── */}
              {bt === 'manufacturing' && <>
                <SubLabel label="Sales" />
                <NavBtn id="customers"     label="Customers" icon={Users} />
                <NavBtn id="enquiries"     label="Enquiries" icon={FileSignature} />
                <NavBtn id="serviceorders" label="SAS"       icon={Briefcase} />
                <CreateBtn docKey="quotation"  bizType="manufacturing" />
                <CreateBtn docKey="invoice"    bizType="manufacturing" />
                <CreateBtn docKey="creditnote" bizType="manufacturing" />

                <SubLabel label="Purchase" />
                <NavBtn id="vendors"    label="Vendors"            icon={Truck} />
                <NavBtn id="vendoreval" label="Vendor Evaluation"  icon={CheckSquare} />
                <CreateBtn docKey="purchase"     bizType="manufacturing" />
                <CreateBtn docKey="purchasebill" bizType="manufacturing" />
                <NavBtn id="grn" label="Goods Receipt (GRN)" icon={Truck} />

                <SubLabel label="Stores" />
                <NavBtn id="items"        label="Items"                icon={Package} />
                <NavBtn id="rawmaterials" label="Raw Materials"        icon={Package} />
                <NavBtn id="stock"        label="Stock Position"       icon={ClipboardList} />
                <NavBtn id="stockledger"  label="Stock Ledger"         icon={FileText} />
                <NavBtn id="storeissue"   label="Stores Issue Voucher" icon={FileMinus} />
                <NavBtn id="verticalrack"  label="Vertical Rack"        icon={Layers} />
                <NavBtn id="bincard"      label="Bin Card"             icon={ClipboardList} />

                <SubLabel label="Engineering" />
                <NavBtn id="partsmaster" label="Parts Master"  icon={Wrench} />
                <NavBtn id="engdocs"     label="Eng Documents" icon={BookOpen} />

                <SubLabel label="Production" />
                <NavBtn id="bom"              label="Bill of Materials" icon={ClipboardList} />
                <NavBtn id="productionorders" label="Production Orders" icon={Factory} />

                <SubLabel label="Quality" />
                <NavBtn id="isoprinciples"  label="ISO Principles"    icon={CheckCircle} />
                <NavBtn id="deptprocedures" label="Dept Procedures"   icon={BookOpen} />
                <NavBtn id="inprocessqa"    label="Inprocess QA"      icon={CheckSquare} />
                <NavBtn id="qatesting"      label="QA Testing"        icon={CheckCircle} />
                <NavBtn id="capa"           label="CAPA"              icon={AlertTriangle} />
                <NavBtn id="internalaudit"  label="Internal Audit"    icon={ClipboardList} />
                <NavBtn id="mis"            label="MIS / Mgmt Review" icon={BarChart2} />

                <SubLabel label="Assets" />
                <NavBtn id="assetregister" label="Asset Register" icon={Package} />

                <SubLabel label="Accounts" />
                <NavBtn id="pettycash" label="Petty Cash" icon={FileMinus} />
                <NavBtn id="vouchers"  label="Vouchers"   icon={FileSignature} />
                {country === 'india' && <NavBtn id="gstr1"  label="GSTR-1 Report" icon={FileText} />}
                {country === 'india' && <NavBtn id="gstr3b" label="GSTR-3B Return" icon={FileText} />}
                {['uae','saudi','bahrain','oman'].includes(country) && <NavBtn id="vatreport" label="VAT Return" icon={FileText} />}
                {COUNTRY_CONFIG[country]?.hasTax && !['india','uae','saudi','bahrain','oman'].includes(country) && <NavBtn id="taxreport" label="Tax Report" icon={FileText} />}
                <NavBtn id="audit" label="P&L Audit" icon={BarChart2} />

                <SubLabel label="HR & Payroll" />
                <NavBtn id="employees"      label="Employees"           icon={Users} />
                <NavBtn id="siteattendance" label="Site Attendance"     icon={Users} />
                <NavBtn id="payroll"        label="Payroll"             icon={FileText} />
                <NavBtn id="offerletter"    label="Offer Letters"       icon={FileText} />
                <NavBtn id="warnletter"     label="Warning Letters"     icon={AlertTriangle} />
                <NavBtn id="termletter"     label="Termination Letters" icon={FileSignature} />
                <SubLabel label="Admin" />
                <NavBtn id="staff"        label="Staff"         icon={Shield} />
                <NavBtn id="contracts"    label="Contracts"     icon={FileSignature} />
                <NavBtn id="termslibrary" label="Terms Library" icon={BookOpen} />
              </>}

              {/* ── MEP / SERVICE ────────────────────────────────────── */}
              {(bt === 'service' || bt === 'fmamc') && <>
                <SubLabel label="Sales" />
                <NavBtn id="customers"   label="Customers"     icon={Users} />
                <CreateBtn docKey="quotation"  bizType={bt} />
                <CreateBtn docKey="invoice"    bizType={bt} />
                <NavBtn id="rabilling"   label="RA Billing"         icon={FileMinus} />
                <NavBtn id="mepbom"      label="Project BOM"        icon={ClipboardList} />
                <NavBtn id="scopeofwork" label="Service Catalogue"  icon={BookOpen} />

                <SubLabel label="Purchase" />
                <NavBtn id="vendors"        label="Vendors"        icon={Truck} />
                <CreateBtn docKey="purchase"     bizType={bt} />
                <CreateBtn docKey="purchasebill" bizType={bt} />
                <NavBtn id="subcontractors" label="Subcontractors" icon={Truck} />
                <NavBtn id="grn"            label="Goods Receipt (GRN)" icon={Truck} />

                <SubLabel label="Stores" />
                <NavBtn id="items"       label="Item Master"          icon={Package} />
                <NavBtn id="stock"       label="Stock Position"       icon={ClipboardList} />
                <NavBtn id="stockledger" label="Stock Ledger"         icon={FileText} />
                <NavBtn id="storeissue"  label="Stores Issue Voucher" icon={FileMinus} />
                <NavBtn id="verticalrack" label="Vertical Rack"        icon={Layers} />
                <NavBtn id="bincard"     label="Bin Card"             icon={ClipboardList} />

                <SubLabel label="Site Operations" />
                <NavBtn id="siteprojects"    label="Projects"           icon={MapPin} />
                <NavBtn id="tender"          label="Tender & Estimation" icon={FileText} />
                <NavBtn id="activityplanner" label="Activity Planner"   icon={ClipboardList} />
                  <NavBtn id="progressboard"   label="Progress Board"     icon={BarChart2} />
                <NavBtn id="clientmaterials" label="Client Materials"   icon={Package} />

                <SubLabel label="Assets" />
                <NavBtn id="assetregister" label="Asset Register" icon={Package} />

                {bt === 'fmamc' && <>
                  <SubLabel label="FM Suite" />
                  <NavBtn id="fmkpi"         label="KPI Dashboard"  icon={BarChart2} />
                  <NavBtn id="assetregister" label="Asset Register"  icon={Package} />
                  <NavBtn id="pmschedules"   label="PM Schedules"    icon={ClipboardList} />
                  <NavBtn id="fmworkorders"  label="Work Orders"     icon={Wrench} />
                  <NavBtn id="amccontracts"  label="AMC Contracts"   icon={FileSignature} />
                  <NavBtn id="fmspareparts"  label="Spare Parts"     icon={Package} />
                </>}

                <SubLabel label="Compliance" />
                <NavBtn id="hse"            label="HSE"              icon={Shield} />
                <NavBtn id="tcommissioning" label="T&C"              icon={CheckCircle} />
                <NavBtn id="handover"       label="Handover / DLP"   icon={CheckSquare} />
                <NavBtn id="evaluation"     label="Quarterly Review" icon={BarChart2} />
                <NavBtn id="mepreports"     label="MEP Reports"      icon={FileText} />

                <SubLabel label="Accounts" />
                <NavBtn id="pettycash" label="Petty Cash" icon={FileMinus} />
                <NavBtn id="vouchers"  label="Vouchers"   icon={FileSignature} />
                {country === 'india' && <NavBtn id="gstr1"  label="GSTR-1 Report" icon={FileText} />}
                {country === 'india' && <NavBtn id="gstr3b" label="GSTR-3B Return" icon={FileText} />}
                {['uae','saudi','bahrain','oman'].includes(country) && <NavBtn id="vatreport" label="VAT Return" icon={FileText} />}
                {COUNTRY_CONFIG[country]?.hasTax && !['india','uae','saudi','bahrain','oman'].includes(country) && <NavBtn id="taxreport" label="Tax Report" icon={FileText} />}
                <NavBtn id="audit" label="P&L Audit" icon={BarChart2} />

                <SubLabel label="HR & Payroll" />
                <NavBtn id="employees"      label="Employees"           icon={Users} />
                <NavBtn id="siteattendance" label="Site Attendance"     icon={Users} />
                <NavBtn id="payroll"        label="Payroll"             icon={FileText} />
                <NavBtn id="offerletter"    label="Offer Letters"       icon={FileText} />
                <NavBtn id="warnletter"     label="Warning Letters"     icon={AlertTriangle} />
                <NavBtn id="termletter"     label="Termination Letters" icon={FileSignature} />
                <SubLabel label="Admin" />
                <NavBtn id="staff"        label="Staff"         icon={Shield} />
                <NavBtn id="contracts"    label="Contracts"     icon={FileSignature} />
                <NavBtn id="termslibrary" label="Terms Library" icon={BookOpen} />
              </>}

            </BizSection>
          ))}
        </>
      ) : (
        /* ── SINGLE BIZ: existing flat-section layout (unchanged) ──────── */
        <>
          <div style={{ ...styles.navGroup, marginBottom: 4 }}>
            <NavBtn id="documents" label="All Documents" icon={FileText} />
          </div>

          {/* Sales */}
          <Section sectionKey="sales" label="Sales">
            <NavBtn id="customers" label="Customers"    icon={Users} />
            <NavBtn id="enquiries" label="Enquiries"    icon={FileSignature} />
            {!showService && <NavBtn id="channelpartners" label="Channel Partners" icon={Briefcase} />}
            {showProduction && <NavBtn id="serviceorders" label="SAS" icon={Briefcase} />}
            <CreateBtn docKey="quotation" />
          </Section>

          {/* Accounts */}
          <Section sectionKey="accounts" label="Accounts">
            <CreateBtn docKey="invoice" />
            <CreateBtn docKey="creditnote" />
            <NavBtn id="pettycash" label="Petty Cash"  icon={FileMinus} />
            <NavBtn id="vouchers"  label="Vouchers"    icon={FileSignature} />
            {country === 'india' && <NavBtn id="gstr1"  label="GSTR-1 Report" icon={FileText} />}
            {country === 'india' && <NavBtn id="gstr3b" label="GSTR-3B Return" icon={FileText} />}
            {['uae','saudi','bahrain','oman'].includes(country) && <NavBtn id="vatreport" label="VAT Return" icon={FileText} />}
            {COUNTRY_CONFIG[country]?.hasTax && !['india','uae','saudi','bahrain','oman'].includes(country) && <NavBtn id="taxreport" label="Tax Report" icon={FileText} />}
            <NavBtn id="audit" label="P&L Audit" icon={BarChart2} />
          </Section>

          {/* Purchase */}
          <Section sectionKey="purchase" label="Purchase">
            <NavBtn id="vendors" label="Vendors" icon={Truck} />
            <CreateBtn docKey="purchase" />
            <CreateBtn docKey="purchasebill" />
            <NavBtn id="grn" label="Goods Receipt (GRN)" icon={Truck} />
            {showProduction && <NavBtn id="vendoreval" label="Vendor Evaluation" icon={CheckSquare} />}
          </Section>

          {/* Stores — all biz types */}
          {(showTrade || showService || showFMAMC) && (
            <Section sectionKey="stores" label="Stores">
              <NavBtn id="items" label="Item Master" icon={Package} />
              <CreateBtn docKey="delivery" />
              <CreateBtn docKey="packing_list" />
              <NavBtn id="stock"       label="Stock Position"       icon={ClipboardList} />
              <NavBtn id="stockledger" label="Stock Ledger"         icon={FileText} />
              <NavBtn id="storeissue"  label="Stores Issue Voucher" icon={FileMinus} />
              <NavBtn id="verticalrack" label="Vertical Rack"        icon={Layers} />
              <NavBtn id="bincard"     label="Bin Card"             icon={ClipboardList} />
            </Section>
          )}

          {/* Assets — all biz types */}
          <Section sectionKey="assets" label="Assets">
            <NavBtn id="assetregister" label="Asset Register" icon={Package} />
          </Section>

          {/* Project BOM + Service Catalogue */}
          {(showService || showFMAMC) && (
            <Section sectionKey="scope" label="Projects">
              <NavBtn id="mepbom"      label="Project BOM"       icon={ClipboardList} />
              <NavBtn id="scopeofwork" label="Service Catalogue" icon={BookOpen} />
            </Section>
          )}

          {/* MEP Suite */}
          {showService && (
            <Section sectionKey="site" label="MEP Suite">
              <NavBtn id="siteprojects"    label="Projects"           icon={MapPin} />
              <NavBtn id="tender"          label="Tender & Estimation" icon={FileText} />
              <NavBtn id="activityplanner" label="Activity Planner"   icon={ClipboardList} />
              <NavBtn id="rabilling"       label="RA Billing"         icon={FileMinus} />
              <NavBtn id="subcontractors"  label="Subcontractors"     icon={Truck} />
              <NavBtn id="hse"             label="HSE"                icon={Shield} />
              <NavBtn id="tcommissioning"  label="T&C"                icon={CheckCircle} />
              <NavBtn id="handover"        label="Handover / DLP"     icon={CheckSquare} />
              <NavBtn id="progressboard"   label="Progress Board"     icon={BarChart2} />
              <NavBtn id="clientmaterials" label="Client Materials"   icon={Package} />
              <NavBtn id="evaluation"      label="Quarterly Review"   icon={BarChart2} />
              <NavBtn id="mepreports"      label="MEP Reports"        icon={FileText} />
              <NavBtn id="assetregister"   label="Asset Register"     icon={Package} />
            </Section>
          )}

          {/* Engineering */}
          {showProduction && (
            <Section sectionKey="engineering" label="Engineering">
              <NavBtn id="partsmaster" label="Parts Master"  icon={Wrench} />
              <NavBtn id="engdocs"     label="Eng Documents" icon={BookOpen} />
            </Section>
          )}

          {/* Production */}
          {showProduction && (
            <Section sectionKey="production" label="Production">
              <NavBtn id="rawmaterials"     label="Raw Materials"     icon={Package} />
              <NavBtn id="bom"              label="Bill of Materials" icon={ClipboardList} />
              <NavBtn id="productionorders" label="Production Orders" icon={Factory} />
            </Section>
          )}

          {/* Quality */}
          {showProduction && (
            <Section sectionKey="quality" label="Quality">
              <NavBtn id="isoprinciples"  label="ISO Principles"    icon={CheckCircle} />
              <NavBtn id="deptprocedures" label="Dept Procedures"   icon={BookOpen} />
              <NavBtn id="inprocessqa"    label="Inprocess QA"      icon={CheckSquare} />
              <NavBtn id="qatesting"      label="QA Testing"        icon={CheckCircle} />
              <NavBtn id="capa"           label="CAPA"              icon={AlertTriangle} />
              <NavBtn id="internalaudit"  label="Internal Audit"    icon={ClipboardList} />
              <NavBtn id="mis"            label="MIS / Mgmt Review" icon={BarChart2} />
            </Section>
          )}

          {/* FM / AMC */}
          {showFMAMC && (
            <Section sectionKey="fmamc" label="FM Suite">
              <NavBtn id="fmkpi"         label="KPI Dashboard"  icon={BarChart2} />
              <NavBtn id="assetregister" label="Asset Register"  icon={Package} />
              <NavBtn id="pmschedules"   label="PM Schedules"    icon={ClipboardList} />
              <NavBtn id="fmworkorders"  label="Work Orders"     icon={Wrench} />
              <NavBtn id="amccontracts"  label="AMC Contracts"   icon={FileSignature} />
              <NavBtn id="fmspareparts"  label="Spare Parts"     icon={Package} />
            </Section>
          )}
        </>
      )}

      {/* HR & Payroll — single biz only; multi-biz gets HR inside each BizSection */}
      {!isMultiBiz && (
        <Section sectionKey="hr" label="HR & Payroll">
          <NavBtn id="employees"      label="Employees"           icon={Users} />
          <NavBtn id="siteattendance" label="Site Attendance"     icon={Users} />
          <NavBtn id="payroll"        label="Payroll"             icon={FileText} />
          <NavBtn id="offerletter"    label="Offer Letters"       icon={FileText} />
          <NavBtn id="warnletter"     label="Warning Letters"     icon={AlertTriangle} />
          <NavBtn id="termletter"     label="Termination Letters" icon={FileSignature} />
        </Section>
      )}

      {/* Admin — single biz only; multi-biz gets Admin inside each BizSection */}
      {!isMultiBiz && userRole === 'admin' && (
        <Section sectionKey="admin" label="Admin">
          <NavBtn id="staff"        label="Staff"         icon={Shield} />
          <NavBtn id="contracts"    label="Contracts"     icon={FileSignature} />
          <NavBtn id="termslibrary" label="Terms Library" icon={BookOpen} />
        </Section>
      )}

      <SidebarFooter syncStatus={syncStatus} user={user} userRole={userRole} onLogout={onLogout} view={view} setView={setView} unreadCount={unreadCount} onShowNotifications={onShowNotifications} />
    </div>
  );

  // ── Sales staff ───────────────────────────────────────────────────────────
  if (userRole === 'sales') return (
    <div style={{ ...styles.sidebar, overflowY: 'auto' }} className="no-print">
      {Brand()}

      {/* Switch Activity button */}
      {onSwitchActivity && (
        <button
          onClick={onSwitchActivity}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: 'calc(100% - 16px)',
            margin: '0 8px 8px', padding: '7px 12px',
            background: 'rgba(201,162,75,0.13)', border: '1px solid rgba(201,162,75,0.3)',
            borderRadius: 8, color: '#C9A24B', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
          <span style={{ fontSize: 15 }}>⇄</span> Switch Activity
        </button>
      )}
      <div style={styles.navGroup}>
        <NavBtn id="dashboard" label="Dashboard" icon={LayoutDashboard} />
      </div>
      <Section sectionKey="sales" label="Sales">
        <NavBtn id="customers" label="Customers"     icon={Users} />
        <NavBtn id="enquiries" label="Enquiries"     icon={FileSignature} />
        <NavBtn id="items"     label="Items"         icon={Package} />
        <NavBtn id="documents" label="My Documents"  icon={FileText} />
        <CreateBtn docKey="quotation" />
        <CreateBtn docKey="invoice" />
        <CreateBtn docKey="delivery" />
        <CreateBtn docKey="packing_list" />
        <CreateBtn docKey="creditnote" />
      </Section>
      <SidebarFooter syncStatus={syncStatus} user={user} userRole={userRole} onLogout={onLogout} view={view} setView={setView} unreadCount={unreadCount} onShowNotifications={onShowNotifications} />
    </div>
  );

  // ── Purchase staff ────────────────────────────────────────────────────────
  if (userRole === 'purchase') return (
    <div style={{ ...styles.sidebar, overflowY: 'auto' }} className="no-print">
      {Brand()}

      {/* Switch Activity button */}
      {onSwitchActivity && (
        <button
          onClick={onSwitchActivity}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: 'calc(100% - 16px)',
            margin: '0 8px 8px', padding: '7px 12px',
            background: 'rgba(201,162,75,0.13)', border: '1px solid rgba(201,162,75,0.3)',
            borderRadius: 8, color: '#C9A24B', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
          <span style={{ fontSize: 15 }}>⇄</span> Switch Activity
        </button>
      )}
      <div style={styles.navGroup}>
        <NavBtn id="dashboard" label="Dashboard" icon={LayoutDashboard} />
      </div>
      <Section sectionKey="purchase" label="Purchase">
        <NavBtn id="vendors"   label="Vendors"          icon={Truck} />
        <NavBtn id="grn"       label="GRN"              icon={Truck} />
        <NavBtn id="items"     label="Items"            icon={Package} />
        <NavBtn id="documents" label="My Documents"     icon={FileText} />
        <CreateBtn docKey="purchase" />
        <CreateBtn docKey="purchasebill" />
      </Section>
      <SidebarFooter syncStatus={syncStatus} user={user} userRole={userRole} onLogout={onLogout} view={view} setView={setView} unreadCount={unreadCount} onShowNotifications={onShowNotifications} />
    </div>
  );

  // ── Inventory staff ───────────────────────────────────────────────────────
  if (userRole === 'inventory') return (
    <div style={{ ...styles.sidebar, overflowY: 'auto' }} className="no-print">
      {Brand()}

      {/* Switch Activity button */}
      {onSwitchActivity && (
        <button
          onClick={onSwitchActivity}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: 'calc(100% - 16px)',
            margin: '0 8px 8px', padding: '7px 12px',
            background: 'rgba(201,162,75,0.13)', border: '1px solid rgba(201,162,75,0.3)',
            borderRadius: 8, color: '#C9A24B', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
          <span style={{ fontSize: 15 }}>⇄</span> Switch Activity
        </button>
      )}
      <div style={styles.navGroup}>
        <NavBtn id="dashboard" label="Dashboard" icon={LayoutDashboard} />
        <NavBtn id="documents" label="Documents"  icon={FileText} />
      </div>
      {showTrade && (
        <Section sectionKey="stores" label="Stores">
          <NavBtn id="items"       label="Items"          icon={Package} />
          <NavBtn id="stock"       label="Stock Position"      icon={Package} />
          <NavBtn id="stockledger" label="Stock Ledger"        icon={ClipboardList} />
          <NavBtn id="grn"         label="GRN"                icon={Truck} />
          <NavBtn id="storeissue"  label="Stores Issue Voucher" icon={FileMinus} />
        </Section>
      )}
      {showProduction && (
        <Section sectionKey="production" label="Production">
          <NavBtn id="rawmaterials"     label="Raw Materials"     icon={Package} />
          <NavBtn id="productionorders" label="Production Orders" icon={Factory} />
        </Section>
      )}
      {showProduction && (
        <Section sectionKey="quality" label="Quality">
          <NavBtn id="qatesting" label="QA Testing" icon={CheckCircle} />
        </Section>
      )}
      <SidebarFooter syncStatus={syncStatus} user={user} userRole={userRole} onLogout={onLogout} view={view} setView={setView} unreadCount={unreadCount} onShowNotifications={onShowNotifications} />
    </div>
  );

  // ── Accounts staff ────────────────────────────────────────────────────────
  if (userRole === 'accounts') return (
    <div style={{ ...styles.sidebar, overflowY: 'auto' }} className="no-print">
      {Brand()}

      {/* Switch Activity button */}
      {onSwitchActivity && (
        <button
          onClick={onSwitchActivity}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: 'calc(100% - 16px)',
            margin: '0 8px 8px', padding: '7px 12px',
            background: 'rgba(201,162,75,0.13)', border: '1px solid rgba(201,162,75,0.3)',
            borderRadius: 8, color: '#C9A24B', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
          <span style={{ fontSize: 15 }}>⇄</span> Switch Activity
        </button>
      )}
      <div style={styles.navGroup}>
        <NavBtn id="dashboard" label="Dashboard"     icon={LayoutDashboard} />
        <NavBtn id="documents" label="All Documents" icon={FileText} />
      </div>
      <Section sectionKey="sales" label="Parties">
        <NavBtn id="customers" label="Customers" icon={Users} />
        <NavBtn id="vendors"   label="Vendors"   icon={Truck} />
      </Section>
      <Section sectionKey="accounts" label="Accounts">
        <NavBtn id="pettycash" label="Petty Cash" icon={FileMinus} />
        <NavBtn id="vouchers"  label="Vouchers"   icon={FileSignature} />
      </Section>
      <SidebarFooter syncStatus={syncStatus} user={user} userRole={userRole} onLogout={onLogout} view={view} setView={setView} unreadCount={unreadCount} onShowNotifications={onShowNotifications} />
    </div>
  );

  // ── Fallback ──────────────────────────────────────────────────────────────
  return (
    <div style={{ ...styles.sidebar, overflowY: 'auto' }} className="no-print">
      {Brand()}

      {/* Switch Activity button */}
      {onSwitchActivity && (
        <button
          onClick={onSwitchActivity}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, width: 'calc(100% - 16px)',
            margin: '0 8px 8px', padding: '7px 12px',
            background: 'rgba(201,162,75,0.13)', border: '1px solid rgba(201,162,75,0.3)',
            borderRadius: 8, color: '#C9A24B', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
          <span style={{ fontSize: 15 }}>⇄</span> Switch Activity
        </button>
      )}
      <div style={styles.navGroup}>
        <NavBtn id="dashboard" label="Dashboard" icon={LayoutDashboard} />
        <NavBtn id="documents" label="Documents"  icon={FileText} />
      </div>
      <SidebarFooter syncStatus={syncStatus} user={user} userRole={userRole} onLogout={onLogout} view={view} setView={setView} unreadCount={unreadCount} onShowNotifications={onShowNotifications} />
    </div>
  );
  }  // end renderSidebarContent
  return <SidebarCtx.Provider value={sbCtx}>{renderSidebarContent()}</SidebarCtx.Provider>;
}



export function SidebarFooter({ syncStatus, unreadCount, onShowNotifications, view }) {
  return (
    <>
      <div style={{ flex: 1 }} />
      {/* Notification Bell */}
      <button onClick={onShowNotifications} style={{
        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        background: view === 'notifications' ? 'rgba(255,255,255,0.12)' : 'transparent',
        border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
        color: '#E8E6DE', fontSize: 13, marginBottom: 4, position: 'relative',
      }}>
        <span style={{ fontSize: 16 }}>🔔</span>
        <span>Notifications</span>
        {unreadCount > 0 && (
          <span style={{
            background: '#C9A24B', color: '#fff', borderRadius: 10,
            fontSize: 10, fontWeight: 700, padding: '1px 6px', marginLeft: 'auto',
            minWidth: 18, textAlign: 'center',
          }}>{unreadCount}</span>
        )}
      </button>
      <div style={styles.syncBox}>
        {syncStatus === 'syncing' && <><Cloud size={14} color="#A9B0C9" /><span>Syncing…</span></>}
        {syncStatus === 'synced'  && <><Cloud size={14} color="#7FBF96" /><span>Synced</span></>}
        {syncStatus === 'error'   && <><CloudOff size={14} color="#E08A7D" /><span>Sync error</span></>}
        {syncStatus === 'idle'    && <><Cloud size={14} color="#A9B0C9" /><span>Connecting…</span></>}
      </div>
    </>
  );
}

// ─── HSN Search ────────────────────────────────────────────────



export const COMMON_HSN = [
  { code: '1001', desc: 'Wheat and meslin' },
  { code: '1006', desc: 'Rice' },
  { code: '2201', desc: 'Water (including natural / artificial mineral water)' },
  { code: '2710', desc: 'Petroleum oils and oils from bituminous minerals' },
  { code: '3004', desc: 'Medicaments (medicines)' },
  { code: '3401', desc: 'Soap and organic surface-active products' },
  { code: '3923', desc: 'Plastic articles for the conveyance or packing of goods' },
  { code: '4016', desc: 'Other articles of vulcanised rubber' },
  { code: '4901', desc: 'Printed books, brochures, leaflets' },
  { code: '6101', desc: 'Men\'s overcoats, car-coats, cloaks' },
  { code: '6109', desc: 'T-shirts, singlets and other vests' },
  { code: '6403', desc: 'Footwear with outer soles of rubber/plastics, leather uppers' },
  { code: '7108', desc: 'Gold (unwrought or semi-manufactured)' },
  { code: '7113', desc: 'Jewellery and parts thereof, of precious metal' },
  { code: '7323', desc: 'Table, kitchen or other household articles of iron / steel' },
  { code: '8414', desc: 'Air or vacuum pumps, fans, ventilating hoods' },
  { code: '8415', desc: 'Air conditioning machines' },
  { code: '8418', desc: 'Refrigerators, freezers and other refrigerating equipment' },
  { code: '8443', desc: 'Printing machinery; inkjet printing machines' },
  { code: '8450', desc: 'Household or laundry type washing machines' },
  { code: '8471', desc: 'Automatic data processing machines (computers)' },
  { code: '8517', desc: 'Telephone sets; smartphones' },
  { code: '8518', desc: 'Microphones, loudspeakers, headphones' },
  { code: '8528', desc: 'Monitors and projectors; TV reception apparatus' },
  { code: '8703', desc: 'Motor cars and vehicles for transport of persons' },
  { code: '8704', desc: 'Motor vehicles for transport of goods' },
  { code: '9403', desc: 'Other furniture and parts thereof' },
  { code: '9503', desc: 'Tricycles, scooters, toy cars and similar wheeled toys' },
  // SAC codes (services)
  { code: '9954', desc: 'Construction services' },
  { code: '9961', desc: 'Services in wholesale trade' },
  { code: '9962', desc: 'Services in retail trade' },
  { code: '9971', desc: 'Financial and related services' },
  { code: '9972', desc: 'Real estate services' },
  { code: '9973', desc: 'Leasing or rental services' },
  { code: '9981', desc: 'Research and development services' },
  { code: '9982', desc: 'Legal and accounting services' },
  { code: '9983', desc: 'Other professional/technical/business services' },
  { code: '9984', desc: 'Telecommunications and IT services' },
  { code: '9985', desc: 'Support services' },
  { code: '9986', desc: 'Agricultural support services' },
  { code: '9987', desc: 'Maintenance, repair and installation services' },
  { code: '9988', desc: 'Manufacturing services on physical inputs owned by others' },
  { code: '9989', desc: 'Other manufacturing services' },
  { code: '9991', desc: 'Public administration and other services' },
  { code: '9992', desc: 'Education services' },
  { code: '9993', desc: 'Human health and social care services' },
  { code: '9994', desc: 'Sewage and waste collection, treatment and disposal' },
  { code: '9995', desc: 'Services of membership organisations' },
  { code: '9996', desc: 'Recreational, cultural and sporting services' },
  { code: '9997', desc: 'Other services' },
];



export function HsnSearchModal({ onSelect, onClose }) {
  const [q, setQ] = useState('');
  const results = q.length < 2 ? COMMON_HSN.slice(0, 20) : COMMON_HSN.filter(h =>
    h.code.startsWith(q) || h.desc.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <Modal onClose={onClose} title="HSN / SAC Code Lookup">
      <div style={{ marginBottom: 10 }}>
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search by code or description…"
          style={{ ...styles.input, width: '100%' }}
        />
      </div>
      <div style={{ maxHeight: 320, overflowY: 'auto', fontSize: 13 }}>
        {results.length === 0 && <div style={styles.emptyBox}>No results. <a href="https://www.cbic-gst.gov.in/gst-goods-services-rates.html" target="_blank" rel="noreferrer" style={{ color: '#1A56DB' }}>Search on CBIC portal →</a></div>}
        {results.map(h => (
          <div key={h.code} onClick={() => onSelect(h.code)} style={{ display: 'flex', gap: 12, padding: '8px 10px', borderRadius: 6, cursor: 'pointer', borderBottom: '1px solid #F0EDE6' }}
            onMouseEnter={e => e.currentTarget.style.background = '#F5F3EE'}
            onMouseLeave={e => e.currentTarget.style.background = ''}>
            <span style={{ fontWeight: 700, color: '#1E2A4A', minWidth: 52, flexShrink: 0 }}>{h.code}</span>
            <span style={{ color: '#555' }}>{h.desc}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 10, fontSize: 12, color: '#888780' }}>
        Can't find your code? <a href="https://www.cbic-gst.gov.in/gst-goods-services-rates.html" target="_blank" rel="noreferrer" style={{ color: '#1A56DB' }}>Search full CBIC database →</a>
      </div>
    </Modal>
  );
}

// ─── DocEditor ─────────────────────────────────────────────────

// ─── MEP Invoice Picker ──────────────────────────────────────────────────────


export function MEPInvoicePicker({ siteProjects, siteActivities, progressUpdates, onClose, onLoad }) {
  const [selProject, setSelProject] = React.useState(siteProjects[0]?.id || '');
  const [selected, setSelected] = React.useState({});
  const project = siteProjects.find(p => p.id === selProject);
  const acts = siteActivities.filter(a => a.projectId === selProject && (a.contractValue||0) > 0);

  function getProgress(actId) {
    const logs = progressUpdates.filter(u => u.activityId === actId);
    if (!logs.length) return 0;
    return Math.max(...logs.map(u => parseFloat(u.cumProgress)||0));
  }

  function toggle(id) { setSelected(p => ({ ...p, [id]: !p[id] })); }
  function selectAll() {
    const all = {};
    acts.forEach(a => { all[a.id] = true; });
    setSelected(all);
  }

  function handleLoad() {
    const villas = project?.villas || [];
    const lineItems = acts.filter(a => selected[a.id]).map(a => {
      const villa = villas.find(v => v.id === a.villaId);
      const pct = getProgress(a.id);
      const amount = ((a.contractValue || 0) * pct / 100);
      return {
        id: crypto.randomUUID(),
        itemId: '',
        name: `${villa ? villa.name + ' — ' : ''}${a.discipline} — ${a.name} (${pct}% complete)`,
        hsn: '', qty: 1, rate: Math.round(amount * 100) / 100,
        unit: 'nos', discount: 0, tax: 0,
        packages: 1, netWeight: 0, grossWeight: 0, dimensions: '',
      };
    });
    onLoad(lineItems);
  }

  return (
    <Modal onClose={onClose} title="📋 Load Activities into Invoice" width={580}>
      <div style={{ marginBottom: 12 }}>
        <label style={styles.label}>Project</label>
        <select value={selProject} onChange={e => { setSelProject(e.target.value); setSelected({}); }} style={styles.input}>
          {siteProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {acts.length === 0 ? (
        <div style={{ color: '#aaa', fontSize: 13, padding: '12px 0' }}>
          No activities with Contract Value set for this project.<br />
          Go to <strong>Activity Planner → Edit activity</strong> and set the Contract Value first.
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, color: '#888' }}>{acts.length} activities with contract value</span>
            <button onClick={selectAll} style={styles.ghostBtn}>Select all</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
            {acts.map(a => {
              const pct = getProgress(a.id);
              const amount = ((a.contractValue || 0) * pct / 100);
              const villa = (project?.villas||[]).find(v => v.id === a.villaId);
              return (
                <div key={a.id} onClick={() => toggle(a.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8,
                    border: selected[a.id] ? '2px solid #1E7A9A' : '1px solid #EAE6DB',
                    background: selected[a.id] ? '#E0F2F9' : '#FAFAF8', cursor: 'pointer' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: selected[a.id] ? '2px solid #1E7A9A' : '2px solid #ccc',
                    background: selected[a.id] ? '#1E7A9A' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {selected[a.id] && <span style={{ color: '#fff', fontSize: 12 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{villa ? villa.name + ' — ' : ''}{a.discipline} — {a.name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{a.phase} · {pct}% complete · Contract: {(a.contractValue||0).toLocaleString()}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontWeight: 700, fontSize: 13, color: '#1E2A4A' }}>
                    {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} style={styles.ghostBtn}>Cancel</button>
            <button onClick={handleLoad} disabled={!Object.values(selected).some(Boolean)}
              style={{ ...styles.primaryBtn, background: '#1E7A9A', opacity: Object.values(selected).some(Boolean) ? 1 : 0.5 }}>
              ✓ Add {Object.values(selected).filter(Boolean).length} line item(s)
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}




export function DocEditor({ doc, setDoc, customers, vendors, items, businessInfo, userRole, onSave, onCancel, onAddCustomer, onAddVendor, onConvert, onOpenDoc, documents = [], siteActivities = [], siteProjects = [], progressUpdates = [] }) {
  // All hooks MUST come before any conditional returns (React Rules of Hooks)
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectionNote, setRejectionNote] = useState('');
  const [hsnSearchRow, setHsnSearchRow] = useState(null); // rowId being searched
  const [mepPickerOpen, setMepPickerOpen] = useState(false);
  const [useLH, setUseLH] = useState(!!(businessInfo?.letterhead||businessInfo?.letterheadHtml));
  const [showScan, setShowScan] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const bizBadge = BIZ_BADGE[doc.bizType];
  const showBizBadge = !!bizBadge;

  const t = DOC_TYPES[doc.type];
  if (!t) return <div style={{ padding: 32, color: '#B5453A' }}>Unknown document type: "{doc.type}". Please go back and try again.</div>;
  const isVendorDoc = t.party === 'vendor';
  const partyList = isVendorDoc ? vendors : customers;
  const totals = computeTotals(doc, businessInfo.state, businessInfo.country);
  const customer = partyList.find((c) => c.id === doc.customerId);
  const displayParty = customer || doc.customerSnapshot; // fallback to snapshot when live record unavailable
  const template = businessInfo.template || 'classic';
  const cc = COUNTRY_CONFIG[businessInfo.country || 'india'];
  const fmt = (n) => currency(n, cc.currency);

  // Field editing rules
  const isApproved = doc.status === 'approved';
  const isForwarded = doc.status === 'submitted' || doc.status === 'verified';
  const inReview = isForwarded; // alias for layout checks below
  // Editable if: admin/manager always, or any role when doc is in draft/rejected (preparing stage)
  const isEditable =
    userRole === 'admin' || userRole === 'manager' ||
    (doc.status === 'draft' || doc.status === 'rejected');

  async function handleSaveAndDownload(status) {
    setPdfLoading(true);
    try {
      const el = document.querySelector('.print-area');
      const fname = `${(DOC_TYPES[doc.type]?.label || doc.type).replace(/\s+/g,'-')}-${doc.number || 'draft'}.pdf`;
      if (el) await downloadDocPDF(el, fname);
    } catch(e) { console.error(e); }
    setPdfLoading(false);
    onSave(status);
  }

  function applyScanData(extracted) {
    setDoc(prev => {
      const updates = {};
      if (extracted.date) updates.date = extracted.date;
      if (extracted.vendorName && !prev.customerName) updates.customerName = extracted.vendorName;
      if (extracted.items?.length) {
        updates.items = extracted.items.map(it => ({
          id: crypto.randomUUID(),
          name: it.name,
          qty: it.qty || 1,
          rate: it.rate || 0,
          gst: it.gst || 18,
          unit: 'pcs',
          itemId: '',
          description: '',
        }));
      }
      return { ...prev, ...updates };
    });
    setShowScan(false);
  }

  function handleReject() {
    onSave('rejected', rejectionNote);
    setRejectMode(false);
    setRejectionNote('');
  }

  function update(field, value) {
    setDoc((d) => ({ ...d, [field]: value }));
  }

  function updateItem(rowId, field, value) {
    setDoc((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === rowId ? { ...it, [field]: value } : it)),
    }));
  }

  function selectItem(rowId, itemId) {
    const master = items.find((i) => i.id === itemId);
    const isVendor = DOC_TYPES[doc.type]?.party === 'vendor';
    const autoRate = master
      ? (isVendor
          ? (master.purchaseRate ?? master.rate ?? 0)
          : (master.saleRate ?? master.rate ?? 0))
      : 0;
    setDoc((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === rowId
        ? { ...it, itemId, name: master ? master.name : it.name, hsn: master ? master.hsn : it.hsn, rate: master ? autoRate : it.rate, gst: master ? master.gst : it.gst }
        : it)),
    }));
  }

  function addRow() {
    setDoc((d) => ({ ...d, items: [...d.items, EMPTY_ITEM_ROW(businessInfo)] }));
  }

  function removeRow(rowId) {
    setDoc((d) => ({ ...d, items: d.items.filter((it) => it.id !== rowId) }));
  }

  function selectCustomer(id) {
    if (id === '__new__') { isVendorDoc ? onAddVendor() : onAddCustomer(); return; }
    const c = partyList.find((x) => x.id === id);
    update('customerId', id);
    setDoc((d) => ({ ...d, customerId: id, customerSnapshot: c || null, placeOfSupply: c ? c.state : d.placeOfSupply }));
  }

  const sameDocs = documents.filter(d => d.type === doc.type && d.id !== doc.id && (d.bizType || 'trading') === (doc.bizType || 'trading'))
    .sort((a, b) => (b.number || '').localeCompare(a.number || ''));

  return (
    <div style={styles.page}>
      <div style={styles.editorTopBar} className="no-print">
        <button onClick={onCancel} style={styles.ghostBtn}><X size={15} /> Cancel</button>
        <div style={styles.editorTitle}>
          <t.icon size={18} color={t.color} />
          <span className="serif">{t.label}</span>
          <StatusBadge status={doc.status} />
            {showBizBadge && bizBadge && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: bizBadge.bg, color: bizBadge.color, letterSpacing: '0.04em' }}>{bizBadge.label}</span>
            )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Previous docs dropdown */}
          {sameDocs.length > 0 && (
            <select value="" onChange={e => { if (e.target.value && onOpenDoc) onOpenDoc(e.target.value); }}
              style={{ fontSize: 12, border: '1px solid #D8D3C8', borderRadius: 6, padding: '5px 8px', background: '#fff', cursor: 'pointer', color: '#1E2A4A' }}>
              <option value="">📄 View {t.label}s ▾</option>
              {sameDocs.map(d => <option key={d.id} value={d.id}>{d.number} · {d.date}</option>)}
            </select>
          )}
          {/* Convert to → dropdown */}
          {onConvert && CONVERT_TO[doc.type] && doc.id && (
            <ConvertDropdown doc={doc} onConvert={onConvert} />
          )}
          <button onClick={() => {
            const t = computeTotals(doc, businessInfo.state, businessInfo.country);
            const party = doc.customerSnapshot?.name || '';
            downloadCSV((doc.number || doc.type) + '.csv',
              ['#','Item','HSN','Qty','Unit','Rate','Disc%','Tax%','Amount'],
              (doc.items || []).map((it,i) => [
                i+1, it.name||'', it.hsn||'', it.qty||'', it.unit||'',
                it.rate||'', it.discount||'', it.tax||'',
                ((parseFloat(it.qty)||0)*(parseFloat(it.rate)||0)).toFixed(2)
              ]).concat([
                ['','','','','','','','Subtotal', t.subtotal.toFixed(2)],
                ['','','','','','','','Tax', t.totalTax.toFixed(2)],
                ['','','','','','','','Grand Total', t.grandTotal.toFixed(2)],
              ])
            );
          }} style={styles.ghostBtn}><Download size={15} /> Export CSV</button>
          {businessInfo?.letterhead && (
            <button onClick={() => setUseLH(v => !v)} style={{ ...styles.ghostBtn, ...(useLH ? { background: '#EEF2FF', color: '#3D52A0', fontWeight: 600 } : {}) }}>
              📃 {useLH ? 'Letterhead ON' : 'Use Letterhead'}
            </button>
          )}
          <button onClick={() => setShowScan(true)} style={styles.ghostBtn}>📷 Scan Bill</button>
          <button onClick={() => window.print()} style={styles.ghostBtn}><Printer size={15} /> Print / PDF</button>
          <button onClick={async () => { setPdfLoading(true); await downloadDocPDF('.print-area', `${(DOC_TYPES[doc.type]?.label||doc.type).replace(/\s+/g,'-')}-${doc.number||'draft'}.pdf`); setPdfLoading(false); }} style={styles.ghostBtn} disabled={pdfLoading}>{pdfLoading ? '⏳' : <Download size={15}/>} {pdfLoading ? 'Generating...' : 'Download PDF'}</button>

          {/* ── PREPARER (any non-admin): draft or rejected → Save / Forward ── */}
          {userRole !== 'admin' && (doc.status === 'draft' || doc.status === 'rejected') && (
            <>
              <button onClick={() => handleSaveAndDownload('draft')} style={styles.ghostBtn}>💾 Save</button>
              <button onClick={() => onSave('submitted')} style={styles.primaryBtn}>Forward for Approval →</button>
            </>
          )}

          {/* ── PREPARER: forwarded — locked, can only view ── */}
          {userRole !== 'admin' && isForwarded && (
            <span style={{ fontSize: 13, color: '#2255A0', fontStyle: 'italic' }}>⏳ Forwarded — awaiting approval</span>
          )}

          {/* ── ADMIN / MANAGER: forwarded or any editable status ── */}
          {(userRole === 'admin' || userRole === 'manager') && !rejectMode && (
            <>
              {/* Can always save as draft */}
              {!isApproved && <button onClick={() => handleSaveAndDownload('draft')} style={styles.ghostBtn}>💾 Save Draft</button>}
              {/* Reject button — shown when forwarded */}
              {isForwarded && (
                <button onClick={() => setRejectMode(true)} style={{ ...styles.ghostBtn, color: '#B5453A', borderColor: '#B5453A' }}>Reject</button>
              )}
              {/* Approve — shown when forwarded; Save changes when already approved */}
              {!isApproved
                ? isForwarded && <button onClick={() => handleSaveAndDownload('approved')} style={{ ...styles.primaryBtn, background: '#3D7A5C' }}>Approve ✓</button>
                : <button onClick={() => handleSaveAndDownload('approved')} style={styles.primaryBtn}>💾 Save changes</button>
              }
              {/* Admin can also forward their own drafts */}
              {userRole === 'admin' && doc.status === 'draft' && (
                <button onClick={() => handleSaveAndDownload('approved')} style={{ ...styles.primaryBtn, background: '#3D7A5C' }}>Approve ✓</button>
              )}
            </>
          )}

          {/* ── Reject inline panel ── */}
          {rejectMode && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: '#FBEAE7', padding: '6px 10px', borderRadius: 8 }}>
              <input
                value={rejectionNote}
                onChange={(e) => setRejectionNote(e.target.value)}
                placeholder="Reason for rejection…"
                style={{ ...styles.input, width: 220, padding: '5px 10px', fontSize: 13 }}
                autoFocus
              />
              <button onClick={handleReject} style={{ ...styles.primaryBtn, background: '#B5453A', padding: '6px 14px' }}>Confirm Reject</button>
              <button onClick={() => { setRejectMode(false); setRejectionNote(''); }} style={styles.iconBtn}><X size={15} /></button>
            </div>
          )}
        </div>
      </div>

      {/* Linked-from banner */}
      {doc.linkedFrom && (
        <div style={{ background: '#F0EEF9', border: '1px solid #C8C0E8', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: '#4A3F8A', display: 'flex', alignItems: 'center', gap: 8 }} className="no-print">
          🔗 <span>Based on <strong>{DOC_TYPES[doc.linkedFrom.docType]?.label}</strong> — {doc.linkedFrom.docNumber}</span>
        </div>
      )}

      {/* Rejection note banner */}
      {doc.status === 'rejected' && doc.rejectionNote && (
        <div style={{ background: '#FBEAE7', border: '1px solid #E9B8B3', borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13 }} className="no-print">
          <strong style={{ color: '#B5453A' }}>Rejected:</strong> <span style={{ color: '#5F5E5A' }}>{doc.rejectionNote}</span>
        </div>
      )}

      {/* Approval status banner for locked docs */}
      {(inReview || isApproved) && (
        <div style={{ background: isApproved ? '#EAF3DE' : '#E6EEF9', border: `1px solid ${isApproved ? '#B8D9A0' : '#B0C8E9'}`, borderRadius: 8, padding: '10px 16px', marginBottom: 12, fontSize: 13, color: isApproved ? '#3B6D11' : '#2255A0' }} className="no-print">
          {isForwarded && '⏳ Forwarded for approval — awaiting admin/manager action'}
          {doc.status === 'approved' && (userRole === 'admin' || userRole === 'manager' ? '✓ Approved — you can edit this document' : '✓ Approved and locked')}
        </div>
      )}

      <div style={styles.editorLayout}>
        <div style={styles.editorForm} className="no-print">
          <div style={styles.formGroup}>
            <label style={styles.label}>Document number</label>
            <input value={doc.number} onChange={(e) => update('number', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ ...styles.formGroup, flex: 1 }}>
              <label style={styles.label}>Date</label>
              <input type="date" value={doc.date} onChange={(e) => update('date', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} />
            </div>
            <div style={{ ...styles.formGroup, flex: 1 }}>
              <label style={styles.label}>Due date</label>
              <input type="date" value={doc.dueDate || ''} onChange={(e) => update('dueDate', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} />
            </div>
          </div>
          {cc.hasTax && (
            <div style={styles.formGroup}>
              <label style={styles.label}>{cc.splitTax ? 'Place of supply (state)' : 'Place of supply'}</label>
              <input value={doc.placeOfSupply} onChange={(e) => update('placeOfSupply', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} />
            </div>
          )}

          <div style={styles.formGroup}>
            <label style={styles.label}>{isVendorDoc ? 'Vendor' : 'Customer'}</label>
            <select value={doc.customerId} onChange={(e) => isEditable && selectCustomer(e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} disabled={!isEditable}>
              <option value="">{isVendorDoc ? 'Select vendor' : 'Select customer'}</option>
              {partyList.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              {isEditable && <option value="__new__">{isVendorDoc ? '+ Add new vendor' : '+ Add new customer'}</option>}
            </select>
          </div>

          {(doc.type === 'purchase' || doc.type === 'purchasebill') && (
            <div style={styles.formGroup}>
              <label style={styles.label}>{doc.type === 'purchase' ? 'Reference / requisition no.' : 'Vendor bill / invoice no.'}</label>
              <input value={doc.refNumber} onChange={(e) => update('refNumber', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} />
            </div>
          )}

          {doc.type === 'packing_list' && (() => {
            const isDomestic = (doc.shipmentType || 'domestic') === 'domestic';
            const billingCustomer = customer;
            const toggleStyle = (active) => ({
              flex: 1, padding: '7px 0', textAlign: 'center', fontSize: 12.5, fontWeight: 600,
              borderRadius: 6, cursor: isEditable ? 'pointer' : 'default', border: 'none',
              background: active ? '#1E2A4A' : 'transparent', color: active ? '#fff' : '#888780',
              transition: 'all 0.15s',
            });
            return (<>
              {/* Shipment type toggle */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Shipment type</label>
                <div style={{ display: 'flex', gap: 4, background: '#F0EDE6', borderRadius: 8, padding: 4 }}>
                  <button style={toggleStyle(isDomestic)} onClick={() => isEditable && update('shipmentType', 'domestic')}>🚛 Domestic (Road)</button>
                  <button style={toggleStyle(!isDomestic)} onClick={() => isEditable && update('shipmentType', 'international')}>🚢 International (Sea / Air)</button>
                </div>
              </div>

              {/* Ship To address */}
              <div style={{ ...styles.formGroup }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ ...styles.label, marginBottom: 0 }}>Ship To (Delivery Address)</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#555', cursor: isEditable ? 'pointer' : 'default' }}>
                    <input type="checkbox" checked={!!doc.shipToSameAsBilling} disabled={!isEditable}
                      onChange={(e) => {
                        const same = e.target.checked;
                        if (same && billingCustomer) {
                          update('shipToSameAsBilling', true);
                          update('shipToName', billingCustomer.name || '');
                          update('shipToAddress', billingCustomer.address || '');
                        } else {
                          update('shipToSameAsBilling', false);
                        }
                      }} />
                    Same as billing address
                  </label>
                </div>
                <input value={doc.shipToName || ''} onChange={(e) => update('shipToName', e.target.value)} style={{ ...styles.input, marginBottom: 6, ...(isEditable && !doc.shipToSameAsBilling ? {} : styles.inputReadOnly) }} readOnly={!isEditable || !!doc.shipToSameAsBilling} placeholder="Company / branch name" />
                <textarea value={doc.shipToAddress || ''} onChange={(e) => update('shipToAddress', e.target.value)} style={{ ...styles.input, minHeight: 55, resize: 'vertical', ...(isEditable && !doc.shipToSameAsBilling ? {} : styles.inputReadOnly) }} readOnly={!isEditable || !!doc.shipToSameAsBilling} placeholder="Factory / warehouse / branch address" />
              </div>

              {/* Domestic fields */}
              {isDomestic && (<>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Vehicle no.</label>
                    <input value={doc.vehicleNo || ''} onChange={(e) => update('vehicleNo', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} placeholder="e.g. TN 01 AB 1234" />
                  </div>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Mode of vehicle</label>
                    <select value={doc.vehicleMode || ''} onChange={(e) => isEditable && update('vehicleMode', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} disabled={!isEditable}>
                      <option value="">Select</option>
                      <option value="Tata Ace">Tata Ace</option>
                      <option value="Half Lorry">Half Lorry</option>
                      <option value="Trailer">Trailer</option>
                      <option value="Two Wheeler">Two Wheeler</option>
                      <option value="Others">Others</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Driver name</label>
                    <input value={doc.driverName || ''} onChange={(e) => update('driverName', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} />
                  </div>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Driver mobile</label>
                    <input value={doc.driverMobile || ''} onChange={(e) => update('driverMobile', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} placeholder="+91 99999 99999" />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Shipping marks / remarks</label>
                  <input value={doc.shippingMarks || ''} onChange={(e) => update('shippingMarks', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} />
                </div>
              </>)}

              {/* International fields */}
              {!isDomestic && (<>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Port of loading</label>
                    <input value={doc.portOfLoading || ''} onChange={(e) => update('portOfLoading', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} placeholder="e.g. Mumbai" />
                  </div>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Port of discharge</label>
                    <input value={doc.portOfDischarge || ''} onChange={(e) => update('portOfDischarge', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} placeholder="e.g. Dubai (Jebel Ali)" />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Vessel / Flight no.</label>
                    <input value={doc.vesselFlight || ''} onChange={(e) => update('vesselFlight', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} />
                  </div>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>B/L or AWB no.</label>
                    <input value={doc.blNumber || ''} onChange={(e) => update('blNumber', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Country of origin</label>
                    <input value={doc.countryOfOrigin || ''} onChange={(e) => update('countryOfOrigin', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} placeholder="e.g. India" />
                  </div>
                  <div style={{ ...styles.formGroup, flex: 1 }}>
                    <label style={styles.label}>Shipping marks</label>
                    <input value={doc.shippingMarks || ''} onChange={(e) => update('shippingMarks', e.target.value)} style={{ ...styles.input, ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} />
                  </div>
                </div>
              </>)}
            </>);
          })()}

          <div style={styles.formGroup}>
            <label style={styles.label}>Notes</label>
            <textarea value={doc.notes} onChange={(e) => update('notes', e.target.value)} style={{ ...styles.input, minHeight: 60, resize: 'vertical', ...(isEditable ? {} : styles.inputReadOnly) }} readOnly={!isEditable} placeholder="Additional notes for this document…" />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>
              Terms &amp; Conditions
              <span style={{ marginLeft: 8, fontSize: 11, color: '#B0AC9F', fontWeight: 400 }}>per document</span>
            </label>
            <textarea
              value={doc.terms || ''}
              onChange={(e) => update('terms', e.target.value)}
              style={{ ...styles.input, minHeight: 70, resize: 'vertical', ...(isEditable ? {} : styles.inputReadOnly) }}
              readOnly={!isEditable}
              placeholder={businessInfo.terms || 'e.g. Payment due within 30 days. Goods once sold cannot be returned.'}
            />
            {isEditable && businessInfo.terms && !doc.terms && (
              <button
                type="button"
                onClick={() => update('terms', businessInfo.terms)}
                style={{ ...styles.ghostBtn, fontSize: 11.5, marginTop: 4, padding: '3px 10px', color: '#888780' }}
              >
                ↓ Copy from profile defaults
              </button>
            )}
          </div>

          {/* Items shortcut — Add line button in left panel */}
          {doc.type !== 'packing_list' && (
            <div style={{ borderTop: '1px solid #EAE6DB', paddingTop: 12, marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ ...styles.label, marginBottom: 0 }}>
                  Line items <span style={{ background: '#EAE6DB', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 600, marginLeft: 6 }}>{doc.items.length}</span>
                </label>
                {isEditable && (
                  <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                    {doc.bizType !== 'service' && (
                      <button onClick={addRow} style={{ ...styles.primaryBtn, fontSize: 12, padding: '5px 12px' }}>
                        <Plus size={13} /> Add item
                      </button>
                    )}
                    {doc.bizType === 'service' && ['invoice','quotation'].includes(doc.type) && (
                      <button onClick={() => setMepPickerOpen(true)} style={{ ...styles.primaryBtn, fontSize: 12, padding: '5px 14px', background: '#1E7A9A' }}>
                        📋 Load from activities
                      </button>
                    )}
                    {doc.bizType === 'service' && !['invoice','quotation'].includes(doc.type) && (
                      <button onClick={addRow} style={{ ...styles.primaryBtn, fontSize: 12, padding: '5px 12px' }}>
                        <Plus size={13} /> Add item
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 260, overflowY: 'auto' }}>
                {doc.items.map((it, i) => (
                  <div key={it.id} style={{ background: '#FAFAF8', borderRadius: 6, padding: '6px 8px', fontSize: 12 }}>
                    {isEditable && items.length > 0 && doc.bizType !== 'service' && (
                      <select
                        value={it.itemId || ''}
                        onChange={(e) => selectItem(it.id, e.target.value)}
                        style={{ width: '100%', border: '1px solid #DDD8CE', borderRadius: 4, fontSize: 11, padding: '3px 6px', marginBottom: 5, background: '#fff', color: '#1E2A4A' }}
                      >
                        <option value="">— Select from items master —</option>
                        {items.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: '#B0AC9F', minWidth: 18, fontSize: 11 }}>{i + 1}</span>
                      <input
                        value={it.name}
                        onChange={(e) => updateItem(it.id, 'name', e.target.value)}
                        placeholder="Item description"
                        readOnly={!isEditable}
                        style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 12, color: '#1E2A4A', outline: 'none', cursor: isEditable ? 'text' : 'default' }}
                      />
                      <input
                        type="number"
                        value={it.qty}
                        onChange={(e) => updateItem(it.id, 'qty', parseFloat(e.target.value) || 0)}
                        readOnly={!isEditable}
                        style={{ width: 36, border: 'none', background: 'transparent', fontSize: 11, color: '#888780', textAlign: 'right', outline: 'none' }}
                        title="Qty"
                      />
                      <span style={{ color: '#ccc', fontSize: 10 }}>×</span>
                      <input
                        type="number"
                        value={it.rate}
                        onChange={(e) => updateItem(it.id, 'rate', parseFloat(e.target.value) || 0)}
                        readOnly={!isEditable}
                        style={{ width: 64, border: 'none', background: 'transparent', fontSize: 11, color: '#888780', textAlign: 'right', outline: 'none' }}
                        title="Rate"
                      />
                      {isEditable && (
                        <button onClick={() => removeRow(it.id)} style={{ ...styles.iconBtn, padding: 2 }}><Trash2 size={12} color="#B5453A" /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mark as paid — admin only, after approval */}
          {userRole === 'admin' && doc.status === 'approved' && doc.type === 'invoice' && (
            <div style={styles.formGroup}>
              <label style={styles.label}>Payment</label>
              <select value={doc.paid ? 'paid' : 'unpaid'} onChange={(e) => update('paid', e.target.value === 'paid')} style={styles.input}>
                <option value="unpaid">Unpaid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          )}
        </div>

        <div style={styles.preview} className="print-area">
          {useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml || businessInfo?.letterheadFooter) && <LetterpadPrintStyle />}
          {useLH && <LetterheadHeader bi={businessInfo} />}
          {/* ── DRAFT watermark — visible on screen + print when not approved ── */}
          {doc.status === 'draft' && (
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              pointerEvents: 'none', zIndex: 9, display: 'flex',
              alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              <span className="draft-watermark" style={{
                fontSize: 110, fontWeight: 900, letterSpacing: 12,
                color: 'rgba(185, 28, 28, 0.10)',
                transform: 'rotate(-35deg)', userSelect: 'none',
                whiteSpace: 'nowrap', fontFamily: 'Arial, sans-serif',
              }}>DRAFT</span>
            </div>
          )}
          {(() => {
            // ── Letterhead mode: skip template header entirely ──
            if (useLH && businessInfo?.letterhead) {
              return (
                <div style={{ textAlign: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #EAE6DB' }}>
                  <div className="serif" style={{ ...styles.previewDocType, color: t.color }}>{t.label}</div>
                  <div style={styles.previewSmall}>No: {doc.number} &nbsp;·&nbsp; Date: {doc.date}{doc.refNumber ? ` · Ref: ${doc.refNumber}` : ''}</div>
                </div>
              );
            }
            const logoStyle = { width: 64, height: 64, objectFit: 'contain', borderRadius: 8, display: 'block' };
            const logoWrap = (dark) => businessInfo.logo ? (
              <div style={{ background: dark ? '#fff' : 'transparent', borderRadius: 10, padding: dark ? 4 : 0, marginRight: 12, flexShrink: 0, alignSelf: 'flex-start' }}>
                <img src={businessInfo.logo} alt="logo" style={logoStyle} />
              </div>
            ) : null;
            const logo = (useLH && businessInfo?.letterhead) ? null : logoWrap(false);
            const logoDark = (useLH && businessInfo?.letterhead) ? null : logoWrap(true);
            const brandInfo = (useLH && businessInfo?.letterhead) ? null : (
              <div>
                <div className="serif" style={styles.previewBrand}>{businessInfo.name}</div>
                <div style={styles.previewSmall}>{businessInfo.address}</div>
                <div style={styles.previewSmall}>{cc.taxIdLabel}: {businessInfo.gstin}</div>
                <div style={styles.previewSmall}>{businessInfo.phone} · {businessInfo.email}{businessInfo.website ? ' · ' + businessInfo.website : ''}</div>
              </div>
            );

            // ── Classic ──
            if (!template || template === 'classic') return (
              <>
                <div style={styles.previewHeader}>
                  <div style={{ ...styles.previewBrandRow, flex: 1, minWidth: 0 }}>{logo}{brandInfo}</div>
                  <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap', paddingLeft: 16 }}>
                    <div className="serif" style={{ ...styles.previewDocType, color: t.color }}>{t.label}</div>
                    <div style={styles.previewSmall}>No: {doc.number}</div>
                    <div style={styles.previewSmall}>Date: {doc.date}</div>
                    {doc.refNumber && <div style={styles.previewSmall}>Ref: {doc.refNumber}</div>}
                  </div>
                </div>
                <div style={styles.previewDivider} />
              </>
            );

            // ── Modern: full-width color band ──
            if (template === 'modern') return (
              <>
                <div style={{ background: t.color, borderRadius: 10, padding: '20px 24px', marginBottom: 20 }}>
                  <div style={styles.previewHeader}>
                    <div style={{ ...styles.previewBrandRow, flex: 1, minWidth: 0 }}>
                      {logoDark}
                      {!(useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml)) && <div>
                        <div className="serif" style={{ ...styles.previewBrand, color: '#fff' }}>{businessInfo.name}</div>
                        <div style={{ ...styles.previewSmall, color: 'rgba(255,255,255,0.8)' }}>{businessInfo.address}</div>
                        <div style={{ ...styles.previewSmall, color: 'rgba(255,255,255,0.8)' }}>{cc.taxIdLabel}: {businessInfo.gstin}</div>
                        <div style={{ ...styles.previewSmall, color: 'rgba(255,255,255,0.8)' }}>{businessInfo.phone} · {businessInfo.email}{businessInfo.website ? ' · ' + businessInfo.website : ''}</div>
                      </div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap', paddingLeft: 16 }}>
                      <div className="serif" style={{ ...styles.previewDocType, color: '#fff' }}>{t.label}</div>
                      <div style={{ ...styles.previewSmall, color: 'rgba(255,255,255,0.8)' }}>No: {doc.number}</div>
                      <div style={{ ...styles.previewSmall, color: 'rgba(255,255,255,0.8)' }}>Date: {doc.date}</div>
                      {doc.refNumber && <div style={{ ...styles.previewSmall, color: 'rgba(255,255,255,0.8)' }}>Ref: {doc.refNumber}</div>}
                    </div>
                  </div>
                </div>
              </>
            );

            // ── Minimal: just a top line ──
            if (template === 'minimal') return (
              <>
                <div style={{ borderTop: '3px solid #1E2A4A', paddingTop: 16, marginBottom: 4 }}>
                  <div style={styles.previewHeader}>
                    <div style={{ ...styles.previewBrandRow, flex: 1, minWidth: 0 }}>{logo}{brandInfo}</div>
                    <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap', paddingLeft: 16 }}>
                      <div className="serif" style={{ ...styles.previewDocType, color: '#1E2A4A' }}>{t.label}</div>
                      <div style={styles.previewSmall}>No: {doc.number}</div>
                      <div style={styles.previewSmall}>Date: {doc.date}</div>
                      {doc.refNumber && <div style={styles.previewSmall}>Ref: {doc.refNumber}</div>}
                    </div>
                  </div>
                </div>
                <div style={styles.previewDivider} />
              </>
            );

            // ── Executive: dark navy full header ──
            if (template === 'executive') return (
              <>
                <div style={{ background: '#1E2A4A', borderRadius: 10, padding: '22px 28px', marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={styles.previewBrandRow}>
                      {logoDark}
                      {!(useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml)) && <div>
                        <div className="serif" style={{ ...styles.previewBrand, color: '#fff', fontSize: 21 }}>{businessInfo.name}</div>
                        <div style={{ ...styles.previewSmall, color: '#A9B8D4' }}>{businessInfo.address}</div>
                        <div style={{ ...styles.previewSmall, color: '#A9B8D4' }}>{cc.taxIdLabel}: {businessInfo.gstin}</div>
                        <div style={{ ...styles.previewSmall, color: '#A9B8D4' }}>{businessInfo.phone} · {businessInfo.email}{businessInfo.website ? ' · ' + businessInfo.website : ''}</div>
                      </div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap', paddingLeft: 16 }}>
                      <div style={{ background: t.color, borderRadius: 6, padding: '4px 14px', display: 'inline-block', marginBottom: 8 }}>
                        <div className="serif" style={{ ...styles.previewDocType, color: '#fff' }}>{t.label}</div>
                      </div>
                      <div style={{ ...styles.previewSmall, color: '#A9B8D4' }}>No: {doc.number}</div>
                      <div style={{ ...styles.previewSmall, color: '#A9B8D4' }}>Date: {doc.date}</div>
                      {doc.refNumber && <div style={{ ...styles.previewSmall, color: '#A9B8D4' }}>Ref: {doc.refNumber}</div>}
                    </div>
                  </div>
                </div>
              </>
            );

            // ── Elegant: left color bar accent ──
            if (template === 'elegant') return (
              <>
                <div style={{ display: 'flex', gap: 0, marginBottom: 4 }}>
                  <div style={{ width: 5, borderRadius: 4, background: t.color, marginRight: 18, flexShrink: 0, minHeight: 70 }} />
                  <div style={{ flex: 1 }}>
                    <div style={styles.previewHeader}>
                      <div style={{ ...styles.previewBrandRow, flex: 1, minWidth: 0 }}>{logo}{brandInfo}</div>
                      <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap', paddingLeft: 16 }}>
                        <div className="serif" style={{ ...styles.previewDocType, color: t.color }}>{t.label}</div>
                        <div style={styles.previewSmall}>No: {doc.number}</div>
                        <div style={styles.previewSmall}>Date: {doc.date}</div>
                        {doc.refNumber && <div style={styles.previewSmall}>Ref: {doc.refNumber}</div>}
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{ ...styles.previewDivider, borderBottomWidth: 2, borderColor: t.color }} />
              </>
            );

            // ── Fresh: soft teal background ──
            if (template === 'fresh') return (
              <>
                <div style={{ background: 'linear-gradient(135deg,#E8F5EE,#DCF0E8)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
                  <div style={styles.previewHeader}>
                    <div style={styles.previewBrandRow}>
                      {logo}
                      {!(useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml)) && <div>
                        <div className="serif" style={{ ...styles.previewBrand, color: '#1A4A33' }}>{businessInfo.name}</div>
                        <div style={{ ...styles.previewSmall, color: '#3A7A5A' }}>{businessInfo.address}</div>
                        <div style={{ ...styles.previewSmall, color: '#3A7A5A' }}>{cc.taxIdLabel}: {businessInfo.gstin}</div>
                        <div style={{ ...styles.previewSmall, color: '#3A7A5A' }}>{businessInfo.phone} · {businessInfo.email}{businessInfo.website ? ' · ' + businessInfo.website : ''}</div>
                      </div>}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, whiteSpace: 'nowrap', paddingLeft: 16 }}>
                      <div className="serif" style={{ ...styles.previewDocType, color: '#1A7A3E' }}>{t.label}</div>
                      <div style={{ ...styles.previewSmall, color: '#3A7A5A' }}>No: {doc.number}</div>
                      <div style={{ ...styles.previewSmall, color: '#3A7A5A' }}>Date: {doc.date}</div>
                      {doc.refNumber && <div style={{ ...styles.previewSmall, color: '#3A7A5A' }}>Ref: {doc.refNumber}</div>}
                    </div>
                  </div>
                </div>
              </>
            );

            // ── Formal / Prestige ──
            if (template === 'formal' || template === 'prestige') {
              const isPrestige = template === 'prestige';
              const bdr = '1px solid #000';
              const taxRows = cc.splitTax
                ? (totals.sameState ? [['CGST', totals.cgst], ['SGST', totals.sgst]] : [['IGST', totals.igst]])
                : [[cc.taxLabel, totals.vat]];
              return (
                <div style={{ margin: '-40px -48px', border: bdr, fontSize: 12, fontFamily: 'Arial, sans-serif', color: '#222', lineHeight: 1.5 }}>
                  {/* Header band */}
                  <div style={{ background: isPrestige ? '#1E2A4A' : '#fff', color: isPrestige ? '#fff' : '#000', textAlign: 'center', padding: '8px 16px', fontWeight: 700, fontSize: 15, letterSpacing: 1, borderBottom: bdr }}>
                    {doc.type === 'invoice' ? 'TAX INVOICE' : t.label.toUpperCase()}
                  </div>
                  {/* Seller + Logo */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 18px', borderBottom: bdr }}>
                    {!(useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml)) && <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{businessInfo.name}</div>
                      <div style={{ color: '#333' }}>{cc.taxIdLabel}: {businessInfo.gstin}</div>
                      <div style={{ color: '#333' }}>{businessInfo.address}</div>
                      {businessInfo.phone && <div style={{ color: '#333' }}>{businessInfo.phone}</div>}
                      {businessInfo.email && <div style={{ color: '#1A56DB', textDecoration: 'underline' }}>{businessInfo.email}</div>}
                      {businessInfo.website && <div style={{ color: '#1A56DB' }}>{businessInfo.website}</div>}
                    </div>}
                    {!(useLH && (businessInfo?.letterhead || businessInfo?.letterheadHtml)) && businessInfo.logo && (
                      <div style={{ textAlign: 'center', flexShrink: 0, marginLeft: 20 }}>
                        <img src={businessInfo.logo} alt="logo" style={{ width: 84, height: 84, objectFit: 'contain', display: 'block' }} />
                        <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, maxWidth: 100 }}>{businessInfo.name}</div>
                      </div>
                    )}
                  </div>
                  {/* Buyer + Invoice details */}
                  <div style={{ display: 'flex', borderBottom: bdr }}>
                    <div style={{ flex: 1, padding: '10px 18px', borderRight: bdr }}>
                      {[['Customer', displayParty?.name],['GSTIN', displayParty?.gstin || displayParty?.taxId],['Address', displayParty?.address],['Mob', displayParty?.phone],['Email', displayParty?.email]].map(([k,v]) => (
                        <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 3 }}>
                          <span style={{ fontWeight: 700, minWidth: 72 }}>{k}:</span>
                          <span style={{ color: k === 'Email' && v ? '#1A56DB' : '#222' }}>{v || '—'}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ width: 270, padding: '10px 18px' }}>
                      {[[`${t.label} No`, doc.number],['Date', doc.date],['Due Date', doc.dueDate],['Place of Supply', doc.placeOfSupply]].filter(([,v])=>v).map(([k,v])=>(
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 5 }}>
                          <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{k}:</span>
                          <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Items table */}
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: isPrestige ? '#1E2A4A' : '#f0f0f0' }}>
                        {['Sl No','HSN/SAC','Item Description','Tax %','Qty','Rate','Amount'].map((h,i)=>(
                          <th key={h} style={{ padding:'7px 8px', fontWeight:700, color: isPrestige?'#fff':'#222', textAlign: h==='Item Description'?'left':['Qty','Rate','Amount'].includes(h)?'right':'center', borderBottom: bdr, borderRight: i<6?'1px solid #ccc':'none', whiteSpace:'nowrap' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(doc.items||[]).map((it,i)=>{
                        const amt = (Number(it.qty)||0)*(Number(it.rate)||0);
                        return (
                          <tr key={it.id||i} style={{ borderBottom:'1px solid #ddd', background: i%2===0?'#fff':'#fafafa' }}>
                            <td style={{ padding:'6px 8px', textAlign:'center', borderRight:'1px solid #ddd' }}>{i+1}</td>
                            <td style={{ padding:'6px 8px', textAlign:'center', borderRight:'1px solid #ddd' }}>{it.hsn||''}</td>
                            <td style={{ padding:'6px 8px', borderRight:'1px solid #ddd', fontWeight:500 }}>{it.name||<span style={{color:'#bbb'}}>Item description</span>}</td>
                            <td style={{ padding:'6px 8px', textAlign:'center', borderRight:'1px solid #ddd' }}>{it.gst||0}</td>
                            <td style={{ padding:'6px 8px', textAlign:'right', borderRight:'1px solid #ddd' }}>{it.qty||0}</td>
                            <td style={{ padding:'6px 8px', textAlign:'right', borderRight:'1px solid #ddd' }}>{fmt(it.rate||0)}</td>
                            <td style={{ padding:'6px 8px', textAlign:'right', fontWeight:600 }}>{fmt(amt)}</td>
                          </tr>
                        );
                      })}
                      {(doc.items||[]).length < 3 && [...Array(Math.max(0,3-(doc.items||[]).length))].map((_,i)=>(
                        <tr key={'pad'+i} style={{ borderBottom:'1px solid #eee', height:26 }}>
                          {[...Array(7)].map((_,j)=><td key={j} style={{ borderRight:j<6?'1px solid #eee':'none' }}>&nbsp;</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* Footer */}
                  <div style={{ display:'flex', borderTop: bdr }}>
                    <div style={{ flex:1, padding:'10px 18px', borderRight: bdr }}>
                      <div style={{ color:'#555', fontStyle:'italic', marginBottom:8 }}>Thank you for your valuable business!</div>
                      <div style={{ marginBottom:8 }}>
                        <div style={{ fontWeight:700, textDecoration:'underline', marginBottom:3 }}>Amount in words:</div>
                        <div style={{ fontStyle:'italic' }}>{numToWords(Math.round(totals.grandTotal))} Rupees Only.</div>
                      </div>
                      {doc.notes && <div style={{ marginBottom:6 }}><div style={{ fontWeight:700 }}>Notes:</div><div style={{ color:'#444' }}>{doc.notes}</div></div>}
                      {(businessInfo.bankName||businessInfo.bankAccount) && (
                        <div style={{ marginTop:6 }}>
                          <div style={{ fontWeight:700 }}>Bank Details:</div>
                          {businessInfo.bankName && <div>Bank: {businessInfo.bankName}</div>}
                          {businessInfo.bankAccount && <div>A/C: {businessInfo.bankAccount}</div>}
                          {businessInfo.ifsc && <div>IFSC: {businessInfo.ifsc}</div>}
                          {businessInfo.upi && <div>UPI: {businessInfo.upi}</div>}
                        </div>
                      )}
                    </div>
                    <div style={{ width:270, display:'flex', flexDirection:'column' }}>
                      <div>
                        <div style={{ display:'flex', justifyContent:'space-between', padding:'5px 16px', borderBottom:'1px solid #ddd' }}>
                          <span>Taxable</span><span style={{ fontWeight:600 }}>{fmt(totals.subtotal)}</span>
                        </div>
                        {taxRows.map(([label,val])=>(
                          <div key={label} style={{ display:'flex', justifyContent:'space-between', padding:'5px 16px', borderBottom:'1px solid #ddd' }}>
                            <span>{label}</span><span style={{ fontWeight:600 }}>{fmt(val||0)}</span>
                          </div>
                        ))}
                        <div style={{ display:'flex', justifyContent:'space-between', padding:'7px 16px', borderTop:'2px solid #000', fontWeight:700, fontSize:13 }}>
                          <span>Total (Round off)</span><span>{fmt(Math.round(totals.grandTotal))}</span>
                        </div>
                      </div>
                      <div style={{ textAlign:'right', padding:'10px 18px', borderTop: bdr, marginTop:'auto' }}>
                        <div style={{ fontWeight:600, marginBottom:32, fontSize:12 }}>{businessInfo.name}</div>
                        <div style={{ borderTop:'1px solid #555', paddingTop:5, fontSize:11, color:'#555' }}>
                          {businessInfo.signatory || 'Authorized Signatory'}
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Terms & Conditions — doc-level first, fall back to profile default */}
                  {(doc.terms || businessInfo.terms) && (
                    <div style={{ borderTop: bdr, padding:'8px 18px' }}>
                      <div style={{ fontWeight:700, marginBottom:4 }}>Terms &amp; Conditions:</div>
                      <div style={{ fontSize:11, color:'#555', lineHeight:1.7 }}>
                        {(doc.terms || businessInfo.terms).split('\n').filter(Boolean).map((line,i)=>(
                          <div key={i}>{i+1}. {line}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }

            return null;
          })()}

          {(template !== 'formal' && template !== 'prestige') && (<>

          {doc.type === 'packing_list' ? (
            <>
              {/* Row 1: Invoice Address + Ship To Address */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 12 }}>
                <div style={styles.billTo}>
                  <div style={styles.billToLabel}>Invoice Address (Bill To)</div>
                  {displayParty ? (
                    <>
                      <div style={styles.billToName}>{displayParty.name}</div>
                      <div style={styles.previewSmall}>{displayParty.address}</div>
                      <div style={styles.previewSmall}>{displayParty.state}</div>
                    </>
                  ) : <div style={styles.previewSmall}>No customer selected</div>}
                </div>
                <div style={styles.billTo}>
                  <div style={styles.billToLabel}>Delivery Address (Ship To)</div>
                  {(doc.shipToName || doc.shipToAddress) ? (
                    <>
                      {doc.shipToName && <div style={styles.billToName}>{doc.shipToName}</div>}
                      {doc.shipToAddress && <div style={styles.previewSmall}>{doc.shipToAddress}</div>}
                    </>
                  ) : (
                    <div style={styles.previewSmall}>Same as invoice address</div>
                  )}
                </div>
              </div>
              {/* Row 2: Shipment Details */}
              {(() => {
                const isDom = (doc.shipmentType || 'domestic') === 'domestic';
                const cell = (label, val) => val ? <div key={label}><div style={{ fontSize: 10, color: '#888', fontWeight: 600, textTransform: 'uppercase', marginBottom: 2 }}>{label}</div>{val}</div> : null;
                const domCells = [cell('Vehicle No.', doc.vehicleNo), cell('Mode of Vehicle', doc.vehicleMode), cell('Driver Name', doc.driverName), cell('Driver Mobile', doc.driverMobile), cell('Remarks', doc.shippingMarks)].filter(Boolean);
                const intlCells = [cell('Port of Loading', doc.portOfLoading), cell('Port of Discharge', doc.portOfDischarge), cell('Vessel / Flight', doc.vesselFlight), cell('B/L or AWB No.', doc.blNumber), cell('Country of Origin', doc.countryOfOrigin), cell('Shipping Marks', doc.shippingMarks)].filter(Boolean);
                const cells = isDom ? domCells : intlCells;
                if (!cells.length) return null;
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: isDom ? '#EEF5F0' : '#EEF1F8', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#555' }}>
                    <div style={{ gridColumn: '1/-1', fontSize: 10, fontWeight: 700, color: isDom ? '#3D7A5C' : '#1E4A8A', textTransform: 'uppercase', marginBottom: 4 }}>
                      {isDom ? '🚛 Transport Details' : '🚢 Shipment Details'}
                    </div>
                    {cells}
                  </div>
                );
              })()}
            </>
          ) : (
            <div style={styles.billTo}>
              <div style={styles.billToLabel}>{isVendorDoc ? 'Vendor / billed from' : 'Billed to'}</div>
              {displayParty ? (
                <>
                  <div style={styles.billToName}>{displayParty.name}</div>
                  <div style={styles.previewSmall}>{displayParty.address}</div>
                  {(displayParty.gstin || displayParty.taxId) && <div style={styles.previewSmall}>{cc.taxIdLabel}: {displayParty.gstin || displayParty.taxId}</div>}
                  {displayParty.state && <div style={styles.previewSmall}>State: {displayParty.state}</div>}
                </>
              ) : (
                <div style={styles.previewSmall}>{isVendorDoc ? 'No vendor selected' : 'No customer selected'}</div>
              )}
            </div>
          )}

          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Item</th>
                {doc.type !== 'packing_list' && cc.splitTax && <th style={styles.th}>HSN</th>}
                <th style={{ ...styles.th, textAlign: 'right' }}>Qty</th>
                {doc.type === 'packing_list' ? (<>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Pkgs</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Net Wt (kg)</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Gross Wt (kg)</th>
                  <th style={styles.th}>Dimensions</th>
                </>) : (<>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Rate</th>
                  {cc.hasTax && <th style={{ ...styles.th, textAlign: 'right' }}>{cc.taxLabel} %</th>}
                  <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                </>)}
                <th className="no-print" style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((it) => {
                const amount = (Number(it.qty) || 0) * (Number(it.rate) || 0);
                return (
                  <tr key={it.id}>
                    <td style={styles.td}>
                      {isEditable && <select className="no-print" value={it.itemId} onChange={(e) => selectItem(it.id, e.target.value)} style={styles.inlineSelect}>
                        <option value="">Custom item</option>
                        {items.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>}
                      <input value={it.name} onChange={(e) => updateItem(it.id, 'name', e.target.value)} style={{ ...styles.inlineInput, ...(isEditable ? styles.inlineInputEditable : {}) }} placeholder="Item description" readOnly={!isEditable} />
                    </td>
                    {doc.type !== 'packing_list' && cc.splitTax && (
                      <td style={styles.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <input value={it.hsn} onChange={(e) => updateItem(it.id, 'hsn', e.target.value)} style={{ ...styles.inlineInput, width: 60, ...(isEditable ? styles.inlineInputEditable : {}) }} readOnly={!isEditable} />
                          {isEditable && cc.splitTax && (
                            <button type="button" title="Search HSN/SAC code" onClick={() => setHsnSearchRow(it.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', color: '#888780', flexShrink: 0 }}>
                              🔍
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                    <td style={styles.td}><input type="number" value={it.qty} onChange={(e) => updateItem(it.id, 'qty', parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} style={{ ...styles.inlineInput, width: 60, textAlign: 'right', ...(isEditable ? styles.inlineInputEditable : {}) }} readOnly={!isEditable} /></td>
                    {doc.type === 'packing_list' ? (<>
                      <td style={styles.td}><input type="number" value={it.packages ?? 1} onChange={(e) => updateItem(it.id, 'packages', parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} style={{ ...styles.inlineInput, width: 55, textAlign: 'right', ...(isEditable ? styles.inlineInputEditable : {}) }} readOnly={!isEditable} /></td>
                      <td style={styles.td}><input type="number" value={it.netWeight ?? 0} onChange={(e) => updateItem(it.id, 'netWeight', parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} style={{ ...styles.inlineInput, width: 80, textAlign: 'right', ...(isEditable ? styles.inlineInputEditable : {}) }} readOnly={!isEditable} /></td>
                      <td style={styles.td}><input type="number" value={it.grossWeight ?? 0} onChange={(e) => updateItem(it.id, 'grossWeight', parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} style={{ ...styles.inlineInput, width: 80, textAlign: 'right', ...(isEditable ? styles.inlineInputEditable : {}) }} readOnly={!isEditable} /></td>
                      <td style={styles.td}><input value={it.dimensions || ''} onChange={(e) => updateItem(it.id, 'dimensions', e.target.value)} style={{ ...styles.inlineInput, width: 110, ...(isEditable ? styles.inlineInputEditable : {}) }} placeholder="L×W×H cm" readOnly={!isEditable} /></td>
                    </>) : (<>
                      <td style={styles.td}><input type="number" value={it.rate} onChange={(e) => updateItem(it.id, 'rate', parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} style={{ ...styles.inlineInput, width: 90, textAlign: 'right', ...(isEditable ? styles.inlineInputEditable : {}) }} readOnly={!isEditable} /></td>
                      {cc.hasTax && <td style={styles.td}><input type="number" value={it.gst} onChange={(e) => updateItem(it.id, 'gst', parseFloat(e.target.value) || 0)} onFocus={(e) => e.target.select()} style={{ ...styles.inlineInput, width: 55, textAlign: 'right', ...(isEditable ? styles.inlineInputEditable : {}) }} readOnly={!isEditable} /></td>}
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 500 }}>{fmt(amount)}</td>
                    </>)}
                    {isEditable && <td className="no-print" style={styles.td}>
                      <button onClick={() => removeRow(it.id)} style={styles.iconBtn}><Trash2 size={14} color="#B5453A" /></button>
                    </td>}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {isEditable && <button onClick={addRow} className="no-print" style={styles.addRowBtn}><Plus size={14} /> Add line item</button>}

          {/* ── Packing List weight totals ── */}
          {doc.type === 'packing_list' && (() => {
            const totalPkgs = doc.items.reduce((s, it) => s + (Number(it.packages) || 0), 0);
            const totalNet = doc.items.reduce((s, it) => s + (Number(it.netWeight) || 0), 0);
            const totalGross = doc.items.reduce((s, it) => s + (Number(it.grossWeight) || 0), 0);
            const row = (label, val) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#555', borderBottom: '1px solid #F2EFE6' }}>
                <span>{label}</span><span style={{ fontWeight: 600 }}>{val}</span>
              </div>
            );
            return (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <div style={{ minWidth: 280 }}>
                  {row('Total Packages', totalPkgs)}
                  {row('Total Net Weight', totalNet.toFixed(2) + ' kg')}
                  {row('Total Gross Weight', totalGross.toFixed(2) + ' kg')}
                  {doc.portOfLoading && row('Port of Loading', doc.portOfLoading)}
                  {doc.portOfDischarge && row('Port of Discharge', doc.portOfDischarge)}
                  {doc.vesselFlight && row('Vessel / Flight', doc.vesselFlight)}
                  {doc.blNumber && row('B/L or AWB No.', doc.blNumber)}
                  {doc.countryOfOrigin && row('Country of Origin', doc.countryOfOrigin)}
                </div>
              </div>
            );
          })()}

          {/* ── Totals aligned right ── */}
          {doc.type !== 'packing_list' && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
            <div style={{ minWidth: 260 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#555', borderBottom: '1px solid #F2EFE6' }}>
                <span>Subtotal</span><span>{fmt(totals.subtotal)}</span>
              </div>
              {cc.hasTax && (cc.splitTax ? (
                totals.sameState ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#555', borderBottom: '1px solid #F2EFE6' }}>
                      <span>CGST</span><span>{fmt(totals.cgst)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#555', borderBottom: '1px solid #F2EFE6' }}>
                      <span>SGST</span><span>{fmt(totals.sgst)}</span>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#555', borderBottom: '1px solid #F2EFE6' }}>
                    <span>IGST</span><span>{fmt(totals.igst)}</span>
                  </div>
                )
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, color: '#555', borderBottom: '1px solid #F2EFE6' }}>
                  <span>{cc.taxLabel}</span><span>{fmt(totals.vat)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0 6px', fontSize: 16, fontWeight: 700, color: '#1E2A4A', borderTop: '2px solid #1E2A4A', marginTop: 2 }}>
                <span>Grand Total</span><span className="serif">{fmt(totals.grandTotal)}</span>
              </div>
            </div>
          </div>}

          {/* ── Footer: Notes + Bank details + Signatory ── */}
          <div style={{ marginTop: 28, borderTop: '1px solid #EAE6DB', paddingTop: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 28 }}>

              {/* Notes / Terms */}
              <div>
                {(doc.notes || doc.terms || businessInfo.terms) && (
                  <>
                    <div style={styles.billToLabel}>Notes &amp; Terms</div>
                    {doc.notes && <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginBottom: 4 }}>{doc.notes}</div>}
                    {(doc.terms || businessInfo.terms) && (
                      <div style={{ fontSize: 11.5, color: '#888780', lineHeight: 1.6, fontStyle: 'italic' }}>
                        {(doc.terms || businessInfo.terms).split('\n').filter(Boolean).map((line, i) => (
                          <div key={i}>{i + 1}. {line}</div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Bank Details — not shown on packing list */}
              {doc.type !== 'packing_list' && (businessInfo.bankName || businessInfo.bankAccount || businessInfo.upi) && (
                <div>
                  <div style={styles.billToLabel}>Bank Details</div>
                  {businessInfo.bankName && (
                    <div style={{ fontSize: 12.5, color: '#1E2A4A', marginBottom: 2 }}>
                      <span style={{ color: '#888780' }}>Bank: </span>{businessInfo.bankName}
                    </div>
                  )}
                  {businessInfo.bankAccount && (
                    <div style={{ fontSize: 12.5, color: '#1E2A4A', marginBottom: 2 }}>
                      <span style={{ color: '#888780' }}>A/C No: </span><strong>{businessInfo.bankAccount}</strong>
                    </div>
                  )}
                  {businessInfo.ifsc && (
                    <div style={{ fontSize: 12.5, color: '#1E2A4A', marginBottom: 2 }}>
                      <span style={{ color: '#888780' }}>IFSC: </span>{businessInfo.ifsc}
                    </div>
                  )}
                  {businessInfo.upi && (
                    <div style={{ fontSize: 12.5, color: '#1E2A4A' }}>
                      <span style={{ color: '#888780' }}>UPI: </span>{businessInfo.upi}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Authorized Signatory + Seal */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 8 }}>
              {/* Seal / Stamp area */}
              <div style={{ border: '1px dashed #DDD8CC', borderRadius: 8, minHeight: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, color: '#C8C4BB', letterSpacing: '0.05em' }}>SEAL / STAMP</span>
              </div>
              {/* Signatory */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: '#1E2A4A', fontWeight: 600, marginBottom: 4 }}>{businessInfo.name}</div>
                <div style={{ borderTop: '1px solid #555', paddingTop: 8, marginTop: 40, fontSize: 11.5, color: '#888780' }}>
                  {businessInfo.signatory ? businessInfo.signatory : 'Authorized Signatory'}
                </div>
              </div>
            </div>
          </div>
          {useLH && businessInfo?.letterheadFooter && (
            <div className="lh-pad-footer" style={{ background: '#fff' }}>
              <img src={businessInfo.letterheadFooter} alt="letterhead footer" style={{ width:'100%', display:'block' }} />
            </div>
          )}
          </>)}
        </div>
      </div>
      {hsnSearchRow && (
        <HsnSearchModal
          onSelect={(code) => { updateItem(hsnSearchRow, 'hsn', code); setHsnSearchRow(null); }}
          onClose={() => setHsnSearchRow(null)}
        />
      )}
      {mepPickerOpen && (
        <MEPInvoicePicker
          siteProjects={siteProjects}
          siteActivities={siteActivities}
          progressUpdates={progressUpdates}
          onClose={() => setMepPickerOpen(false)}
          onLoad={(lineItems) => {
            setDoc(d => ({ ...d, items: [...d.items.filter(i=>i.name), ...lineItems] }));
            setMepPickerOpen(false);
          }}
        />
      )}
      {showScan && <ScanBillModal onApply={applyScanData} onClose={() => setShowScan(false)} />}
    </div>
  );
}

// ─── PettyCash ─────────────────────────────────────────────────



export function AuditView({ documents, vouchers, pettyCash, businessInfo, userRole, currentBizType = 'trading', isMultiBiz = false, auditDocs, setAuditDocs }) {
  const curYear = new Date().getFullYear();
  const [year,   setYear]   = useState(curYear);
  const [period, setPeriod] = useState('FY');
  const [notes,  setNotes]  = useState('');
  const [saved,  setSaved]  = useState(false);
  const [viewDoc, setViewDoc] = useState(null); // saved audit record to view/print

  const PERIODS = [
    { key: 'Q1', label: 'Q1 (Jan–Mar)' },
    { key: 'Q2', label: 'Q2 (Apr–Jun)' },
    { key: 'Q3', label: 'Q3 (Jul–Sep)' },
    { key: 'Q4', label: 'Q4 (Oct–Dec)' },
    { key: 'H1', label: 'H1 (Jan–Jun)' },
    { key: 'H2', label: 'H2 (Jul–Dec)' },
    { key: 'FY', label: 'Full Year' },
  ];

  function getRange(p, y) {
    const ranges = {
      Q1: [`${y}-01-01`, `${y}-03-31`],
      Q2: [`${y}-04-01`, `${y}-06-30`],
      Q3: [`${y}-07-01`, `${y}-09-30`],
      Q4: [`${y}-10-01`, `${y}-12-31`],
      H1: [`${y}-01-01`, `${y}-06-30`],
      H2: [`${y}-07-01`, `${y}-12-31`],
      FY: [`${y}-01-01`, `${y}-12-31`],
    };
    return ranges[p] || ranges.FY;
  }

  function computePL(p, y) {
    const [start, end] = getRange(p, y);
    const inRange = d => d >= start && d <= end;
    const inDiv   = x => !isMultiBiz || (x.bizType || 'trading') === currentBizType;

    const docs = Array.isArray(documents) ? documents : [];
    const vlist = Array.isArray(vouchers) ? vouchers : [];
    const pcEntries = Array.isArray(pettyCash?.entries) ? pettyCash.entries : [];

    // Revenue — approved/finalized invoices
    const invoices = docs.filter(d => d.type === 'invoice' && inRange(d.date || '') && inDiv(d));
    const revenue  = invoices.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

    // COGS — purchase bills
    const pbills = docs.filter(d => d.type === 'purchasebill' && inRange(d.date || '') && inDiv(d));
    const cogs   = pbills.reduce((s, d) => s + (parseFloat(d.total) || 0), 0);

    // Operating expenses — voucher payments + petty cash debits
    const voucherExp = vlist
      .filter(v => inRange(v.date || '') && inDiv(v) && v.status !== 'rejected')
      .reduce((s, v) => s + (parseFloat(v.amount) || 0), 0);
    const pcExp = pcEntries
      .filter(e => inRange(e.date || '') && inDiv(e) && e.status !== 'rejected')
      .reduce((s, e) => s + (parseFloat(e.debit) || 0), 0);
    const opExpenses = voucherExp + pcExp;

    const grossProfit = revenue - cogs;
    const netProfit   = grossProfit - opExpenses;

    return {
      revenue, cogs, grossProfit, opExpenses, netProfit,
      invoiceCount: invoices.length, pbillCount: pbills.length,
    };
  }

  const pl = computePL(period, year);
  const fmt = n => {
    const sym = businessInfo?.currencySymbol || '₹';
    const abs = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (n < 0 ? `(${sym}${abs})` : `${sym}${abs}`);
  };
  const periodLabel = PERIODS.find(p => p.key === period)?.label || period;
  const [s, e] = getRange(period, year);
  const dateRangeStr = `${new Date(s).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })} – ${new Date(e).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })}`;

  function handleSave() {
    const rec = {
      id: Date.now().toString(),
      period, year,
      periodLabel,
      dateRange: dateRangeStr,
      bizType: currentBizType,
      createdAt: new Date().toISOString(),
      notes,
      ...pl,
    };
    setAuditDocs(prev => [rec, ...(Array.isArray(prev) ? prev : [])]);
    setSaved(true);
    setNotes('');
    setTimeout(() => setSaved(false), 2500);
  }

  // Filter saved records for current division
  const myAudits = (Array.isArray(auditDocs) ? auditDocs : [])
    .filter(a => !isMultiBiz || (a.bizType || 'trading') === currentBizType)
    .sort((a, b) => b.createdAt?.localeCompare(a.createdAt));

  function handlePrint(doc) {
    const sym = businessInfo?.currencySymbol || '₹';
    const fmtN = n => {
      const abs = Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return n < 0 ? `(${sym}${abs})` : `${sym}${abs}`;
    };
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><title>P&L – ${doc.periodLabel} ${doc.year}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 13px; color: #222; margin: 0; padding: 24px 40px; }
      h2 { text-align: center; font-size: 16px; margin: 0 0 2px; }
      .sub { text-align: center; color: #555; font-size: 12px; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      td { padding: 7px 10px; }
      .section-head { background: #1E2A4A; color: #fff; font-weight: 700; font-size: 12px; letter-spacing: 0.5px; }
      .subtotal { background: #f5f5f5; font-weight: 700; border-top: 1.5px solid #ccc; }
      .total { background: #1E2A4A; color: #fff; font-weight: 700; font-size: 14px; }
      .loss  { background: #FEF2F2; color: #B91C1C; font-weight: 700; font-size: 14px; }
      .right { text-align: right; }
      .indent { padding-left: 24px; color: #444; }
      hr { border: none; border-top: 1px solid #ddd; margin: 12px 0; }
      .footer { margin-top: 32px; font-size: 11px; color: #888; text-align: center; }
      @media print { body { padding: 10mm; } }
    </style></head><body>
    <h2>${businessInfo?.name || 'Company'}</h2>
    <div class="sub">PROFIT &amp; LOSS STATEMENT — ${doc.periodLabel} ${doc.year} (${doc.dateRange})</div>
    ${isMultiBiz ? `<div class="sub">Division: ${doc.bizType?.toUpperCase()}</div>` : ''}
    <table>
      <tr><td class="section-head">INCOME</td><td class="section-head right"></td></tr>
      <tr><td class="indent">Sales Revenue (${doc.invoiceCount} invoices)</td><td class="right">${fmtN(doc.revenue)}</td></tr>
      <tr><td class="subtotal">GROSS INCOME</td><td class="subtotal right">${fmtN(doc.revenue)}</td></tr>

      <tr><td style="padding-top:12px" class="section-head">COST OF GOODS SOLD</td><td class="section-head right"></td></tr>
      <tr><td class="indent">Purchases / Direct Costs (${doc.pbillCount} bills)</td><td class="right">${fmtN(doc.cogs)}</td></tr>
      <tr><td class="subtotal">TOTAL COGS</td><td class="subtotal right">(${fmtN(doc.cogs)})</td></tr>

      <tr><td class="subtotal" style="font-size:14px">GROSS PROFIT</td><td class="subtotal right" style="font-size:14px">${fmtN(doc.grossProfit)}</td></tr>

      <tr><td style="padding-top:12px" class="section-head">OPERATING EXPENSES</td><td class="section-head right"></td></tr>
      <tr><td class="indent">Vouchers &amp; Petty Cash</td><td class="right">${fmtN(doc.opExpenses)}</td></tr>
      <tr><td class="subtotal">TOTAL OPEX</td><td class="subtotal right">(${fmtN(doc.opExpenses)})</td></tr>

      <tr><td colspan="2" style="padding:4px"></td></tr>
      <tr class="${doc.netProfit >= 0 ? 'total' : 'loss'}">
        <td>NET ${doc.netProfit >= 0 ? 'PROFIT' : 'LOSS'}</td>
        <td class="right">${fmtN(doc.netProfit)}</td>
      </tr>
    </table>
    ${doc.notes ? `<hr/><p><strong>Notes:</strong> ${doc.notes}</p>` : ''}
    <div class="footer">Generated on ${new Date(doc.createdAt).toLocaleString('en-IN')} · Operix</div>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 400);
  }

  const cardStyle = { background: '#fff', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' };
  const rowStyle  = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' };
  const labelStyle = { fontSize: 13, color: '#555' };
  const valueStyle = (n) => ({ fontSize: 13, fontWeight: 600, color: n < 0 ? '#B91C1C' : '#1E2A4A' });

  if (viewDoc) {
    const vpl = viewDoc;
    return (
      <div style={{ padding: '24px 28px', maxWidth: 680, margin: '0 auto' }}>
        <button onClick={() => setViewDoc(null)} style={{ marginBottom: 16, background: 'none', border: 'none', color: '#1E2A4A', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>← Back to Audit List</button>
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 17, color: '#1E2A4A' }}>{vpl.periodLabel} {vpl.year}</div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{vpl.dateRange}</div>
            </div>
            <button onClick={() => handlePrint(vpl)} style={{ padding: '7px 16px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Print / Export</button>
          </div>
          <div style={rowStyle}><span style={labelStyle}>Sales Revenue ({vpl.invoiceCount} invoices)</span><span style={valueStyle(vpl.revenue)}>{fmt(vpl.revenue)}</span></div>
          <div style={rowStyle}><span style={labelStyle}>Cost of Goods Sold ({vpl.pbillCount} bills)</span><span style={valueStyle(-vpl.cogs)}>{fmt(-vpl.cogs)}</span></div>
          <div style={{ ...rowStyle, fontWeight: 700, borderBottom: '2px solid #1E2A4A', marginBottom: 8 }}><span style={{ fontSize: 13 }}>GROSS PROFIT</span><span style={valueStyle(vpl.grossProfit)}>{fmt(vpl.grossProfit)}</span></div>
          <div style={rowStyle}><span style={labelStyle}>Operating Expenses (Vouchers + Petty Cash)</span><span style={valueStyle(-vpl.opExpenses)}>{fmt(-vpl.opExpenses)}</span></div>
          <div style={{ ...rowStyle, fontWeight: 700, fontSize: 15, background: vpl.netProfit >= 0 ? '#EEF2FF' : '#FEF2F2', borderRadius: 7, padding: '10px 12px', marginTop: 8, border: `1.5px solid ${vpl.netProfit >= 0 ? '#6366F1' : '#FCA5A5'}` }}>
            <span>NET {vpl.netProfit >= 0 ? 'PROFIT' : 'LOSS'}</span>
            <span style={{ color: vpl.netProfit >= 0 ? '#4338CA' : '#B91C1C' }}>{fmt(vpl.netProfit)}</span>
          </div>
          {vpl.notes && <p style={{ fontSize: 12, color: '#666', marginTop: 12 }}><strong>Notes:</strong> {vpl.notes}</p>}
          <p style={{ fontSize: 11, color: '#aaa', marginTop: 12 }}>Saved on {new Date(vpl.createdAt).toLocaleString('en-IN')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 28px', maxWidth: 720, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, color: '#1E2A4A' }}>P&L Audit</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#888' }}>Auto-computed from your invoices, purchase bills, vouchers and petty cash</p>
      </div>

      {/* Period selector */}
      <div style={{ ...cardStyle, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Year</label>
            <select value={year} onChange={e => setYear(+e.target.value)} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', fontSize: 13 }}>
              {[curYear+1, curYear, curYear-1, curYear-2, curYear-3].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 4 }}>Period</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {PERIODS.map(p => (
                <button key={p.key} onClick={() => setPeriod(p.key)}
                  style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: period === p.key ? '2px solid #1E2A4A' : '1px solid #ddd', background: period === p.key ? '#1E2A4A' : '#fff', color: period === p.key ? '#fff' : '#444' }}>
                  {p.key}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 12 }}>{periodLabel} · {dateRangeStr}</div>

        {/* P&L Summary */}
        <div style={rowStyle}><span style={labelStyle}>Sales Revenue ({pl.invoiceCount} invoices)</span><span style={valueStyle(pl.revenue)}>{fmt(pl.revenue)}</span></div>
        <div style={rowStyle}><span style={labelStyle}>Cost of Goods Sold ({pl.pbillCount} bills)</span><span style={valueStyle(-pl.cogs)}>{fmt(-pl.cogs)}</span></div>
        <div style={{ ...rowStyle, fontWeight: 700, borderTop: '2px solid #1E2A4A', marginTop: 4, paddingTop: 10 }}>
          <span style={{ fontSize: 13 }}>GROSS PROFIT</span>
          <span style={valueStyle(pl.grossProfit)}>{fmt(pl.grossProfit)}</span>
        </div>
        <div style={rowStyle}><span style={labelStyle}>Operating Expenses (Vouchers + Petty Cash)</span><span style={valueStyle(-pl.opExpenses)}>{fmt(-pl.opExpenses)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderRadius: 8, marginTop: 8, background: pl.netProfit >= 0 ? '#EEF2FF' : '#FEF2F2', border: `1.5px solid ${pl.netProfit >= 0 ? '#6366F1' : '#FCA5A5'}` }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>NET {pl.netProfit >= 0 ? 'PROFIT' : 'LOSS'}</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: pl.netProfit >= 0 ? '#4338CA' : '#B91C1C' }}>{fmt(pl.netProfit)}</span>
        </div>

        {/* Notes + Save */}
        {userRole === 'admin' && (
          <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
            <textarea
              placeholder="Optional notes for this audit record…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 7, border: '1px solid #ddd', fontSize: 13, resize: 'vertical', marginBottom: 10 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSave} style={{ padding: '8px 20px', background: '#1E2A4A', color: '#fff', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                {saved ? '✓ Saved!' : 'Save as Audit Record'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Saved audit records */}
      <div style={{ marginBottom: 8, fontWeight: 700, fontSize: 14, color: '#1E2A4A' }}>Saved Audit Records</div>
      {myAudits.length === 0 ? (
        <div style={{ ...cardStyle, color: '#aaa', fontSize: 13, textAlign: 'center', padding: 32 }}>No saved records yet. Generate a P&L above and click "Save as Audit Record".</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {myAudits.map(a => (
            <div key={a.id} style={{ ...cardStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: '#1E2A4A' }}>{a.periodLabel} {a.year}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{a.dateRange}{isMultiBiz ? ` · ${a.bizType}` : ''}</div>
                {a.notes && <div style={{ fontSize: 12, color: '#666', marginTop: 3 }}>{a.notes}</div>}
              </div>
              <div style={{ textAlign: 'right', minWidth: 120 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: a.netProfit >= 0 ? '#4338CA' : '#B91C1C' }}>
                  {a.netProfit >= 0 ? 'Profit ' : 'Loss '}{fmt(Math.abs(a.netProfit))}
                </div>
                <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{new Date(a.createdAt).toLocaleDateString('en-IN')}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setViewDoc(a)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: '1px solid #1E2A4A', background: '#fff', color: '#1E2A4A', cursor: 'pointer', fontWeight: 600 }}>View</button>
                <button onClick={() => handlePrint(a)} style={{ padding: '5px 12px', fontSize: 12, borderRadius: 6, border: 'none', background: '#1E2A4A', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Print</button>
                {userRole === 'admin' && <button onClick={() => setAuditDocs(prev => (Array.isArray(prev) ? prev : []).filter(x => x.id !== a.id))} style={{ padding: '5px 10px', fontSize: 12, borderRadius: 6, border: '1px solid #fca5a5', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer' }}>✕</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// GSTR-1 REPORT (India only)
// ─────────────────────────────────────────────


export function GSTR1Report({ documents, customers, businessInfo }) {
  const now = new Date();
  const [from, setFrom] = useState(now.toISOString().slice(0, 7) + '-01');
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [showPrint, setShowPrint] = useState(false);
  const cc = COUNTRY_CONFIG['india'];
  const fmt = (n) => currency(n, cc.currency);

  const invoices = filterByRange(documents, ['invoice'], from, to);

  const rows = invoices.map(d => {
    const c = customers.find(x => x.id === d.customerId);
    const t = computeTotals(d, businessInfo.state, 'india');
    const gstin = c ? (c.gstin || '') : '';
    return { ...t, number: d.number, date: d.date, party: c ? c.name : (d.customerSnapshot?.name || '—'), gstin, type: gstin ? 'B2B' : 'B2C', state: c ? c.state : '' };
  }).sort((a, b) => a.date > b.date ? 1 : -1);

  const b2b = rows.filter(r => r.type === 'B2B');
  const b2c = rows.filter(r => r.type === 'B2C');
  const totalTaxable = rows.reduce((s, r) => s + r.subtotal, 0);
  const totalCGST    = rows.reduce((s, r) => s + r.cgst, 0);
  const totalSGST    = rows.reduce((s, r) => s + r.sgst, 0);
  const totalIGST    = rows.reduce((s, r) => s + r.igst, 0);
  const totalTax     = rows.reduce((s, r) => s + r.totalTax, 0);
  const thStyle = { ...styles.th, fontSize: 11 };

  return (
    <div style={styles.page}>
      {showPrint && <PrintModal title="GSTR-1 Report" onClose={() => setShowPrint(false)}>
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
            <div><div style={{ fontSize:20, fontWeight:700 }}>{businessInfo.name}</div>
              <div style={{ fontSize:11, color:'#555' }}>{businessInfo.address}</div>
              {businessInfo.gstin && <div style={{ fontSize:11 }}>GSTIN: {businessInfo.gstin}</div>}
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:18, fontWeight:700 }}>GSTR-1 REPORT</div>
              <div style={{ fontSize:12, color:'#555' }}>Period: {from} to {to}</div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:16 }}>
            {[['Taxable',totalTaxable],['CGST',totalCGST],['SGST',totalSGST],['IGST',totalIGST],['Total Tax',totalTax]].map(([l,v])=>(
              <div key={l} style={{ border:'1px solid #ddd', borderRadius:4, padding:'8px 10px', textAlign:'center' }}>
                <div style={{ fontSize:10, color:'#888', textTransform:'uppercase' }}>{l}</div>
                <div style={{ fontWeight:700 }}>{fmt(v)}</div>
              </div>
            ))}
          </div>
          {b2b.length > 0 && <><div style={{ fontWeight:700, fontSize:12, marginBottom:6 }}>B2B ({b2b.length})</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11, marginBottom:12 }}>
              <thead><tr style={{ background:'#f0f0f0' }}>{['Invoice','Date','Party','GSTIN','Taxable','CGST','SGST','IGST','Total'].map(h=><th key={h} style={{ padding:'5px 6px', textAlign:'left' }}>{h}</th>)}</tr></thead>
              <tbody>{b2b.map(r=><tr key={r.number} style={{ borderBottom:'1px solid #f5f5f5' }}>
                <td style={{ padding:'4px 6px' }}>{r.number}</td><td style={{ padding:'4px 6px' }}>{r.date}</td>
                <td style={{ padding:'4px 6px' }}>{r.party}</td><td style={{ padding:'4px 6px', fontFamily:'monospace' }}>{r.gstin}</td>
                <td style={{ padding:'4px 6px', textAlign:'right' }}>{fmt(r.subtotal)}</td>
                <td style={{ padding:'4px 6px', textAlign:'right' }}>{fmt(r.cgst)}</td>
                <td style={{ padding:'4px 6px', textAlign:'right' }}>{fmt(r.sgst)}</td>
                <td style={{ padding:'4px 6px', textAlign:'right' }}>{fmt(r.igst)}</td>
                <td style={{ padding:'4px 6px', textAlign:'right', fontWeight:600 }}>{fmt(r.grandTotal)}</td>
              </tr>)}</tbody>
            </table></>}
          {b2c.length > 0 && <><div style={{ fontWeight:700, fontSize:12, marginBottom:6 }}>B2C ({b2c.length})</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
              <thead><tr style={{ background:'#f0f0f0' }}>{['Invoice','Date','Party','Taxable','CGST','SGST','IGST','Total'].map(h=><th key={h} style={{ padding:'5px 6px', textAlign:'left' }}>{h}</th>)}</tr></thead>
              <tbody>{b2c.map(r=><tr key={r.number} style={{ borderBottom:'1px solid #f5f5f5' }}>
                <td style={{ padding:'4px 6px' }}>{r.number}</td><td style={{ padding:'4px 6px' }}>{r.date}</td>
                <td style={{ padding:'4px 6px' }}>{r.party}</td>
                <td style={{ padding:'4px 6px', textAlign:'right' }}>{fmt(r.subtotal)}</td>
                <td style={{ padding:'4px 6px', textAlign:'right' }}>{fmt(r.cgst)}</td>
                <td style={{ padding:'4px 6px', textAlign:'right' }}>{fmt(r.sgst)}</td>
                <td style={{ padding:'4px 6px', textAlign:'right' }}>{fmt(r.igst)}</td>
                <td style={{ padding:'4px 6px', textAlign:'right', fontWeight:600 }}>{fmt(r.grandTotal)}</td>
              </tr>)}</tbody>
            </table></>}
        </div>
      </PrintModal>}
      <div style={styles.pageHeader}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>GSTR-1 Report</h2>
          <div style={{ fontSize: 13, color: '#888780' }}>Outward supplies summary for GST filing</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button style={styles.secondaryBtn} onClick={() => downloadCSV('gstr1-' + from + '-to-' + to + '.csv',
            ['Type','Invoice No','Date','Party','GSTIN','State','Taxable','CGST','SGST','IGST','Total'],
            [...rows.map(r => [r.type, r.number, r.date, r.party, r.gstin, r.state,
              r.subtotal.toFixed(2), r.cgst.toFixed(2), r.sgst.toFixed(2), r.igst.toFixed(2), r.grandTotal.toFixed(2)])])
          }><Download size={15}/> Export CSV</button>
          <button style={styles.primaryBtn} onClick={() => setShowPrint(true)}><Printer size={15}/> Print / PDF</button>
        </div>
      </div>

      <DateRangePicker from={from} setFrom={setFrom} to={to} setTo={setTo} count={rows.length} label="invoice(s)" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12, marginBottom: 24 }}>
        {[['Taxable Value', totalTaxable, '#1E2A4A'],['CGST', totalCGST, '#6B5BAE'],['SGST', totalSGST, '#8A6FD6'],['IGST', totalIGST, '#3D7A5C'],['Total Tax', totalTax, '#B5453A']].map(([l,v,a]) => (
          <div key={l} style={{ ...styles.statCard, padding: '12px 14px' }}>
            <div style={{ ...styles.statBar, background: a }} />
            <div><div style={{ ...styles.statLabel, fontSize: 11 }}>{l}</div><div className="serif" style={{ ...styles.statValue, fontSize: 15 }}>{fmt(v)}</div></div>
          </div>
        ))}
      </div>

      {b2b.length > 0 && (<>
        <div style={styles.dashSection}>B2B Invoices (with GSTIN)</div>
        <div style={{ overflowX: 'auto', marginBottom: 24 }}>
          <table style={styles.table}>
            <thead><tr>{['Invoice No','Date','Party','GSTIN','State','Taxable','CGST','SGST','IGST','Total'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {b2b.map(r=>(
                <tr key={r.number}>
                  <td style={{ ...styles.td, fontFamily:'monospace', fontSize:11 }}>{r.number}</td>
                  <td style={styles.td}>{r.date}</td>
                  <td style={{ ...styles.td, fontWeight:500 }}>{r.party}</td>
                  <td style={{ ...styles.td, fontFamily:'monospace', fontSize:11 }}>{r.gstin}</td>
                  <td style={styles.td}>{r.state}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.subtotal)}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.cgst)}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.sgst)}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.igst)}</td>
                  <td style={{ ...styles.td, textAlign:'right', fontWeight:600 }}>{fmt(r.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {b2c.length > 0 && (<>
        <div style={styles.dashSection}>B2C Invoices (without GSTIN)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead><tr>{['Invoice No','Date','Party','Taxable','CGST','SGST','IGST','Total'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {b2c.map(r=>(
                <tr key={r.number}>
                  <td style={{ ...styles.td, fontFamily:'monospace', fontSize:11 }}>{r.number}</td>
                  <td style={styles.td}>{r.date}</td>
                  <td style={{ ...styles.td, fontWeight:500 }}>{r.party}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.subtotal)}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.cgst)}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.sgst)}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.igst)}</td>
                  <td style={{ ...styles.td, textAlign:'right', fontWeight:600 }}>{fmt(r.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {rows.length === 0 && <div style={styles.emptyBox}>No approved invoices found for the selected period.</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// GSTR-3B REPORT (India only)
// ─────────────────────────────────────────────


export function GSTR3BReport({ documents, customers, vendors, businessInfo }) {
  const now = new Date();
  const [month, setMonth] = useState(now.toISOString().slice(0, 7));
  const [showPrint, setShowPrint] = useState(false);
  const cc = COUNTRY_CONFIG['india'];
  const fmt = (n) => '₹' + (n||0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const from = month + '-01';
  const lastDay = new Date(new Date(month).getFullYear(), new Date(month).getMonth()+1, 0).getDate();
  const to = month + '-' + String(lastDay).padStart(2,'0');

  // Outward supplies — invoices & credit notes
  const outDocs = (documents||[]).filter(d => {
    if (!['invoice','creditnote'].includes(d.type)) return false;
    const dt = d.date || d.invoiceDate || '';
    return dt >= from && dt <= to;
  });

  // ITC — purchase bills from registered vendors (with GSTIN)
  const inDocs = (documents||[]).filter(d => {
    if (d.type !== 'purchasebill') return false;
    const dt = d.date || '';
    const vendor = vendors?.find(v=>v.id===d.vendorId);
    return dt >= from && dt <= to && vendor?.gstin;
  });

  // Compute totals
  function sumTotals(docs) {
    let subtotal=0, cgst=0, sgst=0, igst=0;
    docs.forEach(d => {
      const t = computeTotals(d, businessInfo?.state||'', 'india');
      const sign = d.type==='creditnote' ? -1 : 1;
      subtotal += t.subtotal * sign;
      cgst += t.cgst * sign;
      sgst += t.sgst * sign;
      igst += t.igst * sign;
    });
    return { subtotal, cgst, sgst, igst, totalTax: cgst+sgst+igst };
  }

  const out = sumTotals(outDocs);
  const itc = sumTotals(inDocs);
  const netCGST = Math.max(0, out.cgst - itc.cgst);
  const netSGST = Math.max(0, out.sgst - itc.sgst);
  const netIGST = Math.max(0, out.igst - itc.igst);
  const netTax  = netCGST + netSGST + netIGST;

  // Table 3.2 — interstate to unregistered (IGST only, no GSTIN)
  const unreg = outDocs.filter(d => {
    const c = customers?.find(x=>x.id===d.customerId);
    return d.type==='invoice' && !c?.gstin;
  });
  const unreg3p2 = sumTotals(unreg);

  // Rows for output breakdown
  const outRows = [
    ['3.1(a)','Outward taxable supplies (other than zero rated/nil/exempt)', out.subtotal, out.cgst, out.sgst, out.igst],
    ['3.1(b)','Zero rated supplies (Exports)', 0, 0, 0, 0],
    ['3.1(c)','Nil rated / Exempt supplies', 0, 0, 0, 0],
    ['3.2','Supplies to unregistered / composition (IGST only)', unreg3p2.subtotal, '-', '-', unreg3p2.igst],
  ];

  const tableHeaderStyle = { background:'#1E2A4A', color:'#fff', padding:'8px 10px', textAlign:'left', fontSize:11, fontWeight:700 };
  const tdStyle = (right=false) => ({ padding:'7px 10px', fontSize:13, textAlign: right?'right':'left', borderBottom:'1px solid #f0ece5' });

  const PrintContent = () => (
    <div style={{ fontFamily:'Georgia, serif' }}>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <div style={{ fontSize:18, fontWeight:700 }}>{businessInfo?.name||''}</div>
          {businessInfo?.address && <div style={{ fontSize:11, color:'#555' }}>{businessInfo.address}</div>}
          {businessInfo?.gst && <div style={{ fontSize:11 }}>GSTIN: {businessInfo.gst}</div>}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize:20, fontWeight:700 }}>GSTR-3B</div>
          <div style={{ fontSize:12, color:'#555' }}>Return Period: {month}</div>
        </div>
      </div>
      {/* Table 3.1 — Outward Supplies */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1E2A4A', marginBottom:6, background:'#E8F0FE', padding:'6px 10px', borderRadius:4 }}>
          Table 3 — Details of Outward Supplies and Inward Supplies Liable to Reverse Charge
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr>
            {['Row','Nature of Supplies','Taxable Value','CGST','SGST','IGST'].map(h=><th key={h} style={tableHeaderStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            {outRows.map(([row,label,taxable,cgst,sgst,igst])=>(
              <tr key={row} style={{ background:'#fff' }}>
                <td style={tdStyle()}>{row}</td>
                <td style={tdStyle()}>{label}</td>
                <td style={tdStyle(true)}>{typeof taxable==='number'?fmt(taxable):taxable}</td>
                <td style={tdStyle(true)}>{typeof cgst==='number'?fmt(cgst):cgst}</td>
                <td style={tdStyle(true)}>{typeof sgst==='number'?fmt(sgst):sgst}</td>
                <td style={tdStyle(true)}>{typeof igst==='number'?fmt(igst):igst}</td>
              </tr>
            ))}
            <tr style={{ background:'#F8F7F4', fontWeight:700 }}>
              <td colSpan={2} style={{ ...tdStyle(), fontWeight:700 }}>Total Output Tax</td>
              <td style={tdStyle(true)}>{fmt(out.subtotal)}</td>
              <td style={tdStyle(true)}>{fmt(out.cgst)}</td>
              <td style={tdStyle(true)}>{fmt(out.sgst)}</td>
              <td style={tdStyle(true)}>{fmt(out.igst)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* Table 4 — ITC */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#1E2A4A', marginBottom:6, background:'#E8F0FE', padding:'6px 10px', borderRadius:4 }}>
          Table 4 — Eligible Input Tax Credit (ITC)
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
          <thead><tr>
            {['Row','Details','Taxable Value','CGST','SGST','IGST'].map(h=><th key={h} style={tableHeaderStyle}>{h}</th>)}
          </tr></thead>
          <tbody>
            <tr>
              <td style={tdStyle()}>4(A)</td>
              <td style={tdStyle()}>ITC available — Inputs from registered suppliers</td>
              <td style={tdStyle(true)}>{fmt(itc.subtotal)}</td>
              <td style={tdStyle(true)}>{fmt(itc.cgst)}</td>
              <td style={tdStyle(true)}>{fmt(itc.sgst)}</td>
              <td style={tdStyle(true)}>{fmt(itc.igst)}</td>
            </tr>
            <tr style={{ background:'#F8F7F4', fontWeight:700 }}>
              <td colSpan={2} style={{ ...tdStyle(), fontWeight:700 }}>Total ITC</td>
              <td style={tdStyle(true)}>{fmt(itc.subtotal)}</td>
              <td style={tdStyle(true)}>{fmt(itc.cgst)}</td>
              <td style={tdStyle(true)}>{fmt(itc.sgst)}</td>
              <td style={tdStyle(true)}>{fmt(itc.igst)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      {/* Net Tax Payable */}
      <div style={{ background:'#1E2A4A', color:'#fff', borderRadius:8, padding:'14px 20px' }}>
        <div style={{ fontSize:13, fontWeight:700, marginBottom:10, borderBottom:'1px solid rgba(255,255,255,0.2)', paddingBottom:8 }}>
          Net GST Payable (Output Tax − ITC)
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
          {[['CGST', out.cgst, itc.cgst, netCGST],['SGST', out.sgst, itc.sgst, netSGST],['IGST', out.igst, itc.igst, netIGST],['Total', out.totalTax, itc.totalTax, netTax]].map(([l,o,i,n])=>(
            <div key={l} style={{ background:'rgba(255,255,255,0.1)', borderRadius:6, padding:'10px 12px' }}>
              <div style={{ fontSize:11, opacity:0.7, marginBottom:4 }}>{l}</div>
              <div style={{ fontSize:11, opacity:0.7 }}>Output: {fmt(o)}</div>
              <div style={{ fontSize:11, opacity:0.7 }}>ITC: {fmt(i)}</div>
              <div style={{ fontSize:16, fontWeight:700, marginTop:6, borderTop:'1px solid rgba(255,255,255,0.2)', paddingTop:4 }}>{fmt(n)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ padding:'24px 32px' }}>
      {showPrint && (
        <DocPrintOverlay onClose={()=>setShowPrint(false)} filename={`GSTR-3B-${month}.pdf`} businessInfo={businessInfo}>
          <PrintContent/>
        </DocPrintOverlay>
      )}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <h2 className="serif" style={{ fontSize:22, fontWeight:700, color:'#1E2A4A', margin:0 }}>GSTR-3B Report</h2>
          <div style={{ fontSize:13, color:'#888', marginTop:2 }}>Monthly GST summary return — outward supplies, ITC, net payable</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type='month' value={month} onChange={e=>setMonth(e.target.value)} style={{ ...{ padding:'8px 12px', borderRadius:8, border:'1px solid #EAE6DB', fontSize:13, background:'#fff' } }}/>
          <button onClick={()=>setShowPrint(true)} style={styles.primaryBtn}><Printer size={15}/> Print / PDF</button>
        </div>
      </div>
      {/* Summary stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[['Output CGST', out.cgst,'#1E2A4A'],['Output SGST', out.sgst,'#1E2A4A'],['Output IGST', out.igst,'#1E2A4A'],['Total Output Tax', out.totalTax,'#C9A24B'],['ITC CGST', itc.cgst,'#1a6b30'],['ITC SGST', itc.sgst,'#1a6b30'],['ITC IGST', itc.igst,'#1a6b30'],['Total ITC', itc.totalTax,'#1a6b30']].map(([l,v,c])=>(
          <div key={l} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:8, padding:'12px 16px' }}>
            <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{l}</div>
            <div style={{ fontSize:18, fontWeight:700, color:c, marginTop:4 }}>{fmt(v)}</div>
          </div>
        ))}
      </div>
      {/* Net Payable Banner */}
      <div style={{ background:'#1E2A4A', color:'#fff', borderRadius:10, padding:'16px 24px', marginBottom:24, display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
        {[['Net CGST Payable', netCGST],['Net SGST Payable', netSGST],['Net IGST Payable', netIGST],['Total GST Payable', netTax]].map(([l,v])=>(
          <div key={l} style={{ borderRight: l!=='Total GST Payable'?'1px solid rgba(255,255,255,0.2)':'none', paddingRight:16 }}>
            <div style={{ fontSize:11, opacity:0.7 }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:700, marginTop:4 }}>{fmt(v)}</div>
          </div>
        ))}
      </div>
      {/* Table 3.1 */}
      <div style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:10, overflow:'hidden', marginBottom:20 }}>
        <div style={{ padding:'12px 16px', fontWeight:700, fontSize:13, color:'#1E2A4A', borderBottom:'1px solid #EAE6DB', background:'#F8F7F4' }}>Table 3 — Outward Supplies</div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:'#F8F7F4' }}>
            {['Row','Nature','Taxable Value','CGST','SGST','IGST'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:h==='Row'||h==='Nature'?'left':'right', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {outRows.map(([row,label,taxable,cgst,sgst,igst])=>(
              <tr key={row} style={{ borderBottom:'1px solid #F0ECE5' }}>
                <td style={{ padding:'9px 12px', fontWeight:600, width:80 }}>{row}</td>
                <td style={{ padding:'9px 12px', color:'#555' }}>{label}</td>
                <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:600 }}>{typeof taxable==='number'?fmt(taxable):taxable}</td>
                <td style={{ padding:'9px 12px', textAlign:'right' }}>{typeof cgst==='number'?fmt(cgst):cgst}</td>
                <td style={{ padding:'9px 12px', textAlign:'right' }}>{typeof sgst==='number'?fmt(sgst):sgst}</td>
                <td style={{ padding:'9px 12px', textAlign:'right' }}>{typeof igst==='number'?fmt(igst):igst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Table 4 — ITC */}
      <div style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:10, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', fontWeight:700, fontSize:13, color:'#1E2A4A', borderBottom:'1px solid #EAE6DB', background:'#F8F7F4' }}>Table 4 — Input Tax Credit (ITC)</div>
        <div style={{ padding:'14px 16px', fontSize:13, color:'#555' }}>
          ITC is computed from purchase bills where vendor GSTIN is on record.
          {inDocs.length === 0 && <span style={{ color:'#B5453A', marginLeft:8 }}>No eligible purchase bills found for {month}.</span>}
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:'#F8F7F4' }}>
            {['Row','Details','Taxable Value','CGST','SGST','IGST'].map(h=><th key={h} style={{ padding:'8px 12px', textAlign:h==='Row'||h==='Details'?'left':'right', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            <tr style={{ borderBottom:'1px solid #F0ECE5' }}>
              <td style={{ padding:'9px 12px', fontWeight:600 }}>4(A)</td>
              <td style={{ padding:'9px 12px', color:'#555' }}>Inputs from registered suppliers (purchase bills with GSTIN)</td>
              <td style={{ padding:'9px 12px', textAlign:'right', fontWeight:600 }}>{fmt(itc.subtotal)}</td>
              <td style={{ padding:'9px 12px', textAlign:'right' }}>{fmt(itc.cgst)}</td>
              <td style={{ padding:'9px 12px', textAlign:'right' }}>{fmt(itc.sgst)}</td>
              <td style={{ padding:'9px 12px', textAlign:'right' }}>{fmt(itc.igst)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// UAE VAT RETURN REPORT
// ─────────────────────────────────────────────


export function VATReport({ documents, customers, businessInfo }) {
  const now = new Date();
  const [from, setFrom] = useState(now.toISOString().slice(0, 7) + '-01');
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [showPrint, setShowPrint] = useState(false);
  const cc = COUNTRY_CONFIG['uae'];
  const fmt = (n) => currency(n, cc.currency);
  const isService = businessInfo.companyType === 'service';
  const supplyLabel = isService ? 'Standard rated services (5%)' : 'Standard rated supplies (5%)';
  const supplyLabelB = isService ? 'Zero rated services' : 'Zero rated supplies';
  const supplyLabelC = isService ? 'Exempt services' : 'Exempt supplies';

  const invoices = filterByRange(documents, ['invoice'], from, to);
  const purchases = filterByRange(documents, ['purchasebill'], from, to);

  const invRows = invoices.map(d => {
    const t = computeTotals(d, businessInfo.state, 'uae');
    const c = customers.find(x => x.id === d.customerId);
    return { ...t, number: d.number, date: d.date, party: c ? c.name : (d.customerSnapshot?.name || '—'), trn: c?.gstin || '' };
  }).sort((a,b) => a.date > b.date ? 1 : -1);

  const purRows = purchases.map(d => {
    const t = computeTotals(d, businessInfo.state, 'uae');
    return { ...t, number: d.number, date: d.date, party: d.customerSnapshot?.name || '—' };
  }).sort((a,b) => a.date > b.date ? 1 : -1);

  const outputVAT = invRows.reduce((s,r) => s + r.vat, 0);
  const inputVAT  = purRows.reduce((s,r) => s + r.vat, 0);
  const netVAT    = outputVAT - inputVAT;
  const taxableSales = invRows.reduce((s,r) => s + r.subtotal, 0);
  const taxablePurch = purRows.reduce((s,r) => s + r.subtotal, 0);
  const thStyle = { ...styles.th, fontSize: 11 };

  function exportCSV() {
    downloadCSV('vat-return-' + from + '-to-' + to + '.csv',
      ['Type','Invoice/Bill No','Date','Party','TRN','Taxable (AED)','VAT 5% (AED)','Total (AED)'],
      [
        ...invRows.map(r => ['Sales', r.number, r.date, r.party, r.trn, r.subtotal.toFixed(2), r.vat.toFixed(2), r.grandTotal.toFixed(2)]),
        ...purRows.map(r => ['Purchase', r.number, r.date, r.party, '', r.subtotal.toFixed(2), r.vat.toFixed(2), r.grandTotal.toFixed(2)]),
        ['','','','','','','',''],
        ['SUMMARY','','','','','','',''],
        ['Output VAT (Sales)','','','','',taxableSales.toFixed(2),outputVAT.toFixed(2),''],
        ['Input VAT (Purchases)','','','','',taxablePurch.toFixed(2),inputVAT.toFixed(2),''],
        ['Net VAT Payable','','','','','',netVAT.toFixed(2),''],
      ]
    );
  }

  const PrintContent = () => (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{businessInfo.name}</div>
          <div style={{ fontSize: 12, color:'#555' }}>{businessInfo.address}</div>
          {businessInfo.gstin && <div style={{ fontSize: 12 }}>TRN: {businessInfo.gstin}</div>}
        </div>
        <div style={{ textAlign:'right' }}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>VAT RETURN</div>
          <div style={{ fontSize: 12, color:'#555' }}>Period: {from} to {to}</div>
          <div style={{ fontSize: 11, color:'#888' }}>UAE Federal Tax Authority</div>
        </div>
      </div>

      {/* VAT 201 Table */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8, borderBottom: '2px solid #1E2A4A', paddingBottom: 4 }}>VAT 201 — Tax Return Summary</div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize: 12 }}>
          <thead>
            <tr style={{ background:'#1E2A4A', color:'#fff' }}>
              <th style={{ padding:'7px 10px', textAlign:'left' }}>Box</th>
              <th style={{ padding:'7px 10px', textAlign:'left' }}>Description</th>
              <th style={{ padding:'7px 10px', textAlign:'right' }}>Amount (AED)</th>
              <th style={{ padding:'7px 10px', textAlign:'right' }}>VAT Amount (AED)</th>
            </tr>
          </thead>
          <tbody>
            {[['1a', supplyLabel, taxableSales, outputVAT],
              ['1b', supplyLabelB, 0, 0],
              ['1c', supplyLabelC, 0, 0],
              ['6a', isService ? 'Standard rated expenses (5%)' : 'Standard rated expenses (5%)', taxablePurch, inputVAT],
            ].map(([code, label, amt, tax]) => (
              <tr key={code} style={{ borderBottom:'1px solid #eee' }}>
                <td style={{ padding:'7px 10px', color:'#888', width: 50 }}>{code}</td>
                <td style={{ padding:'7px 10px' }}>{label}</td>
                <td style={{ padding:'7px 10px', textAlign:'right' }}>{fmt(amt)}</td>
                <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600 }}>{fmt(tax)}</td>
              </tr>
            ))}
            <tr style={{ background:'#1E2A4A', color:'#fff', fontWeight:700 }}>
              <td colSpan={3} style={{ padding:'9px 10px' }}>Net VAT Due (Output − Input)</td>
              <td style={{ padding:'9px 10px', textAlign:'right', fontSize:14 }}>{fmt(netVAT)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sales Detail */}
      {invRows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight:700, fontSize:12, marginBottom:6 }}>Sales Invoices ({invRows.length})</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead><tr style={{ background:'#f0f0f0' }}>{['Invoice','Date','Customer','TRN','Taxable (AED)','VAT 5%','Total (AED)'].map(h=><th key={h} style={{ padding:'5px 8px', textAlign: h.includes('AED')||h==='VAT 5%'?'right':'left' }}>{h}</th>)}</tr></thead>
            <tbody>
              {invRows.map(r=><tr key={r.number} style={{ borderBottom:'1px solid #f0f0f0' }}>
                <td style={{ padding:'5px 8px' }}>{r.number}</td>
                <td style={{ padding:'5px 8px' }}>{r.date}</td>
                <td style={{ padding:'5px 8px' }}>{r.party}</td>
                <td style={{ padding:'5px 8px', fontFamily:'monospace' }}>{r.trn||'—'}</td>
                <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmt(r.subtotal)}</td>
                <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmt(r.vat)}</td>
                <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:600 }}>{fmt(r.grandTotal)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}

      {/* Purchase Detail */}
      {purRows.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight:700, fontSize:12, marginBottom:6 }}>Purchase Bills — Input VAT ({purRows.length})</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead><tr style={{ background:'#f0f0f0' }}>{['Bill No','Date','Vendor','Taxable (AED)','VAT 5%','Total (AED)'].map(h=><th key={h} style={{ padding:'5px 8px', textAlign: h.includes('AED')||h==='VAT 5%'?'right':'left' }}>{h}</th>)}</tr></thead>
            <tbody>
              {purRows.map(r=><tr key={r.number} style={{ borderBottom:'1px solid #f0f0f0' }}>
                <td style={{ padding:'5px 8px' }}>{r.number}</td>
                <td style={{ padding:'5px 8px' }}>{r.date}</td>
                <td style={{ padding:'5px 8px' }}>{r.party}</td>
                <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmt(r.subtotal)}</td>
                <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmt(r.vat)}</td>
                <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:600 }}>{fmt(r.grandTotal)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 28, fontSize: 11, color:'#888', borderTop:'1px solid #ddd', paddingTop: 8 }}>
        Generated by Operix · {new Date().toLocaleDateString()}
      </div>
    </div>
  );

  return (
    <div style={styles.page}>
      {showPrint && <PrintModal title="VAT Return" onClose={() => setShowPrint(false)}><PrintContent /></PrintModal>}
      <div style={styles.pageHeader}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>VAT Return</h2>
          <div style={{ fontSize: 13, color:'#888780' }}>UAE Federal Tax Authority — VAT 201</div>
        </div>
        <div style={{ display:'flex', gap: 8 }}>
          <button style={styles.secondaryBtn} onClick={exportCSV}><Download size={15}/> Export CSV</button>
          <button style={styles.primaryBtn} onClick={() => setShowPrint(true)}><Printer size={15}/> Print / PDF</button>
        </div>
      </div>

      <DateRangePicker from={from} setFrom={setFrom} to={to} setTo={setTo} count={invRows.length} label="sales invoice(s)" />

      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:24 }}>
        {[['Taxable Sales', taxableSales, '#1E2A4A'],['Output VAT (5%)', outputVAT, '#6B5BAE'],
          ['Taxable Purchases', taxablePurch, '#3D7A5C'],['Input VAT (5%)', inputVAT, '#8A6FD6'],
          ['Net VAT Payable', netVAT, netVAT >= 0 ? '#B5453A' : '#065F46'],
          ['Total Invoices', invRows.length, '#C9A24B']].map(([l,v,a]) => (
          <div key={l} style={{ ...styles.statCard, padding:'12px 14px' }}>
            <div style={{ ...styles.statBar, background:a }} />
            <div><div style={{ ...styles.statLabel, fontSize:11 }}>{l}</div>
              <div className="serif" style={{ ...styles.statValue, fontSize:15 }}>{l==='Total Invoices'?v:fmt(v)}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...styles.card, marginBottom:20 }}>
        <div style={styles.cardTitle}>VAT 201 Summary</div>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead><tr style={{ background:'#f8f7f5' }}>
            {['Box','Description','Amount (AED)','VAT (AED)'].map(h=><th key={h} style={{ ...thStyle, textAlign: h.includes('AED')?'right':'left' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[['1a', supplyLabel, taxableSales, outputVAT],
              ['1b', supplyLabelB, 0, 0],['1c', supplyLabelC, 0, 0],
              ['6a', 'Standard rated expenses (5%)', taxablePurch, inputVAT]].map(([code,label,amt,tax])=>(
              <tr key={code} style={{ borderBottom:'1px solid #eee' }}>
                <td style={{ padding:'8px 10px', color:'#888', width:50 }}>{code}</td>
                <td style={{ padding:'8px 10px' }}>{label}</td>
                <td style={{ padding:'8px 10px', textAlign:'right' }}>{fmt(amt)}</td>
                <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:600 }}>{fmt(tax)}</td>
              </tr>
            ))}
            <tr style={{ background:'#1E2A4A', color:'#fff', fontWeight:700 }}>
              <td colSpan={3} style={{ padding:'10px 10px' }}>Net VAT Due (Output − Input)</td>
              <td style={{ padding:'10px 10px', textAlign:'right', fontSize:15 }}>{fmt(netVAT)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {invRows.length > 0 && (<>
        <div style={styles.dashSection}>Sales Invoices</div>
        <div style={{ overflowX:'auto', marginBottom:20 }}>
          <table style={styles.table}>
            <thead><tr>{['Invoice','Date','Customer','TRN','Taxable (AED)','VAT 5%','Total (AED)'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>{invRows.map(r=><tr key={r.number}>
              <td style={{ ...styles.td, fontFamily:'monospace' }}>{r.number}</td>
              <td style={styles.td}>{r.date}</td>
              <td style={{ ...styles.td, fontWeight:500 }}>{r.party}</td>
              <td style={{ ...styles.td, fontFamily:'monospace', fontSize:11 }}>{r.trn||'—'}</td>
              <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.subtotal)}</td>
              <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.vat)}</td>
              <td style={{ ...styles.td, textAlign:'right', fontWeight:600 }}>{fmt(r.grandTotal)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>)}
      {purRows.length > 0 && (<>
        <div style={styles.dashSection}>Purchase Bills (Input VAT)</div>
        <div style={{ overflowX:'auto' }}>
          <table style={styles.table}>
            <thead><tr>{['Bill No','Date','Vendor','Taxable (AED)','VAT 5%','Total (AED)'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>{purRows.map(r=><tr key={r.number}>
              <td style={{ ...styles.td, fontFamily:'monospace' }}>{r.number}</td>
              <td style={styles.td}>{r.date}</td>
              <td style={{ ...styles.td, fontWeight:500 }}>{r.party}</td>
              <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.subtotal)}</td>
              <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.vat)}</td>
              <td style={{ ...styles.td, textAlign:'right', fontWeight:600 }}>{fmt(r.grandTotal)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>)}
      {invRows.length === 0 && purRows.length === 0 && <div style={styles.emptyBox}>No approved documents for selected period.</div>}
    </div>
  );
}

// ─────────────────────────────────────────────
// GENERIC TAX REPORT (Other countries)
// ─────────────────────────────────────────────


export function TaxReport({ documents, customers, businessInfo }) {
  const [useLHTax, setUseLHTax] = React.useState(!!(businessInfo?.letterhead||businessInfo?.letterheadHtml));
  const now = new Date();
  const [from, setFrom] = useState(now.toISOString().slice(0, 7) + '-01');
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const cc = COUNTRY_CONFIG['other'];
  const fmt = (n) => currency(n, cc.currency);

  const invoices = filterByRange(documents, ['invoice'], from, to);
  const purchases = filterByRange(documents, ['purchasebill'], from, to);

  const invRows = invoices.map(d => {
    const t = computeTotals(d, businessInfo.state, 'other');
    const c = customers.find(x => x.id === d.customerId);
    return { ...t, number: d.number, date: d.date, party: c ? c.name : (d.customerSnapshot?.name || '—') };
  }).sort((a,b) => a.date > b.date ? 1 : -1);

  const purRows = purchases.map(d => {
    const t = computeTotals(d, businessInfo.state, 'other');
    return { ...t, number: d.number, date: d.date, party: d.customerSnapshot?.name || '—' };
  }).sort((a,b) => a.date > b.date ? 1 : -1);

  const outputTax = invRows.reduce((s,r) => s + r.totalTax, 0);
  const inputTax  = purRows.reduce((s,r) => s + r.totalTax, 0);
  const netTax    = outputTax - inputTax;
  const thStyle   = { ...styles.th, fontSize: 11 };

  return (
    <div style={styles.page} id="tax-report-page">
      <div style={styles.pageHeader}>
        <div>
          <h2 className="serif" style={styles.pageTitle}>Tax Report</h2>
          <div style={{ fontSize: 13, color: '#888780' }}>Sales & purchase tax summary</div>
        </div>
        {(businessInfo?.letterhead||businessInfo?.letterheadHtml) && <button onClick={() => setUseLHTax(v=>!v)} style={{ ...styles.ghostBtn, ...(useLHTax?{background:'#EEF2FF',color:'#3D52A0',fontWeight:600}:{}) }}>📃 {useLHTax?'Letterhead ON':'Use Letterhead'}</button>}
        <button style={styles.ghostBtn} onClick={() => downloadDocPDF('#tax-report-page','tax-report.pdf')}><Download size={15}/> PDF</button>
        <button style={styles.primaryBtn} onClick={() => window.print()}><Printer size={15} /> Print</button>
      </div>

      {useLHTax && (businessInfo?.letterhead || businessInfo?.letterheadHtml || businessInfo?.letterheadFooter) && <LetterpadPrintStyle />}
      {useLHTax && <LetterheadHeader bi={businessInfo} />}
      <DateRangePicker from={from} setFrom={setFrom} to={to} setTo={setTo} count={invRows.length} label="invoice(s)" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 24 }}>
        {[['Output Tax', outputTax, '#6B5BAE'],['Input Tax', inputTax, '#3D7A5C'],['Net Tax Payable', netTax, netTax >= 0 ? '#B5453A' : '#065F46']].map(([l,v,a]) => (
          <div key={l} style={{ ...styles.statCard, padding: '14px 16px' }}>
            <div style={{ ...styles.statBar, background: a }} />
            <div><div style={styles.statLabel}>{l}</div><div className="serif" style={styles.statValue}>{fmt(v)}</div></div>
          </div>
        ))}
      </div>

      {invRows.length > 0 && (<>
        <div style={styles.dashSection}>Sales ({invRows.length} invoices)</div>
        <div style={{ overflowX: 'auto', marginBottom: 20 }}>
          <table style={styles.table}>
            <thead><tr>{['Invoice','Date','Customer','Taxable','Tax','Total'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {invRows.map(r=>(
                <tr key={r.number}>
                  <td style={{ ...styles.td, fontFamily:'monospace' }}>{r.number}</td>
                  <td style={styles.td}>{r.date}</td>
                  <td style={{ ...styles.td, fontWeight:500 }}>{r.party}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.subtotal)}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.totalTax)}</td>
                  <td style={{ ...styles.td, textAlign:'right', fontWeight:600 }}>{fmt(r.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {purRows.length > 0 && (<>
        <div style={styles.dashSection}>Purchases ({purRows.length} bills)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead><tr>{['Bill No','Date','Vendor','Taxable','Tax','Total'].map(h=><th key={h} style={thStyle}>{h}</th>)}</tr></thead>
            <tbody>
              {purRows.map(r=>(
                <tr key={r.number}>
                  <td style={{ ...styles.td, fontFamily:'monospace' }}>{r.number}</td>
                  <td style={styles.td}>{r.date}</td>
                  <td style={{ ...styles.td, fontWeight:500 }}>{r.party}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.subtotal)}</td>
                  <td style={{ ...styles.td, textAlign:'right' }}>{fmt(r.totalTax)}</td>
                  <td style={{ ...styles.td, textAlign:'right', fontWeight:600 }}>{fmt(r.grandTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {invRows.length === 0 && purRows.length === 0 && <div style={styles.emptyBox}>No approved documents found for the selected period.</div>}
      {useLHTax && businessInfo?.letterheadFooter && (
        <div className="lh-pad-footer" style={{ background: '#fff' }}>
          <img src={businessInfo.letterheadFooter} alt="letterhead footer" style={{ width:'100%', display:'block' }} />
        </div>
      )}
    </div>
  );
}

// ── Bin Card ──────────────────────────────────────────────────────────────────
// ─── Enquiry Module ──────────────────────────────────────────────────────────

// ─── Engineering ───────────────────────────────────────────────

// ─── Quality Check ────────────────────────────────────────────────────────────


