// viewsheet.js — โหลดรายการชีท + ระบบตะกร้า (ไม่มี OTP)
import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

/* -------------------- INIT -------------------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* -------------------- DOM --------------------- */
const userEmailSpan = document.getElementById('userEmail');
const sheetList = document.getElementById('sheetList');
const sheetLoading = document.getElementById('sheetLoading');
const searchBtn = document.getElementById('searchBtn');

const $ = (id) => document.getElementById(id);

/* ----------------- AUTH GUARD ----------------- */
onAuthStateChanged(auth, (user) => {
  if (user && userEmailSpan) userEmailSpan.textContent = user.email;
  else window.location.href = 'login.html';
});

/* ----------------- HELPERS -------------------- */
function showLoading(show) {
  if (sheetLoading) sheetLoading.style.display = show ? 'flex' : 'none';
}
function emptyState(msg) {
  if (!sheetList) return;
  sheetList.innerHTML = `
    <div style="width:100%;text-align:center;color:#777;padding:24px 0;">
      ${msg}
    </div>`;
}

/* ----------------- LOAD SHEETS ---------------- */
async function loadSheets() {
  if (!sheetList) return;
  showLoading(true);
  sheetList.innerHTML = '';

  try {
    const qs = await getDocs(collection(db, 'sheets'));

    const searchText = $('searchInput')?.value?.trim().toLowerCase() || '';
    const faculty = $('facultySelect')?.value || '';
    const major = $('majorSelect')?.value || '';
    const term = $('termSelect')?.value || '';
    const year = $('yearSelect')?.value || '';
    const type = $('typeSelect')?.value || '';

    let shown = 0;

    qs.forEach((docSnap) => {
      const data = docSnap.data() || {};

      let match = true;
      if (searchText) {
        const all = `${data.sheetName || ''} ${data.subjectCode || ''} ${data.author || ''} ${data.description || ''}`.toLowerCase();
        if (!all.includes(searchText)) match = false;
      }
      if (faculty && data.faculty !== faculty) match = false;
      if (major && data.major !== major) match = false;
      if (term && data.semester !== term) match = false;
      if (year && data.year !== year) match = false;
      if (type && (data.type || '').toLowerCase() !== type.toLowerCase()) match = false;
      if (!match) return;

      shown++;

      const card = document.createElement('div');
      card.className = 'sheet-card';
      const coverSrc = data.coverUrl || data.coverBase64 || '../pic/placeholder.png';

      card.innerHTML = `
        <div style="width:100%;display:flex;justify-content:center;">
          <img class="cover"
               src="${coverSrc}"
               alt="cover"
               style="margin-bottom:8px;width:200px;height:200px;object-fit:cover;border-radius:8px;background:#ddd">
        </div>
        <div class="info" style="font-family:'Kanit',sans-serif;text-align:left;color:#333;">
          <div><strong>รหัสวิชา:</strong> ${data.subjectCode || '-'}</div>
          <div><strong>คณะ:</strong> ${data.faculty || '-'} | <strong>สาขา:</strong> ${data.major || '-'}</div>
          <div><strong>เทอม:</strong> ${data.semester || '-'} | <strong>ปี:</strong> ${data.year || '-'}</div>
          <div><strong>ชื่อชีท:</strong> ${data.sheetName || '-'}</div>
          <div><strong>ผู้จัดทำ:</strong> ${data.author || '-'}</div>
          <div><strong>รายละเอียด:</strong> ${data.description || '-'}</div>
          <div><strong>ราคา:</strong> ${data.price || '0'}฿</div>
        </div>
        <div class="actions" style="margin-top:8px;display:flex;gap:8px;">
          <button class="detail-btn btn"
            data-id="${docSnap.id}">เพิ่มเติม</button>
          <button class="buy-btn btn"
            data-id="${docSnap.id}"
            data-name="${data.sheetName || '-'}"
            data-price="${data.price || '0'}"
            data-img="${coverSrc}">เพิ่มลงตะกร้า</button>
        </div>
      `;
      sheetList.appendChild(card);
    });

    if (shown === 0) emptyState('ไม่พบชีทที่ตรงกับเงื่อนไข');

    // ปุ่ม “เพิ่มเติม”
    document.querySelectorAll('.detail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        if (id) window.location.href = `sheetdetail.html?id=${encodeURIComponent(id)}`;
      });
    });

  } catch (e) {
    console.error('[viewsheet] load error:', e);
    emptyState('เกิดข้อผิดพลาดในการโหลดข้อมูล');
  } finally {
    showLoading(false);
  }
}

/* ------------- SEARCH/ FILTER UX -------------- */
if (searchBtn) searchBtn.addEventListener('click', loadSheets);
$('searchInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadSheets();
});

/* ----------------- FIRST LOAD ----------------- */
loadSheets();

/* =====================================================
   🛒 ระบบตะกร้า (คงตำแหน่งเดิมแต่ยกปุ่มขึ้นเล็กน้อย)
   ===================================================== */
const cartToggle = document.getElementById('cartToggle');
const cartPanel = document.getElementById('cartPanel');
const closeCart = document.getElementById('closeCart');
const cartItems = document.getElementById('cartItems');
const cartTotal = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
let cart = [];

function openCart() { cartPanel.classList.add('open'); }
function closeCartPanel() { cartPanel.classList.remove('open'); }
cartToggle?.addEventListener('click', () => cartPanel.classList.toggle('open'));
closeCart?.addEventListener('click', closeCartPanel);

function renderCart() {
  if (!cartItems) return;

  if (cart.length === 0) {
    cartItems.innerHTML = '<p style="color:#777;text-align:center;">ยังไม่มีชีทในตะกร้า</p>';
    cartTotal.textContent = '0฿';
    return;
  }

  let total = 0;
  cartItems.innerHTML = cart.map(item => {
    total += Number(item.price) || 0;
    return `
      <div class="cart-item" style="display:flex;align-items:center;gap:10px;border-bottom:1px solid #eee;padding:8px 0;">
        <img src="${item.img}" alt="cover" style="width:60px;height:60px;object-fit:cover;border-radius:8px;">
        <div style="flex:1;">
          <strong>${item.name}</strong><br>
          <small>ราคา: ${item.price}฿</small>
        </div>
        <button class="remove-item" data-id="${item.id}" style="background:none;border:none;color:#e57373;font-size:18px;cursor:pointer;">🗑</button>
      </div>
    `;
  }).join('');

  cartTotal.textContent = total + '฿';
}

cartItems?.addEventListener('click', (e) => {
  if (e.target.classList.contains('remove-item')) {
    const id = e.target.dataset.id;
    cart = cart.filter(item => item.id !== id);
    renderCart();
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.classList.contains('buy-btn')) return;

  const btn = e.target;
  const id = btn.dataset.id;
  const name = btn.dataset.name;
  const price = btn.dataset.price || '0';
  const img = btn.dataset.img;

  if (cart.some(item => item.id === id)) {
    alert('ชีทนี้มีอยู่ในตะกร้าแล้ว');
    openCart();
    return;
  }

  cart.push({ id, name, price, img });
  renderCart();
  openCart();
  alert('✅ เพิ่มชีทลงในตะกร้าเรียบร้อยแล้ว');
});

checkoutBtn?.addEventListener('click', () => {
  if (cart.length === 0) return alert('ยังไม่มีชีทในตะกร้า');
  alert('✅ ชำระเงินเรียบร้อยแล้ว! กำลังไปหน้าชีทของฉัน...');
  cart = [];
  renderCart();
  window.location.href = 'mysheet.html';
});
