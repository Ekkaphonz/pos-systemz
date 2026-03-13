/* ============================================================
   FILE: js/payment.js  (MODIFIED — saveOrder is now async)

   WHAT CHANGED vs the original:
   ─────────────────────────────
   • processPayment() changed to async function so it can
     await saveOrder() (which now writes to Firestore).
   • await deductStockForOrder() added (also async now).
   • Everything else — selectPayType, updateChange, showToast,
     event listeners — is 100% UNCHANGED.
   ============================================================ */

/* ── Selected Payment Type ──────────────────────────────── */
let selectedPayType = null;

/* ── selectPayType: UNCHANGED ───────────────────────────── */
function selectPayType(type) {
  selectedPayType = type;
  const cashBtn     = document.getElementById('btnCash');
  const transferBtn = document.getElementById('btnTransfer');
  cashBtn.className     = 'pay-type-btn';
  transferBtn.className = 'pay-type-btn';
  if (type === 'cash') {
    cashBtn.className = 'pay-type-btn selected-cash';
  } else {
    transferBtn.className = 'pay-type-btn selected-transfer';
  }
  const payInputSection = document.getElementById('payInputSection');
  if (type === 'cash') {
    payInputSection.style.display = 'flex';
  } else {
    payInputSection.style.display = 'none';
    document.getElementById('changeBox').style.display = 'none';
  }
}

/* ── updateChange: UNCHANGED ────────────────────────────── */
function updateChange() {
  if (selectedPayType !== 'cash') return;
  const subtotal  = getCartSubtotal();
  const { total } = calcVAT(subtotal);
  const received  = parseFloat(document.getElementById('receivedInput').value) || 0;
  const changeBox = document.getElementById('changeBox');
  const changeLbl = document.getElementById('changeLbl');
  const changeVal = document.getElementById('changeVal');

  if (total === 0 || received === 0) { changeBox.style.display = 'none'; return; }

  const change = received - total;
  changeBox.style.display = 'flex';
  if (change < 0) {
    changeBox.className   = 'change-box err';
    changeLbl.textContent = '⚠️ ຍັງຂາດ';
    changeVal.textContent = formatKIP(Math.abs(change));
  } else {
    changeBox.className   = 'change-box ok';
    changeLbl.textContent = '💰 ທອນເງິນ';
    changeVal.textContent = formatKIP(change);
  }
}

/* ── processPayment: MODIFIED — now async ───────────────────
   Only change: the function is now async so it can await
   saveOrder() and deductStockForOrder() (both Firestore calls).
   All validation, order building, and toast logic is identical.
 ─────────────────────────────────────────────────────────── */
async function processPayment() {
  // 1. Validate cart
  if (getCartItemCount() === 0) {
    showToast('⚠️ ກະຕ່າຫວ່າງ! ກະລຸນາເລືອກສິນຄ້າ');
    return;
  }

  // 2. Validate payment type
  if (!selectedPayType) {
    showToast('⚠️ ກະລຸນາເລືອກປະເພດຊຳລະ (ເງິນສົດ / ໂອນ)');
    return;
  }

  // 3. Get amounts
  const subtotal       = getCartSubtotal();
  const { vat, total } = calcVAT(subtotal);
  let received         = total;
  let change           = 0;

  if (selectedPayType === 'cash') {
    received = parseFloat(document.getElementById('receivedInput').value) || 0;
    if (received <= 0) { showToast('⚠️ ກະລຸນາໃສ່ຈຳນວນເງິນທີ່ຮັບ'); return; }
    if (received < total) { showToast('⚠️ ຈຳນວນເງິນບໍ່ພໍ!'); return; }
    change = received - total;
  }

  // 4. Build order object (structure unchanged)
  const items = getCartItems();
  const order = {
    id:          generateOrderId(),
    date:        new Date().toISOString(),
    items,
    subtotal,
    vat,
    total,
    received,
    change,
    paymentType: selectedPayType,
  };

  // 5. Save order — AWAITED (now writes to Firestore too)
  await saveOrder(order);

  // 6. Deduct stock — AWAITED (now updates Firestore too)
  await deductStockForOrder(items);

  // 7. Toast (unchanged)
  if (selectedPayType === 'cash') {
    showToast(`✅ ຊຳລະສຳເລັດ! ທອນ: ${formatKIP(change)}`);
  } else {
    showToast('✅ ຊຳລະໂອນສຳເລັດ!');
  }

  // 8. Reset cart (unchanged)
  resetCart();
}

/* ── showToast: UNCHANGED ───────────────────────────────── */
let toastTimer = null;
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ── Event Listeners: UNCHANGED ─────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btnCash').addEventListener('click',     () => selectPayType('cash'));
  document.getElementById('btnTransfer').addEventListener('click', () => selectPayType('transfer'));
  document.getElementById('receivedInput').addEventListener('input', updateChange);
  document.getElementById('payBtn').addEventListener('click', processPayment);
  document.getElementById('resetBtn').addEventListener('click', () => {
    if (getCartItemCount() === 0 || confirm('ລ້າງລາຍການປັດຈຸບັນ?')) {
      resetCart();
      showToast('🗑️ ລ້າງລາຍການແລ້ວ');
    }
  });
});