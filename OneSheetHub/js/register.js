import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, updateProfile } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";
import { getFirestore, setDoc, doc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const registerForm = document.querySelector('.register-form');
const errorMsg = document.createElement('p');
errorMsg.style.color = 'red';
errorMsg.style.textAlign = 'center';
registerForm.appendChild(errorMsg);

registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = registerForm.querySelector('input[type=email]').value;
  const password = registerForm.querySelectorAll('input[type=password]')[0].value;
  const confirmPassword = registerForm.querySelectorAll('input[type=password]')[1].value;
  const displayName = registerForm.querySelector('input[name=displayName]')?.value || "";
  const photoURL = registerForm.querySelector('input[name=photoURL]')?.value || "";

  if (password !== confirmPassword) {
    errorMsg.textContent = 'รหัสผ่านไม่ตรงกัน';
    return;
  }

  try {
    // สมัครสมาชิกกับ Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    // อัปเดตโปรไฟล์ใน Auth
    await updateProfile(user, { displayName, photoURL });
    // สร้างข้อมูล user ใน Firestore (collection 'users', id เป็น uid)
    await setDoc(doc(db, "users", user.uid), {
      email: user.email,
      displayName: displayName,
      photoURL: photoURL,
      createdAt: new Date().toISOString()
    });
    errorMsg.style.color = 'green';
    errorMsg.textContent = 'สมัครสมาชิกสำเร็จ!';
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 1500);
  } catch (error) {
    errorMsg.textContent = error.message;
  }
});
