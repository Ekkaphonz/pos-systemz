/* ============================================================
   FILE: js/auth.js  (MODIFIED — Firebase Authentication added)

   WHAT CHANGED vs the original:
   ─────────────────────────────
   • Imports Firebase auth + Firestore from firebase.js
   • attemptLogin()  → now calls signInWithEmailAndPassword()
   • logout()        → now calls Firebase signOut()
   • requireLogin()  → now uses onAuthStateChanged() to guard pages
   • isLoggedIn()    → kept for synchronous checks; Firebase session
                        is the source of truth via onAuthStateChanged
   • saveUserProfile() → NEW: writes { email, role } to users/{uid}
                          on first login so the users collection exists

   WHAT IS KEPT UNCHANGED:
   ─────────────────────────────
   • All function names stay the same — no changes needed in HTML files
   • LocalStorage session key kept as a fast synchronous fallback
     (Firebase Auth state persists across page reloads automatically)
   ============================================================ */

import { auth, db, COL_USERS }
  from './firebase.js';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, setDoc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── LocalStorage key (kept for synchronous isLoggedIn checks) ──
const AUTH_KEY = 'posAdminSession';

/* ── Save user profile to Firestore (users collection) ─────
   Structure: users/{uid} → { email, role }
   Called once after successful login.
 ─────────────────────────────────────────────────────────── */
async function saveUserProfile(user) {
  try {
    const ref      = doc(db, COL_USERS, user.uid);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, { email: user.email, role: 'admin' });
    }
  } catch (e) {
    console.error('saveUserProfile error:', e);
  }
}

/* ── attemptLogin ───────────────────────────────────────────
   CHANGED: uses Firebase signInWithEmailAndPassword.
   The HTML still calls attemptLogin(email, password) —
   same call signature, now returns Promise<boolean>.
 ─────────────────────────────────────────────────────────── */
async function attemptLogin(email, password) {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const user       = credential.user;

    await saveUserProfile(user);

    // Keep lightweight LocalStorage flag for synchronous isLoggedIn()
    localStorage.setItem(AUTH_KEY, JSON.stringify({
      loggedIn:  true,
      uid:       user.uid,
      email:     user.email,
      loginTime: new Date().toISOString(),
    }));
    return true;
  } catch (e) {
    console.error('Firebase login error:', e.code, e.message);
    return false;
  }
}

/* ── logout ─────────────────────────────────────────────────
   CHANGED: calls Firebase signOut before clearing LocalStorage.
 ─────────────────────────────────────────────────────────── */
async function logout() {
  try { await signOut(auth); } catch (e) { console.error(e); }
  localStorage.removeItem(AUTH_KEY);
  window.location.href = 'login.html';
}

/* ── isLoggedIn ─────────────────────────────────────────────
   UNCHANGED — synchronous LocalStorage check used as a fast
   guard. Firebase session also persists across reloads.
 ─────────────────────────────────────────────────────────── */
function isLoggedIn() {
  try {
    const raw     = localStorage.getItem(AUTH_KEY);
    const session = raw ? JSON.parse(raw) : null;
    return session && session.loggedIn === true;
  } catch (e) {
    return false;
  }
}

/* ── requireLogin ───────────────────────────────────────────
   CHANGED: onAuthStateChanged is now the authoritative check.
   Hides page body until Firebase confirms auth state.
 ─────────────────────────────────────────────────────────── */
function requireLogin() {
  document.body.style.visibility = 'hidden';
  onAuthStateChanged(auth, (user) => {
    if (user) {
      document.body.style.visibility = 'visible';
    } else {
      localStorage.removeItem(AUTH_KEY);
      window.location.href = 'login.html';
    }
  });
}

/* ── getSessionUser ─────────────────────────────────────────
   UNCHANGED — reads email from LocalStorage session.
 ─────────────────────────────────────────────────────────── */
function getSessionUser() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? (JSON.parse(raw).email || 'Admin') : 'Admin';
  } catch (e) {
    return 'Admin';
  }
}

/* ── initCredentials ────────────────────────────────────────
   KEPT so login.html needs zero changes — now a no-op.
   Create your admin account once in Firebase Console:
   Authentication → Users → Add user (email + password)
 ─────────────────────────────────────────────────────────── */
function initCredentials() {
  // No-op: Firebase manages credentials.
}