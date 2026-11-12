/* ===== Sign-in, dashboard and new-project wizard ===== */
function vAuth() {
  const a = S.auth; const tab = a.tab;
  const email = `<label class="f"><span>Email</span><input id="au_email" type="email" autocomplete="email" required value="${esc(a.email || '')}" placeholder="you@company.com"></label>`;
  const pass = (id, label, ac) => `<label class="f"><span>${label}</span><input id="${id}" type="password" autocomplete="${ac}" minlength="8" required placeholder="At least 8 characters"></label>`;
  const btn = (label) => `<button class="btn pri" type="submit" style="justify-content:center" ${a.busy ? 'disabled' : ''}>${a.busy ? 'Please wait…' : label}</button>`;
  let form = '';
  if (tab === 'signin') form = `<form class="grid" data-form="signin">${email}${pass('au_pass', 'Password', 'current-password')}${btn('Sign in')}
      <div class="row small" style="justify-content:space-between"><button class="linkbtn" type="button" data-act="authtab" data-v="reset">Forgot password?</button><button class="linkbtn" type="button" data-act="authtab" data-v="magic">Email me a sign-in link</button></div></form>`;
  if (tab === 'signup') form = `<form class="grid" data-form="signup">${email}${pass('au_pass', 'Create a password', 'new-password')}${btn('Create account')}
      <p class="small muted" style="margin:0">We'll send a confirmation email. Your projects stay private to your account.</p></form>`;
  if (tab === 'magic') form = `<form class="grid" data-form="magic">${email}${btn('Send sign-in link')}<p class="small muted" style="margin:0">No password needed. We email you a sign-in link. Open it on this device.</p><button class="linkbtn small" type="button" data-act="authtab" data-v="signin">Back to sign in</button></form>`;
  if (tab === 'reset') form = `<form class="grid" data-form="reset">${email}${btn('Send reset link')}<button class="linkbtn small" type="button" data-act="authtab" data-v="signin">Back to sign in</button></form>`;
  if (tab === 'confirmlink') form = `<form class="grid" data-form="confirmlink"><p style="margin:0">You opened a sign-in link on a different device or browser. Confirm your email to finish signing in.</p>${email}${btn('Finish signing in')}</form>`;
  if (tab === 'sent') form = `<div class="grid"><p style="margin:0">Check your inbox at <b>${esc(a.email)}</b>. ${esc(a.sentMsg || '')}</p><button class="btn" data-act="authtab" data-v="signin">Back to sign in</button></div>`;
  if (tab === 'newpass') form = `<form class="grid" data-form="newpass"><p style="margin:0">Choose a new password for <b>${esc((Store.user && Store.user.email) || '')}</b>.</p>${pass('au_pass', 'New password', 'new-password')}${btn('Save password')}<button class="linkbtn small" type="button" data-act="authcancel">Cancel</button></form>`;
  const tabs = ['signin', 'signup'].includes(tab) ? `<div class="seg" role="tablist"><button role="tab" class="${tab === 'signin' ? 'on' : ''}" aria-selected="${tab === 'signin'}" data-act="authtab" data-v="signin">Sign in</button><button role="tab" class="${tab === 'signup' ? 'on' : ''}" aria-selected="${tab === 'signup'}" data-act="authtab" data-v="signup">Create account</button></div>` : '';
  const title = { signin: 'Welcome back', signup: 'Create your Bizvora account', magic: 'Sign in with email', reset: 'Reset your password', confirmlink: 'Finish signing in', sent: 'Check your email', newpass: 'Set a new password' }[tab];
  return `<div class="auth">
    <section class="auth-hero">
      <div class="brand" style="font-size:22px"><img class="brand-logo" src="/icons/icon-192.png" alt="" width="34" height="34" style="width:34px;height:34px">Bizvora</div>
      <h1 class="auth-title">Project reports banks can read, built in an afternoon.</h1>
      <ul class="auth-list">
        <li><b>General DPR</b><span>Project report for startups, investors and subsidy files</span></li>
        <li><b>Bank / MSME DPR</b><span>Loan proposal with DSCR, ratios and stress tests</span></li>
        <li><b>Bank / MSME + CMA</b><span>Historical analysis, reconciliation, CMA forms and MPBF</span></li>
      </ul>
      <p style="margin:0"><button class="btn" data-act="guestexample">See a finished example report →</button></p>
      <p class="small muted" style="margin:0">Any currency · Lakh/crore or million · Excel, PDF and Word export</p>
      <p class="small muted" style="margin:0"><a href="/pricing" target="_blank" rel="noopener">Pricing</a> · <a href="/terms" target="_blank" rel="noopener">Terms</a> · <a href="/privacy" target="_blank" rel="noopener">Privacy</a> · <a href="/refund" target="_blank" rel="noopener">Refunds</a> · <a href="/contact" target="_blank" rel="noopener">Contact</a></p>
    </section>
    <section class="auth-card card">
      ${tabs}<h2 style="margin:4px 0 14px">${title}</h2>
      ${a.err ? `<p class="auth-msg bad" role="alert">${esc(a.err)}</p>` : ''}${a.msg ? `<p class="auth-msg ok" role="status">${esc(a.msg)}</p>` : ''}
      ${form}
    </section>
  </div>`;
}
function authErr(e) {
  const m = (e && e.message) || 'Something went wrong. Try again.';
  if (/invalid login/i.test(m)) return 'Email or password is incorrect.';
  if (/email not confirmed/i.test(m)) return 'Confirm your email first — open the link we sent you, then sign in.';
  if (/already registered/i.test(m)) return 'An account with this email already exists. Sign in instead.';
  if (/rate limit|too many/i.test(m)) return 'Too many attempts. Wait a minute and try again.';
  if (/expired|invalid.*token|otp/i.test(m)) return 'That code or link has expired. Request a new one.';
  return m;
}
async function submitAuth(kind) {
  const a = S.auth; const val = id => { const el = document.getElementById(id); return el ? el.value.trim() : ''; };
  if (document.getElementById('au_email')) a.email = val('au_email');
  const pw = document.getElementById('au_pass') ? document.getElementById('au_pass').value : '';
  a.err = ''; a.msg = ''; a.busy = true; render();
  try {
    if (kind === 'signin') await Store.signIn(a.email, pw);
    if (kind === 'signup') { await Store.signUp(a.email, pw); toast('Account created. We sent a verification email to ' + a.email + '.'); }
    if (kind === 'magic') { await Store.sendLink(a.email); a.tab = 'sent'; a.sentMsg = 'Open the sign-in link on this device to continue.'; }
    if (kind === 'confirmlink') await Store.finishLink(a.email);
    if (kind === 'reset') { await Store.resetPassword(a.email); a.tab = 'sent'; a.sentMsg = 'Open the link to choose a new password, then sign in here.'; }
    if (kind === 'newpass') { await Store.setPassword(pw); a.tab = 'signin'; toast('Password updated.'); enterApp(); }
  } catch (e) { a.err = authErr(e); }
  a.busy = false; render();
}

/* ---- dashboard ---- */
function relTime(ts) {
  if (!ts) return ''; const d = (Date.now() - ts) / 1000;
  if (d < 60) return 'just now'; if (d < 3600) return Math.floor(d / 60) + ' min ago'; if (d < 86400) return Math.floor(d / 3600) + ' h ago';
  if (d < 86400 * 7) return Math.floor(d / 86400) + ' days ago'; return new Date(ts).toLocaleDateString();
}
function vDashboard() {
  const list = S.projects; const q = (S.dashQ || '').toLowerCase();
  const who = Store.mode === 'cloud' && Store.user ? Store.user.email : null;
  const head2 = head('My projects', who ? `Hi, ${who.split('@')[0]}` : 'Your projects',
    Store.mode === 'cloud' ? 'Every project is saved to your account and private to you.' : `Local mode: sign-in is off. ${Store.localReason || ''} Projects are saved in this browser.`,
    `<button class="btn pri" data-act="newproj">+ New project</button>`);
  const verify = Store.mode === 'cloud' && Store.user && Store.user.emailVerified === false
    ? `<div class="banner"><div style="flex:1;min-width:220px"><b>Verify your email.</b> We sent a link to ${esc(Store.user.email)}. Verifying lets you reset your password later.</div><button class="btn sm" data-act="resendverify">Send again</button></div>` : '';
  if (list === null) return `${verify}${head2}<p class="muted">Loading your projects…</p>`;
  if (S.listErr) return `${head2}<div class="banner"><div style="flex:1"><b>Could not load projects.</b> ${esc(S.listErr)}</div><button class="btn sm" data-act="reload">Try again</button></div>`;
  const shown = list.filter(x => !q || (x.name + ' ' + (x.summary.company || '') + ' ' + (x.summary.sector || '')).toLowerCase().includes(q));
  const byMode = [1, 2, 3].map(m => list.filter(x => (x.mode || x.summary.mode) === m).length);
  const week = list.filter(x => Date.now() - x.updated < 7 * 86400000).length;
  const card = x => { const s = x.summary || {}; const set = { currency: s.currency || 'INR', numSystem: s.numSystem || 'indian', unit: s.unit || 1e5 };
    return `<article class="card pcard">
      <div class="row" style="justify-content:space-between"><span class="row" style="gap:6px"><span class="pill mode">Mode ${x.mode || s.mode || 1}</span>${(PAY.unlocks[x.id] || 0) >= (x.mode || s.mode || 1) ? '<span class="pill ok">Unlocked</span>' : ''}</span><span class="small muted">${esc(relTime(x.updated))}</span></div>
      <h3 style="margin:0">${esc(x.name || 'Untitled project')}</h3>
      <div class="small muted">${esc([s.sector, s.city].filter(Boolean).join(' · ') || '—')}</div>
      <div class="small">${s.total != null ? `Project cost <b class="num">${esc(miniMoney(s.total, set))}</b>` : ''}${s.dscr != null ? ` · DSCR <b class="num">${(+s.dscr).toFixed(2)}×</b>` : ''}</div>
      <div class="row" style="margin-top:auto;padding-top:6px"><button class="btn sm pri" data-act="open" data-v="${esc(x.id)}">Open</button><button class="btn sm" data-act="dup" data-v="${esc(x.id)}">Duplicate</button>
      ${S.confirmDel === x.id ? `<button class="btn sm danger" data-act="delyes" data-v="${esc(x.id)}">Confirm delete</button><button class="btn sm ghost" data-act="delno">Cancel</button>` : `<button class="btn sm ghost danger" data-act="delp" data-v="${esc(x.id)}">Delete</button>`}</div>
    </article>`; };
  return `${verify}${head2}
  ${list.length ? `<div class="kpis">${kpi('Projects', fn(list.length), `${week} updated this week`, 'feature')}${kpi('General DPR', fn(byMode[0]), 'Mode 1')}${kpi('Bank / MSME', fn(byMode[1]), 'Mode 2')}${kpi('Bank + CMA', fn(byMode[2]), 'Mode 3')}</div>` : ''}
  ${list.length > 5 ? `<label class="f" style="max-width:360px"><span>Search</span><input id="dashQ" type="search" value="${esc(S.dashQ || '')}" placeholder="Project, company or sector"></label>` : ''}
  <div class="grid g3">
    <button class="card newcard" data-act="newproj"><span class="plus" aria-hidden="true">+</span><b>New project</b><span class="small muted">Name it, pick the purpose and finance type. Takes a minute.</span></button>
    ${shown.map(card).join('')}
    ${!list.length ? `<button class="card newcard ex" data-act="example"><span class="plus" aria-hidden="true">↗</span><b>Look at an example</b><span class="small muted">A finished Mode 3 report for a CNC machining unit. Nothing is saved.</span></button>` : ''}
  </div>
  ${list.length ? `<p class="small muted">Want to see a complete report first? <button class="linkbtn" data-act="example">Open the example project</button></p>` : ''}
  <p class="small muted" style="margin:0"><a href="/pricing" target="_blank" rel="noopener">Pricing</a> · <a href="/terms" target="_blank" rel="noopener">Terms</a> · <a href="/privacy" target="_blank" rel="noopener">Privacy</a> · <a href="/refund" target="_blank" rel="noopener">Refunds</a> · <a href="/contact" target="_blank" rel="noopener">Contact</a></p>`;
}

/* ---- new project wizard ---- */
function vNewProject() {
  const d = S.modal.draft; const step = S.modal.step;
  const chip = (k, v, multi) => { const on = multi ? d[k].includes(v) : d[k] === v; return `<button class="chip ${on ? 'on' : ''}" aria-pressed="${on}" data-act="dchip" data-k="${k}" data-v="${esc(v)}" data-multi="${multi ? 1 : ''}">${esc(v)}</button>`; };
  const sug = d.financeMode !== 'Bank' ? 1 : d.existing ? 3 : 2;
  const mode = d.mode || sug;
  const body = step === 1 ? `
      <label class="f"><span>Project name</span><input id="np_name" data-d="name" value="${esc(d.name)}" placeholder="e.g. Sri Lakshmi Rice Mill expansion" required></label>
      <label class="f"><span>Company / business name</span><input id="np_company" data-d="company" value="${esc(d.company)}" placeholder="Registered name"></label>
      <div class="grid g2"><label class="f"><span>Sector</span><select id="np_sector" data-d="sector">${SECTORS.map(s => `<option ${s === d.sector ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="f"><span>City / location</span><input id="np_city" data-d="city" value="${esc(d.city)}" placeholder="City"></label></div>`
    : step === 2 ? `
      <p class="small muted" style="margin:0">Purpose — pick all that apply</p><div class="chips">${PURPOSES.map(p => chip('purposes', p, true)).join('')}</div>
      <p class="small muted" style="margin:6px 0 0">Finance</p><div class="chips">${['Self', 'Bank', 'Investor'].map(v => `<button class="chip ${d.financeMode === v ? 'on' : ''}" aria-pressed="${d.financeMode === v}" data-act="dchip" data-k="financeMode" data-v="${v}">${{ Self: 'Self-funded', Bank: 'Bank / financial institution', Investor: 'Investor funding' }[v]}</button>`).join('')}</div>
      <label class="row small"><input type="checkbox" id="np_existing" data-d="existing" ${d.existing ? 'checked' : ''}> Existing business with past financial statements</label>`
    : `
      <p class="small muted" style="margin:0">Report mode${mode === sug ? ' (suggested from your answers)' : ''}</p>
      <div class="modes">${MODES.map(m => `<button class="mode ${mode === m.n ? 'on' : ''}" aria-pressed="${mode === m.n}" data-act="dmode" data-v="${m.n}"><b>Mode ${m.n} · ${esc(m.name)}</b><span>${esc(m.desc)}</span></button>`).join('')}</div>
      <div class="grid g3"><label class="f"><span>Country</span><input id="np_country" data-d="country" value="${esc(d.country)}"></label>
      <label class="f"><span>Currency</span><select id="np_currency" data-d="currency">${CURRENCIES.map(c => `<option value="${c[0]}" ${c[0] === d.currency ? 'selected' : ''}>${c[0]} — ${esc(c[1])}</option>`).join('')}</select></label>
      <label class="f"><span>Start with</span><select id="np_start" data-d="start"><option value="blank" ${d.start === 'blank' ? 'selected' : ''}>Blank inputs</option><option value="example" ${d.start === 'example' ? 'selected' : ''}>Example figures (edit later)</option></select></label></div>`;
  const canNext = step !== 1 || String(d.name).trim();
  return `<div class="overlay" data-act="closemodal"><div class="card modal" role="dialog" aria-modal="true" aria-labelledby="npt" data-stop="1">
    <div class="eyebrow">New project · step ${step} of 3</div><h2 id="npt" style="margin-bottom:14px">${['Name the project', 'What is it for?', 'Mode and currency'][step - 1]}</h2>
    <div class="steps" aria-hidden="true">${[1, 2, 3].map(i => `<i class="${i <= step ? 'on' : ''}"></i>`).join('')}</div>
    <div class="grid" style="gap:14px">${body}</div>
    <div class="row" style="margin-top:18px;justify-content:space-between"><button class="btn ghost" data-act="${step === 1 ? 'closemodal' : 'npback'}">${step === 1 ? 'Cancel' : 'Back'}</button>
    ${step < 3 ? `<button class="btn pri" data-act="npnext" ${canNext ? '' : 'disabled'}>Continue</button>` : `<button class="btn pri" data-act="npcreate" ${S.busy.create ? 'disabled' : ''}>${S.busy.create ? 'Creating…' : 'Create project'}</button>`}</div>
  </div></div>`;
}
function newDraft() {
  const last = LS.get('bz-last-currency') || 'INR';
  return { name: '', company: '', sector: 'Manufacturing', city: '', purposes: ['New Business / Startup'], financeMode: 'Bank', existing: false, mode: 0, country: last === 'INR' ? 'India' : '', currency: last, start: 'blank' };
}
function buildFromDraft(d) {
  const p = d.start === 'example' ? exampleProject() : blankProject();
  p.id = newId(); p.example = false; p.name = d.name.trim() || 'Untitled project';
  p.company.name = d.company.trim() || (d.start === 'example' ? p.company.name : '');
  if (d.city.trim()) p.company.city = d.city.trim();
  p.setup.sector = d.sector; p.setup.purposes = d.purposes.length ? d.purposes.slice() : ['General Project Report'];
  p.setup.financeMode = d.financeMode; p.setup.existing = d.existing;
  p.settings.mode = d.mode || (d.financeMode !== 'Bank' ? 1 : d.existing ? 3 : 2);
  p.settings.country = d.country.trim(); p.settings.currency = d.currency;
  p.settings.numSystem = d.currency === 'INR' ? 'indian' : 'intl'; p.settings.unit = d.currency === 'INR' ? 1e5 : 1e3;
  p.narrative = {}; p.updated = Date.now();
  if (d.start !== 'example' && !d.existing) p.historical = [];
  LS.set('bz-last-currency', d.currency);
  return normalize(p);
}
