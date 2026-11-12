/* ===== Admin panel: users and full-access grants ===== */
const ADMIN = { data: null, err: '', q: '', busy: {} };

async function authedFetch(url, opts = {}) {
  const tok = await Store.idToken();
  const r = await fetch(url, { ...opts, headers: { 'content-type': 'application/json', ...(opts.headers || {}), authorization: 'Bearer ' + tok } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('Request failed (' + r.status + ')'));
  return j;
}
async function loadAccess() {
  S.isAdmin = false; PAY.fullAccess = false;
  if (Store.mode !== 'cloud' || !Store.user) return;
  try { const j = await authedFetch('/api/access'); S.isAdmin = !!j.isAdmin; PAY.fullAccess = !!j.fullAccess; } catch (e) { }
}
async function loadAdmin() {
  ADMIN.err = ''; ADMIN.data = null; render();
  try { ADMIN.data = await authedFetch('/api/admin'); } catch (e) { ADMIN.err = e.message; }
  render();
}
async function setGrant(email, on, note) {
  ADMIN.busy[email] = true; render();
  try {
    await authedFetch('/api/admin', { method: 'POST', body: JSON.stringify({ email, fullAccess: on, note: note || '' }) });
    toast(on ? `Full access given to ${email}.` : `Full access removed for ${email}.`);
    if (Store.user && email === String(Store.user.email || '').toLowerCase()) await loadAccess();
    ADMIN.busy[email] = false; await loadAdmin();
  } catch (e) { ADMIN.busy[email] = false; render(); toast(e.message); }
}
function adminGrantFromForm() {
  const email = (document.getElementById('ad_email') || {}).value || '';
  const note = (document.getElementById('ad_note') || {}).value || '';
  if (!email.trim()) { toast('Enter an email address.'); return; }
  setGrant(email.trim().toLowerCase(), true, note.trim());
}
function vAdmin() {
  const d = ADMIN.data; const q = ADMIN.q.toLowerCase();
  const head2 = head('Admin', 'Users and access', 'Give full access to any email: every report unlocks free, PDF and Word included. It applies once that person signs in with a verified email.',
    `<button class="btn" data-act="adminreload">Refresh</button>`);
  const form = `<div class="card"><h3>Give full access</h3>
    <form class="grid g3" data-form="admingrant" style="align-items:end">
      <label class="f"><span>Email</span><input id="ad_email" type="email" required placeholder="friend@gmail.com"></label>
      <label class="f"><span>Note (optional)</span><input id="ad_note" placeholder="e.g. CA partner, beta tester"></label>
      <button class="btn pri" type="submit" style="justify-content:center">Give full access</button>
    </form>
    <p class="small muted" style="margin:10px 0 0">Works for people who haven't signed up yet. They get access as soon as they create an account and verify the email.</p></div>`;
  if (ADMIN.err) return `${head2}<div class="banner"><div style="flex:1"><b>Could not load the admin panel.</b> ${esc(ADMIN.err)}</div><button class="btn sm" data-act="adminreload">Try again</button></div>`;
  if (!d) return `${head2}${form}<p class="muted">Loading users…</p>`;
  const users = d.users.filter(u => !q || (u.email + ' ' + u.note).toLowerCase().includes(q));
  const dt = ts => ts ? new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const access = u => u.admin ? pill('ok', 'Admin') : u.fullAccess ? pill('ok', 'Full access') : pill('na', 'Standard');
  const btn = u => u.admin ? '' : u.fullAccess
    ? `<button class="btn sm danger" data-act="admintoggle" data-v="${esc(u.email.toLowerCase())}" data-on="0" ${ADMIN.busy[u.email.toLowerCase()] ? 'disabled' : ''}>Remove access</button>`
    : `<button class="btn sm pri" data-act="admintoggle" data-v="${esc(u.email.toLowerCase())}" data-on="1" ${ADMIN.busy[u.email.toLowerCase()] ? 'disabled' : ''}>Give full access</button>`;
  const total = d.users.length, granted = d.users.filter(u => u.fullAccess).length, paidUsers = d.users.filter(u => u.paid).length;
  return `${head2}
  <div class="kpis">${kpi('Users', fn(total), `${d.users.filter(u => u.verified).length} verified`, 'feature')}${kpi('Full access', fn(granted + d.pending.length), `${d.pending.length} not signed up yet`)}${kpi('Paying users', fn(paidUsers), 'At least one paid report')}${kpi('Projects', fn(d.users.reduce((s, u) => s + (u.projects || 0), 0)), 'Across all users')}</div>
  ${form}
  ${d.pending.length ? `<div class="card"><h3>Waiting to sign up</h3><div class="tw"><table><thead><tr><th>Email</th><th>Note</th><th></th></tr></thead><tbody>
    ${d.pending.map(p => `<tr><td>${esc(p.email)}</td><td>${esc(p.note)}</td><td style="text-align:right"><button class="btn sm danger" data-act="admintoggle" data-v="${esc(p.email)}" data-on="0">Remove</button></td></tr>`).join('')}</tbody></table></div></div>` : ''}
  <div class="card"><div class="row" style="justify-content:space-between;margin-bottom:12px"><h3 style="margin:0">All users</h3>
    <label class="f" style="min-width:240px"><input id="adminQ" type="search" value="${esc(ADMIN.q)}" placeholder="Search email or note" aria-label="Search users"></label></div>
    <div class="tw"><table><thead><tr><th>Email</th><th>Verified</th><th>Access</th><th class="n">Projects</th><th class="n">Paid reports</th><th>Joined</th><th>Last sign-in</th><th></th></tr></thead><tbody>
    ${users.map(u => `<tr><td>${esc(u.email)}${u.note ? `<div class="small muted">${esc(u.note)}</div>` : ''}</td><td>${u.verified ? pill('ok', 'Yes') : pill('warn', 'No')}</td><td>${access(u)}</td>
      <td class="n">${u.projects ?? '–'}</td><td class="n">${u.paid ?? '–'}</td><td>${dt(u.created)}</td><td>${dt(u.lastSignIn)}</td><td style="text-align:right">${btn(u)}</td></tr>`).join('') || `<tr><td colspan="8" class="muted">No users match.</td></tr>`}
    </tbody></table></div>
    <p class="small muted" style="margin:10px 0 0">Full access only works for verified emails, so nobody can claim it by signing up with someone else's address. Admins: ${esc(d.admins.join(', '))}.</p></div>`;
}
function adminShell() { return `<div class="app dash">${topBar(false)}<main class="main"><div class="wrap">${vAdmin()}</div></main></div>`; }
