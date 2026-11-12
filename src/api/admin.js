// Admin panel API. GET: list users and grants. POST {email, fullAccess, note}: give or remove full access.
import { requireUser, adminApp, db, sendError } from './_admin.js';
import { isAdminUser, adminEmails } from './_access.js';
import admin from 'firebase-admin';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const me = await requireUser(req);
    if (!isAdminUser(me)) return res.status(403).json({ error: me.email_verified ? 'This account is not an admin.' : 'Verify your email first, then reload.' });

    if (req.method === 'GET') {
      const auth = adminApp().auth();
      const users = []; let token;
      do { const page = await auth.listUsers(1000, token); users.push(...page.users); token = page.pageToken; } while (token && users.length < 5000);
      const grantsSnap = await db().collection('grants').get();
      const grants = {}; grantsSnap.docs.forEach(d => { grants[d.id] = d.data(); });
      const rows = await Promise.all(users.map(async u => {
        const email = (u.email || '').toLowerCase();
        let projects = null, paid = null;
        try { projects = (await db().collection(`users/${u.uid}/projects`).count().get()).data().count; } catch (e) { }
        try { paid = (await db().collection(`users/${u.uid}/unlocks`).count().get()).data().count; } catch (e) { }
        const g = grants[email];
        return { uid: u.uid, email: u.email || '', verified: !!u.emailVerified, disabled: !!u.disabled,
          created: u.metadata.creationTime ? Date.parse(u.metadata.creationTime) : null,
          lastSignIn: u.metadata.lastSignInTime ? Date.parse(u.metadata.lastSignInTime) : null,
          projects, paid, admin: adminEmails().includes(email), fullAccess: !!(g && g.fullAccess), note: g ? g.note || '' : '' };
      }));
      const known = new Set(rows.map(r => r.email.toLowerCase()));
      const pending = Object.entries(grants).filter(([e, g]) => g.fullAccess && !known.has(e)).map(([e, g]) => ({ email: e, note: g.note || '', grantedAt: g.grantedAt ? g.grantedAt.toMillis() : null }));
      rows.sort((a, b) => (b.created || 0) - (a.created || 0));
      return res.status(200).json({ users: rows, pending, admins: adminEmails() });
    }

    if (req.method === 'POST') {
      const { email, fullAccess, note } = req.body || {};
      const e = String(email || '').trim().toLowerCase();
      if (!EMAIL.test(e) || e.length > 200) return res.status(400).json({ error: 'Enter a valid email address.' });
      const ref = db().doc('grants/' + e);
      if (fullAccess) {
        await ref.set({ fullAccess: true, note: String(note || '').slice(0, 200), grantedBy: me.email, grantedAt: admin.firestore.FieldValue.serverTimestamp() });
      } else {
        await ref.delete();
      }
      return res.status(200).json({ ok: true, email: e, fullAccess: !!fullAccess });
    }
    res.setHeader('Allow', 'GET, POST');
    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { sendError(res, e); }
}
