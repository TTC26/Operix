import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { AlertTriangle, BarChart2, Bell, BookOpen, Briefcase, CheckCircle, CheckSquare, ChevronDown, ChevronRight, ClipboardList, Clock, Cloud, CloudOff, Download, Factory, FileMinus, FileSignature, FileText, LayoutDashboard, Layers, LogOut, MapPin, Package, Paperclip, Pencil, Plus, Printer, Search, Settings, Shield, ShoppingCart, Square, Trash2, Truck, Users, Wrench, X } from 'lucide-react';
import { uploadDrawing, deleteDrawing } from './firebase';
import { ROLE_MODULES, TEST_EMAILS, PLAN_MODULES, DOC_TYPES, CONVERT_TO, EMPTY_ITEM_ROW, blankDoc, COUNTRY_CONFIG, numToWords, currency, makeFmt, computeTotals, calcModuleTax, computeStock, downloadCSV, filterByRange, loadScript, parseOCRText, styles, TaxSummaryBox, DocPrintOverlay, Modal, LetterpadPrintStyle, sanitizeLHtml, LetterheadHeader, VoucherPrintHeader, VoucherSignatory, ApprovalActions, StatusBadge, DocRow, StatCard, BIZ_BADGE, DocumentsList, ConvertDropdown, PrintModal, DateRangePicker, SpecsFields, DrawingUploader, LockedModuleScreen, TemplateMiniPreview, sendNotificationEmail } from './utils.jsx';

export function MepBomView({ mepBoms, setMepBoms, siteProjects, scopeOfWork, siteActivities, setSiteActivities, userRole, businessInfo }) {
  const [subView, setSubView]     = useState('list');   // 'list' | 'edit'
  const [editing, setEditing]     = useState(null);
  const [showCatalogue, setShowCatalogue] = useState(false);
  const canEdit = userRole === 'admin' || userRole === 'manager';

  // MEP_DISCIPLINES, MEP_UNITS, MEP_LINE_STATUSES — use exported constants

  function newBom(projectId) {
    return {
      id: crypto.randomUUID(), projectId,
      ref: '', contractRef: '', date: new Date().toISOString().slice(0,10),
      items: [], status: 'draft', createdAt: Date.now(),
    };
  }
  function blankItem(seq) {
    return {
      id: crypto.randomUUID(), seq, description: '', discipline: MEP_DISCIPLINES[0],
      unit: 'nos', qty: '', rate: '', plannedStart: '', plannedEnd: '',
      status: 'Pending', activityId: '', catalogueRef: '',
    };
  }

  function saveBom(bom) {
    setMepBoms(prev => prev.find(b=>b.id===bom.id) ? prev.map(b=>b.id===bom.id?bom:b) : [...prev, bom]);
    setSubView('list');
  }

  function deleteBom(id) {
    if (!confirm('Delete this BOM?')) return;
    setMepBoms(prev => prev.filter(b=>b.id!==id));
  }

  // Push a BOM line item → create/update Activity in activityPlanner
  function pushToActivity(bom, item) {
    if (!bom.projectId) return alert('Select a project first.');
    const existing = siteActivities.find(a=>a.bomItemId===item.id);
    if (existing) { alert('Activity already linked: ' + (existing.name||existing.id)); return; }
    const newAct = {
      id: crypto.randomUUID(),
      projectId: bom.projectId,
      bomItemId: item.id,
      name: item.description,
      discipline: item.discipline,
      startDate: item.plannedStart,
      endDate: item.plannedEnd,
      status: 'not-started',
      weight: 5,
      bom: [], bomLocked: false,
      createdAt: Date.now(),
    };
    setSiteActivities(prev => [...prev, newAct]);
    // Update item with activityId
    const updatedItems = editing.items.map(i => i.id===item.id ? {...i, activityId: newAct.id} : i);
    setEditing(prev => ({...prev, items: updatedItems}));
    alert('Activity created in Activity Planner!');
  }

  function importFromCatalogue(catItem) {
    const seq = (editing.items.length || 0) + 1;
    const newItem = { ...blankItem(seq), description: catItem.name, discipline: 'Other', unit: catItem.unit||'nos', rate: catItem.rate||'', catalogueRef: catItem.id };
    setEditing(prev => ({...prev, items: [...prev.items, newItem]}));
  }

  function updateItem(itemId, field, val) {
    setEditing(prev => ({...prev, items: prev.items.map(i => i.id===itemId ? {...i, [field]: val} : i)}));
  }
  function addItem() {
    const seq = (editing.items.length||0)+1;
    setEditing(prev=>({...prev, items:[...prev.items, blankItem(seq)]}));
  }
  function removeItem(itemId) {
    setEditing(prev=>({...prev, items: prev.items.filter(i=>i.id!==itemId).map((i,idx)=>({...i,seq:idx+1}))}));
  }

  const currency = businessInfo?.currency || 'AED';
  const totalAmt = (editing?.items||[]).reduce((s,i)=>s+(parseFloat(i.qty)||0)*(parseFloat(i.rate)||0),0);

  const ST_COLOR = { draft:{bg:'#F5F5F5',color:'#888'}, approved:{bg:'#D4EDDA',color:'#1a6b30'} };

  // ── List View ──────────────────────────────────────────────────────────────
  if (subView === 'list') return (
    <div style={styles.page}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24}}>
        <div>
          <h1 className="serif" style={styles.h1}>Project BOM</h1>
          <p style={styles.muted}>Bill of Materials per project — link scope items to activities.</p>
        </div>
        {canEdit && (
          <div style={{display:'flex',gap:8}}>
            <select onChange={e=>{ if(e.target.value){ setEditing(newBom(e.target.value)); setSubView('edit'); e.target.value=''; }}}
              style={{...styles.input, width:200}}>
              <option value="">+ New BOM for project…</option>
              {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {mepBoms.length === 0 && <div style={styles.emptyBox}>No project BOMs yet. Select a project above to create one.</div>}

      {siteProjects.map(proj => {
        const boms = mepBoms.filter(b=>b.projectId===proj.id);
        if (!boms.length) return null;
        return (
          <div key={proj.id} style={{marginBottom:24}}>
            <div style={{fontSize:12,fontWeight:700,color:'#1E7A9A',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>
              📁 {proj.name}
            </div>
            {boms.map(bom => {
              const total = bom.items.reduce((s,i)=>s+(parseFloat(i.qty)||0)*(parseFloat(i.rate)||0),0);
              const linked = bom.items.filter(i=>i.activityId).length;
              const st = ST_COLOR[bom.status]||ST_COLOR.draft;
              return (
                <div key={bom.id} style={{...styles.recordRow, marginBottom:8, alignItems:'center'}}>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>
                      BOM {bom.ref||bom.id.slice(0,6).toUpperCase()}
                      {bom.contractRef && <span style={{fontSize:12,color:'#888',marginLeft:8}}>· Contract: {bom.contractRef}</span>}
                    </div>
                    <div style={{fontSize:12,color:'#888',marginTop:3}}>
                      {bom.date} · {bom.items.length} items · {currency} {total.toLocaleString('en',{minimumFractionDigits:2})} · {linked}/{bom.items.length} linked to activities
                    </div>
                  </div>
                  <span style={{...styles.badge, background:st.bg, color:st.color, marginRight:8}}>{bom.status}</span>
                  {canEdit && <>
                    <button onClick={()=>{setEditing(bom);setSubView('edit');}} style={styles.iconBtn}><Pencil size={14}/></button>
                    <button onClick={()=>deleteBom(bom.id)} style={{...styles.iconBtn,color:'#B5453A'}}><Trash2 size={14}/></button>
                  </>}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );

  // ── Edit View ──────────────────────────────────────────────────────────────
  const project = siteProjects.find(p=>p.id===editing.projectId);

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={()=>setSubView('list')} style={styles.ghostBtn}>← Back</button>
          <h2 className="serif" style={{...styles.h2, margin:0}}>
            Project BOM — {project?.name || 'Unknown Project'}
          </h2>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>setShowCatalogue(s=>!s)} style={styles.ghostBtn}>📋 Import from Catalogue</button>
          {canEdit && <button onClick={()=>saveBom(editing)} style={styles.primaryBtn}><CheckCircle size={14}/> Save BOM</button>}
        </div>
      </div>

      {/* BOM Meta */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20,background:'#F9F8F5',borderRadius:10,padding:16}}>
        <div>
          <div style={styles.fieldLabel}>BOM Reference</div>
          <input value={editing.ref||''} onChange={e=>setEditing(p=>({...p,ref:e.target.value}))} style={styles.input} placeholder="e.g. BOM-001"/>
        </div>
        <div>
          <div style={styles.fieldLabel}>Contract / PO Ref</div>
          <input value={editing.contractRef||''} onChange={e=>setEditing(p=>({...p,contractRef:e.target.value}))} style={styles.input} placeholder="Contract number"/>
        </div>
        <div>
          <div style={styles.fieldLabel}>Date</div>
          <input type="date" value={editing.date||''} onChange={e=>setEditing(p=>({...p,date:e.target.value}))} style={styles.input}/>
        </div>
      </div>

      {/* Catalogue Import Panel */}
      {showCatalogue && (
        <div style={{background:'#EEF7FA',border:'1px solid #B2D8E8',borderRadius:10,padding:14,marginBottom:16}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:8,color:'#1E7A9A'}}>Service Catalogue — click to add</div>
          {scopeOfWork.length===0 && <div style={{fontSize:12,color:'#888'}}>No catalogue items. Add items in Service Catalogue first.</div>}
          <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
            {scopeOfWork.map(s=>(
              <button key={s.id} onClick={()=>importFromCatalogue(s)} style={{...styles.ghostBtn,fontSize:12,padding:'4px 10px'}}>
                + {s.name} ({s.unit||'hrs'})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Line Items Table */}
      <div style={{overflowX:'auto',marginBottom:16}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr style={{background:'#F0EDE8'}}>
              {['#','Description','Discipline','Qty','Unit','Rate','Amount','Plan Start','Plan End','Status','Activity',''].map(h=>(
                <th key={h} style={{padding:'8px 10px',textAlign:'left',fontWeight:700,fontSize:11,color:'#555',whiteSpace:'nowrap'}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {editing.items.map((item,idx)=>{
              const amt = (parseFloat(item.qty)||0)*(parseFloat(item.rate)||0);
              const linkedAct = siteActivities.find(a=>a.id===item.activityId);
              return (
                <tr key={item.id} style={{borderBottom:'1px solid #EAE6DB'}}>
                  <td style={{padding:'6px 10px',color:'#888',width:30}}>{item.seq}</td>
                  <td style={{padding:'4px 6px',minWidth:180}}>
                    <input value={item.description} onChange={e=>updateItem(item.id,'description',e.target.value)}
                      style={{...styles.input,padding:'4px 8px',fontSize:12}} placeholder="Work description"/>
                  </td>
                  <td style={{padding:'4px 6px',minWidth:120}}>
                    <select value={item.discipline} onChange={e=>updateItem(item.id,'discipline',e.target.value)} style={{...styles.input,padding:'4px 8px',fontSize:12}}>
                      {MEP_DISCIPLINES.map(d=><option key={d}>{d}</option>)}
                    </select>
                  </td>
                  <td style={{padding:'4px 6px',width:70}}>
                    <input type="number" value={item.qty} onChange={e=>updateItem(item.id,'qty',e.target.value)}
                      style={{...styles.input,padding:'4px 8px',fontSize:12,width:60}} placeholder="0"/>
                  </td>
                  <td style={{padding:'4px 6px',width:80}}>
                    <select value={item.unit} onChange={e=>updateItem(item.id,'unit',e.target.value)}
                      style={{...styles.input,padding:'4px 6px',fontSize:12,width:75}}>
                      {MEP_UNITS.map(u=><option key={u}>{u}</option>)}
                    </select>
                  </td>
                  <td style={{padding:'4px 6px',width:90}}>
                    <input type="number" value={item.rate} onChange={e=>updateItem(item.id,'rate',e.target.value)}
                      style={{...styles.input,padding:'4px 8px',fontSize:12,width:80}} placeholder="0.00"/>
                  </td>
                  <td style={{padding:'6px 10px',fontWeight:600,whiteSpace:'nowrap',color:amt?'#1E2A4A':'#ccc'}}>
                    {amt ? amt.toLocaleString('en',{minimumFractionDigits:2}) : '—'}
                  </td>
                  <td style={{padding:'4px 6px',width:120}}>
                    <input type="date" value={item.plannedStart} onChange={e=>updateItem(item.id,'plannedStart',e.target.value)}
                      style={{...styles.input,padding:'4px 8px',fontSize:11,width:115}}/>
                  </td>
                  <td style={{padding:'4px 6px',width:120}}>
                    <input type="date" value={item.plannedEnd} onChange={e=>updateItem(item.id,'plannedEnd',e.target.value)}
                      style={{...styles.input,padding:'4px 8px',fontSize:11,width:115}}/>
                  </td>
                  <td style={{padding:'4px 6px',width:110}}>
                    <select value={item.status} onChange={e=>updateItem(item.id,'status',e.target.value)} style={{...styles.input,padding:'4px 8px',fontSize:12}}>
                      {MEP_LINE_STATUSES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td style={{padding:'6px 10px',width:130}}>
                    {linkedAct
                      ? <span style={{fontSize:11,color:'#1a6b30',fontWeight:600}}>✓ {linkedAct.name?.slice(0,18)||'Linked'}</span>
                      : <button onClick={()=>pushToActivity(editing,item)} style={{...styles.ghostBtn,fontSize:11,padding:'3px 8px',borderColor:'#1E7A9A',color:'#1E7A9A'}}
                          title="Create activity in Activity Planner">→ Activity</button>
                    }
                  </td>
                  <td style={{padding:'4px 6px'}}>
                    <button onClick={()=>removeItem(item.id)} style={{...styles.iconBtn,color:'#B5453A'}}><X size={13}/></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add row + Total */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <button onClick={addItem} style={styles.ghostBtn}><Plus size={14}/> Add Line Item</button>
        <div style={{fontWeight:700,fontSize:15,color:'#1E2A4A'}}>
          Total: {currency} {totalAmt.toLocaleString('en',{minimumFractionDigits:2})}
        </div>
      </div>

      {/* Status */}
      <div style={{marginTop:20,display:'flex',gap:10,alignItems:'center'}}>
        <span style={{fontSize:13,fontWeight:600}}>BOM Status:</span>
        {['draft','approved'].map(s=>(
          <button key={s} onClick={()=>setEditing(p=>({...p,status:s}))}
            style={{...styles.ghostBtn, padding:'5px 14px',
              background: editing.status===s?(s==='approved'?'#D4EDDA':'#F0EDE8'):'transparent',
              fontWeight: editing.status===s?700:400,
              borderColor: s==='approved'?'#1a6b30':'#ccc',
              color: s==='approved'?'#1a6b30':'#555'}}>
            {s.charAt(0).toUpperCase()+s.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}


export const MEP_DISCIPLINES = [
  'Electrical','Plumbing & Drainage','HVAC','Firefighting',
  'Civil','ELV','BMS','Gas','Landscaping','IT/ICT','Elevator','Other',
];

export const MEP_PHASES = [
  'Mobilisation','Shop Drawing Approval','Material Submittal',
  'Procurement / Fabrication','Rough-in / First Fix',
  'Above Ceiling / Second Fix','Testing & Commissioning',
  'Inspection & Snagging','Handover','Defects Liability Period',
];

export const MEP_UNITS = [
  '%','m','m²','m³','kg','nos','set','lot','point',
  'circuit','roll','pair','box','length','bag','trip',
];

export const MEP_LINE_STATUSES = ['Pending','In Progress','Complete','On Hold','Cancelled'];

// ── Helper: compute activity progress (latest cumulative %) ────────────────────

export function getActivityProgress(actId, progressUpdates) {
  const updates = progressUpdates.filter(u => u.activityId === actId).sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  return updates.length ? (updates[0].cumulativePct || 0) : 0;
}

// ── Site Projects (MEP) ────────────────────────────────────────────────────────

export function MEPProjectsView({ siteProjects, setSiteProjects, employees, siteActivities, progressUpdates, userRole }) {
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const canEdit = userRole === 'admin' || userRole === 'manager';

  function save(form) {
    const rec = { ...form, id: form.id || crypto.randomUUID() };
    setSiteProjects(prev => form.id ? prev.map(p => p.id === form.id ? rec : p) : [...prev, rec]);
    setEditing(null);
  }
  function del(id) { if (confirm('Delete project and all its data?')) setSiteProjects(prev => prev.filter(p => p.id !== id)); }

  function projectProgress(proj) {
    const acts = siteActivities.filter(a => a.projectId === proj.id);
    if (!acts.length) return 0;
    const totalWeight = acts.reduce((s,a) => s + (parseFloat(a.weight)||1), 0);
    const weightedPct = acts.reduce((s,a) => {
      const pct = getActivityProgress(a.id, progressUpdates);
      return s + pct * (parseFloat(a.weight)||1);
    }, 0);
    return totalWeight ? Math.round(weightedPct / totalWeight) : 0;
  }

  const STATUS_COLOR = { planning:'#C9A24B', active:'#1A7A3E', on_hold:'#B5453A', completed:'#3D7A5C' };

  if (selected) {
    const proj = siteProjects.find(p => p.id === selected);
    if (!proj) { setSelected(null); return null; }
    const acts = siteActivities.filter(a => a.projectId === proj.id);
    const overallPct = projectProgress(proj);
    // Group by villa
    const villas = proj.villas || [];
    return (
      <div style={styles.page}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:18 }}>
          <button style={styles.ghostBtn} onClick={() => setSelected(null)}>← Back</button>
          <div>
            <h2 className="serif" style={styles.h2}>{proj.name}</h2>
            <div style={{ fontSize:12, color:'#888' }}>{proj.client} · {proj.location}</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
            {canEdit && <button style={styles.ghostBtn} onClick={() => setEditing(proj)}>Edit Project</button>}
          </div>
        </div>
        {/* Overall progress */}
        <div style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
            <span style={{ fontWeight:600, fontSize:14 }}>Overall Completion</span>
            <span style={{ fontWeight:700, fontSize:18, color: overallPct===100?'#1A7A3E':'#1E2A4A' }}>{overallPct}%</span>
          </div>
          <div style={{ background:'#EAE6DB', borderRadius:6, height:10 }}>
            <div style={{ width:`${overallPct}%`, background:overallPct===100?'#1A7A3E':'#1E2A4A', borderRadius:6, height:10, transition:'width 0.4s' }} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginTop:14 }}>
            {[['Villas',(proj.villas||[]).length,''],['Activities',acts.length,''],
              ['In Progress',acts.filter(a=>getActivityProgress(a.id,progressUpdates)>0&&getActivityProgress(a.id,progressUpdates)<100).length,'#C9A24B'],
              ['Completed',acts.filter(a=>getActivityProgress(a.id,progressUpdates)>=100).length,'#1A7A3E']].map(([l,v,c])=>(
              <div key={l} style={{ textAlign:'center', background:'#FAF8F4', borderRadius:8, padding:'8px 4px' }}>
                <div style={{ fontSize:20, fontWeight:700, color:c||'#1E2A4A' }}>{v}</div>
                <div style={{ fontSize:11, color:'#888' }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        {/* Villa progress cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:12 }}>
          {villas.map(v => {
            const villActs = acts.filter(a => a.villaId === v.id);
            const villaPct = villActs.length ? Math.round(villActs.reduce((s,a)=>s+getActivityProgress(a.id,progressUpdates),0)/villActs.length) : 0;
            return (
              <div key={v.id} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:10, padding:'14px 16px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontWeight:600, fontSize:13 }}>{v.name}</span>
                  <span style={{ fontWeight:700, fontSize:15, color:villaPct===100?'#1A7A3E':'#1E2A4A' }}>{villaPct}%</span>
                </div>
                <div style={{ background:'#EAE6DB', borderRadius:4, height:6, marginBottom:10 }}>
                  <div style={{ width:`${villaPct}%`, background:villaPct===100?'#1A7A3E':'#C9A24B', borderRadius:4, height:6 }} />
                </div>
                {MEP_DISCIPLINES.slice(0,6).map(disc => {
                  const discActs = villActs.filter(a=>a.discipline===disc);
                  if (!discActs.length) return null;
                  const discPct = Math.round(discActs.reduce((s,a)=>s+getActivityProgress(a.id,progressUpdates),0)/discActs.length);
                  return (
                    <div key={disc} style={{ display:'flex', justifyContent:'space-between', fontSize:12, color:'#555', marginBottom:3 }}>
                      <span>{disc}</span>
                      <span style={{ fontWeight:600, color:discPct===100?'#1A7A3E':discPct>0?'#C9A24B':'#aaa' }}>{discPct}%</span>
                    </div>
                  );
                })}
                <div style={{ fontSize:11, color:'#aaa', marginTop:6 }}>{villActs.length} activities</div>
              </div>
            );
          })}
          {villas.length === 0 && <div style={{ color:'#aaa', fontSize:13 }}>No villas set up. Edit the project to add villas.</div>}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div>
          <h2 className="serif" style={styles.h2}>MEP Projects</h2>
          <p style={styles.muted}>{siteProjects.length} project{siteProjects.length!==1?'s':''}</p>
        </div>
        {canEdit && <button style={styles.primaryBtn} onClick={() => setEditing({ _isNew:true, status:'active', villas:[], disciplines:[...MEP_DISCIPLINES] })}>+ New Project</button>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:14 }}>
        {siteProjects.map(proj => {
          const pct = projectProgress(proj);
          const acts = siteActivities.filter(a=>a.projectId===proj.id);
          return (
            <div key={proj.id} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:12, padding:'16px 18px', cursor:'pointer' }} onClick={() => setSelected(proj.id)}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <div style={{ fontWeight:600, fontSize:14, color:'#1E2A4A' }}>{proj.name}</div>
                <span style={{ fontSize:11, fontWeight:700, color:STATUS_COLOR[proj.status]||'#888', background:'#F5F3EE', borderRadius:6, padding:'2px 8px', textTransform:'uppercase' }}>{proj.status}</span>
              </div>
              <div style={{ fontSize:12, color:'#666', marginBottom:8 }}>📍 {proj.location} · {proj.client}</div>
              <div style={{ marginBottom:6 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                  <span>{(proj.villas||[]).length} villas · {acts.length} activities</span>
                  <span style={{ fontWeight:700, color:pct===100?'#1A7A3E':'#1E2A4A' }}>{pct}%</span>
                </div>
                <div style={{ background:'#EAE6DB', borderRadius:4, height:6 }}>
                  <div style={{ width:`${pct}%`, background:pct===100?'#1A7A3E':'#C9A24B', borderRadius:4, height:6 }} />
                </div>
              </div>
              <div style={{ fontSize:11.5, color:'#888' }}>{proj.startDate} → {proj.endDate||'ongoing'}</div>
              {canEdit && (
                <div style={{ display:'flex', gap:8, marginTop:10 }} onClick={e=>e.stopPropagation()}>
                  <button style={{ ...styles.ghostBtn, fontSize:12 }} onClick={() => setEditing(proj)}>Edit</button>
                  <button style={{ ...styles.ghostBtn, fontSize:12, color:'#B5453A' }} onClick={() => del(proj.id)}>Delete</button>
                </div>
              )}
            </div>
          );
        })}
        {siteProjects.length===0 && <div style={{ color:'#aaa', padding:24 }}>No projects yet.</div>}
      </div>
      {editing && <MEPProjectForm project={editing} employees={employees} onSave={save} onClose={()=>setEditing(null)} />}
    </div>
  );
}


export function MEPProjectForm({ project, employees, onSave, onClose }) {
  const [form, setForm] = useState({
    name:'', client:'', location:'', startDate:'', endDate:'', status:'active',
    teamIds:[], disciplines:[...MEP_DISCIPLINES], villas:[], description:'', contractRef:'',
    ...project,
  });
  const [newVilla, setNewVilla] = useState('');
  function set(k,v) { setForm(f=>({...f,[k]:v})); }
  function addVilla() {
    if (!newVilla.trim()) return;
    set('villas', [...form.villas, { id: crypto.randomUUID(), name: newVilla.trim() }]);
    setNewVilla('');
  }
  function removeVilla(id) { set('villas', form.villas.filter(v=>v.id!==id)); }
  function toggleDisc(d) { set('disciplines', form.disciplines.includes(d) ? form.disciplines.filter(x=>x!==d) : [...form.disciplines, d]); }
  function toggleTeam(id) { set('teamIds', form.teamIds.includes(id) ? form.teamIds.filter(x=>x!==id) : [...form.teamIds, id]); }
  // Bulk add villas
  function bulkAdd() {
    const prefix = prompt('Villa name prefix (e.g. "Villa"):', 'Villa');
    if (!prefix) return;
    const count = parseInt(prompt('How many villas to add?', '10'), 10);
    if (!count || count < 1) return;
    const existing = form.villas.length;
    const newOnes = Array.from({ length: count }, (_,i) => ({ id: crypto.randomUUID(), name: `${prefix} ${existing + i + 1}` }));
    set('villas', [...form.villas, ...newOnes]);
  }
  return (
    <Modal title={form._isNew ? 'New MEP Project' : 'Edit Project'} onClose={onClose} width={600}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        {[['name','Project Name *'],['client','Client / Developer *'],['location','Site Location'],['contractRef','Contract / PO Ref']].map(([k,l])=>(
          <div key={k} style={{ gridColumn: k==='location'||k==='contractRef'?'1/-1':undefined, ...styles.formGroup }}>
            <label style={styles.label}>{l}</label>
            <input value={form[k]||''} onChange={e=>set(k,e.target.value)} style={styles.input} />
          </div>
        ))}
        <div style={styles.formGroup}>
          <label style={styles.label}>Status</label>
          <select value={form.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
            {['planning','active','on_hold','completed'].map(s=><option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
        </div>
        <div style={styles.formGroup}></div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Start Date</label>
          <input type="date" value={form.startDate||''} onChange={e=>set('startDate',e.target.value)} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>End Date</label>
          <input type="date" value={form.endDate||''} onChange={e=>set('endDate',e.target.value)} style={styles.input} />
        </div>
        <div style={{ gridColumn:'1/-1', ...styles.formGroup }}>
          <label style={styles.label}>Disciplines in scope</label>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
            {MEP_DISCIPLINES.map(d=>(
              <button key={d} onClick={()=>toggleDisc(d)} style={{ fontSize:12, padding:'4px 10px', borderRadius:20, border:'1px solid #DDD8CC', cursor:'pointer', background:form.disciplines.includes(d)?'#1E2A4A':'#F5F3EE', color:form.disciplines.includes(d)?'#fff':'#444' }}>{d}</button>
            ))}
          </div>
        </div>
        {/* Villas */}
        <div style={{ gridColumn:'1/-1', ...styles.formGroup }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
            <label style={styles.label}>Villas / Units ({form.villas.length})</label>
            <button style={{ ...styles.ghostBtn, fontSize:11 }} onClick={bulkAdd}>+ Bulk add</button>
          </div>
          <div style={{ display:'flex', gap:8, marginBottom:8 }}>
            <input value={newVilla} onChange={e=>setNewVilla(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addVilla()}
              style={{ ...styles.input, flex:1 }} placeholder='e.g. "Villa 1" then press Enter' />
            <button style={styles.primaryBtn} onClick={addVilla}>Add</button>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, maxHeight:120, overflowY:'auto' }}>
            {form.villas.map(v=>(
              <span key={v.id} style={{ fontSize:12, background:'#EAE6DB', borderRadius:8, padding:'3px 10px', display:'flex', alignItems:'center', gap:6 }}>
                {v.name}
                <button onClick={()=>removeVilla(v.id)} style={{ border:'none', background:'none', cursor:'pointer', color:'#888', fontSize:12, padding:0 }}>×</button>
              </span>
            ))}
          </div>
        </div>
        {/* Team */}
        {employees.length > 0 && (
          <div style={{ gridColumn:'1/-1', ...styles.formGroup }}>
            <label style={styles.label}>Assign Team</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:6 }}>
              {employees.map(e=>(
                <button key={e.id} onClick={()=>toggleTeam(e.id)} style={{ fontSize:12, padding:'4px 10px', borderRadius:20, border:'1px solid #DDD8CC', cursor:'pointer', background:form.teamIds.includes(e.id)?'#1E2A4A':'#F5F3EE', color:form.teamIds.includes(e.id)?'#fff':'#444' }}>{e.name}</button>
              ))}
            </div>
          </div>
        )}
        <div style={{ gridColumn:'1/-1', ...styles.formGroup }}>
          <label style={styles.label}>Description / Scope summary</label>
          <textarea value={form.description||''} onChange={e=>set('description',e.target.value)} style={{ ...styles.input, height:56 }} />
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:16 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={()=>{ if(!form.name||!form.client) return alert('Name and client required'); onSave(form); }}>Save Project</button>
      </div>
    </Modal>
  );
}

// ── Activity Planner (WBS + BOM) ────────────────────────────────────────────────
// ─── MEP Gantt Chart + Activity Planner ──────────────────────────────────────

export function ActivityPlannerView({ siteActivities, setSiteActivities, siteProjects, progressUpdates, setProgressUpdates, userRole, employees = [] }) {
  const [selProject, setSelProject] = useState(siteProjects[0]?.id || '');
  const [editing, setEditing] = useState(null);
  const [expandedBOM, setExpandedBOM] = useState({});
  const [viewMode, setViewMode] = useState('gantt'); // 'gantt' | 'table'
  const [updateModal, setUpdateModal] = useState(null); // activityId
  const [ganttStart, setGanttStart] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().slice(0,10);
  });
  const [ganttDays, setGanttDays] = useState(60);
  const canEdit = userRole === 'admin' || userRole === 'manager';
  const project = siteProjects.find(p => p.id === selProject);
  const acts = siteActivities.filter(a => a.projectId === selProject).sort((a,b) => {
    const vA = (project?.villas||[]).findIndex(v=>v.id===a.villaId);
    const vB = (project?.villas||[]).findIndex(v=>v.id===b.villaId);
    if (vA !== vB) return vA - vB;
    return (a.sequence||0) - (b.sequence||0);
  });

  function save(form) {
    const rec = { ...form, id: form.id || crypto.randomUUID(), projectId: selProject };
    setSiteActivities(prev => form.id ? prev.map(a=>a.id===form.id?rec:a) : [...prev, rec]);
    setEditing(null);
  }
  function del(id) { if (confirm('Delete activity?')) setSiteActivities(prev=>prev.filter(a=>a.id!==id)); }
  function lockBOM(id) { setSiteActivities(prev=>prev.map(a=>a.id===id?{...a,bomLocked:true}:a)); }
  function toggleBOM(id) { setExpandedBOM(p=>({...p,[id]:!p[id]})); }

  function getProgress(actId) {
    const logs = progressUpdates.filter(u => u.activityId === actId);
    if (!logs.length) return 0;
    return Math.max(...logs.map(u => parseFloat(u.cumProgress)||0));
  }

  // Gantt helpers
  const gStart = new Date(ganttStart);
  const DAY_W = 28; // px per day

  function dayOffset(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return Math.round((d - gStart) / 86400000);
  }

  function formatGanttHeader() {
    const headers = [];
    let cur = new Date(gStart);
    let wk = 0;
    while (wk < ganttDays) {
      const mo = cur.toLocaleString('default',{month:'short'});
      const days = [];
      while (wk < ganttDays && (days.length === 0 || cur.getDate() !== 1)) {
        days.push({ d: cur.getDate(), dow: cur.toLocaleString('default',{weekday:'narrow'}), isWeekend: cur.getDay()===0||cur.getDay()===6 });
        cur = new Date(cur); cur.setDate(cur.getDate()+1); wk++;
      }
      headers.push({ month: mo, days });
    }
    return headers;
  }
  const ganttHeaders = formatGanttHeader();

  if (!siteProjects.length) return (
    <div style={styles.page}>
      <h2 className="serif" style={styles.h2}>Activity Planner</h2>
      <p style={{ color:'#aaa', marginTop:16 }}>Create a project first, then add activities.</p>
    </div>
  );

  const villas = project?.villas || [];

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div>
          <h2 className="serif" style={styles.h2}>Activity Planner</h2>
          <p style={styles.muted}>{acts.length} activities · {project?.name}</p>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <select value={selProject} onChange={e=>setSelProject(e.target.value)} style={{ ...styles.input, width:200 }}>
            {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ display:'flex', border:'1px solid #DDD8CE', borderRadius:8, overflow:'hidden' }}>
            {[['gantt','📊 Gantt'],['table','📋 Table'],['log','📅 Daily Log']].map(([k,l])=>(
              <button key={k} onClick={()=>setViewMode(k)} style={{ padding:'6px 14px', border:'none', cursor:'pointer', fontSize:12, fontWeight:600, background: viewMode===k ? '#1E2A4A' : '#fff', color: viewMode===k ? '#fff' : '#555' }}>{l}</button>
            ))}
          </div>
          {canEdit && <button style={styles.primaryBtn} onClick={()=>setEditing({ _isNew:true, villaId:'', discipline:(project?.disciplines||MEP_DISCIPLINES)[0], phase:MEP_PHASES[0], weight:5, bom:[], bomLocked:false })}>+ Add Activity</button>}
        </div>
      </div>

      {/* GANTT VIEW */}
      {viewMode === 'gantt' && (
        <div>
          {/* Gantt controls */}
          <div style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center', flexWrap:'wrap' }}>
            <label style={{ fontSize:12, color:'#888' }}>Start:</label>
            <input type="date" value={ganttStart} onChange={e=>setGanttStart(e.target.value)} style={{ ...styles.input, width:140, fontSize:12, padding:'4px 8px' }} />
            <label style={{ fontSize:12, color:'#888' }}>Show:</label>
            {[30,60,90,120].map(d=>(
              <button key={d} onClick={()=>setGanttDays(d)} style={{ padding:'4px 10px', border:'1px solid #DDD8CE', borderRadius:6, fontSize:12, cursor:'pointer', background: ganttDays===d ? '#1E2A4A' : '#fff', color: ganttDays===d ? '#fff' : '#555' }}>{d}d</button>
            ))}
            <span style={{ fontSize:11, color:'#aaa', marginLeft:8 }}>Click bar to log update</span>
            <div style={{ display:'flex', gap:10, marginLeft:'auto', alignItems:'center' }}>
              <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#555' }}>
                <span style={{ width:16, height:10, borderRadius:3, background:'#3D6B9A', display:'inline-block' }} /> Planned
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#555' }}>
                <span style={{ width:16, height:10, borderRadius:3, background:'#C9A24B', display:'inline-block' }} /> In Progress
              </span>
              <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#555' }}>
                <span style={{ width:16, height:10, borderRadius:3, background:'#1A7A3E', display:'inline-block' }} /> Complete
              </span>
            </div>
          </div>

          {/* Gantt table */}
          <div style={{ overflowX:'auto', border:'1px solid #EAE6DB', borderRadius:10 }}>
            <div style={{ display:'flex', minWidth: 380 + ganttDays * DAY_W }}>
              {/* Left fixed panel */}
              <div style={{ width:380, flexShrink:0, borderRight:'2px solid #DDD8CE' }}>
                {/* Header row */}
                <div style={{ display:'grid', gridTemplateColumns:'120px 90px 1fr', background:'#1E2A4A', color:'#fff', fontSize:11, fontWeight:700, padding:'0 0' }}>
                  <div style={{ padding:'8px 10px', borderRight:'1px solid #3B4F7A' }}>Discipline</div>
                  <div style={{ padding:'8px 10px', borderRight:'1px solid #3B4F7A' }}>Progress</div>
                  <div style={{ padding:'8px 10px' }}>Activity</div>
                </div>
                {/* Activity rows */}
                {acts.map(act => {
                  const pct = getProgress(act.id);
                  const villa = villas.find(v=>v.id===act.villaId);
                  return (
                    <div key={act.id} style={{ display:'grid', gridTemplateColumns:'120px 90px 1fr', borderBottom:'1px solid #F0EDE6', background:'#FAFAF8', minHeight:36 }}>
                      <div style={{ padding:'6px 10px', borderRight:'1px solid #EAE6DB', fontSize:11 }}>
                        <div style={{ fontWeight:600, color:'#1E2A4A', fontSize:11 }}>{act.discipline}</div>
                        {villa && <div style={{ fontSize:10, color:'#aaa' }}>{villa.name}</div>}
                      </div>
                      <div style={{ padding:'6px 10px', borderRight:'1px solid #EAE6DB' }}>
                        <div style={{ background:'#EAE6DB', borderRadius:3, height:6, marginTop:4 }}>
                          <div style={{ width:`${pct}%`, background: pct===100?'#1A7A3E':'#C9A24B', borderRadius:3, height:6 }} />
                        </div>
                        <div style={{ fontSize:10, color:'#555', marginTop:2, fontWeight:600 }}>{pct}%</div>
                      </div>
                      <div style={{ padding:'6px 8px', fontSize:11 }}>
                        <div style={{ fontWeight:600, color:'#1E2A4A', lineHeight:1.3 }}>{act.name}</div>
                        <div style={{ fontSize:10, color:'#aaa' }}>{act.phase}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Gantt panel */}
              <div style={{ flex:1, overflowX:'auto' }}>
                {/* Month + day headers */}
                <div style={{ background:'#1E2A4A' }}>
                  {/* Month row */}
                  <div style={{ display:'flex', borderBottom:'1px solid #3B4F7A' }}>
                    {ganttHeaders.map((mo,i) => (
                      <div key={i} style={{ width: mo.days.length * DAY_W, flexShrink:0, padding:'4px 6px', fontSize:11, fontWeight:700, color:'#C9A24B', borderRight:'1px solid #3B4F7A' }}>{mo.month}</div>
                    ))}
                  </div>
                  {/* Day row */}
                  <div style={{ display:'flex' }}>
                    {ganttHeaders.flatMap(mo => mo.days).map((d,i) => (
                      <div key={i} style={{ width:DAY_W, flexShrink:0, padding:'3px 0', textAlign:'center', fontSize:9, color: d.isWeekend ? '#C9A24B' : '#9BA3C7', borderRight:'1px solid #2D3F6A', fontWeight: d.isWeekend ? 700 : 400 }}>{d.d}</div>
                    ))}
                  </div>
                </div>

                {/* Activity bars */}
                {acts.map(act => {
                  const pct = getProgress(act.id);
                  const startOff = dayOffset(act.plannedStart);
                  const endOff   = dayOffset(act.plannedEnd);
                  const hasDates = startOff !== null && endOff !== null;
                  // Clamp to visible gantt window
                  const clampedStart = hasDates ? Math.max(0, startOff) : null;
                  const clampedEnd   = hasDates ? Math.min(ganttDays - 1, endOff) : null;
                  const barLeft  = hasDates ? clampedStart * DAY_W : null;
                  const barWidth = hasDates ? Math.max(DAY_W, (clampedEnd - clampedStart + 1) * DAY_W) : null;
                  // Colors: planned bar = steel-blue, progress = amber→green
                  const planColor = '#3D6B9A';          // dark steel-blue planned bar
                  const progColor = pct >= 100 ? '#1A7A3E' : pct > 0 ? '#C9A24B' : null;
                  return (
                    <div key={act.id} style={{ height:38, borderBottom:'1px solid #F0EDE6', position:'relative', background:'#FAFAF8', display:'flex', alignItems:'center', width: ganttDays * DAY_W }}
                      onClick={() => setUpdateModal(act.id)}>
                      {/* Weekend shading */}
                      {Array.from({length: ganttDays}).map((_,i) => {
                        const d = new Date(gStart); d.setDate(d.getDate()+i);
                        return d.getDay()===0||d.getDay()===6 ? <div key={i} style={{ position:'absolute', left:i*DAY_W, width:DAY_W, top:0, bottom:0, background:'rgba(201,162,75,0.05)' }} /> : null;
                      })}
                      {/* Gantt bar — two-layer: planned (blue) + progress overlay (amber/green) */}
                      {barLeft !== null && barWidth !== null && (
                        <div style={{ position:'absolute', left:barLeft, width:barWidth, height:22, borderRadius:5, background: planColor, overflow:'hidden', cursor:'pointer', boxShadow:'0 1px 3px rgba(0,0,0,0.18)' }}
                          title={`${act.name} · Planned: ${act.plannedStart} → ${act.plannedEnd} · Progress: ${pct}%`}>
                          {/* Progress fill layer */}
                          {progColor && (
                            <div style={{ position:'absolute', left:0, top:0, width:`${pct}%`, height:'100%', background: progColor, borderRadius:5, transition:'width 0.3s', opacity:0.92 }} />
                          )}
                          {/* Hatched pattern for 0% (no progress yet) */}
                          {pct === 0 && (
                            <div style={{ position:'absolute', inset:0, backgroundImage:'repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0px, rgba(255,255,255,0.07) 3px, transparent 3px, transparent 8px)' }} />
                          )}
                          {/* Label */}
                          <span style={{ position:'absolute', left:7, top:'50%', transform:'translateY(-50%)', fontSize:10, fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:barWidth-14, textShadow:'0 1px 2px rgba(0,0,0,0.4)' }}>
                            {act.name}{pct > 0 ? ` · ${pct}%` : ''}
                          </span>
                        </div>
                      )}
                      {!hasDates && (
                        <div onClick={e=>{ e.stopPropagation(); setEditing(act); }}
                          style={{ position:'absolute', left:8, fontSize:10, color:'#3D6B9A', fontStyle:'italic', cursor:'pointer',
                            background:'rgba(61,107,154,0.08)', borderRadius:4, padding:'2px 8px', border:'1px dashed #3D6B9A' }}>
                          📅 No dates — click to set
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TABLE VIEW */}
      {viewMode === 'table' && (
        <div>
          {[...villas.map(v=>({ v, items: acts.filter(a=>a.villaId===v.id) })), ...(acts.filter(a=>!a.villaId).length?[{v:{id:'__none',name:'Project-wide'},items:acts.filter(a=>!a.villaId)}]:[])].map(({v,items})=>(
            <div key={v.id} style={{ marginBottom:20 }}>
              <div style={{ ...styles.dashSection, fontSize:12, marginBottom:8 }}>🏠 {v.name} ({items.length})</div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ ...styles.table, fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'#F5F3EE' }}>
                      {['Discipline','Phase','Activity','Start','End','Dur','Wt%','Progress','Contract Val','BOM',''].map(h=>(
                        <th key={h} style={{ ...styles.th, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(act => {
                      const pct = getProgress(act.id, progressUpdates);
                      return (
                        <React.Fragment key={act.id}>
                          <tr style={{ borderTop:'1px solid #EAE6DB' }}>
                            <td style={styles.td}><span style={{ fontWeight:600, color:'#1E2A4A' }}>{act.discipline}</span></td>
                            <td style={styles.td}><span style={{ fontSize:11, color:'#888' }}>{act.phase}</span></td>
                            <td style={styles.td}>{act.name}</td>
                            <td style={{ ...styles.td, color:'#555' }}>{act.plannedStart||'—'}</td>
                            <td style={{ ...styles.td, color:'#555' }}>{act.plannedEnd||'—'}</td>
                            <td style={{ ...styles.td, textAlign:'center' }}>{act.duration||'—'}</td>
                            <td style={{ ...styles.td, textAlign:'center' }}>{act.weight||0}%</td>
                            <td style={{ ...styles.td, minWidth:100 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                <div style={{ flex:1, background:'#EAE6DB', borderRadius:3, height:5 }}>
                                  <div style={{ width:`${pct}%`, background:pct===100?'#1A7A3E':'#C9A24B', borderRadius:3, height:5 }} />
                                </div>
                                <span style={{ fontSize:11, fontWeight:600, color:pct===100?'#1A7A3E':'#555', width:28 }}>{pct}%</span>
                              </div>
                            </td>
                            <td style={{ ...styles.td, textAlign:'right' }}>{act.contractValue ? act.contractValue.toLocaleString() : '—'}</td>
                            <td style={styles.td}>
                              <button onClick={()=>toggleBOM(act.id)} style={{ ...styles.ghostBtn, fontSize:11, padding:'2px 8px' }}>{(act.bom||[]).length} items {expandedBOM[act.id]?'▲':'▼'}</button>
                              {act.bomLocked && <span style={{ fontSize:10, color:'#1A7A3E', marginLeft:4 }}>🔒</span>}
                            </td>
                            <td style={styles.td}>
                              {canEdit && (
                                <div style={{ display:'flex', gap:4 }}>
                                  <button style={{ ...styles.ghostBtn, fontSize:11, padding:'2px 7px' }} onClick={()=>setUpdateModal(act.id)}>📝 Update</button>
                                  <button style={{ ...styles.ghostBtn, fontSize:11, padding:'2px 7px' }} onClick={()=>setEditing(act)}>Edit</button>
                                  <button style={{ ...styles.ghostBtn, fontSize:11, padding:'2px 7px', color:'#B5453A' }} onClick={()=>del(act.id)}>×</button>
                                </div>
                              )}
                            </td>
                          </tr>
                          {expandedBOM[act.id] && (
                            <tr><td colSpan={11} style={{ padding:'0 0 8px 16px', background:'#FDFCF9' }}>
                              <BOMInlineEditor activity={act} onUpdate={updated=>setSiteActivities(prev=>prev.map(a=>a.id===act.id?updated:a))} canEdit={canEdit&&!act.bomLocked} />
                              {canEdit && !act.bomLocked && <button style={{ ...styles.ghostBtn, fontSize:11, color:'#1A7A3E', marginTop:6 }} onClick={()=>lockBOM(act.id)}>🔒 Lock BOM</button>}
                            </td></tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DAILY LOG VIEW */}
      {viewMode === 'log' && (() => {
        const [logDate, setLogDate] = React.useState(new Date().toISOString().slice(0,10));
        const [logModal, setLogModal] = React.useState(null);
        const dayUpdates = progressUpdates.filter(u=>u.projectId===selProject&&u.date===logDate);
        return (
          <div>
            <div style={{ display:'flex', gap:8, marginBottom:14, alignItems:'center', flexWrap:'wrap' }}>
              <button style={styles.ghostBtn} onClick={()=>{ const d=new Date(logDate); d.setDate(d.getDate()-1); setLogDate(d.toISOString().slice(0,10)); }}>◀ Prev</button>
              <input type="date" value={logDate} onChange={e=>setLogDate(e.target.value)} style={{ ...styles.input, width:160 }} />
              <button style={styles.ghostBtn} onClick={()=>setLogDate(new Date().toISOString().slice(0,10))}>Today</button>
              <button style={styles.ghostBtn} onClick={()=>{ const d=new Date(logDate); d.setDate(d.getDate()+1); setLogDate(d.toISOString().slice(0,10)); }}>Next ▶</button>
              {canEdit && <button style={styles.primaryBtn} onClick={()=>setLogModal('__new')}>+ Add Update</button>}
            </div>
            {dayUpdates.length===0 && <div style={{ color:'#aaa', padding:20 }}>No updates logged for {logDate}.</div>}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {dayUpdates.map(u=>{
                const act = acts.find(a=>a.id===u.activityId);
                const villa = villas.find(v=>v.id===act?.villaId);
                const prevPct = progressUpdates.filter(x=>x.activityId===u.activityId&&x.date<u.date).sort((a,b)=>b.date.localeCompare(a.date))[0]?.cumProgress||0;
                const delta = (u.cumProgress||0) - prevPct;
                return (
                  <div key={u.id} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:12, padding:'14px 18px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:6 }}>
                      <div>
                        <span style={{ fontWeight:600, fontSize:14, color:'#1E2A4A' }}>{villa?.name||'Project-wide'}</span>
                        <span style={{ fontSize:12, color:'#888', marginLeft:8 }}>→ {act?.discipline} → {act?.name||'Unknown'}</span>
                      </div>
                      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                        <span style={{ fontWeight:700, fontSize:16, color:'#1A7A3E' }}>{u.cumProgress||0}%</span>
                        {delta>0 && <span style={{ fontSize:11, color:'#1A7A3E', background:'#E6F5EC', borderRadius:6, padding:'2px 7px' }}>+{delta}%</span>}
                        {canEdit && <button style={{ ...styles.ghostBtn, fontSize:11, color:'#B5453A' }} onClick={()=>{ if(confirm('Delete?')) setProgressUpdates(prev=>prev.filter(x=>x.id!==u.id)); }}>×</button>}
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:12, color:'#555', marginTop:4 }}>
                      {u.mpCount>0 && <span>👷 {u.mpCount} MP</span>}
                      {u.stdHours>0 && <span>⏱ Std {u.stdHours}h</span>}
                      {u.otHours>0 && <span style={{ color:'#C9A24B' }}>⚡ OT {u.otHours}h</span>}
                      {u.totalManhours>0 && <span style={{ fontWeight:600 }}>= {u.totalManhours} manhours</span>}
                    </div>
                    {(u.materialConsumed||[]).length>0 && (
                      <div style={{ fontSize:12, color:'#666', marginTop:4 }}>
                        📦 {u.materialConsumed.map(m=>`${m.name} (${m.qty} ${m.unit})`).join(' · ')}
                      </div>
                    )}
                    {u.notes && <div style={{ fontSize:12, color:'#444', marginTop:4, fontStyle:'italic' }}>{u.notes}</div>}
                  </div>
                );
              })}
            </div>
            {logModal && (
              <DailyUpdateModal
                activityId={logModal==='__new' ? (acts[0]?.id||'') : logModal}
                activity={logModal==='__new' ? null : acts.find(a=>a.id===logModal)}
                project={project}
                progressUpdates={progressUpdates}
                setProgressUpdates={setProgressUpdates}
                employees={employees}
                onClose={()=>setLogModal(null)}
              />
            )}
          </div>
        );
      })()}

      {editing && <ActivityForm activity={editing} project={project} onSave={save} onClose={()=>setEditing(null)} />}
      {updateModal && (
        <DailyUpdateModal
          activityId={updateModal}
          activity={acts.find(a=>a.id===updateModal)}
          project={project}
          progressUpdates={progressUpdates}
          setProgressUpdates={setProgressUpdates}
          employees={employees}
          onClose={()=>setUpdateModal(null)}
        />
      )}
    </div>
  );
}

// ─── Daily Update Modal (from Gantt click) ───────────────────────────────────

export function DailyUpdateModal({ activityId, activity, project, progressUpdates, setProgressUpdates, employees, onClose }) {
  const today = new Date().toISOString().slice(0,10);
  const lastLog = progressUpdates.filter(u=>u.activityId===activityId).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const lastPct = lastLog ? parseFloat(lastLog.cumProgress)||0 : 0;

  const [form, setForm] = useState({
    date: today,
    cumProgress: lastPct,
    mpCount: '',
    stdHours: '',
    otHours: '',
    totalManhours: '',
    empHours: [],
    materialConsumed: [],
    notes: '',
  });
  const [saved, setSaved] = useState(false);
  const set = (k,v) => setForm(p=>({...p,[k]:v}));
  function setMP(mp) {
    const std = mp ? String(parseFloat(mp) * 8) : '';
    setForm(p => ({ ...p, mpCount: mp, stdHours: std,
      totalManhours: std ? String(parseFloat(std) + (parseFloat(p.otHours)||0)) : p.totalManhours }));
  }
  function setOT(ot) {
    setForm(p => ({ ...p, otHours: ot,
      totalManhours: String((parseFloat(p.stdHours)||0) + (parseFloat(ot)||0)) }));
  }

  function setEmpHour(empId, hours) {
    setForm(p => {
      const existing = p.empHours.filter(e=>e.empId!==empId);
      return { ...p, empHours: hours ? [...existing, {empId, hours:parseFloat(hours)||0}] : existing };
    });
  }

  function addMaterial() { setForm(p=>({...p, materialConsumed:[...p.materialConsumed,{id:Date.now().toString(36)+Math.random().toString(36).slice(2),name:'',qty:'',unit:'nos'}]})); }
  function updateMat(id,k,v) { setForm(p=>({...p,materialConsumed:p.materialConsumed.map(m=>m.id===id?{...m,[k]:v}:m)})); }
  function removeMat(id) { setForm(p=>({...p,materialConsumed:p.materialConsumed.filter(m=>m.id!==id)})); }

  function handleSave() {
    if (!form.date) { alert('Select a date'); return; }
    const rec = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      activityId, projectId: project?.id || '',
      ...form,
      cumProgress: Number(form.cumProgress) || 0,
      mpCount: Number(form.mpCount) || 0,
      stdHours: Number(form.stdHours) || 0,
      otHours: Number(form.otHours) || 0,
      totalManhours: Number(form.totalManhours) || 0,
    };
    setProgressUpdates(prev => [...prev, rec]);
    setSaved(true);
    setTimeout(() => { if (typeof onClose === 'function') onClose(); }, 900);
  }

  const bom = activity?.bom || [];
  const villas = project?.villas||[];
  const villa = villas.find(v=>v.id===activity?.villaId);

  return (
    <Modal onClose={onClose} title={`📝 Daily Update — ${activity?.name||''}`} width={560}>
      <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>
        {villa ? `${villa.name} · ` : ''}{activity?.discipline} · {activity?.phase}
        {lastLog && <span style={{ marginLeft:8, color:'#C9A24B' }}>Last update: {lastLog.date} ({lastPct}%)</span>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Date *</label>
          <input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Cumulative Progress % <span style={{ color:'#C9A24B' }}>(was {lastPct}%)</span></label>
          <input type="number" min={lastPct} max={100} value={form.cumProgress} onChange={e=>set('cumProgress',Math.min(100,Math.max(lastPct,+e.target.value)))} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Manpower on site (headcount)</label>
          <input type="number" min={0} value={form.mpCount} onChange={e=>setMP(e.target.value)} style={styles.input} placeholder="e.g. 5" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Standard Hrs <span style={{ fontWeight:400, color:'#888' }}>auto (MP × 8)</span></label>
          <input type="number" min={0} step="0.5" value={form.stdHours}
            onChange={e=>{ const s=e.target.value; setForm(p=>({...p,stdHours:s,totalManhours:String((parseFloat(s)||0)+(parseFloat(p.otHours)||0))})); }}
            style={{ ...styles.input, background:'#F9F8F5' }} placeholder="0" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>OT Hours</label>
          <input type="number" min={0} step="0.5" value={form.otHours} onChange={e=>setOT(e.target.value)} style={styles.input} placeholder="0" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Total Manhours <span style={{ color:'#1A7A3E', fontWeight:600 }}>(Std + OT)</span></label>
          <input type="number" min={0} step="0.5" value={form.totalManhours} onChange={e=>set('totalManhours',e.target.value)}
            style={{ ...styles.input, fontWeight:700, color:'#1E2A4A' }} placeholder="0" />
        </div>
      </div>

      {/* Per-employee hours */}
      {employees.length > 0 && (
        <div style={{ marginBottom:12 }}>
          <div style={{ ...styles.label, marginBottom:6 }}>Employee-wise hours</div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:140, overflowY:'auto' }}>
            {employees.map(emp => {
              const eh = form.empHours.find(e=>e.empId===emp.id);
              return (
                <div key={emp.id} style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:12, flex:1, color:'#555' }}>{emp.name}</span>
                  <input type="number" min={0} step="0.5" value={eh?.hours||''} onChange={e=>setEmpHour(emp.id,e.target.value)}
                    style={{ ...styles.input, width:80, padding:'4px 8px', fontSize:12 }} placeholder="hrs" />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Material consumed */}
      <div style={{ marginBottom:12 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <div style={styles.label}>Materials consumed today</div>
          <button onClick={addMaterial} style={{ ...styles.ghostBtn, fontSize:11 }}>+ Add</button>
        </div>
        {bom.length > 0 && form.materialConsumed.length === 0 && (
          <div style={{ fontSize:11, color:'#aaa', marginBottom:6 }}>
            BOM items: {bom.map(b=>b.material).join(', ')} — click + Add to log consumption
          </div>
        )}
        {form.materialConsumed.map(m => (
          <div key={m.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 70px auto', gap:6, marginBottom:4, alignItems:'center' }}>
            <input value={m.name} onChange={e=>updateMat(m.id,'name',e.target.value)} style={{ ...styles.input, fontSize:12, padding:'4px 8px' }} placeholder="Material name" list={`bom-${activityId}`} />
            <input type="number" min={0} value={m.qty} onChange={e=>updateMat(m.id,'qty',e.target.value)} style={{ ...styles.input, fontSize:12, padding:'4px 8px' }} placeholder="Qty" />
            <input value={m.unit} onChange={e=>updateMat(m.id,'unit',e.target.value)} style={{ ...styles.input, fontSize:12, padding:'4px 8px' }} placeholder="Unit" />
            <button onClick={()=>removeMat(m.id)} style={{ ...styles.iconBtn, color:'#B5453A' }}>×</button>
          </div>
        ))}
        <datalist id={`bom-${activityId}`}>{bom.map(b=><option key={b.id} value={b.material}/>)}</datalist>
      </div>

      <div style={styles.formGroup}>
        <label style={styles.label}>Notes / work done today</label>
        <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} style={{ ...styles.input, minHeight:60, resize:'vertical' }} placeholder="Describe work completed today..." />
      </div>

      <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:8 }}>
        {!saved && <button onClick={onClose} style={styles.ghostBtn}>Cancel</button>}
        <button onClick={handleSave} disabled={saved}
          style={{ ...styles.primaryBtn, background: saved ? '#1A7A3E' : '#1E2A4A', color:'#fff', opacity: saved ? 0.85 : 1 }}>
          {saved ? '✓ Saved! Updating...' : 'Save Daily Update'}
        </button>
      </div>
    </Modal>
  );
}


// ─── MEP Reports View ─────────────────────────────────────────────────────────

export function MEPReportsView({ siteProjects, siteActivities, progressUpdates, employees, businessInfo }) {
  const [selProject, setSelProject] = useState(siteProjects[0]?.id || '');
  const [reportType, setReportType] = useState('manhour_summary'); // manhour_summary | emp_report | material_report
  const [fromDate, setFromDate] = useState(() => { const d=new Date(); d.setDate(1); return d.toISOString().slice(0,10); });
  const [toDate, setToDate] = useState(new Date().toISOString().slice(0,10));
  const [selEmp, setSelEmp] = useState(employees[0]?.id || '');
  const [orientation, setOrientation] = useState('landscape'); // landscape | portrait
  const [useLHMep, setUseLHMep] = useState(!!(businessInfo?.letterhead||businessInfo?.letterheadHtml));

  const acts = siteActivities.filter(a => a.projectId === selProject);
  const project = siteProjects.find(p => p.id === selProject);

  const filteredUpdates = progressUpdates.filter(u =>
    u.projectId === selProject && u.date >= fromDate && u.date <= toDate
  );

  // Manhour summary: per activity — date, mp count, manhours, progress
  const manhourRows = acts.map(act => {
    const logs = filteredUpdates.filter(u => u.activityId === act.id);
    const totalMH = logs.reduce((s,u) => s + (parseFloat(u.totalManhours)||0), 0);
    const totalMP = logs.reduce((s,u) => s + (parseFloat(u.mpCount)||0), 0);
    const latestPct = logs.length ? Math.max(...logs.map(u=>parseFloat(u.cumProgress)||0)) : 0;
    const villa = (project?.villas||[]).find(v=>v.id===act.villaId);
    return { act, logs, totalMH, totalMP, latestPct, villa };
  }).filter(r => r.logs.length > 0);

  // Employee report: all logs for selected employee
  const empLogs = filteredUpdates.filter(u =>
    (u.empHours||[]).some(e => e.empId === selEmp)
  ).map(u => {
    const eh = (u.empHours||[]).find(e=>e.empId===selEmp);
    const act = siteActivities.find(a=>a.id===u.activityId);
    const villa = (project?.villas||[]).find(v=>v.id===act?.villaId);
    return { date:u.date, actName:act?.name||'—', villa:villa?.name||'', discipline:act?.discipline||'', hours:eh?.hours||0, notes:u.notes||'' };
  }).sort((a,b)=>a.date.localeCompare(b.date));

  // Material report: per activity → per material consumed in period
  const matRows = acts.map(act => {
    const logs = filteredUpdates.filter(u => u.activityId === act.id);
    const mats = {};
    logs.forEach(u => (u.materialConsumed||[]).forEach(m => {
      if (!m.name) return;
      if (!mats[m.name]) mats[m.name] = { unit: m.unit, qty: 0 };
      mats[m.name].qty += parseFloat(m.qty)||0;
    }));
    const villa = (project?.villas||[]).find(v=>v.id===act.villaId);
    return { act, villa, mats: Object.entries(mats).map(([name,v])=>({name,...v})) };
  }).filter(r => r.mats.length > 0);

  const selectedEmp = employees.find(e=>e.id===selEmp);
  const empTotalHours = empLogs.reduce((s,r)=>s+r.hours,0);


  function handlePrint() {
    const reportTitles = {
      manhour_summary: 'Manhour Summary Report',
      emp_report: `Employee Report — ${selectedEmp?.name || ''}`,
      material_report: 'Material Consumption Report',
    };
    const title = reportTitles[reportType] || 'MEP Report';
    const period = `${fromDate} to ${toDate}`;
    const projName = project?.name || '';

    let tableHTML = '';

    if (reportType === 'manhour_summary') {
      const rows = manhourRows.map(({act,logs,totalMH,totalMP,latestPct,villa}) => `
        <tr>
          <td>${villa?.name||'Project-wide'}</td>
          <td><b>${act.discipline}</b></td>
          <td>${act.name}</td>
          <td>${act.phase||''}</td>
          <td style="text-align:center">${logs.length}</td>
          <td style="text-align:center">${totalMP}</td>
          <td style="text-align:center;font-weight:700">${totalMH.toFixed(1)}</td>
          <td style="text-align:center;font-weight:700;color:${latestPct===100?'#1A7A3E':'#C9A24B'}">${latestPct}%</td>
        </tr>`).join('');
      const totMH = manhourRows.reduce((s,r)=>s+r.totalMH,0).toFixed(1);
      const totMP = manhourRows.reduce((s,r)=>s+r.totalMP,0);
      tableHTML = `
        <table>
          <thead><tr>${['Villa/Unit','Discipline','Activity','Phase','Days Worked','Total MP-days','Total Manhours','Progress %'].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="5" style="text-align:right"><b>TOTAL</b></td><td style="text-align:center"><b>${totMP}</b></td><td style="text-align:center"><b>${totMH}</b></td><td></td></tr></tfoot>
        </table>
        <h3>Daily Log Detail</h3>
        ${manhourRows.map(({act,logs,villa})=>`
          <h4>${villa?.name?villa.name+' — ':''} ${act.discipline} · ${act.name}</h4>
          <table>
            <thead><tr>${['Date','MP Count','Manhours','Progress %','Notes'].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${logs.sort((a,b)=>a.date.localeCompare(b.date)).map(u=>`
              <tr><td>${u.date}</td><td style="text-align:center">${u.mpCount||'—'}</td><td style="text-align:center">${u.totalManhours||'—'}</td><td style="text-align:center">${u.cumProgress}%</td><td>${u.notes||'—'}</td></tr>`).join('')}
            </tbody>
          </table>`).join('')}`;
    } else if (reportType === 'emp_report') {
      const rows = empLogs.map(r=>`
        <tr>
          <td>${r.date}</td><td>${r.villa||'Project-wide'}</td><td>${r.discipline}</td>
          <td>${r.actName}</td><td style="text-align:center;font-weight:700">${r.hours}</td><td>${r.notes||'—'}</td>
        </tr>`).join('');
      tableHTML = `
        <p><b>Total Days Worked:</b> ${empLogs.length} &nbsp;&nbsp; <b>Total Manhours:</b> ${empTotalHours.toFixed(1)}</p>
        <table>
          <thead><tr>${['Date','Villa/Unit','Discipline','Activity','Hours','Notes'].map(h=>`<th>${h}</th>`).join('')}</tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4" style="text-align:right"><b>TOTAL HOURS</b></td><td style="text-align:center"><b>${empTotalHours.toFixed(1)}</b></td><td></td></tr></tfoot>
        </table>`;
    } else {
      tableHTML = matRows.map(({act,villa,mats})=>`
        <h4>${villa?.name?villa.name+' — ':''} ${act.discipline} · ${act.name}</h4>
        <table>
          <thead><tr><th>Material</th><th>Total Qty</th><th>Unit</th></tr></thead>
          <tbody>${mats.map(m=>`<tr><td>${m.name}</td><td style="text-align:center;font-weight:700">${m.qty.toFixed(2)}</td><td>${m.unit}</td></tr>`).join('')}</tbody>
        </table>`).join('');
    }

    const lhHtml = useLHMep && (businessInfo?.letterhead || businessInfo?.letterheadHtml)
      ? `<div style="position:fixed;top:0;left:0;right:0;background:#fff;z-index:9999;padding-bottom:10px;border-bottom:2px solid #1E2A4A;"><img src="${businessInfo.letterhead}" style="width:100%;max-height:200px;object-fit:contain;object-position:top;display:block;" /></div>`
      : `<div style="font-size:15px;font-weight:700;color:#1E2A4A;margin-bottom:2px;">${businessInfo?.name||''}</div>`;
    const lhFooterHtml = useLHMep && businessInfo?.letterheadFooter
      ? `<div style="position:fixed;bottom:0;left:0;right:0;background:#fff;z-index:9999;padding-top:8px;border-top:2px solid #1E2A4A;"><img src="${businessInfo.letterheadFooter}" style="width:100%;max-height:120px;object-fit:contain;object-position:bottom;display:block;" /></div>`
      : '';
    const html = `<!DOCTYPE html><html><head>
      <meta charset="utf-8"/>
      <title>${title}</title>
      <style>
        @page { size: A4 ${orientation}; margin: ${useLHMep && businessInfo?.letterhead ? '220px' : '15mm'} 15mm ${useLHMep && businessInfo?.letterheadFooter ? '140px' : '15mm'}; }
        body { font-family: Arial, sans-serif; font-size: 11px; color: #222; }
        h1 { font-size: 16px; color: #1E2A4A; margin: 0 0 4px; }
        h3 { font-size: 13px; color: #1E2A4A; margin: 16px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
        h4 { font-size: 12px; color: #1E2A4A; margin: 12px 0 4px; }
        .meta { color: #666; font-size: 11px; margin-bottom: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #1E2A4A; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
        td { padding: 5px 8px; border-bottom: 1px solid #e0ddd5; font-size: 11px; }
        tfoot td { background: #f5f3ee; font-weight: 700; }
        tr:nth-child(even) td { background: #faf9f6; }
        p { margin: 4px 0 10px; }
      </style>
    </head><body>
      ${lhHtml}
      <h1>${title}</h1>
      <div class="meta">Project: <b>${projName}</b> &nbsp;|&nbsp; Period: <b>${period}</b> &nbsp;|&nbsp; Printed: ${new Date().toLocaleDateString()}</div>
      ${tableHTML || '<p>No data available for the selected period.</p>'}
      ${lhFooterHtml}
    </body></html>`;

    const w = window.open('', '_blank', 'width=1000,height=700');
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 500);
  }

  return (
    <div style={styles.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <h2 className="serif" style={styles.h2}>MEP Reports</h2>
          <p style={styles.muted}>Manhour, manpower & material reports for selected period</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          {(businessInfo?.letterhead||businessInfo?.letterheadHtml) && <button onClick={() => setUseLHMep(v => !v)} style={{ ...styles.ghostBtn, ...(useLHMep ? { background: '#EEF2FF', color: '#3D52A0', fontWeight: 600 } : {}) }}>📃 {useLHMep ? 'Letterhead ON' : 'Use Letterhead'}</button>}
          <div style={{ display:'flex', border:'1px solid #DDD8CC', borderRadius:8, overflow:'hidden', fontSize:12 }}>
            {[['landscape','⬜ Landscape'],['portrait','📄 Portrait']].map(([val,lbl])=>(
              <button key={val} onClick={()=>setOrientation(val)}
                style={{ padding:'7px 12px', background: orientation===val ? '#1E2A4A' : '#fff',
                  color: orientation===val ? '#fff' : '#555', border:'none', cursor:'pointer', fontWeight: orientation===val ? 600 : 400 }}>
                {lbl}
              </button>
            ))}
          </div>
          <button onClick={handlePrint} style={{ ...styles.primaryBtn, gap:6 }}>🖨 Print / PDF</button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginBottom:16, padding:'12px 16px', background:'#F5F3EE', borderRadius:10 }}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Project</label>
          <select value={selProject} onChange={e=>setSelProject(e.target.value)} style={{ ...styles.input, width:180 }}>
            {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Report type</label>
          <select value={reportType} onChange={e=>setReportType(e.target.value)} style={{ ...styles.input, width:200 }}>
            <option value="manhour_summary">Manhour Summary (all activities)</option>
            <option value="emp_report">Employee Report (one person)</option>
            <option value="material_report">Material Consumption</option>
          </select>
        </div>
        {reportType === 'emp_report' && (
          <div style={styles.formGroup}>
            <label style={styles.label}>Employee</label>
            <select value={selEmp} onChange={e=>setSelEmp(e.target.value)} style={{ ...styles.input, width:160 }}>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        )}
        <div style={styles.formGroup}>
          <label style={styles.label}>From</label>
          <input type="date" value={fromDate} onChange={e=>setFromDate(e.target.value)} style={{ ...styles.input, width:140 }} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>To</label>
          <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} style={{ ...styles.input, width:140 }} />
        </div>
      </div>

      {/* ── MANHOUR SUMMARY ── */}
      {reportType === 'manhour_summary' && (
        <div>
          <div style={{ ...styles.dashSection, marginBottom:12 }}>Manhour Summary · {fromDate} to {toDate}</div>
          {manhourRows.length === 0
            ? <div style={styles.emptyBox}>No updates logged in this period.</div>
            : <>
              <table style={{ ...styles.table, fontSize:12, width:'100%' }}>
                <thead>
                  <tr style={{ background:'#1E2A4A', color:'#fff' }}>
                    {['Villa/Unit','Discipline','Activity','Phase','Days worked','Total MP-days','Total Manhours','Progress %'].map(h=>(
                      <th key={h} style={{ ...styles.th, color:'#fff', whiteSpace:'nowrap', padding:'8px 10px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {manhourRows.map(({act,logs,totalMH,totalMP,latestPct,villa})=>(
                    <tr key={act.id} style={{ borderBottom:'1px solid #EAE6DB' }}>
                      <td style={styles.td}>{villa?.name||'Project-wide'}</td>
                      <td style={styles.td}><span style={{ fontWeight:600, color:'#1E2A4A' }}>{act.discipline}</span></td>
                      <td style={styles.td}>{act.name}</td>
                      <td style={styles.td}><span style={{ fontSize:11, color:'#888' }}>{act.phase}</span></td>
                      <td style={{ ...styles.td, textAlign:'center' }}>{logs.length}</td>
                      <td style={{ ...styles.td, textAlign:'center' }}>{totalMP}</td>
                      <td style={{ ...styles.td, textAlign:'center', fontWeight:700, color:'#1E2A4A' }}>{totalMH.toFixed(1)}</td>
                      <td style={{ ...styles.td, textAlign:'center' }}>
                        <span style={{ fontWeight:700, color:latestPct===100?'#1A7A3E':'#C9A24B' }}>{latestPct}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:'#F5F3EE', fontWeight:700 }}>
                    <td colSpan={5} style={{ ...styles.td, textAlign:'right', color:'#888' }}>TOTAL</td>
                    <td style={{ ...styles.td, textAlign:'center' }}>{manhourRows.reduce((s,r)=>s+r.totalMP,0)}</td>
                    <td style={{ ...styles.td, textAlign:'center', color:'#1E2A4A' }}>{manhourRows.reduce((s,r)=>s+r.totalMH,0).toFixed(1)}</td>
                    <td style={styles.td}></td>
                  </tr>
                </tfoot>
              </table>
              {/* Daily breakdown */}
              <div style={{ marginTop:20 }}>
                <div style={{ ...styles.dashSection, marginBottom:8 }}>Daily Log Detail</div>
                {manhourRows.map(({act,logs,villa})=>(
                  <div key={act.id} style={{ marginBottom:16 }}>
                    <div style={{ fontWeight:700, fontSize:12, color:'#1E2A4A', marginBottom:4 }}>
                      {villa?.name ? villa.name+' — ' : ''}{act.discipline} · {act.name}
                    </div>
                    <table style={{ ...styles.table, fontSize:11, width:'100%' }}>
                      <thead>
                        <tr style={{ background:'#F5F3EE' }}>
                          {['Date','MP count','Manhours','Progress %','Notes'].map(h=>(
                            <th key={h} style={{ ...styles.th, padding:'5px 8px' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {logs.sort((a,b)=>a.date.localeCompare(b.date)).map(u=>(
                          <tr key={u.id} style={{ borderBottom:'1px solid #F0EDE6' }}>
                            <td style={{ ...styles.td, padding:'5px 8px' }}>{u.date}</td>
                            <td style={{ ...styles.td, padding:'5px 8px', textAlign:'center' }}>{u.mpCount||'—'}</td>
                            <td style={{ ...styles.td, padding:'5px 8px', textAlign:'center', fontWeight:600 }}>{u.totalManhours||'—'}</td>
                            <td style={{ ...styles.td, padding:'5px 8px', textAlign:'center', color:'#C9A24B', fontWeight:600 }}>{u.cumProgress}%</td>
                            <td style={{ ...styles.td, padding:'5px 8px', color:'#666' }}>{u.notes||'—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </>
          }
        </div>
      )}

      {/* ── EMPLOYEE REPORT ── */}
      {reportType === 'emp_report' && (
        <div>
          <div style={{ ...styles.dashSection, marginBottom:12 }}>
            {selectedEmp?.name || 'Employee'} — Work Report · {fromDate} to {toDate}
          </div>
          {empLogs.length === 0
            ? <div style={styles.emptyBox}>No hours logged for this employee in the selected period.</div>
            : <>
              <div style={{ display:'flex', gap:16, marginBottom:12 }}>
                <div style={{ ...styles.statCard, flex:1 }}>
                  <div style={{ fontSize:11, color:'#888' }}>Total days worked</div>
                  <div style={{ fontSize:22, fontWeight:700, color:'#1E2A4A' }}>{empLogs.length}</div>
                </div>
                <div style={{ ...styles.statCard, flex:1 }}>
                  <div style={{ fontSize:11, color:'#888' }}>Total manhours</div>
                  <div style={{ fontSize:22, fontWeight:700, color:'#1E7A9A' }}>{empTotalHours.toFixed(1)}</div>
                </div>
              </div>
              <table style={{ ...styles.table, fontSize:12, width:'100%' }}>
                <thead>
                  <tr style={{ background:'#1E2A4A', color:'#fff' }}>
                    {['Date','Villa/Unit','Discipline','Activity','Hours','Notes'].map(h=>(
                      <th key={h} style={{ ...styles.th, color:'#fff', padding:'8px 10px' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {empLogs.map((r,i)=>(
                    <tr key={i} style={{ borderBottom:'1px solid #EAE6DB' }}>
                      <td style={styles.td}>{r.date}</td>
                      <td style={styles.td}>{r.villa||'Project-wide'}</td>
                      <td style={styles.td}>{r.discipline}</td>
                      <td style={styles.td}>{r.actName}</td>
                      <td style={{ ...styles.td, fontWeight:700, color:'#1E2A4A', textAlign:'center' }}>{r.hours}</td>
                      <td style={{ ...styles.td, color:'#666' }}>{r.notes||'—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:'#F5F3EE', fontWeight:700 }}>
                    <td colSpan={4} style={{ ...styles.td, textAlign:'right', color:'#888' }}>TOTAL HOURS</td>
                    <td style={{ ...styles.td, textAlign:'center', color:'#1E2A4A', fontSize:14 }}>{empTotalHours.toFixed(1)}</td>
                    <td style={styles.td}></td>
                  </tr>
                </tfoot>
              </table>
            </>
          }
        </div>
      )}

      {/* ── MATERIAL REPORT ── */}
      {reportType === 'material_report' && (
        <div>
          <div style={{ ...styles.dashSection, marginBottom:12 }}>Material Consumption · {fromDate} to {toDate}</div>
          {matRows.length === 0
            ? <div style={styles.emptyBox}>No material consumption logged in this period.</div>
            : matRows.map(({act,villa,mats})=>(
              <div key={act.id} style={{ marginBottom:16 }}>
                <div style={{ fontWeight:700, fontSize:12, color:'#1E2A4A', marginBottom:6 }}>
                  {villa?.name ? villa.name+' — ' : ''}{act.discipline} · {act.name}
                </div>
                <table style={{ ...styles.table, fontSize:12, width:'100%' }}>
                  <thead>
                    <tr style={{ background:'#F5F3EE' }}>
                      {['Material','Total Qty','Unit'].map(h=><th key={h} style={{ ...styles.th, padding:'6px 10px' }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {mats.map((m,i)=>(
                      <tr key={i} style={{ borderBottom:'1px solid #F0EDE6' }}>
                        <td style={styles.td}>{m.name}</td>
                        <td style={{ ...styles.td, fontWeight:700, color:'#1E2A4A', textAlign:'center' }}>{m.qty.toFixed(2)}</td>
                        <td style={styles.td}>{m.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}


export function BOMInlineEditor({ activity, onUpdate, canEdit }) {
  const bom = activity.bom || [];
  function addRow() { onUpdate({ ...activity, bom: [...bom, { id:crypto.randomUUID(), material:'', plannedQty:'', unit:'nos', consumed:0 }] }); }
  function updateRow(i,k,v) { const b=[...bom]; b[i]={...b[i],[k]:v}; onUpdate({...activity,bom:b}); }
  function removeRow(i) { onUpdate({...activity, bom:bom.filter((_,idx)=>idx!==i)}); }
  return (
    <div style={{ padding:'8px 0' }}>
      <div style={{ fontWeight:600, fontSize:12, color:'#1E2A4A', marginBottom:6 }}>
        Bill of Materials {activity.bomLocked && <span style={{ color:'#1A7A3E', fontSize:11 }}>— Locked (order approved)</span>}
      </div>
      {bom.length===0 && <div style={{ fontSize:12, color:'#aaa', marginBottom:6 }}>No materials added.</div>}
      {bom.map((row,i)=>(
        <div key={row.id||i} style={{ display:'grid', gridTemplateColumns:'3fr 1.5fr 1fr 1.5fr auto', gap:8, marginBottom:6, alignItems:'center' }}>
          {canEdit
            ? <input value={row.material} onChange={e=>updateRow(i,'material',e.target.value)} style={{ ...styles.input, fontSize:12 }} placeholder="Material description" />
            : <span style={{ fontSize:12 }}>{row.material}</span>}
          {canEdit
            ? <input type="number" value={row.plannedQty} onChange={e=>updateRow(i,'plannedQty',e.target.value)} style={{ ...styles.input, fontSize:12 }} placeholder="Planned qty" />
            : <span style={{ fontSize:12 }}>{row.plannedQty}</span>}
          {canEdit
            ? <select value={row.unit} onChange={e=>updateRow(i,'unit',e.target.value)} style={{ ...styles.input, fontSize:12 }}>
                {MEP_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
              </select>
            : <span style={{ fontSize:12 }}>{row.unit}</span>}
          <span style={{ fontSize:12, color:'#555' }}>Used: <strong>{row.consumed||0}</strong></span>
          {canEdit && <button onClick={()=>removeRow(i)} style={{ ...styles.ghostBtn, color:'#B5453A', fontSize:12, padding:'2px 7px' }}>×</button>}
        </div>
      ))}
      {canEdit && <button style={{ ...styles.ghostBtn, fontSize:11 }} onClick={addRow}>+ Add material</button>}
    </div>
  );
}


export function ActivityForm({ activity, project, onSave, onClose }) {
  const [form, setForm] = useState({
    name:'', villaId:'', discipline:MEP_DISCIPLINES[0], phase: MEP_PHASES[0],
    plannedStart:'', plannedEnd:'', duration:'', weight:5, sequence:0,
    plannedQty:'', unit:'%', bom:[], bomLocked:false,
    ...activity,
  });
  function set(k,v) { setForm(f=>({...f,[k]:v})); }
  const villas = project?.villas || [];
  const disciplines = project?.disciplines || MEP_DISCIPLINES;
  return (
    <Modal title={form._isNew?'New Activity':'Edit Activity'} onClose={onClose} width={560}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div style={{ gridColumn:'1/-1', ...styles.formGroup }}>
          <label style={styles.label}>Activity Name *</label>
          <input value={form.name} onChange={e=>set('name',e.target.value)} style={styles.input} placeholder="e.g. Electrical Rough-in" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Villa / Unit</label>
          <select value={form.villaId} onChange={e=>set('villaId',e.target.value)} style={styles.input}>
            <option value="">Project-wide</option>
            {villas.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Discipline</label>
          <select value={form.discipline} onChange={e=>set('discipline',e.target.value)} style={styles.input}>
            {disciplines.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={{ gridColumn:'1/-1', ...styles.formGroup }}>
          <label style={styles.label}>Phase</label>
          <select value={form.phase} onChange={e=>set('phase',e.target.value)} style={styles.input}>
            {MEP_PHASES.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Planned Start</label>
          <input type="date" value={form.plannedStart||''} onChange={e=>set('plannedStart',e.target.value)} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Planned End</label>
          <input type="date" value={form.plannedEnd||''} onChange={e=>set('plannedEnd',e.target.value)} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Duration (days)</label>
          <input type="number" value={form.duration||''} onChange={e=>set('duration',e.target.value)} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Weight % (for overall progress)</label>
          <input type="number" min={0} max={100} value={form.weight||0} onChange={e=>set('weight',+e.target.value)} style={styles.input} />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Contract Value (for invoicing)</label>
          <input type="number" min={0} value={form.contractValue||''} onChange={e=>set('contractValue',+e.target.value)} style={styles.input} placeholder="0.00" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Planned Qty</label>
          <input value={form.plannedQty||''} onChange={e=>set('plannedQty',e.target.value)} style={styles.input} placeholder="e.g. 100" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Unit</label>
          <select value={form.unit||'%'} onChange={e=>set('unit',e.target.value)} style={styles.input}>
            {MEP_UNITS.map(u=><option key={u} value={u}>{u}</option>)}
          </select>
        </div>
        <div style={{ gridColumn:'1/-1', ...styles.formGroup }}>
          <label style={styles.label}>Sequence (for ordering)</label>
          <input type="number" value={form.sequence||0} onChange={e=>set('sequence',+e.target.value)} style={styles.input} />
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:16 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={()=>{ if(!form.name) return alert('Activity name required'); onSave(form); }}>Save Activity</button>
      </div>
    </Modal>
  );
}

// ── Daily Progress Updates ──────────────────────────────────────────────────────

export function DailyUpdateView({ progressUpdates, setProgressUpdates, siteActivities, siteProjects, employees, userRole }) {
  const [selProject, setSelProject] = useState(siteProjects[0]?.id||'');
  const [selDate, setSelDate] = useState(new Date().toISOString().slice(0,10));
  const [editing, setEditing] = useState(null);
  const canEdit = userRole==='admin'||userRole==='manager'||userRole==='sales';

  const project = siteProjects.find(p=>p.id===selProject);
  const todayUpdates = progressUpdates.filter(u=>u.projectId===selProject&&u.date===selDate);
  const projectActs = siteActivities.filter(a=>a.projectId===selProject);

  function save(form) {
    const rec = { ...form, id: form.id||crypto.randomUUID(), projectId: selProject, date: selDate };
    setProgressUpdates(prev => form.id ? prev.map(u=>u.id===form.id?rec:u) : [...prev, rec]);
    // Update consumed materials in siteActivities
    if (form.materialsConsumed?.length) {
      // consumed is tracked per activity bom row
    }
    setEditing(null);
  }
  function del(id) { if(confirm('Delete update?')) setProgressUpdates(prev=>prev.filter(u=>u.id!==id)); }

  if (!siteProjects.length) return (
    <div style={styles.page}>
      <h2 className="serif" style={styles.h2}>Daily Progress Updates</h2>
      <p style={{ color:'#aaa', marginTop:16 }}>Create a project and activities first.</p>
    </div>
  );

  return (
    <div style={styles.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <h2 className="serif" style={styles.h2}>Daily Progress Updates</h2>
          <p style={styles.muted}>{todayUpdates.length} update{todayUpdates.length!==1?'s':''} for selected date</p>
        </div>
        {canEdit && <button style={styles.primaryBtn} onClick={()=>setEditing({ _isNew:true, activityId:'', cumulativePct:0, dailyQtyDone:'', workers:[], materialsConsumed:[], issues:'', remarks:'' })}>+ Add Update</button>}
      </div>

      <div style={{ display:'flex', gap:10, marginBottom:18, flexWrap:'wrap', alignItems:'center' }}>
        <select value={selProject} onChange={e=>setSelProject(e.target.value)} style={{ ...styles.input, width:220 }}>
          {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} style={{ ...styles.input, width:160 }} />
        <div style={{ display:'flex', gap:6 }}>
          <button style={styles.ghostBtn} onClick={()=>{ const d=new Date(selDate); d.setDate(d.getDate()-1); setSelDate(d.toISOString().slice(0,10)); }}>◀ Prev</button>
          <button style={styles.ghostBtn} onClick={()=>setSelDate(new Date().toISOString().slice(0,10))}>Today</button>
          <button style={styles.ghostBtn} onClick={()=>{ const d=new Date(selDate); d.setDate(d.getDate()+1); setSelDate(d.toISOString().slice(0,10)); }}>Next ▶</button>
        </div>
      </div>

      {/* Updates for selected date */}
      {todayUpdates.length===0 && <div style={{ color:'#aaa', padding:24 }}>No updates logged for {selDate}.</div>}
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {todayUpdates.map(u=>{
          const act = projectActs.find(a=>a.id===u.activityId);
          const villa = (project?.villas||[]).find(v=>v.id===act?.villaId);
          const prevPct = progressUpdates
            .filter(x=>x.activityId===u.activityId && x.date<u.date)
            .sort((a,b)=>b.date.localeCompare(a.date))[0]?.cumulativePct || 0;
          const delta = (u.cumulativePct||0) - prevPct;
          return (
            <div key={u.id} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:12, padding:'14px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                <div>
                  <span style={{ fontWeight:600, fontSize:14, color:'#1E2A4A' }}>{villa?.name||'Project-wide'}</span>
                  <span style={{ fontSize:12, color:'#888', marginLeft:8 }}>→ {act?.discipline} → {act?.name||'?'}</span>
                </div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:16, color:'#1A7A3E' }}>{u.cumulativePct}%</span>
                  {delta>0 && <span style={{ fontSize:11, color:'#1A7A3E', background:'#E6F5EC', borderRadius:6, padding:'2px 7px' }}>+{delta}% today</span>}
                  {canEdit && <>
                    <button style={{ ...styles.ghostBtn, fontSize:12 }} onClick={()=>setEditing(u)}>Edit</button>
                    <button style={{ ...styles.ghostBtn, fontSize:12, color:'#B5453A' }} onClick={()=>del(u.id)}>×</button>
                  </>}
                </div>
              </div>
              {/* Workers */}
              {(u.workers||[]).length>0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:6 }}>
                  {u.workers.map((w,i)=>{
                    const emp=employees.find(e=>e.id===w.employeeId);
                    return <span key={i} style={{ fontSize:11.5, background:'#F5F3EE', borderRadius:8, padding:'3px 8px' }}>{emp?.name||'?'} · {w.hours}h · {w.trade}</span>;
                  })}
                </div>
              )}
              {/* Materials consumed */}
              {(u.materialsConsumed||[]).length>0 && (
                <div style={{ fontSize:12, color:'#555', marginBottom:4 }}>
                  Materials: {u.materialsConsumed.map(m=>`${m.material} (${m.qty} ${m.unit})`).join(' · ')}
                </div>
              )}
              {u.issues && <div style={{ fontSize:12, color:'#B5453A', marginTop:4 }}>⚠ {u.issues}</div>}
              {u.remarks && <div style={{ fontSize:12, color:'#666', fontStyle:'italic', marginTop:4 }}>{u.remarks}</div>}
            </div>
          );
        })}
      </div>

      {editing && (
        <UpdateForm update={editing} projectActs={projectActs} project={project} employees={employees}
          progressUpdates={progressUpdates} onSave={save} onClose={()=>setEditing(null)} />
      )}
    </div>
  );
}


export function UpdateForm({ update, projectActs, project, employees, progressUpdates, onSave, onClose }) {
  const TRADES = ['Electrical','Plumbing','HVAC','Civil','Firefighting','IT','General'];
  const [form, setForm] = useState({
    activityId:'', cumulativePct:0, dailyQtyDone:'', workers:[], materialsConsumed:[], issues:'', remarks:'',
    ...update,
  });
  function set(k,v) { setForm(f=>({...f,[k]:v})); }

  const selAct = projectActs.find(a=>a.id===form.activityId);
  const lastPct = form.activityId ? (progressUpdates
    .filter(u=>u.activityId===form.activityId&&u.id!==form.id)
    .sort((a,b)=>b.date.localeCompare(a.date))[0]?.cumulativePct||0) : 0;

  function addWorker() { set('workers',[...form.workers,{ employeeId:'', trade:'Electrical', hours:8 }]); }
  function updateWorker(i,k,v) { const w=[...form.workers]; w[i]={...w[i],[k]:v}; set('workers',w); }
  function removeWorker(i) { set('workers',form.workers.filter((_,idx)=>idx!==i)); }

  // Materials come from the activity BOM
  const actBOM = selAct?.bom || [];
  function toggleMat(row) {
    const existing = form.materialsConsumed.find(m=>m.bomId===row.id);
    if (existing) {
      set('materialsConsumed', form.materialsConsumed.filter(m=>m.bomId!==row.id));
    } else {
      set('materialsConsumed', [...form.materialsConsumed, { bomId:row.id, material:row.material, qty:'', unit:row.unit }]);
    }
  }
  function setMatQty(bomId, qty) {
    set('materialsConsumed', form.materialsConsumed.map(m=>m.bomId===bomId?{...m,qty}:m));
  }

  // Group acts by villa
  const villas = project?.villas||[];
  const byVilla = {};
  projectActs.forEach(a=>{ const key=a.villaId||'__none'; (byVilla[key]=byVilla[key]||[]).push(a); });

  return (
    <Modal title={form._isNew?'Log Progress Update':'Edit Update'} onClose={onClose} width={600}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
        <div style={{ gridColumn:'1/-1', ...styles.formGroup }}>
          <label style={styles.label}>Activity *</label>
          <select value={form.activityId} onChange={e=>set('activityId',e.target.value)} style={styles.input}>
            <option value="">— Select activity —</option>
            {villas.map(v=>{
              const items=byVilla[v.id]||[];
              if (!items.length) return null;
              return <optgroup key={v.id} label={v.name}>{items.map(a=><option key={a.id} value={a.id}>{a.discipline} → {a.name}</option>)}</optgroup>;
            })}
            {(byVilla['__none']||[]).length>0 && (
              <optgroup label="Project-wide">{(byVilla['__none']||[]).map(a=><option key={a.id} value={a.id}>{a.discipline} → {a.name}</option>)}</optgroup>
            )}
          </select>
        </div>
        {form.activityId && (
          <div style={{ gridColumn:'1/-1' }}>
            <div style={{ fontSize:12, color:'#888', marginBottom:6 }}>Previous progress: <strong>{lastPct}%</strong> → Setting cumulative to:</div>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <input type="range" min={lastPct} max={100} value={form.cumulativePct}
                onChange={e=>set('cumulativePct',+e.target.value)} style={{ flex:1, accentColor:'#1A7A3E' }} />
              <span style={{ fontWeight:700, fontSize:18, color:'#1A7A3E', width:48 }}>{form.cumulativePct}%</span>
            </div>
            {selAct?.plannedQty && (
              <div style={{ ...styles.formGroup, marginTop:10 }}>
                <label style={styles.label}>Quantity done today ({selAct.unit})</label>
                <input value={form.dailyQtyDone||''} onChange={e=>set('dailyQtyDone',e.target.value)} style={styles.input} placeholder={`Planned: ${selAct.plannedQty} ${selAct.unit}`} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Workers */}
      <div style={{ marginBottom:6, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontWeight:600, fontSize:13, color:'#1E2A4A' }}>Manpower Today</span>
        <button style={{ ...styles.ghostBtn, fontSize:11 }} onClick={addWorker}>+ Add</button>
      </div>
      {form.workers.map((w,i)=>(
        <div key={i} style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr auto', gap:8, marginBottom:8, alignItems:'center' }}>
          <select value={w.employeeId} onChange={e=>updateWorker(i,'employeeId',e.target.value)} style={{ ...styles.input, fontSize:12 }}>
            <option value="">— Employee —</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select value={w.trade} onChange={e=>updateWorker(i,'trade',e.target.value)} style={{ ...styles.input, fontSize:12 }}>
            {TRADES.map(t=><option key={t} value={t}>{t}</option>)}
          </select>
          <input type="number" min={1} max={12} value={w.hours} onChange={e=>updateWorker(i,'hours',+e.target.value)} style={{ ...styles.input, fontSize:12 }} placeholder="hrs" />
          <button onClick={()=>removeWorker(i)} style={{ ...styles.ghostBtn, color:'#B5453A', fontSize:12, padding:'4px 8px' }}>×</button>
        </div>
      ))}
      {form.workers.length===0 && <div style={{ fontSize:12, color:'#aaa', marginBottom:8 }}>No workers added.</div>}

      {/* Materials consumed */}
      {actBOM.length>0 && (
        <>
          <div style={{ fontWeight:600, fontSize:13, color:'#1E2A4A', marginTop:10, marginBottom:6 }}>Materials Consumed Today</div>
          {actBOM.map(row=>{
            const sel = form.materialsConsumed.find(m=>m.bomId===row.id);
            return (
              <div key={row.id} style={{ display:'flex', gap:8, marginBottom:6, alignItems:'center' }}>
                <button onClick={()=>toggleMat(row)} style={{ fontSize:12, padding:'3px 10px', borderRadius:20, border:'1px solid #DDD8CC', cursor:'pointer', background:sel?'#1E2A4A':'#F5F3EE', color:sel?'#fff':'#444', whiteSpace:'nowrap' }}>
                  {row.material}
                </button>
                {sel && (
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="number" value={sel.qty||''} onChange={e=>setMatQty(row.id,e.target.value)} style={{ ...styles.input, width:80, fontSize:12 }} placeholder="qty" />
                    <span style={{ fontSize:12, color:'#666' }}>{row.unit}</span>
                  </div>
                )}
                {!sel && <span style={{ fontSize:11, color:'#aaa' }}>planned: {row.plannedQty} {row.unit}</span>}
              </div>
            );
          })}
        </>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12 }}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Issues / Blockers</label>
          <textarea value={form.issues||''} onChange={e=>set('issues',e.target.value)} style={{ ...styles.input, height:50 }} placeholder="Any problems on site?" />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Remarks</label>
          <textarea value={form.remarks||''} onChange={e=>set('remarks',e.target.value)} style={{ ...styles.input, height:50 }} />
        </div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:14 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={()=>{ if(!form.activityId) return alert('Select an activity'); onSave(form); }}>Save Update</button>
      </div>
    </Modal>
  );
}

// ── Progress Board (Matrix view) ────────────────────────────────────────────────

export function ProgressBoardView({ siteProjects, siteActivities, progressUpdates }) {
  const [selProject, setSelProject] = useState(siteProjects[0]?.id||'');
  const project = siteProjects.find(p=>p.id===selProject);
  const acts = siteActivities.filter(a=>a.projectId===selProject);
  const villas = project?.villas||[];
  const disciplines = project?.disciplines||MEP_DISCIPLINES;

  function cellPct(villaId, discipline) {
    const cellActs = acts.filter(a=>a.villaId===villaId&&a.discipline===discipline);
    if (!cellActs.length) return null;
    const avg = cellActs.reduce((s,a)=>s+getActivityProgress(a.id,progressUpdates),0)/cellActs.length;
    return Math.round(avg);
  }
  function villaPct(villaId) {
    const va = acts.filter(a=>a.villaId===villaId);
    if (!va.length) return null;
    return Math.round(va.reduce((s,a)=>s+getActivityProgress(a.id,progressUpdates),0)/va.length);
  }
  function discPct(discipline) {
    const da = acts.filter(a=>a.discipline===discipline);
    if (!da.length) return null;
    return Math.round(da.reduce((s,a)=>s+getActivityProgress(a.id,progressUpdates),0)/da.length);
  }
  const overallPct = acts.length ? Math.round(acts.reduce((s,a)=>s+getActivityProgress(a.id,progressUpdates),0)/acts.length) : null;

  function pctColor(pct) {
    if (pct===null) return '#F0EDE6';
    if (pct===100) return '#1A7A3E';
    if (pct>=75) return '#3D7A5C';
    if (pct>=50) return '#C9A24B';
    if (pct>0) return '#E07A2B';
    return '#EAE6DB';
  }
  function pctBg(pct) {
    if (pct===null) return '#F5F3EE';
    if (pct===100) return '#E6F5EC';
    if (pct>=75) return '#EBF5F0';
    if (pct>=50) return '#FDF7E6';
    if (pct>0) return '#FEF0E0';
    return '#FAF8F4';
  }

  if (!siteProjects.length) return (
    <div style={styles.page}>
      <h2 className="serif" style={styles.h2}>Progress Board</h2>
      <p style={{ color:'#aaa', marginTop:16 }}>Create a project and activities first.</p>
    </div>
  );

  const activeDisciplines = disciplines.filter(d=>acts.some(a=>a.discipline===d));

  return (
    <div style={styles.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <h2 className="serif" style={styles.h2}>Progress Board</h2>
          <p style={styles.muted}>Villa × Discipline completion matrix</p>
        </div>
        <select value={selProject} onChange={e=>setSelProject(e.target.value)} style={{ ...styles.input, width:220 }}>
          {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      {overallPct!==null && (
        <div style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:10, padding:'12px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:16 }}>
          <div>
            <div style={{ fontSize:11, color:'#888', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em' }}>Overall Project</div>
            <div style={{ fontSize:24, fontWeight:700, color:pctColor(overallPct) }}>{overallPct}%</div>
          </div>
          <div style={{ flex:1, background:'#EAE6DB', borderRadius:6, height:12 }}>
            <div style={{ width:`${overallPct}%`, background:pctColor(overallPct), borderRadius:6, height:12, transition:'width 0.4s' }} />
          </div>
        </div>
      )}
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', fontSize:13, minWidth: villas.length>0?`${180+activeDisciplines.length*90}px`:'auto' }}>
          <thead>
            <tr>
              <th style={{ padding:'10px 14px', textAlign:'left', background:'#F5F3EE', border:'1px solid #EAE6DB', fontSize:12, color:'#555', minWidth:140 }}>Villa / Unit</th>
              {activeDisciplines.map(d=>(
                <th key={d} style={{ padding:'10px 12px', background:'#F5F3EE', border:'1px solid #EAE6DB', textAlign:'center', fontSize:12, color:'#555', whiteSpace:'nowrap' }}>{d}</th>
              ))}
              <th style={{ padding:'10px 12px', background:'#EAE6DB', border:'1px solid #D8D4CC', textAlign:'center', fontSize:12, color:'#444', fontWeight:700 }}>Overall</th>
            </tr>
          </thead>
          <tbody>
            {villas.map(v=>{
              const vPct = villaPct(v.id);
              return (
                <tr key={v.id}>
                  <td style={{ padding:'8px 14px', border:'1px solid #EAE6DB', fontWeight:600, fontSize:13, color:'#1E2A4A', background:'#FAFAF8' }}>{v.name}</td>
                  {activeDisciplines.map(d=>{
                    const pct = cellPct(v.id, d);
                    return (
                      <td key={d} style={{ padding:'6px 12px', border:'1px solid #EAE6DB', textAlign:'center', background:pctBg(pct) }}>
                        {pct!==null
                          ? <div>
                              <div style={{ fontWeight:700, color:pctColor(pct), fontSize:14 }}>{pct}%</div>
                              <div style={{ height:3, background:'#EAE6DB', borderRadius:2, marginTop:3 }}>
                                <div style={{ width:`${pct}%`, background:pctColor(pct), height:3, borderRadius:2 }} />
                              </div>
                            </div>
                          : <span style={{ color:'#ccc', fontSize:12 }}>—</span>
                        }
                      </td>
                    );
                  })}
                  <td style={{ padding:'8px 12px', border:'1px solid #D8D4CC', textAlign:'center', background:pctBg(vPct), fontWeight:700, color:pctColor(vPct), fontSize:15 }}>
                    {vPct!==null?`${vPct}%`:'—'}
                  </td>
                </tr>
              );
            })}
            {/* Totals row */}
            <tr>
              <td style={{ padding:'8px 14px', border:'1px solid #EAE6DB', fontWeight:700, fontSize:12, color:'#888', background:'#EAE6DB' }}>DISCIPLINE AVG</td>
              {activeDisciplines.map(d=>{
                const pct=discPct(d);
                return (
                  <td key={d} style={{ padding:'8px 12px', border:'1px solid #D8D4CC', textAlign:'center', background:'#EAE6DB', fontWeight:700, color:pctColor(pct), fontSize:14 }}>
                    {pct!==null?`${pct}%`:'—'}
                  </td>
                );
              })}
              <td style={{ padding:'8px 12px', border:'1px solid #C8C4BC', textAlign:'center', background:'#DDD8CC', fontWeight:700, color:pctColor(overallPct), fontSize:16 }}>
                {overallPct!==null?`${overallPct}%`:'—'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:14, marginTop:14, flexWrap:'wrap' }}>
        {[['Not started','#EAE6DB'],['In progress','#E07A2B'],['50%+','#C9A24B'],['75%+','#3D7A5C'],['Complete','#1A7A3E']].map(([l,c])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#555' }}>
            <div style={{ width:14, height:14, borderRadius:3, background:c }} />{l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Client Materials Received ───────────────────────────────────────────────────

export function ClientMaterialView({ clientMaterials, setClientMaterials, siteProjects, employees, userRole }) {
  const [editing, setEditing] = useState(null);
  const [filterProject, setFilterProject] = useState('');
  const canEdit = userRole === 'admin' || userRole === 'manager';
  const sorted = [...clientMaterials]
    .filter(m => !filterProject || m.projectId === filterProject)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  function save(form) {
    const rec = { ...form, id: form.id || crypto.randomUUID() };
    setClientMaterials(prev => form.id ? prev.map(m => m.id === form.id ? rec : m) : [...prev, rec]);
    setEditing(null);
  }
  function del(id) { if (confirm('Delete record?')) setClientMaterials(prev => prev.filter(m => m.id !== id)); }
  const COND_COLOR = { good: '#1A7A3E', damaged: '#B5453A', partial: '#C9A24B' };
  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h2 className="serif" style={styles.h2}>Client Materials Received</h2>
          <p style={styles.muted}>{clientMaterials.length} record{clientMaterials.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && <button style={styles.primaryBtn} onClick={() => setEditing({ _isNew: true, date: new Date().toISOString().slice(0, 10), items: [], status: 'received' })}>+ Log Receipt</button>}
      </div>
      <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ ...styles.input, width: 240, marginBottom: 14 }}>
        <option value="">All Projects</option>
        {siteProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(m => {
          const proj = siteProjects.find(p => p.id === m.projectId);
          return (
            <div key={m.id} style={{ background: '#fff', border: '1px solid #EAE6DB', borderRadius: 12, padding: '14px 18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1E2A4A' }}>{m.date} — {proj?.name || '—'}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Ref: {m.refNo || '—'} · Received by: {m.receivedBy || '—'}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: COND_COLOR[m.status] || '#888', background: '#F5F3EE', borderRadius: 6, padding: '2px 8px', textTransform: 'uppercase' }}>{m.status}</span>
                  {canEdit && <>
                    <button style={{ ...styles.ghostBtn, fontSize: 12 }} onClick={() => setEditing(m)}>Edit</button>
                    <button style={{ ...styles.ghostBtn, fontSize: 12, color: '#B5453A' }} onClick={() => del(m.id)}>×</button>
                  </>}
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead>
                  <tr style={{ background: '#F5F3EE' }}>
                    {['Description', 'Qty', 'Unit', 'Condition'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '4px 8px', color: '#666', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(m.items || []).map((it, i) => (
                    <tr key={i} style={{ borderTop: '1px solid #F0EDE6' }}>
                      <td style={{ padding: '4px 8px' }}>{it.description}</td>
                      <td style={{ padding: '4px 8px' }}>{it.qty}</td>
                      <td style={{ padding: '4px 8px' }}>{it.unit}</td>
                      <td style={{ padding: '4px 8px', color: COND_COLOR[it.condition] || '#888' }}>{it.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {m.remarks && <div style={{ fontSize: 12, color: '#666', marginTop: 8, fontStyle: 'italic' }}>{m.remarks}</div>}
            </div>
          );
        })}
        {sorted.length === 0 && <div style={{ color: '#aaa', padding: 24 }}>No material receipts logged.</div>}
      </div>
      {editing && <ClientMaterialForm record={editing} siteProjects={siteProjects} employees={employees} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}


export function ClientMaterialForm({ record, siteProjects, employees, onSave, onClose }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10), projectId: '', refNo: '',
    receivedBy: '', status: 'received', items: [], remarks: '',
    ...record,
  });
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function addItem() { set('items', [...form.items, { description: '', qty: '', unit: 'nos', condition: 'good' }]); }
  function updateItem(i, k, v) { const it = [...form.items]; it[i] = { ...it[i], [k]: v }; set('items', it); }
  function removeItem(i) { set('items', form.items.filter((_, idx) => idx !== i)); }
  return (
    <Modal title={form._isNew ? 'Log Material Receipt' : 'Edit Receipt'} onClose={onClose} width={620}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={styles.formGroup}><label style={styles.label}>Date *</label><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={styles.input} /></div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Project *</label>
          <select value={form.projectId} onChange={e=>set('projectId',e.target.value)} style={styles.input}>
            <option value="">— Select —</option>
            {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div style={styles.formGroup}><label style={styles.label}>Client Delivery Ref / DO No.</label><input value={form.refNo||''} onChange={e=>set('refNo',e.target.value)} style={styles.input} placeholder="e.g. DO-2024-001" /></div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Received by</label>
          <select value={form.receivedBy||''} onChange={e=>set('receivedBy',e.target.value)} style={styles.input}>
            <option value="">— Select —</option>
            {employees.map(e=><option key={e.id} value={e.name}>{e.name}</option>)}
          </select>
        </div>
        <div style={{ gridColumn:'1/-1', ...styles.formGroup }}>
          <label style={styles.label}>Status</label>
          <select value={form.status} onChange={e=>set('status',e.target.value)} style={{ ...styles.input, width:200 }}>
            {['received','partially received','returned','pending verification'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div style={{ marginTop:14, marginBottom:6, fontWeight:600, fontSize:13, color:'#1E2A4A' }}>
        Items Received <button style={{ ...styles.ghostBtn, fontSize:11, marginLeft:10 }} onClick={addItem}>+ Add item</button>
      </div>
      {form.items.map((it,i)=>(
        <div key={i} style={{ display:'grid', gridTemplateColumns:'3fr 1fr 1fr 1.2fr auto', gap:8, marginBottom:8, alignItems:'center' }}>
          <input value={it.description} onChange={e=>updateItem(i,'description',e.target.value)} style={{ ...styles.input, fontSize:12 }} placeholder="Description" />
          <input value={it.qty} onChange={e=>updateItem(i,'qty',e.target.value)} style={{ ...styles.input, fontSize:12 }} placeholder="Qty" />
          <select value={it.unit} onChange={e=>updateItem(i,'unit',e.target.value)} style={{ ...styles.input, fontSize:12 }}>
            {['nos','m','m²','kg','ltr','roll','set','lot'].map(u=><option key={u} value={u}>{u}</option>)}
          </select>
          <select value={it.condition} onChange={e=>updateItem(i,'condition',e.target.value)} style={{ ...styles.input, fontSize:12 }}>
            {['good','damaged','partial'].map(c=><option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={()=>removeItem(i)} style={{ ...styles.ghostBtn, color:'#B5453A', fontSize:12, padding:'4px 8px' }}>×</button>
        </div>
      ))}
      {form.items.length===0 && <div style={{ fontSize:12, color:'#aaa', marginBottom:8 }}>No items added.</div>}
      <div style={{ ...styles.formGroup, marginTop:10 }}><label style={styles.label}>Remarks</label><textarea value={form.remarks||''} onChange={e=>set('remarks',e.target.value)} style={{ ...styles.input, height:50 }} /></div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:12 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={()=>{ if(!form.date||!form.projectId) return alert('Date and project required'); onSave(form); }}>Save Receipt</button>
      </div>
    </Modal>
  );
}

// ── Site Attendance ─────────────────────────────────────────────────────────────

export function SiteAttendanceView({ siteAttendance, setSiteAttendance, siteProjects, employees, userRole }) {
  const [editing, setEditing] = useState(null);
  const [filterProject, setFilterProject] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const canEdit = userRole === 'admin' || userRole === 'manager';
  const sorted = [...siteAttendance]
    .filter(r => (!filterProject || r.projectId === filterProject) && (!filterMonth || (r.date || '').startsWith(filterMonth)))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  function save(form) {
    const rec = { ...form, id: form.id || crypto.randomUUID() };
    setSiteAttendance(prev => form.id ? prev.map(r => r.id === form.id ? rec : r) : [...prev, rec]);
    setEditing(null);
  }
  function del(id) { if (confirm('Delete attendance record?')) setSiteAttendance(prev => prev.filter(r => r.id !== id)); }
  const STATUS_ICON = { present: '✅', absent: '❌', half_day: '🔶', leave: '🔵' };
  const empSummary = employees.reduce((acc, emp) => {
    const records = sorted.flatMap(r => (r.records || []).filter(x => x.employeeId === emp.id));
    acc[emp.id] = {
      present: records.filter(x => x.status === 'present').length,
      halfDay: records.filter(x => x.status === 'half_day').length,
      absent: records.filter(x => x.status === 'absent').length,
      leave: records.filter(x => x.status === 'leave').length,
      total: records.length,
    };
    return acc;
  }, {});
  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div><h2 className="serif" style={styles.h2}>Site Attendance</h2><p style={styles.muted}>{siteAttendance.length} daily records</p></div>
        {canEdit && <button style={styles.primaryBtn} onClick={() => setEditing({ _isNew: true, date: new Date().toISOString().slice(0, 10), records: [] })}>+ Mark Attendance</button>}
      </div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <select value={filterProject} onChange={e => setFilterProject(e.target.value)} style={{ ...styles.input, width: 220 }}>
          <option value="">All Projects</option>
          {siteProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ ...styles.input, width: 160 }} />
        <button style={styles.ghostBtn} onClick={() => setFilterMonth('')}>All months</button>
      </div>
      {employees.length > 0 && (
        <>
          <div style={styles.dashSection}>Monthly Summary — {filterMonth || 'All time'}</div>
          <div style={{ overflowX: 'auto', marginBottom: 20 }}>
            <table style={styles.table}>
              <thead><tr style={{ background: '#F5F3EE' }}>{['Employee','Days Logged','Present','Half Day','Absent','Leave','Attendance %'].map(h=><th key={h} style={{ ...styles.th, textAlign: h==='Employee'?'left':'center' }}>{h}</th>)}</tr></thead>
              <tbody>
                {employees.map(emp => {
                  const s = empSummary[emp.id] || {};
                  const pct = s.total ? Math.round(((s.present + (s.halfDay||0) * 0.5) / s.total) * 100) : 0;
                  return (
                    <tr key={emp.id} style={{ borderTop: '1px solid #EAE6DB' }}>
                      <td style={styles.td}>{emp.name}</td>
                      <td style={{ ...styles.td, textAlign:'center' }}>{s.total||0}</td>
                      <td style={{ ...styles.td, textAlign:'center', color:'#1A7A3E', fontWeight:600 }}>{s.present||0}</td>
                      <td style={{ ...styles.td, textAlign:'center', color:'#C9A24B' }}>{s.halfDay||0}</td>
                      <td style={{ ...styles.td, textAlign:'center', color:'#B5453A' }}>{s.absent||0}</td>
                      <td style={{ ...styles.td, textAlign:'center', color:'#6B5BAE' }}>{s.leave||0}</td>
                      <td style={{ ...styles.td, textAlign:'center' }}><span style={{ fontWeight:700, color: pct>=80?'#1A7A3E':pct>=60?'#C9A24B':'#B5453A' }}>{s.total?`${pct}%`:'—'}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div style={styles.dashSection}>Daily Records</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sorted.map(r => {
          const proj = siteProjects.find(p => p.id === r.projectId);
          const presentCount = (r.records || []).filter(x => x.status === 'present').length;
          return (
            <div key={r.id} style={{ background: '#fff', border: '1px solid #EAE6DB', borderRadius: 12, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14, color: '#1E2A4A' }}>{r.date}</span>
                  <span style={{ fontSize: 12, color: '#888', marginLeft: 10 }}>{proj?.name || '—'}</span>
                  <span style={{ fontSize: 12, color: '#1A7A3E', marginLeft: 10 }}>{presentCount}/{(r.records||[]).length} present</span>
                </div>
                {canEdit && <div style={{ display:'flex', gap:6 }}>
                  <button style={{ ...styles.ghostBtn, fontSize: 12 }} onClick={() => setEditing(r)}>Edit</button>
                  <button style={{ ...styles.ghostBtn, fontSize: 12, color: '#B5453A' }} onClick={() => del(r.id)}>×</button>
                </div>}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(r.records || []).map((rec, i) => {
                  const emp = employees.find(e => e.id === rec.employeeId);
                  return <span key={i} style={{ fontSize: 12, background: '#F5F3EE', borderRadius: 8, padding: '3px 10px' }}>{STATUS_ICON[rec.status]||'?'} {emp?.name||'?'}</span>;
                })}
              </div>
            </div>
          );
        })}
        {sorted.length === 0 && <div style={{ color: '#aaa', padding: 24 }}>No attendance records for this period.</div>}
      </div>
      {editing && <AttendanceSheet sheet={editing} siteProjects={siteProjects} employees={employees} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}


export function AttendanceSheet({ sheet, siteProjects, employees, onSave, onClose }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10), projectId: '',
    records: employees.map(e => ({ employeeId: e.id, status: 'present', note: '' })),
    ...sheet,
  });
  useEffect(() => {
    if (form.records.length === 0 && employees.length > 0) {
      setForm(f => ({ ...f, records: employees.map(e => ({ employeeId: e.id, status: 'present', note: '' })) }));
    }
  }, []);
  function set(k, v) { setForm(f => ({ ...f, [k]: v })); }
  function setRecord(i, k, v) { const recs = [...form.records]; recs[i] = { ...recs[i], [k]: v }; set('records', recs); }
  const STATUSES = [{ value:'present',label:'P',color:'#1A7A3E' },{ value:'absent',label:'A',color:'#B5453A' },{ value:'half_day',label:'½',color:'#C9A24B' },{ value:'leave',label:'L',color:'#6B5BAE' }];
  const proj = siteProjects.find(p => p.id === form.projectId);
  const relevantEmps = proj?.teamIds?.length ? employees.filter(e => proj.teamIds.includes(e.id)) : employees;
  const displayRecords = form.records.filter(r => relevantEmps.some(e => e.id === r.employeeId));
  return (
    <Modal title="Mark Attendance" onClose={onClose} width={560}>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
        <div style={styles.formGroup}><label style={styles.label}>Date *</label><input type="date" value={form.date} onChange={e=>set('date',e.target.value)} style={styles.input} /></div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Project</label>
          <select value={form.projectId} onChange={e=>set('projectId',e.target.value)} style={styles.input}>
            <option value="">— All / General —</option>
            {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>
      <div style={{ fontWeight:600, fontSize:13, color:'#1E2A4A', marginBottom:8 }}>Employees ({relevantEmps.length})</div>
      <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:340, overflowY:'auto' }}>
        {displayRecords.map((rec) => {
          const emp = employees.find(e => e.id === rec.employeeId);
          const allIdx = form.records.findIndex(r => r.employeeId === rec.employeeId);
          return (
            <div key={rec.employeeId} style={{ display:'grid', gridTemplateColumns:'2fr 1fr 3fr', gap:10, alignItems:'center', padding:'8px 12px', background:'#FAF8F4', borderRadius:8 }}>
              <span style={{ fontSize:13, fontWeight:500 }}>{emp?.name||'?'}</span>
              <div style={{ display:'flex', gap:4 }}>
                {STATUSES.map(s=>(
                  <button key={s.value} onClick={()=>setRecord(allIdx,'status',s.value)}
                    style={{ fontSize:12, padding:'3px 8px', borderRadius:6, border:'none', cursor:'pointer', background:rec.status===s.value?s.color:'#EAE6DB', color:rec.status===s.value?'#fff':'#666', fontWeight:700 }}>
                    {s.label}
                  </button>
                ))}
              </div>
              <input value={rec.note||''} onChange={e=>setRecord(allIdx,'note',e.target.value)} style={{ ...styles.input, fontSize:12, padding:'4px 8px' }} placeholder="Note (optional)" />
            </div>
          );
        })}
        {displayRecords.length===0 && <div style={{ color:'#aaa', fontSize:13 }}>No employees. Add team in project settings.</div>}
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:16 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={()=>{ if(!form.date) return alert('Date required'); onSave(form); }}>Save Attendance</button>
      </div>
    </Modal>
  );
}

// ── Quarterly Evaluation ────────────────────────────────────────────────────────

export function QuarterlyEvalView({ evaluations, setEvaluations, employees, siteAttendance, progressUpdates, siteProjects, userRole }) {
  const [editing, setEditing] = useState(null);
  const [filterEmp, setFilterEmp] = useState('');
  const canEdit = userRole === 'admin' || userRole === 'manager';
  const sorted = [...evaluations]
    .filter(e => !filterEmp || e.employeeId === filterEmp)
    .sort((a, b) => `${b.year}${b.quarter}`.localeCompare(`${a.year}${a.quarter}`));

  function computeStats(employeeId, quarter, year) {
    const qMonths = { Q1:['01','02','03'], Q2:['04','05','06'], Q3:['07','08','09'], Q4:['10','11','12'] }[quarter];
    const prefix = qMonths.map(m => `${year}-${m}`);
    const attRecs = siteAttendance.filter(r=>prefix.some(p=>(r.date||'').startsWith(p))).flatMap(r=>(r.records||[]).filter(x=>x.employeeId===employeeId));
    const total = attRecs.length;
    const present = attRecs.filter(x=>x.status==='present').length;
    const halfDay = attRecs.filter(x=>x.status==='half_day').length;
    const attPct = total ? Math.round(((present+halfDay*0.5)/total)*100) : 0;
    const dsrCount = progressUpdates.filter(u=>prefix.some(p=>(u.date||'').startsWith(p))).filter(u=>(u.workers||[]).some(w=>w.employeeId===employeeId)).length;
    return { attPct, dsrCount, totalDays: total };
  }
  function save(form) {
    const rec = { ...form, id: form.id || crypto.randomUUID() };
    setEvaluations(prev => form.id ? prev.map(e => e.id === form.id ? rec : e) : [...prev, rec]);
    setEditing(null);
  }
  function del(id) { if (confirm('Delete evaluation?')) setEvaluations(prev => prev.filter(e => e.id !== id)); }
  const RATING_COLOR = { 5:'#1A7A3E', 4:'#3D7A5C', 3:'#C9A24B', 2:'#E07A2B', 1:'#B5453A' };
  const currentYear = new Date().getFullYear();
  const currentQ = `Q${Math.ceil((new Date().getMonth()+1)/3)}`;
  return (
    <div style={styles.page}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
        <div><h2 className="serif" style={styles.h2}>Quarterly Evaluation</h2><p style={styles.muted}>{evaluations.length} evaluation{evaluations.length!==1?'s':''}</p></div>
        {canEdit && <button style={styles.primaryBtn} onClick={()=>setEditing({ _isNew:true, quarter:currentQ, year:String(currentYear), ratings:{ punctuality:3, quality:3, teamwork:3, safety:3, initiative:3 } })}>+ New Evaluation</button>}
      </div>
      <select value={filterEmp} onChange={e=>setFilterEmp(e.target.value)} style={{ ...styles.input, width:240, marginBottom:16 }}>
        <option value="">All Employees</option>
        {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {sorted.map(ev=>{
          const emp = employees.find(e=>e.id===ev.employeeId);
          const ratings = ev.ratings||{};
          const vals = Object.values(ratings).filter(v=>typeof v==='number');
          const avg = vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'—';
          return (
            <div key={ev.id} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:12, padding:'16px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:15, color:'#1E2A4A' }}>{emp?.name||'?'}</div>
                  <div style={{ fontSize:12.5, color:'#888', marginTop:2 }}>{ev.quarter} {ev.year}</div>
                </div>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <div style={{ textAlign:'center' }}>
                    <div style={{ fontSize:22, fontWeight:700, color:RATING_COLOR[Math.round(parseFloat(avg))]||'#888' }}>{avg}</div>
                    <div style={{ fontSize:10, color:'#aaa' }}>avg / 5</div>
                  </div>
                  {canEdit && <>
                    <button style={{ ...styles.ghostBtn, fontSize:12 }} onClick={()=>setEditing(ev)}>Edit</button>
                    <button style={{ ...styles.ghostBtn, fontSize:12, color:'#B5453A' }} onClick={()=>del(ev.id)}>×</button>
                  </>}
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:10 }}>
                {[['punctuality','Punctuality'],['quality','Quality'],['teamwork','Teamwork'],['safety','Safety'],['initiative','Initiative']].map(([k,l])=>(
                  <div key={k} style={{ textAlign:'center', background:'#FAF8F4', borderRadius:8, padding:'8px 4px' }}>
                    <div style={{ fontSize:18, fontWeight:700, color:RATING_COLOR[ratings[k]]||'#aaa' }}>{ratings[k]||'—'}</div>
                    <div style={{ fontSize:10, color:'#888', marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, fontSize:12, color:'#555' }}>
                <div>📅 Attendance: <strong style={{ color:ev.attPct>=80?'#1A7A3E':'#C9A24B' }}>{ev.attPct??'—'}%</strong></div>
                <div>📋 Active days: <strong>{ev.dsrCount??'—'}</strong></div>
                <div>📝 Status: <strong>{ev.status||'draft'}</strong></div>
              </div>
              {ev.comments && <div style={{ fontSize:12, color:'#666', marginTop:8, fontStyle:'italic', borderTop:'1px solid #F0EDE6', paddingTop:8 }}>{ev.comments}</div>}
            </div>
          );
        })}
        {sorted.length===0 && <div style={{ color:'#aaa', padding:24 }}>No evaluations recorded.</div>}
      </div>
      {editing && <QuarterlyEvalForm evaluation={editing} employees={employees} computeStats={computeStats} onSave={save} onClose={()=>setEditing(null)} />}
    </div>
  );
}


export function QuarterlyEvalForm({ evaluation, employees, computeStats, onSave, onClose }) {
  const currentYear = new Date().getFullYear();
  const [form, setForm] = useState({
    employeeId:'', quarter:'Q1', year:String(currentYear), status:'draft',
    ratings:{ punctuality:3, quality:3, teamwork:3, safety:3, initiative:3 },
    attPct:null, dsrCount:null, comments:'',
    ...evaluation,
  });
  function set(k,v) { setForm(f=>({...f,[k]:v})); }
  function setRating(k,v) { setForm(f=>({...f,ratings:{...f.ratings,[k]:v}})); }
  useEffect(()=>{
    if (form.employeeId && form.quarter && form.year) {
      const stats = computeStats(form.employeeId, form.quarter, form.year);
      setForm(f=>({...f, attPct:stats.attPct, dsrCount:stats.dsrCount, totalDays:stats.totalDays}));
    }
  }, [form.employeeId, form.quarter, form.year]);
  const RATING_LABELS = { 1:'Poor', 2:'Below avg', 3:'Average', 4:'Good', 5:'Excellent' };
  const CRITERIA = [['punctuality','Punctuality & Attendance'],['quality','Quality of Work'],['teamwork','Teamwork & Cooperation'],['safety','Safety Compliance'],['initiative','Initiative & Attitude']];
  const avgRating = (Object.values(form.ratings).reduce((a,b)=>a+b,0)/Object.values(form.ratings).length).toFixed(1);
  return (
    <Modal title={form._isNew?'New Quarterly Evaluation':'Edit Evaluation'} onClose={onClose} width={560}>
      <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:12, marginBottom:16 }}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Employee *</label>
          <select value={form.employeeId} onChange={e=>set('employeeId',e.target.value)} style={styles.input}>
            <option value="">— Select —</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div style={styles.formGroup}><label style={styles.label}>Quarter</label><select value={form.quarter} onChange={e=>set('quarter',e.target.value)} style={styles.input}>{['Q1','Q2','Q3','Q4'].map(q=><option key={q} value={q}>{q}</option>)}</select></div>
        <div style={styles.formGroup}><label style={styles.label}>Year</label><select value={form.year} onChange={e=>set('year',e.target.value)} style={styles.input}>{[currentYear,currentYear-1,currentYear-2].map(y=><option key={y} value={y}>{y}</option>)}</select></div>
      </div>
      {form.employeeId && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:16 }}>
          {[['Attendance %',form.attPct!==null?`${form.attPct}%`:'—',form.attPct>=80?'#1A7A3E':'#C9A24B'],['Active Days',form.dsrCount??'—','#1E2A4A'],['Working Days',form.totalDays??'—','#555']].map(([l,v,c])=>(
            <div key={l} style={{ background:'#FAF8F4', borderRadius:8, padding:'10px 14px', textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:700, color:c }}>{v}</div>
              <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{l}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontWeight:600, fontSize:13, color:'#1E2A4A', marginBottom:10 }}>Performance Ratings <span style={{ fontSize:11, color:'#888', fontWeight:400 }}>(1=Poor → 5=Excellent)</span></div>
        {CRITERIA.map(([k,label])=>(
          <div key={k} style={{ display:'grid', gridTemplateColumns:'2fr 1fr auto', gap:12, alignItems:'center', marginBottom:10 }}>
            <label style={{ fontSize:13, color:'#444' }}>{label}</label>
            <input type="range" min={1} max={5} value={form.ratings[k]||3} onChange={e=>setRating(k,+e.target.value)} style={{ accentColor:'#1E2A4A' }} />
            <span style={{ fontSize:13, fontWeight:700, color:'#1E2A4A', width:100, textAlign:'right' }}>{form.ratings[k]}/5 — {RATING_LABELS[form.ratings[k]]}</span>
          </div>
        ))}
        <div style={{ textAlign:'right', fontSize:13, color:'#1E2A4A', fontWeight:600 }}>Overall: {avgRating} / 5</div>
      </div>
      <div style={styles.formGroup}><label style={styles.label}>Comments / Recommendations</label><textarea value={form.comments||''} onChange={e=>set('comments',e.target.value)} style={{ ...styles.input, height:64 }} /></div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
        <div style={styles.formGroup}><label style={styles.label}>Evaluator</label><input value={form.evaluator||''} onChange={e=>set('evaluator',e.target.value)} style={styles.input} /></div>
        <div style={styles.formGroup}><label style={styles.label}>Status</label><select value={form.status} onChange={e=>set('status',e.target.value)} style={styles.input}>{['draft','submitted','acknowledged'].map(s=><option key={s} value={s}>{s}</option>)}</select></div>
      </div>
      <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
        <button style={styles.ghostBtn} onClick={onClose}>Cancel</button>
        <button style={styles.primaryBtn} onClick={()=>{ if(!form.employeeId) return alert('Select an employee'); onSave(form); }}>Save Evaluation</button>
      </div>
    </Modal>
  );
}



// ─── Asset Register ──────────────────────────────────────────────────────────

export function TenderView({ tenders, setTenders, customers, siteProjects, userRole, businessInfo }) {
  const [editing, setEditing] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);
  const canEdit = ['admin','manager'].includes(userRole);
  const STATUS = ['draft','submitted','won','lost','cancelled'];
  const STATUS_COLOR = { draft:'#555', submitted:'#0a58ca', won:'#1a6b30', lost:'#842029', cancelled:'#888' };
  const STATUS_BG    = { draft:'#f0ece5', submitted:'#cfe2ff', won:'#d4edda', lost:'#f8d7da', cancelled:'#f0f0f0' };
  const country = businessInfo?.country || 'other';
  const cc = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.other;
  const sellerState = businessInfo?.state || '';

  function blank() {
    return { id:'', number:`TND-${String(tenders.length+1).padStart(3,'0')}`, customerId:'', projectRef:'', title:'', submissionDate:'', validUntil:'', status:'draft', boq:[], taxRate: cc.defaultTaxRate||0, placeOfSupply:'', notes:'' };
  }
  function blankLine() { return { id:crypto.randomUUID(), description:'', unit:'', qty:0, rate:0 }; }
  function lineTotal(l) { return (parseFloat(l.qty)||0)*(parseFloat(l.rate)||0); }
  function boqSubtotal(t) { return (t.boq||[]).reduce((s,l)=>s+lineTotal(l),0); }
  function grandTotal(t) {
    const sub = boqSubtotal(t);
    if (!cc.hasTax) return sub;
    return calcModuleTax(sub, t.taxRate||0, cc, t.placeOfSupply, sellerState).grandTotal;
  }
  function save(t) {
    const rec = { ...t, id:t.id||crypto.randomUUID(), approvalStatus: t.approvalStatus||'draft', approvalNote: t.approvalNote||'', updatedAt:Date.now() };
    setTenders(prev => prev.find(x=>x.id===rec.id)?prev.map(x=>x.id===rec.id?rec:x):[...prev,rec]);
    setEditing(null);
  }
  function updateApproval(id, patch) {
    setTenders(prev => prev.map(x => x.id===id ? { ...x, approvalStatus: patch.status, approvalNote: patch.rejectionNote||'' } : x));
  }

  if (editing) {
    const t = editing;
    const set = (k,v) => setEditing(p=>({...p,[k]:v}));
    const subtotal = boqSubtotal(t);
    return (
      <div style={{ maxWidth:760, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{t.id?'Edit':'New'} Tender — {t.number}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Tender No.</label><input value={t.number} onChange={e=>set('number',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Submission Date</label><input type='date' value={t.submissionDate||''} onChange={e=>set('submissionDate',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Valid Until</label><input type='date' value={t.validUntil||''} onChange={e=>set('validUntil',e.target.value)} style={styles.input}/></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Client</label>
              <select value={t.customerId||''} onChange={e=>set('customerId',e.target.value)} style={styles.input}>
                <option value=''>Select client</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Status</label>
              <select value={t.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
                {STATUS.map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Tender Title / Scope</label><input value={t.title||''} onChange={e=>set('title',e.target.value)} style={styles.input} placeholder='e.g. MEP Works for Villa Block A'/></div>
          {/* BOQ */}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:8, textTransform:'uppercase' }}>Bill of Quantities (BOQ)</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#F8F7F4' }}>
                {['Description','Unit','Qty','Rate','Amount',''].map(h=><th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {(t.boq||[]).map((l,i)=>(
                  <tr key={l.id}>
                    <td style={{ padding:'4px 4px' }}><input value={l.description} onChange={e=>set('boq',t.boq.map((x,j)=>j===i?{...x,description:e.target.value}:x))} style={{ ...styles.input, margin:0, width:'100%' }}/></td>
                    <td style={{ padding:'4px 4px', width:70 }}><input value={l.unit} onChange={e=>set('boq',t.boq.map((x,j)=>j===i?{...x,unit:e.target.value}:x))} style={{ ...styles.input, margin:0 }} placeholder='m²'/></td>
                    <td style={{ padding:'4px 4px', width:80 }}><input type='number' value={l.qty} onChange={e=>set('boq',t.boq.map((x,j)=>j===i?{...x,qty:e.target.value}:x))} style={{ ...styles.input, margin:0 }}/></td>
                    <td style={{ padding:'4px 4px', width:100 }}><input type='number' value={l.rate} onChange={e=>set('boq',t.boq.map((x,j)=>j===i?{...x,rate:e.target.value}:x))} style={{ ...styles.input, margin:0 }}/></td>
                    <td style={{ padding:'4px 8px', fontWeight:600, width:100 }}>{lineTotal(l).toLocaleString(undefined,{maximumFractionDigits:2})}</td>
                    <td style={{ padding:'4px 4px', width:30 }}><button onClick={()=>set('boq',t.boq.filter((_,j)=>j!==i))} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={13}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
              <button onClick={()=>set('boq',[...(t.boq||[]),blankLine()])} style={styles.ghostBtn}><Plus size={13}/> Add Line</button>
              {!cc.hasTax && <div style={{ fontWeight:700, fontSize:15, color:'#1E2A4A' }}>Total: {subtotal.toLocaleString(undefined,{maximumFractionDigits:2})}</div>}
            </div>
            {cc.hasTax && (
              <TaxSummaryBox
                subtotal={subtotal} taxRate={t.taxRate} cc={cc}
                placeOfSupply={t.placeOfSupply} sellerState={sellerState}
                onChangeTax={v=>set('taxRate',v)} onChangePOS={v=>set('placeOfSupply',v)}
              />
            )}
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Notes</label><textarea value={t.notes||''} onChange={e=>set('notes',e.target.value)} style={{ ...styles.input, height:60 }}/></div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>save(t)} style={styles.primaryBtn}>Save Tender</button>
          </div>
        </div>
      </div>
    );
  }

  const list = [...tenders].sort((a,b)=>b.submissionDate>a.submissionDate?1:-1);
  const wonValue = tenders.filter(t=>t.status==='won').reduce((s,t)=>s+grandTotal(t),0);
  return (
    <>
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 className="serif" style={styles.pageTitle}>Tender & Estimation</h2>
        {canEdit && <button onClick={()=>setEditing(blank())} style={styles.primaryBtn}><Plus size={15}/> New Tender</button>}
      </div>
      <div style={{ display:'flex', gap:16, marginBottom:20 }}>
        {[['Total',tenders.length,''],['Won',tenders.filter(t=>t.status==='won').length,'#1a6b30'],['Submitted',tenders.filter(t=>t.status==='submitted').length,'#0a58ca'],['Won Value',(cc.currency||'')+wonValue.toLocaleString(undefined,{maximumFractionDigits:0}),'#C9A24B']].map(([l,v,c])=>(
          <div key={l} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:8, padding:'12px 18px', minWidth:100 }}>
            <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:700, color:c||'#1E2A4A' }}>{v}</div>
          </div>
        ))}
      </div>
      {list.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No tenders yet.</div> : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4' }}>
              {['Tender No.','Title','Client','Submission','BOQ Value',cc.hasTax?'Grand Total (incl. tax)':'','Status',''].map(h=>h&&<th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(t=>{
                const client = customers.find(c=>c.id===t.customerId);
                const sub = boqSubtotal(t);
                const gt = grandTotal(t);
                return (
                  <tr key={t.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{t.number}</td>
                    <td style={{ padding:'10px 12px', color:'#333' }}>{t.title||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{client?.name||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{t.submissionDate||'—'}</td>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{(cc.currency||'')+sub.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                    {cc.hasTax && <td style={{ padding:'10px 12px', fontWeight:700, color:'#1E2A4A' }}>{(cc.currency||'')+gt.toLocaleString(undefined,{maximumFractionDigits:0})}</td>}
                    <td style={{ padding:'10px 12px' }}><span style={{ background:STATUS_BG[t.status], color:STATUS_COLOR[t.status], borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{t.status.toUpperCase()}</span></td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', justifyContent:'flex-end' }}>
                        <StatusBadge status={t.approvalStatus||'draft'} />
                        <ApprovalActions item={{ status:t.approvalStatus||'draft', rejectionNote:t.approvalNote||'' }} onUpdate={(patch)=>updateApproval(t.id,patch)} userRole={userRole} compact />
                        <button onClick={()=>setPrintDoc(t)} style={styles.iconBtn} title="Print"><Printer size={14}/></button>
                        {canEdit && t.approvalStatus!=='submitted' && <><button onClick={()=>setEditing(t)} style={styles.iconBtn}><Pencil size={14}/></button>
                        <button onClick={()=>{if(window.confirm('Delete?'))setTenders(prev=>prev.filter(x=>x.id!==t.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button></>}
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
    {/* ── Tender Print Overlay ── */}
    {printDoc && (()=>{
      const t = printDoc;
      const client = customers.find(c=>c.id===t.customerId);
      const sub = boqSubtotal(t);
      const tax = cc.hasTax ? calcModuleTax(sub, t.taxRate||0, cc, t.placeOfSupply, sellerState) : null;
      return (
        <DocPrintOverlay onClose={()=>setPrintDoc(null)} filename={`Tender-${t.number}.pdf`} businessInfo={businessInfo}>
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#1E2A4A', letterSpacing:1 }}>TENDER / BILL OF QUANTITIES</div>
            <div style={{ fontSize:13, color:'#888', marginTop:4 }}>{t.number} &nbsp;|&nbsp; Status: {t.status?.toUpperCase()}</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 32px', fontSize:13, marginBottom:20 }}>
            {[['Client / Employer', client?.name||'—'], ['Tender Title', t.title||'—'], ['Submission Date', t.submissionDate||'—'], ['Valid Until', t.validUntil||'—']].map(([l,v])=>(
              <div key={l} style={{ display:'flex', gap:8, borderBottom:'1px solid #f0ece5', padding:'5px 0' }}>
                <span style={{ color:'#888', minWidth:130 }}>{l}</span><span style={{ fontWeight:600, color:'#1E2A4A' }}>{v}</span>
              </div>
            ))}
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:16 }}>
            <thead><tr style={{ background:'#1E2A4A', color:'#fff' }}>
              {['#','Description','Unit','Qty','Rate','Amount'].map(h=><th key={h} style={{ padding:'8px 10px', textAlign:h==='#'||h==='Qty'||h==='Rate'||h==='Amount'?'right':'left', fontSize:11, fontWeight:700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(t.boq||[]).map((l,i)=>(
                <tr key={l.id} style={{ background:i%2===0?'#fff':'#F8F7F4', borderBottom:'1px solid #eee' }}>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:'#888' }}>{i+1}</td>
                  <td style={{ padding:'7px 10px' }}>{l.description}</td>
                  <td style={{ padding:'7px 10px', textAlign:'center' }}>{l.unit||'—'}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right' }}>{parseFloat(l.qty||0).toLocaleString()}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right' }}>{(cc.currency||'')+parseFloat(l.rate||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600 }}>{(cc.currency||'')+lineTotal(l).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'2px solid #1E2A4A' }}>
                <td colSpan={5} style={{ padding:'8px 10px', textAlign:'right', fontWeight:700 }}>Subtotal</td>
                <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700 }}>{(cc.currency||'')+sub.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
              </tr>
              {tax && tax.cgst>0 && <>
                <tr><td colSpan={5} style={{ padding:'4px 10px', textAlign:'right', color:'#555' }}>CGST ({(t.taxRate||0)/2}%)</td><td style={{ padding:'4px 10px', textAlign:'right' }}>{(cc.currency||'')+tax.cgst.toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>
                <tr><td colSpan={5} style={{ padding:'4px 10px', textAlign:'right', color:'#555' }}>SGST ({(t.taxRate||0)/2}%)</td><td style={{ padding:'4px 10px', textAlign:'right' }}>{(cc.currency||'')+tax.sgst.toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>
              </>}
              {tax && tax.igst>0 && <tr><td colSpan={5} style={{ padding:'4px 10px', textAlign:'right', color:'#555' }}>IGST ({t.taxRate||0}%)</td><td style={{ padding:'4px 10px', textAlign:'right' }}>{(cc.currency||'')+tax.igst.toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>}
              {tax && tax.vat>0 && <tr><td colSpan={5} style={{ padding:'4px 10px', textAlign:'right', color:'#555' }}>{cc.taxLabel||'Tax'} ({t.taxRate||0}%)</td><td style={{ padding:'4px 10px', textAlign:'right' }}>{(cc.currency||'')+tax.vat.toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>}
              {tax && <tr style={{ background:'#1E2A4A', color:'#fff' }}>
                <td colSpan={5} style={{ padding:'10px', textAlign:'right', fontWeight:700, fontSize:14 }}>Grand Total</td>
                <td style={{ padding:'10px', textAlign:'right', fontWeight:700, fontSize:14 }}>{(cc.currency||'')+tax.grandTotal.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
              </tr>}
              {!tax && <tr style={{ background:'#1E2A4A', color:'#fff' }}>
                <td colSpan={5} style={{ padding:'10px', textAlign:'right', fontWeight:700, fontSize:14 }}>Total</td>
                <td style={{ padding:'10px', textAlign:'right', fontWeight:700, fontSize:14 }}>{(cc.currency||'')+sub.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
              </tr>}
            </tfoot>
          </table>
          {t.notes && <div style={{ fontSize:12, color:'#555', borderTop:'1px solid #eee', paddingTop:10, marginTop:4 }}><b>Notes:</b> {t.notes}</div>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32, marginTop:48 }}>
            {['Prepared By','Authorised Signatory'].map(s=>(
              <div key={s} style={{ borderTop:'1px solid #555', paddingTop:8, fontSize:12, color:'#555', textAlign:'center' }}>{s}</div>
            ))}
          </div>
        </DocPrintOverlay>
      );
    })()}
    </>
  );
}

// ─── Subcontractor Management ─────────────────────────────────────────────────

export function SubcontractorView({ subcontractors, setSubcontractors, siteProjects, userRole, businessInfo }) {
  const [tab, setTab] = useState('register');
  const [editing, setEditing] = useState(null);
  const [editingWO, setEditingWO] = useState(null);
  const [printWO, setPrintWO] = useState(null);
  const canEdit = ['admin','manager'].includes(userRole);
  const country = businessInfo?.country || 'other';
  const cc = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.other;
  const sellerState = businessInfo?.state || '';

  // All work orders across all subcontractors
  const allWOs = subcontractors.flatMap(s=>(s.workOrders||[]).map(w=>({...w,subId:s.id,subName:s.name})));

  function blankSub() { return { id:'', name:'', trade:'', contact:'', email:'', phone:'', taxId:'', workOrders:[] }; }
  function blankWO(subId) { return { id:crypto.randomUUID(), subId, projectId:'', scope:'', value:0, taxRate:cc.defaultTaxRate||0, placeOfSupply:'', startDate:'', endDate:'', advancePaid:0, progressPaid:0, retentionHeld:0, finalPaid:0, status:'active' }; }

  function saveSub(sub) {
    const rec = { ...sub, id:sub.id||crypto.randomUUID() };
    setSubcontractors(prev=>prev.find(x=>x.id===rec.id)?prev.map(x=>x.id===rec.id?rec:x):[...prev,rec]);
    setEditing(null);
  }
  function saveWO(wo) {
    const rec = { ...wo, approvalStatus: wo.approvalStatus||'draft', approvalNote: wo.approvalNote||'' };
    setSubcontractors(prev=>prev.map(s=>{
      if(s.id!==rec.subId) return s;
      const wos = s.workOrders||[];
      return { ...s, workOrders: wos.find(w=>w.id===rec.id)?wos.map(w=>w.id===rec.id?rec:w):[...wos,rec] };
    }));
    setEditingWO(null);
  }
  function updateWOApproval(woId, subId, patch) {
    setSubcontractors(prev=>prev.map(s=>{
      if(s.id!==subId) return s;
      return { ...s, workOrders:(s.workOrders||[]).map(w=>w.id===woId?{...w,approvalStatus:patch.status,approvalNote:patch.rejectionNote||''}:w) };
    }));
  }
  function balance(wo) {
    return (parseFloat(wo.value)||0) - (parseFloat(wo.advancePaid)||0) - (parseFloat(wo.progressPaid)||0) - (parseFloat(wo.retentionHeld)||0) - (parseFloat(wo.finalPaid)||0);
  }

  const TABS = [['register','Register'],['workorders','Work Orders']];

  if (editingWO) {
    const wo = editingWO;
    const set = (k,v)=>setEditingWO(p=>({...p,[k]:v}));
    const sub = subcontractors.find(s=>s.id===wo.subId);
    return (
      <div style={{ maxWidth:620, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditingWO(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>Work Order — {sub?.name}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Project</label>
              <select value={wo.projectId||''} onChange={e=>set('projectId',e.target.value)} style={styles.input}>
                <option value=''>Select project</option>
                {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Status</label>
              <select value={wo.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
                {['active','completed','terminated','on_hold'].map(s=><option key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Start Date</label><input type='date' value={wo.startDate||''} onChange={e=>set('startDate',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>End Date</label><input type='date' value={wo.endDate||''} onChange={e=>set('endDate',e.target.value)} style={styles.input}/></div>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Scope of Work</label><textarea value={wo.scope||''} onChange={e=>set('scope',e.target.value)} style={{ ...styles.input, height:72 }}/></div>
          <div style={styles.formGroup}><label style={styles.label}>Contract Value (excl. tax)</label><input type='number' value={wo.value||0} onChange={e=>set('value',e.target.value)} style={styles.input}/></div>
          {cc.hasTax && (
            <TaxSummaryBox
              subtotal={parseFloat(wo.value)||0} taxRate={wo.taxRate} cc={cc}
              placeOfSupply={wo.placeOfSupply} sellerState={sellerState}
              onChangeTax={v=>set('taxRate',v)} onChangePOS={v=>set('placeOfSupply',v)}
            />
          )}
          <div style={{ background:'#F8F7F4', borderRadius:8, padding:14 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:10 }}>Payment Tracker</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[['advancePaid','Advance Paid'],['progressPaid','Progress Payments'],['retentionHeld','Retention Held'],['finalPaid','Final Payment']].map(([k,label])=>(
                <div key={k} style={styles.formGroup}><label style={styles.label}>{label}</label><input type='number' value={wo[k]||0} onChange={e=>set(k,e.target.value)} style={styles.input}/></div>
              ))}
            </div>
            <div style={{ textAlign:'right', fontWeight:700, fontSize:14, color: balance(wo)<0?'#B5453A':'#1a6b30', marginTop:8 }}>
              Balance Due: {balance(wo).toLocaleString(undefined,{maximumFractionDigits:2})}
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditingWO(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>saveWO(wo)} style={styles.primaryBtn}>Save</button>
          </div>
        </div>
      </div>
    );
  }

  if (editing) {
    const s = editing;
    const set = (k,v)=>setEditing(p=>({...p,[k]:v}));
    return (
      <div style={{ maxWidth:560, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{s.id?'Edit':'New'} Subcontractor</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:12 }}>
          {[['name','Company Name'],['trade','Trade / Discipline'],['contact','Contact Person'],['phone','Phone'],['email','Email'],['taxId','Tax / VAT ID']].map(([k,label])=>(
            <div key={k} style={styles.formGroup}><label style={styles.label}>{label}</label><input value={s[k]||''} onChange={e=>set(k,e.target.value)} style={styles.input}/></div>
          ))}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>saveSub(s)} style={styles.primaryBtn}>Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 className="serif" style={styles.pageTitle}>Subcontractor Management</h2>
        {canEdit && tab==='register' && <button onClick={()=>setEditing(blankSub())} style={styles.primaryBtn}><Plus size={15}/> Add Subcontractor</button>}
        {canEdit && tab==='workorders' && <button onClick={()=>{ if(!subcontractors.length){alert('Add a subcontractor first.');return;} setEditingWO(blankWO(subcontractors[0].id)); }} style={styles.primaryBtn}><Plus size={15}/> New Work Order</button>}
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{ ...styles.ghostBtn, background:tab===k?'#1E2A4A':'transparent', color:tab===k?'#fff':'#555', fontSize:12 }}>{l}</button>)}
      </div>
      {tab==='register' && (
        subcontractors.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No subcontractors registered.</div> : (
          <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#F8F7F4' }}>
                {['Name','Trade','Contact','Phone','Work Orders',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {subcontractors.map(s=>(
                  <tr key={s.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{s.name}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{s.trade||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{s.contact||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{s.phone||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{(s.workOrders||[]).length}</td>
                    <td style={{ padding:'10px 12px' }}>
                      {canEdit && <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>setEditing(s)} style={styles.iconBtn}><Pencil size={14}/></button>
                        <button onClick={()=>setEditingWO(blankWO(s.id))} style={{ ...styles.ghostBtn, fontSize:11 }}><Plus size={13}/> WO</button>
                        <button onClick={()=>{if(window.confirm('Delete?'))setSubcontractors(prev=>prev.filter(x=>x.id!==s.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button>
                      </div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {tab==='workorders' && (
        allWOs.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No work orders yet.</div> : (
          <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#F8F7F4' }}>
                {['Subcontractor','Project','Scope','Value',cc.hasTax?'Grand Total':'','Balance','Status',''].filter(h=>h!==false&&h!=='').map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {allWOs.map(wo=>{
                  const proj = siteProjects.find(p=>p.id===wo.projectId);
                  const bal = balance(wo);
                  const woValue = parseFloat(wo.value||0);
                  const woGrand = cc.hasTax ? calcModuleTax(woValue, wo.taxRate||0, cc, wo.placeOfSupply, sellerState).grandTotal : woValue;
                  return (
                    <tr key={wo.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                      <td style={{ padding:'10px 12px', fontWeight:600 }}>{wo.subName}</td>
                      <td style={{ padding:'10px 12px', color:'#555' }}>{proj?.name||'—'}</td>
                      <td style={{ padding:'10px 12px', color:'#333', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{wo.scope||'—'}</td>
                      <td style={{ padding:'10px 12px', fontWeight:600 }}>{(cc.currency||'')+woValue.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                      {cc.hasTax && <td style={{ padding:'10px 12px', fontWeight:700, color:'#1E2A4A' }}>{(cc.currency||'')+woGrand.toLocaleString(undefined,{maximumFractionDigits:0})}</td>}
                      <td style={{ padding:'10px 12px', color:bal<0?'#B5453A':'#1a6b30', fontWeight:600 }}>{bal.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                      <td style={{ padding:'10px 12px' }}><span style={{ background:wo.status==='active'?'#cfe2ff':wo.status==='completed'?'#d4edda':'#f0ece5', color:wo.status==='active'?'#0a58ca':wo.status==='completed'?'#1a6b30':'#555', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{wo.status.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', justifyContent:'flex-end' }}>
                          <StatusBadge status={wo.approvalStatus||'draft'} />
                          <ApprovalActions item={{ status:wo.approvalStatus||'draft', rejectionNote:wo.approvalNote||'' }} onUpdate={(patch)=>updateWOApproval(wo.id,wo.subId,patch)} userRole={userRole} compact />
                          <button onClick={()=>setPrintWO(wo)} style={styles.iconBtn} title="Print"><Printer size={14}/></button>
                          {canEdit && wo.approvalStatus!=='submitted' && <button onClick={()=>setEditingWO(wo)} style={styles.iconBtn}><Pencil size={14}/></button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
    {/* ── Subcontractor WO Print Overlay ── */}
    {printWO && (()=>{
      const wo = printWO;
      const sub = subcontractors.find(s=>s.id===wo.subId);
      const proj = siteProjects.find(p=>p.id===wo.projectId);
      const woVal = parseFloat(wo.value||0);
      const tax = cc.hasTax ? calcModuleTax(woVal, wo.taxRate||0, cc, wo.placeOfSupply, sellerState) : null;
      const paid = (parseFloat(wo.advancePaid||0)+parseFloat(wo.progressPaid||0)+parseFloat(wo.retentionHeld||0)+parseFloat(wo.finalPaid||0));
      const bal = woVal - paid;
      return (
        <DocPrintOverlay onClose={()=>setPrintWO(null)} filename={`SubWO-${sub?.name||'WO'}.pdf`} businessInfo={businessInfo}>
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#1E2A4A', letterSpacing:1 }}>SUBCONTRACTOR WORK ORDER</div>
            <div style={{ fontSize:13, color:'#888', marginTop:4 }}>Issued by: {businessInfo?.name||'—'}</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 32px', fontSize:13, marginBottom:16 }}>
            {[['Subcontractor', sub?.name||'—'], ['Trade', sub?.trade||'—'], ['Project', proj?.name||'—'], ['Status', wo.status?.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())||'—'], ['Start Date', wo.startDate||'—'], ['End Date', wo.endDate||'—']].map(([l,v])=>(
              <div key={l} style={{ display:'flex', gap:8, borderBottom:'1px solid #f0ece5', padding:'5px 0' }}>
                <span style={{ color:'#888', minWidth:120 }}>{l}</span><span style={{ fontWeight:600, color:'#1E2A4A' }}>{v}</span>
              </div>
            ))}
          </div>
          {wo.scope && <div style={{ marginBottom:16, fontSize:13 }}><b>Scope of Work:</b><div style={{ color:'#555', marginTop:4, lineHeight:1.6, whiteSpace:'pre-wrap' }}>{wo.scope}</div></div>}
          {/* Value & Tax */}
          <div style={{ background:'#F8F7F4', borderRadius:8, padding:'12px 16px', marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:10, textTransform:'uppercase' }}>Contract Value</div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:4 }}>
              <span>Value (excl. tax)</span><span style={{ fontWeight:600 }}>{(cc.currency||'')+woVal.toLocaleString(undefined,{minimumFractionDigits:2})}</span>
            </div>
            {tax && tax.cgst>0 && <>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>CGST ({(wo.taxRate||0)/2}%)</span><span>{(cc.currency||'')+tax.cgst.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>SGST ({(wo.taxRate||0)/2}%)</span><span>{(cc.currency||'')+tax.sgst.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>
            </>}
            {tax && tax.igst>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>IGST ({wo.taxRate||0}%)</span><span>{(cc.currency||'')+tax.igst.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
            {tax && tax.vat>0 && <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#555', marginBottom:2 }}><span>{cc.taxLabel||'Tax'} ({wo.taxRate||0}%)</span><span>{(cc.currency||'')+tax.vat.toLocaleString(undefined,{minimumFractionDigits:2})}</span></div>}
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:15, fontWeight:700, color:'#1E2A4A', borderTop:'1px solid #ddd', paddingTop:6, marginTop:4 }}>
              <span>Total Contract Value</span><span>{(cc.currency||'')+(tax?tax.grandTotal:woVal).toLocaleString(undefined,{minimumFractionDigits:2})}</span>
            </div>
          </div>
          {/* Payment Tracker */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:8, textTransform:'uppercase' }}>Payment Tracker</div>
            <table style={{ width:'100%', fontSize:13, borderCollapse:'collapse' }}>
              {[['Advance Paid', wo.advancePaid||0],['Progress Payments', wo.progressPaid||0],['Retention Held', wo.retentionHeld||0],['Final Payment', wo.finalPaid||0]].map(([l,v])=>(
                <tr key={l} style={{ borderBottom:'1px solid #f0ece5' }}>
                  <td style={{ padding:'6px 0', color:'#555' }}>{l}</td>
                  <td style={{ padding:'6px 0', textAlign:'right', fontWeight:600 }}>{(cc.currency||'')+parseFloat(v).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                </tr>
              ))}
              <tr style={{ borderTop:'2px solid #1E2A4A' }}>
                <td style={{ padding:'8px 0', fontWeight:700, color:bal<0?'#B5453A':'#1a6b30' }}>Balance Due</td>
                <td style={{ padding:'8px 0', textAlign:'right', fontWeight:700, color:bal<0?'#B5453A':'#1a6b30' }}>{(cc.currency||'')+bal.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
              </tr>
            </table>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32, marginTop:40 }}>
            {['Subcontractor Signature','Authorised Signatory'].map(s=>(
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

// ─── HSE ──────────────────────────────────────────────────────────────────────

export function HSEView({ hseRecords, setHseRecords, siteProjects, userRole, businessInfo }) {
  const [tab, setTab] = useState('incidents');
  const [editing, setEditing] = useState(null);
  const [printPermit, setPrintPermit] = useState(null);
  const canEdit = ['admin','manager'].includes(userRole);

  const incidents    = hseRecords.incidents    || [];
  const toolboxTalks = hseRecords.toolboxTalks || [];
  const permits      = hseRecords.permits      || [];

  function updateSection(key, fn) {
    setHseRecords(prev=>({ ...prev, [key]: fn(prev[key]||[]) }));
  }

  const INCIDENT_TYPES = ['Near Miss','First Aid','Minor Injury','Major Injury','LTI','Property Damage','Environmental'];
  const PERMIT_TYPES   = ['Hot Work','Confined Space','Electrical Isolation','Working at Height','Excavation','General'];

  const TABS = [['incidents',`Incidents (${incidents.length})`],['toolbox',`Toolbox Talks (${toolboxTalks.length})`],['permits',`Permits to Work (${permits.length})`]];

  // Stats
  const lti    = incidents.filter(i=>i.type==='LTI').length;
  const open   = incidents.filter(i=>i.status!=='closed').length;
  const activeP = permits.filter(p=>p.status==='active').length;

  function blankIncident() { return { id:'', date:new Date().toISOString().slice(0,10), time:'', projectId:'', location:'', type:'Near Miss', description:'', injuredPerson:'', rootCause:'', correctiveAction:'', status:'open', reportedBy:'' }; }
  function blankTalk()     { return { id:'', date:new Date().toISOString().slice(0,10), projectId:'', topic:'', conductedBy:'', attendeesCount:0, notes:'' }; }
  function blankPermit()   { return { id:'', number:`PTW-${String(permits.length+1).padStart(3,'0')}`, date:new Date().toISOString().slice(0,10), projectId:'', type:'Hot Work', location:'', description:'', validFrom:'', validUntil:'', issuedBy:'', receiver:'', status:'active' }; }

  function saveRecord(section, key, rec) {
    const data = { ...rec, id:rec.id||crypto.randomUUID(), approvalStatus: rec.approvalStatus||'draft', approvalNote: rec.approvalNote||'', updatedAt:Date.now() };
    updateSection(section, prev=>prev.find(x=>x.id===data.id)?prev.map(x=>x.id===data.id?data:x):[...prev,data]);
    setEditing(null);
  }
  function updatePermitApproval(id, patch) {
    updateSection('permits', prev=>prev.map(x=>x.id===id?{...x,approvalStatus:patch.status,approvalNote:patch.rejectionNote||''}:x));
  }

  const INC_COLOR = { open:'#842029', investigating:'#856404', closed:'#1a6b30' };
  const INC_BG    = { open:'#f8d7da', investigating:'#fff3cd', closed:'#d4edda' };

  if (editing) {
    const { section, data } = editing;
    const set = (k,v) => setEditing(p=>({ ...p, data:{ ...p.data,[k]:v } }));
    const d = data;
    return (
      <div style={{ maxWidth:620, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{section==='incidents'?'Incident Report':section==='toolbox'?'Toolbox Talk':'Permit to Work'}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:12 }}>
          {section==='incidents' && (<>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div style={styles.formGroup}><label style={styles.label}>Date</label><input type='date' value={d.date||''} onChange={e=>set('date',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Time</label><input type='time' value={d.time||''} onChange={e=>set('time',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Type</label>
                <select value={d.type} onChange={e=>set('type',e.target.value)} style={styles.input}>
                  {INCIDENT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={styles.formGroup}><label style={styles.label}>Project</label>
                <select value={d.projectId||''} onChange={e=>set('projectId',e.target.value)} style={styles.input}>
                  <option value=''>Select project</option>
                  {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={styles.formGroup}><label style={styles.label}>Location</label><input value={d.location||''} onChange={e=>set('location',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Injured Person (if any)</label><input value={d.injuredPerson||''} onChange={e=>set('injuredPerson',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Reported By</label><input value={d.reportedBy||''} onChange={e=>set('reportedBy',e.target.value)} style={styles.input}/></div>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Description</label><textarea value={d.description||''} onChange={e=>set('description',e.target.value)} style={{ ...styles.input, height:72 }}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Root Cause</label><textarea value={d.rootCause||''} onChange={e=>set('rootCause',e.target.value)} style={{ ...styles.input, height:60 }}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Corrective Action</label><textarea value={d.correctiveAction||''} onChange={e=>set('correctiveAction',e.target.value)} style={{ ...styles.input, height:60 }}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Status</label>
              <select value={d.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
                {['open','investigating','closed'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
          </>)}
          {section==='toolbox' && (<>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={styles.formGroup}><label style={styles.label}>Date</label><input type='date' value={d.date||''} onChange={e=>set('date',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Project</label>
                <select value={d.projectId||''} onChange={e=>set('projectId',e.target.value)} style={styles.input}>
                  <option value=''>Select project</option>
                  {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Topic</label><input value={d.topic||''} onChange={e=>set('topic',e.target.value)} style={styles.input} placeholder='e.g. Fire Safety, PPE Usage, Electrical Hazards'/></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={styles.formGroup}><label style={styles.label}>Conducted By</label><input value={d.conductedBy||''} onChange={e=>set('conductedBy',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Attendees Count</label><input type='number' value={d.attendeesCount||0} onChange={e=>set('attendeesCount',e.target.value)} style={styles.input}/></div>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Notes</label><textarea value={d.notes||''} onChange={e=>set('notes',e.target.value)} style={{ ...styles.input, height:72 }}/></div>
          </>)}
          {section==='permits' && (<>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
              <div style={styles.formGroup}><label style={styles.label}>PTW No.</label><input value={d.number||''} onChange={e=>set('number',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Date</label><input type='date' value={d.date||''} onChange={e=>set('date',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Type</label>
                <select value={d.type} onChange={e=>set('type',e.target.value)} style={styles.input}>
                  {PERMIT_TYPES.map(t=><option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div style={styles.formGroup}><label style={styles.label}>Project</label>
                <select value={d.projectId||''} onChange={e=>set('projectId',e.target.value)} style={styles.input}>
                  <option value=''>Select project</option>
                  {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div style={styles.formGroup}><label style={styles.label}>Location</label><input value={d.location||''} onChange={e=>set('location',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Valid From</label><input type='date' value={d.validFrom||''} onChange={e=>set('validFrom',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Valid Until</label><input type='date' value={d.validUntil||''} onChange={e=>set('validUntil',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Issued By</label><input value={d.issuedBy||''} onChange={e=>set('issuedBy',e.target.value)} style={styles.input}/></div>
              <div style={styles.formGroup}><label style={styles.label}>Receiver</label><input value={d.receiver||''} onChange={e=>set('receiver',e.target.value)} style={styles.input}/></div>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Work Description</label><textarea value={d.description||''} onChange={e=>set('description',e.target.value)} style={{ ...styles.input, height:60 }}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Status</label>
              <select value={d.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
                {['active','suspended','closed'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
          </>)}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>saveRecord(section,section,d)} style={styles.primaryBtn}>Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 className="serif" style={styles.pageTitle}>HSE — Health, Safety & Environment</h2>
        {canEdit && <button onClick={()=>{
          if(tab==='incidents') setEditing({ section:'incidents', data:blankIncident() });
          else if(tab==='toolbox') setEditing({ section:'toolbox', data:blankTalk() });
          else setEditing({ section:'permits', data:blankPermit() });
        }} style={styles.primaryBtn}><Plus size={15}/> New {tab==='incidents'?'Incident':tab==='toolbox'?'Talk':'Permit'}</button>}
      </div>
      {/* KPIs */}
      <div style={{ display:'flex', gap:12, marginBottom:20 }}>
        {[['Total Incidents',incidents.length,''],['LTI',lti,'#B5453A'],['Open',open,'#856404'],['Active Permits',activeP,'#0a58ca'],['Toolbox Talks',toolboxTalks.length,'#1a6b30']].map(([l,v,c])=>(
          <div key={l} style={{ background:'#fff', border:`1px solid ${c?'#EAE6DB':'#EAE6DB'}`, borderRadius:8, padding:'10px 16px' }}>
            <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:700, color:c||'#1E2A4A' }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', gap:8, marginBottom:16 }}>
        {TABS.map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{ ...styles.ghostBtn, background:tab===k?'#1E2A4A':'transparent', color:tab===k?'#fff':'#555', fontSize:12 }}>{l}</button>)}
      </div>
      {tab==='incidents' && (
        incidents.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No incidents recorded.</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {[...incidents].sort((a,b)=>b.date>a.date?1:-1).map(inc=>{
              const proj = siteProjects.find(p=>p.id===inc.projectId);
              return (
                <div key={inc.id} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:8, padding:'12px 16px', display:'flex', gap:12, alignItems:'flex-start' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontWeight:700, color:'#1E2A4A' }}>{inc.type}</span>
                      <span style={{ background:INC_BG[inc.status]||'#f0ece5', color:INC_COLOR[inc.status]||'#555', borderRadius:5, padding:'1px 8px', fontSize:11, fontWeight:700 }}>{(inc.status||'').toUpperCase()}</span>
                      {proj && <span style={{ fontSize:11, color:'#888' }}>{proj.name}</span>}
                    </div>
                    <div style={{ fontSize:13, color:'#333' }}>{inc.description||'—'}</div>
                    <div style={{ fontSize:11, color:'#888', marginTop:3 }}>{inc.date} {inc.time||''} · {inc.location||''} · Reported by {inc.reportedBy||'—'}</div>
                  </div>
                  {canEdit && <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>setEditing({ section:'incidents', data:inc })} style={styles.iconBtn}><Pencil size={14}/></button>
                    <button onClick={()=>{if(window.confirm('Delete?'))updateSection('incidents',prev=>prev.filter(x=>x.id!==inc.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button>
                  </div>}
                </div>
              );
            })}
          </div>
        )
      )}
      {tab==='toolbox' && (
        toolboxTalks.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No toolbox talks recorded.</div> : (
          <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#F8F7F4' }}>
                {['Date','Topic','Project','Conducted By','Attendees',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[...toolboxTalks].sort((a,b)=>b.date>a.date?1:-1).map(tk=>{
                  const proj = siteProjects.find(p=>p.id===tk.projectId);
                  return (
                    <tr key={tk.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                      <td style={{ padding:'10px 12px' }}>{tk.date}</td>
                      <td style={{ padding:'10px 12px', fontWeight:600 }}>{tk.topic||'—'}</td>
                      <td style={{ padding:'10px 12px', color:'#555' }}>{proj?.name||'—'}</td>
                      <td style={{ padding:'10px 12px', color:'#555' }}>{tk.conductedBy||'—'}</td>
                      <td style={{ padding:'10px 12px', color:'#555' }}>{tk.attendeesCount||0}</td>
                      <td style={{ padding:'10px 12px' }}>{canEdit && <div style={{ display:'flex', gap:6 }}>
                        <button onClick={()=>setEditing({ section:'toolbox', data:tk })} style={styles.iconBtn}><Pencil size={14}/></button>
                        <button onClick={()=>{if(window.confirm('Delete?'))updateSection('toolboxTalks',prev=>prev.filter(x=>x.id!==tk.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button>
                      </div>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
      {tab==='permits' && (
        permits.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No permits issued.</div> : (
          <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead><tr style={{ background:'#F8F7F4' }}>
                {['PTW No.','Type','Project','Location','Valid Until','Issued By','Status',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {[...permits].sort((a,b)=>b.date>a.date?1:-1).map(pt=>{
                  const proj = siteProjects.find(p=>p.id===pt.projectId);
                  const expired = pt.validUntil && pt.validUntil < new Date().toISOString().slice(0,10);
                  return (
                    <tr key={pt.id} style={{ borderBottom:'1px solid #F0ECE5', background:expired&&pt.status==='active'?'#fff8f7':'#fff' }}>
                      <td style={{ padding:'10px 12px', fontWeight:600 }}>{pt.number}</td>
                      <td style={{ padding:'10px 12px', color:'#333' }}>{pt.type}</td>
                      <td style={{ padding:'10px 12px', color:'#555' }}>{proj?.name||'—'}</td>
                      <td style={{ padding:'10px 12px', color:'#555' }}>{pt.location||'—'}</td>
                      <td style={{ padding:'10px 12px', color:expired?'#B5453A':'#555', fontWeight:expired?700:400 }}>{pt.validUntil||'—'}{expired?' ⚠':''}</td>
                      <td style={{ padding:'10px 12px', color:'#555' }}>{pt.issuedBy||'—'}</td>
                      <td style={{ padding:'10px 12px' }}><span style={{ background:pt.status==='active'?'#d4edda':pt.status==='suspended'?'#fff3cd':'#f0ece5', color:pt.status==='active'?'#1a6b30':pt.status==='suspended'?'#856404':'#555', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{pt.status.toUpperCase()}</span></td>
                      <td style={{ padding:'10px 12px' }}>
                        <div style={{ display:'flex', gap:6 }}>
                          <StatusBadge status={pt.approvalStatus||'draft'} />
                          <ApprovalActions item={{ status:pt.approvalStatus||'draft', rejectionNote:pt.approvalNote||'' }} onUpdate={(patch)=>updatePermitApproval(pt.id,patch)} userRole={userRole} compact />
                          <button onClick={()=>setPrintPermit(pt)} style={styles.iconBtn} title="Print PTW"><Printer size={14}/></button>
                          {canEdit && pt.approvalStatus!=='submitted' && <><button onClick={()=>setEditing({ section:'permits', data:pt })} style={styles.iconBtn}><Pencil size={14}/></button>
                          <button onClick={()=>{if(window.confirm('Delete?'))updateSection('permits',prev=>prev.filter(x=>x.id!==pt.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button></>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
    {/* ── HSE Permit to Work Print Overlay ── */}
    {printPermit && (()=>{
      const pt = printPermit;
      const proj = siteProjects.find(p=>p.id===pt.projectId);
      const expired = pt.validUntil && pt.validUntil < new Date().toISOString().slice(0,10);
      return (
        <DocPrintOverlay onClose={()=>setPrintPermit(null)} filename={`PTW-${pt.number}.pdf`} businessInfo={businessInfo}>
          {/* Title Banner */}
          <div style={{ background:'#1E2A4A', color:'#fff', borderRadius:8, padding:'16px 24px', marginBottom:20, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:20, fontWeight:700, letterSpacing:1 }}>PERMIT TO WORK</div>
              <div style={{ fontSize:13, opacity:0.8, marginTop:3 }}>{pt.type}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:18, fontWeight:700 }}>{pt.number}</div>
              <div style={{ fontSize:12, opacity:0.8, marginTop:3 }}>
                <span style={{ background:pt.status==='active'?'#22c55e':'#ef4444', borderRadius:4, padding:'2px 8px', fontWeight:700 }}>{pt.status?.toUpperCase()}</span>
              </div>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 32px', fontSize:13, marginBottom:16 }}>
            {[['Project', proj?.name||'—'], ['Location', pt.location||'—'], ['Issue Date', pt.date||'—'], ['Valid From', pt.validFrom||'—'], ['Valid Until', pt.validUntil||(expired?'EXPIRED':'—')], ['Issued By', pt.issuedBy||'—'], ['Work Receiver', pt.receiver||'—']].map(([l,v])=>(
              <div key={l} style={{ display:'flex', gap:8, borderBottom:'1px solid #f0ece5', padding:'5px 0' }}>
                <span style={{ color:'#888', minWidth:120 }}>{l}</span>
                <span style={{ fontWeight:600, color:l==='Valid Until'&&expired?'#B5453A':'#1E2A4A' }}>{v}</span>
              </div>
            ))}
          </div>
          {pt.description && <div style={{ marginBottom:16, fontSize:13 }}><b>Work Description:</b><div style={{ color:'#555', marginTop:4, lineHeight:1.6, border:'1px solid #eee', borderRadius:6, padding:'10px 14px' }}>{pt.description}</div></div>}
          {/* Safety Checklist */}
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:10, textTransform:'uppercase' }}>Safety Precautions Checklist</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              {['Fire extinguisher available at work site','Area barricaded / cordoned off','All energised equipment de-energised & locked out','PPE — Helmet, Gloves, Safety Shoes, Harness (as applicable)','Emergency contact numbers displayed','First aid kit available','Hot work permit (if applicable) obtained','Gas test / atmosphere check carried out'].map((item,i)=>(
                <tr key={i} style={{ borderBottom:'1px solid #f0ece5' }}>
                  <td style={{ padding:'6px 10px', width:24, textAlign:'center', fontSize:14 }}>☐</td>
                  <td style={{ padding:'6px 10px' }}>{item}</td>
                  <td style={{ padding:'6px 10px', width:80, textAlign:'center', color:'#888', fontSize:11 }}>Initials</td>
                </tr>
              ))}
            </table>
          </div>
          {/* Signature Block */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:20, marginTop:32 }}>
            {['Issuing Authority','Work Receiver','Safety Officer'].map(s=>(
              <div key={s} style={{ borderTop:'1px solid #555', paddingTop:8 }}>
                <div style={{ fontSize:11, color:'#555', textAlign:'center', marginBottom:16 }}>{s}</div>
                <div style={{ borderBottom:'1px solid #aaa', marginBottom:4, height:36 }}></div>
                <div style={{ fontSize:10, color:'#aaa', textAlign:'center' }}>Signature & Date</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:20, fontSize:11, color:'#888', textAlign:'center', borderTop:'1px solid #eee', paddingTop:12 }}>
            This permit is valid only for the date and scope stated above. Any deviation requires fresh permit issuance.
          </div>
        </DocPrintOverlay>
      );
    })()}
    </>
  );
}

// ─── RA Billing ───────────────────────────────────────────────────────────────

export function RABillingView({ raBillings, setRaBillings, siteProjects, customers, tenders, userRole, businessInfo }) {
  const [editing, setEditing] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);
  const canEdit = ['admin','manager','accounts'].includes(userRole);
  const country = businessInfo?.country || 'other';
  const cc = COUNTRY_CONFIG[country] || COUNTRY_CONFIG.other;
  const sellerState = businessInfo?.state || '';

  function blank() {
    return { id:'', billNumber:`RAB-${String(raBillings.length+1).padStart(3,'0')}`, projectId:'', customerId:'', tenderId:'', periodFrom:'', periodTo:'', date:new Date().toISOString().slice(0,10), items:[], taxRate:cc.defaultTaxRate||0, placeOfSupply:'', status:'draft', notes:'' };
  }
  function blankItem() { return { id:crypto.randomUUID(), description:'', contractValue:0, previousQty:0, thisQty:0, unit:'%' }; }
  function itemAmount(item, tender) {
    if(!item) return 0;
    const cv = parseFloat(item.contractValue)||0;
    const prev = parseFloat(item.previousQty)||0;
    const curr = parseFloat(item.thisQty)||0;
    return cv * (curr - prev) / 100;
  }
  function billTotal(bill) { return (bill.items||[]).reduce((s,i)=>s+itemAmount(i),0); }
  function save(bill) {
    const rec = { ...bill, id:bill.id||crypto.randomUUID(), approvalStatus:bill.approvalStatus||'draft', approvalNote:bill.approvalNote||'', updatedAt:Date.now() };
    setRaBillings(prev=>prev.find(x=>x.id===rec.id)?prev.map(x=>x.id===rec.id?rec:x):[...prev,rec]);
    setEditing(null);
  }
  function updateApproval(id, patch) {
    setRaBillings(prev=>prev.map(x=>x.id===id?{...x,approvalStatus:patch.status,approvalNote:patch.rejectionNote||''}:x));
  }

  if (editing) {
    const b = editing;
    const set = (k,v)=>setEditing(p=>({...p,[k]:v}));
    const subtotal = billTotal(b);
    return (
      <div style={{ maxWidth:800, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{b.id?'Edit':'New'} RA Bill — {b.billNumber}</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Bill No.</label><input value={b.billNumber} onChange={e=>set('billNumber',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Bill Date</label><input type='date' value={b.date} onChange={e=>set('date',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Status</label>
              <select value={b.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
                {['draft','submitted','approved','paid','rejected'].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Project</label>
              <select value={b.projectId||''} onChange={e=>set('projectId',e.target.value)} style={styles.input}>
                <option value=''>Select project</option>
                {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Client</label>
              <select value={b.customerId||''} onChange={e=>set('customerId',e.target.value)} style={styles.input}>
                <option value=''>Select client</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Period From</label><input type='date' value={b.periodFrom||''} onChange={e=>set('periodFrom',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Period To</label><input type='date' value={b.periodTo||''} onChange={e=>set('periodTo',e.target.value)} style={styles.input}/></div>
          </div>
          {/* BOQ Progress Items */}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:8, textTransform:'uppercase' }}>Progress Claim Items</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:'#F8F7F4' }}>
                {['Description','Contract Value','Prev %','This Bill %','Amount',''].map(h=><th key={h} style={{ padding:'6px 8px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {(b.items||[]).map((item,i)=>(
                  <tr key={item.id}>
                    <td style={{ padding:'4px 4px' }}><input value={item.description} onChange={e=>set('items',b.items.map((x,j)=>j===i?{...x,description:e.target.value}:x))} style={{ ...styles.input, margin:0, width:'100%' }}/></td>
                    <td style={{ padding:'4px 4px', width:110 }}><input type='number' value={item.contractValue} onChange={e=>set('items',b.items.map((x,j)=>j===i?{...x,contractValue:e.target.value}:x))} style={{ ...styles.input, margin:0 }}/></td>
                    <td style={{ padding:'4px 4px', width:80 }}><input type='number' min={0} max={100} value={item.previousQty} onChange={e=>set('items',b.items.map((x,j)=>j===i?{...x,previousQty:e.target.value}:x))} style={{ ...styles.input, margin:0 }}/></td>
                    <td style={{ padding:'4px 4px', width:80 }}><input type='number' min={0} max={100} value={item.thisQty} onChange={e=>set('items',b.items.map((x,j)=>j===i?{...x,thisQty:e.target.value}:x))} style={{ ...styles.input, margin:0 }}/></td>
                    <td style={{ padding:'4px 8px', fontWeight:600, width:100 }}>{itemAmount(item).toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                    <td style={{ padding:'4px 4px', width:30 }}><button onClick={()=>set('items',b.items.filter((_,j)=>j!==i))} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={13}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:8 }}>
              <button onClick={()=>set('items',[...(b.items||[]),blankItem()])} style={styles.ghostBtn}><Plus size={13}/> Add Item</button>
              {!cc.hasTax && <div style={{ fontWeight:700, fontSize:15, color:'#1E2A4A' }}>This Bill: {subtotal.toLocaleString(undefined,{maximumFractionDigits:0})}</div>}
            </div>
            {cc.hasTax && (
              <TaxSummaryBox
                subtotal={subtotal} taxRate={b.taxRate} cc={cc}
                placeOfSupply={b.placeOfSupply} sellerState={sellerState}
                onChangeTax={v=>set('taxRate',v)} onChangePOS={v=>set('placeOfSupply',v)}
              />
            )}
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Notes</label><textarea value={b.notes||''} onChange={e=>set('notes',e.target.value)} style={{ ...styles.input, height:56 }}/></div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>save(b)} style={styles.primaryBtn}>Save RA Bill</button>
          </div>
        </div>
      </div>
    );
  }

  const ST_COLOR = { draft:'#555', submitted:'#0a58ca', approved:'#1a6b30', paid:'#C9A24B', rejected:'#842029' };
  const ST_BG    = { draft:'#f0ece5', submitted:'#cfe2ff', approved:'#d4edda', paid:'#FFF8E7', rejected:'#f8d7da' };
  const list = [...raBillings].sort((a,b)=>b.date>a.date?1:-1);
  function billGrandTotal(b) {
    const sub = billTotal(b);
    return cc.hasTax ? calcModuleTax(sub, b.taxRate||0, cc, b.placeOfSupply, sellerState).grandTotal : sub;
  }
  const totalBilled = list.reduce((s,b)=>s+billGrandTotal(b),0);
  return (
    <>
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <h2 className="serif" style={styles.pageTitle}>RA Billing — Running Account</h2>
        {canEdit && <button onClick={()=>setEditing(blank())} style={styles.primaryBtn}><Plus size={15}/> New RA Bill</button>}
      </div>
      <div style={{ display:'flex', gap:16, marginBottom:20 }}>
        {[['Total Bills',list.length],['Total Billed',(cc.currency||'')+totalBilled.toLocaleString(undefined,{maximumFractionDigits:0})],['Approved',list.filter(b=>b.status==='approved').length],['Paid',list.filter(b=>b.status==='paid').length]].map(([l,v])=>(
          <div key={l} style={{ background:'#fff', border:'1px solid #EAE6DB', borderRadius:8, padding:'12px 18px' }}>
            <div style={{ fontSize:11, color:'#888', fontWeight:600, textTransform:'uppercase' }}>{l}</div>
            <div style={{ fontSize:22, fontWeight:700, color:'#1E2A4A' }}>{v}</div>
          </div>
        ))}
      </div>
      {list.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No RA bills raised yet.</div> : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4' }}>
              {['Bill No.','Date','Project','Client','Period','Subtotal',cc.hasTax?'Grand Total (incl. tax)':'','Status',''].filter(h=>h!=='').map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(b=>{
                const proj = siteProjects.find(p=>p.id===b.projectId);
                const client = customers.find(c=>c.id===b.customerId);
                const sub = billTotal(b);
                const grand = billGrandTotal(b);
                return (
                  <tr key={b.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{b.billNumber}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{b.date}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{proj?.name||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{client?.name||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555', fontSize:11 }}>{b.periodFrom||'—'} → {b.periodTo||'—'}</td>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{(cc.currency||'')+sub.toLocaleString(undefined,{maximumFractionDigits:0})}</td>
                    {cc.hasTax && <td style={{ padding:'10px 12px', fontWeight:700, color:'#1E2A4A' }}>{(cc.currency||'')+grand.toLocaleString(undefined,{maximumFractionDigits:0})}</td>}
                    <td style={{ padding:'10px 12px' }}><span style={{ background:ST_BG[b.status], color:ST_COLOR[b.status], borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{b.status.toUpperCase()}</span></td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:6 }}>
                        <StatusBadge status={b.approvalStatus||'draft'} />
                        <ApprovalActions item={{ status:b.approvalStatus||'draft', rejectionNote:b.approvalNote||'' }} onUpdate={(patch)=>updateApproval(b.id,patch)} userRole={userRole} compact />
                        <button onClick={()=>setPrintDoc(b)} style={styles.iconBtn} title="Print"><Printer size={14}/></button>
                        {canEdit && b.approvalStatus!=='submitted' && <><button onClick={()=>setEditing(b)} style={styles.iconBtn}><Pencil size={14}/></button>
                        <button onClick={()=>{if(window.confirm('Delete?'))setRaBillings(prev=>prev.filter(x=>x.id!==b.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button></>}
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
    {/* ── RA Bill Print Overlay ── */}
    {printDoc && (()=>{
      const b = printDoc;
      const proj = siteProjects.find(p=>p.id===b.projectId);
      const client = customers.find(c=>c.id===b.customerId);
      const sub = billTotal(b);
      const tax = cc.hasTax ? calcModuleTax(sub, b.taxRate||0, cc, b.placeOfSupply, sellerState) : null;
      return (
        <DocPrintOverlay onClose={()=>setPrintDoc(null)} filename={`RA-Bill-${b.billNumber}.pdf`} businessInfo={businessInfo}>
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#1E2A4A', letterSpacing:1 }}>RUNNING ACCOUNT BILL</div>
            <div style={{ fontSize:13, color:'#888', marginTop:4 }}>{b.billNumber} &nbsp;|&nbsp; {b.status?.toUpperCase()}</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 32px', fontSize:13, marginBottom:20 }}>
            {[['Client', client?.name||'—'], ['Project', proj?.name||'—'], ['Bill Date', b.date||'—'], ['Period', (b.periodFrom||'—')+' → '+(b.periodTo||'—')]].map(([l,v])=>(
              <div key={l} style={{ display:'flex', gap:8, borderBottom:'1px solid #f0ece5', padding:'5px 0' }}>
                <span style={{ color:'#888', minWidth:100 }}>{l}</span><span style={{ fontWeight:600, color:'#1E2A4A' }}>{v}</span>
              </div>
            ))}
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13, marginBottom:16 }}>
            <thead><tr style={{ background:'#1E2A4A', color:'#fff' }}>
              {['#','Description','Contract Value','Prev %','This Bill %','Amount'].map(h=><th key={h} style={{ padding:'8px 10px', textAlign:h==='#'||h==='Prev %'||h==='This Bill %'||h==='Amount'||h==='Contract Value'?'right':'left', fontSize:11, fontWeight:700 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {(b.items||[]).map((item,i)=>(
                <tr key={item.id} style={{ background:i%2===0?'#fff':'#F8F7F4', borderBottom:'1px solid #eee' }}>
                  <td style={{ padding:'7px 10px', textAlign:'right', color:'#888' }}>{i+1}</td>
                  <td style={{ padding:'7px 10px' }}>{item.description||'—'}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right' }}>{(cc.currency||'')+parseFloat(item.contractValue||0).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                  <td style={{ padding:'7px 10px', textAlign:'right' }}>{parseFloat(item.previousQty||0)}%</td>
                  <td style={{ padding:'7px 10px', textAlign:'right' }}>{parseFloat(item.thisQty||0)}%</td>
                  <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:600 }}>{(cc.currency||'')+itemAmount(item).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop:'2px solid #1E2A4A' }}>
                <td colSpan={5} style={{ padding:'8px 10px', textAlign:'right', fontWeight:700 }}>This Bill Subtotal</td>
                <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700 }}>{(cc.currency||'')+sub.toLocaleString(undefined,{minimumFractionDigits:2})}</td>
              </tr>
              {tax && tax.cgst>0 && <>
                <tr><td colSpan={5} style={{ padding:'4px 10px', textAlign:'right', color:'#555' }}>CGST ({(b.taxRate||0)/2}%)</td><td style={{ padding:'4px 10px', textAlign:'right' }}>{(cc.currency||'')+tax.cgst.toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>
                <tr><td colSpan={5} style={{ padding:'4px 10px', textAlign:'right', color:'#555' }}>SGST ({(b.taxRate||0)/2}%)</td><td style={{ padding:'4px 10px', textAlign:'right' }}>{(cc.currency||'')+tax.sgst.toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>
              </>}
              {tax && tax.igst>0 && <tr><td colSpan={5} style={{ padding:'4px 10px', textAlign:'right', color:'#555' }}>IGST ({b.taxRate||0}%)</td><td style={{ padding:'4px 10px', textAlign:'right' }}>{(cc.currency||'')+tax.igst.toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>}
              {tax && tax.vat>0 && <tr><td colSpan={5} style={{ padding:'4px 10px', textAlign:'right', color:'#555' }}>{cc.taxLabel||'Tax'} ({b.taxRate||0}%)</td><td style={{ padding:'4px 10px', textAlign:'right' }}>{(cc.currency||'')+tax.vat.toLocaleString(undefined,{minimumFractionDigits:2})}</td></tr>}
              <tr style={{ background:'#1E2A4A', color:'#fff' }}>
                <td colSpan={5} style={{ padding:'10px', textAlign:'right', fontWeight:700, fontSize:14 }}>{tax?'Grand Total':'Total'}</td>
                <td style={{ padding:'10px', textAlign:'right', fontWeight:700, fontSize:14 }}>{(cc.currency||'')+(tax?tax.grandTotal:sub).toLocaleString(undefined,{minimumFractionDigits:2})}</td>
              </tr>
            </tfoot>
          </table>
          {b.notes && <div style={{ fontSize:12, color:'#555', borderTop:'1px solid #eee', paddingTop:10 }}><b>Notes:</b> {b.notes}</div>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32, marginTop:48 }}>
            {['Contractor Signature','Client / Engineer Signature'].map(s=>(
              <div key={s} style={{ borderTop:'1px solid #555', paddingTop:8, fontSize:12, color:'#555', textAlign:'center' }}>{s}</div>
            ))}
          </div>
        </DocPrintOverlay>
      );
    })()}
    </>
  );
}

// ─── Testing & Commissioning ──────────────────────────────────────────────────

export function TCPrint({ checklist, project, businessInfo, onClose }) {
  const useLH = !!(businessInfo?.letterhead||businessInfo?.letterheadHtml);
  const tests = checklist.tests || [];
  const punch = checklist.punchList || [];
  const fails = tests.filter(t => t.result === 'fail').length;
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
        <div style={{textAlign:'center',fontSize:15,fontWeight:700,letterSpacing:1,borderTop:'2px solid #1E2A4A',borderBottom:'2px solid #1E2A4A',padding:'6px 0',marginBottom:16}}>TESTING & COMMISSIONING CHECKLIST</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 24px',marginBottom:16,padding:'12px 16px',background:'#F8F6F2',borderRadius:8}}>
          <div><strong>Project:</strong> {project?.name || '—'}</div>
          <div><strong>System:</strong> {checklist.system}</div>
          <div><strong>Date:</strong> {checklist.date}</div>
          <div><strong>Status:</strong> {(checklist.status||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</div>
          <div><strong>Prepared By:</strong> {checklist.preparedBy || '—'}</div>
          <div><strong>Witnessed By:</strong> {checklist.witnessedBy || '—'}</div>
        </div>
        {tests.length > 0 && (
          <>
            <div style={{fontWeight:700,marginBottom:8,color:'#1E2A4A'}}>Test Records {fails > 0 && <span style={{color:'#B5453A',fontWeight:400}}>({fails} failure{fails>1?'s':''})</span>}</div>
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:16,fontSize:11}}>
              <thead>
                <tr style={{background:'#1E2A4A',color:'#fff'}}>
                  {['#','Test Type','Equipment / Circuit','Location','Standard','Result','Remarks'].map(h => (
                    <th key={h} style={{padding:'6px 8px',textAlign:'left'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tests.map((t, i) => (
                  <tr key={i} style={{borderBottom:'1px solid #EEE',background:t.result==='fail'?'#FFF8F7':i%2===0?'#fff':'#F9F8F5'}}>
                    <td style={{padding:'5px 8px'}}>{i+1}</td>
                    <td style={{padding:'5px 8px'}}>{t.testType}</td>
                    <td style={{padding:'5px 8px'}}>{t.equipment}</td>
                    <td style={{padding:'5px 8px'}}>{t.location}</td>
                    <td style={{padding:'5px 8px'}}>{t.standard}</td>
                    <td style={{padding:'5px 8px',fontWeight:700,color:t.result==='pass'?'#1a6b30':t.result==='fail'?'#842029':'#555'}}>{(t.result||'').toUpperCase()}</td>
                    <td style={{padding:'5px 8px'}}>{t.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {punch.length > 0 && (
          <>
            <div style={{fontWeight:700,marginBottom:8,color:'#1E2A4A'}}>Punch List</div>
            <table style={{width:'100%',borderCollapse:'collapse',marginBottom:16,fontSize:11}}>
              <thead>
                <tr style={{background:'#555',color:'#fff'}}>
                  {['#','Description','Location','Raised By','Raised Date','Closed Date','Status'].map(h => (
                    <th key={h} style={{padding:'6px 8px',textAlign:'left'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {punch.map((p, i) => (
                  <tr key={i} style={{borderBottom:'1px solid #EEE',background:p.status==='open'?'#FFF8F7':i%2===0?'#fff':'#F9F8F5'}}>
                    <td style={{padding:'5px 8px'}}>{i+1}</td>
                    <td style={{padding:'5px 8px'}}>{p.description}</td>
                    <td style={{padding:'5px 8px'}}>{p.location}</td>
                    <td style={{padding:'5px 8px'}}>{p.raisedBy}</td>
                    <td style={{padding:'5px 8px'}}>{p.raisedDate}</td>
                    <td style={{padding:'5px 8px'}}>{p.closedDate || '—'}</td>
                    <td style={{padding:'5px 8px',fontWeight:600,color:p.status==='open'?'#842029':'#1a6b30'}}>{(p.status||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <div style={{display:'flex',justifyContent:'space-between',marginTop:40,paddingTop:16,borderTop:'1px solid #CCC'}}>
          <div style={{textAlign:'center',minWidth:140}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Prepared By<br/><strong>{checklist.preparedBy || ''}</strong></div></div>
          <div style={{textAlign:'center',minWidth:140}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Client / Witness<br/><strong>{checklist.witnessedBy || ''}</strong></div></div>
          <div style={{textAlign:'center',minWidth:140}}><div style={{borderTop:'1px solid #333',paddingTop:4,fontSize:11}}>Authorised Signatory</div></div>
        </div>
        {useLH && businessInfo?.letterheadFooter && <img src={businessInfo.letterheadFooter} alt="footer" style={{width:'100%',display:'block',marginTop:16}} />}
      </div>
    </div>
  );
}


export function TCView({ tcChecklists, setTcChecklists, siteProjects, userRole, businessInfo }) {
  const [editing, setEditing] = useState(null);
  const [viewId, setViewId] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);
  const canEdit = ['admin','manager'].includes(userRole);

  const SYSTEMS = ['Electrical LV','Electrical MV','Plumbing','HVAC','Fire Fighting','Fire Alarm','BMS','Earthing','Lighting','CCTV','Access Control','Lifts','Other'];
  const TEST_TYPES = ['Insulation Resistance','Earth Continuity','Polarity Check','Functional Test','Load Test','Pressure Test','Flow Test','Commission & Start-up','Witnessed Test','Other'];

  function blank() {
    return { id:'', projectId:'', system:'Electrical LV', date:new Date().toISOString().slice(0,10), tests:[], punchList:[], status:'open', preparedBy:'', witnessedBy:'' };
  }
  function blankTest()  { return { id:crypto.randomUUID(), testType:'Functional Test', equipment:'', location:'', standard:'', result:'pass', remarks:'' }; }
  function blankPunch() { return { id:crypto.randomUUID(), description:'', location:'', raisedBy:'', raisedDate:new Date().toISOString().slice(0,10), closedDate:'', status:'open' }; }
  function save(rec) {
    const data = { ...rec, id:rec.id||crypto.randomUUID(), approvalStatus:rec.approvalStatus||'draft', approvalNote:rec.approvalNote||'', updatedAt:Date.now() };
    setTcChecklists(prev=>prev.find(x=>x.id===data.id)?prev.map(x=>x.id===data.id?data:x):[...prev,data]);
    setEditing(null); setViewId(null);
  }
  function updateApproval(id, patch) {
    setTcChecklists(prev=>prev.map(x=>x.id===id?{...x,approvalStatus:patch.status,approvalNote:patch.rejectionNote||''}:x));
  }

  if (editing) {
    const r = editing;
    const set = (k,v)=>setEditing(p=>({...p,[k]:v}));
    const fails = (r.tests||[]).filter(t=>t.result==='fail').length;
    return (
      <div style={{ maxWidth:780, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{r.id?'Edit':'New'} T&C Checklist</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Project</label>
              <select value={r.projectId||''} onChange={e=>set('projectId',e.target.value)} style={styles.input}>
                <option value=''>Select project</option>
                {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>System</label>
              <select value={r.system} onChange={e=>set('system',e.target.value)} style={styles.input}>
                {SYSTEMS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Date</label><input type='date' value={r.date} onChange={e=>set('date',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Prepared By</label><input value={r.preparedBy||''} onChange={e=>set('preparedBy',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Witnessed By (Client)</label><input value={r.witnessedBy||''} onChange={e=>set('witnessedBy',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Status</label>
              <select value={r.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
                {['open','in_progress','completed','signed_off'].map(s=><option key={s} value={s}>{s.replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </div>
          </div>
          {/* Test Records */}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:8, textTransform:'uppercase' }}>Test Records {fails>0&&<span style={{ color:'#B5453A' }}>({fails} fail{fails>1?'s':''})</span>}</div>
            {(r.tests||[]).map((t,i)=>(
              <div key={t.id} style={{ background:t.result==='fail'?'#FFF8F7':'#F8F7F4', border:`1px solid ${t.result==='fail'?'#FBEAE7':'#EAE6DB'}`, borderRadius:8, padding:12, marginBottom:8 }}>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 80px 1fr 24px', gap:8, alignItems:'center' }}>
                  <select value={t.testType} onChange={e=>set('tests',r.tests.map((x,j)=>j===i?{...x,testType:e.target.value}:x))} style={{ ...styles.input, margin:0, fontSize:12 }}>
                    {TEST_TYPES.map(ty=><option key={ty} value={ty}>{ty}</option>)}
                  </select>
                  <input value={t.equipment} onChange={e=>set('tests',r.tests.map((x,j)=>j===i?{...x,equipment:e.target.value}:x))} style={{ ...styles.input, margin:0, fontSize:12 }} placeholder='Equipment/Circuit'/>
                  <input value={t.location} onChange={e=>set('tests',r.tests.map((x,j)=>j===i?{...x,location:e.target.value}:x))} style={{ ...styles.input, margin:0, fontSize:12 }} placeholder='Location'/>
                  <select value={t.result} onChange={e=>set('tests',r.tests.map((x,j)=>j===i?{...x,result:e.target.value}:x))} style={{ ...styles.input, margin:0, fontSize:12, background:t.result==='pass'?'#d4edda':t.result==='fail'?'#f8d7da':'#fff', fontWeight:700, color:t.result==='pass'?'#1a6b30':t.result==='fail'?'#842029':'#555' }}>
                    <option value='pass'>Pass</option><option value='fail'>Fail</option><option value='na'>N/A</option>
                  </select>
                  <input value={t.remarks} onChange={e=>set('tests',r.tests.map((x,j)=>j===i?{...x,remarks:e.target.value}:x))} style={{ ...styles.input, margin:0, fontSize:12 }} placeholder='Remarks'/>
                  <button onClick={()=>set('tests',r.tests.filter((_,j)=>j!==i))} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={13}/></button>
                </div>
              </div>
            ))}
            <button onClick={()=>set('tests',[...(r.tests||[]),blankTest()])} style={styles.ghostBtn}><Plus size={13}/> Add Test</button>
          </div>
          {/* Punch List */}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:8, textTransform:'uppercase' }}>Punch List</div>
            {(r.punchList||[]).map((p,i)=>(
              <div key={p.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, background:'#F8F7F4', borderRadius:6, padding:'6px 8px' }}>
                <input value={p.description} onChange={e=>set('punchList',r.punchList.map((x,j)=>j===i?{...x,description:e.target.value}:x))} style={{ ...styles.input, margin:0, flex:2, fontSize:12 }} placeholder='Punch item description'/>
                <input value={p.location} onChange={e=>set('punchList',r.punchList.map((x,j)=>j===i?{...x,location:e.target.value}:x))} style={{ ...styles.input, margin:0, flex:1, fontSize:12 }} placeholder='Location'/>
                <select value={p.status} onChange={e=>set('punchList',r.punchList.map((x,j)=>j===i?{...x,status:e.target.value}:x))} style={{ ...styles.input, margin:0, width:90, fontSize:12 }}>
                  <option value='open'>Open</option><option value='closed'>Closed</option>
                </select>
                <button onClick={()=>set('punchList',r.punchList.filter((_,j)=>j!==i))} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={13}/></button>
              </div>
            ))}
            <button onClick={()=>set('punchList',[...(r.punchList||[]),blankPunch()])} style={styles.ghostBtn}><Plus size={13}/> Add Punch Item</button>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>save(r)} style={styles.primaryBtn}>Save Checklist</button>
          </div>
        </div>
      </div>
    );
  }

  const list = [...tcChecklists].sort((a,b)=>b.date>a.date?1:-1);
  const ST_COLOR = { open:'#555', in_progress:'#0a58ca', completed:'#856404', signed_off:'#1a6b30' };
  const ST_BG    = { open:'#f0ece5', in_progress:'#cfe2ff', completed:'#fff3cd', signed_off:'#d4edda' };
  return (
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 className="serif" style={styles.pageTitle}>Testing & Commissioning</h2>
        {canEdit && <button onClick={()=>setEditing(blank())} style={styles.primaryBtn}><Plus size={15}/> New T&C Checklist</button>}
      </div>
      {list.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No T&C checklists yet.</div> : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4' }}>
              {['Project','System','Date','Tests','Punch Items','Witnessed By','Status',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(r=>{
                const proj = siteProjects.find(p=>p.id===r.projectId);
                const fails = (r.tests||[]).filter(t=>t.result==='fail').length;
                const openPunch = (r.punchList||[]).filter(p=>p.status==='open').length;
                return (
                  <tr key={r.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{proj?.name||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#333' }}>{r.system}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{r.date}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span>{(r.tests||[]).length} tests</span>
                      {fails>0&&<span style={{ marginLeft:6, background:'#f8d7da', color:'#842029', borderRadius:5, padding:'1px 6px', fontSize:11, fontWeight:700 }}>{fails} fail</span>}
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      {(r.punchList||[]).length>0&&<span>{(r.punchList||[]).length}</span>}
                      {openPunch>0&&<span style={{ marginLeft:4, background:'#fff3cd', color:'#856404', borderRadius:5, padding:'1px 6px', fontSize:11, fontWeight:700 }}>{openPunch} open</span>}
                      {(r.punchList||[]).length===0&&'—'}
                    </td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{r.witnessedBy||'—'}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:ST_BG[r.status], color:ST_COLOR[r.status], borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{(r.status||'').replace('_',' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', justifyContent:'flex-end' }}>
                        <StatusBadge status={r.approvalStatus||'draft'} />
                        <ApprovalActions item={{ status:r.approvalStatus||'draft', rejectionNote:r.approvalNote||'' }} onUpdate={(patch)=>updateApproval(r.id,patch)} userRole={userRole} compact />
                        <button onClick={()=>setPrintDoc(r)} style={styles.iconBtn} title="Print"><Printer size={14}/></button>
                        {canEdit && r.approvalStatus!=='submitted' && <><button onClick={()=>setEditing(r)} style={styles.iconBtn}><Pencil size={14}/></button>
                        <button onClick={()=>{if(window.confirm('Delete?'))setTcChecklists(prev=>prev.filter(x=>x.id!==r.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button></>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {printDoc && <TCPrint checklist={printDoc} project={siteProjects.find(p=>p.id===printDoc.projectId)} businessInfo={businessInfo} onClose={()=>setPrintDoc(null)} />}
    </div>
  );
}

// ─── Project Handover ─────────────────────────────────────────────────────────

export function HandoverView({ handoverDocs, setHandoverDocs, siteProjects, customers, userRole, businessInfo }) {
  const [editing, setEditing] = useState(null);
  const [printDoc, setPrintDoc] = useState(null);
  const canEdit = ['admin','manager'].includes(userRole);

  const CHECKLIST_ITEMS = [
    'As-built Drawings (Electrical)','As-built Drawings (Plumbing)','As-built Drawings (HVAC)',
    'O&M Manuals','Test Certificates','Warranties / Guarantees','Spare Parts Handover',
    'Training to Client','Final Inspection Sign-off','Authority Approvals / NOC',
    'Snag List Cleared','Final RA Bill Approved','Retention Certificate'
  ];

  function blank() {
    return {
      id:'', projectId:'', customerId:'', handoverDate:'', dlpStart:'', dlpEnd:'',
      clientRep:'', ourRep:'', checklist: CHECKLIST_ITEMS.map(item=>({ item, done:false, notes:'' })),
      defects:[], notes:'', status:'in_progress'
    };
  }
  function blankDefect() { return { id:crypto.randomUUID(), description:'', raisedDate:new Date().toISOString().slice(0,10), closedDate:'', status:'open' }; }
  function save(rec) {
    const data = { ...rec, id:rec.id||crypto.randomUUID(), approvalStatus:rec.approvalStatus||'draft', approvalNote:rec.approvalNote||'', updatedAt:Date.now() };
    setHandoverDocs(prev=>prev.find(x=>x.id===data.id)?prev.map(x=>x.id===data.id?data:x):[...prev,data]);
    setEditing(null);
  }
  function updateApproval(id, patch) {
    setHandoverDocs(prev=>prev.map(x=>x.id===id?{...x,approvalStatus:patch.status,approvalNote:patch.rejectionNote||''}:x));
  }

  if (editing) {
    const r = editing;
    const set = (k,v)=>setEditing(p=>({...p,[k]:v}));
    const done = (r.checklist||[]).filter(c=>c.done).length;
    const total = (r.checklist||[]).length;
    const pct = total ? Math.round((done/total)*100) : 0;
    return (
      <div style={{ maxWidth:720, margin:'0 auto', padding:'24px 0' }}>
        <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
          <button onClick={()=>setEditing(null)} style={styles.ghostBtn}><X size={14}/> Back</button>
          <h2 className="serif" style={styles.pageTitle}>{r.id?'Edit':'New'} Project Handover</h2>
        </div>
        <div style={{ background:'#fff', borderRadius:10, padding:24, border:'1px solid #EAE6DB', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={styles.formGroup}><label style={styles.label}>Project</label>
              <select value={r.projectId||''} onChange={e=>set('projectId',e.target.value)} style={styles.input}>
                <option value=''>Select project</option>
                {siteProjects.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Client</label>
              <select value={r.customerId||''} onChange={e=>set('customerId',e.target.value)} style={styles.input}>
                <option value=''>Select client</option>
                {customers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>Handover Date</label><input type='date' value={r.handoverDate||''} onChange={e=>set('handoverDate',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Status</label>
              <select value={r.status} onChange={e=>set('status',e.target.value)} style={styles.input}>
                {['in_progress','handed_over','dlp','completed'].map(s=><option key={s} value={s}>{s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</option>)}
              </select>
            </div>
            <div style={styles.formGroup}><label style={styles.label}>DLP Start (Defects Liability)</label><input type='date' value={r.dlpStart||''} onChange={e=>set('dlpStart',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>DLP End</label><input type='date' value={r.dlpEnd||''} onChange={e=>set('dlpEnd',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Our Representative</label><input value={r.ourRep||''} onChange={e=>set('ourRep',e.target.value)} style={styles.input}/></div>
            <div style={styles.formGroup}><label style={styles.label}>Client Representative</label><input value={r.clientRep||''} onChange={e=>set('clientRep',e.target.value)} style={styles.input}/></div>
          </div>
          {/* Handover Checklist */}
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', textTransform:'uppercase' }}>Handover Checklist</div>
              <div style={{ fontSize:12, color:'#1a6b30', fontWeight:600 }}>{done}/{total} done ({pct}%)</div>
            </div>
            <div style={{ background:'#F8F7F4', borderRadius:8, padding:12 }}>
              {(r.checklist||[]).map((c,i)=>(
                <div key={c.item} style={{ display:'flex', gap:10, alignItems:'center', padding:'6px 0', borderBottom:i<(r.checklist.length-1)?'1px solid #EAE6DB':'none' }}>
                  <input type='checkbox' checked={c.done} onChange={e=>set('checklist',r.checklist.map((x,j)=>j===i?{...x,done:e.target.checked}:x))} style={{ width:16, height:16, accentColor:'#1E2A4A', flexShrink:0 }}/>
                  <span style={{ flex:1, fontSize:13, color:c.done?'#888':'#333', textDecoration:c.done?'line-through':'none' }}>{c.item}</span>
                  <input value={c.notes||''} onChange={e=>set('checklist',r.checklist.map((x,j)=>j===i?{...x,notes:e.target.value}:x))} placeholder='Notes...' style={{ ...styles.input, margin:0, width:160, fontSize:11 }}/>
                </div>
              ))}
            </div>
          </div>
          {/* DLP Defects */}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', textTransform:'uppercase', marginBottom:8 }}>DLP Defects Log</div>
            {(r.defects||[]).map((d,i)=>(
              <div key={d.id} style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, background:'#F8F7F4', borderRadius:6, padding:'6px 8px' }}>
                <input value={d.description} onChange={e=>set('defects',r.defects.map((x,j)=>j===i?{...x,description:e.target.value}:x))} style={{ ...styles.input, margin:0, flex:2, fontSize:12 }} placeholder='Defect description'/>
                <input type='date' value={d.raisedDate||''} onChange={e=>set('defects',r.defects.map((x,j)=>j===i?{...x,raisedDate:e.target.value}:x))} style={{ ...styles.input, margin:0, width:130, fontSize:12 }}/>
                <select value={d.status} onChange={e=>set('defects',r.defects.map((x,j)=>j===i?{...x,status:e.target.value}:x))} style={{ ...styles.input, margin:0, width:90, fontSize:12 }}>
                  <option value='open'>Open</option><option value='closed'>Closed</option>
                </select>
                <button onClick={()=>set('defects',r.defects.filter((_,j)=>j!==i))} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={13}/></button>
              </div>
            ))}
            <button onClick={()=>set('defects',[...(r.defects||[]),blankDefect()])} style={styles.ghostBtn}><Plus size={13}/> Log Defect</button>
          </div>
          <div style={styles.formGroup}><label style={styles.label}>Notes</label><textarea value={r.notes||''} onChange={e=>set('notes',e.target.value)} style={{ ...styles.input, height:60 }}/></div>
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10 }}>
            <button onClick={()=>setEditing(null)} style={styles.ghostBtn}>Cancel</button>
            <button onClick={()=>save(r)} style={styles.primaryBtn}>Save Handover</button>
          </div>
        </div>
      </div>
    );
  }

  const ST_COLOR = { in_progress:'#0a58ca', handed_over:'#856404', dlp:'#C9A24B', completed:'#1a6b30' };
  const ST_BG    = { in_progress:'#cfe2ff', handed_over:'#fff3cd', dlp:'#FFF8E7', completed:'#d4edda' };
  const list = [...handoverDocs].sort((a,b)=>b.handoverDate>a.handoverDate?1:-1);
  return (
    <>
    <div style={{ padding:'24px 32px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
        <h2 className="serif" style={styles.pageTitle}>Project Handover & DLP</h2>
        {canEdit && <button onClick={()=>setEditing(blank())} style={styles.primaryBtn}><Plus size={15}/> New Handover</button>}
      </div>
      {list.length===0 ? <div style={{ textAlign:'center', padding:60, color:'#888' }}>No handover records yet.</div> : (
        <div style={{ background:'#fff', borderRadius:10, border:'1px solid #EAE6DB', overflow:'hidden' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
            <thead><tr style={{ background:'#F8F7F4' }}>
              {['Project','Client','Handover Date','Checklist','DLP End','Open Defects','Status',''].map(h=><th key={h} style={{ padding:'10px 12px', textAlign:'left', fontSize:11, fontWeight:700, color:'#888', textTransform:'uppercase' }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {list.map(r=>{
                const proj = siteProjects.find(p=>p.id===r.projectId);
                const client = customers.find(c=>c.id===r.customerId);
                const done = (r.checklist||[]).filter(c=>c.done).length;
                const total = (r.checklist||[]).length;
                const openDefects = (r.defects||[]).filter(d=>d.status==='open').length;
                const dlpExpired = r.dlpEnd && r.dlpEnd < new Date().toISOString().slice(0,10);
                return (
                  <tr key={r.id} style={{ borderBottom:'1px solid #F0ECE5' }}>
                    <td style={{ padding:'10px 12px', fontWeight:600 }}>{proj?.name||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{client?.name||'—'}</td>
                    <td style={{ padding:'10px 12px', color:'#555' }}>{r.handoverDate||'—'}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ fontSize:12 }}>{done}/{total}</span> <span style={{ fontSize:11, color:done===total?'#1a6b30':'#856404', fontWeight:600 }}>{done===total?'✓ Complete':'in progress'}</span></td>
                    <td style={{ padding:'10px 12px', color:dlpExpired?'#1a6b30':'#555' }}>{r.dlpEnd||'—'}</td>
                    <td style={{ padding:'10px 12px' }}>{openDefects>0?<span style={{ background:'#f8d7da', color:'#842029', borderRadius:5, padding:'1px 8px', fontSize:11, fontWeight:700 }}>{openDefects} open</span>:'—'}</td>
                    <td style={{ padding:'10px 12px' }}><span style={{ background:ST_BG[r.status]||'#f0ece5', color:ST_COLOR[r.status]||'#555', borderRadius:6, padding:'2px 8px', fontSize:11, fontWeight:700 }}>{(r.status||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())}</span></td>
                    <td style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center', justifyContent:'flex-end' }}>
                        <StatusBadge status={r.approvalStatus||'draft'} />
                        <ApprovalActions item={{ status:r.approvalStatus||'draft', rejectionNote:r.approvalNote||'' }} onUpdate={(patch)=>updateApproval(r.id,patch)} userRole={userRole} compact />
                        <button onClick={()=>setPrintDoc(r)} style={styles.iconBtn} title="Print Certificate"><Printer size={14}/></button>
                        {canEdit && r.approvalStatus!=='submitted' && <><button onClick={()=>setEditing(r)} style={styles.iconBtn}><Pencil size={14}/></button>
                        <button onClick={()=>{if(window.confirm('Delete?'))setHandoverDocs(prev=>prev.filter(x=>x.id!==r.id))}} style={{ ...styles.iconBtn, color:'#B5453A' }}><Trash2 size={14}/></button></>}
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
    {/* ── Handover Certificate Print Overlay ── */}
    {printDoc && (()=>{
      const r = printDoc;
      const proj = siteProjects.find(p=>p.id===r.projectId);
      const client = customers.find(c=>c.id===r.customerId);
      const cl = r.checklist||[];
      const done = cl.filter(c=>c.done).length;
      const openDefects = (r.defects||[]).filter(d=>d.status==='open').length;
      return (
        <DocPrintOverlay onClose={()=>setPrintDoc(null)} filename={`Handover-${proj?.name||'Project'}.pdf`} businessInfo={businessInfo}>
          <div style={{ textAlign:'center', marginBottom:20 }}>
            <div style={{ fontSize:22, fontWeight:700, color:'#1E2A4A', letterSpacing:1 }}>PROJECT HANDOVER CERTIFICATE</div>
            <div style={{ fontSize:13, color:'#888', marginTop:4 }}>Practical Completion &amp; Defect Liability Period</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 32px', fontSize:13, marginBottom:20 }}>
            {[['Project', proj?.name||'—'], ['Client', client?.name||'—'], ['Handover Date', r.handoverDate||'—'], ['DLP Start', r.dlpStart||'—'], ['DLP End', r.dlpEnd||'—'], ['Status', (r.status||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())], ['Our Representative', r.ourRep||'—'], ['Client Representative', r.clientRep||'—']].map(([l,v])=>(
              <div key={l} style={{ display:'flex', gap:8, borderBottom:'1px solid #f0ece5', padding:'5px 0' }}>
                <span style={{ color:'#888', minWidth:150 }}>{l}</span><span style={{ fontWeight:600, color:'#1E2A4A' }}>{v}</span>
              </div>
            ))}
          </div>
          {/* Checklist */}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#1E2A4A', marginBottom:8, textTransform:'uppercase', display:'flex', justifyContent:'space-between' }}>
              <span>Handover Checklist</span>
              <span style={{ color: done===cl.length?'#1a6b30':'#856404' }}>{done}/{cl.length} Complete</span>
            </div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr style={{ background:'#F8F7F4' }}>
                <th style={{ padding:'6px 8px', width:24 }}></th>
                <th style={{ padding:'6px 8px', textAlign:'left', fontWeight:700, color:'#888' }}>Item</th>
                <th style={{ padding:'6px 8px', textAlign:'left', fontWeight:700, color:'#888', width:180 }}>Notes</th>
              </tr></thead>
              <tbody>
                {cl.map((c,i)=>(
                  <tr key={i} style={{ borderBottom:'1px solid #f0ece5', background:c.done?'#f0fdf4':'#fff' }}>
                    <td style={{ padding:'6px 8px', textAlign:'center', fontSize:15 }}>{c.done?'✓':'☐'}</td>
                    <td style={{ padding:'6px 8px', color: c.done?'#1a6b30':'#333' }}>{c.item}</td>
                    <td style={{ padding:'6px 8px', color:'#888', fontSize:11 }}>{c.notes||''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Open Defects */}
          {(r.defects||[]).filter(d=>d.status==='open').length>0 && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'#B5453A', marginBottom:8, textTransform:'uppercase' }}>Open Defects / Snag Items ({openDefects})</div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                {(r.defects||[]).filter(d=>d.status==='open').map((d,i)=>(
                  <tr key={d.id} style={{ borderBottom:'1px solid #f0ece5' }}>
                    <td style={{ padding:'5px 8px', color:'#888', width:24 }}>{i+1}</td>
                    <td style={{ padding:'5px 8px' }}>{d.description}</td>
                    <td style={{ padding:'5px 8px', color:'#888', fontSize:11 }}>Raised: {d.raisedDate||'—'}</td>
                  </tr>
                ))}
              </table>
            </div>
          )}
          {r.notes && <div style={{ fontSize:12, color:'#555', borderTop:'1px solid #eee', paddingTop:10, marginBottom:16 }}><b>Notes:</b> {r.notes}</div>}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:32, marginTop:40 }}>
            {['Client Representative','Contractor Representative'].map(s=>(
              <div key={s}>
                <div style={{ borderTop:'1px solid #555', paddingTop:8, fontSize:12, color:'#555', textAlign:'center' }}>{s}</div>
                <div style={{ marginTop:24, fontSize:11, color:'#aaa', textAlign:'center' }}>Name &amp; Signature &amp; Date</div>
              </div>
            ))}
          </div>
        </DocPrintOverlay>
      );
    })()}
    </>
  );
}

// ─── MIS / Management Review ─────────────────────────────────────────────────
