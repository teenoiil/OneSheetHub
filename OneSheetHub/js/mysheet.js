import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import {
  getFirestore, collection, query, where, getDocs, getDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

document.addEventListener('DOMContentLoaded', () => {
  const userEmailSpan   = document.getElementById('userEmail');
  const purchasedListEl = document.getElementById('mysheetPurchased');
  const uploadedListEl  = document.getElementById('mysheetUploaded');
  const noPurchasedEl   = document.getElementById('noPurchased');
  const noUploadedEl    = document.getElementById('noUploaded');
  const sheetLoading    = document.getElementById('sheetLoading');

  const OTP_DELAY_MS = 3 * 60 * 1000; // 3 นาที
  let otpCooldown = {}; // { fileId: timestamp }

  const hideSpinner = () => { if (sheetLoading) sheetLoading.style.display = 'none'; };

  /* 🕒 ตรวจสอบ Cooldown การขอรหัส */
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

  /* ========================== 🧾 ชีทที่ "ซื้อ" ========================== */
  const renderPurchasedCard = (data, fileId, userEmail) => {
    const card = document.createElement('div');
    card.className = 'sheet-card';
    const coverSrc = data.coverUrl || data.coverBase64 || '../pic/placeholder.png';
    const tag = `${data.type || 'ทั่วไป'} | เทอม ${data.semester || '-'} / ${data.year || '-'}`;
    const author = data.author || '-';

    card.innerHTML = `
      <div class="sheet-tag">${tag}</div>
      <div style="display:flex;gap:12px;align-items:center;">
        <img class="cover" src="${coverSrc}" alt="cover" style="width:80px;height:80px;border-radius:8px;object-fit:cover;background:#ddd">
        <div style="flex:1;text-align:left;">
          <div><b>${data.sheetName || ''}</b></div>
          <div>รหัสวิชา: ${data.subjectCode || '-'}</div>
          <div>ผู้จัดทำ: ${author}</div>
          <div>ราคา: ${data.price || 0}฿</div>
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

  /* ========================== 🧩 ชีทที่ "อัปโหลดเอง" ========================== */
  const renderUploadedCard = (data, fileId) => {
    const card = document.createElement('div');
    card.className = 'sheet-card';
    const coverSrc = data.coverUrl || '../pic/placeholder.png';
    card.innerHTML = `
      <div style="display:flex;gap:12px;align-items:center;">
        <img class="cover" src="${coverSrc}" alt="cover">
        <div style="flex:1;text-align:left;">
          <div><b>${data.sheetName || ''}</b></div>
          <div>รหัสวิชา: ${data.subjectCode || '-'}</div>
          <div>ราคา: ${data.price || 0}฿</div>
        </div>
      </div>
      <div class="actions">
        <button class="edit-btn" data-id="${fileId}">✏️ แก้ไขข้อมูล</button>
      </div>
    `;
    return card;
  };

  /* ========================== โหลดข้อมูล ========================== */
  onAuthStateChanged(auth, async (user) => {
    if (!user) return window.location.href = 'login.html';
    userEmailSpan.textContent = user.email;
    sheetLoading.style.display = 'flex';

    purchasedListEl.innerHTML = '';
    uploadedListEl.innerHTML = '';

    // 🔹 โหลดชีทที่ซื้อ
    const entQ = query(collection(db, 'entitlements'), where('userId', '==', user.uid));
    const entSnap = await getDocs(entQ);
    if (!entSnap.empty) {
      for (const d of entSnap.docs) {
        const fileId = d.data().fileId;
        const sSnap = await getDoc(doc(db, 'sheets', fileId));
        if (!sSnap.exists()) continue;
        purchasedListEl.appendChild(renderPurchasedCard(sSnap.data(), fileId, user.email));
      }
    } else {
      noPurchasedEl.style.display = 'block';
    }

    // 🔹 โหลดชีทที่อัปโหลดเอง
    const myQ = query(collection(db, 'sheets'), where('ownerEmail', '==', user.email));
    const mySnap = await getDocs(myQ);
    if (!mySnap.empty) {
      mySnap.forEach((docSnap) => {
        uploadedListEl.appendChild(renderUploadedCard(docSnap.data(), docSnap.id));
      });
    } else {
      noUploadedEl.style.display = 'block';
    }

    hideSpinner();
  });

  /* ========================== 🔐 EVENT OTP ========================== */
  document.addEventListener('click', async (e) => {
    const user = auth.currentUser;
    if (!user) return alert('กรุณาเข้าสู่ระบบก่อน');

    // ✅ ขอรหัส OTP
    if (e.target.classList.contains('open-btn')) {
      const btn = e.target;
      const fileId = btn.dataset.id;
      const resendBtn = btn.parentElement.querySelector('.resend-btn');
      const otpTimer = document.querySelector(`.otp-box[data-id="${fileId}"] .otp-timer`);
      if (!canRequestOTP(fileId)) return alert('กรุณารอ 3 นาที ก่อนขอรหัสใหม่');

      try {
        const res = await fetch('https://us-central1-project-sharesheet2.cloudfunctions.net/rotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': 'myadmin' },
          body: JSON.stringify({ fileId, toEmail: user.email })
        });
        if (!res.ok) throw new Error(await res.text());
        alert('📩 ส่งรหัส OTP ไปยังอีเมลของคุณแล้ว!');
        startCooldown(fileId, resendBtn, otpTimer);
      } catch (err) {
        alert('❌ เกิดข้อผิดพลาด: ' + err.message);
      }
    }

    // ✅ ขอรหัสอีกครั้ง
    if (e.target.classList.contains('resend-btn')) {
      const btn = e.target;
      const fileId = btn.dataset.id;
      const otpTimer = document.querySelector(`.otp-box[data-id="${fileId}"] .otp-timer`);
      if (!canRequestOTP(fileId)) return alert('โปรดรอ 3 นาทีเพื่อขอรหัสใหม่อีกครั้ง');

      try {
        const res = await fetch('https://us-central1-project-sharesheet2.cloudfunctions.net/rotate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-key': 'myadmin' },
          body: JSON.stringify({ fileId, toEmail: user.email })
        });
        if (!res.ok) throw new Error(await res.text());
        alert('📧 ระบบได้ส่งรหัสใหม่ให้แล้ว');
        startCooldown(fileId, btn, otpTimer);
      } catch (err) {
        alert('เกิดข้อผิดพลาด: ' + err.message);
      }
    }
  });

  // ✅ เมื่อกรอกรหัส OTP ครบ 6 หลัก
  document.addEventListener('input', async (ev) => {
    if (!ev.target.classList.contains('otp-input')) return;
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

  /* ========================== ✏️ MODAL (แก้ไขชีทตัวเอง) ========================== */
  const modalHTML = `
    <div id="editModal" class="modal">
      <div class="modal-content">
        <h3>แก้ไขข้อมูลชีท</h3>
        <img id="editCoverPreview" src="" alt="cover" class="cover-preview">
        <input type="file" id="editCoverFile" accept="image/*" style="display:none;">
        <button id="changeCoverBtn" class="btn-small">เปลี่ยนภาพปก</button>
        <label>ชื่อชีท:</label>
        <input type="text" id="editName" placeholder="ชื่อชีท">
        <label>คำอธิบาย:</label>
        <textarea id="editDesc" rows="3" placeholder="คำอธิบายชีท..."></textarea>
        <label>ราคา (บาท):</label>
        <input type="number" id="editPrice" min="0" step="1">
        <div style="text-align:center;margin-top:16px;">
          <button id="saveEditBtn" class="btn-primary">บันทึก</button>
          <button id="cancelEditBtn" class="btn-outline">ยกเลิก</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const modal = document.getElementById('editModal');
  const nameInput = document.getElementById('editName');
  const descInput = document.getElementById('editDesc');
  const priceInput = document.getElementById('editPrice');
  const coverPreview = document.getElementById('editCoverPreview');
  const coverFileInput = document.getElementById('editCoverFile');
  const changeCoverBtn = document.getElementById('changeCoverBtn');
  const saveBtn = document.getElementById('saveEditBtn');
  const cancelBtn = document.getElementById('cancelEditBtn');
  let currentDocRef = null;
  let newCoverFile = null;

  cancelBtn.onclick = () => modal.style.display = 'none';
  changeCoverBtn.onclick = () => coverFileInput.click();
  coverFileInput.onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      newCoverFile = file;
      coverPreview.src = URL.createObjectURL(file);
    }
  };

  document.addEventListener('click', async (e) => {
    if (!e.target.classList.contains('edit-btn')) return;
    const id = e.target.dataset.id;
    const snap = await getDoc(doc(db, 'sheets', id));
    if (!snap.exists()) return alert('ไม่พบชีทนี้');
    const data = snap.data();

    currentDocRef = doc(db, 'sheets', id);
    nameInput.value = data.sheetName || '';
    descInput.value = data.description || '';
    priceInput.value = data.price || 0;
    coverPreview.src = data.coverUrl || '../pic/placeholder.png';
    newCoverFile = null;
    modal.style.display = 'flex';
  });

  saveBtn.onclick = async () => {
    if (!currentDocRef) return;
    const newName = nameInput.value.trim();
    const newDesc = descInput.value.trim();
    const newPrice = parseFloat(priceInput.value);

    try {
      let updateData = { sheetName: newName, description: newDesc, price: newPrice };
      if (newCoverFile) {
        const path = `covers/${auth.currentUser.uid}_${Date.now()}_${newCoverFile.name}`;
        const coverRef = ref(storage, path);
        await uploadBytes(coverRef, newCoverFile);
        const url = await getDownloadURL(coverRef);
        updateData.coverUrl = url;
      }
      await updateDoc(currentDocRef, updateData);
      alert('✅ แก้ไขข้อมูลเรียบร้อย!');
      modal.style.display = 'none';
      location.reload();
    } catch (err) {
      console.error(err);
      alert('❌ เกิดข้อผิดพลาดในการอัปเดต');
    }
  };
});
