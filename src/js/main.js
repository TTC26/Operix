/* ===== Shell, events, start-up ===== */
const VIEW_FN = { overview: vOverview, setup: vSetup, company: vCompany, products: vProducts, cost: vCost, opex: vOpex, wc: vWC, finance: vFinance, history: vHistory,
  projections: vProjections, appraisal: vAppraisal, cma: vCMA, checks: vChecks, report: vReport };

function topBar(inProject) {
  const p = S.cur; const s = p && p.settings; const units = s ? (UNITS[s.numSystem] || UNITS.intl) : [];
  const email = Store.mode === 'cloud' && Store.user ? Store.user.email : '';
  return `<header class="top">
    <button class="brand linkbtn" data-act="home" aria-label="Bizvora — my projects"><img class="brand-logo" src="/icons/icon-192.png" alt="" width="28" height="28">Bizvora</button>
    ${inProject ? `<span class="proj-name" title="${esc(p.name)}">${esc(p.name)}</span><span class="pill mode">Mode ${mode()}</span>` : ''}
    <span class="spacer"></span>
    ${inProject ? `<label class="ctl">Currency ${sel('settings.currency', CURRENCIES.map(c => [c[0], c[0]]), { label: 'Currency' })}</label>
    <label class="ctl">Show in ${sel('settings.unit', units.map(u => [u[0], u[1]]), { num: true, label: 'Show amounts in' })}</label>
    <span class="save-state" id="saveState" aria-live="polite">${esc(S.saveState)}</span>` : ''}
    ${S.guest ? `<button class="btn sm pri" data-act="guestsignup">Sign up free</button><button class="btn sm ghost" data-act="guestsignin">Sign in</button>` : `<button class="btn sm pri" data-act="newproj">+ New project</button>`}
    ${inProject && !p.example && PAY.fullAccess ? '<span class="pill ok">Full access</span>' : ''}${inProject && !p.example && !PAY.fullAccess ? (isUnlocked(p) ? '<span class="pill ok">Report unlocked</span>' : `<button class="btn sm lime" data-act="unlock">Unlock report · ${inr(amountDueNow(p))}</button>`) : ''}
    ${Store.mode === 'cloud' && !S.guest ? `<div class="acct"><button class="btn sm ghost" data-act="acct" aria-expanded="${!!S.acctOpen}">${esc(email.split('@')[0] || 'Account')} ▾</button>
      ${S.acctOpen ? `<div class="menu card"><div class="small muted">Signed in as</div><div class="small" style="font-weight:600;word-break:break-all">${esc(email)}</div>
      <button class="btn sm" data-act="home">My projects</button>${S.isAdmin ? '<button class="btn sm" data-act="adminopen">Admin panel</button>' : ''}<button class="btn sm" data-act="authpass">Change password</button><button class="btn sm danger" data-act="signout">Sign out</button></div>` : ''}</div>` : ''}
  </header>`;
}
function projectShell() {
  const p = S.cur, m = mode();
  const views = VIEWS.filter(v => !v.min || m >= v.min);
  if (!views.find(v => v.id === S.view)) S.view = 'overview';
  const worst = {}; const rank = { bad: 3, warn: 2, ok: 1 };
  S.issues.forEach(i => { if (!i.view || p.issuesIgnored[i.key]) return; if ((rank[i.sev] || 0) > (rank[worst[i.view]] || 0)) worst[i.view] = i.sev; });
  const groups = [...new Set(views.map(v => v.g))];
  return `<div class="app">${topBar(true)}
  <nav class="side" aria-label="Steps"><div class="sidewrap">${groups.map(g => `<div class="navgroup"><h4>${esc(g)}</h4><div class="nav">${views.filter(v => v.g === g).map(v =>
    `<button class="${S.view === v.id ? 'on' : ''}" data-act="nav" data-v="${v.id}" ${S.view === v.id ? 'aria-current="page"' : ''}><span class="dot ${worst[v.id] || ''}"></span>${esc(v.label)}</button>`).join('')}</div></div>`).join('')}</div></nav>
  <main class="main"><div class="wrap">
    ${p.example ? `<div class="banner"><div style="flex:1;min-width:220px"><b>Example project.</b> Sample figures for a CNC machining unit. Edits here are not saved.</div><button class="btn sm pri" data-act="saveex">Save a copy to my projects</button><button class="btn sm" data-act="home">Back to my projects</button></div>` : ''}
    ${VIEW_FN[S.view]()}
  </div></main></div>`;
}
function dashShell() {
  return `<div class="app dash">${topBar(false)}<main class="main"><div class="wrap">${vDashboard()}</div></main></div>`;
}

let root;
function render() {
  const ae = document.activeElement; const aid = ae && ae.id; let ss = null, se = null;
  try { ss = ae.selectionStart; se = ae.selectionEnd; } catch (e) { }
  const main = $('.main'); const st = main ? main.scrollTop : 0;
  let html;
  if (S.screen === 'loading') html = `<div class="splash"><img src="/icons/icon-192.png" alt="" width="64" height="64"><p class="muted">Loading Bizvora…</p></div>`;
  else if (S.screen === 'auth') html = vAuth();
  else if (S.view === 'admin' && S.isAdmin) html = adminShell();
  else if (S.cur && S.view !== 'dashboard') { S.R = Engine.compute(S.cur); S.issues = buildIssues(); html = projectShell(); }
  else html = dashShell();
  if (S.screen === 'app' && S.modal) html += S.modal.kind === 'new' ? vNewProject() : vUnlock();
  html += `<div class="toast" id="toast" role="status" ${S.toastVisible ? '' : 'hidden'}>${esc(S.toastMsg || '')}</div>`;
  root.innerHTML = html;
  const m2 = $('.main'); if (m2) m2.scrollTop = st;
  if (aid && !['quoteFile', 'importFile'].includes(aid)) { const el = document.getElementById(aid); if (el) { el.focus({ preventScroll: true }); try { if (ss != null) el.setSelectionRange(ss, se); } catch (e) { } } }
}
function changed(rerender) { if (S.cur) S.R = Engine.compute(S.cur); scheduleSave(); if (rerender) render(); }
function readVal(t) { if (t.dataset.t === 'n') { if (t.value === '') return ''; const n = Number(t.value); return isFinite(n) ? n : ''; } return t.value; }
const NEW_ROWS = {
  products: () => ({ name: 'New product', unit: 'nos', capacity: 0, price: 0, rmCost: 0, growth: 0 }),
  assets: () => ({ cat: 'Plant & Machinery', desc: '', qty: 1, rate: 0, dep: 6.33, quote: '' }),
  manpower: () => ({ role: '', count: 1, salary: 0 }),
  'opex.other': () => ({ name: '', basis: 'fixed', value: 0, esc: 0 }),
  promoters: () => ({ name: '', role: 'Director', age: '', qualification: '', experience: '', netWorth: 0, share: 0, contribution: 0 }),
  existingLoans: () => ({ name: '', outstanding: 0, rate: 10, years: 3 }),
  historical: () => ({ fy: 'FY ', revenue: 0, ebitda: 0, depn: 0, interest: 0, pat: 0, netWorth: 0, debt: 0, ca: 0, cl: 0, gst: 0, itr: 0, bank: 0 }),
  implementation: () => ({ task: '', start: 0, months: 1 }),
  risks: () => ({ risk: '', impact: 'Medium', mitigation: '' })
};
function sideEffects(k, v) {
  const s = S.cur.settings;
  if (k === 'settings.currency') { s.numSystem = v === 'INR' ? 'indian' : 'intl'; s.unit = v === 'INR' ? 1e5 : (S.R && S.R.pc.total >= 5e7 ? 1e6 : 1e3); const c = CURRENCIES.find(x => x[0] === v); toast(`Amounts are now shown in ${c ? c[1] : v}. Values are relabelled, not converted.`); }
  if (k === 'settings.numSystem') s.unit = v === 'indian' ? 1e5 : 1e3;
  const m = k.match(/^assets\.(\d+)\.cat$/); if (m) S.cur.assets[+m[1]].dep = DEP_DEFAULT[v] ?? 10;
}

/* ---- saving ---- */
function scheduleSave() {
  if (!S.cur || S.cur.example) return;
  S.saveState = 'Saving…'; paintSave(); clearTimeout(S.saveT); S.saveT = setTimeout(doSave, 900);
}
function doSave() {
  const p = S.cur; if (!p || p.example) return Promise.resolve();
  clearTimeout(S.saveT);
  const R = Engine.compute(p);
  S.chain = (S.chain || Promise.resolve()).then(() => Store.save(p, R)).then(meta => {
    if (S.projects) { const i = S.projects.findIndex(x => x.id === meta.id); if (i >= 0) S.projects[i] = meta; else S.projects.unshift(meta); }
    S.saveState = Store.mode === 'cloud' ? 'Saved' : 'Saved in this browser'; paintSave();
  }).catch(e => { S.saveState = 'Not saved — ' + ((e && e.message) || 'error'); paintSave(); toast('Could not save: ' + ((e && e.message) || 'error')); });
  return S.chain;
}
function paintSave() { const el = $('#saveState'); if (el) el.textContent = S.saveState; }
function toast(msg) { S.toastMsg = msg; S.toastVisible = true; const el = $('#toast'); if (el) { el.textContent = msg; el.hidden = false; } clearTimeout(S.toastT); S.toastT = setTimeout(() => { S.toastVisible = false; const e2 = $('#toast'); if (e2) e2.hidden = true; }, 4200); }
function scrollTop() { const m = $('.main'); if (m) m.scrollTop = 0; window.scrollTo(0, 0); }

/* ---- navigation between dashboard and projects ---- */
async function loadProjects() {
  S.projects = null; S.listErr = ''; render();
  try { S.projects = await Store.list(); } catch (e) { S.projects = []; S.listErr = (e && e.message) || 'Unknown error'; }
  render();
}
async function goHome() {
  if (S.cur && !S.cur.example) { try { await doSave(); } catch (e) { } }
  S.cur = null; S.view = 'dashboard'; S.extract = null; S.acctOpen = false; S.confirmDel = null; render(); scrollTop();
}
function openProject(p, view) { S.cur = normalize(p); S.view = view || 'overview'; S.extract = null; S.acctOpen = false; S.saveState = p.example ? 'Example — not saved' : 'Saved'; render(); scrollTop(); }
async function openById(id) {
  try { toast('Opening…'); const p = await Store.get(id); p.id = id; openProject(p); } catch (e) { toast('Could not open the project: ' + e.message); }
}
async function createProject(p, view) { S.cur = p; S.view = view; S.saveState = 'Saving…'; render(); scrollTop(); await doSave(); }

function enterApp() { S.guest = false; S.screen = 'app'; S.view = 'dashboard'; S.cur = null; loadProjects(); loadUnlocks().then(() => render()); loadAccess().then(() => render()); }

function bind() {
  document.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'dashQ') { S.dashQ = t.value; render(); return; }
    if (t.id === 'adminQ') { ADMIN.q = t.value; render(); return; }
    if (t.dataset && t.dataset.d && S.modal && S.modal.draft) { S.modal.draft[t.dataset.d] = t.type === 'checkbox' ? t.checked : t.value; if (t.dataset.d === 'name') { const b = document.querySelector('[data-act=npnext]'); if (b) b.disabled = !t.value.trim(); } return; }
    const k = t.dataset && t.dataset.k;
    if (!k || !S.cur || t.type === 'checkbox' || t.tagName === 'SELECT') return;
    setP(S.cur, k, readVal(t)); S.R = Engine.compute(S.cur); scheduleSave();
  });
  document.addEventListener('change', e => {
    const t = e.target;
    if (t.dataset && t.dataset.d && S.modal && S.modal.draft) { S.modal.draft[t.dataset.d] = t.type === 'checkbox' ? t.checked : t.value; if (t.type === 'checkbox') render(); return; }
    if (t.id && t.id.startsWith('photo_') && t.files[0]) { addProductPhoto(+t.id.slice(6), t.files[0]); t.value = ''; return; }
    if (t.id === 'quoteFile' && t.files[0]) { readQuote(t.files[0]); t.value = ''; return; }
    if (t.id === 'importFile' && t.files[0]) {
      t.files[0].text().then(txt => { const p = JSON.parse(txt); if (!p || !p.settings || !p.products) throw new Error('bad'); p.id = newId(); p.example = false; createProject(normalize(p), 'overview'); toast('Imported ' + p.name); })
        .catch(() => toast('That file is not a Bizvora project backup.')); t.value = ''; return;
    }
    const k = t.dataset && t.dataset.k; if (!k || !S.cur) return;
    const v = t.type === 'checkbox' ? t.checked : readVal(t);
    setP(S.cur, k, v); sideEffects(k, v); changed(false); setTimeout(render, 0);
  });
  document.addEventListener('submit', e => { const f = e.target.closest('[data-form]'); if (!f) return; e.preventDefault(); if (f.dataset.form === 'admingrant') adminGrantFromForm(); else submitAuth(f.dataset.form); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && (S.modal || S.acctOpen)) { S.modal = null; S.acctOpen = false; render(); } });
  document.addEventListener('click', e => {
    if (S.acctOpen && !e.target.closest('.acct')) { S.acctOpen = false; render(); }
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.classList.contains('overlay') && e.target.closest('[data-stop]')) return;
    const a = b.dataset.act, v = b.dataset.v, p = S.cur;
    if (S.guest && ['newproj', 'home', 'saveex', 'unlock', 'pdf', 'docx', 'guestsignup', 'guestsignin'].includes(a) || (S.guest && a === 'nav' && v === 'dashboard')) {
      S.modal = null; S.screen = 'auth';
      S.auth = a === 'guestsignin' ? { tab: 'signin' } : { tab: 'signup', msg: 'Create a free account to save projects and download reports.' };
      render(); return;
    }
    switch (a) {
      case 'guestexample': S.guest = true; S.screen = 'app'; openProject(exampleProject()); break;
      /* auth */
      case 'authtab': S.auth = { tab: v, email: S.auth.email || (document.getElementById('au_email') || {}).value || '' }; render(); break;
      case 'authpass': S.acctOpen = false; S.auth = { tab: 'newpass' }; S.screen = 'auth'; render(); break;
      case 'signout': S.acctOpen = false; (async () => { if (S.cur && !S.cur.example) { try { await doSave(); } catch (e) { } } await Store.signOut(); S.cur = null; S.projects = null; S.isAdmin = false; PAY.fullAccess = false; ADMIN.data = null; S.screen = 'auth'; S.auth = { tab: 'signin' }; render(); })(); break;
      case 'authcancel': enterApp(); break;
      case 'photodel': delete p.products[+v].photo; changed(true); break;
      case 'adminopen': S.acctOpen = false; S.cur = null; S.view = 'admin'; loadAdmin(); scrollTop(); break;
      case 'adminreload': loadAdmin(); break;
      case 'admintoggle': setGrant(v, b.dataset.on === '1'); break;
      case 'resendverify': Store.resendVerification().then(() => toast('Verification email sent.')).catch(e => toast(e.message)); break;
      case 'acct': S.acctOpen = !S.acctOpen; render(); break;
      /* dashboard */
      case 'home': goHome(); break;
      case 'reload': loadProjects(); break;
      case 'newproj': S.acctOpen = false; S.modal = { kind: 'new', step: 1, draft: newDraft() }; render(); setTimeout(() => { const el = document.getElementById('np_name'); if (el) el.focus(); }, 0); break;
      case 'dchip': { const d = S.modal.draft; if (b.dataset.multi) { const i = d[b.dataset.k].indexOf(v); if (i >= 0) d[b.dataset.k].splice(i, 1); else d[b.dataset.k].push(v); } else d[b.dataset.k] = v; if (b.dataset.k === 'financeMode') d.mode = 0; render(); break; }
      case 'dmode': S.modal.draft.mode = +v; render(); break;
      case 'npnext': if (S.modal.step === 1 && !String(S.modal.draft.name).trim()) break; S.modal.step++; render(); break;
      case 'npback': S.modal.step--; render(); break;
      case 'npcreate': { const np = buildFromDraft(S.modal.draft); S.modal = null; createProject(np, 'setup').then(() => toast('Project created. Start with the setup, then work down the steps.')); break; }
      case 'example': openProject(exampleProject()); break;
      case 'open': openById(v); break;
      case 'dup': (async () => { try { const src = await Store.get(v); src.id = newId(); src.name = (src.name || 'Project') + ' (copy)'; src.example = false; const meta = await Store.save(normalize(src), Engine.compute(normalize(src))); S.projects.unshift(meta); render(); toast('Duplicated.'); } catch (e) { toast('Could not duplicate: ' + e.message); } })(); break;
      case 'delp': S.confirmDel = v; render(); break;
      case 'delno': S.confirmDel = null; render(); break;
      case 'delyes': (async () => { try { await Store.remove(v); S.projects = S.projects.filter(x => x.id !== v); S.confirmDel = null; render(); toast('Project deleted.'); } catch (e) { toast('Could not delete: ' + e.message); } })(); break;
      /* project */
      case 'nav': if (v === 'dashboard') { goHome(); break; } S.view = v; render(); scrollTop(); break;
      case 'mode': p.settings.mode = +v; changed(true); break;
      case 'chip': { const arr = getP(p, b.dataset.path) || []; const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); setP(p, b.dataset.path, arr); changed(true); break; }
      case 'set': setP(p, b.dataset.path, v); changed(true); break;
      case 'add': { const L = getP(p, b.dataset.list); L.push(NEW_ROWS[b.dataset.list] ? NEW_ROWS[b.dataset.list]() : {}); changed(true); break; }
      case 'del': getP(p, b.dataset.list).splice(+b.dataset.i, 1); changed(true); break;
      case 'balance': p.finance.equity = Math.round(S.R.pc.totalExWC - S.R.means.termLoan - S.R.means.subsidy - S.R.means.unsecured); changed(true); toast('Promoter equity set to balance the project cost.'); break;
      case 'applywc': p.finance.wcLoan = Math.round(S.R.assessed[0]); changed(true); toast('Working capital loan updated. Margin money changed — rebalance means of finance.'); break;
      case 'reason': p.growthReason = (String(p.growthReason || '').trim() ? p.growthReason.trim() + ' ' : '') + v + '.'; changed(true); break;
      case 'ignore': p.issuesIgnored[v] = !p.issuesIgnored[v]; changed(true); break;
      case 'ai': aiDraft(v); break;
      case 'airisks': aiRisks(); break;
      case 'narrdefault': p.narrative[v] = ''; changed(true); break;
      case 'xlsx': withBusy('xlsx', exportXLSX); break;
      case 'pdf': if (requirePro('pdf')) withBusy('pdf', downloadPDF); break;
      case 'docx': if (requirePro('docx')) withBusy('docx', exportDOCX); break;
      case 'json': exportJSON(); break;
      case 'exadd': { const it = S.extract.items[+b.dataset.i]; const q = +it.qty || 1;
        p.assets.push({ cat: 'Plant & Machinery', desc: it.description || 'Item', qty: q, rate: Math.round((+it.unitPrice || 0) + ((+it.freight || 0) + (+it.installation || 0)) / q), dep: 6.33, quote: `${S.extract.vendor || 'Quotation'} (${S.extract.name})` });
        it.done = 'added'; changed(true); break; }
      case 'exskip': S.extract.items[+b.dataset.i].done = 'ignored'; render(); break;
      case 'saveex': { const np = normalize(clone(p)); np.id = newId(); np.example = false; np.name = p.name + ' (copy)'; createProject(np, S.view).then(() => toast('Saved to your projects.')); break; }
      /* plan */
      case 'unlock': S.acctOpen = false; S.modal = { kind: 'unlock' }; render(); break;
      case 'pay': startPayment(); break;
      case 'demounlock': demoUnlock(); break;
      case 'closemodal': S.modal = null; render(); break;
    }
  });
}

/* ---- AI through the Vercel function /api/ai (enabled when ANTHROPIC_API_KEY is set) ---- */
function fileToB64(f) {
  return new Promise((res, rej) => { if (f.size > 3.5e6) return rej({ message: 'Image is larger than 3.5 MB. Use a smaller photo or a text file.' });
    const r = new FileReader(); r.onload = () => res({ mediaType: f.type, data: String(r.result).split(',')[1] }); r.onerror = () => rej({ message: 'Could not read the file.' }); r.readAsDataURL(f); });
}
function makeServerSample() {
  const call = async (input, opts = {}) => {
    const images = opts.images ? await Promise.all([...opts.images].map(fileToB64)) : [];
    const headers = { 'content-type': 'application/json' };
    const tok = await Store.idToken(); if (tok) headers.authorization = 'Bearer ' + tok;
    const r = await fetch('/api/ai', { method: 'POST', headers, body: JSON.stringify({ prompt: input, images }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw { code: 'api_error', message: j.error || ('AI request failed (' + r.status + ')') };
    if (opts.onText) opts.onText({ text: j.text, delta: j.text });
    return { text: j.text || '', truncated: false };
  };
  call.json = async (input, opts) => {
    const { text } = await call(input + '\n\nReply with the JSON only. No prose, no code fences.', opts);
    const m = text.match(/\{[\s\S]*\}/); if (!m) throw { message: 'The AI reply had no JSON.' };
    return JSON.parse(m[0]);
  };
  call.limits = async () => ({ images: { mediaTypes: ['image/png', 'image/jpeg', 'image/webp'] } });
  return call;
}
function enableServerAI() {
  fetch('/api/ai').then(r => r.ok ? r.json() : null).then(j => { if (j && j.enabled) { S.sample = makeServerSample(); S.sampleImages = true; if (S.cur) render(); } }).catch(() => { });
}

async function init() {
  root = document.getElementById('root');
  S.screen = 'loading'; S.cur = null; S.view = 'dashboard'; S.projects = null; S.auth = { tab: 'signin' };
  bind(); render();
  Store.onAuth((event, user) => {
    if (event === 'SIGNED_IN' && S.screen === 'auth' && S.auth.tab !== 'newpass') { toast('Signed in.'); enterApp(); return; }
    if (event === 'SIGNED_OUT') { S.cur = null; S.projects = null; S.screen = 'auth'; S.auth = { tab: 'signin' }; render(); }
  });
  const qs = new URLSearchParams(location.search);
  const wantExample = qs.has('example'), wantSignup = qs.has('signup');
  if (wantExample || wantSignup) history.replaceState(null, '', location.pathname);
  await Store.init();
  if (Store.mode === 'cloud' && !Store.user) {
    S.screen = 'auth';
    if (wantSignup) S.auth = { tab: 'signup' };
    if (Store.pendingLink) S.auth = { tab: 'confirmlink' };
    if (Store.linkError) S.auth.err = Store.err(Store.linkError).message;
    if (wantExample && !Store.pendingLink) { S.guest = true; S.screen = 'app'; openProject(exampleProject()); }
    else render();
  }
  else { enterApp(); if (wantExample) openProject(exampleProject()); }
  enableServerAI();
  loadPayConfig().then(() => { if (S.screen === 'app') render(); });
}
if ('serviceWorker' in navigator && location.protocol === 'https:') window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));
init();
