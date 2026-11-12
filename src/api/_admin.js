// Firebase Admin (server only). Needs FIREBASE_SERVICE_ACCOUNT = the service-account JSON
// from Firebase → Project settings → Service accounts → Generate new private key.
import admin from 'firebase-admin';

export function adminApp() {
  if (admin.apps.length) return admin.app();
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT is not set in Vercel.'), { status: 503 });
  let sa;
  try { sa = JSON.parse(raw); } catch (e) { throw Object.assign(new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.'), { status: 503 }); }
  if (sa.private_key) sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  return admin.initializeApp({ credential: admin.credential.cert(sa) });
}
export async function requireUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) throw Object.assign(new Error('Sign in to continue.'), { status: 401 });
  try { return await adminApp().auth().verifyIdToken(h.slice(7)); }
  catch (e) { if (e.status) throw e; throw Object.assign(new Error('Your session has expired. Sign in again.'), { status: 401 }); }
}
export function db() { return adminApp().firestore(); }
export function sendError(res, e) { res.status(e.status || 500).json({ error: e.status ? e.message : 'Something went wrong. Try again.' }); if (!e.status) console.error(e); }
