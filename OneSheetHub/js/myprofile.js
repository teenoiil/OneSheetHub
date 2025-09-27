import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
  const userEmailSpan = document.getElementById('userEmail');
  const profileImg = document.getElementById('profileImg');
  const profileName = document.getElementById('profileName');
  const profileCreated = document.getElementById('profileCreated');
  const profileEmail = document.getElementById('profileEmail');
  const editProfileBtn = document.getElementById('editProfileBtn');

  onAuthStateChanged(auth, async (user) => {
    if (user && user.email) {
      userEmailSpan.textContent = user.email;
      userEmailSpan.style.display = 'inline';

      // ดึงข้อมูลโปรไฟล์จาก Firestore
      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        profileImg.src = data.photoURL || '../pic/placeholder.png';
        profileName.textContent = data.displayName || '-';
        profileCreated.textContent = data.createdAt ? new Date(data.createdAt).toLocaleString('th-TH') : '-';
        profileEmail.textContent = data.email || '-';
      } else {
        profileImg.src = '../pic/placeholder.png';
        profileName.textContent = '-';
        profileCreated.textContent = '-';
        profileEmail.textContent = user.email;
      }

      // กดแก้ไขโปรไฟล์
      editProfileBtn.onclick = async () => {
        const newName = prompt('กรุณาใส่ชื่อใหม่:', profileName.textContent);
        if (newName && querySnapshot.docs[0]) {
          await updateDoc(querySnapshot.docs[0].ref, { displayName: newName });
          profileName.textContent = newName;
        }
      };
    } else {
      userEmailSpan.textContent = '-';
      window.location.href = 'login.html';
    }
  });
});
