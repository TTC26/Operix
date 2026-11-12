/* ===== Pay-per-report unlock (Razorpay) =====
   Excel is free. PDF + Word for a project unlock after one payment for that project.
   Price depends on the report mode; moving to a higher mode later costs only the difference. */
const PAY = { cfg: null, unlocks: {} };

async function loadPayConfig() {
  try { const r = await fetch('/api/pay/prices', { cache: 'no-store' }); PAY.cfg = r.ok ? await r.json() : null; } catch (e) { PAY.cfg = null; }
  if (!PAY.cfg) PAY.cfg = { enabled: false, currency: 'INR', prices: { 1: 599, 2: 999, 3: 1499 }, testMode: false };
}
async function loadUnlocks() { try { PAY.unlocks = await Store.listUnlocks(); } catch (e) { PAY.unlocks = PAY.unlocks || {}; } }
const priceOf = m => (PAY.cfg ? PAY.cfg.prices[m] : { 1: 599, 2: 999, 3: 1499 }[m]);
function paidMode(id) { return (PAY.unlocks[id] || 0); }
function isUnlocked(p) { p = p || S.cur; return !!p && !p.example && (PAY.fullAccess || paidMode(p.id) >= mode()); }
function amountDueNow(p) { p = p || S.cur; const pm = paidMode(p.id); return Math.max(0, priceOf(mode()) - (pm ? priceOf(pm) : 0)); }
const inr = n => '₹' + new Intl.NumberFormat('en-IN').format(n);

function requirePro(kind) {
  if (!isUnlocked()) { S.modal = { kind: 'unlock', want: kind }; render(); return false; }
  const n = blockingCount();
  if (n) { toast(`Fix ${n} blocking issue${n > 1 ? 's' : ''} before generating the final report.`); S.view = 'checks'; render(); return false; }
  return true;
}

function vUnlock() {
  const p = S.cur; const pm = paidMode(p.id); const due = amountDueNow(p); const cfg = PAY.cfg || {};
  const busy = S.busy.pay;
  let action;
  if (p.example) action = `<p class="small" style="margin:0">This is the example project. Save a copy to your projects, then unlock that copy.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="closemodal">Close</button><button class="btn pri" data-act="saveex">Save a copy</button></div>`;
  else if (Store.mode !== 'cloud') action = `<p class="small" style="margin:0;padding:10px 12px;border-radius:var(--r-sm);background:var(--blush-soft)">Local mode: accounts are not configured, so payments are off. This button unlocks the report on this device for testing only.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="closemodal">Not now</button><button class="btn pri" data-act="demounlock">Unlock for testing</button></div>`;
  else if (!cfg.enabled) action = `<p class="small" style="margin:0;padding:10px 12px;border-radius:var(--r-sm);background:var(--warn-bg)">Payments are not switched on for this site yet. The site owner needs to add the Razorpay keys.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn ghost" data-act="closemodal">Close</button></div>`;
  else action = `${cfg.testMode ? `<p class="small" style="margin:0;padding:10px 12px;border-radius:var(--r-sm);background:var(--warn-bg)"><b>Test mode.</b> No real money moves. Use Razorpay's test UPI or test cards.</p>` : ''}
      <div class="row" style="justify-content:space-between"><span class="small muted">Secure payment by Razorpay · UPI, cards, netbanking · <a href="/refund" target="_blank" rel="noopener">Refund policy</a></span>
      <div class="row"><button class="btn ghost" data-act="closemodal" ${busy ? 'disabled' : ''}>Not now</button><button class="btn pri" data-act="pay" ${busy ? 'disabled' : ''}>${busy ? 'Opening payment…' : `Pay ${inr(due)}`}</button></div></div>`;
  return `<div class="overlay" data-act="closemodal"><div class="card modal" role="dialog" aria-modal="true" aria-labelledby="ut" data-stop="1">
    <div class="eyebrow">Unlock report</div>
    <h2 id="ut">${pm ? `Upgrade to Mode ${mode()} for ${inr(due)}` : `Get the final report for ${inr(due)}`}</h2>
    <p class="muted" style="margin:6px 0 14px">${esc(p.name)} · Mode ${mode()} — ${esc(MODES[mode() - 1].name)}. ${pm ? `You already paid for Mode ${pm}; you pay only the difference.` : 'One payment for this project. Edit and re-download as often as you like.'}</p>
    <div class="grid g2" style="margin-bottom:14px">
      <div class="card tint"><h3>Included</h3><ul class="small" style="margin:0;padding-left:18px;line-height:1.8"><li>Bank-ready PDF report</li><li>Editable Word (.docx) report</li><li>Unlimited edits and re-downloads for this project</li><li>Excel model stays free</li></ul></div>
      <div class="card" style="border-color:var(--lime);background:var(--lime-soft)"><h3>Price per report</h3><div class="pricelist">
        ${MODES.map(m => `<div class="${m.n === mode() ? 'on' : ''}"><span>Mode ${m.n} · ${esc(m.name)}</span><b class="num">${inr(priceOf(m.n))}</b></div>`).join('')}
      </div></div>
    </div>
    <div class="grid" style="gap:12px">${action}</div>
  </div></div>`;
}

async function startPayment() {
  const p = S.cur; if (!p || p.example) return;
  S.busy.pay = true; render();
  try {
    await doSave();
    const tok = await Store.idToken();
    const r = await fetch('/api/pay/order', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok }, body: JSON.stringify({ projectId: p.id, mode: mode() }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Could not start the payment.');
    if (j.alreadyUnlocked) { await loadUnlocks(); unlockedDone(); return; }
    await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    const rz = new window.Razorpay({
      key: j.keyId, amount: j.amount, currency: j.currency, order_id: j.orderId,
      name: 'Bizvora', description: `Report unlock — ${p.name} (Mode ${mode()})`, image: location.origin + '/icons/icon-192.png',
      prefill: { email: (Store.user && Store.user.email) || '' }, theme: { color: '#2F7D4F' },
      handler: resp => verifyPayment(resp),
      modal: { ondismiss: () => { S.busy.pay = false; render(); } }
    });
    rz.on('payment.failed', e => { toast('Payment failed: ' + ((e && e.error && e.error.description) || 'try again')); });
    rz.open();
  } catch (e) { S.busy.pay = false; render(); toast(e.message || 'Could not start the payment.'); }
}
async function verifyPayment(resp) {
  S.busy.pay = true; render(); toast('Confirming payment…');
  try {
    const tok = await Store.idToken();
    const r = await fetch('/api/pay/verify', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + tok },
      body: JSON.stringify({ orderId: resp.razorpay_order_id, paymentId: resp.razorpay_payment_id, signature: resp.razorpay_signature }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Payment could not be confirmed.');
    PAY.unlocks[j.projectId] = Math.max(PAY.unlocks[j.projectId] || 0, j.mode);
    unlockedDone();
  } catch (e) {
    S.busy.pay = false; render();
    toast((e.message || 'Payment could not be confirmed.') + ' If money was deducted, email support with payment ID ' + resp.razorpay_payment_id + '.');
  }
}
function unlockedDone() {
  const want = S.modal && S.modal.want; S.busy.pay = false; S.modal = null; render();
  toast('Report unlocked. PDF and Word downloads are ready.');
  if (want === 'pdf') withBusy('pdf', downloadPDF); else if (want === 'docx') withBusy('docx', exportDOCX);
}
function demoUnlock() {
  const all = JSON.parse(LS.get('bz-demo-unlocks') || '{}'); all[S.cur.id] = mode(); LS.set('bz-demo-unlocks', JSON.stringify(all));
  PAY.unlocks[S.cur.id] = mode(); unlockedDone();
}
