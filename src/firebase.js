import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, doc, getDoc, getDocFromServer, setDoc, updateDoc, onSnapshot, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, uploadString, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import {
  getAuth,
  initializeAuth,
  indexedDBLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  sendPasswordResetEmail,
  reload,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB5WOHI70_Zu-By8USC7zKzS12EAeAWTGQ",
  authDomain: "operix-15516.firebaseapp.com",
  projectId: "operix-15516",
  storageBucket: "operix-15516.firebasestorage.app",
  messagingSenderId: "203137257066",
  appId: "1:203137257066:web:c6459db047f3dd16158413"
};

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, 'default'); // <-- IMPORTANT: this project's Firestore database is named 'default'
              //     (not the standard '(default)'). Without this the app talked to a
              //     non-existent database, so no data ever reached the server.
// PWA-safe durable session: prefer IndexedDB (survives standalone PWA restarts),
// fall back to localStorage, then session. initializeAuth sets this at startup so
// a previously signed-in user is restored on reload without re-entering password.
let _auth;
try {
  _auth = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
  });
} catch (e) {
  // Already initialized (hot reload) or unsupported — fall back to getAuth.
  _auth = getAuth(app);
}
export const auth = _auth;
export const storage = getStorage(app);

// Secondary app removed — staff accounts are now created via REST API (no SDK,
// no IndexedDB init, no auth session interference).

export async function signUp(email, password, companyName) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (companyName) {
    await updateProfile(cred.user, { displayName: companyName });
  }
  await sendEmailVerification(cred.user);
  return cred.user;
}

export async function resendVerificationEmail(user) {
  await sendEmailVerification(user);
}

export async function resetPassword(email) {
  await sendPasswordResetEmail(auth, email);
}

export async function refreshUser(user) {
  await reload(user);
  return user;
}

export async function signIn(email, password, keepLoggedIn = true) {
  try {
    await setPersistence(auth, keepLoggedIn ? indexedDBLocalPersistence : browserSessionPersistence);
  } catch (e) {
    // Storage blocked (private mode / PWA quirk) — fall back to localStorage, then session.
    try { await setPersistence(auth, keepLoggedIn ? browserLocalPersistence : browserSessionPersistence); } catch (e2) {}
  }
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function logOut() {
  await signOut(auth);
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

const COMPANY_DOC = (uid) => doc(db, 'companies', uid);
// Each data section lives in its OWN document under companies/{uid}/parts so no
// single document ever approaches Firestore's 1 MB limit, however large the data.
const PART_DOC = (uid, key) => doc(db, 'companies', uid, 'parts', key);
const PARTS_COL = (uid) => collection(db, 'companies', uid, 'parts');

export async function loadCompanyData(uid) {
  try {
    const [mainSnap, partsSnap] = await Promise.all([
      getDoc(COMPANY_DOC(uid)),
      getDocs(PARTS_COL(uid)),
    ]);
    const main = mainSnap.exists() ? mainSnap.data() : {};
    const parts = {};
    partsSnap.forEach((d) => { const dd = d.data(); parts[d.id] = dd && 'v' in dd ? dd.v : dd; });
    const merged = { ...main, ...parts };
    return Object.keys(merged).length ? merged : null;
  } catch (e) {
    if (e.code === 'unavailable') return null;
    throw e;
  }
}

export async function saveCompanyData(uid, data) {
  // Write each top-level key to its own document. Small, isolated writes that
  // never hit the 1 MB per-document limit and always reach the server.
  const entries = Object.entries(data || {});
  await Promise.all(entries.map(([k, v]) => setDoc(PART_DOC(uid, k), { v: v === undefined ? null : v })));
}

// Diagnostic: write a tiny doc then force-read it back FROM THE SERVER (not cache).
// Proves whether writes actually reach Firestore, and surfaces the exact error.
export async function testServerWrite(uid) {
  const ref = doc(db, 'companies', uid, 'parts', '_conntest');
  await setDoc(ref, { v: Date.now() });
  const snap = await getDocFromServer(ref);
  return snap.exists() ? snap.data() : null;
}

// ─── Branding media (separate document) ───────────────────────────────────────
// Logo, letterhead images and letterhead HTML are large base64 blobs. Kept in the
// main company document they can push it past Firestore's 1 MB per-document limit,
// which makes every save silently fail to reach the server. We store them in their
// own document so the main document always stays small and saves always succeed.
const BRANDING_DOC = (uid) => doc(db, 'companies', uid, 'meta', 'branding');

export async function loadBranding(uid) {
  try {
    const snap = await getDoc(BRANDING_DOC(uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.warn('loadBranding:', e.message);
    return null;
  }
}

export async function saveBranding(uid, branding) {
  await setDoc(BRANDING_DOC(uid), branding || {}, { merge: true });
}

// One-time migration: replace the main document's businessInfo map with a
// branding-free version. updateDoc replaces the field wholesale (unlike setDoc
// merge), so the heavy base64 keys are dropped and the document shrinks.
export async function stripBrandingFromMain(uid, coreBusinessInfo) {
  await updateDoc(COMPANY_DOC(uid), { businessInfo: coreBusinessInfo });
}

// ─── Cloud backups (server-side version history, device-independent) ──────────
// Full snapshots of the company data are stored as JSON files in Firebase Storage.
// Storage has no 1 MB limit, snapshots live on the server (not one browser), and
// any admin can list/restore them from any device or PC. A rolling history is kept.
const BACKUP_FOLDER = (uid) => `companies/${uid}/backups`;

export async function saveServerBackup(uid, dataObject, keep = 10) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const path = `${BACKUP_FOLDER(uid)}/backup-${stamp}.json`;
  const json = JSON.stringify({ ...dataObject, _backupAt: new Date().toISOString() });
  await uploadString(ref(storage, path), json, 'raw', { contentType: 'application/json' });
  // Prune: keep only the newest `keep` snapshots (ISO filenames sort chronologically).
  try {
    const { items } = await listAll(ref(storage, BACKUP_FOLDER(uid)));
    const names = items.map((i) => i.name).sort();
    const excess = names.slice(0, Math.max(0, names.length - keep));
    await Promise.all(excess.map((n) => deleteObject(ref(storage, `${BACKUP_FOLDER(uid)}/${n}`)).catch(() => {})));
  } catch (_e) {}
  return path;
}

export async function listServerBackups(uid) {
  try {
    const { items } = await listAll(ref(storage, BACKUP_FOLDER(uid)));
    return items
      .map((i) => i.name)
      .sort()
      .reverse()
      .map((name) => ({
        name,
        path: `${BACKUP_FOLDER(uid)}/${name}`,
        label: name.replace(/^backup-/, '').replace(/\.json$/, ''),
      }));
  } catch (e) {
    console.warn('listServerBackups:', e.message);
    return [];
  }
}

export async function fetchServerBackup(path) {
  const url = await getDownloadURL(ref(storage, path));
  const res = await fetch(url);
  if (!res.ok) throw new Error('download failed (' + res.status + ')');
  return await res.json();
}

export function subscribeCompanyData(uid, callback, onError) {
  // Data spans the legacy main document + the companies/{uid}/parts subcollection.
  // Listen to both and merge (parts take precedence). Retry main on auth races.
  let mainData = {};
  let partsData = {};
  let unsubMain = null, unsubParts = null;
  let attempts = 0;
  const emit = () => callback({ ...mainData, ...partsData });

  function attachMain() {
    unsubMain = onSnapshot(
      COMPANY_DOC(uid),
      (snap) => { attempts = 0; mainData = snap.exists() ? snap.data() : {}; emit(); },
      (err) => {
        console.warn('subscribe main error:', err.code, err.message);
        if (err.code === 'permission-denied' && attempts < 3) { attempts++; setTimeout(attachMain, 800 * attempts); }
        else if (onError) onError(err);
      }
    );
  }
  function attachParts() {
    unsubParts = onSnapshot(
      PARTS_COL(uid),
      (qs) => { const p = {}; qs.forEach((d) => { const dd = d.data(); p[d.id] = dd && 'v' in dd ? dd.v : dd; }); partsData = p; emit(); },
      (err) => { console.warn('subscribe parts error:', err.code, err.message); }
    );
  }

  attachMain();
  attachParts();
  return () => { if (unsubMain) unsubMain(); if (unsubParts) unsubParts(); };
}

export async function getMembership(uid) {
  const snap = await getDoc(doc(db, 'staff_memberships', uid));
  if (snap.exists()) return snap.data();
  return null;
}

export async function createStaffAccount(ownerUid, email, password, name, role, companyName = '', empId = '', empNo = '') {
  const withTimeout = (promise, ms = 45000) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

  const REST = (endpoint, body) =>
    fetch(`https://identitytoolkit.googleapis.com/v1/accounts:${endpoint}?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(r => r.json());

  // ── Step 1: Create Firebase Auth account via REST ──────────────────────────
  let staffUid, idToken;

  const signUpRes = await withTimeout(REST('signUp', { email, password, returnSecureToken: true }));

  if (signUpRes.error) {
    const msg = (signUpRes.error.message || 'UNKNOWN');

    // EMAIL_EXISTS = account was created in a previous timed-out attempt.
    // Recover by signing in with the same password to obtain the existing UID.
    if (msg === 'EMAIL_EXISTS') {
      const signInRes = await withTimeout(
        REST('signInWithPassword', { email, password, returnSecureToken: true }),
        15000
      );
      if (signInRes.error) {
        // Wrong password or other error — can't recover automatically
        const err = new Error('EMAIL_EXISTS');
        err.code = 'auth/email-already-in-use';
        throw err;
      }
      staffUid = signInRes.localId;
      idToken  = signInRes.idToken;
      // Fall through to write/overwrite the Firestore docs
    } else {
      const code = msg.toLowerCase().replace(/_/g, '-');
      const err = new Error(msg);
      err.code = `auth/${code}`;
      throw err;
    }
  } else {
    staffUid = signUpRes.localId;
    idToken  = signUpRes.idToken;
  }

  // ── Step 2: Set displayName + emailVerified (best-effort, 8s) ─────────────
  if (idToken) {
    try {
      await withTimeout(
        REST('update', { idToken, displayName: name || '', emailVerified: true }),
        8000
      );
    } catch (_) {}
  }

  // ── Step 3: Firestore writes ───────────────────────────────────────────────
  // staff_memberships — best-effort (Firestore rules may block cross-uid writes)
  try {
    await withTimeout(setDoc(doc(db, 'staff_memberships', staffUid), {
      ownerUid, role, name, email, companyName,
    }), 15000);
  } catch (_) {}

  // company staff subcollection — owner writing to own company, should always succeed
  await withTimeout(setDoc(doc(db, 'companies', ownerUid, 'staff', staffUid), {
    uid: staffUid, name, email, role, companyName, createdAt: Date.now(),
    ...(empId ? { empId, empNo } : {}),
  }), 15000);

  // email index — best-effort
  try {
    await withTimeout(setDoc(doc(db, 'staff_email_index', email.toLowerCase()), {
      companyName, ownerUid,
    }), 8000);
  } catch (_) {}

  return staffUid;
}

// Lookup company name for a given email (used on sign-in page before auth)
export async function lookupStaffEmail(email) {
  try {
    const snap = await getDoc(doc(db, 'staff_email_index', email.toLowerCase()));
    if (snap.exists()) return snap.data(); // { companyName, ownerUid }
    return null;
  } catch {
    return null;
  }
}

export async function getStaffList(ownerUid) {
  const snap = await getDocs(collection(db, 'companies', ownerUid, 'staff'));
  return snap.docs.map((d) => d.data());
}

export async function removeStaff(ownerUid, staffUid, email = '') {
  await deleteDoc(doc(db, 'companies', ownerUid, 'staff', staffUid));
  await deleteDoc(doc(db, 'staff_memberships', staffUid));
  if (email) {
    try { await deleteDoc(doc(db, 'staff_email_index', email.toLowerCase())); } catch (_) {}
  }
}

export async function updateStaffRole(ownerUid, staffUid, newRole) {
  await setDoc(doc(db, 'companies', ownerUid, 'staff', staffUid), { role: newRole }, { merge: true });
  await setDoc(doc(db, 'staff_memberships', staffUid), { role: newRole }, { merge: true });
}

export async function uploadDrawing(ownerUid, folder, file) {
  const path = `companies/${ownerUid}/${folder}/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return { url, path, name: file.name, type: file.type, uploadedAt: Date.now() };
}

export async function deleteDrawing(filePath) {
  try {
    const storageRef = ref(storage, filePath);
    await deleteObject(storageRef);
  } catch (e) {
    console.warn('deleteDrawing:', e.message);
  }
}

// ─── Account deletion helpers ─────────────────────────────────────────────────

export async function reauthenticateUser(user, password) {
  const credential = EmailAuthProvider.credential(user.email, password);
  await reauthenticateWithCredential(user, credential);
}

export async function deleteAllCompanyFirestore(ownerUid) {
  // Delete main company document FIRST — all business data lives here.
  // Even if staff cleanup below fails or the caller's timeout hits, the primary data is gone.
  await deleteDoc(doc(db, 'companies', ownerUid));
  // Delete the parts subcollection (business data now lives here).
  try {
    const partsSnap = await getDocs(collection(db, 'companies', ownerUid, 'parts'));
    await Promise.all(partsSnap.docs.map((d) => deleteDoc(d.ref)));
  } catch (e) { console.warn('parts cleanup (non-fatal):', e); }
  // Best-effort: clean up staff subcollection docs + their memberships.
  // Failures here are non-fatal; orphaned docs don't affect new sign-ups (new UID).
  try {
    const staffSnap = await getDocs(collection(db, 'companies', ownerUid, 'staff'));
    await Promise.all([
      ...staffSnap.docs.map(d => deleteDoc(d.ref)),
      ...staffSnap.docs.map(d => deleteDoc(doc(db, 'staff_memberships', d.id))),
    ]);
  } catch (e) {
    console.warn('Staff subcollection cleanup (non-fatal):', e);
  }
}

export async function deleteCompanyStorage(ownerUid) {
  try {
    async function deleteFolder(folderRef) {
      const { items, prefixes } = await listAll(folderRef);
      await Promise.all([
        ...items.map(item => deleteObject(item).catch(() => {})),
        ...prefixes.map(p => deleteFolder(p)),
      ]);
    }
    await deleteFolder(ref(storage, `companies/${ownerUid}`));
  } catch (e) {
    console.warn('deleteCompanyStorage:', e.message);
  }
}

export async function deleteFirebaseUser(user) {
  await deleteUser(user);
}
