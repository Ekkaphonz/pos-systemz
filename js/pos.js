/* ============================================================
   FILE: js/pos.js  (MODIFIED — Firebase sync added)

   WHAT CHANGED vs the original:
   ─────────────────────────────
   • DOMContentLoaded handler now calls loadProductsFromFirestore()
     first, then falls back to LocalStorage stock if Firestore is
     empty. This syncs server-side stock to the local cache on load.
   • After initStock(), calls saveProductToFirestore() for each
     product so the products collection is populated on first run.
   • All other logic (cart, buildMenu, renderCart, etc.) UNCHANGED.
   ============================================================ */

/* ── Currency Formatter ─────────────────────────────────── */
function formatKIP(amount) {
  return amount.toLocaleString('en-US') + ' KIP';
}

/* ── Product Data ───────────────────────────────────────── */
const PRODUCTS = [
  { id: 1,  name: "ເຂົ້າຈີ່ທຳມະດາ",  price: 12000, icon: "🍞", clrLight: "var(--p1)",  clrDark: "var(--p1d)",  defaultStock: 50 },
  { id: 2,  name: "ເຂົ້າຈີ່ເນີຍ",    price: 13000, icon: "🥐", clrLight: "var(--p2)",  clrDark: "var(--p2d)",  defaultStock: 50 },
  { id: 3,  name: "ເຂົ້າຈີ່ຍາວ",     price: 13000, icon: "🥖", clrLight: "var(--p3)",  clrDark: "var(--p3d)",  defaultStock: 50 },
  { id: 4,  name: "ເຂົ້າຈີ່ໄຂ່",     price: 15000, icon: "🥯", clrLight: "var(--p4)",  clrDark: "var(--p4d)",  defaultStock: 50 },
  { id: 5,  name: "ເຂົ້າຈີ່ສາລີ",    price: 15000, icon: "🌽", clrLight: "var(--p5)",  clrDark: "var(--p5d)",  defaultStock: 50 },
  { id: 6,  name: "ເຂົ້າຈີ່ນ້ຳຕານ",  price: 13000, icon: "🍯", clrLight: "var(--p6)",  clrDark: "var(--p6d)",  defaultStock: 50 },
  { id: 7,  name: "ເຂົ້າຈີ່ທອດ",     price: 18000, icon: "🥪", clrLight: "var(--p7)",  clrDark: "var(--p7d)",  defaultStock: 30 },
  { id: 8,  name: "ເຂົ້າສາລີທອດ",    price: 20000, icon: "🥟", clrLight: "var(--p8)",  clrDark: "var(--p8d)",  defaultStock: 30 },
  { id: 9,  name: "ໝູເດັ່ນທອດ",      price: 25000, icon: "🥟", clrLight: "var(--p9)",  clrDark: "var(--p9d)",  defaultStock: 30 },
  { id: 10, name: "ແປ້ງທອດໄສ້ຜັກ",  price: 20000, icon: "🥟", clrLight: "var(--p10)", clrDark: "var(--p10d)", defaultStock: 30 },
];

/* ── Cart State ─────────────────────────────────────────── */
let cart = {};

/* ── buildMenu: UNCHANGED ───────────────────────────────── */
function buildMenu() {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = '';

  PRODUCTS.forEach(product => {
    const stock      = getStock(product.id);
    const cartQty    = cart[product.id] || 0;
    const outOfStock = stock <= 0;

    const btn = document.createElement('button');
    btn.className = 'menu-btn' + (outOfStock ? ' out-of-stock' : '');
    btn.style.setProperty('--clr-light', product.clrLight);
    btn.style.setProperty('--clr-dark',  product.clrDark);

    let stockLabel = '';
    if (outOfStock) {
      stockLabel = `<div class="m-stock empty">ໝົດສະຕ໋ອກ</div>`;
    } else if (stock <= 5) {
      stockLabel = `<div class="m-stock low">ເຫຼືອ ${stock}</div>`;
    } else {
      stockLabel = `<div class="m-stock">ສະຕ໋ອກ: ${stock}</div>`;
    }

    btn.innerHTML = `
      <div class="m-icon">${product.icon}</div>
      <div class="m-name">${product.name}</div>
      <div class="m-price">${formatKIP(product.price)}</div>
      ${stockLabel}
    `;

    if (!outOfStock) {
      btn.addEventListener('click', () => addToCart(product.id));
    }

    grid.appendChild(btn);
  });
}

/* ── addToCart: UNCHANGED ───────────────────────────────── */
function addToCart(productId) {
  const stock   = getStock(productId);
  const cartQty = cart[productId] || 0;
  if (cartQty >= stock) { showToast('⚠️ ສະຕ໋ອກບໍ່ພໍ!'); return; }
  cart[productId] = cartQty + 1;
  renderCart();
  buildMenu();
  updateSummary();
}

/* ── changeQty: UNCHANGED ───────────────────────────────── */
function changeQty(productId, delta) {
  const current = cart[productId] || 0;
  const newQty  = current + delta;
  if (newQty <= 0) {
    delete cart[productId];
  } else {
    if (delta > 0 && newQty > getStock(productId)) {
      showToast('⚠️ ສະຕ໋ອກບໍ່ພໍ!');
      return;
    }
    cart[productId] = newQty;
  }
  renderCart();
  buildMenu();
  updateSummary();
}

/* ── getCartSubtotal: UNCHANGED ─────────────────────────── */
function getCartSubtotal() {
  let subtotal = 0;
  for (const [id, qty] of Object.entries(cart)) {
    const product = PRODUCTS.find(p => p.id === parseInt(id));
    if (product) subtotal += product.price * qty;
  }
  return subtotal;
}

/* ── getCartItemCount: UNCHANGED ────────────────────────── */
function getCartItemCount() {
  return Object.values(cart).reduce((sum, qty) => sum + qty, 0);
}

/* ── getCartItems: UNCHANGED ────────────────────────────── */
function getCartItems() {
  return Object.entries(cart).map(([id, qty]) => {
    const product = PRODUCTS.find(p => p.id === parseInt(id));
    return { productId: product.id, name: product.name, price: product.price, qty, lineTotal: product.price * qty };
  });
}

/* ── renderCart: UNCHANGED ──────────────────────────────── */
function renderCart() {
  const cartBody  = document.getElementById('cartBody');
  const cartEmpty = document.getElementById('cartEmpty');
  const cartBadge = document.getElementById('cartBadge');

  cartBody.querySelectorAll('.cart-row').forEach(r => r.remove());
  const ids = Object.keys(cart);

  if (ids.length === 0) {
    cartEmpty.style.display = 'flex';
    cartBadge.textContent   = '0 ລາຍການ';
    updateSummary();
    return;
  }

  cartEmpty.style.display = 'none';
  let itemCount = 0;

  ids.forEach(id => {
    const product   = PRODUCTS.find(p => p.id === parseInt(id));
    const qty       = cart[id];
    const lineTotal = product.price * qty;
    itemCount += qty;

    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <div class="cr-info">
        <div class="cr-name">${product.icon} ${product.name}</div>
        <div class="cr-sub">${formatKIP(product.price)} × ${qty}</div>
      </div>
      <div class="qty-wrap">
        <button class="qty-btn dec" onclick="changeQty(${id}, -1)">−</button>
        <span class="qty-num">${qty}</span>
        <button class="qty-btn inc" onclick="changeQty(${id}, +1)">+</button>
      </div>
      <div class="cr-line">${formatKIP(lineTotal)}</div>
    `;
    cartBody.appendChild(row);
  });

  cartBadge.textContent = `${itemCount} ລາຍການ`;
}

/* ── updateSummary: UNCHANGED ───────────────────────────── */
function updateSummary() {
  const subtotal   = getCartSubtotal();
  const { vat, total } = calcVAT(subtotal);
  document.getElementById('dispSubtotal').textContent = formatKIP(subtotal);
  document.getElementById('dispVAT').textContent      = formatKIP(vat);
  document.getElementById('dispTotal').textContent    = formatKIP(total);
  updateChange();
}

/* ── resetCart: UNCHANGED ───────────────────────────────── */
function resetCart() {
  cart = {};
  document.getElementById('receivedInput').value = '';
  document.getElementById('changeBox').style.display = 'none';
  document.querySelectorAll('.pay-type-btn').forEach(b => { b.className = 'pay-type-btn'; });
  selectedPayType = null;
  renderCart();
  buildMenu();
  updateSummary();
}

/* ── Initialize: MODIFIED ───────────────────────────────────
   Added: loadProductsFromFirestore() before building the menu
   so stock values from the cloud are merged in first.
   Added: saveProductToFirestore() to ensure the products
   collection exists in Firestore on first run.
 ─────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Ensure LocalStorage stock records exist
  initStock(PRODUCTS);

  // 2. Fetch Firestore stock → merges into LocalStorage cache
  //    (silently falls back to local values if offline/error)
  await loadProductsFromFirestore();

  // 3. Ensure all products exist in Firestore products collection
  //    (no-op if they already exist due to merge: true)
  for (const product of PRODUCTS) {
    await saveProductToFirestore(product);
  }

  // 4. Build UI (same as before)
  buildMenu();
  renderCart();
  updateSummary();
});