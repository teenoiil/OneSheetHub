import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { 
  getAuth, 
  onAuthStateChanged, 
  updateProfile 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc 
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

document.addEventListener('DOMContentLoaded', () => {
  const userEmailSpan = document.getElementById('userEmail');
  const profileImg = document.getElementById('profileImg');
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    userEmailSpan.textContent = user.email;
    userEmailSpan.style.display = 'inline';

    const userRef = doc(db, 'users', user.uid);
    let userSnap = await getDoc(userRef);

    // ถ้ายังไม่มีข้อมูล → สร้างใหม่อัตโนมัติ
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        email: user.email,
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        createdAt: new Date().toISOString()
      });
      userSnap = await getDoc(userRef);
    }

    const data = userSnap.data();

    // แสดงข้อมูล
    profileImg.src = data.photoURL || '../pic/placeholder.png';
    profileName.textContent = data.displayName || user.displayName || '-';
    profileEmail.textContent = data.email || user.email;
  });
});
