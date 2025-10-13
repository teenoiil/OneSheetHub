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
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

document.addEventListener('DOMContentLoaded', () => {
  const userEmailSpan = document.getElementById('userEmail');
  const profileImg = document.getElementById('profileImg');
  const profileImgInput = document.getElementById('profileImgInput');
  const profileNameInput = document.getElementById('profileNameInput');
  const saveProfileBtn = document.getElementById('saveProfileBtn');

  let userRef = null;
  let newImageFile = null;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    userEmailSpan.textContent = user.email;
    userEmailSpan.style.display = 'inline';

    userRef = doc(db, 'users', user.uid);
    let userSnap = await getDoc(userRef);

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
    profileImg.src = data.photoURL || '../pic/placeholder.png';
    profileNameInput.value = data.displayName || '';
  });

  
  profileImgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      newImageFile = file;
      const reader = new FileReader();
      reader.onload = (evt) => {
        profileImg.src = evt.target.result; 
      };
      reader.readAsDataURL(file);
    }
  });

  
  saveProfileBtn.addEventListener('click', async () => {
    const user = auth.currentUser;
    if (!user || !userRef) return;

    const newName = profileNameInput.value.trim();
    let photoURL = profileImg.src;

    try {
      
      if (newImageFile) {
        const imgRef = ref(storage, `profiles/${user.uid}/${newImageFile.name}`);
        await uploadBytes(imgRef, newImageFile);
        photoURL = await getDownloadURL(imgRef);
      }

      
      await updateDoc(userRef, {
        displayName: newName,
        photoURL: photoURL
      });

      
      await updateProfile(user, {
        displayName: newName,
        photoURL: photoURL
      });

      alert('✅ บันทึกโปรไฟล์เรียบร้อยแล้ว!');
      window.location.href = 'myprofile.html';
    } catch (err) {
      console.error('Error updating profile:', err);
      alert('❌ ไม่สามารถบันทึกข้อมูลได้: ' + err.message);
    }
  });
});
