import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
  const userEmailSpan = document.getElementById('userEmail');
  const profileImg = document.getElementById('profileImg');
  const profileImgInput = document.getElementById('profileImgInput');
  const profileNameInput = document.getElementById('profileNameInput');
  const saveProfileBtn = document.getElementById('saveProfileBtn');

  let userDocRef = null;

  onAuthStateChanged(auth, async (user) => {
    if (user && user.email) {
      userEmailSpan.textContent = user.email;
      userEmailSpan.style.display = 'inline';

      // ดึงข้อมูลโปรไฟล์จาก Firestore
      const q = query(collection(db, 'users'), where('email', '==', user.email));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const data = querySnapshot.docs[0].data();
        userDocRef = querySnapshot.docs[0].ref;
        profileImg.src = data.photoURL || '../pic/placeholder.png';
        profileNameInput.value = data.displayName || '';
      } else {
        profileImg.src = '../pic/placeholder.png';
        profileNameInput.value = '';
      }
    } else {
      userEmailSpan.textContent = '-';
      window.location.href = 'login.html';
    }
  });

  profileImgInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        profileImg.src = evt.target.result;
        profileImg.dataset.base64 = evt.target.result;
      };
      reader.readAsDataURL(file);
    }
  });

  saveProfileBtn.addEventListener('click', async () => {
    if (!userDocRef) return;
    const newName = profileNameInput.value.trim();
    const newPhoto = profileImg.dataset.base64 || profileImg.src;
    await updateDoc(userDocRef, {
      displayName: newName,
      photoURL: newPhoto
    });
    alert('บันทึกโปรไฟล์เรียบร้อยแล้ว!');
    window.location.href = 'myprofile.html';
  });
});
