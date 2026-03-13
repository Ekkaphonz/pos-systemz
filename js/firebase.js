/* ============================================================
   FILE: js/firebase.js
   Firebase initialization — imports SDK, connects to project,
   and exports { db, auth } for use in other modules.

   HOW TO USE:
     import { db, auth } from './firebase.js';

   SETUP STEPS (do this once before going live):
     1. Go to https://console.firebase.google.com
     2. Create a project → "school-sale-pos"
     3. Add a Web App → copy the firebaseConfig object
     4. Replace the placeholder config below with YOUR values
     5. In Firebase Console → Build → Firestore Database → Create database
     6. In Firebase Console → Build → Authentication → Sign-in method
        → Enable "Email/Password"
   ============================================================ */

// ── Import Firebase SDK modules (CDN ES module build) ─────
import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore }         from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth }              from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';

// ── Your Firebase project config ──────────────────────────
// ⚠️  REPLACE these values with your own project's config.
//     Find them in: Firebase Console → Project Settings → Your apps
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId:             "YOUR_APP_ID",
};

// ── Initialize Firebase ────────────────────────────────────
const app  = initializeApp(firebaseConfig);

// ── Export service instances ───────────────────────────────
// db   → Cloud Firestore (used by storage.js, payment.js, pos.js)
// auth → Firebase Authentication (used by auth.js)
export const db   = getFirestore(app);
export const auth = getAuth(app);

/* ── Firestore collection name constants ──────────────────
   Import these wherever you need a collection reference
   to avoid typos across files.
   ========================================================= */
export const COL_ORDERS   = 'orders';    // orders/{orderId}
export const COL_PRODUCTS = 'products';  // products/{productId}
export const COL_USERS    = 'users';     // users/{uid}