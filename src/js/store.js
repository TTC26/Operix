/* ===== Store: accounts + projects ===== */
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
};
function newId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}
function projectSummary(p, R) {
  return { total: R ? R.pc.total : null, dscr: R ? R.avgDscr : null, sector: p.setup.sector, city: p.company.city || '', company: p.company.name || '',
    currency: p.settings.currency, numSystem: p.settings.numSystem, unit: p.settings.unit, mode: +p.settings.mode || 1 };
}

/* Cloud mode: Firebase Authentication (email) + Cloud Firestore at users/{uid}/projects/{id} (see firestore.rules).
   Local mode: used when /api/config has no Firebase config (e.g. local development). Projects live in this browser. */
const Store = {
  mode: 'local', fb: null, auth: null, db: null, user: null, listeners: [], ready: false,
  onAuth(fn) { this.listeners.push(fn); },
  emit(event) { this.listeners.forEach(fn => { try { fn(event, this.user); } catch (e) { console.error(e); } }); },

  async init() {
    let cfg = null;
    try { const r = await fetch('/api/config', { cache: 'no-store' }); if (r.ok) cfg = await r.json(); } catch (e) { }
    const fc = cfg && cfg.firebase;
    if (!(fc && fc.apiKey && fc.projectId && window.firebase && firebase.initializeApp)) {
      this.mode = 'local'; this.user = { uid: 'local', email: null, local: true };
      this.localReason = !cfg ? 'The app could not reach /api/config (the Vercel function did not answer).' : (cfg.reason || (!window.firebase ? 'The Firebase SDK did not load.' : 'Firebase is not configured.'));
      return;
    }
    this.mode = 'cloud';
    this.fb = firebase.apps.length ? firebase.app() : firebase.initializeApp(fc);
    this.auth = firebase.auth(); this.db = firebase.firestore();
    try { await this.auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); } catch (e) { }
    // Finish an email-link sign-in if this page was opened from the email.
    if (this.auth.isSignInWithEmailLink(location.href)) {
      const email = LS.get('bz-link-email');
      if (email) { try { await this.auth.signInWithEmailLink(email, location.href); LS.set('bz-link-email', ''); } catch (e) { this.linkError = e; } }
      else this.pendingLink = location.href;
      history.replaceState(null, '', location.pathname);
    }
    await new Promise(res => {
      this.auth.onAuthStateChanged(u => {
        const was = this.user; this.user = u || null;
        if (!this.ready) { this.ready = true; res(); return; }
        if (u && !was) this.emit('SIGNED_IN'); else if (!u && was) this.emit('SIGNED_OUT');
      });
    });
  },

  /* ---- auth (cloud only) ---- */
  err(e) {
    const c = (e && e.code) || ''; const map = {
      'auth/invalid-credential': 'Email or password is incorrect.', 'auth/wrong-password': 'Email or password is incorrect.', 'auth/user-not-found': 'Email or password is incorrect.',
      'auth/email-already-in-use': 'An account with this email already exists. Sign in instead.', 'auth/invalid-email': 'Enter a valid email address.',
      'auth/weak-password': 'Use a password of at least 8 characters.', 'auth/too-many-requests': 'Too many attempts. Wait a few minutes and try again.',
      'auth/requires-recent-login': 'For security, sign out and sign in again, then change your password.', 'auth/expired-action-code': 'That link has expired. Request a new one.',
      'auth/invalid-action-code': 'That link is invalid or already used. Request a new one.', 'auth/network-request-failed': 'No connection. Check your internet and try again.',
      'auth/operation-not-allowed': 'This sign-in method is not turned on for this app yet.', 'permission-denied': 'You do not have access to this project.'
    };
    if (c.startsWith('auth/api-key-not-valid') || c === 'auth/invalid-api-key') return new Error('This deployment has a wrong Firebase apiKey. Check FIREBASE_CONFIG in Vercel against Firebase → Project settings → Web API key, then redeploy.');
    if (c === 'auth/unauthorized-domain' || c === 'auth/unauthorized-continue-uri') return new Error('This website domain is not authorised in Firebase. Add it under Authentication → Settings → Authorized domains.');
    return new Error(map[c] || (e && e.message) || String(e));
  },
  async signIn(email, password) { try { await this.auth.signInWithEmailAndPassword(email, password); } catch (e) { throw this.err(e); } },
  async signUp(email, password) {
    try { const cred = await this.auth.createUserWithEmailAndPassword(email, password); try { await cred.user.sendEmailVerification({ url: location.origin + '/app' }); } catch (e) { } return true; }
    catch (e) { throw this.err(e); }
  },
  async sendLink(email) {
    try { await this.auth.sendSignInLinkToEmail(email, { url: location.origin + '/app', handleCodeInApp: true }); LS.set('bz-link-email', email); } catch (e) { throw this.err(e); }
  },
  async finishLink(email) {
    try { await this.auth.signInWithEmailLink(email, this.pendingLink); this.pendingLink = null; LS.set('bz-link-email', ''); } catch (e) { throw this.err(e); }
  },
  async resetPassword(email) { try { await this.auth.sendPasswordResetEmail(email, { url: location.origin + '/app' }); } catch (e) { throw this.err(e); } },
  async setPassword(password) { try { await this.auth.currentUser.updatePassword(password); } catch (e) { throw this.err(e); } },
  async resendVerification() { try { await this.auth.currentUser.sendEmailVerification({ url: location.origin + '/app' }); } catch (e) { throw this.err(e); } },
  async idToken() { return this.auth && this.auth.currentUser ? this.auth.currentUser.getIdToken() : null; },
  async signOut() { if (this.auth) await this.auth.signOut(); this.user = null; },

  /* ---- projects ---- */
  col() { return this.db.collection('users').doc(this.user.uid).collection('projects'); },
  localAll() { try { return JSON.parse(LS.get('dpr-projects') || '{}'); } catch (e) { return {}; } },
  async list() {
    if (this.mode === 'cloud') {
      try {
        const snap = await this.col().orderBy('updatedAt', 'desc').get();
        return snap.docs.map(d => { const r = d.data(); return { id: d.id, name: r.name, mode: r.mode, summary: r.summary || {}, updated: r.updatedAt || 0 }; });
      } catch (e) { throw this.err(e); }
    }
    return Object.values(this.localAll()).map(p => ({ id: p.id, name: p.name, mode: +p.settings.mode || 1, summary: p._summary || {}, updated: p.updated || 0 }))
      .sort((a, b) => b.updated - a.updated);
  },
  async get(id) {
    if (this.mode === 'cloud') {
      try { const d = await this.col().doc(id).get(); if (!d.exists) throw new Error('Project not found.'); return JSON.parse(d.data().dataJson); }
      catch (e) { throw this.err(e); }
    }
    const p = this.localAll()[id]; if (!p) throw new Error('Project not found.'); return clone(p);
  },
  async save(p, R) {
    const summary = projectSummary(p, R); const body = clone(p); delete body._summary; body.updated = Date.now();
    Object.keys(summary).forEach(k => { if (summary[k] == null || (typeof summary[k] === 'number' && !isFinite(summary[k]))) summary[k] = null; });
    if (this.mode === 'cloud') {
      try { await this.col().doc(p.id).set({ name: p.name || 'Untitled project', mode: +p.settings.mode || 1, summary, dataJson: JSON.stringify(body), updatedAt: body.updated }); }
      catch (e) { throw this.err(e); }
    } else {
      const all = this.localAll(); body._summary = summary; all[p.id] = body; LS.set('dpr-projects', JSON.stringify(all));
    }
    return { id: p.id, name: p.name, mode: +p.settings.mode || 1, summary, updated: body.updated };
  },
  async listUnlocks() {
    if (this.mode === 'cloud') {
      const snap = await this.db.collection('users').doc(this.user.uid).collection('unlocks').get();
      const out = {}; snap.docs.forEach(d => { out[d.id] = d.data().mode || 0; }); return out;
    }
    try { return JSON.parse(LS.get('bz-demo-unlocks') || '{}'); } catch (e) { return {}; }
  },
  async remove(id) {
    if (this.mode === 'cloud') { try { await this.col().doc(id).delete(); } catch (e) { throw this.err(e); } return; }
    const all = this.localAll(); delete all[id]; LS.set('dpr-projects', JSON.stringify(all));
  }
};
