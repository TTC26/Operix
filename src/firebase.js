import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, doc, getDoc, getDocFromCache, setDoc, onSnapshot, collection, getDocs, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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
  localCache: persistentLocalCache(),  // persistent cache — serves data even when gRPC is blocked
  experimentalForceLongPolling: true,  // forces HTTP long-polling instead of WebSocket/gRPC (bypasses ISP/firewall blocks)
});
export const auth = getAuth(app);
export const storage = getStorage(app);

// Secondary app instance — used ONLY for staff account creation.
// This prevents the admin's session from being replaced when creating staff accounts
// (Firebase's createUserWithEmailAndPassword logs in as the new user by default).
const secondaryApp = initializeApp(firebaseConfig, 'secondary');
const secondaryAuth = getAuth(secondaryApp);

// ---------- Auth helpers ----------

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

// ---------- Company data (multi-tenant) ----------
// Each company's data lives at /companies/{ownerUid}

const COMPANY_DOC = (uid) => doc(db, 'companies', uid);

// Returns { data, confirmed }:
//   confirmed=true  → Firestore was reachable (or cache hit) — safe to allow saves
//   confirmed=false → offline AND no local cache — block saves until confirmed
export async function loadCompanyData(uid) {
  try {
    const snap = await getDoc(COMPANY_DOC(uid));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    // Offline — try local cache so data still loads when gRPC/WebSocket is blocked
    if (e.code === 'unavailable') {
      try {
        const cached = await getDocFromCache(COMPANY_DOC(uid));
        if (cached.exists()) return cached.data();
      } catch (_) {}
    }
    throw e; // re-throw so App.jsx retry logic fires
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

// ---------- Staff management ----------
// Staff membership:  /staff_memberships/{staffUid}  →  { ownerUid, role, name, email }
// Staff list:        /companies/{ownerUid}/staff/{staffUid}

export async function getMembership(uid) {
  const snap = await getDoc(doc(db, 'staff_memberships', uid));
  if (snap.exists()) return snap.data(); // { ownerUid, role, name, email }
  return null;
}

export async function createStaffAccount(ownerUid, email, password, name, role) {
  // Use secondary auth so admin session is never replaced
  const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  const staffUid = cred.user.uid;
  await updateProfile(cred.user, { displayName: name });
  await signOut(secondaryAuth); // sign out of secondary immediately

  // Membership doc — used on login to find ownerUid + role
  await setDoc(doc(db, 'staff_memberships', staffUid), {
    ownerUid,
    role,
    name,
    email,
  });

  // Staff record under company — used by StaffPage to list members
  await setDoc(doc(db, 'companies', ownerUid, 'staff', staffUid), {
    uid: staffUid,
    name,
    email,
    role,
    createdAt: Date.now(),
  });

  return staffUid;
}

export async function getStaffList(ownerUid) {
  const snap = await getDocs(collection(db, 'companies', ownerUid, 'staff'));
  return snap.docs.map((d) => d.data());
}

export async function removeStaff(ownerUid, staffUid) {
  await deleteDoc(doc(db, 'companies', ownerUid, 'staff', staffUid));
  await deleteDoc(doc(db, 'staff_memberships', staffUid));
  // Note: the Firebase Auth account for the staff user is not deleted here
  // (requires Admin SDK / Cloud Function). Without a membership record,
  // they will be treated as an owner with no data if they try to log in.
}

export async function updateStaffRole(ownerUid, staffUid, newRole) {
  await setDoc(doc(db, 'companies', ownerUid, 'staff', staffUid), { role: newRole }, { merge: true });
  await setDoc(doc(db, 'staff_memberships', staffUid), { role: newRole }, { merge: true });
}

// ---------- File / Drawing storage ----------
// Files stored at: companies/{ownerUid}/{folder}/{timestamp}_{filename}

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
    // Ignore if already deleted
    console.warn('deleteDrawing:', e.message);
  }
}
