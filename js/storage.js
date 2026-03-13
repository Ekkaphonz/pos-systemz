/* ============================================================
   FILE: js/storage.js  (MODIFIED — Firestore added)

   WHAT CHANGED vs the original:
   ─────────────────────────────
   • Imports db + collection constants from firebase.js
   • loadOrders()        → still reads LocalStorage (fast, offline)
   • saveOrder()         → now ALSO writes to Firestore orders collection
   • clearAllOrders()    → now ALSO deletes all Firestore order docs
   • loadProductsFromFirestore() → NEW: loads products/{id} from Firestore
   • saveProductToFirestore()    → NEW: upserts a product doc
   • deleteProductFromFirestore()→ NEW: removes a product doc
   • updateStockInFirestore()    → NEW: updates stock field on product doc
   • All stock/VAT/CSV helpers   → UNCHANGED
   ============================================================ */

import { db, COL_ORDERS, COL_PRODUCTS }
  from './firebase.js';
import {
  collection, doc, addDoc, setDoc, deleteDoc,
  getDocs, updateDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── LocalStorage keys (unchanged) ─────────────────────────
const ORDERS_KEY = 'schoolSaleOrders_v2';
const STOCK_KEY  = 'schoolSaleStock_v2';
const VAT_RATE   = 0.10;

/* ── loadOrders: UNCHANGED ─────────────────────────────── */
function loadOrders() {
  try {
    const raw = localStorage.getItem(ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('loadOrders error:', e);
    return [];
  }
}

/* ── saveOrder: MODIFIED — dual-write ─────────────────────
   Writes to LocalStorage first (fast), then Firestore (cloud).
   Firestore doc structure:
     orders/{auto-id} → {
       orderId, date (serverTimestamp), paymentType,
       subtotal, vat, total, received, change,
       items: [ { productId, name, price, qty, lineTotal } ]
     }
 ─────────────────────────────────────────────────────────── */
async function saveOrder(order) {
  // 1. LocalStorage (always, instant)
  try {
    const orders = loadOrders();
    orders.push(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch (e) {
    console.error('saveOrder (local) error:', e);
  }

  // 2. Firestore (async, non-blocking, non-fatal on failure)
  try {
    await addDoc(collection(db, COL_ORDERS), {
      orderId:     order.id,
      date:        serverTimestamp(),
      paymentType: order.paymentType,
      subtotal:    order.subtotal,
      vat:         order.vat,
      total:       order.total,
      received:    order.received,
      change:      order.change,
      items:       order.items,
    });
  } catch (e) {
    console.error('saveOrder (Firestore) error:', e);
  }
}

/* ── clearAllOrders: MODIFIED ─────────────────────────── */
async function clearAllOrders() {
  localStorage.removeItem(ORDERS_KEY);
  try {
    const snap     = await getDocs(collection(db, COL_ORDERS));
    const deletes  = snap.docs.map(d => deleteDoc(doc(db, COL_ORDERS, d.id)));
    await Promise.all(deletes);
  } catch (e) {
    console.error('clearAllOrders (Firestore) error:', e);
  }
}

/* ── generateOrderId: UNCHANGED ───────────────────────── */
function generateOrderId() {
  return 'ORD-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000);
}

// ── Revenue helpers: UNCHANGED ────────────────────────────
function getTotalRevenue()    { return loadOrders().reduce((s, o) => s + o.total, 0); }
function getTotalVAT()        { return loadOrders().reduce((s, o) => s + o.vat,   0); }
function getOrderCount()      { return loadOrders().length; }
function getCashRevenue()     { return loadOrders().filter(o => o.paymentType === 'cash').reduce((s, o) => s + o.total, 0); }
function getTransferRevenue() { return loadOrders().filter(o => o.paymentType === 'transfer').reduce((s, o) => s + o.total, 0); }
function getTotalItemsSold()  { return loadOrders().reduce((sum, o) => sum + o.items.reduce((s, i) => s + i.qty, 0), 0); }
function getBestSeller() {
  const orders = loadOrders();
  if (orders.length === 0) return '—';
  const tally = {};
  orders.forEach(o => o.items.forEach(i => { tally[i.name] = (tally[i.name] || 0) + i.qty; }));
  return Object.entries(tally).sort((a, b) => b[1] - a[1])[0][0];
}

/* ── Stock helpers: mostly UNCHANGED ─────────────────────
   setStock, addStock, deductStockForOrder now also call
   updateStockInFirestore() to keep Firestore in sync.
 ─────────────────────────────────────────────────────────── */
function loadStock() {
  try {
    const raw = localStorage.getItem(STOCK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

function saveStock(stockObj) {
  localStorage.setItem(STOCK_KEY, JSON.stringify(stockObj));
}

function getStock(productId) {
  const stock = loadStock();
  return stock[productId] !== undefined ? stock[productId] : 0;
}

async function setStock(productId, qty) {
  const stock = loadStock();
  stock[productId] = Math.max(0, qty);
  saveStock(stock);
  await updateStockInFirestore(productId, Math.max(0, qty));
}

async function addStock(productId, qty) {
  const stock = loadStock();
  stock[productId] = (stock[productId] || 0) + Math.max(0, qty);
  saveStock(stock);
  await updateStockInFirestore(productId, stock[productId]);
}

async function deductStockForOrder(items) {
  const stock = loadStock();
  items.forEach(item => {
    if (stock[item.productId] !== undefined) {
      stock[item.productId] = Math.max(0, stock[item.productId] - item.qty);
    }
  });
  saveStock(stock);
  const updates = items.map(item =>
    updateStockInFirestore(item.productId, stock[item.productId] ?? 0)
  );
  await Promise.all(updates);
}

function initStock(products) {
  const stock = loadStock();
  let changed = false;
  products.forEach(p => {
    if (stock[p.id] === undefined) {
      stock[p.id] = p.defaultStock || 50;
      changed = true;
    }
  });
  if (changed) saveStock(stock);
}

/* ── NEW — Firestore product helpers ──────────────────────
   saveProductToFirestore:    upserts products/{id}
   deleteProductFromFirestore: deletes products/{id}
   updateStockInFirestore:    updates stock field only
   loadProductsFromFirestore:  fetches all products and merges
                               their stock into LocalStorage
 ─────────────────────────────────────────────────────────── */

/**
 * Upsert a product to Firestore.
 * products/{productId} → { name, price, stock }
 */
async function saveProductToFirestore(product) {
  try {
    await setDoc(doc(db, COL_PRODUCTS, String(product.id)), {
      name:  product.name,
      price: product.price,
      stock: getStock(product.id),
    }, { merge: true });
  } catch (e) {
    console.error('saveProductToFirestore error:', e);
  }
}

/**
 * Delete a product document from Firestore.
 */
async function deleteProductFromFirestore(productId) {
  try {
    await deleteDoc(doc(db, COL_PRODUCTS, String(productId)));
  } catch (e) {
    console.error('deleteProductFromFirestore error:', e);
  }
}

/**
 * Update only the stock field on a Firestore product doc.
 * If the doc doesn't exist yet, creates it with merge.
 */
async function updateStockInFirestore(productId, qty) {
  try {
    await updateDoc(doc(db, COL_PRODUCTS, String(productId)), { stock: qty });
  } catch (e) {
    try {
      await setDoc(doc(db, COL_PRODUCTS, String(productId)), { stock: qty }, { merge: true });
    } catch (e2) {
      console.error('updateStockInFirestore error:', e2);
    }
  }
}

/**
 * Fetch all products from Firestore and merge their stock
 * values into LocalStorage. Call once on POS page load.
 * Returns array of { id, name, price, stock }.
 */
async function loadProductsFromFirestore() {
  try {
    const snap     = await getDocs(collection(db, COL_PRODUCTS));
    const products = [];
    const stock    = loadStock();

    snap.forEach(d => {
      const data = d.data();
      const id   = parseInt(d.id);
      products.push({ id, name: data.name, price: data.price, stock: data.stock });
      stock[id]  = data.stock ?? stock[id] ?? 0;
    });

    saveStock(stock);
    return products;
  } catch (e) {
    console.error('loadProductsFromFirestore error:', e);
    return [];
  }
}

/* ── calcVAT: UNCHANGED ───────────────────────────────── */
function calcVAT(subtotal) {
  const vat   = Math.round(subtotal * VAT_RATE);
  const total = subtotal + vat;
  return { subtotal, vat, total };
}

/* ── exportCSV: UNCHANGED ─────────────────────────────── */
function exportCSV() {
  const orders = loadOrders();
  if (orders.length === 0) {
    alert('ບໍ່ມີຂໍ້ມູນທີ່ຈະສົ່ງອອກ (No data to export)');
    return;
  }
  const header = ['Date','OrderID','Product','Price (KIP)','Quantity',
                  'Line Total (KIP)','Subtotal (KIP)','VAT (KIP)','Total (KIP)','Payment Type'];
  const rows = [header.join(',')];
  orders.forEach(order => {
    const date    = new Date(order.date).toLocaleString('en-GB');
    const payType = order.paymentType === 'cash' ? 'Cash' : 'Transfer';
    order.items.forEach(item => {
      rows.push([
        `"${date}"`, order.id, `"${item.name}"`,
        item.price, item.qty, item.lineTotal,
        order.subtotal, order.vat, order.total, payType,
      ].join(','));
    });
  });
  const csv  = rows.join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'sales-report.csv'; a.click();
  URL.revokeObjectURL(url);
}