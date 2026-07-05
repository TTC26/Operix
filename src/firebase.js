import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDoc, getDocFromCache, setDoc, onSnapshot, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import {
  getAuth,
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
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalForceLongPolling: true,
});
export const auth = getAuth(app);
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
  await setPersistence(auth, keepLoggedIn ? browserLocalPersistence : browserSessionPersistence);
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

export async function loadCompanyData(uid) {
  try {
    const snap = await getDoc(COMPANY_DOC(uid));
    if (snap.exists()) return snap.data();
    return null;
  } catch (e) {
    if (e.code === 'unavailable') {
      try {
        const cached = await getDocFromCache(COMPANY_DOC(uid));
        if (cached.exists()) return cached.data();
      } catch {}
      return null;
    }
    throw e;
  }
}

export async function saveCompanyData(uid, data) {
  await setDoc(COMPANY_DOC(uid), data, { merge: true });
}

export function subscribeCompanyData(uid, callback) {
  return onSnapshot(COMPANY_DOC(uid), (snap) => {
    if (snap.exists()) callback(snap.data());
  });
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
