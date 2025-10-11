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
  const purchasedListEl = document.getElementById('mysheetPurchased');
  const uploadedListEl  = document.getElementById('mysheetUploaded');
  const noPurchasedEl   = document.getElementById('noPurchased');
  const noUploadedEl    = document.getElementById('noUploaded');
  const sheetLoading    = document.getElementById('sheetLoading');

  /* =============== 🕒 SYSTEM CONFIG =============== */
  const OTP_DELAY_MS = 3 * 60 * 1000; // 3 นาที
  let otpCooldown = {}; // เก็บเวลาที่ส่งล่าสุด: { fileId: timestamp }

  /* ---------- Helper ฟังก์ชัน ---------- */
  const canRequestOTP = (fileId) => {
    const last = otpCooldown[fileId];
    return !last || (Date.now() - last) > OTP_DELAY_MS;
  };

  const startCooldown = (fileId, btn, counterEl) => {
    otpCooldown[fileId] = Date.now();
    let remain = 180;
    btn.disabled = true;

    const updateText = () => {
      const min = Math.floor(remain / 60);
      const sec = remain % 60;
      counterEl.textContent = `ขอรหัสใหม่ได้ใน ${min}:${sec.toString().padStart(2, '0')} นาที`;
    };
    updateText();

    const timer = setInterval(() => {
      remain--;
      updateText();
      if (remain <= 0) {
        clearInterval(timer);
        btn.disabled = false;
        counterEl.textContent = '';
        btn.textContent = 'ขอรหัสอีกครั้ง';
      }
    }, 1000);
  };

  const hideSpinner = () => { if (sheetLoading) sheetLoading.style.display = 'none'; };

  /* =============== 🧾 RENDER CARD =============== */
  const renderCard = (data, fileId, userEmail) => {
    const card = document.createElement('div');
    card.className = 'sheet-card';
    const coverSrc = data.coverUrl || data.coverBase64 || '../pic/placeholder.png';
    const tag = `${data.type || 'ทั่วไป'} | เทอม ${data.semester || '-'} / ${data.year || '-'}`;
    const author = data.author || userEmail;

    card.innerHTML = `
      <div class="sheet-tag">${tag}</div>
      <div style="display:flex;gap:12px;align-items:center;">
        <img class="cover" src="${coverSrc}" alt="cover" style="width:80px;height:80px;border-radius:8px;object-fit:cover;background:#ddd">
        <div style="flex:1;text-align:left;">
          <div><b>${data.sheetName || ''}</b></div>
          <div>รหัสวิชา: ${data.subjectCode || '-'}</div>
          <div>คณะ: ${data.faculty || '-'}</div>
          <div>ผู้จัดทำ: ${author}</div>
        </div>
      </div>

      <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="open-btn btn-primary" data-id="${fileId}">ขอรหัส OTP</button>
        <button class="resend-btn btn-outline" data-id="${fileId}" disabled>ขอรหัสอีกครั้ง</button>
      </div>

      <div class="otp-box" data-id="${fileId}" style="margin-top:10px;">
        <input type="text" class="otp-input" placeholder="กรอกรหัส OTP ที่ได้รับ" maxlength="6"
          style="padding:8px;border:1px solid #ccc;border-radius:6px;width:100%;text-align:center;font-size:16px;">
        <div class="otp-timer" style="margin-top:6px;color:#6a1b9a;font-size:14px;"></div>
      </div>
    `;
    return card;
  };

  /* =============== 👤 LOAD SHEETS =============== */
  onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = 'login.html';
    userEmailSpan.textContent = user.email;
    sheetLoading.style.display = 'flex';

    const entQ = query(collection(db, 'entitlements'), where('userId', '==', user.uid));
    const entSnap = await getDocs(entQ);
    purchasedListEl.innerHTML = '';
    uploadedListEl.innerHTML = '';

    if (!entSnap.empty) {
      for (const d of entSnap.docs) {
        const fileId = d.data().fileId;
        const sSnap = await getDoc(doc(db, 'sheets', fileId));
        if (!sSnap.exists()) continue;
        const sheetData = sSnap.data();
        purchasedListEl.appendChild(renderCard(sheetData, fileId, user.email));
      }
    } else {
      noPurchasedEl.style.display = 'block';
    }

    hideSpinner();
  });

  /* =============== ⚡ EVENT LISTENER =============== */
  document.addEventListener('click', async (e) => {
    const user = auth.currentUser;
    if (!user) return alert('กรุณาเข้าสู่ระบบก่อน');

    // --- ปุ่มเปิดชีท ---
    if (e.target.classList.contains('open-btn')) {
      const btn = e.target;
      const fileId = btn.dataset.id;
      const token = await user.getIdToken();
      const resendBtn = btn.parentElement.querySelector('.resend-btn');
      const otpInput = document.querySelector(`.otp-box[data-id="${fileId}"] .otp-input`);
      const otpTimer = document.querySelector(`.otp-box[data-id="${fileId}"] .otp-timer`);

      try {
        if (!canRequestOTP(fileId))
          return alert('กรุณารอ 3 นาที ก่อนขอรหัสใหม่');

        // ✅ เรียก Cloud Function ส่ง OTP
        const res = await fetch('https://us-central1-project-sharesheet2.cloudfunctions.net/rotate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': 'myadmin'
          },
          body: JSON.stringify({ fileId, toEmail: user.email })
        });

        if (!res.ok) throw new Error(await res.text());
        alert('📩 ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว!');
        resendBtn.disabled = true;
        startCooldown(fileId, resendBtn, otpTimer);

      } catch (err) {
        alert('❌ เกิดข้อผิดพลาด: ' + err.message);
      }
    }

    // --- ปุ่มขอรหัสอีกครั้ง ---
    if (e.target.classList.contains('resend-btn')) {
      const btn = e.target;
      const fileId = btn.dataset.id;
      const otpTimer = document.querySelector(`.otp-box[data-id="${fileId}"] .otp-timer`);
      if (!canRequestOTP(fileId))
        return alert('โปรดรอ 3 นาทีเพื่อขอรหัสใหม่อีกครั้ง');

      try {
        const user = auth.currentUser;
        const res = await fetch('https://us-central1-project-sharesheet2.cloudfunctions.net/rotate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-admin-key': 'myadmin'
          },
          body: JSON.stringify({ fileId, toEmail: user.email })
        });
        if (!res.ok) throw new Error(await res.text());
        alert('📧 ระบบได้ส่งรหัสใหม่ให้แล้ว');
        startCooldown(fileId, btn, otpTimer);
      } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
      }
    }

    // --- เมื่อกรอกรหัส OTP ครบ 6 หลัก ---
    if (e.target.classList.contains('otp-input')) {
      e.target.addEventListener('input', async (ev) => {
        const code = ev.target.value.trim();
        const fileId = ev.target.closest('.otp-box').dataset.id;
        if (code.length !== 6) return;
        try {
          const token = await auth.currentUser.getIdToken();
          const verifyRes = await fetch('https://us-central1-project-sharesheet2.cloudfunctions.net/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({ fileId, code })
          });
          if (!verifyRes.ok) throw new Error(await verifyRes.text());
          alert('✅ ยืนยันสำเร็จ! กำลังเปิดชีท...');
          window.location.href = `viewer.html?id=${encodeURIComponent(fileId)}`;
        } catch (err) {
          alert('❌ รหัสไม่ถูกต้องหรือหมดอายุ');
          ev.target.value = '';
        }
      });
    }
  });
});
