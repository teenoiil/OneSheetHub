// viewsheet.js — โหลดรายการชีท + ซื้อด้วยรหัสครั้งเดียว (เรียก /verify)
import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, getDocs } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

/* -------------------- INIT -------------------- */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* -------------------- DOM --------------------- */
const userEmailSpan   = document.getElementById('userEmail');
const sheetList       = document.getElementById('sheetList');
const sheetLoading    = document.getElementById('sheetLoading');
const searchBtn       = document.getElementById('searchBtn');

const $ = (id) => document.getElementById(id);

/* ----------------- AUTH GUARD ----------------- */
onAuthStateChanged(auth, (user) => {
  if (user && userEmailSpan) {
    userEmailSpan.textContent = user.email;
  } else {
    window.location.href = 'login.html';
  }
});

/* ----------------- HELPERS -------------------- */
function showLoading(show) { if (sheetLoading) sheetLoading.style.display = show ? 'flex' : 'none'; }
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

    // อ่านค่ากรองจากฟอร์ม (มีหรือไม่มีก็ได้)
    const searchText = $('searchInput')?.value?.trim().toLowerCase() || '';
    const faculty    = $('facultySelect')?.value || '';
    const major      = $('majorSelect')?.value || '';
    const term       = $('termSelect')?.value || '';
    const year       = $('yearSelect')?.value || '';
    const type       = $('typeSelect')?.value || '';

    let shown = 0;

    qs.forEach((docSnap) => {
      const data = docSnap.data() || {};

      // ---------- กรอง ----------
      let match = true;
      if (searchText) {
        const all = `${data.sheetName||''} ${data.subjectCode||''} ${data.author||''} ${data.description||''}`.toLowerCase();
        if (!all.includes(searchText)) match = false;
      }
      if (faculty && faculty !== 'คณะ...' && data.faculty !== faculty) match = false;
      if (major   && major   !== 'สาขา...' && data.major   !== major)   match = false;
      if (term    && term    !== 'เทอม'    && data.semester!== term)    match = false;
      if (year    && year    !== 'ปีการศึกษา' && data.year !== year)    match = false;
      if (type    && type    !== 'ประเภท'  && (data.type||'').toLowerCase() !== type.toLowerCase()) match = false;
      if (!match) return;

      shown++;

      // ---------- การ์ด ----------
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
        <div class="code"><strong>รหัสวิชา:</strong> ${data.subjectCode || '-'} </div>
        <div class="info">
          <strong>คณะ:</strong> ${data.faculty || '-'}<br>
          <strong>สาขา:</strong> ${data.major || '-'}<br>
          <strong>เทอม:</strong> ${data.semester || '-'}<br>
          <strong>ปีการศึกษา:</strong> ${data.year || '-'}<br>
          <strong>ชื่อชีท:</strong> ${data.sheetName || '-'}<br>
          <strong>ผู้จัดทำ:</strong> ${data.author || '-'}<br>
          <strong>รายละเอียด:</strong> ${data.description || '-'}<br>
          <strong>ราคา:</strong> ${data.price || '-'}
        </div>
        <div class="actions" style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="detail-btn btn" data-id="${docSnap.id}">เพิ่มเติม</button>
          <button class="buy-btn btn" data-id="${docSnap.id}">ซื้อชีท</button>
        </div>
      `;
      sheetList.appendChild(card);
    });

    if (shown === 0) {
      emptyState('ไม่พบชีทที่ตรงกับเงื่อนไข');
    }

    // ---------- ปุ่ม "เพิ่มเติม" ----------
    sheetList.querySelectorAll('.detail-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        if (id) window.location.href = `sheetdetail.html?id=${encodeURIComponent(id)}`;
      });
    });

    // ---------- ปุ่ม "ซื้อชีท" ----------
    sheetList.querySelectorAll('.buy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fileId = btn.getAttribute('data-id');
        if (!fileId) return;

        const code = prompt('กรอกรหัส 6 หลักที่ได้รับทางอีเมล:');
        if (!code) return;

        const user = auth.currentUser;
        if (!user) { alert('กรุณาเข้าสู่ระบบ'); return; }

        // กันกดซ้ำระหว่างรอ
        btn.disabled = true;
        const oldText = btn.textContent;
        btn.textContent = 'กำลังตรวจสอบ...';

        try {
          const token = await user.getIdToken();
          const r = await fetch('https://us-central1-project-sharesheet2.cloudfunctions.net/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ fileId, code: code.trim() })
          });

          if (!r.ok) {
            const msg = await r.text();
            throw new Error(msg || 'ตรวจรหัสล้มเหลว');
          }

          // ✅ ไม่เปิด Signed URL → ไปหน้า viewer
          window.location.href = `viewer.html?id=${encodeURIComponent(fileId)}`;
        } catch (err) {
          alert(err?.message || 'เกิดข้อผิดพลาด');
        } finally {
          btn.disabled = false;
          btn.textContent = oldText;
        }
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

// กด Enter ในช่องค้นหาให้ทำงานทันที
$('searchInput')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') loadSheets();
});

/* ----------------- FIRST LOAD ----------------- */
loadSheets();
