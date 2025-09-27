import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore, collection, query, where, getDocs, getDoc, doc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
  const userEmailSpan   = document.getElementById('userEmail');

  // โครงใหม่ (2 กล่อง)
  const purchasedListEl = document.getElementById('mysheetPurchased');
  const uploadedListEl  = document.getElementById('mysheetUploaded');
  const noPurchasedEl   = document.getElementById('noPurchased');
  const noUploadedEl    = document.getElementById('noUploaded');

  // โครงเก่า (กล่องเดียว)
  const singleListEl    = document.getElementById('mysheetList');
  const noSheetMsgEl    = document.getElementById('noSheetMsg');

  const sheetLoading    = document.getElementById('sheetLoading');

  // ถ้าไม่พบกล่องใหม่ครบทั้ง 2 อัน ให้ถือว่าใช้โครงเก่า
  const useSingleLayout = !(purchasedListEl && uploadedListEl);

  if (useSingleLayout) {
    console.warn('[mysheet] Using single-list layout (mysheetList). Consider updating HTML to have mysheetPurchased/mysheetUploaded.');
  }

  const renderCard = (data) => {
    const card = document.createElement('div');
    card.className = 'sheet-card';
    const coverSrc = data.coverUrl || data.coverBase64 || '../pic/placeholder.png';
    card.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;">
        <img class="cover" src="${coverSrc}" alt="cover" style="width:64px;height:64px;border-radius:8px;object-fit:cover;background:#ddd">
        <div>
          <div class="info"><b>${data.sheetName || ''}</b></div>
          <div class="info">ราคา: ${data.price || ''} บาท</div>
          <div class="info">วิชา: ${data.subjectCode || ''}</div>
          <div class="info">สาขา: ${data.major || ''}</div>
          <div class="info">คณะ: ${data.faculty || ''}</div>
        </div>
      </div>
    `;
    return card;
  };

  const hideSpinner = () => { if (sheetLoading) sheetLoading.style.display = 'none'; };

  onAuthStateChanged(auth, async (user) => {
    try {
      if (!user || !user.email) {
        if (userEmailSpan) userEmailSpan.textContent = '-';
        window.location.href = 'login.html';
        return;
      }
      if (userEmailSpan) {
        userEmailSpan.textContent = user.email;
        userEmailSpan.style.display = 'inline';
      }
      if (sheetLoading) sheetLoading.style.display = 'flex';

      // เคลียร์ UI แบบปลอดภัย
      if (useSingleLayout) {
        if (singleListEl) singleListEl.innerHTML = '';
        if (noSheetMsgEl) noSheetMsgEl.style.display = 'none';
      } else {
        if (purchasedListEl) purchasedListEl.innerHTML = '';
        if (uploadedListEl)  uploadedListEl.innerHTML  = '';
        if (noPurchasedEl)   noPurchasedEl.style.display = 'none';
        if (noUploadedEl)    noUploadedEl.style.display  = 'none';
      }

      // ---------- 1) ชีทที่ซื้อ (entitlements) ----------
      const entQ = query(collection(db, 'entitlements'), where('userId', '==', user.uid));
      const entSnap = await getDocs(entQ);

      let purchasedCount = 0;
      if (!entSnap.empty) {
        const fileIds = entSnap.docs.map(d => (d.data() || {}).fileId).filter(Boolean);
        const results = await Promise.all(
          fileIds.map(fid =>
            getDoc(doc(db, 'sheets', fid))
              .then(s => s.exists() ? s.data() : null)
              .catch(() => null)
          )
        );
        results.forEach(d => {
          if (!d) return;
          purchasedCount++;
          if (useSingleLayout) {
            if (singleListEl && !singleListEl.querySelector('[data-sec="purchased"]')) {
              const h = document.createElement('div');
              h.dataset.sec = 'purchased';
              h.style.gridColumn = '1/-1';
              h.style.fontWeight = '700';
              h.style.color = '#5b3cc4';
              h.style.margin = '12px 0 4px';
              h.textContent = 'Sheets I Purchased';
              singleListEl.appendChild(h);
            }
            singleListEl && singleListEl.appendChild(renderCard(d));
          } else {
            purchasedListEl && purchasedListEl.appendChild(renderCard(d));
          }
        });
      }
      if (!useSingleLayout && purchasedCount === 0 && noPurchasedEl) {
        noPurchasedEl.style.display = 'block';
      }

      // ---------- 2) ชีทที่อัปโหลด ----------
      const upQ = query(collection(db, 'sheets'), where('user', '==', user.email));
      const upSnap = await getDocs(upQ);

      let uploadedCount = 0;
      if (!upSnap.empty) {
        upSnap.forEach(docSnap => {
          uploadedCount++;
          const data = docSnap.data();
          if (useSingleLayout) {
            if (singleListEl && !singleListEl.querySelector('[data-sec="uploaded"]')) {
              const h = document.createElement('div');
              h.dataset.sec = 'uploaded';
              h.style.gridColumn = '1/-1';
              h.style.fontWeight = '700';
              h.style.color = '#5b3cc4';
              h.style.margin = '16px 0 4px';
              h.textContent = 'Sheets I Uploaded';
              singleListEl.appendChild(h);
            }
            singleListEl && singleListEl.appendChild(renderCard(data));
          } else {
            uploadedListEl && uploadedListEl.appendChild(renderCard(data));
          }
        });
      }
      if (!useSingleLayout && uploadedCount === 0 && noUploadedEl) {
        noUploadedEl.style.display = 'block';
      }

      // ---------- กรณีไม่มีอะไรเลย (layout เก่า) ----------
      if (useSingleLayout) {
        const hasAny = (purchasedCount + uploadedCount) > 0;
        if (!hasAny && noSheetMsgEl) {
          noSheetMsgEl.style.display = 'block';
          noSheetMsgEl.textContent = 'ยังไม่มีชีทที่คุณซื้อหรืออัปโหลด';
        }
      }

    } catch (err) {
      console.error('[mysheet] error:', err);
      if (useSingleLayout) {
        if (noSheetMsgEl) {
          noSheetMsgEl.style.display = 'block';
          noSheetMsgEl.textContent = 'เกิดข้อผิดพลาดในการโหลดรายการ';
        }
      } else {
        if (noPurchasedEl) { noPurchasedEl.style.display = 'block'; noPurchasedEl.textContent = 'โหลดไม่สำเร็จ'; }
        if (noUploadedEl)  { noUploadedEl.style.display  = 'block'; noUploadedEl.textContent  = 'โหลดไม่สำเร็จ'; }
      }
    } finally {
      hideSpinner();
    }
  });
});
