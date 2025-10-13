import firebaseConfig from './firebaseConfig.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const emailOrUser = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;

  
  try {
    await signInWithEmailAndPassword(auth, emailOrUser, password);
    window.location.assign('/html/home.html'); 
  } catch (error) {
    loginError.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
  }
});
