import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const userEmailSpan = document.getElementById('userEmail');
onAuthStateChanged(auth, (user) => {
  if (user) {
    userEmailSpan.textContent = user.email;
  } else {
    window.location.href = 'login.html';
  }
});

const container = document.getElementById('sheetDetailContainer');

function getSheetIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

async function loadSheetDetail() {
  const id = getSheetIdFromUrl();
  if (!id) {
    container.innerHTML = '<p>ไม่พบข้อมูลชีทนี้</p>';
    return;
  }
  const docRef = doc(db, 'sheets', id);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    container.innerHTML = '<p>ไม่พบข้อมูลชีทนี้</p>';
    return;
  }
  const data = docSnap.data();
  container.innerHTML = `
    <div class="sheet-detail-left">
      <img src="${data.coverUrl || '../img/no-image.png'}" alt="cover">
      <div style="font-size:20px;margin-top:12px;">
        <strong>จำนวนหน้า:</strong> (${data.pageCount !== undefined ? 'จำนวนหน้า' : '-'}) ${data.pageCount || '-'}<br>
        <strong>ราคา:</strong> (ราคา) ${data.price || '-'} บาท
      </div>
      <div style="font-size:18px;margin-top:12px;">
        <strong>คะแนนรีวิว:</strong> (คะแนนรีวิว) ${data.reviewScore || '-'} / 5
      </div>
    </div>
    <div class="sheet-detail-right">
      <div class="code"><strong>รหัสวิชา:</strong> (รหัสวิชา) ${data.subjectCode || '-'}</div>
      <div class="info">
        <strong>ชื่อชีท:</strong> (ชื่อชีท) ${data.sheetName || '-'}<br>
        <strong>รายละเอียด:</strong> (รายละเอียด) ${data.description || '-'}<br>
        <strong>คณะ:</strong> (คณะ) ${data.faculty || '-'}<br>
        <strong>สาขา:</strong> (สาขา) ${data.major || '-'}<br>
        <strong>เทอม:</strong> (เทอม) ${data.semester || '-'}<br>
        <strong>ปีการศึกษา:</strong> (ปีการศึกษา) ${data.year || '-'}<br>
      </div>
      <div class="actions">
        <button>ซื้อชีท</button> 
      </div>
    </div>
  `;
}

loadSheetDetail();
